import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindManyOptions, FindOneOptions } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Order, OrderStatus, OrderType, OrderPriority } from '../entities/order.entity';
import { OrderItem } from '../entities/order-item.entity';
import { OrderWorkflow } from '../entities/order-workflow.entity';
import { CreateOrderDto, UpdateOrderDto, FilterOrdersDto } from '../dto';

@Injectable()
export class OrderService {
  private readonly logger = new Logger(OrderService.name);

  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(OrderItem)
    private readonly orderItemRepository: Repository<OrderItem>,
    @InjectRepository(OrderWorkflow)
    private readonly orderWorkflowRepository: Repository<OrderWorkflow>,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Создание новой заявки
   */
  async create(createOrderDto: CreateOrderDto, userId: string): Promise<Order> {
    try {
      this.logger.log(`Creating new order by user: ${userId}`);

      // Генерация номера заявки
      const orderNumber = await this.generateOrderNumber();

      const order = this.orderRepository.create({
        ...createOrderDto,
        orderNumber,
        createdBy: userId,
        status: OrderStatus.DRAFT,
      });

      const savedOrder = await this.orderRepository.save(order);

      // Создание начального workflow
      await this.createInitialWorkflow(savedOrder.id, userId);

      // Событие создания заявки
      this.eventEmitter.emit('order.created', {
        orderId: savedOrder.id,
        orderNumber: savedOrder.orderNumber,
        userId,
        type: savedOrder.type,
      });

      this.logger.log(`Order created: ${savedOrder.orderNumber}`);
      return this.findOne(savedOrder.id);
    } catch (error) {
      this.logger.error(`Failed to create order: ${error.message}`);
      throw new BadRequestException('Failed to create order');
    }
  }

  /**
   * Получение всех заявок с фильтрацией
   */
  async findAll(filters: FilterOrdersDto): Promise<{
    orders: Order[];
    total: number;
    page: number;
    limit: number;
  }> {
    const {
      page = 1,
      limit = 20,
      status,
      type,
      priority,
      clientId,
      dateFrom,
      dateTo,
      search,
      sortBy = 'createdAt',
      sortOrder = 'DESC',
    } = filters;

    const query = this.orderRepository.createQueryBuilder('order')
      .leftJoinAndSelect('order.client', 'client')
      .leftJoinAndSelect('order.consignee', 'consignee')
      .leftJoinAndSelect('order.items', 'items')
      .leftJoinAndSelect('items.container', 'container')
      .where('order.isActive = :isActive', { isActive: true });

    // Применение фильтров
    if (status) {
      query.andWhere('order.status = :status', { status });
    }

    if (type) {
      query.andWhere('order.type = :type', { type });
    }

    if (priority) {
      query.andWhere('order.priority = :priority', { priority });
    }

    if (clientId) {
      query.andWhere('order.clientId = :clientId', { clientId });
    }

    if (dateFrom) {
      query.andWhere('order.requestedDate >= :dateFrom', { dateFrom });
    }

    if (dateTo) {
      query.andWhere('order.requestedDate <= :dateTo', { dateTo });
    }

    if (search) {
      query.andWhere(
        '(order.orderNumber ILIKE :search OR client.name ILIKE :search OR order.vesselName ILIKE :search OR order.billOfLading ILIKE :search)',
        { search: `%${search}%` }
      );
    }

    // Сортировка
    query.orderBy(`order.${sortBy}`, sortOrder);

    // Пагинация
    const skip = (page - 1) * limit;
    query.skip(skip).take(limit);

    const [orders, total] = await query.getManyAndCount();

    return {
      orders,
      total,
      page,
      limit,
    };
  }

  /**
   * Получение заявки по ID
   */
  async findOne(id: string): Promise<Order> {
    const order = await this.orderRepository.findOne({
      where: { id, isActive: true },
      relations: [
        'client',
        'consignee',
        'items',
        'items.container',
        'items.containerType',
        'workflows',
        'notes',
      ],
    });

    if (!order) {
      throw new NotFoundException(`Order with ID ${id} not found`);
    }

    return order;
  }

