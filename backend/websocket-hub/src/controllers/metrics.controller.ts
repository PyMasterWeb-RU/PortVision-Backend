import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  HttpStatus,
  HttpException,
  UseGuards,
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
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { MetricsService, AlertRule, MetricsSnapshot } from '../services/metrics.service';

@ApiTags('Metrics & Monitoring')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('metrics')
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Get('current')
  @ApiOperation({ 
    summary: 'Получить текущие метрики',
    description: 'Возвращает снимок текущих метрик системы WebSocket Hub',
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Текущие метрики получены успешно',
  })
  async getCurrentMetrics(): Promise<MetricsSnapshot> {
    try {
      return await this.metricsService.getCurrentMetrics();
    } catch (error) {
      throw new HttpException(
        `Ошибка получения текущих метрик: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('history')
  @ApiOperation({ 
    summary: 'Получить историю метрик',
    description: 'Возвращает историю метрик за указанный период',
  })
  @ApiQuery({ name: 'hours', required: false, description: 'Период в часах (по умолчанию 24)' })
  @ApiResponse({ 
    status: 200, 
    description: 'История метрик получена успешно',
  })
  async getMetricsHistory(@Query('hours') hours?: string): Promise<MetricsSnapshot[]> {
    try {
      const hoursValue = hours ? parseInt(hours, 10) : 24;
      return await this.metricsService.getMetricsHistory(hoursValue);
    } catch (error) {
      throw new HttpException(
        `Ошибка получения истории метрик: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('connections')
  @ApiOperation({ 
    summary: 'Получить метрики WebSocket соединений',
    description: 'Возвращает подробные метрики о WebSocket соединениях',
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Метрики соединений получены успешно',
  })
  async getConnectionMetrics(): Promise<any> {
    try {
      return await this.metricsService.getConnectionMetrics();
    } catch (error) {
      throw new HttpException(
        `Ошибка получения метрик соединений: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('subscriptions')
  @ApiOperation({ 
    summary: 'Получить метрики подписок',
    description: 'Возвращает подробные метрики о подписках на события',
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Метрики подписок получены успешно',
  })
  async getSubscriptionMetrics(): Promise<any> {
    try {
      return await this.metricsService.getSubscriptionMetrics();
    } catch (error) {
      throw new HttpException(
        `Ошибка получения метрик подписок: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('notifications')
  @ApiOperation({ 
    summary: 'Получить метрики уведомлений',
    description: 'Возвращает подробные метрики о доставке уведомлений',
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Метрики уведомлений получены успешно',
  })
  async getNotificationMetrics(): Promise<any> {
    try {
      return await this.metricsService.getNotificationMetrics();
    } catch (error) {
      throw new HttpException(
        `Ошибка получения метрик уведомлений: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('performance')
  @ApiOperation({ 
    summary: 'Получить метрики производительности',
    description: 'Возвращает метрики производительности системы (память, CPU, время отклика)',
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Метрики производительности получены успешно',
  })
  async getPerformanceMetrics(): Promise<any> {
    try {
      return await this.metricsService.getPerformanceMetrics();
    } catch (error) {
      throw new HttpException(
        `Ошибка получения метрик производительности: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('health')
  @ApiOperation({ 
    summary: 'Получить оценку здоровья системы',
    description: 'Возвращает общую оценку здоровья системы и список выявленных проблем',
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Оценка здоровья системы получена успешно',
  })
  async getHealthScore(): Promise<any> {
    try {
      return await this.metricsService.getHealthScore();
    } catch (error) {
      throw new HttpException(
        `Ошибка получения оценки здоровья: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('trends/:metric')
  @ApiOperation({ 
    summary: 'Получить тренд по метрике',
    description: 'Возвращает данные тренда для указанной метрики за определенный период',
  })
  @ApiParam({ name: 'metric', description: 'Название метрики (например, connections.active)' })
  @ApiQuery({ name: 'hours', required: false, description: 'Период в часах (по умолчанию 24)' })
  @ApiResponse({ 
    status: 200, 
    description: 'Данные тренда получены успешно',
  })
  async getTrendData(
    @Param('metric') metric: string,
    @Query('hours') hours?: string,
  ): Promise<any[]> {
    try {
      const hoursValue = hours ? parseInt(hours, 10) : 24;
      return await this.metricsService.getTrendData(metric, hoursValue);
    } catch (error) {
      throw new HttpException(
        `Ошибка получения данных тренда: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('alerts')
  @ApiOperation({ 
    summary: 'Получить список алертов',
    description: 'Возвращает список всех настроенных правил алертов',
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Список алертов получен успешно',
  })
  async getAlerts(): Promise<AlertRule[]> {
    try {
      return await this.metricsService.getAlerts();
    } catch (error) {
      throw new HttpException(
        `Ошибка получения алертов: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('alerts')
  @ApiOperation({ 
    summary: 'Создать новый алерт',
    description: 'Создает новое правило алерта для мониторинга метрик',
  })
  @ApiBody({ 
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Название алерта' },
        description: { type: 'string', description: 'Описание алерта' },
        metric: { type: 'string', description: 'Метрика для отслеживания' },
        operator: { type: 'string', enum: ['gt', 'lt', 'eq', 'gte', 'lte'], description: 'Оператор сравнения' },
        threshold: { type: 'number', description: 'Пороговое значение' },
        duration: { type: 'number', description: 'Длительность в минутах' },
        severity: { type: 'string', enum: ['low', 'medium', 'high', 'critical'], description: 'Уровень серьезности' },
        enabled: { type: 'boolean', description: 'Включен ли алерт' },
        actions: { type: 'array', items: { type: 'string' }, description: 'Список действий' },
      },
      required: ['name', 'description', 'metric', 'operator', 'threshold', 'duration', 'severity', 'enabled', 'actions'],
    },
  })
  @ApiResponse({ 
    status: 201, 
    description: 'Алерт создан успешно',
  })
  async createAlert(@Body() alertData: Omit<AlertRule, 'id'>): Promise<AlertRule> {
    try {
      return await this.metricsService.addAlert(alertData);
    } catch (error) {
      throw new HttpException(
        `Ошибка создания алерта: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Put('alerts/:id')
  @ApiOperation({ 
    summary: 'Обновить алерт',
    description: 'Обновляет существующее правило алерта',
  })
  @ApiParam({ name: 'id', description: 'ID алерта' })
  @ApiResponse({ 
    status: 200, 
    description: 'Алерт обновлен успешно',
  })
  @ApiResponse({ 
    status: 404, 
    description: 'Алерт не найден',
  })
  async updateAlert(
    @Param('id') id: string,
    @Body() updates: Partial<AlertRule>,
  ): Promise<AlertRule> {
    try {
      const updatedAlert = await this.metricsService.updateAlert(id, updates);
      
      if (!updatedAlert) {
        throw new HttpException(
          `Алерт ${id} не найден`,
          HttpStatus.NOT_FOUND,
        );
      }
      
      return updatedAlert;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      
      throw new HttpException(
        `Ошибка обновления алерта: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Delete('alerts/:id')
  @ApiOperation({ 
    summary: 'Удалить алерт',
    description: 'Удаляет правило алерта из системы',
  })
  @ApiParam({ name: 'id', description: 'ID алерта' })
  @ApiResponse({ 
    status: 200, 
    description: 'Алерт удален успешно',
  })
  @ApiResponse({ 
    status: 404, 
    description: 'Алерт не найден',
  })
  async deleteAlert(@Param('id') id: string): Promise<{ message: string }> {
    try {
      const deleted = await this.metricsService.deleteAlert(id);
      
      if (!deleted) {
        throw new HttpException(
          `Алерт ${id} не найден`,
          HttpStatus.NOT_FOUND,
        );
      }
      
      return { message: `Алерт ${id} удален` };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      
      throw new HttpException(
        `Ошибка удаления алерта: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('alerts/active')
  @ApiOperation({ 
    summary: 'Получить активные алерты',
    description: 'Возвращает список всех активных (сработавших) алертов',
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Список активных алертов получен успешно',
  })
  async getActiveAlerts(): Promise<Array<{ alert: AlertRule; since: Date }>> {
    try {
      return await this.metricsService.getActiveAlerts();
    } catch (error) {
      throw new HttpException(
        `Ошибка получения активных алертов: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('collect')
  @ApiOperation({ 
    summary: 'Принудительно собрать метрики',
    description: 'Запускает принудительный сбор метрик (обычно происходит автоматически каждую минуту)',
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Метрики собраны успешно',
  })
  async forceCollectMetrics(): Promise<{ message: string; timestamp: Date }> {
    try {
      await this.metricsService.collectMetrics();
      return {
        message: 'Метрики собраны принудительно',
        timestamp: new Date(),
      };
    } catch (error) {
      throw new HttpException(
        `Ошибка принудительного сбора метрик: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('dashboard')
  @ApiOperation({ 
    summary: 'Получить данные для дашборда',
    description: 'Возвращает агрегированные данные для отображения на дашборде мониторинга',
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Данные дашборда получены успешно',
  })
  async getDashboardData(): Promise<any> {
    try {
      const [
        currentMetrics,
        healthScore,
        connectionMetrics,
        subscriptionMetrics,
        notificationMetrics,
        performanceMetrics,
        activeAlerts,
      ] = await Promise.all([
        this.metricsService.getCurrentMetrics(),
        this.metricsService.getHealthScore(),
        this.metricsService.getConnectionMetrics(),
        this.metricsService.getSubscriptionMetrics(),
        this.metricsService.getNotificationMetrics(),
        this.metricsService.getPerformanceMetrics(),
        this.metricsService.getActiveAlerts(),
      ]);

      return {
        overview: {
          timestamp: currentMetrics.timestamp,
          healthScore: healthScore.overall,
          healthComponents: healthScore.components,
          issues: healthScore.issues,
          activeAlerts: activeAlerts.length,
        },
        connections: {
          total: connectionMetrics.totals.totalConnections,
          active: connectionMetrics.totals.activeConnections,
          averageLatency: connectionMetrics.totals.averageLatency,
          totalMessages: connectionMetrics.totals.totalMessages,
          breakdown: connectionMetrics.breakdown,
        },
        subscriptions: {
          total: subscriptionMetrics.totals.totalSubscriptions,
          active: subscriptionMetrics.totals.activeSubscriptions,
          highVolumeCount: subscriptionMetrics.totals.highVolumeCount,
          errorRate: subscriptionMetrics.totals.errorRate,
        },
        notifications: {
          total: notificationMetrics.totals.totalNotifications,
          sent: notificationMetrics.totals.sent,
          delivered: notificationMetrics.totals.delivered,
          failed: notificationMetrics.totals.failed,
          successRate: notificationMetrics.totals.successRate,
        },
        performance: {
          memory: performanceMetrics.memory,
          cpu: performanceMetrics.cpu,
          uptime: performanceMetrics.performance.uptime,
          nodeVersion: performanceMetrics.performance.nodeVersion,
        },
        alerts: {
          active: activeAlerts,
          total: (await this.metricsService.getAlerts()).length,
        },
      };
    } catch (error) {
      throw new HttpException(
        `Ошибка получения данных дашборда: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('export')
  @ApiOperation({ 
    summary: 'Экспорт метрик',
    description: 'Экспортирует метрики в формате, совместимом с Prometheus',
  })
  @ApiQuery({ name: 'format', required: false, enum: ['prometheus', 'json'], description: 'Формат экспорта' })
  @ApiResponse({ 
    status: 200, 
    description: 'Метрики экспортированы успешно',
  })
  async exportMetrics(@Query('format') format?: 'prometheus' | 'json'): Promise<any> {
    try {
      const currentMetrics = await this.metricsService.getCurrentMetrics();
      
      if (format === 'prometheus') {
        // TODO: Реализовать экспорт в формате Prometheus
        return this.formatPrometheusMetrics(currentMetrics);
      }
      
      return currentMetrics;
    } catch (error) {
      throw new HttpException(
        `Ошибка экспорта метрик: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  private formatPrometheusMetrics(metrics: MetricsSnapshot): string {
    // Базовая реализация экспорта в формате Prometheus
    const lines = [
      `# HELP websocket_connections_total Total number of WebSocket connections`,
      `# TYPE websocket_connections_total gauge`,
      `websocket_connections_total ${metrics.connections.total}`,
      ``,
      `# HELP websocket_connections_active Active WebSocket connections`,
      `# TYPE websocket_connections_active gauge`,
      `websocket_connections_active ${metrics.connections.active}`,
      ``,
      `# HELP websocket_average_latency Average latency of WebSocket connections`,
      `# TYPE websocket_average_latency gauge`,
      `websocket_average_latency ${metrics.connections.averageLatency}`,
      ``,
      `# HELP websocket_subscriptions_total Total number of subscriptions`,
      `# TYPE websocket_subscriptions_total gauge`,
      `websocket_subscriptions_total ${metrics.subscriptions.total}`,
      ``,
      `# HELP websocket_subscriptions_active Active subscriptions`,
      `# TYPE websocket_subscriptions_active gauge`,
      `websocket_subscriptions_active ${metrics.subscriptions.active}`,
      ``,
      `# HELP websocket_notifications_total Total number of notifications`,
      `# TYPE websocket_notifications_total gauge`,
      `websocket_notifications_total ${metrics.notifications.total}`,
    ];

    return lines.join('\n');
  }
}