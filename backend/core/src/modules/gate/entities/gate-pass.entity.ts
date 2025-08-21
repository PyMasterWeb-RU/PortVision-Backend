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
import { Order } from '../../orders/entities/order.entity';
import { Container } from '../../common/entities/container.entity';

export enum GatePassType {
  IMPORT = 'import',
  EXPORT = 'export',
  EMPTY_RETURN = 'empty_return',
  EMPTY_PICKUP = 'empty_pickup',
  TEMPORARY = 'temporary',
  INSPECTION = 'inspection',
  MAINTENANCE = 'maintenance',
}

export enum GatePassStatus {
  ACTIVE = 'active',
  USED = 'used',
  EXPIRED = 'expired',
  CANCELLED = 'cancelled',
  SUSPENDED = 'suspended',
}

export enum GateDirection {
  IN = 'in',
  OUT = 'out',
  BOTH = 'both',
}

@Entity('gate_passes', { schema: 'gate' })
@Index(['passNumber'], { unique: true })
@Index(['type'])
@Index(['status'])
@Index(['direction'])
@Index(['orderId'])
@Index(['containerId'])
@Index(['validFrom', 'validUntil'])
@Index(['truckNumber'])
export class GatePass {
  @ApiProperty({ description: 'Уникальный идентификатор пропуска' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ description: 'Номер пропуска', example: 'GP-2023-001234' })
  @Column({ name: 'pass_number', type: 'varchar', length: 50, unique: true })
  passNumber: string;

  @ApiProperty({ description: 'Тип пропуска', enum: GatePassType })
  @Column({
    type: 'enum',
    enum: GatePassType,
  })
  type: GatePassType;

  @ApiProperty({ description: 'Статус пропуска', enum: GatePassStatus })
  @Column({
    type: 'enum',
    enum: GatePassStatus,
    default: GatePassStatus.ACTIVE,
  })
  status: GatePassStatus;

  @ApiProperty({ description: 'Направление движения', enum: GateDirection })
  @Column({
    type: 'enum',
    enum: GateDirection,
    default: GateDirection.BOTH,
  })
  direction: GateDirection;

  @ApiProperty({ description: 'ID заявки' })
  @Column({ name: 'order_id', nullable: true })
  orderId: string;

  @ApiProperty({ description: 'Заявка', type: () => Order })
  @ManyToOne(() => Order, { eager: true })
  @JoinColumn({ name: 'order_id' })
  order: Order;

  @ApiProperty({ description: 'ID контейнера' })
  @Column({ name: 'container_id', nullable: true })
  containerId: string;

  @ApiProperty({ description: 'Контейнер', type: () => Container })
  @ManyToOne(() => Container, { eager: true })
  @JoinColumn({ name: 'container_id' })
  container: Container;

  @ApiProperty({ description: 'Номер контейнера (если контейнер не создан в системе)' })
  @Column({ name: 'container_number', nullable: true })
  containerNumber: string;

  @ApiProperty({ description: 'Номер грузовика' })
  @Column({ name: 'truck_number' })
  truckNumber: string;

  @ApiProperty({ description: 'Номер прицепа' })
  @Column({ name: 'trailer_number', nullable: true })
  trailerNumber: string;

  @ApiProperty({ description: 'Имя водителя' })
  @Column({ name: 'driver_name' })
  driverName: string;

  @ApiProperty({ description: 'Номер водительского удостоверения' })
  @Column({ name: 'driver_license', nullable: true })
  driverLicense: string;

  @ApiProperty({ description: 'Телефон водителя' })
  @Column({ name: 'driver_phone', nullable: true })
  driverPhone: string;

  @ApiProperty({ description: 'Транспортная компания' })
  @Column({ name: 'transport_company', nullable: true })
  transportCompany: string;

  @ApiProperty({ description: 'Контактное лицо компании' })
  @Column({ name: 'company_contact', nullable: true })
  companyContact: string;

  @ApiProperty({ description: 'Телефон компании' })
  @Column({ name: 'company_phone', nullable: true })
  companyPhone: string;

  @ApiProperty({ description: 'Дата начала действия пропуска' })
  @Column({ name: 'valid_from', type: 'timestamp' })
  validFrom: Date;

  @ApiProperty({ description: 'Дата окончания действия пропуска' })
  @Column({ name: 'valid_until', type: 'timestamp' })
  validUntil: Date;

  @ApiProperty({ description: 'Цель визита' })
  @Column({ type: 'text', nullable: true })
  purpose: string;

  @ApiProperty({ description: 'Особые инструкции' })
  @Column({ name: 'special_instructions', type: 'text', nullable: true })
  specialInstructions: string;

  @ApiProperty({ description: 'Требуется сопровождение' })
  @Column({ name: 'requires_escort', default: false })
  requiresEscort: boolean;

  @ApiProperty({ description: 'Ограничения по времени' })
  @Column({ name: 'time_restrictions', type: 'jsonb', nullable: true })
  timeRestrictions: {
    allowedHours?: { from: string; to: string }[];
    excludedDays?: string[];
    maxStayDuration?: number; // minutes
  };

  @ApiProperty({ description: 'Ограничения по зонам' })
  @Column({ name: 'zone_restrictions', type: 'jsonb', nullable: true })
  zoneRestrictions: {
    allowedZones?: string[];
    restrictedZones?: string[];
    requiresPermissionFor?: string[];
  };

  @ApiProperty({ description: 'Фактическое время въезда' })
  @Column({ name: 'actual_entry_time', type: 'timestamp', nullable: true })
  actualEntryTime: Date;

  @ApiProperty({ description: 'Фактическое время выезда' })
  @Column({ name: 'actual_exit_time', type: 'timestamp', nullable: true })
  actualExitTime: Date;

  @ApiProperty({ description: 'Ворота въезда' })
  @Column({ name: 'entry_gate', nullable: true })
  entryGate: string;

  @ApiProperty({ description: 'Ворота выезда' })
  @Column({ name: 'exit_gate', nullable: true })
  exitGate: string;

  @ApiProperty({ description: 'ID пользователя, выдавшего пропуск' })
  @Column({ name: 'issued_by' })
  issuedBy: string;

  @ApiProperty({ description: 'ID пользователя, обработавшего въезд' })
  @Column({ name: 'entry_processed_by', nullable: true })
  entryProcessedBy: string;

  @ApiProperty({ description: 'ID пользователя, обработавшего выезд' })
  @Column({ name: 'exit_processed_by', nullable: true })
  exitProcessedBy: string;

  @ApiProperty({ description: 'QR код пропуска' })
  @Column({ name: 'qr_code', type: 'text', nullable: true })
  qrCode: string;

  @ApiProperty({ description: 'Штрих-код пропуска' })
  @Column({ name: 'barcode', nullable: true })
  barcode: string;

  @ApiProperty({ description: 'Фотографии транспорта' })
  @Column({ type: 'jsonb', nullable: true })
  photos: {
    entryPhotos?: {
      front?: string;
      rear?: string;
      side?: string;
      driver?: string;
      documents?: string;
    };
    exitPhotos?: {
      front?: string;
      rear?: string;
      side?: string;
    };
  };

  @ApiProperty({ description: 'Нарушения и замечания' })
  @Column({ type: 'jsonb', nullable: true })
  violations: {
    type: string;
    description: string;
    severity: 'low' | 'medium' | 'high';
    reportedBy: string;
    reportedAt: Date;
    resolved: boolean;
  }[];

  @ApiProperty({ description: 'Причина отмены (если пропуск отменен)' })
  @Column({ name: 'cancellation_reason', type: 'text', nullable: true })
  cancellationReason: string;

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