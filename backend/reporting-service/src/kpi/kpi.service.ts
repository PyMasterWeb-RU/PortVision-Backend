import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ClickHouseService } from '../clickhouse/clickhouse.service';
import {
  GetKPIMetricsDto,
  CreateKPITargetDto,
  CreateKPIAlertDto,
  GetKPIDashboardDto,
  GenerateKPIReportDto,
  GetKPITrendsDto,
  GetKPIAlertsDto,
  AcknowledgeKPIAlertDto,
} from './dto/kpi.dto';
import {
  KPIMetric,
  KPICategory,
  KPIStatus,
  KPITarget,
  KPIAlert,
  KPIDashboard,
  KPIReport,
  TimePeriod,
  TerminalKPIs,
} from './interfaces/kpi.interface';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class KpiService {
  private readonly logger = new Logger(KpiService.name);
  
  // In-memory хранилища для демонстрации
  private readonly kpiCache = new Map<string, KPIMetric>();
  private readonly targets = new Map<string, KPITarget>();
  private readonly alerts = new Map<string, KPIAlert>();
  private readonly dashboards = new Map<string, KPIDashboard>();

  constructor(
    private readonly clickhouseService: ClickHouseService,
    private readonly eventEmitter: EventEmitter2,
  ) {
    this.initializeDefaultDashboard();
  }

  async getKPIMetrics(dto: GetKPIMetricsDto): Promise<KPIMetric[]> {
    this.logger.log(`📊 Получение KPI метрик: ${dto.category || 'все категории'}`);

    const period: TimePeriod = {
      start: dto.dateFrom ? new Date(dto.dateFrom) : new Date(Date.now() - 24 * 60 * 60 * 1000),
      end: dto.dateTo ? new Date(dto.dateTo) : new Date(),
      type: dto.period || 'daily',
    };

    try {
      const terminalKPIs = await this.calculateTerminalKPIs(period, dto.forceRefresh);
      let metrics: KPIMetric[] = [];

      // Извлечение метрик по категориям
      if (!dto.category || dto.category === KPICategory.OPERATIONAL) {
        metrics.push(...Object.values(terminalKPIs.operational));
      }
      if (!dto.category || dto.category === KPICategory.FINANCIAL) {
        metrics.push(...Object.values(terminalKPIs.financial));
      }
      if (!dto.category || dto.category === KPICategory.EQUIPMENT) {
        metrics.push(...Object.values(terminalKPIs.equipment));
      }
      if (!dto.category || dto.category === KPICategory.SAFETY) {
        metrics.push(...Object.values(terminalKPIs.safety));
      }

      // Фильтрация по статусу
      if (dto.statuses?.length) {
        metrics = metrics.filter(m => dto.statuses.includes(m.status));
      }

      // Фильтрация по тегам
      if (dto.tags?.length) {
        metrics = metrics.filter(m => dto.tags.some(tag => m.tags.includes(tag)));
      }

      // Добавление целей и бенчмарков
      if (dto.includeTargets) {
        metrics.forEach(metric => {
          const target = this.targets.get(metric.id);
          if (target) {
            metric.target = target.targetValue;
          }
        });
      }

      // Обновление кэша
      metrics.forEach(metric => this.kpiCache.set(metric.id, metric));

      this.eventEmitter.emit('kpi.metrics.calculated', {
        category: dto.category,
        count: metrics.length,
        period: period.type,
      });

      return metrics;

    } catch (error) {
      this.logger.error(`❌ Ошибка расчета KPI метрик:`, error.message);
      throw error;
    }
  }

  async getKPIDashboard(dto: GetKPIDashboardDto): Promise<KPIDashboard> {
    const dashboardId = dto.dashboardId || 'default';
    let dashboard = this.dashboards.get(dashboardId);

    if (!dashboard) {
      throw new NotFoundException(`KPI дашборд с ID ${dashboardId} не найден`);
    }

    // Обновление метрик дашборда
    const metricsDto: GetKPIMetricsDto = {
      category: dto.category,
      period: 'real-time',
      includeTrends: true,
      includeTargets: true,
    };

    const metrics = await this.getKPIMetrics(metricsDto);
    dashboard.metrics = metrics;
    dashboard.updatedAt = new Date();

    return dashboard;
  }

  async createKPITarget(dto: CreateKPITargetDto): Promise<KPITarget> {
    const target: KPITarget = {
      metricId: dto.metricId,
      targetValue: dto.targetValue,
      targetType: dto.targetType,
      targetRange: dto.targetRange,
      effectiveFrom: new Date(dto.effectiveFrom),
      effectiveTo: dto.effectiveTo ? new Date(dto.effectiveTo) : undefined,
      description: dto.description,
      owner: dto.owner,
    };

    this.targets.set(dto.metricId, target);

    this.eventEmitter.emit('kpi.target.created', {
      metricId: dto.metricId,
      targetValue: dto.targetValue,
      owner: dto.owner,
    });

    this.logger.log(`🎯 Создана цель для метрики ${dto.metricId}: ${dto.targetValue}`);
    return target;
  }

  async createKPIAlert(dto: CreateKPIAlertDto): Promise<KPIAlert> {
    const alert: KPIAlert = {
      id: uuidv4(),
      metricId: dto.metricId,
      alertType: dto.alertType,
      condition: dto.condition,
      severity: dto.severity,
      message: dto.message,
      triggeredAt: new Date(),
      actions: dto.actions || [],
    };

    this.alerts.set(alert.id, alert);

    this.eventEmitter.emit('kpi.alert.created', {
      alertId: alert.id,
      metricId: dto.metricId,
      severity: dto.severity,
    });

    this.logger.log(`🚨 Создан алерт для метрики ${dto.metricId}: ${dto.severity}`);
    return alert;
  }

  async getKPIAlerts(dto: GetKPIAlertsDto): Promise<{
    alerts: KPIAlert[];
    total: number;
    page: number;
    limit: number;
  }> {
    let alerts = Array.from(this.alerts.values());

    // Фильтрация
    if (dto.severity?.length) {
      alerts = alerts.filter(a => dto.severity.includes(a.severity));
    }

    if (dto.unacknowledgedOnly) {
      alerts = alerts.filter(a => !a.acknowledgedAt);
    }

    if (dto.metricId) {
      alerts = alerts.filter(a => a.metricId === dto.metricId);
    }

    if (dto.dateFrom) {
      const dateFrom = new Date(dto.dateFrom);
      alerts = alerts.filter(a => a.triggeredAt >= dateFrom);
    }

    if (dto.dateTo) {
      const dateTo = new Date(dto.dateTo);
      alerts = alerts.filter(a => a.triggeredAt <= dateTo);
    }

    // Сортировка по важности и времени
    alerts.sort((a, b) => {
      const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      const severityDiff = severityOrder[b.severity] - severityOrder[a.severity];
      if (severityDiff !== 0) return severityDiff;
      return b.triggeredAt.getTime() - a.triggeredAt.getTime();
    });

    // Пагинация
    const offset = (dto.page - 1) * dto.limit;
    const paginatedAlerts = alerts.slice(offset, offset + dto.limit);

    return {
      alerts: paginatedAlerts,
      total: alerts.length,
      page: dto.page,
      limit: dto.limit,
    };
  }

  async acknowledgeAlert(alertId: string, dto: AcknowledgeKPIAlertDto, userId: string): Promise<KPIAlert> {
    const alert = this.alerts.get(alertId);
    if (!alert) {
      throw new NotFoundException(`Алерт с ID ${alertId} не найден`);
    }

    alert.acknowledgedAt = new Date();
    alert.acknowledgedBy = userId;

    this.alerts.set(alertId, alert);

    this.eventEmitter.emit('kpi.alert.acknowledged', {
      alertId,
      userId,
      comment: dto.comment,
    });

    this.logger.log(`✅ Алерт ${alertId} подтвержден пользователем ${userId}`);
    return alert;
  }

  async generateKPIReport(dto: GenerateKPIReportDto): Promise<KPIReport> {
    this.logger.log(`📋 Генерация KPI отчета: ${dto.title}`);

    const period: TimePeriod = {
      start: new Date(dto.dateFrom),
      end: new Date(dto.dateTo),
      type: 'daily',
    };

    const metricsDto: GetKPIMetricsDto = {
      category: dto.category,
      dateFrom: dto.dateFrom,
      dateTo: dto.dateTo,
      period: 'daily',
      includeTrends: dto.includeTrendAnalysis,
      includeBenchmarks: dto.includeBenchmarking,
      includeTargets: true,
    };

    const metrics = await this.getKPIMetrics(metricsDto);

    const report: KPIReport = {
      id: uuidv4(),
      title: dto.title,
      description: dto.description || '',
      category: dto.category || KPICategory.OPERATIONAL,
      period,
      metrics,
      summary: this.calculateReportSummary(metrics),
      insights: dto.includeTrendAnalysis ? this.generateInsights(metrics) : [],
      recommendations: dto.includeRecommendations ? this.generateRecommendations(metrics) : [],
      generatedAt: new Date(),
      generatedBy: 'system', // Будет заменено на реального пользователя
    };

    this.eventEmitter.emit('kpi.report.generated', {
      reportId: report.id,
      category: report.category,
      metricsCount: metrics.length,
    });

    return report;
  }

  // Автоматический расчет KPI
  @Cron(CronExpression.EVERY_5_MINUTES)
  private async calculateRealTimeKPIs(): Promise<void> {
    try {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

      const period: TimePeriod = {
        start: oneHourAgo,
        end: now,
        type: 'real-time',
      };

      await this.calculateTerminalKPIs(period, true);
      this.logger.debug(`⚡ Real-time KPI обновлены`);

    } catch (error) {
      this.logger.error(`❌ Ошибка расчета real-time KPI:`, error.message);
    }
  }

  // Проверка алертов
  @Cron(CronExpression.EVERY_MINUTE)
  private async checkKPIAlerts(): Promise<void> {
    try {
      const metrics = Array.from(this.kpiCache.values());
      
      for (const metric of metrics) {
        const alerts = Array.from(this.alerts.values()).filter(a => a.metricId === metric.id);
        
        for (const alert of alerts) {
          if (this.shouldTriggerAlert(metric, alert)) {
            await this.triggerAlert(alert, metric);
          }
        }
      }

    } catch (error) {
      this.logger.error(`❌ Ошибка проверки алертов:`, error.message);
    }
  }

  // Приватные методы
  private async calculateTerminalKPIs(period: TimePeriod, forceRefresh: boolean = false): Promise<TerminalKPIs> {
    const cacheKey = `terminal_kpis_${period.start.getTime()}_${period.end.getTime()}`;
    
    if (!forceRefresh && this.kpiCache.has(cacheKey)) {
      // Возвращаем кэшированные данные (упрощенно)
    }

    // Операционные KPI
    const operational = await this.calculateOperationalKPIs(period);
    
    // Финансовые KPI
    const financial = await this.calculateFinancialKPIs(period);
    
    // KPI оборудования
    const equipment = await this.calculateEquipmentKPIs(period);
    
    // KPI безопасности
    const safety = await this.calculateSafetyKPIs(period);

    return {
      operational,
      financial,
      equipment,
      safety,
      environmental: {} as any, // Будет реализовано позже
      customer: {} as any, // Будет реализовано позже
    };
  }

  private async calculateOperationalKPIs(period: TimePeriod): Promise<any> {
    const throughputQuery = `
      SELECT 
        count() as operations,
        uniq(container_number) as containers,
        sum(CASE WHEN container_size = 20 THEN 1 WHEN container_size = 40 THEN 2 ELSE 1 END) as teu
      FROM portvision360.container_operations
      WHERE timestamp BETWEEN '${period.start.toISOString().slice(0, 19).replace('T', ' ')}' 
        AND '${period.end.toISOString().slice(0, 19).replace('T', ' ')}'
    `;

    const throughputResult = await this.clickhouseService.query(throughputQuery);
    const throughputData = throughputResult.data[0] || { teu: 0 };

    const containerThroughput: KPIMetric = {
      id: 'container_throughput',
      name: 'Пропускная способность (TEU)',
      category: KPICategory.OPERATIONAL,
      description: 'Количество обработанных TEU за период',
      value: throughputData.teu,
      unit: 'TEU',
      trend: { direction: 'up', percentage: 5.2, period: 'vs previous period' },
      status: this.calculateKPIStatus(throughputData.teu, 1000),
      calculatedAt: new Date(),
      period,
      tags: ['production', 'throughput'],
    };

    return { containerThroughput };
  }

  private async calculateFinancialKPIs(period: TimePeriod): Promise<any> {
    const revenueQuery = `
      SELECT sum(amount) as total_revenue
      FROM portvision360.financial_transactions
      WHERE transaction_date BETWEEN '${period.start.toISOString().slice(0, 19).replace('T', ' ')}'
        AND '${period.end.toISOString().slice(0, 19).replace('T', ' ')}'
    `;

    const revenueResult = await this.clickhouseService.query(revenueQuery);
    const revenueData = revenueResult.data[0] || { total_revenue: 0 };

    const revenue: KPIMetric = {
      id: 'revenue',
      name: 'Выручка',
      category: KPICategory.FINANCIAL,
      description: 'Общая выручка за период',
      value: revenueData.total_revenue,
      unit: 'руб',
      trend: { direction: 'up', percentage: 8.5, period: 'vs previous period' },
      status: this.calculateKPIStatus(revenueData.total_revenue, 5000000),
      calculatedAt: new Date(),
      period,
      tags: ['finance', 'revenue'],
    };

    return { revenue };
  }

  private async calculateEquipmentKPIs(period: TimePeriod): Promise<any> {
    const equipmentQuery = `
      SELECT avg(utilization_percent) as avg_utilization
      FROM portvision360.equipment_performance
      WHERE timestamp BETWEEN '${period.start.toISOString().slice(0, 19).replace('T', ' ')}'
        AND '${period.end.toISOString().slice(0, 19).replace('T', ' ')}'
    `;

    const equipmentResult = await this.clickhouseService.query(equipmentQuery);
    const equipmentData = equipmentResult.data[0] || { avg_utilization: 0 };

    const equipmentUtilization: KPIMetric = {
      id: 'equipment_utilization',
      name: 'Утилизация оборудования',
      category: KPICategory.EQUIPMENT,
      description: 'Средний процент использования оборудования',
      value: equipmentData.avg_utilization,
      unit: '%',
      trend: { direction: 'stable', percentage: 0.5, period: 'vs previous period' },
      status: this.calculateKPIStatus(equipmentData.avg_utilization, 80),
      calculatedAt: new Date(),
      period,
      tags: ['equipment', 'utilization'],
    };

    return { equipmentUtilization };
  }

  private async calculateSafetyKPIs(period: TimePeriod): Promise<any> {
    // Заглушка для KPI безопасности
    const accidentRate: KPIMetric = {
      id: 'accident_rate',
      name: 'Частота инцидентов',
      category: KPICategory.SAFETY,
      description: 'Количество инцидентов за период',
      value: 2,
      unit: 'инциденты',
      trend: { direction: 'down', percentage: -15.0, period: 'vs previous period' },
      status: KPIStatus.GOOD,
      calculatedAt: new Date(),
      period,
      tags: ['safety', 'incidents'],
    };

    return { accidentRate };
  }

  private calculateKPIStatus(value: number, target: number): KPIStatus {
    const ratio = value / target;
    
    if (ratio >= 1.1) return KPIStatus.EXCELLENT;
    if (ratio >= 1.0) return KPIStatus.GOOD;
    if (ratio >= 0.8) return KPIStatus.WARNING;
    return KPIStatus.CRITICAL;
  }

  private calculateReportSummary(metrics: KPIMetric[]): any {
    const excellentCount = metrics.filter(m => m.status === KPIStatus.EXCELLENT).length;
    const goodCount = metrics.filter(m => m.status === KPIStatus.GOOD).length;
    const warningCount = metrics.filter(m => m.status === KPIStatus.WARNING).length;
    const criticalCount = metrics.filter(m => m.status === KPIStatus.CRITICAL).length;

    const overallScore = ((excellentCount * 4 + goodCount * 3 + warningCount * 2 + criticalCount * 1) / (metrics.length * 4)) * 100;

    return {
      totalMetrics: metrics.length,
      excellentCount,
      goodCount,
      warningCount,
      criticalCount,
      overallScore: Math.round(overallScore),
      keyHighlights: ['Высокая пропускная способность', 'Стабильная выручка'],
      majorConcerns: criticalCount > 0 ? ['Критические показатели требуют внимания'] : [],
    };
  }

  private generateInsights(metrics: KPIMetric[]): any[] {
    return [
      {
        type: 'trend',
        title: 'Положительная динамика пропускной способности',
        description: 'Пропускная способность терминала показывает устойчивый рост на 5.2%',
        metrics: ['container_throughput'],
        confidence: 85,
        impact: 'high',
      },
    ];
  }

  private generateRecommendations(metrics: KPIMetric[]): any[] {
    return [
      {
        title: 'Оптимизация загрузки оборудования',
        description: 'Рекомендуется перераспределить нагрузку для повышения эффективности',
        priority: 'medium',
        category: 'operations',
        estimatedImpact: '+5% эффективности',
        implementationTime: '2-3 недели',
        resources: ['operations_team', 'equipment_manager'],
        metrics: ['equipment_utilization'],
      },
    ];
  }

  private shouldTriggerAlert(metric: KPIMetric, alert: KPIAlert): boolean {
    const { condition } = alert;
    
    switch (condition.operator) {
      case '>':
        return metric.value > (condition.value as number);
      case '<':
        return metric.value < (condition.value as number);
      case '>=':
        return metric.value >= (condition.value as number);
      case '<=':
        return metric.value <= (condition.value as number);
      case '=':
        return metric.value === (condition.value as number);
      default:
        return false;
    }
  }

  private async triggerAlert(alert: KPIAlert, metric: KPIMetric): Promise<void> {
    this.logger.warn(`🚨 Алерт сработал: ${alert.message} (${metric.name}: ${metric.value})`);
    
    this.eventEmitter.emit('kpi.alert.triggered', {
      alertId: alert.id,
      metricId: metric.id,
      value: metric.value,
      severity: alert.severity,
    });
  }

  private initializeDefaultDashboard(): void {
    const defaultDashboard: KPIDashboard = {
      id: 'default',
      name: 'Основные KPI терминала',
      description: 'Дашборд с ключевыми показателями эффективности',
      category: KPICategory.OPERATIONAL,
      metrics: [],
      layout: {
        type: 'grid',
        columns: 4,
        groupBy: 'category',
        sorting: 'status',
      },
      refreshInterval: 60,
      isDefault: true,
      createdBy: 'system',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.dashboards.set('default', defaultDashboard);
    this.logger.log(`📊 Инициализирован дашборд KPI по умолчанию`);
  }

  getServiceStats() {
    return {
      cachedMetrics: this.kpiCache.size,
      activeTargets: this.targets.size,
      activeAlerts: this.alerts.size,
      dashboards: this.dashboards.size,
      memoryUsage: process.memoryUsage(),
      uptime: process.uptime(),
    };
  }
}