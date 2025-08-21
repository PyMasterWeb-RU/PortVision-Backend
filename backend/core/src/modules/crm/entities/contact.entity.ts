import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

export enum ContactType {
  CLIENT = 'client',
  PROSPECT = 'prospect',
  SUPPLIER = 'supplier',
  PARTNER = 'partner',
  VENDOR = 'vendor',
  CONTRACTOR = 'contractor',
  GOVERNMENT = 'government',
  OTHER = 'other',
}

export enum ContactStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  LEAD = 'lead',
  QUALIFIED = 'qualified',
  CONVERTED = 'converted',
  BLOCKED = 'blocked',
  ARCHIVED = 'archived',
}

export enum LeadSource {
  WEBSITE = 'website',
  PHONE_CALL = 'phone_call',
  EMAIL = 'email',
  REFERRAL = 'referral',
  TRADE_SHOW = 'trade_show',
  ADVERTISEMENT = 'advertisement',
  SOCIAL_MEDIA = 'social_media',
  COLD_CALL = 'cold_call',
  EXISTING_CLIENT = 'existing_client',
  PARTNER = 'partner',
  OTHER = 'other',
}

export enum Industry {
  SHIPPING = 'shipping',
  LOGISTICS = 'logistics',
  MANUFACTURING = 'manufacturing',
  RETAIL = 'retail',
  AUTOMOTIVE = 'automotive',
  CHEMICALS = 'chemicals',
  FOOD_BEVERAGE = 'food_beverage',
  TEXTILES = 'textiles',
  ELECTRONICS = 'electronics',
  CONSTRUCTION = 'construction',
  ENERGY = 'energy',
  PHARMACEUTICALS = 'pharmaceuticals',
  AGRICULTURE = 'agriculture',
  MINING = 'mining',
  OTHER = 'other',
}

@Entity('contacts', { schema: 'crm' })
@Index(['contactType'])
@Index(['status'])
@Index(['industry'])
@Index(['leadSource'])
@Index(['assignedTo'])
@Index(['companyName'])
@Index(['email'])
@Index(['phone'])
export class Contact {
  @ApiProperty({ description: 'Уникальный идентификатор контакта' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ description: 'Тип контакта', enum: ContactType })
  @Column({
    name: 'contact_type',
    type: 'enum',
    enum: ContactType,
  })
  contactType: ContactType;

  @ApiProperty({ description: 'Статус контакта', enum: ContactStatus })
  @Column({
    type: 'enum',
    enum: ContactStatus,
    default: ContactStatus.LEAD,
  })
  status: ContactStatus;

  @ApiProperty({ description: 'Источник лида', enum: LeadSource })
  @Column({
    name: 'lead_source',
    type: 'enum',
    enum: LeadSource,
    nullable: true,
  })
  leadSource: LeadSource;

  @ApiProperty({ description: 'Отрасль', enum: Industry })
  @Column({
    type: 'enum',
    enum: Industry,
    nullable: true,
  })
  industry: Industry;

  @ApiProperty({ description: 'Название компании' })
  @Column({ name: 'company_name' })
  companyName: string;

  @ApiProperty({ description: 'Регистрационный номер компании' })
  @Column({ name: 'registration_number', nullable: true })
  registrationNumber: string;

  @ApiProperty({ description: 'Налоговый ID' })
  @Column({ name: 'tax_id', nullable: true })
  taxId: string;

  @ApiProperty({ description: 'Основная контактная информация' })
  @Column({ name: 'primary_contact', type: 'jsonb' })
  primaryContact: {
    firstName: string;
    lastName: string;
    position: string;
    department: string;
    email: string;
    phone: string;
    mobile?: string;
    directLine?: string;
    extension?: string;
    preferredContactMethod: 'email' | 'phone' | 'mobile';
    timezone: string;
    language: string;
  };

  @ApiProperty({ description: 'Дополнительные контакты' })
  @Column({ name: 'additional_contacts', type: 'jsonb', nullable: true })
  additionalContacts: Array<{
    contactId: string;
    firstName: string;
    lastName: string;
    position: string;
    department: string;
    email: string;
    phone?: string;
    mobile?: string;
    role: 'decision_maker' | 'influencer' | 'technical' | 'financial' | 'operations' | 'other';
    isPrimaryContact: boolean;
    notes?: string;
  }>;