  /**
   * Получение заявки по номеру
   */
  async findByNumber(orderNumber: string): Promise<Order> {
    const order = await this.orderRepository.findOne({
      where: { orderNumber, isActive: true },
      relations: [
        'client',
        'consignee',
        'items',
        'items.container',
        'items.containerType',
        'workflows',
        'notes',
      ],
    });

    if (!order) {
      throw new NotFoundException(`Order with number ${orderNumber} not found`);
    }

    return order;
  }

  /**
   * Обновление заявки
   */
  async update(id: string, updateOrderDto: UpdateOrderDto, userId: string): Promise<Order> {
    const order = await this.findOne(id);

    // Проверка возможности редактирования
    if (order.status === OrderStatus.COMPLETED || order.status === OrderStatus.CANCELLED) {
      throw new BadRequestException('Cannot update completed or cancelled order');
    }

    const oldStatus = order.status;
    Object.assign(order, updateOrderDto);

    const updatedOrder = await this.orderRepository.save(order);

    // Создание workflow записи при изменении статуса
    if (updateOrderDto.status && updateOrderDto.status !== oldStatus) {
      await this.createWorkflowEntry(id, oldStatus, updateOrderDto.status, userId, updateOrderDto.statusComment);

      this.eventEmitter.emit('order.status.changed', {
        orderId: id,
        orderNumber: order.orderNumber,
        oldStatus,
        newStatus: updateOrderDto.status,
        userId,
      });
    }

    this.eventEmitter.emit('order.updated', {
      orderId: id,
      orderNumber: order.orderNumber,
      userId,
      changes: updateOrderDto,
    });

    this.logger.log(`Order updated: ${order.orderNumber}`);
    return this.findOne(id);
  }

  /**
   * Изменение статуса заявки
   */
  async changeStatus(
    id: string,
    newStatus: OrderStatus,
    userId: string,
    comment?: string
  ): Promise<Order> {
    const order = await this.findOne(id);
    const oldStatus = order.status;

    // Валидация смены статуса
    this.validateStatusChange(oldStatus, newStatus);

    order.status = newStatus;

    // Установка дат начала/завершения
    if (newStatus === OrderStatus.IN_PROGRESS && !order.actualStartDate) {
      order.actualStartDate = new Date();
    }

    if (newStatus === OrderStatus.COMPLETED && !order.actualEndDate) {
      order.actualEndDate = new Date();
    }

    await this.orderRepository.save(order);

    // Создание workflow записи
    await this.createWorkflowEntry(id, oldStatus, newStatus, userId, comment);

    this.eventEmitter.emit('order.status.changed', {
      orderId: id,
      orderNumber: order.orderNumber,
      oldStatus,
      newStatus,
      userId,
      comment,
    });

    this.logger.log(`Order status changed: ${order.orderNumber} from ${oldStatus} to ${newStatus}`);
    return this.findOne(id);
  }

  /**
   * Мягкое удаление заявки
   */
  async remove(id: string, userId: string): Promise<void> {
    const order = await this.findOne(id);

    if (order.status === OrderStatus.IN_PROGRESS) {
      throw new BadRequestException('Cannot delete order in progress');
    }

    order.isActive = false;
    await this.orderRepository.save(order);

    this.eventEmitter.emit('order.deleted', {
      orderId: id,
      orderNumber: order.orderNumber,
      userId,
    });

    this.logger.log(`Order deleted: ${order.orderNumber}`);
  }

