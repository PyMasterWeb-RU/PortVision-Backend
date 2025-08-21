import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { Point } from 'geojson';

export enum MaintenanceRequestType {
  CONTAINER_REPAIR = 'container_repair',
  CONTAINER_CLEANING = 'container_cleaning',
  CONTAINER_INSPECTION = 'container_inspection',
  SPECIALIZED_HANDLING = 'specialized_handling',
  CERTIFICATION = 'certification',
  MODIFICATION = 'modification',
  RECONDITIONING = 'reconditioning',
  DISPOSAL = 'disposal',
}

export enum RequestStatus {
  PENDING = 'pending',
  QUOTED = 'quoted',
  QUOTE_ACCEPTED = 'quote_accepted',
  QUOTE_REJECTED = 'quote_rejected',
  SCHEDULED = 'scheduled',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  ON_HOLD = 'on_hold',
  CANCELLED = 'cancelled',
  REJECTED = 'rejected',
}

export enum RequestPriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  URGENT = 'urgent',
  EMERGENCY = 'emergency',
}

export enum RequestSource {
  CLIENT_PORTAL = 'client_portal',
  PHONE = 'phone',
  EMAIL = 'email',
  MOBILE_APP = 'mobile_app',
  SYSTEM_AUTOMATIC = 'system_automatic',
  TERMINAL_OPERATOR = 'terminal_operator',
  DAMAGE_REPORT = 'damage_report',
}

@Entity('maintenance_requests', { schema: 'mr_services' })
@Index(['requestType'])
@Index(['status'])
@Index(['priority'])
@Index(['scheduledDate'])
@Index(['clientId'])
@Index(['containerId'])
@Index(['requestNumber'], { unique: true })
@Index(['workOrderNumber'], { unique: true })
export class MaintenanceRequest {
  @ApiProperty({ description: 'Уникальный идентификатор заявки' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ description: 'Номер заявки', example: 'MR-2024-001234' })
  @Column({ name: 'request_number', type: 'varchar', length: 50, unique: true })
  requestNumber: string;

  @ApiProperty({ description: 'Номер наряда', example: 'WO-2024-001234' })
  @Column({ name: 'work_order_number', type: 'varchar', length: 50, unique: true, nullable: true })
  workOrderNumber: string;

  @ApiProperty({ description: 'Тип заявки', enum: MaintenanceRequestType })
  @Column({
    name: 'request_type',
    type: 'enum',
    enum: MaintenanceRequestType,
  })
  requestType: MaintenanceRequestType;

  @ApiProperty({ description: 'Статус заявки', enum: RequestStatus })
  @Column({
    type: 'enum',
    enum: RequestStatus,
    default: RequestStatus.PENDING,
  })
  status: RequestStatus;

  @ApiProperty({ description: 'Приоритет заявки', enum: RequestPriority })
  @Column({
    type: 'enum',
    enum: RequestPriority,
    default: RequestPriority.NORMAL,
  })
  priority: RequestPriority;

  @ApiProperty({ description: 'Источник заявки', enum: RequestSource })
  @Column({
    name: 'request_source',
    type: 'enum',
    enum: RequestSource,
  })
  requestSource: RequestSource;

  @ApiProperty({ description: 'ID клиента' })
  @Column({ name: 'client_id' })
  clientId: string;

  @ApiProperty({ description: 'Название клиента' })
  @Column({ name: 'client_name' })
  clientName: string;

  @ApiProperty({ description: 'Контактное лицо клиента' })
  @Column({ name: 'client_contact' })
  clientContact: string;

  @ApiProperty({ description: 'Номер контейнера' })
  @Column({ name: 'container_id' })
  containerId: string;

  @ApiProperty({ description: 'Номер контейнера' })
  @Column({ name: 'container_number' })
  containerNumber: string;

  @ApiProperty({ description: 'Тип контейнера' })
  @Column({ name: 'container_type' })
  containerType: string;

  @ApiProperty({ description: 'Размер контейнера' })
  @Column({ name: 'container_size' })
  containerSize: string;

  @ApiProperty({ description: 'Текущая позиция контейнера' })
  @Column({ name: 'container_location' })
  containerLocation: string;

  @ApiProperty({ description: 'Координаты позиции контейнера' })
  @Column({
    name: 'container_coordinates',
    type: 'geography',
    spatialFeatureType: 'Point',
    srid: 4326,
    nullable: true,
  })
  containerCoordinates: Point;

