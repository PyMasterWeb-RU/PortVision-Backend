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
import { WebSocketService } from '../services/websocket.service';
import { SubscriptionService } from '../services/subscription.service';
import { NotificationService } from '../services/notification.service';
import { WsJwtGuard } from '../guards/ws-jwt.guard';

@WebSocketGateway({
  port: 3003,
  cors: {
    origin: '*',
    credentials: true,
  },
  namespace: '/terminal',
})
export class TerminalGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(TerminalGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly webSocketService: WebSocketService,
    private readonly subscriptionService: SubscriptionService,
    private readonly notificationService: NotificationService,
  ) {}

  afterInit(server: Server) {
    this.logger.log('🔌 Terminal WebSocket Gateway инициализирован');
    
    // Настройка middleware для аутентификации
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
      this.logger.log(`🟢 Подключение: ${user.email} (${socket.id})`);

      // Создаем запись соединения
      await this.webSocketService.createConnection(socket.id, user, {
        userAgent: socket.handshake.headers['user-agent'],
        ipAddress: socket.handshake.address,
        browser: this.parseUserAgent(socket.handshake.headers['user-agent']),
        language: socket.handshake.headers['accept-language'],
        timezone: 'UTC', // TODO: получить из клиента
      });

      // Присоединяем к пользовательской комнате
      socket.join(`user:${user.sub}`);
      socket.join(`role:${user.role}`);

      // Отправляем приветственное сообщение
      socket.emit('connection:welcome', {
        message: 'Добро пожаловать в PortVision 360!',
        socketId: socket.id,
        timestamp: new Date(),
        serverTime: new Date(),
        features: [
          'realtime_updates',
          'notifications',
          'digital_twin',
          'equipment_tracking',
        ],
      });

      // Отправляем статус терминала
      const terminalStatus = await this.getTerminalStatus();
      socket.emit('terminal:status', terminalStatus);

      // Загружаем активные подписки пользователя
      const subscriptions = await this.subscriptionService.getUserSubscriptions(user.sub);
      for (const subscription of subscriptions) {
        socket.join(subscription.roomName);
      }

      // Отправляем непрочитанные уведомления
      const notifications = await this.notificationService.getUnreadNotifications(user.sub);
      if (notifications.length > 0) {
        socket.emit('notifications:unread', notifications);
      }

    } catch (error) {
      this.logger.error(`❌ Ошибка при подключении: ${error.message}`);
      socket.emit('connection:error', { message: 'Ошибка при установке соединения' });
      socket.disconnect();
    }
  }

  async handleDisconnect(socket: Socket) {
    const user = socket.data.user;
    this.logger.log(`🔴 Отключение: ${user?.email} (${socket.id})`);

    try {
      await this.webSocketService.updateConnection(socket.id, {
        status: 'disconnected',
        disconnectedAt: new Date(),
      });
    } catch (error) {
      this.logger.error(`❌ Ошибка при отключении: ${error.message}`);
    }
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('terminal:subscribe')
  async handleTerminalSubscribe(
    @ConnectedSocket() socket: Socket,
    @MessageBody() data: { channels: string[]; filters?: any },
  ) {
    const user = socket.data.user;
    this.logger.debug(`📡 Подписка на каналы терминала: ${data.channels.join(', ')}`);

    try {
      for (const channel of data.channels) {
        const subscription = await this.subscriptionService.createSubscription({
          userId: user.sub,
          connectionId: socket.id,
          type: this.mapChannelToType(channel),
          name: `Terminal ${channel}`,
          channel,
          roomName: channel,
          filters: data.filters?.[channel] || [],
          settings: {
            updateFrequency: 1000,
            batchUpdates: false,
            priority: 'medium',
            includeHistorical: false,
            dataFormat: 'full',
            includeMetadata: true,
            compression: false,
            bufferEnabled: false,
          },
        });

        socket.join(channel);
        
        socket.emit('terminal:subscribed', {
          channel,
          subscriptionId: subscription.id,
          timestamp: new Date(),
        });
      }

      await this.webSocketService.updateConnection(socket.id, {
        subscriptions: data.channels,
        rooms: data.channels,
      });

    } catch (error) {
      this.logger.error(`❌ Ошибка подписки: ${error.message}`);
      socket.emit('terminal:subscription_error', { 
        message: 'Ошибка при оформлении подписки',
        error: error.message,
      });
    }
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('terminal:unsubscribe')
  async handleTerminalUnsubscribe(
    @ConnectedSocket() socket: Socket,
    @MessageBody() data: { channels: string[] },
  ) {
    const user = socket.data.user;
    this.logger.debug(`📡 Отписка от каналов: ${data.channels.join(', ')}`);

    try {
      for (const channel of data.channels) {
        await this.subscriptionService.cancelSubscription(user.sub, channel);
        socket.leave(channel);
        
        socket.emit('terminal:unsubscribed', {
          channel,
          timestamp: new Date(),
        });
      }
    } catch (error) {
      this.logger.error(`❌ Ошибка отписки: ${error.message}`);
      socket.emit('terminal:unsubscription_error', { 
        message: 'Ошибка при отписке',
        error: error.message,
      });
    }
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('terminal:ping')
  async handlePing(
    @ConnectedSocket() socket: Socket,
    @MessageBody() data: { timestamp: number },
  ) {
    const latency = Date.now() - data.timestamp;
    
    await this.webSocketService.updateConnectionMetrics(socket.id, {
      latency,
      lastPing: new Date(),
      lastActivity: new Date(),
    });

    socket.emit('terminal:pong', {
      timestamp: data.timestamp,
      serverTime: Date.now(),
      latency,
    });
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('terminal:get_status')
  async handleGetStatus(@ConnectedSocket() socket: Socket) {
    try {
      const status = await this.getTerminalStatus();
      socket.emit('terminal:status', status);
    } catch (error) {
      this.logger.error(`❌ Ошибка получения статуса: ${error.message}`);
      socket.emit('terminal:status_error', { 
        message: 'Ошибка получения статуса терминала',
        error: error.message,
      });
    }
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('terminal:request_data')
  async handleRequestData(
    @ConnectedSocket() socket: Socket,
    @MessageBody() data: { 
      type: 'containers' | 'equipment' | 'operations' | 'personnel';
      filters?: any;
      limit?: number;
    },
  ) {
    try {
      const responseData = await this.getTerminalData(data.type, data.filters, data.limit);
      
      socket.emit('terminal:data_response', {
        type: data.type,
        data: responseData,
        timestamp: new Date(),
        filters: data.filters,
      });

    } catch (error) {
      this.logger.error(`❌ Ошибка получения данных: ${error.message}`);
      socket.emit('terminal:data_error', { 
        message: 'Ошибка получения данных терминала',
        type: data.type,
        error: error.message,
      });
    }
  }

  // Методы для отправки обновлений всем подключенным клиентам
  async broadcastTerminalUpdate(data: any) {
    this.server.emit('terminal:update', {
      ...data,
      timestamp: new Date(),
    });
  }

  async broadcastToRoom(room: string, event: string, data: any) {
    this.server.to(room).emit(event, {
      ...data,
      timestamp: new Date(),
    });
  }

  async sendToUser(userId: string, event: string, data: any) {
    this.server.to(`user:${userId}`).emit(event, {
      ...data,
      timestamp: new Date(),
    });
  }

  async sendToRole(role: string, event: string, data: any) {
    this.server.to(`role:${role}`).emit(event, {
      ...data,
      timestamp: new Date(),
    });
  }

  // Приватные методы
  private parseUserAgent(userAgent: string): any {
    // Простая функция парсинга User-Agent
    // В реальном проекте лучше использовать библиотеку типа 'ua-parser-js'
    return {
      name: 'Unknown',
      version: 'Unknown',
    };
  }

  private mapChannelToType(channel: string): any {
    const channelMap = {
      'containers': 'CONTAINER_UPDATES',
      'equipment': 'EQUIPMENT_STATUS',
      'operations': 'GATE_OPERATIONS',
      'yard': 'YARD_MOVEMENTS',
      'orders': 'ORDER_CHANGES',
      'personnel': 'PERSONNEL_LOCATION',
      'alerts': 'SYSTEM_ALERTS',
      'weather': 'WEATHER_UPDATES',
      'security': 'SECURITY_EVENTS',
      'maintenance': 'MAINTENANCE_REQUESTS',
      'billing': 'BILLING_UPDATES',
    };

    return channelMap[channel] || 'CUSTOM';
  }

  private async getTerminalStatus(): Promise<any> {
    // TODO: Получить реальный статус терминала из базы данных
    return {
      operationalStatus: 'operational',
      currentShift: {
        id: 'shift-001',
        startTime: new Date(),
        supervisor: 'Иванов И.И.',
      },
      statistics: {
        containersInYard: 1234,
        activeEquipment: 15,
        operationsToday: 89,
        averageProcessingTime: 45,
      },
      weather: {
        temperature: 15,
        humidity: 65,
        windSpeed: 12,
        conditions: 'cloudy',
      },
      alerts: {
        critical: 0,
        warning: 2,
        info: 5,
      },
    };
  }

  private async getTerminalData(type: string, filters?: any, limit?: number): Promise<any> {
    // TODO: Получить реальные данные из соответствующих сервисов
    const mockData = {
      containers: [],
      equipment: [],
      operations: [],
      personnel: [],
    };

    return mockData[type] || [];
  }
}