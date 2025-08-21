import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
  Logger,
  Request,
  Sse,
  MessageEvent,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBearerAuth,
  ApiBody,
} from '@nestjs/swagger';
import { Observable } from 'rxjs';
import { RealtimeService } from './realtime.service';
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
  RealtimeEvent,
  MessageQueue,
  RealtimeAnalytics,
  ExternalIntegration,
  SubscriptionType,
  SubscriptionStatus,
  QueueType,
  IntegrationType,
  SystemHealth,
} from './interfaces/realtime.interface';

// Базовые guards будут добавлены позже при интеграции с Keycloak
// import { JwtAuthGuard } from '../auth/jwt-auth.guard';
// import { RolesGuard } from '../auth/roles.guard';
// import { Roles } from '../auth/roles.decorator';

@ApiTags('realtime')
@Controller('realtime')
// @UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT')
export class RealtimeController {
  private readonly logger = new Logger(RealtimeController.name);

  constructor(private readonly realtimeService: RealtimeService) {}

  @Post('subscriptions')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Создание подписки на данные в реальном времени',
    description: 'Создает новую подписку для получения обновлений в реальном времени',
  })
  @ApiBody({
    type: CreateRealtimeSubscriptionDto,
    description: 'Параметры создания подписки',
    examples: {
      'terminal-operations': {
        summary: 'Подписка на операции терминала',
        value: {
          type: SubscriptionType.TERMINAL_OPERATIONS,
          topic: 'terminal.operations.container_movements',
          filters: [
            {
              field: 'status',
              operator: 'eq',
              value: 'active',
              condition: 'AND',
            },
            {
              field: 'equipment_type',
              operator: 'in',
              value: ['crane', 'reach_stacker'],
              condition: 'AND',
            },
          ],
          config: {
            refreshInterval: 1000,
            bufferSize: 100,
            compression: true,
            throttle: {
              enabled: true,
              maxUpdatesPerSecond: 10,
              strategy: 'buffer',
            },
            aggregation: {
              enabled: true,
              window: 5000,
              functions: [
                {
                  field: 'processing_time',
                  operation: 'avg',
                  alias: 'avg_processing_time',
                },
                {
                  field: 'container_count',
                  operation: 'sum',
                  alias: 'total_containers',
                },
              ],
              groupBy: ['equipment_id'],
            },
          },
        },
      },
      'equipment-monitoring': {
        summary: 'Мониторинг оборудования',
        value: {
          type: SubscriptionType.EQUIPMENT_STATUS,
          topic: 'equipment.status.cranes',
          filters: [
            {
              field: 'status',
              operator: 'ne',
              value: 'offline',
              condition: 'AND',
            },
          ],
          config: {
            refreshInterval: 500,
            compression: false,
            throttle: {
              enabled: true,
              maxUpdatesPerSecond: 20,
              strategy: 'debounce',
            },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Подписка создана',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'sub-uuid' },
            type: { type: 'string', example: 'terminal_operations' },
            topic: { type: 'string', example: 'terminal.operations.container_movements' },
            status: { type: 'string', example: 'active' },
            createdAt: { type: 'string', format: 'date-time' },
            config: { type: 'object' },
          },
        },
        message: { type: 'string', example: 'Подписка создана' },
      },
    },
  })
  // @Roles('MANAGER', 'ADMIN', 'DISPATCHER', 'OPERATOR')
  async createRealtimeSubscription(
    @Body() dto: CreateRealtimeSubscriptionDto,
    @Request() req: any,
  ): Promise<{
    success: boolean;
    data: RealtimeSubscription;
    message: string;
  }> {
    const userId = req.user?.id || 'demo-user';
    const sessionId = req.session?.id || 'demo-session';
    this.logger.log(`📡 Создание подписки real-time: ${dto.topic} - ${userId}`);
    
    const subscription = await this.realtimeService.createRealtimeSubscription(dto, userId, sessionId);
    
    return {
      success: true,
      data: subscription,
      message: 'Подписка на данные в реальном времени создана',
    };
  }

  @Get('subscriptions')
  @ApiOperation({
    summary: 'Получение списка подписок',
    description: 'Возвращает список подписок пользователя с фильтрацией',
  })
  @ApiQuery({ name: 'page', required: false, description: 'Номер страницы', example: 1 })
  @ApiQuery({ name: 'limit', required: false, description: 'Количество элементов', example: 20 })
  @ApiQuery({ name: 'type', required: false, enum: SubscriptionType, description: 'Фильтр по типу' })
  @ApiQuery({ name: 'status', required: false, enum: SubscriptionStatus, description: 'Фильтр по статусу' })
  @ApiQuery({ name: 'topic', required: false, description: 'Поиск по топику' })
  @ApiQuery({ name: 'activeOnly', required: false, description: 'Только активные', example: false })
  @ApiResponse({
    status: 200,
    description: 'Список подписок получен',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: {
          type: 'object',
          properties: {
            subscriptions: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  type: { type: 'string' },
                  topic: { type: 'string' },
                  status: { type: 'string' },
                  createdAt: { type: 'string', format: 'date-time' },
                  lastActivity: { type: 'string', format: 'date-time' },
                  metrics: { type: 'object' },
                },
              },
            },
            total: { type: 'number', example: 15 },
            page: { type: 'number', example: 1 },
            limit: { type: 'number', example: 20 },
          },
        },
        message: { type: 'string', example: 'Список подписок получен' },
      },
    },
  })
  // @Roles('MANAGER', 'ADMIN', 'DISPATCHER', 'OPERATOR', 'VIEWER')
  async getRealtimeSubscriptions(
    @Query() dto: GetRealtimeSubscriptionsDto,
    @Request() req: any,
  ): Promise<{
    success: boolean;
    data: {
      subscriptions: RealtimeSubscription[];
      total: number;
      page: number;
      limit: number;
    };
    message: string;
  }> {
    const userId = req.user?.id || 'demo-user';
    const data = await this.realtimeService.getRealtimeSubscriptions(dto, userId);
    
    return {
      success: true,
      data,
      message: 'Список подписок получен',
    };
  }

  @Get('subscriptions/:subscriptionId')
  @ApiOperation({
    summary: 'Получение подписки',
    description: 'Возвращает детальную информацию о подписке',
  })
  @ApiParam({
    name: 'subscriptionId',
    description: 'ID подписки',
    example: 'sub-uuid',
  })
  @ApiResponse({
    status: 200,
    description: 'Информация о подписке получена',
  })
  @ApiResponse({
    status: 404,
    description: 'Подписка не найдена',
  })
  // @Roles('MANAGER', 'ADMIN', 'DISPATCHER', 'OPERATOR', 'VIEWER')
  async getRealtimeSubscription(@Param('subscriptionId') subscriptionId: string): Promise<{
    success: boolean;
    data: RealtimeSubscription;
    message: string;
  }> {
    const subscription = await this.realtimeService.getRealtimeSubscription(subscriptionId);
    
    return {
      success: true,
      data: subscription,
      message: 'Информация о подписке получена',
    };
  }

  @Put('subscriptions/:subscriptionId')
  @ApiOperation({
    summary: 'Обновление подписки',
    description: 'Обновляет настройки подписки',
  })
  @ApiParam({
    name: 'subscriptionId',
    description: 'ID подписки для обновления',
    example: 'sub-uuid',
  })
  @ApiBody({
    type: UpdateRealtimeSubscriptionDto,
    description: 'Параметры для обновления',
    examples: {
      'update-status': {
        summary: 'Изменение статуса',
        value: {
          status: SubscriptionStatus.PAUSED,
        },
      },
      'update-config': {
        summary: 'Обновление конфигурации',
        value: {
          config: {
            refreshInterval: 2000,
            throttle: {
              enabled: true,
              maxUpdatesPerSecond: 5,
              strategy: 'buffer',
            },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Подписка обновлена',
  })
  // @Roles('MANAGER', 'ADMIN', 'DISPATCHER', 'OPERATOR')
  async updateRealtimeSubscription(
    @Param('subscriptionId') subscriptionId: string,
    @Body() dto: UpdateRealtimeSubscriptionDto,
    @Request() req: any,
  ): Promise<{
    success: boolean;
    data: RealtimeSubscription;
    message: string;
  }> {
    const userId = req.user?.id || 'demo-user';
    const subscription = await this.realtimeService.updateRealtimeSubscription(subscriptionId, dto, userId);
    
    return {
      success: true,
      data: subscription,
      message: 'Подписка обновлена',
    };
  }

  @Delete('subscriptions/:subscriptionId')
  @ApiOperation({
    summary: 'Удаление подписки',
    description: 'Удаляет подписку и прекращает получение обновлений',
  })
  @ApiParam({
    name: 'subscriptionId',
    description: 'ID подписки для удаления',
    example: 'sub-uuid',
  })
  @ApiResponse({
    status: 200,
    description: 'Подписка удалена',
  })
  // @Roles('MANAGER', 'ADMIN', 'DISPATCHER', 'OPERATOR')
  async deleteRealtimeSubscription(
    @Param('subscriptionId') subscriptionId: string,
    @Request() req: any,
  ): Promise<{
    success: boolean;
    message: string;
  }> {
    const userId = req.user?.id || 'demo-user';
    await this.realtimeService.deleteRealtimeSubscription(subscriptionId, userId);
    
    return {
      success: true,
      message: 'Подписка удалена',
    };
  }

  @Post('events')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: 'Публикация события',
    description: 'Публикует событие в систему real-time обновлений',
  })
  @ApiBody({
    type: PublishRealtimeEventDto,
    description: 'Данные события для публикации',
    examples: {
      'container-movement': {
        summary: 'Движение контейнера',
        value: {
          type: 'container_movement',
          topic: 'terminal.operations.container_movements',
          data: {
            containerId: 'cont-123',
            containerNumber: 'MSCU1234567',
            movementType: 'arrival',
            fromLocation: 'vessel-berth-1',
            toLocation: 'yard-block-a-01',
            equipmentId: 'crane-01',
            status: 'completed',
            timestamp: '2024-12-24T10:30:00.000Z',
          },
          source: {
            type: 'equipment',
            id: 'crane-01',
            name: 'Кран портальный №1',
            location: {
              latitude: 55.7558,
              longitude: 37.6176,
            },
          },
          metadata: {
            priority: 'high',
            category: 'operations',
            tags: ['container', 'movement', 'yard'],
            correlationId: 'order-456',
          },
        },
      },
      'equipment-alert': {
        summary: 'Сигнал от оборудования',
        value: {
          type: 'equipment_alert',
          topic: 'equipment.alerts.critical',
          data: {
            equipmentId: 'crane-02',
            alertType: 'overload',
            severity: 'critical',
            message: 'Превышена максимальная нагрузка',
            currentLoad: 45000,
            maxLoad: 40000,
            timestamp: '2024-12-24T10:35:00.000Z',
          },
          source: {
            type: 'equipment',
            id: 'crane-02',
            name: 'Кран портальный №2',
          },
          metadata: {
            priority: 'critical',
            category: 'safety',
            tags: ['equipment', 'overload', 'safety'],
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 202,
    description: 'Событие принято к обработке',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: {
          type: 'object',
          properties: {
            eventId: { type: 'string', example: 'event-uuid' },
            topic: { type: 'string', example: 'terminal.operations.container_movements' },
            timestamp: { type: 'string', format: 'date-time' },
            subscribersNotified: { type: 'number', example: 5 },
          },
        },
        message: { type: 'string', example: 'Событие опубликовано' },
      },
    },
  })
  // @Roles('MANAGER', 'ADMIN', 'DISPATCHER', 'OPERATOR', 'SYSTEM')
  async publishRealtimeEvent(
    @Body() dto: PublishRealtimeEventDto,
    @Request() req: any,
  ): Promise<{
    success: boolean;
    data: {
      eventId: string;
      topic: string;
      timestamp: Date;
      subscribersNotified: number;
    };
    message: string;
  }> {
    const userId = req.user?.id || 'demo-user';
    this.logger.log(`📤 Публикация события: ${dto.type} -> ${dto.topic} - ${userId}`);
    
    const result = await this.realtimeService.publishRealtimeEvent(dto, userId);
    
    return {
      success: true,
      data: result,
      message: 'Событие опубликовано',
    };
  }

  @Sse('stream/:subscriptionId')
  @ApiOperation({
    summary: 'Поток данных SSE',
    description: 'Подключение к потоку Server-Sent Events для получения обновлений',
  })
  @ApiParam({
    name: 'subscriptionId',
    description: 'ID подписки для потока',
    example: 'sub-uuid',
  })
  @ApiResponse({
    status: 200,
    description: 'Поток SSE установлен',
  })
  // @Roles('MANAGER', 'ADMIN', 'DISPATCHER', 'OPERATOR', 'VIEWER')
  getRealtimeStream(@Param('subscriptionId') subscriptionId: string): Observable<MessageEvent> {
    this.logger.log(`🌊 Подключение к потоку SSE: ${subscriptionId}`);
    return this.realtimeService.getRealtimeStream(subscriptionId);
  }

  @Post('queues')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Создание очереди сообщений',
    description: 'Создает новую очередь для обработки сообщений',
  })
  @ApiBody({
    type: CreateMessageQueueDto,
    description: 'Параметры создания очереди',
    examples: {
      'priority-queue': {
        summary: 'Приоритетная очередь',
        value: {
          topic: 'terminal.alerts',
          type: QueueType.PRIORITY,
          config: {
            maxSize: 10000,
            ttl: 3600,
            persistent: true,
            compression: true,
            priority: {
              enabled: true,
              levels: 5,
            },
            deduplication: {
              enabled: true,
              window: 300,
              keyFields: ['type', 'source.id'],
            },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Очередь создана',
  })
  // @Roles('MANAGER', 'ADMIN')
  async createMessageQueue(
    @Body() dto: CreateMessageQueueDto,
    @Request() req: any,
  ): Promise<{
    success: boolean;
    data: MessageQueue;
    message: string;
  }> {
    const userId = req.user?.id || 'demo-user';
    const queue = await this.realtimeService.createMessageQueue(dto, userId);
    
    return {
      success: true,
      data: queue,
      message: 'Очередь сообщений создана',
    };
  }

  @Get('queues')
  @ApiOperation({
    summary: 'Получение списка очередей',
    description: 'Возвращает список очередей сообщений с метриками',
  })
  @ApiResponse({
    status: 200,
    description: 'Список очередей получен',
  })
  // @Roles('MANAGER', 'ADMIN', 'VIEWER')
  async getMessageQueues(): Promise<{
    success: boolean;
    data: MessageQueue[];
    message: string;
  }> {
    const queues = await this.realtimeService.getMessageQueues();
    
    return {
      success: true,
      data: queues,
      message: 'Список очередей получен',
    };
  }

  @Get('analytics')
  @ApiOperation({
    summary: 'Аналитика real-time данных',
    description: 'Возвращает аналитическую информацию о real-time системе',
  })
  @ApiQuery({ name: 'startTime', required: false, description: 'Дата начала периода' })
  @ApiQuery({ name: 'endTime', required: false, description: 'Дата окончания периода' })
  @ApiQuery({ name: 'granularity', required: false, enum: ['second', 'minute', 'hour'], description: 'Гранулярность' })
  @ApiQuery({ name: 'dimensions', required: false, description: 'Измерения для группировки' })
  @ApiResponse({
    status: 200,
    description: 'Аналитика получена',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: {
          type: 'object',
          properties: {
            sessionId: { type: 'string' },
            timeframe: { type: 'object' },
            metrics: {
              type: 'object',
              properties: {
                events: {
                  type: 'object',
                  properties: {
                    total: { type: 'number', example: 1250 },
                    rate: { type: 'number', example: 15.5 },
                    byType: { type: 'object' },
                    byTopic: { type: 'object' },
                  },
                },
                connections: {
                  type: 'object',
                  properties: {
                    active: { type: 'number', example: 45 },
                    total: { type: 'number', example: 120 },
                    avgSessionDuration: { type: 'number', example: 3600 },
                  },
                },
                performance: {
                  type: 'object',
                  properties: {
                    latency: { type: 'object' },
                    throughput: { type: 'number', example: 850 },
                    errorRate: { type: 'number', example: 0.5 },
                  },
                },
              },
            },
            generatedAt: { type: 'string', format: 'date-time' },
          },
        },
        message: { type: 'string', example: 'Аналитика получена' },
      },
    },
  })
  // @Roles('MANAGER', 'ADMIN', 'ANALYST', 'VIEWER')
  async getRealtimeAnalytics(@Query() dto: GetRealtimeAnalyticsDto): Promise<{
    success: boolean;
    data: RealtimeAnalytics;
    message: string;
  }> {
    const analytics = await this.realtimeService.getRealtimeAnalytics(dto);
    
    return {
      success: true,
      data: analytics,
      message: 'Аналитика real-time системы получена',
    };
  }

  @Post('integrations')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Создание внешней интеграции',
    description: 'Создает интеграцию с внешней системой для получения данных',
  })
  @ApiBody({
    type: CreateExternalIntegrationDto,
    description: 'Параметры интеграции',
    examples: {
      'kafka-integration': {
        summary: 'Интеграция с Kafka',
        value: {
          name: 'Kafka Container Events',
          type: IntegrationType.KAFKA,
          config: {
            endpoint: 'localhost:9092',
            credentials: {
              username: 'kafka_user',
              password: 'secure_password',
            },
            timeout: 30000,
            retries: 3,
            batchSize: 100,
            mappings: [
              {
                source: 'container_id',
                target: 'containerId',
                required: true,
              },
              {
                source: 'movement_type',
                target: 'movementType',
                transform: 'uppercase',
                required: true,
              },
            ],
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Интеграция создана',
  })
  // @Roles('MANAGER', 'ADMIN')
  async createExternalIntegration(
    @Body() dto: CreateExternalIntegrationDto,
    @Request() req: any,
  ): Promise<{
    success: boolean;
    data: ExternalIntegration;
    message: string;
  }> {
    const userId = req.user?.id || 'demo-user';
    const integration = await this.realtimeService.createExternalIntegration(dto, userId);
    
    return {
      success: true,
      data: integration,
      message: 'Внешняя интеграция создана',
    };
  }

  @Get('integrations')
  @ApiOperation({
    summary: 'Получение списка интеграций',
    description: 'Возвращает список настроенных внешних интеграций',
  })
  @ApiResponse({
    status: 200,
    description: 'Список интеграций получен',
  })
  // @Roles('MANAGER', 'ADMIN', 'VIEWER')
  async getExternalIntegrations(): Promise<{
    success: boolean;
    data: ExternalIntegration[];
    message: string;
  }> {
    const integrations = await this.realtimeService.getExternalIntegrations();
    
    return {
      success: true,
      data: integrations,
      message: 'Список внешних интеграций получен',
    };
  }

  @Get('health')
  @ApiOperation({
    summary: 'Состояние системы real-time',
    description: 'Возвращает информацию о состоянии системы real-time обновлений',
  })
  @ApiResponse({
    status: 200,
    description: 'Состояние системы получено',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: {
          type: 'object',
          properties: {
            status: { type: 'string', example: 'healthy' },
            components: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string', example: 'WebSocket Server' },
                  status: { type: 'string', example: 'healthy' },
                  message: { type: 'string' },
                  metrics: { type: 'object' },
                },
              },
            },
            metrics: {
              type: 'object',
              properties: {
                uptime: { type: 'number', example: 86400 },
                connectionsCount: { type: 'number', example: 45 },
                subscriptionsCount: { type: 'number', example: 128 },
                messagesPerSecond: { type: 'number', example: 25.5 },
                errorRate: { type: 'number', example: 0.2 },
              },
            },
            lastChecked: { type: 'string', format: 'date-time' },
          },
        },
        message: { type: 'string', example: 'Состояние системы получено' },
      },
    },
  })
  async getSystemHealth(): Promise<{
    success: boolean;
    data: SystemHealth;
    message: string;
  }> {
    const health = await this.realtimeService.getSystemHealth();
    
    return {
      success: true,
      data: health,
      message: 'Состояние real-time системы получено',
    };
  }

  @Get('stats')
  @ApiOperation({
    summary: 'Статистика real-time сервиса',
    description: 'Возвращает техническую статистику работы сервиса',
  })
  @ApiResponse({
    status: 200,
    description: 'Статистика получена',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: {
          type: 'object',
          properties: {
            subscriptions: { type: 'number', example: 128 },
            activeConnections: { type: 'number', example: 45 },
            messageQueues: { type: 'number', example: 8 },
            externalIntegrations: { type: 'number', example: 3 },
            eventsProcessed: { type: 'number', example: 15678 },
            avgLatency: { type: 'number', example: 45.2 },
            memoryUsage: {
              type: 'object',
              properties: {
                rss: { type: 'number' },
                heapTotal: { type: 'number' },
                heapUsed: { type: 'number' },
                external: { type: 'number' },
              },
            },
            uptime: { type: 'number', example: 86400 },
          },
        },
        message: { type: 'string', example: 'Статистика получена' },
      },
    },
  })
  // @Roles('ADMIN')
  async getServiceStats(): Promise<{
    success: boolean;
    data: any;
    message: string;
  }> {
    const stats = this.realtimeService.getServiceStats();
    
    return {
      success: true,
      data: stats,
      message: 'Статистика real-time сервиса получена',
    };
  }

  @Post('events/terminal-operation')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: 'Публикация операции терминала',
    description: 'Специализированный endpoint для публикации операций терминала',
  })
  @ApiBody({
    description: 'Данные операции терминала',
    schema: {
      type: 'object',
      properties: {
        operationType: { type: 'string', example: 'gate_in' },
        containerId: { type: 'string', example: 'cont-123' },
        containerNumber: { type: 'string', example: 'MSCU1234567' },
        equipmentId: { type: 'string', example: 'crane-01' },
        location: {
          type: 'object',
          properties: {
            from: { type: 'string', example: 'gate-1' },
            to: { type: 'string', example: 'yard-a-01' },
          },
        },
        status: { type: 'string', example: 'completed' },
      },
    },
  })
  @ApiResponse({
    status: 202,
    description: 'Операция опубликована',
  })
  // @Roles('SYSTEM', 'OPERATOR', 'DISPATCHER')
  async publishTerminalOperation(@Body() data: any): Promise<{
    success: boolean;
    message: string;
  }> {
    await this.realtimeService.publishTerminalOperationEvent(data);
    
    return {
      success: true,
      message: 'Операция терминала опубликована',
    };
  }

  @Post('events/equipment-status')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: 'Публикация статуса оборудования',
    description: 'Специализированный endpoint для публикации статуса оборудования',
  })
  @ApiBody({
    description: 'Данные статуса оборудования',
    schema: {
      type: 'object',
      properties: {
        equipmentId: { type: 'string', example: 'crane-01' },
        equipmentType: { type: 'string', example: 'crane' },
        status: { type: 'string', example: 'active' },
        position: {
          type: 'object',
          properties: {
            latitude: { type: 'number', example: 55.7558 },
            longitude: { type: 'number', example: 37.6176 },
          },
        },
        telemetry: {
          type: 'object',
          properties: {
            cpu: { type: 'number', example: 65.5 },
            memory: { type: 'number', example: 78.2 },
            fuel: { type: 'number', example: 85.0 },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 202,
    description: 'Статус оборудования опубликован',
  })
  // @Roles('SYSTEM', 'EQUIPMENT', 'OPERATOR')
  async publishEquipmentStatus(@Body() data: any): Promise<{
    success: boolean;
    message: string;
  }> {
    await this.realtimeService.publishEquipmentStatusEvent(data);
    
    return {
      success: true,
      message: 'Статус оборудования опубликован',
    };
  }
}