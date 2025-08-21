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
import { Operator } from './operator.entity';

export enum ShiftType {
  REGULAR = 'regular',
  OVERTIME = 'overtime',
  EMERGENCY = 'emergency',
  TRAINING = 'training',
  MAINTENANCE = 'maintenance',
}

export enum ShiftStatus {
  SCHEDULED = 'scheduled',
  STARTED = 'started',
  ON_BREAK = 'on_break',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  NO_SHOW = 'no_show',
}

@Entity('shifts', { schema: 'personnel' })
@Index(['operatorId'])
@Index(['shiftType'])
@Index(['status'])
@Index(['startTime'])
@Index(['endTime'])
@Index(['departmentId'])
@Index(['supervisorId'])
@Index(['shiftNumber'], { unique: true })
export class Shift {
  @ApiProperty({ description: 'Уникальный идентификатор смены' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ description: 'Номер смены', example: 'SH-2024-001-DAY' })
  @Column({ name: 'shift_number', type: 'varchar', length: 50, unique: true })
  shiftNumber: string;

  @ApiProperty({ description: 'ID оператора' })
  @Column({ name: 'operator_id' })
  operatorId: string;

  @ApiProperty({ description: 'Тип смены', enum: ShiftType })
  @Column({
    name: 'shift_type',
    type: 'enum',
    enum: ShiftType,
    default: ShiftType.REGULAR,
  })
  shiftType: ShiftType;

  @ApiProperty({ description: 'Статус смены', enum: ShiftStatus })
  @Column({
    type: 'enum',
    enum: ShiftStatus,
    default: ShiftStatus.SCHEDULED,
  })
  status: ShiftStatus;

  @ApiProperty({ description: 'Название смены' })
  @Column({ name: 'shift_name' })
  shiftName: string;

  @ApiProperty({ description: 'Описание смены' })
  @Column({ type: 'text', nullable: true })
  description: string;

  @ApiProperty({ description: 'Плановое время начала' })
  @Column({ name: 'start_time', type: 'timestamp' })
  startTime: Date;

  @ApiProperty({ description: 'Плановое время окончания' })
  @Column({ name: 'end_time', type: 'timestamp' })
  endTime: Date;

  @ApiProperty({ description: 'Фактическое время начала' })
  @Column({ name: 'actual_start_time', type: 'timestamp', nullable: true })
  actualStartTime: Date;

  @ApiProperty({ description: 'Фактическое время окончания' })
  @Column({ name: 'actual_end_time', type: 'timestamp', nullable: true })
  actualEndTime: Date;

  @ApiProperty({ description: 'Плановая продолжительность в часах' })
  @Column({ name: 'planned_duration_hours', type: 'decimal', precision: 5, scale: 2 })
  plannedDurationHours: number;

  @ApiProperty({ description: 'Фактическая продолжительность в часах' })
  @Column({ name: 'actual_duration_hours', type: 'decimal', precision: 5, scale: 2, nullable: true })
  actualDurationHours: number;

  @ApiProperty({ description: 'ID подразделения' })
  @Column({ name: 'department_id' })
  departmentId: string;

  @ApiProperty({ description: 'Название подразделения' })
  @Column({ name: 'department_name' })
  departmentName: string;

  @ApiProperty({ description: 'ID супервайзера смены' })
  @Column({ name: 'supervisor_id', nullable: true })
  supervisorId: string;

  @ApiProperty({ description: 'Имя супервайзера' })
  @Column({ name: 'supervisor_name', nullable: true })
  supervisorName: string;

  @ApiProperty({ description: 'Рабочая зона/участок' })
  @Column({ name: 'work_zone', nullable: true })
  workZone: string;

  @ApiProperty({ description: 'Координаты рабочей зоны' })
  @Column({
    name: 'work_location',
    type: 'geometry',
    spatialFeatureType: 'Point',
    srid: 4326,
    nullable: true,
  })
  workLocation: string;

  @ApiProperty({ description: 'Назначенное оборудование' })
  @Column({ name: 'assigned_equipment', type: 'jsonb', nullable: true })
  assignedEquipment: Array<{
    equipmentId: string;
    equipmentNumber: string;
    equipmentType: string;
    assignedAt: Date;
    releasedAt?: Date;
    condition: string;
    fuelLevel?: number;
    notes?: string;
  }>;

  @ApiProperty({ description: 'Задачи смены' })
  @Column({ name: 'shift_tasks', type: 'jsonb' })
  shiftTasks: Array<{
    taskId: string;
    taskType: string;
    description: string;
    priority: 'low' | 'normal' | 'high' | 'urgent';
    estimatedDuration: number; // minutes
    assignedAt: Date;
    startedAt?: Date;
    completedAt?: Date;
    status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
    notes?: string;
  }>;

  @ApiProperty({ description: 'Перерывы' })
  @Column({ type: 'jsonb', nullable: true })
  breaks: Array<{
    breakType: 'lunch' | 'coffee' | 'rest' | 'emergency';
    startTime: Date;
    endTime?: Date;
    duration?: number; // minutes
    location?: string;
    authorized: boolean;
    authorizedBy?: string;
  }>;

  @ApiProperty({ description: 'Отчет о смене' })
  @Column({ name: 'shift_report', type: 'jsonb', nullable: true })
  shiftReport: {
    summary: string;
    tasksCompleted: number;
    tasksRemaining: number;
    issues: Array<{
      issueType: string;
      description: string;
      severity: 'low' | 'medium' | 'high' | 'critical';
      reportedAt: Date;
      resolvedAt?: Date;
      resolutionNotes?: string;
    }>;
    achievements: string[];
    recommendations: string[];
    handoverNotes?: string;
    operatorFeedback?: {
      satisfaction: number; // 1-10
      challenges: string[];
      suggestions: string[];
    };
  };

