import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ClickHouseService } from '../clickhouse/clickhouse.service';
import {
  CreateExportJobDto,
  GetExportJobsDto,
  CreateBatchExportDto,
  CreateAutoExportDto,
  UpdateAutoExportDto,
  CreateExportTemplateDto,
  ExportDataDto,
  ScheduleExportDto,
} from './dto/export.dto';
import {
  ExportJob,
  ExportType,
  ExportFormat,
  ExportStatus,
  ExportResult,
  ExportTemplate,
  AutoExportConfig,
  BatchExportJob,
  ExportStatistics,
  ExportPreset,
  ExportPresetCategory,
} from './interfaces/export.interface';
import { v4 as uuidv4 } from 'uuid';
import * as ExcelJS from 'exceljs';
import * as PDFDocument from 'pdfkit';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class ExportService {
  private readonly logger = new Logger(ExportService.name);
  
  // In-memory хранилища для демонстрации
  private readonly exportJobs = new Map<string, ExportJob>();
  private readonly batchJobs = new Map<string, BatchExportJob>();
  private readonly autoExports = new Map<string, AutoExportConfig>();
  private readonly templates = new Map<string, ExportTemplate>();
  private readonly presets = new Map<string, ExportPreset>();

  // Очередь заданий
  private readonly jobQueue: string[] = [];
  private readonly processingJobs = new Set<string>();

  constructor(
    private readonly clickhouseService: ClickHouseService,
    private readonly eventEmitter: EventEmitter2,
  ) {
    this.initializePresets();
    this.initializeDefaultTemplates();
  }

  async createExportJob(dto: CreateExportJobDto, userId: string): Promise<ExportJob> {
    this.logger.log(`📤 Создание задания экспорта: ${dto.title} (${dto.format})`);

    const job: ExportJob = {
      id: uuidv4(),
      type: dto.type,
      format: dto.format,
      status: ExportStatus.QUEUED,
      progress: 0,
      title: dto.title,
      description: dto.description,
      config: {
        source: dto.source,
        options: dto.options || {},
        filters: dto.filters,
        template: dto.templateId ? this.templates.get(dto.templateId) : undefined,
      },
      createdAt: new Date(),
      createdBy: userId,
      expiresAt: new Date(Date.now() + (dto.retentionDays || 7) * 24 * 60 * 60 * 1000),
    };

    this.exportJobs.set(job.id, job);
    this.jobQueue.push(job.id);

    this.eventEmitter.emit('export.job.created', {
      jobId: job.id,
      type: job.type,
      format: job.format,
      userId,
    });

    // Запускаем обработку если есть свободные слоты
    setImmediate(() => this.processQueue());

    this.logger.log(`✅ Задание экспорта создано: ${job.id}`);
    return job;
  }

  async getExportJobs(dto: GetExportJobsDto, userId: string): Promise<{
    jobs: ExportJob[];
    total: number;
    page: number;
    limit: number;
  }> {
    let jobs = Array.from(this.exportJobs.values());

    // Фильтрация по пользователю
    if (dto.myOnly) {
      jobs = jobs.filter(j => j.createdBy === userId);
    }

    // Фильтрация по типу, формату, статусу
    if (dto.type) {
      jobs = jobs.filter(j => j.type === dto.type);
    }
    if (dto.format) {
      jobs = jobs.filter(j => j.format === dto.format);
    }
    if (dto.status) {
      jobs = jobs.filter(j => j.status === dto.status);
    }

    // Поиск по названию
    if (dto.search) {
      const search = dto.search.toLowerCase();
      jobs = jobs.filter(j => 
        j.title.toLowerCase().includes(search) ||
        j.description?.toLowerCase().includes(search)
      );
    }

    // Фильтрация по датам
    if (dto.createdFrom) {
      const createdFrom = new Date(dto.createdFrom);
      jobs = jobs.filter(j => j.createdAt >= createdFrom);
    }
    if (dto.createdTo) {
      const createdTo = new Date(dto.createdTo);
      jobs = jobs.filter(j => j.createdAt <= createdTo);
    }

    // Сортировка по дате создания (новые сначала)
    jobs.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    // Пагинация
    const offset = (dto.page - 1) * dto.limit;
    const paginatedJobs = jobs.slice(offset, offset + dto.limit);

    return {
      jobs: paginatedJobs,
      total: jobs.length,
      page: dto.page,
      limit: dto.limit,
    };
  }

  async getExportJob(jobId: string, userId: string): Promise<ExportJob> {
    const job = this.exportJobs.get(jobId);
    if (!job) {
      throw new NotFoundException(`Задание экспорта с ID ${jobId} не найдено`);
    }

    // Проверка доступа (упрощенная)
    if (job.createdBy !== userId) {
      // В реальной системе здесь будут более сложные правила доступа
    }

    return job;
  }

  async cancelExportJob(jobId: string, userId: string): Promise<ExportJob> {
    const job = await this.getExportJob(jobId, userId);

    if (job.status === ExportStatus.COMPLETED || job.status === ExportStatus.FAILED) {
      throw new BadRequestException('Нельзя отменить завершенное задание');
    }

    job.status = ExportStatus.CANCELLED;
    this.exportJobs.set(jobId, job);

    // Удаляем из очереди
    const queueIndex = this.jobQueue.indexOf(jobId);
    if (queueIndex > -1) {
      this.jobQueue.splice(queueIndex, 1);
    }

    this.eventEmitter.emit('export.job.cancelled', { jobId, userId });

    this.logger.log(`❌ Задание экспорта отменено: ${jobId}`);
    return job;
  }

  async downloadExportFile(jobId: string, userId: string): Promise<{
    filePath: string;
    fileName: string;
    mimeType: string;
  }> {
    const job = await this.getExportJob(jobId, userId);

    if (job.status !== ExportStatus.COMPLETED || !job.result) {
      throw new BadRequestException('Файл не готов для скачивания');
    }

    // Проверяем, что файл существует
    if (!fs.existsSync(job.result.filePath)) {
      throw new NotFoundException('Файл не найден на диске');
    }

    this.eventEmitter.emit('export.file.downloaded', {
      jobId,
      userId,
      fileName: job.result.fileName,
    });

    return {
      filePath: job.result.filePath,
      fileName: job.result.fileName,
      mimeType: job.result.mimeType,
    };
  }

  async createBatchExport(dto: CreateBatchExportDto, userId: string): Promise<BatchExportJob> {
    this.logger.log(`📦 Создание пакетного экспорта: ${dto.name}`);

    const batchJob: BatchExportJob = {
      id: uuidv4(),
      name: dto.name,
      jobs: [],
      status: ExportStatus.QUEUED,
      progress: 0,
      createdAt: new Date(),
      createdBy: userId,
    };

    // Создаем все задания экспорта
    for (const jobDto of dto.jobs) {
      const job = await this.createExportJob(jobDto, userId);
      batchJob.jobs.push(job);
    }

    this.batchJobs.set(batchJob.id, batchJob);

    this.eventEmitter.emit('export.batch.created', {
      batchId: batchJob.id,
      jobsCount: batchJob.jobs.length,
      userId,
    });

    return batchJob;
  }

  async createAutoExport(dto: CreateAutoExportDto, userId: string): Promise<AutoExportConfig> {
    this.logger.log(`🔄 Создание автоматического экспорта: ${dto.name}`);

    const autoExport: AutoExportConfig = {
      id: uuidv4(),
      name: dto.name,
      enabled: dto.enabled ?? true,
      trigger: dto.trigger,
      source: dto.source,
      format: dto.format,
      recipients: dto.recipients,
      conditions: dto.conditions,
      template: dto.templateId ? this.templates.get(dto.templateId) : undefined,
      retentionDays: dto.retentionDays || 30,
      createdBy: userId,
      createdAt: new Date(),
      nextRun: this.calculateNextRun(dto.trigger),
    };

    this.autoExports.set(autoExport.id, autoExport);

    this.eventEmitter.emit('export.auto.created', {
      autoExportId: autoExport.id,
      name: autoExport.name,
      userId,
    });

    return autoExport;
  }

  async exportData(dto: ExportDataDto, userId: string): Promise<ExportJob> {
    this.logger.log(`📊 Прямой экспорт данных: ${dto.format}`);

    // Создаем задание экспорта для прямого экспорта данных
    const exportJob: CreateExportJobDto = {
      type: ExportType.RAW_DATA,
      format: dto.format,
      title: dto.fileName || `Data Export ${new Date().toISOString()}`,
      source: {
        type: 'query',
        query: dto.query,
        parameters: dto.parameters,
      },
      options: dto.options,
    };

    return this.createExportJob(exportJob, userId);
  }

  async getExportStatistics(): Promise<ExportStatistics> {
    const jobs = Array.from(this.exportJobs.values());
    const completedJobs = jobs.filter(j => j.status === ExportStatus.COMPLETED);
    const failedJobs = jobs.filter(j => j.status === ExportStatus.FAILED);

    // Подсчет по форматам
    const formatCounts = new Map<ExportFormat, number>();
    jobs.forEach(job => {
      formatCounts.set(job.format, (formatCounts.get(job.format) || 0) + 1);
    });

    const popularFormats = Array.from(formatCounts.entries())
      .map(([format, count]) => ({
        format,
        count,
        percentage: (count / jobs.length) * 100,
      }))
      .sort((a, b) => b.count - a.count);

    // Подсчет по типам
    const typeCounts = new Map<ExportType, number>();
    jobs.forEach(job => {
      typeCounts.set(job.type, (typeCounts.get(job.type) || 0) + 1);
    });

    const popularTypes = Array.from(typeCounts.entries())
      .map(([type, count]) => ({
        type,
        count,
        percentage: (count / jobs.length) * 100,
      }))
      .sort((a, b) => b.count - a.count);

    // Среднее время обработки
    const avgProcessingTime = completedJobs.length > 0
      ? completedJobs.reduce((acc, job) => {
          const processingTime = job.completedAt && job.startedAt
            ? job.completedAt.getTime() - job.startedAt.getTime()
            : 0;
          return acc + processingTime;
        }, 0) / completedJobs.length
      : 0;

    // Общий размер файлов
    const totalFileSize = completedJobs.reduce((acc, job) => {
      return acc + (job.result?.fileSize || 0);
    }, 0);

    // Последние задания
    const recentJobs = jobs
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 10);

    return {
      totalJobs: jobs.length,
      completedJobs: completedJobs.length,
      failedJobs: failedJobs.length,
      avgProcessingTime,
      totalFileSize,
      popularFormats,
      popularTypes,
      recentJobs,
    };
  }

  async getPresets(): Promise<ExportPreset[]> {
    return Array.from(this.presets.values());
  }

  async createTemplate(dto: CreateExportTemplateDto, userId: string): Promise<ExportTemplate> {
    const template: ExportTemplate = {
      id: uuidv4(),
      name: dto.name,
      type: dto.type,
      layout: dto.layout,
      styling: dto.styling || {},
      variables: dto.variables,
    };

    this.templates.set(template.id, template);

    this.eventEmitter.emit('export.template.created', {
      templateId: template.id,
      name: template.name,
      userId,
    });

    this.logger.log(`📄 Шаблон экспорта создан: ${template.id}`);
    return template;
  }

  // Обработка очереди заданий
  @Cron(CronExpression.EVERY_10_SECONDS)
  private async processQueue(): Promise<void> {
    const maxConcurrentJobs = 3; // Максимум одновременных заданий

    while (this.jobQueue.length > 0 && this.processingJobs.size < maxConcurrentJobs) {
      const jobId = this.jobQueue.shift();
      if (jobId && !this.processingJobs.has(jobId)) {
        this.processingJobs.add(jobId);
        setImmediate(() => this.processExportJob(jobId));
      }
    }
  }

  private async processExportJob(jobId: string): Promise<void> {
    const job = this.exportJobs.get(jobId);
    if (!job || job.status !== ExportStatus.QUEUED) {
      this.processingJobs.delete(jobId);
      return;
    }

    try {
      job.status = ExportStatus.PROCESSING;
      job.startedAt = new Date();
      job.progress = 10;

      this.eventEmitter.emit('export.job.started', { jobId, userId: job.createdBy });

      // Получение данных
      job.progress = 30;
      const data = await this.fetchData(job);

      // Генерация файла
      job.progress = 60;
      const result = await this.generateFile(job, data);

      // Завершение
      job.status = ExportStatus.COMPLETED;
      job.progress = 100;
      job.completedAt = new Date();
      job.result = result;

      this.eventEmitter.emit('export.job.completed', {
        jobId,
        userId: job.createdBy,
        fileName: result.fileName,
        fileSize: result.fileSize,
      });

      this.logger.log(`✅ Экспорт завершен: ${jobId} -> ${result.fileName}`);

    } catch (error) {
      job.status = ExportStatus.FAILED;
      job.error = error.message;
      job.completedAt = new Date();

      this.eventEmitter.emit('export.job.failed', {
        jobId,
        userId: job.createdBy,
        error: error.message,
      });

      this.logger.error(`❌ Ошибка экспорта ${jobId}:`, error.message);
    } finally {
      this.exportJobs.set(jobId, job);
      this.processingJobs.delete(jobId);
    }
  }

  private async fetchData(job: ExportJob): Promise<any[]> {
    const { source } = job.config;

    switch (source.type) {
      case 'query':
        if (!source.query) {
          throw new Error('Query не указан для типа query');
        }
        const result = await this.clickhouseService.query(source.query, {
          parameters: source.parameters,
        });
        return result.data;

      case 'report':
        // Здесь будет интеграция с модулем отчетов
        return [{ message: 'Report data not implemented yet' }];

      case 'dashboard':
        // Здесь будет интеграция с модулем дашбордов
        return [{ message: 'Dashboard data not implemented yet' }];

      case 'kpi':
        // Здесь будет интеграция с модулем KPI
        return [{ message: 'KPI data not implemented yet' }];

      default:
        throw new Error(`Неподдерживаемый тип источника: ${source.type}`);
    }
  }

  private async generateFile(job: ExportJob, data: any[]): Promise<ExportResult> {
    const fileName = `${job.title.replace(/[^a-z0-9]/gi, '_')}_${Date.now()}`;
    const exportDir = path.join(process.cwd(), 'exports');
    
    // Создаем директорию если не существует
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true });
    }

    switch (job.format) {
      case ExportFormat.CSV:
        return this.generateCSV(fileName, data, exportDir, job);
      
      case ExportFormat.EXCEL:
        return this.generateExcel(fileName, data, exportDir, job);
      
      case ExportFormat.PDF:
        return this.generatePDF(fileName, data, exportDir, job);
      
      case ExportFormat.JSON:
        return this.generateJSON(fileName, data, exportDir, job);
      
      default:
        throw new Error(`Неподдерживаемый формат: ${job.format}`);
    }
  }

  private async generateCSV(fileName: string, data: any[], exportDir: string, job: ExportJob): Promise<ExportResult> {
    const filePath = path.join(exportDir, `${fileName}.csv`);
    const options = job.config.options;

    let csvContent = '';
    
    if (data.length > 0) {
      const headers = Object.keys(data[0]);
      
      // Заголовки
      if (options.includeHeader !== false) {
        csvContent += headers.join(options.delimiter || ',') + '\n';
      }
      
      // Данные
      for (const row of data) {
        const values = headers.map(header => {
          const value = row[header];
          const stringValue = value !== null && value !== undefined ? String(value) : '';
          // Экранируем запятые и кавычки
          return stringValue.includes(',') || stringValue.includes('"') 
            ? `"${stringValue.replace(/"/g, '""')}"` 
            : stringValue;
        });
        csvContent += values.join(options.delimiter || ',') + '\n';
      }
    }

    fs.writeFileSync(filePath, csvContent, 'utf8');
    const stats = fs.statSync(filePath);

    return {
      filePath,
      fileName: `${fileName}.csv`,
      fileSize: stats.size,
      mimeType: 'text/csv',
      metadata: {
        rows: data.length,
        columns: data.length > 0 ? Object.keys(data[0]).length : 0,
      },
    };
  }

  private async generateExcel(fileName: string, data: any[], exportDir: string, job: ExportJob): Promise<ExportResult> {
    const filePath = path.join(exportDir, `${fileName}.xlsx`);
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(job.config.options.sheetName || 'Data');

    if (data.length > 0) {
      const headers = Object.keys(data[0]);
      
      // Добавляем заголовки
      worksheet.addRow(headers);
      
      // Стилизация заголовков
      const headerRow = worksheet.getRow(1);
      headerRow.eachCell((cell) => {
        cell.font = { bold: true };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFE0E0E0' },
        };
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' },
        };
      });

      // Добавляем данные
      data.forEach(row => {
        const values = headers.map(header => row[header]);
        worksheet.addRow(values);
      });

      // Автоподбор ширины колонок
      if (job.config.options.autoFitColumns !== false) {
        worksheet.columns.forEach(column => {
          let maxLength = 10;
          column.eachCell({ includeEmpty: false }, (cell) => {
            const columnLength = String(cell.value).length;
            if (columnLength > maxLength) {
              maxLength = columnLength;
            }
          });
          column.width = Math.min(maxLength + 2, 50);
        });
      }
    }

    await workbook.xlsx.writeFile(filePath);
    const stats = fs.statSync(filePath);

    return {
      filePath,
      fileName: `${fileName}.xlsx`,
      fileSize: stats.size,
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      metadata: {
        rows: data.length,
        columns: data.length > 0 ? Object.keys(data[0]).length : 0,
      },
    };
  }

  private async generatePDF(fileName: string, data: any[], exportDir: string, job: ExportJob): Promise<ExportResult> {
    const filePath = path.join(exportDir, `${fileName}.pdf`);
    const doc = new PDFDocument();
    const stream = fs.createWriteStream(filePath);
    
    doc.pipe(stream);

    // Заголовок
    doc.fontSize(16).text(job.title, { align: 'center' });
    doc.moveDown();

    // Описание
    if (job.description) {
      doc.fontSize(12).text(job.description);
      doc.moveDown();
    }

    // Данные в виде таблицы (упрощенно)
    if (data.length > 0) {
      const headers = Object.keys(data[0]);
      
      // Заголовки таблицы
      doc.fontSize(10);
      let y = doc.y;
      let x = 50;
      
      headers.forEach((header, index) => {
        doc.text(header, x + index * 100, y, { width: 90 });
      });
      
      doc.moveDown();
      
      // Данные (показываем только первые 50 строк для PDF)
      const limitedData = data.slice(0, 50);
      limitedData.forEach(row => {
        y = doc.y;
        headers.forEach((header, index) => {
          const value = row[header];
          const displayValue = value !== null && value !== undefined ? String(value) : '';
          doc.text(displayValue.substring(0, 20), x + index * 100, y, { width: 90 });
        });
        doc.moveDown();
        
        // Переход на новую страницу при необходимости
        if (doc.y > 700) {
          doc.addPage();
        }
      });
      
      if (data.length > 50) {
        doc.moveDown();
        doc.text(`... и еще ${data.length - 50} строк`, { align: 'center' });
      }
    }

    // Футер
    doc.fontSize(8).text(`Сгенерировано: ${new Date().toLocaleString()}`, 50, 750);

    doc.end();

    return new Promise((resolve, reject) => {
      stream.on('finish', () => {
        const stats = fs.statSync(filePath);
        resolve({
          filePath,
          fileName: `${fileName}.pdf`,
          fileSize: stats.size,
          mimeType: 'application/pdf',
          metadata: {
            rows: data.length,
            columns: data.length > 0 ? Object.keys(data[0]).length : 0,
          },
        });
      });
      
      stream.on('error', reject);
    });
  }

  private async generateJSON(fileName: string, data: any[], exportDir: string, job: ExportJob): Promise<ExportResult> {
    const filePath = path.join(exportDir, `${fileName}.json`);
    
    const jsonData = {
      metadata: {
        title: job.title,
        description: job.description,
        generatedAt: new Date().toISOString(),
        totalRows: data.length,
      },
      data: data,
    };

    const jsonContent = JSON.stringify(jsonData, null, 2);
    fs.writeFileSync(filePath, jsonContent, 'utf8');
    
    const stats = fs.statSync(filePath);

    return {
      filePath,
      fileName: `${fileName}.json`,
      fileSize: stats.size,
      mimeType: 'application/json',
      metadata: {
        rows: data.length,
        columns: data.length > 0 ? Object.keys(data[0]).length : 0,
      },
    };
  }

  // Вспомогательные методы
  private calculateNextRun(trigger: any): Date | undefined {
    if (trigger.type === 'schedule' && trigger.schedule) {
      // Здесь будет логика расчета следующего запуска по cron
      return new Date(Date.now() + 24 * 60 * 60 * 1000); // Заглушка: завтра
    }
    return undefined;
  }

  private initializePresets(): void {
    const operationalPreset: ExportPreset = {
      id: 'operational-pdf',
      name: 'Операционный отчет PDF',
      description: 'Стандартный операционный отчет в формате PDF',
      category: ExportPresetCategory.OPERATIONAL,
      format: ExportFormat.PDF,
      config: {
        source: { type: 'report' },
        options: {
          includeHeader: true,
          includeFooter: true,
          includeSummary: true,
          includeCharts: true,
          pageSize: 'A4',
          orientation: 'portrait',
        },
      },
      isDefault: true,
      tags: ['операции', 'pdf', 'стандартный'],
    };

    this.presets.set(operationalPreset.id, operationalPreset);

    this.logger.log(`📋 Инициализированы пресеты экспорта: ${this.presets.size}`);
  }

  private initializeDefaultTemplates(): void {
    const defaultTemplate: ExportTemplate = {
      id: 'default-report',
      name: 'Стандартный шаблон отчета',
      type: ExportFormat.PDF,
      layout: {
        header: {
          content: '<h1>{{title}}</h1><p>Период: {{dateRange}}</p>',
          height: 80,
        },
        body: {
          content: '{{content}}',
        },
        footer: {
          content: '<p>Сгенерировано: {{generatedAt}} | PortVision 360</p>',
          height: 40,
        },
        margin: { top: 20, right: 20, bottom: 20, left: 20 },
      },
      styling: {
        fontFamily: 'Arial',
        fontSize: 12,
        color: '#333333',
      },
      variables: {
        companyName: 'PortVision 360',
        companyLogo: '',
      },
    };

    this.templates.set(defaultTemplate.id, defaultTemplate);

    this.logger.log(`📄 Инициализированы шаблоны экспорта: ${this.templates.size}`);
  }

  // Автоматическая очистка истекших файлов
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  private async cleanupExpiredFiles(): Promise<void> {
    const now = new Date();
    let removedCount = 0;

    for (const [jobId, job] of this.exportJobs.entries()) {
      if (job.expiresAt < now) {
        // Удаляем файл с диска
        if (job.result?.filePath && fs.existsSync(job.result.filePath)) {
          fs.unlinkSync(job.result.filePath);
        }
        
        // Удаляем задание из памяти
        this.exportJobs.delete(jobId);
        removedCount++;
      }
    }

    if (removedCount > 0) {
      this.logger.log(`🧹 Очищено ${removedCount} истекших экспортов`);
    }
  }

  getServiceStats() {
    return {
      totalJobs: this.exportJobs.size,
      queuedJobs: this.jobQueue.length,
      processingJobs: this.processingJobs.size,
      batchJobs: this.batchJobs.size,
      autoExports: this.autoExports.size,
      templates: this.templates.size,
      presets: this.presets.size,
      memoryUsage: process.memoryUsage(),
      uptime: process.uptime(),
    };
  }
}