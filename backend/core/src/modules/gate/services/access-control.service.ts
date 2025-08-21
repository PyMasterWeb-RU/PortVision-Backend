import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AccessControl } from '../entities/access-control.entity';

export interface CreateAccessControlDto {
  gatePassId?: string;
  type: 'gate_pass' | 'visitor' | 'employee' | 'contractor' | 'emergency';
  subjectId: string;
  subjectType: 'person' | 'vehicle' | 'equipment';
  status: 'active' | 'suspended' | 'expired' | 'revoked';
  accessLevel: 'basic' | 'restricted' | 'full' | 'emergency';
  validFrom: Date;
  validUntil?: Date;
  allowedZones?: string[];
  restrictedZones?: string[];
  allowedActions?: string[];
  restrictedActions?: string[];
  timeRestrictions?: {
    allowedHours?: { from: string; to: string }[];
    excludedDays?: string[];
    maxDuration?: number;
  };
  approvedBy: string;
  reason?: string;
  conditions?: string[];
  metadata?: Record<string, any>;
}

export interface UpdateAccessControlDto {
  status?: 'active' | 'suspended' | 'expired' | 'revoked';
  accessLevel?: 'basic' | 'restricted' | 'full' | 'emergency';
  validUntil?: Date;
  allowedZones?: string[];
  restrictedZones?: string[];
  allowedActions?: string[];
  restrictedActions?: string[];
  timeRestrictions?: any;
  lastAccessTime?: Date;
  lastAccessLocation?: string;
  suspensionReason?: string;
  revocationReason?: string;
  conditions?: string[];
  metadata?: Record<string, any>;
}

export interface FilterAccessControlDto {
  page?: number;
  limit?: number;
  type?: string;
  subjectType?: string;
  status?: string;
  accessLevel?: string;
  validFrom?: Date;
  validUntil?: Date;
  lastAccessFrom?: Date;
  lastAccessTo?: Date;
  subjectId?: string;
  gatePassId?: string;
  search?: string;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
}

export interface AccessCheckDto {
  subjectId: string;
  subjectType: 'person' | 'vehicle' | 'equipment';
  requestedAction: string;
  requestedZone: string;
  gateId?: string;
  metadata?: Record<string, any>;
}

export interface AccessCheckResult {
  allowed: boolean;
  accessControlId?: string;
  reason?: string;
  restrictions?: string[];
  warnings?: string[];
  expiresAt?: Date;
  accessLevel?: string;
}

@Injectable()
export class AccessControlService {
  private readonly logger = new Logger(AccessControlService.name);

