import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { 
  MaintenanceRequest, 
  MaintenanceRequestType, 
  RequestStatus, 
  RequestPriority,
  RequestSource 
} from '../entities/maintenance-request.entity';

export interface CreateMaintenanceRequestDto {
  requestType: MaintenanceRequestType;
  priority?: RequestPriority;
  requestSource: RequestSource;
  clientId: string;
  clientName: string;
  clientContact: string;
  containerId: string;
  containerNumber: string;
  containerType: string;
  containerSize: string;
  containerLocation: string;
  containerCoordinates?: any;
  description: string;
  damageDetails?: any;
  workScheduling?: any;
  notes?: string;
  metadata?: Record<string, any>;
}

export interface UpdateMaintenanceRequestDto {
  requestType?: MaintenanceRequestType;
  status?: RequestStatus;
  priority?: RequestPriority;
  clientContact?: string;
  containerLocation?: string;
  containerCoordinates?: any;
  description?: string;
  damageDetails?: any;
  quoteInformation?: any;
  workScheduling?: any;
  assignedTeam?: any;
  scheduledDate?: Date;
  scheduledCompletion?: Date;
  actualStartDate?: Date;
  actualCompletionDate?: Date;
  workReport?: any;
  billingInformation?: any;
  relatedDocuments?: any[];
  cancellationReason?: string;
  notes?: string;
  metadata?: Record<string, any>;
}

export interface RequestSearchFilters {
  requestType?: MaintenanceRequestType;
  status?: RequestStatus;
  priority?: RequestPriority;
  requestSource?: RequestSource;
  clientId?: string;
  containerId?: string;
  containerType?: string;
  scheduledDateAfter?: Date;
  scheduledDateBefore?: Date;
  actualStartAfter?: Date;
  actualStartBefore?: Date;
  isOverdue?: boolean;
  hasQuote?: boolean;
  isCompleted?: boolean;
  assignedSupervisor?: string;
  workLocation?: string;
  searchText?: string;
}

@Injectable()
export class MaintenanceRequestService {
  private readonly logger = new Logger(MaintenanceRequestService.name);

