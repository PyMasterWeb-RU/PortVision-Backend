import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { 
  MaintenanceRecord, 
  MaintenanceType, 
  MaintenanceStatus, 
  MaintenancePriority 
} from '../entities/maintenance-record.entity';
import { EquipmentService } from './equipment.service';
import { EquipmentStatus } from '../entities/equipment.entity';

export interface CreateMaintenanceRecordDto {
  equipmentId: string;
  maintenanceType: MaintenanceType;
  priority?: MaintenancePriority;
  maintenanceTitle: string;
  description: string;
  scheduledDate: Date;
  estimatedDurationHours: number;
  assignedBy: string;
  assignedByName: string;
  performedBy?: string;
  performedByName?: string;
  supervisedBy?: string;
  supervisedByName?: string;
  externalContractor?: string;
  contractorContact?: any;
  workChecklist: any[];
  materialsUsed?: any[];
  toolsUsed?: any[];
  testResults?: any;
  issuesFound?: any[];
  recommendations?: any[];
  nextMaintenance?: any;
  costInformation?: any;
  certificationData?: any;
  downtimeTracking?: any;
  complianceInfo?: any;
  metadata?: Record<string, any>;
}

export interface UpdateMaintenanceRecordDto {
  status?: MaintenanceStatus;
  priority?: MaintenancePriority;
  maintenanceTitle?: string;
  description?: string;
  scheduledDate?: Date;
  estimatedDurationHours?: number;
  startedAt?: Date;
  completedDate?: Date;
  actualDurationHours?: number;
  performedBy?: string;
  performedByName?: string;
  supervisedBy?: string;
  supervisedByName?: string;
  externalContractor?: string;
  contractorContact?: any;
  workChecklist?: any[];
  materialsUsed?: any[];
  toolsUsed?: any[];
  testResults?: any;
  issuesFound?: any[];
  recommendations?: any[];
  nextMaintenance?: any;
  costInformation?: any;
  certificationData?: any;
  downtimeTracking?: any;
  complianceInfo?: any;
  metadata?: Record<string, any>;
}

export interface MaintenanceSearchFilters {
  equipmentId?: string;
  maintenanceType?: MaintenanceType;
  status?: MaintenanceStatus;
  priority?: MaintenancePriority;
  performedBy?: string;
  assignedBy?: string;
  supervisedBy?: string;
  scheduledAfter?: Date;
  scheduledBefore?: Date;
  completedAfter?: Date;
  completedBefore?: Date;
  equipmentType?: string;
  isOverdue?: boolean;
  hasIssues?: boolean;
  isExternal?: boolean;
  searchText?: string;
}

@Injectable()
export class MaintenanceRecordService {
  private readonly logger = new Logger(MaintenanceRecordService.name);

