import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { Client } from '../../common/entities/client.entity';
import { Consignee } from '../../common/entities/consignee.entity';
import { OrderItem } from './order-item.entity';
import { OrderWorkflow } from './order-workflow.entity';
import { OrderNote } from './order-note.entity';

export enum OrderType {
  IMPORT = 'import',
  EXPORT = 'export',
  EMPTY_RETURN = 'empty_return',
  EMPTY_PICKUP = 'empty_pickup',
  TRANSSHIPMENT = 'transshipment',
  STORAGE = 'storage',
  REPAIR = 'repair',
}

export enum OrderStatus {
  DRAFT = 'draft',
  SUBMITTED = 'submitted',
  CONFIRMED = 'confirmed',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  ON_HOLD = 'on_hold',
}

export enum OrderPriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  URGENT = 'urgent',
}

@Entity('orders', { schema: 'orders' })
@Index(['orderNumber'], { unique: true })
@Index(['type'])
@Index(['status'])
@Index(['priority'])
@Index(['clientId'])
@Index(['consigneeId'])
@Index(['requestedDate'])
@Index(['vesselVoyage'])
export class Order {
  @ApiProperty({ description: 'Уникальный идентификатор заявки' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ description: 'Номер заявки', example: 'ORD-2023-001234' })
  @Column({ name: 'order_number', type: 'varchar', length: 50, unique: true })
  orderNumber: string;

  @ApiProperty({ description: 'Тип заявки', enum: OrderType })
  @Column({
    type: 'enum',
    enum: OrderType,
  })
  type: OrderType;

  @ApiProperty({ description: 'Статус заявки', enum: OrderStatus })
  @Column({
    type: 'enum',
    enum: OrderStatus,
    default: OrderStatus.DRAFT,
  })
  status: OrderStatus;

  @ApiProperty({ description: 'Приоритет заявки', enum: OrderPriority })
  @Column({
    type: 'enum',
    enum: OrderPriority,
    default: OrderPriority.NORMAL,
  })
  priority: OrderPriority;

  @ApiProperty({ description: 'ID клиента' })
  @Column({ name: 'client_id' })
  clientId: string;

  @ApiProperty({ description: 'Клиент', type: () => Client })
  @ManyToOne(() => Client, { eager: true })
  @JoinColumn({ name: 'client_id' })
  client: Client;

  @ApiProperty({ description: 'ID грузополучателя' })
  @Column({ name: 'consignee_id', nullable: true })
  consigneeId: string;

  @ApiProperty({ description: 'Грузополучатель', type: () => Consignee })
  @ManyToOne(() => Consignee, { eager: true })
  @JoinColumn({ name: 'consignee_id' })
  consignee: Consignee;

  @ApiProperty({ description: 'Название судна' })
  @Column({ name: 'vessel_name', nullable: true })
  vesselName: string;

  @ApiProperty({ description: 'Рейс', example: '2023-045' })
  @Column({ name: 'vessel_voyage', nullable: true })
  vesselVoyage: string;

  @ApiProperty({ description: 'IMO номер судна' })
  @Column({ name: 'vessel_imo', nullable: true })
  vesselImo: string;

  @ApiProperty({ description: 'Коносамент/Bill of Lading номер' })
  @Column({ name: 'bill_of_lading', nullable: true })
  billOfLading: string;

  @ApiProperty({ description: 'Booking номер' })
  @Column({ name: 'booking_number', nullable: true })
  bookingNumber: string;

  @ApiProperty({ description: 'Запрошенная дата выполнения' })
  @Column({ name: 'requested_date', type: 'timestamp' })
  requestedDate: Date;

  @ApiProperty({ description: 'Планируемая дата начала' })
  @Column({ name: 'planned_start_date', type: 'timestamp', nullable: true })
  plannedStartDate: Date;

  @ApiProperty({ description: 'Планируемая дата завершения' })
  @Column({ name: 'planned_end_date', type: 'timestamp', nullable: true })
  plannedEndDate: Date;

  @ApiProperty({ description: 'Фактическая дата начала' })
  @Column({ name: 'actual_start_date', type: 'timestamp', nullable: true })
  actualStartDate: Date;

