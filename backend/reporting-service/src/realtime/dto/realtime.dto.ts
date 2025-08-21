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
  IsIn,
  ArrayMaxSize,
  IsUUID,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  SubscriptionType,
  SubscriptionStatus,
  QueueType,
  IntegrationType,
} from '../interfaces/realtime.interface';

export class CreateRealtimeSubscriptionDto {
  @ApiProperty({
    enum: SubscriptionType,
    description: 'Тип подписки на данные в реальном времени',
    example: SubscriptionType.TERMINAL_OPERATIONS,
  })
  @IsEnum(SubscriptionType)
  type: SubscriptionType;

  @ApiProperty({
    description: 'Топик для подписки',
    example: 'terminal.operations.container_movements',
  })
  @IsNotEmpty()
  @IsString()
  topic: string;

  @ApiPropertyOptional({
    description: 'Фильтры для данных',
    type: [Object],
    example: [
      {
        field: 'status',
        operator: 'eq',
        value: 'active',
        condition: 'AND',
      },
      {
        field: 'equipment_type',
        operator: 'in',
        value: ['crane', 'reach_stacker'],
        condition: 'AND',
      },
    ],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => RealtimeFilterDto)
  filters?: RealtimeFilterDto[];

  @ApiPropertyOptional({
    description: 'Конфигурация подписки',
    example: {
      refreshInterval: 1000,
      bufferSize: 100,
      compression: true,
      throttle: {
        enabled: true,
        maxUpdatesPerSecond: 10,
        strategy: 'buffer',
      },
      aggregation: {
        enabled: true,
        window: 5000,
        functions: [
          {
            field: 'processing_time',
            operation: 'avg',
            alias: 'avg_processing_time',
          },
        ],
        groupBy: ['equipment_id'],
      },
    },
  })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => SubscriptionConfigDto)
  config?: SubscriptionConfigDto;
}

export class RealtimeFilterDto {
  @ApiProperty({
    description: 'Поле для фильтрации',
    example: 'status',
  })
  @IsString()
  field: string;

