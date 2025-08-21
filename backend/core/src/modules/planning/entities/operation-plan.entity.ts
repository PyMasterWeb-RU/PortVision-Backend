import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

export enum PlanType {
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
  QUARTERLY = 'quarterly',
  ANNUAL = 'annual',
  SEASONAL = 'seasonal',
  VESSEL_OPERATION = 'vessel_operation',
  MAINTENANCE = 'maintenance',
  SPECIAL_EVENT = 'special_event',
}

export enum PlanStatus {
  DRAFT = 'draft',
  UNDER_REVIEW = 'under_review',
  APPROVED = 'approved',
  ACTIVE = 'active',
  ON_HOLD = 'on_hold',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  SUPERSEDED = 'superseded',
}

export enum PlanPriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  URGENT = 'urgent',
  CRITICAL = 'critical',
}

@Entity('operation_plans', { schema: 'planning' })
@Index(['planType'])
@Index(['status'])
@Index(['priority'])
@Index(['startDate'])
@Index(['endDate'])
@Index(['departmentId'])
@Index(['planManagerId'])
@Index(['planNumber'], { unique: true })
export class OperationPlan {
  @ApiProperty({ description: 'Уникальный идентификатор плана' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ description: 'Номер плана', example: 'PLN-2024-001-DAILY' })
  @Column({ name: 'plan_number', type: 'varchar', length: 50, unique: true })
  planNumber: string;

  @ApiProperty({ description: 'Тип плана', enum: PlanType })
  @Column({
    name: 'plan_type',
    type: 'enum',
    enum: PlanType,
  })
  planType: PlanType;

  @ApiProperty({ description: 'Статус плана', enum: PlanStatus })
  @Column({
    type: 'enum',
    enum: PlanStatus,
    default: PlanStatus.DRAFT,
  })
  status: PlanStatus;

  @ApiProperty({ description: 'Приоритет плана', enum: PlanPriority })
  @Column({
    type: 'enum',
    enum: PlanPriority,
    default: PlanPriority.NORMAL,
  })
  priority: PlanPriority;

  @ApiProperty({ description: 'Название плана' })
  @Column({ name: 'plan_title' })
  planTitle: string;

  @ApiProperty({ description: 'Описание плана' })
  @Column({ type: 'text' })
  description: string;

  @ApiProperty({ description: 'Дата начала выполнения' })
  @Column({ name: 'start_date', type: 'timestamp' })
  startDate: Date;

  @ApiProperty({ description: 'Дата окончания выполнения' })
  @Column({ name: 'end_date', type: 'timestamp' })
  endDate: Date;

  @ApiProperty({ description: 'ID менеджера плана' })
  @Column({ name: 'plan_manager_id' })
  planManagerId: string;

  @ApiProperty({ description: 'Имя менеджера плана' })
  @Column({ name: 'plan_manager_name' })
  planManagerName: string;

  @ApiProperty({ description: 'ID подразделения' })
  @Column({ name: 'department_id' })
  departmentId: string;

  @ApiProperty({ description: 'Название подразделения' })
  @Column({ name: 'department_name' })
  departmentName: string;

  @ApiProperty({ description: 'ID родительского плана' })
  @Column({ name: 'parent_plan_id', nullable: true })
  parentPlanId: string;

  @ApiProperty({ description: 'Номер родительского плана' })
  @Column({ name: 'parent_plan_number', nullable: true })
  parentPlanNumber: string;

  @ApiProperty({ description: 'Цели и задачи плана' })
  @Column({ type: 'jsonb' })
  objectives: Array<{
    objectiveId: string;
    title: string;
    description: string;
    priority: 'low' | 'medium' | 'high' | 'critical';
    targetValue?: number;
    currentValue?: number;
    unit?: string;
    progress: number; // percentage
    status: 'not_started' | 'in_progress' | 'completed' | 'on_hold' | 'cancelled';
    assignedTo?: string;
    dueDate?: Date;
    completedAt?: Date;
    notes?: string;
  }>;

  @ApiProperty({ description: 'Ресурсы планирования' })
  @Column({ name: 'resource_planning', type: 'jsonb' })
  resourcePlanning: {
    personnel: {
      requiredRoles: Array<{
        role: string;
        count: number;
        qualifications: string[];
        shiftPattern: string;
        coverage: number; // percentage
      }>;
      assignments: Array<{
        operatorId: string;
        operatorName: string;
        role: string;
        startDate: Date;
        endDate: Date;
        workload: number; // percentage
      }>;
    };
    equipment: {
      requiredEquipment: Array<{
        equipmentType: string;
        count: number;
        specifications?: Record<string, any>;
        utilizationTarget: number; // percentage
        priority: 'low' | 'medium' | 'high';
      }>;
      reservations: Array<{
        equipmentId: string;
        equipmentNumber: string;
        reservedFrom: Date;
        reservedTo: Date;
        purpose: string;
        priority: 'low' | 'medium' | 'high';
      }>;
    };
    infrastructure: {
      yardAreas: Array<{
        areaId: string;
        areaName: string;
        reservationType: 'exclusive' | 'shared' | 'priority';
        capacity: number;
        reservedFrom: Date;
        reservedTo: Date;
      }>;
      gates: Array<{
        gateId: string;
        gateName: string;
        operationType: string[];
        timeSlots: Array<{
          startTime: Date;
          endTime: Date;
          capacity: number;
          reserved: number;
        }>;
      }>;
    };
  };

