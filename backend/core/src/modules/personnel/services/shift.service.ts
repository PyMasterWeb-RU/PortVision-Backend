import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { 
  Shift, 
  ShiftType, 
  ShiftStatus 
} from '../entities/shift.entity';
import { OperatorService } from './operator.service';
import { OperatorStatus } from '../entities/operator.entity';

export interface CreateShiftDto {
  operatorId: string;
  shiftType?: ShiftType;
  shiftName: string;
  description?: string;
  startTime: Date;
  endTime: Date;
  plannedDurationHours: number;
  departmentId: string;
  departmentName: string;
  supervisorId?: string;
  supervisorName?: string;
  workZone?: string;
  workLocation?: string;
  assignedEquipment?: any[];
  shiftTasks: any[];
  breaks?: any[];
  shiftReport?: any;
  performanceData?: any;
  timeTracking?: any[];
  overtimeDetails?: any;
  workingConditions?: any;
  qualityControl?: any;
  safetyData?: any;
  notes?: string;
  metadata?: Record<string, any>;
}

export interface UpdateShiftDto {
  shiftType?: ShiftType;
  status?: ShiftStatus;
  shiftName?: string;
  description?: string;
  startTime?: Date;
  endTime?: Date;
  actualStartTime?: Date;
  actualEndTime?: Date;
  plannedDurationHours?: number;
  actualDurationHours?: number;
  supervisorId?: string;
  supervisorName?: string;
  workZone?: string;
  workLocation?: string;
  assignedEquipment?: any[];
  shiftTasks?: any[];
  breaks?: any[];
  shiftReport?: any;
  performanceData?: any;
  timeTracking?: any[];
  overtimeDetails?: any;
  workingConditions?: any;
  qualityControl?: any;
  safetyData?: any;
  cancellationReason?: string;
  notes?: string;
  metadata?: Record<string, any>;
}

export interface ShiftSearchFilters {
  operatorId?: string;
  shiftType?: ShiftType;
  status?: ShiftStatus;
  departmentId?: string;
  supervisorId?: string;
  workZone?: string;
  startTimeAfter?: Date;
  startTimeBefore?: Date;
  endTimeAfter?: Date;
  endTimeBefore?: Date;
  isOvertime?: boolean;
  hasIssues?: boolean;
  completionRate?: { min: number; max: number };
  performanceRating?: { min: number; max: number };
  searchText?: string;
}

@Injectable()
export class ShiftService {
  private readonly logger = new Logger(ShiftService.name);

