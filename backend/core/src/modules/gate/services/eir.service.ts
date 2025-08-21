import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Eir, EirStatus, EirType, DamageLocation, DamageSeverity } from '../entities/eir.entity';

export interface CreateEirDto {
  type: EirType;
  containerId: string;
  gatePassId?: string;
  inspectionDate: Date;
  inspectionLocation: string;
  inspectorName: string;
  transportInfo: {
    truckNumber: string;
    trailerNumber?: string;
    driverName: string;
    driverLicense?: string;
    transportCompany?: string;
  };
  overallCondition: string;
  seals?: any;
  damages?: any[];
  cleanliness?: any;
  functionalElements?: any;
  measurements?: any;
  photos: any;
  inspectorNotes?: string;
}

export interface UpdateEirDto {
  status?: EirStatus;
  overallCondition?: string;
  seals?: any;
  damages?: any[];
  cleanliness?: any;
  functionalElements?: any;
  measurements?: any;
  photos?: any;
  inspectorNotes?: string;
  driverSignatureReceived?: boolean;
  driverSignature?: string;
  inspectorSignatureReceived?: boolean;
  inspectorSignature?: string;
  disputes?: any[];
  pdfUrl?: string;
  metadata?: Record<string, any>;
}

export interface FilterEirsDto {
  page?: number;
  limit?: number;
  status?: EirStatus;
  type?: EirType;
  containerId?: string;
  gatePassId?: string;
  inspectorId?: string;
  dateFrom?: Date;
  dateTo?: Date;
  search?: string;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
}

export interface CreateDamageDto {
  eirId: string;
  location: DamageLocation;
  description: string;
  severity: DamageSeverity;
  size?: {
    length: number;
    width: number;
    depth?: number;
    unit: 'mm' | 'cm' | 'm';
  };
  photos: string[];
  preExisting: boolean;
  repairRequired: boolean;
  estimatedCost?: number;
  notes?: string;
}

@Injectable()
export class EirService {
  private readonly logger = new Logger(EirService.name);

