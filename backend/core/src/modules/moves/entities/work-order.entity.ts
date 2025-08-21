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
import { MoveTask } from './move-task.entity';
import { Order } from '../../orders/entities/order.entity';

export enum WorkOrderType {
  VESSEL_OPERATION = 'vessel_operation',
  RAIL_OPERATION = 'rail_operation',
  TRUCK_OPERATION = 'truck_operation',
  YARD_OPERATION = 'yard_operation',
  GATE_OPERATION = 'gate_operation',
  INSPECTION_OPERATION = 'inspection_operation',
  MAINTENANCE_OPERATION = 'maintenance_operation',
  EMERGENCY_OPERATION = 'emergency_operation',
}

export enum WorkOrderStatus {
  DRAFT = 'draft',
  PLANNED = 'planned',
  APPROVED = 'approved',
  SCHEDULED = 'scheduled',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  ON_HOLD = 'on_hold',
}

export enum WorkOrderPriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  URGENT = 'urgent',
  EMERGENCY = 'emergency',
}

@Entity('work_orders', { schema: 'moves' })
@Index(['workOrderNumber'], { unique: true })
@Index(['type'])
@Index(['status'])
@Index(['priority'])
@Index(['orderId'])
@Index(['supervisorId'])
@Index(['scheduledStartAt'])
@Index(['deadlineAt'])
export class WorkOrder {
  @ApiProperty({ description: 'Уникальный идентификатор рабочего наряда' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ description: 'Номер рабочего наряда', example: 'WO-2023-001234' })
  @Column({ name: 'work_order_number', type: 'varchar', length: 50, unique: true })
  workOrderNumber: string;

  @ApiProperty({ description: 'Тип рабочего наряда', enum: WorkOrderType })
  @Column({
    type: 'enum',
    enum: WorkOrderType,
  })
  type: WorkOrderType;

  @ApiProperty({ description: 'Статус рабочего наряда', enum: WorkOrderStatus })
  @Column({
    type: 'enum',
    enum: WorkOrderStatus,
    default: WorkOrderStatus.DRAFT,
  })
  status: WorkOrderStatus;

  @ApiProperty({ description: 'Приоритет рабочего наряда', enum: WorkOrderPriority })
  @Column({
    type: 'enum',
    enum: WorkOrderPriority,
    default: WorkOrderPriority.NORMAL,
  })
  priority: WorkOrderPriority;

  @ApiProperty({ description: 'Название рабочего наряда' })
  @Column({ name: 'work_order_name' })
  workOrderName: string;

  @ApiProperty({ description: 'Описание работ' })
  @Column({ type: 'text', nullable: true })
  description: string;

  @ApiProperty({ description: 'ID заявки' })
  @Column({ name: 'order_id', nullable: true })
  orderId: string;

  @ApiProperty({ description: 'Заявка', type: () => Order })
  @ManyToOne(() => Order, { eager: true })
  @JoinColumn({ name: 'order_id' })
  order: Order;

  @ApiProperty({ description: 'ID супервайзера' })
  @Column({ name: 'supervisor_id' })
  supervisorId: string;

  @ApiProperty({ description: 'Имя супервайзера' })
  @Column({ name: 'supervisor_name' })
  supervisorName: string;

  @ApiProperty({ description: 'Планируемое время начала' })
  @Column({ name: 'scheduled_start_at', type: 'timestamp' })
  scheduledStartAt: Date;

  @ApiProperty({ description: 'Планируемое время завершения' })
  @Column({ name: 'scheduled_end_at', type: 'timestamp' })
  scheduledEndAt: Date;

  @ApiProperty({ description: 'Крайний срок выполнения' })
  @Column({ name: 'deadline_at', type: 'timestamp', nullable: true })
  deadlineAt: Date;

  @ApiProperty({ description: 'Фактическое время начала' })
  @Column({ name: 'actual_start_at', type: 'timestamp', nullable: true })
  actualStartAt: Date;

  @ApiProperty({ description: 'Фактическое время завершения' })
  @Column({ name: 'actual_end_at', type: 'timestamp', nullable: true })
  actualEndAt: Date;

