import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

export enum NotificationType {
  ALERT = 'alert',
  WARNING = 'warning',
  INFO = 'info',
  SUCCESS = 'success',
  ERROR = 'error',
  SYSTEM = 'system',
  OPERATION = 'operation',
  EQUIPMENT = 'equipment',
  SECURITY = 'security',
  WEATHER = 'weather',
}

export enum NotificationPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  URGENT = 'urgent',
  CRITICAL = 'critical',
}

export enum NotificationStatus {
  PENDING = 'pending',
  SENT = 'sent',
  DELIVERED = 'delivered',
  READ = 'read',
  FAILED = 'failed',
  EXPIRED = 'expired',
}

export enum DeliveryChannel {
  WEBSOCKET = 'websocket',
  EMAIL = 'email',
  SMS = 'sms',
  PUSH = 'push',
  BROWSER = 'browser',
  SYSTEM_TRAY = 'system_tray',
}

@Entity('notifications', { schema: 'websocket' })
@Index(['type'])
@Index(['priority'])
@Index(['status'])
@Index(['userId'])
@Index(['targetRole'])
@Index(['createdAt'])
@Index(['expiresAt'])
export class Notification {
  @ApiProperty({ description: 'Уникальный идентификатор уведомления' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ description: 'Тип уведомления', enum: NotificationType })
  @Column({
    type: 'enum',
    enum: NotificationType,
  })
  type: NotificationType;

  @ApiProperty({ description: 'Приоритет уведомления', enum: NotificationPriority })
  @Column({
    type: 'enum',
    enum: NotificationPriority,
    default: NotificationPriority.MEDIUM,
  })
  priority: NotificationPriority;

  @ApiProperty({ description: 'Статус уведомления', enum: NotificationStatus })
  @Column({
    type: 'enum',
    enum: NotificationStatus,
    default: NotificationStatus.PENDING,
  })
  status: NotificationStatus;

  @ApiProperty({ description: 'Заголовок уведомления' })
  @Column()
  title: string;

  @ApiProperty({ description: 'Сообщение уведомления' })
  @Column({ type: 'text' })
  message: string;

  @ApiProperty({ description: 'Краткое сообщение' })
  @Column({ name: 'short_message', nullable: true })
  shortMessage: string;

  @ApiProperty({ description: 'Категория уведомления' })
  @Column({ nullable: true })
  category: string;

  @ApiProperty({ description: 'Теги для фильтрации' })
  @Column({ type: 'simple-array', nullable: true })
  tags: string[];

  @ApiProperty({ description: 'ID целевого пользователя' })
  @Column({ name: 'user_id', nullable: true })
  userId: string;

  @ApiProperty({ description: 'Целевая роль' })
  @Column({ name: 'target_role', nullable: true })
  targetRole: string;

  @ApiProperty({ description: 'Целевая группа' })
  @Column({ name: 'target_group', nullable: true })
  targetGroup: string;

  @ApiProperty({ description: 'Целевая зона терминала' })
  @Column({ name: 'target_zone', nullable: true })
  targetZone: string;

  @ApiProperty({ description: 'Каналы доставки', enum: DeliveryChannel })
  @Column({
    name: 'delivery_channels',
    type: 'simple-array',
    default: [DeliveryChannel.WEBSOCKET],
  })
  deliveryChannels: DeliveryChannel[];

  @ApiProperty({ description: 'Данные уведомления' })
  @Column({ type: 'jsonb' })
  data: {
    // Базовые данные
    source: string;
    sourceId?: string;
    sourceType?: string;
    
    // Действия
    actions?: Array<{
      id: string;
      label: string;
      type: 'button' | 'link' | 'api_call';
      url?: string;
      method?: string;
      payload?: any;
      style?: 'primary' | 'secondary' | 'success' | 'warning' | 'danger';
    }>;
    
    // Вложения
    attachments?: Array<{
      type: 'image' | 'document' | 'video' | 'audio';
      url: string;
      name: string;
      size?: number;
      mimeType?: string;
    }>;
    
    // Местоположение
    location?: {
      zone: string;
      area: string;
      coordinates?: {
        x: number;
        y: number;
        z?: number;
      };
    };
    
    // Связанные объекты
    relatedObjects?: Array<{
      type: 'container' | 'equipment' | 'order' | 'person';
      id: string;
      name: string;
      status?: string;
    }>;
    
    // Метрики
    metrics?: {
      severity: number; // 1-10
      impact: 'low' | 'medium' | 'high' | 'critical';
      urgency: 'low' | 'medium' | 'high' | 'immediate';
      estimatedResolutionTime?: number; // в минутах
    };
    
    // Контекст
    context?: {
      workShift?: string;
      weather?: string;
      systemLoad?: number;
      activeOperations?: number;
    };
  };

  @ApiProperty({ description: 'Настройки отображения' })
  @Column({ name: 'display_settings', type: 'jsonb', nullable: true })
  displaySettings: {
    icon?: string;
    color?: string;
    sound?: string;
    duration?: number; // в миллисекундах
    position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center';
    modal?: boolean;
    dismissible?: boolean;
    autoHide?: boolean;
    animation?: 'fade' | 'slide' | 'bounce' | 'shake';
    badge?: {
      text: string;
      color: string;
    };
    progress?: {
      show: boolean;
      value?: number;
      max?: number;
    };
  };