  @ApiProperty({ description: 'Описание проблемы или работ' })
  @Column({ type: 'text' })
  description: string;

  @ApiProperty({ description: 'Детальная информация о повреждениях' })
  @Column({ name: 'damage_details', type: 'jsonb', nullable: true })
  damageDetails: {
    damageType: string[];
    severity: 'minor' | 'moderate' | 'major' | 'critical';
    affectedParts: Array<{
      partName: string;
      damageDescription: string;
      replacementRequired: boolean;
      repairMethod: string;
    }>;
    photos: Array<{
      photoUrl: string;
      description: string;
      timestamp: Date;
      takenBy: string;
    }>;
    inspection: {
      inspectorId: string;
      inspectorName: string;
      inspectionDate: Date;
      findings: string;
      recommendations: string[];
    };
  };

  @ApiProperty({ description: 'Информация о квоте' })
  @Column({ name: 'quote_information', type: 'jsonb', nullable: true })
  quoteInformation: {
    quoteNumber: string;
    laborCosts: {
      skillCategory: string;
      hours: number;
      rate: number;
      total: number;
    }[];
    materialCosts: {
      partNumber: string;
      description: string;
      quantity: number;
      unitPrice: number;
      total: number;
    }[];
    additionalServices: {
      service: string;
      description: string;
      cost: number;
    }[];
    subtotal: number;
    taxes: number;
    totalAmount: number;
    currency: string;
    validUntil: Date;
    quotedBy: string;
    quotedAt: Date;
    acceptedBy?: string;
    acceptedAt?: Date;
    rejectionReason?: string;
  };

  @ApiProperty({ description: 'Планирование работ' })
  @Column({ name: 'work_scheduling', type: 'jsonb', nullable: true })
  workScheduling: {
    estimatedDuration: number; // hours
    requiredSkills: string[];
    requiredEquipment: string[];
    workLocation: string;
    workLocationCoordinates?: Point;
    specialRequirements: string[];
    safetyPrecautions: string[];
    environmentalConsiderations: string[];
    clientAvailability: {
      preferredDates: Date[];
      timeWindows: Array<{
        startTime: string;
        endTime: string;
        days: string[];
      }>;
      contactMethod: string;
      contactDetails: string;
    };
  };

  @ApiProperty({ description: 'Назначенная команда' })
  @Column({ name: 'assigned_team', type: 'jsonb', nullable: true })
  assignedTeam: {
    supervisor: {
      operatorId: string;
      operatorName: string;
      qualifications: string[];
    };
    technicians: Array<{
      operatorId: string;
      operatorName: string;
      role: string;
      specialization: string[];
      experience: number; // years
    }>;
    equipment: Array<{
      equipmentId: string;
      equipmentNumber: string;
      equipmentType: string;
      reservationStatus: 'reserved' | 'confirmed' | 'in_use';
    }>;
  };

  @ApiProperty({ description: 'Плановая дата начала работ' })
  @Column({ name: 'scheduled_date', type: 'timestamp', nullable: true })
  scheduledDate: Date;

  @ApiProperty({ description: 'Плановое время завершения' })
  @Column({ name: 'scheduled_completion', type: 'timestamp', nullable: true })
  scheduledCompletion: Date;

  @ApiProperty({ description: 'Фактическая дата начала работ' })
  @Column({ name: 'actual_start_date', type: 'timestamp', nullable: true })
  actualStartDate: Date;

  @ApiProperty({ description: 'Фактическая дата завершения' })
  @Column({ name: 'actual_completion_date', type: 'timestamp', nullable: true })
  actualCompletionDate: Date;

  @ApiProperty({ description: 'Отчет о выполненных работах' })
  @Column({ name: 'work_report', type: 'jsonb', nullable: true })
  workReport: {
    workPerformed: Array<{
      taskType: string;
      description: string;
      completedBy: string;
      duration: number; // hours
      qualityRating: number; // 1-10
    }>;
    materialsUsed: Array<{
      partNumber: string;
      description: string;
      quantityUsed: number;
      wasteGenerated: number;
      supplier: string;
    }>;
    qualityControl: {
      inspectorId: string;
      inspectorName: string;
      inspectionDate: Date;
      inspectionResult: 'passed' | 'failed' | 'conditional';
      defectsFound: string[];
      correctiveActions: string[];
      finalApproval: boolean;
    };
    clientAcceptance: {
      acceptedBy: string;
      acceptanceDate: Date;
      clientSignature: string;
      clientComments: string;
      satisfactionRating: number; // 1-10
    };
    photos: Array<{
      photoUrl: string;
      description: string;
      photoType: 'before' | 'during' | 'after' | 'problem' | 'solution';
      timestamp: Date;
      takenBy: string;
    }>;
  };

