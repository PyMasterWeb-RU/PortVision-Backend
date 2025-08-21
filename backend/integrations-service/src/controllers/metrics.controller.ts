import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
  ApiBody,
} from '@nestjs/swagger';
import { MetricsService, AlertConfiguration } from '../services/metrics.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';

@ApiTags('Metrics & Health')
@Controller('metrics')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT')
export class MetricsController {
  private readonly logger = new Logger(MetricsController.name);

  constructor(private readonly metricsService: MetricsService) {}

  @Get('system')
  @ApiOperation({ 
    summary: 'Получить системные метрики',
    description: 'Возвращает общие метрики системы интеграций'
  })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Системные метрики получены',
    schema: {
      type: 'object',
      properties: {
        totalEndpoints: { type: 'number', description: 'Общее количество интеграций' },
        activeEndpoints: { type: 'number', description: 'Активные интеграции' },
        healthyEndpoints: { type: 'number', description: 'Здоровые интеграции' },
        errorEndpoints: { type: 'number', description: 'Интеграции с ошибками' },
        totalMessages: { type: 'number', description: 'Всего обработано сообщений' },
        totalErrors: { type: 'number', description: 'Всего ошибок' },
        systemUptime: { type: 'number', description: 'Время работы системы в мс' },
        memoryUsage: { 
          type: 'object',
          properties: {
            used: { type: 'number' },
            total: { type: 'number' },
            percentage: { type: 'number' }
          }
        },
        cpuUsage: { type: 'number', description: 'Использование CPU' },
        redisConnectionCount: { type: 'number', description: 'Количество Redis соединений' }
      }
    }
  })
  async getSystemMetrics() {
    return await this.metricsService.getSystemMetrics();
  }

  @Get('alerts')
  @ApiOperation({ 
    summary: 'Получить активные алерты',
    description: 'Возвращает список всех активных алертов'
  })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Список алертов получен',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          endpointId: { type: 'string' },
          type: { type: 'string' },
          severity: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
          message: { type: 'string' },
          value: { type: 'number' },
          threshold: { type: 'number' },
          triggeredAt: { type: 'string', format: 'date-time' },
          acknowledged: { type: 'boolean' },
          acknowledgedBy: { type: 'string' },
          acknowledgedAt: { type: 'string', format: 'date-time' },
          resolvedAt: { type: 'string', format: 'date-time' },
          metadata: { type: 'object' }
        }
      }
    }
  })
  @ApiQuery({ name: 'severity', required: false, enum: ['low', 'medium', 'high', 'critical'], description: 'Фильтр по уровню серьезности' })
  @ApiQuery({ name: 'endpointId', required: false, description: 'Фильтр по ID интеграции' })
  @ApiQuery({ name: 'acknowledged', required: false, type: Boolean, description: 'Фильтр по статусу подтверждения' })
  async getActiveAlerts(
    @Query('severity') severity?: string,
    @Query('endpointId') endpointId?: string,
    @Query('acknowledged') acknowledged?: boolean,
  ) {
    let alerts = await this.metricsService.getActiveAlerts();

    // Применяем фильтры
    if (severity) {
      alerts = alerts.filter(alert => alert.severity === severity);
    }

    if (endpointId) {
      alerts = alerts.filter(alert => alert.endpointId === endpointId);
    }

    if (acknowledged !== undefined) {
      alerts = alerts.filter(alert => alert.acknowledged === acknowledged);
    }

    return alerts;
  }

  @Post('alerts')
  @ApiOperation({ 
    summary: 'Создать конфигурацию алерта',
    description: 'Создает новую конфигурацию алерта для интеграции'
  })
  @ApiResponse({ 
    status: HttpStatus.CREATED, 
    description: 'Конфигурация алерта создана'
  })
  @ApiBody({
    description: 'Конфигурация алерта',
    examples: {
      errorRateAlert: {
        summary: 'Алерт по уровню ошибок',
        value: {
          endpointId: '12345678-1234-1234-1234-123456789012',
          type: 'error_rate',
          threshold: 15,
          timeWindow: 300,
          enabled: true,
          notificationChannels: ['email', 'webhook'],
          cooldownPeriod: 900
        }
      },
      processingDelayAlert: {
        summary: 'Алерт по задержке обработки',
        value: {
          endpointId: '12345678-1234-1234-1234-123456789012',
          type: 'processing_delay',
          threshold: 30000,
          timeWindow: 600,
          enabled: true,
          notificationChannels: ['webhook'],
          cooldownPeriod: 1800
        }
      }
    }
  })
  async createAlert(@Body() config: AlertConfiguration): Promise<void> {
    this.logger.log(`🚨 Создание алерта для интеграции ${config.endpointId}: ${config.type}`);
    await this.metricsService.createAlert(config);
  }

  @Put('alerts/:alertId/acknowledge')
  @ApiOperation({ 
    summary: 'Подтвердить алерт',
    description: 'Подтверждает алерт как просмотренный пользователем'
  })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Алерт подтвержден'
  })
  @ApiParam({ name: 'alertId', description: 'ID алерта' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        userId: { type: 'string', description: 'ID пользователя, подтверждающего алерт' }
      },
      required: ['userId']
    }
  })
  async acknowledgeAlert(
    @Param('alertId') alertId: string,
    @Body('userId') userId: string,
  ): Promise<void> {
    this.logger.log(`✅ Подтверждение алерта ${alertId} пользователем ${userId}`);
    await this.metricsService.acknowledgeAlert(alertId, userId);
  }

  @Put('alerts/:alertId/resolve')
  @ApiOperation({ 
    summary: 'Разрешить алерт',
    description: 'Помечает алерт как разрешенный'
  })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Алерт разрешен'
  })
  @ApiParam({ name: 'alertId', description: 'ID алерта' })
  async resolveAlert(@Param('alertId') alertId: string): Promise<void> {
    this.logger.log(`✅ Разрешение алерта ${alertId}`);
    await this.metricsService.resolveAlert(alertId);
  }

  @Get('dashboards/overview')
  @ApiOperation({ 
    summary: 'Получить данные для обзорного дашборда',
    description: 'Возвращает агрегированные данные для главного дашборда'
  })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Данные дашборда получены',
    schema: {
      type: 'object',
      properties: {
        systemMetrics: { type: 'object' },
        activeAlerts: { 
          type: 'object',
          properties: {
            total: { type: 'number' },
            critical: { type: 'number' },
            high: { type: 'number' },
            medium: { type: 'number' },
            low: { type: 'number' }
          }
        },
        topPerformers: { 
          type: 'array',
          items: {
            type: 'object',
            properties: {
              endpointId: { type: 'string' },
              name: { type: 'string' },
              throughputPerMinute: { type: 'number' },
              errorRate: { type: 'number' },
              uptime: { type: 'number' }
            }
          }
        },
        problematicEndpoints: { 
          type: 'array',
          items: {
            type: 'object',
            properties: {
              endpointId: { type: 'string' },
              name: { type: 'string' },
              status: { type: 'string' },
              errorRate: { type: 'number' },
              lastError: { type: 'string' }
            }
          }
        },
        messageVolumeChart: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              timestamp: { type: 'string' },
              received: { type: 'number' },
              processed: { type: 'number' },
              failed: { type: 'number' }
            }
          }
        }
      }
    }
  })
  @ApiQuery({ name: 'timeRange', required: false, enum: ['1h', '6h', '24h', '7d', '30d'], description: 'Временной диапазон для данных' })
  async getOverviewDashboard(@Query('timeRange') timeRange: string = '24h') {
    // Получаем системные метрики
    const systemMetrics = await this.metricsService.getSystemMetrics();

    // Получаем активные алерты с группировкой по серьезности
    const alerts = await this.metricsService.getActiveAlerts();
    const activeAlerts = {
      total: alerts.length,
      critical: alerts.filter(a => a.severity === 'critical').length,
      high: alerts.filter(a => a.severity === 'high').length,
      medium: alerts.filter(a => a.severity === 'medium').length,
      low: alerts.filter(a => a.severity === 'low').length,
    };

    // Получаем топ-исполнителей (заглушка - в реальности нужен запрос к БД)
    const topPerformers = [
      {
        endpointId: 'endpoint-1',
        name: 'Main Gate OCR',
        throughputPerMinute: 45.5,
        errorRate: 2.1,
        uptime: 99.8
      },
      {
        endpointId: 'endpoint-2', 
        name: 'Equipment GPS Tracker',
        throughputPerMinute: 120.3,
        errorRate: 0.5,
        uptime: 100.0
      },
      {
        endpointId: 'endpoint-3',
        name: 'RFID Gate Reader',
        throughputPerMinute: 78.2,
        errorRate: 1.8,
        uptime: 98.7
      }
    ];

    // Проблемные интеграции (заглушка)
    const problematicEndpoints = [
      {
        endpointId: 'endpoint-4',
        name: '1C Integration',
        status: 'error',
        errorRate: 25.6,
        lastError: 'Connection timeout to 1C server'
      }
    ];

    // График объема сообщений за последние часы (заглушка)
    const messageVolumeChart = [];
    const now = new Date();
    const hoursToShow = timeRange === '1h' ? 1 : timeRange === '6h' ? 6 : 24;
    
    for (let i = hoursToShow - 1; i >= 0; i--) {
      const timestamp = new Date(now.getTime() - i * 60 * 60 * 1000);
      messageVolumeChart.push({
        timestamp: timestamp.toISOString(),
        received: Math.floor(Math.random() * 100) + 50,
        processed: Math.floor(Math.random() * 95) + 45,
        failed: Math.floor(Math.random() * 10),
      });
    }

    return {
      systemMetrics,
      activeAlerts,
      topPerformers,
      problematicEndpoints,
      messageVolumeChart,
    };
  }

  @Get('dashboards/performance')
  @ApiOperation({ 
    summary: 'Получить данные для дашборда производительности',
    description: 'Возвращает детальные метрики производительности всех интеграций'
  })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Данные производительности получены'
  })
  @ApiQuery({ name: 'endpointId', required: false, description: 'Фильтр по ID интеграции' })
  @ApiQuery({ name: 'timeRange', required: false, enum: ['1h', '6h', '24h', '7d', '30d'], description: 'Временной диапазон' })
  async getPerformanceDashboard(
    @Query('endpointId') endpointId?: string,
    @Query('timeRange') timeRange: string = '24h',
  ) {
    if (endpointId) {
      // Возвращаем детальные метрики для конкретной интеграции
      const metrics = await this.metricsService.getEndpointMetrics(endpointId);
      
      if (!metrics) {
        return { error: 'Метрики не найдены для указанной интеграции' };
      }

      return {
        endpoint: {
          id: metrics.endpointId,
          name: metrics.endpointName,
          type: metrics.type
        },
        currentMetrics: {
          messagesReceived: metrics.messagesReceived,
          messagesProcessed: metrics.messagesProcessed,
          messagesFailed: metrics.messagesFailed,
          errorRate: metrics.errorRate,
          averageProcessingTime: metrics.averageProcessingTime,
          throughputPerMinute: metrics.throughputPerMinute,
          uptime: metrics.uptime
        },
        latencyDistribution: {
          p50: metrics.latencyP50,
          p95: metrics.latencyP95,
          p99: metrics.latencyP99
        },
        hourlyStats: metrics.hourlyStats,
        healthStatus: {
          isHealthy: metrics.errorRate < 10 && metrics.uptime > 0,
          lastProcessedAt: metrics.lastProcessedAt
        }
      };
    }

    // Возвращаем общие метрики производительности
    const systemMetrics = await this.metricsService.getSystemMetrics();
    
    return {
      summary: {
        totalMessages: systemMetrics.totalMessages,
        totalErrors: systemMetrics.totalErrors,
        averageErrorRate: systemMetrics.totalMessages > 0 
          ? (systemMetrics.totalErrors / systemMetrics.totalMessages) * 100 
          : 0,
        activeEndpoints: systemMetrics.activeEndpoints,
        healthyEndpoints: systemMetrics.healthyEndpoints
      },
      systemResources: {
        memoryUsage: systemMetrics.memoryUsage,
        cpuUsage: systemMetrics.cpuUsage,
        redisConnections: systemMetrics.redisConnectionCount
      }
    };
  }

  @Get('health')
  @ApiOperation({ 
    summary: 'Получить общее состояние здоровья системы',
    description: 'Возвращает агрегированную информацию о здоровье всей системы интеграций'
  })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Состояние здоровья получено',
    schema: {
      type: 'object',
      properties: {
        overall: { 
          type: 'string', 
          enum: ['healthy', 'degraded', 'unhealthy'],
          description: 'Общее состояние системы'
        },
        score: { 
          type: 'number', 
          minimum: 0, 
          maximum: 100,
          description: 'Общий балл здоровья системы (0-100)'
        },
        components: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              status: { type: 'string', enum: ['up', 'down', 'degraded'] },
              message: { type: 'string' },
              responseTime: { type: 'number' }
            }
          }
        },
        integrations: {
          type: 'object',
          properties: {
            total: { type: 'number' },
            healthy: { type: 'number' },
            degraded: { type: 'number' },
            down: { type: 'number' }
          }
        },
        criticalAlerts: { type: 'number' }
      }
    }
  })
  async getHealthStatus() {
    const systemMetrics = await this.metricsService.getSystemMetrics();
    const alerts = await this.metricsService.getActiveAlerts();
    const criticalAlerts = alerts.filter(a => a.severity === 'critical').length;

    // Проверяем компоненты системы
    const components = [];

    // Проверка базы данных (заглушка)
    components.push({
      name: 'Database',
      status: 'up',
      message: 'PostgreSQL connection healthy',
      responseTime: 5
    });

    // Проверка Redis
    components.push({
      name: 'Redis',
      status: systemMetrics.redisConnectionCount > 0 ? 'up' : 'down',
      message: `${systemMetrics.redisConnectionCount} connections active`,
      responseTime: 2
    });

    // Проверка памяти
    const memoryStatus = systemMetrics.memoryUsage.percentage < 80 ? 'up' : 
                        systemMetrics.memoryUsage.percentage < 90 ? 'degraded' : 'down';
    components.push({
      name: 'Memory',
      status: memoryStatus,
      message: `${systemMetrics.memoryUsage.percentage.toFixed(1)}% used`,
      responseTime: 0
    });

    // Вычисляем общий балл здоровья
    let healthScore = 100;
    
    // Снижаем балл за неактивные интеграции
    const inactiveRatio = (systemMetrics.totalEndpoints - systemMetrics.activeEndpoints) / systemMetrics.totalEndpoints;
    healthScore -= inactiveRatio * 20;
    
    // Снижаем балл за интеграции с ошибками
    const errorRatio = systemMetrics.errorEndpoints / systemMetrics.totalEndpoints;
    healthScore -= errorRatio * 30;
    
    // Снижаем балл за критические алерты
    healthScore -= criticalAlerts * 10;
    
    // Снижаем балл за высокое использование памяти
    if (systemMetrics.memoryUsage.percentage > 90) {
      healthScore -= 20;
    } else if (systemMetrics.memoryUsage.percentage > 80) {
      healthScore -= 10;
    }

    healthScore = Math.max(0, Math.min(100, healthScore));

    // Определяем общее состояние
    const overall = healthScore >= 80 ? 'healthy' : 
                   healthScore >= 60 ? 'degraded' : 'unhealthy';

    return {
      overall,
      score: Math.round(healthScore),
      components,
      integrations: {
        total: systemMetrics.totalEndpoints,
        healthy: systemMetrics.healthyEndpoints,
        degraded: systemMetrics.activeEndpoints - systemMetrics.healthyEndpoints - systemMetrics.errorEndpoints,
        down: systemMetrics.errorEndpoints
      },
      criticalAlerts
    };
  }

  @Post('collect')
  @ApiOperation({ 
    summary: 'Принудительно запустить сбор метрик',
    description: 'Запускает внеплановый сбор метрик для всех активных интеграций'
  })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Сбор метрик запущен'
  })
  async forceMetricsCollection() {
    this.logger.log('📊 Запуск принудительного сбора метрик');
    await this.metricsService.collectMetrics();
    
    return {
      message: 'Сбор метрик успешно запущен',
      timestamp: new Date().toISOString()
    };
  }
}