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
import { Order } from '../../orders/entities/order.entity';

export enum MoveTaskType {
  GATE_IN = 'gate_in',
  GATE_OUT = 'gate_out',
  YARD_TO_YARD = 'yard_to_yard',
  VESSEL_LOADING = 'vessel_loading',
  VESSEL_DISCHARGE = 'vessel_discharge',
  RAIL_LOADING = 'rail_loading',
  RAIL_DISCHARGE = 'rail_discharge',
  TRUCK_LOADING = 'truck_loading',
  TRUCK_DISCHARGE = 'truck_discharge',
  RESTOW = 'restow',
  INSPECTION = 'inspection',
  WEIGHING = 'weighing',
  REPAIR = 'repair',
  CUSTOMS_EXAM = 'customs_exam',
  REEFER_CONNECT = 'reefer_connect',
  REEFER_DISCONNECT = 'reefer_disconnect',
  TRANSHIPMENT = 'transhipment',
}

export enum MoveTaskStatus {
  PLANNED = 'planned',
  QUEUED = 'queued',
  ASSIGNED = 'assigned',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  FAILED = 'failed',
  ON_HOLD = 'on_hold',
  SUSPENDED = 'suspended',
}

export enum MoveTaskPriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  URGENT = 'urgent',
  EMERGENCY = 'emergency',
}

export enum EquipmentType {
  CRANE = 'crane',
  REACH_STACKER = 'reach_stacker',
  FORKLIFT = 'forklift',
  TERMINAL_TRACTOR = 'terminal_tractor',
  CHASSIS = 'chassis',
  TRUCK = 'truck',
  RAIL_CRANE = 'rail_crane',
  SHIP_CRANE = 'ship_crane',
  MOBILE_CRANE = 'mobile_crane',
  RTG = 'rtg',
  RMG = 'rmg',
  STRADDLE_CARRIER = 'straddle_carrier',
}

@Entity('move_tasks', { schema: 'moves' })
@Index(['taskNumber'], { unique: true })
@Index(['type'])
@Index(['status'])
@Index(['priority'])
@Index(['containerId'])
@Index(['orderId'])
@Index(['assignedOperatorId'])
@Index(['assignedEquipmentId'])
@Index(['scheduledAt'])
@Index(['deadlineAt'])
@Index(['parentTaskId'])
export class MoveTask {
  @ApiProperty({ description: 'Уникальный идентификатор задачи перемещения' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ description: 'Номер задачи', example: 'MT-2023-001234' })
  @Column({ name: 'task_number', type: 'varchar', length: 50, unique: true })
  taskNumber: string;

  @ApiProperty({ description: 'Тип задачи перемещения', enum: MoveTaskType })
  @Column({
    type: 'enum',
    enum: MoveTaskType,
  })
  type: MoveTaskType;

  @ApiProperty({ description: 'Статус задачи', enum: MoveTaskStatus })
  @Column({
    type: 'enum',
    enum: MoveTaskStatus,
    default: MoveTaskStatus.PLANNED,
  })
  status: MoveTaskStatus;

  @ApiProperty({ description: 'Приоритет задачи', enum: MoveTaskPriority })
  @Column({
    type: 'enum',
    enum: MoveTaskPriority,
    default: MoveTaskPriority.NORMAL,
  })
  priority: MoveTaskPriority;

  @ApiProperty({ description: 'Название задачи' })
  @Column({ name: 'task_name' })
  taskName: string;

  @ApiProperty({ description: 'Описание задачи' })
  @Column({ type: 'text', nullable: true })
  description: string;

  @ApiProperty({ description: 'ID контейнера' })
  @Column({ name: 'container_id', nullable: true })
  containerId: string;

  @ApiProperty({ description: 'Контейнер', type: () => Container })
  @ManyToOne(() => Container, { eager: true })
  @JoinColumn({ name: 'container_id' })
  container: Container;

  @ApiProperty({ description: 'Номер контейнера (если контейнер не в системе)' })
  @Column({ name: 'container_number', nullable: true })
  containerNumber: string;

  @ApiProperty({ description: 'ID заявки' })
  @Column({ name: 'order_id', nullable: true })
  orderId: string;

  @ApiProperty({ description: 'Заявка', type: () => Order })
  @ManyToOne(() => Order)
  @JoinColumn({ name: 'order_id' })
  order: Order;

  @ApiProperty({ description: 'ID родительской задачи (для подзадач)' })
  @Column({ name: 'parent_task_id', nullable: true })
  parentTaskId: string;

