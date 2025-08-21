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

export enum ProviderType {
  INTERNAL = 'internal',
  EXTERNAL_CONTRACTOR = 'external_contractor',
  CERTIFIED_PARTNER = 'certified_partner',
  SPECIALIST_VENDOR = 'specialist_vendor',
  EMERGENCY_SERVICE = 'emergency_service',
}

export enum ProviderStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SUSPENDED = 'suspended',
  BLACKLISTED = 'blacklisted',
  PENDING_APPROVAL = 'pending_approval',
  UNDER_REVIEW = 'under_review',
}

export enum CertificationStatus {
  VALID = 'valid',
  EXPIRED = 'expired',
  SUSPENDED = 'suspended',
  PENDING_RENEWAL = 'pending_renewal',
}

@Entity('service_providers', { schema: 'mr_services' })
@Index(['providerType'])
@Index(['status'])
@Index(['performanceRating'])
@Index(['providerCode'], { unique: true })
export class ServiceProvider {
  @ApiProperty({ description: 'Уникальный идентификатор поставщика услуг' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ description: 'Код поставщика', example: 'SP-001' })
  @Column({ name: 'provider_code', type: 'varchar', length: 20, unique: true })
  providerCode: string;

  @ApiProperty({ description: 'Название компании' })
  @Column({ name: 'company_name' })
  companyName: string;

  @ApiProperty({ description: 'Тип поставщика', enum: ProviderType })
  @Column({
    name: 'provider_type',
    type: 'enum',
    enum: ProviderType,
  })
  providerType: ProviderType;

  @ApiProperty({ description: 'Статус поставщика', enum: ProviderStatus })
  @Column({
    type: 'enum',
    enum: ProviderStatus,
    default: ProviderStatus.PENDING_APPROVAL,
  })
  status: ProviderStatus;

  @ApiProperty({ description: 'Контактная информация' })
  @Column({ name: 'contact_information', type: 'jsonb' })
  contactInformation: {
    primaryContact: {
      name: string;
      position: string;
      phone: string;
      email: string;
      mobile?: string;
    };
    billingContact: {
      name: string;
      position: string;
      phone: string;
      email: string;
      address: {
        street: string;
        city: string;
        state: string;
        postalCode: string;
        country: string;
      };
    };
    technicalContact: {
      name: string;
      position: string;
      phone: string;
      email: string;
      mobile: string;
      emergencyPhone?: string;
    };
    emergencyContact?: {
      name: string;
      phone: string;
      availability: string;
    };
  };

  @ApiProperty({ description: 'Физический адрес' })
  @Column({ name: 'physical_address', type: 'jsonb' })
  physicalAddress: {
    street: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
    coordinates?: Point;
    operatingHours: {
      weekdays: { open: string; close: string };
      saturday?: { open: string; close: string };
      sunday?: { open: string; close: string };
    };
    emergencyAvailability: boolean;
  };

  @ApiProperty({ description: 'Предоставляемые услуги' })
  @Column({ name: 'services_offered', type: 'jsonb' })
  servicesOffered: Array<{
    serviceCategory: string;
    serviceType: string;
    description: string;
    specializations: string[];
    equipment: string[];
    certificationRequired: boolean;
    emergencyAvailable: boolean;
    pricing: {
      rateType: 'hourly' | 'fixed' | 'per_unit' | 'negotiable';
      baseRate?: number;
      currency: string;
      minimumCharge?: number;
      emergencyMultiplier?: number;
    };
    qualityStandards: string[];
    warranty: {
      duration: number;
      durationUnit: 'days' | 'months' | 'years';
      coverage: string;
      conditions: string[];
    };
  }>;

  @ApiProperty({ description: 'Сертификации и лицензии' })
  @Column({ name: 'certifications', type: 'jsonb', nullable: true })
  certifications: Array<{
    certificationType: string;
    certificateNumber: string;
    issuingAuthority: string;
    issueDate: Date;
    expiryDate: Date;
    status: CertificationStatus;
    scope: string[];
    documentUrl?: string;
    renewalDate?: Date;
    renewalReminder: boolean;
  }>;

  @ApiProperty({ description: 'Страхование' })
  @Column({ name: 'insurance_information', type: 'jsonb', nullable: true })
  insuranceInformation: {
    generalLiability: {
      provider: string;
      policyNumber: string;
      coverage: number;
      currency: string;
      expiryDate: Date;
      documentUrl?: string;
    };
    professionalIndemnity?: {
      provider: string;
      policyNumber: string;
      coverage: number;
      currency: string;
      expiryDate: Date;
      documentUrl?: string;
    };
    workersCompensation?: {
      provider: string;
      policyNumber: string;
      coverage: number;
      currency: string;
      expiryDate: Date;
      documentUrl?: string;
    };
  };

  @ApiProperty({ description: 'Рейтинг производительности' })
  @Column({ name: 'performance_rating', type: 'decimal', precision: 3, scale: 2, default: 0 })
  performanceRating: number;

  @ApiProperty({ description: 'Показатели производительности' })
  @Column({ name: 'performance_metrics', type: 'jsonb', nullable: true })
  performanceMetrics: {
    qualityScore: number; // 1-10
    timeliness: number; // percentage
    responsiveness: number; // 1-10
    customerSatisfaction: number; // 1-10
    safetyRecord: number; // incidents per job
    completionRate: number; // percentage
    costEffectiveness: number; // 1-10
    communicationRating: number; // 1-10
    jobsCompleted: number;
    totalRevenue: number;
    currency: string;
    lastUpdated: Date;
    evaluationPeriod: {
      startDate: Date;
      endDate: Date;
    };
  };

