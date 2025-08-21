import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

export enum YardType {
  CONTAINER_YARD = 'container_yard',
  EMPTY_YARD = 'empty_yard',
  REEFER_YARD = 'reefer_yard',
  DANGEROUS_YARD = 'dangerous_yard',
  TRANSIT_YARD = 'transit_yard',
  REPAIR_YARD = 'repair_yard',
  CUSTOMS_YARD = 'customs_yard',
  QUARANTINE_YARD = 'quarantine_yard',
}

export enum YardStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  MAINTENANCE = 'maintenance',
  EMERGENCY_CLOSED = 'emergency_closed',
}

@Entity('yards', { schema: 'yard' })
@Index(['yardCode'], { unique: true })
@Index(['type'])
@Index(['status'])
@Index(['geometry'], { spatial: true })
export class Yard {
  @ApiProperty({ description: 'Уникальный идентификатор склада' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ description: 'Код склада', example: 'Y001' })
  @Column({ name: 'yard_code', type: 'varchar', length: 20, unique: true })
  yardCode: string;

  @ApiProperty({ description: 'Название склада' })
  @Column({ name: 'yard_name' })
  yardName: string;

  @ApiProperty({ description: 'Тип склада', enum: YardType })
  @Column({
    type: 'enum',
    enum: YardType,
  })
  type: YardType;

  @ApiProperty({ description: 'Статус склада', enum: YardStatus })
  @Column({
    type: 'enum',
    enum: YardStatus,
    default: YardStatus.ACTIVE,
  })
  status: YardStatus;

  @ApiProperty({ description: 'Описание склада' })
  @Column({ type: 'text', nullable: true })
  description: string;

  @ApiProperty({ description: 'Геометрия склада (полигон)' })
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
  @Column({ name: 'max_stack_height', default: 5 })
  maxStackHeight: number;

  @ApiProperty({ description: 'Размеры склада' })
  @Column({ type: 'jsonb' })
  dimensions: {
    length: number;
    width: number;
    unit: 'm' | 'ft';
    area: number;
  };

  @ApiProperty({ description: 'Поверхность склада' })
  @Column({ name: 'surface_type' })
  surfaceType: 'concrete' | 'asphalt' | 'gravel' | 'dirt' | 'other';

  @ApiProperty({ description: 'Дренаж' })
  @Column({ name: 'has_drainage', default: false })
  hasDrainage: boolean;

  @ApiProperty({ description: 'Освещение' })
  @Column({ name: 'has_lighting', default: true })
  hasLighting: boolean;

  @ApiProperty({ description: 'Электропитание для рефконтейнеров' })
  @Column({ name: 'reefer_plugs', default: 0 })
  reeferPlugs: number;

  @ApiProperty({ description: 'Система видеонаблюдения' })
  @Column({ name: 'has_cctv', default: false })
  hasCctv: boolean;

  @ApiProperty({ description: 'Система пожаротушения' })
  @Column({ name: 'fire_suppression_system', nullable: true })
  fireSuppressionSystem: string;

  @ApiProperty({ description: 'Ограничения доступа' })
  @Column({ name: 'access_restrictions', type: 'jsonb', nullable: true })
  accessRestrictions: {
    requiresPermission: boolean;
    authorizedPersonnel: string[];
    timeRestrictions?: {
      allowedHours: { from: string; to: string }[];
      excludedDays: string[];
    };
    equipmentRestrictions?: {
      allowedEquipment: string[];
      maxWeight: number;
    };
  };

  @ApiProperty({ description: 'Ограничения по типам грузов' })
  @Column({ name: 'cargo_restrictions', type: 'jsonb', nullable: true })
  cargoRestrictions: {
    allowedCargoTypes: string[];
    hazmatRestrictions?: {
      allowedClasses: string[];
      segregationRules: Record<string, string[]>;
    };
    temperatureControl?: {
      minTemperature: number;
      maxTemperature: number;
      unit: 'C' | 'F';
    };
  };

  @ApiProperty({ description: 'Операционные часы' })
  @Column({ name: 'operating_hours', type: 'jsonb' })
  operatingHours: {
    schedule: Array<{
      dayOfWeek: string;
      openTime: string;
      closeTime: string;
      is24Hours: boolean;
    }>;
    exceptions?: Array<{
      date: string;
      specialHours?: { openTime: string; closeTime: string };
      closed: boolean;
      reason: string;
    }>;
  };

  @ApiProperty({ description: 'Координаты точки доступа' })
  @Column({ name: 'access_point', type: 'point', nullable: true })
  accessPoint: string;

  @ApiProperty({ description: 'Зоны внутри склада' })
  @Column({ type: 'jsonb', nullable: true })
  zones: Array<{
    zoneId: string;
    zoneName: string;
    purpose: string;
    geometry: string;
    capacity: number;
    restrictions?: Record<string, any>;
  }>;

  @ApiProperty({ description: 'Оборудование склада' })
  @Column({ type: 'jsonb', nullable: true })
  equipment: {
    cranes?: Array<{
      craneId: string;
      type: string;
      capacity: number;
      coverage: string; // geometry
    }>;
    reach_stackers?: Array<{
      equipmentId: string;
      capacity: number;
      status: 'available' | 'busy' | 'maintenance';
    }>;
    forklifts?: Array<{
      equipmentId: string;
      capacity: number;
      status: 'available' | 'busy' | 'maintenance';
    }>;
    weighbridges?: Array<{
      weighbridgeId: string;
      capacity: number;
      accuracy: number;
      location: string; // point
    }>;
  };

  @ApiProperty({ description: 'Статистика производительности' })
  @Column({ name: 'performance_metrics', type: 'jsonb', nullable: true })
  performanceMetrics: {
    avgTurnaroundTime: number; // minutes
    throughputLastMonth: number;
    utilizationRate: number; // percentage
    lastUpdated: Date;
  };

  @ApiProperty({ description: 'Контакты менеджера' })
  @Column({ name: 'manager_contact', type: 'jsonb', nullable: true })
  managerContact: {
    name: string;
    phone: string;
    email: string;
    shiftSchedule?: Array<{
      dayOfWeek: string;
      startTime: string;
      endTime: string;
    }>;
  };

  @ApiProperty({ description: 'Планы эвакуации' })
  @Column({ name: 'emergency_procedures', type: 'jsonb', nullable: true })
  emergencyProcedures: {
    evacuationRoutes: Array<{
      routeId: string;
      description: string;
      geometry: string; // linestring
    }>;
    assemblyPoints: Array<{
      pointId: string;
      location: string; // point
      capacity: number;
    }>;
    emergencyContacts: Array<{
      service: string;
      phone: string;
      description: string;
    }>;
  };

  @ApiProperty({ description: 'Экологические характеристики' })
  @Column({ name: 'environmental_data', type: 'jsonb', nullable: true })
  environmentalData: {
    noiseLevel?: number; // dB
    airQuality?: {
      pm25: number;
      pm10: number;
      lastMeasured: Date;
    };
    soilCondition?: {
      contamination: boolean;
      testDate: Date;
      notes: string;
    };
    waterDrainage?: {
      runoffManagement: boolean;
      drainageCapacity: number; // liters per hour
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