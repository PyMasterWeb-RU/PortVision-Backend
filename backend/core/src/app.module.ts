import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CacheModule } from '@nestjs/cache-manager';
import { ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { EventEmitterModule } from '@nestjs/event-emitter';
import * as redisStore from 'cache-manager-redis-store';

// Core modules
import { CommonModule } from './modules/common/common.module';
import { OrdersModule } from './modules/orders/orders.module';
import { GateModule } from './modules/gate/gate.module';
import { YardModule } from './modules/yard/yard.module';
import { MovesModule } from './modules/moves/moves.module';
import { PlanningModule } from './modules/planning/planning.module';
import { EquipmentModule } from './modules/equipment/equipment.module';
import { PersonnelModule } from './modules/personnel/personnel.module';
import { MrServicesModule } from './modules/mr-services/mr-services.module';
import { BillingModule } from './modules/billing/billing.module';
import { CrmModule } from './modules/crm/crm.module';
import { FilesModule } from './modules/files/files.module';
import { DigitalTwinModule } from './modules/digital-twin/digital-twin.module';

// Configuration
import { databaseConfig } from './config/database.config';
import { redisConfig } from './config/redis.config';
import { appConfig } from './config/app.config';
import { securityConfig } from './config/security.config';

// Health check
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, databaseConfig, redisConfig, securityConfig],
      envFilePath: ['.env.local', '.env'],
      cache: true,
    }),

    // Database
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get('database.host'),
        port: configService.get('database.port'),
        username: configService.get('database.username'),
        password: configService.get('database.password'),
        database: configService.get('database.name'),
        ssl: configService.get('database.ssl'),
        synchronize: configService.get('database.synchronize'),
        migrationsRun: configService.get('database.migrationsRun'),
        autoLoadEntities: true,
        migrations: ['dist/database/migrations/*.js'],
        logging: configService.get('NODE_ENV') === 'development',
        extra: {
          max: 20,
          idleTimeoutMillis: 30000,
          connectionTimeoutMillis: 2000,
        },
      }),
      inject: [ConfigService],
    }),

    // Redis Cache
    CacheModule.registerAsync({
      isGlobal: true,
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        store: redisStore,
        host: configService.get('redis.host'),
        port: configService.get('redis.port'),
        password: configService.get('redis.password'),
        db: configService.get('redis.db'),
        ttl: 300, // 5 minutes default TTL
      }),
      inject: [ConfigService],
    }),

    // Rate limiting
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        ttl: configService.get('security.rateLimitTtl', 60),
        limit: configService.get('security.rateLimitLimit', 100),
      }),
      inject: [ConfigService],
    }),

    // Scheduling
    ScheduleModule.forRoot(),

    // Event emitter
    EventEmitterModule.forRoot({
      wildcard: false,
      delimiter: '.',
      newListener: false,
      removeListener: false,
      maxListeners: 10,
      verboseMemoryLeak: false,
      ignoreErrors: false,
    }),

    // Business modules
    CommonModule,
    OrdersModule,
    GateModule,
    YardModule,
    MovesModule,
    PlanningModule,
    EquipmentModule,
    PersonnelModule,
    MrServicesModule,
    BillingModule,
    CrmModule,
    FilesModule,
    DigitalTwinModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}