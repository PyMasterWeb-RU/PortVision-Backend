import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ConfigService } from '@nestjs/config';

export interface DomainEvent {
  eventId: string;
  eventType: string;
  aggregateId: string;
  aggregateType: string;
  version: number;
  occurredAt: Date;
  data: Record<string, any>;
  userId?: string;
  correlationId?: string;
}

@Injectable()
export class EventBusService {
  private readonly logger = new Logger(EventBusService.name);

  constructor(
    private readonly eventEmitter: EventEmitter2,
    private readonly configService: ConfigService,
  ) {}

  async publishEvent(event: DomainEvent): Promise<void> {
    try {
      this.logger.debug(`Publishing event: ${event.eventType}`, {
        eventId: event.eventId,
        aggregateId: event.aggregateId,
        aggregateType: event.aggregateType,
      });

      // Публикация в локальном event bus
      this.eventEmitter.emit(event.eventType, event);

      // TODO: Публикация в Kafka для межсервисного взаимодействия
      await this.publishToKafka(event);

    } catch (error) {
      this.logger.error(`Failed to publish event: ${event.eventType}`, error);
      throw error;
    }
  }

  async publishEvents(events: DomainEvent[]): Promise<void> {
    for (const event of events) {
      await this.publishEvent(event);
    }
  }

  private async publishToKafka(event: DomainEvent): Promise<void> {
    // TODO: Реализация публикации в Kafka
    // Будет добавлено в integration service
    this.logger.debug(`Would publish to Kafka: ${event.eventType}`);
  }

  // Метод для создания доменного события
  createEvent<T = any>(
    eventType: string,
    aggregateId: string,
    aggregateType: string,
    data: T,
    options: {
      version?: number;
      userId?: string;
      correlationId?: string;
    } = {},
  ): DomainEvent {
    return {
      eventId: this.generateEventId(),
      eventType,
      aggregateId,
      aggregateType,
      version: options.version || 1,
      occurredAt: new Date(),
      data: data as Record<string, any>,
      userId: options.userId,
      correlationId: options.correlationId,
    };
  }

  private generateEventId(): string {
    return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}