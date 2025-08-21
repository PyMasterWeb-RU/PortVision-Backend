import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ClickHouseService } from './clickhouse.service';

export interface TableSchema {
  name: string;
  engine: string;
  columns: Array<{
    name: string;
    type: string;
    nullable: boolean;
    default?: string;
    comment?: string;
  }>;
  orderBy?: string[];
  partitionBy?: string;
  settings?: Record<string, any>;
}

@Injectable()
export class ClickHouseSchemaService implements OnModuleInit {
  private readonly logger = new Logger(ClickHouseSchemaService.name);

  constructor(private readonly clickhouseService: ClickHouseService) {}

  async onModuleInit() {
    await this.initializeSchema();
  }

  private async initializeSchema(): Promise<void> {
    this.logger.log('🏗️ Инициализация схемы ClickHouse...');

    try {
      // Создаем базу данных
      await this.clickhouseService.createDatabase('portvision360');

      // Создаем все необходимые таблицы
      await this.createAllTables();

      this.logger.log('✅ Схема ClickHouse инициализирована');
    } catch (error) {
      this.logger.error('❌ Ошибка инициализации схемы ClickHouse:', error.message);
      throw error;
    }
  }

  private async createAllTables(): Promise<void> {
    const tables = this.getTableSchemas();

    for (const table of tables) {
      await this.createTable(table);
    }
  }

  private async createTable(schema: TableSchema): Promise<void> {
    try {
      const sql = this.buildCreateTableSQL(schema);
      await this.clickhouseService.execute(sql);
      this.logger.log(`📋 Таблица ${schema.name} создана`);
    } catch (error) {
      if (!error.message.includes('already exists')) {
        this.logger.error(`❌ Ошибка создания таблицы ${schema.name}:`, error.message);
        throw error;
      }
    }
  }

  private buildCreateTableSQL(schema: TableSchema): string {
    const columns = schema.columns.map(col => {
      let colDef = `${col.name} ${col.type}`;
      if (col.nullable) colDef += ' Nullable(String)';
      if (col.default) colDef += ` DEFAULT ${col.default}`;
      if (col.comment) colDef += ` COMMENT '${col.comment}'`;
      return colDef;
    }).join(',\n  ');

    let sql = `CREATE TABLE IF NOT EXISTS portvision360.${schema.name} (\n  ${columns}\n)`;
    
    sql += ` ENGINE = ${schema.engine}`;

    if (schema.partitionBy) {
      sql += ` PARTITION BY ${schema.partitionBy}`;
    }

    if (schema.orderBy && schema.orderBy.length > 0) {
      sql += ` ORDER BY (${schema.orderBy.join(', ')})`;
    }

    if (schema.settings) {
      const settings = Object.entries(schema.settings)
        .map(([key, value]) => `${key} = ${value}`)
        .join(', ');
      sql += ` SETTINGS ${settings}`;
    }

    return sql;
  }

