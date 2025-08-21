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
import { Container } from '../../common/entities/container.entity';
import { ContainerType } from '../../common/entities/container-type.entity';

export enum ItemStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

@Entity('order_items', { schema: 'orders' })
@Index(['orderId'])
@Index(['containerId'])
@Index(['containerNumber'])
@Index(['status'])
export class OrderItem {
  @ApiProperty({ description: 'Уникальный идентификатор позиции' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ description: 'ID заявки' })
  @Column({ name: 'order_id' })
  orderId: string;

  @ApiProperty({ description: 'Заявка', type: () => Order })
  @ManyToOne(() => Order, (order) => order.items)
  @JoinColumn({ name: 'order_id' })
  order: Order;

  @ApiProperty({ description: 'Номер позиции в заявке' })
  @Column({ name: 'line_number', type: 'smallint' })
  lineNumber: number;

  @ApiProperty({ description: 'ID контейнера (если уже определен)' })
  @Column({ name: 'container_id', nullable: true })
  containerId: string;

  @ApiProperty({ description: 'Контейнер', type: () => Container })
  @ManyToOne(() => Container, { eager: true })
  @JoinColumn({ name: 'container_id' })
  container: Container;

  @ApiProperty({ description: 'Номер контейнера (может быть указан без привязки к Container)' })
  @Column({ name: 'container_number', nullable: true })
  containerNumber: string;

  @ApiProperty({ description: 'ID типа контейнера' })
  @Column({ name: 'container_type_id' })
  containerTypeId: string;

  @ApiProperty({ description: 'Тип контейнера', type: () => ContainerType })
  @ManyToOne(() => ContainerType, { eager: true })
  @JoinColumn({ name: 'container_type_id' })
  containerType: ContainerType;

  @ApiProperty({ description: 'Статус позиции', enum: ItemStatus })
  @Column({
    type: 'enum',
    enum: ItemStatus,
    default: ItemStatus.PENDING,
  })
  status: ItemStatus;

  @ApiProperty({ description: 'Количество контейнеров (для типовых заявок)' })
  @Column({ type: 'smallint', default: 1 })
  quantity: number;

  @ApiProperty({ description: 'Описание груза' })
  @Column({ name: 'cargo_description', type: 'text', nullable: true })
  cargoDescription: string;

  @ApiProperty({ description: 'Вес груза (кг)' })
  @Column({ name: 'cargo_weight', type: 'decimal', precision: 10, scale: 2, nullable: true })
  cargoWeight: number;

  @ApiProperty({ description: 'Объем груза (куб.м)' })
  @Column({ name: 'cargo_volume', type: 'decimal', precision: 8, scale: 3, nullable: true })
  cargoVolume: number;

  @ApiProperty({ description: 'Стоимость груза' })
  @Column({ name: 'cargo_value', type: 'decimal', precision: 12, scale: 2, nullable: true })
  cargoValue: number;

  @ApiProperty({ description: 'Валюта стоимости груза' })
  @Column({ name: 'cargo_currency', length: 3, nullable: true })
  cargoCurrency: string;

  @ApiProperty({ description: 'Класс опасности (для опасных грузов)' })
  @Column({ name: 'hazard_class', nullable: true })
  hazardClass: string;

  @ApiProperty({ description: 'UN номер (для опасных грузов)' })
  @Column({ name: 'un_number', nullable: true })
  unNumber: string;

  @ApiProperty({ description: 'Температурный режим' })
  @Column({ name: 'temperature_setting', type: 'smallint', nullable: true })
  temperatureSetting: number;

  @ApiProperty({ description: 'Особые инструкции по позиции' })
  @Column({ name: 'special_instructions', type: 'text', nullable: true })
  specialInstructions: string;

  @ApiProperty({ description: 'Сертификаты и документы' })
  @Column({ type: 'jsonb', nullable: true })
  certificates: {
    phytosanitaryCertificate?: string;
    veterinaryCertificate?: string;
    originCertificate?: string;
    qualityCertificate?: string;
    other?: { name: string; number: string }[];
  };

  @ApiProperty({ description: 'Таможенные данные позиции' })
  @Column({ name: 'customs_info', type: 'jsonb', nullable: true })
  customsInfo: {
    hsCode?: string;
    customsValue?: number;
    customsValueCurrency?: string;
    countryOfOrigin?: string;
    manufacturer?: string;
  };

  @ApiProperty({ description: 'Планируемая дата обработки' })
  @Column({ name: 'planned_date', type: 'timestamp', nullable: true })
  plannedDate: Date;

  @ApiProperty({ description: 'Фактическая дата обработки' })
  @Column({ name: 'actual_date', type: 'timestamp', nullable: true })
  actualDate: Date;

  @ApiProperty({ description: 'Местоположение назначения на терминале' })
  @Column({ name: 'destination_location', nullable: true })
  destinationLocation: string;

  @ApiProperty({ description: 'Примечания по позиции' })
  @Column({ type: 'text', nullable: true })
  notes: string;

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