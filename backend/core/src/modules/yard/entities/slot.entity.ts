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
import { Zone } from './zone.entity';

export enum SlotStatus {
  AVAILABLE = 'available',
  OCCUPIED = 'occupied',
  RESERVED = 'reserved',
  BLOCKED = 'blocked',
  MAINTENANCE = 'maintenance',
  DAMAGED = 'damaged',
}

export enum SlotAccessibility {
  CRANE_ONLY = 'crane_only',
  REACH_STACKER = 'reach_stacker',
  FORKLIFT = 'forklift',
  TRUCK_ACCESSIBLE = 'truck_accessible',
  ALL_EQUIPMENT = 'all_equipment',
  NO_ACCESS = 'no_access',
}

@Entity('slots', { schema: 'yard' })
@Index(['slotAddress'], { unique: true })
@Index(['zoneId'])
@Index(['status'])
@Index(['accessibility'])
@Index(['position'], { spatial: true })
@Index(['rowNumber', 'columnNumber', 'tierNumber'])
export class Slot {
  @ApiProperty({ description: 'Уникальный идентификатор слота' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ description: 'Адрес слота', example: 'Y001-A01-R05-C12-T02' })
  @Column({ name: 'slot_address', type: 'varchar', length: 50, unique: true })
  slotAddress: string;

  @ApiProperty({ description: 'ID зоны' })
  @Column({ name: 'zone_id' })
  zoneId: string;

  @ApiProperty({ description: 'Зона', type: () => Zone })
  @ManyToOne(() => Zone, { eager: true })
  @JoinColumn({ name: 'zone_id' })
  zone: Zone;

  @ApiProperty({ description: 'Номер ряда' })
  @Column({ name: 'row_number' })
  rowNumber: number;

  @ApiProperty({ description: 'Буквенный индекс ряда' })
  @Column({ name: 'row_label', nullable: true })
  rowLabel: string;

  @ApiProperty({ description: 'Номер колонки' })
  @Column({ name: 'column_number' })
  columnNumber: number;

  @ApiProperty({ description: 'Буквенный индекс колонки' })
  @Column({ name: 'column_label', nullable: true })
  columnLabel: string;

  @ApiProperty({ description: 'Номер яруса/уровня' })
  @Column({ name: 'tier_number', default: 1 })
  tierNumber: number;

  @ApiProperty({ description: 'Статус слота', enum: SlotStatus })
  @Column({
    type: 'enum',
    enum: SlotStatus,
    default: SlotStatus.AVAILABLE,
  })
  status: SlotStatus;

  @ApiProperty({ description: 'Доступность для оборудования', enum: SlotAccessibility })
  @Column({
    type: 'enum',
    enum: SlotAccessibility,
    default: SlotAccessibility.ALL_EQUIPMENT,
  })
  accessibility: SlotAccessibility;

  @ApiProperty({ description: 'Позиция слота (точка)' })
  @Column({
    type: 'geometry',
    spatialFeatureType: 'Point',
    srid: 4326,
  })
  position: string;

  @ApiProperty({ description: 'Граница слота (полигон)' })
  @Column({
    name: 'slot_boundary',
    type: 'geometry',
    spatialFeatureType: 'Polygon',
    srid: 4326,
    nullable: true,
  })
  slotBoundary: string;

  @ApiProperty({ description: 'Физические размеры слота' })
  @Column({ type: 'jsonb' })
  dimensions: {
    length: number;
    width: number;
    height: number;
    unit: 'm' | 'ft';
    groundLevel: number;
    maxLoadHeight: number;
  };

  @ApiProperty({ description: 'Несущая способность' })
  @Column({ name: 'load_capacity', type: 'jsonb' })
  loadCapacity: {
    maxWeight: number;
    unit: 'kg' | 'lbs';
    distributedLoad: boolean;
    stackingLoad: number;
    groundPressure: number;
  };

  @ApiProperty({ description: 'Поверхность и фундамент' })
  @Column({ name: 'surface_info', type: 'jsonb' })
  surfaceInfo: {
    type: 'concrete' | 'asphalt' | 'gravel' | 'compacted_earth';
    condition: 'excellent' | 'good' | 'fair' | 'poor';
    levelness: number; // deviation in mm
    drainageQuality: 'excellent' | 'good' | 'poor' | 'none';
    lastInspection: Date;
  };

  @ApiProperty({ description: 'Ориентация слота' })
  @Column({ type: 'jsonb' })
  orientation: {
    bearing: number; // degrees from north
    facingDirection: 'north' | 'south' | 'east' | 'west' | 'northeast' | 'northwest' | 'southeast' | 'southwest';
    doorOrientation?: 'seaside' | 'landside' | 'crosswise';
  };

