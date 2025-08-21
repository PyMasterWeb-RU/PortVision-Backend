import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Order, OrderType } from '../entities/order.entity';
import { OrderItem } from '../entities/order-item.entity';

interface EdiMessage {
  messageType: string;
  messageId: string;
  sender: string;
  receiver: string;
  version: string;
  content: any;
  rawMessage: string;
}

interface EdifactBaplie {
  // Bay/Stow Planning message
  vesselName: string;
  vesselImo: string;
  voyage: string;
  portOfLoading: string;
  portOfDischarge: string;
  containers: Array<{
    containerNumber: string;
    containerType: string;
    sizeType: string;
    weight: number;
    bay: string;
    row: string;
    tier: string;
    loadingStatus: 'L' | 'D'; // Loading or Discharge
  }>;
}

interface EdifactCoprar {
  // Container pre-advice message
  vesselName: string;
  vesselImo: string;
  voyage: string;
  containers: Array<{
    containerNumber: string;
    containerType: string;
    sizeType: string;
    weight: number;
    commodity: string;
    dangerous: boolean;
    temperature?: number;
    deliveryMode: string;
    consignee: string;
    billOfLading: string;
  }>;
}

@Injectable()
export class EdiService {
  private readonly logger = new Logger(EdiService.name);

  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(OrderItem)
    private readonly orderItemRepository: Repository<OrderItem>,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Обработка входящего EDI сообщения
   */
  async processIncomingEdiMessage(ediMessage: EdiMessage, userId: string): Promise<Order[]> {
    try {
      this.logger.log(`Processing EDI message: ${ediMessage.messageType} from ${ediMessage.sender}`);

      switch (ediMessage.messageType.toUpperCase()) {
        case 'BAPLIE':
          return await this.processBaplieMessage(ediMessage, userId);
        case 'COPRAR':
          return await this.processCoprarMessage(ediMessage, userId);
        case 'CODECO':
          return await this.processCodecoMessage(ediMessage, userId);
        default:
          throw new BadRequestException(`Unsupported EDI message type: ${ediMessage.messageType}`);
      }
    } catch (error) {
      this.logger.error(`Failed to process EDI message: ${error.message}`);
      
      this.eventEmitter.emit('edi.message.failed', {
        messageId: ediMessage.messageId,
        messageType: ediMessage.messageType,
        error: error.message,
        userId,
      });
      
      throw error;
    }
  }

  /**
   * Обработка BAPLIE сообщения (Bay/Stow Planning)
   */
  private async processBaplieMessage(ediMessage: EdiMessage, userId: string): Promise<Order[]> {
    const baplie = this.parseEdifactBaplie(ediMessage.content);
    const orders: Order[] = [];

    this.logger.log(`Processing BAPLIE for vessel: ${baplie.vesselName}, voyage: ${baplie.voyage}`);

    // Группируем контейнеры по операции (погрузка/выгрузка)
    const loadingContainers = baplie.containers.filter(c => c.loadingStatus === 'L');
    const dischargeContainers = baplie.containers.filter(c => c.loadingStatus === 'D');

    // Создаем заявку на погрузку
    if (loadingContainers.length > 0) {
      const loadingOrder = await this.createOrderFromBaplie(
        baplie,
        loadingContainers,
        OrderType.EXPORT,
        ediMessage,
        userId
      );
      orders.push(loadingOrder);
    }

    // Создаем заявку на выгрузку
    if (dischargeContainers.length > 0) {
      const dischargeOrder = await this.createOrderFromBaplie(
        baplie,
        dischargeContainers,
        OrderType.IMPORT,
        ediMessage,
        userId
      );
      orders.push(dischargeOrder);
    }

    this.eventEmitter.emit('edi.baplie.processed', {
      messageId: ediMessage.messageId,
      vesselName: baplie.vesselName,
      voyage: baplie.voyage,
      ordersCreated: orders.length,
      userId,
    });

    return orders;
  }

