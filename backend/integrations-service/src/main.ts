import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { IntegrationsServiceModule } from './integrations-service.module';

async function bootstrap() {
  const logger = new Logger('IntegrationsServiceBootstrap');
  
  const app = await NestFactory.create(IntegrationsServiceModule, {
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

  // CORS
  app.enableCors({
    origin: process.env.NODE_ENV === 'production' 
      ? configService.get('CORS_ORIGINS', '').split(',').filter(Boolean)
      : ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:5173'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'X-Requested-With'],
    credentials: true,
  });

  // Swagger документация
  const config = new DocumentBuilder()
    .setTitle('PortVision 360 - Integrations Service API')
    .setDescription(`
      API для управления интеграциями с внешними системами.
      
      ## Поддерживаемые интеграции:
      - **OCR/ANPR** - Распознавание номеров контейнеров с камер
      - **GPS/GLONASS** - Отслеживание позиций техники через MQTT
      - **RFID** - Считывание RFID меток на воротах
      - **EDI** - Обмен данными с контейнерными линиями
      - **1С** - Интеграция с российской учетной системой
      - **Весы** - Автоматическое взвешивание контейнеров
      - **Камеры** - Система видеонаблюдения и контроля
      - **Файловые мониторы** - Обработка файлов из папок
      - **Custom API** - Интеграция с произвольными REST API
      - **Database** - Синхронизация с внешними БД
      
      ## Функции:
      - Конфигурируемые адаптеры для различных протоколов
      - Трансформация и валидация данных
      - Маршрутизация сообщений по условиям
      - Мониторинг и метрики производительности
      - Система retry и dead letter queue
      - Планировщик задач и расписание
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
    .addTag('Integration Endpoints', 'Управление точками интеграции')
    .addTag('OCR/ANPR Processing', 'Распознавание номеров контейнеров')
    .addTag('GPS/MQTT Tracking', 'Отслеживание техники через MQTT')
    .addTag('RFID Readers', 'Управление RFID считывателями')
    .addTag('EDI Gateway', 'Обмен EDI сообщениями')
    .addTag('1C Integration', 'Интеграция с системой 1С')
    .addTag('File Monitoring', 'Мониторинг файлов и папок')
    .addTag('Custom Integrations', 'Произвольные интеграции')
    .addTag('Metrics & Health', 'Метрики и мониторинг здоровья')
    .build();

  const document = SwaggerModule.createDocument(app, config, {
    operationIdFactory: (controllerKey: string, methodKey: string) => methodKey,
  });
  
  SwaggerModule.setup('api-docs', app, document, {
    customSiteTitle: 'Integrations Service API Documentation',
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

  const port = configService.get('INTEGRATIONS_PORT', 3007);
  const host = configService.get('HOST', '0.0.0.0');
  
  await app.listen(port, host);
  
  logger.log(`🚀 Integrations Service запущен на ${host}:${port}`);
  logger.log(`📝 API документация: http://localhost:${port}/api-docs`);
  logger.log(`🔗 Поддерживаемые интеграции:`);
  logger.log(`   • OCR/ANPR - Распознавание номеров контейнеров`);
  logger.log(`   • GPS/MQTT - Отслеживание техники`);
  logger.log(`   • RFID - Считыватели на воротах`);
  logger.log(`   • EDI - Обмен с контейнерными линиями`);
  logger.log(`   • 1С - Российская учетная система`);
  logger.log(`   • Weighbridge - Автоматическое взвешивание`);
  logger.log(`   • Camera System - Видеонаблюдение`);
  logger.log(`   • File Watcher - Мониторинг файлов`);
  logger.log(`   • Custom API - REST API интеграции`);
  logger.log(`   • Database - Синхронизация с БД`);
  logger.log(`🗄️  База данных: ${configService.get('DB_HOST', 'localhost')}:${configService.get('DB_PORT', 5432)}`);
  logger.log(`🗂️  Redis: ${configService.get('REDIS_URL', 'redis://localhost:6379')}`);
  logger.log(`🔐 JWT Secret: ${configService.get('JWT_SECRET') ? '***' : 'default (не безопасно)'}`);
  logger.log(`🌍 Environment: ${configService.get('NODE_ENV', 'development')}`);
}

bootstrap().catch(err => {
  const logger = new Logger('IntegrationsServiceBootstrap');
  logger.error('❌ Критическая ошибка запуска Integrations Service:', err.stack || err);
  process.exit(1);
});