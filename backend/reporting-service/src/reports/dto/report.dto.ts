import {
  IsString,
  IsDateString,
  IsOptional,
  IsArray,
  IsEnum,
  IsUUID,
  IsBoolean,
  IsNumber,
  Min,
  Max,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type, Transform } from 'class-transformer';

export enum ReportType {
  CONTAINER_OPERATIONS = 'container_operations',
  GATE_TRANSACTIONS = 'gate_transactions',
  EQUIPMENT_PERFORMANCE = 'equipment_performance',
  FINANCIAL_ANALYSIS = 'financial_analysis',
  INVENTORY_STATUS = 'inventory_status',
  PRODUCTIVITY_ANALYSIS = 'productivity_analysis',
  CLIENT_ACTIVITY = 'client_activity',
  TERMINAL_KPI = 'terminal_kpi',
}

export enum ReportFormat {
  JSON = 'json',
  CSV = 'csv',
  EXCEL = 'excel',
  PDF = 'pdf',
}

export enum GroupingPeriod {
  HOUR = 'hour',
  DAY = 'day',
  WEEK = 'week',
  MONTH = 'month',
}

export class GenerateReportDto {
  @ApiProperty({
    enum: ReportType,
    description: 'Тип отчета',
    example: ReportType.CONTAINER_OPERATIONS,
  })
  @IsEnum(ReportType)
  type: ReportType;

  @ApiProperty({
    description: 'Название отчета',
    example: 'Операции контейнеров за декабрь 2024',
  })
  @IsString()
  name: string;

  @ApiProperty({
    description: 'Дата начала периода',
    example: '2024-12-01T00:00:00.000Z',
  })
  @IsDateString()
  dateFrom: string;

  @ApiProperty({
    description: 'Дата окончания периода',
    example: '2024-12-31T23:59:59.999Z',
  })
  @IsDateString()
  dateTo: string;

  @ApiPropertyOptional({
    description: 'ID клиентов для фильтрации',
    type: [String],
    example: ['client-123', 'client-456'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  clientIds?: string[];

  @ApiPropertyOptional({
    description: 'Типы контейнеров для фильтрации',
    type: [String],
    example: ['20FT', '40FT', '40HC'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  containerTypes?: string[];

  @ApiPropertyOptional({
    description: 'Типы операций для фильтрации',
    type: [String],
    example: ['loading', 'unloading', 'movement'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  operationTypes?: string[];

  @ApiPropertyOptional({
    description: 'Типы оборудования для фильтрации',
    type: [String],
    example: ['crane', 'reach_stacker', 'forklift'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  equipmentTypes?: string[];

  @ApiPropertyOptional({
    description: 'Статусы для фильтрации',
    type: [String],
    example: ['completed', 'in_progress', 'pending'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  statuses?: string[];

  @ApiPropertyOptional({
    description: 'Локации для фильтрации',
    type: [String],
    example: ['YARD-A-01', 'BERTH-1', 'GATE-1'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  locations?: string[];

  @ApiPropertyOptional({
    enum: GroupingPeriod,
    description: 'Период группировки данных',
    example: GroupingPeriod.DAY,
  })
  @IsOptional()
  @IsEnum(GroupingPeriod)
  groupBy?: GroupingPeriod;

  @ApiPropertyOptional({
    enum: ReportFormat,
    description: 'Формат отчета',
    example: ReportFormat.JSON,
    default: ReportFormat.JSON,
  })
  @IsOptional()
  @IsEnum(ReportFormat)
  format?: ReportFormat = ReportFormat.JSON;

  @ApiPropertyOptional({
    description: 'Включить детализированные данные',
    example: true,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  includeDetails?: boolean = false;

  @ApiPropertyOptional({
    description: 'Включить сводную информацию',
    example: true,
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  includeSummary?: boolean = true;
}

export class ReportListDto {
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
    enum: ReportType,
    description: 'Фильтр по типу отчета',
  })
  @IsOptional()
  @IsEnum(ReportType)
  type?: ReportType;

  @ApiPropertyOptional({
    description: 'Поиск по названию отчета',
    example: 'операции контейнеров',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Дата создания с',
    example: '2024-12-01T00:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  createdFrom?: string;

  @ApiPropertyOptional({
    description: 'Дата создания по',
    example: '2024-12-31T23:59:59.999Z',
  })
  @IsOptional()
  @IsDateString()
  createdTo?: string;
}

export class UpdateReportDto {
  @ApiPropertyOptional({
    description: 'Новое название отчета',
    example: 'Обновленный отчет по операциям',
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({
    description: 'Архивировать отчет',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  archived?: boolean;
}

export class BulkDeleteReportsDto {
  @ApiProperty({
    description: 'Массив ID отчетов для удаления',
    type: [String],
    example: ['report-123', 'report-456'],
  })
  @IsArray()
  @IsUUID(4, { each: true })
  reportIds: string[];
}