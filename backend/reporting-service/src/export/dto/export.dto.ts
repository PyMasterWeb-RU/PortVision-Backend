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
  IsEmail,
  Min,
  Max,
  Matches,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ExportType, ExportFormat, ExportStatus } from '../interfaces/export.interface';

export class CreateExportJobDto {
  @ApiProperty({
    enum: ExportType,
    description: 'Тип экспорта',
    example: ExportType.REPORT,
  })
  @IsEnum(ExportType)
  type: ExportType;

  @ApiProperty({
    enum: ExportFormat,
    description: 'Формат экспорта',
    example: ExportFormat.PDF,
  })
  @IsEnum(ExportFormat)
  format: ExportFormat;

  @ApiProperty({
    description: 'Название экспорта',
    example: 'Операционный отчет за декабрь 2024',
  })
  @IsString()
  title: string;

  @ApiPropertyOptional({
    description: 'Описание экспорта',
    example: 'Подробный отчет по операциям терминала за декабрь',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    description: 'Конфигурация источника данных',
    example: {
      type: 'report',
      id: 'report-uuid',
      dateRange: {
        start: '2024-12-01T00:00:00.000Z',
        end: '2024-12-31T23:59:59.999Z',
      },
    },
  })
  @IsObject()
  source: {
    type: 'report' | 'dashboard' | 'kpi' | 'query';
    id?: string;
    query?: string;
    dateRange?: {
      start: Date;
      end: Date;
    };
    parameters?: Record<string, any>;
  };

  @ApiPropertyOptional({
    description: 'Опции экспорта',
    example: {
      includeHeader: true,
      includeFooter: true,
      pageSize: 'A4',
      orientation: 'portrait',
      quality: 95,
    },
  })
  @IsOptional()
  @IsObject()
  options?: {
    includeHeader?: boolean;
    includeFooter?: boolean;
    includeSummary?: boolean;
    includeCharts?: boolean;
    includeTables?: boolean;
    pageSize?: 'A4' | 'A3' | 'Letter' | 'Legal';
    orientation?: 'portrait' | 'landscape';
    compression?: boolean;
    quality?: number;
    locale?: string;
    timezone?: string;
    watermark?: string;
    password?: string;
  };

  @ApiPropertyOptional({
    description: 'Фильтры данных',
    example: {
      columns: ['date', 'operation_type', 'count'],
      rows: { limit: 1000 },
    },
  })
  @IsOptional()
  @IsObject()
  filters?: {
    columns?: string[];
    rows?: {
      limit?: number;
      offset?: number;
      where?: Record<string, any>;
    };
    aggregations?: {
      groupBy?: string[];
      functions?: Array<{
        field: string;
        function: 'sum' | 'avg' | 'count' | 'min' | 'max';
      }>;
    };
  };

  @ApiPropertyOptional({
    description: 'ID шаблона для экспорта',
    example: 'terminal-report-template',
  })
  @IsOptional()
  @IsString()
  templateId?: string;

  @ApiPropertyOptional({
    description: 'Время жизни файла в днях',
    example: 7,
    default: 7,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(365)
  retentionDays?: number = 7;
}

export class GetExportJobsDto {
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
    enum: ExportType,
    description: 'Фильтр по типу экспорта',
  })
  @IsOptional()
  @IsEnum(ExportType)
  type?: ExportType;

  @ApiPropertyOptional({
    enum: ExportFormat,
    description: 'Фильтр по формату',
  })
  @IsOptional()
  @IsEnum(ExportFormat)
  format?: ExportFormat;

  @ApiPropertyOptional({
    enum: ExportStatus,
    description: 'Фильтр по статусу',
  })
  @IsOptional()
  @IsEnum(ExportStatus)
  status?: ExportStatus;

