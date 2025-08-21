import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  CreateRealtimeSubscriptionDto,
  UpdateRealtimeSubscriptionDto,
  GetRealtimeSubscriptionsDto,
  PublishRealtimeEventDto,
  CreateMessageQueueDto,
  GetRealtimeAnalyticsDto,
  CreateExternalIntegrationDto,
} from './dto/realtime.dto';
import {
  RealtimeSubscription,
  SubscriptionType,
  SubscriptionStatus,
  RealtimeEvent,
  WebSocketConnection,
  ConnectionStatus,
  MessageQueue,
  QueueType,
  QueueStatus,
  QueuedMessage,
  RealtimeAnalytics,
  SystemHealth,
  ExternalIntegration,
  IntegrationType,
  IntegrationStatus,
  EventSource,
  TerminalOperationEvent,
  EquipmentStatusEvent,
  ContainerMovementEvent,
  KPIMetricEvent,
  AlertEvent,
} from './interfaces/realtime.interface';
import { v4 as uuidv4 } from 'uuid';
import * as WebSocket from 'ws';

@Injectable()
export class RealtimeService {
  private readonly logger = new Logger(RealtimeService.name);
  
  // In-memory хранилища для демонстрации
  private readonly subscriptions = new Map<string, RealtimeSubscription>();
  private readonly connections = new Map<string, WebSocketConnection>();
  private readonly queues = new Map<string, MessageQueue>();
  private readonly queuedMessages = new Map<string, QueuedMessage>();
  private readonly integrations = new Map<string, ExternalIntegration>();
  
  // WebSocket сервер
  private wss: WebSocket.Server | null = null;
  
  // Метрики и аналитика
  private readonly eventCounts = new Map<string, number>();
  private readonly connectionMetrics = {
    totalConnections: 0,
    activeConnections: 0,
    messagesSent: 0,
    messagesReceived: 0,
    errors: 0,
  };

  constructor(private readonly eventEmitter: EventEmitter2) {
    this.initializeDefaultQueues();
    this.initializeWebSocketServer();
  }

  // Управление подписками

  async createRealtimeSubscription(
    dto: CreateRealtimeSubscriptionDto,
    userId: string,
    sessionId: string,
  ): Promise<RealtimeSubscription> {
    this.logger.log(`📡 Создание подписки на реальное время: ${dto.type} - ${dto.topic}`);

    // Проверяем лимиты
    const userSubscriptions = Array.from(this.subscriptions.values())
      .filter(s => s.userId === userId && s.status === SubscriptionStatus.ACTIVE);
    
    if (userSubscriptions.length >= 50) { // Максимум 50 подписок на пользователя
      throw new BadRequestException('Превышен лимит подписок на пользователя');
    }

    const subscription: RealtimeSubscription = {
      id: uuidv4(),
      userId,
      sessionId,
      type: dto.type,
      topic: dto.topic,
      filters: dto.filters || [],
      config: {
        refreshInterval: dto.config?.refreshInterval || 1000,
        bufferSize: dto.config?.bufferSize || 100,
        compression: dto.config?.compression || false,
        throttle: dto.config?.throttle || {
          enabled: false,
          maxUpdatesPerSecond: 10,
          strategy: 'buffer',
        },
        aggregation: dto.config?.aggregation,
        transforms: dto.config?.transforms || [],
        persistence: dto.config?.persistence,
      },
      status: SubscriptionStatus.ACTIVE,
      createdAt: new Date(),
      lastActivity: new Date(),
      metrics: {
        totalMessages: 0,
        messagesPerSecond: 0,
        errors: 0,
        bytesTransferred: 0,
        latency: {
          min: 0,
          max: 0,
          avg: 0,
          p95: 0,
          p99: 0,
        },
      },
    };

    this.subscriptions.set(subscription.id, subscription);

    // Создаем очередь для подписки если нужно
    await this.createTopicQueue(dto.topic, dto.type);

    this.eventEmitter.emit('realtime.subscription.created', {
      subscriptionId: subscription.id,
      userId,
      type: dto.type,
      topic: dto.topic,
    });

    this.logger.log(`✅ Подписка создана: ${subscription.id}`);
    return subscription;
  }

