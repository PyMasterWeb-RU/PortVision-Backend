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
import { Yard } from './yard.entity';

export enum ZoneType {
  IMPORT = 'import',
  EXPORT = 'export',
  TRANSIT = 'transit',
  EMPTY = 'empty',
  REEFER = 'reefer',
  DANGEROUS = 'dangerous',
  OVERSIZED = 'oversized',
  QUARANTINE = 'quarantine',
  CUSTOMS = 'customs',
  REPAIR = 'repair',
  BLOCKED = 'blocked',
}

export enum ZoneStatus {
  AVAILABLE = 'available',
  FULL = 'full',
  RESERVED = 'reserved',
  MAINTENANCE = 'maintenance',
  BLOCKED = 'blocked',
  EMERGENCY = 'emergency',
}

@Entity('zones', { schema: 'yard' })
@Index(['zoneCode'], { unique: true })
@Index(['yardId'])
@Index(['type'])
@Index(['status'])
@Index(['geometry'], { spatial: true })
export class Zone {
  @ApiProperty({ description: 'Уникальный идентификатор зоны' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ description: 'Код зоны', example: 'Y001-A01' })
  @Column({ name: 'zone_code', type: 'varchar', length: 30, unique: true })
  zoneCode: string;

  @ApiProperty({ description: 'Название зоны' })
  @Column({ name: 'zone_name' })
  zoneName: string;

  @ApiProperty({ description: 'ID склада' })
  @Column({ name: 'yard_id' })
  yardId: string;

  @ApiProperty({ description: 'Склад', type: () => Yard })
  @ManyToOne(() => Yard, { eager: true })
  @JoinColumn({ name: 'yard_id' })
  yard: Yard;

  @ApiProperty({ description: 'Тип зоны', enum: ZoneType })
  @Column({
    type: 'enum',
    enum: ZoneType,
  })
  type: ZoneType;

  @ApiProperty({ description: 'Статус зоны', enum: ZoneStatus })
  @Column({
    type: 'enum',
    enum: ZoneStatus,
    default: ZoneStatus.AVAILABLE,
  })
  status: ZoneStatus;

  @ApiProperty({ description: 'Описание зоны' })
  @Column({ type: 'text', nullable: true })
  description: string;

  @ApiProperty({ description: 'Геометрия зоны (полигон)' })
  @Column({
    type: 'geometry',
    spatialFeatureType: 'Polygon',
    srid: 4326,
  })
  geometry: string;

  @ApiProperty({ description: 'Максимальная вместимость (контейнеры)' })
  @Column({ name: 'max_capacity' })
  maxCapacity: number;

  @ApiProperty({ description: 'Текущая заполненность' })
  @Column({ name: 'current_occupancy', default: 0 })
  currentOccupancy: number;

  @ApiProperty({ description: 'Максимальная высота штабелирования' })
  @Column({ name: 'max_stack_height', default: 3 })
  maxStackHeight: number;

  @ApiProperty({ description: 'Размеры зоны' })
  @Column({ type: 'jsonb' })
  dimensions: {
    length: number;
    width: number;
    height?: number;
    unit: 'm' | 'ft';
    area: number;
  };

  @ApiProperty({ description: 'Сетка адресации' })
  @Column({ name: 'address_grid', type: 'jsonb' })
  addressGrid: {
    rows: number;
    columns: number;
    tiers: number;
    slotSize: {
      length: number;
      width: number;
      unit: 'm' | 'ft';
    };
    indexingScheme: 'alphanumeric' | 'numeric' | 'custom';
    customScheme?: {
      rowLabels: string[];
      columnLabels: string[];
      tierLabels: string[];
    };
  };

  @ApiProperty({ description: 'Правила размещения' })
  @Column({ name: 'placement_rules', type: 'jsonb', nullable: true })
  placementRules: {
    allowedContainerTypes: string[];
    allowedContainerSizes: string[];
    segregationRules?: {
      incompatibleWith: string[];
      requiredDistance: number;
      unit: 'm' | 'ft';
    };
    weightRestrictions?: {
      maxWeightPerSlot: number;
      maxWeightPerTier: number;
      unit: 'kg' | 'lbs';
    };
    hazmatRules?: {
      allowedClasses: string[];
      storageRequirements: string[];
      emergencyProcedures: string[];
    };
  };

