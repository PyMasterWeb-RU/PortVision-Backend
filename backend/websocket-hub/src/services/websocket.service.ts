import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { WebSocketConnection, ConnectionStatus, ClientType } from '../entities/websocket-connection.entity';

export interface CreateConnectionDto {
  socketId: string;
  user: any;
  clientInfo: {
    userAgent?: string;
    ipAddress: string;
    browser?: any;
    language?: string;
    timezone: string;
  };
}

export interface UpdateConnectionDto {
  status?: ConnectionStatus;
  subscriptions?: string[];
  rooms?: string[];
  metrics?: any;
  sessionContext?: any;
  disconnectedAt?: Date;
  lastActivityAt?: Date;
}

@Injectable()
export class WebSocketService {
  private readonly logger = new Logger(WebSocketService.name);

  constructor(
    @InjectRepository(WebSocketConnection)
    private readonly connectionRepository: Repository<WebSocketConnection>,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async createConnection(socketId: string, user: any, clientInfo: any): Promise<WebSocketConnection> {
    this.logger.log(`Creating connection for user ${user.sub}`);

    // Определяем тип клиента
    const clientType = this.determineClientType(clientInfo.userAgent);

    // Создаем соединение
    const connection = this.connectionRepository.create({
      socketId,
      userId: user.sub,
      userName: user.name || user.email,
      userRole: user.role,
      status: ConnectionStatus.CONNECTED,
      clientType,
      clientInfo: {
        userAgent: clientInfo.userAgent,
        browser: clientInfo.browser,
        language: clientInfo.language || 'en',
        timezone: clientInfo.timezone || 'UTC',
        ipAddress: clientInfo.ipAddress,
        // TODO: Добавить определение OS, device, screen, location
      },
      subscriptions: [],
      rooms: [`user:${user.sub}`, `role:${user.role}`],
      metrics: {
        messagesReceived: 0,
        messagesSent: 0,
        bytesReceived: 0,
        bytesSent: 0,
        latency: 0,
        lastPing: new Date(),
        connectionDuration: 0,
        reconnectCount: 0,
        errorCount: 0,
        lastActivity: new Date(),
      },
      settings: {
        enableNotifications: true,
        enableRealTimeUpdates: true,
        updateFrequency: 1000,
        compressionEnabled: false,
        heartbeatInterval: 30000,
        maxReconnectAttempts: 5,
        bufferSize: 1024,
        qosLevel: 'medium',
        priorities: {
          alerts: 3,
          updates: 2,
          notifications: 1,
        },
      },
      sessionContext: {
        permissions: user.permissions || [],
        workShift: user.currentShift,
      },
      connectedAt: new Date(),
      lastActivityAt: new Date(),
    });

    const savedConnection = await this.connectionRepository.save(connection);

    this.eventEmitter.emit('websocket.connection.created', {
      connectionId: savedConnection.id,
      socketId: savedConnection.socketId,
      userId: savedConnection.userId,
      userRole: savedConnection.userRole,
      clientType: savedConnection.clientType,
    });

    return savedConnection;
  }

  async getConnection(socketId: string): Promise<WebSocketConnection | null> {
    return this.connectionRepository.findOne({
      where: { socketId },
    });
  }

  async getConnectionsByUser(userId: string): Promise<WebSocketConnection[]> {
    return this.connectionRepository.find({
      where: { 
        userId,
        status: ConnectionStatus.CONNECTED,
      },
      order: { connectedAt: 'DESC' },
    });
  }

  async getActiveConnections(): Promise<WebSocketConnection[]> {
    return this.connectionRepository.find({
      where: { status: ConnectionStatus.CONNECTED },
      order: { connectedAt: 'DESC' },
    });
  }

  async getConnectionsByRole(role: string): Promise<WebSocketConnection[]> {
    return this.connectionRepository.find({
      where: { 
        userRole: role,
        status: ConnectionStatus.CONNECTED,
      },
      order: { connectedAt: 'DESC' },
    });
  }

  async updateConnection(socketId: string, updateData: UpdateConnectionDto): Promise<WebSocketConnection> {
    const connection = await this.getConnection(socketId);
    if (!connection) {
      throw new Error(`Connection with socket ID ${socketId} not found`);
    }

    Object.assign(connection, updateData);
    const updatedConnection = await this.connectionRepository.save(connection);

    this.eventEmitter.emit('websocket.connection.updated', {
      connectionId: updatedConnection.id,
      socketId: updatedConnection.socketId,
      userId: updatedConnection.userId,
      changes: updateData,
    });

    return updatedConnection;
  }

  async updateConnectionMetrics(socketId: string, metrics: Partial<WebSocketConnection['metrics']>): Promise<void> {
    const connection = await this.getConnection(socketId);
    if (!connection) return;

    const updatedMetrics = {
      ...connection.metrics,
      ...metrics,
    };

    await this.connectionRepository.update(
      { socketId },
      { 
        metrics: updatedMetrics,
        lastActivityAt: new Date(),
      }
    );
  }

  async incrementMessageCount(socketId: string, direction: 'received' | 'sent', bytes: number = 0): Promise<void> {
    const connection = await this.getConnection(socketId);
    if (!connection) return;

    const metrics = connection.metrics;
    if (direction === 'received') {
      metrics.messagesReceived++;
      metrics.bytesReceived += bytes;
    } else {
      metrics.messagesSent++;
      metrics.bytesSent += bytes;
    }

    metrics.lastActivity = new Date();

    await this.connectionRepository.update(
      { socketId },
      { 
        metrics,
        lastActivityAt: new Date(),
      }
    );
  }

  async disconnectConnection(socketId: string): Promise<void> {
    const connection = await this.getConnection(socketId);
    if (!connection) return;

    const now = new Date();
    const connectionDuration = now.getTime() - connection.connectedAt.getTime();

    await this.updateConnection(socketId, {
      status: ConnectionStatus.DISCONNECTED,
      disconnectedAt: now,
      metrics: {
        ...connection.metrics,
        connectionDuration,
      },
    });

    this.eventEmitter.emit('websocket.connection.disconnected', {
      connectionId: connection.id,
      socketId: connection.socketId,
      userId: connection.userId,
      connectionDuration,
    });
  }

  async cleanupOldConnections(olderThanHours: number = 24): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setHours(cutoffDate.getHours() - olderThanHours);

    const result = await this.connectionRepository.delete({
      status: ConnectionStatus.DISCONNECTED,
      disconnectedAt: cutoffDate,
    });

    this.logger.log(`Cleaned up ${result.affected} old connections`);
    return result.affected || 0;
  }

