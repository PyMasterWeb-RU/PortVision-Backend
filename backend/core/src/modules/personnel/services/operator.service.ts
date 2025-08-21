import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { 
  Operator, 
  OperatorStatus, 
  EmploymentType, 
  ShiftPattern 
} from '../entities/operator.entity';

export interface CreateOperatorDto {
  firstName: string;
  middleName?: string;
  lastName: string;
  email: string;
  phoneNumber?: string;
  birthDate?: Date;
  employmentType?: EmploymentType;
  position: string;
  positionId?: string;
  department: string;
  departmentId: string;
  supervisorId?: string;
  supervisorName?: string;
  hireDate: Date;
  shiftPattern?: ShiftPattern;
  personalInfo?: any;
  skillsQualifications: any;
  workSchedule: any;
  performanceMetrics?: any;
  safetyData: any;
  compensationInfo?: any;
  currentStatus?: any;
  notificationPreferences?: any;
  careerHistory?: any[];
  metadata?: Record<string, any>;
}

export interface UpdateOperatorDto {
  firstName?: string;
  middleName?: string;
  lastName?: string;
  email?: string;
  phoneNumber?: string;
  birthDate?: Date;
  status?: OperatorStatus;
  employmentType?: EmploymentType;
  position?: string;
  positionId?: string;
  department?: string;
  departmentId?: string;
  supervisorId?: string;
  supervisorName?: string;
  terminationDate?: Date;
  shiftPattern?: ShiftPattern;
  personalInfo?: any;
  skillsQualifications?: any;
  workSchedule?: any;
  performanceMetrics?: any;
  safetyData?: any;
  compensationInfo?: any;
  currentStatus?: any;
  notificationPreferences?: any;
  careerHistory?: any[];
  metadata?: Record<string, any>;
}

export interface OperatorSearchFilters {
  status?: OperatorStatus;
  employmentType?: EmploymentType;
  departmentId?: string;
  positionId?: string;
  supervisorId?: string;
  shiftPattern?: ShiftPattern;
  skillsRequired?: string[];
  equipmentQualified?: string[];
  availabilityStatus?: 'available' | 'busy' | 'unavailable';
  locationZone?: string;
  hireDateAfter?: Date;
  hireDateBefore?: Date;
  performanceRating?: { min: number; max: number };
  experienceYears?: { min: number; max: number };
  searchText?: string;
}

export interface OperatorAvailabilityFilters {
  startTime: Date;
  endTime: Date;
  requiredSkills?: string[];
  equipmentTypes?: string[];
  locationZone?: string;
  shiftPattern?: ShiftPattern;
  excludeOperatorIds?: string[];
}

@Injectable()
export class OperatorService {
  private readonly logger = new Logger(OperatorService.name);

