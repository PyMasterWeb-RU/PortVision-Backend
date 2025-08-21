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

export enum TimeSlotType {
  GATE_IN = 'gate_in',
  GATE_OUT = 'gate_out',
  LOADING = 'loading',
  DISCHARGE = 'discharge',
  INSPECTION = 'inspection',
  CUSTOMS = 'customs',
  DELIVERY = 'delivery',
  PICKUP = 'pickup',
}

export enum TimeSlotStatus {
  AVAILABLE = 'available',
  RESERVED = 'reserved',
  CONFIRMED = 'confirmed',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  NO_SHOW = 'no_show',
}

@Entity('time_slots', { schema: 'orders' })
@Index(['type'])
@Index(['status'])
@Index(['startTime', 'endTime'])
@Index(['orderId'])
@Index(['location'])
export class TimeSlot {
  @ApiProperty({ description: 'Уникальный идентификатор тайм-слота' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ description: 'Тип тайм-слота', enum: TimeSlotType })
  @Column({
    type: 'enum',
    enum: TimeSlotType,
  })
  type: TimeSlotType;

  @ApiProperty({ description: 'Статус тайм-слота', enum: TimeSlotStatus })
  @Column({
    type: 'enum',
    enum: TimeSlotStatus,
    default: TimeSlotStatus.AVAILABLE,
  })
  status: TimeSlotStatus;

  @ApiProperty({ description: 'Время начала слота' })
  @Column({ name: 'start_time', type: 'timestamp' })
  startTime: Date;

  @ApiProperty({ description: 'Время окончания слота' })
  @Column({ name: 'end_time', type: 'timestamp' })
  endTime: Date;

  @ApiProperty({ description: 'Продолжительность в минутах' })
  @Column({ name: 'duration_minutes', type: 'smallint' })
  durationMinutes: number;

  @ApiProperty({ description: 'Местоположение/ресурс', example: 'Gate A1' })
  @Column()
  location: string;

  @ApiProperty({ description: 'Максимальное количество контейнеров в слоте' })
  @Column({ name: 'max_containers', type: 'smallint', default: 1 })
  maxContainers: number;

  @ApiProperty({ description: 'Зарезервированное количество контейнеров' })
  @Column({ name: 'reserved_containers', type: 'smallint', default: 0 })
  reservedContainers: number;

  @ApiProperty({ description: 'ID заявки (если слот зарезервирован)' })
  @Column({ name: 'order_id', nullable: true })
  orderId: string;

  @ApiProperty({ description: 'Заявка', type: () => Order })
  @ManyToOne(() => Order)
  @JoinColumn({ name: 'order_id' })
  order: Order;

  @ApiProperty({ description: 'ID клиента (если слот зарезервирован)' })
  @Column({ name: 'client_id', nullable: true })
  clientId: string;

  @ApiProperty({ description: 'Контактная информация' })
  @Column({ name: 'contact_info', type: 'jsonb', nullable: true })
  contactInfo: {
    contactPerson?: string;
    phone?: string;
    email?: string;
    truckNumber?: string;
    driverName?: string;
    driverPhone?: string;
  };

  @ApiProperty({ description: 'Требования к слоту' })
  @Column({ type: 'jsonb', nullable: true })
  requirements: {
    containerTypes?: string[];
    requiresWeighing?: boolean;
    requiresInspection?: boolean;
    requiresCustoms?: boolean;
    specialEquipment?: string[];
    hazardousCargo?: boolean;
    oversized?: boolean;
  };

  @ApiProperty({ description: 'Стоимость слота' })
  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  cost: number;

  @ApiProperty({ description: 'Валюта стоимости' })
  @Column({ length: 3, default: 'RUB' })
  currency: string;

  @ApiProperty({ description: 'Время резервирования' })
  @Column({ name: 'reserved_at', type: 'timestamp', nullable: true })
  reservedAt: Date;

  @ApiProperty({ description: 'ID пользователя, зарезервировавшего слот' })
  @Column({ name: 'reserved_by', nullable: true })
  reservedBy: string;

  @ApiProperty({ description: 'Время подтверждения' })
  @Column({ name: 'confirmed_at', type: 'timestamp', nullable: true })
  confirmedAt: Date;

  @ApiProperty({ description: 'ID пользователя, подтвердившего слот' })
  @Column({ name: 'confirmed_by', nullable: true })
  confirmedBy: string;

  @ApiProperty({ description: 'Фактическое время начала' })
  @Column({ name: 'actual_start_time', type: 'timestamp', nullable: true })
  actualStartTime: Date;

  @ApiProperty({ description: 'Фактическое время окончания' })
  @Column({ name: 'actual_end_time', type: 'timestamp', nullable: true })
  actualEndTime: Date;

  @ApiProperty({ description: 'Причина отмены (если слот отменен)' })
  @Column({ name: 'cancellation_reason', type: 'text', nullable: true })
  cancellationReason: string;

  @ApiProperty({ description: 'Время отмены' })
  @Column({ name: 'cancelled_at', type: 'timestamp', nullable: true })
  cancelledAt: Date;

  @ApiProperty({ description: 'Примечания к слоту' })
  @Column({ type: 'text', nullable: true })
  notes: string;

  @ApiProperty({ description: 'Дополнительные метаданные' })
  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @ApiProperty({ description: 'Активен ли слот' })
  @Column({ default: true })
  isActive: boolean;

  @ApiProperty({ description: 'Дата создания' })
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ApiProperty({ description: 'Дата обновления' })
  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}