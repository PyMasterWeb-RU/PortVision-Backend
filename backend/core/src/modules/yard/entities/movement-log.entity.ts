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
import { Container } from '../../common/entities/container.entity';
import { Placement } from './placement.entity';

export enum MovementType {
  GATE_IN = 'gate_in',
  GATE_OUT = 'gate_out',
  YARD_TO_YARD = 'yard_to_yard',
  ZONE_TO_ZONE = 'zone_to_zone',
  SLOT_TO_SLOT = 'slot_to_slot',
  RESTOW = 'restow',
  INSPECTION = 'inspection',
  WEIGHING = 'weighing',
  REPAIR = 'repair',
  VESSEL_LOADING = 'vessel_loading',
  VESSEL_DISCHARGE = 'vessel_discharge',
  RAIL_LOADING = 'rail_loading',
  RAIL_DISCHARGE = 'rail_discharge',
  TRUCK_LOADING = 'truck_loading',
  TRUCK_DISCHARGE = 'truck_discharge',
}

export enum MovementStatus {
  PLANNED = 'planned',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  FAILED = 'failed',
  SUSPENDED = 'suspended',
}

export enum MovementPriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  URGENT = 'urgent',
  EMERGENCY = 'emergency',
}

@Entity('movement_logs', { schema: 'yard' })
@Index(['containerId'])
@Index(['placementId'])
@Index(['type'])
@Index(['status'])
@Index(['priority'])
@Index(['timestamp'])
@Index(['operatorId'])
@Index(['equipmentId'])
@Index(['fromLocation'])
@Index(['toLocation'])
export class MovementLog {
  @ApiProperty({ description: 'Уникальный идентификатор записи движения' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ description: 'ID контейнера' })
  @Column({ name: 'container_id' })
  containerId: string;

  @ApiProperty({ description: 'Контейнер', type: () => Container })
  @ManyToOne(() => Container, { eager: true })
  @JoinColumn({ name: 'container_id' })
  container: Container;

  @ApiProperty({ description: 'ID размещения' })
  @Column({ name: 'placement_id', nullable: true })
  placementId: string;

  @ApiProperty({ description: 'Размещение', type: () => Placement })
  @ManyToOne(() => Placement)
  @JoinColumn({ name: 'placement_id' })
  placement: Placement;

  @ApiProperty({ description: 'Тип движения', enum: MovementType })
  @Column({
    type: 'enum',
    enum: MovementType,
  })
  type: MovementType;

  @ApiProperty({ description: 'Статус движения', enum: MovementStatus })
  @Column({
    type: 'enum',
    enum: MovementStatus,
    default: MovementStatus.PLANNED,
  })
  status: MovementStatus;

  @ApiProperty({ description: 'Приоритет движения', enum: MovementPriority })
  @Column({
    type: 'enum',
    enum: MovementPriority,
    default: MovementPriority.NORMAL,
  })
  priority: MovementPriority;

  @ApiProperty({ description: 'Время движения' })
  @Column({ type: 'timestamp' })
  timestamp: Date;

  @ApiProperty({ description: 'Время начала движения' })
  @Column({ name: 'start_time', type: 'timestamp', nullable: true })
  startTime: Date;

  @ApiProperty({ description: 'Время завершения движения' })
  @Column({ name: 'end_time', type: 'timestamp', nullable: true })
  endTime: Date;

  @ApiProperty({ description: 'Продолжительность движения (секунды)' })
  @Column({ name: 'duration_seconds', nullable: true })
  durationSeconds: number;

  @ApiProperty({ description: 'Исходное местоположение' })
  @Column({ name: 'from_location', type: 'jsonb' })
  fromLocation: {
    type: 'yard' | 'gate' | 'vessel' | 'rail' | 'truck' | 'external';
    yardId?: string;
    zoneId?: string;
    slotId?: string;
    slotAddress?: string;
    coordinates?: {
      latitude: number;
      longitude: number;
      accuracy?: number;
    };
    description?: string;
  };

  @ApiProperty({ description: 'Целевое местоположение' })
  @Column({ name: 'to_location', type: 'jsonb' })
  toLocation: {
    type: 'yard' | 'gate' | 'vessel' | 'rail' | 'truck' | 'external';
    yardId?: string;
    zoneId?: string;
    slotId?: string;
    slotAddress?: string;
    coordinates?: {
      latitude: number;
      longitude: number;
      accuracy?: number;
    };
    description?: string;
  };

  @ApiProperty({ description: 'ID оператора' })
  @Column({ name: 'operator_id' })
  operatorId: string;

  @ApiProperty({ description: 'Имя оператора' })
  @Column({ name: 'operator_name' })
  operatorName: string;

  @ApiProperty({ description: 'ID оборудования' })
  @Column({ name: 'equipment_id', nullable: true })
  equipmentId: string;

  @ApiProperty({ description: 'Тип оборудования' })
  @Column({ name: 'equipment_type', nullable: true })
  equipmentType: string;

  @ApiProperty({ description: 'Номер оборудования' })
  @Column({ name: 'equipment_number', nullable: true })
  equipmentNumber: string;

  @ApiProperty({ description: 'Причина движения' })
  @Column({ type: 'text' })
  reason: string;

  @ApiProperty({ description: 'Описание операции' })
  @Column({ type: 'text', nullable: true })
  description: string;