  constructor(
    @InjectRepository(Operator)
    private readonly operatorRepository: Repository<Operator>,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async createOperator(createOperatorDto: CreateOperatorDto): Promise<Operator> {
    this.logger.log(`Creating operator: ${createOperatorDto.firstName} ${createOperatorDto.lastName}`);

    // Generate operator number
    const operatorNumber = await this.generateOperatorNumber();

    // Set full name
    const fullName = `${createOperatorDto.firstName} ${createOperatorDto.middleName || ''} ${createOperatorDto.lastName}`.replace(/\s+/g, ' ').trim();

    const operator = this.operatorRepository.create({
      ...createOperatorDto,
      operatorNumber,
      fullName,
      status: OperatorStatus.ACTIVE,
    });

    const savedOperator = await this.operatorRepository.save(operator);

    this.eventEmitter.emit('operator.created', {
      operatorId: savedOperator.id,
      operatorNumber: savedOperator.operatorNumber,
      fullName: savedOperator.fullName,
      departmentId: savedOperator.departmentId,
      position: savedOperator.position,
    });

    this.logger.log(`Operator created: ${savedOperator.operatorNumber}`);
    return savedOperator;
  }

  async getAllOperators(): Promise<Operator[]> {
    return this.operatorRepository.find({
      order: { operatorNumber: 'ASC' },
    });
  }

  async getOperatorById(id: string): Promise<Operator> {
    const operator = await this.operatorRepository.findOne({
      where: { id },
    });

    if (!operator) {
      throw new NotFoundException(`Operator with ID ${id} not found`);
    }

    return operator;
  }

  async getOperatorByNumber(operatorNumber: string): Promise<Operator> {
    const operator = await this.operatorRepository.findOne({
      where: { operatorNumber },
    });

    if (!operator) {
      throw new NotFoundException(`Operator with number ${operatorNumber} not found`);
    }

    return operator;
  }

  async getOperatorByEmail(email: string): Promise<Operator> {
    const operator = await this.operatorRepository.findOne({
      where: { email },
    });

    if (!operator) {
      throw new NotFoundException(`Operator with email ${email} not found`);
    }

    return operator;
  }

  async updateOperator(id: string, updateOperatorDto: UpdateOperatorDto): Promise<Operator> {
    const operator = await this.getOperatorById(id);

    // Update full name if name fields changed
    if (updateOperatorDto.firstName || updateOperatorDto.middleName !== undefined || updateOperatorDto.lastName) {
      const firstName = updateOperatorDto.firstName || operator.firstName;
      const middleName = updateOperatorDto.middleName !== undefined ? updateOperatorDto.middleName : operator.middleName;
      const lastName = updateOperatorDto.lastName || operator.lastName;
      updateOperatorDto.fullName = `${firstName} ${middleName || ''} ${lastName}`.replace(/\s+/g, ' ').trim();
    }

    Object.assign(operator, updateOperatorDto);
    const updatedOperator = await this.operatorRepository.save(operator);

    this.eventEmitter.emit('operator.updated', {
      operatorId: updatedOperator.id,
      operatorNumber: updatedOperator.operatorNumber,
      changes: updateOperatorDto,
    });

    this.logger.log(`Operator updated: ${updatedOperator.operatorNumber}`);
    return updatedOperator;
  }

  async deleteOperator(id: string): Promise<void> {
    const operator = await this.getOperatorById(id);

    if (operator.status === OperatorStatus.ACTIVE) {
      throw new BadRequestException(`Cannot delete active operator ${operator.operatorNumber}. Please set status to inactive first.`);
    }

    await this.operatorRepository.remove(operator);

    this.eventEmitter.emit('operator.deleted', {
      operatorId: operator.id,
      operatorNumber: operator.operatorNumber,
    });

    this.logger.log(`Operator deleted: ${operator.operatorNumber}`);
  }

  async searchOperators(filters: OperatorSearchFilters): Promise<Operator[]> {
    const query = this.operatorRepository.createQueryBuilder('operator');

    if (filters.status) {
      query.andWhere('operator.status = :status', { status: filters.status });
    }

    if (filters.employmentType) {
      query.andWhere('operator.employmentType = :employmentType', { 
        employmentType: filters.employmentType 
      });
    }

    if (filters.departmentId) {
      query.andWhere('operator.departmentId = :departmentId', { 
        departmentId: filters.departmentId 
      });
    }

    if (filters.positionId) {
      query.andWhere('operator.positionId = :positionId', { 
        positionId: filters.positionId 
      });
    }

    if (filters.supervisorId) {
      query.andWhere('operator.supervisorId = :supervisorId', { 
        supervisorId: filters.supervisorId 
      });
    }

    if (filters.shiftPattern) {
      query.andWhere('operator.shiftPattern = :shiftPattern', { 
        shiftPattern: filters.shiftPattern 
      });
    }

    if (filters.skillsRequired?.length) {
      query.andWhere(
        'operator.skillsQualifications->>\'primarySkills\' ?| ARRAY[:...skills]',
        { skills: filters.skillsRequired }
      );
    }

    if (filters.equipmentQualified?.length) {
      query.andWhere(`
        EXISTS (
          SELECT 1 FROM jsonb_array_elements(operator.skills_qualifications->'equipmentQualifications') eq
          WHERE eq->>'equipmentType' = ANY(:equipmentTypes)
        )
      `, { equipmentTypes: filters.equipmentQualified });
    }

    if (filters.availabilityStatus) {
      switch (filters.availabilityStatus) {
        case 'available':
          query.andWhere('operator.currentStatus->>\'availability\'->>\'isAvailable\' = \'true\'');
          break;
        case 'busy':
          query.andWhere('(operator.currentStatus->>\'workload\'->>\'utilizationPercentage\')::int > 80');
          break;
        case 'unavailable':
          query.andWhere('operator.currentStatus->>\'availability\'->>\'isAvailable\' = \'false\'');
          break;
      }
    }

    if (filters.locationZone) {
      query.andWhere('operator.currentStatus->>\'currentLocation\'->>\'zone\' = :zone', { 
        zone: filters.locationZone 
      });
    }

    if (filters.hireDateAfter) {
      query.andWhere('operator.hireDate >= :hireDateAfter', { 
        hireDateAfter: filters.hireDateAfter 
      });
    }

    if (filters.hireDateBefore) {
      query.andWhere('operator.hireDate <= :hireDateBefore', { 
        hireDateBefore: filters.hireDateBefore 
      });
    }

    if (filters.performanceRating) {
      query.andWhere(
        '(operator.performanceMetrics->>\'currentPeriod\'->>\'qualityScore\')::numeric BETWEEN :minRating AND :maxRating',
        { 
          minRating: filters.performanceRating.min,
          maxRating: filters.performanceRating.max 
        }
      );
    }

    if (filters.experienceYears) {
      const currentYear = new Date().getFullYear();
      query.andWhere(
        ':currentYear - EXTRACT(YEAR FROM operator.hireDate) BETWEEN :minYears AND :maxYears',
        {
          currentYear,
          minYears: filters.experienceYears.min,
          maxYears: filters.experienceYears.max
        }
      );
    }

    if (filters.searchText) {
      query.andWhere(`(
        operator.operatorNumber ILIKE :searchText
        OR operator.fullName ILIKE :searchText
        OR operator.firstName ILIKE :searchText
        OR operator.lastName ILIKE :searchText
        OR operator.email ILIKE :searchText
        OR operator.phoneNumber ILIKE :searchText
        OR operator.position ILIKE :searchText
        OR operator.department ILIKE :searchText
      )`, { searchText: `%${filters.searchText}%` });
    }

    query.orderBy('operator.operatorNumber', 'ASC');

    return query.getMany();
  }

  async getOperatorsByStatus(status: OperatorStatus): Promise<Operator[]> {
    return this.searchOperators({ status });
  }

  async getOperatorsByDepartment(departmentId: string): Promise<Operator[]> {
    return this.searchOperators({ departmentId });
  }

  async getOperatorsBySupervisor(supervisorId: string): Promise<Operator[]> {
    return this.searchOperators({ supervisorId });
  }

  async getAvailableOperators(filters: OperatorAvailabilityFilters): Promise<Operator[]> {
    const query = this.operatorRepository.createQueryBuilder('operator')
      .where('operator.status = :status', { status: OperatorStatus.ACTIVE })
      .andWhere('operator.currentStatus->>\'availability\'->>\'isAvailable\' = \'true\'');

    if (filters.requiredSkills?.length) {
      query.andWhere(
        'operator.skillsQualifications->>\'primarySkills\' ?| ARRAY[:...skills]',
        { skills: filters.requiredSkills }
      );
    }

    if (filters.equipmentTypes?.length) {
      query.andWhere(`
        EXISTS (
          SELECT 1 FROM jsonb_array_elements(operator.skills_qualifications->'equipmentQualifications') eq
          WHERE eq->>'equipmentType' = ANY(:equipmentTypes)
        )
      `, { equipmentTypes: filters.equipmentTypes });
    }

    if (filters.locationZone) {
      query.andWhere('operator.currentStatus->>\'currentLocation\'->>\'zone\' = :zone', { 
        zone: filters.locationZone 
      });
    }

    if (filters.shiftPattern) {
      query.andWhere('operator.shiftPattern = :shiftPattern', { 
        shiftPattern: filters.shiftPattern 
      });
    }

    if (filters.excludeOperatorIds?.length) {
      query.andWhere('operator.id NOT IN (:...excludeIds)', { 
        excludeIds: filters.excludeOperatorIds 
      });
    }

    // TODO: Add shift schedule checking against the requested time range
    // This would require joining with shifts table to check availability

    query.orderBy('operator.operatorNumber', 'ASC');

    return query.getMany();
  }

  async updateOperatorStatus(id: string, status: OperatorStatus, reason?: string): Promise<Operator> {
    const operator = await this.getOperatorById(id);
    const previousStatus = operator.status;

    const updateData: UpdateOperatorDto = { status };
    
    if (status === OperatorStatus.TERMINATED && !operator.terminationDate) {
      updateData.terminationDate = new Date();
    }

    if (reason) {
      updateData.metadata = {
        ...operator.metadata,
        statusChangeReason: reason,
        statusChangedAt: new Date(),
      };
    }

    const updatedOperator = await this.updateOperator(id, updateData);

    this.eventEmitter.emit('operator.status_changed', {
      operatorId: id,
      operatorNumber: operator.operatorNumber,
      previousStatus,
      newStatus: status,
      reason,
      changedAt: new Date(),
    });

    return updatedOperator;
  }

  async updateOperatorLocation(
    id: string, 
    location: { latitude: number; longitude: number; zone?: string; accuracy?: number }
  ): Promise<Operator> {
    const operator = await this.getOperatorById(id);

    const currentStatus = {
      ...operator.currentStatus,
      currentLocation: {
        latitude: location.latitude,
        longitude: location.longitude,
        accuracy: location.accuracy,
        timestamp: new Date(),
        zone: location.zone,
      },
    };

    const updatedOperator = await this.updateOperator(id, { currentStatus });

    this.eventEmitter.emit('operator.location_updated', {
      operatorId: id,
      operatorNumber: operator.operatorNumber,
      location,
      timestamp: new Date(),
    });

    return updatedOperator;
  }

  async updateOperatorAvailability(
    id: string, 
    availability: { isAvailable: boolean; reason?: string; availableFrom?: Date }
  ): Promise<Operator> {
    const operator = await this.getOperatorById(id);

    const currentStatus = {
      ...operator.currentStatus,
      availability,
    };

    const updatedOperator = await this.updateOperator(id, { currentStatus });

    this.eventEmitter.emit('operator.availability_changed', {
      operatorId: id,
      operatorNumber: operator.operatorNumber,
      availability,
      changedAt: new Date(),
    });

    return updatedOperator;
  }

  async addSkillQualification(
    id: string,
    qualification: {
      equipmentType: string;
      proficiencyLevel: 'beginner' | 'intermediate' | 'advanced' | 'expert';
      certifiedDate: Date;
      expiresDate?: Date;
      instructorId?: string;
    }
  ): Promise<Operator> {
    const operator = await this.getOperatorById(id);

    const skillsQualifications = {
      ...operator.skillsQualifications,
      equipmentQualifications: [
        ...(operator.skillsQualifications.equipmentQualifications || []),
        qualification,
      ],
    };

    const updatedOperator = await this.updateOperator(id, { skillsQualifications });

    this.eventEmitter.emit('operator.qualification_added', {
      operatorId: id,
      operatorNumber: operator.operatorNumber,
      qualification,
    });

    return updatedOperator;
  }

  async addCertification(
    id: string,
    certification: {
      certificationType: string;
      certificateNumber: string;
      issuedBy: string;
      issuedDate: Date;
      expiresDate: Date;
      documentUrl?: string;
    }
  ): Promise<Operator> {
    const operator = await this.getOperatorById(id);

    const skillsQualifications = {
      ...operator.skillsQualifications,
      certifications: [
        ...(operator.skillsQualifications.certifications || []),
        {
          ...certification,
          isActive: true,
        },
      ],
    };

    const updatedOperator = await this.updateOperator(id, { skillsQualifications });

    this.eventEmitter.emit('operator.certification_added', {
      operatorId: id,
      operatorNumber: operator.operatorNumber,
      certification,
    });

    return updatedOperator;
  }

  async updatePerformanceMetrics(
    id: string,
    metrics: {
      hoursWorked?: number;
      tasksCompleted?: number;
      qualityScore?: number;
      productivityScore?: number;
      safetyScore?: number;
      customerSatisfaction?: number;
    }
  ): Promise<Operator> {
    const operator = await this.getOperatorById(id);

    const currentPeriod = {
      ...operator.performanceMetrics?.currentPeriod,
      ...metrics,
    };

    const performanceMetrics = {
      ...operator.performanceMetrics,
      currentPeriod,
    };

    const updatedOperator = await this.updateOperator(id, { performanceMetrics });

    this.eventEmitter.emit('operator.performance_updated', {
      operatorId: id,
      operatorNumber: operator.operatorNumber,
      metrics,
      updatedAt: new Date(),
    });

    return updatedOperator;
  }

  private async generateOperatorNumber(): Promise<string> {
    const year = new Date().getFullYear();
    
    // Find the next sequence number for this year
    const lastOperator = await this.operatorRepository
      .createQueryBuilder('operator')
      .where('operator.operatorNumber LIKE :pattern', { 
        pattern: `OP-${year}-%` 
      })
      .orderBy('operator.operatorNumber', 'DESC')
      .getOne();

    let sequence = 1;
    if (lastOperator) {
      const lastNumber = lastOperator.operatorNumber.split('-')[2];
      sequence = parseInt(lastNumber) + 1;
    }

    return `OP-${year}-${sequence.toString().padStart(3, '0')}`;
  }

  async getOperatorStatistics(filters?: {
    period?: number;
    departmentId?: string;
    supervisorId?: string;
    positionId?: string;
  }) {
    const whereClause = [];
    const params = [];

    if (filters?.period) {
      whereClause.push('hire_date >= NOW() - INTERVAL \\'' + filters.period + ' days\\'');
    }

    if (filters?.departmentId) {
      whereClause.push('department_id = $' + (params.length + 1));
      params.push(filters.departmentId);
    }

    if (filters?.supervisorId) {
      whereClause.push('supervisor_id = $' + (params.length + 1));
      params.push(filters.supervisorId);
    }

    if (filters?.positionId) {
      whereClause.push('position_id = $' + (params.length + 1));
      params.push(filters.positionId);
    }

    const whereSQL = whereClause.length > 0 ? 'WHERE ' + whereClause.join(' AND ') : '';

    const [
      totalOperators,
      operatorsByStatus,
      operatorsByDepartment,
      operatorsByPosition,
      avgPerformance,
      utilizationRate,
    ] = await Promise.all([
      this.operatorRepository.query(`
        SELECT COUNT(*) as count
        FROM personnel.operators
        ${whereSQL}
      `, params),
      this.operatorRepository.query(`
        SELECT status, COUNT(*) as count
        FROM personnel.operators
        ${whereSQL}
        GROUP BY status
        ORDER BY count DESC
      `, params),
      this.operatorRepository.query(`
        SELECT department, COUNT(*) as count
        FROM personnel.operators
        ${whereSQL}
        GROUP BY department
        ORDER BY count DESC
      `, params),
      this.operatorRepository.query(`
        SELECT position, COUNT(*) as count
        FROM personnel.operators
        ${whereSQL}
        GROUP BY position
        ORDER BY count DESC
      `, params),
      this.operatorRepository.query(`
        SELECT 
          AVG((performance_metrics->'currentPeriod'->>'qualityScore')::numeric) as avg_quality,
          AVG((performance_metrics->'currentPeriod'->>'productivityScore')::numeric) as avg_productivity,
          AVG((performance_metrics->'currentPeriod'->>'safetyScore')::numeric) as avg_safety
        FROM personnel.operators
        ${whereSQL ? whereSQL + ' AND' : 'WHERE'} performance_metrics IS NOT NULL
      `, params),
      this.operatorRepository.query(`
        SELECT 
          COUNT(CASE WHEN current_status->'availability'->>'isAvailable' = 'true' THEN 1 END) * 100.0 / 
          COUNT(CASE WHEN status = 'active' THEN 1 END) as utilization_rate
        FROM personnel.operators
        ${whereSQL}
      `, params),
    ]);

    return {
      totals: {
        totalOperators: parseInt(totalOperators[0].count),
        utilizationRate: parseFloat(utilizationRate[0].utilization_rate || 0),
        avgQualityScore: parseFloat(avgPerformance[0].avg_quality || 0),
        avgProductivityScore: parseFloat(avgPerformance[0].avg_productivity || 0),
        avgSafetyScore: parseFloat(avgPerformance[0].avg_safety || 0),
      },
      breakdown: {
        byStatus: operatorsByStatus,
        byDepartment: operatorsByDepartment,
        byPosition: operatorsByPosition,
      },
    };
  }
}