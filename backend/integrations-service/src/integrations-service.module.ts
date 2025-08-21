import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { RedisModule } from '@nestjs-modules/ioredis';
import { JwtModule } from '@nestjs/jwt';
import { ScheduleModule } from '@nestjs/schedule';
import { HttpModule } from '@nestjs/axios';

// Entities
import { IntegrationEndpoint } from './entities/integration-endpoint.entity';

// Core Services
import { IntegrationEndpointService } from './services/integration-endpoint.service';
import { DataTransformationService } from './services/data-transformation.service';
import { RoutingService } from './services/routing.service';
import { MetricsService } from './services/metrics.service';

// Integration Adapters
import { OcrAnprAdapter } from './adapters/ocr-anpr.adapter';
import { GpsMqttAdapter } from './adapters/gps-mqtt.adapter';
import { RfidAdapter } from './adapters/rfid.adapter';
import { EdiGatewayAdapter } from './adapters/edi-gateway.adapter';
import { OneCAdapter } from './adapters/one-c.adapter';
import { WeighbridgeAdapter } from './adapters/weighbridge.adapter';
import { CameraSystemAdapter } from './adapters/camera-system.adapter';
import { FileWatcherAdapter } from './adapters/file-watcher.adapter';
import { CustomApiAdapter } from './adapters/custom-api.adapter';
import { DatabaseAdapter } from './adapters/database.adapter';

// Processors
import { OcrProcessor } from './processors/ocr.processor';
import { MqttProcessor } from './processors/mqtt.processor';
import { RfidProcessor } from './processors/rfid.processor';
import { EdiProcessor } from './processors/edi.processor';
import { OneCProcessor } from './processors/one-c.processor';
import { FileProcessor } from './processors/file.processor';
import { ApiProcessor } from './processors/api.processor';
import { DatabaseProcessor } from './processors/database.processor';

// Controllers
import { IntegrationEndpointsController } from './controllers/integration-endpoints.controller';
import { OcrAnprController } from './controllers/ocr-anpr.controller';
import { GpsMqttController } from './controllers/gps-mqtt.controller';
import { RfidController } from './controllers/rfid.controller';
import { EdiController } from './controllers/edi.controller';
import { OneCController } from './controllers/one-c.controller';
import { FileWatcherController } from './controllers/file-watcher.controller';
import { MetricsController } from './controllers/metrics.controller';

// Guards
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get('DB_HOST', 'localhost'),
        port: configService.get('DB_PORT', 5432),
        username: configService.get('DB_USERNAME', 'postgres'),
        password: configService.get('DB_PASSWORD', 'postgres'),
        database: configService.get('DB_NAME', 'portvision360'),
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        synchronize: configService.get('NODE_ENV') === 'development',
        logging: configService.get('DB_LOGGING', false),
        ssl: configService.get('DB_SSL') === 'true' ? { rejectUnauthorized: false } : false,
      }),
      inject: [ConfigService],
    }),
    TypeOrmModule.forFeature([
      IntegrationEndpoint,
    ]),
    RedisModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'single',
        url: configService.get('REDIS_URL', 'redis://localhost:6379'),
      }),
      inject: [ConfigService],
    }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get('JWT_SECRET', 'your-secret-key'),
        signOptions: { 
          expiresIn: configService.get('JWT_EXPIRES_IN', '24h'),
        },
      }),
      inject: [ConfigService],
    }),
    EventEmitterModule.forRoot({
      wildcard: true,
      delimiter: '.',
      newListener: false,
      removeListener: false,
      maxListeners: 20,
      verboseMemoryLeak: true,
      ignoreErrors: false,
    }),
    ScheduleModule.forRoot(),
    HttpModule.register({
      timeout: 10000,
      maxRedirects: 5,
    }),
  ],
  controllers: [
    IntegrationEndpointsController,
    OcrAnprController,
    GpsMqttController,
    RfidController,
    EdiController,
    OneCController,
    FileWatcherController,
    MetricsController,
  ],
  providers: [
    // Core Services
    IntegrationEndpointService,
    DataTransformationService,
    RoutingService,
    MetricsService,
    
    // Integration Adapters
    OcrAnprAdapter,
    GpsMqttAdapter,
    RfidAdapter,
    EdiGatewayAdapter,
    OneCAdapter,
    WeighbridgeAdapter,
    CameraSystemAdapter,
    FileWatcherAdapter,
    CustomApiAdapter,
    DatabaseAdapter,
    
    // Processors
    OcrProcessor,
    MqttProcessor,
    RfidProcessor,
    EdiProcessor,
    OneCProcessor,
    FileProcessor,
    ApiProcessor,
    DatabaseProcessor,
    
    // Guards
    JwtAuthGuard,
  ],
  exports: [
    IntegrationEndpointService,
    DataTransformationService,
    RoutingService,
    MetricsService,
  ],
})
export class IntegrationsServiceModule {}