  async getConnectionStatistics(): Promise<any> {
    const [
      totalConnections,
      activeConnections,
      connectionsByStatus,
      connectionsByClientType,
      connectionsByRole,
    ] = await Promise.all([
      this.connectionRepository.count(),
      this.connectionRepository.count({ where: { status: ConnectionStatus.CONNECTED } }),
      this.connectionRepository.query(`
        SELECT status, COUNT(*) as count
        FROM websocket.websocket_connections
        GROUP BY status
        ORDER BY count DESC
      `),
      this.connectionRepository.query(`
        SELECT client_type, COUNT(*) as count
        FROM websocket.websocket_connections
        WHERE status = 'connected'
        GROUP BY client_type
        ORDER BY count DESC
      `),
      this.connectionRepository.query(`
        SELECT user_role, COUNT(*) as count
        FROM websocket.websocket_connections
        WHERE status = 'connected'
        GROUP BY user_role
        ORDER BY count DESC
      `),
    ]);

    // Получаем метрики производительности
    const performanceMetrics = await this.connectionRepository.query(`
      SELECT 
        AVG((metrics->>'latency')::numeric) as avg_latency,
        AVG((metrics->>'messagesReceived')::numeric + (metrics->>'messagesSent')::numeric) as avg_message_rate,
        SUM((metrics->>'bytesReceived')::numeric + (metrics->>'bytesSent')::numeric) as total_bytes
      FROM websocket.websocket_connections
      WHERE status = 'connected'
      AND metrics IS NOT NULL
    `);

    return {
      totals: {
        totalConnections,
        activeConnections,
        avgLatency: parseFloat(performanceMetrics[0]?.avg_latency || 0),
        avgMessageRate: parseFloat(performanceMetrics[0]?.avg_message_rate || 0),
        totalBytes: parseInt(performanceMetrics[0]?.total_bytes || 0),
      },
      breakdown: {
        byStatus: connectionsByStatus,
        byClientType: connectionsByClientType,
        byRole: connectionsByRole,
      },
    };
  }

