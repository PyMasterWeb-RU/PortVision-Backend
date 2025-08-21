import {
  Injectable,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { Cron, CronExpression } from '@nestjs/schedule';
import Redis from 'ioredis';
import { IntegrationEndpoint } from '../entities/integration-endpoint.entity';

export interface IntegrationMetrics {
  endpointId: string;
  endpointName: string;
  type: string;
  messagesReceived: number;
  messagesProcessed: number;
  messagesFailed: number;
  bytesProcessed: number;
  averageProcessingTime: number;
  errorRate: number;
  uptime: number;
  lastProcessedAt?: Date;
  connectionAttempts: number;
  successfulConnections: number;
  
  // Дополнительные метрики
  throughputPerMinute: number;
  latencyP50: number;
  latencyP95: number;
  latencyP99: number;
  activeConnections: number;
  queueDepth: number;
  
  // Метрики за период
  hourlyStats: Array<{
    hour: string;
    received: number;
    processed: number;
    failed: number;
    avgProcessingTime: number;
  }>;
}

export interface SystemMetrics {
  totalEndpoints: number;
  activeEndpoints: number;
  healthyEndpoints: number;
  errorEndpoints: number;
  totalMessages: number;
  totalErrors: number;
  systemUptime: number;
  memoryUsage: {
    used: number;
    total: number;
    percentage: number;
  };
  cpuUsage: number;
  redisConnectionCount: number;
}

export interface AlertConfiguration {
  endpointId: string;
  type: 'error_rate' | 'processing_delay' | 'connection_loss' | 'throughput_drop' | 'custom';
  threshold: number;
  timeWindow: number; // в секундах
  enabled: boolean;
  notificationChannels: ('email' | 'webhook' | 'sms')[];
  cooldownPeriod: number; // в секундах
}

export interface Alert {
  id: string;
  endpointId: string;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  value: number;
  threshold: number;
  triggeredAt: Date;
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
  resolvedAt?: Date;
  metadata?: Record<string, any>;
}

@Injectable()
export class MetricsService {
  private readonly logger = new Logger(MetricsService.name);
  private readonly alerts = new Map<string, Alert>();
  private readonly alertCooldowns = new Map<string, Date>();
  private readonly startTime = Date.now();

  constructor(
    @InjectRepository(IntegrationEndpoint)
    private readonly integrationEndpointRepository: Repository<IntegrationEndpoint>,
    private readonly eventEmitter: EventEmitter2,
    @InjectRedis() private readonly redis: Redis,
  ) {
    // Подписываемся на события для сбора метрик
    this.subscribeToEvents();
  }

  async recordMessage(endpointId: string, messageSize: number, processingTime: number): Promise<void> {
    try {
      const endpoint = await this.integrationEndpointRepository.findOne({
        where: { id: endpointId },
      });

      if (!endpoint) {
        this.logger.warn(`⚠️ Endpoint ${endpointId} не найден для записи метрик`);
        return;
      }

      // Обновляем метрики в базе данных
      const updatedMetrics = {
        ...endpoint.metrics,
        messagesReceived: (endpoint.metrics?.messagesReceived || 0) + 1,
        messagesProcessed: (endpoint.metrics?.messagesProcessed || 0) + 1,
        bytesProcessed: (endpoint.metrics?.bytesProcessed || 0) + messageSize,
        averageProcessingTime: this.calculateMovingAverage(
          endpoint.metrics?.averageProcessingTime || 0,
          processingTime,
          endpoint.metrics?.messagesProcessed || 0,
        ),
        lastProcessedAt: new Date(),
      };

      await this.integrationEndpointRepository.update(endpointId, {
        metrics: updatedMetrics,
      });

      // Записываем метрики в Redis для real-time аналитики
      await this.recordRealtimeMetrics(endpointId, {
        type: 'message_processed',
        messageSize,
        processingTime,
        timestamp: Date.now(),
      });

      // Записываем статистику по часам
      await this.recordHourlyStats(endpointId, {
        processed: 1,
        processingTime,
      });

    } catch (error) {
      this.logger.error(`❌ Ошибка записи метрик для ${endpointId}:`, error.message);
    }
  }

  async recordError(endpointId: string, error: string, processingTime?: number): Promise<void> {
    try {
      const endpoint = await this.integrationEndpointRepository.findOne({
        where: { id: endpointId },
      });

      if (!endpoint) {
        this.logger.warn(`⚠️ Endpoint ${endpointId} не найден для записи ошибки`);
        return;
      }

      // Обновляем метрики ошибок
      const updatedMetrics = {
        ...endpoint.metrics,
        messagesReceived: (endpoint.metrics?.messagesReceived || 0) + 1,
        messagesFailed: (endpoint.metrics?.messagesFailed || 0) + 1,
        errorRate: this.calculateErrorRate(
          endpoint.metrics?.messagesReceived || 0,
          (endpoint.metrics?.messagesFailed || 0) + 1,
        ),
      };

      await this.integrationEndpointRepository.update(endpointId, {
        metrics: updatedMetrics,
      });

      // Записываем ошибку в Redis
      await this.recordRealtimeMetrics(endpointId, {
        type: 'message_failed',
        error,
        processingTime: processingTime || 0,
        timestamp: Date.now(),
      });

      // Записываем в часовую статистику
      await this.recordHourlyStats(endpointId, {
        failed: 1,
        processingTime: processingTime || 0,
      });

      // Проверяем алерты
      await this.checkErrorRateAlert(endpointId, updatedMetrics.errorRate);

    } catch (err) {
      this.logger.error(`❌ Ошибка записи ошибки для ${endpointId}:`, err.message);
    }
  }

  async recordConnectionAttempt(endpointId: string, success: boolean): Promise<void> {
    try {
      const endpoint = await this.integrationEndpointRepository.findOne({
        where: { id: endpointId },
      });

      if (!endpoint) return;

      const updatedMetrics = {
        ...endpoint.metrics,
        connectionAttempts: (endpoint.metrics?.connectionAttempts || 0) + 1,
        successfulConnections: success 
          ? (endpoint.metrics?.successfulConnections || 0) + 1
          : (endpoint.metrics?.successfulConnections || 0),
      };

      await this.integrationEndpointRepository.update(endpointId, {
        metrics: updatedMetrics,
      });

      // Проверяем алерт по потере соединения
      if (!success) {
        await this.checkConnectionLossAlert(endpointId);
      }

    } catch (error) {
      this.logger.error(`❌ Ошибка записи попытки соединения для ${endpointId}:`, error.message);
    }
  }

  async getEndpointMetrics(endpointId: string): Promise<IntegrationMetrics | null> {
    try {
      const endpoint = await this.integrationEndpointRepository.findOne({
        where: { id: endpointId },
      });

      if (!endpoint) return null;

      // Получаем дополнительные метрики из Redis
      const realtimeMetrics = await this.getRealtimeMetrics(endpointId);
      const hourlyStats = await this.getHourlyStats(endpointId);

      return {
        endpointId: endpoint.id,
        endpointName: endpoint.name,
        type: endpoint.type,
        messagesReceived: endpoint.metrics?.messagesReceived || 0,
        messagesProcessed: endpoint.metrics?.messagesProcessed || 0,
        messagesFailed: endpoint.metrics?.messagesFailed || 0,
        bytesProcessed: endpoint.metrics?.bytesProcessed || 0,
        averageProcessingTime: endpoint.metrics?.averageProcessingTime || 0,
        errorRate: endpoint.errorRate,
        uptime: endpoint.uptime,
        lastProcessedAt: endpoint.metrics?.lastProcessedAt,
        connectionAttempts: endpoint.metrics?.connectionAttempts || 0,
        successfulConnections: endpoint.metrics?.successfulConnections || 0,
        
        // Real-time метрики
        throughputPerMinute: realtimeMetrics.throughputPerMinute,
        latencyP50: realtimeMetrics.latencyP50,
        latencyP95: realtimeMetrics.latencyP95,
        latencyP99: realtimeMetrics.latencyP99,
        activeConnections: realtimeMetrics.activeConnections,
        queueDepth: realtimeMetrics.queueDepth,
        
        hourlyStats,
      };

    } catch (error) {
      this.logger.error(`❌ Ошибка получения метрик для ${endpointId}:`, error.message);
      return null;
    }
  }

  async getSystemMetrics(): Promise<SystemMetrics> {
    try {
      const endpoints = await this.integrationEndpointRepository.find();
      
      let totalMessages = 0;
      let totalErrors = 0;
      let activeEndpoints = 0;
      let healthyEndpoints = 0;
      let errorEndpoints = 0;

      endpoints.forEach(endpoint => {
        if (endpoint.isActive) activeEndpoints++;
        if (endpoint.isHealthy) healthyEndpoints++;
        if (endpoint.hasErrors) errorEndpoints++;
        
        totalMessages += endpoint.metrics?.messagesReceived || 0;
        totalErrors += endpoint.metrics?.messagesFailed || 0;
      });

      // Системные метрики
      const memoryUsage = process.memoryUsage();
      const cpuUsage = process.cpuUsage();

      return {
        totalEndpoints: endpoints.length,
        activeEndpoints,
        healthyEndpoints,
        errorEndpoints,
        totalMessages,
        totalErrors,
        systemUptime: Date.now() - this.startTime,
        memoryUsage: {
          used: memoryUsage.heapUsed,
          total: memoryUsage.heapTotal,
          percentage: (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100,
        },
        cpuUsage: (cpuUsage.user + cpuUsage.system) / 1000000, // в секундах
        redisConnectionCount: await this.getRedisConnectionCount(),
      };

    } catch (error) {
      this.logger.error('❌ Ошибка получения системных метрик:', error.message);
      throw error;
    }
  }

  async createAlert(config: AlertConfiguration): Promise<void> {
    const alertKey = `alert_config:${config.endpointId}:${config.type}`;
    await this.redis.setex(alertKey, 86400, JSON.stringify(config)); // 24 часа
    
    this.logger.log(`🚨 Создан алерт для ${config.endpointId}: ${config.type} (порог: ${config.threshold})`);
  }

  async getActiveAlerts(): Promise<Alert[]> {
    return Array.from(this.alerts.values()).filter(alert => !alert.resolvedAt);
  }

  async acknowledgeAlert(alertId: string, userId: string): Promise<void> {
    const alert = this.alerts.get(alertId);
    if (alert) {
      alert.acknowledged = true;
      alert.acknowledgedBy = userId;
      alert.acknowledgedAt = new Date();
      
      this.logger.log(`✅ Алерт ${alertId} подтвержден пользователем ${userId}`);
      
      this.eventEmitter.emit('alert.acknowledged', {
        alertId,
        userId,
        endpointId: alert.endpointId,
      });
    }
  }

  async resolveAlert(alertId: string): Promise<void> {
    const alert = this.alerts.get(alertId);
    if (alert) {
      alert.resolvedAt = new Date();
      
      this.logger.log(`✅ Алерт ${alertId} разрешен`);
      
      this.eventEmitter.emit('alert.resolved', {
        alertId,
        endpointId: alert.endpointId,
        duration: alert.resolvedAt.getTime() - alert.triggeredAt.getTime(),
      });
    }
  }

  @Cron(CronExpression.EVERY_5_MINUTES)
  async collectMetrics(): Promise<void> {
    try {
      this.logger.debug('📊 Начинаем сбор метрик...');
      
      const endpoints = await this.integrationEndpointRepository.find({
        where: { isActive: true },
      });

      for (const endpoint of endpoints) {
        await this.updateEndpointMetrics(endpoint);
        await this.checkAlerts(endpoint);
      }

      this.logger.debug(`📊 Сбор метрик завершен для ${endpoints.length} endpoints`);
      
    } catch (error) {
      this.logger.error('❌ Ошибка сбора метрик:', error.message);
    }
  }

  @Cron(CronExpression.EVERY_HOUR)
  async cleanupOldMetrics(): Promise<void> {
    try {
      // Очищаем старые метрики из Redis (старше 7 дней)
      const cutoffTime = Date.now() - (7 * 24 * 60 * 60 * 1000);
      const pattern = 'metrics:*';
      const keys = await this.redis.keys(pattern);

      let deletedCount = 0;
      for (const key of keys) {
        const data = await this.redis.get(key);
        if (data) {
          const metric = JSON.parse(data);
          if (metric.timestamp < cutoffTime) {
            await this.redis.del(key);
            deletedCount++;
          }
        }
      }

      if (deletedCount > 0) {
        this.logger.log(`🧹 Очищено ${deletedCount} старых метрик из Redis`);
      }

    } catch (error) {
      this.logger.error('❌ Ошибка очистки метрик:', error.message);
    }
  }

  private subscribeToEvents(): void {
    this.eventEmitter.on('data.processing.completed', async (event) => {
      await this.recordMessage(event.endpointId, 0, event.processingTime);
    });

    this.eventEmitter.on('data.processing.failed', async (event) => {
      await this.recordError(event.endpointId, event.error, event.processingTime);
    });

    this.eventEmitter.on('integration.endpoint.status_changed', async (event) => {
      if (event.newStatus === 'connected') {
        await this.recordConnectionAttempt(event.endpointId, true);
      } else if (event.newStatus === 'error') {
        await this.recordConnectionAttempt(event.endpointId, false);
      }
    });
  }

  private async recordRealtimeMetrics(endpointId: string, metric: any): Promise<void> {
    const key = `metrics:${endpointId}:${Date.now()}`;
    await this.redis.setex(key, 3600, JSON.stringify(metric)); // 1 час
  }

  private async recordHourlyStats(endpointId: string, stats: any): Promise<void> {
    const hour = new Date().toISOString().substring(0, 13); // YYYY-MM-DDTHH
    const key = `hourly_stats:${endpointId}:${hour}`;
    
    const existingStats = await this.redis.get(key);
    const currentStats = existingStats ? JSON.parse(existingStats) : {
      hour,
      received: 0,
      processed: 0,
      failed: 0,
      totalProcessingTime: 0,
      count: 0,
    };

    currentStats.received += stats.received || 0;
    currentStats.processed += stats.processed || 0;
    currentStats.failed += stats.failed || 0;
    currentStats.totalProcessingTime += stats.processingTime || 0;
    currentStats.count += 1;

    await this.redis.setex(key, 86400, JSON.stringify(currentStats)); // 24 часа
  }

  private async getRealtimeMetrics(endpointId: string): Promise<any> {
    const keys = await this.redis.keys(`metrics:${endpointId}:*`);
    const recentKeys = keys
      .filter(key => {
        const timestamp = parseInt(key.split(':').pop());
        return Date.now() - timestamp < 300000; // последние 5 минут
      })
      .sort()
      .slice(-100); // последние 100 метрик

    const metrics = [];
    for (const key of recentKeys) {
      const data = await this.redis.get(key);
      if (data) {
        metrics.push(JSON.parse(data));
      }
    }

    const processingTimes = metrics
      .filter(m => m.type === 'message_processed')
      .map(m => m.processingTime)
      .sort((a, b) => a - b);

    return {
      throughputPerMinute: metrics.filter(m => m.type === 'message_processed').length * (60 / 5),
      latencyP50: this.percentile(processingTimes, 50),
      latencyP95: this.percentile(processingTimes, 95),
      latencyP99: this.percentile(processingTimes, 99),
      activeConnections: 1, // TODO: реальный подсчет
      queueDepth: 0, // TODO: реальный подсчет
    };
  }

  private async getHourlyStats(endpointId: string): Promise<any[]> {
    const hours = [];
    const now = new Date();
    
    for (let i = 23; i >= 0; i--) {
      const hourDate = new Date(now.getTime() - i * 60 * 60 * 1000);
      const hour = hourDate.toISOString().substring(0, 13);
      hours.push(hour);
    }

    const stats = [];
    for (const hour of hours) {
      const key = `hourly_stats:${endpointId}:${hour}`;
      const data = await this.redis.get(key);
      
      if (data) {
        const hourStats = JSON.parse(data);
        stats.push({
          hour,
          received: hourStats.received,
          processed: hourStats.processed,
          failed: hourStats.failed,
          avgProcessingTime: hourStats.count > 0 
            ? hourStats.totalProcessingTime / hourStats.count 
            : 0,
        });
      } else {
        stats.push({
          hour,
          received: 0,
          processed: 0,
          failed: 0,
          avgProcessingTime: 0,
        });
      }
    }

    return stats;
  }

  private async updateEndpointMetrics(endpoint: IntegrationEndpoint): Promise<void> {
    // Обновляем uptime
    const uptime = endpoint.lastConnectedAt 
      ? Date.now() - endpoint.lastConnectedAt.getTime()
      : 0;

    const updatedMetrics = {
      ...endpoint.metrics,
      uptime,
    };

    await this.integrationEndpointRepository.update(endpoint.id, {
      metrics: updatedMetrics,
    });
  }

  private async checkAlerts(endpoint: IntegrationEndpoint): Promise<void> {
    // Проверяем алерты по error rate
    if (endpoint.errorRate > 10) { // 10% ошибок
      await this.triggerAlert(endpoint.id, 'error_rate', 'high', 
        `Высокий уровень ошибок: ${endpoint.errorRate.toFixed(2)}%`, 
        endpoint.errorRate, 10);
    }

    // Проверяем алерты по uptime
    const hoursSinceLastConnection = endpoint.uptime / (1000 * 60 * 60);
    if (hoursSinceLastConnection > 1) { // более часа без соединения
      await this.triggerAlert(endpoint.id, 'connection_loss', 'critical',
        `Потеря соединения более ${hoursSinceLastConnection.toFixed(1)} часов`,
        hoursSinceLastConnection, 1);
    }
  }

  private async checkErrorRateAlert(endpointId: string, errorRate: number): Promise<void> {
    if (errorRate > 15) { // 15% критический уровень
      await this.triggerAlert(endpointId, 'error_rate', 'critical',
        `Критический уровень ошибок: ${errorRate.toFixed(2)}%`,
        errorRate, 15);
    } else if (errorRate > 10) { // 10% высокий уровень
      await this.triggerAlert(endpointId, 'error_rate', 'high',
        `Высокий уровень ошибок: ${errorRate.toFixed(2)}%`,
        errorRate, 10);
    }
  }

  private async checkConnectionLossAlert(endpointId: string): Promise<void> {
    await this.triggerAlert(endpointId, 'connection_loss', 'medium',
      'Неудачная попытка подключения',
      1, 0);
  }

  private async triggerAlert(
    endpointId: string, 
    type: string, 
    severity: Alert['severity'],
    message: string, 
    value: number, 
    threshold: number
  ): Promise<void> {
    const alertId = `${endpointId}:${type}:${Date.now()}`;
    const cooldownKey = `${endpointId}:${type}`;

    // Проверяем cooldown
    const lastAlert = this.alertCooldowns.get(cooldownKey);
    if (lastAlert && Date.now() - lastAlert.getTime() < 300000) { // 5 минут cooldown
      return;
    }

    const alert: Alert = {
      id: alertId,
      endpointId,
      type,
      severity,
      message,
      value,
      threshold,
      triggeredAt: new Date(),
      acknowledged: false,
    };

    this.alerts.set(alertId, alert);
    this.alertCooldowns.set(cooldownKey, new Date());

    this.logger.warn(`🚨 Алерт ${severity.toUpperCase()}: ${message} (${endpointId})`);

    this.eventEmitter.emit('alert.triggered', alert);
  }

  private calculateMovingAverage(currentAvg: number, newValue: number, count: number): number {
    if (count === 0) return newValue;
    return ((currentAvg * count) + newValue) / (count + 1);
  }

  private calculateErrorRate(totalMessages: number, failedMessages: number): number {
    if (totalMessages === 0) return 0;
    return (failedMessages / totalMessages) * 100;
  }

  private percentile(arr: number[], p: number): number {
    if (arr.length === 0) return 0;
    const index = Math.ceil((p / 100) * arr.length) - 1;
    return arr[Math.max(0, Math.min(index, arr.length - 1))];
  }

  private async getRedisConnectionCount(): Promise<number> {
    try {
      const info = await this.redis.info('clients');
      const match = info.match(/connected_clients:(\d+)/);
      return match ? parseInt(match[1]) : 0;
    } catch (error) {
      return 0;
    }
  }
}