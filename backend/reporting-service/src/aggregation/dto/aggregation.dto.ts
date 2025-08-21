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
  IsNotEmpty,
  Matches,
  IsIn,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  AggregationType,
  AggregationStatus,
  AggregationCategory,
  AggregationOperationType,
  AggregationAlertType,
} from '../interfaces/aggregation.interface';

export class CreateAggregationJobDto {
  @ApiProperty({
    description: 'Название задания агрегации',
    example: 'Ежедневная агрегация операций терминала',
  })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty({
    enum: AggregationType,
    description: 'Тип агрегации',
    example: AggregationType.SCHEDULED,
  })
  @IsEnum(AggregationType)
  type: AggregationType;

  @ApiPropertyOptional({
    description: 'Описание задания',
    example: 'Агрегирует ежедневные операции терминала для отчетности',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    description: 'Конфигурация расписания',
    example: {
      type: 'cron',
      expression: '0 2 * * *',
      timezone: 'Europe/Moscow',
      enabled: true,
      priority: 5,
    },
  })
  @IsObject()
  @ValidateNested()
  @Type(() => AggregationScheduleDto)
  schedule: AggregationScheduleDto;

  @ApiProperty({
    description: 'Источник данных',
    example: {
      type: 'clickhouse',
      connection: {
        host: 'localhost',
        port: 8123,
        database: 'terminal_operations',
      },
      query: 'SELECT * FROM container_movements WHERE date = today()',
      incremental: true,
      incrementalField: 'updated_at',
      batchSize: 1000,
    },
  })
  @IsObject()
  @ValidateNested()
  @Type(() => AggregationSourceDto)
  source: AggregationSourceDto;

  @ApiProperty({
    description: 'Целевое хранилище',
    example: {
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
    },
  })
  @IsObject()
  @ValidateNested()
  @Type(() => AggregationTargetDto)
  target: AggregationTargetDto;

