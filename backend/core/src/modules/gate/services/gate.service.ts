import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindManyOptions } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { GatePass, GatePassStatus, GatePassType, GateDirection } from '../entities/gate-pass.entity';
import { GateTransaction } from '../entities/gate-transaction.entity';
import { AccessControl } from '../entities/access-control.entity';

export interface CreateGatePassDto {
  type: GatePassType;
  direction: GateDirection;
  orderId?: string;
  containerId?: string;
  containerNumber?: string;
  truckNumber: string;
  trailerNumber?: string;
  driverName: string;
  driverLicense?: string;
  driverPhone?: string;
  transportCompany?: string;
  companyContact?: string;
  companyPhone?: string;
  validFrom: Date;
  validUntil: Date;
  purpose?: string;
  specialInstructions?: string;
  requiresEscort?: boolean;
  timeRestrictions?: any;
  zoneRestrictions?: any;
}

export interface UpdateGatePassDto {
  status?: GatePassStatus;
  actualEntryTime?: Date;
  actualExitTime?: Date;
  entryGate?: string;
  exitGate?: string;
  entryProcessedBy?: string;
  exitProcessedBy?: string;
  photos?: any;
  violations?: any[];
  cancellationReason?: string;
  metadata?: Record<string, any>;
}

export interface FilterGatePassesDto {
  page?: number;
  limit?: number;
  status?: GatePassStatus;
  type?: GatePassType;
  direction?: GateDirection;
  dateFrom?: Date;
  dateTo?: Date;
  truckNumber?: string;
  containerNumber?: string;
  search?: string;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
}

export interface CreateGateTransactionDto {
  gatePassId: string;
  type: 'entry' | 'exit';
  gateId: string;
  processedBy: string;
  vehicleInfo: any;
  documents?: any;
  photos?: any;
  notes?: string;
}

@Injectable()
export class GateService {
  private readonly logger = new Logger(GateService.name);