  @ApiPropertyOptional({
    description: 'Поиск по названию',
    example: 'операционный отчет',
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

  @ApiPropertyOptional({
    description: 'Только мои экспорты',
    example: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  myOnly?: boolean = false;
}

export class CreateBatchExportDto {
  @ApiProperty({
    description: 'Название пакетного экспорта',
    example: 'Месячные отчеты за декабрь 2024',
  })
  @IsString()
  name: string;

  @ApiProperty({
    description: 'Список заданий экспорта',
    type: [CreateExportJobDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateExportJobDto)
  jobs: CreateExportJobDto[];

  @ApiPropertyOptional({
    description: 'Создать архив всех файлов',
    example: true,
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  createArchive?: boolean = true;

  @ApiPropertyOptional({
    description: 'Уведомить по завершении',
    type: [String],
    example: ['manager@terminal.com'],
  })
  @IsOptional()
  @IsArray()
  @IsEmail({}, { each: true })
  notifyEmails?: string[];
}

export class CreateAutoExportDto {
  @ApiProperty({
    description: 'Название автоматического экспорта',
    example: 'Ежедневный операционный отчет',
  })
  @IsString()
  name: string;

  @ApiProperty({
    description: 'Конфигурация триггера',
    example: {
      type: 'schedule',
      schedule: '0 8 * * *',
    },
  })
  @IsObject()
  trigger: {
    type: 'schedule' | 'event' | 'threshold';
    schedule?: string;
    event?: string;
    threshold?: {
      metric: string;
      operator: '>' | '<' | '=' | '>=' | '<=';
      value: number;
    };
  };

  @ApiProperty({
    description: 'Источник данных',
    example: {
      type: 'report',
      id: 'daily-operations-report',
    },
  })
  @IsObject()
  source: {
    type: 'report' | 'dashboard' | 'kpi' | 'query';
    id?: string;
    query?: string;
    parameters?: Record<string, any>;
  };

  @ApiProperty({
    enum: ExportFormat,
    description: 'Формат экспорта',
    example: ExportFormat.PDF,
  })
  @IsEnum(ExportFormat)
  format: ExportFormat;

  @ApiProperty({
    description: 'Получатели экспорта',
    type: [String],
    example: ['operations@terminal.com', 'manager@terminal.com'],
  })
  @IsArray()
  @IsEmail({}, { each: true })
  recipients: string[];

  @ApiPropertyOptional({
    description: 'Условия выполнения экспорта',
    type: [Object],
    example: [
      {
        field: 'operations_count',
        operator: '>',
        value: 0,
      },
    ],
  })
  @IsOptional()
  @IsArray()
  conditions?: Array<{
    field: string;
    operator: '=' | '!=' | '>' | '<' | '>=' | '<=' | 'in' | 'not_in' | 'contains';
    value: any;
  }>;

  @ApiPropertyOptional({
    description: 'ID шаблона',
    example: 'daily-report-template',
  })
  @IsOptional()
  @IsString()
  templateId?: string;

  @ApiPropertyOptional({
    description: 'Время хранения файлов в днях',
    example: 30,
    default: 30,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(365)
  retentionDays?: number = 30;

  @ApiPropertyOptional({
    description: 'Включить автоматический экспорт',
    example: true,
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean = true;
}

export class UpdateAutoExportDto {
  @ApiPropertyOptional({
    description: 'Новое название',
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({
    description: 'Включить/отключить',
  })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional({
    description: 'Обновить триггер',
  })
  @IsOptional()
  @IsObject()
  trigger?: {
    type: 'schedule' | 'event' | 'threshold';
    schedule?: string;
    event?: string;
    threshold?: {
      metric: string;
      operator: '>' | '<' | '=' | '>=' | '<=';
      value: number;
    };
  };

  @ApiPropertyOptional({
    description: 'Обновить получателей',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsEmail({}, { each: true })
  recipients?: string[];

  @ApiPropertyOptional({
    description: 'Обновить условия',
    type: [Object],
  })
  @IsOptional()
  @IsArray()
  conditions?: Array<{
    field: string;
    operator: '=' | '!=' | '>' | '<' | '>=' | '<=' | 'in' | 'not_in' | 'contains';
    value: any;
  }>;

  @ApiPropertyOptional({
    description: 'Время хранения',
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(365)
  retentionDays?: number;
}

export class CreateExportTemplateDto {
  @ApiProperty({
    description: 'Название шаблона',
    example: 'Стандартный отчет терминала',
  })
  @IsString()
  name: string;

  @ApiProperty({
    enum: ExportFormat,
    description: 'Формат шаблона',
    example: ExportFormat.PDF,
  })
  @IsEnum(ExportFormat)
  type: ExportFormat;

  @ApiProperty({
    description: 'Макет шаблона',
    example: {
      header: {
        content: '<h1>{{title}}</h1><p>Период: {{dateRange}}</p>',
        height: 80,
      },
      body: {
        content: '{{content}}',
      },
      footer: {
        content: '<p>Сгенерировано: {{generatedAt}} | Страница {{page}} из {{totalPages}}</p>',
        height: 40,
      },
      margin: { top: 20, right: 20, bottom: 20, left: 20 },
    },
  })
  @IsObject()
  layout: {
    header?: {
      content: string;
      height?: number;
      styling?: any;
    };
    body: {
      content: string;
      styling?: any;
    };
    footer?: {
      content: string;
      height?: number;
      styling?: any;
    };
    margin?: {
      top: number;
      right: number;
      bottom: number;
      left: number;
    };
  };

  @ApiPropertyOptional({
    description: 'Стилизация шаблона',
    example: {
      fontFamily: 'Arial',
      fontSize: 12,
      color: '#333333',
      backgroundColor: '#ffffff',
    },
  })
  @IsOptional()
  @IsObject()
  styling?: {
    fontFamily?: string;
    fontSize?: number;
    fontWeight?: 'normal' | 'bold';
    color?: string;
    backgroundColor?: string;
    borderColor?: string;
    borderWidth?: number;
    padding?: number;
    margin?: number;
    textAlign?: 'left' | 'center' | 'right' | 'justify';
  };

  @ApiPropertyOptional({
    description: 'Переменные шаблона',
    example: {
      companyName: 'PortVision 360',
      companyLogo: 'https://example.com/logo.png',
      contactEmail: 'support@portvision360.com',
    },
  })
  @IsOptional()
  @IsObject()
  variables?: Record<string, any>;
}

export class ExportDataDto {
  @ApiProperty({
    description: 'SQL запрос для экспорта данных',
    example: 'SELECT * FROM container_operations WHERE date >= ? AND date <= ?',
  })
  @IsString()
  query: string;

  @ApiPropertyOptional({
    description: 'Параметры запроса',
    example: ['2024-12-01', '2024-12-31'],
  })
  @IsOptional()
  @IsArray()
  parameters?: any[];

  @ApiProperty({
    enum: ExportFormat,
    description: 'Формат экспорта',
    example: ExportFormat.CSV,
  })
  @IsEnum(ExportFormat)
  format: ExportFormat;

  @ApiPropertyOptional({
    description: 'Название файла',
    example: 'container_operations_export',
  })
  @IsOptional()
  @IsString()
  fileName?: string;

  @ApiPropertyOptional({
    description: 'Опции экспорта',
    example: {
      includeHeader: true,
      delimiter: ',',
      encoding: 'utf8',
    },
  })
  @IsOptional()
  @IsObject()
  options?: Record<string, any>;
}

export class ScheduleExportDto {
  @ApiProperty({
    description: 'Cron выражение для расписания',
    example: '0 8 * * 1-5',
  })
  @IsString()
  @Matches(/^(\*|[0-5]?[0-9]|\*\/[0-9]+) (\*|1?[0-9]|2[0-3]|\*\/[0-9]+) (\*|[1-2]?[0-9]|3[0-1]|\*\/[0-9]+) (\*|[1-9]|1[0-2]|\*\/[0-9]+) (\*|[0-6]|\*\/[0-9]+)$/, {
    message: 'Неверный формат cron выражения',
  })
  cron: string;

  @ApiProperty({
    description: 'Конфигурация экспорта',
    type: CreateExportJobDto,
  })
  @ValidateNested()
  @Type(() => CreateExportJobDto)
  exportConfig: CreateExportJobDto;

  @ApiPropertyOptional({
    description: 'Часовой пояс',
    example: 'Europe/Moscow',
    default: 'UTC',
  })
  @IsOptional()
  @IsString()
  timezone?: string = 'UTC';

  @ApiPropertyOptional({
    description: 'Email получатели',
    type: [String],
    example: ['reports@terminal.com'],
  })
  @IsOptional()
  @IsArray()
  @IsEmail({}, { each: true })
  recipients?: string[];

  @ApiPropertyOptional({
    description: 'Тема письма',
    example: 'Автоматический отчет - {{date}}',
  })
  @IsOptional()
  @IsString()
  emailSubject?: string;

  @ApiPropertyOptional({
    description: 'Текст письма',
    example: 'Во вложении автоматически сгенерированный отчет за {{date}}.',
  })
  @IsOptional()
  @IsString()
  emailBody?: string;
}