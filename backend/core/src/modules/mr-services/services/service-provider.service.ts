import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { 
  ServiceProvider, 
  ProviderType, 
  ProviderStatus,
  CertificationStatus 
} from '../entities/service-provider.entity';

export interface CreateServiceProviderDto {
  companyName: string;
  providerType: ProviderType;
  contactInformation: any;
  physicalAddress: any;
  servicesOffered: any[];
  certifications?: any[];
  insuranceInformation?: any;
  financialInformation?: any;
  contractInformation?: any;
  staffQualifications?: any[];
  equipmentTools?: any[];
  notes?: string;
  metadata?: Record<string, any>;
}

export interface UpdateServiceProviderDto {
  companyName?: string;
  providerType?: ProviderType;
  status?: ProviderStatus;
  contactInformation?: any;
  physicalAddress?: any;
  servicesOffered?: any[];
  certifications?: any[];
  insuranceInformation?: any;
  performanceRating?: number;
  performanceMetrics?: any;
  financialInformation?: any;
  contractInformation?: any;
  staffQualifications?: any[];
  equipmentTools?: any[];
  reviewsFeedback?: any[];
  incidentHistory?: any[];
  documents?: any[];
  notes?: string;
  metadata?: Record<string, any>;
}

export interface ProviderSearchFilters {
  providerType?: ProviderType;
  status?: ProviderStatus;
  serviceCategory?: string;
  serviceType?: string;
  city?: string;
  state?: string;
  country?: string;
  performanceRatingMin?: number;
  performanceRatingMax?: number;
  emergencyAvailable?: boolean;
  certificationRequired?: boolean;
  hasValidInsurance?: boolean;
  searchText?: string;
}

@Injectable()
export class ServiceProviderService {
  private readonly logger = new Logger(ServiceProviderService.name);