  constructor(
    @InjectRepository(GatePass)
    private readonly gatePassRepository: Repository<GatePass>,
    @InjectRepository(GateTransaction)
    private readonly gateTransactionRepository: Repository<GateTransaction>,
    @InjectRepository(AccessControl)
    private readonly accessControlRepository: Repository<AccessControl>,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Создание нового пропуска
   */
  async createGatePass(createDto: CreateGatePassDto, issuedBy: string): Promise<GatePass> {
    try {
      this.logger.log(`Creating gate pass for truck: ${createDto.truckNumber}`);

      // Генерация номера пропуска
      const passNumber = await this.generatePassNumber();

      const gatePass = this.gatePassRepository.create({
        ...createDto,
        passNumber,
        issuedBy,
        status: GatePassStatus.ACTIVE,
      });

      // Валидация временных ограничений
      if (createDto.validFrom >= createDto.validUntil) {
        throw new BadRequestException('Valid from date must be before valid until date');
      }

      const savedPass = await this.gatePassRepository.save(gatePass);

      // Создание записи контроля доступа
      await this.createAccessControlEntry(savedPass.id, issuedBy);

      // Событие создания пропуска
      this.eventEmitter.emit('gate.pass.created', {
        gatePassId: savedPass.id,
        passNumber: savedPass.passNumber,
        type: savedPass.type,
        truckNumber: savedPass.truckNumber,
        issuedBy,
      });

      this.logger.log(`Gate pass created: ${savedPass.passNumber}`);
      return this.findGatePassById(savedPass.id);
    } catch (error) {
      this.logger.error(`Failed to create gate pass: ${error.message}`);
      throw new BadRequestException('Failed to create gate pass');
    }
  }

  /**
   * Получение всех пропусков с фильтрацией
   */
  async findAllGatePasses(filters: FilterGatePassesDto): Promise<{
    gatePasses: GatePass[];
    total: number;
    page: number;
    limit: number;
  }> {
    const {
      page = 1,
      limit = 20,
      status,
      type,
      direction,
      dateFrom,
      dateTo,
      truckNumber,
      containerNumber,
      search,
      sortBy = 'createdAt',
      sortOrder = 'DESC',
    } = filters;

    const query = this.gatePassRepository.createQueryBuilder('pass')
      .leftJoinAndSelect('pass.order', 'order')
      .leftJoinAndSelect('pass.container', 'container');

    // Применение фильтров
    if (status) {
      query.andWhere('pass.status = :status', { status });
    }

    if (type) {
      query.andWhere('pass.type = :type', { type });
    }

    if (direction) {
      query.andWhere('pass.direction = :direction', { direction });
    }

    if (dateFrom) {
      query.andWhere('pass.validFrom >= :dateFrom', { dateFrom });
    }

    if (dateTo) {
      query.andWhere('pass.validUntil <= :dateTo', { dateTo });
    }

    if (truckNumber) {
      query.andWhere('pass.truckNumber ILIKE :truckNumber', { truckNumber: `%${truckNumber}%` });
    }

    if (containerNumber) {
      query.andWhere('(pass.containerNumber ILIKE :containerNumber OR container.number ILIKE :containerNumber)', 
        { containerNumber: `%${containerNumber}%` });
    }

    if (search) {
      query.andWhere(
        '(pass.passNumber ILIKE :search OR pass.truckNumber ILIKE :search OR pass.driverName ILIKE :search OR pass.transportCompany ILIKE :search)',
        { search: `%${search}%` }
      );
    }

    // Сортировка
    query.orderBy(`pass.${sortBy}`, sortOrder);

    // Пагинация
    const skip = (page - 1) * limit;
    query.skip(skip).take(limit);

    const [gatePasses, total] = await query.getManyAndCount();

    return {
      gatePasses,
      total,
      page,
      limit,
    };
  }

  /**
   * Получение пропуска по ID
   */
  async findGatePassById(id: string): Promise<GatePass> {
    const gatePass = await this.gatePassRepository.findOne({
      where: { id },
      relations: ['order', 'container'],
    });

    if (!gatePass) {
      throw new NotFoundException(`Gate pass with ID ${id} not found`);
    }

    return gatePass;
  }

  /**
   * Получение пропуска по номеру
   */
  async findGatePassByNumber(passNumber: string): Promise<GatePass> {
    const gatePass = await this.gatePassRepository.findOne({
      where: { passNumber },
      relations: ['order', 'container'],
    });

    if (!gatePass) {
      throw new NotFoundException(`Gate pass with number ${passNumber} not found`);
    }

    return gatePass;
  }

  /**
   * Обновление пропуска
   */
  async updateGatePass(id: string, updateDto: UpdateGatePassDto, userId: string): Promise<GatePass> {
    const gatePass = await this.findGatePassById(id);

    // Проверка возможности обновления
    if (gatePass.status === GatePassStatus.CANCELLED) {
      throw new BadRequestException('Cannot update cancelled gate pass');
    }

    const oldStatus = gatePass.status;
    Object.assign(gatePass, updateDto);

    const updatedPass = await this.gatePassRepository.save(gatePass);

    // Событие при изменении статуса
    if (updateDto.status && updateDto.status !== oldStatus) {
      this.eventEmitter.emit('gate.pass.status.changed', {
        gatePassId: id,
        passNumber: gatePass.passNumber,
        oldStatus,
        newStatus: updateDto.status,
        userId,
      });
    }

    this.eventEmitter.emit('gate.pass.updated', {
      gatePassId: id,
      passNumber: gatePass.passNumber,
      userId,
      changes: updateDto,
    });

    this.logger.log(`Gate pass updated: ${gatePass.passNumber}`);
    return this.findGatePassById(id);
  }

  /**
   * Обработка въезда
   */
  async processEntry(gatePassId: string, entryData: CreateGateTransactionDto, userId: string): Promise<GatePass> {
    const gatePass = await this.findGatePassById(gatePassId);

    // Валидация возможности въезда
    this.validateEntry(gatePass);

    // Создание транзакции въезда
    const transaction = await this.createGateTransaction({
      ...entryData,
      gatePassId,
      type: 'entry',
      processedBy: userId,
    });

    // Обновление пропуска
    const updateData: UpdateGatePassDto = {
      actualEntryTime: new Date(),
      entryGate: entryData.gateId,
      entryProcessedBy: userId,
      status: GatePassStatus.USED,
    };

    await this.updateGatePass(gatePassId, updateData, userId);

    this.eventEmitter.emit('gate.entry.processed', {
      gatePassId,
      passNumber: gatePass.passNumber,
      transactionId: transaction.id,
      userId,
    });

    this.logger.log(`Entry processed for gate pass: ${gatePass.passNumber}`);
    return this.findGatePassById(gatePassId);
  }

  /**
   * Обработка выезда
   */
  async processExit(gatePassId: string, exitData: CreateGateTransactionDto, userId: string): Promise<GatePass> {
    const gatePass = await this.findGatePassById(gatePassId);

    // Валидация возможности выезда
    this.validateExit(gatePass);

    // Создание транзакции выезда
    const transaction = await this.createGateTransaction({
      ...exitData,
      gatePassId,
      type: 'exit',
      processedBy: userId,
    });

    // Обновление пропуска
    const updateData: UpdateGatePassDto = {
      actualExitTime: new Date(),
      exitGate: exitData.gateId,
      exitProcessedBy: userId,
    };

    await this.updateGatePass(gatePassId, updateData, userId);

    this.eventEmitter.emit('gate.exit.processed', {
      gatePassId,
      passNumber: gatePass.passNumber,
      transactionId: transaction.id,
      userId,
    });

    this.logger.log(`Exit processed for gate pass: ${gatePass.passNumber}`);
    return this.findGatePassById(gatePassId);
  }

  /**
   * Отмена пропуска
   */
  async cancelGatePass(id: string, reason: string, userId: string): Promise<GatePass> {
    const gatePass = await this.findGatePassById(id);

    if (gatePass.status === GatePassStatus.USED) {
      throw new BadRequestException('Cannot cancel used gate pass');
    }

    const updateData: UpdateGatePassDto = {
      status: GatePassStatus.CANCELLED,
      cancellationReason: reason,
    };

    const result = await this.updateGatePass(id, updateData, userId);

    this.eventEmitter.emit('gate.pass.cancelled', {
      gatePassId: id,
      passNumber: gatePass.passNumber,
      reason,
      userId,
    });

    this.logger.log(`Gate pass cancelled: ${gatePass.passNumber}`);
    return result;
  }

  /**
   * Создание транзакции ворот
   */
  private async createGateTransaction(createDto: CreateGateTransactionDto): Promise<GateTransaction> {
    const transaction = this.gateTransactionRepository.create({
      ...createDto,
      timestamp: new Date(),
    });

    return await this.gateTransactionRepository.save(transaction);
  }

  /**
   * Создание записи контроля доступа
   */
  private async createAccessControlEntry(gatePassId: string, createdBy: string): Promise<void> {
    const accessControl = this.accessControlRepository.create({
      gatePassId,
      createdBy,
      status: 'active',
      validFrom: new Date(),
    });

    await this.accessControlRepository.save(accessControl);
  }

  /**
   * Генерация номера пропуска
   */
  private async generatePassNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `GP-${year}-`;

    const lastPass = await this.gatePassRepository
      .createQueryBuilder('pass')
      .where('pass.passNumber LIKE :prefix', { prefix: `${prefix}%` })
      .orderBy('pass.passNumber', 'DESC')
      .getOne();

    let sequence = 1;
    if (lastPass) {
      const lastSequence = parseInt(lastPass.passNumber.split('-')[2], 10);
      sequence = lastSequence + 1;
    }

    return `${prefix}${sequence.toString().padStart(6, '0')}`;
  }

