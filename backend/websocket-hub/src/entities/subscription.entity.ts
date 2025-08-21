import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

export enum SubscriptionType {
  CONTAINER_UPDATES = 'container_updates',
  EQUIPMENT_STATUS = 'equipment_status',
  GATE_OPERATIONS = 'gate_operations',
  YARD_MOVEMENTS = 'yard_movements',
  ORDER_CHANGES = 'order_changes',
  PERSONNEL_LOCATION = 'personnel_location',
  SYSTEM_ALERTS = 'system_alerts',
  WEATHER_UPDATES = 'weather_updates',
  SECURITY_EVENTS = 'security_events',
  MAINTENANCE_REQUESTS = 'maintenance_requests',
  BILLING_UPDATES = 'billing_updates',
  CUSTOM = 'custom',
}

export enum SubscriptionStatus {
  ACTIVE = 'active',
  PAUSED = 'paused',
  INACTIVE = 'inactive',
  EXPIRED = 'expired',
}

export enum FilterOperator {
  EQUALS = 'equals',
  NOT_EQUALS = 'not_equals',
  CONTAINS = 'contains',
  NOT_CONTAINS = 'not_contains',
  STARTS_WITH = 'starts_with',
  ENDS_WITH = 'ends_with',
  GREATER_THAN = 'greater_than',
  LESS_THAN = 'less_than',
  GREATER_EQUAL = 'greater_equal',
  LESS_EQUAL = 'less_equal',
  IN = 'in',
  NOT_IN = 'not_in',
  BETWEEN = 'between',
  IS_NULL = 'is_null',
  IS_NOT_NULL = 'is_not_null',
}

@Entity('subscriptions', { schema: 'websocket' })
@Index(['userId'])
@Index(['type'])
@Index(['status'])
@Index(['createdAt'])
@Index(['expiresAt'])
export class Subscription {
  @ApiProperty({ description: 'Уникальный идентификатор подписки' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ description: 'ID пользователя' })
  @Column({ name: 'user_id' })
  userId: string;

  @ApiProperty({ description: 'ID соединения' })
  @Column({ name: 'connection_id' })
  connectionId: string;

  @ApiProperty({ description: 'Тип подписки', enum: SubscriptionType })
  @Column({
    type: 'enum',
    enum: SubscriptionType,
  })
  type: SubscriptionType;

  @ApiProperty({ description: 'Статус подписки', enum: SubscriptionStatus })
  @Column({
    type: 'enum',
    enum: SubscriptionStatus,
    default: SubscriptionStatus.ACTIVE,
  })
  status: SubscriptionStatus;

  @ApiProperty({ description: 'Название подписки' })
  @Column()
  name: string;

  @ApiProperty({ description: 'Описание подписки' })
  @Column({ type: 'text', nullable: true })
  description: string;

  @ApiProperty({ description: 'Канал подписки' })
  @Column()
  channel: string;

  @ApiProperty({ description: 'Комната WebSocket' })
  @Column({ name: 'room_name' })
  roomName: string;

  @ApiProperty({ description: 'Фильтры подписки' })
  @Column({ type: 'jsonb', nullable: true })
  filters: Array<{
    field: string;
    operator: FilterOperator;
    value: any;
    logicalOperator?: 'AND' | 'OR';
  }>;

  @ApiProperty({ description: 'Настройки подписки' })
  @Column({ type: 'jsonb' })
  settings: {
    // Частота обновлений
    updateFrequency: number; // в миллисекундах
    batchUpdates: boolean;
    batchSize?: number;
    batchInterval?: number; // в миллисекундах
    
    // Приоритеты
    priority: 'low' | 'medium' | 'high' | 'critical';
    includeHistorical: boolean;
    maxHistoricalItems?: number;
    
    // Форматирование данных
    dataFormat: 'full' | 'minimal' | 'custom';
    includeMetadata: boolean;
    compression: boolean;
    
    // Буферизация
    bufferEnabled: boolean;
    bufferSize?: number;
    bufferTimeout?: number; // в миллисекундах
    
    // Условия доставки
    deliveryConditions?: {
      onlyIfChanged: boolean;
      significantChangeThreshold?: number;
      minimumInterval?: number; // в миллисекундах
      maxQueueSize?: number;
    };
    
    // Геофильтры
    geographicFilters?: {
      enabled: boolean;
      zones?: string[];
      radius?: {
        center: { x: number; y: number };
        distance: number;
      };
      boundingBox?: {
        minX: number;
        maxX: number;
        minY: number;
        maxY: number;
      };
    };
    
    // Временные фильтры
    timeFilters?: {
      enabled: boolean;
      startTime?: string; // HH:MM
      endTime?: string; // HH:MM
      weekdays?: number[]; // 0-6, где 0 = воскресенье
      timezone: string;
    };
  };

  @ApiProperty({ description: 'Конфигурация уведомлений' })
  @Column({ name: 'notification_config', type: 'jsonb', nullable: true })
  notificationConfig: {
    enabled: boolean;
    types: string[]; // типы событий для уведомлений
    priority: 'low' | 'medium' | 'high' | 'urgent';
    sound: boolean;
    vibration: boolean;
    badge: boolean;
    
    // Группировка уведомлений
    grouping: {
      enabled: boolean;
      groupBy: string; // поле для группировки
      maxGroupSize: number;
      groupTimeout: number; // в минутах
    };
    
    // Дедупликация
    deduplication: {
      enabled: boolean;
      keyFields: string[];
      timeWindow: number; // в минутах
    };
  };