  constructor(
    @InjectRepository(MaintenanceRecord)
    private readonly maintenanceRecordRepository: Repository<MaintenanceRecord>,
    private readonly equipmentService: EquipmentService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async createMaintenanceRecord(createMaintenanceRecordDto: CreateMaintenanceRecordDto): Promise<MaintenanceRecord> {
    this.logger.log(`Creating maintenance record for equipment ${createMaintenanceRecordDto.equipmentId}`);

    // Validate equipment exists
    const equipment = await this.equipmentService.getEquipmentById(createMaintenanceRecordDto.equipmentId);

    // Generate work order number
    const workOrderNumber = await this.generateWorkOrderNumber(createMaintenanceRecordDto.maintenanceType);

    const maintenanceRecord = this.maintenanceRecordRepository.create({
      ...createMaintenanceRecordDto,
      workOrderNumber,
      status: MaintenanceStatus.SCHEDULED,
    });

    const savedRecord = await this.maintenanceRecordRepository.save(maintenanceRecord);

    // Update equipment status if maintenance is starting soon or critical
    if (createMaintenanceRecordDto.priority === MaintenancePriority.CRITICAL ||
        createMaintenanceRecordDto.priority === MaintenancePriority.EMERGENCY) {
      await this.equipmentService.updateStatus(equipment.id, EquipmentStatus.MAINTENANCE);
    }

    this.eventEmitter.emit('maintenance_record.created', {
      maintenanceRecordId: savedRecord.id,
      workOrderNumber: savedRecord.workOrderNumber,
      equipmentId: equipment.id,
      equipmentNumber: equipment.equipmentNumber,
      maintenanceType: savedRecord.maintenanceType,
      priority: savedRecord.priority,
      scheduledDate: savedRecord.scheduledDate,
    });

    this.logger.log(`Maintenance record created: ${savedRecord.workOrderNumber}`);
    return savedRecord;
  }

  async getAllMaintenanceRecords(): Promise<MaintenanceRecord[]> {
    return this.maintenanceRecordRepository.find({
      relations: ['equipment'],
      order: { scheduledDate: 'DESC' },
    });
  }

  async getMaintenanceRecordById(id: string): Promise<MaintenanceRecord> {
    const record = await this.maintenanceRecordRepository.findOne({
      where: { id },
      relations: ['equipment'],
    });

    if (!record) {
      throw new NotFoundException(`Maintenance record with ID ${id} not found`);
    }

    return record;
  }

  async getMaintenanceRecordByWorkOrder(workOrderNumber: string): Promise<MaintenanceRecord> {
    const record = await this.maintenanceRecordRepository.findOne({
      where: { workOrderNumber },
      relations: ['equipment'],
    });

    if (!record) {
      throw new NotFoundException(`Maintenance record with work order ${workOrderNumber} not found`);
    }

    return record;
  }

  async updateMaintenanceRecord(id: string, updateMaintenanceRecordDto: UpdateMaintenanceRecordDto): Promise<MaintenanceRecord> {
    const record = await this.getMaintenanceRecordById(id);

    Object.assign(record, updateMaintenanceRecordDto);
    const updatedRecord = await this.maintenanceRecordRepository.save(record);

    this.eventEmitter.emit('maintenance_record.updated', {
      maintenanceRecordId: updatedRecord.id,
      workOrderNumber: updatedRecord.workOrderNumber,
      equipmentId: record.equipmentId,
      changes: updateMaintenanceRecordDto,
    });

    this.logger.log(`Maintenance record updated: ${updatedRecord.workOrderNumber}`);
    return updatedRecord;
  }

  async deleteMaintenanceRecord(id: string): Promise<void> {
    const record = await this.getMaintenanceRecordById(id);

    if (record.status === MaintenanceStatus.IN_PROGRESS) {
      throw new BadRequestException(
        `Cannot delete maintenance record ${record.workOrderNumber} - maintenance is in progress`
      );
    }

    await this.maintenanceRecordRepository.remove(record);

    this.eventEmitter.emit('maintenance_record.deleted', {
      maintenanceRecordId: record.id,
      workOrderNumber: record.workOrderNumber,
      equipmentId: record.equipmentId,
    });

    this.logger.log(`Maintenance record deleted: ${record.workOrderNumber}`);
  }

  async startMaintenance(id: string, performedBy?: string, performedByName?: string): Promise<MaintenanceRecord> {
    const record = await this.getMaintenanceRecordById(id);

    if (record.status !== MaintenanceStatus.SCHEDULED) {
      throw new BadRequestException(
        `Cannot start maintenance ${record.workOrderNumber} - status is ${record.status}`
      );
    }

    const updateData: UpdateMaintenanceRecordDto = {
      status: MaintenanceStatus.IN_PROGRESS,
      startedAt: new Date(),
    };

    if (performedBy) {
      updateData.performedBy = performedBy;
      updateData.performedByName = performedByName;
    }

    const updatedRecord = await this.updateMaintenanceRecord(id, updateData);

    // Update equipment status to maintenance
    await this.equipmentService.updateStatus(record.equipmentId, EquipmentStatus.MAINTENANCE);

    this.eventEmitter.emit('maintenance_record.started', {
      maintenanceRecordId: updatedRecord.id,
      workOrderNumber: updatedRecord.workOrderNumber,
      equipmentId: record.equipmentId,
      performedBy,
      startedAt: updatedRecord.startedAt,
    });

    return updatedRecord;
  }

  async completeMaintenance(
    id: string, 
    completionData: {
      workChecklist?: any[];
      materialsUsed?: any[];
      toolsUsed?: any[];
      testResults?: any;
      issuesFound?: any[];
      recommendations?: any[];
      nextMaintenance?: any;
      costInformation?: any;
      certificationData?: any;
      downtimeTracking?: any;
      complianceInfo?: any;
      supervisedBy?: string;
      supervisedByName?: string;
    }
  ): Promise<MaintenanceRecord> {
    const record = await this.getMaintenanceRecordById(id);

    if (record.status !== MaintenanceStatus.IN_PROGRESS) {
      throw new BadRequestException(
        `Cannot complete maintenance ${record.workOrderNumber} - status is ${record.status}`
      );
    }

    const completedDate = new Date();
    const actualDurationHours = record.startedAt 
      ? (completedDate.getTime() - record.startedAt.getTime()) / (1000 * 60 * 60)
      : null;

    const updatedRecord = await this.updateMaintenanceRecord(id, {
      status: MaintenanceStatus.COMPLETED,
      completedDate,
      actualDurationHours,
      ...completionData,
    });

    // Update equipment status back to available (or as determined by issues found)
    const hasOpenIssues = completionData.issuesFound?.some(issue => !issue.resolved);
    const newEquipmentStatus = hasOpenIssues ? EquipmentStatus.REPAIR : EquipmentStatus.AVAILABLE;
    
    await this.equipmentService.updateStatus(record.equipmentId, newEquipmentStatus);

    // Schedule next maintenance if provided
    if (completionData.nextMaintenance) {
      await this.scheduleNextMaintenance(record.equipmentId, completionData.nextMaintenance);
    }

    this.eventEmitter.emit('maintenance_record.completed', {
      maintenanceRecordId: updatedRecord.id,
      workOrderNumber: updatedRecord.workOrderNumber,
      equipmentId: record.equipmentId,
      completedDate,
      actualDurationHours,
      hasOpenIssues,
    });

    return updatedRecord;
  }

  async cancelMaintenance(id: string, reason: string): Promise<MaintenanceRecord> {
    const record = await this.getMaintenanceRecordById(id);

    if (record.status === MaintenanceStatus.COMPLETED) {
      throw new BadRequestException(
        `Cannot cancel maintenance ${record.workOrderNumber} - already completed`
      );
    }

    const updatedRecord = await this.updateMaintenanceRecord(id, {
      status: MaintenanceStatus.CANCELLED,
      metadata: {
        ...record.metadata,
        cancellationReason: reason,
        cancelledAt: new Date(),
      },
    });

    // Restore equipment status if it was in maintenance
    const equipment = await this.equipmentService.getEquipmentById(record.equipmentId);
    if (equipment.status === EquipmentStatus.MAINTENANCE) {
      await this.equipmentService.updateStatus(record.equipmentId, EquipmentStatus.AVAILABLE);
    }

    this.eventEmitter.emit('maintenance_record.cancelled', {
      maintenanceRecordId: updatedRecord.id,
      workOrderNumber: updatedRecord.workOrderNumber,
      equipmentId: record.equipmentId,
      reason,
    });

    return updatedRecord;
  }

  async rescheduleMaintenance(id: string, newScheduledDate: Date): Promise<MaintenanceRecord> {
    const record = await this.getMaintenanceRecordById(id);

    if (record.status === MaintenanceStatus.IN_PROGRESS || record.status === MaintenanceStatus.COMPLETED) {
      throw new BadRequestException(
        `Cannot reschedule maintenance ${record.workOrderNumber} - status is ${record.status}`
      );
    }

    const updatedRecord = await this.updateMaintenanceRecord(id, {
      status: MaintenanceStatus.RESCHEDULED,
      scheduledDate: newScheduledDate,
      metadata: {
        ...record.metadata,
        previousScheduledDate: record.scheduledDate,
        rescheduledAt: new Date(),
      },
    });

    this.eventEmitter.emit('maintenance_record.rescheduled', {
      maintenanceRecordId: updatedRecord.id,
      workOrderNumber: updatedRecord.workOrderNumber,
      equipmentId: record.equipmentId,
      previousScheduledDate: record.scheduledDate,
      newScheduledDate,
    });

    return updatedRecord;
  }

  async searchMaintenanceRecords(filters: MaintenanceSearchFilters): Promise<MaintenanceRecord[]> {
    const query = this.maintenanceRecordRepository.createQueryBuilder('maintenance')
      .leftJoinAndSelect('maintenance.equipment', 'equipment');

    if (filters.equipmentId) {
      query.andWhere('maintenance.equipmentId = :equipmentId', { equipmentId: filters.equipmentId });
    }

    if (filters.maintenanceType) {
      query.andWhere('maintenance.maintenanceType = :maintenanceType', { 
        maintenanceType: filters.maintenanceType 
      });
    }

    if (filters.status) {
      query.andWhere('maintenance.status = :status', { status: filters.status });
    }

    if (filters.priority) {
      query.andWhere('maintenance.priority = :priority', { priority: filters.priority });
    }

    if (filters.performedBy) {
      query.andWhere('maintenance.performedBy = :performedBy', { performedBy: filters.performedBy });
    }

    if (filters.assignedBy) {
      query.andWhere('maintenance.assignedBy = :assignedBy', { assignedBy: filters.assignedBy });
    }

    if (filters.supervisedBy) {
      query.andWhere('maintenance.supervisedBy = :supervisedBy', { supervisedBy: filters.supervisedBy });
    }

    if (filters.scheduledAfter) {
      query.andWhere('maintenance.scheduledDate >= :scheduledAfter', { 
        scheduledAfter: filters.scheduledAfter 
      });
    }

    if (filters.scheduledBefore) {
      query.andWhere('maintenance.scheduledDate <= :scheduledBefore', { 
        scheduledBefore: filters.scheduledBefore 
      });
    }

    if (filters.completedAfter) {
      query.andWhere('maintenance.completedDate >= :completedAfter', { 
        completedAfter: filters.completedAfter 
      });
    }

    if (filters.completedBefore) {
      query.andWhere('maintenance.completedDate <= :completedBefore', { 
        completedBefore: filters.completedBefore 
      });
    }

    if (filters.equipmentType) {
      query.andWhere('equipment.type = :equipmentType', { equipmentType: filters.equipmentType });
    }

    if (filters.isOverdue) {
      query.andWhere('maintenance.scheduledDate < NOW()')
        .andWhere('maintenance.status IN (:...overdueStatuses)', { 
          overdueStatuses: [MaintenanceStatus.SCHEDULED, MaintenanceStatus.OVERDUE] 
        });
    }

    if (filters.hasIssues) {
      query.andWhere('maintenance.issuesFound IS NOT NULL')
        .andWhere('jsonb_array_length(maintenance.issuesFound) > 0');
    }

    if (filters.isExternal) {
      query.andWhere('maintenance.externalContractor IS NOT NULL');
    }

    if (filters.searchText) {
      query.andWhere(`(
        maintenance.workOrderNumber ILIKE :searchText
        OR maintenance.maintenanceTitle ILIKE :searchText
        OR maintenance.description ILIKE :searchText
        OR maintenance.performedByName ILIKE :searchText
        OR maintenance.externalContractor ILIKE :searchText
        OR equipment.equipmentNumber ILIKE :searchText
        OR equipment.equipmentName ILIKE :searchText
      )`, { searchText: `%${filters.searchText}%` });
    }

    query.orderBy('maintenance.scheduledDate', 'DESC');

    return query.getMany();
  }

  async getMaintenanceByEquipment(equipmentId: string): Promise<MaintenanceRecord[]> {
    return this.searchMaintenanceRecords({ equipmentId });
  }

  async getMaintenanceByPerformer(performedBy: string): Promise<MaintenanceRecord[]> {
    return this.searchMaintenanceRecords({ performedBy });
  }

  async getOverdueMaintenance(): Promise<MaintenanceRecord[]> {
    return this.searchMaintenanceRecords({ isOverdue: true });
  }

  async getScheduledMaintenance(period: number = 30): Promise<MaintenanceRecord[]> {
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + period);

    return this.searchMaintenanceRecords({
      status: MaintenanceStatus.SCHEDULED,
      scheduledBefore: endDate,
    });
  }

