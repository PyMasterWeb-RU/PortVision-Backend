import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { CacheModule } from '@nestjs/cache-manager';
import { BullModule } from '@nestjs/bull';
import * as redisStore from 'cache-manager-redis-store';

// ClickHouse
import { ClickHouseModule } from './clickhouse/clickhouse.module';

// Reports
import { ReportsModule } from './reports/reports.module';
import { DashboardsModule } from './dashboards/dashboards.module';
import { KpiModule } from './kpi/kpi.module';
import { ExportModule } from './export/export.module';

// Services
import { DataAggregationModule } from './data-aggregation/data-aggregation.module';
import { RealtimeModule } from './realtime/realtime.module';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),

    // Event handling
    EventEmitterModule.forRoot({
      wildcard: false,
      delimiter: '.',
      newListener: false,
      removeListener: false,
      maxListeners: 20,
      verboseMemoryLeak: false,
      ignoreErrors: false,
    }),

    // Scheduling
    ScheduleModule.forRoot(),

    // Caching
    CacheModule.register({
      isGlobal: true,
      store: redisStore,
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT) || 6379,
      ttl: 300, // 5 minutes default
    }),

    // Queue management
    BullModule.forRoot({
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT) || 6379,
      },
    }),

    // ClickHouse
    ClickHouseModule,

    // Feature modules
    ReportsModule,
    DashboardsModule,
    KpiModule,
    ExportModule,
    DataAggregationModule,
    RealtimeModule,
  ],
})
export class ReportingModule {}