  @ApiProperty({ description: 'Соседние слоты' })
  @Column({ name: 'adjacent_slots', type: 'jsonb', nullable: true })
  adjacentSlots: {
    north?: string;
    south?: string;
    east?: string;
    west?: string;
    above?: string;
    below?: string;
  };

  @ApiProperty({ description: 'Оборудование для слота' })
  @Column({ name: 'equipment_access', type: 'jsonb', nullable: true })
  equipmentAccess: {
    reachStacker: {
      accessible: boolean;
      approachSide: 'front' | 'rear' | 'side' | 'any';
      clearanceRequired: number;
    };
    crane: {
      accessible: boolean;
      craneId?: string;
      spreadDistance: number;
      liftHeight: number;
    };
    forklift: {
      accessible: boolean;
      approachSide: 'front' | 'rear' | 'side';
      minimumAisle: number;
    };
    truck: {
      accessible: boolean;
      chassisType: '20ft' | '40ft' | 'multi';
      turningRadius: number;
    };
  };

  @ApiProperty({ description: 'Коммуникации' })
  @Column({ type: 'jsonb', nullable: true })
  utilities: {
    power: {
      available: boolean;
      voltage?: number;
      amperage?: number;
      plugType?: string;
      distanceToSource?: number;
    };
    dataConnection: {
      available: boolean;
      type?: 'ethernet' | 'wifi' | 'cellular';
      signalStrength?: number;
    };
    monitoring: {
      cameraId?: string;
      sensorIds?: string[];
      rfidReader?: boolean;
    };
  };

  @ApiProperty({ description: 'Экологические условия' })
  @Column({ name: 'environmental_conditions', type: 'jsonb', nullable: true })
  environmentalConditions: {
    exposure: 'sheltered' | 'semi_exposed' | 'fully_exposed';
    windExposure: 'low' | 'medium' | 'high';
    sunExposure: 'shaded' | 'partial' | 'full_sun';
    drainageQuality: 'excellent' | 'good' | 'poor';
    floodRisk: 'none' | 'low' | 'medium' | 'high';
    ambientConditions?: {
      temperatureRange: { min: number; max: number };
      humidityRange: { min: number; max: number };
    };
  };

  @ApiProperty({ description: 'Ограничения и правила' })
  @Column({ type: 'jsonb', nullable: true })
  restrictions: {
    containerTypes: {
      allowed: string[];
      prohibited: string[];
    };
    containerSizes: {
      allowed: string[];
      prohibited: string[];
    };
    cargoTypes: {
      allowed: string[];
      prohibited: string[];
    };
    hazmat: {
      allowedClasses: string[];
      segregationDistance: number;
      storageTime: number; // hours
    };
    weight: {
      maxSingleContainer: number;
      maxStackWeight: number;
      unit: 'kg' | 'lbs';
    };
    operational: {
      maxDwellTime: number; // hours
      priorityUse?: string;
      specialHandling?: string[];
    };
  };

  @ApiProperty({ description: 'Резервирование слота' })
  @Column({ name: 'reservation_info', type: 'jsonb', nullable: true })
  reservationInfo: {
    reservedFor?: string; // orderId or customerId
    reservationType: 'order' | 'customer' | 'equipment' | 'maintenance';
    reservedFrom: Date;
    reservedUntil: Date;
    priority: 'low' | 'medium' | 'high' | 'critical';
    notes?: string;
  };

  @ApiProperty({ description: 'История использования' })
  @Column({ name: 'usage_history', type: 'jsonb', nullable: true })
  usageHistory: {
    totalOccupations: number;
    totalDwellTime: number; // hours
    lastOccupied: Date;
    averageDwellTime: number; // hours
    peakUsagePeriods: Array<{
      from: Date;
      to: Date;
      utilizationRate: number;
    }>;
  };

  @ApiProperty({ description: 'Техническое обслуживание' })
  @Column({ name: 'maintenance_info', type: 'jsonb', nullable: true })
  maintenanceInfo: {
    lastInspection: Date;
    nextInspection: Date;
    condition: 'excellent' | 'good' | 'fair' | 'poor' | 'unsafe';
    maintenanceHistory: Array<{
      date: Date;
      type: 'inspection' | 'repair' | 'upgrade';
      description: string;
      cost?: number;
      duration?: number; // hours
    }>;
    requiredMaintenance?: Array<{
      priority: 'low' | 'medium' | 'high' | 'critical';
      description: string;
      estimatedCost: number;
      estimatedDuration: number;
    }>;
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