  private async scheduleNextMaintenance(equipmentId: string, nextMaintenanceData: any): Promise<void> {
    if (!nextMaintenanceData.scheduledDate || !nextMaintenanceData.maintenanceType) {
      return;
    }

    await this.createMaintenanceRecord({
      equipmentId,
      maintenanceType: nextMaintenanceData.maintenanceType,
      priority: MaintenancePriority.NORMAL,
      maintenanceTitle: `Scheduled ${nextMaintenanceData.maintenanceType} maintenance`,
      description: nextMaintenanceData.notes || `Automatic scheduling based on previous maintenance`,
      scheduledDate: new Date(nextMaintenanceData.scheduledDate),
      estimatedDurationHours: nextMaintenanceData.estimatedHours || 2,
      assignedBy: 'system',
      assignedByName: 'System Auto-Schedule',
      workChecklist: nextMaintenanceData.requiredParts?.map(part => ({
        taskId: `check-${part}`,
        task: `Check ${part}`,
        category: 'inspection',
        required: true,
        completed: false,
      })) || [],
      metadata: {
        autoScheduled: true,
        scheduledFrom: nextMaintenanceData.parentWorkOrder || 'previous_maintenance',
      },
    });
  }

  private async generateWorkOrderNumber(type: MaintenanceType): Promise<string> {
    const typePrefix = {
      [MaintenanceType.ROUTINE]: 'RT',
      [MaintenanceType.PREVENTIVE]: 'PR',
      [MaintenanceType.CORRECTIVE]: 'CR',
      [MaintenanceType.EMERGENCY]: 'EM',
      [MaintenanceType.INSPECTION]: 'IN',
      [MaintenanceType.CALIBRATION]: 'CA',
      [MaintenanceType.OVERHAUL]: 'OH',
      [MaintenanceType.REPAIR]: 'RP',
      [MaintenanceType.SOFTWARE_UPDATE]: 'SU',
      [MaintenanceType.SAFETY_CHECK]: 'SF',
    };

    const prefix = typePrefix[type] || 'WO';
    const year = new Date().getFullYear();
    
    // Find the next sequence number for this type and year
    const lastRecord = await this.maintenanceRecordRepository
      .createQueryBuilder('maintenance')
      .where('maintenance.workOrderNumber LIKE :pattern', { 
        pattern: `${prefix}-${year}-%` 
      })
      .orderBy('maintenance.workOrderNumber', 'DESC')
      .getOne();

    let sequence = 1;
    if (lastRecord) {
      const lastNumber = lastRecord.workOrderNumber.split('-')[2];
      sequence = parseInt(lastNumber) + 1;
    }

    return `${prefix}-${year}-${sequence.toString().padStart(4, '0')}`;
  }