  constructor(
    @InjectRepository(AccessControl)
    private readonly accessControlRepository: Repository<AccessControl>,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Создание записи контроля доступа
   */
  async create(createDto: CreateAccessControlDto, createdBy: string): Promise<AccessControl> {
    try {
      this.logger.log(`Creating access control for subject: ${createDto.subjectId}`);

      // Валидация дат
      if (createDto.validUntil && createDto.validFrom >= createDto.validUntil) {
        throw new BadRequestException('Valid from date must be before valid until date');
      }

      const accessControl = this.accessControlRepository.create({
        ...createDto,
        createdBy,
      });

      const savedRecord = await this.accessControlRepository.save(accessControl);

      // Событие создания записи контроля доступа
      this.eventEmitter.emit('access.control.created', {
        accessControlId: savedRecord.id,
        subjectId: createDto.subjectId,
        subjectType: createDto.subjectType,
        type: createDto.type,
        accessLevel: createDto.accessLevel,
        createdBy,
      });

      this.logger.log(`Access control created: ${savedRecord.id}`);
      return this.findOne(savedRecord.id);
    } catch (error) {
      this.logger.error(`Failed to create access control: ${error.message}`);
      throw new BadRequestException('Failed to create access control');
    }
  }

  /**
   * Получение всех записей контроля доступа с фильтрацией
   */
  async findAll(filters: FilterAccessControlDto): Promise<{
    records: AccessControl[];
    total: number;
    page: number;
    limit: number;
  }> {
    const {
      page = 1,
      limit = 20,
      type,
      subjectType,
      status,
      accessLevel,
      validFrom,
      validUntil,
      lastAccessFrom,
      lastAccessTo,
      subjectId,
      gatePassId,
      search,
      sortBy = 'createdAt',
      sortOrder = 'DESC',
    } = filters;

    const query = this.accessControlRepository.createQueryBuilder('ac');

    // Применение фильтров
    if (type) {
      query.andWhere('ac.type = :type', { type });
    }

    if (subjectType) {
      query.andWhere('ac.subjectType = :subjectType', { subjectType });
    }

    if (status) {
      query.andWhere('ac.status = :status', { status });
    }

    if (accessLevel) {
      query.andWhere('ac.accessLevel = :accessLevel', { accessLevel });
    }

    if (validFrom) {
      query.andWhere('ac.validFrom >= :validFrom', { validFrom });
    }

    if (validUntil) {
      query.andWhere('ac.validUntil <= :validUntil', { validUntil });
    }

    if (lastAccessFrom) {
      query.andWhere('ac.lastAccessTime >= :lastAccessFrom', { lastAccessFrom });
    }

    if (lastAccessTo) {
      query.andWhere('ac.lastAccessTime <= :lastAccessTo', { lastAccessTo });
    }

    if (subjectId) {
      query.andWhere('ac.subjectId = :subjectId', { subjectId });
    }

    if (gatePassId) {
      query.andWhere('ac.gatePassId = :gatePassId', { gatePassId });
    }

    if (search) {
      query.andWhere(
        '(ac.subjectId ILIKE :search OR ac.reason ILIKE :search OR ac.suspensionReason ILIKE :search)',
        { search: `%${search}%` }
      );
    }

    // Сортировка
    query.orderBy(`ac.${sortBy}`, sortOrder);

    // Пагинация
    const skip = (page - 1) * limit;
    query.skip(skip).take(limit);

    const [records, total] = await query.getManyAndCount();

    return {
      records,
      total,
      page,
      limit,
    };
  }

  /**
   * Получение записи контроля доступа по ID
   */
  async findOne(id: string): Promise<AccessControl> {
    const accessControl = await this.accessControlRepository.findOne({
      where: { id },
    });

    if (!accessControl) {
      throw new NotFoundException(`Access control record with ID ${id} not found`);
    }

    return accessControl;
  }

  /**
   * Получение активных записей контроля доступа для субъекта
   */
  async findActiveBySubject(subjectId: string, subjectType: string): Promise<AccessControl[]> {
    const now = new Date();
    
    return await this.accessControlRepository.find({
      where: {
        subjectId,
        subjectType,
        status: 'active',
        validFrom: {
          lte: now,
        } as any,
        validUntil: [
          {
            gte: now,
          } as any,
          null,
        ],
      },
      order: {
        accessLevel: 'DESC', // Сначала более высокие уровни доступа
        createdAt: 'DESC',
      },
    });
  }

  /**
   * Обновление записи контроля доступа
   */
  async update(id: string, updateDto: UpdateAccessControlDto, userId: string): Promise<AccessControl> {
    const accessControl = await this.findOne(id);
    const oldStatus = accessControl.status;

    Object.assign(accessControl, updateDto);
    accessControl.updatedBy = userId;

    const updatedRecord = await this.accessControlRepository.save(accessControl);

    // Событие при изменении статуса
    if (updateDto.status && updateDto.status !== oldStatus) {
      this.eventEmitter.emit('access.control.status.changed', {
        accessControlId: id,
        subjectId: accessControl.subjectId,
        oldStatus,
        newStatus: updateDto.status,
        userId,
      });
    }

    this.eventEmitter.emit('access.control.updated', {
      accessControlId: id,
      subjectId: accessControl.subjectId,
      userId,
      changes: updateDto,
    });

    this.logger.log(`Access control updated: ${id}`);
    return this.findOne(id);
  }

  /**
   * Проверка доступа
   */
  async checkAccess(checkDto: AccessCheckDto): Promise<AccessCheckResult> {
    try {
      this.logger.log(`Checking access for subject: ${checkDto.subjectId}, action: ${checkDto.requestedAction}, zone: ${checkDto.requestedZone}`);

      // Получение активных записей контроля доступа
      const activeRecords = await this.findActiveBySubject(checkDto.subjectId, checkDto.subjectType);

      if (activeRecords.length === 0) {
        return {
          allowed: false,
          reason: 'No active access control records found',
        };
      }

      // Проверка каждой записи (берем первую подходящую)
      for (const record of activeRecords) {
        const checkResult = await this.checkSingleRecord(record, checkDto);
        
        if (checkResult.allowed) {
          // Обновляем время последнего доступа
          await this.updateLastAccess(record.id, checkDto.requestedZone);
          
          // Событие успешного доступа
          this.eventEmitter.emit('access.granted', {
            accessControlId: record.id,
            subjectId: checkDto.subjectId,
            action: checkDto.requestedAction,
            zone: checkDto.requestedZone,
            gateId: checkDto.gateId,
          });

          return checkResult;
        }
      }

      // Событие отказа в доступе
      this.eventEmitter.emit('access.denied', {
        subjectId: checkDto.subjectId,
        subjectType: checkDto.subjectType,
        action: checkDto.requestedAction,
        zone: checkDto.requestedZone,
        gateId: checkDto.gateId,
        reason: 'Access denied by security policy',
      });

      return {
        allowed: false,
        reason: 'Access denied by security policy',
      };

    } catch (error) {
      this.logger.error(`Access check failed: ${error.message}`);
      return {
        allowed: false,
        reason: 'Access check failed due to system error',
      };
    }
  }

  /**
   * Приостановка доступа
   */
  async suspend(id: string, reason: string, userId: string): Promise<AccessControl> {
    const updateData: UpdateAccessControlDto = {
      status: 'suspended',
      suspensionReason: reason,
    };

    const result = await this.update(id, updateData, userId);

    this.eventEmitter.emit('access.control.suspended', {
      accessControlId: id,
      subjectId: result.subjectId,
      reason,
      userId,
    });

    this.logger.log(`Access control suspended: ${id}`);
    return result;
  }

  /**
   * Восстановление доступа
   */
  async restore(id: string, userId: string): Promise<AccessControl> {
    const accessControl = await this.findOne(id);

    if (accessControl.status !== 'suspended') {
      throw new BadRequestException('Can only restore suspended access');
    }

    const updateData: UpdateAccessControlDto = {
      status: 'active',
      suspensionReason: null,
    };

    const result = await this.update(id, updateData, userId);

    this.eventEmitter.emit('access.control.restored', {
      accessControlId: id,
      subjectId: result.subjectId,
      userId,
    });

    this.logger.log(`Access control restored: ${id}`);
    return result;
  }

  /**
   * Отзыв доступа
   */
  async revoke(id: string, reason: string, userId: string): Promise<AccessControl> {
    const updateData: UpdateAccessControlDto = {
      status: 'revoked',
      revocationReason: reason,
    };

    const result = await this.update(id, updateData, userId);

    this.eventEmitter.emit('access.control.revoked', {
      accessControlId: id,
      subjectId: result.subjectId,
      reason,
      userId,
    });

    this.logger.log(`Access control revoked: ${id}`);
    return result;
  }

  /**
   * Проверка одной записи контроля доступа
   */
  private async checkSingleRecord(record: AccessControl, checkDto: AccessCheckDto): Promise<AccessCheckResult> {
    const now = new Date();
    const warnings: string[] = [];
    const restrictions: string[] = [];

    // Проверка статуса
    if (record.status !== 'active') {
      return {
        allowed: false,
        reason: `Access is ${record.status}`,
      };
    }

    // Проверка временных рамок
    if (record.validUntil && now > record.validUntil) {
      return {
        allowed: false,
        reason: 'Access expired',
      };
    }

    // Проверка зон
    if (record.restrictedZones?.includes(checkDto.requestedZone)) {
      return {
        allowed: false,
        reason: 'Zone is restricted',
      };
    }

    if (record.allowedZones?.length > 0 && !record.allowedZones.includes(checkDto.requestedZone)) {
      return {
        allowed: false,
        reason: 'Zone is not in allowed zones list',
      };
    }

    // Проверка действий
    if (record.restrictedActions?.includes(checkDto.requestedAction)) {
      return {
        allowed: false,
        reason: 'Action is restricted',
      };
    }

    if (record.allowedActions?.length > 0 && !record.allowedActions.includes(checkDto.requestedAction)) {
      return {
        allowed: false,
        reason: 'Action is not in allowed actions list',
      };
    }

    // Проверка временных ограничений
    if (record.timeRestrictions) {
      const timeCheck = this.checkTimeRestrictions(record.timeRestrictions, now);
      if (!timeCheck.allowed) {
        return {
          allowed: false,
          reason: timeCheck.reason,
        };
      }
      if (timeCheck.warnings) {
        warnings.push(...timeCheck.warnings);
      }
    }

    // Проверка приближающегося истечения срока
    if (record.validUntil) {
      const hoursUntilExpiry = (record.validUntil.getTime() - now.getTime()) / (1000 * 60 * 60);
      if (hoursUntilExpiry <= 24) {
        warnings.push(`Access expires in ${Math.round(hoursUntilExpiry)} hours`);
      }
    }

    return {
      allowed: true,
      accessControlId: record.id,
      accessLevel: record.accessLevel,
      expiresAt: record.validUntil,
      restrictions,
      warnings,
    };
  }

  /**
   * Проверка временных ограничений
   */
  private checkTimeRestrictions(timeRestrictions: any, now: Date): {
    allowed: boolean;
    reason?: string;
    warnings?: string[];
  } {
    const warnings: string[] = [];

    // Проверка исключенных дней
    if (timeRestrictions.excludedDays?.length > 0) {
      const currentDay = now.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
      if (timeRestrictions.excludedDays.includes(currentDay)) {
        return {
          allowed: false,
          reason: `Access not allowed on ${currentDay}`,
        };
      }
    }

    // Проверка разрешенных часов
    if (timeRestrictions.allowedHours?.length > 0) {
      const currentTime = now.toTimeString().substr(0, 5); // HH:MM
      const isInAllowedHours = timeRestrictions.allowedHours.some(hours => 
        currentTime >= hours.from && currentTime <= hours.to
      );

      if (!isInAllowedHours) {
        return {
          allowed: false,
          reason: 'Current time is outside allowed hours',
        };
      }
    }

    // Проверка максимальной длительности (пока что только предупреждение)
    if (timeRestrictions.maxDuration) {
      warnings.push(`Maximum stay duration: ${timeRestrictions.maxDuration} minutes`);
    }

    return {
      allowed: true,
      warnings,
    };
  }

  /**
   * Обновление времени последнего доступа
   */
  private async updateLastAccess(accessControlId: string, location: string): Promise<void> {
    await this.accessControlRepository.update(accessControlId, {
      lastAccessTime: new Date(),
      lastAccessLocation: location,
    });
  }

  /**
   * Получение статистики контроля доступа
   */
  async getStatistics(): Promise<{
    total: number;
    byStatus: Record<string, number>;
    byType: Record<string, number>;
    byAccessLevel: Record<string, number>;
    todayAccesses: number;
    expiringSoon: number;
  }> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const next7Days = new Date();
    next7Days.setDate(next7Days.getDate() + 7);

    const [total, statusStats, typeStats, accessLevelStats, todayAccesses, expiringSoon] = await Promise.all([
      this.accessControlRepository.count(),
      this.accessControlRepository
        .createQueryBuilder('ac')
        .select('ac.status', 'status')
        .addSelect('COUNT(*)', 'count')
        .groupBy('ac.status')
        .getRawMany(),
      this.accessControlRepository
        .createQueryBuilder('ac')
        .select('ac.type', 'type')
        .addSelect('COUNT(*)', 'count')
        .groupBy('ac.type')
        .getRawMany(),
      this.accessControlRepository
        .createQueryBuilder('ac')
        .select('ac.accessLevel', 'accessLevel')
        .addSelect('COUNT(*)', 'count')
        .groupBy('ac.accessLevel')
        .getRawMany(),
      this.accessControlRepository.count({
        where: {
          lastAccessTime: {
            gte: today,
            lt: tomorrow,
          } as any,
        },
      }),
      this.accessControlRepository.count({
        where: {
          status: 'active',
          validUntil: {
            gte: today,
            lt: next7Days,
          } as any,
        },
      }),
    ]);

    return {
      total,
      byStatus: this.mapStatsToRecord(statusStats, 'status'),
      byType: this.mapStatsToRecord(typeStats, 'type'),
      byAccessLevel: this.mapStatsToRecord(accessLevelStats, 'accessLevel'),
      todayAccesses,
      expiringSoon,
    };
  }

  /**
   * Преобразование статистики в объект
   */
  private mapStatsToRecord(stats: any[], key: string): Record<string, number> {
    const result: Record<string, number> = {};

    stats.forEach((stat) => {
      result[stat[key]] = parseInt(stat.count, 10);
    });

    return result;
  }
}