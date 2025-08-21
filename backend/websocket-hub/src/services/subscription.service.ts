import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere, In } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { 
  Subscription, 
  SubscriptionType, 
  SubscriptionStatus, 
  FilterOperator 
} from '../entities/subscription.entity';

export interface CreateSubscriptionDto {
  userId: string;
  connectionId: string;
  type: SubscriptionType;
  name: string;
  description?: string;
  channel: string;
  roomName: string;
  filters?: Array<{
    field: string;
    operator: FilterOperator;
    value: any;
    logicalOperator?: 'AND' | 'OR';
  }>;
  settings: {
    updateFrequency: number;
    batchUpdates: boolean;
    batchSize?: number;
    batchInterval?: number;
    priority: 'low' | 'medium' | 'high' | 'critical';
    includeHistorical: boolean;
    maxHistoricalItems?: number;
    dataFormat: 'full' | 'minimal' | 'custom';
    includeMetadata: boolean;
    compression: boolean;
    bufferEnabled: boolean;
    bufferSize?: number;
    bufferTimeout?: number;
    deliveryConditions?: {
      onlyIfChanged: boolean;
      significantChangeThreshold?: number;
      minimumInterval?: number;
      maxQueueSize?: number;
    };
    geographicFilters?: {
      enabled: boolean;
      zones?: string[];
      radius?: {
        center: { x: number; y: number };
        distance: number;
      };
      boundingBox?: {
        minX: number;
        maxX: number;
        minY: number;
        maxY: number;
      };
    };
    timeFilters?: {
      enabled: boolean;
      startTime?: string;
      endTime?: string;
      weekdays?: number[];
      timezone: string;
    };
  };
  notificationConfig?: {
    enabled: boolean;
    types: string[];
    priority: 'low' | 'medium' | 'high' | 'urgent';
    sound: boolean;
    vibration: boolean;
    badge: boolean;
    grouping: {
      enabled: boolean;
      groupBy: string;
      maxGroupSize: number;
      groupTimeout: number;
    };
    deduplication: {
      enabled: boolean;
      keyFields: string[];
      timeWindow: number;
    };
  };
  tags?: string[];
  metadata?: Record<string, any>;
  expiresAt?: Date;
  autoRenew?: boolean;
}

export interface UpdateSubscriptionDto {
  status?: SubscriptionStatus;
  settings?: Partial<CreateSubscriptionDto['settings']>;
  notificationConfig?: Partial<CreateSubscriptionDto['notificationConfig']>;
  filters?: CreateSubscriptionDto['filters'];
  tags?: string[];
  metadata?: Record<string, any>;
  expiresAt?: Date;
  autoRenew?: boolean;
}

@Injectable()
export class SubscriptionService {
  private readonly logger = new Logger(SubscriptionService.name);