  @ApiProperty({ description: 'Родительская задача', type: () => MoveTask })
  @ManyToOne(() => MoveTask)
  @JoinColumn({ name: 'parent_task_id' })
  parentTask: MoveTask;

  @ApiProperty({ description: 'Порядковый номер в последовательности задач' })
  @Column({ name: 'sequence_number', default: 1 })
  sequenceNumber: number;

  @ApiProperty({ description: 'Исходное местоположение' })
  @Column({ name: 'from_location', type: 'jsonb' })
  fromLocation: {
    type: 'yard' | 'gate' | 'vessel' | 'rail' | 'truck' | 'external';
    yardId?: string;
    yardCode?: string;
    zoneId?: string;
    zoneCode?: string;
    slotId?: string;
    slotAddress?: string;
    vesselId?: string;
    vesselName?: string;
    bayRow?: string;
    tierLevel?: string;
    railCarId?: string;
    truckId?: string;
    coordinates?: {
      latitude: number;
      longitude: number;
    };
    description?: string;
  };

  @ApiProperty({ description: 'Целевое местоположение' })
  @Column({ name: 'to_location', type: 'jsonb' })
  toLocation: {
    type: 'yard' | 'gate' | 'vessel' | 'rail' | 'truck' | 'external';
    yardId?: string;
    yardCode?: string;
    zoneId?: string;
    zoneCode?: string;
    slotId?: string;
    slotAddress?: string;
    vesselId?: string;
    vesselName?: string;
    bayRow?: string;
    tierLevel?: string;
    railCarId?: string;
    truckId?: string;
    coordinates?: {
      latitude: number;
      longitude: number;
    };
    description?: string;
  };

  @ApiProperty({ description: 'Требуемый тип оборудования' })
  @Column({ name: 'required_equipment_type', type: 'enum', enum: EquipmentType })
  requiredEquipmentType: EquipmentType;

  @ApiProperty({ description: 'ID назначенного оборудования' })
  @Column({ name: 'assigned_equipment_id', nullable: true })
  assignedEquipmentId: string;

  @ApiProperty({ description: 'Номер назначенного оборудования' })
  @Column({ name: 'assigned_equipment_number', nullable: true })
  assignedEquipmentNumber: string;

  @ApiProperty({ description: 'ID назначенного оператора' })
  @Column({ name: 'assigned_operator_id', nullable: true })
  assignedOperatorId: string;

  @ApiProperty({ description: 'Имя назначенного оператора' })
  @Column({ name: 'assigned_operator_name', nullable: true })
  assignedOperatorName: string;

  @ApiProperty({ description: 'Планируемое время выполнения' })
  @Column({ name: 'scheduled_at', type: 'timestamp', nullable: true })
  scheduledAt: Date;

  @ApiProperty({ description: 'Крайний срок выполнения' })
  @Column({ name: 'deadline_at', type: 'timestamp', nullable: true })
  deadlineAt: Date;

  @ApiProperty({ description: 'Время начала выполнения' })
  @Column({ name: 'started_at', type: 'timestamp', nullable: true })
  startedAt: Date;

  @ApiProperty({ description: 'Время завершения' })
  @Column({ name: 'completed_at', type: 'timestamp', nullable: true })
  completedAt: Date;

  @ApiProperty({ description: 'Планируемая продолжительность (минуты)' })
  @Column({ name: 'estimated_duration_minutes', nullable: true })
  estimatedDurationMinutes: number;

  @ApiProperty({ description: 'Фактическая продолжительность (минуты)' })
  @Column({ name: 'actual_duration_minutes', nullable: true })
  actualDurationMinutes: number;

  @ApiProperty({ description: 'Зависимости от других задач' })
  @Column({ type: 'jsonb', nullable: true })
  dependencies: {
    prerequisiteTasks: string[]; // IDs задач, которые должны быть выполнены до этой
    blockedTasks: string[]; // IDs задач, которые блокируются этой задачей
    parallelTasks: string[]; // IDs задач, которые могут выполняться параллельно
    conflictingTasks: string[]; // IDs задач, которые конфликтуют с этой
  };

  @ApiProperty({ description: 'Особые требования' })
  @Column({ name: 'special_requirements', type: 'jsonb', nullable: true })
  specialRequirements: {
    hazmatHandling?: {
      required: boolean;
      class: string;
      instructions: string[];
    };
    temperatureControl?: {
      required: boolean;
      targetTemperature: number;
      unit: 'C' | 'F';
      tolerance: number;
    };
    weightRestrictions?: {
      maxWeight: number;
      unit: 'kg' | 'lbs';
      verificationRequired: boolean;
    };
    customsSealed?: {
      sealed: boolean;
      sealNumbers: string[];
      verificationRequired: boolean;
    };
    specialHandling?: {
      fragile: boolean;
      oversized: boolean;
      highValue: boolean;
      securityLevel: 'standard' | 'high' | 'maximum';
      instructions: string[];
    };
    documentation?: {
      required: string[];
      certificates: string[];
      permits: string[];
    };
  };