  @ApiProperty({ description: 'Информация о выставлении счета' })
  @Column({ name: 'billing_information', type: 'jsonb', nullable: true })
  billingInformation: {
    invoiceNumber: string;
    invoiceDate: Date;
    actualCosts: {
      laborCosts: number;
      materialCosts: number;
      additionalCharges: number;
      discounts: number;
    };
    totalAmount: number;
    currency: string;
    paymentTerms: string;
    paymentStatus: 'pending' | 'paid' | 'overdue' | 'disputed';
    paymentDate?: Date;
    paymentMethod?: string;
  };

  @ApiProperty({ description: 'Связанные документы' })
  @Column({ name: 'related_documents', type: 'jsonb', nullable: true })
  relatedDocuments: Array<{
    documentType: 'quote' | 'work_order' | 'invoice' | 'photo' | 'certificate' | 'report' | 'contract';
    documentName: string;
    documentUrl: string;
    uploadedBy: string;
    uploadedAt: Date;
    fileSize: number;
    mimeType: string;
  }>;

  @ApiProperty({ description: 'История статусов' })
  @Column({ name: 'status_history', type: 'jsonb', nullable: true })
  statusHistory: Array<{
    status: RequestStatus;
    changedBy: string;
    changedAt: Date;
    reason: string;
    comments?: string;
  }>;

  @ApiProperty({ description: 'Коммуникации с клиентом' })
  @Column({ name: 'client_communications', type: 'jsonb', nullable: true })
  clientCommunications: Array<{
    communicationType: 'email' | 'phone' | 'sms' | 'portal' | 'in_person';
    direction: 'inbound' | 'outbound';
    subject: string;
    content: string;
    sentBy: string;
    receivedBy: string;
    timestamp: Date;
    attachments?: string[];
    status: 'sent' | 'delivered' | 'read' | 'replied';
  }>;

  @ApiProperty({ description: 'Причина отклонения или отмены' })
  @Column({ name: 'cancellation_reason', nullable: true })
  cancellationReason: string;

  @ApiProperty({ description: 'Примечания' })
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

  // Вычисляемые поля
  get isOverdue(): boolean {
    if (!this.scheduledCompletion || this.status === RequestStatus.COMPLETED) return false;
    return new Date() > this.scheduledCompletion;
  }

  get actualDuration(): number {
    if (!this.actualStartDate || !this.actualCompletionDate) return 0;
    return Math.round((this.actualCompletionDate.getTime() - this.actualStartDate.getTime()) / (1000 * 60 * 60));
  }

  get plannedDuration(): number {
    if (!this.scheduledDate || !this.scheduledCompletion) return 0;
    return Math.round((this.scheduledCompletion.getTime() - this.scheduledDate.getTime()) / (1000 * 60 * 60));
  }

  get durationVariance(): number {
    if (!this.actualDuration || !this.plannedDuration) return 0;
    return this.actualDuration - this.plannedDuration;
  }

  get isQuoteRequired(): boolean {
    return [
      MaintenanceRequestType.CONTAINER_REPAIR,
      MaintenanceRequestType.MODIFICATION,
      MaintenanceRequestType.RECONDITIONING,
    ].includes(this.requestType);
  }

  get isCompleted(): boolean {
    return this.status === RequestStatus.COMPLETED;
  }

  get isInProgress(): boolean {
    return [
      RequestStatus.SCHEDULED,
      RequestStatus.IN_PROGRESS,
    ].includes(this.status);
  }

  get currentCost(): number {
    return this.quoteInformation?.totalAmount || 0;
  }

  get hasOpenCommunications(): boolean {
    return this.clientCommunications?.some(comm => 
      comm.direction === 'inbound' && comm.status !== 'replied'
    ) || false;
  }
}