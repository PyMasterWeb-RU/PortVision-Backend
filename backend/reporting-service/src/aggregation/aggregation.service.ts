import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ClickHouseService } from '../clickhouse/clickhouse.service';
import {
  CreateAggregationJobDto,
  GetAggregationJobsDto,
  UpdateAggregationJobDto,
  RunAggregationJobDto,
  CreateAggregationTemplateDto,
  GetAggregationStatsDto,
} from './dto/aggregation.dto';
import {
  AggregationJob,
  AggregationType,
  AggregationStatus,
  AggregationCategory,
  AggregationTemplate,
  AggregationStatistics,
  AggregationQueue,
  AggregationQueueItem,
  AggregationResult,
  AggregationOperationType,
  IncrementalState,
  AggregationMonitoring,
  AggregationAlert,
  AggregationAlertType,
  DataLineage,
  DataQualityResult,
} from './interfaces/aggregation.interface';
import { v4 as uuidv4 } from 'uuid';
import * as cron from 'node-cron';

@Injectable()
export class AggregationService {
  private readonly logger = new Logger(AggregationService.name);
  
  // In-memory хранилища для демонстрации
  private readonly jobs = new Map<string, AggregationJob>();
  private readonly templates = new Map<string, AggregationTemplate>();
  private readonly queues = new Map<string, AggregationQueue>();
  private readonly queueItems = new Map<string, AggregationQueueItem>();
  private readonly incrementalStates = new Map<string, IncrementalState>();
  
  // Очереди заданий по приоритетам
  private readonly highPriorityQueue: string[] = [];
  private readonly normalPriorityQueue: string[] = [];
  private readonly lowPriorityQueue: string[] = [];
  private readonly runningJobs = new Set<string>();

  constructor(
    private readonly clickhouseService: ClickHouseService,
    private readonly eventEmitter: EventEmitter2,
  ) {
    this.initializeDefaultTemplates();
    this.initializeQueues();
  }

  async createAggregationJob(dto: CreateAggregationJobDto, userId: string): Promise<AggregationJob> {
    this.logger.log(`📊 Создание задания агрегации: ${dto.name} (${dto.type})`);

    // Валидация конфигурации
    this.validateJobConfiguration(dto);

    const job: AggregationJob = {
      id: uuidv4(),
      name: dto.name,
      type: dto.type,
      status: AggregationStatus.PENDING,
      schedule: {
        ...dto.schedule,
        priority: dto.schedule.priority || 5,
      },
      source: dto.source,
      target: dto.target,
      transformation: dto.transformation,
      progress: 0,
      createdAt: new Date(),
      createdBy: userId,
      isActive: dto.isActive ?? true,
    };

    // Расчет следующего запуска для cron
    if (job.schedule.type === 'cron' && job.schedule.expression) {
      job.nextRun = this.calculateNextRun(job.schedule.expression, job.schedule.timezone);
    }

    this.jobs.set(job.id, job);

    // Добавляем в очередь если задание активно
    if (job.isActive && job.type === AggregationType.ON_DEMAND) {
      this.enqueueJob(job.id, job.schedule.priority || 5);
    }

    this.eventEmitter.emit('aggregation.job.created', {
      jobId: job.id,
      name: job.name,
      type: job.type,
      userId,
    });

    // Создаем инкрементальное состояние
    if (job.source.incremental) {
      this.createIncrementalState(job.id);
    }

    // Создаем линеаж данных
    this.createDataLineage(job);

    this.logger.log(`✅ Задание агрегации создано: ${job.id}`);
    return job;
  }