  @ApiProperty({ description: 'Список задач в рабочем наряде' })
  @Column({ name: 'task_list', type: 'jsonb' })
  taskList: Array<{
    taskId: string;
    taskNumber: string;
    taskName: string;
    taskType: string;
    sequence: number;
    estimatedDuration: number; // minutes
    assignedOperatorId?: string;
    assignedOperatorName?: string;
    assignedEquipmentId?: string;
    assignedEquipmentNumber?: string;
    status: string;
    startedAt?: Date;
    completedAt?: Date;
    notes?: string;
  }>;

  @ApiProperty({ description: 'Требуемые ресурсы' })
  @Column({ name: 'required_resources', type: 'jsonb' })
  requiredResources: {
    personnel: Array<{
      role: string;
      skillLevel: string;
      quantity: number;
      shiftHours: number;
      specialCertifications?: string[];
    }>;
    equipment: Array<{
      equipmentType: string;
      quantity: number;
      operatingHours: number;
      specifications?: Record<string, any>;
      alternatives?: string[];
    }>;
    materials: Array<{
      materialType: string;
      quantity: number;
      unit: string;
      specifications?: string;
    }>;
    facilities: Array<{
      facilityType: string;
      duration: number; // hours
      specifications?: Record<string, any>;
    }>;
  };

  @ApiProperty({ description: 'Назначенные ресурсы' })
  @Column({ name: 'assigned_resources', type: 'jsonb', nullable: true })
  assignedResources: {
    personnel: Array<{
      operatorId: string;
      operatorName: string;
      role: string;
      shiftStart: Date;
      shiftEnd: Date;
      contactInfo?: {
        phone: string;
        radio: string;
      };
    }>;
    equipment: Array<{
      equipmentId: string;
      equipmentNumber: string;
      equipmentType: string;
      operatorId?: string;
      assignedFrom: Date;
      assignedUntil: Date;
      currentLocation?: {
        latitude: number;
        longitude: number;
      };
      status: 'available' | 'assigned' | 'in_use' | 'maintenance';
    }>;
    materials: Array<{
      materialId: string;
      materialType: string;
      quantityAllocated: number;
      unit: string;
      storageLocation: string;
    }>;
    facilities: Array<{
      facilityId: string;
      facilityType: string;
      allocatedFrom: Date;
      allocatedUntil: Date;
      accessInstructions?: string;
    }>;
  };

  @ApiProperty({ description: 'План выполнения работ' })
  @Column({ name: 'execution_plan', type: 'jsonb' })
  executionPlan: {
    phases: Array<{
      phaseId: string;
      phaseName: string;
      sequence: number;
      estimatedDuration: number; // minutes
      prerequisites: string[];
      tasks: string[]; // task IDs
      milestones: Array<{
        milestone: string;
        expectedAt: Date;
        criticalPath: boolean;
      }>;
    }>;
    criticalPath: {
      totalDuration: number; // minutes
      taskSequence: string[];
      bufferTime: number; // minutes
    };
    riskAssessment: {
      riskLevel: 'low' | 'medium' | 'high' | 'critical';
      identifiedRisks: Array<{
        riskId: string;
        description: string;
        probability: number; // 0-1
        impact: 'low' | 'medium' | 'high' | 'critical';
        mitigation: string;
      }>;
      contingencyPlans: Array<{
        scenario: string;
        response: string;
        additionalResources?: string[];
        estimatedDelay?: number; // minutes
      }>;
    };
  };

  @ApiProperty({ description: 'Требования безопасности' })
  @Column({ name: 'safety_requirements', type: 'jsonb', nullable: true })
  safetyRequirements: {
    hazardLevel: 'low' | 'medium' | 'high' | 'critical';
    requiredPPE: string[];
    safetyBriefing: {
      required: boolean;
      topics: string[];
      duration: number; // minutes
    };
    permits: Array<{
      permitType: string;
      permitNumber?: string;
      validFrom: Date;
      validUntil: Date;
      restrictions?: string[];
    }>;
    emergencyProcedures: {
      evacuationPlan: string;
      emergencyContacts: Array<{
        service: string;
        phone: string;
        description: string;
      }>;
      firstAidStations: Array<{
        location: string;
        equipment: string[];
      }>;
    };
    environmentalConsiderations: {
      weatherRestrictions: string[];
      noiseLevel: number; // dB
      emissions: boolean;
      wasteManagement: string[];
    };
  };