  constructor(
    @InjectRepository(MaintenanceRequest)
    private readonly maintenanceRequestRepository: Repository<MaintenanceRequest>,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async createMaintenanceRequest(createMaintenanceRequestDto: CreateMaintenanceRequestDto): Promise<MaintenanceRequest> {
    this.logger.log(`Creating maintenance request for container: ${createMaintenanceRequestDto.containerNumber}`);

    // Generate request number
    const requestNumber = await this.generateRequestNumber(createMaintenanceRequestDto.requestType);

    const maintenanceRequest = this.maintenanceRequestRepository.create({
      ...createMaintenanceRequestDto,
      requestNumber,
      status: RequestStatus.PENDING,
    });

    const savedRequest = await this.maintenanceRequestRepository.save(maintenanceRequest);

    this.eventEmitter.emit('maintenance_request.created', {
      requestId: savedRequest.id,
      requestNumber: savedRequest.requestNumber,
      requestType: savedRequest.requestType,
      clientId: savedRequest.clientId,
      containerId: savedRequest.containerId,
      priority: savedRequest.priority,
    });

    this.logger.log(`Maintenance request created: ${savedRequest.requestNumber}`);
    return savedRequest;
  }

  async getAllMaintenanceRequests(): Promise<MaintenanceRequest[]> {
    return this.maintenanceRequestRepository.find({
      order: { createdAt: 'DESC' },
    });
  }

  async getMaintenanceRequestById(id: string): Promise<MaintenanceRequest> {
    const request = await this.maintenanceRequestRepository.findOne({
      where: { id },
    });

    if (!request) {
      throw new NotFoundException(`Maintenance request with ID ${id} not found`);
    }

    return request;
  }

  async getMaintenanceRequestByNumber(requestNumber: string): Promise<MaintenanceRequest> {
    const request = await this.maintenanceRequestRepository.findOne({
      where: { requestNumber },
    });

    if (!request) {
      throw new NotFoundException(`Maintenance request with number ${requestNumber} not found`);
    }

    return request;
  }

  async updateMaintenanceRequest(id: string, updateMaintenanceRequestDto: UpdateMaintenanceRequestDto): Promise<MaintenanceRequest> {
    const request = await this.getMaintenanceRequestById(id);

    // Validate status transitions
    if (updateMaintenanceRequestDto.status) {
      this.validateStatusTransition(request.status, updateMaintenanceRequestDto.status);
    }

    // Update status history if status is changing
    if (updateMaintenanceRequestDto.status && updateMaintenanceRequestDto.status !== request.status) {
      const statusHistory = request.statusHistory || [];
      statusHistory.push({
        status: updateMaintenanceRequestDto.status,
        changedBy: 'system', // TODO: get from current user context
        changedAt: new Date(),
        reason: 'Status updated via API',
      });
      updateMaintenanceRequestDto.statusHistory = statusHistory;
    }

    Object.assign(request, updateMaintenanceRequestDto);
    const updatedRequest = await this.maintenanceRequestRepository.save(request);

    this.eventEmitter.emit('maintenance_request.updated', {
      requestId: updatedRequest.id,
      requestNumber: updatedRequest.requestNumber,
      changes: updateMaintenanceRequestDto,
    });

    this.logger.log(`Maintenance request updated: ${updatedRequest.requestNumber}`);
    return updatedRequest;
  }

  async deleteMaintenanceRequest(id: string): Promise<void> {
    const request = await this.getMaintenanceRequestById(id);

    if ([RequestStatus.IN_PROGRESS, RequestStatus.SCHEDULED].includes(request.status)) {
      throw new BadRequestException(`Cannot delete request ${request.requestNumber} - status is ${request.status}`);
    }

    await this.maintenanceRequestRepository.remove(request);

    this.eventEmitter.emit('maintenance_request.deleted', {
      requestId: request.id,
      requestNumber: request.requestNumber,
    });

    this.logger.log(`Maintenance request deleted: ${request.requestNumber}`);
  }

  async searchMaintenanceRequests(filters: RequestSearchFilters): Promise<MaintenanceRequest[]> {
    const query = this.maintenanceRequestRepository.createQueryBuilder('request');

    if (filters.requestType) {
      query.andWhere('request.requestType = :requestType', { requestType: filters.requestType });
    }

    if (filters.status) {
      query.andWhere('request.status = :status', { status: filters.status });
    }

    if (filters.priority) {
      query.andWhere('request.priority = :priority', { priority: filters.priority });
    }

    if (filters.requestSource) {
      query.andWhere('request.requestSource = :requestSource', { requestSource: filters.requestSource });
    }

    if (filters.clientId) {
      query.andWhere('request.clientId = :clientId', { clientId: filters.clientId });
    }

    if (filters.containerId) {
      query.andWhere('request.containerId = :containerId', { containerId: filters.containerId });
    }

    if (filters.containerType) {
      query.andWhere('request.containerType = :containerType', { containerType: filters.containerType });
    }

    if (filters.scheduledDateAfter) {
      query.andWhere('request.scheduledDate >= :scheduledDateAfter', { scheduledDateAfter: filters.scheduledDateAfter });
    }

    if (filters.scheduledDateBefore) {
      query.andWhere('request.scheduledDate <= :scheduledDateBefore', { scheduledDateBefore: filters.scheduledDateBefore });
    }

    if (filters.actualStartAfter) {
      query.andWhere('request.actualStartDate >= :actualStartAfter', { actualStartAfter: filters.actualStartAfter });
    }

    if (filters.actualStartBefore) {
      query.andWhere('request.actualStartDate <= :actualStartBefore', { actualStartBefore: filters.actualStartBefore });
    }

    if (filters.isOverdue) {
      query.andWhere('request.scheduledCompletion < NOW()')
        .andWhere('request.status != :completedStatus', { completedStatus: RequestStatus.COMPLETED });
    }

    if (filters.hasQuote) {
      query.andWhere('request.quoteInformation IS NOT NULL');
    }

    if (filters.isCompleted) {
      query.andWhere('request.status = :completedStatus', { completedStatus: RequestStatus.COMPLETED });
    }

    if (filters.assignedSupervisor) {
      query.andWhere('request.assignedTeam->>\'supervisor\'->>\'operatorId\' = :supervisorId', 
        { supervisorId: filters.assignedSupervisor });
    }

    if (filters.workLocation) {
      query.andWhere('request.workScheduling->>\'workLocation\' ILIKE :workLocation', 
        { workLocation: `%${filters.workLocation}%` });
    }

    if (filters.searchText) {
      query.andWhere(`(
        request.requestNumber ILIKE :searchText
        OR request.containerNumber ILIKE :searchText
        OR request.clientName ILIKE :searchText
        OR request.description ILIKE :searchText
        OR request.containerLocation ILIKE :searchText
      )`, { searchText: `%${filters.searchText}%` });
    }

    query.orderBy('request.createdAt', 'DESC');

    return query.getMany();
  }

  async getRequestsByType(requestType: MaintenanceRequestType): Promise<MaintenanceRequest[]> {
    return this.searchMaintenanceRequests({ requestType });
  }

  async getRequestsByStatus(status: RequestStatus): Promise<MaintenanceRequest[]> {
    return this.searchMaintenanceRequests({ status });
  }

  async getRequestsByClient(clientId: string): Promise<MaintenanceRequest[]> {
    return this.searchMaintenanceRequests({ clientId });
  }

  async getRequestsByContainer(containerId: string): Promise<MaintenanceRequest[]> {
    return this.searchMaintenanceRequests({ containerId });
  }

  async getPendingRequests(): Promise<MaintenanceRequest[]> {
    return this.searchMaintenanceRequests({ status: RequestStatus.PENDING });
  }

  async getActiveRequests(): Promise<MaintenanceRequest[]> {
    return this.maintenanceRequestRepository.find({
      where: [
        { status: RequestStatus.SCHEDULED },
        { status: RequestStatus.IN_PROGRESS },
      ],
      order: { scheduledDate: 'ASC' },
    });
  }

  async getOverdueRequests(): Promise<MaintenanceRequest[]> {
    return this.searchMaintenanceRequests({ isOverdue: true });
  }

  async getRequestsRequiringQuotes(): Promise<MaintenanceRequest[]> {
    const query = this.maintenanceRequestRepository.createQueryBuilder('request')
      .where('request.status = :status', { status: RequestStatus.PENDING })
      .andWhere('request.requestType IN (:...types)', { 
        types: [
          MaintenanceRequestType.CONTAINER_REPAIR,
          MaintenanceRequestType.MODIFICATION,
          MaintenanceRequestType.RECONDITIONING,
        ]
      })
      .andWhere('request.quoteInformation IS NULL');

    return query.getMany();
  }

  async submitQuote(
    id: string, 
    quoteInformation: any,
    quotedBy: string
  ): Promise<MaintenanceRequest> {
    const request = await this.getMaintenanceRequestById(id);

    if (request.status !== RequestStatus.PENDING) {
      throw new BadRequestException(`Cannot submit quote for request ${request.requestNumber} - status is ${request.status}`);
    }

    const updatedRequest = await this.updateMaintenanceRequest(id, {
      status: RequestStatus.QUOTED,
      quoteInformation: {
        ...quoteInformation,
        quotedBy,
        quotedAt: new Date(),
      },
    });

    this.eventEmitter.emit('maintenance_request.quote_submitted', {
      requestId: updatedRequest.id,
      requestNumber: updatedRequest.requestNumber,
      clientId: request.clientId,
      totalAmount: quoteInformation.totalAmount,
    });

    return updatedRequest;
  }

  async acceptQuote(id: string, acceptedBy: string): Promise<MaintenanceRequest> {
    const request = await this.getMaintenanceRequestById(id);

    if (request.status !== RequestStatus.QUOTED) {
      throw new BadRequestException(`Cannot accept quote for request ${request.requestNumber} - status is ${request.status}`);
    }

    const quoteInformation = {
      ...request.quoteInformation,
      acceptedBy,
      acceptedAt: new Date(),
    };

    const updatedRequest = await this.updateMaintenanceRequest(id, {
      status: RequestStatus.QUOTE_ACCEPTED,
      quoteInformation,
    });

    this.eventEmitter.emit('maintenance_request.quote_accepted', {
      requestId: updatedRequest.id,
      requestNumber: updatedRequest.requestNumber,
      acceptedBy,
    });

    return updatedRequest;
  }

  async rejectQuote(id: string, rejectionReason: string): Promise<MaintenanceRequest> {
    const request = await this.getMaintenanceRequestById(id);

    if (request.status !== RequestStatus.QUOTED) {
      throw new BadRequestException(`Cannot reject quote for request ${request.requestNumber} - status is ${request.status}`);
    }

    const quoteInformation = {
      ...request.quoteInformation,
      rejectionReason,
    };

    const updatedRequest = await this.updateMaintenanceRequest(id, {
      status: RequestStatus.QUOTE_REJECTED,
      quoteInformation,
    });

    this.eventEmitter.emit('maintenance_request.quote_rejected', {
      requestId: updatedRequest.id,
      requestNumber: updatedRequest.requestNumber,
      rejectionReason,
    });

    return updatedRequest;
  }

  async scheduleWork(
    id: string,
    scheduledDate: Date,
    scheduledCompletion: Date,
    assignedTeam?: any
  ): Promise<MaintenanceRequest> {
    const request = await this.getMaintenanceRequestById(id);

    if (![RequestStatus.QUOTE_ACCEPTED, RequestStatus.PENDING].includes(request.status)) {
      throw new BadRequestException(`Cannot schedule work for request ${request.requestNumber} - status is ${request.status}`);
    }

    // Generate work order number
    const workOrderNumber = await this.generateWorkOrderNumber();

    const updatedRequest = await this.updateMaintenanceRequest(id, {
      status: RequestStatus.SCHEDULED,
      scheduledDate,
      scheduledCompletion,
      workOrderNumber,
      assignedTeam,
    });

    this.eventEmitter.emit('maintenance_request.work_scheduled', {
      requestId: updatedRequest.id,
      requestNumber: updatedRequest.requestNumber,
      workOrderNumber,
      scheduledDate,
      assignedTeam,
    });

    return updatedRequest;
  }

  async startWork(id: string): Promise<MaintenanceRequest> {
    const request = await this.getMaintenanceRequestById(id);

    if (request.status !== RequestStatus.SCHEDULED) {
      throw new BadRequestException(`Cannot start work for request ${request.requestNumber} - status is ${request.status}`);
    }

    const updatedRequest = await this.updateMaintenanceRequest(id, {
      status: RequestStatus.IN_PROGRESS,
      actualStartDate: new Date(),
    });

    this.eventEmitter.emit('maintenance_request.work_started', {
      requestId: updatedRequest.id,
      requestNumber: updatedRequest.requestNumber,
      actualStartDate: updatedRequest.actualStartDate,
    });

    return updatedRequest;
  }

  async completeWork(id: string, workReport?: any): Promise<MaintenanceRequest> {
    const request = await this.getMaintenanceRequestById(id);

    if (request.status !== RequestStatus.IN_PROGRESS) {
      throw new BadRequestException(`Cannot complete work for request ${request.requestNumber} - status is ${request.status}`);
    }

    const updatedRequest = await this.updateMaintenanceRequest(id, {
      status: RequestStatus.COMPLETED,
      actualCompletionDate: new Date(),
      workReport: workReport || {},
    });

    this.eventEmitter.emit('maintenance_request.work_completed', {
      requestId: updatedRequest.id,
      requestNumber: updatedRequest.requestNumber,
      actualCompletionDate: updatedRequest.actualCompletionDate,
      workReport,
    });

    return updatedRequest;
  }

  async putOnHold(id: string, reason: string): Promise<MaintenanceRequest> {
    const request = await this.getMaintenanceRequestById(id);

    if (![RequestStatus.SCHEDULED, RequestStatus.IN_PROGRESS].includes(request.status)) {
      throw new BadRequestException(`Cannot put request ${request.requestNumber} on hold - status is ${request.status}`);
    }

    const updatedRequest = await this.updateMaintenanceRequest(id, {
      status: RequestStatus.ON_HOLD,
      notes: `${request.notes || ''}\nOn Hold: ${reason}`,
    });

    this.eventEmitter.emit('maintenance_request.put_on_hold', {
      requestId: updatedRequest.id,
      requestNumber: updatedRequest.requestNumber,
      reason,
    });

    return updatedRequest;
  }

  async cancelRequest(id: string, cancellationReason: string): Promise<MaintenanceRequest> {
    const request = await this.getMaintenanceRequestById(id);

    if ([RequestStatus.COMPLETED, RequestStatus.CANCELLED].includes(request.status)) {
      throw new BadRequestException(`Cannot cancel request ${request.requestNumber} - status is ${request.status}`);
    }

    const updatedRequest = await this.updateMaintenanceRequest(id, {
      status: RequestStatus.CANCELLED,
      cancellationReason,
    });

    this.eventEmitter.emit('maintenance_request.cancelled', {
      requestId: updatedRequest.id,
      requestNumber: updatedRequest.requestNumber,
      cancellationReason,
    });

    return updatedRequest;
  }

  async addCommunication(
    id: string,
    communication: {
      communicationType: string;
      direction: string;
      subject: string;
      content: string;
      sentBy: string;
      receivedBy: string;
    }
  ): Promise<MaintenanceRequest> {
    const request = await this.getMaintenanceRequestById(id);

    const newCommunication = {
      ...communication,
      timestamp: new Date(),
      status: 'sent' as const,
    };

    const clientCommunications = request.clientCommunications || [];
    clientCommunications.push(newCommunication);

    const updatedRequest = await this.updateMaintenanceRequest(id, {
      clientCommunications,
    });

    this.eventEmitter.emit('maintenance_request.communication_added', {
      requestId: updatedRequest.id,
      requestNumber: updatedRequest.requestNumber,
      communication: newCommunication,
    });

    return updatedRequest;
  }

  private validateStatusTransition(currentStatus: RequestStatus, newStatus: RequestStatus): void {
    const validTransitions: Record<RequestStatus, RequestStatus[]> = {
      [RequestStatus.PENDING]: [RequestStatus.QUOTED, RequestStatus.SCHEDULED, RequestStatus.CANCELLED, RequestStatus.REJECTED],
      [RequestStatus.QUOTED]: [RequestStatus.QUOTE_ACCEPTED, RequestStatus.QUOTE_REJECTED, RequestStatus.CANCELLED],
      [RequestStatus.QUOTE_ACCEPTED]: [RequestStatus.SCHEDULED, RequestStatus.CANCELLED],
      [RequestStatus.QUOTE_REJECTED]: [RequestStatus.CANCELLED],
      [RequestStatus.SCHEDULED]: [RequestStatus.IN_PROGRESS, RequestStatus.ON_HOLD, RequestStatus.CANCELLED],
      [RequestStatus.IN_PROGRESS]: [RequestStatus.COMPLETED, RequestStatus.ON_HOLD, RequestStatus.CANCELLED],
      [RequestStatus.ON_HOLD]: [RequestStatus.SCHEDULED, RequestStatus.IN_PROGRESS, RequestStatus.CANCELLED],
      [RequestStatus.COMPLETED]: [],
      [RequestStatus.CANCELLED]: [],
      [RequestStatus.REJECTED]: [],
    };

    if (!validTransitions[currentStatus]?.includes(newStatus)) {
      throw new BadRequestException(
        `Invalid status transition from ${currentStatus} to ${newStatus}`
      );
    }
  }

  private async generateRequestNumber(requestType: MaintenanceRequestType): Promise<string> {
    const typePrefix = {
      [MaintenanceRequestType.CONTAINER_REPAIR]: 'MR-REP',
      [MaintenanceRequestType.CONTAINER_CLEANING]: 'MR-CLN',
      [MaintenanceRequestType.CONTAINER_INSPECTION]: 'MR-INS',
      [MaintenanceRequestType.SPECIALIZED_HANDLING]: 'MR-SPC',
      [MaintenanceRequestType.CERTIFICATION]: 'MR-CRT',
      [MaintenanceRequestType.MODIFICATION]: 'MR-MOD',
      [MaintenanceRequestType.RECONDITIONING]: 'MR-REC',
      [MaintenanceRequestType.DISPOSAL]: 'MR-DIS',
    };

    const prefix = typePrefix[requestType] || 'MR';
    const year = new Date().getFullYear();
    
    // Find the next sequence number for this type and year
    const lastRequest = await this.maintenanceRequestRepository
      .createQueryBuilder('request')
      .where('request.requestNumber LIKE :pattern', { 
        pattern: `${prefix}-${year}-%` 
      })
      .orderBy('request.requestNumber', 'DESC')
      .getOne();

    let sequence = 1;
    if (lastRequest) {
      const lastNumber = lastRequest.requestNumber.split('-')[2];
      sequence = parseInt(lastNumber) + 1;
    }

    return `${prefix}-${year}-${sequence.toString().padStart(6, '0')}`;
  }

  private async generateWorkOrderNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `WO-${year}`;
    
    // Find the next sequence number for this year
    const lastWorkOrder = await this.maintenanceRequestRepository
      .createQueryBuilder('request')
      .where('request.workOrderNumber LIKE :pattern', { 
        pattern: `${prefix}-%` 
      })
      .orderBy('request.workOrderNumber', 'DESC')
      .getOne();

    let sequence = 1;
    if (lastWorkOrder) {
      const lastNumber = lastWorkOrder.workOrderNumber.split('-')[2];
      sequence = parseInt(lastNumber) + 1;
    }

    return `${prefix}-${sequence.toString().padStart(6, '0')}`;
  }