  @ApiProperty({
    description: 'Конфигурация трансформации данных',
    example: {
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
      ],
      groupBy: ['date', 'operation_type'],
      orderBy: [{ field: 'date', direction: 'DESC' }],
    },
  })
  @IsObject()
  @ValidateNested()
  @Type(() => AggregationTransformationDto)
  transformation: AggregationTransformationDto;

  @ApiPropertyOptional({
    description: 'Включить задание',
    example: true,
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean = true;
}

export class AggregationScheduleDto {
  @ApiProperty({
    description: 'Тип расписания',
    enum: ['cron', 'interval', 'once', 'event'],
    example: 'cron',
  })
  @IsIn(['cron', 'interval', 'once', 'event'])
  type: 'cron' | 'interval' | 'once' | 'event';

  @ApiPropertyOptional({
    description: 'Cron выражение',
    example: '0 2 * * *',
  })
  @IsOptional()
  @IsString()
  @Matches(/^(\*|[0-5]?[0-9]|(\*\/[0-9]+)) (\*|1?[0-9]|2[0-3]|(\*\/[0-9]+)) (\*|[1-2]?[0-9]|3[0-1]|(\*\/[0-9]+)) (\*|[1-9]|1[0-2]|(\*\/[0-9]+)) (\*|[0-6]|(\*\/[0-9]+))$/, {
    message: 'Неверный формат cron выражения',
  })
  expression?: string;

  @ApiPropertyOptional({
    description: 'Интервал в миллисекундах',
    example: 3600000,
  })
  @IsOptional()
  @IsNumber()
  @Min(1000)
  interval?: number;

  @ApiPropertyOptional({
    description: 'Часовой пояс',
    example: 'Europe/Moscow',
    default: 'UTC',
  })
  @IsOptional()
  @IsString()
  timezone?: string = 'UTC';

  @ApiProperty({
    description: 'Включить расписание',
    example: true,
  })
  @IsBoolean()
  enabled: boolean;

  @ApiPropertyOptional({
    description: 'Приоритет (1-10)',
    example: 5,
    default: 5,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(10)
  priority?: number = 5;
}

export class AggregationSourceDto {
  @ApiProperty({
    description: 'Тип источника данных',
    enum: ['clickhouse', 'postgresql', 'kafka', 'api', 'file'],
    example: 'clickhouse',
  })
  @IsIn(['clickhouse', 'postgresql', 'kafka', 'api', 'file'])
  type: 'clickhouse' | 'postgresql' | 'kafka' | 'api' | 'file';

  @ApiProperty({
    description: 'Параметры подключения',
    example: {
      host: 'localhost',
      port: 8123,
      database: 'terminal_operations',
      username: 'readonly_user',
    },
  })
  @IsObject()
  @ValidateNested()
  @Type(() => AggregationConnectionDto)
  connection: AggregationConnectionDto;

  @ApiPropertyOptional({
    description: 'SQL запрос для извлечения данных',
    example: 'SELECT * FROM container_movements WHERE date >= ?',
  })
  @IsOptional()
  @IsString()
  query?: string;

  @ApiPropertyOptional({
    description: 'Название таблицы',
    example: 'container_movements',
  })
  @IsOptional()
  @IsString()
  table?: string;

  @ApiPropertyOptional({
    description: 'Kafka топик',
    example: 'terminal-operations',
  })
  @IsOptional()
  @IsString()
  topic?: string;

  @ApiPropertyOptional({
    description: 'API endpoint',
    example: 'https://api.terminal.com/operations',
  })
  @IsOptional()
  @IsString()
  endpoint?: string;

  @ApiPropertyOptional({
    description: 'Путь к файлу',
    example: '/data/terminal/operations.csv',
  })
  @IsOptional()
  @IsString()
  filePath?: string;

  @ApiPropertyOptional({
    description: 'Фильтры для данных',
    type: [Object],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AggregationFilterDto)
  filters?: AggregationFilterDto[];

  @ApiPropertyOptional({
    description: 'Инкрементальная обработка',
    example: true,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  incremental?: boolean = false;

  @ApiPropertyOptional({
    description: 'Поле для инкрементальной обработки',
    example: 'updated_at',
  })
  @IsOptional()
  @IsString()
  incrementalField?: string;

  @ApiPropertyOptional({
    description: 'Размер батча для обработки',
    example: 1000,
    default: 1000,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100000)
  batchSize?: number = 1000;
}

export class AggregationConnectionDto {
  @ApiPropertyOptional({
    description: 'Хост',
    example: 'localhost',
  })
  @IsOptional()
  @IsString()
  host?: string;

  @ApiPropertyOptional({
    description: 'Порт',
    example: 8123,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(65535)
  port?: number;

  @ApiPropertyOptional({
    description: 'База данных',
    example: 'terminal_operations',
  })
  @IsOptional()
  @IsString()
  database?: string;

  @ApiPropertyOptional({
    description: 'Имя пользователя',
    example: 'readonly_user',
  })
  @IsOptional()
  @IsString()
  username?: string;

  @ApiPropertyOptional({
    description: 'Пароль',
    example: 'secure_password',
  })
  @IsOptional()
  @IsString()
  password?: string;

  @ApiPropertyOptional({
    description: 'Строка подключения',
    example: 'postgresql://user:pass@localhost:5432/db',
  })
  @IsOptional()
  @IsString()
  connectionString?: string;

  @ApiPropertyOptional({
    description: 'Дополнительные опции',
    example: { ssl: true, timeout: 30000 },
  })
  @IsOptional()
  @IsObject()
  options?: Record<string, any>;
}

export class AggregationFilterDto {
  @ApiProperty({
    description: 'Поле для фильтрации',
    example: 'operation_type',
  })
  @IsString()
  field: string;

  @ApiProperty({
    description: 'Оператор сравнения',
    enum: ['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'in', 'not_in', 'like', 'between'],
    example: 'eq',
  })
  @IsIn(['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'in', 'not_in', 'like', 'between'])
  operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'not_in' | 'like' | 'between';

  @ApiProperty({
    description: 'Значение для сравнения',
    example: 'gate_in',
  })
  value: any;

  @ApiPropertyOptional({
    description: 'Логический оператор',
    enum: ['AND', 'OR'],
    example: 'AND',
    default: 'AND',
  })
  @IsOptional()
  @IsIn(['AND', 'OR'])
  condition?: 'AND' | 'OR' = 'AND';
}

export class AggregationTargetDto {
  @ApiProperty({
    description: 'Тип целевого хранилища',
    enum: ['clickhouse', 'postgresql', 'redis', 'file'],
    example: 'clickhouse',
  })
  @IsIn(['clickhouse', 'postgresql', 'redis', 'file'])
  type: 'clickhouse' | 'postgresql' | 'redis' | 'file';

  @ApiProperty({
    description: 'Параметры подключения',
  })
  @IsObject()
  @ValidateNested()
  @Type(() => AggregationConnectionDto)
  connection: AggregationConnectionDto;

  @ApiPropertyOptional({
    description: 'Название таблицы',
    example: 'daily_operations_summary',
  })
  @IsOptional()
  @IsString()
  table?: string;

  @ApiPropertyOptional({
    description: 'Название коллекции',
    example: 'operations_cache',
  })
  @IsOptional()
  @IsString()
  collection?: string;

  @ApiPropertyOptional({
    description: 'Путь к файлу',
    example: '/data/aggregated/daily_summary.parquet',
  })
  @IsOptional()
  @IsString()
  filePath?: string;

  @ApiPropertyOptional({
    description: 'Формат файла',
    enum: ['json', 'csv', 'parquet', 'avro'],
    example: 'parquet',
  })
  @IsOptional()
  @IsIn(['json', 'csv', 'parquet', 'avro'])
  format?: 'json' | 'csv' | 'parquet' | 'avro';

  @ApiPropertyOptional({
    description: 'Настройки партиционирования',
  })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => AggregationPartitioningDto)
  partitioning?: AggregationPartitioningDto;

  @ApiPropertyOptional({
    description: 'Настройки хранения данных',
  })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => AggregationRetentionDto)
  retention?: AggregationRetentionDto;

  @ApiPropertyOptional({
    description: 'Использовать сжатие',
    example: true,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  compression?: boolean = false;
}

export class AggregationPartitioningDto {
  @ApiProperty({
    description: 'Включить партиционирование',
    example: true,
  })
  @IsBoolean()
  enabled: boolean;

  @ApiProperty({
    description: 'Поле для партиционирования',
    example: 'date',
  })
  @IsString()
  field: string;

  @ApiProperty({
    description: 'Тип партиционирования',
    enum: ['time', 'hash', 'range'],
    example: 'time',
  })
  @IsIn(['time', 'hash', 'range'])
  type: 'time' | 'hash' | 'range';

  @ApiPropertyOptional({
    description: 'Интервал партиционирования',
    enum: ['hour', 'day', 'week', 'month', 'year'],
    example: 'day',
  })
  @IsOptional()
  @IsIn(['hour', 'day', 'week', 'month', 'year'])
  interval?: 'hour' | 'day' | 'week' | 'month' | 'year';

  @ApiPropertyOptional({
    description: 'Количество партиций',
    example: 12,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(1000)
  partitions?: number;
}

export class AggregationRetentionDto {
  @ApiProperty({
    description: 'Включить политику хранения',
    example: true,
  })
  @IsBoolean()
  enabled: boolean;

  @ApiProperty({
    description: 'Период хранения в днях',
    example: 365,
  })
  @IsNumber()
  @Min(1)
  @Max(3650)
  period: number;

  @ApiPropertyOptional({
    description: 'Архивировать после (дней)',
    example: 90,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  archiveAfter?: number;

  @ApiPropertyOptional({
    description: 'Удалить после (дней)',
    example: 2555,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  deleteAfter?: number;
}

export class AggregationTransformationDto {
  @ApiProperty({
    description: 'Операции агрегации',
    type: [Object],
    example: [
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
    ],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AggregationOperationDto)
  operations: AggregationOperationDto[];

  @ApiPropertyOptional({
    description: 'Поля для группировки',
    type: [String],
    example: ['date', 'operation_type'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  groupBy?: string[];

  @ApiPropertyOptional({
    description: 'Поля для сортировки',
    type: [Object],
    example: [{ field: 'date', direction: 'DESC' }],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AggregationOrderByDto)
  orderBy?: AggregationOrderByDto[];

  @ApiPropertyOptional({
    description: 'Условия HAVING',
    type: [Object],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AggregationFilterDto)
  having?: AggregationFilterDto[];

  @ApiPropertyOptional({
    description: 'Лимит записей',
    example: 10000,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(1000000)
  limit?: number;

  @ApiPropertyOptional({
    description: 'Смещение записей',
    example: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  offset?: number;
}

export class AggregationOperationDto {
  @ApiProperty({
    enum: AggregationOperationType,
    description: 'Тип операции агрегации',
    example: AggregationOperationType.COUNT,
  })
  @IsEnum(AggregationOperationType)
  type: AggregationOperationType;

  @ApiProperty({
    description: 'Поле для операции',
    example: 'teu_count',
  })
  @IsString()
  field: string;

  @ApiPropertyOptional({
    description: 'Псевдоним результата',
    example: 'total_teu',
  })
  @IsOptional()
  @IsString()
  alias?: string;

  @ApiPropertyOptional({
    description: 'Параметры операции',
    example: { percentile: 95 },
  })
  @IsOptional()
  @IsObject()
  params?: Record<string, any>;

  @ApiPropertyOptional({
    description: 'Условие для операции',
    example: 'status = "completed"',
  })
  @IsOptional()
  @IsString()
  condition?: string;
}

export class AggregationOrderByDto {
  @ApiProperty({
    description: 'Поле для сортировки',
    example: 'date',
  })
  @IsString()
  field: string;

  @ApiProperty({
    description: 'Направление сортировки',
    enum: ['ASC', 'DESC'],
    example: 'DESC',
  })
  @IsIn(['ASC', 'DESC'])
  direction: 'ASC' | 'DESC';
}

export class GetAggregationJobsDto {
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
    enum: AggregationType,
    description: 'Фильтр по типу агрегации',
  })
  @IsOptional()
  @IsEnum(AggregationType)
  type?: AggregationType;

  @ApiPropertyOptional({
    enum: AggregationStatus,
    description: 'Фильтр по статусу',
  })
  @IsOptional()
  @IsEnum(AggregationStatus)
  status?: AggregationStatus;

  @ApiPropertyOptional({
    enum: AggregationCategory,
    description: 'Фильтр по категории',
  })
  @IsOptional()
  @IsEnum(AggregationCategory)
  category?: AggregationCategory;

  @ApiPropertyOptional({
    description: 'Поиск по названию',
    example: 'операции',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Только активные задания',
    example: true,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  activeOnly?: boolean = false;

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

export class UpdateAggregationJobDto {
  @ApiPropertyOptional({
    description: 'Новое название',
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({
    description: 'Новое описание',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: 'Включить/отключить задание',
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    description: 'Обновить расписание',
  })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => AggregationScheduleDto)
  schedule?: AggregationScheduleDto;

  @ApiPropertyOptional({
    description: 'Обновить трансформацию',
  })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => AggregationTransformationDto)
  transformation?: AggregationTransformationDto;
}

export class RunAggregationJobDto {
  @ApiPropertyOptional({
    description: 'Переопределить параметры для однократного запуска',
    example: {
      dateFrom: '2024-12-01',
      dateTo: '2024-12-31',
    },
  })
  @IsOptional()
  @IsObject()
  parameters?: Record<string, any>;

  @ApiPropertyOptional({
    description: 'Запустить с высоким приоритетом',
    example: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  highPriority?: boolean = false;

  @ApiPropertyOptional({
    description: 'Игнорировать зависимости',
    example: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  ignoreDependencies?: boolean = false;
}

export class CreateAggregationTemplateDto {
  @ApiProperty({
    description: 'Название шаблона',
    example: 'Ежедневная агрегация операций',
  })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiPropertyOptional({
    description: 'Описание шаблона',
    example: 'Шаблон для ежедневной агрегации операций терминала',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    enum: AggregationCategory,
    description: 'Категория шаблона',
    example: AggregationCategory.OPERATIONAL,
  })
  @IsEnum(AggregationCategory)
  category: AggregationCategory;

  @ApiProperty({
    enum: AggregationType,
    description: 'Тип агрегации',
    example: AggregationType.SCHEDULED,
  })
  @IsEnum(AggregationType)
  type: AggregationType;

  @ApiProperty({
    description: 'Шаблон конфигурации',
    example: {
      source: {
        type: 'clickhouse',
        table: '{{source_table}}',
      },
      target: {
        type: 'clickhouse',
        table: '{{target_table}}',
      },
      transformation: {
        operations: [
          { type: 'count', field: '*', alias: 'total_count' },
        ],
        groupBy: ['{{group_field}}'],
      },
      schedule: {
        type: 'cron',
        expression: '{{cron_expression}}',
        enabled: true,
      },
    },
  })
  @IsObject()
  template: {
    source: Partial<AggregationSourceDto>;
    target: Partial<AggregationTargetDto>;
    transformation: Partial<AggregationTransformationDto>;
    schedule: Partial<AggregationScheduleDto>;
  };

  @ApiProperty({
    description: 'Переменные шаблона',
    type: [Object],
    example: [
      {
        name: 'source_table',
        type: 'string',
        description: 'Исходная таблица',
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
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AggregationVariableDto)
  variables: AggregationVariableDto[];

  @ApiPropertyOptional({
    description: 'Шаблон по умолчанию',
    example: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean = false;

  @ApiPropertyOptional({
    description: 'Теги шаблона',
    type: [String],
    example: ['операции', 'ежедневно', 'терминал'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}

export class AggregationVariableDto {
  @ApiProperty({
    description: 'Название переменной',
    example: 'source_table',
  })
  @IsString()
  name: string;

  @ApiProperty({
    description: 'Тип переменной',
    enum: ['string', 'number', 'boolean', 'date', 'array'],
    example: 'string',
  })
  @IsIn(['string', 'number', 'boolean', 'date', 'array'])
  type: 'string' | 'number' | 'boolean' | 'date' | 'array';

  @ApiProperty({
    description: 'Описание переменной',
    example: 'Исходная таблица для агрегации',
  })
  @IsString()
  description: string;

  @ApiProperty({
    description: 'Обязательная переменная',
    example: true,
  })
  @IsBoolean()
  required: boolean;

  @ApiPropertyOptional({
    description: 'Значение по умолчанию',
    example: 'container_movements',
  })
  @IsOptional()
  defaultValue?: any;

  @ApiPropertyOptional({
    description: 'Правила валидации',
    example: {
      min: 1,
      max: 100,
      pattern: '^[a-zA-Z_][a-zA-Z0-9_]*$',
    },
  })
  @IsOptional()
  @IsObject()
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
    enum?: any[];
  };
}

export class GetAggregationStatsDto {
  @ApiPropertyOptional({
    description: 'Дата начала периода',
    example: '2024-12-01T00:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiPropertyOptional({
    description: 'Дата окончания периода',
    example: '2024-12-31T23:59:59.999Z',
  })
  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @ApiPropertyOptional({
    enum: AggregationCategory,
    description: 'Фильтр по категории',
  })
  @IsOptional()
  @IsEnum(AggregationCategory)
  category?: AggregationCategory;

  @ApiPropertyOptional({
    description: 'Включить детальную статистику',
    example: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  detailed?: boolean = false;
}