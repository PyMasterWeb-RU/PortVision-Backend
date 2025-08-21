import { Injectable, Logger, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ClickHouseService } from '../clickhouse/clickhouse.service';
import {
  CreateDashboardDto,
  UpdateDashboardDto,
  CreateWidgetDto,
  UpdateWidgetDto,
  GetDashboardsDto,
  GetWidgetDataDto,
  CloneDashboardDto,
  ShareDashboardDto,
  ExportDashboardDto,
} from './dto/dashboard.dto';
import {
  DashboardConfig,
  DashboardTemplate,
  DashboardCategory,
  WidgetData,
  WidgetType,
  ChartData,
  MetricCardData,
  TableData,
  GaugeData,
  MapData,
} from './interfaces/dashboard.interface';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class DashboardsService {
  private readonly logger = new Logger(DashboardsService.name);
  
  // In-memory storage для демонстрации (в продакшене будет база данных)
  private readonly dashboards = new Map<string, DashboardConfig>();
  private readonly widgetDataCache = new Map<string, WidgetData>();
  private readonly dashboardTemplates = new Map<string, DashboardTemplate>();

  constructor(
    private readonly clickhouseService: ClickHouseService,
    private readonly eventEmitter: EventEmitter2,
  ) {
    this.initializeTemplates();
  }

  async createDashboard(dto: CreateDashboardDto, userId: string): Promise<DashboardConfig> {
    this.logger.log(`📊 Создание дашборда: ${dto.name} пользователем ${userId}`);

    const dashboard: DashboardConfig = {
      id: uuidv4(),
      name: dto.name,
      description: dto.description,
      layout: dto.layout,
      widgets: dto.widgets || [],
      filters: dto.filters || [],
      refreshInterval: dto.refreshInterval || 30,
      isPublic: dto.isPublic || false,
      createdBy: userId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.dashboards.set(dashboard.id, dashboard);

    this.eventEmitter.emit('dashboard.created', {
      dashboardId: dashboard.id,
      userId,
      name: dashboard.name,
    });

    this.logger.log(`✅ Дашборд создан: ${dashboard.id}`);
    return dashboard;
  }

  async getDashboards(dto: GetDashboardsDto, userId: string): Promise<{
    dashboards: DashboardConfig[];
    total: number;
    page: number;
    limit: number;
  }> {
    let dashboards = Array.from(this.dashboards.values());

    // Фильтрация по доступу
    if (dto.publicOnly) {
      dashboards = dashboards.filter(d => d.isPublic);
    } else if (dto.myOnly) {
      dashboards = dashboards.filter(d => d.createdBy === userId);
    } else {
      // Показываем публичные дашборды и дашборды пользователя
      dashboards = dashboards.filter(d => d.isPublic || d.createdBy === userId);
    }

    // Фильтрация по поиску
    if (dto.search) {
      const search = dto.search.toLowerCase();
      dashboards = dashboards.filter(d => 
        d.name.toLowerCase().includes(search) ||
        d.description?.toLowerCase().includes(search)
      );
    }

    // Сортировка по дате обновления (новые сначала)
    dashboards.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

    // Пагинация
    const offset = (dto.page - 1) * dto.limit;
    const paginatedDashboards = dashboards.slice(offset, offset + dto.limit);

    return {
      dashboards: paginatedDashboards,
      total: dashboards.length,
      page: dto.page,
      limit: dto.limit,
    };
  }

  async getDashboard(dashboardId: string, userId: string): Promise<DashboardConfig> {
    const dashboard = this.dashboards.get(dashboardId);
    if (!dashboard) {
      throw new NotFoundException(`Дашборд с ID ${dashboardId} не найден`);
    }

    // Проверка доступа
    if (!dashboard.isPublic && dashboard.createdBy !== userId) {
      throw new ForbiddenException('Доступ к дашборду запрещен');
    }

    return dashboard;
  }

  async updateDashboard(
    dashboardId: string,
    dto: UpdateDashboardDto,
    userId: string,
  ): Promise<DashboardConfig> {
    const dashboard = await this.getDashboard(dashboardId, userId);

    // Проверка прав на редактирование
    if (dashboard.createdBy !== userId) {
      throw new ForbiddenException('Недостаточно прав для редактирования дашборда');
    }

    // Обновление полей
    if (dto.name !== undefined) dashboard.name = dto.name;
    if (dto.description !== undefined) dashboard.description = dto.description;
    if (dto.layout !== undefined) dashboard.layout = dto.layout;
    if (dto.widgets !== undefined) dashboard.widgets = dto.widgets;
    if (dto.filters !== undefined) dashboard.filters = dto.filters;
    if (dto.refreshInterval !== undefined) dashboard.refreshInterval = dto.refreshInterval;
    if (dto.isPublic !== undefined) dashboard.isPublic = dto.isPublic;
    
    dashboard.updatedAt = new Date();

    this.dashboards.set(dashboardId, dashboard);

    this.eventEmitter.emit('dashboard.updated', {
      dashboardId,
      userId,
      changes: Object.keys(dto),
    });

    this.logger.log(`✅ Дашборд обновлен: ${dashboardId}`);
    return dashboard;
  }

  async deleteDashboard(dashboardId: string, userId: string): Promise<void> {
    const dashboard = await this.getDashboard(dashboardId, userId);

    // Проверка прав на удаление
    if (dashboard.createdBy !== userId) {
      throw new ForbiddenException('Недостаточно прав для удаления дашборда');
    }

    this.dashboards.delete(dashboardId);

    // Очистка кэша виджетов
    for (const widget of dashboard.widgets) {
      this.widgetDataCache.delete(widget.id);
    }

    this.eventEmitter.emit('dashboard.deleted', {
      dashboardId,
      userId,
      name: dashboard.name,
    });

    this.logger.log(`🗑️ Дашборд удален: ${dashboardId}`);
  }

  async addWidget(
    dashboardId: string,
    dto: CreateWidgetDto,
    userId: string,
  ): Promise<DashboardConfig> {
    const dashboard = await this.getDashboard(dashboardId, userId);

    if (dashboard.createdBy !== userId) {
      throw new ForbiddenException('Недостаточно прав для редактирования дашборда');
    }

    const widget = {
      id: uuidv4(),
      ...dto,
    };

    dashboard.widgets.push(widget);
    dashboard.updatedAt = new Date();

    this.dashboards.set(dashboardId, dashboard);

    this.eventEmitter.emit('widget.added', {
      dashboardId,
      widgetId: widget.id,
      userId,
      widgetType: widget.type,
    });

    this.logger.log(`➕ Виджет добавлен: ${widget.id} в дашборд ${dashboardId}`);
    return dashboard;
  }

  async updateWidget(
    dashboardId: string,
    widgetId: string,
    dto: UpdateWidgetDto,
    userId: string,
  ): Promise<DashboardConfig> {
    const dashboard = await this.getDashboard(dashboardId, userId);

    if (dashboard.createdBy !== userId) {
      throw new ForbiddenException('Недостаточно прав для редактирования дашборда');
    }

    const widgetIndex = dashboard.widgets.findIndex(w => w.id === widgetId);
    if (widgetIndex === -1) {
      throw new NotFoundException(`Виджет с ID ${widgetId} не найден`);
    }

    const widget = dashboard.widgets[widgetIndex];

    // Обновление полей виджета
    if (dto.title !== undefined) widget.title = dto.title;
    if (dto.position !== undefined) widget.position = dto.position;
    if (dto.size !== undefined) widget.size = dto.size;
    if (dto.config !== undefined) widget.config = { ...widget.config, ...dto.config };
    if (dto.dataSource !== undefined) widget.dataSource = { ...widget.dataSource, ...dto.dataSource };
    if (dto.styling !== undefined) widget.styling = { ...widget.styling, ...dto.styling };

    dashboard.updatedAt = new Date();
    this.dashboards.set(dashboardId, dashboard);

    // Очистка кэша данных виджета
    this.widgetDataCache.delete(widgetId);

    this.eventEmitter.emit('widget.updated', {
      dashboardId,
      widgetId,
      userId,
      changes: Object.keys(dto),
    });

    this.logger.log(`✏️ Виджет обновлен: ${widgetId}`);
    return dashboard;
  }

  async removeWidget(
    dashboardId: string,
    widgetId: string,
    userId: string,
  ): Promise<DashboardConfig> {
    const dashboard = await this.getDashboard(dashboardId, userId);

    if (dashboard.createdBy !== userId) {
      throw new ForbiddenException('Недостаточно прав для редактирования дашборда');
    }

    const widgetIndex = dashboard.widgets.findIndex(w => w.id === widgetId);
    if (widgetIndex === -1) {
      throw new NotFoundException(`Виджет с ID ${widgetId} не найден`);
    }

    dashboard.widgets.splice(widgetIndex, 1);
    dashboard.updatedAt = new Date();

    this.dashboards.set(dashboardId, dashboard);

    // Очистка кэша данных виджета
    this.widgetDataCache.delete(widgetId);

    this.eventEmitter.emit('widget.removed', {
      dashboardId,
      widgetId,
      userId,
    });

    this.logger.log(`➖ Виджет удален: ${widgetId} из дашборда ${dashboardId}`);
    return dashboard;
  }

  async getWidgetData(
    dashboardId: string,
    widgetId: string,
    dto: GetWidgetDataDto,
    userId: string,
  ): Promise<WidgetData> {
    const dashboard = await this.getDashboard(dashboardId, userId);
    const widget = dashboard.widgets.find(w => w.id === widgetId);

    if (!widget) {
      throw new NotFoundException(`Виджет с ID ${widgetId} не найден`);
    }

    // Проверка кэша (если не принудительное обновление)
    if (!dto.forceRefresh && this.widgetDataCache.has(widgetId)) {
      const cachedData = this.widgetDataCache.get(widgetId);
      const cacheAge = Date.now() - cachedData.metadata.lastUpdated.getTime();
      const cacheTime = (widget.dataSource.cacheTime || 60) * 1000; // в миллисекундах

      if (cacheAge < cacheTime) {
        return cachedData;
      }
    }

    const startTime = Date.now();

    try {
      let data: any;

      switch (widget.dataSource.type) {
        case 'clickhouse':
          data = await this.executeClickHouseQuery(widget, dto);
          break;
        case 'api':
          data = await this.fetchApiData(widget, dto);
          break;
        case 'static':
          data = widget.dataSource.parameters || {};
          break;
        default:
          throw new BadRequestException(`Неподдерживаемый тип источника данных: ${widget.dataSource.type}`);
      }

      // Преобразование данных в формат виджета
      const formattedData = await this.formatWidgetData(widget, data);

      const widgetData: WidgetData = {
        widgetId,
        data: formattedData,
        metadata: {
          lastUpdated: new Date(),
          executionTime: Date.now() - startTime,
          dataPoints: Array.isArray(formattedData) ? formattedData.length : 1,
        },
      };

      // Кэширование данных
      this.widgetDataCache.set(widgetId, widgetData);

      this.eventEmitter.emit('widget.data.updated', {
        dashboardId,
        widgetId,
        dataPoints: widgetData.metadata.dataPoints,
        executionTime: widgetData.metadata.executionTime,
      });

      return widgetData;

    } catch (error) {
      const executionTime = Date.now() - startTime;

      this.logger.error(`❌ Ошибка получения данных виджета ${widgetId}:`, error.message);

      const errorData: WidgetData = {
        widgetId,
        data: null,
        metadata: {
          lastUpdated: new Date(),
          executionTime,
          dataPoints: 0,
          error: error.message,
        },
      };

      return errorData;
    }
  }

  async cloneDashboard(
    dashboardId: string,
    dto: CloneDashboardDto,
    userId: string,
  ): Promise<DashboardConfig> {
    const sourceDashboard = await this.getDashboard(dashboardId, userId);

    const newDashboard: DashboardConfig = {
      id: uuidv4(),
      name: dto.name,
      description: dto.description || sourceDashboard.description,
      layout: { ...sourceDashboard.layout },
      widgets: sourceDashboard.widgets.map(widget => ({
        ...widget,
        id: uuidv4(), // Новые ID для виджетов
      })),
      filters: [...sourceDashboard.filters],
      refreshInterval: sourceDashboard.refreshInterval,
      isPublic: dto.isPublic || false,
      createdBy: userId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.dashboards.set(newDashboard.id, newDashboard);

    this.eventEmitter.emit('dashboard.cloned', {
      sourceDashboardId: dashboardId,
      newDashboardId: newDashboard.id,
      userId,
      name: newDashboard.name,
    });

    this.logger.log(`📋 Дашборд клонирован: ${dashboardId} -> ${newDashboard.id}`);
    return newDashboard;
  }

  async getTemplates(): Promise<DashboardTemplate[]> {
    return Array.from(this.dashboardTemplates.values());
  }

  async createFromTemplate(
    templateId: string,
    name: string,
    userId: string,
  ): Promise<DashboardConfig> {
    const template = this.dashboardTemplates.get(templateId);
    if (!template) {
      throw new NotFoundException(`Шаблон с ID ${templateId} не найден`);
    }

    const dashboard: DashboardConfig = {
      id: uuidv4(),
      name,
      description: template.config.description,
      layout: { ...template.config.layout },
      widgets: template.config.widgets.map(widget => ({
        ...widget,
        id: uuidv4(), // Новые ID для виджетов
      })),
      filters: [...template.config.filters],
      refreshInterval: template.config.refreshInterval,
      isPublic: template.config.isPublic,
      createdBy: userId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.dashboards.set(dashboard.id, dashboard);

    this.eventEmitter.emit('dashboard.created.from.template', {
      templateId,
      dashboardId: dashboard.id,
      userId,
      name: dashboard.name,
    });

    this.logger.log(`📋 Дашборд создан из шаблона: ${templateId} -> ${dashboard.id}`);
    return dashboard;
  }

  // Приватные методы для работы с данными
  private async executeClickHouseQuery(widget: any, dto: GetWidgetDataDto): Promise<any> {
    let query = widget.dataSource.query;

    // Подстановка параметров фильтрации
    if (dto.dateFrom && dto.dateTo) {
      const dateFromStr = new Date(dto.dateFrom).toISOString().slice(0, 19).replace('T', ' ');
      const dateToStr = new Date(dto.dateTo).toISOString().slice(0, 19).replace('T', ' ');
      
      query = query.replace('{{dateFrom}}', `'${dateFromStr}'`);
      query = query.replace('{{dateTo}}', `'${dateToStr}'`);
    }

    // Дополнительные фильтры
    if (dto.filters) {
      for (const [key, value] of Object.entries(dto.filters)) {
        query = query.replace(`{{${key}}}`, `'${value}'`);
      }
    }

    const result = await this.clickhouseService.query(query);
    return result.data;
  }

  private async fetchApiData(widget: any, dto: GetWidgetDataDto): Promise<any> {
    // Здесь будет логика для получения данных из внешних API
    // Пока возвращаем заглушку
    return { message: 'API data not implemented yet' };
  }

  private async formatWidgetData(widget: any, rawData: any): Promise<any> {
    switch (widget.type) {
      case WidgetType.CHART_LINE:
      case WidgetType.CHART_BAR:
      case WidgetType.CHART_AREA:
        return this.formatChartData(rawData, widget);

      case WidgetType.CHART_PIE:
        return this.formatPieChartData(rawData, widget);

      case WidgetType.METRIC_CARD:
        return this.formatMetricCardData(rawData, widget);

      case WidgetType.TABLE:
        return this.formatTableData(rawData, widget);

      case WidgetType.GAUGE:
        return this.formatGaugeData(rawData, widget);

      case WidgetType.MAP:
        return this.formatMapData(rawData, widget);

      default:
        return rawData;
    }
  }

  private formatChartData(rawData: any[], widget: any): ChartData {
    if (!Array.isArray(rawData) || rawData.length === 0) {
      return { labels: [], datasets: [] };
    }

    const firstRow = rawData[0];
    const keys = Object.keys(firstRow);
    
    // Первый ключ обычно используется для labels (например, время)
    const labelKey = keys[0];
    const labels = rawData.map(row => row[labelKey]);

    // Остальные ключи используются для datasets
    const dataKeys = keys.slice(1);
    const datasets = dataKeys.map((key, index) => ({
      label: key,
      data: rawData.map(row => row[key] || 0),
      backgroundColor: this.getChartColor(index, 0.6),
      borderColor: this.getChartColor(index, 1),
      borderWidth: 2,
      fill: widget.type === WidgetType.CHART_AREA,
      tension: 0.4,
    }));

    return { labels, datasets };
  }

  private formatPieChartData(rawData: any[], widget: any): ChartData {
    if (!Array.isArray(rawData) || rawData.length === 0) {
      return { labels: [], datasets: [] };
    }

    const keys = Object.keys(rawData[0]);
    const labelKey = keys[0];
    const valueKey = keys[1];

    const labels = rawData.map(row => row[labelKey]);
    const data = rawData.map(row => row[valueKey] || 0);
    const backgroundColor = rawData.map((_, index) => this.getChartColor(index, 0.8));

    return {
      labels,
      datasets: [{
        label: widget.title,
        data,
        backgroundColor,
        borderWidth: 1,
      }],
    };
  }

  private formatMetricCardData(rawData: any, widget: any): MetricCardData {
    if (Array.isArray(rawData) && rawData.length > 0) {
      const data = rawData[0];
      const keys = Object.keys(data);
      
      return {
        value: data[keys[0]] || 0,
        label: widget.title,
        unit: widget.config.unit || '',
        status: this.calculateMetricStatus(data[keys[0]], widget.config.thresholds),
      };
    }

    return {
      value: 0,
      label: widget.title,
      status: 'info',
    };
  }

  private formatTableData(rawData: any[], widget: any): TableData {
    if (!Array.isArray(rawData) || rawData.length === 0) {
      return { columns: [], rows: [] };
    }

    const firstRow = rawData[0];
    const columns = Object.keys(firstRow).map(key => ({
      key,
      title: key,
      dataType: this.inferDataType(firstRow[key]),
      sortable: true,
      filterable: true,
    }));

    return {
      columns,
      rows: rawData,
      pagination: {
        page: 1,
        pageSize: Math.min(rawData.length, 50),
        total: rawData.length,
      },
    };
  }

  private formatGaugeData(rawData: any, widget: any): GaugeData {
    if (Array.isArray(rawData) && rawData.length > 0) {
      const data = rawData[0];
      const keys = Object.keys(data);
      
      return {
        value: data[keys[0]] || 0,
        min: widget.config.min || 0,
        max: widget.config.max || 100,
        label: widget.title,
        unit: widget.config.unit || '',
        thresholds: widget.config.thresholds || [],
      };
    }

    return {
      value: 0,
      min: 0,
      max: 100,
      label: widget.title,
    };
  }

  private formatMapData(rawData: any[], widget: any): MapData {
    return {
      type: widget.config.mapType || 'terminal',
      center: widget.config.center || [0, 0],
      zoom: widget.config.zoom || 10,
      layers: [{
        id: 'default',
        type: 'containers',
        data: rawData || [],
        visible: true,
      }],
    };
  }

  // Вспомогательные методы
  private getChartColor(index: number, alpha: number = 1): string {
    const colors = [
      '54, 162, 235',   // Синий
      '255, 99, 132',   // Красный
      '255, 205, 86',   // Желтый
      '75, 192, 192',   // Зеленый
      '153, 102, 255',  // Фиолетовый
      '255, 159, 64',   // Оранжевый
      '199, 199, 199',  // Серый
      '83, 102, 255',   // Индиго
    ];

    const colorIndex = index % colors.length;
    return `rgba(${colors[colorIndex]}, ${alpha})`;
  }

  private calculateMetricStatus(value: number, thresholds?: any[]): 'success' | 'warning' | 'error' | 'info' {
    if (!thresholds || thresholds.length === 0) return 'info';

    for (const threshold of thresholds) {
      switch (threshold.operator) {
        case '>':
          if (value > threshold.value) return threshold.status || 'warning';
          break;
        case '<':
          if (value < threshold.value) return threshold.status || 'warning';
          break;
        case '>=':
          if (value >= threshold.value) return threshold.status || 'warning';
          break;
        case '<=':
          if (value <= threshold.value) return threshold.status || 'warning';
          break;
        case '=':
          if (value === threshold.value) return threshold.status || 'warning';
          break;
      }
    }

    return 'success';
  }

  private inferDataType(value: any): 'string' | 'number' | 'date' | 'boolean' {
    if (typeof value === 'boolean') return 'boolean';
    if (typeof value === 'number') return 'number';
    if (value instanceof Date) return 'date';
    if (typeof value === 'string' && !isNaN(Date.parse(value))) return 'date';
    return 'string';
  }

  // Инициализация шаблонов дашбордов
  private initializeTemplates(): void {
    const operationalTemplate: DashboardTemplate = {
      id: 'operational-overview',
      name: 'Операционный обзор',
      description: 'Основные метрики работы терминала в реальном времени',
      category: DashboardCategory.OPERATIONS,
      tags: ['операции', 'контейнеры', 'производительность'],
      config: {
        name: 'Операционный обзор',
        description: 'Основные метрики работы терминала',
        layout: {
          type: 'grid',
          columns: 12,
          rows: 6,
          spacing: 16,
          responsive: true,
        },
        widgets: [
          {
            id: 'widget-1',
            type: WidgetType.METRIC_CARD,
            title: 'Операций сегодня',
            position: { x: 0, y: 0 },
            size: { width: 3, height: 2 },
            config: { unit: 'ops' },
            dataSource: {
              type: 'clickhouse',
              query: `SELECT count() as value FROM portvision360.container_operations 
                      WHERE toDate(timestamp) = today()`,
            },
          },
          {
            id: 'widget-2',
            type: WidgetType.CHART_LINE,
            title: 'Операции по часам',
            position: { x: 3, y: 0 },
            size: { width: 6, height: 4 },
            config: { groupBy: ['hour'] },
            dataSource: {
              type: 'clickhouse',
              query: `SELECT toStartOfHour(timestamp) as hour, count() as operations
                      FROM portvision360.container_operations 
                      WHERE timestamp >= now() - INTERVAL 24 HOUR
                      GROUP BY hour ORDER BY hour`,
            },
          },
          {
            id: 'widget-3',
            type: WidgetType.CHART_PIE,
            title: 'Типы операций',
            position: { x: 9, y: 0 },
            size: { width: 3, height: 4 },
            config: {},
            dataSource: {
              type: 'clickhouse',
              query: `SELECT operation_type, count() as count
                      FROM portvision360.container_operations 
                      WHERE toDate(timestamp) = today()
                      GROUP BY operation_type`,
            },
          },
        ],
        filters: [
          {
            id: 'date-filter',
            name: 'Период',
            type: FilterType.DATE_RANGE,
            field: 'timestamp',
            defaultValue: { start: 'today', end: 'today' },
          },
        ],
        refreshInterval: 30,
        isPublic: false,
      },
    };

    this.dashboardTemplates.set(operationalTemplate.id, operationalTemplate);

    this.logger.log(`📋 Инициализированы шаблоны дашбордов: ${this.dashboardTemplates.size}`);
  }

  // Автоматическая очистка кэша данных виджетов
  @Cron(CronExpression.EVERY_30_MINUTES)
  private cleanupWidgetDataCache(): void {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    let removedCount = 0;

    for (const [widgetId, widgetData] of this.widgetDataCache.entries()) {
      if (widgetData.metadata.lastUpdated < oneHourAgo) {
        this.widgetDataCache.delete(widgetId);
        removedCount++;
      }
    }

    if (removedCount > 0) {
      this.logger.log(`🧹 Очищено ${removedCount} виджетов из кэша`);
    }
  }

  // Получение статистики работы сервиса
  getServiceStats() {
    return {
      totalDashboards: this.dashboards.size,
      totalTemplates: this.dashboardTemplates.size,
      cachedWidgets: this.widgetDataCache.size,
      memoryUsage: process.memoryUsage(),
      uptime: process.uptime(),
    };
  }
}