  /**
   * Обработка COPRAR сообщения (Container pre-advice)
   */
  private async processCoprarMessage(ediMessage: EdiMessage, userId: string): Promise<Order[]> {
    const coprar = this.parseEdifactCoprar(ediMessage.content);
    
    this.logger.log(`Processing COPRAR for vessel: ${coprar.vesselName}, voyage: ${coprar.voyage}`);

    const order = await this.createOrderFromCoprar(coprar, ediMessage, userId);

    this.eventEmitter.emit('edi.coprar.processed', {
      messageId: ediMessage.messageId,
      vesselName: coprar.vesselName,
      voyage: coprar.voyage,
      orderId: order.id,
      userId,
    });

    return [order];
  }

  /**
   * Обработка CODECO сообщения (Container gate-in/gate-out)
   */
  private async processCodecoMessage(ediMessage: EdiMessage, userId: string): Promise<Order[]> {
    // CODECO обычно обновляет существующие заявки, а не создает новые
    this.logger.log(`Processing CODECO message: ${ediMessage.messageId}`);
    
    // Поиск и обновление существующих заявок
    // Здесь будет логика обновления статусов контейнеров
    
    return [];
  }

  /**
   * Создание заявки из BAPLIE сообщения
   */
  private async createOrderFromBaplie(
    baplie: EdifactBaplie,
    containers: EdifactBaplie['containers'],
    orderType: OrderType,
    ediMessage: EdiMessage,
    userId: string
  ): Promise<Order> {
    const orderNumber = await this.generateOrderNumber();

    const order = this.orderRepository.create({
      orderNumber,
      type: orderType,
      vesselName: baplie.vesselName,
      vesselImo: baplie.vesselImo,
      vesselVoyage: baplie.voyage,
      requestedDate: new Date(),
      createdBy: userId,
      ediMessage: {
        messageType: ediMessage.messageType,
        messageId: ediMessage.messageId,
        sender: ediMessage.sender,
        receiver: ediMessage.receiver,
        rawMessage: ediMessage.rawMessage,
        processedAt: new Date(),
      },
      // Устанавливаем клиента по умолчанию для EDI сообщений
      clientId: await this.getDefaultEdiClientId(ediMessage.sender),
    });

    const savedOrder = await this.orderRepository.save(order);

    // Создаем позиции заявки для каждого контейнера
    for (const container of containers) {
      const orderItem = this.orderItemRepository.create({
        orderId: savedOrder.id,
        containerNumber: container.containerNumber,
        containerTypeId: await this.getContainerTypeId(container.containerType),
        weight: container.weight,
        sequence: 1,
        yardPosition: {
          bay: container.bay,
          row: container.row,
          tier: container.tier,
        },
      });

      await this.orderItemRepository.save(orderItem);
    }

    return savedOrder;
  }

  /**
   * Создание заявки из COPRAR сообщения
   */
  private async createOrderFromCoprar(
    coprar: EdifactCoprar,
    ediMessage: EdiMessage,
    userId: string
  ): Promise<Order> {
    const orderNumber = await this.generateOrderNumber();

    const order = this.orderRepository.create({
      orderNumber,
      type: OrderType.IMPORT,
      vesselName: coprar.vesselName,
      vesselImo: coprar.vesselImo,
      vesselVoyage: coprar.voyage,
      requestedDate: new Date(),
      createdBy: userId,
      clientId: await this.getDefaultEdiClientId(ediMessage.sender),
      ediMessage: {
        messageType: ediMessage.messageType,
        messageId: ediMessage.messageId,
        sender: ediMessage.sender,
        receiver: ediMessage.receiver,
        rawMessage: ediMessage.rawMessage,
        processedAt: new Date(),
      },
    });

    const savedOrder = await this.orderRepository.save(order);

    // Создаем позиции заявки
    for (const container of coprar.containers) {
      const orderItem = this.orderItemRepository.create({
        orderId: savedOrder.id,
        containerNumber: container.containerNumber,
        containerTypeId: await this.getContainerTypeId(container.containerType),
        weight: container.weight,
        sequence: 1,
        billOfLading: container.billOfLading,
        commodity: container.commodity,
        isDangerous: container.dangerous,
        temperatureRange: container.temperature ? {
          target: container.temperature,
          unit: 'C'
        } : null,
      });

      await this.orderItemRepository.save(orderItem);
    }

    return savedOrder;
  }