  constructor(
    @InjectRepository(Shift)
    private readonly shiftRepository: Repository<Shift>,
    private readonly operatorService: OperatorService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async createShift(createShiftDto: CreateShiftDto): Promise<Shift> {
    this.logger.log(`Creating shift for operator ${createShiftDto.operatorId}`);

    // Validate operator exists and is active
    const operator = await this.operatorService.getOperatorById(createShiftDto.operatorId);
    
    if (operator.status !== OperatorStatus.ACTIVE) {
      throw new BadRequestException(`Cannot create shift for operator ${operator.operatorNumber} - status is ${operator.status}`);
    }

    // Check for overlapping shifts
    const overlappingShift = await this.checkForOverlappingShifts(
      createShiftDto.operatorId,
      createShiftDto.startTime,
      createShiftDto.endTime
    );

    if (overlappingShift) {
      throw new BadRequestException(
        `Operator ${operator.operatorNumber} already has a shift scheduled during this time period`
      );
    }

    // Generate shift number
    const shiftNumber = await this.generateShiftNumber(createShiftDto.shiftType || ShiftType.REGULAR);

    const shift = this.shiftRepository.create({
      ...createShiftDto,
      shiftNumber,
      status: ShiftStatus.SCHEDULED,
    });

    const savedShift = await this.shiftRepository.save(shift);

    this.eventEmitter.emit('shift.created', {
      shiftId: savedShift.id,
      shiftNumber: savedShift.shiftNumber,
      operatorId: operator.id,
      operatorNumber: operator.operatorNumber,
      startTime: savedShift.startTime,
      endTime: savedShift.endTime,
      departmentId: savedShift.departmentId,
    });

    this.logger.log(`Shift created: ${savedShift.shiftNumber}`);
    return savedShift;
  }

  async getAllShifts(): Promise<Shift[]> {
    return this.shiftRepository.find({
      relations: ['operator'],
      order: { startTime: 'DESC' },
    });
  }

  async getShiftById(id: string): Promise<Shift> {
    const shift = await this.shiftRepository.findOne({
      where: { id },
      relations: ['operator'],
    });

    if (!shift) {
      throw new NotFoundException(`Shift with ID ${id} not found`);
    }

    return shift;
  }

  async getShiftByNumber(shiftNumber: string): Promise<Shift> {
    const shift = await this.shiftRepository.findOne({
      where: { shiftNumber },
      relations: ['operator'],
    });

    if (!shift) {
      throw new NotFoundException(`Shift with number ${shiftNumber} not found`);
    }

    return shift;
  }

  async updateShift(id: string, updateShiftDto: UpdateShiftDto): Promise<Shift> {
    const shift = await this.getShiftById(id);

    // Calculate actual duration if both start and end times are provided
    if (updateShiftDto.actualStartTime && updateShiftDto.actualEndTime) {
      const duration = (updateShiftDto.actualEndTime.getTime() - updateShiftDto.actualStartTime.getTime()) / (1000 * 60 * 60);
      updateShiftDto.actualDurationHours = Math.round(duration * 100) / 100;
    }

    Object.assign(shift, updateShiftDto);
    const updatedShift = await this.shiftRepository.save(shift);

    this.eventEmitter.emit('shift.updated', {
      shiftId: updatedShift.id,
      shiftNumber: updatedShift.shiftNumber,
      operatorId: shift.operatorId,
      changes: updateShiftDto,
    });

    this.logger.log(`Shift updated: ${updatedShift.shiftNumber}`);
    return updatedShift;
  }

  async deleteShift(id: string): Promise<void> {
    const shift = await this.getShiftById(id);

    if (shift.status === ShiftStatus.STARTED || shift.status === ShiftStatus.ON_BREAK) {
      throw new BadRequestException(
        `Cannot delete shift ${shift.shiftNumber} - shift is currently active`
      );
    }

    await this.shiftRepository.remove(shift);

    this.eventEmitter.emit('shift.deleted', {
      shiftId: shift.id,
      shiftNumber: shift.shiftNumber,
      operatorId: shift.operatorId,
    });

    this.logger.log(`Shift deleted: ${shift.shiftNumber}`);
  }

  async startShift(id: string): Promise<Shift> {
    const shift = await this.getShiftById(id);

    if (shift.status !== ShiftStatus.SCHEDULED) {
      throw new BadRequestException(
        `Cannot start shift ${shift.shiftNumber} - status is ${shift.status}`
      );
    }

    const actualStartTime = new Date();
    const updatedShift = await this.updateShift(id, {
      status: ShiftStatus.STARTED,
      actualStartTime,
    });

    // Update operator current status
    await this.operatorService.updateOperator(shift.operatorId, {
      currentStatus: {
        ...shift.operator?.currentStatus,
        currentShift: {
          shiftId: shift.id,
          startTime: actualStartTime,
          endTime: shift.endTime,
          status: 'started',
        },
        availability: {
          isAvailable: false,
          reason: 'on_shift',
        },
      },
    });

    this.eventEmitter.emit('shift.started', {
      shiftId: updatedShift.id,
      shiftNumber: updatedShift.shiftNumber,
      operatorId: shift.operatorId,
      actualStartTime,
    });

    return updatedShift;
  }

  async endShift(id: string, shiftReport?: any): Promise<Shift> {
    const shift = await this.getShiftById(id);

    if (shift.status !== ShiftStatus.STARTED && shift.status !== ShiftStatus.ON_BREAK) {
      throw new BadRequestException(
        `Cannot end shift ${shift.shiftNumber} - status is ${shift.status}`
      );
    }

    const actualEndTime = new Date();
    const actualDurationHours = shift.actualStartTime 
      ? (actualEndTime.getTime() - shift.actualStartTime.getTime()) / (1000 * 60 * 60)
      : null;

    const updateData: UpdateShiftDto = {
      status: ShiftStatus.COMPLETED,
      actualEndTime,
      actualDurationHours: actualDurationHours ? Math.round(actualDurationHours * 100) / 100 : undefined,
    };

    if (shiftReport) {
      updateData.shiftReport = shiftReport;
    }

    const updatedShift = await this.updateShift(id, updateData);

    // Update operator current status
    await this.operatorService.updateOperator(shift.operatorId, {
      currentStatus: {
        ...shift.operator?.currentStatus,
        currentShift: null,
        availability: {
          isAvailable: true,
          reason: 'shift_completed',
        },
      },
    });

    this.eventEmitter.emit('shift.completed', {
      shiftId: updatedShift.id,
      shiftNumber: updatedShift.shiftNumber,
      operatorId: shift.operatorId,
      actualEndTime,
      actualDurationHours,
    });

    return updatedShift;
  }

  async cancelShift(id: string, reason: string): Promise<Shift> {
    const shift = await this.getShiftById(id);

    if (shift.status === ShiftStatus.COMPLETED) {
      throw new BadRequestException(
        `Cannot cancel shift ${shift.shiftNumber} - already completed`
      );
    }

    const updatedShift = await this.updateShift(id, {
      status: ShiftStatus.CANCELLED,
      cancellationReason: reason,
    });

    // Update operator availability if shift was active
    if (shift.status === ShiftStatus.STARTED || shift.status === ShiftStatus.ON_BREAK) {
      await this.operatorService.updateOperator(shift.operatorId, {
        currentStatus: {
          ...shift.operator?.currentStatus,
          currentShift: null,
          availability: {
            isAvailable: true,
            reason: 'shift_cancelled',
          },
        },
      });
    }

    this.eventEmitter.emit('shift.cancelled', {
      shiftId: updatedShift.id,
      shiftNumber: updatedShift.shiftNumber,
      operatorId: shift.operatorId,
      reason,
    });

    return updatedShift;
  }

  async startBreak(id: string, breakType: 'lunch' | 'coffee' | 'rest' | 'emergency', location?: string): Promise<Shift> {
    const shift = await this.getShiftById(id);

    if (shift.status !== ShiftStatus.STARTED) {
      throw new BadRequestException(
        `Cannot start break for shift ${shift.shiftNumber} - shift is not active`
      );
    }

    const breakStart = new Date();
    const breaks = shift.breaks || [];
    breaks.push({
      breakType,
      startTime: breakStart,
      location,
      authorized: true,
    });

    const updatedShift = await this.updateShift(id, {
      status: ShiftStatus.ON_BREAK,
      breaks,
    });

    this.eventEmitter.emit('shift.break_started', {
      shiftId: updatedShift.id,
      shiftNumber: updatedShift.shiftNumber,
      operatorId: shift.operatorId,
      breakType,
      startTime: breakStart,
    });

    return updatedShift;
  }

  async endBreak(id: string): Promise<Shift> {
    const shift = await this.getShiftById(id);

    if (shift.status !== ShiftStatus.ON_BREAK) {
      throw new BadRequestException(
        `Cannot end break for shift ${shift.shiftNumber} - not currently on break`
      );
    }

    const breaks = [...(shift.breaks || [])];
    const currentBreak = breaks[breaks.length - 1];
    
    if (currentBreak && !currentBreak.endTime) {
      const breakEnd = new Date();
      currentBreak.endTime = breakEnd;
      currentBreak.duration = Math.round((breakEnd.getTime() - currentBreak.startTime.getTime()) / (1000 * 60));
    }

    const updatedShift = await this.updateShift(id, {
      status: ShiftStatus.STARTED,
      breaks,
    });

    this.eventEmitter.emit('shift.break_ended', {
      shiftId: updatedShift.id,
      shiftNumber: updatedShift.shiftNumber,
      operatorId: shift.operatorId,
      breakDuration: currentBreak?.duration,
    });

    return updatedShift;
  }

  async addTask(id: string, task: {
    taskType: string;
    description: string;
    priority: 'low' | 'normal' | 'high' | 'urgent';
    estimatedDuration: number;
  }): Promise<Shift> {
    const shift = await this.getShiftById(id);

    const newTask = {
      taskId: `task-${Date.now()}`,
      ...task,
      assignedAt: new Date(),
      status: 'pending' as const,
    };

    const shiftTasks = [...(shift.shiftTasks || []), newTask];

    const updatedShift = await this.updateShift(id, { shiftTasks });

    this.eventEmitter.emit('shift.task_added', {
      shiftId: updatedShift.id,
      shiftNumber: updatedShift.shiftNumber,
      operatorId: shift.operatorId,
      task: newTask,
    });

    return updatedShift;
  }

  async updateTaskStatus(
    id: string, 
    taskId: string, 
    status: 'pending' | 'in_progress' | 'completed' | 'cancelled',
    notes?: string
  ): Promise<Shift> {
    const shift = await this.getShiftById(id);

    const shiftTasks = [...(shift.shiftTasks || [])];
    const taskIndex = shiftTasks.findIndex(task => task.taskId === taskId);

    if (taskIndex === -1) {
      throw new NotFoundException(`Task ${taskId} not found in shift ${shift.shiftNumber}`);
    }

    const task = shiftTasks[taskIndex];
    const now = new Date();

    task.status = status;
    if (notes) task.notes = notes;

    switch (status) {
      case 'in_progress':
        task.startedAt = now;
        break;
      case 'completed':
        task.completedAt = now;
        break;
    }

    const updatedShift = await this.updateShift(id, { shiftTasks });

    this.eventEmitter.emit('shift.task_updated', {
      shiftId: updatedShift.id,
      shiftNumber: updatedShift.shiftNumber,
      operatorId: shift.operatorId,
      taskId,
      status,
    });

    return updatedShift;
  }

  async searchShifts(filters: ShiftSearchFilters): Promise<Shift[]> {
    const query = this.shiftRepository.createQueryBuilder('shift')
      .leftJoinAndSelect('shift.operator', 'operator');

    if (filters.operatorId) {
      query.andWhere('shift.operatorId = :operatorId', { operatorId: filters.operatorId });
    }

    if (filters.shiftType) {
      query.andWhere('shift.shiftType = :shiftType', { shiftType: filters.shiftType });
    }

    if (filters.status) {
      query.andWhere('shift.status = :status', { status: filters.status });
    }

    if (filters.departmentId) {
      query.andWhere('shift.departmentId = :departmentId', { departmentId: filters.departmentId });
    }

    if (filters.supervisorId) {
      query.andWhere('shift.supervisorId = :supervisorId', { supervisorId: filters.supervisorId });
    }

    if (filters.workZone) {
      query.andWhere('shift.workZone = :workZone', { workZone: filters.workZone });
    }

    if (filters.startTimeAfter) {
      query.andWhere('shift.startTime >= :startTimeAfter', { startTimeAfter: filters.startTimeAfter });
    }

    if (filters.startTimeBefore) {
      query.andWhere('shift.startTime <= :startTimeBefore', { startTimeBefore: filters.startTimeBefore });
    }

    if (filters.endTimeAfter) {
      query.andWhere('shift.endTime >= :endTimeAfter', { endTimeAfter: filters.endTimeAfter });
    }

    if (filters.endTimeBefore) {
      query.andWhere('shift.endTime <= :endTimeBefore', { endTimeBefore: filters.endTimeBefore });
    }

    if (filters.isOvertime) {
      query.andWhere('shift.overtimeDetails->>\'isOvertime\' = \'true\'');
    }

    if (filters.hasIssues) {
      query.andWhere('shift.shiftReport->>\'issues\' IS NOT NULL')
        .andWhere('jsonb_array_length(shift.shiftReport->\'issues\') > 0');
    }

    if (filters.completionRate) {
      // This would require a complex calculation - simplified here
      query.andWhere(
        'shift.status = :completedStatus',
        { completedStatus: ShiftStatus.COMPLETED }
      );
    }

    if (filters.performanceRating) {
      query.andWhere(
        '(shift.performanceData->>\'productivity\'->>\'qualityScore\')::numeric BETWEEN :minRating AND :maxRating',
        { 
          minRating: filters.performanceRating.min,
          maxRating: filters.performanceRating.max 
        }
      );
    }

    if (filters.searchText) {
      query.andWhere(`(
        shift.shiftNumber ILIKE :searchText
        OR shift.shiftName ILIKE :searchText
        OR shift.description ILIKE :searchText
        OR operator.fullName ILIKE :searchText
        OR operator.operatorNumber ILIKE :searchText
        OR shift.departmentName ILIKE :searchText
        OR shift.workZone ILIKE :searchText
      )`, { searchText: `%${filters.searchText}%` });
    }

    query.orderBy('shift.startTime', 'DESC');

    return query.getMany();
  }

  async getShiftsByOperator(operatorId: string): Promise<Shift[]> {
    return this.searchShifts({ operatorId });
  }

  async getShiftsByDepartment(departmentId: string): Promise<Shift[]> {
    return this.searchShifts({ departmentId });
  }

  async getActiveShifts(): Promise<Shift[]> {
    return this.searchShifts({ status: ShiftStatus.STARTED });
  }

  async getScheduledShifts(period: number = 7): Promise<Shift[]> {
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + period);

    return this.searchShifts({
      status: ShiftStatus.SCHEDULED,
      startTimeBefore: endDate,
    });
  }

