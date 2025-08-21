import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { Order } from './order.entity';

export enum WorkflowStepType {
  CREATED = 'created',
  SUBMITTED = 'submitted',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  ASSIGNED = 'assigned',
  STARTED = 'started',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  ON_HOLD = 'on_hold',
  RESUMED = 'resumed',
  MODIFIED = 'modified',
  DOCUMENT_UPLOADED = 'document_uploaded',
  NOTIFICATION_SENT = 'notification_sent',
  PAYMENT_RECEIVED = 'payment_received',
  CUSTOMS_CLEARED = 'customs_cleared',
  INSPECTION_COMPLETED = 'inspection_completed',
}

@Entity('order_workflows', { schema: 'orders' })
@Index(['orderId'])
@Index(['stepType'])
@Index(['timestamp'])
@Index(['userId'])
export class OrderWorkflow {
  @ApiProperty({ description: 'Уникальный идентификатор шага workflow' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ description: 'ID заявки' })
  @Column({ name: 'order_id' })
  orderId: string;

  @ApiProperty({ description: 'Заявка', type: () => Order })
  @ManyToOne(() => Order, (order) => order.workflows)
  @JoinColumn({ name: 'order_id' })
  order: Order;

  @ApiProperty({ description: 'Тип шага workflow', enum: WorkflowStepType })
  @Column({
    name: 'step_type',
    type: 'enum',
    enum: WorkflowStepType,
  })
  stepType: WorkflowStepType;

  @ApiProperty({ description: 'Название шага' })
  @Column({ name: 'step_name' })
  stepName: string;

  @ApiProperty({ description: 'Описание шага' })
  @Column({ type: 'text', nullable: true })
  description: string;

  @ApiProperty({ description: 'Временная метка выполнения шага' })
  @Column({ type: 'timestamp' })
  timestamp: Date;

  @ApiProperty({ description: 'ID пользователя, выполнившего шаг' })
  @Column({ name: 'user_id' })
  userId: string;

  @ApiProperty({ description: 'Имя пользователя' })
  @Column({ name: 'user_name', nullable: true })
  userName: string;

  @ApiProperty({ description: 'Роль пользователя' })
  @Column({ name: 'user_role', nullable: true })
  userRole: string;

  @ApiProperty({ description: 'Статус до изменения' })
  @Column({ name: 'previous_status', nullable: true })
  previousStatus: string;

  @ApiProperty({ description: 'Статус после изменения' })
  @Column({ name: 'new_status', nullable: true })
  newStatus: string;

  @ApiProperty({ description: 'Комментарий к шагу' })
  @Column({ type: 'text', nullable: true })
  comment: string;

  @ApiProperty({ description: 'Данные изменений' })
  @Column({ type: 'jsonb', nullable: true })
  changes: {
    field: string;
    oldValue: any;
    newValue: any;
  }[];

  @ApiProperty({ description: 'Вложения к шагу' })
  @Column({ type: 'jsonb', nullable: true })
  attachments: {
    fileId: string;
    fileName: string;
    fileType: string;
    fileSize: number;
  }[];

  @ApiProperty({ description: 'Уведомления, отправленные на этом шаге' })
  @Column({ type: 'jsonb', nullable: true })
  notifications: {
    recipient: string;
    type: string;
    status: string;
    sentAt: Date;
  }[];

  @ApiProperty({ description: 'Продолжительность шага (миллисекунды)' })
  @Column({ name: 'duration_ms', type: 'bigint', nullable: true })
  durationMs: number;

  @ApiProperty({ description: 'Источник инициации шага' })
  @Column({ default: 'manual' })
  source: string;

  @ApiProperty({ description: 'IP адрес пользователя' })
  @Column({ name: 'ip_address', nullable: true })
  ipAddress: string;

  @ApiProperty({ description: 'User Agent браузера' })
  @Column({ name: 'user_agent', type: 'text', nullable: true })
  userAgent: string;

  @ApiProperty({ description: 'Дополнительные метаданные' })
  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @ApiProperty({ description: 'Дата создания записи' })
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}