import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { WebSocketHubModule } from './websocket-hub.module';

async function bootstrap() {
  const logger = new Logger('WebSocketHubBootstrap');
  
  const app = await NestFactory.create(WebSocketHubModule, {
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
  });
  
  const configService = app.get(ConfigService);

  // Глобальные middleware и pipes
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    disableErrorMessages: false,
    transformOptions: {
      enableImplicitConversion: true,
    },
  }));

  app.setGlobalPrefix('api');

  // CORS для WebSocket и HTTP
  app.enableCors({
    origin: process.env.NODE_ENV === 'production' 
      ? configService.get('CORS_ORIGINS', '').split(',').filter(Boolean)
      : ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:5173'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'X-Requested-With'],
    credentials: true,
  });

  // Socket.IO адаптер
  app.useWebSocketAdapter(new IoAdapter(app));

  // Swagger документация
  const config = new DocumentBuilder()
    .setTitle('PortVision 360 - WebSocket Hub API')
    .setDescription(`
      API для управления WebSocket соединениями, уведомлениями и real-time коммуникациями.
      
      ## WebSocket Gateways:
      - **Terminal** (\`/terminal\`) - Основной шлюз терминала для общих операций
      - **Operations** (\`/operations\`) - Операционные события и управление
      - **Equipment** (\`/equipment\`) - Управление оборудованием и его отслеживание
      - **Notifications** (\`/notifications\`) - Система уведомлений и алертов
      
      ## Функции:
      - Real-time WebSocket коммуникации
      - Система подписок на события
      - Доставка уведомлений через множественные каналы
      - Мониторинг и метрики производительности
      - Управление соединениями и их статусом
    `)
    .setVersion('1.0')
    .setContact(
      'PortVision 360 Support', 
      'https://github.com/portvision360', 
      'support@portvision360.com'
    )
    .setLicense('GNU AGPL v3', 'https://www.gnu.org/licenses/agpl-3.0.en.html')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Введите JWT токен для авторизации',
      },
      'JWT'
    )
    .addTag('WebSocket Connections', 'Управление WebSocket соединениями и их мониторинг')
    .addTag('Notifications', 'Создание, доставка и управление уведомлениями')
    .addTag('Metrics & Monitoring', 'Метрики производительности, алерты и мониторинг')
    .build();

  const document = SwaggerModule.createDocument(app, config, {
    operationIdFactory: (controllerKey: string, methodKey: string) => methodKey,
  });
  
  SwaggerModule.setup('api-docs', app, document, {
    customSiteTitle: 'WebSocket Hub API Documentation',
    customfavIcon: '/favicon.ico',
    customCss: `
      .swagger-ui .topbar { display: none; }
      .swagger-ui .info hgroup.main a { color: #3b82f6; }
      .swagger-ui .scheme-container { padding: 30px 0; }
    `,
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
      filter: true,
      showExtensions: true,
      tryItOutEnabled: true,
    },
  });

  const port = configService.get('WEBSOCKET_PORT', 3000);
  const host = configService.get('HOST', '0.0.0.0');
  
  await app.listen(port, host);
  
  logger.log(`🚀 WebSocket Hub запущен на ${host}:${port}`);
  logger.log(`📝 API документация: http://localhost:${port}/api-docs`);
  logger.log(`🔌 WebSocket Gateways:`);
  logger.log(`   • Terminal: ws://localhost:3003/terminal`);
  logger.log(`   • Operations: ws://localhost:3004/operations`);
  logger.log(`   • Equipment: ws://localhost:3005/equipment`);
  logger.log(`   • Notifications: ws://localhost:3006/notifications`);
  logger.log(`🗄️  База данных: ${configService.get('DB_HOST', 'localhost')}:${configService.get('DB_PORT', 5432)}`);
  logger.log(`🗂️  Redis: ${configService.get('REDIS_URL', 'redis://localhost:6379')}`);
  logger.log(`🔐 JWT Secret: ${configService.get('JWT_SECRET') ? '***' : 'default (не безопасно)'}`);
  logger.log(`🌍 Environment: ${configService.get('NODE_ENV', 'development')}`);
}

bootstrap().catch(err => {
  const logger = new Logger('WebSocketHubBootstrap');
  logger.error('❌ Критическая ошибка запуска WebSocket Hub:', err.stack || err);
  process.exit(1);
});