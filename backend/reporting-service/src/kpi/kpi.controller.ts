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
import { KpiService } from './kpi.service';
import {
  GetKPIMetricsDto,
  CreateKPITargetDto,
  CreateKPIAlertDto,
  GetKPIDashboardDto,
  GenerateKPIReportDto,
  GetKPITrendsDto,
  GetKPIAlertsDto,
  AcknowledgeKPIAlertDto,
} from './dto/kpi.dto';
import { KPIMetric, KPITarget, KPIAlert, KPIDashboard, KPIReport } from './interfaces/kpi.interface';

// Базовые guards будут добавлены позже при интеграции с Keycloak
// import { JwtAuthGuard } from '../auth/jwt-auth.guard';
// import { RolesGuard } from '../auth/roles.guard';
// import { Roles } from '../auth/roles.decorator';

@ApiTags('kpi')
@Controller('kpi')
// @UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT')
export class KpiController {
  private readonly logger = new Logger(KpiController.name);

  constructor(private readonly kpiService: KpiService) {}

  @Get('metrics')
  @ApiOperation({
    summary: 'Получение KPI метрик',
    description: 'Возвращает ключевые показатели эффективности терминала с возможностью фильтрации',
  })
  @ApiQuery({ name: 'category', required: false, description: 'Категория KPI' })
  @ApiQuery({ name: 'dateFrom', required: false, description: 'Дата начала' })
  @ApiQuery({ name: 'dateTo', required: false, description: 'Дата окончания' })
  @ApiQuery({ name: 'period', required: false, description: 'Тип периода' })
  @ApiQuery({ name: 'statuses', required: false, description: 'Фильтр по статусам' })
  @ApiQuery({ name: 'tags', required: false, description: 'Фильтр по тегам' })
  @ApiQuery({ name: 'includeTrends', required: false, description: 'Включить тренды' })
  @ApiQuery({ name: 'includeBenchmarks', required: false, description: 'Включить бенчмарки' })
  @ApiQuery({ name: 'includeTargets', required: false, description: 'Включить цели' })
  @ApiQuery({ name: 'forceRefresh', required: false, description: 'Принудительное обновление' })
  @ApiResponse({
    status: 200,
    description: 'KPI метрики получены',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', example: 'container_throughput' },
              name: { type: 'string', example: 'Пропускная способность (TEU)' },
              category: { type: 'string', example: 'operational' },
              value: { type: 'number', example: 1250 },
              unit: { type: 'string', example: 'TEU' },
              target: { type: 'number', example: 1000 },
              status: { type: 'string', example: 'excellent' },
              trend: {
                type: 'object',
                properties: {
                  direction: { type: 'string', example: 'up' },
                  percentage: { type: 'number', example: 5.2 },
                  period: { type: 'string', example: 'vs previous period' },
                },
              },
              calculatedAt: { type: 'string', format: 'date-time' },
            },
          },
        },
        message: { type: 'string', example: 'KPI метрики получены' },
      },
    },
  })
  // @Roles('MANAGER', 'DISPATCHER', 'ANALYST', 'VIEWER')
  async getKPIMetrics(@Query() dto: GetKPIMetricsDto): Promise<{
    success: boolean;
    data: KPIMetric[];
    message: string;
  }> {
    this.logger.log(`📊 Запрос KPI метрик: ${dto.category || 'все категории'}`);
    
    const metrics = await this.kpiService.getKPIMetrics(dto);
    
    return {
      success: true,
      data: metrics,
      message: 'KPI метрики получены',
    };
  }

  @Get('dashboard')
  @ApiOperation({
    summary: 'Получение KPI дашборда',
    description: 'Возвращает настроенный дашборд с ключевыми показателями эффективности',
  })
  @ApiQuery({ name: 'dashboardId', required: false, description: 'ID дашборда' })
  @ApiQuery({ name: 'category', required: false, description: 'Категория для фильтрации' })
  @ApiQuery({ name: 'refreshInterval', required: false, description: 'Интервал обновления' })
  @ApiQuery({ name: 'groupBy', required: false, description: 'Группировка метрик' })
  @ApiQuery({ name: 'sortBy', required: false, description: 'Сортировка метрик' })
  @ApiResponse({
    status: 200,
    description: 'KPI дашборд получен',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'default' },
            name: { type: 'string', example: 'Основные KPI терминала' },
            description: { type: 'string' },
            category: { type: 'string', example: 'operational' },
            metrics: { type: 'array', items: { type: 'object' } },
            layout: {
              type: 'object',
              properties: {
                type: { type: 'string', example: 'grid' },
                columns: { type: 'number', example: 4 },
                groupBy: { type: 'string', example: 'category' },
                sorting: { type: 'string', example: 'status' },
              },
            },
            refreshInterval: { type: 'number', example: 60 },
          },
        },
        message: { type: 'string', example: 'KPI дашборд получен' },
      },
    },
  })
  // @Roles('MANAGER', 'DISPATCHER', 'ANALYST', 'VIEWER')
  async getKPIDashboard(@Query() dto: GetKPIDashboardDto): Promise<{
    success: boolean;
    data: KPIDashboard;
    message: string;
  }> {
    const dashboard = await this.kpiService.getKPIDashboard(dto);
    
    return {
      success: true,
      data: dashboard,
      message: 'KPI дашборд получен',
    };
  }

  @Post('targets')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Создание цели KPI',
    description: 'Устанавливает целевое значение для указанной KPI метрики',
  })
  @ApiBody({
    type: CreateKPITargetDto,
    description: 'Параметры цели KPI',
    examples: {
      'throughput-target': {
        summary: 'Цель по пропускной способности',
        value: {
          metricId: 'container_throughput',
          targetValue: 1000,
          targetType: 'minimum',
          effectiveFrom: '2024-01-01T00:00:00.000Z',
          effectiveTo: '2024-12-31T23:59:59.999Z',
          description: 'Минимальная пропускная способность терминала',
          owner: 'operations_manager',
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Цель KPI создана',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: {
          type: 'object',
          properties: {
            metricId: { type: 'string', example: 'container_throughput' },
            targetValue: { type: 'number', example: 1000 },
            targetType: { type: 'string', example: 'minimum' },
            effectiveFrom: { type: 'string', format: 'date-time' },
            effectiveTo: { type: 'string', format: 'date-time' },
            description: { type: 'string' },
            owner: { type: 'string' },
          },
        },
        message: { type: 'string', example: 'Цель KPI создана' },
      },
    },
  })
  // @Roles('MANAGER', 'ADMIN')
  async createKPITarget(@Body() dto: CreateKPITargetDto): Promise<{
    success: boolean;
    data: KPITarget;
    message: string;
  }> {
    this.logger.log(`🎯 Создание цели KPI: ${dto.metricId} = ${dto.targetValue}`);
    
    const target = await this.kpiService.createKPITarget(dto);
    
    return {
      success: true,
      data: target,
      message: 'Цель KPI создана',
    };
  }

  @Post('alerts')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Создание алерта KPI',
    description: 'Настраивает алерт для мониторинга KPI метрики',
  })
  @ApiBody({
    type: CreateKPIAlertDto,
    description: 'Параметры алерта KPI',
    examples: {
      'turnaround-alert': {
        summary: 'Алерт по времени оборота судна',
        value: {
          metricId: 'vessel_turnaround_time',
          alertType: 'threshold',
          condition: {
            operator: '>',
            value: 24,
            duration: 30,
            consecutive: true,
          },
          severity: 'high',
          message: 'Время оборота судна превышает норму',
          actions: [
            {
              type: 'email',
              target: 'operations@terminal.com',
              template: 'kpi_alert',
            },
          ],
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Алерт KPI создан',
  })
  // @Roles('MANAGER', 'DISPATCHER', 'ADMIN')
  async createKPIAlert(@Body() dto: CreateKPIAlertDto): Promise<{
    success: boolean;
    data: KPIAlert;
    message: string;
  }> {
    this.logger.log(`🚨 Создание алерта KPI: ${dto.metricId} (${dto.severity})`);
    
    const alert = await this.kpiService.createKPIAlert(dto);
    
    return {
      success: true,
      data: alert,
      message: 'Алерт KPI создан',
    };
  }

  @Get('alerts')
  @ApiOperation({
    summary: 'Получение списка алертов KPI',
    description: 'Возвращает список активных и исторических алертов с фильтрацией',
  })
  @ApiQuery({ name: 'page', required: false, description: 'Номер страницы' })
  @ApiQuery({ name: 'limit', required: false, description: 'Количество элементов' })
  @ApiQuery({ name: 'severity', required: false, description: 'Фильтр по важности' })
  @ApiQuery({ name: 'unacknowledgedOnly', required: false, description: 'Только непрочитанные' })
  @ApiQuery({ name: 'dateFrom', required: false, description: 'Дата начала' })
  @ApiQuery({ name: 'dateTo', required: false, description: 'Дата окончания' })
  @ApiQuery({ name: 'metricId', required: false, description: 'ID метрики' })
  @ApiResponse({
    status: 200,
    description: 'Список алертов получен',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: {
          type: 'object',
          properties: {
            alerts: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string', example: 'alert-uuid' },
                  metricId: { type: 'string', example: 'vessel_turnaround_time' },
                  alertType: { type: 'string', example: 'threshold' },
                  severity: { type: 'string', example: 'high' },
                  message: { type: 'string' },
                  triggeredAt: { type: 'string', format: 'date-time' },
                  acknowledgedAt: { type: 'string', format: 'date-time' },
                  acknowledgedBy: { type: 'string' },
                },
              },
            },
            total: { type: 'number', example: 15 },
            page: { type: 'number', example: 1 },
            limit: { type: 'number', example: 20 },
          },
        },
        message: { type: 'string', example: 'Список алертов получен' },
      },
    },
  })
  // @Roles('MANAGER', 'DISPATCHER', 'ANALYST', 'VIEWER')
  async getKPIAlerts(@Query() dto: GetKPIAlertsDto): Promise<{
    success: boolean;
    data: {
      alerts: KPIAlert[];
      total: number;
      page: number;
      limit: number;
    };
    message: string;
  }> {
    const data = await this.kpiService.getKPIAlerts(dto);
    
    return {
      success: true,
      data,
      message: 'Список алертов получен',
    };
  }

  @Put('alerts/:alertId/acknowledge')
  @ApiOperation({
    summary: 'Подтверждение алерта KPI',
    description: 'Отмечает алерт как прочитанный и добавляет комментарий',
  })
  @ApiParam({
    name: 'alertId',
    description: 'ID алерта для подтверждения',
    example: 'alert-uuid',
  })
  @ApiBody({
    type: AcknowledgeKPIAlertDto,
    description: 'Параметры подтверждения',
    examples: {
      'acknowledge': {
        summary: 'Подтверждение алерта',
        value: {
          comment: 'Проблема выявлена, работаем над устранением',
          expectedResolution: '2024-12-25T15:00:00.000Z',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Алерт подтвержден',
  })
  // @Roles('MANAGER', 'DISPATCHER', 'ANALYST')
  async acknowledgeAlert(
    @Param('alertId') alertId: string,
    @Body() dto: AcknowledgeKPIAlertDto,
    @Request() req: any,
  ): Promise<{
    success: boolean;
    data: KPIAlert;
    message: string;
  }> {
    const userId = req.user?.id || 'demo-user';
    const alert = await this.kpiService.acknowledgeAlert(alertId, dto, userId);
    
    return {
      success: true,
      data: alert,
      message: 'Алерт подтвержден',
    };
  }

  @Post('reports')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Генерация KPI отчета',
    description: 'Создает подробный отчет с анализом KPI метрик за указанный период',
  })
  @ApiBody({
    type: GenerateKPIReportDto,
    description: 'Параметры генерации отчета',
    examples: {
      'monthly-report': {
        summary: 'Месячный отчет по операционным KPI',
        value: {
          title: 'Операционные KPI за декабрь 2024',
          description: 'Анализ ключевых показателей эффективности операций терминала',
          category: 'operational',
          dateFrom: '2024-12-01T00:00:00.000Z',
          dateTo: '2024-12-31T23:59:59.999Z',
          includeTrendAnalysis: true,
          includeBenchmarking: true,
          includeRecommendations: true,
          includeForecast: false,
          format: 'pdf',
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'KPI отчет сгенерирован',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'report-uuid' },
            title: { type: 'string', example: 'Операционные KPI за декабрь 2024' },
            category: { type: 'string', example: 'operational' },
            summary: {
              type: 'object',
              properties: {
                totalMetrics: { type: 'number', example: 10 },
                excellentCount: { type: 'number', example: 4 },
                goodCount: { type: 'number', example: 3 },
                warningCount: { type: 'number', example: 2 },
                criticalCount: { type: 'number', example: 1 },
                overallScore: { type: 'number', example: 75 },
              },
            },
            generatedAt: { type: 'string', format: 'date-time' },
          },
        },
        message: { type: 'string', example: 'KPI отчет сгенерирован' },
      },
    },
  })
  // @Roles('MANAGER', 'ANALYST', 'ADMIN')
  async generateKPIReport(@Body() dto: GenerateKPIReportDto): Promise<{
    success: boolean;
    data: KPIReport;
    message: string;
  }> {
    this.logger.log(`📋 Генерация KPI отчета: ${dto.title}`);
    
    const report = await this.kpiService.generateKPIReport(dto);
    
    return {
      success: true,
      data: report,
      message: 'KPI отчет сгенерирован',
    };
  }

  @Get('categories')
  @ApiOperation({
    summary: 'Получение категорий KPI',
    description: 'Возвращает список доступных категорий KPI с описанием',
  })
  @ApiResponse({
    status: 200,
    description: 'Категории KPI получены',
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
              name: { type: 'string', example: 'Операционные показатели' },
              description: { type: 'string' },
              metrics: { type: 'array', items: { type: 'string' } },
            },
          },
        },
        message: { type: 'string', example: 'Категории KPI получены' },
      },
    },
  })
  // @Roles('MANAGER', 'DISPATCHER', 'ANALYST', 'VIEWER')
  async getKPICategories(): Promise<{
    success: boolean;
    data: Array<{
      category: string;
      name: string;
      description: string;
      metrics: string[];
    }>;
    message: string;
  }> {
    const categories = [
      {
        category: 'operational',
        name: 'Операционные показатели',
        description: 'Ключевые метрики операционной эффективности терминала',
        metrics: ['container_throughput', 'vessel_turnaround_time', 'truck_turnaround_time', 'berth_productivity'],
      },
      {
        category: 'financial',
        name: 'Финансовые показатели',
        description: 'Показатели доходности и финансовой эффективности',
        metrics: ['revenue', 'revenue_per_teu', 'cost_per_move', 'profit_margin'],
      },
      {
        category: 'equipment',
        name: 'Показатели оборудования',
        description: 'Метрики эффективности и надежности оборудования',
        metrics: ['equipment_utilization', 'equipment_availability', 'maintenance_cost', 'breakdown_frequency'],
      },
      {
        category: 'safety',
        name: 'Показатели безопасности',
        description: 'Метрики безопасности и соблюдения требований',
        metrics: ['accident_rate', 'injury_rate', 'near_miss_reports', 'safety_training_compliance'],
      },
      {
        category: 'environmental',
        name: 'Экологические показатели',
        description: 'Метрики воздействия на окружающую среду',
        metrics: ['carbon_emissions', 'energy_consumption', 'waste_reduction', 'water_usage'],
      },
      {
        category: 'customer',
        name: 'Клиентские показатели',
        description: 'Метрики качества обслуживания клиентов',
        metrics: ['customer_satisfaction', 'service_level', 'complaint_resolution_time', 'customer_retention'],
      },
    ];

    return {
      success: true,
      data: categories,
      message: 'Категории KPI получены',
    };
  }

  @Get('stats/service')
  @ApiOperation({
    summary: 'Статистика работы KPI сервиса',
    description: 'Возвращает статистику работы сервиса KPI',
  })
  @ApiResponse({
    status: 200,
    description: 'Статистика получена',
  })
  // @Roles('ADMIN', 'MANAGER')
  async getServiceStats(): Promise<{
    success: boolean;
    data: any;
    message: string;
  }> {
    const stats = this.kpiService.getServiceStats();
    
    return {
      success: true,
      data: stats,
      message: 'Статистика KPI сервиса получена',
    };
  }
}