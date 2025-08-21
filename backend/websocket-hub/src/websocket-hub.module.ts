import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { RedisModule } from '@nestjs-modules/ioredis';
import { JwtModule } from '@nestjs/jwt';
import { ScheduleModule } from '@nestjs/schedule';

// WebSocket Gateways
import { TerminalGateway } from './gateways/terminal.gateway';
import { OperationsGateway } from './gateways/operations.gateway';
import { EquipmentGateway } from './gateways/equipment.gateway';
import { NotificationsGateway } from './gateways/notifications.gateway';

// Services
import { WebSocketService } from './services/websocket.service';
import { NotificationService } from './services/notification.service';
import { SubscriptionService } from './services/subscription.service';
import { MetricsService } from './services/metrics.service';

// Controllers
import { WebSocketController } from './controllers/websocket.controller';
import { NotificationsController } from './controllers/notifications.controller';
import { MetricsController } from './controllers/metrics.controller';

// Entities
import { WebSocketConnection } from './entities/websocket-connection.entity';
import { Notification } from './entities/notification.entity';
import { Subscription } from './entities/subscription.entity';

// Guards
import { WsJwtGuard } from './guards/ws-jwt.guard';
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
      WebSocketConnection,
      Notification,
      Subscription,
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
  ],
  controllers: [
    WebSocketController,
    NotificationsController,
    MetricsController,
  ],
  providers: [
    // Gateways
    TerminalGateway,
    OperationsGateway,
    EquipmentGateway,
    NotificationsGateway,
    
    // Services
    WebSocketService,
    NotificationService,
    SubscriptionService,
    MetricsService,
    
    // Guards
    WsJwtGuard,
    JwtAuthGuard,
  ],
  exports: [
    WebSocketService,
    NotificationService,
    SubscriptionService,
    MetricsService,
  ],
})
export class WebSocketHubModule {}