  async getMaintenanceStatistics(filters?: {
    period?: number;
    equipmentType?: string;
    performedBy?: string;
    departmentId?: string;
  }) {
    const whereClause = [];
    const params = [];

    if (filters?.period) {
      whereClause.push('scheduled_date >= NOW() - INTERVAL \\'' + filters.period + ' days\\'');
    }

    if (filters?.equipmentType) {
      whereClause.push('equipment.type = $' + (params.length + 1));
      params.push(filters.equipmentType);
    }

    if (filters?.performedBy) {
      whereClause.push('performed_by = $' + (params.length + 1));
      params.push(filters.performedBy);
    }

    if (filters?.departmentId) {
      whereClause.push('equipment.department_id = $' + (params.length + 1));
      params.push(filters.departmentId);
    }

    const whereSQL = whereClause.length > 0 ? 'WHERE ' + whereClause.join(' AND ') : '';
    const joinSQL = filters?.equipmentType || filters?.departmentId 
      ? 'JOIN equipment.equipment ON maintenance.equipment_id = equipment.id'
      : '';

    const [
      totalMaintenance,
      maintenanceByStatus,
      maintenanceByType,
      avgDuration,
      overdueCount,
      costSummary,
    ] = await Promise.all([
      this.maintenanceRecordRepository.query(`
        SELECT COUNT(*) as count
        FROM equipment.maintenance_records maintenance
        ${joinSQL}
        ${whereSQL}
      `, params),
      this.maintenanceRecordRepository.query(`
        SELECT status, COUNT(*) as count
        FROM equipment.maintenance_records maintenance
        ${joinSQL}
        ${whereSQL}
        GROUP BY status
        ORDER BY count DESC
      `, params),
      this.maintenanceRecordRepository.query(`
        SELECT maintenance_type, COUNT(*) as count
        FROM equipment.maintenance_records maintenance
        ${joinSQL}
        ${whereSQL}
        GROUP BY maintenance_type
        ORDER BY count DESC
      `, params),
      this.maintenanceRecordRepository.query(`
        SELECT AVG(actual_duration_hours) as avg_hours
        FROM equipment.maintenance_records maintenance
        ${joinSQL}
        ${whereSQL ? whereSQL + ' AND' : 'WHERE'} actual_duration_hours IS NOT NULL
      `, params),
      this.maintenanceRecordRepository.query(`
        SELECT COUNT(*) as count
        FROM equipment.maintenance_records maintenance
        ${joinSQL}
        ${whereSQL ? whereSQL + ' AND' : 'WHERE'} scheduled_date < NOW() AND status IN ('scheduled', 'overdue')
      `, params),
      this.maintenanceRecordRepository.query(`
        SELECT 
          AVG((cost_information->>'totalCost')::numeric) as avg_cost,
          SUM((cost_information->>'totalCost')::numeric) as total_cost
        FROM equipment.maintenance_records maintenance
        ${joinSQL}
        ${whereSQL ? whereSQL + ' AND' : 'WHERE'} cost_information IS NOT NULL AND cost_information->>'totalCost' IS NOT NULL
      `, params),
    ]);

    return {
      totals: {
        totalMaintenance: parseInt(totalMaintenance[0].count),
        avgDurationHours: parseFloat(avgDuration[0].avg_hours || 0),
        overdueCount: parseInt(overdueCount[0].count),
        avgCost: parseFloat(costSummary[0].avg_cost || 0),
        totalCost: parseFloat(costSummary[0].total_cost || 0),
      },
      breakdown: {
        byStatus: maintenanceByStatus,
        byType: maintenanceByType,
      },
    };
  }
}