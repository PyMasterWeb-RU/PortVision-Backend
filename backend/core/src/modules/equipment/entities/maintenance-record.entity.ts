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

export enum MaintenanceType {
  ROUTINE = 'routine',
  PREVENTIVE = 'preventive',
  CORRECTIVE = 'corrective',
  EMERGENCY = 'emergency',
  INSPECTION = 'inspection',
  CALIBRATION = 'calibration',
  OVERHAUL = 'overhaul',
  REPAIR = 'repair',
  SOFTWARE_UPDATE = 'software_update',
  SAFETY_CHECK = 'safety_check',
}

export enum MaintenanceStatus {
  SCHEDULED = 'scheduled',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  OVERDUE = 'overdue',
  FAILED = 'failed',
  RESCHEDULED = 'rescheduled',
}

export enum MaintenancePriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  CRITICAL = 'critical',
  EMERGENCY = 'emergency',
}

@Entity('maintenance_records', { schema: 'equipment' })
@Index(['equipmentId'])
@Index(['maintenanceType'])
@Index(['status'])
@Index(['priority'])
@Index(['scheduledDate'])
@Index(['completedDate'])
@Index(['performedBy'])
@Index(['workOrderNumber'], { unique: true })
export class MaintenanceRecord {
  @ApiProperty({ description: 'Уникальный идентификатор записи ТО' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ description: 'Номер наряда на работы', example: 'WO-2024-001-MAINT' })
  @Column({ name: 'work_order_number', type: 'varchar', length: 50, unique: true })
  workOrderNumber: string;

  @ApiProperty({ description: 'ID оборудования' })
  @Column({ name: 'equipment_id' })
  equipmentId: string;

  @ApiProperty({ description: 'Тип технического обслуживания', enum: MaintenanceType })
  @Column({
    name: 'maintenance_type',
    type: 'enum',
    enum: MaintenanceType,
  })
  maintenanceType: MaintenanceType;

  @ApiProperty({ description: 'Статус ТО', enum: MaintenanceStatus })
  @Column({
    type: 'enum',
    enum: MaintenanceStatus,
    default: MaintenanceStatus.SCHEDULED,
  })
  status: MaintenanceStatus;

  @ApiProperty({ description: 'Приоритет', enum: MaintenancePriority })
  @Column({
    type: 'enum',
    enum: MaintenancePriority,
    default: MaintenancePriority.NORMAL,
  })
  priority: MaintenancePriority;

  @ApiProperty({ description: 'Название работ' })
  @Column({ name: 'maintenance_title' })
  maintenanceTitle: string;

  @ApiProperty({ description: 'Описание работ' })
  @Column({ type: 'text' })
  description: string;

  @ApiProperty({ description: 'Дата планового ТО' })
  @Column({ name: 'scheduled_date', type: 'timestamp' })
  scheduledDate: Date;

  @ApiProperty({ description: 'Плановая продолжительность в часах' })
  @Column({ name: 'estimated_duration_hours', type: 'decimal', precision: 5, scale: 2 })
  estimatedDurationHours: number;

  @ApiProperty({ description: 'Дата начала работ' })
  @Column({ name: 'started_at', type: 'timestamp', nullable: true })
  startedAt: Date;

  @ApiProperty({ description: 'Дата завершения работ' })
  @Column({ name: 'completed_date', type: 'timestamp', nullable: true })
  completedDate: Date;

  @ApiProperty({ description: 'Фактическая продолжительность в часах' })
  @Column({ name: 'actual_duration_hours', type: 'decimal', precision: 5, scale: 2, nullable: true })
  actualDurationHours: number;

  @ApiProperty({ description: 'ID исполнителя' })
  @Column({ name: 'performed_by', nullable: true })
  performedBy: string;

  @ApiProperty({ description: 'Имя исполнителя' })
  @Column({ name: 'performed_by_name', nullable: true })
  performedByName: string;

  @ApiProperty({ description: 'ID назначившего' })
  @Column({ name: 'assigned_by' })
  assignedBy: string;

  @ApiProperty({ description: 'Имя назначившего' })
  @Column({ name: 'assigned_by_name' })
  assignedByName: string;

  @ApiProperty({ description: 'ID супервайзера/контролера' })
  @Column({ name: 'supervised_by', nullable: true })
  supervisedBy: string;

  @ApiProperty({ description: 'Имя супервайзера' })
  @Column({ name: 'supervised_by_name', nullable: true })
  supervisedByName: string;

  @ApiProperty({ description: 'Внешний подрядчик' })
  @Column({ name: 'external_contractor', nullable: true })
  externalContractor: string;

  @ApiProperty({ description: 'Контактная информация подрядчика' })
  @Column({ name: 'contractor_contact', type: 'jsonb', nullable: true })
  contractorContact: {
    company: string;
    contactPerson: string;
    phone: string;
    email: string;
    address?: string;
    certifications?: string[];
  };

  @ApiProperty({ description: 'Список работ и чек-лист' })
  @Column({ name: 'work_checklist', type: 'jsonb' })
  workChecklist: Array<{
    taskId: string;
    task: string;
    category: string;
    required: boolean;
    completed: boolean;
    completedAt?: Date;
    performedBy?: string;
    notes?: string;
    measurements?: Record<string, any>;
    photos?: string[];
  }>;

