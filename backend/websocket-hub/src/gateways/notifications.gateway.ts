import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  ConnectedSocket,
  MessageBody,
  WsException,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, UseGuards } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { OnEvent } from '@nestjs/event-emitter';
import { WebSocketService } from '../services/websocket.service';
import { NotificationService } from '../services/notification.service';
import { WsJwtGuard } from '../guards/ws-jwt.guard';
import { 
  Notification, 
  NotificationType, 
  NotificationPriority 
} from '../entities/notification.entity';

@WebSocketGateway({
  port: 3006,
  cors: {
    origin: '*',
    credentials: true,
  },
  namespace: '/notifications',
})
export class NotificationsGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(NotificationsGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly webSocketService: WebSocketService,
    private readonly notificationService: NotificationService,
  ) {}

  afterInit(server: Server) {
    this.logger.log('🔌 Notifications WebSocket Gateway инициализирован');
    
    server.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');
        
        if (!token) {
          throw new WsException('Токен не предоставлен');
        }

        const payload = this.jwtService.verify(token);
        socket.data.user = payload;
        
        this.logger.debug(`🔐 Аутентификация пользователя: ${payload.sub}`);
        next();
      } catch (error) {
        this.logger.error(`❌ Ошибка аутентификации: ${error.message}`);
        next(error);
      }
    });
  }

  async handleConnection(socket: Socket) {
    try {
      const user = socket.data.user;
      this.logger.log(`🟢 Подключение к уведомлениям: ${user.email} (${socket.id})`);

      await this.webSocketService.createConnection(socket.id, user, {
        userAgent: socket.handshake.headers['user-agent'],
        ipAddress: socket.handshake.address,
        browser: this.parseUserAgent(socket.handshake.headers['user-agent']),
        language: socket.handshake.headers['accept-language'],
        timezone: 'UTC',
      });

      // Присоединяем к комнатам
      socket.join(`user:${user.sub}`);
      socket.join(`role:${user.role}`);
      socket.join('notifications');

      // Отправляем приветственное сообщение
      socket.emit('notifications:welcome', {
        message: 'Подключение к системе уведомлений установлено',
        socketId: socket.id,
        timestamp: new Date(),
        supportedTypes: Object.values(NotificationType),
        supportedPriorities: Object.values(NotificationPriority),
      });

      // Отправляем непрочитанные уведомления
      const unreadNotifications = await this.notificationService.getUnreadNotifications(user.sub);
      if (unreadNotifications.length > 0) {
        socket.emit('notifications:unread_batch', {
          notifications: unreadNotifications,
          count: unreadNotifications.length,
          timestamp: new Date(),
        });
      }

      // Отправляем статистику уведомлений
      const stats = await this.getNotificationStats(user.sub);
      socket.emit('notifications:stats', stats);

    } catch (error) {
      this.logger.error(`❌ Ошибка подключения к уведомлениям: ${error.message}`);
      socket.emit('notifications:error', { message: 'Ошибка при установке соединения' });
      socket.disconnect();
    }
  }

  async handleDisconnect(socket: Socket) {
    const user = socket.data.user;
    this.logger.log(`🔴 Отключение от уведомлений: ${user?.email} (${socket.id})`);

    try {
      await this.webSocketService.disconnectConnection(socket.id);
    } catch (error) {
      this.logger.error(`❌ Ошибка отключения от уведомлений: ${error.message}`);
    }
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('notifications:get_history')
  async handleGetHistory(
    @ConnectedSocket() socket: Socket,
    @MessageBody() data: { 
      limit?: number; 
      offset?: number;
      types?: NotificationType[];
      priorities?: NotificationPriority[];
      dateFrom?: Date;
      dateTo?: Date;
    },
  ) {
    const user = socket.data.user;
    this.logger.debug(`📋 Запрос истории уведомлений: ${user.email}`);

    try {
      const notifications = await this.notificationService.getUserNotifications(
        user.sub,
        undefined,
        data.limit || 50
      );

      // Фильтруем по типам и приоритетам если указаны
      let filteredNotifications = notifications;
      
      if (data.types?.length) {
        filteredNotifications = filteredNotifications.filter(n => data.types.includes(n.type));
      }
      
      if (data.priorities?.length) {
        filteredNotifications = filteredNotifications.filter(n => data.priorities.includes(n.priority));
      }

      if (data.dateFrom) {
        filteredNotifications = filteredNotifications.filter(n => n.createdAt >= data.dateFrom);
      }

      if (data.dateTo) {
        filteredNotifications = filteredNotifications.filter(n => n.createdAt <= data.dateTo);
      }

      socket.emit('notifications:history', {
        notifications: filteredNotifications,
        total: filteredNotifications.length,
        filters: {
          types: data.types,
          priorities: data.priorities,
          dateFrom: data.dateFrom,
          dateTo: data.dateTo,
        },
        timestamp: new Date(),
      });

    } catch (error) {
      this.logger.error(`❌ Ошибка получения истории уведомлений: ${error.message}`);
      socket.emit('notifications:history_error', {
        message: 'Ошибка при получении истории уведомлений',
        error: error.message,
      });
    }
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('notifications:mark_read')
  async handleMarkAsRead(
    @ConnectedSocket() socket: Socket,
    @MessageBody() data: { notificationIds: string[] },
  ) {
    const user = socket.data.user;
    this.logger.debug(`✅ Отметка уведомлений как прочитанные: ${data.notificationIds.length} шт.`);

    try {
      await this.notificationService.markMultipleAsRead(data.notificationIds, user.sub);

      socket.emit('notifications:marked_read', {
        notificationIds: data.notificationIds,
        timestamp: new Date(),
      });

      // Обновляем статистику
      const stats = await this.getNotificationStats(user.sub);
      socket.emit('notifications:stats', stats);

    } catch (error) {
      this.logger.error(`❌ Ошибка отметки уведомлений как прочитанные: ${error.message}`);
      socket.emit('notifications:mark_read_error', {
        notificationIds: data.notificationIds,
        message: 'Ошибка при отметке уведомлений как прочитанные',
        error: error.message,
      });
    }
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('notifications:mark_all_read')
  async handleMarkAllAsRead(
    @ConnectedSocket() socket: Socket,
  ) {
    const user = socket.data.user;
    this.logger.debug(`✅ Отметка всех уведомлений как прочитанные: ${user.email}`);

    try {
      const unreadNotifications = await this.notificationService.getUnreadNotifications(user.sub);
      const notificationIds = unreadNotifications.map(n => n.id);

      if (notificationIds.length > 0) {
        await this.notificationService.markMultipleAsRead(notificationIds, user.sub);
      }

      socket.emit('notifications:all_marked_read', {
        count: notificationIds.length,
        timestamp: new Date(),
      });

      // Обновляем статистику
      const stats = await this.getNotificationStats(user.sub);
      socket.emit('notifications:stats', stats);

    } catch (error) {
      this.logger.error(`❌ Ошибка отметки всех уведомлений как прочитанные: ${error.message}`);
      socket.emit('notifications:mark_all_read_error', {
        message: 'Ошибка при отметке всех уведомлений как прочитанные',
        error: error.message,
      });
    }
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('notifications:delete')
  async handleDeleteNotifications(
    @ConnectedSocket() socket: Socket,
    @MessageBody() data: { notificationIds: string[] },
  ) {
    const user = socket.data.user;
    this.logger.debug(`🗑️ Удаление уведомлений: ${data.notificationIds.length} шт.`);

    try {
      for (const notificationId of data.notificationIds) {
        // Проверяем права доступа перед удалением
        const notification = await this.notificationService.getNotification(notificationId);
        if (notification && notification.userId === user.sub) {
          await this.notificationService.deleteNotification(notificationId);
        }
      }

      socket.emit('notifications:deleted', {
        notificationIds: data.notificationIds,
        timestamp: new Date(),
      });

      // Обновляем статистику
      const stats = await this.getNotificationStats(user.sub);
      socket.emit('notifications:stats', stats);

    } catch (error) {
      this.logger.error(`❌ Ошибка удаления уведомлений: ${error.message}`);
      socket.emit('notifications:delete_error', {
        notificationIds: data.notificationIds,
        message: 'Ошибка при удалении уведомлений',
        error: error.message,
      });
    }
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('notifications:get_stats')
  async handleGetStats(@ConnectedSocket() socket: Socket) {
    const user = socket.data.user;

    try {
      const stats = await this.getNotificationStats(user.sub);
      socket.emit('notifications:stats', stats);
    } catch (error) {
      this.logger.error(`❌ Ошибка получения статистики уведомлений: ${error.message}`);
      socket.emit('notifications:stats_error', {
        message: 'Ошибка при получении статистики уведомлений',
        error: error.message,
      });
    }
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('notifications:subscribe_types')
  async handleSubscribeToTypes(
    @ConnectedSocket() socket: Socket,
    @MessageBody() data: { 
      types: NotificationType[];
      priorities?: NotificationPriority[];
    },
  ) {
    const user = socket.data.user;
    this.logger.debug(`🔔 Подписка на типы уведомлений: ${data.types.join(', ')}`);

    try {
      // Присоединяемся к комнатам по типам
      for (const type of data.types) {
        socket.join(`type:${type}`);
      }

      // Присоединяемся к комнатам по приоритетам
      if (data.priorities?.length) {
        for (const priority of data.priorities) {
          socket.join(`priority:${priority}`);
        }
      }

      socket.emit('notifications:subscription_success', {
        types: data.types,
        priorities: data.priorities,
        timestamp: new Date(),
      });

    } catch (error) {
      this.logger.error(`❌ Ошибка подписки на типы уведомлений: ${error.message}`);
      socket.emit('notifications:subscription_error', {
        types: data.types,
        message: 'Ошибка при подписке на типы уведомлений',
        error: error.message,
      });
    }
  }

  // Event Handlers для автоматической отправки уведомлений
  @OnEvent('websocket.send_notification')
  async handleSendNotification(event: { notification: Notification; targets: string[] }) {
    this.logger.debug(`📤 Отправка уведомления через WebSocket: ${event.notification.id}`);

    try {
      const notificationData = {
        id: event.notification.id,
        type: event.notification.type,
        priority: event.notification.priority,
        title: event.notification.title,
        message: event.notification.message,
        shortMessage: event.notification.shortMessage,
        category: event.notification.category,
        tags: event.notification.tags,
        data: event.notification.data,
        displaySettings: event.notification.displaySettings,
        createdAt: event.notification.createdAt,
        expiresAt: event.notification.expiresAt,
        typeIcon: event.notification.typeIcon,
        priorityIcon: event.notification.priorityIcon,
        timestamp: new Date(),
      };

      // Отправляем уведомление по целевым комнатам
      for (const target of event.targets) {
        this.server.to(target).emit('notifications:new', notificationData);
      }

      // Также отправляем в комнаты по типу и приоритету
      this.server.to(`type:${event.notification.type}`).emit('notifications:new', notificationData);
      this.server.to(`priority:${event.notification.priority}`).emit('notifications:new', notificationData);

    } catch (error) {
      this.logger.error(`❌ Ошибка отправки уведомления через WebSocket: ${error.message}`);
    }
  }

  @OnEvent('browser.send_notification')
  async handleBrowserNotification(event: { notification: Notification; targets: string[] }) {
    this.logger.debug(`🌐 Отправка браузерного уведомления: ${event.notification.id}`);

    try {
      const browserNotificationData = {
        title: event.notification.title,
        body: event.notification.shortMessage || event.notification.message,
        icon: event.notification.displaySettings?.icon || '/icons/notification.png',
        badge: '/icons/badge.png',
        tag: event.notification.id,
        requireInteraction: event.notification.isHighPriority,
        actions: event.notification.data.actions?.slice(0, 2).map(action => ({
          action: action.id,
          title: action.label,
          icon: action.style === 'primary' ? '/icons/primary-action.png' : '/icons/secondary-action.png',
        })) || [],
        data: {
          notificationId: event.notification.id,
          type: event.notification.type,
          timestamp: new Date(),
        },
      };

      // Отправляем команду на показ браузерного уведомления
      for (const target of event.targets) {
        this.server.to(target).emit('notifications:browser_show', browserNotificationData);
      }

    } catch (error) {
      this.logger.error(`❌ Ошибка отправки браузерного уведомления: ${error.message}`);
    }
  }

  // Методы для отправки специальных уведомлений
  async broadcastSystemAlert(alert: any) {
    this.server.emit('notifications:system_alert', {
      ...alert,
      timestamp: new Date(),
    });
  }

  async broadcastMaintenanceNotice(notice: any) {
    this.server.emit('notifications:maintenance_notice', {
      ...notice,
      timestamp: new Date(),
    });
  }

  async sendToUser(userId: string, notification: any) {
    this.server.to(`user:${userId}`).emit('notifications:personal', {
      ...notification,
      timestamp: new Date(),
    });
  }

  async sendToRole(role: string, notification: any) {
    this.server.to(`role:${role}`).emit('notifications:role_based', {
      ...notification,
      timestamp: new Date(),
    });
  }

  // Приватные методы
  private parseUserAgent(userAgent: string): any {
    return {
      name: 'Unknown',
      version: 'Unknown',
    };
  }

  private async getNotificationStats(userId: string): Promise<any> {
    try {
      const [
        allNotifications,
        unreadNotifications,
        criticalNotifications,
      ] = await Promise.all([
        this.notificationService.getUserNotifications(userId, undefined, 1000),
        this.notificationService.getUnreadNotifications(userId),
        this.notificationService.getUserNotifications(userId, undefined, 100)
          .then(notifications => notifications.filter(n => n.isCritical)),
      ]);

      const byType = allNotifications.reduce((acc, notification) => {
        acc[notification.type] = (acc[notification.type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const byPriority = allNotifications.reduce((acc, notification) => {
        acc[notification.priority] = (acc[notification.priority] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      return {
        total: allNotifications.length,
        unread: unreadNotifications.length,
        critical: criticalNotifications.length,
        read: allNotifications.length - unreadNotifications.length,
        byType,
        byPriority,
        lastNotificationAt: allNotifications[0]?.createdAt || null,
        timestamp: new Date(),
      };

    } catch (error) {
      this.logger.error(`❌ Ошибка получения статистики уведомлений: ${error.message}`);
      return {
        total: 0,
        unread: 0,
        critical: 0,
        read: 0,
        byType: {},
        byPriority: {},
        lastNotificationAt: null,
        timestamp: new Date(),
      };
    }
  }
}