  @ApiProperty({
    description: 'Оператор сравнения',
    enum: ['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'in', 'not_in', 'contains', 'regex'],
    example: 'eq',
  })
  @IsIn(['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'in', 'not_in', 'contains', 'regex'])
  operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'not_in' | 'contains' | 'regex';

  @ApiProperty({
    description: 'Значение для сравнения',
    example: 'active',
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

export class SubscriptionConfigDto {
  @ApiPropertyOptional({
    description: 'Интервал обновления в миллисекундах',
    example: 1000,
    minimum: 100,
    maximum: 60000,
  })
  @IsOptional()
  @IsNumber()
  @Min(100)
  @Max(60000)
  refreshInterval?: number;

  @ApiPropertyOptional({
    description: 'Размер буфера сообщений',
    example: 100,
    minimum: 1,
    maximum: 10000,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(10000)
  bufferSize?: number;

  @ApiPropertyOptional({
    description: 'Использовать сжатие',
    example: true,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  compression?: boolean = false;

  @ApiPropertyOptional({
    description: 'Настройки троттлинга',
  })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => ThrottleConfigDto)
  throttle?: ThrottleConfigDto;

  @ApiPropertyOptional({
    description: 'Настройки агрегации',
  })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => AggregationConfigDto)
  aggregation?: AggregationConfigDto;

  @ApiPropertyOptional({
    description: 'Конфигурации трансформации',
    type: [Object],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => TransformConfigDto)
  transforms?: TransformConfigDto[];

  @ApiPropertyOptional({
    description: 'Настройки персистенции',
  })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => PersistenceConfigDto)
  persistence?: PersistenceConfigDto;
}

export class ThrottleConfigDto {
  @ApiProperty({
    description: 'Включить троттлинг',
    example: true,
  })
  @IsBoolean()
  enabled: boolean;

  @ApiProperty({
    description: 'Максимум обновлений в секунду',
    example: 10,
    minimum: 1,
    maximum: 1000,
  })
  @IsNumber()
  @Min(1)
  @Max(1000)
  maxUpdatesPerSecond: number;

  @ApiProperty({
    description: 'Стратегия троттлинга',
    enum: ['drop', 'buffer', 'debounce'],
    example: 'buffer',
  })
  @IsIn(['drop', 'buffer', 'debounce'])
  strategy: 'drop' | 'buffer' | 'debounce';
}

export class AggregationConfigDto {
  @ApiProperty({
    description: 'Включить агрегацию',
    example: true,
  })
  @IsBoolean()
  enabled: boolean;

  @ApiProperty({
    description: 'Окно агрегации в миллисекундах',
    example: 5000,
    minimum: 1000,
    maximum: 300000,
  })
  @IsNumber()
  @Min(1000)
  @Max(300000)
  window: number;

  @ApiProperty({
    description: 'Функции агрегации',
    type: [Object],
    example: [
      {
        field: 'processing_time',
        operation: 'avg',
        alias: 'avg_processing_time',
      },
      {
        field: 'container_count',
        operation: 'sum',
        alias: 'total_containers',
      },
    ],
  })
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => AggregationFunctionDto)
  functions: AggregationFunctionDto[];

  @ApiPropertyOptional({
    description: 'Поля для группировки',
    type: [String],
    example: ['equipment_id', 'operation_type'],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  groupBy?: string[];
}

export class AggregationFunctionDto {
  @ApiProperty({
    description: 'Поле для агрегации',
    example: 'processing_time',
  })
  @IsString()
  field: string;

  @ApiProperty({
    description: 'Операция агрегации',
    enum: ['sum', 'avg', 'min', 'max', 'count', 'last', 'first'],
    example: 'avg',
  })
  @IsIn(['sum', 'avg', 'min', 'max', 'count', 'last', 'first'])
  operation: 'sum' | 'avg' | 'min' | 'max' | 'count' | 'last' | 'first';

  @ApiPropertyOptional({
    description: 'Псевдоним результата',
    example: 'avg_processing_time',
  })
  @IsOptional()
  @IsString()
  alias?: string;
}

export class TransformConfigDto {
  @ApiProperty({
    description: 'Тип трансформации',
    enum: ['map', 'filter', 'reduce', 'sort', 'group', 'custom'],
    example: 'map',
  })
  @IsIn(['map', 'filter', 'reduce', 'sort', 'group', 'custom'])
  type: 'map' | 'filter' | 'reduce' | 'sort' | 'group' | 'custom';

  @ApiProperty({
    description: 'Выражение для трансформации',
    example: 'data.processing_time > 1000',
  })
  @IsString()
  expression: string;

  @ApiPropertyOptional({
    description: 'Параметры трансформации',
    example: { threshold: 1000, unit: 'ms' },
  })
  @IsOptional()
  @IsObject()
  params?: Record<string, any>;
}

export class PersistenceConfigDto {
  @ApiProperty({
    description: 'Включить персистенцию',
    example: true,
  })
  @IsBoolean()
  enabled: boolean;

  @ApiProperty({
    description: 'Тип хранилища',
    enum: ['memory', 'redis', 'clickhouse'],
    example: 'redis',
  })
  @IsIn(['memory', 'redis', 'clickhouse'])
  storage: 'memory' | 'redis' | 'clickhouse';

  @ApiProperty({
    description: 'Время хранения в секундах',
    example: 3600,
    minimum: 60,
    maximum: 86400,
  })
  @IsNumber()
  @Min(60)
  @Max(86400)
  retention: number;

  @ApiPropertyOptional({
    description: 'Размер батча для записи',
    example: 100,
    minimum: 1,
    maximum: 10000,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(10000)
  batchSize?: number;
}

export class UpdateRealtimeSubscriptionDto {
  @ApiPropertyOptional({
    enum: SubscriptionStatus,
    description: 'Новый статус подписки',
  })
  @IsOptional()
  @IsEnum(SubscriptionStatus)
  status?: SubscriptionStatus;

  @ApiPropertyOptional({
    description: 'Обновить фильтры',
    type: [Object],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => RealtimeFilterDto)
  filters?: RealtimeFilterDto[];

  @ApiPropertyOptional({
    description: 'Обновить конфигурацию',
  })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => SubscriptionConfigDto)
  config?: SubscriptionConfigDto;
}

export class GetRealtimeSubscriptionsDto {
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
    enum: SubscriptionType,
    description: 'Фильтр по типу подписки',
  })
  @IsOptional()
  @IsEnum(SubscriptionType)
  type?: SubscriptionType;

  @ApiPropertyOptional({
    enum: SubscriptionStatus,
    description: 'Фильтр по статусу',
  })
  @IsOptional()
  @IsEnum(SubscriptionStatus)
  status?: SubscriptionStatus;

  @ApiPropertyOptional({
    description: 'Поиск по топику',
    example: 'terminal.operations',
  })
  @IsOptional()
  @IsString()
  topic?: string;

  @ApiPropertyOptional({
    description: 'Только активные подписки',
    example: true,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  activeOnly?: boolean = false;
}

export class PublishRealtimeEventDto {
  @ApiProperty({
    description: 'Тип события',
    example: 'container_movement',
  })
  @IsString()
  type: string;

  @ApiProperty({
    description: 'Топик для публикации',
    example: 'terminal.operations.container_movements',
  })
  @IsString()
  topic: string;

  @ApiProperty({
    description: 'Данные события',
    example: {
      containerId: 'cont-123',
      containerNumber: 'MSCU1234567',
      movementType: 'arrival',
      fromLocation: 'vessel-berth-1',
      toLocation: 'yard-block-a-01',
      equipmentId: 'crane-01',
      status: 'completed',
      timestamp: '2024-12-24T10:30:00.000Z',
    },
  })
  @IsObject()
  data: any;

  @ApiPropertyOptional({
    description: 'Источник события',
    example: {
      type: 'equipment',
      id: 'crane-01',
      name: 'Кран портальный №1',
      location: {
        latitude: 55.7558,
        longitude: 37.6176,
      },
    },
  })
  @IsOptional()
  @IsObject()
  source?: {
    type: 'terminal' | 'equipment' | 'integration' | 'system' | 'user';
    id: string;
    name?: string;
    location?: {
      latitude: number;
      longitude: number;
      altitude?: number;
    };
  };

  @ApiPropertyOptional({
    description: 'Метаданные события',
    example: {
      priority: 'high',
      category: 'operations',
      tags: ['container', 'movement', 'yard'],
      correlationId: 'order-456',
    },
  })
  @IsOptional()
  @IsObject()
  metadata?: {
    priority?: 'low' | 'normal' | 'high' | 'critical';
    category?: string;
    tags?: string[];
    correlationId?: string;
    causationId?: string;
    version?: string;
  };
}

export class CreateMessageQueueDto {
  @ApiProperty({
    description: 'Топик очереди',
    example: 'terminal.alerts',
  })
  @IsString()
  topic: string;

  @ApiProperty({
    enum: QueueType,
    description: 'Тип очереди',
    example: QueueType.PRIORITY,
  })
  @IsEnum(QueueType)
  type: QueueType;

  @ApiPropertyOptional({
    description: 'Конфигурация очереди',
    example: {
      maxSize: 10000,
      ttl: 3600,
      persistent: true,
      compression: true,
      priority: {
        enabled: true,
        levels: 5,
      },
      deduplication: {
        enabled: true,
        window: 300,
        keyFields: ['type', 'source.id'],
      },
    },
  })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => QueueConfigDto)
  config?: QueueConfigDto;
}

export class QueueConfigDto {
  @ApiProperty({
    description: 'Максимальный размер очереди',
    example: 10000,
    minimum: 1,
    maximum: 1000000,
  })
  @IsNumber()
  @Min(1)
  @Max(1000000)
  maxSize: number;

  @ApiProperty({
    description: 'Время жизни сообщений в секундах',
    example: 3600,
    minimum: 1,
    maximum: 86400,
  })
  @IsNumber()
  @Min(1)
  @Max(86400)
  ttl: number;

  @ApiProperty({
    description: 'Персистентное хранение',
    example: true,
  })
  @IsBoolean()
  persistent: boolean;

  @ApiProperty({
    description: 'Сжатие сообщений',
    example: true,
  })
  @IsBoolean()
  compression: boolean;

  @ApiPropertyOptional({
    description: 'Настройки приоритетов',
  })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => QueuePriorityConfigDto)
  priority?: QueuePriorityConfigDto;

  @ApiPropertyOptional({
    description: 'Настройки дедупликации',
  })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => QueueDeduplicationConfigDto)
  deduplication?: QueueDeduplicationConfigDto;
}

export class QueuePriorityConfigDto {
  @ApiProperty({
    description: 'Включить приоритеты',
    example: true,
  })
  @IsBoolean()
  enabled: boolean;

  @ApiProperty({
    description: 'Количество уровней приоритета',
    example: 5,
    minimum: 1,
    maximum: 10,
  })
  @IsNumber()
  @Min(1)
  @Max(10)
  levels: number;
}

export class QueueDeduplicationConfigDto {
  @ApiProperty({
    description: 'Включить дедупликацию',
    example: true,
  })
  @IsBoolean()
  enabled: boolean;

  @ApiProperty({
    description: 'Окно дедупликации в секундах',
    example: 300,
    minimum: 1,
    maximum: 3600,
  })
  @IsNumber()
  @Min(1)
  @Max(3600)
  window: number;

  @ApiProperty({
    description: 'Поля для ключа дедупликации',
    type: [String],
    example: ['type', 'source.id'],
  })
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  keyFields: string[];
}

export class GetRealtimeAnalyticsDto {
  @ApiPropertyOptional({
    description: 'Дата начала периода',
    example: '2024-12-24T00:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  startTime?: string;

  @ApiPropertyOptional({
    description: 'Дата окончания периода',
    example: '2024-12-24T23:59:59.999Z',
  })
  @IsOptional()
  @IsDateString()
  endTime?: string;

  @ApiPropertyOptional({
    description: 'Гранулярность данных',
    enum: ['second', 'minute', 'hour'],
    example: 'minute',
    default: 'minute',
  })
  @IsOptional()
  @IsIn(['second', 'minute', 'hour'])
  granularity?: 'second' | 'minute' | 'hour' = 'minute';

  @ApiPropertyOptional({
    description: 'Фильтры для аналитики',
    type: [Object],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => RealtimeFilterDto)
  filters?: RealtimeFilterDto[];

  @ApiPropertyOptional({
    description: 'Измерения для группировки',
    type: [String],
    example: ['type', 'topic', 'source.type'],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @IsString({ each: true })
  dimensions?: string[];
}

export class CreateExternalIntegrationDto {
  @ApiProperty({
    description: 'Название интеграции',
    example: 'Kafka Container Events',
  })
  @IsString()
  name: string;

  @ApiProperty({
    enum: IntegrationType,
    description: 'Тип интеграции',
    example: IntegrationType.KAFKA,
  })
  @IsEnum(IntegrationType)
  type: IntegrationType;

  @ApiProperty({
    description: 'Конфигурация интеграции',
    example: {
      endpoint: 'localhost:9092',
      credentials: {
        username: 'kafka_user',
        password: 'secure_password',
      },
      timeout: 30000,
      retries: 3,
      batchSize: 100,
      mappings: [
        {
          source: 'container_id',
          target: 'containerId',
          required: true,
        },
        {
          source: 'movement_type',
          target: 'movementType',
          transform: 'uppercase',
          required: true,
        },
      ],
    },
  })
  @IsObject()
  @ValidateNested()
  @Type(() => IntegrationConfigDto)
  config: IntegrationConfigDto;
}

export class IntegrationConfigDto {
  @ApiPropertyOptional({
    description: 'Endpoint подключения',
    example: 'localhost:9092',
  })
  @IsOptional()
  @IsString()
  endpoint?: string;

  @ApiPropertyOptional({
    description: 'Учетные данные',
    example: {
      username: 'user',
      password: 'password',
      apiKey: 'key123',
    },
  })
  @IsOptional()
  @IsObject()
  credentials?: Record<string, string>;

  @ApiPropertyOptional({
    description: 'HTTP заголовки',
    example: {
      'Content-Type': 'application/json',
      'X-API-Version': 'v1',
    },
  })
  @IsOptional()
  @IsObject()
  headers?: Record<string, string>;

  @ApiPropertyOptional({
    description: 'Таймаут в миллисекундах',
    example: 30000,
    minimum: 1000,
    maximum: 300000,
  })
  @IsOptional()
  @IsNumber()
  @Min(1000)
  @Max(300000)
  timeout?: number;

  @ApiPropertyOptional({
    description: 'Количество повторных попыток',
    example: 3,
    minimum: 0,
    maximum: 10,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(10)
  retries?: number;

  @ApiPropertyOptional({
    description: 'Размер батча',
    example: 100,
    minimum: 1,
    maximum: 10000,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(10000)
  batchSize?: number;

  @ApiPropertyOptional({
    description: 'Маппинг полей',
    type: [Object],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => FieldMappingDto)
  mappings?: FieldMappingDto[];
}

export class FieldMappingDto {
  @ApiProperty({
    description: 'Исходное поле',
    example: 'container_id',
  })
  @IsString()
  source: string;

  @ApiProperty({
    description: 'Целевое поле',
    example: 'containerId',
  })
  @IsString()
  target: string;

  @ApiPropertyOptional({
    description: 'Трансформация значения',
    example: 'uppercase',
  })
  @IsOptional()
  @IsString()
  transform?: string;

  @ApiPropertyOptional({
    description: 'Обязательное поле',
    example: true,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  required?: boolean = false;
}