  private async checkForOverlappingShifts(
    operatorId: string,
    startTime: Date,
    endTime: Date,
    excludeShiftId?: string
  ): Promise<Shift | null> {
    const query = this.shiftRepository.createQueryBuilder('shift')
      .where('shift.operatorId = :operatorId', { operatorId })
      .andWhere('shift.status IN (:...activeStatuses)', { 
        activeStatuses: [ShiftStatus.SCHEDULED, ShiftStatus.STARTED, ShiftStatus.ON_BREAK] 
      })
      .andWhere(`(
        (shift.startTime <= :startTime AND shift.endTime > :startTime) OR
        (shift.startTime < :endTime AND shift.endTime >= :endTime) OR
        (shift.startTime >= :startTime AND shift.endTime <= :endTime)
      )`, { startTime, endTime });

    if (excludeShiftId) {
      query.andWhere('shift.id != :excludeShiftId', { excludeShiftId });
    }

    return query.getOne();
  }

  private async generateShiftNumber(shiftType: ShiftType): Promise<string> {
    const typePrefix = {
      [ShiftType.REGULAR]: 'REG',
      [ShiftType.OVERTIME]: 'OVT',
      [ShiftType.EMERGENCY]: 'EMG',
      [ShiftType.TRAINING]: 'TRN',
      [ShiftType.MAINTENANCE]: 'MNT',
    };

    const prefix = typePrefix[shiftType] || 'SH';
    const year = new Date().getFullYear();
    const month = (new Date().getMonth() + 1).toString().padStart(2, '0');
    
    // Find the next sequence number for this type, year, and month
    const lastShift = await this.shiftRepository
      .createQueryBuilder('shift')
      .where('shift.shiftNumber LIKE :pattern', { 
        pattern: `${prefix}-${year}-${month}-%` 
      })
      .orderBy('shift.shiftNumber', 'DESC')
      .getOne();

    let sequence = 1;
    if (lastShift) {
      const lastNumber = lastShift.shiftNumber.split('-')[3];
      sequence = parseInt(lastNumber) + 1;
    }

    return `${prefix}-${year}-${month}-${sequence.toString().padStart(3, '0')}`;
  }