  async getRealtimeSubscriptions(dto: GetRealtimeSubscriptionsDto, userId: string): Promise<{
    subscriptions: RealtimeSubscription[];
    total: number;
    page: number;
    limit: number;
  }> {
    let subscriptions = Array.from(this.subscriptions.values())
      .filter(s => s.userId === userId); // Только подписки пользователя

    // Применяем фильтры
    if (dto.type) {
      subscriptions = subscriptions.filter(s => s.type === dto.type);
    }
    if (dto.status) {
      subscriptions = subscriptions.filter(s => s.status === dto.status);
    }
    if (dto.topic) {
      subscriptions = subscriptions.filter(s => s.topic.includes(dto.topic));
    }
    if (dto.activeOnly) {
      subscriptions = subscriptions.filter(s => s.status === SubscriptionStatus.ACTIVE);
    }

    // Сортировка по дате создания (новые сначала)
    subscriptions.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    // Пагинация
    const offset = (dto.page - 1) * dto.limit;
    const paginatedSubscriptions = subscriptions.slice(offset, offset + dto.limit);

    return {
      subscriptions: paginatedSubscriptions,
      total: subscriptions.length,
      page: dto.page,
      limit: dto.limit,
    };
  }

  async getRealtimeSubscription(subscriptionId: string, userId: string): Promise<RealtimeSubscription> {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) {
      throw new NotFoundException(`Подписка с ID ${subscriptionId} не найдена`);
    }

    if (subscription.userId !== userId) {
      throw new NotFoundException('Подписка не найдена'); // Не показываем что подписка существует
    }

