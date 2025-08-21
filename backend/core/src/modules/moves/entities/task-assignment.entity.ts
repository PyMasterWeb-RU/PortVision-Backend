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
import { WorkOrder } from './work-order.entity';

export enum AssignmentStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  REJECTED = 'rejected',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  REASSIGNED = 'reassigned',
}

export enum AssignmentType {
  MANUAL = 'manual',
  AUTOMATIC = 'automatic',
  EMERGENCY = 'emergency',
  TEMPORARY = 'temporary',
  PREFERRED = 'preferred',
}

@Entity('task_assignments', { schema: 'moves' })
@Index(['taskId'])
@Index(['workOrderId'])
@Index(['operatorId'])
@Index(['equipmentId'])
@Index(['status'])
@Index(['assignedAt'])
@Index(['scheduledStartAt'])
export class TaskAssignment {
  @ApiProperty({ description: 'Уникальный идентификатор назначения' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ description: 'ID задачи' })
  @Column({ name: 'task_id' })
  taskId: string;

  @ApiProperty({ description: 'Задача', type: () => MoveTask })
  @ManyToOne(() => MoveTask, { eager: true })
  @JoinColumn({ name: 'task_id' })
  task: MoveTask;

  @ApiProperty({ description: 'ID рабочего наряда' })
  @Column({ name: 'work_order_id', nullable: true })
  workOrderId: string;

  @ApiProperty({ description: 'Рабочий наряд', type: () => WorkOrder })
  @ManyToOne(() => WorkOrder)
  @JoinColumn({ name: 'work_order_id' })
  workOrder: WorkOrder;

  @ApiProperty({ description: 'ID оператора' })
  @Column({ name: 'operator_id' })
  operatorId: string;

  @ApiProperty({ description: 'Имя оператора' })
  @Column({ name: 'operator_name' })
  operatorName: string;

  @ApiProperty({ description: 'ID оборудования' })
  @Column({ name: 'equipment_id', nullable: true })
  equipmentId: string;

  @ApiProperty({ description: 'Номер оборудования' })
  @Column({ name: 'equipment_number', nullable: true })
  equipmentNumber: string;

  @ApiProperty({ description: 'Тип оборудования' })
  @Column({ name: 'equipment_type', nullable: true })
  equipmentType: string;

  @ApiProperty({ description: 'Статус назначения', enum: AssignmentStatus })
  @Column({
    type: 'enum',
    enum: AssignmentStatus,
    default: AssignmentStatus.PENDING,
  })
  status: AssignmentStatus;

  @ApiProperty({ description: 'Тип назначения', enum: AssignmentType })
  @Column({
    name: 'assignment_type',
    type: 'enum',
    enum: AssignmentType,
    default: AssignmentType.MANUAL,
  })
  assignmentType: AssignmentType;

  @ApiProperty({ description: 'ID назначившего пользователя' })
  @Column({ name: 'assigned_by' })
  assignedBy: string;

  @ApiProperty({ description: 'Имя назначившего пользователя' })
  @Column({ name: 'assigned_by_name' })
  assignedByName: string;

  @ApiProperty({ description: 'Время назначения' })
  @Column({ name: 'assigned_at', type: 'timestamp' })
  assignedAt: Date;

  @ApiProperty({ description: 'Планируемое время начала' })
  @Column({ name: 'scheduled_start_at', type: 'timestamp' })
  scheduledStartAt: Date;

  @ApiProperty({ description: 'Планируемое время завершения' })
  @Column({ name: 'scheduled_end_at', type: 'timestamp' })
  scheduledEndAt: Date;

  @ApiProperty({ description: 'Фактическое время принятия' })
  @Column({ name: 'accepted_at', type: 'timestamp', nullable: true })
  acceptedAt: Date;

  @ApiProperty({ description: 'Фактическое время начала' })
  @Column({ name: 'started_at', type: 'timestamp', nullable: true })
  startedAt: Date;

  @ApiProperty({ description: 'Фактическое время завершения' })
  @Column({ name: 'completed_at', type: 'timestamp', nullable: true })
  completedAt: Date;

  @ApiProperty({ description: 'Критерии назначения' })
  @Column({ name: 'assignment_criteria', type: 'jsonb', nullable: true })
  assignmentCriteria: {
    operatorSkills: string[];
    equipmentCapabilities: string[];
    workloadBalance: number; // 0-1
    proximityScore: number; // 0-1
    costEfficiency: number; // 0-1
    timeEfficiency: number; // 0-1
    preferenceScore: number; // 0-1
    totalScore: number; // 0-1
    alternativeOptions?: Array<{
      operatorId: string;
      operatorName: string;
      equipmentId?: string;
      equipmentNumber?: string;
      score: number;
      reason: string;
    }>;
  };

