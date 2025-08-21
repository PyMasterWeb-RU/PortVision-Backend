import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { Client } from './client.entity';
import { ContainerType } from './container-type.entity';
import { ContainerEvent } from './container-event.entity';

export enum ContainerStatus {
  EMPTY = 'empty',
  LOADED = 'loaded',
  IN_TRANSIT = 'in_transit',
  AT_TERMINAL = 'at_terminal',
  DELIVERED = 'delivered',
  DAMAGED = 'damaged',
  ON_REPAIR = 'on_repair',
}

export enum ContainerCondition {
  EXCELLENT = 'excellent',
  GOOD = 'good',
  FAIR = 'fair',
  POOR = 'poor',
  DAMAGED = 'damaged',
}

@Entity('containers', { schema: 'core' })
@Index(['number'], { unique: true })
@Index(['status'])
@Index(['currentLocation'])
@Index(['clientId'])
export class Container {
  @ApiProperty({ description: 'Уникальный идентификатор контейнера' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ description: 'Номер контейнера (ISO стандарт)', example: 'MSKU9070420' })
  @Column({ type: 'varchar', length: 11, unique: true })
  @Index()
  number: string;

  @ApiProperty({ description: 'Статус контейнера', enum: ContainerStatus })
  @Column({
    type: 'enum',
    enum: ContainerStatus,
    default: ContainerStatus.EMPTY,
  })
  status: ContainerStatus;

  @ApiProperty({ description: 'Состояние контейнера', enum: ContainerCondition })
  @Column({
    type: 'enum',
    enum: ContainerCondition,
    default: ContainerCondition.GOOD,
  })
  condition: ContainerCondition;

  @ApiProperty({ description: 'ID типа контейнера' })
  @Column({ name: 'container_type_id' })
  containerTypeId: string;

  @ApiProperty({ description: 'Тип контейнера', type: () => ContainerType })
  @ManyToOne(() => ContainerType, { eager: true })
  @JoinColumn({ name: 'container_type_id' })
  containerType: ContainerType;

  @ApiProperty({ description: 'ID клиента-владельца' })
  @Column({ name: 'client_id', nullable: true })
  clientId: string;

  @ApiProperty({ description: 'Клиент-владелец', type: () => Client })
  @ManyToOne(() => Client, (client) => client.containers, { eager: true })
  @JoinColumn({ name: 'client_id' })
  client: Client;

  @ApiProperty({ description: 'Текущее местоположение', example: 'A-01-02-01' })
  @Column({ name: 'current_location', nullable: true })
  currentLocation: string;

  @ApiProperty({ description: 'Предыдущее местоположение' })
  @Column({ name: 'previous_location', nullable: true })
  previousLocation: string;

  @ApiProperty({ description: 'Вес тары (кг)', example: 2200 })
  @Column({ name: 'tare_weight', type: 'decimal', precision: 8, scale: 2 })
  tareWeight: number;

  @ApiProperty({ description: 'Максимальный вес груза (кг)', example: 28280 })
  @Column({ name: 'max_gross_weight', type: 'decimal', precision: 8, scale: 2 })
  maxGrossWeight: number;

  @ApiProperty({ description: 'Текущий вес груза (кг)' })
  @Column({ name: 'current_gross_weight', type: 'decimal', precision: 8, scale: 2, nullable: true })
  currentGrossWeight: number;

  @ApiProperty({ description: 'Дата последнего осмотра' })
  @Column({ name: 'last_inspection_date', type: 'timestamp', nullable: true })
  lastInspectionDate: Date;

  @ApiProperty({ description: 'Дата последнего ремонта' })
  @Column({ name: 'last_repair_date', type: 'timestamp', nullable: true })
  lastRepairDate: Date;

  @ApiProperty({ description: 'Дата следующего обязательного осмотра' })
  @Column({ name: 'next_inspection_due', type: 'timestamp', nullable: true })
  nextInspectionDue: Date;

  @ApiProperty({ description: 'Сертификат CSC действителен до' })
  @Column({ name: 'csc_valid_until', type: 'timestamp', nullable: true })
  cscValidUntil: Date;

  @ApiProperty({ description: 'Дополнительная информация' })
  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @ApiProperty({ description: 'Активен ли контейнер' })
  @Column({ default: true })
  isActive: boolean;

  @ApiProperty({ description: 'События контейнера', type: () => [ContainerEvent] })
  @OneToMany(() => ContainerEvent, (event) => event.container)
  events: ContainerEvent[];

  @ApiProperty({ description: 'Дата создания' })
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ApiProperty({ description: 'Дата обновления' })
  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}