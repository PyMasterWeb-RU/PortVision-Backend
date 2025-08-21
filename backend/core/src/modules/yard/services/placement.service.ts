import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Placement, PlacementStatus, PlacementType, PlacementMethod } from '../entities/placement.entity';
import { Slot, SlotStatus } from '../entities/slot.entity';
import { Container } from '../../common/entities/container.entity';
import { YardService } from './yard.service';
import { MovementLogService } from './movement-log.service';

export interface CreatePlacementDto {
  containerId: string;
  slotId: string;
  zoneId: string;
  type?: PlacementType;
  placementMethod: PlacementMethod;
  plannedRemovalAt?: Date;
  stackLevel?: number;
  maxStackLevel?: number;
  orientation: {
    bearing: number;
    doorDirection: 'north' | 'south' | 'east' | 'west';
    isReversed: boolean;
    sideAccess: 'left' | 'right' | 'both' | 'none';
  };
  placementData: {
    operatorId: string;
    operatorName: string;
    equipmentId?: string;
    equipmentType: string;
    duration: number;
    accuracy: 'precise' | 'approximate' | 'estimated';
    verificationMethod: 'visual' | 'rfid' | 'barcode' | 'gps' | 'manual';
    conditions: {
      weather: string;
      visibility: 'excellent' | 'good' | 'poor';
      groundCondition: 'dry' | 'wet' | 'muddy' | 'icy';
    };
  };
  physicalCondition: {
    weight: {
      gross: number;
      tare: number;
      net: number;
      unit: 'kg' | 'lbs';
      verified: boolean;
    };
    dimensions: {
      length: number;
      width: number;
      height: number;
      unit: 'm' | 'ft';
    };
    condition: 'excellent' | 'good' | 'damaged' | 'needs_inspection';
    damageNotes?: string;
    sealCondition?: 'intact' | 'broken' | 'missing';
    sealNumbers?: string[];
  };
}

export interface UpdatePlacementDto {
  status?: PlacementStatus;
  type?: PlacementType;
  plannedRemovalAt?: Date;
  stackLevel?: number;
  maxStackLevel?: number;
  orientation?: any;
  accessRestrictions?: any;
  cargoInformation?: any;
  monitoring?: any;
  financialData?: any;
  planning?: any;
}

export interface PlacementSearchFilters {
  status?: PlacementStatus;
  type?: PlacementType;
  yardId?: string;
  zoneId?: string;
  containerId?: string;
  containerNumber?: string;
  placedAfter?: Date;
  placedBefore?: Date;
  plannedRemovalAfter?: Date;
  plannedRemovalBefore?: Date;
  operatorId?: string;
  equipmentType?: string;
  stackLevel?: number;
  hasRestrictions?: boolean;
  requiresRemoval?: boolean;
}

export interface SlotAllocationResult {
  allocated: boolean;
  slotId?: string;
  slotAddress?: string;
  reason?: string;
  alternatives?: Array<{
    slotId: string;
    slotAddress: string;
    suitabilityScore: number;
    notes: string;
  }>;
}

@Injectable()
export class PlacementService {
  private readonly logger = new Logger(PlacementService.name);

