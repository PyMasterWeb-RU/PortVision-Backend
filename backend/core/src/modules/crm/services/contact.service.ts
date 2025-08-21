import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { 
  Contact, 
  ContactType, 
  ContactStatus, 
  LeadSource,
  Industry 
} from '../entities/contact.entity';

export interface CreateContactDto {
  contactType: ContactType;
  status?: ContactStatus;
  leadSource?: LeadSource;
  industry?: Industry;
  companyName: string;
  registrationNumber?: string;
  taxId?: string;
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
  additionalContacts?: Array<{
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
  companyInformation?: {
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
  logisticsInformation?: {
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
      satisfactionLevel: number;
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
  assignedTo?: string;
  assignedToName?: string;
  salesTeam?: Array<{
    memberId: string;
    memberName: string;
    role: 'account_manager' | 'sales_rep' | 'technical_consultant' | 'support_specialist';
    isPrimary: boolean;
  }>;
  salesInformation?: {
    leadScore: number;
    qualificationLevel: 'unqualified' | 'marketing_qualified' | 'sales_qualified' | 'sales_accepted';
    pipeline: {
      stage: 'prospecting' | 'qualification' | 'needs_analysis' | 'proposal' | 'negotiation' | 'closed_won' | 'closed_lost';
      probability: number;
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
  preferences?: {
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
  ratingScoring?: {
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
      financialStability: number;
      growthPotential: number;
      strategicValue: number;
      relationshipQuality: number;
      overallScore: number;
    };
  };
  tags?: string[];
  notes?: string;
  internalNotes?: string;
  metadata?: Record<string, any>;
}

export interface UpdateContactDto {
  contactType?: ContactType;
  status?: ContactStatus;
  leadSource?: LeadSource;
  industry?: Industry;
  companyName?: string;
  registrationNumber?: string;
  taxId?: string;
  primaryContact?: Partial<CreateContactDto['primaryContact']>;
  additionalContacts?: CreateContactDto['additionalContacts'];
  addressInformation?: Partial<CreateContactDto['addressInformation']>;
  companyInformation?: Partial<CreateContactDto['companyInformation']>;
  logisticsInformation?: Partial<CreateContactDto['logisticsInformation']>;
  assignedTo?: string;
  assignedToName?: string;
  salesTeam?: CreateContactDto['salesTeam'];
  interactionHistory?: Array<{
    interactionId: string;
    interactionType: 'call' | 'email' | 'meeting' | 'visit' | 'demo' | 'proposal' | 'contract' | 'support';
    subject: string;
    description: string;
    outcome: string;
    followUpRequired: boolean;
    followUpDate?: Date;
    contactedBy: string;
    contactedPerson: string;
    duration?: number;
    location?: string;
    attachments?: string[];
    createdAt: Date;
  }>;
  salesInformation?: Partial<CreateContactDto['salesInformation']>;
  documents?: Array<{
    documentId: string;
    documentType: 'contract' | 'proposal' | 'presentation' | 'certificate' | 'license' | 'financial' | 'other';
    documentName: string;
    documentUrl: string;
    uploadedBy: string;
    uploadedAt: Date;
    accessLevel: 'public' | 'internal' | 'restricted';
    tags: string[];
  }>;
  tasksReminders?: Array<{
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
  preferences?: Partial<CreateContactDto['preferences']>;
  ratingScoring?: Partial<CreateContactDto['ratingScoring']>;
  tags?: string[];
  notes?: string;
  internalNotes?: string;
  metadata?: Record<string, any>;
}

export interface ContactSearchFilters {
  contactType?: ContactType;
  status?: ContactStatus;
  leadSource?: LeadSource;
  industry?: Industry;
  assignedTo?: string;
  leadScoreMin?: number;
  leadScoreMax?: number;
  pipelineStage?: string;
  expectedValueMin?: number;
  expectedValueMax?: number;
  hasOpenTasks?: boolean;
  needsFollowUp?: boolean;
  lastInteractionBefore?: Date;
  lastInteractionAfter?: Date;
  isHighPotential?: boolean;
  riskLevel?: string;
  country?: string;
  city?: string;
  searchText?: string;
}

@Injectable()
export class ContactService {
  private readonly logger = new Logger(ContactService.name);

  constructor(
    @InjectRepository(Contact)
    private readonly contactRepository: Repository<Contact>,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async createContact(createContactDto: CreateContactDto): Promise<Contact> {
    this.logger.log(`Creating contact: ${createContactDto.companyName}`);

    // Check for duplicate company
    const existingContact = await this.contactRepository.findOne({
      where: { companyName: createContactDto.companyName },
    });

    if (existingContact) {
      throw new BadRequestException(`Contact with company name ${createContactDto.companyName} already exists`);
    }

    // Set defaults
    const contactData = {
      ...createContactDto,
      status: createContactDto.status || ContactStatus.LEAD,
    };

    // Calculate lead score if sales information provided
    if (contactData.salesInformation && !contactData.salesInformation.leadScore) {
      contactData.salesInformation.leadScore = this.calculateLeadScore(contactData);
    }

    const contact = this.contactRepository.create(contactData);
    const savedContact = await this.contactRepository.save(contact);

    this.eventEmitter.emit('contact.created', {
      contactId: savedContact.id,
      companyName: savedContact.companyName,
      contactType: savedContact.contactType,
      status: savedContact.status,
      assignedTo: savedContact.assignedTo,
    });

    this.logger.log(`Contact created: ${savedContact.companyName}`);
    return savedContact;
  }

  async getAllContacts(): Promise<Contact[]> {
    return this.contactRepository.find({
      order: { createdAt: 'DESC' },
    });
  }

  async getContactById(id: string): Promise<Contact> {
    const contact = await this.contactRepository.findOne({
      where: { id },
    });

    if (!contact) {
      throw new NotFoundException(`Contact with ID ${id} not found`);
    }

    return contact;
  }

  async updateContact(id: string, updateContactDto: UpdateContactDto): Promise<Contact> {
    const contact = await this.getContactById(id);

    // Validate status transitions
    if (updateContactDto.status) {
      this.validateStatusTransition(contact.status, updateContactDto.status);
    }

    // Update lead score if sales information changed
    if (updateContactDto.salesInformation) {
      const updatedSalesInfo = { ...contact.salesInformation, ...updateContactDto.salesInformation };
      updatedSalesInfo.leadScore = this.calculateLeadScore({
        ...contact,
        ...updateContactDto,
        salesInformation: updatedSalesInfo,
      });
      updateContactDto.salesInformation = updatedSalesInfo;
    }

    // Merge interaction history
    if (updateContactDto.interactionHistory) {
      const existingHistory = contact.interactionHistory || [];
      updateContactDto.interactionHistory = [...existingHistory, ...updateContactDto.interactionHistory];
    }

    Object.assign(contact, updateContactDto);
    const updatedContact = await this.contactRepository.save(contact);

    this.eventEmitter.emit('contact.updated', {
      contactId: updatedContact.id,
      companyName: updatedContact.companyName,
      changes: updateContactDto,
    });

    this.logger.log(`Contact updated: ${updatedContact.companyName}`);
    return updatedContact;
  }

  async deleteContact(id: string): Promise<void> {
    const contact = await this.getContactById(id);

    if (contact.status === ContactStatus.CONVERTED) {
      throw new BadRequestException(`Cannot delete converted contact ${contact.companyName}`);
    }

    await this.contactRepository.remove(contact);

    this.eventEmitter.emit('contact.deleted', {
      contactId: contact.id,
      companyName: contact.companyName,
    });

    this.logger.log(`Contact deleted: ${contact.companyName}`);
  }

  async searchContacts(filters: ContactSearchFilters): Promise<Contact[]> {
    const query = this.contactRepository.createQueryBuilder('contact');

    if (filters.contactType) {
      query.andWhere('contact.contactType = :contactType', { contactType: filters.contactType });
    }

    if (filters.status) {
      query.andWhere('contact.status = :status', { status: filters.status });
    }

    if (filters.leadSource) {
      query.andWhere('contact.leadSource = :leadSource', { leadSource: filters.leadSource });
    }

    if (filters.industry) {
      query.andWhere('contact.industry = :industry', { industry: filters.industry });
    }

    if (filters.assignedTo) {
      query.andWhere('contact.assignedTo = :assignedTo', { assignedTo: filters.assignedTo });
    }

    if (filters.leadScoreMin) {
      query.andWhere('(contact.salesInformation->>\'leadScore\')::int >= :leadScoreMin', { leadScoreMin: filters.leadScoreMin });
    }

    if (filters.leadScoreMax) {
      query.andWhere('(contact.salesInformation->>\'leadScore\')::int <= :leadScoreMax', { leadScoreMax: filters.leadScoreMax });
    }

    if (filters.pipelineStage) {
      query.andWhere('contact.salesInformation->>\'pipeline\'->>\'stage\' = :pipelineStage', { pipelineStage: filters.pipelineStage });
    }

    if (filters.expectedValueMin) {
      query.andWhere('(contact.salesInformation->>\'pipeline\'->>\'expectedValue\')::numeric >= :expectedValueMin', { expectedValueMin: filters.expectedValueMin });
    }

    if (filters.expectedValueMax) {
      query.andWhere('(contact.salesInformation->>\'pipeline\'->>\'expectedValue\')::numeric <= :expectedValueMax', { expectedValueMax: filters.expectedValueMax });
    }

    if (filters.riskLevel) {
      query.andWhere('contact.ratingScoring->>\'riskAssessment\'->>\'riskLevel\' = :riskLevel', { riskLevel: filters.riskLevel });
    }

    if (filters.country) {
      query.andWhere('contact.addressInformation->>\'headquarters\'->>\'country\' = :country', { country: filters.country });
    }

    if (filters.city) {
      query.andWhere('contact.addressInformation->>\'headquarters\'->>\'city\' = :city', { city: filters.city });
    }

    if (filters.searchText) {
      query.andWhere(`(
        contact.companyName ILIKE :searchText
        OR contact.registrationNumber ILIKE :searchText
        OR contact.taxId ILIKE :searchText
        OR contact.primaryContact->>'firstName' ILIKE :searchText
        OR contact.primaryContact->>'lastName' ILIKE :searchText
        OR contact.primaryContact->>'email' ILIKE :searchText
        OR contact.notes ILIKE :searchText
      )`, { searchText: `%${filters.searchText}%` });
    }

    query.orderBy('contact.createdAt', 'DESC');

    return query.getMany();
  }

  async getContactsByType(contactType: ContactType): Promise<Contact[]> {
    return this.searchContacts({ contactType });
  }

  async getContactsByStatus(status: ContactStatus): Promise<Contact[]> {
    return this.searchContacts({ status });
  }

  async getContactsByAssignee(assignedTo: string): Promise<Contact[]> {
    return this.searchContacts({ assignedTo });
  }

  async getLeads(): Promise<Contact[]> {
    return this.contactRepository.find({
      where: [
        { status: ContactStatus.LEAD },
        { status: ContactStatus.QUALIFIED },
      ],
      order: { createdAt: 'DESC' },
    });
  }

  async getClients(): Promise<Contact[]> {
    return this.contactRepository.find({
      where: { 
        contactType: ContactType.CLIENT,
        status: ContactStatus.CONVERTED,
      },
      order: { companyName: 'ASC' },
    });
  }

  async getHighPotentialContacts(): Promise<Contact[]> {
    const query = this.contactRepository.createQueryBuilder('contact')
      .where('(contact.salesInformation->>\'leadScore\')::int >= 70')
      .andWhere('(contact.ratingScoring->>\'businessScore\'->>\'overallScore\')::int >= 7')
      .orderBy('(contact.salesInformation->>\'leadScore\')::int', 'DESC');

    return query.getMany();
  }

  async getContactsNeedingFollowUp(): Promise<Contact[]> {
    const today = new Date();
    
    const query = this.contactRepository.createQueryBuilder('contact')
      .where(`(
        EXISTS (
          SELECT 1 FROM jsonb_array_elements(contact.tasksReminders) as task
          WHERE task->>'status' = 'pending'
          AND (task->>'dueDate')::date <= :today
        )
        OR EXISTS (
          SELECT 1 FROM jsonb_array_elements(contact.interactionHistory) as interaction
          WHERE interaction->>'followUpRequired' = 'true'
          AND (interaction->>'followUpDate')::date <= :today
        )
      )`, { today: today.toISOString().split('T')[0] })
      .orderBy('contact.updatedAt', 'ASC');

    return query.getMany();
  }

  async addInteraction(contactId: string, interaction: {
    interactionType: 'call' | 'email' | 'meeting' | 'visit' | 'demo' | 'proposal' | 'contract' | 'support';
    subject: string;
    description: string;
    outcome: string;
    followUpRequired: boolean;
    followUpDate?: Date;
    contactedBy: string;
    contactedPerson: string;
    duration?: number;
    location?: string;
    attachments?: string[];
  }): Promise<Contact> {
    const contact = await this.getContactById(contactId);

    const newInteraction = {
      interactionId: `INT-${Date.now()}`,
      ...interaction,
      createdAt: new Date(),
    };

    const updatedHistory = [...(contact.interactionHistory || []), newInteraction];

    return this.updateContact(contactId, {
      interactionHistory: updatedHistory,
    });
  }

  async addTask(contactId: string, task: {
    taskType: 'follow_up' | 'call' | 'email' | 'meeting' | 'proposal' | 'contract_review' | 'other';
    title: string;
    description: string;
    assignedTo: string;
    dueDate: Date;
    priority: 'low' | 'medium' | 'high' | 'urgent';
    notes?: string;
  }): Promise<Contact> {
    const contact = await this.getContactById(contactId);

    const newTask = {
      taskId: `TSK-${Date.now()}`,
      ...task,
      status: 'pending' as const,
    };

    const updatedTasks = [...(contact.tasksReminders || []), newTask];

    return this.updateContact(contactId, {
      tasksReminders: updatedTasks,
    });
  }

  async completeTask(contactId: string, taskId: string, notes?: string): Promise<Contact> {
    const contact = await this.getContactById(contactId);

    if (!contact.tasksReminders) {
      throw new NotFoundException(`Task ${taskId} not found`);
    }

    const taskIndex = contact.tasksReminders.findIndex(task => task.taskId === taskId);
    
    if (taskIndex === -1) {
      throw new NotFoundException(`Task ${taskId} not found`);
    }

    contact.tasksReminders[taskIndex] = {
      ...contact.tasksReminders[taskIndex],
      status: 'completed',
      completedAt: new Date(),
      notes: notes || contact.tasksReminders[taskIndex].notes,
    };

    return this.updateContact(contactId, {
      tasksReminders: contact.tasksReminders,
    });
  }

  async updatePipelineStage(
    contactId: string,
    stage: 'prospecting' | 'qualification' | 'needs_analysis' | 'proposal' | 'negotiation' | 'closed_won' | 'closed_lost',
    probability: number,
    expectedValue?: number,
    expectedCloseDate?: Date
  ): Promise<Contact> {
    const contact = await this.getContactById(contactId);

    const updatedPipeline = {
      ...contact.salesInformation?.pipeline,
      stage,
      probability,
      expectedValue: expectedValue || contact.salesInformation?.pipeline?.expectedValue || 0,
      expectedCloseDate: expectedCloseDate || contact.salesInformation?.pipeline?.expectedCloseDate,
      lastStageUpdate: new Date(),
    };

    const updatedSalesInfo = {
      ...contact.salesInformation,
      pipeline: updatedPipeline,
    };

    // Update lead score based on new pipeline stage
    updatedSalesInfo.leadScore = this.calculateLeadScore({
      ...contact,
      salesInformation: updatedSalesInfo,
    });

    const updatedContact = await this.updateContact(contactId, {
      salesInformation: updatedSalesInfo,
    });

    this.eventEmitter.emit('contact.pipeline.updated', {
      contactId: updatedContact.id,
      companyName: updatedContact.companyName,
      stage,
      probability,
      expectedValue,
    });

    return updatedContact;
  }

  async convertToClient(contactId: string): Promise<Contact> {
    const contact = await this.getContactById(contactId);

    if (contact.contactType !== ContactType.PROSPECT && contact.contactType !== ContactType.CLIENT) {
      throw new BadRequestException('Only prospects can be converted to clients');
    }

    const updatedContact = await this.updateContact(contactId, {
      contactType: ContactType.CLIENT,
      status: ContactStatus.CONVERTED,
    });

    this.eventEmitter.emit('contact.converted', {
      contactId: updatedContact.id,
      companyName: updatedContact.companyName,
    });

    return updatedContact;
  }

  private calculateLeadScore(contact: Partial<Contact & CreateContactDto>): number {
    let score = 0;

    // Company size scoring
    if (contact.companyInformation?.employeeCount) {
      if (contact.companyInformation.employeeCount >= 1000) score += 20;
      else if (contact.companyInformation.employeeCount >= 100) score += 15;
      else if (contact.companyInformation.employeeCount >= 50) score += 10;
      else score += 5;
    }

    // Revenue scoring
    if (contact.companyInformation?.annualRevenue?.amount) {
      const revenue = contact.companyInformation.annualRevenue.amount;
      if (revenue >= 100000000) score += 20; // $100M+
      else if (revenue >= 10000000) score += 15; // $10M+
      else if (revenue >= 1000000) score += 10; // $1M+
      else score += 5;
    }

    // Industry scoring
    if (contact.industry) {
      const highValueIndustries = [Industry.SHIPPING, Industry.LOGISTICS, Industry.MANUFACTURING];
      if (highValueIndustries.includes(contact.industry)) score += 15;
      else score += 10;
    }

    // Shipping volume scoring
    if (contact.logisticsInformation?.shippingVolume?.containersTEU) {
      const annualTEU = contact.logisticsInformation.shippingVolume.containersTEU;
      const period = contact.logisticsInformation.shippingVolume.period;
      
      let adjustedTEU = annualTEU;
      if (period === 'monthly') adjustedTEU *= 12;
      else if (period === 'quarterly') adjustedTEU *= 4;

      if (adjustedTEU >= 10000) score += 20;
      else if (adjustedTEU >= 1000) score += 15;
      else if (adjustedTEU >= 100) score += 10;
      else score += 5;
    }

    // Pipeline stage scoring
    if (contact.salesInformation?.pipeline?.stage) {
      const stageScores = {
        'prospecting': 5,
        'qualification': 10,
        'needs_analysis': 15,
        'proposal': 20,
        'negotiation': 25,
        'closed_won': 30,
        'closed_lost': 0,
      };
      score += stageScores[contact.salesInformation.pipeline.stage] || 0;
    }

    // Engagement scoring (based on interactions)
    if (contact.interactionHistory?.length) {
      const recentInteractions = contact.interactionHistory.filter(
        interaction => new Date(interaction.createdAt) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      );
      score += Math.min(recentInteractions.length * 2, 10);
    }

    return Math.min(Math.max(score, 0), 100); // Ensure score is between 0-100
  }

  private validateStatusTransition(currentStatus: ContactStatus, newStatus: ContactStatus): void {
    const validTransitions: Record<ContactStatus, ContactStatus[]> = {
      [ContactStatus.LEAD]: [ContactStatus.QUALIFIED, ContactStatus.INACTIVE, ContactStatus.ARCHIVED],
      [ContactStatus.QUALIFIED]: [ContactStatus.CONVERTED, ContactStatus.INACTIVE, ContactStatus.ARCHIVED],
      [ContactStatus.CONVERTED]: [ContactStatus.ACTIVE, ContactStatus.INACTIVE],
      [ContactStatus.ACTIVE]: [ContactStatus.INACTIVE, ContactStatus.BLOCKED],
      [ContactStatus.INACTIVE]: [ContactStatus.ACTIVE, ContactStatus.ARCHIVED],
      [ContactStatus.BLOCKED]: [ContactStatus.INACTIVE, ContactStatus.ARCHIVED],
      [ContactStatus.ARCHIVED]: [],
    };

    if (!validTransitions[currentStatus]?.includes(newStatus)) {
      throw new BadRequestException(
        `Invalid status transition from ${currentStatus} to ${newStatus}`
      );
    }
  }

  async getContactStatistics(filters?: {
    period?: number;
    assignedTo?: string;
    contactType?: ContactType;
  }) {
    const whereClause = [];
    const params = [];

    if (filters?.period) {
      whereClause.push('created_at >= NOW() - INTERVAL \\'' + filters.period + ' days\\'');
    }

    if (filters?.contactType) {
      whereClause.push('contact_type = $' + (params.length + 1));
      params.push(filters.contactType);
    }

    if (filters?.assignedTo) {
      whereClause.push('assigned_to = $' + (params.length + 1));
      params.push(filters.assignedTo);
    }

    const whereSQL = whereClause.length > 0 ? 'WHERE ' + whereClause.join(' AND ') : '';

    const [
      totalContacts,
      contactsByStatus,
      contactsByType,
      avgLeadScore,
      conversionStats,
      pipelineStats,
    ] = await Promise.all([
      this.contactRepository.query(`
        SELECT COUNT(*) as count
        FROM crm.contacts
        ${whereSQL}
      `, params),
      this.contactRepository.query(`
        SELECT status, COUNT(*) as count
        FROM crm.contacts
        ${whereSQL}
        GROUP BY status
        ORDER BY count DESC
      `, params),
      this.contactRepository.query(`
        SELECT contact_type, COUNT(*) as count
        FROM crm.contacts
        ${whereSQL}
        GROUP BY contact_type
        ORDER BY count DESC
      `, params),
      this.contactRepository.query(`
        SELECT AVG((sales_information->>'leadScore')::int) as avg_score
        FROM crm.contacts
        WHERE sales_information->>'leadScore' IS NOT NULL
        ${whereSQL ? 'AND ' + whereSQL.replace('WHERE ', '') : ''}
      `, params),
      this.contactRepository.query(`
        SELECT 
          COUNT(CASE WHEN status = 'converted' THEN 1 END) as converted,
          COUNT(CASE WHEN status IN ('lead', 'qualified') THEN 1 END) as active_leads
        FROM crm.contacts
        ${whereSQL}
      `, params),
      this.contactRepository.query(`
        SELECT 
          sales_information->'pipeline'->>'stage' as stage,
          COUNT(*) as count,
          AVG((sales_information->'pipeline'->>'expectedValue')::numeric) as avg_value
        FROM crm.contacts
        WHERE sales_information->'pipeline'->>'stage' IS NOT NULL
        ${whereSQL ? 'AND ' + whereSQL.replace('WHERE ', '') : ''}
        GROUP BY sales_information->'pipeline'->>'stage'
        ORDER BY count DESC
      `, params),
    ]);

    const conversionRate = conversionStats[0].active_leads > 0 
      ? (conversionStats[0].converted / (conversionStats[0].converted + conversionStats[0].active_leads)) * 100 
      : 0;

    return {
      totals: {
        totalContacts: parseInt(totalContacts[0].count),
        avgLeadScore: parseFloat(avgLeadScore[0].avg_score || 0),
        conversionRate: parseFloat(conversionRate.toFixed(2)),
        totalConverted: parseInt(conversionStats[0].converted),
        activeLeads: parseInt(conversionStats[0].active_leads),
      },
      breakdown: {
        byStatus: contactsByStatus,
        byType: contactsByType,
        byPipelineStage: pipelineStats,
      },
    };
  }
}