  @ApiProperty({ description: 'Адресная информация' })
  @Column({ name: 'address_information', type: 'jsonb' })
  addressInformation: {
    headquarters: {
      street: string;
      city: string;
      state: string;
      postalCode: string;
      country: string;
      coordinates?: {
        latitude: number;
        longitude: number;
      };
    };
    billingAddress?: {
      street: string;
      city: string;
      state: string;
      postalCode: string;
      country: string;
      sameAsHeadquarters: boolean;
    };
    shippingAddress?: {
      street: string;
      city: string;
      state: string;
      postalCode: string;
      country: string;
      sameAsHeadquarters: boolean;
    };
    operatingLocations?: Array<{
      locationName: string;
      locationType: 'office' | 'warehouse' | 'factory' | 'port' | 'terminal' | 'other';
      street: string;
      city: string;
      state: string;
      postalCode: string;
      country: string;
      isPrimary: boolean;
    }>;
  };

  @ApiProperty({ description: 'Информация о компании' })
  @Column({ name: 'company_information', type: 'jsonb', nullable: true })
  companyInformation: {
    foundedYear?: number;
    employeeCount?: number;
    annualRevenue?: {
      amount: number;
      currency: string;
      year: number;
    };
    website?: string;
    socialMedia?: {
      linkedin?: string;
      facebook?: string;
      twitter?: string;
      youtube?: string;
    };
    description?: string;
    businessModel: 'b2b' | 'b2c' | 'b2b2c' | 'marketplace' | 'other';
    publiclyTraded: boolean;
    stockSymbol?: string;
    parentCompany?: string;
    subsidiaries?: string[];
  };

  @ApiProperty({ description: 'Логистическая информация' })
  @Column({ name: 'logistics_information', type: 'jsonb', nullable: true })
  logisticsInformation: {
    shippingVolume?: {
      containersTEU: number;
      period: 'monthly' | 'quarterly' | 'annually';
      growthRate?: number;
    };
    cargoTypes: string[];
    tradeRoutes: Array<{
      origin: string;
      destination: string;
      frequency: string;
      volume: number;
    }>;
    currentProviders?: Array<{
      providerName: string;
      serviceType: string;
      marketShare: number;
      contractExpiry?: Date;
      satisfactionLevel: number; // 1-10
    }>;
    requirements: Array<{
      serviceType: string;
      priority: 'high' | 'medium' | 'low';
      description: string;
    }>;
    budgetRange?: {
      min: number;
      max: number;
      currency: string;
      period: 'monthly' | 'quarterly' | 'annually';
    };
  };

  @ApiProperty({ description: 'Назначенный менеджер' })
  @Column({ name: 'assigned_to', nullable: true })
  assignedTo: string;

  @ApiProperty({ description: 'Имя назначенного менеджера' })
  @Column({ name: 'assigned_to_name', nullable: true })
  assignedToName: string;

  @ApiProperty({ description: 'Команда продаж' })
  @Column({ name: 'sales_team', type: 'jsonb', nullable: true })
  salesTeam: Array<{
    memberId: string;
    memberName: string;
    role: 'account_manager' | 'sales_rep' | 'technical_consultant' | 'support_specialist';
    isPrimary: boolean;
  }>;

  @ApiProperty({ description: 'История взаимодействий' })
  @Column({ name: 'interaction_history', type: 'jsonb', nullable: true })
  interactionHistory: Array<{
    interactionId: string;
    interactionType: 'call' | 'email' | 'meeting' | 'visit' | 'demo' | 'proposal' | 'contract' | 'support';
    subject: string;
    description: string;
    outcome: string;
    followUpRequired: boolean;
    followUpDate?: Date;
    contactedBy: string;
    contactedPerson: string;
    duration?: number; // minutes
    location?: string;
    attachments?: string[];
    createdAt: Date;
  }>;

  @ApiProperty({ description: 'Информация о продажах' })
  @Column({ name: 'sales_information', type: 'jsonb', nullable: true })
  salesInformation: {
    leadScore: number; // 0-100
    qualificationLevel: 'unqualified' | 'marketing_qualified' | 'sales_qualified' | 'sales_accepted';
    pipeline: {
      stage: 'prospecting' | 'qualification' | 'needs_analysis' | 'proposal' | 'negotiation' | 'closed_won' | 'closed_lost';
      probability: number; // 0-100
      expectedValue: number;
      currency: string;
      expectedCloseDate?: Date;
      lastStageUpdate: Date;
    };
    competitors?: Array<{
      competitorName: string;
      strengths: string[];
      weaknesses: string[];
      marketPosition: 'leader' | 'challenger' | 'follower' | 'niche';
    }>;
    decisionMakingProcess: {
      timeframe: string;
      budget: number;
      authority: string;
      needs: string[];
    };
  };

  @ApiProperty({ description: 'Документы и файлы' })
  @Column({ name: 'documents', type: 'jsonb', nullable: true })
  documents: Array<{
    documentId: string;
    documentType: 'contract' | 'proposal' | 'presentation' | 'certificate' | 'license' | 'financial' | 'other';
    documentName: string;
    documentUrl: string;
    uploadedBy: string;
    uploadedAt: Date;
    accessLevel: 'public' | 'internal' | 'restricted';
    tags: string[];
  }>;

