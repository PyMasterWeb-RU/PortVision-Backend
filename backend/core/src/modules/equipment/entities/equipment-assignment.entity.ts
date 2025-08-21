import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { Equipment } from './equipment.entity';

export enum AssignmentType {
  OPERATOR = 'operator',
  TASK = 'task',
  PROJECT = 'project',
  MAINTENANCE = 'maintenance',
  TRAINING = 'training',
  INSPECTION = 'inspection',
  TRANSPORTATION = 'transportation',
  TEMPORARY = 'temporary',
}

export enum AssignmentStatus {
  SCHEDULED = 'scheduled',
  ACTIVE = 'active',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  SUSPENDED = 'suspended',
  OVERDUE = 'overdue',
}

export enum AssignmentPriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  URGENT = 'urgent',
  EMERGENCY = 'emergency',
}

@Entity('equipment_assignments', { schema: 'equipment' })
@Index(['equipmentId'])
@Index(['assignmentType'])
@Index(['status'])
@Index(['priority'])
@Index(['assignedToId'])
@Index(['startDate'])
@Index(['endDate'])
@Index(['assignmentNumber'], { unique: true })
export class EquipmentAssignment {
  @ApiProperty({ description: 'Уникальный идентификатор назначения' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ description: 'Номер назначения', example: 'ASG-2024-001-EQ' })
  @Column({ name: 'assignment_number', type: 'varchar', length: 50, unique: true })
  assignmentNumber: string;

  @ApiProperty({ description: 'ID оборудования' })
  @Column({ name: 'equipment_id' })
  equipmentId: string;

  @ApiProperty({ description: 'Тип назначения', enum: AssignmentType })
  @Column({
    name: 'assignment_type',
    type: 'enum',
    enum: AssignmentType,
  })
  assignmentType: AssignmentType;

  @ApiProperty({ description: 'Статус назначения', enum: AssignmentStatus })
  @Column({
    type: 'enum',
    enum: AssignmentStatus,
    default: AssignmentStatus.SCHEDULED,
  })
  status: AssignmentStatus;

  @ApiProperty({ description: 'Приоритет', enum: AssignmentPriority })
  @Column({
    type: 'enum',
    enum: AssignmentPriority,
    default: AssignmentPriority.NORMAL,
  })
  priority: AssignmentPriority;

  @ApiProperty({ description: 'Название назначения' })
  @Column({ name: 'assignment_title' })
  assignmentTitle: string;

  @ApiProperty({ description: 'Описание назначения' })
  @Column({ type: 'text', nullable: true })
  description: string;

  @ApiProperty({ description: 'ID назначенного (оператор, проект, задача)' })
  @Column({ name: 'assigned_to_id' })
  assignedToId: string;

  @ApiProperty({ description: 'Тип назначенного (operator, project, task, etc.)' })
  @Column({ name: 'assigned_to_type' })
  assignedToType: string;

  @ApiProperty({ description: 'Имя назначенного' })
  @Column({ name: 'assigned_to_name' })
  assignedToName: string;

  @ApiProperty({ description: 'ID того, кто назначил' })
  @Column({ name: 'assigned_by_id' })
  assignedById: string;

  @ApiProperty({ description: 'Имя того, кто назначил' })
  @Column({ name: 'assigned_by_name' })
  assignedByName: string;

  @ApiProperty({ description: 'Дата начала назначения' })
  @Column({ name: 'start_date', type: 'timestamp' })
  startDate: Date;

  @ApiProperty({ description: 'Плановая дата окончания' })
  @Column({ name: 'end_date', type: 'timestamp' })
  endDate: Date;

  @ApiProperty({ description: 'Фактическая дата начала' })
  @Column({ name: 'actual_start_date', type: 'timestamp', nullable: true })
  actualStartDate: Date;

  @ApiProperty({ description: 'Фактическая дата окончания' })
  @Column({ name: 'actual_end_date', type: 'timestamp', nullable: true })
  actualEndDate: Date;

  @ApiProperty({ description: 'Местоположение работ' })
  @Column({ name: 'work_location', nullable: true })
  workLocation: string;

  @ApiProperty({ description: 'Координаты работ' })
  @Column({
    name: 'work_coordinates',
    type: 'geometry',
    spatialFeatureType: 'Point',
    srid: 4326,
    nullable: true,
  })
  workCoordinates: string;

  @ApiProperty({ description: 'Зона/участок работ' })
  @Column({ name: 'work_zone', nullable: true })
  workZone: string;

  @ApiProperty({ description: 'Требования к назначению' })
  @Column({ type: 'jsonb', nullable: true })
  requirements: {
    operatorRequirements?: {
      minimumExperience: number; // hours
      requiredCertifications: string[];
      requiredSkills: string[];
      clearanceLevel?: string;
    };
    equipmentRequirements?: {
      fuelLevel?: number; // percentage
      maintenanceStatus: 'current' | 'due' | 'overdue';
      requiredAttachments?: string[];
      specialConfigurations?: Record<string, any>;
    };
    environmentalRequirements?: {
      weatherConditions?: string[];
      temperatureRange?: { min: number; max: number };
      specialSafety?: string[];
    };
    timeRequirements?: {
      shiftPattern?: string;
      breakSchedule?: Array<{ start: string; end: string }>;
      overtimeAllowed?: boolean;
      nightShiftAllowed?: boolean;
    };
  };