  async getRequestStatistics(filters?: {
    period?: number;
    clientId?: string;
    requestType?: MaintenanceRequestType;
  }) {
    const whereClause = [];
    const params = [];

    if (filters?.period) {
      whereClause.push('created_at >= NOW() - INTERVAL \\'' + filters.period + ' days\\'');
    }

    if (filters?.clientId) {
      whereClause.push('client_id = $' + (params.length + 1));
      params.push(filters.clientId);
    }

    if (filters?.requestType) {
      whereClause.push('request_type = $' + (params.length + 1));
      params.push(filters.requestType);
    }

    const whereSQL = whereClause.length > 0 ? 'WHERE ' + whereClause.join(' AND ') : '';

    const [
      totalRequests,
      requestsByStatus,
      requestsByType,
      avgCompletionTime,
      overdueCount,
    ] = await Promise.all([
      this.maintenanceRequestRepository.query(`
        SELECT COUNT(*) as count
        FROM mr_services.maintenance_requests
        ${whereSQL}
      `, params),
      this.maintenanceRequestRepository.query(`
        SELECT status, COUNT(*) as count
        FROM mr_services.maintenance_requests
        ${whereSQL}
        GROUP BY status
        ORDER BY count DESC
      `, params),
      this.maintenanceRequestRepository.query(`
        SELECT request_type, COUNT(*) as count
        FROM mr_services.maintenance_requests
        ${whereSQL}
        GROUP BY request_type
        ORDER BY count DESC
      `, params),
      this.maintenanceRequestRepository.query(`
        SELECT AVG(EXTRACT(EPOCH FROM (actual_completion_date - actual_start_date))/3600) as avg_hours
        FROM mr_services.maintenance_requests
        ${whereSQL ? whereSQL + ' AND' : 'WHERE'} actual_start_date IS NOT NULL 
        AND actual_completion_date IS NOT NULL
      `, params),
      this.maintenanceRequestRepository.query(`
        SELECT COUNT(*) as count
        FROM mr_services.maintenance_requests
        ${whereSQL ? whereSQL + ' AND' : 'WHERE'} scheduled_completion < NOW() 
        AND status != 'completed'
      `, params),
    ]);

    return {
      totals: {
        totalRequests: parseInt(totalRequests[0].count),
        avgCompletionTime: parseFloat(avgCompletionTime[0].avg_hours || 0),
        overdueCount: parseInt(overdueCount[0].count),
      },
      breakdown: {
        byStatus: requestsByStatus,
        byType: requestsByType,
      },
    };
  }
}