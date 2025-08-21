import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import * as compression from 'compression';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('ReportingService');
  
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
  });

  const configService = app.get(ConfigService);

  // Security middleware
  app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  }));

  // Compression
  app.use(compression());

  // CORS
  app.enableCors({
    origin: configService.get('CORS_ORIGIN')?.split(',') || ['http://localhost:3000'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  });

  // Global prefix
  app.setGlobalPrefix('api');

  // Validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      disableErrorMessages: false,
      validationError: {
        target: false,
        value: false,
      },
    }),
  );

  // Swagger documentation
  const config = new DocumentBuilder()
    .setTitle('PortVision 360 - Reporting Service')
    .setDescription('Comprehensive reporting and analytics service for container terminal management')
    .setVersion('1.0.0')
    .addTag('reports', 'Business reports and analytics')
    .addTag('dashboards', 'Interactive dashboards and widgets')
    .addTag('kpi', 'Key Performance Indicators and metrics')
    .addTag('export', 'Data export and file generation')
    .addTag('aggregation', 'Data aggregation and ETL operations')
    .addTag('realtime', 'Real-time data streaming and subscriptions')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Enter JWT token',
        in: 'header',
      },
      'JWT',
    )
    .addServer('http://localhost:3004', 'Development server')
    .addServer('https://api.portvision360.ru/reporting', 'Production server')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
      docExpansion: 'none',
      filter: true,
      showRequestDuration: true,
    },
    customSiteTitle: 'PortVision 360 - Reporting Service API',
    customfavIcon: '/favicon.ico',
    customCss: `
      .swagger-ui .topbar { background-color: #1890ff; }
      .swagger-ui .topbar .download-url-wrapper { display: none; }
      .swagger-ui .info .title { color: #1890ff; }
    `,
  });

  // Health check endpoint
  app.getHttpAdapter().get('/health', (req, res) => {
    res.status(200).json({
      status: 'ok',
      service: 'reporting-service',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      version: process.env.npm_package_version || '1.0.0',
    });
  });

  const port = configService.get('PORT') || 3004;
  const host = configService.get('HOST') || '0.0.0.0';

  await app.listen(port, host);

  logger.log(`🚀 Reporting Service запущен на ${host}:${port}`);
  logger.log(`📚 Swagger документация: http://${host}:${port}/api/docs`);
  logger.log(`❤️  Health check: http://${host}:${port}/health`);
  logger.log(`🌍 Среда: ${process.env.NODE_ENV || 'development'}`);
}

bootstrap().catch((error) => {
  const logger = new Logger('ReportingService');
  logger.error('❌ Ошибка запуска сервиса:', error);
  process.exit(1);
});