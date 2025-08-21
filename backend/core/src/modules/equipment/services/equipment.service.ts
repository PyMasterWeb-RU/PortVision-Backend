import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { 
  Equipment, 
  EquipmentType, 
  EquipmentStatus, 
  EquipmentCondition,
  FuelType 
} from '../entities/equipment.entity';

export interface CreateEquipmentDto {
  equipmentName: string;
  type: EquipmentType;
  description?: string;
  manufacturer: string;
  manufacturerId?: string;
  model: string;
  manufacturingYear: number;
  serialNumber: string;
  vinNumber?: string;
  licensePlate?: string;
  specifications: any;
  attachments?: any[];
  certifications?: any[];
  currentLocation?: string;
  locationAddress?: string;
  locationZone?: string;
  assignedOperatorId?: string;
  assignedOperatorName?: string;
  departmentId?: string;
  departmentName?: string;
  costCenter?: string;
  commissionedAt: Date;
  financialData?: any;
  maintenanceSchedule: any;
  operationalData?: any;
  monitoringData?: any;
  movementHistory?: any[];
  safetyRequirements?: any;
  connectivityConfig?: any;
  metadata?: Record<string, any>;
}

export interface UpdateEquipmentDto {
  equipmentName?: string;
  status?: EquipmentStatus;
  condition?: EquipmentCondition;
  description?: string;
  specifications?: any;
  attachments?: any[];
  certifications?: any[];
  currentLocation?: string;
  locationAddress?: string;
  locationZone?: string;
  assignedOperatorId?: string;
  assignedOperatorName?: string;
  departmentId?: string;
  departmentName?: string;
  costCenter?: string;
  decommissionedAt?: Date;
  financialData?: any;
  maintenanceSchedule?: any;
  operationalData?: any;
  monitoringData?: any;
  movementHistory?: any[];
  safetyRequirements?: any;
  connectivityConfig?: any;
  metadata?: Record<string, any>;
}

export interface EquipmentSearchFilters {
  type?: EquipmentType;
  status?: EquipmentStatus;
  condition?: EquipmentCondition;
  manufacturer?: string;
  manufacturerId?: string;
  model?: string;
  manufacturingYearFrom?: number;
  manufacturingYearTo?: number;
  assignedOperatorId?: string;
  departmentId?: string;
  locationZone?: string;
  fuelType?: FuelType;
  commissionedAfter?: Date;
  commissionedBefore?: Date;
  decommissionedAfter?: Date;
  decommissionedBefore?: Date;
  hasLocation?: boolean;
  hasAssignedOperator?: boolean;
  maintenanceDue?: boolean;
  maxCapacityFrom?: number;
  maxCapacityTo?: number;
  searchText?: string;
}

export interface EquipmentAvailabilityFilters {
  equipmentTypes?: EquipmentType[];
  locationZone?: string;
  requiredCapacity?: number;
  startTime: Date;
  endTime: Date;
  excludeEquipmentIds?: string[];
}

@Injectable()
export class EquipmentService {
  private readonly logger = new Logger(EquipmentService.name);