  constructor(
    @InjectRepository(Eir)
    private readonly eirRepository: Repository<Eir>,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Создание нового EIR
   */
  async create(createEirDto: CreateEirDto, inspectorId: string): Promise<Eir> {
    try {
      this.logger.log(`Creating EIR for container: ${createEirDto.containerId}`);

      // Генерация номера EIR
      const eirNumber = await this.generateEirNumber();

      const eir = this.eirRepository.create({
        ...createEirDto,
        eirNumber,
        inspectorId,
        status: EirStatus.DRAFT,
      });

      const savedEir = await this.eirRepository.save(eir);

      // Событие создания EIR
      this.eventEmitter.emit('eir.created', {
        eirId: savedEir.id,
        eirNumber: savedEir.eirNumber,
        type: savedEir.type,
        containerId: savedEir.containerId,
        inspectorId,
      });

      this.logger.log(`EIR created: ${savedEir.eirNumber}`);
      return this.findOne(savedEir.id);
    } catch (error) {
      this.logger.error(`Failed to create EIR: ${error.message}`);
      throw new BadRequestException('Failed to create EIR');
    }
  }

  /**
   * Получение всех EIR с фильтрацией
   */
  async findAll(filters: FilterEirsDto): Promise<{
    eirs: Eir[];
    total: number;
    page: number;
    limit: number;
  }> {
    const {
      page = 1,
      limit = 20,
      status,
      type,
      containerId,
      gatePassId,
      inspectorId,
      dateFrom,
      dateTo,
      search,
      sortBy = 'createdAt',
      sortOrder = 'DESC',
    } = filters;

    const query = this.eirRepository.createQueryBuilder('eir')
      .leftJoinAndSelect('eir.container', 'container')
      .leftJoinAndSelect('eir.gatePass', 'gatePass');

    // Применение фильтров
    if (status) {
      query.andWhere('eir.status = :status', { status });
    }

    if (type) {
      query.andWhere('eir.type = :type', { type });
    }

    if (containerId) {
      query.andWhere('eir.containerId = :containerId', { containerId });
    }

    if (gatePassId) {
      query.andWhere('eir.gatePassId = :gatePassId', { gatePassId });
    }

    if (inspectorId) {
      query.andWhere('eir.inspectorId = :inspectorId', { inspectorId });
    }

    if (dateFrom) {
      query.andWhere('eir.inspectionDate >= :dateFrom', { dateFrom });
    }

    if (dateTo) {
      query.andWhere('eir.inspectionDate <= :dateTo', { dateTo });
    }

    if (search) {
      query.andWhere(
        '(eir.eirNumber ILIKE :search OR eir.inspectorName ILIKE :search OR container.number ILIKE :search)',
        { search: `%${search}%` }
      );
    }

    // Сортировка
    query.orderBy(`eir.${sortBy}`, sortOrder);

    // Пагинация
    const skip = (page - 1) * limit;
    query.skip(skip).take(limit);

    const [eirs, total] = await query.getManyAndCount();

    return {
      eirs,
      total,
      page,
      limit,
    };
  }

  /**
   * Получение EIR по ID
   */
  async findOne(id: string): Promise<Eir> {
    const eir = await this.eirRepository.findOne({
      where: { id },
      relations: ['container', 'gatePass'],
    });

    if (!eir) {
      throw new NotFoundException(`EIR with ID ${id} not found`);
    }

    return eir;
  }

  /**
   * Получение EIR по номеру
   */
  async findByNumber(eirNumber: string): Promise<Eir> {
    const eir = await this.eirRepository.findOne({
      where: { eirNumber },
      relations: ['container', 'gatePass'],
    });

    if (!eir) {
      throw new NotFoundException(`EIR with number ${eirNumber} not found`);
    }

    return eir;
  }

  /**
   * Обновление EIR
   */
  async update(id: string, updateEirDto: UpdateEirDto, userId: string): Promise<Eir> {
    const eir = await this.findOne(id);

    // Проверка возможности редактирования
    if (eir.status === EirStatus.SIGNED) {
      throw new BadRequestException('Cannot update signed EIR');
    }

    const oldStatus = eir.status;
    Object.assign(eir, updateEirDto);

    const updatedEir = await this.eirRepository.save(eir);

    // Событие при изменении статуса
    if (updateEirDto.status && updateEirDto.status !== oldStatus) {
      this.eventEmitter.emit('eir.status.changed', {
        eirId: id,
        eirNumber: eir.eirNumber,
        oldStatus,
        newStatus: updateEirDto.status,
        userId,
      });
    }

    this.eventEmitter.emit('eir.updated', {
      eirId: id,
      eirNumber: eir.eirNumber,
      userId,
      changes: updateEirDto,
    });

    this.logger.log(`EIR updated: ${eir.eirNumber}`);
    return this.findOne(id);
  }

  /**
   * Добавление повреждения
   */
  async addDamage(damageDto: CreateDamageDto, userId: string): Promise<Eir> {
    const eir = await this.findOne(damageDto.eirId);

    if (eir.status === EirStatus.SIGNED) {
      throw new BadRequestException('Cannot add damage to signed EIR');
    }

    // Создание нового повреждения
    const damageId = this.generateDamageId();
    const damage = {
      id: damageId,
      location: damageDto.location,
      description: damageDto.description,
      severity: damageDto.severity,
      size: damageDto.size,
      photos: damageDto.photos,
      preExisting: damageDto.preExisting,
      repairRequired: damageDto.repairRequired,
      estimatedCost: damageDto.estimatedCost,
      notes: damageDto.notes,
    };

    // Добавление повреждения к существующему массиву
    const damages = eir.damages || [];
    damages.push(damage);

    await this.eirRepository.update(eir.id, { damages });

    this.eventEmitter.emit('eir.damage.added', {
      eirId: eir.id,
      eirNumber: eir.eirNumber,
      damageId,
      severity: damage.severity,
      userId,
    });

    this.logger.log(`Damage added to EIR: ${eir.eirNumber}, damage ID: ${damageId}`);
    return this.findOne(eir.id);
  }

  /**
   * Удаление повреждения
   */
  async removeDamage(eirId: string, damageId: string, userId: string): Promise<Eir> {
    const eir = await this.findOne(eirId);

    if (eir.status === EirStatus.SIGNED) {
      throw new BadRequestException('Cannot remove damage from signed EIR');
    }

    const damages = eir.damages || [];
    const updatedDamages = damages.filter(damage => damage.id !== damageId);

    if (damages.length === updatedDamages.length) {
      throw new NotFoundException(`Damage with ID ${damageId} not found`);
    }

    await this.eirRepository.update(eirId, { damages: updatedDamages });

    this.eventEmitter.emit('eir.damage.removed', {
      eirId,
      eirNumber: eir.eirNumber,
      damageId,
      userId,
    });

    this.logger.log(`Damage removed from EIR: ${eir.eirNumber}, damage ID: ${damageId}`);
    return this.findOne(eirId);
  }

  /**
   * Завершение осмотра
   */
  async completeInspection(id: string, userId: string): Promise<Eir> {
    const eir = await this.findOne(id);

    if (eir.status !== EirStatus.DRAFT) {
      throw new BadRequestException('Only draft EIR can be completed');
    }

    // Валидация обязательных данных
    this.validateEirCompletion(eir);

    const updateData: UpdateEirDto = {
      status: EirStatus.COMPLETED,
    };

    const result = await this.update(id, updateData, userId);

    this.eventEmitter.emit('eir.inspection.completed', {
      eirId: id,
      eirNumber: eir.eirNumber,
      userId,
    });

    this.logger.log(`EIR inspection completed: ${eir.eirNumber}`);
    return result;
  }

  /**
   * Подписание EIR водителем
   */
  async signByDriver(id: string, signature: string, userId: string): Promise<Eir> {
    const eir = await this.findOne(id);

    if (eir.status !== EirStatus.COMPLETED) {
      throw new BadRequestException('EIR must be completed before driver signing');
    }

    const updateData: UpdateEirDto = {
      driverSignatureReceived: true,
      driverSignature: signature,
      driverSignedAt: new Date(),
    };

    // Если и инспектор подписал, то EIR подписан полностью
    if (eir.inspectorSignatureReceived) {
      updateData.status = EirStatus.SIGNED;
    }

    const result = await this.update(id, updateData, userId);

    this.eventEmitter.emit('eir.signed.driver', {
      eirId: id,
      eirNumber: eir.eirNumber,
      userId,
    });

    this.logger.log(`EIR signed by driver: ${eir.eirNumber}`);
    return result;
  }

  /**
   * Подписание EIR инспектором
   */
  async signByInspector(id: string, signature: string, userId: string): Promise<Eir> {
    const eir = await this.findOne(id);

    if (eir.status !== EirStatus.COMPLETED) {
      throw new BadRequestException('EIR must be completed before inspector signing');
    }

    const updateData: UpdateEirDto = {
      inspectorSignatureReceived: true,
      inspectorSignature: signature,
    };

    // Если и водитель подписал, то EIR подписан полностью
    if (eir.driverSignatureReceived) {
      updateData.status = EirStatus.SIGNED;
    }

    const result = await this.update(id, updateData, userId);

    this.eventEmitter.emit('eir.signed.inspector', {
      eirId: id,
      eirNumber: eir.eirNumber,
      userId,
    });

    this.logger.log(`EIR signed by inspector: ${eir.eirNumber}`);
    return result;
  }

  /**
   * Создание спора
   */
  async createDispute(id: string, dispute: any, userId: string): Promise<Eir> {
    const eir = await this.findOne(id);

    const disputeId = this.generateDisputeId();
    const newDispute = {
      id: disputeId,
      ...dispute,
      status: 'open',
      createdAt: new Date(),
    };

    const disputes = eir.disputes || [];
    disputes.push(newDispute);

    const updateData: UpdateEirDto = {
      status: EirStatus.DISPUTED,
      disputes,
    };

    const result = await this.update(id, updateData, userId);

    this.eventEmitter.emit('eir.dispute.created', {
      eirId: id,
      eirNumber: eir.eirNumber,
      disputeId,
      disputeType: dispute.type,
      userId,
    });

    this.logger.log(`Dispute created for EIR: ${eir.eirNumber}, dispute ID: ${disputeId}`);
    return result;
  }

  /**
   * Отмена EIR
   */
  async cancel(id: string, reason: string, userId: string): Promise<Eir> {
    const eir = await this.findOne(id);

    if (eir.status === EirStatus.SIGNED) {
      throw new BadRequestException('Cannot cancel signed EIR');
    }

    const updateData: UpdateEirDto = {
      status: EirStatus.CANCELLED,
      metadata: {
        ...eir.metadata,
        cancellationReason: reason,
        cancelledBy: userId,
        cancelledAt: new Date(),
      },
    };

    const result = await this.update(id, updateData, userId);

    this.eventEmitter.emit('eir.cancelled', {
      eirId: id,
      eirNumber: eir.eirNumber,
      reason,
      userId,
    });

    this.logger.log(`EIR cancelled: ${eir.eirNumber}`);
    return result;
  }

  /**
   * Генерация номера EIR
   */
  private async generateEirNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `EIR-${year}-`;

    const lastEir = await this.eirRepository
      .createQueryBuilder('eir')
      .where('eir.eirNumber LIKE :prefix', { prefix: `${prefix}%` })
      .orderBy('eir.eirNumber', 'DESC')
      .getOne();

    let sequence = 1;
    if (lastEir) {
      const lastSequence = parseInt(lastEir.eirNumber.split('-')[2], 10);
      sequence = lastSequence + 1;
    }

    return `${prefix}${sequence.toString().padStart(6, '0')}`;
  }

