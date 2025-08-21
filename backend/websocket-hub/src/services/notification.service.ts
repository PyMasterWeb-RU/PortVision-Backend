import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere, In, Between } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { 
  Notification, 
  NotificationType, 
  NotificationPriority, 
  NotificationStatus,
  DeliveryChannel 
} from '../entities/notification.entity';

export interface CreateNotificationDto {
  type: NotificationType;
  priority: NotificationPriority;
  title: string;
  message: string;
  shortMessage?: string;
  category?: string;
  tags?: string[];
  userId?: string;
  targetRole?: string;
  targetGroup?: string;
  targetZone?: string;
  deliveryChannels: DeliveryChannel[];
  data: {
    source: string;
    sourceId?: string;
    sourceType?: string;
    actions?: Array<{
      id: string;
      label: string;
      type: 'button' | 'link' | 'api_call';
      url?: string;
      method?: string;
      payload?: any;
      style?: 'primary' | 'secondary' | 'success' | 'warning' | 'danger';
    }>;
    attachments?: Array<{
      type: 'image' | 'document' | 'video' | 'audio';
      url: string;
      name: string;
      size?: number;
      mimeType?: string;
    }>;
    location?: {
      zone: string;
      area: string;
      coordinates?: {
        x: number;
        y: number;
        z?: number;
      };
    };
    relatedObjects?: Array<{
      type: 'container' | 'equipment' | 'order' | 'person';
      id: string;
      name: string;
      status?: string;
    }>;
    metrics?: {
      severity: number;
      impact: 'low' | 'medium' | 'high' | 'critical';
      urgency: 'low' | 'medium' | 'high' | 'immediate';
      estimatedResolutionTime?: number;
    };
    context?: {
      workShift?: string;
      weather?: string;
      systemLoad?: number;
      activeOperations?: number;
    };
  };
  displaySettings?: {
    icon?: string;
    color?: string;
    sound?: string;
    duration?: number;
    position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center';
    modal?: boolean;
    dismissible?: boolean;
    autoHide?: boolean;
    animation?: 'fade' | 'slide' | 'bounce' | 'shake';
    badge?: {
      text: string;
      color: string;
    };
    progress?: {
      show: boolean;
      value?: number;
      max?: number;
    };
  };
  deliveryRules?: {
    immediate: boolean;
    batchDelivery?: boolean;
    batchInterval?: number;
    maxRetries?: number;
    retryInterval?: number;
    failureEscalation?: {
      enabled: boolean;
      escalateAfter: number;
      escalateTo: string;
    };
    deliveryWindow?: {
      startHour: number;
      endHour: number;
      timezone: string;
      weekdaysOnly?: boolean;
    };
    conditions?: Array<{
      field: string;
      operator: 'equals' | 'not_equals' | 'contains' | 'greater_than' | 'less_than';
      value: any;
    }>;
  };
  expiresAt?: Date;
}

