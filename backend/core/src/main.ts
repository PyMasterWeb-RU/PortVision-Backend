import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import compression from 'compression';
import helmet from 'helmet';

import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './libs/filters/global-exception.filter';
import { ResponseInterceptor } from './libs/interceptors/response.interceptor';
import { LoggingInterceptor } from './libs/interceptors/logging.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  // Security
  app.use(helmet());
  app.use(compression());

  // CORS
  app.enableCors({
    origin: [
      'http://localhost:3000',
      'http://localhost:3002',
      'https://localhost',
      configService.get('FRONTEND_URL', 'http://localhost:3002'),
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  });

  // API versioning
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  // Global prefix
  app.setGlobalPrefix('api');

  // Global pipes
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

  // Global filters
  app.useGlobalFilters(new GlobalExceptionFilter());

  // Global interceptors
  app.useGlobalInterceptors(
    new ResponseInterceptor(),
    new LoggingInterceptor(),
  );

  // Swagger API Documentation
  if (configService.get('NODE_ENV') !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('PortVision 360 API')
      .setDescription(
        'Container Terminal Management System (CTMS) - REST API Documentation',
      )
      .setVersion('1.0')
      .addBearerAuth()
      .addTag('auth', 'Authentication & Authorization')
      .addTag('orders', 'Order Management')
      .addTag('gate', 'Gate Operations')
      .addTag('yard', 'Yard Management')
      .addTag('moves', 'Container Moves')
      .addTag('planning', 'Resource Planning')
      .addTag('equipment', 'Equipment Management')
      .addTag('personnel', 'Personnel Management')
      .addTag('mr-services', 'Maintenance & Repair Services')
      .addTag('billing', 'Billing & Invoicing')
      .addTag('crm', 'Customer Relationship Management')
      .addTag('files', 'File Management')
      .addTag('digital-twin', 'Digital Twin Operations')
      .addTag('reporting', 'Reports & Analytics')
      .addServer('http://localhost:3000', 'Development Server')
      .addServer('https://api.portvision360.local', 'Production Server')
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
    });
  }

  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.log('Received SIGINT, shutting down gracefully...');
    await app.close();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log('Received SIGTERM, shutting down gracefully...');
    await app.close();
    process.exit(0);
  });

  const port = configService.get('PORT', 3000);
  await app.listen(port);

  console.log(`🚀 PortVision 360 API is running on: http://localhost:${port}`);
  console.log(`📚 API Documentation: http://localhost:${port}/api/docs`);
  console.log(`🏥 Health Check: http://localhost:${port}/api/health`);
}

bootstrap().catch((error) => {
  console.error('❌ Error starting the application:', error);
  process.exit(1);
});