  private getTableSchemas(): TableSchema[] {
    return [
      // Операции контейнеров
      {
        name: 'container_operations',
        engine: 'MergeTree()',
        partitionBy: 'toYYYYMM(timestamp)',
        orderBy: ['timestamp', 'container_number'],
        columns: [
          { name: 'operation_id', type: 'String', nullable: false, comment: 'Уникальный ID операции' },
          { name: 'timestamp', type: 'DateTime', nullable: false, comment: 'Время операции' },
          { name: 'operation_type', type: 'LowCardinality(String)', nullable: false, comment: 'Тип операции' },
          { name: 'container_number', type: 'String', nullable: false, comment: 'Номер контейнера' },
          { name: 'container_type', type: 'LowCardinality(String)', nullable: true, comment: 'Тип контейнера' },
          { name: 'container_size', type: 'UInt8', nullable: true, comment: 'Размер контейнера' },
          { name: 'vessel_name', type: 'String', nullable: true, comment: 'Название судна' },
          { name: 'voyage', type: 'String', nullable: true, comment: 'Номер рейса' },
          { name: 'operator_id', type: 'String', nullable: true, comment: 'ID оператора' },
          { name: 'equipment_id', type: 'String', nullable: true, comment: 'ID оборудования' },
          { name: 'location_from', type: 'String', nullable: true, comment: 'Локация источник' },
          { name: 'location_to', type: 'String', nullable: true, comment: 'Локация назначение' },
          { name: 'duration_seconds', type: 'UInt32', nullable: true, comment: 'Длительность в секундах' },
          { name: 'client_id', type: 'String', nullable: true, comment: 'ID клиента' },
          { name: 'order_id', type: 'String', nullable: true, comment: 'ID заявки' },
          { name: 'status', type: 'LowCardinality(String)', nullable: false, comment: 'Статус операции' },
          { name: 'created_at', type: 'DateTime', nullable: false, default: 'now()', comment: 'Время создания записи' },
        ],
      },

      // КПП транзакции
      {
        name: 'gate_transactions',
        engine: 'MergeTree()',
        partitionBy: 'toYYYYMM(timestamp)',
        orderBy: ['timestamp', 'truck_number'],
        columns: [
          { name: 'transaction_id', type: 'String', nullable: false, comment: 'Уникальный ID транзакции' },
          { name: 'timestamp', type: 'DateTime', nullable: false, comment: 'Время транзакции' },
          { name: 'gate_direction', type: 'LowCardinality(String)', nullable: false, comment: 'Направление (in/out)' },
          { name: 'truck_number', type: 'String', nullable: false, comment: 'Номер грузовика' },
          { name: 'driver_name', type: 'String', nullable: true, comment: 'Имя водителя' },
          { name: 'driver_license', type: 'String', nullable: true, comment: 'Права водителя' },
          { name: 'container_number', type: 'String', nullable: true, comment: 'Номер контейнера' },
          { name: 'gross_weight', type: 'UInt32', nullable: true, comment: 'Общий вес' },
          { name: 'net_weight', type: 'UInt32', nullable: true, comment: 'Чистый вес' },
          { name: 'appointment_id', type: 'String', nullable: true, comment: 'ID записи на время' },
          { name: 'processing_time_seconds', type: 'UInt32', nullable: true, comment: 'Время обработки' },
          { name: 'operator_id', type: 'String', nullable: true, comment: 'ID оператора КПП' },
          { name: 'status', type: 'LowCardinality(String)', nullable: false, comment: 'Статус транзакции' },
          { name: 'created_at', type: 'DateTime', nullable: false, default: 'now()', comment: 'Время создания записи' },
        ],
      },

      // Производительность оборудования
      {
        name: 'equipment_performance',
        engine: 'MergeTree()',
        partitionBy: 'toYYYYMM(timestamp)',
        orderBy: ['timestamp', 'equipment_id'],
        columns: [
          { name: 'equipment_id', type: 'String', nullable: false, comment: 'ID оборудования' },
          { name: 'timestamp', type: 'DateTime', nullable: false, comment: 'Время измерения' },
          { name: 'equipment_type', type: 'LowCardinality(String)', nullable: false, comment: 'Тип оборудования' },
          { name: 'status', type: 'LowCardinality(String)', nullable: false, comment: 'Статус оборудования' },
          { name: 'utilization_percent', type: 'Float32', nullable: true, comment: 'Процент использования' },
          { name: 'moves_per_hour', type: 'Float32', nullable: true, comment: 'Движений в час' },
          { name: 'fuel_consumption', type: 'Float32', nullable: true, comment: 'Расход топлива' },
          { name: 'maintenance_hours', type: 'Float32', nullable: true, comment: 'Часы обслуживания' },
          { name: 'breakdown_count', type: 'UInt16', nullable: true, comment: 'Количество поломок' },
          { name: 'operator_id', type: 'String', nullable: true, comment: 'ID оператора' },
          { name: 'location', type: 'String', nullable: true, comment: 'Локация оборудования' },
          { name: 'created_at', type: 'DateTime', nullable: false, default: 'now()', comment: 'Время создания записи' },
        ],
      },

      // Метрики терминала
      {
        name: 'terminal_metrics',
        engine: 'MergeTree()',
        partitionBy: 'toYYYYMM(timestamp)',
        orderBy: ['timestamp', 'metric_type'],
        columns: [
          { name: 'metric_id', type: 'String', nullable: false, comment: 'ID метрики' },
          { name: 'timestamp', type: 'DateTime', nullable: false, comment: 'Время измерения' },
          { name: 'metric_type', type: 'LowCardinality(String)', nullable: false, comment: 'Тип метрики' },
          { name: 'metric_name', type: 'String', nullable: false, comment: 'Название метрики' },
          { name: 'value', type: 'Float64', nullable: false, comment: 'Значение метрики' },
          { name: 'unit', type: 'LowCardinality(String)', nullable: true, comment: 'Единица измерения' },
          { name: 'tags', type: 'Map(String, String)', nullable: true, comment: 'Дополнительные теги' },
          { name: 'source_service', type: 'LowCardinality(String)', nullable: true, comment: 'Источник данных' },
          { name: 'created_at', type: 'DateTime', nullable: false, default: 'now()', comment: 'Время создания записи' },
        ],
      },

      // Финансовые данные
      {
        name: 'financial_transactions',
        engine: 'MergeTree()',
        partitionBy: 'toYYYYMM(transaction_date)',
        orderBy: ['transaction_date', 'client_id'],
        columns: [
          { name: 'transaction_id', type: 'String', nullable: false, comment: 'ID транзакции' },
          { name: 'transaction_date', type: 'DateTime', nullable: false, comment: 'Дата транзакции' },
          { name: 'transaction_type', type: 'LowCardinality(String)', nullable: false, comment: 'Тип транзакции' },
          { name: 'client_id', type: 'String', nullable: false, comment: 'ID клиента' },
          { name: 'service_type', type: 'LowCardinality(String)', nullable: false, comment: 'Тип услуги' },
          { name: 'amount', type: 'Decimal(15,2)', nullable: false, comment: 'Сумма' },
          { name: 'currency', type: 'LowCardinality(String)', nullable: false, comment: 'Валюта' },
          { name: 'container_count', type: 'UInt32', nullable: true, comment: 'Количество контейнеров' },
          { name: 'invoice_id', type: 'String', nullable: true, comment: 'ID счета' },
          { name: 'payment_status', type: 'LowCardinality(String)', nullable: false, comment: 'Статус оплаты' },
          { name: 'created_at', type: 'DateTime', nullable: false, default: 'now()', comment: 'Время создания записи' },
        ],
      },

      // Запасы и инвентаризация
      {
        name: 'inventory_snapshots',
        engine: 'MergeTree()',
        partitionBy: 'toYYYYMM(snapshot_date)',
        orderBy: ['snapshot_date', 'location'],
        columns: [
          { name: 'snapshot_id', type: 'String', nullable: false, comment: 'ID снимка' },
          { name: 'snapshot_date', type: 'DateTime', nullable: false, comment: 'Дата снимка' },
          { name: 'location', type: 'String', nullable: false, comment: 'Локация' },
          { name: 'location_type', type: 'LowCardinality(String)', nullable: false, comment: 'Тип локации' },
          { name: 'container_count', type: 'UInt32', nullable: false, comment: 'Количество контейнеров' },
          { name: 'teu_count', type: 'Float32', nullable: false, comment: 'TEU количество' },
          { name: 'utilization_percent', type: 'Float32', nullable: true, comment: 'Процент заполнения' },
          { name: 'container_types', type: 'Map(String, UInt32)', nullable: true, comment: 'Типы контейнеров' },
          { name: 'container_sizes', type: 'Map(String, UInt32)', nullable: true, comment: 'Размеры контейнеров' },
          { name: 'dwell_time_avg', type: 'Float32', nullable: true, comment: 'Среднее время хранения' },
          { name: 'created_at', type: 'DateTime', nullable: false, default: 'now()', comment: 'Время создания записи' },
        ],
      },

      // События системы
      {
        name: 'system_events',
        engine: 'MergeTree()',
        partitionBy: 'toYYYYMM(timestamp)',
        orderBy: ['timestamp', 'event_type'],
        columns: [
          { name: 'event_id', type: 'String', nullable: false, comment: 'ID события' },
          { name: 'timestamp', type: 'DateTime', nullable: false, comment: 'Время события' },
          { name: 'event_type', type: 'LowCardinality(String)', nullable: false, comment: 'Тип события' },
          { name: 'event_source', type: 'LowCardinality(String)', nullable: false, comment: 'Источник события' },
          { name: 'severity', type: 'LowCardinality(String)', nullable: false, comment: 'Уровень важности' },
          { name: 'message', type: 'String', nullable: false, comment: 'Сообщение' },
          { name: 'details', type: 'String', nullable: true, comment: 'Детали события (JSON)' },
          { name: 'user_id', type: 'String', nullable: true, comment: 'ID пользователя' },
          { name: 'session_id', type: 'String', nullable: true, comment: 'ID сессии' },
          { name: 'ip_address', type: 'IPv4', nullable: true, comment: 'IP адрес' },
          { name: 'created_at', type: 'DateTime', nullable: false, default: 'now()', comment: 'Время создания записи' },
        ],
      },

      // Агрегированные данные по дням
      {
        name: 'daily_aggregates',
        engine: 'AggregatingMergeTree()',
        partitionBy: 'toYYYYMM(date)',
        orderBy: ['date', 'metric_type'],
        columns: [
          { name: 'date', type: 'Date', nullable: false, comment: 'Дата' },
          { name: 'metric_type', type: 'LowCardinality(String)', nullable: false, comment: 'Тип метрики' },
          { name: 'container_operations_count', type: 'AggregateFunction(count, UInt64)', nullable: true },
          { name: 'teu_moved', type: 'AggregateFunction(sum, Float32)', nullable: true },
          { name: 'gate_transactions_count', type: 'AggregateFunction(count, UInt64)', nullable: true },
          { name: 'revenue_total', type: 'AggregateFunction(sum, Decimal(15,2))', nullable: true },
          { name: 'equipment_utilization_avg', type: 'AggregateFunction(avg, Float32)', nullable: true },
          { name: 'dwell_time_avg', type: 'AggregateFunction(avg, Float32)', nullable: true },
          { name: 'created_at', type: 'DateTime', nullable: false, default: 'now()', comment: 'Время создания записи' },
        ],
      },
    ];
  }