  @ApiProperty({ description: 'Финансовая информация' })
  @Column({ name: 'financial_information', type: 'jsonb', nullable: true })
  financialInformation: {
    bankingDetails: {
      bankName: string;
      accountNumber: string;
      routingNumber: string;
      accountType: string;
      currency: string;
    };
    taxInformation: {
      taxId: string;
      vatNumber?: string;
      taxStatus: string;
    };
    creditRating?: {
      rating: string;
      ratingAgency: string;
      lastUpdated: Date;
    };
    paymentTerms: {
      standardTerms: string;
      discountTerms?: string;
      penaltyTerms?: string;
    };
  };

  @ApiProperty({ description: 'Договорная информация' })
  @Column({ name: 'contract_information', type: 'jsonb', nullable: true })
  contractInformation: {
    contractType: 'master_service_agreement' | 'individual_contracts' | 'framework_agreement';
    contractNumber?: string;
    startDate?: Date;
    endDate?: Date;
    autoRenewal: boolean;
    renewalPeriod?: number; // months
    terminationClause: string;
    slaRequirements: Array<{
      metric: string;
      target: number;
      unit: string;
      penalty?: string;
    }>;
    documentUrl?: string;
  };

  @ApiProperty({ description: 'Квалификация персонала' })
  @Column({ name: 'staff_qualifications', type: 'jsonb', nullable: true })
  staffQualifications: Array<{
    role: string;
    qualifications: string[];
    certifications: string[];
    experienceYears: number;
    languageSkills: string[];
    securityClearance?: string;
    availability: {
      shift: 'day' | 'night' | '24x7';
      emergencyCall: boolean;
      weekendWork: boolean;
    };
  }>;

  @ApiProperty({ description: 'Оборудование и инструменты' })
  @Column({ name: 'equipment_tools', type: 'jsonb', nullable: true })
  equipmentTools: Array<{
    equipmentType: string;
    make: string;
    model: string;
    year?: number;
    capacity?: string;
    certifications: string[];
    maintenanceStatus: 'current' | 'due' | 'overdue';
    lastMaintenance?: Date;
    nextMaintenance?: Date;
    availability: 'available' | 'in_use' | 'maintenance' | 'unavailable';
  }>;

  @ApiProperty({ description: 'Отзывы и оценки' })
  @Column({ name: 'reviews_feedback', type: 'jsonb', nullable: true })
  reviewsFeedback: Array<{
    reviewId: string;
    reviewDate: Date;
    reviewerName: string;
    jobType: string;
    overallRating: number; // 1-10
    qualityRating: number; // 1-10
    timelinessRating: number; // 1-10
    communicationRating: number; // 1-10
    valueRating: number; // 1-10
    comments: string;
    wouldRecommend: boolean;
    response?: {
      responseDate: Date;
      responseText: string;
    };
  }>;

  @ApiProperty({ description: 'История инцидентов' })
  @Column({ name: 'incident_history', type: 'jsonb', nullable: true })
  incidentHistory: Array<{
    incidentId: string;
    incidentDate: Date;
    incidentType: 'safety' | 'quality' | 'environmental' | 'security' | 'compliance';
    severity: 'minor' | 'moderate' | 'major' | 'critical';
    description: string;
    rootCause: string;
    correctiveActions: string[];
    preventiveActions: string[];
    reportedBy: string;
    investigatedBy: string;
    status: 'open' | 'investigating' | 'resolved' | 'closed';
    resolutionDate?: Date;
    lessonsLearned: string[];
  }>;

  @ApiProperty({ description: 'Документы и файлы' })
  @Column({ name: 'documents', type: 'jsonb', nullable: true })
  documents: Array<{
    documentType: 'contract' | 'certificate' | 'insurance' | 'license' | 'procedure' | 'safety_data';
    documentName: string;
    documentUrl: string;
    uploadDate: Date;
    expiryDate?: Date;
    version: string;
    uploadedBy: string;
    accessLevel: 'public' | 'internal' | 'restricted';
  }>;

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
  get isActive(): boolean {
    return this.status === ProviderStatus.ACTIVE;
  }

  get hasCriticalCertificationsExpiring(): boolean {
    const threeMonthsFromNow = new Date();
    threeMonthsFromNow.setMonth(threeMonthsFromNow.getMonth() + 3);
    
    return this.certifications?.some(cert => 
      cert.status === CertificationStatus.VALID && 
      cert.expiryDate <= threeMonthsFromNow
    ) || false;
  }

  get hasValidInsurance(): boolean {
    const now = new Date();
    return this.insuranceInformation?.generalLiability?.expiryDate > now;
  }

  get averageRating(): number {
    if (!this.reviewsFeedback || this.reviewsFeedback.length === 0) return 0;
    
    const sum = this.reviewsFeedback.reduce((acc, review) => acc + review.overallRating, 0);
    return Math.round((sum / this.reviewsFeedback.length) * 100) / 100;
  }

  get totalJobsCompleted(): number {
    return this.performanceMetrics?.jobsCompleted || 0;
  }

  get isEmergencyProvider(): boolean {
    return this.servicesOffered?.some(service => service.emergencyAvailable) || false;
  }

  get criticalIncidentsCount(): number {
    return this.incidentHistory?.filter(incident => 
      incident.severity === 'critical' && incident.status !== 'closed'
    ).length || 0;
  }
}