  @ApiProperty({ description: 'Задачи и напоминания' })
  @Column({ name: 'tasks_reminders', type: 'jsonb', nullable: true })
  tasksReminders: Array<{
    taskId: string;
    taskType: 'follow_up' | 'call' | 'email' | 'meeting' | 'proposal' | 'contract_review' | 'other';
    title: string;
    description: string;
    assignedTo: string;
    dueDate: Date;
    priority: 'low' | 'medium' | 'high' | 'urgent';
    status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
    completedAt?: Date;
    notes?: string;
  }>;

  @ApiProperty({ description: 'Предпочтения и настройки' })
  @Column({ name: 'preferences', type: 'jsonb', nullable: true })
  preferences: {
    communicationPreferences: {
      preferredLanguage: string;
      preferredContactTime: string;
      preferredContactMethod: 'email' | 'phone' | 'meeting' | 'video_call';
      frequency: 'daily' | 'weekly' | 'bi_weekly' | 'monthly' | 'quarterly';
      doNotContact: boolean;
      unsubscribed: boolean;
    };
    businessPreferences: {
      paymentTerms: string;
      currency: string;
      invoiceDelivery: 'email' | 'portal' | 'mail';
      reportingRequirements: string[];
    };
    servicePreferences: {
      preferredServiceTypes: string[];
      serviceLevel: 'standard' | 'premium' | 'enterprise';
      specialRequirements: string[];
    };
  };

  @ApiProperty({ description: 'Теги и метки' })
  @Column({ name: 'tags', type: 'simple-array', nullable: true })
  tags: string[];

  @ApiProperty({ description: 'Оценка и рейтинг' })
  @Column({ name: 'rating_scoring', type: 'jsonb', nullable: true })
  ratingScoring: {
    creditRating?: {
      rating: string;
      ratingAgency: string;
      lastUpdated: Date;
    };
    riskAssessment: {
      riskLevel: 'low' | 'medium' | 'high' | 'critical';
      factors: string[];
      lastAssessed: Date;
    };
    businessScore: {
      financialStability: number; // 1-10
      growthPotential: number; // 1-10
      strategicValue: number; // 1-10
      relationshipQuality: number; // 1-10
      overallScore: number; // calculated average
    };
  };

  @ApiProperty({ description: 'Заметки' })
  @Column({ type: 'text', nullable: true })
  notes: string;

  @ApiProperty({ description: 'Внутренние заметки' })
  @Column({ name: 'internal_notes', type: 'text', nullable: true })
  internalNotes: string;

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
    return this.status === ContactStatus.ACTIVE;
  }

  get isLead(): boolean {
    return [ContactStatus.LEAD, ContactStatus.QUALIFIED].includes(this.status);
  }

  get isClient(): boolean {
    return this.contactType === ContactType.CLIENT && this.status === ContactStatus.CONVERTED;
  }

  get currentPipelineStage(): string {
    return this.salesInformation?.pipeline?.stage || 'prospecting';
  }

  get leadScore(): number {
    return this.salesInformation?.leadScore || 0;
  }

  get expectedValue(): number {
    return this.salesInformation?.pipeline?.expectedValue || 0;
  }

  get overallBusinessScore(): number {
    return this.ratingScoring?.businessScore?.overallScore || 0;
  }

  get primaryContactEmail(): string {
    return this.primaryContact?.email;
  }

  get primaryContactPhone(): string {
    return this.primaryContact?.phone;
  }

  get fullCompanyName(): string {
    return this.companyName;
  }

  get hasHighPotential(): boolean {
    return this.leadScore >= 70 && this.overallBusinessScore >= 7;
  }

  get requiresFollowUp(): boolean {
    const hasOpenTasks = this.tasksReminders?.some(task => 
      task.status === 'pending' && new Date(task.dueDate) <= new Date()
    );
    const hasFollowUpInteraction = this.interactionHistory?.some(interaction => 
      interaction.followUpRequired && 
      interaction.followUpDate && 
      new Date(interaction.followUpDate) <= new Date()
    );
    return hasOpenTasks || hasFollowUpInteraction;
  }

  get daysSinceLastInteraction(): number {
    if (!this.interactionHistory || this.interactionHistory.length === 0) return -1;
    
    const lastInteraction = this.interactionHistory
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
    
    const diffTime = new Date().getTime() - new Date(lastInteraction.createdAt).getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  get annualShippingVolume(): number {
    const volume = this.logisticsInformation?.shippingVolume;
    if (!volume) return 0;
    
    switch (volume.period) {
      case 'monthly':
        return volume.containersTEU * 12;
      case 'quarterly':
        return volume.containersTEU * 4;
      case 'annually':
        return volume.containersTEU;
      default:
        return 0;
    }
  }
}