  @ApiProperty({ description: 'Условия назначения' })
  @Column({ type: 'jsonb', nullable: true })
  conditions: {
    hourlyRate?: number;
    fixedFee?: number;
    currency?: string;
    fuelAllocation?: number;
    fuelUnit?: string;
    maximumHours?: number;
    overtimeRate?: number;
    allowances?: Array<{
      type: string;
      amount: number;
      description: string;
    }>;
    penalties?: Array<{
      condition: string;
      amount: number;
      description: string;
    }>;
  };

  @ApiProperty({ description: 'Производительность и метрики' })
  @Column({ name: 'performance_tracking', type: 'jsonb', nullable: true })
  performanceTracking: {
    hoursWorked?: number;
    hoursPlanned?: number;
    efficiency?: number; // percentage
    qualityScore?: number; // 1-10
    safetyIncidents?: number;
    fuelConsumption?: {
      total: number;
      unit: string;
      efficiency: number; // per hour or per operation
    };
    operationsCompleted?: number;
    distanceTraveled?: {
      total: number;
      unit: string;
    };
    breakdowns?: Array<{
      date: Date;
      duration: number; // minutes
      cause: string;
      resolved: boolean;
    }>;
  };

  @ApiProperty({ description: 'Текущее состояние назначения' })
  @Column({ name: 'current_status', type: 'jsonb', nullable: true })
  currentStatus: {
    currentLocation?: {
      latitude: number;
      longitude: number;
      address?: string;
      timestamp: Date;
    };
    currentActivity?: string;
    operationalState?: 'idle' | 'working' | 'moving' | 'maintenance' | 'break';
    lastUpdate?: Date;
    nextScheduledActivity?: {
      activity: string;
      scheduledAt: Date;
      location?: string;
    };
  };

  @ApiProperty({ description: 'Отчеты и документация' })
  @Column({ type: 'jsonb', nullable: true })
  reporting: {
    dailyReports?: Array<{
      date: Date;
      hoursWorked: number;
      tasksCompleted: string[];
      issues?: string[];
      fuelUsed?: number;
      notes?: string;
      submittedBy: string;
      approvedBy?: string;
    }>;
    weeklyReports?: Array<{
      weekOf: Date;
      totalHours: number;
      productivity: number;
      achievements: string[];
      challenges: string[];
      submittedBy: string;
    }>;
    completionReport?: {
      totalDuration: number; // hours
      overallRating: number; // 1-10
      objectives: Array<{
        objective: string;
        achieved: boolean;
        notes?: string;
      }>;
      recommendations: string[];
      lessons: string[];
      finalNotes: string;
    };
  };

  @ApiProperty({ description: 'Контроль доступа и безопасность' })
  @Column({ name: 'access_control', type: 'jsonb', nullable: true })
  accessControl: {
    accessLevels: string[];
    restrictedAreas?: string[];
    escortRequired?: boolean;
    backgroundCheckRequired?: boolean;
    trainingCompleted?: Array<{
      trainingType: string;
      completedDate: Date;
      validUntil?: Date;
      certificateId?: string;
    }>;
    emergencyContacts?: Array<{
      name: string;
      relationship: string;
      phone: string;
      email?: string;
    }>;
  };

  @ApiProperty({ description: 'Финансовая информация' })
  @Column({ name: 'financial_tracking', type: 'jsonb', nullable: true })
  financialTracking: {
    budgetAllocated?: number;
    costToDate?: number;
    currency?: string;
    costBreakdown?: {
      labor?: number;
      fuel?: number;
      maintenance?: number;
      insurance?: number;
      other?: number;
    };
    billingSchedule?: Array<{
      period: string;
      amount: number;
      dueDate: Date;
      invoiced: boolean;
      paid: boolean;
    }>;
    projectedFinalCost?: number;
    varianceFromBudget?: number; // positive = under budget
  };

  @ApiProperty({ description: 'Связанные документы и файлы' })
  @Column({ name: 'document_references', type: 'jsonb', nullable: true })
  documentReferences: {
    contracts?: string[];
    permits?: string[];
    insurancePolicies?: string[];
    trainingCertificates?: string[];
    photos?: string[];
    videos?: string[];
    reports?: string[];
    correspondence?: string[];
  };

  @ApiProperty({ description: 'Заметки и комментарии' })
  @Column({ type: 'text', nullable: true })
  notes: string;

  @ApiProperty({ description: 'Причина отмены/приостановки' })
  @Column({ name: 'cancellation_reason', nullable: true })
  cancellationReason: string;

  @ApiProperty({ description: 'Дополнительные метаданные' })
  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @ApiProperty({ description: 'Дата создания' })
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ApiProperty({ description: 'Дата обновления' })
  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Relations
  @ManyToOne(() => Equipment, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'equipment_id' })
  equipment: Equipment;
}