  constructor(
    @InjectRepository(Subscription)
    private readonly subscriptionRepository: Repository<Subscription>,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async createSubscription(createDto: CreateSubscriptionDto): Promise<Subscription> {
    this.logger.log(`Создание подписки: ${createDto.name} для пользователя ${createDto.userId}`);

    // Проверяем дубликаты
    const existing = await this.subscriptionRepository.findOne({
      where: {
        userId: createDto.userId,
        channel: createDto.channel,
        status: SubscriptionStatus.ACTIVE,
      },
    });

    if (existing) {
      this.logger.warn(`Подписка уже существует: ${existing.id}`);
      return existing;
    }

    const subscription = this.subscriptionRepository.create({
      ...createDto,
      status: SubscriptionStatus.ACTIVE,
      statistics: {
        totalMessages: 0,
        messagesThisHour: 0,
        messagesThisDay: 0,
        averageMessageSize: 0,
        totalBytesTransferred: 0,
        peakMessagesPerHour: 0,
        errorCount: 0,
        averageLatency: 0,
        eventTypeStats: {},
      },
      lastActivityAt: new Date(),
    });

    const savedSubscription = await this.subscriptionRepository.save(subscription);

    this.eventEmitter.emit('subscription.created', {
      subscriptionId: savedSubscription.id,
      userId: savedSubscription.userId,
      type: savedSubscription.type,
      channel: savedSubscription.channel,
    });

    return savedSubscription;
  }

  async getSubscription(id: string): Promise<Subscription | null> {
    return this.subscriptionRepository.findOne({ where: { id } });
  }

  async getUserSubscriptions(userId: string, status?: SubscriptionStatus): Promise<Subscription[]> {
    const where: FindOptionsWhere<Subscription> = { userId };
    if (status) {
      where.status = status;
    }

    return this.subscriptionRepository.find({
      where,
      order: { createdAt: 'DESC' },
    });
  }

  async getActiveSubscriptions(): Promise<Subscription[]> {
    return this.subscriptionRepository.find({
      where: { status: SubscriptionStatus.ACTIVE },
      order: { createdAt: 'DESC' },
    });
  }

  async getSubscriptionsByType(type: SubscriptionType, status?: SubscriptionStatus): Promise<Subscription[]> {
    const where: FindOptionsWhere<Subscription> = { type };
    if (status) {
      where.status = status;
    }

    return this.subscriptionRepository.find({
      where,
      order: { createdAt: 'DESC' },
    });
  }

  async getSubscriptionsByChannel(channel: string, status?: SubscriptionStatus): Promise<Subscription[]> {
    const where: FindOptionsWhere<Subscription> = { channel };
    if (status) {
      where.status = status;
    }

    return this.subscriptionRepository.find({
      where,
      order: { createdAt: 'DESC' },
    });
  }

  async updateSubscription(id: string, updateDto: UpdateSubscriptionDto): Promise<Subscription> {
    const subscription = await this.getSubscription(id);
    if (!subscription) {
      throw new NotFoundException(`Подписка ${id} не найдена`);
    }

    Object.assign(subscription, updateDto);
    const updatedSubscription = await this.subscriptionRepository.save(subscription);

    this.eventEmitter.emit('subscription.updated', {
      subscriptionId: updatedSubscription.id,
      userId: updatedSubscription.userId,
      changes: updateDto,
    });

    return updatedSubscription;
  }

  async pauseSubscription(id: string): Promise<Subscription> {
    return this.updateSubscription(id, { status: SubscriptionStatus.PAUSED });
  }

  async resumeSubscription(id: string): Promise<Subscription> {
    return this.updateSubscription(id, { status: SubscriptionStatus.ACTIVE });
  }

  async cancelSubscription(userId: string, channel: string): Promise<void> {
    const subscription = await this.subscriptionRepository.findOne({
      where: { userId, channel, status: SubscriptionStatus.ACTIVE },
    });

    if (subscription) {
      await this.updateSubscription(subscription.id, { status: SubscriptionStatus.INACTIVE });
    }
  }

  async deleteSubscription(id: string): Promise<void> {
    const subscription = await this.getSubscription(id);
    if (!subscription) {
      throw new NotFoundException(`Подписка ${id} не найдена`);
    }

    await this.subscriptionRepository.remove(subscription);

    this.eventEmitter.emit('subscription.deleted', {
      subscriptionId: id,
      userId: subscription.userId,
      type: subscription.type,
      channel: subscription.channel,
    });
  }

  async updateStatistics(
    subscriptionId: string, 
    updates: Partial<Subscription['statistics']>
  ): Promise<void> {
    const subscription = await this.getSubscription(subscriptionId);
    if (!subscription) return;

    const currentStats = subscription.statistics || {
      totalMessages: 0,
      messagesThisHour: 0,
      messagesThisDay: 0,
      averageMessageSize: 0,
      totalBytesTransferred: 0,
      peakMessagesPerHour: 0,
      errorCount: 0,
      averageLatency: 0,
      eventTypeStats: {},
    };

    const updatedStats = {
      ...currentStats,
      ...updates,
      lastMessageAt: new Date(),
    };

    await this.subscriptionRepository.update(
      { id: subscriptionId },
      { 
        statistics: updatedStats,
        lastActivityAt: new Date(),
      }
    );
  }

  async incrementMessageCount(subscriptionId: string, messageSize: number = 0): Promise<void> {
    const subscription = await this.getSubscription(subscriptionId);
    if (!subscription) return;

    const stats = subscription.statistics;
    await this.updateStatistics(subscriptionId, {
      totalMessages: stats.totalMessages + 1,
      messagesThisHour: stats.messagesThisHour + 1,
      messagesThisDay: stats.messagesThisDay + 1,
      totalBytesTransferred: stats.totalBytesTransferred + messageSize,
      averageMessageSize: ((stats.averageMessageSize * stats.totalMessages) + messageSize) / (stats.totalMessages + 1),
    });
  }

  async recordLatency(subscriptionId: string, latency: number): Promise<void> {
    const subscription = await this.getSubscription(subscriptionId);
    if (!subscription) return;

    const stats = subscription.statistics;
    const newAverage = ((stats.averageLatency * stats.totalMessages) + latency) / (stats.totalMessages + 1);

    await this.updateStatistics(subscriptionId, {
      averageLatency: newAverage,
    });
  }

  async recordError(subscriptionId: string): Promise<void> {
    const subscription = await this.getSubscription(subscriptionId);
    if (!subscription) return;

    const stats = subscription.statistics;
    await this.updateStatistics(subscriptionId, {
      errorCount: stats.errorCount + 1,
      lastErrorAt: new Date(),
    });
  }

  async getSubscriptionStatistics(): Promise<any> {
    const [
      totalSubscriptions,
      activeSubscriptions,
      subscriptionsByType,
      subscriptionsByStatus,
      topChannels,
    ] = await Promise.all([
      this.subscriptionRepository.count(),
      this.subscriptionRepository.count({ where: { status: SubscriptionStatus.ACTIVE } }),
      this.subscriptionRepository.query(`
        SELECT type, COUNT(*) as count
        FROM websocket.subscriptions
        GROUP BY type
        ORDER BY count DESC
      `),
      this.subscriptionRepository.query(`
        SELECT status, COUNT(*) as count
        FROM websocket.subscriptions
        GROUP BY status
        ORDER BY count DESC
      `),
      this.subscriptionRepository.query(`
        SELECT channel, COUNT(*) as count
        FROM websocket.subscriptions
        WHERE status = 'active'
        GROUP BY channel
        ORDER BY count DESC
        LIMIT 10
      `),
    ]);

    // Получаем статистику сообщений
    const messageStats = await this.subscriptionRepository.query(`
      SELECT 
        SUM((statistics->>'totalMessages')::numeric) as total_messages,
        AVG((statistics->>'averageLatency')::numeric) as avg_latency,
        SUM((statistics->>'errorCount')::numeric) as total_errors,
        SUM((statistics->>'totalBytesTransferred')::numeric) as total_bytes
      FROM websocket.subscriptions
      WHERE status = 'active'
      AND statistics IS NOT NULL
    `);

    return {
      totals: {
        totalSubscriptions,
        activeSubscriptions,
        totalMessages: parseInt(messageStats[0]?.total_messages || 0),
        totalErrors: parseInt(messageStats[0]?.total_errors || 0),
        totalBytes: parseInt(messageStats[0]?.total_bytes || 0),
        averageLatency: parseFloat(messageStats[0]?.avg_latency || 0),
      },
      breakdown: {
        byType: subscriptionsByType,
        byStatus: subscriptionsByStatus,
        topChannels,
      },
    };
  }

  async getHighVolumeSubscriptions(threshold: number = 1000): Promise<Subscription[]> {
    return this.subscriptionRepository
      .createQueryBuilder('subscription')
      .where('subscription.status = :status', { status: SubscriptionStatus.ACTIVE })
      .andWhere('(subscription.statistics->>\\'messagesThisHour\\')::numeric > :threshold', { threshold })
      .orderBy('(subscription.statistics->>\\'messagesThisHour\\')::numeric', 'DESC')
      .getMany();
  }

  async getHighLatencySubscriptions(threshold: number = 1000): Promise<Subscription[]> {
    return this.subscriptionRepository
      .createQueryBuilder('subscription')
      .where('subscription.status = :status', { status: SubscriptionStatus.ACTIVE })
      .andWhere('(subscription.statistics->>\\'averageLatency\\')::numeric > :threshold', { threshold })
      .orderBy('(subscription.statistics->>\\'averageLatency\\')::numeric', 'DESC')
      .getMany();
  }

  async getSubscriptionsNearExpiry(hoursThreshold: number = 24): Promise<Subscription[]> {
    const threshold = new Date();
    threshold.setHours(threshold.getHours() + hoursThreshold);

    return this.subscriptionRepository.find({
      where: {
        status: SubscriptionStatus.ACTIVE,
        expiresAt: threshold,
      },
      order: { expiresAt: 'ASC' },
    });
  }

  async cleanupExpiredSubscriptions(): Promise<number> {
    const now = new Date();
    
    const expiredSubscriptions = await this.subscriptionRepository.find({
      where: {
        expiresAt: now,
        autoRenew: false,
      },
    });

    if (expiredSubscriptions.length > 0) {
      await this.subscriptionRepository.update(
        { id: In(expiredSubscriptions.map(s => s.id)) },
        { status: SubscriptionStatus.EXPIRED }
      );

      this.logger.log(`Отмечено как истекшие ${expiredSubscriptions.length} подписок`);
    }

    return expiredSubscriptions.length;
  }

  async renewExpiredSubscriptions(): Promise<number> {
    const now = new Date();
    const oneMonthFromNow = new Date();
    oneMonthFromNow.setMonth(oneMonthFromNow.getMonth() + 1);
    
    const subscriptionsToRenew = await this.subscriptionRepository.find({
      where: {
        expiresAt: now,
        autoRenew: true,
        status: SubscriptionStatus.ACTIVE,
      },
    });

    if (subscriptionsToRenew.length > 0) {
      await this.subscriptionRepository.update(
        { id: In(subscriptionsToRenew.map(s => s.id)) },
        { expiresAt: oneMonthFromNow }
      );

      this.logger.log(`Продлено ${subscriptionsToRenew.length} подписок`);
    }

    return subscriptionsToRenew.length;
  }

  async resetHourlyCounters(): Promise<void> {
    await this.subscriptionRepository.query(`
      UPDATE websocket.subscriptions
      SET statistics = jsonb_set(statistics, '{messagesThisHour}', '0')
      WHERE status = 'active'
    `);

    this.logger.log('Сброшены почасовые счетчики сообщений');
  }

  async resetDailyCounters(): Promise<void> {
    // Сохраняем текущие дневные значения как пиковые
    await this.subscriptionRepository.query(`
      UPDATE websocket.subscriptions
      SET statistics = jsonb_set(
        jsonb_set(statistics, '{peakMessagesPerHour}', 
          CASE 
            WHEN (statistics->>'messagesThisDay')::numeric > (statistics->>'peakMessagesPerHour')::numeric 
            THEN statistics->'messagesThisDay' 
            ELSE statistics->'peakMessagesPerHour' 
          END
        ), 
        '{messagesThisDay}', '0'
      )
      WHERE status = 'active'
    `);

    this.logger.log('Сброшены дневные счетчики сообщений');
  }

  async getSubscriptionHealth(): Promise<{
    healthy: number;
    degraded: number;
    critical: number;
    details: any[];
  }> {
    const subscriptions = await this.getActiveSubscriptions();
    
    let healthy = 0;
    let degraded = 0;
    let critical = 0;
    const details = [];

    for (const subscription of subscriptions) {
      const score = subscription.performanceScore;
      const status = subscription.healthStatus;

      switch (status) {
        case 'excellent':
        case 'good':
          healthy++;
          break;
        case 'fair':
          degraded++;
          details.push({
            id: subscription.id,
            userId: subscription.userId,
            channel: subscription.channel,
            status: 'degraded',
            score,
            issues: ['High latency', 'Error rate above threshold'],
          });
          break;
        case 'poor':
          critical++;
          details.push({
            id: subscription.id,
            userId: subscription.userId,
            channel: subscription.channel,
            status: 'critical',
            score,
            issues: ['Very high latency', 'High error rate', 'No recent activity'],
          });
          break;
      }
    }

    return { healthy, degraded, critical, details };
  }
}