  @ApiProperty({ description: 'Операционные планы' })
  @Column({ name: 'operation_schedules', type: 'jsonb' })
  operationSchedules: Array<{
    scheduleId: string;
    operationType: string;
    description: string;
    scheduledStart: Date;
    scheduledEnd: Date;
    estimatedDuration: number; // hours
    requiredResources: {
      personnel: string[];
      equipment: string[];
      infrastructure: string[];
    };
    dependencies: Array<{
      dependencyType: 'start_to_start' | 'start_to_finish' | 'finish_to_start' | 'finish_to_finish';
      dependentScheduleId: string;
      lagTime?: number; // hours
    }>;
    milestones: Array<{
      milestoneId: string;
      title: string;
      targetDate: Date;
      description: string;
      completed: boolean;
      completedAt?: Date;
    }>;
    status: 'planned' | 'ready' | 'in_progress' | 'completed' | 'delayed' | 'cancelled';
    actualStart?: Date;
    actualEnd?: Date;
    progress: number; // percentage
  }>;

  @ApiProperty({ description: 'Показатели эффективности' })
  @Column({ name: 'performance_targets', type: 'jsonb' })
  performanceTargets: {
    productivity: {
      containerThroughput: {
        target: number;
        unit: 'TEU' | 'containers';
        period: 'hour' | 'day' | 'week' | 'month';
      };
      equipmentUtilization: {
        target: number; // percentage
        equipmentTypes: string[];
      };
      personnelEfficiency: {
        target: number; // percentage
        measurementCriteria: string[];
      };
    };
    quality: {
      errorRate: {
        target: number; // percentage
        categories: string[];
      };
      customerSatisfaction: {
        target: number; // 1-10 scale
        metrics: string[];
      };
      damagePrevention: {
        target: number; // incidents per period
        period: string;
      };
    };
    safety: {
      incidentRate: {
        target: number;
        period: string;
        severity: string[];
      };
      complianceScore: {
        target: number; // percentage
        standards: string[];
      };
    };
    financial: {
      costTargets: {
        operationalCost: number;
        currency: string;
        period: string;
      };
      revenueTargets: {
        expectedRevenue: number;
        currency: string;
        period: string;
      };
    };
  };

  @ApiProperty({ description: 'Анализ рисков и митигация' })
  @Column({ name: 'risk_analysis', type: 'jsonb' })
  riskAnalysis: {
    identifiedRisks: Array<{
      riskId: string;
      category: 'operational' | 'financial' | 'safety' | 'environmental' | 'regulatory';
      description: string;
      probability: 'low' | 'medium' | 'high';
      impact: 'low' | 'medium' | 'high' | 'critical';
      riskScore: number; // calculated from probability and impact
      mitigationMeasures: Array<{
        measure: string;
        responsibility: string;
        implementationDate: Date;
        status: 'planned' | 'in_progress' | 'completed';
        effectiveness?: number; // percentage
      }>;
      contingencyPlans: Array<{
        scenario: string;
        actions: string[];
        triggerConditions: string[];
        responsibleTeam: string;
      }>;
    }>;
    overallRiskLevel: 'low' | 'medium' | 'high' | 'critical';
    lastAssessment: Date;
    nextReview: Date;
  };

  @ApiProperty({ description: 'Процесс утверждения' })
  @Column({ name: 'approval_workflow', type: 'jsonb', nullable: true })
  approvalWorkflow: {
    requiredApprovals: Array<{
      level: number;
      role: string;
      approverName?: string;
      approverId?: string;
      required: boolean;
    }>;
    approvalHistory: Array<{
      level: number;
      approverName: string;
      approverId: string;
      action: 'approved' | 'rejected' | 'requested_changes';
      timestamp: Date;
      comments?: string;
      conditions?: string[];
    }>;
    currentApprovalLevel: number;
    finalApproval: boolean;
  };