    return subscription;
  }

  async updateRealtimeSubscription(
    subscriptionId: string,
    dto: UpdateRealtimeSubscriptionDto,
    userId: string,
  ): Promise<RealtimeSubscription> {
    const subscription = await this.getRealtimeSubscription(subscriptionId, userId);

    if (dto.status !== undefined) {
      subscription.status = dto.status;
    }
    if (dto.filters !== undefined) {
      subscription.filters = dto.filters;
    }
    if (dto.config !== undefined) {
      subscription.config = { ...subscription.config, ...dto.config };
    }

    subscription.lastActivity = new Date();
    this.subscriptions.set(subscriptionId, subscription);

    this.eventEmitter.emit('realtime.subscription.updated', {
      subscriptionId,
      userId,
      changes: dto,
    });

    this.logger.log(`📝 Подписка обновлена: ${subscriptionId}`);
    return subscription;
  }

  async deleteRealtimeSubscription(subscriptionId: string, userId: string): Promise<void> {
    const subscription = await this.getRealtimeSubscription(subscriptionId, userId);

    this.subscriptions.delete(subscriptionId);

    this.eventEmitter.emit('realtime.subscription.deleted', {
      subscriptionId,
      userId,
      type: subscription.type,
      topic: subscription.topic,
    });

    this.logger.log(`🗑️ Подписка удалена: ${subscriptionId}`);
  }

  // Публикация событий

  async publishRealtimeEvent(dto: PublishRealtimeEventDto, userId?: string): Promise<void> {
    this.logger.log(`📢 Публикация события: ${dto.type} -> ${dto.topic}`);

    const event: RealtimeEvent = {
      id: uuidv4(),
      type: dto.type,
      topic: dto.topic,
      timestamp: new Date(),
      source: dto.source || {
        type: 'system',
        id: 'reporting-service',
        name: 'Reporting Service',
      },
      data: dto.data,
      metadata: {
        priority: dto.metadata?.priority || 'normal',
        category: dto.metadata?.category || 'general',
        tags: dto.metadata?.tags || [],
        correlationId: dto.metadata?.correlationId,
        causationId: dto.metadata?.causationId,
        version: dto.metadata?.version || '1.0',
      },
    };

    // Находим подходящие подписки
    const matchingSubscriptions = this.findMatchingSubscriptions(event);

    if (matchingSubscriptions.length === 0) {
      this.logger.debug(`Нет подписчиков для события: ${dto.topic}`);
      return;
    }

    // Отправляем событие подписчикам
    for (const subscription of matchingSubscriptions) {
      await this.sendEventToSubscription(event, subscription);
    }

    // Добавляем в очереди
    await this.enqueueEvent(event);

    // Обновляем метрики
    this.updateEventMetrics(event);

    this.eventEmitter.emit('realtime.event.published', {
      eventId: event.id,
      type: event.type,
      topic: event.topic,
      subscribersCount: matchingSubscriptions.length,
      userId,
    });
  }

  // Специализированные методы публикации

  async publishTerminalOperationEvent(data: any): Promise<void> {
    const event: TerminalOperationEvent = {
      id: uuidv4(),
      type: 'terminal_operation',
      topic: 'terminal.operations.container_movements',
      timestamp: new Date(),
      source: {
        type: 'terminal',
        id: 'terminal-main',
        name: 'Главный терминал',
      },
      data: {
        operationType: data.operationType,
        containerId: data.containerId,
        containerNumber: data.containerNumber,
        vesselId: data.vesselId,
        truckId: data.truckId,
        equipmentId: data.equipmentId,
        location: data.location,
        status: data.status,
        duration: data.duration,
        details: data.details,
      },
    };

    await this.publishRealtimeEvent({
      type: event.type,
      topic: event.topic,
      data: event.data,
      source: event.source,
      metadata: {
        priority: 'high',
        category: 'operations',
        tags: ['terminal', 'container', 'movement'],
      },
    });
  }

  async publishEquipmentStatusEvent(data: any): Promise<void> {
    const event: EquipmentStatusEvent = {
      id: uuidv4(),
      type: 'equipment_status',
      topic: 'terminal.equipment.status',
      timestamp: new Date(),
      source: {
        type: 'equipment',
        id: data.equipmentId,
        name: data.equipmentName || `Equipment ${data.equipmentId}`,
        location: data.position,
      },
      data: {
        equipmentId: data.equipmentId,
        equipmentType: data.equipmentType,
        status: data.status,
        position: data.position,
        telemetry: data.telemetry,
        operator: data.operator,
        task: data.task,
      },
    };

    await this.publishRealtimeEvent({
      type: event.type,
      topic: event.topic,
      data: event.data,
      source: event.source,
      metadata: {
        priority: data.status === 'error' ? 'critical' : 'normal',
        category: 'equipment',
        tags: ['equipment', 'status', data.equipmentType],
      },
    });
  }

  async publishKPIMetricEvent(data: any): Promise<void> {
    const event: KPIMetricEvent = {
      id: uuidv4(),
      type: 'kpi_metric',
      topic: `terminal.kpi.${data.category}`,
      timestamp: new Date(),
      source: {
        type: 'system',
        id: 'kpi-service',
        name: 'KPI Calculation Service',
      },
      data: {
        metricId: data.metricId,
        metricName: data.metricName,
        category: data.category,
        value: data.value,
        unit: data.unit,
        target: data.target,
        threshold: data.threshold,
        trend: data.trend,
        calculatedAt: new Date(),
        period: data.period || 'realtime',
      },
    };

    await this.publishRealtimeEvent({
      type: event.type,
      topic: event.topic,
      data: event.data,
      source: event.source,
      metadata: {
        priority: data.value > (data.threshold?.critical || Infinity) ? 'critical' : 'normal',
        category: 'kpi',
        tags: ['kpi', 'metrics', data.category],
      },
    });
  }

  async publishAlertEvent(data: any): Promise<void> {
    const event: AlertEvent = {
      id: uuidv4(),
      type: 'alert',
      topic: `terminal.alerts.${data.severity}`,
      timestamp: new Date(),
      source: data.source,
      data: {
        alertId: data.alertId || uuidv4(),
        severity: data.severity,
        title: data.title,
        message: data.message,
        source: data.source,
        category: data.category,
        triggeredAt: new Date(),
        actions: data.actions || [],
        metadata: data.metadata,
      },
    };

    await this.publishRealtimeEvent({
      type: event.type,
      topic: event.topic,
      data: event.data,
      source: event.source,
      metadata: {
        priority: data.severity === 'critical' ? 'critical' : 'high',
        category: 'alerts',
        tags: ['alert', data.severity, data.category],
      },
    });
  }

  // Управление очередями

  async createMessageQueue(dto: CreateMessageQueueDto): Promise<MessageQueue> {
    this.logger.log(`📋 Создание очереди сообщений: ${dto.topic} (${dto.type})`);

    const queue: MessageQueue = {
      id: uuidv4(),
      topic: dto.topic,
      type: dto.type,
      config: {
        maxSize: dto.config?.maxSize || 10000,
        ttl: dto.config?.ttl || 3600,
        persistent: dto.config?.persistent || false,
        compression: dto.config?.compression || false,
        priority: dto.config?.priority,
        deduplication: dto.config?.deduplication,
      },
      metrics: {
        size: 0,
        throughputPerSecond: 0,
        avgProcessingTime: 0,
        totalProcessed: 0,
        errors: 0,
      },
      status: QueueStatus.ACTIVE,
      createdAt: new Date(),
    };

    this.queues.set(queue.id, queue);

    this.eventEmitter.emit('realtime.queue.created', {
      queueId: queue.id,
      topic: queue.topic,
      type: queue.type,
    });

    this.logger.log(`✅ Очередь создана: ${queue.id}`);
    return queue;
  }

  async getMessageQueues(): Promise<MessageQueue[]> {
    return Array.from(this.queues.values());
  }

  // Аналитика

  async getRealtimeAnalytics(dto: GetRealtimeAnalyticsDto): Promise<RealtimeAnalytics> {
    const startTime = dto.startTime ? new Date(dto.startTime) : new Date(Date.now() - 60 * 60 * 1000);
    const endTime = dto.endTime ? new Date(dto.endTime) : new Date();

    // Подсчет событий
    const eventMetrics = {
      total: this.connectionMetrics.messagesSent,
      byType: this.getEventCountsByType(),
      byTopic: this.getEventCountsByTopic(),
      rate: this.calculateEventRate(),
      peakRate: this.calculatePeakEventRate(),
      trend: this.generateTrendData(startTime, endTime, dto.granularity || 'minute'),
    };

    // Анализ соединений
    const connectionAnalytics = {
      active: this.connections.size,
      total: this.connectionMetrics.totalConnections,
      byRole: this.getConnectionsByRole(),
      avgSessionDuration: this.calculateAvgSessionDuration(),
      reconnectionRate: this.calculateReconnectionRate(),
    };

    // Метрики производительности
    const performanceMetrics = {
      latency: this.calculateLatencyMetrics(),
      throughput: this.connectionMetrics.messagesSent / 60, // за последнюю минуту
      errorRate: (this.connectionMetrics.errors / this.connectionMetrics.messagesSent) * 100,
      memoryUsage: process.memoryUsage().heapUsed,
      cpuUsage: process.cpuUsage().system / 1000000, // конвертируем в проценты
    };

    // Ошибки
    const errorMetrics = {
      total: this.connectionMetrics.errors,
      byType: this.getErrorsByType(),
      rate: this.connectionMetrics.errors / 60, // за последнюю минуту
      criticalErrors: this.getCriticalErrorsCount(),
      recentErrors: this.getRecentErrors(),
    };

    return {
      sessionId: uuidv4(),
      timeframe: {
        start: startTime,
        end: endTime,
        granularity: dto.granularity || 'minute',
        timezone: 'UTC',
      },
      metrics: {
        events: eventMetrics,
        connections: connectionAnalytics,
        performance: performanceMetrics,
        errors: errorMetrics,
      },
      dimensions: this.calculateDimensions(dto.dimensions),
      filters: dto.filters,
      generatedAt: new Date(),
    };
  }

  // Системное здоровье

  async getSystemHealth(): Promise<SystemHealth> {
    const components = [
      {
        name: 'WebSocket Server',
        status: this.wss ? 'healthy' : 'unhealthy',
        message: this.wss ? 'Сервер запущен' : 'Сервер не запущен',
        metrics: {
          connections: this.connections.size,
          subscriptions: this.subscriptions.size,
        },
      },
      {
        name: 'Message Queues',
        status: this.queues.size > 0 ? 'healthy' : 'degraded',
        message: `Активных очередей: ${this.queues.size}`,
        metrics: {
          totalQueues: this.queues.size,
          totalMessages: Array.from(this.queues.values()).reduce((sum, q) => sum + q.metrics.size, 0),
        },
      },
      {
        name: 'Memory Usage',
        status: this.getMemoryHealthStatus(),
        message: `Использовано: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`,
        metrics: {
          heapUsed: process.memoryUsage().heapUsed,
          heapTotal: process.memoryUsage().heapTotal,
        },
      },
    ];

    const overallStatus = components.every(c => c.status === 'healthy') 
      ? 'healthy' 
      : components.some(c => c.status === 'unhealthy') 
        ? 'unhealthy' 
        : 'degraded';

    return {
      status: overallStatus,
      components,
      metrics: {
        uptime: process.uptime(),
        memoryUsage: (process.memoryUsage().heapUsed / process.memoryUsage().heapTotal) * 100,
        cpuUsage: process.cpuUsage().system / 1000000,
        connectionsCount: this.connections.size,
        subscriptionsCount: this.subscriptions.size,
        messagesPerSecond: this.calculateEventRate(),
        errorRate: (this.connectionMetrics.errors / this.connectionMetrics.messagesSent) * 100,
      },
      lastChecked: new Date(),
    };
  }

  // Внешние интеграции

  async createExternalIntegration(dto: CreateExternalIntegrationDto): Promise<ExternalIntegration> {
    this.logger.log(`🔌 Создание внешней интеграции: ${dto.name} (${dto.type})`);

    const integration: ExternalIntegration = {
      id: uuidv4(),
      name: dto.name,
      type: dto.type,
      config: dto.config,
      status: IntegrationStatus.DISCONNECTED,
      metrics: {
        totalEvents: 0,
        successfulEvents: 0,
        failedEvents: 0,
        avgLatency: 0,
        errorRate: 0,
      },
    };

    this.integrations.set(integration.id, integration);

    // Пытаемся подключиться
    await this.connectIntegration(integration.id);

    this.eventEmitter.emit('realtime.integration.created', {
      integrationId: integration.id,
      name: integration.name,
      type: integration.type,
    });

    this.logger.log(`✅ Интеграция создана: ${integration.id}`);
    return integration;
  }

  async getExternalIntegrations(): Promise<ExternalIntegration[]> {
    return Array.from(this.integrations.values());
  }

  // Частные методы

  private initializeWebSocketServer(): void {
    try {
      this.wss = new WebSocket.Server({ 
        port: process.env.REALTIME_WS_PORT ? parseInt(process.env.REALTIME_WS_PORT) : 8080,
        path: '/realtime',
      });

      this.wss.on('connection', (ws, request) => {
        this.handleWebSocketConnection(ws, request);
      });

      this.wss.on('error', (error) => {
        this.logger.error('WebSocket server error:', error);
      });

      this.logger.log(`🚀 WebSocket сервер запущен на порту ${this.wss.options.port}`);
    } catch (error) {
      this.logger.error('Ошибка запуска WebSocket сервера:', error);
    }
  }

  private handleWebSocketConnection(ws: WebSocket, request: any): void {
    const connectionId = uuidv4();
    const userId = this.extractUserIdFromRequest(request);
    const sessionId = this.extractSessionIdFromRequest(request);

    const connection: WebSocketConnection = {
      id: connectionId,
      userId: userId || 'anonymous',
      sessionId: sessionId || connectionId,
      socket: ws,
      subscriptions: new Set(),
      status: ConnectionStatus.CONNECTED,
      connectedAt: new Date(),
      lastPingAt: new Date(),
      metadata: {
        userAgent: request.headers['user-agent'],
        ipAddress: request.socket.remoteAddress,
      },
      metrics: {
        messagesReceived: 0,
        messagesSent: 0,
        bytesReceived: 0,
        bytesSent: 0,
        reconnections: 0,
        avgLatency: 0,
        lastActivity: new Date(),
      },
    };

    this.connections.set(connectionId, connection);
    this.connectionMetrics.totalConnections++;
    this.connectionMetrics.activeConnections++;

    // Обработчики событий WebSocket
    ws.on('message', (data) => {
      this.handleWebSocketMessage(connectionId, data);
    });

    ws.on('close', () => {
      this.handleWebSocketClose(connectionId);
    });

    ws.on('error', (error) => {
      this.handleWebSocketError(connectionId, error);
    });

    // Отправляем приветственное сообщение
    this.sendToConnection(connectionId, {
      type: 'connection',
      data: {
        connectionId,
        status: 'connected',
        timestamp: new Date(),
      },
    });

    this.logger.log(`🔌 WebSocket соединение установлено: ${connectionId} (${userId})`);
  }

  private handleWebSocketMessage(connectionId: string, data: any): void {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    try {
      const message = JSON.parse(data.toString());
      connection.metrics.messagesReceived++;
      connection.metrics.bytesReceived += data.length;
      connection.metrics.lastActivity = new Date();

      // Обрабатываем команды
      switch (message.type) {
        case 'ping':
          this.sendToConnection(connectionId, { type: 'pong', timestamp: new Date() });
          break;
        case 'subscribe':
          this.handleSubscribeCommand(connectionId, message.data);
          break;
        case 'unsubscribe':
          this.handleUnsubscribeCommand(connectionId, message.data);
          break;
        default:
          this.logger.warn(`Неизвестный тип сообщения: ${message.type}`);
      }
    } catch (error) {
      this.logger.error(`Ошибка обработки сообщения от ${connectionId}:`, error);
      this.connectionMetrics.errors++;
    }
  }

  private handleWebSocketClose(connectionId: string): void {
    const connection = this.connections.get(connectionId);
    if (connection) {
      connection.status = ConnectionStatus.DISCONNECTED;
      this.connections.delete(connectionId);
      this.connectionMetrics.activeConnections--;
      
      this.logger.log(`🔌 WebSocket соединение закрыто: ${connectionId}`);
    }
  }

  private handleWebSocketError(connectionId: string, error: any): void {
    this.logger.error(`WebSocket ошибка ${connectionId}:`, error);
    this.connectionMetrics.errors++;
  }

  private async handleSubscribeCommand(connectionId: string, data: any): Promise<void> {
    // Здесь будет логика подписки через WebSocket
    this.logger.debug(`Подписка через WebSocket: ${connectionId} -> ${data.topic}`);
  }

  private async handleUnsubscribeCommand(connectionId: string, data: any): Promise<void> {
    // Здесь будет логика отписки через WebSocket
    this.logger.debug(`Отписка через WebSocket: ${connectionId} -> ${data.topic}`);
  }

  private findMatchingSubscriptions(event: RealtimeEvent): RealtimeSubscription[] {
    return Array.from(this.subscriptions.values())
      .filter(subscription => 
        subscription.status === SubscriptionStatus.ACTIVE &&
        this.matchesTopicPattern(event.topic, subscription.topic) &&
        this.matchesFilters(event, subscription.filters)
      );
  }

  private matchesTopicPattern(eventTopic: string, subscriptionTopic: string): boolean {
    // Поддержка wildcards: * для одного сегмента, ** для любого количества
    const pattern = subscriptionTopic
      .replace(/\*\*/g, '.*')
      .replace(/\*/g, '[^.]*');
    
    const regex = new RegExp(`^${pattern}$`);
    return regex.test(eventTopic);
  }

  private matchesFilters(event: RealtimeEvent, filters: any[]): boolean {
    if (!filters || filters.length === 0) return true;

    return filters.every(filter => {
      const value = this.getNestedValue(event.data, filter.field);
      return this.evaluateFilter(value, filter.operator, filter.value);
    });
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((curr, prop) => curr?.[prop], obj);
  }

  private evaluateFilter(value: any, operator: string, filterValue: any): boolean {
    switch (operator) {
      case 'eq': return value == filterValue;
      case 'ne': return value != filterValue;
      case 'gt': return value > filterValue;
      case 'gte': return value >= filterValue;
      case 'lt': return value < filterValue;
      case 'lte': return value <= filterValue;
      case 'in': return Array.isArray(filterValue) && filterValue.includes(value);
      case 'not_in': return Array.isArray(filterValue) && !filterValue.includes(value);
      case 'contains': return String(value).includes(String(filterValue));
      case 'regex': return new RegExp(filterValue).test(String(value));
      default: return true;
    }
  }

  private async sendEventToSubscription(event: RealtimeEvent, subscription: RealtimeSubscription): Promise<void> {
    try {
      // Применяем трансформации
      let transformedEvent = event;
      if (subscription.config.transforms) {
        transformedEvent = await this.applyTransforms(event, subscription.config.transforms);
      }

      // Проверяем троттлинг
      if (subscription.config.throttle?.enabled) {
        const shouldThrottle = await this.checkThrottling(subscription);
        if (shouldThrottle) return;
      }

      // Отправляем через WebSocket если есть соединение
      const connection = Array.from(this.connections.values())
        .find(c => c.userId === subscription.userId && c.sessionId === subscription.sessionId);

      if (connection && connection.status === ConnectionStatus.CONNECTED) {
        this.sendToConnection(connection.id, {
          type: 'event',
          subscriptionId: subscription.id,
          data: transformedEvent,
        });

        // Обновляем метрики
        subscription.metrics.totalMessages++;
        subscription.metrics.lastMessageAt = new Date();
        subscription.lastActivity = new Date();
      }

      // Сохраняем в персистентное хранилище если настроено
      if (subscription.config.persistence?.enabled) {
        await this.persistEvent(event, subscription);
      }

    } catch (error) {
      this.logger.error(`Ошибка отправки события подписчику ${subscription.id}:`, error);
      subscription.metrics.errors++;
    }
  }

  private sendToConnection(connectionId: string, message: any): void {
    const connection = this.connections.get(connectionId);
    if (!connection || connection.status !== ConnectionStatus.CONNECTED) return;

    try {
      const data = JSON.stringify(message);
      connection.socket.send(data);
      
      connection.metrics.messagesSent++;
      connection.metrics.bytesSent += data.length;
      connection.metrics.lastActivity = new Date();
      
      this.connectionMetrics.messagesSent++;
    } catch (error) {
      this.logger.error(`Ошибка отправки сообщения ${connectionId}:`, error);
      this.connectionMetrics.errors++;
    }
  }

  private async createTopicQueue(topic: string, type: SubscriptionType): Promise<void> {
    // Создаем очередь для топика если не существует
    const existingQueue = Array.from(this.queues.values())
      .find(q => q.topic === topic);

    if (!existingQueue) {
      await this.createMessageQueue({
        topic,
        type: QueueType.TOPIC,
        config: {
          maxSize: 10000,
          ttl: 3600,
          persistent: false,
          compression: true,
        },
      });
    }
  }

  private async enqueueEvent(event: RealtimeEvent): Promise<void> {
    const queue = Array.from(this.queues.values())
      .find(q => q.topic === event.topic);

    if (!queue) return;

    const queuedMessage: QueuedMessage = {
      id: uuidv4(),
      queueId: queue.id,
      event,
      priority: this.calculateEventPriority(event),
      enqueuedAt: new Date(),
      attempts: 0,
      maxAttempts: 3,
      status: 'pending',
    };

    this.queuedMessages.set(queuedMessage.id, queuedMessage);
    queue.metrics.size++;
  }

  private calculateEventPriority(event: RealtimeEvent): number {
    const priorityMap = {
      'critical': 10,
      'high': 7,
      'normal': 5,
      'low': 1,
    };
    
    return priorityMap[event.metadata?.priority || 'normal'] || 5;
  }

  private updateEventMetrics(event: RealtimeEvent): void {
    const currentCount = this.eventCounts.get(event.type) || 0;
    this.eventCounts.set(event.type, currentCount + 1);
  }

  // Методы для аналитики и метрик

  private getEventCountsByType(): Record<string, number> {
    const result: Record<string, number> = {};
    this.eventCounts.forEach((count, type) => {
      result[type] = count;
    });
    return result;
  }

  private getEventCountsByTopic(): Record<string, number> {
    // Заглушка - в реальной системе будет отслеживание по топикам
    return {
      'terminal.operations': 150,
      'terminal.equipment': 89,
      'terminal.alerts': 12,
    };
  }

  private calculateEventRate(): number {
    // Заглушка - в реальной системе будет расчет на основе временных окон
    return this.connectionMetrics.messagesSent / 60; // за последнюю минуту
  }

  private calculatePeakEventRate(): number {
    // Заглушка
    return this.calculateEventRate() * 1.5;
  }

  private generateTrendData(startTime: Date, endTime: Date, granularity: string): any[] {
    // Заглушка для трендовых данных
    const data = [];
    const interval = granularity === 'minute' ? 60000 : granularity === 'hour' ? 3600000 : 1000;
    
    for (let time = startTime.getTime(); time <= endTime.getTime(); time += interval) {
      data.push({
        timestamp: new Date(time),
        value: Math.floor(Math.random() * 100),
      });
    }
    
    return data;
  }

  private getConnectionsByRole(): Record<string, number> {
    const roleCount: Record<string, number> = {};
    
    this.connections.forEach(connection => {
      const roles = connection.metadata.roles || ['guest'];
      roles.forEach(role => {
        roleCount[role] = (roleCount[role] || 0) + 1;
      });
    });
    
    return roleCount;
  }

  private calculateAvgSessionDuration(): number {
    const now = new Date();
    const durations = Array.from(this.connections.values())
      .map(c => now.getTime() - c.connectedAt.getTime());
    
    return durations.length > 0 
      ? durations.reduce((sum, d) => sum + d, 0) / durations.length 
      : 0;
  }

  private calculateReconnectionRate(): number {
    const totalReconnections = Array.from(this.connections.values())
      .reduce((sum, c) => sum + c.metrics.reconnections, 0);
    
    return this.connectionMetrics.totalConnections > 0 
      ? (totalReconnections / this.connectionMetrics.totalConnections) * 100 
      : 0;
  }

  private calculateLatencyMetrics(): any {
    // Заглушка для метрик латентности
    return {
      min: 5,
      max: 150,
      avg: 25,
      p95: 45,
      p99: 89,
    };
  }

  private getErrorsByType(): Record<string, number> {
    // Заглушка
    return {
      'connection_error': 3,
      'parsing_error': 1,
      'timeout_error': 2,
    };
  }

  private getCriticalErrorsCount(): number {
    // Заглушка
    return 1;
  }

  private getRecentErrors(): any[] {
    // Заглушка
    return [
      {
        timestamp: new Date(),
        type: 'connection_error',
        message: 'WebSocket connection failed',
        source: 'websocket-server',
      },
    ];
  }

  private calculateDimensions(dimensions?: string[]): any[] {
    if (!dimensions) return [];
    
    // Заглушка для измерений
    return dimensions.map(dim => ({
      name: dim,
      values: [
        { value: 'value1', count: 10, percentage: 50 },
        { value: 'value2', count: 10, percentage: 50 },
      ],
    }));
  }

  private getMemoryHealthStatus(): 'healthy' | 'degraded' | 'unhealthy' {
    const memoryUsage = process.memoryUsage();
    const usagePercent = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;
    
    if (usagePercent > 90) return 'unhealthy';
    if (usagePercent > 70) return 'degraded';
    return 'healthy';
  }

  private async connectIntegration(integrationId: string): Promise<void> {
    const integration = this.integrations.get(integrationId);
    if (!integration) return;

    try {
      // Здесь будет логика подключения к внешней системе
      integration.status = IntegrationStatus.CONNECTED;
      integration.lastSync = new Date();
      
      this.logger.log(`🔌 Интеграция подключена: ${integration.name}`);
    } catch (error) {
      integration.status = IntegrationStatus.ERROR;
      this.logger.error(`Ошибка подключения интеграции ${integration.name}:`, error);
    }
  }

  private extractUserIdFromRequest(request: any): string | null {
    // Здесь будет извлечение userId из токена или сессии
    return request.headers['x-user-id'] || null;
  }

  private extractSessionIdFromRequest(request: any): string | null {
    // Здесь будет извлечение sessionId
    return request.headers['x-session-id'] || null;
  }

  private async applyTransforms(event: RealtimeEvent, transforms: any[]): Promise<RealtimeEvent> {
    // Заглушка для трансформаций
    return event;
  }

  private async checkThrottling(subscription: RealtimeSubscription): Promise<boolean> {
    // Заглушка для троттлинга
    return false;
  }

  private async persistEvent(event: RealtimeEvent, subscription: RealtimeSubscription): Promise<void> {
    // Заглушка для персистенции
    this.logger.debug(`Сохранение события ${event.id} для подписки ${subscription.id}`);
  }

  private initializeDefaultQueues(): void {
    // Создаем базовые очереди
    const defaultQueues = [
      { topic: 'terminal.operations', type: QueueType.TOPIC },
      { topic: 'terminal.equipment', type: QueueType.TOPIC },
      { topic: 'terminal.alerts', type: QueueType.PRIORITY },
      { topic: 'terminal.kpi', type: QueueType.TOPIC },
    ];

    defaultQueues.forEach(async queueConfig => {
      await this.createMessageQueue({
        topic: queueConfig.topic,
        type: queueConfig.type,
        config: {
          maxSize: 10000,
          ttl: 3600,
          persistent: false,
          compression: true,
        },
      });
    });

    this.logger.log(`📋 Инициализированы очереди: ${defaultQueues.length}`);
  }

  // Периодические задачи

  @Cron(CronExpression.EVERY_MINUTE)
  private async cleanupExpiredSubscriptions(): Promise<void> {
    const now = new Date();
    let cleanedCount = 0;

    for (const [id, subscription] of this.subscriptions.entries()) {
      // Удаляем неактивные подписки старше 24 часов
      const inactiveTime = now.getTime() - subscription.lastActivity.getTime();
      if (inactiveTime > 24 * 60 * 60 * 1000 && subscription.status !== SubscriptionStatus.ACTIVE) {
        this.subscriptions.delete(id);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      this.logger.log(`🧹 Очищено неактивных подписок: ${cleanedCount}`);
    }
  }

  @Cron(CronExpression.EVERY_5_MINUTES)
  private async updateSubscriptionMetrics(): Promise<void> {
    // Обновляем метрики подписок
    this.subscriptions.forEach(subscription => {
      // Расчет скорости сообщений
      const timeDiff = (new Date().getTime() - subscription.lastActivity.getTime()) / 1000;
      subscription.metrics.messagesPerSecond = timeDiff > 0 
        ? subscription.metrics.totalMessages / timeDiff 
        : 0;
    });
  }

  getServiceStats() {
    return {
      connections: this.connections.size,
      subscriptions: this.subscriptions.size,
      queues: this.queues.size,
      integrations: this.integrations.size,
      wsServerStatus: this.wss ? 'running' : 'stopped',
      totalEvents: Array.from(this.eventCounts.values()).reduce((sum, count) => sum + count, 0),
      connectionMetrics: this.connectionMetrics,
      memoryUsage: process.memoryUsage(),
      uptime: process.uptime(),
    };
  }
}