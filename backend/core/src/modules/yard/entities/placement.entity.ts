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
import { Container } from '../../common/entities/container.entity';
import { Slot } from './slot.entity';
import { Zone } from './zone.entity';

export enum PlacementStatus {
  ACTIVE = 'active',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  TEMPORARY = 'temporary',
  DISPUTED = 'disputed',
}

export enum PlacementType {
  STORAGE = 'storage',
  TRANSIT = 'transit',
  QUARANTINE = 'quarantine',
  CUSTOMS_HOLD = 'customs_hold',
  REPAIR = 'repair',
  INSPECTION = 'inspection',
  LOADING_PREP = 'loading_prep',
  DANGEROUS_GOODS = 'dangerous_goods',
}

export enum PlacementMethod {
  CRANE = 'crane',
  REACH_STACKER = 'reach_stacker',
  FORKLIFT = 'forklift',
  TRUCK_MOUNTED = 'truck_mounted',
  MANUAL = 'manual',
  OTHER = 'other',
}

@Entity('placements', { schema: 'yard' })
@Index(['containerId'])
@Index(['slotId'])
@Index(['zoneId'])
@Index(['status'])
@Index(['type'])
@Index(['placedAt'])
@Index(['plannedRemovalAt'])
export class Placement {
  @ApiProperty({ description: 'Уникальный идентификатор размещения' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ description: 'ID контейнера' })
  @Column({ name: 'container_id' })
  containerId: string;

  @ApiProperty({ description: 'Контейнер', type: () => Container })
  @ManyToOne(() => Container, { eager: true })
  @JoinColumn({ name: 'container_id' })
  container: Container;

  @ApiProperty({ description: 'ID слота' })
  @Column({ name: 'slot_id' })
  slotId: string;

  @ApiProperty({ description: 'Слот', type: () => Slot })
  @ManyToOne(() => Slot, { eager: true })
  @JoinColumn({ name: 'slot_id' })
  slot: Slot;

  @ApiProperty({ description: 'ID зоны' })
  @Column({ name: 'zone_id' })
  zoneId: string;

  @ApiProperty({ description: 'Зона', type: () => Zone })
  @ManyToOne(() => Zone, { eager: true })
  @JoinColumn({ name: 'zone_id' })
  zone: Zone;

  @ApiProperty({ description: 'Статус размещения', enum: PlacementStatus })
  @Column({
    type: 'enum',
    enum: PlacementStatus,
    default: PlacementStatus.ACTIVE,
  })
  status: PlacementStatus;

  @ApiProperty({ description: 'Тип размещения', enum: PlacementType })
  @Column({
    type: 'enum',
    enum: PlacementType,
    default: PlacementType.STORAGE,
  })
  type: PlacementType;

  @ApiProperty({ description: 'Способ размещения', enum: PlacementMethod })
  @Column({
    name: 'placement_method',
    type: 'enum',
    enum: PlacementMethod,
  })
  placementMethod: PlacementMethod;

  @ApiProperty({ description: 'Время размещения' })
  @Column({ name: 'placed_at', type: 'timestamp' })
  placedAt: Date;

  @ApiProperty({ description: 'Планируемое время изъятия' })
  @Column({ name: 'planned_removal_at', type: 'timestamp', nullable: true })
  plannedRemovalAt: Date;

  @ApiProperty({ description: 'Фактическое время изъятия' })
  @Column({ name: 'actual_removal_at', type: 'timestamp', nullable: true })
  actualRemovalAt: Date;

  @ApiProperty({ description: 'Высота штабелирования (уровень)' })
  @Column({ name: 'stack_level', default: 1 })
  stackLevel: number;

  @ApiProperty({ description: 'Максимальный уровень штабелирования' })
  @Column({ name: 'max_stack_level', default: 1 })
  maxStackLevel: number;

  @ApiProperty({ description: 'Позиция в стеке' })
  @Column({ name: 'stack_position', type: 'jsonb' })
  stackPosition: {
    level: number;
    isBottom: boolean;
    isTop: boolean;
    hasContainersAbove: boolean;
    hasContainersBelow: boolean;
    stackHeight: number; // total stack height
  };

  @ApiProperty({ description: 'Ориентация контейнера' })
  @Column({ type: 'jsonb' })
  orientation: {
    bearing: number; // degrees from north
    doorDirection: 'north' | 'south' | 'east' | 'west';
    isReversed: boolean;
    sideAccess: 'left' | 'right' | 'both' | 'none';
  };

  @ApiProperty({ description: 'Данные о размещении' })
  @Column({ name: 'placement_data', type: 'jsonb' })
  placementData: {
    operatorId: string;
    operatorName: string;
    equipmentId?: string;
    equipmentType: string;
    duration: number; // seconds
    accuracy: 'precise' | 'approximate' | 'estimated';
    verificationMethod: 'visual' | 'rfid' | 'barcode' | 'gps' | 'manual';
    conditions: {
      weather: string;
      visibility: 'excellent' | 'good' | 'poor';
      groundCondition: 'dry' | 'wet' | 'muddy' | 'icy';
    };
  };