  constructor(
    @InjectRepository(Equipment)
    private readonly equipmentRepository: Repository<Equipment>,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async createEquipment(createEquipmentDto: CreateEquipmentDto): Promise<Equipment> {
    this.logger.log(`Creating equipment: ${createEquipmentDto.equipmentName}`);

    // Generate equipment number
    const equipmentNumber = await this.generateEquipmentNumber(createEquipmentDto.type);

    const equipment = this.equipmentRepository.create({
      ...createEquipmentDto,
      equipmentNumber,
      status: EquipmentStatus.AVAILABLE,
      condition: EquipmentCondition.GOOD,
    });

    const savedEquipment = await this.equipmentRepository.save(equipment);

    this.eventEmitter.emit('equipment.created', {
      equipmentId: savedEquipment.id,
      equipmentNumber: savedEquipment.equipmentNumber,
      equipmentName: savedEquipment.equipmentName,
      type: savedEquipment.type,
    });

    this.logger.log(`Equipment created: ${savedEquipment.equipmentNumber}`);
    return savedEquipment;
  }

  async getAllEquipment(): Promise<Equipment[]> {
    return this.equipmentRepository.find({
      order: { equipmentNumber: 'ASC' },
    });
  }

  async getEquipmentById(id: string): Promise<Equipment> {
    const equipment = await this.equipmentRepository.findOne({
      where: { id },
    });

    if (!equipment) {
      throw new NotFoundException(`Equipment with ID ${id} not found`);
    }

    return equipment;
  }

  async getEquipmentByNumber(equipmentNumber: string): Promise<Equipment> {
    const equipment = await this.equipmentRepository.findOne({
      where: { equipmentNumber },
    });

    if (!equipment) {
      throw new NotFoundException(`Equipment with number ${equipmentNumber} not found`);
    }

    return equipment;
  }

  async updateEquipment(id: string, updateEquipmentDto: UpdateEquipmentDto): Promise<Equipment> {
    const equipment = await this.getEquipmentById(id);

    Object.assign(equipment, updateEquipmentDto);
    const updatedEquipment = await this.equipmentRepository.save(equipment);

    this.eventEmitter.emit('equipment.updated', {
      equipmentId: updatedEquipment.id,
      equipmentNumber: updatedEquipment.equipmentNumber,
      changes: updateEquipmentDto,
    });

    this.logger.log(`Equipment updated: ${updatedEquipment.equipmentNumber}`);
    return updatedEquipment;
  }

  async deleteEquipment(id: string): Promise<void> {
    const equipment = await this.getEquipmentById(id);

    if (equipment.status === EquipmentStatus.IN_USE) {
      throw new BadRequestException(`Cannot delete equipment ${equipment.equipmentNumber} - currently in use`);
    }

    await this.equipmentRepository.remove(equipment);

    this.eventEmitter.emit('equipment.deleted', {
      equipmentId: equipment.id,
      equipmentNumber: equipment.equipmentNumber,
    });

    this.logger.log(`Equipment deleted: ${equipment.equipmentNumber}`);
  }

  async searchEquipment(filters: EquipmentSearchFilters): Promise<Equipment[]> {
    const query = this.equipmentRepository.createQueryBuilder('equipment');

    if (filters.type) {
      query.andWhere('equipment.type = :type', { type: filters.type });
    }

    if (filters.status) {
      query.andWhere('equipment.status = :status', { status: filters.status });
    }

    if (filters.condition) {
      query.andWhere('equipment.condition = :condition', { condition: filters.condition });
    }

    if (filters.manufacturer) {
      query.andWhere('equipment.manufacturer ILIKE :manufacturer', { 
        manufacturer: `%${filters.manufacturer}%` 
      });
    }

    if (filters.manufacturerId) {
      query.andWhere('equipment.manufacturerId = :manufacturerId', { 
        manufacturerId: filters.manufacturerId 
      });
    }

    if (filters.model) {
      query.andWhere('equipment.model ILIKE :model', { 
        model: `%${filters.model}%` 
      });
    }

    if (filters.manufacturingYearFrom) {
      query.andWhere('equipment.manufacturingYear >= :yearFrom', { 
        yearFrom: filters.manufacturingYearFrom 
      });
    }

    if (filters.manufacturingYearTo) {
      query.andWhere('equipment.manufacturingYear <= :yearTo', { 
        yearTo: filters.manufacturingYearTo 
      });
    }

    if (filters.assignedOperatorId) {
      query.andWhere('equipment.assignedOperatorId = :operatorId', { 
        operatorId: filters.assignedOperatorId 
      });
    }

    if (filters.departmentId) {
      query.andWhere('equipment.departmentId = :departmentId', { 
        departmentId: filters.departmentId 
      });
    }

    if (filters.locationZone) {
      query.andWhere('equipment.locationZone = :locationZone', { 
        locationZone: filters.locationZone 
      });
    }

    if (filters.fuelType) {
      query.andWhere('equipment.specifications->>\'powerSystem\'->>\'fuelType\' = :fuelType', { 
        fuelType: filters.fuelType 
      });
    }

    if (filters.commissionedAfter) {
      query.andWhere('equipment.commissionedAt >= :commissionedAfter', { 
        commissionedAfter: filters.commissionedAfter 
      });
    }

    if (filters.commissionedBefore) {
      query.andWhere('equipment.commissionedAt <= :commissionedBefore', { 
        commissionedBefore: filters.commissionedBefore 
      });
    }

    if (filters.decommissionedAfter) {
      query.andWhere('equipment.decommissionedAt >= :decommissionedAfter', { 
        decommissionedAfter: filters.decommissionedAfter 
      });
    }

    if (filters.decommissionedBefore) {
      query.andWhere('equipment.decommissionedAt <= :decommissionedBefore', { 
        decommissionedBefore: filters.decommissionedBefore 
      });
    }

    if (filters.hasLocation !== undefined) {
      if (filters.hasLocation) {
        query.andWhere('equipment.currentLocation IS NOT NULL');
      } else {
        query.andWhere('equipment.currentLocation IS NULL');
      }
    }

    if (filters.hasAssignedOperator !== undefined) {
      if (filters.hasAssignedOperator) {
        query.andWhere('equipment.assignedOperatorId IS NOT NULL');
      } else {
        query.andWhere('equipment.assignedOperatorId IS NULL');
      }
    }

    if (filters.maintenanceDue) {
      query.andWhere(`
        equipment.maintenanceSchedule->'routine' @> '[{"nextDue": ?}]'
        OR equipment.maintenanceSchedule->'inspections' @> '[{"nextInspection": ?}]'
        OR equipment.maintenanceSchedule->'majorOverhauls' @> '[{"nextOverhaul": ?}]'
      `, [new Date(), new Date(), new Date()]);
    }

    if (filters.maxCapacityFrom) {
      query.andWhere(
        '(equipment.specifications->>\'maxCapacity\'->>\'value\')::numeric >= :capacityFrom', 
        { capacityFrom: filters.maxCapacityFrom }
      );
    }

    if (filters.maxCapacityTo) {
      query.andWhere(
        '(equipment.specifications->>\'maxCapacity\'->>\'value\')::numeric <= :capacityTo', 
        { capacityTo: filters.maxCapacityTo }
      );
    }

    if (filters.searchText) {
      query.andWhere(`(
        equipment.equipmentNumber ILIKE :searchText
        OR equipment.equipmentName ILIKE :searchText
        OR equipment.manufacturer ILIKE :searchText
        OR equipment.model ILIKE :searchText
        OR equipment.serialNumber ILIKE :searchText
        OR equipment.licensePlate ILIKE :searchText
        OR equipment.description ILIKE :searchText
      )`, { searchText: `%${filters.searchText}%` });
    }

    query.orderBy('equipment.equipmentNumber', 'ASC');

    return query.getMany();
  }

  async getEquipmentByType(type: EquipmentType): Promise<Equipment[]> {
    return this.searchEquipment({ type });
  }

  async getEquipmentByStatus(status: EquipmentStatus): Promise<Equipment[]> {
    return this.searchEquipment({ status });
  }

  async getEquipmentByOperator(operatorId: string): Promise<Equipment[]> {
    return this.searchEquipment({ assignedOperatorId: operatorId });
  }

  async getEquipmentByDepartment(departmentId: string): Promise<Equipment[]> {
    return this.searchEquipment({ departmentId });
  }

  async getEquipmentByZone(locationZone: string): Promise<Equipment[]> {
    return this.searchEquipment({ locationZone });
  }

  async getAvailableEquipment(filters: EquipmentAvailabilityFilters): Promise<Equipment[]> {
    const query = this.equipmentRepository.createQueryBuilder('equipment')
      .where('equipment.status = :status', { status: EquipmentStatus.AVAILABLE });

    if (filters.equipmentTypes?.length) {
      query.andWhere('equipment.type IN (:...types)', { types: filters.equipmentTypes });
    }

    if (filters.locationZone) {
      query.andWhere('equipment.locationZone = :zone', { zone: filters.locationZone });
    }

    if (filters.requiredCapacity) {
      query.andWhere(
        '(equipment.specifications->>\'maxCapacity\'->>\'value\')::numeric >= :capacity',
        { capacity: filters.requiredCapacity }
      );
    }

    if (filters.excludeEquipmentIds?.length) {
      query.andWhere('equipment.id NOT IN (:...excludeIds)', { 
        excludeIds: filters.excludeEquipmentIds 
      });
    }

    // TODO: Add availability checking against assignments and maintenance schedules
    // This would require joining with equipment_assignments and maintenance_records

    query.orderBy('equipment.equipmentNumber', 'ASC');

    return query.getMany();
  }

  async assignOperator(
    equipmentId: string, 
    operatorId: string, 
    operatorName: string
  ): Promise<Equipment> {
    const equipment = await this.getEquipmentById(equipmentId);

    if (equipment.status !== EquipmentStatus.AVAILABLE) {
      throw new BadRequestException(
        `Cannot assign operator to equipment ${equipment.equipmentNumber} - status is ${equipment.status}`
      );
    }

    const updatedEquipment = await this.updateEquipment(equipmentId, {
      assignedOperatorId: operatorId,
      assignedOperatorName: operatorName,
      status: EquipmentStatus.IN_USE,
    });

    this.eventEmitter.emit('equipment.operator_assigned', {
      equipmentId,
      equipmentNumber: equipment.equipmentNumber,
      operatorId,
      operatorName,
      assignedAt: new Date(),
    });

    return updatedEquipment;
  }

  async unassignOperator(equipmentId: string): Promise<Equipment> {
    const equipment = await this.getEquipmentById(equipmentId);

    const updatedEquipment = await this.updateEquipment(equipmentId, {
      assignedOperatorId: null,
      assignedOperatorName: null,
      status: EquipmentStatus.AVAILABLE,
    });

    this.eventEmitter.emit('equipment.operator_unassigned', {
      equipmentId,
      equipmentNumber: equipment.equipmentNumber,
      previousOperatorId: equipment.assignedOperatorId,
      unassignedAt: new Date(),
    });

    return updatedEquipment;
  }

  async updateLocation(
    equipmentId: string, 
    location: { coordinates?: string; address?: string; zone?: string }
  ): Promise<Equipment> {
    const equipment = await this.getEquipmentById(equipmentId);

    const updateData: Partial<Equipment> = {};
    if (location.coordinates) updateData.currentLocation = location.coordinates;
    if (location.address) updateData.locationAddress = location.address;
    if (location.zone) updateData.locationZone = location.zone;

    // Add to movement history
    if (equipment.movementHistory) {
      equipment.movementHistory.push({
        timestamp: new Date(),
        location: location.coordinates ? JSON.parse(location.coordinates) : null,
        address: location.address,
        zone: location.zone,
        activity: 'location_update',
        operatorId: equipment.assignedOperatorId,
      });
      updateData.movementHistory = equipment.movementHistory;
    }

    const updatedEquipment = await this.updateEquipment(equipmentId, updateData);

    this.eventEmitter.emit('equipment.location_updated', {
      equipmentId,
      equipmentNumber: equipment.equipmentNumber,
      newLocation: location,
      timestamp: new Date(),
    });

    return updatedEquipment;
  }

  async updateStatus(equipmentId: string, status: EquipmentStatus): Promise<Equipment> {
    const equipment = await this.getEquipmentById(equipmentId);
    const previousStatus = equipment.status;

    const updatedEquipment = await this.updateEquipment(equipmentId, { status });

    this.eventEmitter.emit('equipment.status_changed', {
      equipmentId,
      equipmentNumber: equipment.equipmentNumber,
      previousStatus,
      newStatus: status,
      changedAt: new Date(),
    });

    return updatedEquipment;
  }

  async updateCondition(equipmentId: string, condition: EquipmentCondition): Promise<Equipment> {
    const equipment = await this.getEquipmentById(equipmentId);
    const previousCondition = equipment.condition;

    const updatedEquipment = await this.updateEquipment(equipmentId, { condition });

    this.eventEmitter.emit('equipment.condition_changed', {
      equipmentId,
      equipmentNumber: equipment.equipmentNumber,
      previousCondition,
      newCondition: condition,
      changedAt: new Date(),
    });

    return updatedEquipment;
  }

  private async generateEquipmentNumber(type: EquipmentType): Promise<string> {
    const typePrefix = {
      [EquipmentType.CRANE]: 'CR',
      [EquipmentType.REACH_STACKER]: 'RS',
      [EquipmentType.FORKLIFT]: 'FL',
      [EquipmentType.TERMINAL_TRACTOR]: 'TT',
      [EquipmentType.CHASSIS]: 'CH',
      [EquipmentType.TRUCK]: 'TR',
      [EquipmentType.RAIL_CRANE]: 'RC',
      [EquipmentType.SHIP_CRANE]: 'SC',
      [EquipmentType.MOBILE_CRANE]: 'MC',
      [EquipmentType.RTG]: 'RTG',
      [EquipmentType.RMG]: 'RMG',
      [EquipmentType.STRADDLE_CARRIER]: 'STC',
      [EquipmentType.CONTAINER_SPREADER]: 'CS',
      [EquipmentType.WEIGHBRIDGE]: 'WB',
      [EquipmentType.SCANNER]: 'SCN',
      [EquipmentType.GENERATOR]: 'GEN',
      [EquipmentType.LIGHTING_TOWER]: 'LT',
      [EquipmentType.COMMUNICATION_DEVICE]: 'COM',
    };

    const prefix = typePrefix[type] || 'EQ';
    const year = new Date().getFullYear();
    
    // Find the next sequence number for this type and year
    const lastEquipment = await this.equipmentRepository
      .createQueryBuilder('equipment')
      .where('equipment.equipmentNumber LIKE :pattern', { 
        pattern: `${prefix}-${year}-%` 
      })
      .orderBy('equipment.equipmentNumber', 'DESC')
      .getOne();

    let sequence = 1;
    if (lastEquipment) {
      const lastNumber = lastEquipment.equipmentNumber.split('-')[2];
      sequence = parseInt(lastNumber) + 1;
    }

    return `${prefix}-${year}-${sequence.toString().padStart(3, '0')}`;
  }

  async getEquipmentStatistics(filters?: {
    period?: number;
    departmentId?: string;
    equipmentType?: EquipmentType;
    locationZone?: string;
  }) {
    const whereClause = [];
    const params = [];

    if (filters?.period) {
      whereClause.push('commissioned_at >= NOW() - INTERVAL \\'' + filters.period + ' days\\'');
    }

    if (filters?.departmentId) {
      whereClause.push('department_id = $' + (params.length + 1));
      params.push(filters.departmentId);
    }

    if (filters?.equipmentType) {
      whereClause.push('type = $' + (params.length + 1));
      params.push(filters.equipmentType);
    }

    if (filters?.locationZone) {
      whereClause.push('location_zone = $' + (params.length + 1));
      params.push(filters.locationZone);
    }

    const whereSQL = whereClause.length > 0 ? 'WHERE ' + whereClause.join(' AND ') : '';

    const [
      totalEquipment,
      equipmentByStatus,
      equipmentByType,
      equipmentByCondition,
      utilizationRate,
    ] = await Promise.all([
      this.equipmentRepository.query(`
        SELECT COUNT(*) as count
        FROM equipment.equipment
        ${whereSQL}
      `, params),
      this.equipmentRepository.query(`
        SELECT status, COUNT(*) as count
        FROM equipment.equipment
        ${whereSQL}
        GROUP BY status
        ORDER BY count DESC
      `, params),
      this.equipmentRepository.query(`
        SELECT type, COUNT(*) as count
        FROM equipment.equipment
        ${whereSQL}
        GROUP BY type
        ORDER BY count DESC
      `, params),
      this.equipmentRepository.query(`
        SELECT condition, COUNT(*) as count
        FROM equipment.equipment
        ${whereSQL}
        GROUP BY condition
        ORDER BY count DESC
      `, params),
      this.equipmentRepository.query(`
        SELECT 
          COUNT(CASE WHEN status = 'in_use' THEN 1 END) * 100.0 / 
          COUNT(CASE WHEN status != 'out_of_service' AND decommissioned_at IS NULL THEN 1 END) as utilization_rate
        FROM equipment.equipment
        ${whereSQL}
      `, params),
    ]);

    return {
      totals: {
        totalEquipment: parseInt(totalEquipment[0].count),
        utilizationRate: parseFloat(utilizationRate[0].utilization_rate || 0),
      },
      breakdown: {
        byStatus: equipmentByStatus,
        byType: equipmentByType,
        byCondition: equipmentByCondition,
      },
    };
  }
}