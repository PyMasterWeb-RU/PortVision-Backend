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
import { Container } from './container.entity';

export enum ContainerEventType {
  GATE_IN = 'gate_in',
  GATE_OUT = 'gate_out',
  YARD_IN = 'yard_in',
  YARD_OUT = 'yard_out',
  LOADING_START = 'loading_start',
  LOADING_END = 'loading_end',
  DISCHARGE_START = 'discharge_start',
  DISCHARGE_END = 'discharge_end',
  INSPECTION = 'inspection',
  REPAIR_START = 'repair_start',
  REPAIR_END = 'repair_end',
  DAMAGE_REPORT = 'damage_report',
  CLEANING = 'cleaning',
  WEIGHING = 'weighing',
  CUSTOMS_INSPECTION = 'customs_inspection',
  FUMIGATION = 'fumigation',
  TEMPERATURE_CHECK = 'temperature_check',
  PLUG_IN = 'plug_in',
  PLUG_OUT = 'plug_out',
  MOVEMENT = 'movement',
  STATUS_CHANGE = 'status_change',
}

@Entity('container_events', { schema: 'core' })
@Index(['containerId'])
@Index(['eventType'])
@Index(['timestamp'])
@Index(['location'])
export class ContainerEvent {
  @ApiProperty({ description: 'Уникальный идентификатор события' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ description: 'ID контейнера' })
  @Column({ name: 'container_id' })
  containerId: string;

  @ApiProperty({ description: 'Контейнер', type: () => Container })
  @ManyToOne(() => Container, (container) => container.events)
  @JoinColumn({ name: 'container_id' })
  container: Container;

  @ApiProperty({ description: 'Тип события', enum: ContainerEventType })
  @Column({
    name: 'event_type',
    type: 'enum',
    enum: ContainerEventType,
  })
  eventType: ContainerEventType;

  @ApiProperty({ description: 'Временная метка события' })
  @Column({ type: 'timestamp' })
  timestamp: Date;

  @ApiProperty({ description: 'Местоположение события', example: 'Gate A1' })
  @Column({ nullable: true })
  location: string;

  @ApiProperty({ description: 'Описание события' })
  @Column({ type: 'text', nullable: true })
  description: string;

  @ApiProperty({ description: 'ID пользователя, инициировавшего событие' })
  @Column({ name: 'user_id', nullable: true })
  userId: string;

  @ApiProperty({ description: 'ID оборудования, связанного с событием' })
  @Column({ name: 'equipment_id', nullable: true })
  equipmentId: string;

  @ApiProperty({ description: 'ID заявки, связанной с событием' })
  @Column({ name: 'order_id', nullable: true })
  orderId: string;

  @ApiProperty({ description: 'Источник события (система, оператор, автоматический)' })
  @Column({ default: 'manual' })
  source: string;

  @ApiProperty({ description: 'Дополнительные данные события' })
  @Column({ type: 'jsonb', nullable: true })
  data: Record<string, any>;

  @ApiProperty({ description: 'Координаты GPS (если доступны)' })
  @Column({ name: 'gps_coordinates', type: 'jsonb', nullable: true })
  gpsCoordinates: {
    latitude?: number;
    longitude?: number;
    accuracy?: number;
  };

  @ApiProperty({ description: 'Фотографии или документы, связанные с событием' })
  @Column({ type: 'jsonb', nullable: true })
  attachments: {
    fileId: string;
    fileName: string;
    fileType: string;
    fileSize: number;
  }[];

  @ApiProperty({ description: 'Статус обработки события' })
  @Column({ name: 'processing_status', default: 'completed' })
  processingStatus: string;

  @ApiProperty({ description: 'Сообщение об ошибке (если есть)' })
  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage: string;

  @ApiProperty({ description: 'Дата создания записи' })
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}