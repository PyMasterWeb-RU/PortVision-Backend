import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { Order } from './order.entity';

export enum NoteType {
  GENERAL = 'general',
  CUSTOMER_REQUEST = 'customer_request',
  INTERNAL = 'internal',
  SYSTEM = 'system',
  WARNING = 'warning',
  ERROR = 'error',
  CUSTOMS = 'customs',
  OPERATIONS = 'operations',
  BILLING = 'billing',
}

export enum NoteVisibility {
  PUBLIC = 'public',
  INTERNAL = 'internal',
  PRIVATE = 'private',
}

@Entity('order_notes', { schema: 'orders' })
@Index(['orderId'])
@Index(['type'])
@Index(['visibility'])
@Index(['createdBy'])
@Index(['createdAt'])
export class OrderNote {
  @ApiProperty({ description: 'Уникальный идентификатор заметки' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ description: 'ID заявки' })
  @Column({ name: 'order_id' })
  orderId: string;

  @ApiProperty({ description: 'Заявка', type: () => Order })
  @ManyToOne(() => Order, (order) => order.notes)
  @JoinColumn({ name: 'order_id' })
  order: Order;

  @ApiProperty({ description: 'Тип заметки', enum: NoteType })
  @Column({
    type: 'enum',
    enum: NoteType,
    default: NoteType.GENERAL,
  })
  type: NoteType;

  @ApiProperty({ description: 'Видимость заметки', enum: NoteVisibility })
  @Column({
    type: 'enum',
    enum: NoteVisibility,
    default: NoteVisibility.INTERNAL,
  })
  visibility: NoteVisibility;

  @ApiProperty({ description: 'Заголовок заметки' })
  @Column({ nullable: true })
  title: string;

  @ApiProperty({ description: 'Содержание заметки' })
  @Column({ type: 'text' })
  content: string;

  @ApiProperty({ description: 'Важность заметки' })
  @Column({ type: 'smallint', default: 0 })
  priority: number;

  @ApiProperty({ description: 'ID пользователя, создавшего заметку' })
  @Column({ name: 'created_by' })
  createdBy: string;

  @ApiProperty({ description: 'Имя пользователя' })
  @Column({ name: 'created_by_name', nullable: true })
  createdByName: string;

  @ApiProperty({ description: 'ID пользователя, которому адресована заметка' })
  @Column({ name: 'addressed_to', nullable: true })
  addressedTo: string;

  @ApiProperty({ description: 'Дата, когда заметка должна быть обработана' })
  @Column({ name: 'due_date', type: 'timestamp', nullable: true })
  dueDate: Date;

  @ApiProperty({ description: 'Заметка обработана' })
  @Column({ name: 'is_resolved', default: false })
  isResolved: boolean;

  @ApiProperty({ description: 'Дата обработки заметки' })
  @Column({ name: 'resolved_at', type: 'timestamp', nullable: true })
  resolvedAt: Date;

  @ApiProperty({ description: 'ID пользователя, обработавшего заметку' })
  @Column({ name: 'resolved_by', nullable: true })
  resolvedBy: string;

  @ApiProperty({ description: 'Комментарий к обработке' })
  @Column({ name: 'resolution_comment', type: 'text', nullable: true })
  resolutionComment: string;

  @ApiProperty({ description: 'Вложения к заметке' })
  @Column({ type: 'jsonb', nullable: true })
  attachments: {
    fileId: string;
    fileName: string;
    fileType: string;
    fileSize: number;
  }[];

  @ApiProperty({ description: 'Теги заметки' })
  @Column({ type: 'jsonb', nullable: true })
  tags: string[];

  @ApiProperty({ description: 'Заметка закреплена' })
  @Column({ name: 'is_pinned', default: false })
  isPinned: boolean;

  @ApiProperty({ description: 'Дополнительные метаданные' })
  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @ApiProperty({ description: 'Дата создания' })
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ApiProperty({ description: 'Дата обновления' })
  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}