  async getShiftStatistics(filters?: {
    period?: number;
    departmentId?: string;
    operatorId?: string;
    shiftType?: ShiftType;
  }) {
    const whereClause = [];
    const params = [];

    if (filters?.period) {
      whereClause.push('start_time >= NOW() - INTERVAL \\'' + filters.period + ' days\\'');
    }

    if (filters?.departmentId) {
      whereClause.push('department_id = $' + (params.length + 1));
      params.push(filters.departmentId);
    }

    if (filters?.operatorId) {
      whereClause.push('operator_id = $' + (params.length + 1));
      params.push(filters.operatorId);
    }

    if (filters?.shiftType) {
      whereClause.push('shift_type = $' + (params.length + 1));
      params.push(filters.shiftType);
    }

    const whereSQL = whereClause.length > 0 ? 'WHERE ' + whereClause.join(' AND ') : '';

    const [
      totalShifts,
      shiftsByStatus,
      shiftsByType,
      avgDuration,
      completionRate,
      overtimeHours,
    ] = await Promise.all([
      this.shiftRepository.query(`
        SELECT COUNT(*) as count
        FROM personnel.shifts
        ${whereSQL}
      `, params),
      this.shiftRepository.query(`
        SELECT status, COUNT(*) as count
        FROM personnel.shifts
        ${whereSQL}
        GROUP BY status
        ORDER BY count DESC
      `, params),
      this.shiftRepository.query(`
        SELECT shift_type, COUNT(*) as count
        FROM personnel.shifts
        ${whereSQL}
        GROUP BY shift_type
        ORDER BY count DESC
      `, params),
      this.shiftRepository.query(`
        SELECT AVG(actual_duration_hours) as avg_hours
        FROM personnel.shifts
        ${whereSQL ? whereSQL + ' AND' : 'WHERE'} actual_duration_hours IS NOT NULL
      `, params),
      this.shiftRepository.query(`
        SELECT 
          COUNT(CASE WHEN status = 'completed' THEN 1 END) * 100.0 / 
          COUNT(*) as completion_rate
        FROM personnel.shifts
        ${whereSQL}
      `, params),
      this.shiftRepository.query(`
        SELECT 
          SUM((overtime_details->>'overtimeHours')::numeric) as total_overtime
        FROM personnel.shifts
        ${whereSQL ? whereSQL + ' AND' : 'WHERE'} overtime_details IS NOT NULL
      `, params),
    ]);

    return {
      totals: {
        totalShifts: parseInt(totalShifts[0].count),
        avgDurationHours: parseFloat(avgDuration[0].avg_hours || 0),
        completionRate: parseFloat(completionRate[0].completion_rate || 0),
        totalOvertimeHours: parseFloat(overtimeHours[0].total_overtime || 0),
      },
      breakdown: {
        byStatus: shiftsByStatus,
        byType: shiftsByType,
      },
    };
  }
}