  @ApiProperty({ description: 'Физическое состояние при размещении' })
  @Column({ name: 'physical_condition', type: 'jsonb' })
  physicalCondition: {
    weight: {
      gross: number;
      tare: number;
      net: number;
      unit: 'kg' | 'lbs';
      verified: boolean;
    };
    dimensions: {
      length: number;
      width: number;
      height: number;
      unit: 'm' | 'ft';
    };
    condition: 'excellent' | 'good' | 'damaged' | 'needs_inspection';
    damageNotes?: string;
    sealCondition?: 'intact' | 'broken' | 'missing';
    sealNumbers?: string[];
  };

  @ApiProperty({ description: 'Ограничения доступа' })
  @Column({ name: 'access_restrictions', type: 'jsonb', nullable: true })
  accessRestrictions: {
    requiresAuthorization: boolean;
    authorizedPersonnel: string[];
    accessReasons: string[];
    timeRestrictions?: {
      allowedHours: { from: string; to: string }[];
      excludedDays: string[];
    };
    safetyRequirements?: string[];
    equipmentRestrictions?: string[];
  };

  @ApiProperty({ description: 'Груз и документы' })
  @Column({ name: 'cargo_information', type: 'jsonb', nullable: true })
  cargoInformation: {
    cargoType?: string;
    cargoDescription?: string;
    manifestNumber?: string;
    billOfLadingNumber?: string;
    sealNumbers?: string[];
    customsStatus?: 'cleared' | 'pending' | 'hold' | 'examination';
    hazmatClass?: string;
    temperatureControlled?: boolean;
    targetTemperature?: number;
    temperatureUnit?: 'C' | 'F';
  };

  @ApiProperty({ description: 'Движения и перестановки' })
  @Column({ type: 'jsonb', nullable: true })
  movements: Array<{
    movementId: string;
    timestamp: Date;
    fromPosition?: {
      slotId: string;
      coordinates: string;
    };
    toPosition: {
      slotId: string;
      coordinates: string;
    };
    reason: string;
    operatorId: string;
    equipmentId: string;
    duration: number; // seconds
  }>;

  @ApiProperty({ description: 'Мониторинг и контроль' })
  @Column({ type: 'jsonb', nullable: true })
  monitoring: {
    lastInspection: Date;
    inspectionNotes?: string;
    surveillanceLevel: 'none' | 'periodic' | 'continuous';
    alertsEnabled: boolean;
    temperatureMonitored: boolean;
    currentTemperature?: number;
    temperatureHistory?: Array<{
      timestamp: Date;
      temperature: number;
      alert?: boolean;
    }>;
    securityEvents?: Array<{
      timestamp: Date;
      type: string;
      description: string;
      severity: 'low' | 'medium' | 'high';
    }>;
  };

  @ApiProperty({ description: 'Финансовая информация' })
  @Column({ name: 'financial_data', type: 'jsonb', nullable: true })
  financialData: {
    storageCharges: {
      dailyRate: number;
      currency: string;
      chargedDays: number;
      totalCharge: number;
    };
    additionalCharges?: Array<{
      type: string;
      description: string;
      amount: number;
      currency: string;
      date: Date;
    }>;
    demurrageCharges?: {
      dailyRate: number;
      freeTime: number; // days
      chargeableDays: number;
      totalCharge: number;
    };
  };

  @ApiProperty({ description: 'Планирование и прогнозы' })
  @Column({ type: 'jsonb', nullable: true })
  planning: {
    dwellTimeEstimate: number; // hours
    removalPriority: 'low' | 'medium' | 'high' | 'urgent';
    nextPlannedOperation?: {
      type: 'inspection' | 'loading' | 'relocation' | 'repair';
      scheduledFor: Date;
      estimatedDuration: number;
    };
    dependentOperations?: Array<{
      operationType: string;
      dependsOn: string[];
      prerequisites: string[];
    }>;
  };

  @ApiProperty({ description: 'Причина изъятия (если завершено)' })
  @Column({ name: 'removal_reason', nullable: true })
  removalReason: string;

  @ApiProperty({ description: 'Данные об изъятии' })
  @Column({ name: 'removal_data', type: 'jsonb', nullable: true })
  removalData: {
    operatorId: string;
    operatorName: string;
    equipmentId: string;
    equipmentType: string;
    duration: number; // seconds
    destination?: {
      type: 'gate' | 'vessel' | 'rail' | 'other_zone';
      location: string;
    };
    finalCondition?: {
      condition: string;
      damageReport?: string;
      photos?: string[];
    };
  };

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