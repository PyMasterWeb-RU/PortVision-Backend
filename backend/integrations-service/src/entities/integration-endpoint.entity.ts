import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

export enum IntegrationType {
  OCR_ANPR = 'ocr_anpr',
  GPS_GLONASS = 'gps_glonass',
  MQTT_BROKER = 'mqtt_broker',
  RFID_READER = 'rfid_reader',
  EDI_GATEWAY = 'edi_gateway',
  ERP_1C = 'erp_1c',
  WEIGHBRIDGE = 'weighbridge',
  CAMERA_SYSTEM = 'camera_system',
  CUSTOM_API = 'custom_api',
  DATABASE = 'database',
  FILE_WATCHER = 'file_watcher',
}

export enum ConnectionStatus {
  CONNECTED = 'connected',
  DISCONNECTED = 'disconnected',
  ERROR = 'error',
  CONFIGURING = 'configuring',
  TESTING = 'testing',
  DISABLED = 'disabled',
}

export enum AuthenticationType {
  NONE = 'none',
  BASIC = 'basic',
  BEARER = 'bearer',
  API_KEY = 'api_key',
  OAUTH2 = 'oauth2',
  CERTIFICATE = 'certificate',
  CUSTOM = 'custom',
}

export enum DataFormat {
  JSON = 'json',
  XML = 'xml',
  CSV = 'csv',
  FIXED_WIDTH = 'fixed_width',
  BINARY = 'binary',
  EDI = 'edi',
  CUSTOM = 'custom',
}

@Entity('integration_endpoints', { schema: 'integrations' })
@Index(['type'])
@Index(['status'])
@Index(['name'])
@Index(['isActive'])
@Index(['createdAt'])
export class IntegrationEndpoint {
  @ApiProperty({ description: 'Уникальный идентификатор интеграции' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ description: 'Тип интеграции', enum: IntegrationType })
  @Column({
    type: 'enum',
    enum: IntegrationType,
  })
  type: IntegrationType;

  @ApiProperty({ description: 'Статус соединения', enum: ConnectionStatus })
  @Column({
    type: 'enum',
    enum: ConnectionStatus,
    default: ConnectionStatus.DISCONNECTED,
  })
  status: ConnectionStatus;

  @ApiProperty({ description: 'Название интеграции' })
  @Column({ length: 255 })
  name: string;

  @ApiProperty({ description: 'Описание интеграции' })
  @Column({ type: 'text', nullable: true })
  description: string;

  @ApiProperty({ description: 'Активна ли интеграция' })
  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @ApiProperty({ description: 'Конфигурация подключения' })
  @Column({ name: 'connection_config', type: 'jsonb' })
  connectionConfig: {
    // Основные параметры подключения
    host?: string;
    port?: number;
    protocol?: 'http' | 'https' | 'tcp' | 'udp' | 'mqtt' | 'ftp' | 'sftp' | 'serial';
    path?: string;
    url?: string;
    
    // Аутентификация
    authentication: {
      type: AuthenticationType;
      username?: string;
      password?: string;
      token?: string;
      apiKey?: string;
      certificatePath?: string;
      oauth2Config?: {
        clientId: string;
        clientSecret: string;
        tokenUrl: string;
        scope?: string;
      };
    };
    
    // Специфические параметры для каждого типа
    ocrConfig?: {
      engine: 'tesseract' | 'cloud_vision' | 'azure_cv' | 'custom';
      language: string;
      confidence: number;
      preprocessingSteps: string[];
    };
    
    gpsConfig?: {
      protocol: 'wialon' | 'galileosky' | 'teltonika' | 'custom';
      deviceIds?: string[];
      updateInterval: number;
      trackingFields: string[];
    };
    
    mqttConfig?: {
      clientId: string;
      keepAlive: number;
      clean: boolean;
      reconnectPeriod: number;
      topics: string[];
      qos: 0 | 1 | 2;
    };
    
    rfidConfig?: {
      readerType: 'impinj' | 'zebra' | 'honeywell' | 'custom';
      antennas: number[];
      power: number;
      session: number;
      tagProtocol: string;
    };
    
    ediConfig?: {
      standard: 'x12' | 'edifact' | 'tradacoms' | 'custom';
      version: string;
      senderId: string;
      receiverId: string;
      testMode: boolean;
    };
    
    oneСConfig?: {
      version: '8.2' | '8.3' | 'EDT';
      database: string;
      infobase: string;
      webService?: {
        wsdl: string;
        namespace: string;
      };
    };
    
    databaseConfig?: {
      type: 'postgresql' | 'mysql' | 'oracle' | 'mssql' | 'mongodb';
      database: string;
      schema?: string;
      table?: string;
      query?: string;
      pollInterval: number;
    };
    
    fileConfig?: {
      watchPath: string;
      filePattern: string;
      processedPath: string;
      errorPath: string;
      encoding: string;
      pollInterval: number;
    };
    
    // Таймауты и retry
    timeout?: number;
    retryAttempts?: number;
    retryDelay?: number;
    
    // SSL/TLS конфигурация
    ssl?: {
      enabled: boolean;
      rejectUnauthorized: boolean;
      certificatePath?: string;
      keyPath?: string;
      caPath?: string;
    };
  };