  constructor(
    @InjectRepository(Placement)
    private readonly placementRepository: Repository<Placement>,
    @InjectRepository(Slot)
    private readonly slotRepository: Repository<Slot>,
    @InjectRepository(Container)
    private readonly containerRepository: Repository<Container>,
    private readonly yardService: YardService,
    private readonly movementLogService: MovementLogService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async createPlacement(createPlacementDto: CreatePlacementDto): Promise<Placement> {
    this.logger.log(`Creating placement for container ${createPlacementDto.containerId} in slot ${createPlacementDto.slotId}`);

    // Validate container exists
    const container = await this.containerRepository.findOne({
      where: { id: createPlacementDto.containerId },
    });
    if (!container) {
      throw new NotFoundException(`Container ${createPlacementDto.containerId} not found`);
    }

    // Validate slot exists and is available
    const slot = await this.slotRepository.findOne({
      where: { id: createPlacementDto.slotId },
      relations: ['zone'],
    });
    if (!slot) {
      throw new NotFoundException(`Slot ${createPlacementDto.slotId} not found`);
    }

    if (slot.status !== SlotStatus.AVAILABLE) {
      throw new BadRequestException(`Slot ${slot.slotAddress} is not available (status: ${slot.status})`);
    }

    // Check if container is already placed
    const existingPlacement = await this.placementRepository.findOne({
      where: { 
        containerId: createPlacementDto.containerId,
        status: PlacementStatus.ACTIVE,
      },
    });
    if (existingPlacement) {
      throw new BadRequestException(`Container ${container.number} is already placed in slot ${existingPlacement.slot.slotAddress}`);
    }

    // Validate placement rules
    await this.validatePlacementRules(container, slot, createPlacementDto);

    const placement = this.placementRepository.create({
      ...createPlacementDto,
      placedAt: new Date(),
      status: PlacementStatus.ACTIVE,
      stackPosition: {
        level: createPlacementDto.stackLevel || 1,
        isBottom: (createPlacementDto.stackLevel || 1) === 1,
        isTop: true, // Initially top until another container is placed above
        hasContainersAbove: false,
        hasContainersBelow: (createPlacementDto.stackLevel || 1) > 1,
        stackHeight: createPlacementDto.stackLevel || 1,
      },
    });

    const savedPlacement = await this.placementRepository.save(placement);

    // Update slot status
    await this.slotRepository.update(slot.id, {
      status: SlotStatus.OCCUPIED,
    });

    // Update zone and yard occupancy
    await this.updateOccupancyCounters(slot.zone.yardId, slot.zone.id);

    // Log movement
    await this.movementLogService.createMovementLog({
      containerId: container.id,
      placementId: savedPlacement.id,
      type: 'yard_to_yard',
      fromLocation: {
        type: 'gate',
        description: 'Container entered terminal',
      },
      toLocation: {
        type: 'yard',
        yardId: slot.zone.yardId,
        zoneId: slot.zone.id,
        slotId: slot.id,
        slotAddress: slot.slotAddress,
      },
      operatorId: createPlacementDto.placementData.operatorId,
      operatorName: createPlacementDto.placementData.operatorName,
      equipmentId: createPlacementDto.placementData.equipmentId,
      equipmentType: createPlacementDto.placementData.equipmentType,
      reason: `Container placement - ${createPlacementDto.type || 'storage'}`,
    });

    this.eventEmitter.emit('placement.created', {
      placementId: savedPlacement.id,
      containerId: container.id,
      containerNumber: container.number,
      slotId: slot.id,
      slotAddress: slot.slotAddress,
      zoneId: slot.zone.id,
      yardId: slot.zone.yardId,
      placementType: savedPlacement.type,
      operatorId: createPlacementDto.placementData.operatorId,
    });

    this.logger.log(`Placement created successfully: ${savedPlacement.id}`);
    return savedPlacement;
  }

  async getAllPlacements(): Promise<Placement[]> {
    return this.placementRepository.find({
      relations: ['container', 'slot', 'zone'],
      order: { placedAt: 'DESC' },
    });
  }

  async getPlacementById(id: string): Promise<Placement> {
    const placement = await this.placementRepository.findOne({
      where: { id },
      relations: ['container', 'slot', 'zone'],
    });

    if (!placement) {
      throw new NotFoundException(`Placement with ID ${id} not found`);
    }

    return placement;
  }

  async updatePlacement(id: string, updatePlacementDto: UpdatePlacementDto): Promise<Placement> {
    const placement = await this.getPlacementById(id);

    Object.assign(placement, updatePlacementDto);
    const updatedPlacement = await this.placementRepository.save(placement);

    this.eventEmitter.emit('placement.updated', {
      placementId: updatedPlacement.id,
      containerId: placement.containerId,
      changes: updatePlacementDto,
    });

    this.logger.log(`Placement updated: ${updatedPlacement.id}`);
    return updatedPlacement;
  }

  async completePlacement(id: string, removalData: any): Promise<Placement> {
    const placement = await this.getPlacementById(id);

    if (placement.status !== PlacementStatus.ACTIVE) {
      throw new BadRequestException(`Cannot complete placement ${id} - status is ${placement.status}`);
    }

    const updatedPlacement = await this.placementRepository.save({
      ...placement,
      status: PlacementStatus.COMPLETED,
      actualRemovalAt: new Date(),
      removalData,
    });

    // Update slot status
    await this.slotRepository.update(placement.slotId, {
      status: SlotStatus.AVAILABLE,
    });

    // Update occupancy counters
    await this.updateOccupancyCounters(placement.zone.yard.id, placement.zone.id);

    // Log movement
    await this.movementLogService.createMovementLog({
      containerId: placement.containerId,
      placementId: placement.id,
      type: 'yard_to_yard',
      fromLocation: {
        type: 'yard',
        yardId: placement.zone.yard.id,
        zoneId: placement.zone.id,
        slotId: placement.slot.id,
        slotAddress: placement.slot.slotAddress,
      },
      toLocation: {
        type: removalData.destination?.type || 'gate',
        description: removalData.destination?.location || 'Container removed from terminal',
      },
      operatorId: removalData.operatorId,
      operatorName: removalData.operatorName,
      equipmentId: removalData.equipmentId,
      equipmentType: removalData.equipmentType,
      reason: placement.removalReason || 'Container removal',
    });

    this.eventEmitter.emit('placement.completed', {
      placementId: updatedPlacement.id,
      containerId: placement.containerId,
      slotId: placement.slotId,
      removalReason: placement.removalReason,
      actualRemovalAt: updatedPlacement.actualRemovalAt,
    });

    this.logger.log(`Placement completed: ${updatedPlacement.id}`);
    return updatedPlacement;
  }

  async searchPlacements(filters: PlacementSearchFilters): Promise<Placement[]> {
    const query = this.placementRepository.createQueryBuilder('placement')
      .leftJoinAndSelect('placement.container', 'container')
      .leftJoinAndSelect('placement.slot', 'slot')
      .leftJoinAndSelect('placement.zone', 'zone');

    if (filters.status) {
      query.andWhere('placement.status = :status', { status: filters.status });
    }

    if (filters.type) {
      query.andWhere('placement.type = :type', { type: filters.type });
    }

    if (filters.yardId) {
      query.andWhere('zone.yardId = :yardId', { yardId: filters.yardId });
    }

    if (filters.zoneId) {
      query.andWhere('placement.zoneId = :zoneId', { zoneId: filters.zoneId });
    }

    if (filters.containerId) {
      query.andWhere('placement.containerId = :containerId', { containerId: filters.containerId });
    }

    if (filters.containerNumber) {
      query.andWhere('container.number = :containerNumber', { containerNumber: filters.containerNumber });
    }

    if (filters.placedAfter) {
      query.andWhere('placement.placedAt >= :placedAfter', { placedAfter: filters.placedAfter });
    }

    if (filters.placedBefore) {
      query.andWhere('placement.placedAt <= :placedBefore', { placedBefore: filters.placedBefore });
    }

    if (filters.plannedRemovalAfter) {
      query.andWhere('placement.plannedRemovalAt >= :plannedRemovalAfter', { plannedRemovalAfter: filters.plannedRemovalAfter });
    }

    if (filters.plannedRemovalBefore) {
      query.andWhere('placement.plannedRemovalAt <= :plannedRemovalBefore', { plannedRemovalBefore: filters.plannedRemovalBefore });
    }

    if (filters.operatorId) {
      query.andWhere("placement.placementData->>'operatorId' = :operatorId", { operatorId: filters.operatorId });
    }

    if (filters.equipmentType) {
      query.andWhere("placement.placementData->>'equipmentType' = :equipmentType", { equipmentType: filters.equipmentType });
    }

    if (filters.stackLevel) {
      query.andWhere('placement.stackLevel = :stackLevel', { stackLevel: filters.stackLevel });
    }

    if (filters.hasRestrictions) {
      query.andWhere('placement.accessRestrictions IS NOT NULL');
    }

    if (filters.requiresRemoval) {
      query.andWhere('placement.plannedRemovalAt <= :now', { now: new Date() });
      query.andWhere('placement.status = :activeStatus', { activeStatus: PlacementStatus.ACTIVE });
    }

    query.orderBy('placement.placedAt', 'DESC');

    return query.getMany();
  }

  async findOptimalSlot(
    containerId: string,
    preferredZoneId?: string,
    criteria?: {
      containerType?: string;
      hazmatClass?: string;
      temperatureControlled?: boolean;
      maxDwellTime?: number;
      equipmentAccess?: string[];
    }
  ): Promise<SlotAllocationResult> {
    const container = await this.containerRepository.findOne({
      where: { id: containerId },
    });

    if (!container) {
      throw new NotFoundException(`Container ${containerId} not found`);
    }

    // Build query for available slots
    const query = this.slotRepository.createQueryBuilder('slot')
      .leftJoinAndSelect('slot.zone', 'zone')
      .leftJoinAndSelect('zone.yard', 'yard')
      .where('slot.status = :status', { status: SlotStatus.AVAILABLE })
      .andWhere('zone.status = :zoneStatus', { zoneStatus: 'available' })
      .andWhere('yard.status = :yardStatus', { yardStatus: 'active' });

    if (preferredZoneId) {
      query.andWhere('zone.id = :zoneId', { zoneId: preferredZoneId });
    }

    // Add container size compatibility
    if (container.size) {
      query.andWhere(
        `slot.restrictions->>'containerSizes'->>'allowed' @> :containerSize OR slot.restrictions->>'containerSizes' IS NULL`,
        { containerSize: JSON.stringify([container.size]) }
      );
    }

    // Add container type compatibility
    if (container.type) {
      query.andWhere(
        `slot.restrictions->>'containerTypes'->>'allowed' @> :containerType OR slot.restrictions->>'containerTypes' IS NULL`,
        { containerType: JSON.stringify([container.type]) }
      );
    }

    const availableSlots = await query.getMany();

    if (availableSlots.length === 0) {
      return {
        allocated: false,
        reason: 'No available slots found matching container requirements',
        alternatives: [],
      };
    }

    // Score slots based on suitability
    const scoredSlots = availableSlots.map(slot => {
      let score = 0;

      // Base score for availability
      score += 10;

      // Zone preference
      if (preferredZoneId && slot.zoneId === preferredZoneId) {
        score += 20;
      }

      // Equipment accessibility
      if (criteria?.equipmentAccess) {
        const slotAccess = slot.equipmentAccess;
        criteria.equipmentAccess.forEach(equipment => {
          if (slotAccess[equipment]?.accessible) {
            score += 5;
          }
        });
      }

      // Container type compatibility
      if (slot.restrictions?.containerTypes?.allowed?.includes(container.type)) {
        score += 15;
      }

      // Size compatibility
      if (slot.restrictions?.containerSizes?.allowed?.includes(container.size)) {
        score += 15;
      }

      // Temperature control for reefer containers
      if (criteria?.temperatureControlled && slot.utilities?.power?.available) {
        score += 25;
      }

      // Avoid high-traffic areas for long-term storage
      if (criteria?.maxDwellTime && criteria.maxDwellTime > 168) { // > 1 week
        if (slot.accessibility !== 'truck_accessible') {
          score += 10; // Prefer less accessible slots for long-term storage
        }
      }

      return {
        slot,
        score,
        slotId: slot.id,
        slotAddress: slot.slotAddress,
        suitabilityScore: score,
        notes: this.generateSlotNotes(slot, container, score),
      };
    });

    // Sort by score descending
    scoredSlots.sort((a, b) => b.score - a.score);

    const bestSlot = scoredSlots[0];

    return {
      allocated: true,
      slotId: bestSlot.slotId,
      slotAddress: bestSlot.slotAddress,
      alternatives: scoredSlots.slice(1, 6).map(s => ({
        slotId: s.slotId,
        slotAddress: s.slotAddress,
        suitabilityScore: s.suitabilityScore,
        notes: s.notes,
      })),
    };
  }

  private async validatePlacementRules(container: Container, slot: Slot, placementDto: CreatePlacementDto): Promise<void> {
    // Validate container size compatibility
    if (slot.restrictions?.containerSizes?.prohibited?.includes(container.size)) {
      throw new BadRequestException(`Container size ${container.size} is prohibited in slot ${slot.slotAddress}`);
    }

    // Validate container type compatibility
    if (slot.restrictions?.containerTypes?.prohibited?.includes(container.type)) {
      throw new BadRequestException(`Container type ${container.type} is prohibited in slot ${slot.slotAddress}`);
    }

    // Validate weight restrictions
    if (slot.restrictions?.weight?.maxSingleContainer) {
      const containerWeight = placementDto.physicalCondition.weight.gross;
      if (containerWeight > slot.restrictions.weight.maxSingleContainer) {
        throw new BadRequestException(`Container weight ${containerWeight} exceeds slot limit ${slot.restrictions.weight.maxSingleContainer}`);
      }
    }

    // Validate stack level
    if (placementDto.stackLevel && placementDto.stackLevel > slot.dimensions.height) {
      throw new BadRequestException(`Stack level ${placementDto.stackLevel} exceeds slot height ${slot.dimensions.height}`);
    }
  }

  private async updateOccupancyCounters(yardId: string, zoneId: string): Promise<void> {
    // Update zone occupancy
    const zoneOccupancy = await this.placementRepository.count({
      where: { zoneId, status: PlacementStatus.ACTIVE },
    });

    await this.placementRepository.query(
      'UPDATE yard.zones SET current_occupancy = $1 WHERE id = $2',
      [zoneOccupancy, zoneId]
    );

    // Update yard occupancy
    await this.yardService.updateOccupancy(yardId);
  }

  private generateSlotNotes(slot: Slot, container: Container, score: number): string {
    const notes = [];

    if (score >= 80) {
      notes.push('Excellent match');
    } else if (score >= 60) {
      notes.push('Good match');
    } else if (score >= 40) {
      notes.push('Acceptable match');
    } else {
      notes.push('Poor match');
    }

    if (slot.utilities?.power?.available && container.type === 'reefer') {
      notes.push('Power available for reefer');
    }

    if (slot.accessibility === 'truck_accessible') {
      notes.push('Truck accessible');
    }

    if (slot.accessibility === 'crane_only') {
      notes.push('Crane access only');
    }

    return notes.join(', ');
  }

  async getPlacementStatistics(filters?: { yardId?: string; zoneId?: string; period?: number }) {
    const whereClause = [];
    const params = [];

    if (filters?.yardId) {
      whereClause.push('z.yard_id = $' + (params.length + 1));
      params.push(filters.yardId);
    }

    if (filters?.zoneId) {
      whereClause.push('p.zone_id = $' + (params.length + 1));
      params.push(filters.zoneId);
    }

    if (filters?.period) {
      whereClause.push('p.placed_at >= NOW() - INTERVAL \'' + filters.period + ' days\'');
    }

    const whereSQL = whereClause.length > 0 ? 'WHERE ' + whereClause.join(' AND ') : '';

    const [
      totalPlacements,
      activePlacements,
      placementsByType,
      placementsByStatus,
      avgDwellTime,
    ] = await Promise.all([
      this.placementRepository.query(`
        SELECT COUNT(*) as count
        FROM yard.placements p
        JOIN yard.zones z ON p.zone_id = z.id
        ${whereSQL}
      `, params),
      this.placementRepository.query(`
        SELECT COUNT(*) as count
        FROM yard.placements p
        JOIN yard.zones z ON p.zone_id = z.id
        ${whereSQL ? whereSQL + ' AND' : 'WHERE'} p.status = 'active'
      `, params),
      this.placementRepository.query(`
        SELECT p.type, COUNT(*) as count
        FROM yard.placements p
        JOIN yard.zones z ON p.zone_id = z.id
        ${whereSQL}
        GROUP BY p.type
        ORDER BY count DESC
      `, params),
      this.placementRepository.query(`
        SELECT p.status, COUNT(*) as count
        FROM yard.placements p
        JOIN yard.zones z ON p.zone_id = z.id
        ${whereSQL}
        GROUP BY p.status
        ORDER BY count DESC
      `, params),
      this.placementRepository.query(`
        SELECT AVG(
          EXTRACT(EPOCH FROM (
            COALESCE(p.actual_removal_at, NOW()) - p.placed_at
          )) / 3600
        ) as avg_hours
        FROM yard.placements p
        JOIN yard.zones z ON p.zone_id = z.id
        ${whereSQL}
      `, params),
    ]);

    return {
      totals: {
        totalPlacements: parseInt(totalPlacements[0].count),
        activePlacements: parseInt(activePlacements[0].count),
        avgDwellTimeHours: parseFloat(avgDwellTime[0].avg_hours || 0),
      },
      breakdown: {
        byType: placementsByType,
        byStatus: placementsByStatus,
      },
    };
  }
}