  @ApiProperty({ description: 'Квалификация оператора' })
  @Column({ name: 'operator_qualifications', type: 'jsonb' })
  operatorQualifications: {
    skills: string[];
    certifications: Array<{
      type: string;
      level: string;
      validUntil: Date;
      issuer: string;
    }>;
    experience: {
      totalHours: number;
      taskTypeExperience: Record<string, number>; // task type -> hours
      equipmentExperience: Record<string, number>; // equipment type -> hours
    };
    performanceHistory: {
      completionRate: number; // percentage
      onTimeRate: number; // percentage
      qualityScore: number; // 1-10
      safetyRecord: {
        incidents: number;
        lastIncidentDate?: Date;
        safetyTrainingDate: Date;
      };
    };
    availability: {
      shiftPattern: string;
      workingHours: { from: string; to: string }[];
      overtimeAvailable: boolean;
      currentWorkload: number; // percentage
    };
  };

  @ApiProperty({ description: 'Характеристики оборудования' })
  @Column({ name: 'equipment_specifications', type: 'jsonb', nullable: true })
  equipmentSpecifications: {
    capabilities: {
      maxCapacity: number;
      maxReach: number;
      maxHeight: number;
      operatingSpeed: number;
      fuelType: string;
      attachments: string[];
    };
    condition: {
      status: 'operational' | 'maintenance_required' | 'out_of_service';
      lastMaintenance: Date;
      nextMaintenance: Date;
      fuelLevel: number; // percentage
      operatingHours: number;
      efficiency: number; // percentage
    };
    location: {
      currentPosition: {
        latitude: number;
        longitude: number;
        timestamp: Date;
      };
      proximityToTask: {
        distance: number; // meters
        estimatedTravelTime: number; // minutes
      };
    };
    operatorCompatibility: {
      requiredSkills: string[];
      trainingRequired: boolean;
      familiarOperators: string[];
    };
  };

  @ApiProperty({ description: 'Инструкции по выполнению' })
  @Column({ type: 'jsonb', nullable: true })
  instructions: {
    generalInstructions: string[];
    safetyInstructions: string[];
    qualityRequirements: string[];
    specialProcedures: string[];
    checkpoints: Array<{
      checkpoint: string;
      location?: string;
      expectedTime?: Date;
      verificationMethod: 'visual' | 'photo' | 'signature' | 'scan';
      required: boolean;
    }>;
    documentation: {
      required: string[];
      templates: string[];
      submissionMethod: 'digital' | 'paper' | 'both';
    };
    communication: {
      reportingFrequency: string;
      escalationProcedure: string[];
      emergencyContacts: Array<{
        name: string;
        role: string;
        phone: string;
        radio?: string;
      }>;
    };
  };

  @ApiProperty({ description: 'Отслеживание выполнения' })
  @Column({ name: 'execution_tracking', type: 'jsonb', nullable: true })
  executionTracking: {
    location: {
      trackingEnabled: boolean;
      updateInterval: number; // seconds
      positions: Array<{
        timestamp: Date;
        latitude: number;
        longitude: number;
        accuracy: number;
        activity: string;
      }>;
    };
    progress: {
      currentPhase: string;
      percentComplete: number;
      milestonesReached: string[];
      nextMilestone: string;
      estimatedCompletion: Date;
    };
    communication: Array<{
      timestamp: Date;
      type: 'status_update' | 'issue_report' | 'request_help' | 'completion';
      message: string;
      sender: string;
      urgent: boolean;
      acknowledged: boolean;
    }>;
    issues: Array<{
      issueId: string;
      timestamp: Date;
      type: 'delay' | 'equipment_problem' | 'safety_concern' | 'quality_issue';
      severity: 'low' | 'medium' | 'high' | 'critical';
      description: string;
      photos?: string[];
      resolution?: string;
      resolvedAt?: Date;
    }>;
  };

  @ApiProperty({ description: 'Результаты выполнения' })
  @Column({ type: 'jsonb', nullable: true })
  results: {
    completion: {
      successful: boolean;
      completionTime: Date;
      durationMinutes: number;
      qualityScore: number; // 1-10
      customerSatisfaction?: number; // 1-10
    };
    performance: {
      timeEfficiency: number; // percentage vs planned
      qualityMeasures: Record<string, number>;
      safetyCompliance: boolean;
      costEfficiency: number; // percentage vs budget
    };
    feedback: {
      operatorFeedback: string;
      supervisorFeedback: string;
      customerFeedback?: string;
      improvementSuggestions: string[];
    };
    documentation: {
      photos: string[];
      reports: string[];
      certificates: string[];
      signatures: string[];
    };
  };

  @ApiProperty({ description: 'Причина отклонения/переназначения' })
  @Column({ name: 'rejection_reason', type: 'text', nullable: true })
  rejectionReason: string;

  @ApiProperty({ description: 'Заметки назначения' })
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