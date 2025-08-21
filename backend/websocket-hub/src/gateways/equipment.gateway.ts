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
  port: 3005,
  cors: {
    origin: '*',
    credentials: true,
  },
  namespace: '/equipment',
})
export class EquipmentGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(EquipmentGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly webSocketService: WebSocketService,
    private readonly subscriptionService: SubscriptionService,
    private readonly notificationService: NotificationService,
  ) {}

  afterInit(server: Server) {
    this.logger.log('🔌 Equipment WebSocket Gateway инициализирован');
    
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
      this.logger.log(`🟢 Подключение к оборудованию: ${user.email} (${socket.id})`);

      await this.webSocketService.createConnection(socket.id, user, {
        userAgent: socket.handshake.headers['user-agent'],
        ipAddress: socket.handshake.address,
        browser: this.parseUserAgent(socket.handshake.headers['user-agent']),
        language: socket.handshake.headers['accept-language'],
        timezone: 'UTC',
      });

      socket.join(`user:${user.sub}`);
      socket.join(`role:${user.role}`);
      socket.join('equipment');

      socket.emit('equipment:welcome', {
        message: 'Подключение к системе управления оборудованием установлено',
        socketId: socket.id,
        timestamp: new Date(),
        supportedEquipment: [
          'reach_stacker',
          'forklift',
          'crane',
          'truck',
          'trailer',
          'scanner',
          'weighbridge',
        ],
      });

      const equipmentStatus = await this.getEquipmentOverview();
      socket.emit('equipment:overview', equipmentStatus);

    } catch (error) {
      this.logger.error(`❌ Ошибка подключения к оборудованию: ${error.message}`);
      socket.emit('equipment:error', { message: 'Ошибка при установке соединения' });
      socket.disconnect();
    }
  }

  async handleDisconnect(socket: Socket) {
    const user = socket.data.user;
    this.logger.log(`🔴 Отключение от оборудования: ${user?.email} (${socket.id})`);

    try {
      await this.webSocketService.disconnectConnection(socket.id);
    } catch (error) {
      this.logger.error(`❌ Ошибка отключения от оборудования: ${error.message}`);
    }
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('equipment:track_unit')
  async handleTrackEquipment(
    @ConnectedSocket() socket: Socket,
    @MessageBody() data: { equipmentId: string; includeHistory?: boolean },
  ) {
    const user = socket.data.user;
    this.logger.debug(`🚛 Отслеживание оборудования: ${data.equipmentId}`);

    try {
      const subscription = await this.subscriptionService.createSubscription({
        userId: user.sub,
        connectionId: socket.id,
        type: 'EQUIPMENT_STATUS',
        name: `Equipment Tracking: ${data.equipmentId}`,
        channel: `equipment:${data.equipmentId}`,
        roomName: `equipment:${data.equipmentId}`,
        filters: [{
          field: 'equipmentId',
          operator: 'EQUALS',
          value: data.equipmentId,
        }],
        settings: {
          updateFrequency: 2000,
          batchUpdates: false,
          priority: 'high',
          includeHistorical: data.includeHistory || false,
          maxHistoricalItems: 100,
          dataFormat: 'full',
          includeMetadata: true,
          compression: false,
          bufferEnabled: false,
          geographicFilters: {
            enabled: true,
          },
          timeFilters: {
            enabled: false,
            timezone: user.timezone || 'UTC',
          },
        },
      });

      socket.join(`equipment:${data.equipmentId}`);

      socket.emit('equipment:tracking_started', {
        equipmentId: data.equipmentId,
        subscriptionId: subscription.id,
        timestamp: new Date(),
      });

      // Отправляем текущий статус оборудования
      const equipmentData = await this.getEquipmentData(data.equipmentId);
      socket.emit('equipment:unit_status', equipmentData);

      // Если нужна история, отправляем её
      if (data.includeHistory) {
        const history = await this.getEquipmentHistory(data.equipmentId);
        socket.emit('equipment:unit_history', {
          equipmentId: data.equipmentId,
          history,
          timestamp: new Date(),
        });
      }

    } catch (error) {
      this.logger.error(`❌ Ошибка отслеживания оборудования: ${error.message}`);
      socket.emit('equipment:tracking_error', {
        equipmentId: data.equipmentId,
        message: 'Ошибка при установке отслеживания оборудования',
        error: error.message,
      });
    }
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('equipment:update_location')
  async handleUpdateLocation(
    @ConnectedSocket() socket: Socket,
    @MessageBody() data: {
      equipmentId: string;
      location: {
        x: number;
        y: number;
        z?: number;
        zone: string;
        area?: string;
        heading?: number;
        speed?: number;
      };
      accuracy?: number;
    },
  ) {
    const user = socket.data.user;
    this.logger.debug(`📍 Обновление позиции оборудования: ${data.equipmentId}`);

    try {
      // Эмитим обновление позиции всем подписанным клиентам
      this.server.to(`equipment:${data.equipmentId}`).emit('equipment:location_updated', {
        equipmentId: data.equipmentId,
        location: data.location,
        accuracy: data.accuracy,
        timestamp: new Date(),
        updatedBy: user.email,
      });

      // Также отправляем в общий канал оборудования
      this.server.to('equipment').emit('equipment:unit_moved', {
        equipmentId: data.equipmentId,
        location: data.location,
        timestamp: new Date(),
      });

      socket.emit('equipment:location_update_success', {
        equipmentId: data.equipmentId,
        timestamp: new Date(),
      });

    } catch (error) {
      this.logger.error(`❌ Ошибка обновления позиции: ${error.message}`);
      socket.emit('equipment:location_update_error', {
        equipmentId: data.equipmentId,
        message: 'Ошибка при обновлении позиции оборудования',
        error: error.message,
      });
    }
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('equipment:assign_task')
  async handleAssignTask(
    @ConnectedSocket() socket: Socket,
    @MessageBody() data: {
      equipmentId: string;
      taskId: string;
      taskType: 'move_container' | 'load_truck' | 'unload_truck' | 'maintenance' | 'inspection';
      description: string;
      priority: 'low' | 'medium' | 'high' | 'urgent';
      location?: {
        zone: string;
        area: string;
        position?: string;
      };
      deadline?: Date;
      instructions?: string;
    },
  ) {
    const user = socket.data.user;
    this.logger.log(`📋 Назначение задачи оборудованию: ${data.equipmentId} -> ${data.taskType}`);

    try {
      // Отправляем задачу оборудованию
      this.server.to(`equipment:${data.equipmentId}`).emit('equipment:task_assigned', {
        taskId: data.taskId,
        equipmentId: data.equipmentId,
        taskType: data.taskType,
        description: data.description,
        priority: data.priority,
        location: data.location,
        deadline: data.deadline,
        instructions: data.instructions,
        assignedBy: user.email,
        assignedAt: new Date(),
      });

      // Создаем уведомление оператору оборудования
      await this.notificationService.createNotification({
        type: 'OPERATION',
        priority: data.priority === 'urgent' ? 'URGENT' : 'MEDIUM',
        title: 'Новая задача для оборудования',
        message: `Оборудованию ${data.equipmentId} назначена задача: ${data.description}`,
        shortMessage: `Задача: ${data.taskType}`,
        category: 'equipment_task',
        tags: ['equipment', 'task', data.taskType],
        targetRole: 'EQUIPMENT_OPERATOR',
        deliveryChannels: ['websocket', 'push'],
        data: {
          source: 'equipment_gateway',
          sourceId: data.taskId,
          sourceType: 'task_assignment',
          relatedObjects: [{
            type: 'equipment',
            id: data.equipmentId,
            name: data.equipmentId,
            status: 'task_assigned',
          }],
          location: data.location ? {
            zone: data.location.zone,
            area: data.location.area,
          } : undefined,
          metrics: {
            severity: data.priority === 'urgent' ? 8 : 5,
            impact: 'medium',
            urgency: data.priority === 'urgent' ? 'immediate' : 'medium',
          },
        },
      });

      socket.emit('equipment:task_assignment_success', {
        taskId: data.taskId,
        equipmentId: data.equipmentId,
        timestamp: new Date(),
      });

    } catch (error) {
      this.logger.error(`❌ Ошибка назначения задачи: ${error.message}`);
      socket.emit('equipment:task_assignment_error', {
        taskId: data.taskId,
        equipmentId: data.equipmentId,
        message: 'Ошибка при назначении задачи оборудованию',
        error: error.message,
      });
    }
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('equipment:update_task_status')
  async handleUpdateTaskStatus(
    @ConnectedSocket() socket: Socket,
    @MessageBody() data: {
      taskId: string;
      equipmentId: string;
      status: 'accepted' | 'in_progress' | 'completed' | 'failed' | 'cancelled';
      progress?: number;
      notes?: string;
      completedAt?: Date;
    },
  ) {
    const user = socket.data.user;
    this.logger.debug(`✅ Обновление статуса задачи: ${data.taskId} -> ${data.status}`);

    try {
      // Эмитим обновление статуса задачи
      this.server.emit('equipment:task_status_updated', {
        taskId: data.taskId,
        equipmentId: data.equipmentId,
        status: data.status,
        progress: data.progress,
        notes: data.notes,
        completedAt: data.completedAt,
        updatedBy: user.email,
        timestamp: new Date(),
      });

      // Если задача завершена или провалена, создаем уведомление
      if (data.status === 'completed' || data.status === 'failed') {
        await this.notificationService.createNotification({
          type: data.status === 'completed' ? 'SUCCESS' : 'ERROR',
          priority: 'MEDIUM',
          title: data.status === 'completed' ? 'Задача выполнена' : 'Задача провалена',
          message: `Задача ${data.taskId} для оборудования ${data.equipmentId} ${data.status === 'completed' ? 'успешно выполнена' : 'провалена'}`,
          category: 'task_completion',
          tags: ['equipment', 'task', data.status],
          targetRole: 'MANAGER',
          deliveryChannels: ['websocket'],
          data: {
            source: 'equipment_gateway',
            sourceId: data.taskId,
            sourceType: 'task_completion',
            relatedObjects: [{
              type: 'equipment',
              id: data.equipmentId,
              name: data.equipmentId,
              status: data.status,
            }],
          },
        });
      }

      socket.emit('equipment:task_status_update_success', {
        taskId: data.taskId,
        status: data.status,
        timestamp: new Date(),
      });

    } catch (error) {
      this.logger.error(`❌ Ошибка обновления статуса задачи: ${error.message}`);
      socket.emit('equipment:task_status_update_error', {
        taskId: data.taskId,
        message: 'Ошибка при обновлении статуса задачи',
        error: error.message,
      });
    }
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('equipment:report_maintenance')
  async handleReportMaintenance(
    @ConnectedSocket() socket: Socket,
    @MessageBody() data: {
      equipmentId: string;
      issueType: 'mechanical' | 'electrical' | 'software' | 'fuel' | 'routine' | 'emergency';
      severity: 'low' | 'medium' | 'high' | 'critical';
      description: string;
      location?: {
        zone: string;
        area: string;
      };
      images?: string[];
    },
  ) {
    const user = socket.data.user;
    this.logger.warn(`🔧 Заявка на обслуживание: ${data.equipmentId} (${data.severity})`);

    try {
      const maintenanceId = `maint_${Date.now()}`;

      // Эмитим уведомление о необходимости обслуживания
      this.server.to('role:MAINTENANCE_MANAGER').emit('equipment:maintenance_requested', {
        maintenanceId,
        equipmentId: data.equipmentId,
        issueType: data.issueType,
        severity: data.severity,
        description: data.description,
        location: data.location,
        images: data.images,
        reportedBy: user.email,
        reportedAt: new Date(),
      });

      // Создаем уведомление для менеджера по обслуживанию
      await this.notificationService.createNotification({
        type: 'ALERT',
        priority: data.severity === 'critical' ? 'CRITICAL' : data.severity === 'high' ? 'HIGH' : 'MEDIUM',
        title: 'Заявка на обслуживание оборудования',
        message: `Оборудование ${data.equipmentId} требует обслуживания: ${data.description}`,
        shortMessage: `Обслуживание ${data.equipmentId}`,
        category: 'maintenance_request',
        tags: ['maintenance', 'equipment', data.issueType],
        targetRole: 'MAINTENANCE_MANAGER',
        deliveryChannels: ['websocket', 'email'],
        data: {
          source: 'equipment_gateway',
          sourceId: maintenanceId,
          sourceType: 'maintenance_request',
          relatedObjects: [{
            type: 'equipment',
            id: data.equipmentId,
            name: data.equipmentId,
            status: 'maintenance_required',
          }],
          location: data.location,
          attachments: data.images?.map(image => ({
            type: 'image',
            url: image,
            name: 'Equipment Issue Photo',
          })),
          metrics: {
            severity: data.severity === 'critical' ? 10 : data.severity === 'high' ? 8 : 5,
            impact: data.severity === 'critical' ? 'critical' : 'medium',
            urgency: data.severity === 'critical' ? 'immediate' : 'medium',
          },
        },
      });

      socket.emit('equipment:maintenance_report_success', {
        maintenanceId,
        equipmentId: data.equipmentId,
        message: 'Заявка на обслуживание создана',
        timestamp: new Date(),
      });

    } catch (error) {
      this.logger.error(`❌ Ошибка создания заявки на обслуживание: ${error.message}`);
      socket.emit('equipment:maintenance_report_error', {
        equipmentId: data.equipmentId,
        message: 'Ошибка при создании заявки на обслуживание',
        error: error.message,
      });
    }
  }

  // Методы для отправки обновлений
  async broadcastEquipmentStatus(equipmentId: string, status: any) {
    this.server.to(`equipment:${equipmentId}`).emit('equipment:status_update', {
      equipmentId,
      ...status,
      timestamp: new Date(),
    });
  }

  async broadcastEquipmentAlert(alert: any) {
    this.server.to('equipment').emit('equipment:alert', {
      ...alert,
      timestamp: new Date(),
    });
  }

  async broadcastMaintenanceUpdate(update: any) {
    this.server.to('role:MAINTENANCE_MANAGER').emit('equipment:maintenance_update', {
      ...update,
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

  private async getEquipmentOverview(): Promise<any> {
    // TODO: Получить реальные данные оборудования
    return {
      totalUnits: 24,
      online: 20,
      offline: 4,
      inOperation: 12,
      idle: 8,
      maintenance: 3,
      lowBattery: 2,
      alerts: 1,
      byType: {
        reach_stacker: 6,
        forklift: 8,
        crane: 4,
        truck: 3,
        trailer: 2,
        scanner: 1,
      },
      performance: {
        averageUtilization: 75,
        averageResponseTime: 4.2,
        tasksCompletedToday: 156,
      },
      lastUpdate: new Date(),
    };
  }

  private async getEquipmentData(equipmentId: string): Promise<any> {
    // TODO: Получить реальные данные конкретного оборудования
    return {
      equipmentId,
      status: 'operational',
      location: {
        x: Math.random() * 1000,
        y: Math.random() * 500,
        zone: 'Zone A',
        area: 'Storage',
        heading: Math.random() * 360,
      },
      batteryLevel: Math.floor(Math.random() * 100),
      fuelLevel: Math.floor(Math.random() * 100),
      operatorId: 'OP001',
      currentTask: 'move_container_C123456',
      taskProgress: Math.floor(Math.random() * 100),
      lastMaintenance: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
      nextMaintenance: new Date(Date.now() + Math.random() * 30 * 24 * 60 * 60 * 1000),
      alerts: [],
      lastUpdate: new Date(),
    };
  }

  private async getEquipmentHistory(equipmentId: string): Promise<any[]> {
    // TODO: Получить реальную историю оборудования
    const history = [];
    const now = new Date();
    
    for (let i = 0; i < 10; i++) {
      const timestamp = new Date(now.getTime() - i * 5 * 60 * 1000);
      history.push({
        timestamp,
        location: {
          x: Math.random() * 1000,
          y: Math.random() * 500,
          zone: `Zone ${String.fromCharCode(65 + Math.floor(Math.random() * 3))}`,
        },
        status: 'operational',
        batteryLevel: Math.floor(Math.random() * 100),
        task: i === 0 ? 'move_container_C123456' : null,
      });
    }
    
    return history.reverse();
  }
}