  @ApiProperty({ description: 'Используемые материалы и запчасти' })
  @Column({ name: 'materials_used', type: 'jsonb', nullable: true })
  materialsUsed: Array<{
    partNumber: string;
    partName: string;
    quantity: number;
    unit: string;
    cost?: number;
    currency?: string;
    supplier?: string;
    warrantyPeriod?: number;
    serialNumbers?: string[];
    notes?: string;
  }>;

  @ApiProperty({ description: 'Инструменты и оборудование' })
  @Column({ name: 'tools_used', type: 'jsonb', nullable: true })
  toolsUsed: Array<{
    toolId?: string;
    toolName: string;
    toolType: string;
    calibrationRequired: boolean;
    lastCalibration?: Date;
    condition: 'excellent' | 'good' | 'fair' | 'poor';
  }>;

  @ApiProperty({ description: 'Результаты измерений и тестов' })
  @Column({ name: 'test_results', type: 'jsonb', nullable: true })
  testResults: {
    operationalTests: Array<{
      testName: string;
      parameter: string;
      measuredValue: number;
      expectedRange: { min: number; max: number };
      unit: string;
      passed: boolean;
      notes?: string;
    }>;
    safetyTests: Array<{
      testName: string;
      requirement: string;
      result: 'pass' | 'fail' | 'warning';
      details: string;
      correctiveAction?: string;
    }>;
    performanceMetrics: {
      efficiency?: number;
      powerConsumption?: number;
      vibrationLevels?: Record<string, number>;
      temperatureReadings?: Record<string, number>;
      pressureReadings?: Record<string, number>;
      customMetrics?: Record<string, any>;
    };
  };

  @ApiProperty({ description: 'Найденные проблемы и дефекты' })
  @Column({ name: 'issues_found', type: 'jsonb', nullable: true })
  issuesFound: Array<{
    issueId: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    component: string;
    description: string;
    cause?: string;
    actionTaken: string;
    resolved: boolean;
    followUpRequired: boolean;
    followUpDate?: Date;
    photos?: string[];
    costImplication?: number;
  }>;

  @ApiProperty({ description: 'Рекомендации' })
  @Column({ name: 'recommendations', type: 'jsonb', nullable: true })
  recommendations: Array<{
    type: 'immediate' | 'short_term' | 'long_term';
    priority: 'low' | 'medium' | 'high';
    description: string;
    estimatedCost?: number;
    targetDate?: Date;
    responsible?: string;
  }>;

  @ApiProperty({ description: 'Плановые/следующие работы' })
  @Column({ name: 'next_maintenance', type: 'jsonb', nullable: true })
  nextMaintenance: {
    scheduledDate: Date;
    maintenanceType: MaintenanceType;
    estimatedHours: number;
    requiredParts?: string[];
    specialRequirements?: string[];
    notes?: string;
  };

  @ApiProperty({ description: 'Стоимостная информация' })
  @Column({ name: 'cost_information', type: 'jsonb', nullable: true })
  costInformation: {
    laborCost: {
      hours: number;
      hourlyRate: number;
      totalCost: number;
    };
    materialsCost: {
      totalCost: number;
      breakdown: Array<{
        category: string;
        cost: number;
      }>;
    };
    externalServicesCost?: {
      totalCost: number;
      description: string;
    };
    totalCost: number;
    currency: string;
    budgetVariance?: number; // positive = under budget, negative = over budget
  };

  @ApiProperty({ description: 'Сертификаты и документы' })
  @Column({ name: 'certification_data', type: 'jsonb', nullable: true })
  certificationData: {
    certificates: Array<{
      certificateType: string;
      certificateNumber: string;
      issuedBy: string;
      issuedAt: Date;
      validUntil: Date;
      documentUrl?: string;
    }>;
    inspectionReports: Array<{
      reportId: string;
      inspectorName: string;
      inspectionDate: Date;
      passed: boolean;
      reportUrl?: string;
      notes?: string;
    }>;
    warranties: Array<{
      component: string;
      warrantyPeriod: number; // months
      warrantyStart: Date;
      warrantyEnd: Date;
      warrantyProvider: string;
      warrantyTerms?: string;
    }>;
  };

  @ApiProperty({ description: 'Время простоя' })
  @Column({ name: 'downtime_tracking', type: 'jsonb', nullable: true })
  downtimeTracking: {
    plannedDowntime: {
      start: Date;
      end: Date;
      durationHours: number;
    };
    actualDowntime: {
      start?: Date;
      end?: Date;
      durationHours?: number;
    };
    productionImpact: {
      lostProduction?: number;
      lostRevenue?: number;
      affectedOrders?: string[];
    };
  };

  @ApiProperty({ description: 'Соответствие нормативам' })
  @Column({ name: 'compliance_info', type: 'jsonb', nullable: true })
  complianceInfo: {
    regulations: Array<{
      regulationName: string;
      requirement: string;
      compliance: 'compliant' | 'non_compliant' | 'partially_compliant';
      evidence?: string;
      correctiveActions?: string[];
    }>;
    environmentalImpact: {
      wasteGenerated?: Array<{
        type: string;
        quantity: number;
        unit: string;
        disposalMethod: string;
      }>;
      emissionsChecked?: boolean;
      noiseLevel?: number;
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

  // Relations
  @ManyToOne(() => Equipment, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'equipment_id' })
  equipment: Equipment;
}