  /**
   * Генерация ID повреждения
   */
  private generateDamageId(): string {
    return `DMG-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Генерация ID спора
   */
  private generateDisputeId(): string {
    return `DSP-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Валидация завершения EIR
   */
  private validateEirCompletion(eir: Eir): void {
    if (!eir.overallCondition) {
      throw new BadRequestException('Overall condition is required');
    }

    if (!eir.photos || !eir.photos.general) {
      throw new BadRequestException('General photos are required');
    }

    if (!eir.photos.general.front || !eir.photos.general.rear) {
      throw new BadRequestException('Front and rear photos are required');
    }

    if (!eir.inspectorName) {
      throw new BadRequestException('Inspector name is required');
    }

    if (!eir.transportInfo || !eir.transportInfo.truckNumber || !eir.transportInfo.driverName) {
      throw new BadRequestException('Transport information is required');
    }
  }

  /**
   * Получение статистики EIR
   */
  async getStatistics(): Promise<{
    total: number;
    byStatus: Record<EirStatus, number>;
    byType: Record<EirType, number>;
    todayInspections: number;
    pendingSignatures: number;
    disputedCount: number;
  }> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [total, statusStats, typeStats, todayInspections, pendingSignatures, disputedCount] = await Promise.all([
      this.eirRepository.count(),
      this.eirRepository
        .createQueryBuilder('eir')
        .select('eir.status', 'status')
        .addSelect('COUNT(*)', 'count')
        .groupBy('eir.status')
        .getRawMany(),
      this.eirRepository
        .createQueryBuilder('eir')
        .select('eir.type', 'type')
        .addSelect('COUNT(*)', 'count')
        .groupBy('eir.type')
        .getRawMany(),
      this.eirRepository.count({
        where: {
          inspectionDate: {
            gte: today,
            lt: tomorrow,
          } as any,
        },
      }),
      this.eirRepository.count({
        where: {
          status: EirStatus.COMPLETED,
        },
      }),
      this.eirRepository.count({
        where: {
          status: EirStatus.DISPUTED,
        },
      }),
    ]);

    return {
      total,
      byStatus: this.mapStatsToEnum(statusStats, EirStatus),
      byType: this.mapStatsToEnum(typeStats, EirType),
      todayInspections,
      pendingSignatures,
      disputedCount,
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
      const key = stat.status || stat.type;
      if (key in result) {
        result[key as keyof T] = parseInt(stat.count, 10);
      }
    });

    return result;
  }
}