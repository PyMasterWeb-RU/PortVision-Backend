import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventEmitterModule } from '@nestjs/event-emitter';

// Core modules
import { ReportsModule } from './reports/reports.module';
import { DashboardsModule } from './dashboards/dashboards.module';
import { KpiModule } from './kpi/kpi.module';
import { ExportModule } from './export/export.module';
import { AggregationModule } from './aggregation/aggregation.module';
import { RealtimeModule } from './realtime/realtime.module';

// Shared modules
import { ClickHouseModule } from './clickhouse/clickhouse.module';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '.env.local'],
    }),

    // Database
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.POSTGRES_HOST || 'localhost',
      port: parseInt(process.env.POSTGRES_PORT) || 5432,
      username: process.env.POSTGRES_USERNAME || 'postgres',
      password: process.env.POSTGRES_PASSWORD || 'postgres',
      database: process.env.POSTGRES_DATABASE || 'portvision_reporting',
      schema: process.env.POSTGRES_SCHEMA || 'reporting_schema',
      autoLoadEntities: true,
      synchronize: process.env.NODE_ENV === 'development',
      logging: process.env.NODE_ENV === 'development',
    }),

    // Event system
    EventEmitterModule.forRoot({
      global: true,
      wildcard: true,
      delimiter: '.',
      maxListeners: 50,
    }),

    // Shared modules
    ClickHouseModule,

    // Business modules
    ReportsModule,
    DashboardsModule,
    KpiModule,
    ExportModule,
    AggregationModule,
    RealtimeModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}