  @ApiProperty({ description: 'Правила доставки' })
  @Column({ name: 'delivery_rules', type: 'jsonb', nullable: true })
  deliveryRules: {
    immediate: boolean;
    batchDelivery?: boolean;
    batchInterval?: number; // в минутах
    maxRetries?: number;
    retryInterval?: number; // в минутах
    failureEscalation?: {
      enabled: boolean;
      escalateAfter: number; // в минутах
      escalateTo: string; // роль или пользователь
    };
    deliveryWindow?: {
      startHour: number;
      endHour: number;
      timezone: string;
      weekdaysOnly?: boolean;
    };
    conditions?: Array<{
      field: string;
      operator: 'equals' | 'not_equals' | 'contains' | 'greater_than' | 'less_than';
      value: any;
    }>;
  };

  @ApiProperty({ description: 'История доставки' })
  @Column({ name: 'delivery_history', type: 'jsonb', nullable: true })
  deliveryHistory: Array<{
    channel: DeliveryChannel;
    status: 'success' | 'failed' | 'retry';
    timestamp: Date;
    recipientId?: string;
    errorMessage?: string;
    metadata?: Record<string, any>;
  }>;

  @ApiProperty({ description: 'Дата отправки' })
  @Column({ name: 'sent_at', nullable: true })
  sentAt: Date;

  @ApiProperty({ description: 'Дата доставки' })
  @Column({ name: 'delivered_at', nullable: true })
  deliveredAt: Date;

  @ApiProperty({ description: 'Дата прочтения' })
  @Column({ name: 'read_at', nullable: true })
  readAt: Date;

  @ApiProperty({ description: 'Дата истечения' })
  @Column({ name: 'expires_at', nullable: true })
  expiresAt: Date;

  @ApiProperty({ description: 'Количество попыток доставки' })
  @Column({ name: 'delivery_attempts', default: 0 })
  deliveryAttempts: number;

  @ApiProperty({ description: 'Дата создания' })
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ApiProperty({ description: 'Дата обновления' })
  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Вычисляемые поля
  get isPending(): boolean {
    return this.status === NotificationStatus.PENDING;
  }

  get isSent(): boolean {
    return this.status === NotificationStatus.SENT;
  }

  get isDelivered(): boolean {
    return this.status === NotificationStatus.DELIVERED;
  }

  get isRead(): boolean {
    return this.status === NotificationStatus.READ;
  }

  get isFailed(): boolean {
    return this.status === NotificationStatus.FAILED;
  }

  get isExpired(): boolean {
    return this.status === NotificationStatus.EXPIRED || 
           (this.expiresAt && this.expiresAt < new Date());
  }

  get isCritical(): boolean {
    return this.priority === NotificationPriority.CRITICAL ||
           this.priority === NotificationPriority.URGENT;
  }

  get isHighPriority(): boolean {
    return this.priority === NotificationPriority.HIGH ||
           this.priority === NotificationPriority.URGENT ||
           this.priority === NotificationPriority.CRITICAL;
  }

  get hasActions(): boolean {
    return (this.data.actions?.length || 0) > 0;
  }

  get hasAttachments(): boolean {
    return (this.data.attachments?.length || 0) > 0;
  }

  get hasLocation(): boolean {
    return !!this.data.location;
  }

  get severityScore(): number {
    return this.data.metrics?.severity || 5;
  }

  get estimatedResolutionTime(): number {
    return this.data.metrics?.estimatedResolutionTime || 0;
  }

  get deliveryTime(): number {
    if (!this.sentAt || !this.deliveredAt) return 0;
    return this.deliveredAt.getTime() - this.sentAt.getTime();
  }

  get responseTime(): number {
    if (!this.deliveredAt || !this.readAt) return 0;
    return this.readAt.getTime() - this.deliveredAt.getTime();
  }

  get age(): number {
    return new Date().getTime() - this.createdAt.getTime();
  }

  get timeToExpiry(): number {
    if (!this.expiresAt) return Infinity;
    return this.expiresAt.getTime() - new Date().getTime();
  }

  get isNearExpiry(): boolean {
    const threshold = 60 * 60 * 1000; // 1 час
    return this.timeToExpiry < threshold && this.timeToExpiry > 0;
  }

  get deliverySuccessRate(): number {
    if (this.deliveryHistory.length === 0) return 0;
    const successful = this.deliveryHistory.filter(h => h.status === 'success').length;
    return (successful / this.deliveryHistory.length) * 100;
  }

  get priorityIcon(): string {
    const icons = {
      [NotificationPriority.LOW]: '🔵',
      [NotificationPriority.MEDIUM]: '🟡',
      [NotificationPriority.HIGH]: '🟠',
      [NotificationPriority.URGENT]: '🔴',
      [NotificationPriority.CRITICAL]: '🚨',
    };
    return icons[this.priority] || '⚪';
  }

  get typeIcon(): string {
    const icons = {
      [NotificationType.ALERT]: '⚠️',
      [NotificationType.WARNING]: '🚨',
      [NotificationType.INFO]: 'ℹ️',
      [NotificationType.SUCCESS]: '✅',
      [NotificationType.ERROR]: '❌',
      [NotificationType.SYSTEM]: '⚙️',
      [NotificationType.OPERATION]: '🏗️',
      [NotificationType.EQUIPMENT]: '🚛',
      [NotificationType.SECURITY]: '🔒',
      [NotificationType.WEATHER]: '🌤️',
    };
    return icons[this.type] || '📢';
  }
}