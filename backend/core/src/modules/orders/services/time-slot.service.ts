import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { TimeSlot, TimeSlotType, TimeSlotStatus } from '../entities/time-slot.entity';
import { CreateTimeSlotDto, UpdateTimeSlotDto, FilterTimeSlotsDto, ReserveTimeSlotDto } from '../dto';

@Injectable()
export class TimeSlotService {
  private readonly logger = new Logger(TimeSlotService.name);

  constructor(
    @InjectRepository(TimeSlot)
    private readonly timeSlotRepository: Repository<TimeSlot>,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Создание нового тайм-слота
   */
  async create(createTimeSlotDto: CreateTimeSlotDto, userId: string): Promise<TimeSlot> {
    try {
      this.logger.log(`Creating time slot for location: ${createTimeSlotDto.location}`);

      // Проверка пересечения с существующими слотами
      await this.validateTimeSlotOverlap(
        createTimeSlotDto.startTime,
        createTimeSlotDto.endTime,
        createTimeSlotDto.location
      );

      const timeSlot = this.timeSlotRepository.create({
        ...createTimeSlotDto,
        durationMinutes: this.calculateDuration(createTimeSlotDto.startTime, createTimeSlotDto.endTime),
      });

      const savedTimeSlot = await this.timeSlotRepository.save(timeSlot);

      this.eventEmitter.emit('time-slot.created', {
        timeSlotId: savedTimeSlot.id,
        type: savedTimeSlot.type,
        location: savedTimeSlot.location,
        startTime: savedTimeSlot.startTime,
        userId,
      });

      this.logger.log(`Time slot created: ${savedTimeSlot.id}`);
      return savedTimeSlot;
    } catch (error) {
      this.logger.error(`Failed to create time slot: ${error.message}`);
      throw new BadRequestException('Failed to create time slot');
    }
  }

  /**
   * Получение доступных тайм-слотов
   */
  async findAvailable(filters: FilterTimeSlotsDto): Promise<{
    timeSlots: TimeSlot[];
    total: number;
  }> {
    const {
      type,
      location,
      dateFrom,
      dateTo,
      containerCount = 1,
      sortBy = 'startTime',
      sortOrder = 'ASC',
    } = filters;

    const query = this.timeSlotRepository.createQueryBuilder('slot')
      .where('slot.isActive = :isActive', { isActive: true })
      .andWhere('slot.status = :status', { status: TimeSlotStatus.AVAILABLE })
      .andWhere('slot.maxContainers - slot.reservedContainers >= :containerCount', { containerCount });

    // Применение фильтров
    if (type) {
      query.andWhere('slot.type = :type', { type });
    }

    if (location) {
      query.andWhere('slot.location = :location', { location });
    }

    if (dateFrom) {
      query.andWhere('slot.startTime >= :dateFrom', { dateFrom });
    }

    if (dateTo) {
      query.andWhere('slot.endTime <= :dateTo', { dateTo });
    }

    // Исключаем прошедшие слоты
    query.andWhere('slot.endTime > :now', { now: new Date() });

    // Сортировка
    query.orderBy(`slot.${sortBy}`, sortOrder);

    const [timeSlots, total] = await query.getManyAndCount();

    return { timeSlots, total };
  }

  /**
   * Получение всех тайм-слотов с фильтрацией
   */
  async findAll(filters: FilterTimeSlotsDto): Promise<{
    timeSlots: TimeSlot[];
    total: number;
    page: number;
    limit: number;
  }> {
    const {
      page = 1,
      limit = 20,
      type,
      status,
      location,
      dateFrom,
      dateTo,
      sortBy = 'startTime',
      sortOrder = 'ASC',
    } = filters;

    const query = this.timeSlotRepository.createQueryBuilder('slot')
      .leftJoinAndSelect('slot.order', 'order')
      .where('slot.isActive = :isActive', { isActive: true });

    // Применение фильтров
    if (type) {
      query.andWhere('slot.type = :type', { type });
    }

    if (status) {
      query.andWhere('slot.status = :status', { status });
    }

    if (location) {
      query.andWhere('slot.location = :location', { location });
    }

    if (dateFrom) {
      query.andWhere('slot.startTime >= :dateFrom', { dateFrom });
    }

    if (dateTo) {
      query.andWhere('slot.endTime <= :dateTo', { dateTo });
    }

    // Сортировка
    query.orderBy(`slot.${sortBy}`, sortOrder);

    // Пагинация
    const skip = (page - 1) * limit;
    query.skip(skip).take(limit);

    const [timeSlots, total] = await query.getManyAndCount();

    return {
      timeSlots,
      total,
      page,
      limit,
    };
  }

  /**
   * Получение тайм-слота по ID
   */
  async findOne(id: string): Promise<TimeSlot> {
    const timeSlot = await this.timeSlotRepository.findOne({
      where: { id, isActive: true },
      relations: ['order'],
    });

    if (!timeSlot) {
      throw new NotFoundException(`Time slot with ID ${id} not found`);
    }

    return timeSlot;
  }

  /**
   * Резервирование тайм-слота
   */
  async reserve(id: string, reserveDto: ReserveTimeSlotDto, userId: string): Promise<TimeSlot> {
    const timeSlot = await this.findOne(id);

    if (timeSlot.status !== TimeSlotStatus.AVAILABLE) {
      throw new BadRequestException('Time slot is not available for reservation');
    }

    const requiredContainers = reserveDto.containerCount || 1;
    const availableCapacity = timeSlot.maxContainers - timeSlot.reservedContainers;

    if (availableCapacity < requiredContainers) {
      throw new BadRequestException(`Not enough capacity. Available: ${availableCapacity}, Required: ${requiredContainers}`);
    }

    // Обновляем слот
    timeSlot.status = TimeSlotStatus.RESERVED;
    timeSlot.orderId = reserveDto.orderId;
    timeSlot.clientId = reserveDto.clientId;
    timeSlot.contactInfo = reserveDto.contactInfo;
    timeSlot.requirements = reserveDto.requirements;
    timeSlot.reservedContainers = requiredContainers;
    timeSlot.reservedAt = new Date();
    timeSlot.reservedBy = userId;

    const updatedTimeSlot = await this.timeSlotRepository.save(timeSlot);

    this.eventEmitter.emit('time-slot.reserved', {
      timeSlotId: id,
      orderId: reserveDto.orderId,
      userId,
      containerCount: requiredContainers,
    });

    this.logger.log(`Time slot reserved: ${id} for order: ${reserveDto.orderId}`);
    return updatedTimeSlot;
  }

  /**
   * Подтверждение тайм-слота
   */
  async confirm(id: string, userId: string): Promise<TimeSlot> {
    const timeSlot = await this.findOne(id);

    if (timeSlot.status !== TimeSlotStatus.RESERVED) {
      throw new BadRequestException('Time slot must be reserved before confirmation');
    }

    timeSlot.status = TimeSlotStatus.CONFIRMED;
    timeSlot.confirmedAt = new Date();
    timeSlot.confirmedBy = userId;

    const updatedTimeSlot = await this.timeSlotRepository.save(timeSlot);

    this.eventEmitter.emit('time-slot.confirmed', {
      timeSlotId: id,
      orderId: timeSlot.orderId,
      userId,
    });

    this.logger.log(`Time slot confirmed: ${id}`);
    return updatedTimeSlot;
  }

  /**
   * Начало выполнения тайм-слота
   */
  async start(id: string, userId: string): Promise<TimeSlot> {
    const timeSlot = await this.findOne(id);

    if (timeSlot.status !== TimeSlotStatus.CONFIRMED) {
      throw new BadRequestException('Time slot must be confirmed before starting');
    }

    timeSlot.status = TimeSlotStatus.IN_PROGRESS;
    timeSlot.actualStartTime = new Date();

    const updatedTimeSlot = await this.timeSlotRepository.save(timeSlot);

    this.eventEmitter.emit('time-slot.started', {
      timeSlotId: id,
      orderId: timeSlot.orderId,
      userId,
    });

    this.logger.log(`Time slot started: ${id}`);
    return updatedTimeSlot;
  }

  /**
   * Завершение тайм-слота
   */
  async complete(id: string, userId: string): Promise<TimeSlot> {
    const timeSlot = await this.findOne(id);

    if (timeSlot.status !== TimeSlotStatus.IN_PROGRESS) {
      throw new BadRequestException('Time slot must be in progress before completion');
    }

    timeSlot.status = TimeSlotStatus.COMPLETED;
    timeSlot.actualEndTime = new Date();

    const updatedTimeSlot = await this.timeSlotRepository.save(timeSlot);

    this.eventEmitter.emit('time-slot.completed', {
      timeSlotId: id,
      orderId: timeSlot.orderId,
      userId,
    });

    this.logger.log(`Time slot completed: ${id}`);
    return updatedTimeSlot;
  }

  /**
   * Отмена тайм-слота
   */
  async cancel(id: string, reason: string, userId: string): Promise<TimeSlot> {
    const timeSlot = await this.findOne(id);

    if (timeSlot.status === TimeSlotStatus.COMPLETED) {
      throw new BadRequestException('Cannot cancel completed time slot');
    }

    const oldStatus = timeSlot.status;
    timeSlot.status = TimeSlotStatus.CANCELLED;
    timeSlot.cancellationReason = reason;
    timeSlot.cancelledAt = new Date();
    timeSlot.reservedContainers = 0;
    timeSlot.orderId = null;
    timeSlot.clientId = null;

    const updatedTimeSlot = await this.timeSlotRepository.save(timeSlot);

    this.eventEmitter.emit('time-slot.cancelled', {
      timeSlotId: id,
      orderId: timeSlot.orderId,
      oldStatus,
      reason,
      userId,
    });

    this.logger.log(`Time slot cancelled: ${id}, reason: ${reason}`);
    return updatedTimeSlot;
  }

  /**
   * Обновление тайм-слота
   */
  async update(id: string, updateTimeSlotDto: UpdateTimeSlotDto, userId: string): Promise<TimeSlot> {
    const timeSlot = await this.findOne(id);

    if (timeSlot.status === TimeSlotStatus.IN_PROGRESS || timeSlot.status === TimeSlotStatus.COMPLETED) {
      throw new BadRequestException('Cannot update time slot that is in progress or completed');
    }

    // Если изменяется время, проверяем пересечения
    if (updateTimeSlotDto.startTime || updateTimeSlotDto.endTime) {
      const startTime = updateTimeSlotDto.startTime || timeSlot.startTime;
      const endTime = updateTimeSlotDto.endTime || timeSlot.endTime;
      
      await this.validateTimeSlotOverlap(startTime, endTime, timeSlot.location, id);
      
      if (updateTimeSlotDto.startTime && updateTimeSlotDto.endTime) {
        updateTimeSlotDto.durationMinutes = this.calculateDuration(startTime, endTime);
      }
    }

    Object.assign(timeSlot, updateTimeSlotDto);
    const updatedTimeSlot = await this.timeSlotRepository.save(timeSlot);

    this.eventEmitter.emit('time-slot.updated', {
      timeSlotId: id,
      userId,
      changes: updateTimeSlotDto,
    });

    this.logger.log(`Time slot updated: ${id}`);
    return updatedTimeSlot;
  }

  /**
   * Получение статистики тайм-слотов
   */
  async getStatistics(dateFrom?: Date, dateTo?: Date): Promise<{
    total: number;
    byStatus: Record<TimeSlotStatus, number>;
    byType: Record<TimeSlotType, number>;
    utilizationRate: number;
    avgDuration: number;
  }> {
    const query = this.timeSlotRepository.createQueryBuilder('slot')
      .where('slot.isActive = :isActive', { isActive: true });

    if (dateFrom) {
      query.andWhere('slot.startTime >= :dateFrom', { dateFrom });
    }

    if (dateTo) {
      query.andWhere('slot.endTime <= :dateTo', { dateTo });
    }

    const [slots, total] = await query.getManyAndCount();

    // Статистика по статусам
    const byStatus = {} as Record<TimeSlotStatus, number>;
    Object.values(TimeSlotStatus).forEach(status => {
      byStatus[status] = slots.filter(slot => slot.status === status).length;
    });

    // Статистика по типам
    const byType = {} as Record<TimeSlotType, number>;
    Object.values(TimeSlotType).forEach(type => {
      byType[type] = slots.filter(slot => slot.type === type).length;
    });

    // Коэффициент использования
    const usedSlots = slots.filter(slot => 
      slot.status !== TimeSlotStatus.AVAILABLE && 
      slot.status !== TimeSlotStatus.CANCELLED
    );
    const utilizationRate = total > 0 ? (usedSlots.length / total) * 100 : 0;

    // Средняя продолжительность
    const totalDuration = slots.reduce((sum, slot) => sum + slot.durationMinutes, 0);
    const avgDuration = total > 0 ? totalDuration / total : 0;

    return {
      total,
      byStatus,
      byType,
      utilizationRate: Math.round(utilizationRate * 100) / 100,
      avgDuration: Math.round(avgDuration),
    };
  }

  /**
   * Валидация пересечения тайм-слотов
   */
  private async validateTimeSlotOverlap(
    startTime: Date,
    endTime: Date,
    location: string,
    excludeId?: string
  ): Promise<void> {
    const query = this.timeSlotRepository.createQueryBuilder('slot')
      .where('slot.location = :location', { location })
      .andWhere('slot.isActive = :isActive', { isActive: true })
      .andWhere('slot.status != :cancelled', { cancelled: TimeSlotStatus.CANCELLED })
      .andWhere(
        '(slot.startTime < :endTime AND slot.endTime > :startTime)',
        { startTime, endTime }
      );

    if (excludeId) {
      query.andWhere('slot.id != :excludeId', { excludeId });
    }

    const overlappingSlot = await query.getOne();

    if (overlappingSlot) {
      throw new BadRequestException(
        `Time slot overlaps with existing slot at location ${location} from ${overlappingSlot.startTime} to ${overlappingSlot.endTime}`
      );
    }
  }

  /**
   * Вычисление продолжительности в минутах
   */
  private calculateDuration(startTime: Date, endTime: Date): number {
    return Math.round((endTime.getTime() - startTime.getTime()) / (1000 * 60));
  }
}