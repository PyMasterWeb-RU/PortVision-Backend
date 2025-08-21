import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { MovementLog, MovementType, MovementStatus, MovementPriority } from '../entities/movement-log.entity';

export interface CreateMovementLogDto {
  containerId: string;
  placementId?: string;
  type: MovementType;
  fromLocation: {
    type: 'yard' | 'gate' | 'vessel' | 'rail' | 'truck' | 'external';
    yardId?: string;
    zoneId?: string;
    slotId?: string;
    slotAddress?: string;
    coordinates?: {
      latitude: number;
      longitude: number;
      accuracy?: number;
    };
    description?: string;
  };
  toLocation: {
    type: 'yard' | 'gate' | 'vessel' | 'rail' | 'truck' | 'external';
    yardId?: string;
    zoneId?: string;
    slotId?: string;
    slotAddress?: string;
    coordinates?: {
      latitude: number;
      longitude: number;
      accuracy?: number;
    };
    description?: string;
  };
  operatorId: string;
  operatorName: string;
  equipmentId?: string;
  equipmentType?: string;
  equipmentNumber?: string;
  reason: string;
  description?: string;
  priority?: MovementPriority;
  relatedOrderId?: string;
  gateTransactionId?: string;
}

export interface UpdateMovementLogDto {
  status?: MovementStatus;
  startTime?: Date;
  endTime?: Date;
  durationSeconds?: number;
  route?: any;
  gpsTracking?: any;
  conditions?: any;
  results?: any;
  incidents?: any[];
  measurements?: any;
  performanceMetrics?: any;
  documentation?: any;
}

export interface MovementSearchFilters {
  containerId?: string;
  type?: MovementType;
  status?: MovementStatus;
  priority?: MovementPriority;
  operatorId?: string;
  equipmentId?: string;
  equipmentType?: string;
  fromYardId?: string;
  toYardId?: string;
  timestampAfter?: Date;
  timestampBefore?: Date;
  relatedOrderId?: string;
  gateTransactionId?: string;
}

@Injectable()
export class MovementLogService {
  private readonly logger = new Logger(MovementLogService.name);

