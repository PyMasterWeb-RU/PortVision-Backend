import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Point } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Yard, YardStatus, YardType } from '../entities/yard.entity';
import { Zone } from '../entities/zone.entity';
import { Slot } from '../entities/slot.entity';
import { Placement } from '../entities/placement.entity';

export interface CreateYardDto {
  yardCode: string;
  yardName: string;
  type: YardType;
  description?: string;
  geometry: string;
  maxCapacity: number;
  maxStackHeight?: number;
  dimensions: {
    length: number;
    width: number;
    unit: 'm' | 'ft';
    area: number;
  };
  surfaceType: 'concrete' | 'asphalt' | 'gravel' | 'dirt' | 'other';
  hasDrainage?: boolean;
  hasLighting?: boolean;
  reeferPlugs?: number;
  hasCctv?: boolean;
  operatingHours: any;
  accessPoint?: string;
}

export interface UpdateYardDto {
  yardName?: string;
  status?: YardStatus;
  description?: string;
  maxCapacity?: number;
  currentOccupancy?: number;
  maxStackHeight?: number;
  hasDrainage?: boolean;
  hasLighting?: boolean;
  reeferPlugs?: number;
  hasCctv?: boolean;
  operatingHours?: any;
  accessRestrictions?: any;
  cargoRestrictions?: any;
  managerContact?: any;
}

export interface YardCapacityInfo {
  totalCapacity: number;
  currentOccupancy: number;
  availableCapacity: number;
  utilizationRate: number;
  byZone: Array<{
    zoneId: string;
    zoneName: string;
    capacity: number;
    occupancy: number;
    utilizationRate: number;
  }>;
}

export interface YardSearchFilters {
  status?: YardStatus;
  type?: YardType;
  hasCapacity?: boolean;
  minCapacity?: number;
  maxCapacity?: number;
  surfaceType?: string;
  hasDrainage?: boolean;
  hasLighting?: boolean;
  reeferPlugs?: boolean;
  hasCctv?: boolean;
  nearPoint?: {
    latitude: number;
    longitude: number;
    radiusKm: number;
  };
}

@Injectable()
export class YardService {
  private readonly logger = new Logger(YardService.name);