  // Методы для работы с конкретными таблицами
  async insertContainerOperations(operations: any[]): Promise<void> {
    await this.clickhouseService.insert('container_operations', operations);
  }

  async insertGateTransactions(transactions: any[]): Promise<void> {
    await this.clickhouseService.insert('gate_transactions', transactions);
  }

  async insertEquipmentPerformance(performance: any[]): Promise<void> {
    await this.clickhouseService.insert('equipment_performance', performance);
  }

  async insertTerminalMetrics(metrics: any[]): Promise<void> {
    await this.clickhouseService.insert('terminal_metrics', metrics);
  }

  async insertFinancialTransactions(transactions: any[]): Promise<void> {
    await this.clickhouseService.insert('financial_transactions', transactions);
  }

  async insertInventorySnapshots(snapshots: any[]): Promise<void> {
    await this.clickhouseService.insert('inventory_snapshots', snapshots);
  }

  async insertSystemEvents(events: any[]): Promise<void> {
    await this.clickhouseService.insert('system_events', events);
  }

  // Методы для создания материализованных представлений
  async createMaterializedViews(): Promise<void> {
    const views = [
      // Ежечасная статистика операций
      {
        name: 'hourly_operations_mv',
        query: `
          CREATE MATERIALIZED VIEW IF NOT EXISTS portvision360.hourly_operations_mv
          ENGINE = SummingMergeTree()
          PARTITION BY toYYYYMM(hour)
          ORDER BY (hour, operation_type)
          AS SELECT
            toStartOfHour(timestamp) as hour,
            operation_type,
            count() as operations_count,
            uniq(container_number) as unique_containers,
            avg(duration_seconds) as avg_duration
          FROM portvision360.container_operations
          GROUP BY hour, operation_type
        `,
      },

      // Дневная статистика по клиентам
      {
        name: 'daily_client_stats_mv',
        query: `
          CREATE MATERIALIZED VIEW IF NOT EXISTS portvision360.daily_client_stats_mv
          ENGINE = SummingMergeTree()
          PARTITION BY toYYYYMM(date)
          ORDER BY (date, client_id)
          AS SELECT
            toDate(transaction_date) as date,
            client_id,
            count() as transactions_count,
            sum(amount) as total_amount,
            sum(container_count) as total_containers
          FROM portvision360.financial_transactions
          GROUP BY date, client_id
        `,
      },
    ];

    for (const view of views) {
      try {
        await this.clickhouseService.execute(view.query);
        this.logger.log(`📊 Материализованное представление ${view.name} создано`);
      } catch (error) {
        if (!error.message.includes('already exists')) {
          this.logger.error(`❌ Ошибка создания представления ${view.name}:`, error.message);
        }
      }
    }
  }

  // Утилиты для схемы
  async getSchemaInfo(): Promise<{
    database: string;
    tables: string[];
    totalSize: string;
  }> {
    const tables = await this.clickhouseService.getTables();
    
    // Получаем общий размер всех таблиц
    const sizeResult = await this.clickhouseService.query(`
      SELECT formatReadableSize(sum(bytes_on_disk)) as total_size
      FROM system.parts
      WHERE database = 'portvision360' AND active = 1
    `);

    return {
      database: 'portvision360',
      tables,
      totalSize: sizeResult.data[0]?.total_size || '0 B',
    };
  }

  async optimizeAllTables(): Promise<void> {
    const tables = await this.clickhouseService.getTables();
    
    for (const table of tables) {
      try {
        await this.clickhouseService.optimizeTable(table);
      } catch (error) {
        this.logger.error(`❌ Ошибка оптимизации таблицы ${table}:`, error.message);
      }
    }
  }
}