  @ApiProperty({ description: 'Статистика подписки' })
  @Column({ type: 'jsonb', nullable: true })
  statistics: {
    totalMessages: number;
    messagesThisHour: number;
    messagesThisDay: number;
    averageMessageSize: number;
    totalBytesTransferred: number;
    lastMessageAt?: Date;
    peakMessagesPerHour: number;
    errorCount: number;
    lastErrorAt?: Date;
    averageLatency: number;
    
    // Статистика по типам событий
    eventTypeStats?: Record<string, {
      count: number;
      lastOccurrence: Date;
      avgProcessingTime: number;
    }>;
  };

  @ApiProperty({ description: 'Теги для категоризации' })
  @Column({ type: 'simple-array', nullable: true })
  tags: string[];

  @ApiProperty({ description: 'Пользовательские метаданные' })
  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @ApiProperty({ description: 'Дата последней активности' })
  @Column({ name: 'last_activity_at', nullable: true })
  lastActivityAt: Date;

  @ApiProperty({ description: 'Дата истечения подписки' })
  @Column({ name: 'expires_at', nullable: true })
  expiresAt: Date;

  @ApiProperty({ description: 'Автопродление' })
  @Column({ name: 'auto_renew', default: true })
  autoRenew: boolean;

  @ApiProperty({ description: 'Дата создания' })
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ApiProperty({ description: 'Дата обновления' })
  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Вычисляемые поля
  get isActive(): boolean {
    return this.status === SubscriptionStatus.ACTIVE;
  }

  get isPaused(): boolean {
    return this.status === SubscriptionStatus.PAUSED;
  }

  get isExpired(): boolean {
    return this.status === SubscriptionStatus.EXPIRED ||
           (this.expiresAt && this.expiresAt < new Date());
  }

  get hasFilters(): boolean {
    return (this.filters?.length || 0) > 0;
  }

  get hasGeographicFilters(): boolean {
    return this.settings.geographicFilters?.enabled || false;
  }

  get hasTimeFilters(): boolean {
    return this.settings.timeFilters?.enabled || false;
  }

  get isHighPriority(): boolean {
    return this.settings.priority === 'high' || this.settings.priority === 'critical';
  }

  get isBatchEnabled(): boolean {
    return this.settings.batchUpdates;
  }

  get updateInterval(): number {
    return this.settings.updateFrequency;
  }

  get messagesPerHour(): number {
    return this.statistics?.messagesThisHour || 0;
  }

  get messagesPerDay(): number {
    return this.statistics?.messagesThisDay || 0;
  }

  get averageLatency(): number {
    return this.statistics?.averageLatency || 0;
  }

  get errorRate(): number {
    const total = this.statistics?.totalMessages || 0;
    const errors = this.statistics?.errorCount || 0;
    return total > 0 ? (errors / total) * 100 : 0;
  }

  get dataVolume(): number {
    return this.statistics?.totalBytesTransferred || 0;
  }

  get dataVolumeFormatted(): string {
    const bytes = this.dataVolume;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    if (bytes === 0) return '0 Byte';
    const i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)).toString());
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  }

  get timeSinceLastActivity(): number {
    if (!this.lastActivityAt) return Infinity;
    return new Date().getTime() - this.lastActivityAt.getTime();
  }

  get isRecentlyActive(): boolean {
    const threshold = 60 * 60 * 1000; // 1 час
    return this.timeSinceLastActivity < threshold;
  }

  get timeToExpiry(): number {
    if (!this.expiresAt) return Infinity;
    return this.expiresAt.getTime() - new Date().getTime();
  }

  get isNearExpiry(): boolean {
    const threshold = 24 * 60 * 60 * 1000; // 24 часа
    return this.timeToExpiry < threshold && this.timeToExpiry > 0;
  }

  get priorityWeight(): number {
    const weights = {
      'low': 1,
      'medium': 2,
      'high': 3,
      'critical': 4,
    };
    return weights[this.settings.priority] || 1;
  }

  get subscriptionAge(): number {
    return new Date().getTime() - this.createdAt.getTime();
  }

  get isLongRunning(): boolean {
    const threshold = 7 * 24 * 60 * 60 * 1000; // 7 дней
    return this.subscriptionAge > threshold;
  }

  get estimatedCost(): number {
    // Примерная оценка стоимости подписки на основе объема данных и частоты
    const baseRate = 0.001; // базовая ставка за сообщение
    const volumeMultiplier = this.settings.priority === 'critical' ? 2 : 1;
    const frequencyMultiplier = this.updateInterval < 1000 ? 1.5 : 1;
    
    return (this.statistics?.totalMessages || 0) * baseRate * volumeMultiplier * frequencyMultiplier;
  }

  get performanceScore(): number {
    // Оценка производительности подписки (0-100)
    const latencyScore = Math.max(0, 100 - (this.averageLatency / 10));
    const errorScore = Math.max(0, 100 - this.errorRate);
    const activityScore = this.isRecentlyActive ? 100 : 50;
    
    return Math.round((latencyScore + errorScore + activityScore) / 3);
  }

  get healthStatus(): 'excellent' | 'good' | 'fair' | 'poor' {
    const score = this.performanceScore;
    if (score >= 90) return 'excellent';
    if (score >= 75) return 'good';
    if (score >= 60) return 'fair';
    return 'poor';
  }
}