  @ApiProperty({ description: 'Ограничения по времени' })
  @Column({ name: 'time_constraints', type: 'jsonb', nullable: true })
  timeConstraints: {
    vesselSchedule?: {
      vesselId: string;
      vesselName: string;
      etaAt?: Date;
      etdAt?: Date;
      workingWindow: {
        startTime: Date;
        endTime: Date;
      };
    };
    railSchedule?: {
      trainId: string;
      arrivalAt?: Date;
      departureAt?: Date;
      workingWindow: {
        startTime: Date;
        endTime: Date;
      };
    };
    truckAppointment?: {
      appointmentTime: Date;
      timeSlotDuration: number; // minutes
      gateNumber?: string;
    };
    operationalHours?: {
      allowedHours: { from: string; to: string }[];
      excludedDays: string[];
      shiftRestrictions: string[];
    };
  };

  @ApiProperty({ description: 'Планирование ресурсов' })
  @Column({ name: 'resource_planning', type: 'jsonb', nullable: true })
  resourcePlanning: {
    estimatedCost: {
      labor: number;
      equipment: number;
      fuel: number;
      total: number;
      currency: string;
    };
    resourceAllocation: {
      operatorHours: number;
      equipmentHours: number;
      fuelConsumption: number;
      additionalCosts?: Array<{
        type: string;
        description: string;
        amount: number;
      }>;
    };
    alternativeResources?: Array<{
      equipmentType: EquipmentType;
      operatorSkills: string[];
      costDelta: number;
      timeDelta: number; // minutes
      availability: boolean;
    }>;
  };

  @ApiProperty({ description: 'Автоматизация и оптимизация' })
  @Column({ type: 'jsonb', nullable: true })
  automation: {
    autoAssignment: {
      enabled: boolean;
      criteria: {
        minimizeCost: boolean;
        minimizeTime: boolean;
        balanceWorkload: boolean;
        preferredOperators: string[];
        preferredEquipment: string[];
      };
    };
    routeOptimization: {
      enabled: boolean;
      algorithm: 'shortest_path' | 'fastest_time' | 'least_congestion';
      avoidanceZones: string[];
      preferredRoutes: string[];
    };
    schedulingOptimization: {
      enabled: boolean;
      algorithm: 'fifo' | 'priority' | 'deadline' | 'cost_optimized';
      batchingAllowed: boolean;
      maxBatchSize: number;
    };
  };

  @ApiProperty({ description: 'Отслеживание выполнения' })
  @Column({ type: 'jsonb', nullable: true })
  tracking: {
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
      }>;
    };
    milestones: Array<{
      milestone: string;
      expectedAt: Date;
      actualAt?: Date;
      status: 'pending' | 'completed' | 'overdue';
      notes?: string;
    }>;
    checkpoints: Array<{
      checkpointId: string;
      location: {
        latitude: number;
        longitude: number;
      };
      expectedAt: Date;
      actualAt?: Date;
      verified: boolean;
      method: 'gps' | 'rfid' | 'manual' | 'barcode';
    }>;
  };

  @ApiProperty({ description: 'Результаты выполнения' })
  @Column({ type: 'jsonb', nullable: true })
  results: {
    success: boolean;
    completionRate: number; // percentage
    qualityScore: number; // 1-10
    deliveryAccuracy: {
      locationAccuracy: number; // meters
      timeAccuracy: number; // minutes difference from scheduled
      conditionVerified: boolean;
    };
    issuesEncountered: Array<{
      issueId: string;
      type: 'delay' | 'equipment_failure' | 'damage' | 'safety' | 'other';
      severity: 'low' | 'medium' | 'high' | 'critical';
      description: string;
      resolution?: string;
      impactOnSchedule: number; // minutes
    }>;
    performanceMetrics: {
      fuelEfficiency: number;
      timeEfficiency: number; // percentage
      costEfficiency: number; // percentage
      safetyScore: number; // 1-10
    };
  };

  @ApiProperty({ description: 'Причина отмены/неудачи' })
  @Column({ name: 'cancellation_reason', type: 'text', nullable: true })
  cancellationReason: string;

  @ApiProperty({ description: 'Заметки и комментарии' })
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