  @ApiProperty({ description: 'Конфигурация обработки данных' })
  @Column({ name: 'data_processing_config', type: 'jsonb' })
  dataProcessingConfig: {
    // Формат входящих данных
    inputFormat: DataFormat;
    outputFormat: DataFormat;
    
    // Правила трансформации
    transformationRules: Array<{
      sourceField: string;
      targetField: string;
      transformation?: 'uppercase' | 'lowercase' | 'trim' | 'date_format' | 'number_format' | 'custom';
      transformationParams?: any;
      required: boolean;
      defaultValue?: any;
    }>;
    
    // Валидация данных
    validationRules: Array<{
      field: string;
      type: 'string' | 'number' | 'date' | 'email' | 'regex' | 'custom';
      rules: any;
      errorMessage: string;
    }>;
    
    // Фильтры
    filters: Array<{
      field: string;
      operator: 'equals' | 'contains' | 'starts_with' | 'ends_with' | 'greater_than' | 'less_than' | 'in_array';
      value: any;
      condition: 'include' | 'exclude';
    }>;
    
    // Группировка и агрегация
    aggregation?: {
      enabled: boolean;
      groupBy: string[];
      timeWindow: number;
      functions: Array<{
        field: string;
        function: 'count' | 'sum' | 'avg' | 'min' | 'max' | 'first' | 'last';
      }>;
    };
    
    // Буферизация
    buffering?: {
      enabled: boolean;
      maxSize: number;
      maxAge: number; // в миллисекундах
      flushOn: 'size' | 'time' | 'both';
    };
  };

  @ApiProperty({ description: 'Конфигурация маршрутизации' })
  @Column({ name: 'routing_config', type: 'jsonb' })
  routingConfig: {
    // Целевые endpoints
    targets: Array<{
      type: 'webhook' | 'kafka' | 'database' | 'file' | 'api';
      endpoint: string;
      condition?: {
        field: string;
        operator: string;
        value: any;
      };
      transformation?: string;
      retryPolicy?: {
        maxAttempts: number;
        backoffMultiplier: number;
        initialDelay: number;
      };
    }>;
    
    // Правила маршрутизации
    rules: Array<{
      condition: {
        field: string;
        operator: string;
        value: any;
      };
      action: 'route' | 'discard' | 'alert' | 'store';
      target?: string;
      parameters?: any;
    }>;
    
    // Dead Letter Queue
    deadLetterQueue?: {
      enabled: boolean;
      maxRetries: number;
      storageType: 'database' | 'file' | 'kafka';
      alertOnFailure: boolean;
    };
  };

  @ApiProperty({ description: 'Метрики интеграции' })
  @Column({ type: 'jsonb', nullable: true })
  metrics: {
    messagesReceived: number;
    messagesProcessed: number;
    messagesFailed: number;
    bytesProcessed: number;
    averageProcessingTime: number;
    lastProcessedAt?: Date;
    errorRate: number;
    uptime: number;
    connectionAttempts: number;
    successfulConnections: number;
    
    // Счетчики по типам сообщений
    messageTypeCounters?: Record<string, number>;
    
    // Производительность по часам
    hourlyStats?: Array<{
      hour: string;
      received: number;
      processed: number;
      failed: number;
      avgProcessingTime: number;
    }>;
  };