  @ApiProperty({ description: 'Фактическая дата завершения' })
  @Column({ name: 'actual_end_date', type: 'timestamp', nullable: true })
  actualEndDate: Date;

  @ApiProperty({ description: 'Место доставки/получения' })
  @Column({ name: 'delivery_address', type: 'text', nullable: true })
  deliveryAddress: string;

  @ApiProperty({ description: 'Контактное лицо клиента' })
  @Column({ name: 'contact_person', nullable: true })
  contactPerson: string;

  @ApiProperty({ description: 'Телефон контактного лица' })
  @Column({ name: 'contact_phone', nullable: true })
  contactPhone: string;

  @ApiProperty({ description: 'Email контактного лица' })
  @Column({ name: 'contact_email', nullable: true })
  contactEmail: string;

  @ApiProperty({ description: 'Особые инструкции' })
  @Column({ name: 'special_instructions', type: 'text', nullable: true })
  specialInstructions: string;

  @ApiProperty({ description: 'Температурный режим (для рефрижераторов)' })
  @Column({ name: 'temperature_range', type: 'jsonb', nullable: true })
  temperatureRange: {
    min?: number;
    max?: number;
    unit?: string;
  };

  @ApiProperty({ description: 'Требования к обработке' })
  @Column({ name: 'handling_requirements', type: 'jsonb', nullable: true })
  handlingRequirements: {
    requiresCustomsInspection?: boolean;
    requiresPhytosanitaryInspection?: boolean;
    requiresWeighing?: boolean;
    requiresCleaning?: boolean;
    requiresRepair?: boolean;
    hazardousCargo?: boolean;
    oversizedCargo?: boolean;
  };

  @ApiProperty({ description: 'Таможенные данные' })
  @Column({ name: 'customs_data', type: 'jsonb', nullable: true })
  customsData: {
    declarationNumber?: string;
    customsBroker?: string;
    customsStatus?: string;
    inspectionRequired?: boolean;
    releaseDate?: Date;
  };

  @ApiProperty({ description: 'EDI сообщение (источник)' })
  @Column({ name: 'edi_message', type: 'jsonb', nullable: true })
  ediMessage: {
    messageType?: string;
    messageId?: string;
    sender?: string;
    receiver?: string;
    rawMessage?: string;
    processedAt?: Date;
  };

  @ApiProperty({ description: 'Расчетная стоимость' })
  @Column({ name: 'estimated_cost', type: 'decimal', precision: 12, scale: 2, nullable: true })
  estimatedCost: number;

  @ApiProperty({ description: 'Фактическая стоимость' })
  @Column({ name: 'actual_cost', type: 'decimal', precision: 12, scale: 2, nullable: true })
  actualCost: number;

  @ApiProperty({ description: 'Валюта' })
  @Column({ length: 3, default: 'RUB' })
  currency: string;

  @ApiProperty({ description: 'ID пользователя, создавшего заявку' })
  @Column({ name: 'created_by' })
  createdBy: string;

  @ApiProperty({ description: 'ID пользователя, назначенного ответственным' })
  @Column({ name: 'assigned_to', nullable: true })
  assignedTo: string;

  @ApiProperty({ description: 'Дополнительные метаданные' })
  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @ApiProperty({ description: 'Активна ли заявка' })
  @Column({ default: true })
  isActive: boolean;

  @ApiProperty({ description: 'Позиции заявки', type: () => [OrderItem] })
  @OneToMany(() => OrderItem, (item) => item.order, { cascade: true })
  items: OrderItem[];

  @ApiProperty({ description: 'Workflow заявки', type: () => [OrderWorkflow] })
  @OneToMany(() => OrderWorkflow, (workflow) => workflow.order)
  workflows: OrderWorkflow[];

  @ApiProperty({ description: 'Заметки по заявке', type: () => [OrderNote] })
  @OneToMany(() => OrderNote, (note) => note.order)
  notes: OrderNote[];

  @ApiProperty({ description: 'Дата создания' })
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ApiProperty({ description: 'Дата обновления' })
  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}