  constructor(
    @InjectRepository(MovementLog)
    private readonly movementLogRepository: Repository<MovementLog>,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async createMovementLog(createMovementLogDto: CreateMovementLogDto): Promise<MovementLog> {
    this.logger.log(`Creating movement log for container ${createMovementLogDto.containerId}`);

    const movementLog = this.movementLogRepository.create({
      ...createMovementLogDto,
      timestamp: new Date(),
      status: MovementStatus.PLANNED,
      priority: createMovementLogDto.priority || MovementPriority.NORMAL,
    });

    const savedMovementLog = await this.movementLogRepository.save(movementLog);

    this.eventEmitter.emit('movement.logged', {
      movementId: savedMovementLog.id,
      containerId: savedMovementLog.containerId,
      type: savedMovementLog.type,
      fromLocation: savedMovementLog.fromLocation,
      toLocation: savedMovementLog.toLocation,
      operatorId: savedMovementLog.operatorId,
      timestamp: savedMovementLog.timestamp,
    });

    this.logger.log(`Movement log created: ${savedMovementLog.id}`);
    return savedMovementLog;
  }

  async getAllMovementLogs(): Promise<MovementLog[]> {
    return this.movementLogRepository.find({
      relations: ['container', 'placement'],
      order: { timestamp: 'DESC' },
    });
  }

  async getMovementLogById(id: string): Promise<MovementLog> {
    const movementLog = await this.movementLogRepository.findOne({
      where: { id },
      relations: ['container', 'placement'],
    });

    if (!movementLog) {
      throw new NotFoundException(`Movement log with ID ${id} not found`);
    }

    return movementLog;
  }

  async updateMovementLog(id: string, updateMovementLogDto: UpdateMovementLogDto): Promise<MovementLog> {
    const movementLog = await this.getMovementLogById(id);

    // Auto-calculate duration if start and end times are provided
    if (updateMovementLogDto.startTime && updateMovementLogDto.endTime) {
      updateMovementLogDto.durationSeconds = Math.floor(
        (updateMovementLogDto.endTime.getTime() - updateMovementLogDto.startTime.getTime()) / 1000
      );
    }

    Object.assign(movementLog, updateMovementLogDto);
    const updatedMovementLog = await this.movementLogRepository.save(movementLog);

    this.eventEmitter.emit('movement.updated', {
      movementId: updatedMovementLog.id,
      containerId: movementLog.containerId,
      status: updatedMovementLog.status,
      changes: updateMovementLogDto,
    });

    this.logger.log(`Movement log updated: ${updatedMovementLog.id}`);
    return updatedMovementLog;
  }

  async startMovement(id: string, additionalData?: any): Promise<MovementLog> {
    const updateData: UpdateMovementLogDto = {
      status: MovementStatus.IN_PROGRESS,
      startTime: new Date(),
      ...additionalData,
    };

    const movementLog = await this.updateMovementLog(id, updateData);

    this.eventEmitter.emit('movement.started', {
      movementId: id,
      containerId: movementLog.containerId,
      startTime: updateData.startTime,
    });

    return movementLog;
  }

  async completeMovement(id: string, completionData: any): Promise<MovementLog> {
    const movementLog = await this.getMovementLogById(id);

    const updateData: UpdateMovementLogDto = {
      status: MovementStatus.COMPLETED,
      endTime: new Date(),
      results: {
        success: true,
        accuracy: completionData.accuracy || 'precise',
        verificationMethod: completionData.verificationMethod || 'visual',
        finalPosition: completionData.finalPosition,
        positionDeviation: completionData.positionDeviation,
        qualityMetrics: {
          timeCompliance: true,
          routeCompliance: true,
          safetyCompliance: true,
          procedureCompliance: true,
          ...completionData.qualityMetrics,
        },
      },
      ...completionData,
    };

    // Calculate duration
    if (movementLog.startTime) {
      updateData.durationSeconds = Math.floor(
        (updateData.endTime.getTime() - movementLog.startTime.getTime()) / 1000
      );
    }

    const updatedMovementLog = await this.updateMovementLog(id, updateData);

    this.eventEmitter.emit('movement.completed', {
      movementId: id,
      containerId: movementLog.containerId,
      endTime: updateData.endTime,
      duration: updateData.durationSeconds,
      success: true,
    });

    return updatedMovementLog;
  }

  async failMovement(id: string, failureReason: string, incidentData?: any): Promise<MovementLog> {
    const movementLog = await this.getMovementLogById(id);

    const updateData: UpdateMovementLogDto = {
      status: MovementStatus.FAILED,
      endTime: new Date(),
      results: {
        success: false,
        failureReason,
        ...incidentData,
      },
    };

    // Calculate duration
    if (movementLog.startTime) {
      updateData.durationSeconds = Math.floor(
        (updateData.endTime.getTime() - movementLog.startTime.getTime()) / 1000
      );
    }

    const updatedMovementLog = await this.updateMovementLog(id, updateData);

    this.eventEmitter.emit('movement.failed', {
      movementId: id,
      containerId: movementLog.containerId,
      endTime: updateData.endTime,
      failureReason,
      incident: incidentData,
    });

    return updatedMovementLog;
  }

  async cancelMovement(id: string, cancellationReason: string): Promise<MovementLog> {
    const updateData: UpdateMovementLogDto = {
      status: MovementStatus.CANCELLED,
      endTime: new Date(),
      results: {
        success: false,
        cancellationReason,
      },
    };

    const updatedMovementLog = await this.updateMovementLog(id, updateData);

    this.eventEmitter.emit('movement.cancelled', {
      movementId: id,
      containerId: updatedMovementLog.containerId,
      cancellationReason,
    });

    return updatedMovementLog;
  }

  async searchMovementLogs(filters: MovementSearchFilters): Promise<MovementLog[]> {
    const query = this.movementLogRepository.createQueryBuilder('movement')
      .leftJoinAndSelect('movement.container', 'container')
      .leftJoinAndSelect('movement.placement', 'placement');

    if (filters.containerId) {
      query.andWhere('movement.containerId = :containerId', { containerId: filters.containerId });
    }

    if (filters.type) {
      query.andWhere('movement.type = :type', { type: filters.type });
    }

    if (filters.status) {
      query.andWhere('movement.status = :status', { status: filters.status });
    }

    if (filters.priority) {
      query.andWhere('movement.priority = :priority', { priority: filters.priority });
    }

    if (filters.operatorId) {
      query.andWhere('movement.operatorId = :operatorId', { operatorId: filters.operatorId });
    }

    if (filters.equipmentId) {
      query.andWhere('movement.equipmentId = :equipmentId', { equipmentId: filters.equipmentId });
    }

    if (filters.equipmentType) {
      query.andWhere('movement.equipmentType = :equipmentType', { equipmentType: filters.equipmentType });
    }

    if (filters.fromYardId) {
      query.andWhere("movement.fromLocation->>'yardId' = :fromYardId", { fromYardId: filters.fromYardId });
    }

    if (filters.toYardId) {
      query.andWhere("movement.toLocation->>'yardId' = :toYardId", { toYardId: filters.toYardId });
    }

    if (filters.timestampAfter) {
      query.andWhere('movement.timestamp >= :timestampAfter', { timestampAfter: filters.timestampAfter });
    }

    if (filters.timestampBefore) {
      query.andWhere('movement.timestamp <= :timestampBefore', { timestampBefore: filters.timestampBefore });
    }

    if (filters.relatedOrderId) {
      query.andWhere('movement.relatedOrderId = :relatedOrderId', { relatedOrderId: filters.relatedOrderId });
    }

    if (filters.gateTransactionId) {
      query.andWhere('movement.gateTransactionId = :gateTransactionId', { gateTransactionId: filters.gateTransactionId });
    }

    query.orderBy('movement.timestamp', 'DESC');

    return query.getMany();
  }

  async getContainerMovementHistory(containerId: string): Promise<MovementLog[]> {
    return this.movementLogRepository.find({
      where: { containerId },
      relations: ['container', 'placement'],
      order: { timestamp: 'ASC' },
    });
  }

  async getActiveMovements(): Promise<MovementLog[]> {
    return this.movementLogRepository.find({
      where: [
        { status: MovementStatus.PLANNED },
        { status: MovementStatus.IN_PROGRESS },
      ],
      relations: ['container', 'placement'],
      order: { timestamp: 'ASC' },
    });
  }

  async addGPSPosition(id: string, position: {
    timestamp: Date;
    latitude: number;
    longitude: number;
    accuracy: number;
    speed?: number;
    heading?: number;
    altitude?: number;
  }): Promise<MovementLog> {
    const movementLog = await this.getMovementLogById(id);

    const gpsTracking = movementLog.gpsTracking || {
      enabled: true,
      trackingInterval: 30,
      positions: [],
    };

    gpsTracking.positions.push(position);

    // Update end position
    gpsTracking.endPosition = {
      latitude: position.latitude,
      longitude: position.longitude,
      timestamp: position.timestamp,
    };

    // Set start position if not set
    if (!gpsTracking.startPosition) {
      gpsTracking.startPosition = {
        latitude: position.latitude,
        longitude: position.longitude,
        timestamp: position.timestamp,
      };
    }

    return this.updateMovementLog(id, { gpsTracking });
  }

  async addIncident(id: string, incident: {
    type: 'delay' | 'equipment_failure' | 'safety' | 'damage' | 'other';
    severity: 'low' | 'medium' | 'high' | 'critical';
    description: string;
    location?: {
      latitude: number;
      longitude: number;
    };
    reportedBy: string;
    photos?: string[];
  }): Promise<MovementLog> {
    const movementLog = await this.getMovementLogById(id);

    const incidents = movementLog.incidents || [];

    const newIncident = {
      incidentId: `INC-${Date.now()}`,
      timestamp: new Date(),
      ...incident,
    };

    incidents.push(newIncident);

    this.eventEmitter.emit('movement.incident', {
      movementId: id,
      containerId: movementLog.containerId,
      incident: newIncident,
    });

    return this.updateMovementLog(id, { incidents });
  }

  async getMovementStatistics(filters?: { 
    period?: number; 
    yardId?: string; 
    equipmentType?: string; 
    operatorId?: string;
  }) {
    const whereClause = [];
    const params = [];

    if (filters?.period) {
      whereClause.push('timestamp >= NOW() - INTERVAL \'' + filters.period + ' days\'');
    }

    if (filters?.yardId) {
      whereClause.push('(from_location->\'yardId\' = $' + (params.length + 1) + ' OR to_location->\'yardId\' = $' + (params.length + 1) + ')');
      params.push(`"${filters.yardId}"`);
    }

    if (filters?.equipmentType) {
      whereClause.push('equipment_type = $' + (params.length + 1));
      params.push(filters.equipmentType);
    }

    if (filters?.operatorId) {
      whereClause.push('operator_id = $' + (params.length + 1));
      params.push(filters.operatorId);
    }

    const whereSQL = whereClause.length > 0 ? 'WHERE ' + whereClause.join(' AND ') : '';

    const [
      totalMovements,
      movementsByType,
      movementsByStatus,
      avgDuration,
      equipmentUsage,
    ] = await Promise.all([
      this.movementLogRepository.query(`
        SELECT COUNT(*) as count
        FROM yard.movement_logs
        ${whereSQL}
      `, params),
      this.movementLogRepository.query(`
        SELECT type, COUNT(*) as count
        FROM yard.movement_logs
        ${whereSQL}
        GROUP BY type
        ORDER BY count DESC
      `, params),
      this.movementLogRepository.query(`
        SELECT status, COUNT(*) as count
        FROM yard.movement_logs
        ${whereSQL}
        GROUP BY status
        ORDER BY count DESC
      `, params),
      this.movementLogRepository.query(`
        SELECT AVG(duration_seconds) as avg_seconds
        FROM yard.movement_logs
        ${whereSQL ? whereSQL + ' AND' : 'WHERE'} duration_seconds IS NOT NULL
      `, params),
      this.movementLogRepository.query(`
        SELECT equipment_type, COUNT(*) as count
        FROM yard.movement_logs
        ${whereSQL ? whereSQL + ' AND' : 'WHERE'} equipment_type IS NOT NULL
        GROUP BY equipment_type
        ORDER BY count DESC
      `, params),
    ]);

    return {
      totals: {
        totalMovements: parseInt(totalMovements[0].count),
        avgDurationSeconds: parseFloat(avgDuration[0].avg_seconds || 0),
      },
      breakdown: {
        byType: movementsByType,
        byStatus: movementsByStatus,
        byEquipment: equipmentUsage,
      },
    };
  }
}