  @ApiProperty({ description: 'Настройки мониторинга' })
  @Column({ name: 'monitoring_config', type: 'jsonb', nullable: true })
  monitoringConfig: {
    healthCheck: {
      enabled: boolean;
      interval: number; // в секундах
      timeout: number;
      failureThreshold: number;
      successThreshold: number;
    };
    
    alerts: Array<{
      type: 'connection_lost' | 'high_error_rate' | 'processing_delay' | 'custom';
      condition: {
        metric: string;
        operator: 'gt' | 'lt' | 'eq' | 'gte' | 'lte';
        threshold: number;
        timeWindow: number;
      };
      actions: Array<{
        type: 'email' | 'webhook' | 'sms' | 'log';
        target: string;
        template?: string;
      }>;
      enabled: boolean;
    }>;
    
    logging: {
      level: 'error' | 'warn' | 'info' | 'debug';
      includePII: boolean;
      maxLogSize: number;
      retentionDays: number;
    };
  };

  @ApiProperty({ description: 'Настройки расписания' })
  @Column({ name: 'schedule_config', type: 'jsonb', nullable: true })
  scheduleConfig: {
    enabled: boolean;
    type: 'interval' | 'cron' | 'event_driven';
    interval?: number; // в миллисекундах
    cronExpression?: string;
    timezone?: string;
    
    // Временные окна работы
    activeHours?: {
      start: string; // HH:MM
      end: string; // HH:MM
      days: number[]; // 0-6
    };
    
    // Настройки пакетной обработки
    batchSettings?: {
      enabled: boolean;
      batchSize: number;
      batchTimeout: number;
    };
  };

  @ApiProperty({ description: 'Теги для категоризации' })
  @Column({ type: 'simple-array', nullable: true })
  tags: string[];

  @ApiProperty({ description: 'Дополнительные метаданные' })
  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @ApiProperty({ description: 'Дата последнего подключения' })
  @Column({ name: 'last_connected_at', nullable: true })
  lastConnectedAt: Date;

  @ApiProperty({ description: 'Дата последней ошибки' })
  @Column({ name: 'last_error_at', nullable: true })
  lastErrorAt: Date;

  @ApiProperty({ description: 'Последнее сообщение об ошибке' })
  @Column({ name: 'last_error_message', type: 'text', nullable: true })
  lastErrorMessage: string;

  @ApiProperty({ description: 'Версия конфигурации' })
  @Column({ name: 'config_version', default: 1 })
  configVersion: number;

  @ApiProperty({ description: 'Дата создания' })
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ApiProperty({ description: 'Дата обновления' })
  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Вычисляемые свойства
  get isConnected(): boolean {
    return this.status === ConnectionStatus.CONNECTED;
  }

  get hasErrors(): boolean {
    return this.status === ConnectionStatus.ERROR;
  }

  get uptime(): number {
    if (!this.lastConnectedAt) return 0;
    return new Date().getTime() - this.lastConnectedAt.getTime();
  }

  get errorRate(): number {
    if (!this.metrics) return 0;
    const total = this.metrics.messagesReceived || 0;
    const failed = this.metrics.messagesFailed || 0;
    return total > 0 ? (failed / total) * 100 : 0;
  }

  get throughput(): number {
    if (!this.metrics || this.uptime === 0) return 0;
    return (this.metrics.messagesProcessed || 0) / (this.uptime / 1000 / 60); // сообщений в минуту
  }

  get isHealthy(): boolean {
    if (!this.isActive) return false;
    if (this.hasErrors) return false;
    if (this.errorRate > 10) return false; // более 10% ошибок
    return true;
  }

  get connectionAge(): number {
    if (!this.lastConnectedAt) return 0;
    return new Date().getTime() - this.lastConnectedAt.getTime();
  }

  get nextScheduledRun(): Date | null {
    if (!this.scheduleConfig?.enabled) return null;
    
    // Простая логика для interval типа
    if (this.scheduleConfig.type === 'interval') {
      const interval = this.scheduleConfig.interval || 60000;
      return new Date(Date.now() + interval);
    }
    
    // Для cron и event_driven нужна более сложная логика
    return null;
  }
}