  /**
   * Генерация исходящего EDI сообщения
   */
  async generateOutgoingEdiMessage(
    orderId: string,
    messageType: string,
    recipient: string
  ): Promise<string> {
    const order = await this.orderRepository.findOne({
      where: { id: orderId },
      relations: ['items', 'items.container', 'client'],
    });

    if (!order) {
      throw new BadRequestException(`Order with ID ${orderId} not found`);
    }

    switch (messageType.toUpperCase()) {
      case 'CODECO':
        return this.generateCodecoMessage(order, recipient);
      case 'COPARN':
        return this.generateCoparnMessage(order, recipient);
      default:
        throw new BadRequestException(`Unsupported outgoing EDI message type: ${messageType}`);
    }
  }

  /**
   * Парсинг EDIFACT BAPLIE сообщения
   */
  private parseEdifactBaplie(content: any): EdifactBaplie {
    // Здесь должна быть логика парсинга EDIFACT формата
    // Пока возвращаем mock данные
    return content as EdifactBaplie;
  }

  /**
   * Парсинг EDIFACT COPRAR сообщения
   */
  private parseEdifactCoprar(content: any): EdifactCoprar {
    // Здесь должна быть логика парсинга EDIFACT формата
    return content as EdifactCoprar;
  }

  /**
   * Генерация CODECO сообщения
   */
  private generateCodecoMessage(order: Order, recipient: string): string {
    // Генерация EDIFACT CODECO сообщения
    const segments = [
      `UNH+${order.orderNumber}+CODECO:D:95B:UN'`,
      `BGM+335+${order.orderNumber}+9'`,
      `DTM+137:${new Date().toISOString().slice(0, 10)}:102'`,
      `TDT+20+${order.vesselVoyage}+++${order.vesselName}:${order.vesselImo}'`,
    ];

    order.items.forEach((item, index) => {
      segments.push(`EQD+CN+${item.containerNumber}+${item.containerType?.code || 'GP'}:6346:5'`);
      segments.push(`MEA+AAE+G+KGM:${item.weight}'`);
    });

    segments.push(`UNT+${segments.length + 1}+${order.orderNumber}'`);

    return segments.join('\n');
  }

  /**
   * Генерация COPARN сообщения
   */
  private generateCoparnMessage(order: Order, recipient: string): string {
    // Генерация EDIFACT COPARN сообщения
    const segments = [
      `UNH+${order.orderNumber}+COPARN:D:95B:UN'`,
      `BGM+34+${order.orderNumber}+9'`,
      `DTM+137:${new Date().toISOString().slice(0, 10)}:102'`,
    ];

    // Добавляем сегменты для каждого контейнера
    order.items.forEach((item) => {
      segments.push(`EQD+CN+${item.containerNumber}+${item.containerType?.code || 'GP'}:6346:5'`);
    });

    segments.push(`UNT+${segments.length + 1}+${order.orderNumber}'`);

    return segments.join('\n');
  }

  /**
   * Получение ID клиента по умолчанию для EDI отправителя
   */
  private async getDefaultEdiClientId(sender: string): Promise<string> {
    // Здесь должна быть логика поиска клиента по EDI коду
    // Пока возвращаем фиксированный ID
    return 'default-edi-client-id';
  }

  /**
   * Получение ID типа контейнера по коду
   */
  private async getContainerTypeId(typeCode: string): Promise<string> {
    // Здесь должна быть логика поиска типа контейнера
    return 'default-container-type-id';
  }

  /**
   * Генерация номера заявки
   */
  private async generateOrderNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `EDI-${year}-`;

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
}