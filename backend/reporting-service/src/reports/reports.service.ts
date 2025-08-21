import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ClickHouseService } from '../clickhouse/clickhouse.service';
import { 
  GenerateReportDto, 
  ReportListDto, 
  UpdateReportDto,
  ReportType,
  GroupingPeriod,
  ReportFormat,
} from './dto/report.dto';
import {
  ReportResult,
  ReportFilter,
  ContainerOperationsReportData,
  GateTransactionsReportData,
  EquipmentPerformanceReportData,
  FinancialReportData,
  InventoryReportData,
  ProductivityReportData,
  ClientActivityReportData,
  TerminalKPIReportData,
} from './interfaces/report.interface';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);
  private readonly reportCache = new Map<string, ReportResult>();

  constructor(
    private readonly clickhouseService: ClickHouseService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async generateReport(dto: GenerateReportDto): Promise<ReportResult> {
    const startTime = Date.now();
    this.logger.log(`📊 Генерация отчета: ${dto.type} - ${dto.name}`);

    try {
      const filter: ReportFilter = {
        dateFrom: new Date(dto.dateFrom),
        dateTo: new Date(dto.dateTo),
        clientIds: dto.clientIds,
        containerTypes: dto.containerTypes,
        operationTypes: dto.operationTypes,
        equipmentTypes: dto.equipmentTypes,
        statuses: dto.statuses,
        locations: dto.locations,
        groupBy: dto.groupBy,
      };

      let data: any[];
      let summary: any = {};

      switch (dto.type) {
        case ReportType.CONTAINER_OPERATIONS:
          data = await this.generateContainerOperationsReport(filter);
          summary = await this.calculateContainerOperationsSummary(filter);
          break;

        case ReportType.GATE_TRANSACTIONS:
          data = await this.generateGateTransactionsReport(filter);
          summary = await this.calculateGateTransactionsSummary(filter);
          break;

        case ReportType.EQUIPMENT_PERFORMANCE:
          data = await this.generateEquipmentPerformanceReport(filter);
          summary = await this.calculateEquipmentPerformanceSummary(filter);
          break;

        case ReportType.FINANCIAL_ANALYSIS:
          data = await this.generateFinancialReport(filter);
          summary = await this.calculateFinancialSummary(filter);
          break;

        case ReportType.INVENTORY_STATUS:
          data = await this.generateInventoryReport(filter);
          summary = await this.calculateInventorySummary(filter);
          break;

        case ReportType.PRODUCTIVITY_ANALYSIS:
          data = await this.generateProductivityReport(filter);
          summary = await this.calculateProductivitySummary(filter);
          break;

        case ReportType.CLIENT_ACTIVITY:
          data = await this.generateClientActivityReport(filter);
          summary = await this.calculateClientActivitySummary(filter);
          break;

        case ReportType.TERMINAL_KPI:
          data = await this.generateTerminalKPIReport(filter);
          summary = await this.calculateTerminalKPISummary(filter);
          break;

        default:
          throw new BadRequestException(`Неподдерживаемый тип отчета: ${dto.type}`);
      }

      const executionTime = Date.now() - startTime;

      const report: ReportResult = {
        id: uuidv4(),
        name: dto.name,
        type: dto.type,
        generatedAt: new Date(),
        filters: filter,
        data,
        metadata: {
          totalRows: data.length,
          executionTime,
          dataSource: 'ClickHouse',
          columns: this.getReportColumns(dto.type),
        },
        summary: dto.includeSummary ? summary : undefined,
      };

      // Кэшируем отчет
      this.reportCache.set(report.id, report);

      // Отправляем событие о создании отчета
      this.eventEmitter.emit('report.generated', {
        reportId: report.id,
        type: dto.type,
        executionTime,
        dataSize: data.length,
      });

      this.logger.log(`✅ Отчет сгенерирован за ${executionTime}ms, строк: ${data.length}`);
      return report;

    } catch (error) {
      const executionTime = Date.now() - startTime;
      this.logger.error(`❌ Ошибка генерации отчета (${executionTime}ms):`, error.message);
      
      this.eventEmitter.emit('report.generation.failed', {
        type: dto.type,
        error: error.message,
        executionTime,
      });

      throw error;
    }
  }

  async getReport(reportId: string): Promise<ReportResult> {
    const report = this.reportCache.get(reportId);
    if (!report) {
      throw new NotFoundException(`Отчет с ID ${reportId} не найден`);
    }
    return report;
  }

  async getReportsList(dto: ReportListDto): Promise<{
    reports: Partial<ReportResult>[];
    total: number;
    page: number;
    limit: number;
  }> {
    const reports = Array.from(this.reportCache.values());
    
    // Фильтрация
    let filteredReports = reports;
    if (dto.type) {
      filteredReports = filteredReports.filter(r => r.type === dto.type);
    }
    if (dto.search) {
      const search = dto.search.toLowerCase();
      filteredReports = filteredReports.filter(r => 
        r.name.toLowerCase().includes(search)
      );
    }
    if (dto.createdFrom) {
      const createdFrom = new Date(dto.createdFrom);
      filteredReports = filteredReports.filter(r => r.generatedAt >= createdFrom);
    }
    if (dto.createdTo) {
      const createdTo = new Date(dto.createdTo);
      filteredReports = filteredReports.filter(r => r.generatedAt <= createdTo);
    }

    // Сортировка по дате создания (новые сначала)
    filteredReports.sort((a, b) => b.generatedAt.getTime() - a.generatedAt.getTime());

    // Пагинация
    const offset = (dto.page - 1) * dto.limit;
    const paginatedReports = filteredReports.slice(offset, offset + dto.limit);

    // Возвращаем только базовую информацию для списка
    const reportsList = paginatedReports.map(report => ({
      id: report.id,
      name: report.name,
      type: report.type,
      generatedAt: report.generatedAt,
      metadata: {
        totalRows: report.metadata.totalRows,
        executionTime: report.metadata.executionTime,
      },
    }));

    return {
      reports: reportsList,
      total: filteredReports.length,
      page: dto.page,
      limit: dto.limit,
    };
  }

  async deleteReport(reportId: string): Promise<void> {
    if (!this.reportCache.has(reportId)) {
      throw new NotFoundException(`Отчет с ID ${reportId} не найден`);
    }
    
    this.reportCache.delete(reportId);
    this.logger.log(`🗑️ Отчет ${reportId} удален`);
    
    this.eventEmitter.emit('report.deleted', { reportId });
  }

  private async generateContainerOperationsReport(filter: ReportFilter): Promise<ContainerOperationsReportData[]> {
    const timeColumn = this.getTimeGrouping(filter.groupBy || 'day');
    const whereClause = this.buildWhereClause('container_operations', filter);

    const query = `
      SELECT 
        ${timeColumn} as period,
        operation_type,
        count() as operations_count,
        uniq(container_number) as unique_containers,
        avg(duration_seconds) as avg_duration_seconds,
        sum(CASE WHEN container_size = 20 THEN 1 WHEN container_size = 40 THEN 2 ELSE 1 END) as total_teu,
        countIf(status = 'completed') / count() * 100 as success_rate
      FROM portvision360.container_operations
      WHERE ${whereClause}
      GROUP BY period, operation_type
      ORDER BY period DESC, operation_type
    `;

    const result = await this.clickhouseService.query<ContainerOperationsReportData>(query);
    return result.data;
  }

  private async generateGateTransactionsReport(filter: ReportFilter): Promise<GateTransactionsReportData[]> {
    const timeColumn = this.getTimeGrouping(filter.groupBy || 'day');
    const whereClause = this.buildWhereClause('gate_transactions', filter);

    const query = `
      SELECT 
        ${timeColumn} as period,
        gate_direction,
        count() as transactions_count,
        avg(processing_time_seconds) as avg_processing_time_seconds,
        sum(gross_weight) as total_weight,
        uniq(truck_number) as trucks_count
      FROM portvision360.gate_transactions
      WHERE ${whereClause}
      GROUP BY period, gate_direction
      ORDER BY period DESC, gate_direction
    `;

    const result = await this.clickhouseService.query<GateTransactionsReportData>(query);
    return result.data;
  }

  private async generateEquipmentPerformanceReport(filter: ReportFilter): Promise<EquipmentPerformanceReportData[]> {
    const timeColumn = this.getTimeGrouping(filter.groupBy || 'day');
    const whereClause = this.buildWhereClause('equipment_performance', filter);

    const query = `
      SELECT 
        ${timeColumn} as period,
        equipment_type,
        equipment_id,
        avg(utilization_percent) as utilization_percent,
        avg(moves_per_hour) as moves_per_hour,
        avg(fuel_consumption) as fuel_consumption,
        sum(breakdown_count) as breakdown_count,
        sum(maintenance_hours) as maintenance_hours,
        (avg(utilization_percent) * avg(moves_per_hour)) / 100 as efficiency_score
      FROM portvision360.equipment_performance
      WHERE ${whereClause}
      GROUP BY period, equipment_type, equipment_id
      ORDER BY period DESC, efficiency_score DESC
    `;

    const result = await this.clickhouseService.query<EquipmentPerformanceReportData>(query);
    return result.data;
  }

  private async generateFinancialReport(filter: ReportFilter): Promise<FinancialReportData[]> {
    const timeColumn = this.getTimeGrouping(filter.groupBy || 'day', 'transaction_date');
    const whereClause = this.buildWhereClause('financial_transactions', filter, 'transaction_date');

    const query = `
      SELECT 
        ${timeColumn} as period,
        client_id,
        service_type,
        count() as transactions_count,
        sum(amount) as total_amount,
        any(currency) as currency,
        payment_status,
        avg(amount) as average_transaction_value
      FROM portvision360.financial_transactions
      WHERE ${whereClause}
      GROUP BY period, client_id, service_type, payment_status
      ORDER BY period DESC, total_amount DESC
    `;

    const result = await this.clickhouseService.query<FinancialReportData>(query);
    return result.data;
  }

  private async generateInventoryReport(filter: ReportFilter): Promise<InventoryReportData[]> {
    const timeColumn = this.getTimeGrouping(filter.groupBy || 'day', 'snapshot_date');
    const whereClause = this.buildWhereClause('inventory_snapshots', filter, 'snapshot_date');

    const query = `
      SELECT 
        ${timeColumn} as snapshot_date,
        location,
        location_type,
        avg(container_count) as container_count,
        avg(teu_count) as teu_count,
        avg(utilization_percent) as utilization_percent,
        avg(dwell_time_avg) as dwell_time_avg,
        any(container_types) as container_types
      FROM portvision360.inventory_snapshots
      WHERE ${whereClause}
      GROUP BY snapshot_date, location, location_type
      ORDER BY snapshot_date DESC, utilization_percent DESC
    `;

    const result = await this.clickhouseService.query<InventoryReportData>(query);
    return result.data;
  }

  private async generateProductivityReport(filter: ReportFilter): Promise<ProductivityReportData[]> {
    const timeColumn = this.getTimeGrouping(filter.groupBy || 'day');
    const whereClause = this.buildWhereClause('container_operations', filter);

    const query = `
      SELECT 
        ${timeColumn} as period,
        count() as total_moves,
        count() / (24 * multiIf(
          '${filter.groupBy}' = 'hour', 1,
          '${filter.groupBy}' = 'day', 1,
          '${filter.groupBy}' = 'week', 7,
          '${filter.groupBy}' = 'month', 30,
          1
        )) as moves_per_hour,
        countIf(operation_type LIKE '%vessel%') as vessel_operations,
        countIf(operation_type LIKE '%truck%') as truck_operations
      FROM portvision360.container_operations
      WHERE ${whereClause}
      GROUP BY period
      ORDER BY period DESC
    `;

    const result = await this.clickhouseService.query<ProductivityReportData>(query);
    return result.data;
  }

  private async generateClientActivityReport(filter: ReportFilter): Promise<ClientActivityReportData[]> {
    const timeColumn = this.getTimeGrouping(filter.groupBy || 'day');
    const whereClause = this.buildWhereClause('container_operations', filter);

    const query = `
      SELECT 
        ${timeColumn} as period,
        client_id,
        count() as total_operations,
        uniq(container_number) as container_count,
        avg(duration_seconds) / 3600 as avg_dwell_time
      FROM portvision360.container_operations
      WHERE ${whereClause} AND client_id IS NOT NULL
      GROUP BY period, client_id
      ORDER BY period DESC, total_operations DESC
    `;

    const result = await this.clickhouseService.query<ClientActivityReportData>(query);
    return result.data;
  }

  private async generateTerminalKPIReport(filter: ReportFilter): Promise<TerminalKPIReportData[]> {
    const timeColumn = this.getTimeGrouping(filter.groupBy || 'day');
    const whereClause = this.buildWhereClause('container_operations', filter);

    const query = `
      WITH kpi_data AS (
        SELECT 
          ${timeColumn} as period,
          count() as total_operations,
          uniq(container_number) as unique_containers,
          avg(duration_seconds) / 3600 as avg_operation_hours
        FROM portvision360.container_operations
        WHERE ${whereClause}
        GROUP BY period
      )
      SELECT 
        period,
        unique_containers as throughput_teu,
        avg_operation_hours as avg_vessel_turnaround
      FROM kpi_data
      ORDER BY period DESC
    `;

    const result = await this.clickhouseService.query<TerminalKPIReportData>(query);
    return result.data;
  }

  // Вспомогательные методы для вычисления сводной информации
  private async calculateContainerOperationsSummary(filter: ReportFilter) {
    const whereClause = this.buildWhereClause('container_operations', filter);
    
    const query = `
      SELECT 
        count() as totalOperations,
        uniq(container_number) as totalContainers,
        avg(duration_seconds) as averageProcessingTime,
        countIf(status = 'completed') / count() * 100 as utilizationRate
      FROM portvision360.container_operations
      WHERE ${whereClause}
    `;

    const result = await this.clickhouseService.query(query);
    return result.data[0] || {};
  }

  private async calculateGateTransactionsSummary(filter: ReportFilter) {
    const whereClause = this.buildWhereClause('gate_transactions', filter);
    
    const query = `
      SELECT 
        count() as totalTransactions,
        avg(processing_time_seconds) as averageProcessingTime,
        uniq(truck_number) as totalTrucks,
        sum(gross_weight) as totalWeight
      FROM portvision360.gate_transactions
      WHERE ${whereClause}
    `;

    const result = await this.clickhouseService.query(query);
    return result.data[0] || {};
  }

  private async calculateEquipmentPerformanceSummary(filter: ReportFilter) {
    const whereClause = this.buildWhereClause('equipment_performance', filter);
    
    const query = `
      SELECT 
        avg(utilization_percent) as averageUtilization,
        avg(moves_per_hour) as averageMovesPerHour,
        sum(breakdown_count) as totalBreakdowns,
        sum(maintenance_hours) as totalMaintenanceHours
      FROM portvision360.equipment_performance
      WHERE ${whereClause}
    `;

    const result = await this.clickhouseService.query(query);
    return result.data[0] || {};
  }

  private async calculateFinancialSummary(filter: ReportFilter) {
    const whereClause = this.buildWhereClause('financial_transactions', filter, 'transaction_date');
    
    const query = `
      SELECT 
        sum(amount) as totalRevenue,
        count() as totalTransactions,
        avg(amount) as averageTransactionValue,
        uniq(client_id) as totalClients
      FROM portvision360.financial_transactions
      WHERE ${whereClause}
    `;

    const result = await this.clickhouseService.query(query);
    return result.data[0] || {};
  }

  private async calculateInventorySummary(filter: ReportFilter) {
    const whereClause = this.buildWhereClause('inventory_snapshots', filter, 'snapshot_date');
    
    const query = `
      SELECT 
        avg(container_count) as averageContainerCount,
        avg(utilization_percent) as averageUtilization,
        avg(dwell_time_avg) as averageDwellTime,
        uniq(location) as totalLocations
      FROM portvision360.inventory_snapshots
      WHERE ${whereClause}
    `;

    const result = await this.clickhouseService.query(query);
    return result.data[0] || {};
  }

  private async calculateProductivitySummary(filter: ReportFilter) {
    const whereClause = this.buildWhereClause('container_operations', filter);
    
    const query = `
      SELECT 
        count() as totalMoves,
        count() / dateDiff('hour', toDateTime('${filter.dateFrom.toISOString()}'), toDateTime('${filter.dateTo.toISOString()}')) as movesPerHour,
        countIf(operation_type LIKE '%vessel%') as vesselOperations,
        countIf(operation_type LIKE '%truck%') as truckOperations
      FROM portvision360.container_operations
      WHERE ${whereClause}
    `;

    const result = await this.clickhouseService.query(query);
    return result.data[0] || {};
  }

  private async calculateClientActivitySummary(filter: ReportFilter) {
    const whereClause = this.buildWhereClause('container_operations', filter);
    
    const query = `
      SELECT 
        uniq(client_id) as totalClients,
        count() as totalOperations,
        uniq(container_number) as totalContainers,
        avg(duration_seconds) as averageOperationTime
      FROM portvision360.container_operations
      WHERE ${whereClause} AND client_id IS NOT NULL
    `;

    const result = await this.clickhouseService.query(query);
    return result.data[0] || {};
  }

  private async calculateTerminalKPISummary(filter: ReportFilter) {
    const whereClause = this.buildWhereClause('container_operations', filter);
    
    const query = `
      SELECT 
        uniq(container_number) as throughputTeu,
        avg(duration_seconds) / 3600 as averageTurnaroundHours,
        count() as totalOperations,
        countIf(status = 'completed') / count() * 100 as successRate
      FROM portvision360.container_operations
      WHERE ${whereClause}
    `;

    const result = await this.clickhouseService.query(query);
    return result.data[0] || {};
  }

  // Вспомогательные методы
  private getTimeGrouping(period: string, dateColumn: string = 'timestamp'): string {
    switch (period) {
      case 'hour':
        return `toStartOfHour(${dateColumn})`;
      case 'day':
        return `toStartOfDay(${dateColumn})`;
      case 'week':
        return `toStartOfWeek(${dateColumn})`;
      case 'month':
        return `toStartOfMonth(${dateColumn})`;
      default:
        return `toStartOfDay(${dateColumn})`;
    }
  }

  private buildWhereClause(table: string, filter: ReportFilter, dateColumn: string = 'timestamp'): string {
    const conditions: string[] = [];

    // Временной диапазон
    const dateFrom = filter.dateFrom.toISOString().slice(0, 19).replace('T', ' ');
    const dateTo = filter.dateTo.toISOString().slice(0, 19).replace('T', ' ');
    conditions.push(`${dateColumn} BETWEEN '${dateFrom}' AND '${dateTo}'`);

    // Фильтры по полям
    if (filter.clientIds?.length) {
      conditions.push(`client_id IN (${filter.clientIds.map(id => `'${id}'`).join(', ')})`);
    }

    if (filter.containerTypes?.length) {
      conditions.push(`container_type IN (${filter.containerTypes.map(type => `'${type}'`).join(', ')})`);
    }

    if (filter.operationTypes?.length) {
      conditions.push(`operation_type IN (${filter.operationTypes.map(type => `'${type}'`).join(', ')})`);
    }

    if (filter.equipmentTypes?.length && table === 'equipment_performance') {
      conditions.push(`equipment_type IN (${filter.equipmentTypes.map(type => `'${type}'`).join(', ')})`);
    }

    if (filter.statuses?.length) {
      conditions.push(`status IN (${filter.statuses.map(status => `'${status}'`).join(', ')})`);
    }

    if (filter.locations?.length) {
      if (table === 'container_operations') {
        conditions.push(`(location_from IN (${filter.locations.map(loc => `'${loc}'`).join(', ')}) OR location_to IN (${filter.locations.map(loc => `'${loc}'`).join(', ')}))`);
      } else if (table === 'inventory_snapshots') {
        conditions.push(`location IN (${filter.locations.map(loc => `'${loc}'`).join(', ')})`);
      }
    }

    return conditions.join(' AND ');
  }

  private getReportColumns(type: ReportType): Array<{ name: string; type: string; description?: string }> {
    const commonColumns = [
      { name: 'period', type: 'DateTime', description: 'Период времени' },
    ];

    switch (type) {
      case ReportType.CONTAINER_OPERATIONS:
        return [
          ...commonColumns,
          { name: 'operation_type', type: 'String', description: 'Тип операции' },
          { name: 'operations_count', type: 'UInt64', description: 'Количество операций' },
          { name: 'unique_containers', type: 'UInt64', description: 'Уникальных контейнеров' },
          { name: 'avg_duration_seconds', type: 'Float64', description: 'Средняя длительность (сек)' },
          { name: 'total_teu', type: 'Float64', description: 'Общий TEU' },
          { name: 'success_rate', type: 'Float64', description: 'Процент успешности' },
        ];

      case ReportType.GATE_TRANSACTIONS:
        return [
          ...commonColumns,
          { name: 'gate_direction', type: 'String', description: 'Направление КПП' },
          { name: 'transactions_count', type: 'UInt64', description: 'Количество транзакций' },
          { name: 'avg_processing_time_seconds', type: 'Float64', description: 'Среднее время обработки (сек)' },
          { name: 'total_weight', type: 'UInt64', description: 'Общий вес' },
          { name: 'trucks_count', type: 'UInt64', description: 'Количество грузовиков' },
        ];

      case ReportType.EQUIPMENT_PERFORMANCE:
        return [
          ...commonColumns,
          { name: 'equipment_type', type: 'String', description: 'Тип оборудования' },
          { name: 'equipment_id', type: 'String', description: 'ID оборудования' },
          { name: 'utilization_percent', type: 'Float32', description: 'Процент использования' },
          { name: 'moves_per_hour', type: 'Float32', description: 'Движений в час' },
          { name: 'fuel_consumption', type: 'Float32', description: 'Расход топлива' },
          { name: 'breakdown_count', type: 'UInt16', description: 'Количество поломок' },
          { name: 'maintenance_hours', type: 'Float32', description: 'Часы обслуживания' },
          { name: 'efficiency_score', type: 'Float64', description: 'Показатель эффективности' },
        ];

      default:
        return commonColumns;
    }
  }

  // Автоматическая очистка кэша отчетов
  @Cron(CronExpression.EVERY_HOUR)
  private cleanupReportCache(): void {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    let removedCount = 0;

    for (const [reportId, report] of this.reportCache.entries()) {
      if (report.generatedAt < oneHourAgo) {
        this.reportCache.delete(reportId);
        removedCount++;
      }
    }

    if (removedCount > 0) {
      this.logger.log(`🧹 Очищено ${removedCount} отчетов из кэша`);
    }
  }

  // Получение статистики работы сервиса
  getServiceStats() {
    return {
      cachedReports: this.reportCache.size,
      memoryUsage: process.memoryUsage(),
      uptime: process.uptime(),
    };
  }
}