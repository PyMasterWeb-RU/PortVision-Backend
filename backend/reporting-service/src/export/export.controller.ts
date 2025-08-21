import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
  Logger,
  Request,
  Response,
  NotFoundException,
  BadRequestException,
  StreamableFile,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiProduces,
} from '@nestjs/swagger';
import { ExportService } from './export.service';
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
  ExportFormat,
  ExportStatus,
  ExportType,
  BatchExportJob,
  AutoExportConfig,
  ExportTemplate,
  ExportPreset,
  ExportStatistics,
} from './interfaces/export.interface';
import { Response as ExpressResponse } from 'express';
import * as fs from 'fs';

// Базовые guards будут добавлены позже при интеграции с Keycloak
// import { JwtAuthGuard } from '../auth/jwt-auth.guard';
// import { RolesGuard } from '../auth/roles.guard';
// import { Roles } from '../auth/roles.decorator';

@ApiTags('export')
@Controller('export')
// @UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT')
export class ExportController {
  private readonly logger = new Logger(ExportController.name);

  constructor(private readonly exportService: ExportService) {}

  @Post('jobs')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Создание задания экспорта',
    description: 'Создает новое задание для экспорта данных в различных форматах',
  })
  @ApiBody({
    type: CreateExportJobDto,
    description: 'Параметры экспорта',
    examples: {
      'operations-report': {
        summary: 'Экспорт операционного отчета в PDF',
        value: {
          type: ExportType.REPORT,
          format: ExportFormat.PDF,
          title: 'Операционный отчет за декабрь 2024',
          description: 'Подробный отчет по всем операциям терминала',
          source: {
            type: 'report',
            id: 'operations-report',
            dateRange: {
              start: '2024-12-01T00:00:00.000Z',
              end: '2024-12-31T23:59:59.999Z',
            },
          },
          options: {
            includeHeader: true,
            includeFooter: true,
            includeSummary: true,
            includeCharts: true,
            pageSize: 'A4',
            orientation: 'portrait',
          },
          retentionDays: 7,
        },
      },
      'containers-data': {
        summary: 'Экспорт данных контейнеров в Excel',
        value: {
          type: ExportType.RAW_DATA,
          format: ExportFormat.EXCEL,
          title: 'Данные контейнеров',
          source: {
            type: 'query',
            query: 'SELECT * FROM containers WHERE created_at >= ? AND created_at <= ?',
            parameters: ['2024-12-01', '2024-12-31'],
          },
          options: {
            sheetName: 'Контейнеры',
            autoFitColumns: true,
            includeHeader: true,
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Задание экспорта создано',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'export-uuid' },
            type: { type: 'string', example: 'report' },
            format: { type: 'string', example: 'pdf' },
            status: { type: 'string', example: 'queued' },
            progress: { type: 'number', example: 0 },
            title: { type: 'string', example: 'Операционный отчет за декабрь 2024' },
            createdAt: { type: 'string', format: 'date-time' },
            expiresAt: { type: 'string', format: 'date-time' },
          },
        },
        message: { type: 'string', example: 'Задание экспорта создано' },
      },
    },
  })
  // @Roles('MANAGER', 'DISPATCHER', 'ANALYST', 'VIEWER')
  async createExportJob(
    @Body() dto: CreateExportJobDto,
    @Request() req: any,
  ): Promise<{
    success: boolean;
    data: ExportJob;
    message: string;
  }> {
    const userId = req.user?.id || 'demo-user';
    this.logger.log(`📤 Создание экспорта: ${dto.title} (${dto.format}) - ${userId}`);
    
    const job = await this.exportService.createExportJob(dto, userId);
    
    return {
      success: true,
      data: job,
      message: 'Задание экспорта создано',
    };
  }

  @Get('jobs')
  @ApiOperation({
    summary: 'Получение списка заданий экспорта',
    description: 'Возвращает список заданий экспорта с фильтрацией и пагинацией',
  })
  @ApiQuery({ name: 'page', required: false, description: 'Номер страницы', example: 1 })
  @ApiQuery({ name: 'limit', required: false, description: 'Количество элементов', example: 20 })
  @ApiQuery({ name: 'type', required: false, enum: ExportType, description: 'Фильтр по типу' })
  @ApiQuery({ name: 'format', required: false, enum: ExportFormat, description: 'Фильтр по формату' })
  @ApiQuery({ name: 'status', required: false, enum: ExportStatus, description: 'Фильтр по статусу' })
  @ApiQuery({ name: 'search', required: false, description: 'Поиск по названию' })
  @ApiQuery({ name: 'createdFrom', required: false, description: 'Дата создания с' })
  @ApiQuery({ name: 'createdTo', required: false, description: 'Дата создания по' })
  @ApiQuery({ name: 'myOnly', required: false, description: 'Только мои экспорты', example: false })
  @ApiResponse({
    status: 200,
    description: 'Список заданий экспорта получен',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: {
          type: 'object',
          properties: {
            jobs: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  title: { type: 'string' },
                  type: { type: 'string' },
                  format: { type: 'string' },
                  status: { type: 'string' },
                  progress: { type: 'number' },
                  createdAt: { type: 'string', format: 'date-time' },
                },
              },
            },
            total: { type: 'number', example: 25 },
            page: { type: 'number', example: 1 },
            limit: { type: 'number', example: 20 },
          },
        },
        message: { type: 'string', example: 'Список заданий получен' },
      },
    },
  })
  // @Roles('MANAGER', 'DISPATCHER', 'ANALYST', 'VIEWER')
  async getExportJobs(
    @Query() dto: GetExportJobsDto,
    @Request() req: any,
  ): Promise<{
    success: boolean;
    data: {
      jobs: ExportJob[];
      total: number;
      page: number;
      limit: number;
    };
    message: string;
  }> {
    const userId = req.user?.id || 'demo-user';
    const data = await this.exportService.getExportJobs(dto, userId);
    
    return {
      success: true,
      data,
      message: 'Список заданий экспорта получен',
    };
  }

  @Get('jobs/:jobId')
  @ApiOperation({
    summary: 'Получение задания экспорта',
    description: 'Возвращает детальную информацию о задании экспорта',
  })
  @ApiParam({
    name: 'jobId',
    description: 'ID задания экспорта',
    example: 'export-uuid',
  })
  @ApiResponse({
    status: 200,
    description: 'Информация о задании получена',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            title: { type: 'string' },
            type: { type: 'string' },
            format: { type: 'string' },
            status: { type: 'string' },
            progress: { type: 'number' },
            config: { type: 'object' },
            result: {
              type: 'object',
              properties: {
                fileName: { type: 'string' },
                fileSize: { type: 'number' },
                mimeType: { type: 'string' },
              },
            },
            createdAt: { type: 'string', format: 'date-time' },
            completedAt: { type: 'string', format: 'date-time' },
          },
        },
        message: { type: 'string', example: 'Информация о задании получена' },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Задание не найдено',
  })
  // @Roles('MANAGER', 'DISPATCHER', 'ANALYST', 'VIEWER')
  async getExportJob(
    @Param('jobId') jobId: string,
    @Request() req: any,
  ): Promise<{
    success: boolean;
    data: ExportJob;
    message: string;
  }> {
    const userId = req.user?.id || 'demo-user';
    const job = await this.exportService.getExportJob(jobId, userId);
    
    return {
      success: true,
      data: job,
      message: 'Информация о задании экспорта получена',
    };
  }

  @Put('jobs/:jobId/cancel')
  @ApiOperation({
    summary: 'Отмена задания экспорта',
    description: 'Отменяет выполнение задания экспорта',
  })
  @ApiParam({
    name: 'jobId',
    description: 'ID задания для отмены',
    example: 'export-uuid',
  })
  @ApiResponse({
    status: 200,
    description: 'Задание отменено',
  })
  @ApiResponse({
    status: 400,
    description: 'Задание нельзя отменить',
  })
  // @Roles('MANAGER', 'DISPATCHER', 'ANALYST', 'VIEWER')
  async cancelExportJob(
    @Param('jobId') jobId: string,
    @Request() req: any,
  ): Promise<{
    success: boolean;
    data: ExportJob;
    message: string;
  }> {
    const userId = req.user?.id || 'demo-user';
    const job = await this.exportService.cancelExportJob(jobId, userId);
    
    return {
      success: true,
      data: job,
      message: 'Задание экспорта отменено',
    };
  }

  @Get('jobs/:jobId/download')
  @ApiOperation({
    summary: 'Скачивание файла экспорта',
    description: 'Скачивает готовый файл экспорта',
  })
  @ApiParam({
    name: 'jobId',
    description: 'ID задания экспорта',
    example: 'export-uuid',
  })
  @ApiProduces('application/octet-stream')
  @ApiResponse({
    status: 200,
    description: 'Файл отправлен',
    headers: {
      'Content-Disposition': {
        description: 'Attachment filename',
        schema: { type: 'string' },
      },
      'Content-Type': {
        description: 'MIME type',
        schema: { type: 'string' },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Файл не готов для скачивания',
  })
  @ApiResponse({
    status: 404,
    description: 'Файл не найден',
  })
  // @Roles('MANAGER', 'DISPATCHER', 'ANALYST', 'VIEWER')
  async downloadExportFile(
    @Param('jobId') jobId: string,
    @Request() req: any,
    @Response({ passthrough: true }) res: ExpressResponse,
  ): Promise<StreamableFile> {
    const userId = req.user?.id || 'demo-user';
    this.logger.log(`⬇️ Скачивание файла экспорта: ${jobId} - ${userId}`);
    
    const { filePath, fileName, mimeType } = await this.exportService.downloadExportFile(jobId, userId);
    
    if (!fs.existsSync(filePath)) {
      throw new NotFoundException('Файл не найден на диске');
    }

    const file = fs.createReadStream(filePath);
    
    res.set({
      'Content-Type': mimeType,
      'Content-Disposition': `attachment; filename="${encodeURIComponent(fileName)}"`,
    });

    return new StreamableFile(file);
  }

  @Post('batch')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Создание пакетного экспорта',
    description: 'Создает несколько заданий экспорта в одном пакете',
  })
  @ApiBody({
    type: CreateBatchExportDto,
    description: 'Параметры пакетного экспорта',
    examples: {
      'monthly-reports': {
        summary: 'Пакет месячных отчетов',
        value: {
          name: 'Месячные отчеты за декабрь 2024',
          createArchive: true,
          notifyEmails: ['manager@terminal.com'],
          jobs: [
            {
              type: ExportType.REPORT,
              format: ExportFormat.PDF,
              title: 'Операционный отчет',
              source: { type: 'report', id: 'operations' },
            },
            {
              type: ExportType.REPORT,
              format: ExportFormat.EXCEL,
              title: 'Финансовый отчет',
              source: { type: 'report', id: 'financial' },
            },
          ],
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Пакетный экспорт создан',
  })
  // @Roles('MANAGER', 'ADMIN')
  async createBatchExport(
    @Body() dto: CreateBatchExportDto,
    @Request() req: any,
  ): Promise<{
    success: boolean;
    data: BatchExportJob;
    message: string;
  }> {
    const userId = req.user?.id || 'demo-user';
    this.logger.log(`📦 Создание пакетного экспорта: ${dto.name} - ${userId}`);
    
    const batchJob = await this.exportService.createBatchExport(dto, userId);
    
    return {
      success: true,
      data: batchJob,
      message: 'Пакетный экспорт создан',
    };
  }

  @Post('auto')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Создание автоматического экспорта',
    description: 'Настраивает автоматический экспорт по расписанию или событиям',
  })
  @ApiBody({
    type: CreateAutoExportDto,
    description: 'Параметры автоматического экспорта',
    examples: {
      'daily-operations': {
        summary: 'Ежедневный операционный отчет',
        value: {
          name: 'Ежедневный операционный отчет',
          trigger: {
            type: 'schedule',
            schedule: '0 8 * * *',
          },
          source: {
            type: 'report',
            id: 'daily-operations',
          },
          format: ExportFormat.PDF,
          recipients: ['operations@terminal.com', 'manager@terminal.com'],
          enabled: true,
          retentionDays: 30,
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Автоматический экспорт создан',
  })
  // @Roles('MANAGER', 'ADMIN')
  async createAutoExport(
    @Body() dto: CreateAutoExportDto,
    @Request() req: any,
  ): Promise<{
    success: boolean;
    data: AutoExportConfig;
    message: string;
  }> {
    const userId = req.user?.id || 'demo-user';
    this.logger.log(`🔄 Создание автоматического экспорта: ${dto.name} - ${userId}`);
    
    const autoExport = await this.exportService.createAutoExport(dto, userId);
    
    return {
      success: true,
      data: autoExport,
      message: 'Автоматический экспорт создан',
    };
  }

  @Post('data')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Прямой экспорт данных',
    description: 'Выполняет прямой экспорт данных по SQL запросу',
  })
  @ApiBody({
    type: ExportDataDto,
    description: 'Параметры экспорта данных',
    examples: {
      'container-movements': {
        summary: 'Экспорт движений контейнеров',
        value: {
          query: 'SELECT * FROM container_movements WHERE date >= ? AND date <= ?',
          parameters: ['2024-12-01', '2024-12-31'],
          format: ExportFormat.CSV,
          fileName: 'container_movements_december',
          options: {
            includeHeader: true,
            delimiter: ',',
            encoding: 'utf8',
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Экспорт данных запущен',
  })
  // @Roles('MANAGER', 'ANALYST', 'ADMIN')
  async exportData(
    @Body() dto: ExportDataDto,
    @Request() req: any,
  ): Promise<{
    success: boolean;
    data: ExportJob;
    message: string;
  }> {
    const userId = req.user?.id || 'demo-user';
    this.logger.log(`📊 Прямой экспорт данных: ${dto.format} - ${userId}`);
    
    const job = await this.exportService.exportData(dto, userId);
    
    return {
      success: true,
      data: job,
      message: 'Экспорт данных запущен',
    };
  }

  @Get('presets')
  @ApiOperation({
    summary: 'Получение предустановок экспорта',
    description: 'Возвращает список готовых предустановок для быстрого экспорта',
  })
  @ApiResponse({
    status: 200,
    description: 'Предустановки получены',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', example: 'operational-pdf' },
              name: { type: 'string', example: 'Операционный отчет PDF' },
              description: { type: 'string' },
              category: { type: 'string', example: 'operational' },
              format: { type: 'string', example: 'pdf' },
              isDefault: { type: 'boolean', example: true },
              tags: { type: 'array', items: { type: 'string' } },
            },
          },
        },
        message: { type: 'string', example: 'Предустановки экспорта получены' },
      },
    },
  })
  // @Roles('MANAGER', 'DISPATCHER', 'ANALYST', 'VIEWER')
  async getExportPresets(): Promise<{
    success: boolean;
    data: ExportPreset[];
    message: string;
  }> {
    const presets = await this.exportService.getPresets();
    
    return {
      success: true,
      data: presets,
      message: 'Предустановки экспорта получены',
    };
  }

  @Post('templates')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Создание шаблона экспорта',
    description: 'Создает пользовательский шаблон для экспорта',
  })
  @ApiBody({
    type: CreateExportTemplateDto,
    description: 'Параметры шаблона',
    examples: {
      'custom-report': {
        summary: 'Пользовательский шаблон отчета',
        value: {
          name: 'Корпоративный отчет терминала',
          type: ExportFormat.PDF,
          layout: {
            header: {
              content: '<h1>{{title}}</h1><p>{{companyName}} - {{dateRange}}</p>',
              height: 100,
            },
            body: {
              content: '{{content}}',
            },
            footer: {
              content: '<p>Сгенерировано: {{generatedAt}} | Страница {{page}} из {{totalPages}}</p>',
              height: 50,
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
            companyLogo: 'https://example.com/logo.png',
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Шаблон создан',
  })
  // @Roles('MANAGER', 'ADMIN')
  async createExportTemplate(
    @Body() dto: CreateExportTemplateDto,
    @Request() req: any,
  ): Promise<{
    success: boolean;
    data: ExportTemplate;
    message: string;
  }> {
    const userId = req.user?.id || 'demo-user';
    this.logger.log(`📄 Создание шаблона экспорта: ${dto.name} - ${userId}`);
    
    const template = await this.exportService.createTemplate(dto, userId);
    
    return {
      success: true,
      data: template,
      message: 'Шаблон экспорта создан',
    };
  }

  @Get('statistics')
  @ApiOperation({
    summary: 'Статистика экспорта',
    description: 'Возвращает статистику использования экспорта',
  })
  @ApiResponse({
    status: 200,
    description: 'Статистика получена',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: {
          type: 'object',
          properties: {
            totalJobs: { type: 'number', example: 150 },
            completedJobs: { type: 'number', example: 142 },
            failedJobs: { type: 'number', example: 3 },
            avgProcessingTime: { type: 'number', example: 5420 },
            totalFileSize: { type: 'number', example: 52428800 },
            popularFormats: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  format: { type: 'string', example: 'pdf' },
                  count: { type: 'number', example: 85 },
                  percentage: { type: 'number', example: 56.7 },
                },
              },
            },
            popularTypes: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  type: { type: 'string', example: 'report' },
                  count: { type: 'number', example: 95 },
                  percentage: { type: 'number', example: 63.3 },
                },
              },
            },
            recentJobs: { type: 'array', items: { type: 'object' } },
          },
        },
        message: { type: 'string', example: 'Статистика экспорта получена' },
      },
    },
  })
  // @Roles('MANAGER', 'ADMIN')
  async getExportStatistics(): Promise<{
    success: boolean;
    data: ExportStatistics;
    message: string;
  }> {
    const statistics = await this.exportService.getExportStatistics();
    
    return {
      success: true,
      data: statistics,
      message: 'Статистика экспорта получена',
    };
  }

  @Get('stats/service')
  @ApiOperation({
    summary: 'Статистика работы сервиса экспорта',
    description: 'Возвращает техническую статистику работы сервиса',
  })
  @ApiResponse({
    status: 200,
    description: 'Статистика сервиса получена',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: {
          type: 'object',
          properties: {
            totalJobs: { type: 'number', example: 150 },
            queuedJobs: { type: 'number', example: 3 },
            processingJobs: { type: 'number', example: 2 },
            batchJobs: { type: 'number', example: 5 },
            autoExports: { type: 'number', example: 8 },
            templates: { type: 'number', example: 12 },
            presets: { type: 'number', example: 6 },
            memoryUsage: {
              type: 'object',
              properties: {
                rss: { type: 'number' },
                heapTotal: { type: 'number' },
                heapUsed: { type: 'number' },
                external: { type: 'number' },
                arrayBuffers: { type: 'number' },
              },
            },
            uptime: { type: 'number', example: 86400 },
          },
        },
        message: { type: 'string', example: 'Статистика сервиса получена' },
      },
    },
  })
  // @Roles('ADMIN')
  async getServiceStats(): Promise<{
    success: boolean;
    data: any;
    message: string;
  }> {
    const stats = this.exportService.getServiceStats();
    
    return {
      success: true,
      data: stats,
      message: 'Статистика сервиса экспорта получена',
    };
  }
}