  @ApiProperty({ description: 'Связанный заказ/заявка' })
  @Column({ name: 'related_order_id', nullable: true })
  relatedOrderId: string;

  @ApiProperty({ description: 'Связанная транзакция ворот' })
  @Column({ name: 'gate_transaction_id', nullable: true })
  gateTransactionId: string;

  @ApiProperty({ description: 'Маршрут движения' })
  @Column({ type: 'jsonb', nullable: true })
  route: {
    plannedPath?: {
      type: 'LineString';
      coordinates: number[][];
    };
    actualPath?: {
      type: 'LineString';
      coordinates: number[][];
    };
    waypoints?: Array<{
      sequence: number;
      location: {
        latitude: number;
        longitude: number;
      };
      timestamp?: Date;
      description?: string;
    }>;
    distance?: {
      planned: number;
      actual: number;
      unit: 'm' | 'ft';
    };
  };

  @ApiProperty({ description: 'GPS трекинг' })
  @Column({ name: 'gps_tracking', type: 'jsonb', nullable: true })
  gpsTracking: {
    enabled: boolean;
    trackingInterval: number; // seconds
    positions: Array<{
      timestamp: Date;
      latitude: number;
      longitude: number;
      accuracy: number;
      speed?: number;
      heading?: number;
      altitude?: number;
    }>;
    startPosition?: {
      latitude: number;
      longitude: number;
      timestamp: Date;
    };
    endPosition?: {
      latitude: number;
      longitude: number;
      timestamp: Date;
    };
  };

  @ApiProperty({ description: 'Условия выполнения' })
  @Column({ type: 'jsonb', nullable: true })
  conditions: {
    weather: {
      condition: string;
      temperature: number;
      temperatureUnit: 'C' | 'F';
      windSpeed: number;
      visibility: 'excellent' | 'good' | 'poor';
    };
    operationalConditions: {
      trafficLevel: 'light' | 'moderate' | 'heavy';
      equipmentAvailability: 'full' | 'limited' | 'constrained';
      yardCongestion: 'low' | 'medium' | 'high';
    };
    safetyConditions: {
      hazardLevel: 'none' | 'low' | 'medium' | 'high';
      specialPrecautions: string[];
      emergencyProcedures: boolean;
    };
  };

  @ApiProperty({ description: 'Результаты выполнения' })
  @Column({ type: 'jsonb', nullable: true })
  results: {
    success: boolean;
    accuracy: 'precise' | 'approximate' | 'estimated';
    verificationMethod: 'visual' | 'rfid' | 'barcode' | 'gps' | 'manual';
    finalPosition: {
      latitude: number;
      longitude: number;
      accuracy: number;
    };
    positionDeviation?: {
      distance: number;
      unit: 'm' | 'ft';
      direction: number; // degrees
    };
    qualityMetrics: {
      timeCompliance: boolean;
      routeCompliance: boolean;
      safetyCompliance: boolean;
      procedureCompliance: boolean;
    };
  };

  @ApiProperty({ description: 'Проблемы и инциденты' })
  @Column({ type: 'jsonb', nullable: true })
  incidents: Array<{
    incidentId: string;
    timestamp: Date;
    type: 'delay' | 'equipment_failure' | 'safety' | 'damage' | 'other';
    severity: 'low' | 'medium' | 'high' | 'critical';
    description: string;
    location?: {
      latitude: number;
      longitude: number;
    };
    resolution?: {
      action: string;
      resolvedAt: Date;
      resolvedBy: string;
    };
    reportedBy: string;
    photos?: string[];
  }>;

  @ApiProperty({ description: 'Измерения и проверки' })
  @Column({ type: 'jsonb', nullable: true })
  measurements: {
    weight?: {
      gross: number;
      tare: number;
      net: number;
      unit: 'kg' | 'lbs';
      verificationMethod: 'scale' | 'documentation' | 'estimated';
    };
    dimensions?: {
      length: number;
      width: number;
      height: number;
      unit: 'm' | 'ft';
      verificationMethod: 'measured' | 'documentation' | 'estimated';
    };
    condition?: {
      before: 'excellent' | 'good' | 'damaged' | 'needs_inspection';
      after: 'excellent' | 'good' | 'damaged' | 'needs_inspection';
      changes: string[];
      photos: string[];
    };
  };

  @ApiProperty({ description: 'Производительность' })
  @Column({ name: 'performance_metrics', type: 'jsonb', nullable: true })
  performanceMetrics: {
    plannedDuration: number; // seconds
    actualDuration: number; // seconds
    efficiency: number; // percentage
    fuelConsumption?: number;
    emissions?: {
      co2: number;
      unit: 'kg' | 'lbs';
    };
    costEstimate?: {
      labor: number;
      equipment: number;
      fuel: number;
      total: number;
      currency: string;
    };
  };

  @ApiProperty({ description: 'Документация' })
  @Column({ type: 'jsonb', nullable: true })
  documentation: {
    photos: {
      before: string[];
      during: string[];
      after: string[];
    };
    signatures?: {
      operator: string;
      supervisor?: string;
      customer?: string;
    };
    documents?: Array<{
      type: string;
      url: string;
      timestamp: Date;
    }>;
    certificates?: Array<{
      type: string;
      number: string;
      issuedBy: string;
      validUntil: Date;
    }>;
  };

  @ApiProperty({ description: 'Дополнительные метаданные' })
  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @ApiProperty({ description: 'Дата создания записи' })
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}