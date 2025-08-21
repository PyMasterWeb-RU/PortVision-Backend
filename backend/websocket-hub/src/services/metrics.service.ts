import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { WebSocketConnection } from '../entities/websocket-connection.entity';
import { Subscription } from '../entities/subscription.entity';
import { Notification } from '../entities/notification.entity';

export interface MetricsSnapshot {
  timestamp: Date;
  connections: {
    total: number;
    active: number;
    byType: Record<string, number>;
    byRole: Record<string, number>;
    averageLatency: number;
    totalMessages: number;
    totalBytes: number;
  };
  subscriptions: {
    total: number;
    active: number;
    byType: Record<string, number>;
    averageMessages: number;
    highVolumeCount: number;
    errorRate: number;
  };
  notifications: {
    total: number;
    sent: number;
    delivered: number;
    failed: number;
    byPriority: Record<string, number>;
    averageDeliveryTime: number;
    successRate: number;
  };
  performance: {
    memoryUsage: number;
    cpuUsage: number;
    responseTime: number;
    throughput: number;
    errorRate: number;
  };
}

export interface AlertRule {
  id: string;
  name: string;
  description: string;
  metric: string;
  operator: 'gt' | 'lt' | 'eq' | 'gte' | 'lte';
  threshold: number;
  duration: number; // в минутах
  severity: 'low' | 'medium' | 'high' | 'critical';
  enabled: boolean;
  actions: string[];
}

@Injectable()
export class MetricsService {
  private readonly logger = new Logger(MetricsService.name);
  private metricsHistory: MetricsSnapshot[] = [];
  private alerts: AlertRule[] = [];
  private alertStates: Map<string, { triggered: boolean; since: Date }> = new Map();