  /**
   * Получение статистики заявок
   */
  async getStatistics(): Promise<{
    total: number;
    byStatus: Record<OrderStatus, number>;
    byType: Record<OrderType, number>;
    byPriority: Record<OrderPriority, number>;
  }> {
    const [total, statusStats, typeStats, priorityStats] = await Promise.all([
      this.orderRepository.count({ where: { isActive: true } }),
      this.orderRepository
        .createQueryBuilder('order')
        .select('order.status', 'status')
        .addSelect('COUNT(*)', 'count')
        .where('order.isActive = :isActive', { isActive: true })
        .groupBy('order.status')
        .getRawMany(),
      this.orderRepository
        .createQueryBuilder('order')
        .select('order.type', 'type')
        .addSelect('COUNT(*)', 'count')
        .where('order.isActive = :isActive', { isActive: true })
        .groupBy('order.type')
        .getRawMany(),
      this.orderRepository
        .createQueryBuilder('order')
        .select('order.priority', 'priority')
        .addSelect('COUNT(*)', 'count')
        .where('order.isActive = :isActive', { isActive: true })
        .groupBy('order.priority')
        .getRawMany(),
    ]);

    return {
      total,
      byStatus: this.mapStatsToEnum(statusStats, OrderStatus),
      byType: this.mapStatsToEnum(typeStats, OrderType),
      byPriority: this.mapStatsToEnum(priorityStats, OrderPriority),
    };
  }

  /**
   * Генерация номера заявки
   */
  private async generateOrderNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `ORD-${year}-`;

    const lastOrder = await this.orderRepository
      .createQueryBuilder('order')
      .where('order.orderNumber LIKE :prefix', { prefix: `${prefix}%` })
      .orderBy('order.orderNumber', 'DESC')
      .getOne();

    let sequence = 1;
    if (lastOrder) {
      const lastSequence = parseInt(lastOrder.orderNumber.split('-')[2], 10);
      sequence = lastSequence + 1;
    }

    return `${prefix}${sequence.toString().padStart(6, '0')}`;
  }

  /**
   * Создание начального workflow
   */
  private async createInitialWorkflow(orderId: string, userId: string): Promise<void> {
    const workflow = this.orderWorkflowRepository.create({
      orderId,
      fromStatus: null,
      toStatus: OrderStatus.DRAFT,
      changedBy: userId,
      comment: 'Заявка создана',
      changedAt: new Date(),
    });

    await this.orderWorkflowRepository.save(workflow);
  }

  /**
   * Создание записи workflow
   */
  private async createWorkflowEntry(
    orderId: string,
    fromStatus: OrderStatus,
    toStatus: OrderStatus,
    userId: string,
    comment?: string
  ): Promise<void> {
    const workflow = this.orderWorkflowRepository.create({
      orderId,
      fromStatus,
      toStatus,
      changedBy: userId,
      comment,
      changedAt: new Date(),
    });

    await this.orderWorkflowRepository.save(workflow);
  }

  /**
   * Валидация смены статуса
   */
  private validateStatusChange(fromStatus: OrderStatus, toStatus: OrderStatus): void {
    const allowedTransitions: Record<OrderStatus, OrderStatus[]> = {
      [OrderStatus.DRAFT]: [OrderStatus.SUBMITTED, OrderStatus.CANCELLED],
      [OrderStatus.SUBMITTED]: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED, OrderStatus.ON_HOLD],
      [OrderStatus.CONFIRMED]: [OrderStatus.IN_PROGRESS, OrderStatus.CANCELLED, OrderStatus.ON_HOLD],
      [OrderStatus.IN_PROGRESS]: [OrderStatus.COMPLETED, OrderStatus.CANCELLED, OrderStatus.ON_HOLD],
      [OrderStatus.ON_HOLD]: [OrderStatus.CONFIRMED, OrderStatus.IN_PROGRESS, OrderStatus.CANCELLED],
      [OrderStatus.COMPLETED]: [],
      [OrderStatus.CANCELLED]: [],
    };

    if (!allowedTransitions[fromStatus]?.includes(toStatus)) {
      throw new BadRequestException(
        `Invalid status transition from ${fromStatus} to ${toStatus}`
      );
    }
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
      const key = stat.status || stat.type || stat.priority;
      if (key in result) {
        result[key as keyof T] = parseInt(stat.count, 10);
      }
    });

    return result;
  }
}