  @ApiProperty({ description: 'Контроль качества' })
  @Column({ name: 'quality_control', type: 'jsonb', nullable: true })
  qualityControl: {
    inspectionPoints: Array<{
      pointId: string;
      description: string;
      phase: string;
      inspector: string;
      criteria: string[];
      passed?: boolean;
      notes?: string;
      timestamp?: Date;
    }>;
    qualityStandards: {
      standard: string;
      version: string;
      requirements: string[];
      tolerance: Record<string, number>;
    };
    documentation: {
      required: string[];
      completed: string[];
      photos: string[];
      certificates: string[];
    };
    defectTracking: Array<{
      defectId: string;
      type: string;
      severity: 'minor' | 'major' | 'critical';
      description: string;
      foundAt: Date;
      foundBy: string;
      resolution?: string;
      resolvedAt?: Date;
      resolvedBy?: string;
    }>;
  };

  @ApiProperty({ description: 'Отслеживание прогресса' })
  @Column({ name: 'progress_tracking', type: 'jsonb', nullable: true })
  progressTracking: {
    overallProgress: number; // percentage
    taskProgress: Array<{
      taskId: string;
      progress: number; // percentage
      lastUpdated: Date;
    }>;
    milestones: Array<{
      milestoneId: string;
      milestone: string;
      targetDate: Date;
      actualDate?: Date;
      status: 'pending' | 'achieved' | 'overdue';
    }>;
    delays: Array<{
      delayId: string;
      taskId: string;
      reason: string;
      duration: number; // minutes
      impact: string;
      reportedAt: Date;
      reportedBy: string;
    }>;
    keyPerformanceIndicators: {
      scheduleCompliance: number; // percentage
      qualityScore: number; // 1-10
      safetyScore: number; // 1-10
      costEfficiency: number; // percentage
      resourceUtilization: number; // percentage
    };
  };

  @ApiProperty({ description: 'Финансовая информация' })
  @Column({ name: 'financial_data', type: 'jsonb', nullable: true })
  financialData: {
    budgetedCost: {
      labor: number;
      equipment: number;
      materials: number;
      overhead: number;
      total: number;
      currency: string;
    };
    actualCost: {
      labor: number;
      equipment: number;
      materials: number;
      overhead: number;
      additionalCosts: number;
      total: number;
      currency: string;
    };
    costVariance: {
      amount: number;
      percentage: number;
      explanation?: string;
    };
    billing: {
      billable: boolean;
      clientId?: string;
      invoiceNumber?: string;
      billingRate?: number;
      totalBillable?: number;
    };
  };

  @ApiProperty({ description: 'Коммуникация и уведомления' })
  @Column({ type: 'jsonb', nullable: true })
  communications: {
    stakeholders: Array<{
      stakeholderId: string;
      name: string;
      role: string;
      contactMethod: 'email' | 'sms' | 'radio' | 'phone';
      contactInfo: string;
      notificationPreferences: string[];
    }>;
    notifications: Array<{
      notificationId: string;
      type: 'status_update' | 'delay' | 'completion' | 'emergency';
      recipients: string[];
      message: string;
      sentAt: Date;
      status: 'sent' | 'delivered' | 'failed';
    }>;
    meetingSchedule: Array<{
      meetingId: string;
      type: 'kickoff' | 'progress' | 'completion' | 'emergency';
      scheduledAt: Date;
      attendees: string[];
      agenda: string[];
      notes?: string;
    }>;
  };

  @ApiProperty({ description: 'Результаты выполнения' })
  @Column({ type: 'jsonb', nullable: true })
  results: {
    success: boolean;
    completionRate: number; // percentage
    tasksCompleted: number;
    totalTasks: number;
    overallQualityScore: number; // 1-10
    customerSatisfaction?: number; // 1-10
    lessonLearned: string[];
    recommendations: string[];
    followUpActions: Array<{
      action: string;
      assignedTo: string;
      dueDate: Date;
      priority: string;
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