  /**
   * Валидация возможности въезда
   */
  private validateEntry(gatePass: GatePass): void {
    if (gatePass.status !== GatePassStatus.ACTIVE) {
      throw new BadRequestException('Gate pass is not active');
    }

    if (gatePass.direction === GateDirection.OUT) {
      throw new BadRequestException('Gate pass is for exit only');
    }

    const now = new Date();
    if (now < gatePass.validFrom || now > gatePass.validUntil) {
      throw new BadRequestException('Gate pass is not valid at this time');
    }

    if (gatePass.actualEntryTime) {
      throw new BadRequestException('Vehicle has already entered');
    }
  }

  /**
   * Валидация возможности выезда
   */
  private validateExit(gatePass: GatePass): void {
    if (gatePass.status === GatePassStatus.CANCELLED) {
      throw new BadRequestException('Gate pass is cancelled');
    }

    if (gatePass.direction === GateDirection.IN) {
      throw new BadRequestException('Gate pass is for entry only');
    }

    if (!gatePass.actualEntryTime && gatePass.direction === GateDirection.BOTH) {
      throw new BadRequestException('Vehicle must enter before exit');
    }

    if (gatePass.actualExitTime) {
      throw new BadRequestException('Vehicle has already exited');
    }
  }

  /**
   * Получение статистики пропусков
   */
  async getStatistics(): Promise<{
    total: number;
    byStatus: Record<GatePassStatus, number>;
    byType: Record<GatePassType, number>;
    byDirection: Record<GateDirection, number>;
    todayEntries: number;
    todayExits: number;
  }> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [total, statusStats, typeStats, directionStats, todayEntries, todayExits] = await Promise.all([
      this.gatePassRepository.count(),
      this.gatePassRepository
        .createQueryBuilder('pass')
        .select('pass.status', 'status')
        .addSelect('COUNT(*)', 'count')
        .groupBy('pass.status')
        .getRawMany(),
      this.gatePassRepository
        .createQueryBuilder('pass')
        .select('pass.type', 'type')
        .addSelect('COUNT(*)', 'count')
        .groupBy('pass.type')
        .getRawMany(),
      this.gatePassRepository
        .createQueryBuilder('pass')
        .select('pass.direction', 'direction')
        .addSelect('COUNT(*)', 'count')
        .groupBy('pass.direction')
        .getRawMany(),
      this.gatePassRepository.count({
        where: {
          actualEntryTime: {
            gte: today,
            lt: tomorrow,
          } as any,
        },
      }),
      this.gatePassRepository.count({
        where: {
          actualExitTime: {
            gte: today,
            lt: tomorrow,
          } as any,
        },
      }),
    ]);

    return {
      total,
      byStatus: this.mapStatsToEnum(statusStats, GatePassStatus),
      byType: this.mapStatsToEnum(typeStats, GatePassType),
      byDirection: this.mapStatsToEnum(directionStats, GateDirection),
      todayEntries,
      todayExits,
    };
  }

  /**
   * Преобразование статистики в enum объект
   */
  private mapStatsToEnum<T>(stats: any[], enumObject: T): Record<keyof T, number> {
    const result = {} as Record<keyof T, number>;

    // Инициализируем нулями
    Object.values(enumObject).forEach((value) => {
      result[value as keyof T] = 0;
    });

    // Заполняем данными
    stats.forEach((stat) => {
      const key = stat.status || stat.type || stat.direction;
      if (key in result) {
        result[key as keyof T] = parseInt(stat.count, 10);
      }
    });

    return result;
  }
}