  @ApiProperty({ description: 'Отслеживание выполнения' })
  @Column({ name: 'execution_tracking', type: 'jsonb', nullable: true })
  executionTracking: {
    overallProgress: number; // percentage
    milestoneProgress: number; // percentage
    budgetUtilization: number; // percentage
    scheduleAdherence: number; // percentage
    qualityMetrics: Record<string, number>;
    issuesAndChallenges: Array<{
      issueId: string;
      category: string;
      description: string;
      severity: 'low' | 'medium' | 'high' | 'critical';
      reportedAt: Date;
      reportedBy: string;
      status: 'open' | 'in_progress' | 'resolved' | 'escalated';
      resolution?: string;
      resolvedAt?: Date;
      impact?: string;
    }>;
    changeRequests: Array<{
      changeId: string;
      requestType: 'scope' | 'schedule' | 'resource' | 'budget';
      description: string;
      justification: string;
      requestedBy: string;
      requestedAt: Date;
      impact: string;
      status: 'pending' | 'approved' | 'rejected' | 'implemented';
      reviewedBy?: string;
      reviewedAt?: Date;
      comments?: string;
    }>;
  };

  @ApiProperty({ description: 'Коммуникационный план' })
  @Column({ name: 'communication_plan', type: 'jsonb', nullable: true })
  communicationPlan: {
    stakeholders: Array<{
      stakeholderGroup: string;
      contactPerson?: string;
      communicationMethod: string[];
      frequency: string;
      informationNeeded: string[];
    }>;
    reportingSchedule: Array<{
      reportType: string;
      frequency: string;
      recipients: string[];
      format: string;
      deadline: string;
    }>;
    meetingSchedule: Array<{
      meetingType: string;
      frequency: string;
      participants: string[];
      agenda: string[];
      duration: number; // minutes
    }>;
  };

  @ApiProperty({ description: 'Бюджет и финансы' })
  @Column({ name: 'budget_information', type: 'jsonb', nullable: true })
  budgetInformation: {
    totalBudget: {
      amount: number;
      currency: string;
    };
    budgetBreakdown: {
      personnel: number;
      equipment: number;
      infrastructure: number;
      services: number;
      materials: number;
      contingency: number;
    };
    actualSpending: {
      toDate: number;
      projected: number;
      variance: number; // positive = under budget
    };
    costCenters: Array<{
      costCenter: string;
      allocatedBudget: number;
      spentToDate: number;
      projectedSpend: number;
    }>;
  };

  @ApiProperty({ description: 'Связанные документы' })
  @Column({ name: 'related_documents', type: 'jsonb', nullable: true })
  relatedDocuments: Array<{
    documentType: string;
    documentName: string;
    documentUrl: string;
    version: string;
    uploadedBy: string;
    uploadedAt: Date;
    accessLevel: 'public' | 'internal' | 'restricted' | 'confidential';
  }>;

  @ApiProperty({ description: 'Заметки и комментарии' })
  @Column({ type: 'text', nullable: true })
  notes: string;

  @ApiProperty({ description: 'Причина отмены или приостановки' })
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

  // Вычисляемые поля
  get duration(): number {
    if (!this.startDate || !this.endDate) return 0;
    return Math.ceil((this.endDate.getTime() - this.startDate.getTime()) / (1000 * 60 * 60 * 24));
  }

  get isActive(): boolean {
    return this.status === PlanStatus.ACTIVE;
  }

  get isOverdue(): boolean {
    if (!this.endDate || this.status === PlanStatus.COMPLETED) return false;
    return new Date() > this.endDate;
  }

  get progressPercentage(): number {
    return this.executionTracking?.overallProgress || 0;
  }

  get currentApprovalLevel(): number {
    return this.approvalWorkflow?.currentApprovalLevel || 0;
  }

  get requiresApproval(): boolean {
    return !this.approvalWorkflow?.finalApproval && this.status === PlanStatus.UNDER_REVIEW;
  }

  get budgetUtilization(): number {
    if (!this.budgetInformation?.totalBudget?.amount) return 0;
    const spent = this.budgetInformation.actualSpending?.toDate || 0;
    return (spent / this.budgetInformation.totalBudget.amount) * 100;
  }

  get remainingBudget(): number {
    if (!this.budgetInformation?.totalBudget?.amount) return 0;
    const spent = this.budgetInformation.actualSpending?.toDate || 0;
    return this.budgetInformation.totalBudget.amount - spent;
  }

  get openIssuesCount(): number {
    return this.executionTracking?.issuesAndChallenges?.filter(
      issue => issue.status === 'open' || issue.status === 'in_progress'
    ).length || 0;
  }

  get criticalIssuesCount(): number {
    return this.executionTracking?.issuesAndChallenges?.filter(
      issue => issue.severity === 'critical' && (issue.status === 'open' || issue.status === 'in_progress')
    ).length || 0;
  }
}