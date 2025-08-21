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
  port: 3004,
  cors: {
    origin: '*',
    credentials: true,
  },
  namespace: '/operations',
})
export class OperationsGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(OperationsGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly webSocketService: WebSocketService,
    private readonly subscriptionService: SubscriptionService,
    private readonly notificationService: NotificationService,
  ) {}

  afterInit(server: Server) {
    this.logger.log('🔌 Operations WebSocket Gateway инициализирован');
    
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
      this.logger.log(`🟢 Подключение к операциям: ${user.email} (${socket.id})`);

      // Создаем запись соединения
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
      socket.join('operations');

      // Отправляем приветственное сообщение
      socket.emit('operations:welcome', {
        message: 'Подключение к операциям установлено',
        socketId: socket.id,
        timestamp: new Date(),
        availableOperations: [
          'container_movements',
          'gate_operations',
          'yard_operations',
          'equipment_tracking',
          'order_management',
        ],
      });

      // Отправляем текущий статус операций
      const operationsStatus = await this.getOperationsStatus();
      socket.emit('operations:status', operationsStatus);

    } catch (error) {
      this.logger.error(`❌ Ошибка при подключении к операциям: ${error.message}`);
      socket.emit('operations:error', { message: 'Ошибка при установке соединения' });
      socket.disconnect();
    }
  }

  async handleDisconnect(socket: Socket) {
    const user = socket.data.user;
    this.logger.log(`🔴 Отключение от операций: ${user?.email} (${socket.id})`);

    try {
      await this.webSocketService.disconnectConnection(socket.id);
    } catch (error) {
      this.logger.error(`❌ Ошибка при отключении от операций: ${error.message}`);
    }
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('operations:subscribe_containers')
  async handleSubscribeContainers(
    @ConnectedSocket() socket: Socket,
    @MessageBody() data: { filters?: any; zones?: string[] },
  ) {
    const user = socket.data.user;
    this.logger.debug(`📦 Подписка на контейнеры: ${user.email}`);

    try {
      const subscription = await this.subscriptionService.createSubscription({
        userId: user.sub,
        connectionId: socket.id,
        type: 'CONTAINER_UPDATES',
        name: 'Container Movements',
        channel: 'containers',
        roomName: 'containers',
        filters: data.filters || [],
        settings: {
          updateFrequency: 2000,
          batchUpdates: true,
          batchSize: 10,
          batchInterval: 5000,
          priority: 'high',
          includeHistorical: true,
          maxHistoricalItems: 50,
          dataFormat: 'full',
          includeMetadata: true,
          compression: false,
          bufferEnabled: true,
          bufferSize: 100,
          bufferTimeout: 1000,
          geographicFilters: {
            enabled: !!data.zones?.length,
            zones: data.zones || [],
          },
          timeFilters: {
            enabled: false,
            timezone: user.timezone || 'UTC',
          },
        },
      });

      socket.join('containers');
      if (data.zones) {
        data.zones.forEach(zone => socket.join(`zone:${zone}`));
      }

      socket.emit('operations:container_subscription_success', {
        subscriptionId: subscription.id,
        channel: 'containers',
        filters: data.filters,
        zones: data.zones,
        timestamp: new Date(),
      });

      // Отправляем текущее состояние контейнеров
      const containerStatus = await this.getContainerStatus(data.filters, data.zones);
      socket.emit('operations:container_status', containerStatus);

    } catch (error) {
      this.logger.error(`❌ Ошибка подписки на контейнеры: ${error.message}`);
      socket.emit('operations:subscription_error', { 
        channel: 'containers',
        message: 'Ошибка при подписке на обновления контейнеров',
        error: error.message,
      });
    }
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('operations:subscribe_equipment')
  async handleSubscribeEquipment(
    @ConnectedSocket() socket: Socket,
    @MessageBody() data: { equipmentTypes?: string[]; zones?: string[] },
  ) {
    const user = socket.data.user;
    this.logger.debug(`🚛 Подписка на оборудование: ${user.email}`);

    try {
      const subscription = await this.subscriptionService.createSubscription({
        userId: user.sub,
        connectionId: socket.id,
        type: 'EQUIPMENT_STATUS',
        name: 'Equipment Tracking',
        channel: 'equipment',
        roomName: 'equipment',
        filters: data.equipmentTypes?.map(type => ({
          field: 'type',
          operator: 'EQUALS',
          value: type,
        })) || [],
        settings: {
          updateFrequency: 3000,
          batchUpdates: false,
          priority: 'high',
          includeHistorical: true,
          dataFormat: 'full',
          includeMetadata: true,
          compression: false,
          bufferEnabled: false,
          geographicFilters: {
            enabled: !!data.zones?.length,
            zones: data.zones || [],
          },
          timeFilters: {
            enabled: false,
            timezone: user.timezone || 'UTC',
          },
        },
      });

      socket.join('equipment');
      if (data.zones) {
        data.zones.forEach(zone => socket.join(`zone:${zone}`));
      }

      socket.emit('operations:equipment_subscription_success', {
        subscriptionId: subscription.id,
        channel: 'equipment',
        equipmentTypes: data.equipmentTypes,
        zones: data.zones,
        timestamp: new Date(),
      });

      // Отправляем текущее состояние оборудования
      const equipmentStatus = await this.getEquipmentStatus(data.equipmentTypes, data.zones);
      socket.emit('operations:equipment_status', equipmentStatus);

    } catch (error) {
      this.logger.error(`❌ Ошибка подписки на оборудование: ${error.message}`);
      socket.emit('operations:subscription_error', { 
        channel: 'equipment',
        message: 'Ошибка при подписке на обновления оборудования',
        error: error.message,
      });
    }
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('operations:subscribe_gate')
  async handleSubscribeGate(
    @ConnectedSocket() socket: Socket,
    @MessageBody() data: { gateIds?: string[] },
  ) {
    const user = socket.data.user;
    this.logger.debug(`🚪 Подписка на ворота: ${user.email}`);

    try {
      const subscription = await this.subscriptionService.createSubscription({
        userId: user.sub,
        connectionId: socket.id,
        type: 'GATE_OPERATIONS',
        name: 'Gate Operations',
        channel: 'gate',
        roomName: 'gate',
        filters: data.gateIds?.map(gateId => ({
          field: 'gateId',
          operator: 'EQUALS',
          value: gateId,
        })) || [],
        settings: {
          updateFrequency: 1000,
          batchUpdates: false,
          priority: 'critical',
          includeHistorical: true,
          dataFormat: 'full',
          includeMetadata: true,
          compression: false,
          bufferEnabled: false,
          timeFilters: {
            enabled: false,
            timezone: user.timezone || 'UTC',
          },
        },
      });

      socket.join('gate');
      if (data.gateIds) {
        data.gateIds.forEach(gateId => socket.join(`gate:${gateId}`));
      }

      socket.emit('operations:gate_subscription_success', {
        subscriptionId: subscription.id,
        channel: 'gate',
        gateIds: data.gateIds,
        timestamp: new Date(),
      });

      // Отправляем текущее состояние ворот
      const gateStatus = await this.getGateStatus(data.gateIds);
      socket.emit('operations:gate_status', gateStatus);

    } catch (error) {
      this.logger.error(`❌ Ошибка подписки на ворота: ${error.message}`);
      socket.emit('operations:subscription_error', { 
        channel: 'gate',
        message: 'Ошибка при подписке на обновления ворот',
        error: error.message,
      });
    }
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('operations:request_container_move')
  async handleRequestContainerMove(
    @ConnectedSocket() socket: Socket,
    @MessageBody() data: {
      containerId: string;
      fromLocation: { zone: string; area: string; position: string };
      toLocation: { zone: string; area: string; position: string };
      priority: 'low' | 'medium' | 'high' | 'urgent';
      reason: string;
    },
  ) {
    const user = socket.data.user;
    this.logger.log(`📦➡️ Запрос перемещения контейнера: ${data.containerId}`);

    try {
      // Создаем уведомление о новой задаче перемещения
      await this.notificationService.createNotification({
        type: 'OPERATION',
        priority: data.priority === 'urgent' ? 'URGENT' : 'MEDIUM',
        title: 'Новая задача перемещения контейнера',
        message: `Контейнер ${data.containerId} требует перемещения из ${data.fromLocation.zone} в ${data.toLocation.zone}`,
        shortMessage: `Перемещение контейнера ${data.containerId}`,
        category: 'container_movement',
        tags: ['operation', 'container', 'movement'],
        targetRole: 'YARD_OPERATOR',
        deliveryChannels: ['websocket', 'push'],
        data: {
          source: 'operations_gateway',
          sourceId: data.containerId,
          sourceType: 'container_move_request',
          relatedObjects: [{
            type: 'container',
            id: data.containerId,
            name: data.containerId,
            status: 'move_requested',
          }],
          location: {
            zone: data.fromLocation.zone,
            area: data.fromLocation.area,
          },
          metrics: {
            severity: data.priority === 'urgent' ? 9 : 5,
            impact: 'medium',
            urgency: data.priority === 'urgent' ? 'immediate' : 'medium',
          },
        },
      });

      // Эмитим событие для всех операторов двора
      this.server.to('role:YARD_OPERATOR').emit('operations:container_move_requested', {
        requestId: `move_${Date.now()}`,
        containerId: data.containerId,
        fromLocation: data.fromLocation,
        toLocation: data.toLocation,
        priority: data.priority,
        reason: data.reason,
        requestedBy: user.email,
        timestamp: new Date(),
      });

      socket.emit('operations:container_move_request_success', {
        containerId: data.containerId,
        message: 'Запрос на перемещение контейнера создан',
        timestamp: new Date(),
      });

    } catch (error) {
      this.logger.error(`❌ Ошибка запроса перемещения контейнера: ${error.message}`);
      socket.emit('operations:container_move_request_error', {
        containerId: data.containerId,
        message: 'Ошибка при создании запроса на перемещение',
        error: error.message,
      });
    }
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('operations:update_equipment_status')
  async handleUpdateEquipmentStatus(
    @ConnectedSocket() socket: Socket,
    @MessageBody() data: {
      equipmentId: string;
      status: 'available' | 'busy' | 'maintenance' | 'offline';
      location?: { x: number; y: number; zone: string };
      batteryLevel?: number;
      currentTask?: string;
    },
  ) {
    const user = socket.data.user;
    this.logger.debug(`🚛 Обновление статуса оборудования: ${data.equipmentId} -> ${data.status}`);

    try {
      // Эмитим обновление статуса оборудования
      this.server.to('equipment').emit('operations:equipment_status_updated', {
        equipmentId: data.equipmentId,
        status: data.status,
        location: data.location,
        batteryLevel: data.batteryLevel,
        currentTask: data.currentTask,
        updatedBy: user.email,
        timestamp: new Date(),
      });

      // Если оборудование перешло в статус "maintenance" или "offline"
      if (data.status === 'maintenance' || data.status === 'offline') {
        await this.notificationService.createNotification({
          type: 'EQUIPMENT',
          priority: data.status === 'offline' ? 'HIGH' : 'MEDIUM',
          title: 'Изменение статуса оборудования',
          message: `Оборудование ${data.equipmentId} перешло в статус "${data.status}"`,
          category: 'equipment_status',
          tags: ['equipment', 'status_change'],
          targetRole: 'MANAGER',
          deliveryChannels: ['websocket'],
          data: {
            source: 'operations_gateway',
            sourceId: data.equipmentId,
            sourceType: 'equipment_status_change',
            relatedObjects: [{
              type: 'equipment',
              id: data.equipmentId,
              name: data.equipmentId,
              status: data.status,
            }],
          },
        });
      }

      socket.emit('operations:equipment_status_update_success', {
        equipmentId: data.equipmentId,
        status: data.status,
        timestamp: new Date(),
      });

    } catch (error) {
      this.logger.error(`❌ Ошибка обновления статуса оборудования: ${error.message}`);
      socket.emit('operations:equipment_status_update_error', {
        equipmentId: data.equipmentId,
        message: 'Ошибка при обновлении статуса оборудования',
        error: error.message,
      });
    }
  }

  // Методы для отправки обновлений всем подключенным клиентам
  async broadcastContainerUpdate(data: any) {
    this.server.to('containers').emit('operations:container_update', {
      ...data,
      timestamp: new Date(),
    });
  }

  async broadcastEquipmentUpdate(data: any) {
    this.server.to('equipment').emit('operations:equipment_update', {
      ...data,
      timestamp: new Date(),
    });
  }

  async broadcastGateUpdate(data: any) {
    this.server.to('gate').emit('operations:gate_update', {
      ...data,
      timestamp: new Date(),
    });
  }

  async broadcastOperationAlert(data: any) {
    this.server.emit('operations:alert', {
      ...data,
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

  private async getOperationsStatus(): Promise<any> {
    // TODO: Получить реальный статус операций из базы данных
    return {
      activeOperations: 25,
      containersInMovement: 8,
      equipmentOnline: 12,
      gatesOperational: 4,
      queueLength: 6,
      averageProcessingTime: 8.5,
      lastUpdate: new Date(),
    };
  }

  private async getContainerStatus(filters?: any, zones?: string[]): Promise<any> {
    // TODO: Получить реальные данные контейнеров
    return {
      totalContainers: 1543,
      inMovement: 8,
      awaitingPickup: 45,
      inStorage: 1490,
      byZone: zones?.reduce((acc, zone) => {
        acc[zone] = Math.floor(Math.random() * 200) + 50;
        return acc;
      }, {}) || {},
      lastUpdate: new Date(),
    };
  }

  private async getEquipmentStatus(types?: string[], zones?: string[]): Promise<any> {
    // TODO: Получить реальные данные оборудования
    return {
      totalEquipment: 15,
      available: 10,
      busy: 3,
      maintenance: 1,
      offline: 1,
      byType: types?.reduce((acc, type) => {
        acc[type] = Math.floor(Math.random() * 5) + 1;
        return acc;
      }, {}) || {},
      lastUpdate: new Date(),
    };
  }

  private async getGateStatus(gateIds?: string[]): Promise<any> {
    // TODO: Получить реальные данные ворот
    return {
      totalGates: 4,
      operational: 4,
      averageWaitTime: 12,
      throughputToday: 156,
      byGate: gateIds?.reduce((acc, gateId) => {
        acc[gateId] = {
          status: 'operational',
          queueLength: Math.floor(Math.random() * 5),
          averageProcessingTime: Math.floor(Math.random() * 10) + 5,
        };
        return acc;
      }, {}) || {},
      lastUpdate: new Date(),
    };
  }
}