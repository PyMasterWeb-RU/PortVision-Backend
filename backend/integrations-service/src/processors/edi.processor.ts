import {
  Injectable,
  Logger,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { EdiAdapter, EdiMessage, EdiMessageType, ContainerInfo, VesselInfo } from '../adapters/edi.adapter';
import { DataTransformationService } from '../services/data-transformation.service';
import { RoutingService } from '../services/routing.service';
import { MetricsService } from '../services/metrics.service';
import { IntegrationEndpoint } from '../entities/integration-endpoint.entity';

export interface EdiProcessingRequest {
  endpointId: string;
  action: 'send_message' | 'resend_message' | 'get_messages' | 'validate_message';
  messageType?: EdiMessageType;
  messageId?: string;
  data?: any;
  metadata?: {
    operatorId?: string;
    sessionId?: string;
    priority?: 'low' | 'normal' | 'high' | 'urgent';
    correlationId?: string;
  };
}

export interface EdiProcessingResult {
  success: boolean;
  action: string;
  endpointId: string;
  data?: any;
  errors?: string[];
  processingTime: number;
  messageCount?: number;
  connectionStats?: any;
  metadata?: any;
}

export interface EdiBusinessEvent {
  eventId: string;
  eventType: 'vessel_arrival' | 'vessel_departure' | 'container_discharge' | 'container_load' | 'booking_update' | 'stowage_plan';
  timestamp: Date;
  sourceMessage: {
    messageId: string;
    messageType: EdiMessageType;
    controlNumber: string;
  };
  businessData: {
    vessel?: VesselInfo;
    containers?: ContainerInfo[];
    booking?: any;
    stowagePlan?: any;
    events?: any[];
  };
  affectedEntities: Array<{
    entityType: 'container' | 'vessel' | 'booking' | 'equipment';
    entityId: string;
    action: 'create' | 'update' | 'delete' | 'status_change';
  }>;
  metadata?: any;
}

export interface EdiMessageSummary {
  totalMessages: number;
  messagesByType: Record<EdiMessageType, number>;
  messagesByStatus: Record<string, number>;
  messagesByPartner: Record<string, number>;
  recentMessages: Array<{
    messageId: string;
    messageType: EdiMessageType;
    timestamp: Date;
    status: string;
    partner: string;
  }>;
  errorSummary: {
    totalErrors: number;
    errorsByType: Record<string, number>;
    recentErrors: string[];
  };
  throughputStats: {
    messagesPerHour: number;
    messagesPerDay: number;
    averageProcessingTime: number;
  };
}

@Injectable()
export class EdiProcessor {
  private readonly logger = new Logger(EdiProcessor.name);
  private readonly businessEvents = new Map<string, EdiBusinessEvent>();
  private readonly messageHistory = new Map<string, EdiMessage[]>();
  private readonly processingMetrics = new Map<string, number>();

  constructor(
    private readonly ediAdapter: EdiAdapter,
    private readonly dataTransformationService: DataTransformationService,
    private readonly routingService: RoutingService,
    private readonly metricsService: MetricsService,
    private readonly eventEmitter: EventEmitter2,
  ) {
    this.setupEventListeners();
  }

  async processEdiRequest(
    request: EdiProcessingRequest,
    endpoint: IntegrationEndpoint,
  ): Promise<EdiProcessingResult> {
    const startTime = Date.now();
    
    this.logger.log(`📋 Обработка EDI запроса ${request.action} для интеграции ${endpoint.name}`);

    const result: EdiProcessingResult = {
      success: false,
      action: request.action,
      endpointId: request.endpointId,
      errors: [],
      processingTime: 0,
    };

    try {
      switch (request.action) {
        case 'send_message':
          if (!request.messageType || !request.data) {
            throw new Error('Не указан тип сообщения или данные для отправки');
          }
          result.data = await this.handleSendMessage(
            endpoint,
            request.messageType,
            request.data,
            request.metadata,
          );
          result.success = !!result.data;
          break;

        case 'resend_message':
          if (!request.messageId) {
            throw new Error('Не указан ID сообщения для повторной отправки');
          }
          result.data = await this.handleResendMessage(endpoint, request.messageId);
          result.success = !!result.data;
          break;

        case 'get_messages':
          result.data = await this.handleGetMessages(endpoint, request.metadata);
          result.success = true;
          break;

        case 'validate_message':
          if (!request.messageId) {
            throw new Error('Не указан ID сообщения для валидации');
          }
          result.data = await this.handleValidateMessage(request.messageId);
          result.success = true;
          break;

        default:
          throw new Error(`Неподдерживаемое действие: ${request.action}`);
      }

      // Получаем статистику соединения
      const stats = await this.ediAdapter.getConnectionStats(request.endpointId);
      result.connectionStats = stats;
      result.messageCount = stats?.totalMessages || 0;

      result.processingTime = Date.now() - startTime;

      // Записываем метрики
      await this.metricsService.recordMessage(
        endpoint.id,
        JSON.stringify(request).length,
        result.processingTime,
      );

      this.logger.log(
        `✅ EDI запрос ${request.action} обработан для ${endpoint.name}: ` +
        `${result.processingTime}ms`
      );

      return result;

    } catch (error) {
      result.success = false;
      result.errors.push(error.message);
      result.processingTime = Date.now() - startTime;

      this.logger.error(`❌ Ошибка обработки EDI запроса ${request.action}:`, error.stack);

      await this.metricsService.recordError(
        endpoint.id,
        error.message,
        result.processingTime,
      );

      return result;
    }
  }

  private async handleSendMessage(
    endpoint: IntegrationEndpoint,
    messageType: EdiMessageType,
    data: any,
    metadata?: any,
  ): Promise<string> {
    try {
      // Валидируем данные перед отправкой
      this.validateOutgoingMessageData(messageType, data);

      // Отправляем сообщение
      const messageId = await this.ediAdapter.sendMessage(endpoint.id, messageType, data);
      
      this.logger.log(`📤 EDI сообщение ${messageType} отправлено: ${messageId}`);

      // Создаем бизнес-событие
      const businessEvent = await this.createBusinessEventFromOutgoing(
        messageType,
        data,
        messageId,
        metadata,
      );

      // Сохраняем событие
      this.businessEvents.set(businessEvent.eventId, businessEvent);

      // Отправляем уведомление
      this.eventEmitter.emit('edi.message.sent.processed', {
        endpointId: endpoint.id,
        messageId,
        messageType,
        businessEvent,
        metadata,
        timestamp: new Date(),
      });

      return messageId;

    } catch (error) {
      this.logger.error(`❌ Ошибка отправки EDI сообщения ${messageType}:`, error.message);
      throw error;
    }
  }

  private async handleResendMessage(endpoint: IntegrationEndpoint, messageId: string): Promise<string> {
    try {
      const message = await this.ediAdapter.getMessage(messageId);
      
      if (!message) {
        throw new Error(`Сообщение ${messageId} не найдено`);
      }

      // Создаем новые данные на основе исходного сообщения
      const data = await this.reconstructMessageData(message);
      
      // Отправляем заново
      const newMessageId = await this.ediAdapter.sendMessage(
        endpoint.id,
        message.messageType,
        data,
      );

      this.logger.log(`🔄 EDI сообщение ${messageId} переотправлено как ${newMessageId}`);

      return newMessageId;

    } catch (error) {
      this.logger.error(`❌ Ошибка повторной отправки EDI сообщения ${messageId}:`, error.message);
      throw error;
    }
  }

  private async handleGetMessages(endpoint: IntegrationEndpoint, metadata?: any): Promise<EdiMessageSummary> {
    try {
      const messages = await this.ediAdapter.getMessages(endpoint.id);
      const stats = await this.ediAdapter.getConnectionStats(endpoint.id);

      return this.buildMessageSummary(messages, stats, endpoint);

    } catch (error) {
      this.logger.error(`❌ Ошибка получения EDI сообщений:`, error.message);
      throw error;
    }
  }

  private async handleValidateMessage(messageId: string): Promise<any> {
    try {
      const message = await this.ediAdapter.getMessage(messageId);
      
      if (!message) {
        throw new Error(`Сообщение ${messageId} не найдено`);
      }

      return {
        messageId: message.messageId,
        messageType: message.messageType,
        status: message.status,
        isValid: message.status !== 'error',
        errors: message.errors || [],
        segmentCount: message.segments.length,
        validationDetails: this.getValidationDetails(message),
      };

    } catch (error) {
      this.logger.error(`❌ Ошибка валидации EDI сообщения ${messageId}:`, error.message);
      throw error;
    }
  }

  private validateOutgoingMessageData(messageType: EdiMessageType, data: any): void {
    switch (messageType) {
      case 'CODECO':
        if (!data.containers || !Array.isArray(data.containers)) {
          throw new Error('CODECO сообщение должно содержать массив контейнеров');
        }
        break;

      case 'COPRAR':
        if (!data.events || !Array.isArray(data.events)) {
          throw new Error('COPRAR сообщение должно содержать массив событий');
        }
        break;

      case 'BAPLIE':
        if (!data.vessel) {
          throw new Error('BAPLIE сообщение должно содержать информацию о судне');
        }
        break;

      default:
        if (!data || typeof data !== 'object') {
          throw new Error('Данные сообщения должны быть объектом');
        }
    }
  }

  private async createBusinessEventFromOutgoing(
    messageType: EdiMessageType,
    data: any,
    messageId: string,
    metadata?: any,
  ): Promise<EdiBusinessEvent> {
    const eventId = `biz_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    let eventType: EdiBusinessEvent['eventType'];
    switch (messageType) {
      case 'CODECO':
        eventType = data.operation === 'discharge' ? 'container_discharge' : 'container_load';
        break;
      case 'COPRAR':
        eventType = 'container_discharge';
        break;
      case 'BAPLIE':
        eventType = 'stowage_plan';
        break;
      case 'COARRI':
        eventType = 'vessel_arrival';
        break;
      default:
        eventType = 'booking_update';
    }

    const affectedEntities = this.extractAffectedEntities(messageType, data);

    const businessEvent: EdiBusinessEvent = {
      eventId,
      eventType,
      timestamp: new Date(),
      sourceMessage: {
        messageId,
        messageType,
        controlNumber: messageId.split('_').pop() || messageId,
      },
      businessData: {
        vessel: data.vessel,
        containers: data.containers,
        booking: data.booking,
        stowagePlan: data.stowagePlan,
        events: data.events,
      },
      affectedEntities,
      metadata,
    };

    return businessEvent;
  }

  private extractAffectedEntities(messageType: EdiMessageType, data: any): EdiBusinessEvent['affectedEntities'] {
    const entities: EdiBusinessEvent['affectedEntities'] = [];

    if (data.vessel) {
      entities.push({
        entityType: 'vessel',
        entityId: data.vessel.vesselName || data.vessel.vesselCode,
        action: 'update',
      });
    }

    if (data.containers && Array.isArray(data.containers)) {
      for (const container of data.containers) {
        entities.push({
          entityType: 'container',
          entityId: container.containerNumber,
          action: messageType === 'CODECO' ? 'status_change' : 'update',
        });
      }
    }

    if (data.booking) {
      entities.push({
        entityType: 'booking',
        entityId: data.booking.bookingNumber || data.booking.referenceNumber,
        action: 'update',
      });
    }

    return entities;
  }

  private async reconstructMessageData(message: EdiMessage): Promise<any> {
    // Реконструируем данные из сегментов EDI сообщения
    const data: any = {};

    switch (message.messageType) {
      case 'CODECO':
        data.containers = this.extractContainersFromSegments(message.segments);
        data.vessel = this.extractVesselFromSegments(message.segments);
        break;

      case 'COPRAR':
        data.events = this.extractEventsFromSegments(message.segments);
        data.containers = this.extractContainersFromSegments(message.segments);
        break;

      case 'BAPLIE':
        data.vessel = this.extractVesselFromSegments(message.segments);
        data.stowagePlan = this.extractStowageFromSegments(message.segments);
        break;

      default:
        // Для остальных типов просто копируем сегменты
        data.segments = message.segments;
    }

    return data;
  }

  private extractContainersFromSegments(segments: any[]): ContainerInfo[] {
    const containers: ContainerInfo[] = [];
    const eqdSegments = segments.filter(s => s.tag === 'EQD');

    for (const segment of eqdSegments) {
      containers.push({
        containerNumber: segment.elements[1] || '',
        containerType: segment.elements[0] || '',
        containerSize: segment.elements[2] || '',
      });
    }

    return containers;
  }

  private extractVesselFromSegments(segments: any[]): VesselInfo | null {
    const tdtSegment = segments.find(s => s.tag === 'TDT');
    if (!tdtSegment) {
      return null;
    }

    return {
      vesselName: tdtSegment.elements[7] || '',
      voyage: tdtSegment.elements[1] || '',
      portCode: 'RUMP',
    };
  }

  private extractEventsFromSegments(segments: any[]): any[] {
    const events: any[] = [];
    const stsSegments = segments.filter(s => s.tag === 'STS');

    for (const segment of stsSegments) {
      events.push({
        eventCode: segment.elements[0],
        eventDate: segment.elements[1],
        eventTime: segment.elements[2],
        location: segment.elements[3],
      });
    }

    return events;
  }

  private extractStowageFromSegments(segments: any[]): any {
    const locSegments = segments.filter(s => s.tag === 'LOC');
    
    return {
      occupiedLocations: locSegments
        .filter(s => s.elements[0] === '147')
        .map(s => s.elements[1]),
      emptyLocations: locSegments
        .filter(s => s.elements[0] === '11')
        .map(s => s.elements[1]),
    };
  }

  private buildMessageSummary(messages: EdiMessage[], stats: any, endpoint: IntegrationEndpoint): EdiMessageSummary {
    const messagesByType: Record<string, number> = {};
    const messagesByStatus: Record<string, number> = {};
    const errorsByType: Record<string, number> = {};
    const recentErrors: string[] = [];
    let totalProcessingTime = 0;
    let processedMessages = 0;

    for (const message of messages) {
      // Подсчет по типам
      messagesByType[message.messageType] = (messagesByType[message.messageType] || 0) + 1;
      
      // Подсчет по статусам
      messagesByStatus[message.status] = (messagesByStatus[message.status] || 0) + 1;

      // Ошибки
      if (message.status === 'error' && message.errors) {
        for (const error of message.errors) {
          errorsByType[error] = (errorsByType[error] || 0) + 1;
          if (recentErrors.length < 10) {
            recentErrors.push(`${message.messageId}: ${error}`);
          }
        }
      }
    }

    const recentMessages = messages
      .slice(-10)
      .map(message => ({
        messageId: message.messageId,
        messageType: message.messageType,
        timestamp: message.timestamp,
        status: message.status,
        partner: endpoint.name,
      }));

    const now = Date.now();
    const oneHour = 60 * 60 * 1000;
    const oneDay = 24 * oneHour;

    const messagesLastHour = messages.filter(m => 
      (now - m.timestamp.getTime()) < oneHour
    ).length;

    const messagesLastDay = messages.filter(m => 
      (now - m.timestamp.getTime()) < oneDay
    ).length;

    return {
      totalMessages: messages.length,
      messagesByType: messagesByType as any,
      messagesByStatus,
      messagesByPartner: { [endpoint.name]: messages.length },
      recentMessages,
      errorSummary: {
        totalErrors: Object.values(errorsByType).reduce((sum, count) => sum + count, 0),
        errorsByType,
        recentErrors,
      },
      throughputStats: {
        messagesPerHour: messagesLastHour,
        messagesPerDay: messagesLastDay,
        averageProcessingTime: processedMessages > 0 ? totalProcessingTime / processedMessages : 0,
      },
    };
  }

  private getValidationDetails(message: EdiMessage): any {
    return {
      hasHeader: message.segments.some(s => s.tag === 'UNH'),
      hasTrailer: message.segments.some(s => s.tag === 'UNT'),
      segmentCount: message.segments.length,
      messageTypeSpecific: this.getMessageTypeValidation(message),
    };
  }

  private getMessageTypeValidation(message: EdiMessage): any {
    switch (message.messageType) {
      case 'CODECO':
        return {
          hasContainers: message.segments.some(s => s.tag === 'EQD'),
          containerCount: message.segments.filter(s => s.tag === 'EQD').length,
        };
      case 'COPRAR':
        return {
          hasEvents: message.segments.some(s => s.tag === 'STS'),
          eventCount: message.segments.filter(s => s.tag === 'STS').length,
        };
      case 'BAPLIE':
        return {
          hasVessel: message.segments.some(s => s.tag === 'TDT'),
          hasLocations: message.segments.some(s => s.tag === 'LOC'),
        };
      default:
        return {};
    }
  }

  private setupEventListeners(): void {
    // Обрабатываем события от EDI адаптера
    this.eventEmitter.on('edi.message.received', this.handleMessageReceived.bind(this));
    this.eventEmitter.on('edi.message.sent', this.handleMessageSent.bind(this));
    this.eventEmitter.on('edi.message.error', this.handleMessageError.bind(this));
    this.eventEmitter.on('edi.acknowledgment.sent', this.handleAcknowledmentSent.bind(this));
  }

  private async handleMessageReceived(event: {
    endpointId: string;
    endpointName: string;
    message: EdiMessage;
    businessData: any;
    timestamp: Date;
  }): Promise<void> {
    try {
      const messageCount = this.processingMetrics.get(event.endpointId) || 0;
      this.processingMetrics.set(event.endpointId, messageCount + 1);

      this.logger.log(
        `📨 Получено EDI сообщение ${event.message.messageType} от ${event.endpointName}: ` +
        `${event.message.messageId}`
      );

      // Создаем бизнес-событие
      const businessEvent = await this.createBusinessEventFromIncoming(event.message, event.businessData);
      
      // Сохраняем событие
      this.businessEvents.set(businessEvent.eventId, businessEvent);

      // Сохраняем в историю
      const history = this.messageHistory.get(event.endpointId) || [];
      history.push(event.message);
      this.messageHistory.set(event.endpointId, history);

      // Создаем структурированные данные для трансформации
      const structuredData = this.createStructuredData(event);

      // Отправляем событие для дальнейшей обработки
      this.eventEmitter.emit('edi.business.event', {
        endpointId: event.endpointId,
        businessEvent,
        structuredData,
        timestamp: event.timestamp,
      });

    } catch (error) {
      this.logger.error('❌ Ошибка обработки полученного EDI сообщения:', error.message);
    }
  }

  private async createBusinessEventFromIncoming(
    message: EdiMessage,
    businessData: any,
  ): Promise<EdiBusinessEvent> {
    const eventId = `biz_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    let eventType: EdiBusinessEvent['eventType'];
    switch (message.messageType) {
      case 'CODECO':
        eventType = 'container_discharge';
        break;
      case 'COPRAR':
        eventType = 'container_discharge';
        break;
      case 'BAPLIE':
        eventType = 'stowage_plan';
        break;
      case 'COARRI':
        eventType = 'vessel_arrival';
        break;
      default:
        eventType = 'booking_update';
    }

    return {
      eventId,
      eventType,
      timestamp: message.timestamp,
      sourceMessage: {
        messageId: message.messageId,
        messageType: message.messageType,
        controlNumber: message.controlNumber,
      },
      businessData,
      affectedEntities: this.extractAffectedEntities(message.messageType, businessData),
    };
  }

  private createStructuredData(event: {
    endpointId: string;
    endpointName: string;
    message: EdiMessage;
    businessData: any;
    timestamp: Date;
  }): any {
    return {
      // Основные данные EDI
      edi: {
        messageId: event.message.messageId,
        messageType: event.message.messageType,
        controlNumber: event.message.controlNumber,
        version: event.message.version,
        timestamp: event.message.timestamp,
        status: event.message.status,
        segmentCount: event.message.segments.length,
      },

      // Бизнес-данные
      business: event.businessData,

      // Партнер
      partner: {
        endpointId: event.endpointId,
        endpointName: event.endpointName,
        sender: event.message.sender,
        receiver: event.message.receiver,
      },

      // Метаданные обработки
      processing: {
        timestamp: event.timestamp,
        messageCount: this.processingMetrics.get(event.endpointId) || 0,
      },
    };
  }

  private async handleMessageSent(event: {
    endpointId: string;
    endpointName: string;
    messageId: string;
    messageType: EdiMessageType;
    timestamp: Date;
  }): Promise<void> {
    this.logger.log(`📤 EDI сообщение ${event.messageType} отправлено: ${event.messageId}`);

    await this.metricsService.recordMessage(event.endpointId, 0, 0);
  }

  private async handleMessageError(event: {
    endpointId: string;
    messageId: string;
    error: string;
    timestamp: Date;
  }): Promise<void> {
    this.logger.error(`❌ EDI ошибка сообщения ${event.messageId}: ${event.error}`);

    await this.metricsService.recordError(event.endpointId, event.error, 0);
  }

  private async handleAcknowledmentSent(event: {
    endpointId: string;
    originalMessageId: string;
    acknowledgmentId: string;
    timestamp: Date;
  }): Promise<void> {
    this.logger.log(`📧 Подтверждение отправлено для сообщения ${event.originalMessageId}: ${event.acknowledgmentId}`);
  }

  // Публичные методы для внешнего использования
  async getMessages(endpointId?: string): Promise<EdiMessage[]> {
    return await this.ediAdapter.getMessages(endpointId);
  }

  async getMessage(messageId: string): Promise<EdiMessage | undefined> {
    return await this.ediAdapter.getMessage(messageId);
  }

  async getBusinessEvents(eventType?: EdiBusinessEvent['eventType']): Promise<EdiBusinessEvent[]> {
    const events = Array.from(this.businessEvents.values());
    
    if (eventType) {
      return events.filter(event => event.eventType === eventType);
    }
    
    return events;
  }

  async getBusinessEvent(eventId: string): Promise<EdiBusinessEvent | undefined> {
    return this.businessEvents.get(eventId);
  }

  async getMessageHistory(endpointId: string): Promise<EdiMessage[]> {
    return this.messageHistory.get(endpointId) || [];
  }

  async getProcessingStats(endpointId?: string) {
    const connectionStats = await this.ediAdapter.getConnectionStats(endpointId);
    const processedCount = endpointId ? 
      this.processingMetrics.get(endpointId) || 0 :
      Array.from(this.processingMetrics.values()).reduce((sum, count) => sum + count, 0);

    return {
      edi: connectionStats,
      processedMessages: processedCount,
      businessEvents: this.businessEvents.size,
      messageHistory: Array.from(this.messageHistory.values()).reduce((sum, messages) => sum + messages.length, 0),
      lastUpdate: new Date(),
    };
  }

  async testEdiConnection(endpoint: IntegrationEndpoint): Promise<boolean> {
    return await this.ediAdapter.testConnection(endpoint);
  }

  async clearMessageData(messageId?: string): Promise<void> {
    await this.ediAdapter.clearMessageCache(messageId);
    
    if (messageId) {
      // Удаляем связанные бизнес-события
      for (const [eventId, event] of this.businessEvents) {
        if (event.sourceMessage.messageId === messageId) {
          this.businessEvents.delete(eventId);
        }
      }
      
      this.logger.log(`🧹 Данные EDI сообщения ${messageId} очищены`);
    } else {
      this.businessEvents.clear();
      this.messageHistory.clear();
      this.processingMetrics.clear();
      this.logger.log('🧹 Все данные EDI сообщений очищены');
    }
  }

  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    details: any;
  }> {
    try {
      const stats = await this.getProcessingStats();
      
      const status = (stats.edi?.totalConnections || 0) > 0 ? 'healthy' : 
                    stats.processedMessages > 0 ? 'degraded' : 'unhealthy';
      
      return {
        status,
        details: {
          totalConnections: stats.edi?.totalConnections || 0,
          totalMessages: stats.edi?.totalMessages || 0,
          processedMessages: stats.processedMessages,
          businessEvents: stats.businessEvents,
          messageHistory: stats.messageHistory,
          lastUpdate: stats.lastUpdate,
        },
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        details: {
          error: error.message,
        },
      };
    }
  }
}