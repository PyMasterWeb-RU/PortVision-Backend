import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { Container } from './container.entity';

export enum ContainerCategory {
  DRY = 'dry',
  REEFER = 'reefer',
  TANK = 'tank',
  FLAT_RACK = 'flat_rack',
  OPEN_TOP = 'open_top',
  PLATFORM = 'platform',
  BULK = 'bulk',
}

@Entity('container_types', { schema: 'core' })
@Index(['code'], { unique: true })
@Index(['isoCode'], { unique: true })
export class ContainerType {
  @ApiProperty({ description: 'Уникальный идентификатор типа контейнера' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ description: 'Код типа контейнера', example: '20DV' })
  @Column({ type: 'varchar', length: 10, unique: true })
  code: string;

  @ApiProperty({ description: 'ISO код', example: '22G1' })
  @Column({ name: 'iso_code', type: 'varchar', length: 4, unique: true })
  isoCode: string;

  @ApiProperty({ description: 'Наименование типа' })
  @Column()
  name: string;

  @ApiProperty({ description: 'Описание типа контейнера' })
  @Column({ type: 'text', nullable: true })
  description: string;

  @ApiProperty({ description: 'Категория контейнера', enum: ContainerCategory })
  @Column({
    type: 'enum',
    enum: ContainerCategory,
    default: ContainerCategory.DRY,
  })
  category: ContainerCategory;

  @ApiProperty({ description: 'Длина (футы)', example: 20 })
  @Column({ name: 'length_ft', type: 'smallint' })
  lengthFt: number;

  @ApiProperty({ description: 'Ширина (футы)', example: 8 })
  @Column({ name: 'width_ft', type: 'smallint' })
  widthFt: number;

  @ApiProperty({ description: 'Высота (футы)', example: 8.5 })
  @Column({ name: 'height_ft', type: 'decimal', precision: 3, scale: 1 })
  heightFt: number;

  @ApiProperty({ description: 'Длина (мм)', example: 6058 })
  @Column({ name: 'length_mm', type: 'integer' })
  lengthMm: number;

  @ApiProperty({ description: 'Ширина (мм)', example: 2438 })
  @Column({ name: 'width_mm', type: 'integer' })
  widthMm: number;

  @ApiProperty({ description: 'Высота (мм)', example: 2591 })
  @Column({ name: 'height_mm', type: 'integer' })
  heightMm: number;

  @ApiProperty({ description: 'Внутренняя длина (мм)', example: 5919 })
  @Column({ name: 'internal_length_mm', type: 'integer' })
  internalLengthMm: number;

  @ApiProperty({ description: 'Внутренняя ширина (мм)', example: 2340 })
  @Column({ name: 'internal_width_mm', type: 'integer' })
  internalWidthMm: number;

  @ApiProperty({ description: 'Внутренняя высота (мм)', example: 2385 })
  @Column({ name: 'internal_height_mm', type: 'integer' })
  internalHeightMm: number;

  @ApiProperty({ description: 'Объем (куб.м)', example: 33.1 })
  @Column({ name: 'volume_cbm', type: 'decimal', precision: 6, scale: 2 })
  volumeCbm: number;

  @ApiProperty({ description: 'Вес тары (кг)', example: 2200 })
  @Column({ name: 'tare_weight_kg', type: 'integer' })
  tareWeightKg: number;

  @ApiProperty({ description: 'Максимальный полный вес (кг)', example: 30480 })
  @Column({ name: 'max_gross_weight_kg', type: 'integer' })
  maxGrossWeightKg: number;

  @ApiProperty({ description: 'Максимальный вес груза (кг)', example: 28280 })
  @Column({ name: 'max_payload_kg', type: 'integer' })
  maxPayloadKg: number;

  @ApiProperty({ description: 'Минимальная температура (для рефрижераторов)' })
  @Column({ name: 'min_temperature', type: 'smallint', nullable: true })
  minTemperature: number;

  @ApiProperty({ description: 'Максимальная температура (для рефрижераторов)' })
  @Column({ name: 'max_temperature', type: 'smallint', nullable: true })
  maxTemperature: number;

  @ApiProperty({ description: 'Требуется электропитание' })
  @Column({ name: 'requires_power', default: false })
  requiresPower: boolean;

  @ApiProperty({ description: 'Коэффициент TEU', example: 1 })
  @Column({ name: 'teu_factor', type: 'decimal', precision: 3, scale: 1, default: 1.0 })
  teuFactor: number;

  @ApiProperty({ description: 'Активен ли тип' })
  @Column({ default: true })
  isActive: boolean;

  @ApiProperty({ description: 'Контейнеры данного типа', type: () => [Container] })
  @OneToMany(() => Container, (container) => container.containerType)
  containers: Container[];

  @ApiProperty({ description: 'Дата создания' })
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ApiProperty({ description: 'Дата обновления' })
  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}