  @ApiProperty({ description: 'Оборудование зоны' })
  @Column({ type: 'jsonb', nullable: true })
  equipment: {
    cranes?: Array<{
      craneId: string;
      coverage: string; // geometry polygon
      capacity: number;
      reachRows: number[];
      reachColumns: number[];
    }>;
    reeferPlugs?: Array<{
      plugId: string;
      location: string; // point
      power: number; // kW
      voltage: number;
      status: 'available' | 'occupied' | 'maintenance';
    }>;
    lighting?: {
      type: 'led' | 'halogen' | 'sodium';
      coverage: string; // geometry
      illuminationLevel: number; // lux
      operatingHours: string;
    };
    monitoring?: {
      cameras: Array<{
        cameraId: string;
        location: string; // point
        viewAngle: number;
        resolution: string;
      }>;
      sensors: Array<{
        sensorId: string;
        type: 'temperature' | 'humidity' | 'motion' | 'weight';
        location: string; // point
        calibrationDate: Date;
      }>;
    };
  };

  @ApiProperty({ description: 'Доступность для оборудования' })
  @Column({ name: 'equipment_access', type: 'jsonb' })
  equipmentAccess: {
    reachStacker: boolean;
    forklift: boolean;
    crane: boolean;
    truck: boolean;
    accessRoutes: Array<{
      equipmentType: string;
      geometry: string; // linestring
      restrictions?: string[];
    }>;
  };

  @ApiProperty({ description: 'Климатические условия' })
  @Column({ name: 'climate_control', type: 'jsonb', nullable: true })
  climateControl: {
    temperatureRange?: {
      min: number;
      max: number;
      unit: 'C' | 'F';
    };
    humidityControl?: {
      min: number;
      max: number;
      unit: '%';
    };
    ventilation?: {
      type: 'natural' | 'forced' | 'hvac';
      airChangesPerHour?: number;
    };
    weatherProtection?: {
      roofed: boolean;
      windscreens: boolean;
      drainage: boolean;
    };
  };

  @ApiProperty({ description: 'Ограничения доступа' })
  @Column({ name: 'access_restrictions', type: 'jsonb', nullable: true })
  accessRestrictions: {
    requiresPermission: boolean;
    authorizedPersonnel: string[];
    authorizedEquipment: string[];
    timeRestrictions?: {
      allowedHours: { from: string; to: string }[];
      excludedDays: string[];
    };
    safetyRequirements?: string[];
  };

  @ApiProperty({ description: 'Планировка и навигация' })
  @Column({ type: 'jsonb', nullable: true })
  layout: {
    referencePoints: Array<{
      pointId: string;
      description: string;
      location: string; // point
      visible: boolean;
    }>;
    navigationMarkers: Array<{
      markerId: string;
      type: 'ground' | 'post' | 'paint' | 'digital';
      location: string; // point
      content: string;
    }>;
    drivingLanes: Array<{
      laneId: string;
      geometry: string; // linestring
      direction: 'one_way' | 'two_way';
      maxSpeed: number;
      allowedVehicles: string[];
    }>;
  };

  @ApiProperty({ description: 'Статистика производительности' })
  @Column({ name: 'performance_metrics', type: 'jsonb', nullable: true })
  performanceMetrics: {
    avgDwellTime: number; // hours
    turnoverRate: number; // containers per day
    utilizationRate: number; // percentage
    lastCalculated: Date;
    historicalData?: Array<{
      date: Date;
      occupancy: number;
      throughput: number;
    }>;
  };

  @ApiProperty({ description: 'Техническое обслуживание' })
  @Column({ type: 'jsonb', nullable: true })
  maintenance: {
    lastInspection: Date;
    nextScheduledMaintenance: Date;
    maintenanceHistory: Array<{
      date: Date;
      type: 'routine' | 'repair' | 'upgrade';
      description: string;
      duration: number; // hours
      cost?: number;
    }>;
    requiredMaintenance?: Array<{
      type: string;
      priority: 'low' | 'medium' | 'high' | 'critical';
      description: string;
      estimatedCost: number;
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