  async getConnectionsInRoom(roomName: string): Promise<WebSocketConnection[]> {
    return this.connectionRepository
      .createQueryBuilder('connection')
      .where('connection.status = :status', { status: ConnectionStatus.CONNECTED })
      .andWhere(':roomName = ANY(connection.rooms)', { roomName })
      .getMany();
  }

  async addConnectionToRoom(socketId: string, roomName: string): Promise<void> {
    const connection = await this.getConnection(socketId);
    if (!connection) return;

    if (!connection.rooms.includes(roomName)) {
      connection.rooms.push(roomName);
      await this.connectionRepository.save(connection);
    }
  }

  async removeConnectionFromRoom(socketId: string, roomName: string): Promise<void> {
    const connection = await this.getConnection(socketId);
    if (!connection) return;

    connection.rooms = connection.rooms.filter(room => room !== roomName);
    await this.connectionRepository.save(connection);
  }

  async updateSessionContext(socketId: string, context: any): Promise<void> {
    const connection = await this.getConnection(socketId);
    if (!connection) return;

    const updatedContext = {
      ...connection.sessionContext,
      ...context,
    };

    await this.connectionRepository.update(
      { socketId },
      { sessionContext: updatedContext }
    );
  }

  async markConnectionAsIdle(socketId: string): Promise<void> {
    await this.updateConnection(socketId, {
      status: ConnectionStatus.IDLE,
    });
  }

  async reactivateConnection(socketId: string): Promise<void> {
    await this.updateConnection(socketId, {
      status: ConnectionStatus.CONNECTED,
      lastActivityAt: new Date(),
    });
  }

  private determineClientType(userAgent?: string): ClientType {
    if (!userAgent) return ClientType.API_CLIENT;

    const ua = userAgent.toLowerCase();

    if (ua.includes('mobile') || ua.includes('android') || ua.includes('iphone')) {
      return ClientType.MOBILE_APP;
    }

    if (ua.includes('electron')) {
      return ClientType.DESKTOP_APP;
    }

    if (ua.includes('mozilla') || ua.includes('chrome') || ua.includes('safari') || ua.includes('firefox')) {
      return ClientType.WEB_BROWSER;
    }

    return ClientType.API_CLIENT;
  }

  // Методы для мониторинга здоровья соединений
  async checkConnectionHealth(): Promise<{
    healthy: number;
    unhealthy: number;
    details: any[];
  }> {
    const connections = await this.getActiveConnections();
    const now = new Date();
    const healthyThreshold = 5 * 60 * 1000; // 5 минут

    let healthy = 0;
    let unhealthy = 0;
    const details = [];

    for (const connection of connections) {
      const timeSinceLastActivity = now.getTime() - connection.lastActivityAt.getTime();
      const isHealthy = timeSinceLastActivity < healthyThreshold;

      if (isHealthy) {
        healthy++;
      } else {
        unhealthy++;
        details.push({
          socketId: connection.socketId,
          userId: connection.userId,
          timeSinceLastActivity,
          status: connection.status,
        });
      }
    }

    return { healthy, unhealthy, details };
  }

  async getHighLatencyConnections(threshold: number = 1000): Promise<WebSocketConnection[]> {
    return this.connectionRepository
      .createQueryBuilder('connection')
      .where('connection.status = :status', { status: ConnectionStatus.CONNECTED })
      .andWhere('(connection.metrics->>\'latency\')::numeric > :threshold', { threshold })
      .orderBy('(connection.metrics->>\'latency\')::numeric', 'DESC')
      .getMany();
  }

  async getTopActiveUsers(limit: number = 10): Promise<any[]> {
    return this.connectionRepository.query(`
      SELECT 
        user_id,
        user_name,
        COUNT(*) as connection_count,
        AVG((metrics->>'messagesReceived')::numeric + (metrics->>'messagesSent')::numeric) as avg_messages,
        MAX(last_activity_at) as last_activity
      FROM websocket.websocket_connections
      WHERE status = 'connected'
      GROUP BY user_id, user_name
      ORDER BY avg_messages DESC, connection_count DESC
      LIMIT $1
    `, [limit]);
  }
}