  constructor(
    @InjectRepository(Yard)
    private readonly yardRepository: Repository<Yard>,
    @InjectRepository(Zone)
    private readonly zoneRepository: Repository<Zone>,
    @InjectRepository(Slot)
    private readonly slotRepository: Repository<Slot>,
    @InjectRepository(Placement)
    private readonly placementRepository: Repository<Placement>,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async createYard(createYardDto: CreateYardDto): Promise<Yard> {
    this.logger.log(`Creating new yard: ${createYardDto.yardCode}`);

    const existingYard = await this.yardRepository.findOne({
      where: { yardCode: createYardDto.yardCode },
    });

    if (existingYard) {
      throw new BadRequestException(`Yard with code ${createYardDto.yardCode} already exists`);
    }

    const yard = this.yardRepository.create({
      ...createYardDto,
      status: YardStatus.ACTIVE,
      currentOccupancy: 0,
      fireSuppressionSystem: 'Standard sprinkler system',
    });

    const savedYard = await this.yardRepository.save(yard);

    this.eventEmitter.emit('yard.created', {
      yardId: savedYard.id,
      yardCode: savedYard.yardCode,
      type: savedYard.type,
      capacity: savedYard.maxCapacity,
    });

    this.logger.log(`Yard created successfully: ${savedYard.id}`);
    return savedYard;
  }

  async getAllYards(): Promise<Yard[]> {
    return this.yardRepository.find({
      order: { yardCode: 'ASC' },
    });
  }

  async getYardById(id: string): Promise<Yard> {
    const yard = await this.yardRepository.findOne({
      where: { id },
    });

    if (!yard) {
      throw new NotFoundException(`Yard with ID ${id} not found`);
    }

    return yard;
  }

  async getYardByCode(yardCode: string): Promise<Yard> {
    const yard = await this.yardRepository.findOne({
      where: { yardCode },
    });

    if (!yard) {
      throw new NotFoundException(`Yard with code ${yardCode} not found`);
    }

    return yard;
  }

  async updateYard(id: string, updateYardDto: UpdateYardDto): Promise<Yard> {
    const yard = await this.getYardById(id);

    Object.assign(yard, updateYardDto);
    const updatedYard = await this.yardRepository.save(yard);

    this.eventEmitter.emit('yard.updated', {
      yardId: updatedYard.id,
      yardCode: updatedYard.yardCode,
      changes: updateYardDto,
    });

    this.logger.log(`Yard updated: ${updatedYard.yardCode}`);
    return updatedYard;
  }

  async deleteYard(id: string): Promise<void> {
    const yard = await this.getYardById(id);

    // Check if yard has active placements
    const activePlacements = await this.placementRepository.count({
      where: { 
        zone: { yardId: id },
        status: 'active',
      },
    });

    if (activePlacements > 0) {
      throw new BadRequestException(`Cannot delete yard ${yard.yardCode} - has ${activePlacements} active container placements`);
    }

    await this.yardRepository.remove(yard);

    this.eventEmitter.emit('yard.deleted', {
      yardId: id,
      yardCode: yard.yardCode,
    });

    this.logger.log(`Yard deleted: ${yard.yardCode}`);
  }

  async searchYards(filters: YardSearchFilters): Promise<Yard[]> {
    const query = this.yardRepository.createQueryBuilder('yard');

    if (filters.status) {
      query.andWhere('yard.status = :status', { status: filters.status });
    }

    if (filters.type) {
      query.andWhere('yard.type = :type', { type: filters.type });
    }

    if (filters.hasCapacity) {
      query.andWhere('yard.currentOccupancy < yard.maxCapacity');
    }

    if (filters.minCapacity) {
      query.andWhere('yard.maxCapacity >= :minCapacity', { minCapacity: filters.minCapacity });
    }

    if (filters.maxCapacity) {
      query.andWhere('yard.maxCapacity <= :maxCapacity', { maxCapacity: filters.maxCapacity });
    }

    if (filters.surfaceType) {
      query.andWhere('yard.surfaceType = :surfaceType', { surfaceType: filters.surfaceType });
    }

    if (filters.hasDrainage !== undefined) {
      query.andWhere('yard.hasDrainage = :hasDrainage', { hasDrainage: filters.hasDrainage });
    }

    if (filters.hasLighting !== undefined) {
      query.andWhere('yard.hasLighting = :hasLighting', { hasLighting: filters.hasLighting });
    }

    if (filters.reeferPlugs) {
      query.andWhere('yard.reeferPlugs > 0');
    }

    if (filters.hasCctv !== undefined) {
      query.andWhere('yard.hasCctv = :hasCctv', { hasCctv: filters.hasCctv });
    }

    if (filters.nearPoint) {
      const { latitude, longitude, radiusKm } = filters.nearPoint;
      query.andWhere(
        `ST_DWithin(
          yard.geometry, 
          ST_SetSRID(ST_MakePoint(:longitude, :latitude), 4326)::geography,
          :radiusM
        )`,
        {
          latitude,
          longitude,
          radiusM: radiusKm * 1000,
        }
      );
    }

    query.orderBy('yard.yardCode', 'ASC');

    return query.getMany();
  }

  async getYardCapacityInfo(id: string): Promise<YardCapacityInfo> {
    const yard = await this.getYardById(id);

    const zones = await this.zoneRepository.find({
      where: { yardId: id },
    });

    const byZone = zones.map(zone => ({
      zoneId: zone.id,
      zoneName: zone.zoneName,
      capacity: zone.maxCapacity,
      occupancy: zone.currentOccupancy,
      utilizationRate: zone.maxCapacity > 0 ? (zone.currentOccupancy / zone.maxCapacity) * 100 : 0,
    }));

    return {
      totalCapacity: yard.maxCapacity,
      currentOccupancy: yard.currentOccupancy,
      availableCapacity: yard.maxCapacity - yard.currentOccupancy,
      utilizationRate: yard.maxCapacity > 0 ? (yard.currentOccupancy / yard.maxCapacity) * 100 : 0,
      byZone,
    };
  }

  async getYardsWithinRadius(
    latitude: number,
    longitude: number,
    radiusKm: number
  ): Promise<Array<Yard & { distanceKm: number }>> {
    const query = `
      SELECT 
        yard.*,
        ST_Distance(
          yard.geometry, 
          ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography
        ) / 1000 as "distanceKm"
      FROM yard.yards yard
      WHERE ST_DWithin(
        yard.geometry, 
        ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography,
        $3
      )
      ORDER BY "distanceKm" ASC
    `;

    const results = await this.yardRepository.query(query, [
      latitude,
      longitude,
      radiusKm * 1000,
    ]);

    return results;
  }

  async activateYard(id: string): Promise<Yard> {
    return this.updateYard(id, { status: YardStatus.ACTIVE });
  }

  async deactivateYard(id: string): Promise<Yard> {
    return this.updateYard(id, { status: YardStatus.INACTIVE });
  }

  async setMaintenanceMode(id: string): Promise<Yard> {
    return this.updateYard(id, { status: YardStatus.MAINTENANCE });
  }

  async emergencyClose(id: string, reason: string): Promise<Yard> {
    const yard = await this.updateYard(id, { status: YardStatus.EMERGENCY_CLOSED });

    this.eventEmitter.emit('yard.emergency_closed', {
      yardId: id,
      yardCode: yard.yardCode,
      reason,
      timestamp: new Date(),
    });

    this.logger.warn(`Yard ${yard.yardCode} closed for emergency: ${reason}`);
    return yard;
  }

  async updateOccupancy(yardId: string): Promise<void> {
    const occupancy = await this.placementRepository.count({
      where: {
        zone: { yardId },
        status: 'active',
      },
    });

    await this.yardRepository.update(yardId, {
      currentOccupancy: occupancy,
    });

    this.eventEmitter.emit('yard.occupancy_updated', {
      yardId,
      currentOccupancy: occupancy,
    });
  }

  async getYardStatistics(id: string) {
    const yard = await this.getYardById(id);

    const [
      totalContainers,
      containersByType,
      recentMovements,
      utilizationTrend,
    ] = await Promise.all([
      this.placementRepository.count({
        where: { zone: { yardId: id }, status: 'active' },
      }),
      this.getContainersByType(id),
      this.getRecentMovements(id, 24), // last 24 hours
      this.getUtilizationTrend(id, 30), // last 30 days
    ]);

    return {
      yardInfo: {
        id: yard.id,
        code: yard.yardCode,
        name: yard.yardName,
        type: yard.type,
        status: yard.status,
      },
      capacity: {
        total: yard.maxCapacity,
        current: yard.currentOccupancy,
        available: yard.maxCapacity - yard.currentOccupancy,
        utilizationRate: yard.maxCapacity > 0 ? (yard.currentOccupancy / yard.maxCapacity) * 100 : 0,
      },
      containers: {
        total: totalContainers,
        byType: containersByType,
      },
      activity: {
        recentMovements,
        utilizationTrend,
      },
    };
  }

  private async getContainersByType(yardId: string) {
    const query = `
      SELECT 
        c.type as containerType,
        COUNT(*) as count
      FROM yard.placements p
      JOIN yard.zones z ON p.zone_id = z.id
      JOIN common.containers c ON p.container_id = c.id
      WHERE z.yard_id = $1 AND p.status = 'active'
      GROUP BY c.type
      ORDER BY count DESC
    `;

    return this.yardRepository.query(query, [yardId]);
  }

  private async getRecentMovements(yardId: string, hours: number) {
    const query = `
      SELECT 
        ml.type as movementType,
        COUNT(*) as count
      FROM yard.movement_logs ml
      WHERE ml.timestamp >= NOW() - INTERVAL '${hours} hours'
      AND (
        ml.from_location->>'yardId' = $1 
        OR ml.to_location->>'yardId' = $1
      )
      GROUP BY ml.type
      ORDER BY count DESC
    `;

    return this.yardRepository.query(query, [yardId]);
  }

  private async getUtilizationTrend(yardId: string, days: number) {
    const query = `
      SELECT 
        DATE(p.placed_at) as date,
        COUNT(*) as placements
      FROM yard.placements p
      JOIN yard.zones z ON p.zone_id = z.id
      WHERE z.yard_id = $1 
      AND p.placed_at >= NOW() - INTERVAL '${days} days'
      GROUP BY DATE(p.placed_at)
      ORDER BY date DESC
    `;

    return this.yardRepository.query(query, [yardId]);
  }
}