  @ApiProperty({ description: 'Производительность смены' })
  @Column({ name: 'performance_data', type: 'jsonb', nullable: true })
  performanceData: {
    productivity: {
      tasksPerHour: number;
      qualityScore: number; // 1-10
      efficiencyRating: number; // percentage
    };
    safety: {
      incidentsReported: number;
      safetyChecksCompleted: number;
      ppeCompliance: boolean;
    };
    equipment: {
      utilizationRate: number; // percentage
      maintenanceIssues: number;
      fuelConsumption?: number;
    };
    quality: {
      customerComplaints: number;
      qualityChecks: number;
      errorRate: number; // percentage
    };
  };

  @ApiProperty({ description: 'Отслеживание времени' })
  @Column({ name: 'time_tracking', type: 'jsonb', nullable: true })
  timeTracking: Array<{
    activity: string;
    startTime: Date;
    endTime?: Date;
    duration?: number; // minutes
    location?: {
      latitude: number;
      longitude: number;
      zone?: string;
    };
    equipmentUsed?: string[];
    notes?: string;
  }>;

  @ApiProperty({ description: 'Сверхурочные часы' })
  @Column({ name: 'overtime_details', type: 'jsonb', nullable: true })
  overtimeDetails: {
    isOvertime: boolean;
    overtimeHours: number;
    reason: string;
    approvedBy?: string;
    approvedAt?: Date;
    rate: number;
    compensation: number;
  };

  @ApiProperty({ description: 'Условия работы' })
  @Column({ name: 'working_conditions', type: 'jsonb', nullable: true })
  workingConditions: {
    weather: {
      temperature: number;
      humidity: number;
      windSpeed?: number;
      precipitation?: string;
      visibility?: string;
    };
    environmentalFactors: {
      noiseLevel?: number;
      dustLevel?: string;
      lighting?: string;
      hazards?: string[];
    };
    workload: {
      physicalDemand: 'low' | 'medium' | 'high' | 'extreme';
      mentalDemand: 'low' | 'medium' | 'high' | 'extreme';
      stressLevel: number; // 1-10
    };
  };

  @ApiProperty({ description: 'Контроль качества' })
  @Column({ name: 'quality_control', type: 'jsonb', nullable: true })
  qualityControl: {
    inspections: Array<{
      inspectionType: string;
      inspector: string;
      inspectionTime: Date;
      passed: boolean;
      score?: number;
      notes?: string;
      correctiveActions?: string[];
    }>;
    customerFeedback: Array<{
      feedbackType: string;
      rating: number; // 1-10
      comments: string;
      receivedAt: Date;
      respondedAt?: Date;
    }>;
    qualityMetrics: {
      accuracyRate: number; // percentage
      completionRate: number; // percentage
      reworkRequired: number; // count
    };
  };

  @ApiProperty({ description: 'Данные безопасности' })
  @Column({ name: 'safety_data', type: 'jsonb', nullable: true })
  safetyData: {
    safetyBriefing: {
      conducted: boolean;
      conductedBy?: string;
      topics: string[];
      duration: number; // minutes
    };
    hazardAssessment: Array<{
      hazardType: string;
      riskLevel: 'low' | 'medium' | 'high' | 'critical';
      mitigationMeasures: string[];
      assessedBy: string;
      assessmentTime: Date;
    }>;
    incidents: Array<{
      incidentType: string;
      time: Date;
      description: string;
      severity: 'minor' | 'moderate' | 'serious' | 'critical';
      injuryInvolved: boolean;
      reportedTo: string[];
      investigationRequired: boolean;
    }>;
    ppeCompliance: {
      required: string[];
      provided: string[];
      worn: string[];
      inspected: boolean;
      inspectedBy?: string;
    };
  };

  @ApiProperty({ description: 'Причина отмены' })
  @Column({ name: 'cancellation_reason', nullable: true })
  cancellationReason: string;

  @ApiProperty({ description: 'Комментарии' })
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

  // Relations
  @ManyToOne(() => Operator, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'operator_id' })
  operator: Operator;

  // Вычисляемые поля
  get isActive(): boolean {
    return this.status === ShiftStatus.STARTED || this.status === ShiftStatus.ON_BREAK;
  }

  get isCompleted(): boolean {
    return this.status === ShiftStatus.COMPLETED;
  }

  get duration(): number {
    if (this.actualStartTime && this.actualEndTime) {
      return (this.actualEndTime.getTime() - this.actualStartTime.getTime()) / (1000 * 60 * 60);
    }
    return this.plannedDurationHours;
  }

  get isOvertime(): boolean {
    return this.overtimeDetails?.isOvertime || false;
  }

  get totalBreakTime(): number {
    if (!this.breaks?.length) return 0;
    return this.breaks.reduce((total, break_) => {
      if (break_.endTime && break_.startTime) {
        return total + (break_.endTime.getTime() - break_.startTime.getTime()) / (1000 * 60);
      }
      return total + (break_.duration || 0);
    }, 0);
  }

  get effectiveWorkTime(): number {
    const totalDuration = this.duration * 60; // convert to minutes
    const breakTime = this.totalBreakTime;
    return Math.max(0, totalDuration - breakTime) / 60; // convert back to hours
  }

  get completionRate(): number {
    if (!this.shiftTasks?.length) return 100;
    const completedTasks = this.shiftTasks.filter(task => task.status === 'completed').length;
    return (completedTasks / this.shiftTasks.length) * 100;
  }
}