  constructor(
    @InjectRepository(WebSocketConnection)
    private readonly connectionRepository: Repository<WebSocketConnection>,
    @InjectRepository(Subscription)
    private readonly subscriptionRepository: Repository<Subscription>,
    @InjectRepository(Notification)
    private readonly notificationRepository: Repository<Notification>,
  ) {
    this.initializeDefaultAlerts();
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async collectMetrics(): Promise<void> {
    try {
      const snapshot = await this.createMetricsSnapshot();
      this.metricsHistory.push(snapshot);

      // Храним только последние 1440 снимков (24 часа)
      if (this.metricsHistory.length > 1440) {
        this.metricsHistory = this.metricsHistory.slice(-1440);
      }

      // Проверяем алерты
      await this.checkAlerts(snapshot);

      this.logger.debug(`Собраны метрики: ${snapshot.connections.active} активных соединений`);
    } catch (error) {
      this.logger.error(`Ошибка сбора метрик: ${error.message}`);
    }
  }

  async getCurrentMetrics(): Promise<MetricsSnapshot> {
    return this.createMetricsSnapshot();
  }

  async getMetricsHistory(hours: number = 24): Promise<MetricsSnapshot[]> {
    const since = new Date();
    since.setHours(since.getHours() - hours);

    return this.metricsHistory.filter(m => m.timestamp >= since);
  }

  async getConnectionMetrics(): Promise<any> {
    const [
      totalConnections,
      activeConnections,
      connectionsByType,
      connectionsByRole,
      connectionsByStatus,
      averageLatency,
      totalMessages,
      totalBytes,
      topUsers,
    ] = await Promise.all([
      this.connectionRepository.count(),
      this.connectionRepository.count({ where: { status: 'connected' } }),
      this.connectionRepository.query(`
        SELECT client_type, COUNT(*) as count
        FROM websocket.websocket_connections
        WHERE status = 'connected'
        GROUP BY client_type
      `),
      this.connectionRepository.query(`
        SELECT user_role, COUNT(*) as count
        FROM websocket.websocket_connections
        WHERE status = 'connected'
        GROUP BY user_role
      `),
      this.connectionRepository.query(`
        SELECT status, COUNT(*) as count
        FROM websocket.websocket_connections
        GROUP BY status
      `),
      this.connectionRepository.query(`
        SELECT AVG((metrics->>'latency')::numeric) as avg_latency
        FROM websocket.websocket_connections
        WHERE status = 'connected' AND metrics IS NOT NULL
      `),
      this.connectionRepository.query(`
        SELECT SUM(
          (metrics->>'messagesReceived')::numeric + 
          (metrics->>'messagesSent')::numeric
        ) as total_messages
        FROM websocket.websocket_connections
        WHERE metrics IS NOT NULL
      `),
      this.connectionRepository.query(`
        SELECT SUM(
          (metrics->>'bytesReceived')::numeric + 
          (metrics->>'bytesSent')::numeric
        ) as total_bytes
        FROM websocket.websocket_connections
        WHERE metrics IS NOT NULL
      `),
      this.connectionRepository.query(`
        SELECT 
          user_id,
          user_name,
          COUNT(*) as connection_count,
          MAX(last_activity_at) as last_activity
        FROM websocket.websocket_connections
        WHERE status = 'connected'
        GROUP BY user_id, user_name
        ORDER BY connection_count DESC
        LIMIT 10
      `),
    ]);

    return {
      totals: {
        totalConnections,
        activeConnections,
        averageLatency: parseFloat(averageLatency[0]?.avg_latency || 0),
        totalMessages: parseInt(totalMessages[0]?.total_messages || 0),
        totalBytes: parseInt(totalBytes[0]?.total_bytes || 0),
      },
      breakdown: {
        byType: this.arrayToObject(connectionsByType),
        byRole: this.arrayToObject(connectionsByRole),
        byStatus: this.arrayToObject(connectionsByStatus),
      },
      topUsers,
    };
  }

  async getSubscriptionMetrics(): Promise<any> {
    const [
      totalSubscriptions,
      activeSubscriptions,
      subscriptionsByType,
      subscriptionsByStatus,
      highVolumeSubscriptions,
      errorStats,
      performanceStats,
    ] = await Promise.all([
      this.subscriptionRepository.count(),
      this.subscriptionRepository.count({ where: { status: 'active' } }),
      this.subscriptionRepository.query(`
        SELECT type, COUNT(*) as count
        FROM websocket.subscriptions
        GROUP BY type
      `),
      this.subscriptionRepository.query(`
        SELECT status, COUNT(*) as count
        FROM websocket.subscriptions
        GROUP BY status
      `),
      this.subscriptionRepository.query(`
        SELECT COUNT(*) as count
        FROM websocket.subscriptions
        WHERE status = 'active'
        AND (statistics->>'messagesThisHour')::numeric > 100
      `),
      this.subscriptionRepository.query(`
        SELECT 
          SUM((statistics->>'errorCount')::numeric) as total_errors,
          SUM((statistics->>'totalMessages')::numeric) as total_messages
        FROM websocket.subscriptions
        WHERE statistics IS NOT NULL
      `),
      this.subscriptionRepository.query(`
        SELECT 
          AVG((statistics->>'averageLatency')::numeric) as avg_latency,
          AVG((statistics->>'messagesThisHour')::numeric) as avg_messages_per_hour
        FROM websocket.subscriptions
        WHERE status = 'active' AND statistics IS NOT NULL
      `),
    ]);

    const totalErrors = parseInt(errorStats[0]?.total_errors || 0);
    const totalMessages = parseInt(errorStats[0]?.total_messages || 0);
    const errorRate = totalMessages > 0 ? (totalErrors / totalMessages) * 100 : 0;

    return {
      totals: {
        totalSubscriptions,
        activeSubscriptions,
        highVolumeCount: parseInt(highVolumeSubscriptions[0]?.count || 0),
        errorRate: parseFloat(errorRate.toFixed(2)),
        averageLatency: parseFloat(performanceStats[0]?.avg_latency || 0),
        averageMessagesPerHour: parseFloat(performanceStats[0]?.avg_messages_per_hour || 0),
      },
      breakdown: {
        byType: this.arrayToObject(subscriptionsByType),
        byStatus: this.arrayToObject(subscriptionsByStatus),
      },
    };
  }

  async getNotificationMetrics(): Promise<any> {
    const [
      totalNotifications,
      notificationsByStatus,
      notificationsByPriority,
      deliveryStats,
      recentActivity,
    ] = await Promise.all([
      this.notificationRepository.count(),
      this.notificationRepository.query(`
        SELECT status, COUNT(*) as count
        FROM websocket.notifications
        GROUP BY status
      `),
      this.notificationRepository.query(`
        SELECT priority, COUNT(*) as count
        FROM websocket.notifications
        GROUP BY priority
      `),
      this.notificationRepository.query(`
        SELECT 
          COUNT(*) FILTER (WHERE status = 'sent') as sent,
          COUNT(*) FILTER (WHERE status = 'delivered') as delivered,
          COUNT(*) FILTER (WHERE status = 'failed') as failed,
          AVG(EXTRACT(EPOCH FROM (delivered_at - sent_at))) as avg_delivery_time
        FROM websocket.notifications
        WHERE sent_at IS NOT NULL
      `),
      this.notificationRepository.query(`
        SELECT 
          DATE_TRUNC('hour', created_at) as hour,
          COUNT(*) as count
        FROM websocket.notifications
        WHERE created_at >= NOW() - INTERVAL '24 hours'
        GROUP BY hour
        ORDER BY hour DESC
      `),
    ]);

    const sent = parseInt(deliveryStats[0]?.sent || 0);
    const delivered = parseInt(deliveryStats[0]?.delivered || 0);
    const failed = parseInt(deliveryStats[0]?.failed || 0);
    const successRate = sent > 0 ? (delivered / sent) * 100 : 0;

    return {
      totals: {
        totalNotifications,
        sent,
        delivered,
        failed,
        successRate: parseFloat(successRate.toFixed(2)),
        averageDeliveryTime: parseFloat(deliveryStats[0]?.avg_delivery_time || 0),
      },
      breakdown: {
        byStatus: this.arrayToObject(notificationsByStatus),
        byPriority: this.arrayToObject(notificationsByPriority),
      },
      activity: recentActivity,
    };
  }

  async getPerformanceMetrics(): Promise<any> {
    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    // Получаем статистику из последних метрик
    const recentMetrics = this.metricsHistory.slice(-60); // последний час
    
    const avgResponseTime = recentMetrics.length > 0 
      ? recentMetrics.reduce((sum, m) => sum + m.performance.responseTime, 0) / recentMetrics.length
      : 0;

    const avgThroughput = recentMetrics.length > 0
      ? recentMetrics.reduce((sum, m) => sum + m.performance.throughput, 0) / recentMetrics.length
      : 0;

    return {
      memory: {
        rss: memoryUsage.rss,
        heapTotal: memoryUsage.heapTotal,
        heapUsed: memoryUsage.heapUsed,
        external: memoryUsage.external,
        arrayBuffers: memoryUsage.arrayBuffers,
      },
      cpu: {
        user: cpuUsage.user,
        system: cpuUsage.system,
      },
      performance: {
        averageResponseTime: avgResponseTime,
        averageThroughput: avgThroughput,
        uptime: process.uptime(),
        nodeVersion: process.version,
        platform: process.platform,
      },
    };
  }

  async getAlerts(): Promise<AlertRule[]> {
    return this.alerts;
  }

  async addAlert(alert: Omit<AlertRule, 'id'>): Promise<AlertRule> {
    const newAlert: AlertRule = {
      ...alert,
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    };

    this.alerts.push(newAlert);
    this.logger.log(`Добавлен алерт: ${newAlert.name}`);

    return newAlert;
  }

  async updateAlert(id: string, updates: Partial<AlertRule>): Promise<AlertRule | null> {
    const alertIndex = this.alerts.findIndex(a => a.id === id);
    if (alertIndex === -1) return null;

    this.alerts[alertIndex] = { ...this.alerts[alertIndex], ...updates };
    this.logger.log(`Обновлен алерт: ${this.alerts[alertIndex].name}`);

    return this.alerts[alertIndex];
  }

  async deleteAlert(id: string): Promise<boolean> {
    const alertIndex = this.alerts.findIndex(a => a.id === id);
    if (alertIndex === -1) return false;

    const alert = this.alerts[alertIndex];
    this.alerts.splice(alertIndex, 1);
    this.alertStates.delete(id);

    this.logger.log(`Удален алерт: ${alert.name}`);
    return true;
  }

  async getActiveAlerts(): Promise<Array<{ alert: AlertRule; since: Date }>> {
    return Array.from(this.alertStates.entries())
      .filter(([, state]) => state.triggered)
      .map(([id, state]) => ({
        alert: this.alerts.find(a => a.id === id)!,
        since: state.since,
      }))
      .filter(item => item.alert);
  }

  async getTrendData(metric: string, hours: number = 24): Promise<any[]> {
    const history = this.getMetricsHistory(hours);
    
    return (await history).map(snapshot => ({
      timestamp: snapshot.timestamp,
      value: this.extractMetricValue(snapshot, metric),
    }));
  }

  async getHealthScore(): Promise<{
    overall: number;
    components: {
      connections: number;
      subscriptions: number;
      notifications: number;
      performance: number;
    };
    issues: string[];
  }> {
    const issues: string[] = [];
    
    // Проверяем подключения
    const connectionMetrics = await this.getConnectionMetrics();
    const connectionScore = this.calculateConnectionHealthScore(connectionMetrics, issues);
    
    // Проверяем подписки
    const subscriptionMetrics = await this.getSubscriptionMetrics();
    const subscriptionScore = this.calculateSubscriptionHealthScore(subscriptionMetrics, issues);
    
    // Проверяем уведомления
    const notificationMetrics = await this.getNotificationMetrics();
    const notificationScore = this.calculateNotificationHealthScore(notificationMetrics, issues);
    
    // Проверяем производительность
    const performanceMetrics = await this.getPerformanceMetrics();
    const performanceScore = this.calculatePerformanceHealthScore(performanceMetrics, issues);
    
    const overall = Math.round((connectionScore + subscriptionScore + notificationScore + performanceScore) / 4);
    
    return {
      overall,
      components: {
        connections: connectionScore,
        subscriptions: subscriptionScore,
        notifications: notificationScore,
        performance: performanceScore,
      },
      issues,
    };
  }

  private async createMetricsSnapshot(): Promise<MetricsSnapshot> {
    const [connectionMetrics, subscriptionMetrics, notificationMetrics, performanceMetrics] = await Promise.all([
      this.getConnectionMetrics(),
      this.getSubscriptionMetrics(),
      this.getNotificationMetrics(),
      this.getPerformanceMetrics(),
    ]);

    return {
      timestamp: new Date(),
      connections: {
        total: connectionMetrics.totals.totalConnections,
        active: connectionMetrics.totals.activeConnections,
        byType: connectionMetrics.breakdown.byType,
        byRole: connectionMetrics.breakdown.byRole,
        averageLatency: connectionMetrics.totals.averageLatency,
        totalMessages: connectionMetrics.totals.totalMessages,
        totalBytes: connectionMetrics.totals.totalBytes,
      },
      subscriptions: {
        total: subscriptionMetrics.totals.totalSubscriptions,
        active: subscriptionMetrics.totals.activeSubscriptions,
        byType: subscriptionMetrics.breakdown.byType,
        averageMessages: subscriptionMetrics.totals.averageMessagesPerHour,
        highVolumeCount: subscriptionMetrics.totals.highVolumeCount,
        errorRate: subscriptionMetrics.totals.errorRate,
      },
      notifications: {
        total: notificationMetrics.totals.totalNotifications,
        sent: notificationMetrics.totals.sent,
        delivered: notificationMetrics.totals.delivered,
        failed: notificationMetrics.totals.failed,
        byPriority: notificationMetrics.breakdown.byPriority,
        averageDeliveryTime: notificationMetrics.totals.averageDeliveryTime,
        successRate: notificationMetrics.totals.successRate,
      },
      performance: {
        memoryUsage: performanceMetrics.memory.heapUsed,
        cpuUsage: 0, // TODO: реализовать расчет CPU usage
        responseTime: performanceMetrics.performance.averageResponseTime,
        throughput: performanceMetrics.performance.averageThroughput,
        errorRate: 0, // TODO: реализовать расчет error rate
      },
    };
  }

  private async checkAlerts(snapshot: MetricsSnapshot): Promise<void> {
    for (const alert of this.alerts) {
      if (!alert.enabled) continue;

      const metricValue = this.extractMetricValue(snapshot, alert.metric);
      const threshold = alert.threshold;
      
      const shouldTrigger = this.evaluateCondition(metricValue, alert.operator, threshold);
      const currentState = this.alertStates.get(alert.id);

      if (shouldTrigger && !currentState?.triggered) {
        // Новый алерт
        this.alertStates.set(alert.id, { triggered: true, since: new Date() });
        await this.triggerAlert(alert, metricValue);
      } else if (!shouldTrigger && currentState?.triggered) {
        // Алерт разрешен
        this.alertStates.set(alert.id, { triggered: false, since: new Date() });
        await this.resolveAlert(alert, metricValue);
      } else if (shouldTrigger && currentState?.triggered) {
        // Проверяем длительность
        const duration = new Date().getTime() - currentState.since.getTime();
        const durationMinutes = duration / (1000 * 60);
        
        if (durationMinutes >= alert.duration) {
          await this.escalateAlert(alert, metricValue, durationMinutes);
        }
      }
    }
  }

  private extractMetricValue(snapshot: MetricsSnapshot, metric: string): number {
    const parts = metric.split('.');
    let value: any = snapshot;
    
    for (const part of parts) {
      value = value[part];
      if (value === undefined) return 0;
    }
    
    return typeof value === 'number' ? value : 0;
  }

  private evaluateCondition(value: number, operator: string, threshold: number): boolean {
    switch (operator) {
      case 'gt': return value > threshold;
      case 'lt': return value < threshold;
      case 'eq': return value === threshold;
      case 'gte': return value >= threshold;
      case 'lte': return value <= threshold;
      default: return false;
    }
  }

  private async triggerAlert(alert: AlertRule, value: number): Promise<void> {
    this.logger.warn(`🚨 АЛЕРТ СРАБОТАЛ: ${alert.name} (${value} ${alert.operator} ${alert.threshold})`);
    
    // TODO: Отправить уведомление через notification service
    // TODO: Выполнить действия из alert.actions
  }

  private async resolveAlert(alert: AlertRule, value: number): Promise<void> {
    this.logger.log(`✅ АЛЕРТ РАЗРЕШЕН: ${alert.name} (${value})`);
  }

  private async escalateAlert(alert: AlertRule, value: number, duration: number): Promise<void> {
    this.logger.error(`🔥 ЭСКАЛАЦИЯ АЛЕРТА: ${alert.name} активен ${duration.toFixed(1)} минут`);
  }

  private initializeDefaultAlerts(): void {
    this.alerts = [
      {
        id: 'high_connection_count',
        name: 'Высокое количество подключений',
        description: 'Количество активных подключений превышает норму',
        metric: 'connections.active',
        operator: 'gt',
        threshold: 1000,
        duration: 5,
        severity: 'medium',
        enabled: true,
        actions: ['notify_admins'],
      },
      {
        id: 'high_latency',
        name: 'Высокая задержка',
        description: 'Средняя задержка подключений превышает норму',
        metric: 'connections.averageLatency',
        operator: 'gt',
        threshold: 1000,
        duration: 3,
        severity: 'high',
        enabled: true,
        actions: ['notify_admins', 'scale_up'],
      },
      {
        id: 'high_error_rate',
        name: 'Высокий процент ошибок',
        description: 'Процент ошибок в подписках превышает норму',
        metric: 'subscriptions.errorRate',
        operator: 'gt',
        threshold: 5,
        duration: 2,
        severity: 'high',
        enabled: true,
        actions: ['notify_admins'],
      },
      {
        id: 'low_notification_success_rate',
        name: 'Низкий процент успешных уведомлений',
        description: 'Процент успешно доставленных уведомлений ниже нормы',
        metric: 'notifications.successRate',
        operator: 'lt',
        threshold: 95,
        duration: 5,
        severity: 'medium',
        enabled: true,
        actions: ['notify_admins'],
      },
      {
        id: 'high_memory_usage',
        name: 'Высокое использование памяти',
        description: 'Использование памяти превышает норму',
        metric: 'performance.memoryUsage',
        operator: 'gt',
        threshold: 1024 * 1024 * 1024, // 1GB
        duration: 10,
        severity: 'critical',
        enabled: true,
        actions: ['notify_admins', 'restart_service'],
      },
    ];

    this.logger.log(`Инициализировано ${this.alerts.length} алертов`);
  }

  private arrayToObject(array: any[]): Record<string, number> {
    const result: Record<string, number> = {};
    for (const item of array) {
      result[item.client_type || item.type || item.status || item.priority] = parseInt(item.count);
    }
    return result;
  }

  private calculateConnectionHealthScore(metrics: any, issues: string[]): number {
    let score = 100;
    
    if (metrics.totals.averageLatency > 1000) {
      score -= 20;
      issues.push('Высокая задержка подключений');
    }
    
    if (metrics.totals.activeConnections > 1000) {
      score -= 10;
      issues.push('Большое количество активных подключений');
    }
    
    return Math.max(0, score);
  }

  private calculateSubscriptionHealthScore(metrics: any, issues: string[]): number {
    let score = 100;
    
    if (metrics.totals.errorRate > 5) {
      score -= 30;
      issues.push('Высокий процент ошибок в подписках');
    }
    
    if (metrics.totals.highVolumeCount > 50) {
      score -= 15;
      issues.push('Много высоконагруженных подписок');
    }
    
    return Math.max(0, score);
  }

  private calculateNotificationHealthScore(metrics: any, issues: string[]): number {
    let score = 100;
    
    if (metrics.totals.successRate < 95) {
      score -= 25;
      issues.push('Низкий процент успешных уведомлений');
    }
    
    if (metrics.totals.averageDeliveryTime > 5) {
      score -= 15;
      issues.push('Медленная доставка уведомлений');
    }
    
    return Math.max(0, score);
  }

  private calculatePerformanceHealthScore(metrics: any, issues: string[]): number {
    let score = 100;
    
    const memoryUsageMB = metrics.memory.heapUsed / (1024 * 1024);
    if (memoryUsageMB > 1024) {
      score -= 20;
      issues.push('Высокое использование памяти');
    }
    
    return Math.max(0, score);
  }
}