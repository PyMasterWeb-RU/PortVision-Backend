import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

export enum TariffType {
  STORAGE = 'storage',
  HANDLING = 'handling',
  LOADING = 'loading',
  DISCHARGE = 'discharge',
  INSPECTION = 'inspection',
  WEIGHING = 'weighing',
  REEFER_MONITORING = 'reefer_monitoring',
  POWER_SUPPLY = 'power_supply',
  CLEANING = 'cleaning',
  REPAIR = 'repair',
  CUSTOMS_EXAMINATION = 'customs_examination',
  DOCUMENTATION = 'documentation',
  GATE_SERVICE = 'gate_service',
  PENALTY = 'penalty',
  OTHER = 'other',
}

export enum TariffUnit {
  PER_CONTAINER = 'per_container',
  PER_TEU = 'per_teu',
  PER_DAY = 'per_day',
  PER_HOUR = 'per_hour',
  PER_TON = 'per_ton',
  PER_CBM = 'per_cbm',
  PER_MOVE = 'per_move',
  PER_DOCUMENT = 'per_document',
  FIXED = 'fixed',
  PERCENTAGE = 'percentage',
}

@Entity('tariffs', { schema: 'core' })
@Index(['code'], { unique: true })
@Index(['type'])
@Index(['isActive'])
@Index(['validFrom', 'validUntil'])
export class Tariff {
  @ApiProperty({ description: 'Уникальный идентификатор тарифа' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ description: 'Код тарифа', example: 'STG-20DV-STD' })
  @Column({ type: 'varchar', length: 50, unique: true })
  code: string;

  @ApiProperty({ description: 'Наименование тарифа' })
  @Column()
  name: string;

  @ApiProperty({ description: 'Описание тарифа' })
  @Column({ type: 'text', nullable: true })
  description: string;

  @ApiProperty({ description: 'Тип тарифа', enum: TariffType })
  @Column({
    type: 'enum',
    enum: TariffType,
  })
  type: TariffType;

  @ApiProperty({ description: 'Единица измерения', enum: TariffUnit })
  @Column({
    type: 'enum',
    enum: TariffUnit,
  })
  unit: TariffUnit;

  @ApiProperty({ description: 'Базовая ставка' })
  @Column({ name: 'base_rate', type: 'decimal', precision: 12, scale: 2 })
  baseRate: number;

  @ApiProperty({ description: 'Валюта' })
  @Column({ length: 3, default: 'RUB' })
  currency: string;

  @ApiProperty({ description: 'НДС включен в стоимость' })
  @Column({ name: 'vat_included', default: true })
  vatIncluded: boolean;

  @ApiProperty({ description: 'Ставка НДС (%)' })
  @Column({ name: 'vat_rate', type: 'decimal', precision: 5, scale: 2, default: 20 })
  vatRate: number;

  @ApiProperty({ description: 'Минимальная стоимость' })
  @Column({ name: 'min_charge', type: 'decimal', precision: 12, scale: 2, nullable: true })
  minCharge: number;

  @ApiProperty({ description: 'Максимальная стоимость' })
  @Column({ name: 'max_charge', type: 'decimal', precision: 12, scale: 2, nullable: true })
  maxCharge: number;

  @ApiProperty({ description: 'Льготный период (дни/часы)' })
  @Column({ name: 'free_period', type: 'smallint', default: 0 })
  freePeriod: number;

  @ApiProperty({ description: 'Единица льготного периода' })
  @Column({ name: 'free_period_unit', default: 'days' })
  freePeriodUnit: string;

  @ApiProperty({ description: 'Прогрессивная шкала тарификации' })
  @Column({ name: 'progressive_rates', type: 'jsonb', nullable: true })
  progressiveRates: {
    fromPeriod: number;
    toPeriod: number;
    rate: number;
  }[];

  @ApiProperty({ description: 'Применимые типы контейнеров' })
  @Column({ name: 'container_types', type: 'jsonb', nullable: true })
  containerTypes: string[];

  @ApiProperty({ description: 'Применимые типы клиентов' })
  @Column({ name: 'client_types', type: 'jsonb', nullable: true })
  clientTypes: string[];

  @ApiProperty({ description: 'Дата начала действия' })
  @Column({ name: 'valid_from', type: 'date' })
  validFrom: Date;

  @ApiProperty({ description: 'Дата окончания действия' })
  @Column({ name: 'valid_until', type: 'date', nullable: true })
  validUntil: Date;

  @ApiProperty({ description: 'Приоритет тарифа (чем выше, тем приоритетнее)' })
  @Column({ type: 'smallint', default: 0 })
  priority: number;

  @ApiProperty({ description: 'Автоматическое применение тарифа' })
  @Column({ name: 'auto_apply', default: true })
  autoApply: boolean;

  @ApiProperty({ description: 'Требует подтверждения перед применением' })
  @Column({ name: 'requires_approval', default: false })
  requiresApproval: boolean;

  @ApiProperty({ description: 'Условия применения тарифа' })
  @Column({ type: 'jsonb', nullable: true })
  conditions: {
    minWeight?: number;
    maxWeight?: number;
    minVolume?: number;
    maxVolume?: number;
    timeOfDay?: string[];
    dayOfWeek?: string[];
    specialConditions?: string[];
  };

  @ApiProperty({ description: 'Дополнительные параметры' })
  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @ApiProperty({ description: 'Активен ли тариф' })
  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @ApiProperty({ description: 'Дата создания' })
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ApiProperty({ description: 'Дата обновления' })
  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}