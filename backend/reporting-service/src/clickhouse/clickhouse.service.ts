import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, ClickHouseClient, ResultSet } from '@clickhouse/client';

export interface ClickHouseConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  compression: boolean;
  max_open_connections: number;
  request_timeout: number;
  session_timeout: number;
}

export interface QueryOptions {
  format?: 'JSON' | 'JSONEachRow' | 'CSV' | 'TabSeparated';
  parameters?: Record<string, any>;
  settings?: Record<string, any>;
  timeout?: number;
}

export interface QueryResult<T = any> {
  data: T[];
  rows: number;
  statistics?: {
    elapsed: number;
    rows_read: number;
    bytes_read: number;
  };
  meta?: Array<{
    name: string;
    type: string;
  }>;
}

@Injectable()
export class ClickHouseService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ClickHouseService.name);
  private client: ClickHouseClient;
  private config: ClickHouseConfig;

  constructor(private readonly configService: ConfigService) {
    this.config = {
      host: this.configService.get('CLICKHOUSE_HOST', 'localhost'),
      port: this.configService.get('CLICKHOUSE_PORT', 8123),
      database: this.configService.get('CLICKHOUSE_DATABASE', 'portvision360'),
      username: this.configService.get('CLICKHOUSE_USERNAME', 'default'),
      password: this.configService.get('CLICKHOUSE_PASSWORD', ''),
      compression: this.configService.get('CLICKHOUSE_COMPRESSION', true),
      max_open_connections: this.configService.get('CLICKHOUSE_MAX_CONNECTIONS', 10),
      request_timeout: this.configService.get('CLICKHOUSE_REQUEST_TIMEOUT', 30000),
      session_timeout: this.configService.get('CLICKHOUSE_SESSION_TIMEOUT', 300000),
    };
  }

  async onModuleInit() {
    await this.connect();
  }

  async onModuleDestroy() {
    await this.disconnect();
  }

  private async connect(): Promise<void> {
    try {
      this.client = createClient({
        host: `http://${this.config.host}:${this.config.port}`,
        database: this.config.database,
        username: this.config.username,
        password: this.config.password,
        compression: {
          response: this.config.compression,
          request: this.config.compression,
        },
        max_open_connections: this.config.max_open_connections,
        request_timeout: this.config.request_timeout,
        session_timeout: this.config.session_timeout,
      });

      // Test connection
      await this.client.ping();
      
      this.logger.log(`✅ ClickHouse подключение установлено: ${this.config.host}:${this.config.port}/${this.config.database}`);
    } catch (error) {
      this.logger.error('❌ Ошибка подключения к ClickHouse:', error.message);
      throw error;
    }
  }

  private async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.close();
      this.logger.log('🔌 ClickHouse соединение закрыто');
    }
  }

  async query<T = any>(
    sql: string, 
    options: QueryOptions = {}
  ): Promise<QueryResult<T>> {
    const startTime = Date.now();
    
    try {
      const format = options.format || 'JSON';
      const queryWithFormat = sql.endsWith(';') 
        ? sql.slice(0, -1) + ` FORMAT ${format};`
        : sql + ` FORMAT ${format}`;

      this.logger.debug(`🔍 ClickHouse запрос: ${sql}`);

      const resultSet: ResultSet<T> = await this.client.query({
        query: queryWithFormat,
        query_params: options.parameters,
        clickhouse_settings: options.settings,
        abort_signal: options.timeout ? 
          AbortSignal.timeout(options.timeout) : undefined,
      });

      const data = await resultSet.json<T>();
      const elapsed = Date.now() - startTime;

      this.logger.debug(`⚡ Запрос выполнен за ${elapsed}ms, строк: ${data.rows}`);

      return {
        data: data.data,
        rows: data.rows,
        statistics: {
          elapsed,
          rows_read: data.statistics?.rows_read || 0,
          bytes_read: data.statistics?.bytes_read || 0,
        },
        meta: data.meta,
      };

    } catch (error) {
      const elapsed = Date.now() - startTime;
      this.logger.error(`❌ Ошибка выполнения запроса (${elapsed}ms):`, error.message);
      throw error;
    }
  }

  async insert<T = any>(
    table: string,
    data: T[],
    options: { 
      database?: string;
      format?: 'JSONEachRow' | 'CSV' | 'TabSeparated';
      settings?: Record<string, any>;
    } = {}
  ): Promise<void> {
    const startTime = Date.now();
    
    try {
      const database = options.database || this.config.database;
      const format = options.format || 'JSONEachRow';
      
      this.logger.debug(`📝 ClickHouse вставка: ${data.length} записей в ${table}`);

      await this.client.insert({
        table: `${database}.${table}`,
        values: data,
        format,
        clickhouse_settings: options.settings,
      });

      const elapsed = Date.now() - startTime;
      this.logger.debug(`✅ Вставка выполнена за ${elapsed}ms`);

    } catch (error) {
      const elapsed = Date.now() - startTime;
      this.logger.error(`❌ Ошибка вставки данных (${elapsed}ms):`, error.message);
      throw error;
    }
  }

  async execute(sql: string, options: QueryOptions = {}): Promise<void> {
    const startTime = Date.now();
    
    try {
      this.logger.debug(`⚙️ ClickHouse выполнение: ${sql}`);

      await this.client.exec({
        query: sql,
        query_params: options.parameters,
        clickhouse_settings: options.settings,
        abort_signal: options.timeout ? 
          AbortSignal.timeout(options.timeout) : undefined,
      });

      const elapsed = Date.now() - startTime;
      this.logger.debug(`✅ Команда выполнена за ${elapsed}ms`);

    } catch (error) {
      const elapsed = Date.now() - startTime;
      this.logger.error(`❌ Ошибка выполнения команды (${elapsed}ms):`, error.message);
      throw error;
    }
  }

  async ping(): Promise<boolean> {
    try {
      await this.client.ping();
      return true;
    } catch (error) {
      this.logger.error('❌ ClickHouse ping неудачен:', error.message);
      return false;
    }
  }

  async getServerInfo(): Promise<any> {
    try {
      const result = await this.query('SELECT version() as version, uptime() as uptime');
      return result.data[0];
    } catch (error) {
      this.logger.error('❌ Ошибка получения информации о сервере:', error.message);
      throw error;
    }
  }

  async getDatabases(): Promise<string[]> {
    try {
      const result = await this.query('SHOW DATABASES');
      return result.data.map((row: any) => row.name);
    } catch (error) {
      this.logger.error('❌ Ошибка получения списка баз данных:', error.message);
      throw error;
    }
  }

  async getTables(database?: string): Promise<string[]> {
    try {
      const db = database || this.config.database;
      const result = await this.query(`SHOW TABLES FROM ${db}`);
      return result.data.map((row: any) => row.name);
    } catch (error) {
      this.logger.error('❌ Ошибка получения списка таблиц:', error.message);
      throw error;
    }
  }

  async getTableSchema(table: string, database?: string): Promise<any[]> {
    try {
      const db = database || this.config.database;
      const result = await this.query(`DESCRIBE TABLE ${db}.${table}`);
      return result.data;
    } catch (error) {
      this.logger.error(`❌ Ошибка получения схемы таблицы ${table}:`, error.message);
      throw error;
    }
  }

  async optimizeTable(table: string, database?: string): Promise<void> {
    try {
      const db = database || this.config.database;
      await this.execute(`OPTIMIZE TABLE ${db}.${table}`);
      this.logger.log(`🔄 Таблица ${table} оптимизирована`);
    } catch (error) {
      this.logger.error(`❌ Ошибка оптимизации таблицы ${table}:`, error.message);
      throw error;
    }
  }

  async truncateTable(table: string, database?: string): Promise<void> {
    try {
      const db = database || this.config.database;
      await this.execute(`TRUNCATE TABLE ${db}.${table}`);
      this.logger.log(`🗑️ Таблица ${table} очищена`);
    } catch (error) {
      this.logger.error(`❌ Ошибка очистки таблицы ${table}:`, error.message);
      throw error;
    }
  }

  async dropTable(table: string, database?: string): Promise<void> {
    try {
      const db = database || this.config.database;
      await this.execute(`DROP TABLE IF EXISTS ${db}.${table}`);
      this.logger.log(`🗑️ Таблица ${table} удалена`);
    } catch (error) {
      this.logger.error(`❌ Ошибка удаления таблицы ${table}:`, error.message);
      throw error;
    }
  }

  async createDatabase(database: string): Promise<void> {
    try {
      await this.execute(`CREATE DATABASE IF NOT EXISTS ${database}`);
      this.logger.log(`📁 База данных ${database} создана`);
    } catch (error) {
      this.logger.error(`❌ Ошибка создания базы данных ${database}:`, error.message);
      throw error;
    }
  }

  async getTableSize(table: string, database?: string): Promise<{
    rows: number;
    bytes: number;
    compressed_bytes: number;
  }> {
    try {
      const db = database || this.config.database;
      const result = await this.query(`
        SELECT 
          sum(rows) as rows,
          sum(bytes_on_disk) as bytes,
          sum(data_compressed_bytes) as compressed_bytes
        FROM system.parts 
        WHERE database = '${db}' AND table = '${table}' AND active = 1
      `);
      
      return result.data[0] || { rows: 0, bytes: 0, compressed_bytes: 0 };
    } catch (error) {
      this.logger.error(`❌ Ошибка получения размера таблицы ${table}:`, error.message);
      throw error;
    }
  }

  async getQueryStats(): Promise<{
    total_queries: number;
    running_queries: number;
    failed_queries: number;
  }> {
    try {
      const result = await this.query(`
        SELECT 
          count() as total_queries,
          countIf(query_duration_ms = 0) as running_queries,
          countIf(exception != '') as failed_queries
        FROM system.query_log
        WHERE event_date = today()
      `);
      
      return result.data[0] || { total_queries: 0, running_queries: 0, failed_queries: 0 };
    } catch (error) {
      this.logger.error('❌ Ошибка получения статистики запросов:', error.message);
      throw error;
    }
  }

  // Утилиты для построения запросов
  buildTimeRangeFilter(
    dateColumn: string, 
    startDate: Date, 
    endDate: Date
  ): string {
    const start = startDate.toISOString().slice(0, 19).replace('T', ' ');
    const end = endDate.toISOString().slice(0, 19).replace('T', ' ');
    return `${dateColumn} BETWEEN '${start}' AND '${end}'`;
  }

  buildAggregationQuery(
    table: string,
    aggregations: Array<{
      field: string;
      function: 'count' | 'sum' | 'avg' | 'min' | 'max';
      alias?: string;
    }>,
    groupBy?: string[],
    orderBy?: string[],
    limit?: number
  ): string {
    const selectClauses = aggregations.map(agg => {
      const alias = agg.alias || `${agg.function}_${agg.field}`;
      return `${agg.function}(${agg.field}) as ${alias}`;
    });

    if (groupBy && groupBy.length > 0) {
      selectClauses.unshift(...groupBy);
    }

    let query = `SELECT ${selectClauses.join(', ')} FROM ${table}`;

    if (groupBy && groupBy.length > 0) {
      query += ` GROUP BY ${groupBy.join(', ')}`;
    }

    if (orderBy && orderBy.length > 0) {
      query += ` ORDER BY ${orderBy.join(', ')}`;
    }

    if (limit) {
      query += ` LIMIT ${limit}`;
    }

    return query;
  }

  formatTimeInterval(interval: 'hour' | 'day' | 'week' | 'month'): string {
    switch (interval) {
      case 'hour':
        return 'toStartOfHour(timestamp)';
      case 'day':
        return 'toStartOfDay(timestamp)';
      case 'week':
        return 'toStartOfWeek(timestamp)';
      case 'month':
        return 'toStartOfMonth(timestamp)';
      default:
        return 'toStartOfDay(timestamp)';
    }
  }

  getClient(): ClickHouseClient {
    return this.client;
  }
}