  constructor(
    @InjectRepository(ServiceProvider)
    private readonly serviceProviderRepository: Repository<ServiceProvider>,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async createServiceProvider(createServiceProviderDto: CreateServiceProviderDto): Promise<ServiceProvider> {
    this.logger.log(`Creating service provider: ${createServiceProviderDto.companyName}`);

    // Generate provider code
    const providerCode = await this.generateProviderCode(createServiceProviderDto.providerType);

    const serviceProvider = this.serviceProviderRepository.create({
      ...createServiceProviderDto,
      providerCode,
      status: ProviderStatus.PENDING_APPROVAL,
      performanceRating: 0,
    });

    const savedProvider = await this.serviceProviderRepository.save(serviceProvider);

    this.eventEmitter.emit('service_provider.created', {
      providerId: savedProvider.id,
      providerCode: savedProvider.providerCode,
      companyName: savedProvider.companyName,
      providerType: savedProvider.providerType,
    });

    this.logger.log(`Service provider created: ${savedProvider.providerCode}`);
    return savedProvider;
  }

  async getAllServiceProviders(): Promise<ServiceProvider[]> {
    return this.serviceProviderRepository.find({
      order: { companyName: 'ASC' },
    });
  }

  async getServiceProviderById(id: string): Promise<ServiceProvider> {
    const provider = await this.serviceProviderRepository.findOne({
      where: { id },
    });

    if (!provider) {
      throw new NotFoundException(`Service provider with ID ${id} not found`);
    }

    return provider;
  }

  async getServiceProviderByCode(providerCode: string): Promise<ServiceProvider> {
    const provider = await this.serviceProviderRepository.findOne({
      where: { providerCode },
    });

    if (!provider) {
      throw new NotFoundException(`Service provider with code ${providerCode} not found`);
    }

    return provider;
  }

  async updateServiceProvider(id: string, updateServiceProviderDto: UpdateServiceProviderDto): Promise<ServiceProvider> {
    const provider = await this.getServiceProviderById(id);

    // Validate status transitions
    if (updateServiceProviderDto.status) {
      this.validateStatusTransition(provider.status, updateServiceProviderDto.status);
    }

    Object.assign(provider, updateServiceProviderDto);
    const updatedProvider = await this.serviceProviderRepository.save(provider);

    this.eventEmitter.emit('service_provider.updated', {
      providerId: updatedProvider.id,
      providerCode: updatedProvider.providerCode,
      changes: updateServiceProviderDto,
    });

    this.logger.log(`Service provider updated: ${updatedProvider.providerCode}`);
    return updatedProvider;
  }

  async deleteServiceProvider(id: string): Promise<void> {
    const provider = await this.getServiceProviderById(id);

    if (provider.status === ProviderStatus.ACTIVE) {
      throw new BadRequestException(`Cannot delete active provider ${provider.providerCode}`);
    }

    await this.serviceProviderRepository.remove(provider);

    this.eventEmitter.emit('service_provider.deleted', {
      providerId: provider.id,
      providerCode: provider.providerCode,
    });

    this.logger.log(`Service provider deleted: ${provider.providerCode}`);
  }

  async searchServiceProviders(filters: ProviderSearchFilters): Promise<ServiceProvider[]> {
    const query = this.serviceProviderRepository.createQueryBuilder('provider');

    if (filters.providerType) {
      query.andWhere('provider.providerType = :providerType', { providerType: filters.providerType });
    }

    if (filters.status) {
      query.andWhere('provider.status = :status', { status: filters.status });
    }

    if (filters.serviceCategory) {
      query.andWhere(`
        EXISTS (
          SELECT 1 FROM jsonb_array_elements(provider.services_offered) service
          WHERE service->>'serviceCategory' = :serviceCategory
        )
      `, { serviceCategory: filters.serviceCategory });
    }

    if (filters.serviceType) {
      query.andWhere(`
        EXISTS (
          SELECT 1 FROM jsonb_array_elements(provider.services_offered) service
          WHERE service->>'serviceType' = :serviceType
        )
      `, { serviceType: filters.serviceType });
    }

    if (filters.city) {
      query.andWhere('provider.physicalAddress->>\'city\' ILIKE :city', { city: `%${filters.city}%` });
    }

    if (filters.state) {
      query.andWhere('provider.physicalAddress->>\'state\' ILIKE :state', { state: `%${filters.state}%` });
    }

    if (filters.country) {
      query.andWhere('provider.physicalAddress->>\'country\' ILIKE :country', { country: `%${filters.country}%` });
    }

    if (filters.performanceRatingMin) {
      query.andWhere('provider.performanceRating >= :performanceRatingMin', { performanceRatingMin: filters.performanceRatingMin });
    }

    if (filters.performanceRatingMax) {
      query.andWhere('provider.performanceRating <= :performanceRatingMax', { performanceRatingMax: filters.performanceRatingMax });
    }

    if (filters.emergencyAvailable) {
      query.andWhere(`
        EXISTS (
          SELECT 1 FROM jsonb_array_elements(provider.services_offered) service
          WHERE (service->>'emergencyAvailable')::boolean = true
        )
      `);
    }

    if (filters.certificationRequired) {
      query.andWhere(`
        EXISTS (
          SELECT 1 FROM jsonb_array_elements(provider.services_offered) service
          WHERE (service->>'certificationRequired')::boolean = true
        )
      `);
    }

    if (filters.hasValidInsurance) {
      query.andWhere(`
        (provider.insurance_information->'generalLiability'->>'expiryDate')::timestamp > NOW()
      `);
    }

    if (filters.searchText) {
      query.andWhere(`(
        provider.companyName ILIKE :searchText
        OR provider.providerCode ILIKE :searchText
        OR provider.contactInformation->'primaryContact'->>'name' ILIKE :searchText
        OR provider.physicalAddress->>'city' ILIKE :searchText
      )`, { searchText: `%${filters.searchText}%` });
    }

    query.orderBy('provider.companyName', 'ASC');

    return query.getMany();
  }

  async getProvidersByType(providerType: ProviderType): Promise<ServiceProvider[]> {
    return this.searchServiceProviders({ providerType });
  }

  async getProvidersByStatus(status: ProviderStatus): Promise<ServiceProvider[]> {
    return this.searchServiceProviders({ status });
  }

  async getActiveProviders(): Promise<ServiceProvider[]> {
    return this.searchServiceProviders({ status: ProviderStatus.ACTIVE });
  }

  async getEmergencyProviders(): Promise<ServiceProvider[]> {
    return this.searchServiceProviders({ 
      status: ProviderStatus.ACTIVE,
      emergencyAvailable: true 
    });
  }

  async getProvidersForService(serviceCategory: string, serviceType?: string): Promise<ServiceProvider[]> {
    const filters: ProviderSearchFilters = { 
      status: ProviderStatus.ACTIVE,
      serviceCategory 
    };
    
    if (serviceType) {
      filters.serviceType = serviceType;
    }

    return this.searchServiceProviders(filters);
  }

  async getTopRatedProviders(limit: number = 10): Promise<ServiceProvider[]> {
    return this.serviceProviderRepository.find({
      where: { status: ProviderStatus.ACTIVE },
      order: { performanceRating: 'DESC' },
      take: limit,
    });
  }

  async getProvidersWithExpiringCertifications(daysAhead: number = 90): Promise<ServiceProvider[]> {
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + daysAhead);

    const query = this.serviceProviderRepository.createQueryBuilder('provider')
      .where('provider.status = :status', { status: ProviderStatus.ACTIVE })
      .andWhere(`
        EXISTS (
          SELECT 1 FROM jsonb_array_elements(provider.certifications) cert
          WHERE (cert->>'expiryDate')::timestamp <= :expiryDate
          AND cert->>'status' = 'valid'
        )
      `, { expiryDate });

    return query.getMany();
  }

