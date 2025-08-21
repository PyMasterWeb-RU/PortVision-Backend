import {
  IsString,
  IsOptional,
  IsArray,
  IsNumber,
  IsBoolean,
  IsEnum,
  IsObject,
  ValidateNested,
  IsDateString,
  Min,
  Max,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { KPICategory, KPIStatus } from '../interfaces/kpi.interface';

export class GetKPIMetricsDto {
  @ApiPropertyOptional({
    enum: KPICategory,
    description: 'Фильтр по категории KPI',
    example: KPICategory.OPERATIONAL,
  })
  @IsOptional()
  @IsEnum(KPICategory)
  category?: KPICategory;

  @ApiPropertyOptional({
    description: 'Дата начала периода расчета',
    example: '2024-12-01T00:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiPropertyOptional({
    description: 'Дата окончания периода расчета',
    example: '2024-12-31T23:59:59.999Z',
  })
  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @ApiPropertyOptional({
    description: 'Тип периода для группировки',
    enum: ['real-time', 'hourly', 'daily', 'weekly', 'monthly', 'quarterly', 'yearly'],
    example: 'daily',
    default: 'daily',
  })
  @IsOptional()
  @IsEnum(['real-time', 'hourly', 'daily', 'weekly', 'monthly', 'quarterly', 'yearly'])
  period?: 'real-time' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly' = 'daily';

  @ApiPropertyOptional({
    description: 'Фильтр по статусу KPI',
    type: [String],
    enum: KPIStatus,
    example: [KPIStatus.WARNING, KPIStatus.CRITICAL],
  })
  @IsOptional()
  @IsArray()
  @IsEnum(KPIStatus, { each: true })
  statuses?: KPIStatus[];

  @ApiPropertyOptional({
    description: 'Теги для фильтрации',
    type: [String],
    example: ['production', 'performance'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({
    description: 'Включить информацию о трендах',
    example: true,
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  includeTrends?: boolean = true;

  @ApiPropertyOptional({
    description: 'Включить бенчмарки',
    example: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  includeBenchmarks?: boolean = false;

  @ApiPropertyOptional({
    description: 'Включить цели (targets)',
    example: true,
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  includeTargets?: boolean = true;

  @ApiPropertyOptional({
    description: 'Принудительное обновление (игнорировать кэш)',
    example: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  forceRefresh?: boolean = false;
}

export class CreateKPITargetDto {
  @ApiProperty({
    description: 'ID метрики для установки цели',
    example: 'container_throughput',
  })
  @IsString()
  metricId: string;

  @ApiProperty({
    description: 'Целевое значение',
    example: 1000,
  })
  @IsNumber()
  targetValue: number;

  @ApiProperty({
    description: 'Тип цели',
    enum: ['minimum', 'maximum', 'exact', 'range'],
    example: 'minimum',
  })
  @IsEnum(['minimum', 'maximum', 'exact', 'range'])
  targetType: 'minimum' | 'maximum' | 'exact' | 'range';

  @ApiPropertyOptional({
    description: 'Диапазон для типа "range"',
    example: { min: 800, max: 1200 },
  })
  @IsOptional()
  @IsObject()
  targetRange?: { min: number; max: number };

  @ApiProperty({
    description: 'Дата начала действия цели',
    example: '2024-01-01T00:00:00.000Z',
  })
  @IsDateString()
  effectiveFrom: string;

  @ApiPropertyOptional({
    description: 'Дата окончания действия цели',
    example: '2024-12-31T23:59:59.999Z',
  })
  @IsOptional()
  @IsDateString()
  effectiveTo?: string;

  @ApiPropertyOptional({
    description: 'Описание цели',
    example: 'Минимальная пропускная способность терминала',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: 'Ответственный за достижение цели',
    example: 'operations_manager',
  })
  @IsOptional()
  @IsString()
  owner?: string;
}

export class CreateKPIAlertDto {
  @ApiProperty({
    description: 'ID метрики для настройки алерта',
    example: 'vessel_turnaround_time',
  })
  @IsString()
  metricId: string;

  @ApiProperty({
    description: 'Тип алерта',
    enum: ['threshold', 'trend', 'anomaly'],
    example: 'threshold',
  })
  @IsEnum(['threshold', 'trend', 'anomaly'])
  alertType: 'threshold' | 'trend' | 'anomaly';

  @ApiProperty({
    description: 'Условие срабатывания алерта',
    example: {
      operator: '>',
      value: 24,
      duration: 30,
      consecutive: true,
    },
  })
  @IsObject()
  condition: {
    operator: '>' | '<' | '=' | '>=' | '<=' | 'between' | 'outside';
    value: number | [number, number];
    duration?: number;
    consecutive?: boolean;
  };

  @ApiProperty({
    description: 'Уровень важности',
    enum: ['low', 'medium', 'high', 'critical'],
    example: 'high',
  })
  @IsEnum(['low', 'medium', 'high', 'critical'])
  severity: 'low' | 'medium' | 'high' | 'critical';

  @ApiProperty({
    description: 'Сообщение алерта',
    example: 'Время оборота судна превышает норму',
  })
  @IsString()
  message: string;

  @ApiPropertyOptional({
    description: 'Действия при срабатывании алерта',
    type: [Object],
    example: [
      {
        type: 'email',
        target: 'operations@terminal.com',
        template: 'kpi_alert',
      },
    ],
  })
  @IsOptional()
  @IsArray()
  actions?: Array<{
    type: 'email' | 'sms' | 'webhook' | 'notification';
    target: string;
    template?: string;
    parameters?: Record<string, any>;
  }>;
}

export class GetKPIDashboardDto {
  @ApiPropertyOptional({
    description: 'ID дашборда KPI',
    example: 'operational_kpi_dashboard',
  })
  @IsOptional()
  @IsString()
  dashboardId?: string;

  @ApiPropertyOptional({
    enum: KPICategory,
    description: 'Категория для фильтрации метрик',
  })
  @IsOptional()
  @IsEnum(KPICategory)
  category?: KPICategory;

  @ApiPropertyOptional({
    description: 'Интервал обновления в секундах',
    example: 60,
    default: 60,
  })
  @IsOptional()
  @IsNumber()
  @Min(10)
  @Max(3600)
  refreshInterval?: number = 60;

  @ApiPropertyOptional({
    description: 'Группировка метрик',
    enum: ['category', 'status', 'none'],
    example: 'category',
    default: 'category',
  })
  @IsOptional()
  @IsEnum(['category', 'status', 'none'])
  groupBy?: 'category' | 'status' | 'none' = 'category';

  @ApiPropertyOptional({
    description: 'Сортировка метрик',
    enum: ['name', 'value', 'status', 'trend'],
    example: 'status',
    default: 'status',
  })
  @IsOptional()
  @IsEnum(['name', 'value', 'status', 'trend'])
  sortBy?: 'name' | 'value' | 'status' | 'trend' = 'status';
}

export class GenerateKPIReportDto {
  @ApiProperty({
    description: 'Название отчета',
    example: 'Операционные KPI за декабрь 2024',
  })
  @IsString()
  title: string;

  @ApiPropertyOptional({
    description: 'Описание отчета',
    example: 'Анализ ключевых показателей эффективности операций терминала',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    enum: KPICategory,
    description: 'Категория KPI для включения в отчет',
    example: KPICategory.OPERATIONAL,
  })
  @IsOptional()
  @IsEnum(KPICategory)
  category?: KPICategory;

  @ApiProperty({
    description: 'Дата начала отчетного периода',
    example: '2024-12-01T00:00:00.000Z',
  })
  @IsDateString()
  dateFrom: string;

  @ApiProperty({
    description: 'Дата окончания отчетного периода',
    example: '2024-12-31T23:59:59.999Z',
  })
  @IsDateString()
  dateTo: string;

  @ApiPropertyOptional({
    description: 'Включить анализ трендов',
    example: true,
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  includeTrendAnalysis?: boolean = true;

  @ApiPropertyOptional({
    description: 'Включить бенчмаркинг',
    example: true,
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  includeBenchmarking?: boolean = true;

  @ApiPropertyOptional({
    description: 'Включить рекомендации',
    example: true,
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  includeRecommendations?: boolean = true;

  @ApiPropertyOptional({
    description: 'Включить прогнозы',
    example: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  includeForecast?: boolean = false;

  @ApiPropertyOptional({
    description: 'Формат отчета',
    enum: ['json', 'pdf', 'excel'],
    example: 'pdf',
    default: 'pdf',
  })
  @IsOptional()
  @IsEnum(['json', 'pdf', 'excel'])
  format?: 'json' | 'pdf' | 'excel' = 'pdf';
}

export class GetKPITrendsDto {
  @ApiProperty({
    description: 'ID метрики для анализа трендов',
    example: 'container_throughput',
  })
  @IsString()
  metricId: string;

  @ApiProperty({
    description: 'Дата начала анализа',
    example: '2024-01-01T00:00:00.000Z',
  })
  @IsDateString()
  dateFrom: string;

  @ApiProperty({
    description: 'Дата окончания анализа',
    example: '2024-12-31T23:59:59.999Z',
  })
  @IsDateString()
  dateTo: string;

  @ApiPropertyOptional({
    description: 'Период агрегации',
    enum: ['hour', 'day', 'week', 'month'],
    example: 'day',
    default: 'day',
  })
  @IsOptional()
  @IsEnum(['hour', 'day', 'week', 'month'])
  aggregationPeriod?: 'hour' | 'day' | 'week' | 'month' = 'day';

  @ApiPropertyOptional({
    description: 'Включить прогноз',
    example: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  includeForecast?: boolean = false;

  @ApiPropertyOptional({
    description: 'Горизонт прогноза в днях',
    example: 30,
    default: 30,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(365)
  forecastDays?: number = 30;
}

export class GetKPIAlertsDto {
  @ApiPropertyOptional({
    description: 'Номер страницы',
    example: 1,
    default: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Количество элементов на странице',
    example: 20,
    default: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({
    description: 'Фильтр по уровню важности',
    type: [String],
    enum: ['low', 'medium', 'high', 'critical'],
    example: ['high', 'critical'],
  })
  @IsOptional()
  @IsArray()
  @IsEnum(['low', 'medium', 'high', 'critical'], { each: true })
  severity?: Array<'low' | 'medium' | 'high' | 'critical'>;

  @ApiPropertyOptional({
    description: 'Только непрочитанные алерты',
    example: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  unacknowledgedOnly?: boolean = false;

  @ApiPropertyOptional({
    description: 'Дата начала фильтрации',
    example: '2024-12-01T00:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiPropertyOptional({
    description: 'Дата окончания фильтрации',
    example: '2024-12-31T23:59:59.999Z',
  })
  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @ApiPropertyOptional({
    description: 'ID метрики для фильтрации',
    example: 'vessel_turnaround_time',
  })
  @IsOptional()
  @IsString()
  metricId?: string;
}

export class AcknowledgeKPIAlertDto {
  @ApiPropertyOptional({
    description: 'Комментарий к подтверждению',
    example: 'Проблема выявлена, работаем над устранением',
  })
  @IsOptional()
  @IsString()
  comment?: string;

  @ApiPropertyOptional({
    description: 'Планируемое время решения',
    example: '2024-12-25T15:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  expectedResolution?: string;
}