  async getAggregationJobs(dto: GetAggregationJobsDto): Promise<{
    jobs: AggregationJob[];
    total: number;
    page: number;
    limit: number;
  }> {
    let jobs = Array.from(this.jobs.values());

    // Применяем фильтры
    if (dto.type) {
      jobs = jobs.filter(j => j.type === dto.type);
    }
    if (dto.status) {
      jobs = jobs.filter(j => j.status === dto.status);
    }
    if (dto.category) {
      // Категория определяется по тегам или названию
      jobs = jobs.filter(j => 
        j.name.toLowerCase().includes(dto.category!.toLowerCase())
      );
    }
    if (dto.search) {
      const search = dto.search.toLowerCase();
      jobs = jobs.filter(j => 
        j.name.toLowerCase().includes(search)
      );
    }
    if (dto.activeOnly) {
      jobs = jobs.filter(j => j.isActive);
    }
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

  async getAggregationJob(jobId: string): Promise<AggregationJob> {
    const job = this.jobs.get(jobId);
    if (!job) {
      throw new NotFoundException(`Задание агрегации с ID ${jobId} не найдено`);
    }
    return job;
  }

  async updateAggregationJob(jobId: string, dto: UpdateAggregationJobDto, userId: string): Promise<AggregationJob> {
    const job = await this.getAggregationJob(jobId);

    if (dto.name !== undefined) job.name = dto.name;
    if (dto.isActive !== undefined) job.isActive = dto.isActive;
    if (dto.schedule) {
      job.schedule = { ...job.schedule, ...dto.schedule };
      // Пересчитываем следующий запуск
      if (job.schedule.type === 'cron' && job.schedule.expression) {
        job.nextRun = this.calculateNextRun(job.schedule.expression, job.schedule.timezone);
      }
    }
    if (dto.transformation) {
      job.transformation = { ...job.transformation, ...dto.transformation };
    }

    this.jobs.set(jobId, job);

    this.eventEmitter.emit('aggregation.job.updated', {
      jobId,
      changes: dto,
      userId,
    });

    this.logger.log(`📝 Задание агрегации обновлено: ${jobId}`);
    return job;
  }

  async deleteAggregationJob(jobId: string, userId: string): Promise<void> {
    const job = await this.getAggregationJob(jobId);

    if (job.status === AggregationStatus.RUNNING) {
      throw new BadRequestException('Нельзя удалить выполняющееся задание');
    }

    this.jobs.delete(jobId);
    this.incrementalStates.delete(jobId);

    // Удаляем из очередей
    this.removeFromQueues(jobId);

    this.eventEmitter.emit('aggregation.job.deleted', {
      jobId,
      jobName: job.name,
      userId,
    });

    this.logger.log(`🗑️ Задание агрегации удалено: ${jobId}`);
  }

  async runAggregationJob(jobId: string, dto: RunAggregationJobDto, userId: string): Promise<AggregationJob> {
    const job = await this.getAggregationJob(jobId);

    if (job.status === AggregationStatus.RUNNING) {
      throw new BadRequestException('Задание уже выполняется');
    }

    // Добавляем в очередь с учетом приоритета
    const priority = dto.highPriority ? 10 : (job.schedule.priority || 5);
    this.enqueueJob(jobId, priority, dto.parameters);

    this.eventEmitter.emit('aggregation.job.triggered', {
      jobId,
      triggeredBy: userId,
      parameters: dto.parameters,
    });

    this.logger.log(`▶️ Запуск задания агрегации: ${jobId} - ${userId}`);
    return job;
  }

  async createAggregationTemplate(dto: CreateAggregationTemplateDto, userId: string): Promise<AggregationTemplate> {
    this.logger.log(`📄 Создание шаблона агрегации: ${dto.name}`);

    const template: AggregationTemplate = {
      id: uuidv4(),
      name: dto.name,
      description: dto.description || '',
      category: dto.category,
      type: dto.type,
      template: dto.template,
      variables: dto.variables,
      isDefault: dto.isDefault || false,
      tags: dto.tags || [],
    };

    this.templates.set(template.id, template);

    this.eventEmitter.emit('aggregation.template.created', {
      templateId: template.id,
      name: template.name,
      userId,
    });

    this.logger.log(`✅ Шаблон агрегации создан: ${template.id}`);
    return template;
  }

  async getAggregationTemplates(): Promise<AggregationTemplate[]> {
    return Array.from(this.templates.values());
  }

  async getAggregationStatistics(dto: GetAggregationStatsDto): Promise<AggregationStatistics> {
    let jobs = Array.from(this.jobs.values());

    // Фильтрация по датам
    if (dto.dateFrom) {
      const dateFrom = new Date(dto.dateFrom);
      jobs = jobs.filter(j => j.createdAt >= dateFrom);
    }
    if (dto.dateTo) {
      const dateTo = new Date(dto.dateTo);
      jobs = jobs.filter(j => j.createdAt <= dateTo);
    }
    if (dto.category) {
      jobs = jobs.filter(j => 
        j.name.toLowerCase().includes(dto.category!.toLowerCase())
      );
    }

    const completedJobs = jobs.filter(j => j.status === AggregationStatus.COMPLETED);
    const failedJobs = jobs.filter(j => j.status === AggregationStatus.FAILED);
    const activeJobs = jobs.filter(j => j.isActive);

    // Статистика по категориям
    const categoryMap = new Map<AggregationCategory, number>();
    jobs.forEach(job => {
      // Определяем категорию по названию или тегам
      let category = AggregationCategory.CUSTOM;
      const name = job.name.toLowerCase();
      
      if (name.includes('операц') || name.includes('terminal')) {
        category = AggregationCategory.OPERATIONAL;
      } else if (name.includes('финанс') || name.includes('доход')) {
        category = AggregationCategory.FINANCIAL;
      } else if (name.includes('оборудование') || name.includes('equipment')) {
        category = AggregationCategory.EQUIPMENT;
      } else if (name.includes('безопасн') || name.includes('safety')) {
        category = AggregationCategory.SAFETY;
      } else if (name.includes('экология') || name.includes('environment')) {
        category = AggregationCategory.ENVIRONMENTAL;
      } else if (name.includes('клиент') || name.includes('customer')) {
        category = AggregationCategory.CUSTOMER;
      }
      
      categoryMap.set(category, (categoryMap.get(category) || 0) + 1);
    });

    const jobsByCategory = Array.from(categoryMap.entries()).map(([category, count]) => ({
      category,
      count,
      percentage: jobs.length > 0 ? (count / jobs.length) * 100 : 0,
    }));

    // Статистика по типам
    const typeMap = new Map<AggregationType, number>();
    jobs.forEach(job => {
      typeMap.set(job.type, (typeMap.get(job.type) || 0) + 1);
    });

    const jobsByType = Array.from(typeMap.entries()).map(([type, count]) => ({
      type,
      count,
      percentage: jobs.length > 0 ? (count / jobs.length) * 100 : 0,
    }));

    // Метрики производительности
    const executionTimes = completedJobs
      .filter(j => j.result?.executionTime)
      .map(j => j.result!.executionTime);

    const totalRecordsProcessed = completedJobs.reduce((sum, job) => 
      sum + (job.result?.recordsProcessed || 0), 0
    );

    const totalBytesProcessed = completedJobs.reduce((sum, job) => 
      sum + (job.result?.bytesProcessed || 0), 0
    );

    const averageExecutionTime = executionTimes.length > 0 
      ? executionTimes.reduce((sum, time) => sum + time, 0) / executionTimes.length 
      : 0;

    const fastestJob = executionTimes.length > 0 
      ? completedJobs.reduce((fastest, job) => 
          (job.result?.executionTime || 0) < (fastest.result?.executionTime || Infinity) ? job : fastest
        )
      : null;

    const slowestJob = executionTimes.length > 0 
      ? completedJobs.reduce((slowest, job) => 
          (job.result?.executionTime || 0) > (slowest.result?.executionTime || 0) ? job : slowest
        )
      : null;

    const jobRunCounts = new Map<string, number>();
    completedJobs.forEach(job => {
      jobRunCounts.set(job.id, (jobRunCounts.get(job.id) || 0) + 1);
    });

    const mostActiveJob = Array.from(jobRunCounts.entries()).reduce(
      (most, [jobId, count]) => {
        return count > most.count ? { jobId, count } : most;
      },
      { jobId: '', count: 0 }
    );

    const biggestJob = completedJobs.reduce((biggest, job) => 
      (job.result?.recordsProcessed || 0) > (biggest.result?.recordsProcessed || 0) ? job : biggest
    );

    // Последняя активность
    const recentActivity = completedJobs
      .filter(j => j.completedAt)
      .sort((a, b) => b.completedAt!.getTime() - a.completedAt!.getTime())
      .slice(0, 10)
      .map(job => ({
        jobId: job.id,
        jobName: job.name,
        status: job.status,
        executionTime: job.result?.executionTime || 0,
        recordsProcessed: job.result?.recordsProcessed || 0,
        completedAt: job.completedAt!,
      }));

    return {
      totalJobs: jobs.length,
      activeJobs: activeJobs.length,
      completedJobs: completedJobs.length,
      failedJobs: failedJobs.length,
      totalRecordsProcessed,
      totalBytesProcessed,
      averageExecutionTime,
      successRate: jobs.length > 0 ? (completedJobs.length / jobs.length) * 100 : 0,
      jobsByCategory,
      jobsByType,
      performanceMetrics: {
        fastestJob: fastestJob ? {
          id: fastestJob.id,
          name: fastestJob.name,
          executionTime: fastestJob.result?.executionTime || 0,
        } : { id: '', name: '', executionTime: 0 },
        slowestJob: slowestJob ? {
          id: slowestJob.id,
          name: slowestJob.name,
          executionTime: slowestJob.result?.executionTime || 0,
        } : { id: '', name: '', executionTime: 0 },
        mostActiveJob: mostActiveJob.jobId ? {
          id: mostActiveJob.jobId,
          name: this.jobs.get(mostActiveJob.jobId)?.name || '',
          runsCount: mostActiveJob.count,
        } : { id: '', name: '', runsCount: 0 },
        biggestJob: biggestJob ? {
          id: biggestJob.id,
          name: biggestJob.name,
          recordsProcessed: biggestJob.result?.recordsProcessed || 0,
        } : { id: '', name: '', recordsProcessed: 0 },
      },
      recentActivity,
    };
  }

  // Планировщик заданий - проверяет расписания каждую минуту
  @Cron(CronExpression.EVERY_MINUTE)
  private async checkScheduledJobs(): Promise<void> {
    const now = new Date();
    const jobs = Array.from(this.jobs.values());

    for (const job of jobs) {
      if (
        job.isActive && 
        job.type === AggregationType.SCHEDULED && 
        job.nextRun && 
        job.nextRun <= now &&
        job.status !== AggregationStatus.RUNNING
      ) {
        this.logger.log(`⏰ Запуск по расписанию: ${job.id} - ${job.name}`);
        
        // Добавляем в очередь
        this.enqueueJob(job.id, job.schedule.priority || 5);
        
        // Обновляем время следующего запуска
        if (job.schedule.expression) {
          job.nextRun = this.calculateNextRun(job.schedule.expression, job.schedule.timezone);
          this.jobs.set(job.id, job);
        }
      }
    }
  }

  // Обработчик очередей - каждые 10 секунд
  @Cron(CronExpression.EVERY_10_SECONDS)
  private async processJobQueues(): Promise<void> {
    const maxConcurrentJobs = 5; // Максимум одновременных заданий

    while (this.runningJobs.size < maxConcurrentJobs) {
      let jobId: string | undefined;

      // Приоритетная обработка очередей
      if (this.highPriorityQueue.length > 0) {
        jobId = this.highPriorityQueue.shift();
      } else if (this.normalPriorityQueue.length > 0) {
        jobId = this.normalPriorityQueue.shift();
      } else if (this.lowPriorityQueue.length > 0) {
        jobId = this.lowPriorityQueue.shift();
      } else {
        break; // Нет заданий в очередях
      }

      if (jobId && !this.runningJobs.has(jobId)) {
        this.runningJobs.add(jobId);
        setImmediate(() => this.executeAggregationJob(jobId!));
      }
    }
  }

  private async executeAggregationJob(jobId: string, parameters?: Record<string, any>): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job) {
      this.runningJobs.delete(jobId);
      return;
    }