  async getProvidersWithExpiringInsurance(daysAhead: number = 30): Promise<ServiceProvider[]> {
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + daysAhead);

    const query = this.serviceProviderRepository.createQueryBuilder('provider')
      .where('provider.status = :status', { status: ProviderStatus.ACTIVE })
      .andWhere(`
        (provider.insurance_information->'generalLiability'->>'expiryDate')::timestamp <= :expiryDate
      `, { expiryDate });

    return query.getMany();
  }

  async activateProvider(id: string): Promise<ServiceProvider> {
    const provider = await this.getServiceProviderById(id);

    if (provider.status !== ProviderStatus.PENDING_APPROVAL) {
      throw new BadRequestException(`Cannot activate provider ${provider.providerCode} - status is ${provider.status}`);
    }

    // Validate required information
    this.validateProviderForActivation(provider);

    const updatedProvider = await this.updateServiceProvider(id, {
      status: ProviderStatus.ACTIVE,
    });

    this.eventEmitter.emit('service_provider.activated', {
      providerId: updatedProvider.id,
      providerCode: updatedProvider.providerCode,
      companyName: updatedProvider.companyName,
    });

    return updatedProvider;
  }

  async suspendProvider(id: string, reason: string): Promise<ServiceProvider> {
    const provider = await this.getServiceProviderById(id);

    if (provider.status !== ProviderStatus.ACTIVE) {
      throw new BadRequestException(`Cannot suspend provider ${provider.providerCode} - status is ${provider.status}`);
    }

    const updatedProvider = await this.updateServiceProvider(id, {
      status: ProviderStatus.SUSPENDED,
      notes: `${provider.notes || ''}\nSuspended: ${reason}`,
    });

    this.eventEmitter.emit('service_provider.suspended', {
      providerId: updatedProvider.id,
      providerCode: updatedProvider.providerCode,
      reason,
    });

    return updatedProvider;
  }

  async updatePerformanceRating(
    id: string,
    newRating: number,
    metrics?: any
  ): Promise<ServiceProvider> {
    const provider = await this.getServiceProviderById(id);

    if (newRating < 0 || newRating > 10) {
      throw new BadRequestException('Performance rating must be between 0 and 10');
    }

    const updatedProvider = await this.updateServiceProvider(id, {
      performanceRating: newRating,
      performanceMetrics: metrics ? {
        ...provider.performanceMetrics,
        ...metrics,
        lastUpdated: new Date(),
      } : provider.performanceMetrics,
    });

    this.eventEmitter.emit('service_provider.performance_updated', {
      providerId: updatedProvider.id,
      providerCode: updatedProvider.providerCode,
      oldRating: provider.performanceRating,
      newRating,
    });

    return updatedProvider;
  }

  async addReview(
    id: string,
    review: {
      reviewerName: string;
      jobType: string;
      overallRating: number;
      qualityRating: number;
      timelinessRating: number;
      communicationRating: number;
      valueRating: number;
      comments: string;
      wouldRecommend: boolean;
    }
  ): Promise<ServiceProvider> {
    const provider = await this.getServiceProviderById(id);

    const newReview = {
      reviewId: `review-${Date.now()}`,
      reviewDate: new Date(),
      ...review,
    };

    const reviewsFeedback = provider.reviewsFeedback || [];
    reviewsFeedback.push(newReview);

    // Recalculate average rating
    const totalRating = reviewsFeedback.reduce((sum, r) => sum + r.overallRating, 0);
    const averageRating = totalRating / reviewsFeedback.length;

    const updatedProvider = await this.updateServiceProvider(id, {
      reviewsFeedback,
      performanceRating: Math.round(averageRating * 100) / 100,
    });

    this.eventEmitter.emit('service_provider.review_added', {
      providerId: updatedProvider.id,
      providerCode: updatedProvider.providerCode,
      review: newReview,
    });

    return updatedProvider;
  }

  async addIncident(
    id: string,
    incident: {
      incidentType: string;
      severity: string;
      description: string;
      rootCause: string;
      correctiveActions: string[];
      preventiveActions: string[];
      reportedBy: string;
      investigatedBy: string;
    }
  ): Promise<ServiceProvider> {
    const provider = await this.getServiceProviderById(id);

    const newIncident = {
      incidentId: `incident-${Date.now()}`,
      incidentDate: new Date(),
      status: 'open' as const,
      lessonsLearned: [],
      ...incident,
    };

    const incidentHistory = provider.incidentHistory || [];
    incidentHistory.push(newIncident);

    const updatedProvider = await this.updateServiceProvider(id, {
      incidentHistory,
    });

    this.eventEmitter.emit('service_provider.incident_added', {
      providerId: updatedProvider.id,
      providerCode: updatedProvider.providerCode,
      incident: newIncident,
    });

    return updatedProvider;
  }

  private validateStatusTransition(currentStatus: ProviderStatus, newStatus: ProviderStatus): void {
    const validTransitions: Record<ProviderStatus, ProviderStatus[]> = {
      [ProviderStatus.PENDING_APPROVAL]: [ProviderStatus.ACTIVE, ProviderStatus.INACTIVE, ProviderStatus.BLACKLISTED],
      [ProviderStatus.ACTIVE]: [ProviderStatus.SUSPENDED, ProviderStatus.INACTIVE, ProviderStatus.UNDER_REVIEW, ProviderStatus.BLACKLISTED],
      [ProviderStatus.SUSPENDED]: [ProviderStatus.ACTIVE, ProviderStatus.INACTIVE, ProviderStatus.BLACKLISTED],
      [ProviderStatus.INACTIVE]: [ProviderStatus.PENDING_APPROVAL],
      [ProviderStatus.UNDER_REVIEW]: [ProviderStatus.ACTIVE, ProviderStatus.SUSPENDED, ProviderStatus.BLACKLISTED],
      [ProviderStatus.BLACKLISTED]: [],
    };

    if (!validTransitions[currentStatus]?.includes(newStatus)) {
      throw new BadRequestException(
        `Invalid status transition from ${currentStatus} to ${newStatus}`
      );
    }
  }

  private validateProviderForActivation(provider: ServiceProvider): void {
    const errors: string[] = [];

    if (!provider.contactInformation?.primaryContact?.name) {
      errors.push('Primary contact name is required');
    }

    if (!provider.contactInformation?.primaryContact?.email) {
      errors.push('Primary contact email is required');
    }

    if (!provider.servicesOffered || provider.servicesOffered.length === 0) {
      errors.push('At least one service must be offered');
    }

    if (!provider.insuranceInformation?.generalLiability) {
      errors.push('General liability insurance is required');
    } else {
      const expiryDate = new Date(provider.insuranceInformation.generalLiability.expiryDate);
      if (expiryDate <= new Date()) {
        errors.push('General liability insurance has expired');
      }
    }

    if (errors.length > 0) {
      throw new BadRequestException(`Cannot activate provider: ${errors.join(', ')}`);
    }
  }

  private async generateProviderCode(providerType: ProviderType): Promise<string> {
    const typePrefix = {
      [ProviderType.INTERNAL]: 'INT',
      [ProviderType.EXTERNAL_CONTRACTOR]: 'EXT',
      [ProviderType.CERTIFIED_PARTNER]: 'CPT',
      [ProviderType.SPECIALIST_VENDOR]: 'SPC',
      [ProviderType.EMERGENCY_SERVICE]: 'EMR',
    };

    const prefix = typePrefix[providerType] || 'SP';
    
    // Find the next sequence number for this type
    const lastProvider = await this.serviceProviderRepository
      .createQueryBuilder('provider')
      .where('provider.providerCode LIKE :pattern', { 
        pattern: `${prefix}-%` 
      })
      .orderBy('provider.providerCode', 'DESC')
      .getOne();

    let sequence = 1;
    if (lastProvider) {
      const lastNumber = lastProvider.providerCode.split('-')[1];
      sequence = parseInt(lastNumber) + 1;
    }

    return `${prefix}-${sequence.toString().padStart(3, '0')}`;
  }

  async getProviderStatistics(filters?: {
    period?: number;
    providerType?: ProviderType;
  }) {
    const whereClause = [];
    const params = [];

    if (filters?.period) {
      whereClause.push('created_at >= NOW() - INTERVAL \\'' + filters.period + ' days\\'');
    }

    if (filters?.providerType) {
      whereClause.push('provider_type = $' + (params.length + 1));
      params.push(filters.providerType);
    }

    const whereSQL = whereClause.length > 0 ? 'WHERE ' + whereClause.join(' AND ') : '';

    const [
      totalProviders,
      providersByStatus,
      providersByType,
      avgRating,
      expiringCertifications,
      expiringInsurance,
    ] = await Promise.all([
      this.serviceProviderRepository.query(`
        SELECT COUNT(*) as count
        FROM mr_services.service_providers
        ${whereSQL}
      `, params),
      this.serviceProviderRepository.query(`
        SELECT status, COUNT(*) as count
        FROM mr_services.service_providers
        ${whereSQL}
        GROUP BY status
        ORDER BY count DESC
      `, params),
      this.serviceProviderRepository.query(`
        SELECT provider_type, COUNT(*) as count
        FROM mr_services.service_providers
        ${whereSQL}
        GROUP BY provider_type
        ORDER BY count DESC
      `, params),
      this.serviceProviderRepository.query(`
        SELECT AVG(performance_rating) as avg_rating
        FROM mr_services.service_providers
        ${whereSQL ? whereSQL + ' AND' : 'WHERE'} performance_rating > 0
      `, params),
      this.serviceProviderRepository.query(`
        SELECT COUNT(*) as count
        FROM mr_services.service_providers
        WHERE status = 'active'
        AND EXISTS (
          SELECT 1 FROM jsonb_array_elements(certifications) cert
          WHERE (cert->>'expiryDate')::timestamp <= NOW() + INTERVAL '90 days'
          AND cert->>'status' = 'valid'
        )
      `),
      this.serviceProviderRepository.query(`
        SELECT COUNT(*) as count
        FROM mr_services.service_providers
        WHERE status = 'active'
        AND (insurance_information->'generalLiability'->>'expiryDate')::timestamp <= NOW() + INTERVAL '30 days'
      `),
    ]);

    return {
      totals: {
        totalProviders: parseInt(totalProviders[0].count),
        avgRating: parseFloat(avgRating[0].avg_rating || 0),
        expiringCertifications: parseInt(expiringCertifications[0].count),
        expiringInsurance: parseInt(expiringInsurance[0].count),
      },
      breakdown: {
        byStatus: providersByStatus,
        byType: providersByType,
      },
    };
  }
}