export interface UpdateNotificationDto {
  status?: NotificationStatus;
  deliveryChannels?: DeliveryChannel[];
  data?: Partial<CreateNotificationDto['data']>;
  displaySettings?: Partial<CreateNotificationDto['displaySettings']>;
  deliveryRules?: Partial<CreateNotificationDto['deliveryRules']>;
  expiresAt?: Date;
}

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepository: Repository<Notification>,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async createNotification(createDto: CreateNotificationDto): Promise<Notification> {
    this.logger.log(`Создание уведомления: ${createDto.title} (${createDto.type})`);

    const notification = this.notificationRepository.create({
      ...createDto,
      status: NotificationStatus.PENDING,
      deliveryHistory: [],
      deliveryAttempts: 0,
    });

    const savedNotification = await this.notificationRepository.save(notification);

    this.eventEmitter.emit('notification.created', {
      notificationId: savedNotification.id,
      type: savedNotification.type,
      priority: savedNotification.priority,
      userId: savedNotification.userId,
      targetRole: savedNotification.targetRole,
      immediate: savedNotification.deliveryRules?.immediate,
    });

    // Если требуется немедленная доставка
    if (createDto.deliveryRules?.immediate !== false) {
      await this.deliverNotification(savedNotification.id);
    }

    return savedNotification;
  }

  async getNotification(id: string): Promise<Notification | null> {
    return this.notificationRepository.findOne({ where: { id } });
  }

  async getUserNotifications(
    userId: string, 
    status?: NotificationStatus,
    limit: number = 50
  ): Promise<Notification[]> {
    const where: FindOptionsWhere<Notification> = { userId };
    if (status) {
      where.status = status;
    }

    return this.notificationRepository.find({
      where,
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  async getUnreadNotifications(userId: string): Promise<Notification[]> {
    return this.getUserNotifications(userId, NotificationStatus.DELIVERED);
  }

  async getRoleNotifications(
    role: string, 
    status?: NotificationStatus,
    limit: number = 50
  ): Promise<Notification[]> {
    const where: FindOptionsWhere<Notification> = { targetRole: role };
    if (status) {
      where.status = status;
    }

    return this.notificationRepository.find({
      where,
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  async getNotificationsByType(
    type: NotificationType,
    hours: number = 24
  ): Promise<Notification[]> {
    const since = new Date();
    since.setHours(since.getHours() - hours);

    return this.notificationRepository.find({
      where: {
        type,
        createdAt: Between(since, new Date()),
      },
      order: { createdAt: 'DESC' },
    });
  }

  async getCriticalNotifications(): Promise<Notification[]> {
    return this.notificationRepository.find({
      where: [
        { priority: NotificationPriority.CRITICAL },
        { priority: NotificationPriority.URGENT },
      ],
      order: { createdAt: 'DESC' },
      take: 100,
    });
  }

  async updateNotification(id: string, updateDto: UpdateNotificationDto): Promise<Notification> {
    const notification = await this.getNotification(id);
    if (!notification) {
      throw new NotFoundException(`Уведомление ${id} не найдено`);
    }

    Object.assign(notification, updateDto);
    const updatedNotification = await this.notificationRepository.save(notification);

    this.eventEmitter.emit('notification.updated', {
      notificationId: updatedNotification.id,
      userId: updatedNotification.userId,
      changes: updateDto,
    });

    return updatedNotification;
  }

  async markAsRead(id: string, userId?: string): Promise<Notification> {
    const notification = await this.getNotification(id);
    if (!notification) {
      throw new NotFoundException(`Уведомление ${id} не найдено`);
    }

    // Проверяем права доступа
    if (userId && notification.userId && notification.userId !== userId) {
      throw new NotFoundException(`Уведомление ${id} не найдено`);
    }

    const updatedNotification = await this.updateNotification(id, {
      status: NotificationStatus.read,
    });

    await this.recordDeliveryEvent(id, DeliveryChannel.WEBSOCKET, 'success', {
      action: 'read',
      timestamp: new Date(),
    });

    return updatedNotification;
  }

  async markMultipleAsRead(ids: string[], userId?: string): Promise<void> {
    const notifications = await this.notificationRepository.find({
      where: { id: In(ids) },
    });

    const validIds = notifications
      .filter(n => !userId || !n.userId || n.userId === userId)
      .map(n => n.id);

    if (validIds.length > 0) {
      await this.notificationRepository.update(
        { id: In(validIds) },
        { 
          status: NotificationStatus.read,
          readAt: new Date(),
        }
      );

      this.logger.log(`Отмечено как прочитанные ${validIds.length} уведомлений`);
    }
  }

  async deliverNotification(id: string): Promise<void> {
    const notification = await this.getNotification(id);
    if (!notification) {
      throw new NotFoundException(`Уведомление ${id} не найдено`);
    }

    if (notification.status !== NotificationStatus.PENDING) {
      this.logger.warn(`Уведомление ${id} уже обработано (${notification.status})`);
      return;
    }

    try {
      // Проверяем условия доставки
      if (!this.shouldDeliver(notification)) {
        this.logger.debug(`Уведомление ${id} не соответствует условиям доставки`);
        return;
      }

      // Отправляем через все указанные каналы
      const deliveryPromises = notification.deliveryChannels.map(channel => 
        this.deliverViaChannel(notification, channel)
      );

      await Promise.allSettled(deliveryPromises);

      // Обновляем статус
      await this.updateNotification(id, {
        status: NotificationStatus.SENT,
      });

      await this.notificationRepository.update(
        { id },
        { 
          sentAt: new Date(),
          deliveryAttempts: notification.deliveryAttempts + 1,
        }
      );

      this.eventEmitter.emit('notification.delivered', {
        notificationId: id,
        channels: notification.deliveryChannels,
        timestamp: new Date(),
      });

    } catch (error) {
      this.logger.error(`Ошибка доставки уведомления ${id}: ${error.message}`);
      
      await this.updateNotification(id, {
        status: NotificationStatus.FAILED,
      });

      await this.recordDeliveryEvent(id, DeliveryChannel.WEBSOCKET, 'failed', {
        error: error.message,
        timestamp: new Date(),
      });

      // Если включена эскалация ошибок
      if (notification.deliveryRules?.failureEscalation?.enabled) {
        await this.escalateFailedNotification(notification);
      }
    }
  }

  async retryFailedNotifications(): Promise<number> {
    const failedNotifications = await this.notificationRepository.find({
      where: { status: NotificationStatus.FAILED },
      order: { createdAt: 'ASC' },
      take: 100,
    });

    let retryCount = 0;

    for (const notification of failedNotifications) {
      const maxRetries = notification.deliveryRules?.maxRetries || 3;
      
      if (notification.deliveryAttempts < maxRetries) {
        try {
          await this.deliverNotification(notification.id);
          retryCount++;
        } catch (error) {
          this.logger.error(`Повторная попытка доставки ${notification.id} не удалась: ${error.message}`);
        }
      }
    }

    this.logger.log(`Повторно отправлено ${retryCount} уведомлений`);
    return retryCount;
  }

  async deleteNotification(id: string): Promise<void> {
    const notification = await this.getNotification(id);
    if (!notification) {
      throw new NotFoundException(`Уведомление ${id} не найдено`);
    }

    await this.notificationRepository.remove(notification);

    this.eventEmitter.emit('notification.deleted', {
      notificationId: id,
      userId: notification.userId,
      type: notification.type,
    });
  }

  async cleanupOldNotifications(daysOld: number = 30): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const result = await this.notificationRepository.delete({
      createdAt: cutoffDate,
      status: In([NotificationStatus.read, NotificationStatus.EXPIRED, NotificationStatus.FAILED]),
    });

    this.logger.log(`Удалено ${result.affected} старых уведомлений`);
    return result.affected || 0;
  }

  async expireOldNotifications(): Promise<number> {
    const now = new Date();

    const result = await this.notificationRepository.update(
      {
        expiresAt: now,
        status: In([NotificationStatus.PENDING, NotificationStatus.SENT, NotificationStatus.DELIVERED]),
      },
      {
        status: NotificationStatus.EXPIRED,
      }
    );

    this.logger.log(`Помечено как истекшие ${result.affected} уведомлений`);
    return result.affected || 0;
  }

  async getNotificationStatistics(): Promise<any> {
    const [
      totalNotifications,
      notificationsByType,
      notificationsByPriority,
      notificationsByStatus,
      notificationsByChannel,
      recentActivity,
    ] = await Promise.all([
      this.notificationRepository.count(),
      this.notificationRepository.query(`
        SELECT type, COUNT(*) as count
        FROM websocket.notifications
        GROUP BY type
        ORDER BY count DESC
      `),
      this.notificationRepository.query(`
        SELECT priority, COUNT(*) as count
        FROM websocket.notifications
        GROUP BY priority
        ORDER BY count DESC
      `),
      this.notificationRepository.query(`
        SELECT status, COUNT(*) as count
        FROM websocket.notifications
        GROUP BY status
        ORDER BY count DESC
      `),
      this.notificationRepository.query(`
        SELECT unnest(delivery_channels) as channel, COUNT(*) as count
        FROM websocket.notifications
        GROUP BY channel
        ORDER BY count DESC
      `),
      this.notificationRepository.query(`
        SELECT 
          DATE_TRUNC('hour', created_at) as hour,
          COUNT(*) as count,
          COUNT(*) FILTER (WHERE status = 'delivered') as delivered,
          COUNT(*) FILTER (WHERE status = 'failed') as failed
        FROM websocket.notifications
        WHERE created_at >= NOW() - INTERVAL '24 hours'
        GROUP BY hour
        ORDER BY hour DESC
        LIMIT 24
      `),
    ]);

    // Получаем метрики производительности
    const performanceMetrics = await this.notificationRepository.query(`
      SELECT 
        AVG(EXTRACT(EPOCH FROM (delivered_at - sent_at))) as avg_delivery_time,
        AVG(EXTRACT(EPOCH FROM (read_at - delivered_at))) as avg_response_time,
        AVG(delivery_attempts) as avg_delivery_attempts
      FROM websocket.notifications
      WHERE sent_at IS NOT NULL
      AND delivered_at IS NOT NULL
    `);

    return {
      totals: {
        totalNotifications,
        avgDeliveryTime: parseFloat(performanceMetrics[0]?.avg_delivery_time || 0),
        avgResponseTime: parseFloat(performanceMetrics[0]?.avg_response_time || 0),
        avgDeliveryAttempts: parseFloat(performanceMetrics[0]?.avg_delivery_attempts || 0),
      },
      breakdown: {
        byType: notificationsByType,
        byPriority: notificationsByPriority,
        byStatus: notificationsByStatus,
        byChannel: notificationsByChannel,
      },
      activity: recentActivity,
    };
  }

  async getHighPriorityNotifications(hours: number = 1): Promise<Notification[]> {
    const since = new Date();
    since.setHours(since.getHours() - hours);

    return this.notificationRepository.find({
      where: {
        priority: In([NotificationPriority.HIGH, NotificationPriority.URGENT, NotificationPriority.CRITICAL]),
        createdAt: Between(since, new Date()),
      },
      order: { createdAt: 'DESC' },
    });
  }

  async getFailedNotifications(): Promise<Notification[]> {
    return this.notificationRepository.find({
      where: { status: NotificationStatus.FAILED },
      order: { createdAt: 'DESC' },
      take: 100,
    });
  }

  private shouldDeliver(notification: Notification): boolean {
    // Проверяем срок действия
    if (notification.expiresAt && notification.expiresAt < new Date()) {
      return false;
    }

    // Проверяем временные окна доставки
    const rules = notification.deliveryRules;
    if (rules?.deliveryWindow) {
      const now = new Date();
      const currentHour = now.getHours();
      
      if (currentHour < rules.deliveryWindow.startHour || 
          currentHour > rules.deliveryWindow.endHour) {
        return false;
      }

      if (rules.deliveryWindow.weekdaysOnly) {
        const dayOfWeek = now.getDay();
        if (dayOfWeek === 0 || dayOfWeek === 6) { // выходные
          return false;
        }
      }
    }

    // Проверяем пользовательские условия
    if (rules?.conditions && rules.conditions.length > 0) {
      // Здесь можно добавить логику проверки условий
      // Пока возвращаем true
    }

    return true;
  }

  private async deliverViaChannel(notification: Notification, channel: DeliveryChannel): Promise<void> {
    this.logger.debug(`Доставка уведомления ${notification.id} через канал ${channel}`);

    switch (channel) {
      case DeliveryChannel.WEBSOCKET:
        await this.deliverViaWebSocket(notification);
        break;
      case DeliveryChannel.EMAIL:
        await this.deliverViaEmail(notification);
        break;
      case DeliveryChannel.SMS:
        await this.deliverViaSMS(notification);
        break;
      case DeliveryChannel.PUSH:
        await this.deliverViaPush(notification);
        break;
      case DeliveryChannel.BROWSER:
        await this.deliverViaBrowser(notification);
        break;
      case DeliveryChannel.SYSTEM_TRAY:
        await this.deliverViaSystemTray(notification);
        break;
      default:
        throw new Error(`Неподдерживаемый канал доставки: ${channel}`);
    }

    await this.recordDeliveryEvent(notification.id, channel, 'success');
  }

  private async deliverViaWebSocket(notification: Notification): Promise<void> {
    // Отправляем через WebSocket
    this.eventEmitter.emit('websocket.send_notification', {
      notification,
      targets: this.getWebSocketTargets(notification),
    });
  }

  private async deliverViaEmail(notification: Notification): Promise<void> {
    // TODO: Интеграция с email сервисом
    this.logger.debug(`Email доставка для уведомления ${notification.id}`);
  }

  private async deliverViaSMS(notification: Notification): Promise<void> {
    // TODO: Интеграция с SMS сервисом
    this.logger.debug(`SMS доставка для уведомления ${notification.id}`);
  }

  private async deliverViaPush(notification: Notification): Promise<void> {
    // TODO: Интеграция с push сервисом
    this.logger.debug(`Push доставка для уведомления ${notification.id}`);
  }

  private async deliverViaBrowser(notification: Notification): Promise<void> {
    // Отправляем через браузерные уведомления
    this.eventEmitter.emit('browser.send_notification', {
      notification,
      targets: this.getWebSocketTargets(notification),
    });
  }

  private async deliverViaSystemTray(notification: Notification): Promise<void> {
    // TODO: Интеграция с системными уведомлениями
    this.logger.debug(`System tray доставка для уведомления ${notification.id}`);
  }

  private getWebSocketTargets(notification: Notification): string[] {
    const targets = [];

    if (notification.userId) {
      targets.push(`user:${notification.userId}`);
    }

    if (notification.targetRole) {
      targets.push(`role:${notification.targetRole}`);
    }

    if (notification.targetGroup) {
      targets.push(`group:${notification.targetGroup}`);
    }

    if (notification.targetZone) {
      targets.push(`zone:${notification.targetZone}`);
    }

    return targets;
  }

  private async recordDeliveryEvent(
    notificationId: string, 
    channel: DeliveryChannel, 
    status: 'success' | 'failed' | 'retry',
    metadata?: Record<string, any>
  ): Promise<void> {
    const notification = await this.getNotification(notificationId);
    if (!notification) return;

    const event = {
      channel,
      status,
      timestamp: new Date(),
      ...metadata,
    };

    const updatedHistory = [...(notification.deliveryHistory || []), event];

    await this.notificationRepository.update(
      { id: notificationId },
      { deliveryHistory: updatedHistory }
    );
  }

  private async escalateFailedNotification(notification: Notification): Promise<void> {
    const escalation = notification.deliveryRules?.failureEscalation;
    if (!escalation?.enabled) return;

    // Создаем эскалированное уведомление
    await this.createNotification({
      type: NotificationType.ALERT,
      priority: NotificationPriority.URGENT,
      title: `Ошибка доставки уведомления: ${notification.title}`,
      message: `Не удалось доставить уведомление ${notification.id}. Требуется вмешательство.`,
      category: 'system_escalation',
      tags: ['escalation', 'delivery_failure'],
      targetRole: escalation.escalateTo,
      deliveryChannels: [DeliveryChannel.WEBSOCKET, DeliveryChannel.EMAIL],
      data: {
        source: 'notification_system',
        sourceId: notification.id,
        sourceType: 'failed_notification',
        relatedObjects: [{
          type: 'order',
          id: notification.id,
          name: notification.title,
          status: 'failed',
        }],
        metrics: {
          severity: 8,
          impact: 'high',
          urgency: 'immediate',
        },
      },
    });
  }
}