    try {
      job.status = AggregationStatus.RUNNING;
      job.startedAt = new Date();
      job.progress = 10;

      this.eventEmitter.emit('aggregation.job.started', { 
        jobId, 
        startedAt: job.startedAt 
      });

      this.logger.log(`🚀 Выполнение агрегации: ${jobId} - ${job.name}`);

      // Этап 1: Извлечение данных
      job.progress = 30;
      const sourceData = await this.extractData(job, parameters);
      
      // Этап 2: Трансформация данных
      job.progress = 60;
      const transformedData = await this.transformData(job, sourceData);
      
      // Этап 3: Загрузка данных
      job.progress = 80;
      const result = await this.loadData(job, transformedData);
      
      // Завершение
      job.status = AggregationStatus.COMPLETED;
      job.progress = 100;
      job.completedAt = new Date();
      job.result = result;
      job.lastRun = new Date();

      // Обновляем инкрементальное состояние
      if (job.source.incremental) {
        this.updateIncrementalState(job.id, sourceData);
      }

      this.eventEmitter.emit('aggregation.job.completed', {
        jobId,
        result,
        executionTime: result.executionTime,
      });

      this.logger.log(`✅ Агрегация завершена: ${jobId} - ${result.recordsProcessed} записей за ${result.executionTime}мс`);

    } catch (error) {
      job.status = AggregationStatus.FAILED;
      job.error = error.message;
      job.completedAt = new Date();

      this.eventEmitter.emit('aggregation.job.failed', {
        jobId,
        error: error.message,
      });

      this.logger.error(`❌ Ошибка агрегации ${jobId}:`, error.message);
    } finally {
      this.jobs.set(jobId, job);
      this.runningJobs.delete(jobId);
    }
  }

  private async extractData(job: AggregationJob, parameters?: Record<string, any>): Promise<any[]> {
    const { source } = job;
    
    switch (source.type) {
      case 'clickhouse':
        return this.extractFromClickHouse(job, parameters);
      case 'postgresql':
        return this.extractFromPostgreSQL(job, parameters);
      case 'kafka':
        return this.extractFromKafka(job, parameters);
      case 'api':
        return this.extractFromAPI(job, parameters);
      case 'file':
        return this.extractFromFile(job, parameters);
      default:
        throw new Error(`Неподдерживаемый тип источника: ${source.type}`);
    }
  }

  private async extractFromClickHouse(job: AggregationJob, parameters?: Record<string, any>): Promise<any[]> {
    const { source } = job;
    let query = source.query || `SELECT * FROM ${source.table}`;
    
    // Применяем фильтры
    if (source.filters && source.filters.length > 0) {
      const whereClause = this.buildWhereClause(source.filters);
      query += query.toLowerCase().includes('where') ? ` AND ${whereClause}` : ` WHERE ${whereClause}`;
    }
    
    // Инкрементальная обработка
    if (source.incremental && source.incrementalField) {
      const state = this.incrementalStates.get(job.id);
      if (state && state.lastProcessedValue) {
        const condition = `${source.incrementalField} > '${state.lastProcessedValue}'`;
        query += query.toLowerCase().includes('where') ? ` AND ${condition}` : ` WHERE ${condition}`;
      }
    }
    
    // Применяем параметры
    if (parameters) {
      Object.entries(parameters).forEach(([key, value]) => {
        query = query.replace(new RegExp(`{{${key}}}`, 'g'), String(value));
      });
    }
    
    this.logger.debug(`📊 ClickHouse запрос: ${query}`);
    
    const result = await this.clickhouseService.query(query);
    return result.data || [];
  }

  private async extractFromPostgreSQL(job: AggregationJob, parameters?: Record<string, any>): Promise<any[]> {
    // Заглушка для PostgreSQL источника
    this.logger.warn('PostgreSQL источник не реализован');
    return [];
  }

  private async extractFromKafka(job: AggregationJob, parameters?: Record<string, any>): Promise<any[]> {
    // Заглушка для Kafka источника
    this.logger.warn('Kafka источник не реализован');
    return [];
  }

  private async extractFromAPI(job: AggregationJob, parameters?: Record<string, any>): Promise<any[]> {
    // Заглушка для API источника
    this.logger.warn('API источник не реализован');
    return [];
  }

  private async extractFromFile(job: AggregationJob, parameters?: Record<string, any>): Promise<any[]> {
    // Заглушка для файлового источника
    this.logger.warn('Файловый источник не реализован');
    return [];
  }

  private async transformData(job: AggregationJob, data: any[]): Promise<any[]> {
    if (!data || data.length === 0) {
      return [];
    }

    const { transformation } = job;
    let result = data;

    // Применяем фильтры
    if (transformation.operations) {
      result = this.applyAggregationOperations(data, transformation);
    }

    return result;
  }

  private applyAggregationOperations(data: any[], transformation: any): any[] {
    const { operations, groupBy, orderBy, having, limit, offset } = transformation;
    
    if (!groupBy || groupBy.length === 0) {
      // Без группировки - применяем агрегации ко всем данным
      const aggregatedRow: any = {};
      
      operations.forEach((op: any) => {
        const fieldName = op.alias || `${op.type}_${op.field}`;
        aggregatedRow[fieldName] = this.calculateAggregation(data, op);
      });
      
      return [aggregatedRow];
    }

    // С группировкой
    const grouped = this.groupData(data, groupBy);
    const result: any[] = [];

    for (const [groupKey, groupData] of grouped.entries()) {
      const row: any = {};
      
      // Добавляем поля группировки
      const groupKeyParts = groupKey.split('|');
      groupBy.forEach((field: string, index: number) => {
        row[field] = groupKeyParts[index];
      });
      
      // Применяем агрегации
      operations.forEach((op: any) => {
        const fieldName = op.alias || `${op.type}_${op.field}`;
        row[fieldName] = this.calculateAggregation(groupData, op);
      });
      
      result.push(row);
    }

    // Применяем HAVING
    let filteredResult = result;
    if (having && having.length > 0) {
      filteredResult = result.filter(row => this.evaluateHavingConditions(row, having));
    }

    // Сортировка
    if (orderBy && orderBy.length > 0) {
      filteredResult.sort((a, b) => {
        for (const order of orderBy) {
          const aVal = a[order.field];
          const bVal = b[order.field];
          const comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
          
          if (comparison !== 0) {
            return order.direction === 'DESC' ? -comparison : comparison;
          }
        }
        return 0;
      });
    }

    // Применяем LIMIT и OFFSET
    const startIndex = offset || 0;
    const endIndex = limit ? startIndex + limit : filteredResult.length;
    
    return filteredResult.slice(startIndex, endIndex);
  }

  private groupData(data: any[], groupBy: string[]): Map<string, any[]> {
    const groups = new Map<string, any[]>();
    
    data.forEach(row => {
      const groupKey = groupBy.map(field => row[field] || '').join('|');
      
      if (!groups.has(groupKey)) {
        groups.set(groupKey, []);
      }
      groups.get(groupKey)!.push(row);
    });
    
    return groups;
  }

  private calculateAggregation(data: any[], operation: any): any {
    const { type, field, params } = operation;
    
    switch (type) {
      case AggregationOperationType.COUNT:
        return field === '*' ? data.length : data.filter(row => row[field] != null).length;
        
      case AggregationOperationType.SUM:
        return data.reduce((sum, row) => sum + (parseFloat(row[field]) || 0), 0);
        
      case AggregationOperationType.AVG:
        const validValues = data.filter(row => row[field] != null);
        const sum = validValues.reduce((sum, row) => sum + (parseFloat(row[field]) || 0), 0);
        return validValues.length > 0 ? sum / validValues.length : null;
        
      case AggregationOperationType.MIN:
        return Math.min(...data.map(row => parseFloat(row[field]) || Infinity));
        
      case AggregationOperationType.MAX:
        return Math.max(...data.map(row => parseFloat(row[field]) || -Infinity));
        
      case AggregationOperationType.MEDIAN:
        const sortedValues = data
          .map(row => parseFloat(row[field]))
          .filter(val => !isNaN(val))
          .sort((a, b) => a - b);
        const mid = Math.floor(sortedValues.length / 2);
        return sortedValues.length % 2 === 0 
          ? (sortedValues[mid - 1] + sortedValues[mid]) / 2 
          : sortedValues[mid];
          
      case AggregationOperationType.PERCENTILE:
        const percentile = params?.percentile || 95;
        const values = data
          .map(row => parseFloat(row[field]))
          .filter(val => !isNaN(val))
          .sort((a, b) => a - b);
        const index = Math.ceil((percentile / 100) * values.length) - 1;
        return values[Math.max(0, index)];
        
      default:
        this.logger.warn(`Неподдерживаемая операция агрегации: ${type}`);
        return null;
    }
  }

  private evaluateHavingConditions(row: any, havingConditions: any[]): boolean {
    return havingConditions.every(condition => {
      const { field, operator, value } = condition;
      const fieldValue = row[field];
      
      switch (operator) {
        case 'eq': return fieldValue == value;
        case 'ne': return fieldValue != value;
        case 'gt': return fieldValue > value;
        case 'gte': return fieldValue >= value;
        case 'lt': return fieldValue < value;
        case 'lte': return fieldValue <= value;
        case 'in': return Array.isArray(value) && value.includes(fieldValue);
        case 'not_in': return Array.isArray(value) && !value.includes(fieldValue);
        default: return true;
      }
    });
  }

  private async loadData(job: AggregationJob, data: any[]): Promise<AggregationResult> {
    const startTime = new Date();
    const { target } = job;
    
    let recordsInserted = 0;
    let recordsUpdated = 0;
    
    switch (target.type) {
      case 'clickhouse':
        recordsInserted = await this.loadToClickHouse(job, data);
        break;
      case 'postgresql':
        recordsInserted = await this.loadToPostgreSQL(job, data);
        break;
      case 'redis':
        recordsInserted = await this.loadToRedis(job, data);
        break;
      case 'file':
        recordsInserted = await this.loadToFile(job, data);
        break;
      default:
        throw new Error(`Неподдерживаемый тип целевого хранилища: ${target.type}`);
    }
    
    const endTime = new Date();
    const executionTime = endTime.getTime() - startTime.getTime();
    
    return {
      recordsProcessed: data.length,
      recordsInserted,
      recordsUpdated,
      recordsDeleted: 0,
      bytesProcessed: JSON.stringify(data).length,
      executionTime,
      startTime,
      endTime,
    };
  }

  private async loadToClickHouse(job: AggregationJob, data: any[]): Promise<number> {
    if (!data || data.length === 0) {
      return 0;
    }
    
    const { target } = job;
    const tableName = target.table || 'aggregated_data';
    
    // Формируем INSERT запрос
    const columns = Object.keys(data[0]);
    const values = data.map(row => 
      columns.map(col => {
        const val = row[col];
        return typeof val === 'string' ? `'${val.replace(/'/g, "''")}'` : val;
      }).join(', ')
    ).join('), (');
    
    const insertQuery = `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${values})`;
    
    try {
      await this.clickhouseService.query(insertQuery);
      this.logger.log(`💾 Данные загружены в ClickHouse: ${data.length} записей в ${tableName}`);
      return data.length;
    } catch (error) {
      this.logger.error(`❌ Ошибка загрузки в ClickHouse:`, error.message);
      throw error;
    }
  }

  private async loadToPostgreSQL(job: AggregationJob, data: any[]): Promise<number> {
    // Заглушка для PostgreSQL
    this.logger.warn('Загрузка в PostgreSQL не реализована');
    return 0;
  }

  private async loadToRedis(job: AggregationJob, data: any[]): Promise<number> {
    // Заглушка для Redis
    this.logger.warn('Загрузка в Redis не реализована');
    return 0;
  }

  private async loadToFile(job: AggregationJob, data: any[]): Promise<number> {
    // Заглушка для файловой загрузки
    this.logger.warn('Загрузка в файл не реализована');
    return 0;
  }

  // Вспомогательные методы

  private validateJobConfiguration(dto: CreateAggregationJobDto): void {
    // Валидация расписания
    if (dto.schedule.type === 'cron' && !dto.schedule.expression) {
      throw new BadRequestException('Для cron расписания требуется выражение');
    }
    if (dto.schedule.type === 'interval' && !dto.schedule.interval) {
      throw new BadRequestException('Для интервального расписания требуется интервал');
    }
    
    // Валидация источника
    if (dto.source.incremental && !dto.source.incrementalField) {
      throw new BadRequestException('Для инкрементальной обработки требуется поле');
    }
    
    // Валидация трансформации
    if (!dto.transformation.operations || dto.transformation.operations.length === 0) {
      throw new BadRequestException('Требуется хотя бы одна операция агрегации');
    }
  }

  private calculateNextRun(cronExpression: string, timezone = 'UTC'): Date {
    try {
      // Простая заглушка для расчета следующего запуска
      const now = new Date();
      return new Date(now.getTime() + 24 * 60 * 60 * 1000); // +1 день
    } catch (error) {
      this.logger.error('Ошибка расчета следующего запуска:', error.message);
      return new Date(Date.now() + 24 * 60 * 60 * 1000);
    }
  }

  private enqueueJob(jobId: string, priority: number, parameters?: Record<string, any>): void {
    if (priority >= 8) {
      this.highPriorityQueue.push(jobId);
    } else if (priority >= 4) {
      this.normalPriorityQueue.push(jobId);
    } else {
      this.lowPriorityQueue.push(jobId);
    }
    
    this.logger.log(`📋 Задание добавлено в очередь: ${jobId} (приоритет: ${priority})`);
  }

  private removeFromQueues(jobId: string): void {
    const removeFromArray = (arr: string[]) => {
      const index = arr.indexOf(jobId);
      if (index > -1) arr.splice(index, 1);
    };
    
    removeFromArray(this.highPriorityQueue);
    removeFromArray(this.normalPriorityQueue);
    removeFromArray(this.lowPriorityQueue);
  }

  private buildWhereClause(filters: any[]): string {
    return filters.map(filter => {
      const { field, operator, value, condition } = filter;
      let clause = '';
      
      switch (operator) {
        case 'eq': clause = `${field} = '${value}'`; break;
        case 'ne': clause = `${field} != '${value}'`; break;
        case 'gt': clause = `${field} > ${value}`; break;
        case 'gte': clause = `${field} >= ${value}`; break;
        case 'lt': clause = `${field} < ${value}`; break;
        case 'lte': clause = `${field} <= ${value}`; break;
        case 'in': clause = `${field} IN (${Array.isArray(value) ? value.map(v => `'${v}'`).join(',') : `'${value}'`})`; break;
        case 'like': clause = `${field} LIKE '%${value}%'`; break;
        default: clause = `${field} = '${value}'`;
      }
      
      return clause;
    }).join(` ${filters[0]?.condition || 'AND'} `);
  }

  private createIncrementalState(jobId: string): void {
    const state: IncrementalState = {
      jobId,
      lastProcessedValue: null,
      lastProcessedTime: new Date(),
      watermark: null,
      checkpointData: {},
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    this.incrementalStates.set(jobId, state);
  }

  private updateIncrementalState(jobId: string, data: any[]): void {
    const state = this.incrementalStates.get(jobId);
    if (!state || !data || data.length === 0) return;
    
    const job = this.jobs.get(jobId);
    if (!job?.source.incrementalField) return;
    
    // Находим максимальное значение инкрементального поля
    const incrementalField = job.source.incrementalField;
    const maxValue = data.reduce((max, row) => {
      const value = row[incrementalField];
      return value > max ? value : max;
    }, state.lastProcessedValue || '');
    
    state.lastProcessedValue = maxValue;
    state.lastProcessedTime = new Date();
    state.updatedAt = new Date();
    state.version++;
    
    this.incrementalStates.set(jobId, state);
  }

  private createDataLineage(job: AggregationJob): void {
    const lineage: DataLineage = {
      jobId: job.id,
      sources: [{
        type: job.source.type,
        identifier: job.source.table || job.source.endpoint || job.source.filePath || 'unknown',
        fields: [], // Будет заполнено при выполнении
      }],
      targets: [{
        type: job.target.type,
        identifier: job.target.table || job.target.filePath || 'unknown',
        fields: [], // Будет заполнено при выполнении
      }],
      transformations: job.transformation.operations.map(op => ({
        operation: op.type,
        inputFields: [op.field],
        outputFields: [op.alias || `${op.type}_${op.field}`],
        logic: `${op.type}(${op.field})`,
      })),
      dependencies: [],
      impact: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    // В реальной системе здесь будет сохранение в БД
    this.logger.debug(`📊 Линеаж данных создан для задания: ${job.id}`);
  }

  private initializeDefaultTemplates(): void {
    const operationalTemplate: AggregationTemplate = {
      id: 'operational-daily',
      name: 'Ежедневная агрегация операций',
      description: 'Шаблон для ежедневной агрегации операций терминала',
      category: AggregationCategory.OPERATIONAL,
      type: AggregationType.SCHEDULED,
      template: {
        source: {
          type: 'clickhouse',
          table: '{{source_table}}',
          incremental: true,
          incrementalField: 'updated_at',
        },
        target: {
          type: 'clickhouse',
          table: '{{target_table}}',
          partitioning: {
            enabled: true,
            field: 'date',
            type: 'time',
            interval: 'day',
          },
        },
        transformation: {
          operations: [
            { type: AggregationOperationType.COUNT, field: '*', alias: 'total_operations' },
            { type: AggregationOperationType.SUM, field: 'teu_count', alias: 'total_teu' },
          ],
          groupBy: ['date', 'operation_type'],
        },
        schedule: {
          type: 'cron',
          expression: '{{cron_expression}}',
          enabled: true,
          priority: 5,
        },
      },
      variables: [
        {
          name: 'source_table',
          type: 'string',
          description: 'Исходная таблица',
          required: true,
        },
        {
          name: 'target_table',
          type: 'string',
          description: 'Целевая таблица',
          required: true,
        },
        {
          name: 'cron_expression',
          type: 'string',
          description: 'Cron выражение',
          required: true,
          defaultValue: '0 2 * * *',
        },
      ],
      isDefault: true,
      tags: ['операции', 'ежедневно', 'терминал'],
    };

    this.templates.set(operationalTemplate.id, operationalTemplate);
    this.logger.log(`📄 Инициализированы шаблоны агрегации: ${this.templates.size}`);
  }

  private initializeQueues(): void {
    const defaultQueue: AggregationQueue = {
      id: 'default',
      name: 'Основная очередь',
      priority: 5,
      maxConcurrency: 5,
      currentJobs: 0,
      queuedJobs: 0,
      totalProcessed: 0,
      averageWaitTime: 0,
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.queues.set(defaultQueue.id, defaultQueue);
    this.logger.log(`📋 Инициализированы очереди агрегации: ${this.queues.size}`);
  }

  getServiceStats() {
    return {
      totalJobs: this.jobs.size,
      runningJobs: this.runningJobs.size,
      queuedJobs: this.highPriorityQueue.length + this.normalPriorityQueue.length + this.lowPriorityQueue.length,
      highPriorityQueue: this.highPriorityQueue.length,
      normalPriorityQueue: this.normalPriorityQueue.length,
      lowPriorityQueue: this.lowPriorityQueue.length,
      templates: this.templates.size,
      queues: this.queues.size,
      incrementalStates: this.incrementalStates.size,
      memoryUsage: process.memoryUsage(),
      uptime: process.uptime(),
    };
  }
}