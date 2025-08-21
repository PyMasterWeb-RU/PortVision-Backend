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
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBearerAuth,
  ApiBody,
} from '@nestjs/swagger';
import { AggregationService } from './aggregation.service';
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
} from './interfaces/aggregation.interface';

// Базовые guards будут добавлены позже при интеграции с Keycloak
// import { JwtAuthGuard } from '../auth/jwt-auth.guard';
// import { RolesGuard } from '../auth/roles.guard';
// import { Roles } from '../auth/roles.decorator';

@ApiTags('aggregation')
@Controller('aggregation')
// @UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT')
export class AggregationController {
  private readonly logger = new Logger(AggregationController.name);

  constructor(private readonly aggregationService: AggregationService) {}

  @Post('jobs')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Создание задания агрегации',
    description: 'Создает новое задание для агрегации данных с настройками расписания и трансформации',
  })
  @ApiBody({
    type: CreateAggregationJobDto,
    description: 'Параметры создания задания агрегации',
    examples: {
      'daily-operations': {
        summary: 'Ежедневная агрегация операций',
        value: {
          name: 'Ежедневная агрегация операций терминала',
          type: AggregationType.SCHEDULED,
          description: 'Агрегирует операции терминала по дням для отчетности',
          schedule: {
            type: 'cron',
            expression: '0 2 * * *',
            timezone: 'Europe/Moscow',
            enabled: true,
            priority: 5,
          },
          source: {
            type: 'clickhouse',
            connection: {
              host: 'localhost',
              port: 8123,
              database: 'terminal_operations',
            },
            table: 'container_movements',
            incremental: true,
            incrementalField: 'updated_at',
            batchSize: 1000,
          },
          target: {
            type: 'clickhouse',
            connection: {
              host: 'localhost',
              port: 8123,
              database: 'terminal_analytics',
            },
            table: 'daily_operations_summary',
            partitioning: {
              enabled: true,
              field: 'date',
              type: 'time',
              interval: 'day',
            },
            retention: {
              enabled: true,
              period: 365,
              archiveAfter: 90,
            },
          },
          transformation: {
            operations: [
              {
                type: 'count',
                field: '*',
                alias: 'total_operations',
              },
              {
                type: 'sum',
                field: 'teu_count',
                alias: 'total_teu',
              },
              {
                type: 'avg',
                field: 'processing_time',
                alias: 'avg_processing_time',
              },
            ],
            groupBy: ['date', 'operation_type'],
            orderBy: [{ field: 'date', direction: 'DESC' }],
          },
          isActive: true,
        },
      },
      'realtime-monitoring': {
        summary: 'Мониторинг в реальном времени',
        value: {
          name: 'Мониторинг оборудования в реальном времени',
          type: AggregationType.REALTIME,
          description: 'Агрегация данных оборудования для мониторинга',
          schedule: {
            type: 'interval',
            interval: 30000,
            enabled: true,
            priority: 8,
          },
          source: {
            type: 'kafka',
            connection: {
              host: 'localhost',
              port: 9092,
            },
            topic: 'equipment-telemetry',
            batchSize: 100,
          },
          target: {
            type: 'redis',
            connection: {
              host: 'localhost',
              port: 6379,
            },
            collection: 'equipment_status',
          },
          transformation: {
            operations: [
              {
                type: 'avg',
                field: 'cpu_usage',
                alias: 'avg_cpu',
              },
              {
                type: 'max',
                field: 'memory_usage',
                alias: 'max_memory',
              },
              {
                type: 'count',
                field: 'status',
                alias: 'total_readings',
                condition: 'status = "active"',
              },
            ],
            groupBy: ['equipment_id'],
          },
          isActive: true,
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Задание агрегации создано',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'aggr-uuid' },
            name: { type: 'string', example: 'Ежедневная агрегация операций терминала' },
            type: { type: 'string', example: 'scheduled' },
            status: { type: 'string', example: 'pending' },
            schedule: {
              type: 'object',
              properties: {
                type: { type: 'string', example: 'cron' },
                expression: { type: 'string', example: '0 2 * * *' },
                enabled: { type: 'boolean', example: true },
              },
            },
            isActive: { type: 'boolean', example: true },
            createdAt: { type: 'string', format: 'date-time' },
            nextRun: { type: 'string', format: 'date-time' },
          },
        },
        message: { type: 'string', example: 'Задание агрегации создано' },
      },
    },
  })
  // @Roles('MANAGER', 'ADMIN', 'ANALYST')
  async createAggregationJob(
    @Body() dto: CreateAggregationJobDto,
    @Request() req: any,
  ): Promise<{
    success: boolean;
    data: AggregationJob;
    message: string;
  }> {
    const userId = req.user?.id || 'demo-user';
    this.logger.log(`📊 Создание задания агрегации: ${dto.name} - ${userId}`);
    
    const job = await this.aggregationService.createAggregationJob(dto, userId);
    
    return {
      success: true,
      data: job,
      message: 'Задание агрегации создано',
    };
  }

  @Get('jobs')
  @ApiOperation({
    summary: 'Получение списка заданий агрегации',
    description: 'Возвращает список заданий агрегации с фильтрацией и пагинацией',
  })
  @ApiQuery({ name: 'page', required: false, description: 'Номер страницы', example: 1 })
  @ApiQuery({ name: 'limit', required: false, description: 'Количество элементов', example: 20 })
  @ApiQuery({ name: 'type', required: false, enum: AggregationType, description: 'Фильтр по типу' })
  @ApiQuery({ name: 'status', required: false, enum: AggregationStatus, description: 'Фильтр по статусу' })
  @ApiQuery({ name: 'category', required: false, enum: AggregationCategory, description: 'Фильтр по категории' })
  @ApiQuery({ name: 'search', required: false, description: 'Поиск по названию' })
  @ApiQuery({ name: 'activeOnly', required: false, description: 'Только активные', example: false })
  @ApiQuery({ name: 'createdFrom', required: false, description: 'Дата создания с' })
  @ApiQuery({ name: 'createdTo', required: false, description: 'Дата создания по' })
  @ApiResponse({
    status: 200,
    description: 'Список заданий агрегации получен',
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
                  name: { type: 'string' },
                  type: { type: 'string' },
                  status: { type: 'string' },
                  progress: { type: 'number' },
                  isActive: { type: 'boolean' },
                  createdAt: { type: 'string', format: 'date-time' },
                  nextRun: { type: 'string', format: 'date-time' },
                  lastRun: { type: 'string', format: 'date-time' },
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
  // @Roles('MANAGER', 'ADMIN', 'ANALYST', 'VIEWER')
  async getAggregationJobs(@Query() dto: GetAggregationJobsDto): Promise<{
    success: boolean;
    data: {
      jobs: AggregationJob[];
      total: number;
      page: number;
      limit: number;
    };
    message: string;
  }> {
    const data = await this.aggregationService.getAggregationJobs(dto);
    
    return {
      success: true,
      data,
      message: 'Список заданий агрегации получен',
    };
  }

  @Get('jobs/:jobId')
  @ApiOperation({
    summary: 'Получение задания агрегации',
    description: 'Возвращает детальную информацию о задании агрегации',
  })
  @ApiParam({
    name: 'jobId',
    description: 'ID задания агрегации',
    example: 'aggr-uuid',
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
            name: { type: 'string' },
            type: { type: 'string' },
            status: { type: 'string' },
            progress: { type: 'number' },
            schedule: { type: 'object' },
            source: { type: 'object' },
            target: { type: 'object' },
            transformation: { type: 'object' },
            result: {
              type: 'object',
              properties: {
                recordsProcessed: { type: 'number' },
                recordsInserted: { type: 'number' },
                executionTime: { type: 'number' },
                startTime: { type: 'string', format: 'date-time' },
                endTime: { type: 'string', format: 'date-time' },
              },
            },
            createdAt: { type: 'string', format: 'date-time' },
            lastRun: { type: 'string', format: 'date-time' },
            nextRun: { type: 'string', format: 'date-time' },
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
  // @Roles('MANAGER', 'ADMIN', 'ANALYST', 'VIEWER')
  async getAggregationJob(@Param('jobId') jobId: string): Promise<{
    success: boolean;
    data: AggregationJob;
    message: string;
  }> {
    const job = await this.aggregationService.getAggregationJob(jobId);
    
    return {
      success: true,
      data: job,
      message: 'Информация о задании агрегации получена',
    };
  }

  @Put('jobs/:jobId')
  @ApiOperation({
    summary: 'Обновление задания агрегации',
    description: 'Обновляет конфигурацию задания агрегации',
  })
  @ApiParam({
    name: 'jobId',
    description: 'ID задания агрегации',
    example: 'aggr-uuid',
  })
  @ApiBody({
    type: UpdateAggregationJobDto,
    description: 'Параметры для обновления',
    examples: {
      'update-schedule': {
        summary: 'Обновление расписания',
        value: {
          schedule: {
            type: 'cron',
            expression: '0 3 * * *',
            enabled: true,
            priority: 7,
          },
          isActive: true,
        },
      },
      'update-transformation': {
        summary: 'Обновление трансформации',
        value: {
          transformation: {
            operations: [
              {
                type: 'count',
                field: '*',
                alias: 'total_operations',
              },
              {
                type: 'sum',
                field: 'teu_count',
                alias: 'total_teu',
              },
              {
                type: 'percentile',
                field: 'processing_time',
                alias: 'p95_processing_time',
                params: { percentile: 95 },
              },
            ],
            groupBy: ['date', 'operation_type', 'client_id'],
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Задание обновлено',
  })
  @ApiResponse({
    status: 404,
    description: 'Задание не найдено',
  })
  // @Roles('MANAGER', 'ADMIN', 'ANALYST')
  async updateAggregationJob(
    @Param('jobId') jobId: string,
    @Body() dto: UpdateAggregationJobDto,
    @Request() req: any,
  ): Promise<{
    success: boolean;
    data: AggregationJob;
    message: string;
  }> {
    const userId = req.user?.id || 'demo-user';
    const job = await this.aggregationService.updateAggregationJob(jobId, dto, userId);
    
    return {
      success: true,
      data: job,
      message: 'Задание агрегации обновлено',
    };
  }

  @Delete('jobs/:jobId')
  @ApiOperation({
    summary: 'Удаление задания агрегации',
    description: 'Удаляет задание агрегации и связанные данные',
  })
  @ApiParam({
    name: 'jobId',
    description: 'ID задания для удаления',
    example: 'aggr-uuid',
  })
  @ApiResponse({
    status: 200,
    description: 'Задание удалено',
  })
  @ApiResponse({
    status: 400,
    description: 'Задание нельзя удалить',
  })
  @ApiResponse({
    status: 404,
    description: 'Задание не найдено',
  })
  // @Roles('MANAGER', 'ADMIN')
  async deleteAggregationJob(
    @Param('jobId') jobId: string,
    @Request() req: any,
  ): Promise<{
    success: boolean;
    message: string;
  }> {
    const userId = req.user?.id || 'demo-user';
    await this.aggregationService.deleteAggregationJob(jobId, userId);
    
    return {
      success: true,
      message: 'Задание агрегации удалено',
    };
  }

  @Post('jobs/:jobId/run')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: 'Запуск задания агрегации',
    description: 'Запускает задание агрегации вне расписания',
  })
  @ApiParam({
    name: 'jobId',
    description: 'ID задания для запуска',
    example: 'aggr-uuid',
  })
  @ApiBody({
    type: RunAggregationJobDto,
    description: 'Параметры запуска',
    examples: {
      'normal-run': {
        summary: 'Обычный запуск',
        value: {
          highPriority: false,
          ignoreDependencies: false,
        },
      },
      'priority-run': {
        summary: 'Приоритетный запуск',
        value: {
          parameters: {
            dateFrom: '2024-12-01',
            dateTo: '2024-12-31',
            forceRefresh: true,
          },
          highPriority: true,
          ignoreDependencies: false,
        },
      },
    },
  })
  @ApiResponse({
    status: 202,
    description: 'Задание добавлено в очередь',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            status: { type: 'string', example: 'pending' },
            progress: { type: 'number', example: 0 },
          },
        },
        message: { type: 'string', example: 'Задание запущено' },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Задание уже выполняется',
  })
  // @Roles('MANAGER', 'ADMIN', 'ANALYST')
  async runAggregationJob(
    @Param('jobId') jobId: string,
    @Body() dto: RunAggregationJobDto,
    @Request() req: any,
  ): Promise<{
    success: boolean;
    data: AggregationJob;
    message: string;
  }> {
    const userId = req.user?.id || 'demo-user';
    this.logger.log(`▶️ Запуск задания агрегации: ${jobId} - ${userId}`);
    
    const job = await this.aggregationService.runAggregationJob(jobId, dto, userId);
    
    return {
      success: true,
      data: job,
      message: 'Задание агрегации запущено',
    };
  }

  @Post('templates')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Создание шаблона агрегации',
    description: 'Создает переиспользуемый шаблон для заданий агрегации',
  })
  @ApiBody({
    type: CreateAggregationTemplateDto,
    description: 'Параметры шаблона',
    examples: {
      'operational-template': {
        summary: 'Шаблон операционной агрегации',
        value: {
          name: 'Шаблон операционной агрегации',
          description: 'Базовый шаблон для агрегации операций терминала',
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
                { type: 'count', field: '*', alias: 'total_count' },
                { type: 'sum', field: '{{sum_field}}', alias: 'total_sum' },
              ],
              groupBy: ['{{group_field}}'],
            },
            schedule: {
              type: 'cron',
              expression: '{{cron_expression}}',
              enabled: true,
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
              name: 'sum_field',
              type: 'string',
              description: 'Поле для суммирования',
              required: true,
            },
            {
              name: 'group_field',
              type: 'string',
              description: 'Поле группировки',
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
          isDefault: false,
          tags: ['операции', 'терминал', 'базовый'],
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Шаблон создан',
  })
  // @Roles('MANAGER', 'ADMIN')
  async createAggregationTemplate(
    @Body() dto: CreateAggregationTemplateDto,
    @Request() req: any,
  ): Promise<{
    success: boolean;
    data: AggregationTemplate;
    message: string;
  }> {
    const userId = req.user?.id || 'demo-user';
    this.logger.log(`📄 Создание шаблона агрегации: ${dto.name} - ${userId}`);
    
    const template = await this.aggregationService.createAggregationTemplate(dto, userId);
    
    return {
      success: true,
      data: template,
      message: 'Шаблон агрегации создан',
    };
  }

  @Get('templates')
  @ApiOperation({
    summary: 'Получение шаблонов агрегации',
    description: 'Возвращает список доступных шаблонов агрегации',
  })
  @ApiResponse({
    status: 200,
    description: 'Шаблоны получены',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', example: 'template-uuid' },
              name: { type: 'string', example: 'Шаблон операционной агрегации' },
              description: { type: 'string' },
              category: { type: 'string', example: 'operational' },
              type: { type: 'string', example: 'scheduled' },
              isDefault: { type: 'boolean', example: false },
              tags: { type: 'array', items: { type: 'string' } },
              variables: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    name: { type: 'string' },
                    type: { type: 'string' },
                    description: { type: 'string' },
                    required: { type: 'boolean' },
                  },
                },
              },
            },
          },
        },
        message: { type: 'string', example: 'Шаблоны агрегации получены' },
      },
    },
  })
  // @Roles('MANAGER', 'ADMIN', 'ANALYST', 'VIEWER')
  async getAggregationTemplates(): Promise<{
    success: boolean;
    data: AggregationTemplate[];
    message: string;
  }> {
    const templates = await this.aggregationService.getAggregationTemplates();
    
    return {
      success: true,
      data: templates,
      message: 'Шаблоны агрегации получены',
    };
  }

  @Get('statistics')
  @ApiOperation({
    summary: 'Статистика агрегации',
    description: 'Возвращает статистику работы системы агрегации',
  })
  @ApiQuery({ name: 'dateFrom', required: false, description: 'Дата начала периода' })
  @ApiQuery({ name: 'dateTo', required: false, description: 'Дата окончания периода' })
  @ApiQuery({ name: 'category', required: false, enum: AggregationCategory, description: 'Фильтр по категории' })
  @ApiQuery({ name: 'detailed', required: false, description: 'Детальная статистика', example: false })
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
            totalJobs: { type: 'number', example: 45 },
            activeJobs: { type: 'number', example: 38 },
            completedJobs: { type: 'number', example: 142 },
            failedJobs: { type: 'number', example: 3 },
            totalRecordsProcessed: { type: 'number', example: 1250000 },
            totalBytesProcessed: { type: 'number', example: 524288000 },
            averageExecutionTime: { type: 'number', example: 12500 },
            successRate: { type: 'number', example: 97.9 },
            jobsByCategory: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  category: { type: 'string', example: 'operational' },
                  count: { type: 'number', example: 25 },
                  percentage: { type: 'number', example: 55.6 },
                },
              },
            },
            jobsByType: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  type: { type: 'string', example: 'scheduled' },
                  count: { type: 'number', example: 35 },
                  percentage: { type: 'number', example: 77.8 },
                },
              },
            },
            performanceMetrics: {
              type: 'object',
              properties: {
                fastestJob: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    name: { type: 'string' },
                    executionTime: { type: 'number' },
                  },
                },
                slowestJob: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    name: { type: 'string' },
                    executionTime: { type: 'number' },
                  },
                },
              },
            },
            recentActivity: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  jobId: { type: 'string' },
                  jobName: { type: 'string' },
                  status: { type: 'string' },
                  executionTime: { type: 'number' },
                  recordsProcessed: { type: 'number' },
                  completedAt: { type: 'string', format: 'date-time' },
                },
              },
            },
          },
        },
        message: { type: 'string', example: 'Статистика агрегации получена' },
      },
    },
  })
  // @Roles('MANAGER', 'ADMIN', 'ANALYST')
  async getAggregationStatistics(@Query() dto: GetAggregationStatsDto): Promise<{
    success: boolean;
    data: AggregationStatistics;
    message: string;
  }> {
    const statistics = await this.aggregationService.getAggregationStatistics(dto);
    
    return {
      success: true,
      data: statistics,
      message: 'Статистика агрегации получена',
    };
  }

  @Get('categories')
  @ApiOperation({
    summary: 'Получение категорий агрегации',
    description: 'Возвращает список доступных категорий агрегации с описанием',
  })
  @ApiResponse({
    status: 200,
    description: 'Категории получены',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              category: { type: 'string', example: 'operational' },
              name: { type: 'string', example: 'Операционные данные' },
              description: { type: 'string' },
              examples: { type: 'array', items: { type: 'string' } },
            },
          },
        },
        message: { type: 'string', example: 'Категории агрегации получены' },
      },
    },
  })
  // @Roles('MANAGER', 'ADMIN', 'ANALYST', 'VIEWER')
  async getAggregationCategories(): Promise<{
    success: boolean;
    data: Array<{
      category: string;
      name: string;
      description: string;
      examples: string[];
    }>;
    message: string;
  }> {
    const categories = [
      {
        category: AggregationCategory.OPERATIONAL,
        name: 'Операционные данные',
        description: 'Агрегация операционных данных терминала',
        examples: ['Движения контейнеров', 'Операции причалов', 'Время обработки'],
      },
      {
        category: AggregationCategory.FINANCIAL,
        name: 'Финансовые данные',
        description: 'Агрегация финансовых показателей',
        examples: ['Выручка', 'Расходы', 'Прибыль по услугам'],
      },
      {
        category: AggregationCategory.EQUIPMENT,
        name: 'Данные оборудования',
        description: 'Агрегация показателей работы оборудования',
        examples: ['Загрузка кранов', 'Время простоя', 'Производительность'],
      },
      {
        category: AggregationCategory.SAFETY,
        name: 'Данные безопасности',
        description: 'Агрегация показателей безопасности',
        examples: ['Инциденты', 'Нарушения', 'Обучение персонала'],
      },
      {
        category: AggregationCategory.ENVIRONMENTAL,
        name: 'Экологические данные',
        description: 'Агрегация экологических показателей',
        examples: ['Выбросы CO2', 'Потребление энергии', 'Утилизация отходов'],
      },
      {
        category: AggregationCategory.CUSTOMER,
        name: 'Клиентские данные',
        description: 'Агрегация данных по клиентам',
        examples: ['Удовлетворенность', 'Время обслуживания', 'Объемы грузооборота'],
      },
      {
        category: AggregationCategory.CUSTOM,
        name: 'Пользовательские данные',
        description: 'Пользовательские агрегации',
        examples: ['Специальные отчеты', 'Нестандартные метрики', 'Экспериментальные данные'],
      },
    ];

    return {
      success: true,
      data: categories,
      message: 'Категории агрегации получены',
    };
  }

  @Get('stats/service')
  @ApiOperation({
    summary: 'Статистика работы сервиса агрегации',
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
            totalJobs: { type: 'number', example: 45 },
            runningJobs: { type: 'number', example: 3 },
            queuedJobs: { type: 'number', example: 7 },
            highPriorityQueue: { type: 'number', example: 2 },
            normalPriorityQueue: { type: 'number', example: 4 },
            lowPriorityQueue: { type: 'number', example: 1 },
            templates: { type: 'number', example: 8 },
            queues: { type: 'number', example: 3 },
            incrementalStates: { type: 'number', example: 12 },
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
    const stats = this.aggregationService.getServiceStats();
    
    return {
      success: true,
      data: stats,
      message: 'Статистика сервиса агрегации получена',
    };
  }
}