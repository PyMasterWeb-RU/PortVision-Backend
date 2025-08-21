import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

export enum ConnectionStatus {
  CONNECTED = 'connected',
  DISCONNECTED = 'disconnected',
  IDLE = 'idle',
  RECONNECTING = 'reconnecting',
}

export enum ClientType {
  WEB_BROWSER = 'web_browser',
  MOBILE_APP = 'mobile_app',
  DESKTOP_APP = 'desktop_app',
  API_CLIENT = 'api_client',
  IOT_DEVICE = 'iot_device',
  THIRD_PARTY = 'third_party',
}

@Entity('websocket_connections', { schema: 'websocket' })
@Index(['userId'])
@Index(['socketId'])
@Index(['status'])
@Index(['clientType'])
@Index(['connectedAt'])
export class WebSocketConnection {
  @ApiProperty({ description: 'Уникальный идентификатор соединения' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ description: 'ID сокета' })
  @Column({ name: 'socket_id', unique: true })
  socketId: string;

  @ApiProperty({ description: 'ID пользователя' })
  @Column({ name: 'user_id' })
  userId: string;

  @ApiProperty({ description: 'Имя пользователя' })
  @Column({ name: 'user_name' })
  userName: string;

  @ApiProperty({ description: 'Роль пользователя' })
  @Column({ name: 'user_role' })
  userRole: string;

  @ApiProperty({ description: 'Статус соединения', enum: ConnectionStatus })
  @Column({
    type: 'enum',
    enum: ConnectionStatus,
    default: ConnectionStatus.CONNECTED,
  })
  status: ConnectionStatus;

  @ApiProperty({ description: 'Тип клиента', enum: ClientType })
  @Column({
    name: 'client_type',
    type: 'enum',
    enum: ClientType,
    default: ClientType.WEB_BROWSER,
  })
  clientType: ClientType;

  @ApiProperty({ description: 'Информация о клиенте' })
  @Column({ name: 'client_info', type: 'jsonb' })
  clientInfo: {
    userAgent?: string;
    browser?: {
      name: string;
      version: string;
    };
    os?: {
      name: string;
      version: string;
    };
    device?: {
      type: 'desktop' | 'mobile' | 'tablet';
      vendor?: string;
      model?: string;
    };
    screen?: {
      width: number;
      height: number;
    };
    language: string;
    timezone: string;
    ipAddress: string;
    location?: {
      country: string;
      city: string;
      coordinates?: {
        latitude: number;
        longitude: number;
      };
    };
  };

  @ApiProperty({ description: 'Подписки на каналы' })
  @Column({ type: 'simple-array' })
  subscriptions: string[];

  @ApiProperty({ description: 'Активные комнаты' })
  @Column({ type: 'simple-array' })
  rooms: string[];

  @ApiProperty({ description: 'Метрики соединения' })
  @Column({ type: 'jsonb', nullable: true })
  metrics: {
    messagesReceived: number;
    messagesSent: number;
    bytesReceived: number;
    bytesSent: number;
    latency: number;
    lastPing: Date;
    connectionDuration: number;
    reconnectCount: number;
    errorCount: number;
    lastActivity: Date;
  };

  @ApiProperty({ description: 'Настройки соединения' })
  @Column({ type: 'jsonb', nullable: true })
  settings: {
    enableNotifications: boolean;
    enableRealTimeUpdates: boolean;
    updateFrequency: number; // в миллисекундах
    compressionEnabled: boolean;
    heartbeatInterval: number;
    maxReconnectAttempts: number;
    bufferSize: number;
    qosLevel: 'low' | 'medium' | 'high';
    priorities: {
      alerts: number;
      updates: number;
      notifications: number;
    };
  };

  @ApiProperty({ description: 'Контекст сессии' })
  @Column({ name: 'session_context', type: 'jsonb', nullable: true })
  sessionContext: {
    currentView?: string;
    selectedEquipment?: string[];
    selectedContainers?: string[];
    filterSettings?: Record<string, any>;
    permissions: string[];
    workShift?: {
      id: string;
      startTime: Date;
      endTime: Date;
      role: string;
    };
    location?: {
      zone: string;
      area: string;
      coordinates?: {
        x: number;
        y: number;
      };
    };
  };

  @ApiProperty({ description: 'Дата подключения' })
  @Column({ name: 'connected_at' })
  connectedAt: Date;

  @ApiProperty({ description: 'Дата отключения' })
  @Column({ name: 'disconnected_at', nullable: true })
  disconnectedAt: Date;

  @ApiProperty({ description: 'Дата последней активности' })
  @Column({ name: 'last_activity_at' })
  lastActivityAt: Date;

  @ApiProperty({ description: 'Дата создания' })
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ApiProperty({ description: 'Дата обновления' })
  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Вычисляемые поля
  get isConnected(): boolean {
    return this.status === ConnectionStatus.CONNECTED;
  }

  get isIdle(): boolean {
    return this.status === ConnectionStatus.IDLE;
  }

  get connectionDuration(): number {
    const endTime = this.disconnectedAt || new Date();
    return endTime.getTime() - this.connectedAt.getTime();
  }

  get timeSinceLastActivity(): number {
    return new Date().getTime() - this.lastActivityAt.getTime();
  }

  get isActiveSession(): boolean {
    const idleThreshold = 30 * 60 * 1000; // 30 минут
    return this.isConnected && this.timeSinceLastActivity < idleThreshold;
  }

  get hasHighPriority(): boolean {
    return this.userRole === 'ADMIN' || 
           this.userRole === 'MANAGER' ||
           this.sessionContext?.workShift?.role === 'supervisor';
  }

  get subscriptionCount(): number {
    return this.subscriptions.length;
  }

  get roomCount(): number {
    return this.rooms.length;
  }

  get averageLatency(): number {
    return this.metrics?.latency || 0;
  }

  get messageRate(): number {
    if (!this.metrics || this.connectionDuration === 0) return 0;
    const durationInSeconds = this.connectionDuration / 1000;
    return (this.metrics.messagesReceived + this.metrics.messagesSent) / durationInSeconds;
  }

  get isHighTrafficConnection(): boolean {
    return this.messageRate > 10; // более 10 сообщений в секунду
  }

  get clientTypeIcon(): string {
    const icons = {
      [ClientType.WEB_BROWSER]: '🌐',
      [ClientType.MOBILE_APP]: '📱',
      [ClientType.DESKTOP_APP]: '💻',
      [ClientType.API_CLIENT]: '🔧',
      [ClientType.IOT_DEVICE]: '📡',
      [ClientType.THIRD_PARTY]: '🔗',
    };
    return icons[this.clientType] || '❓';
  }

  get locationString(): string {
    const location = this.clientInfo.location;
    if (!location) return 'Unknown';
    return `${location.city}, ${location.country}`;
  }

  get browserString(): string {
    const browser = this.clientInfo.browser;
    if (!browser) return 'Unknown';
    return `${browser.name} ${browser.version}`;
  }

  get osString(): string {
    const os = this.clientInfo.os;
    if (!os) return 'Unknown';
    return `${os.name} ${os.version}`;
  }

  get deviceString(): string {
    const device = this.clientInfo.device;
    if (!device) return 'Unknown';
    return device.vendor && device.model 
      ? `${device.vendor} ${device.model}` 
      : device.type;
  }
}