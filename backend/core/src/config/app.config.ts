import { registerAs } from '@nestjs/config';

export const appConfig = registerAs('app', () => ({
  name: process.env.APP_NAME || 'PortVision360',
  version: process.env.APP_VERSION || '1.0.0',
  environment: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 3000,
  buildTime: process.env.BUILD_TIME || new Date().toISOString(),
  
  // API Configuration
  globalPrefix: 'api',
  defaultVersion: '1',
  
  // CORS Configuration
  corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:3000,http://localhost:3002,https://localhost').split(','),
  
  // File Upload Configuration
  maxFileSize: parseInt(process.env.MAX_FILE_SIZE, 10) || 10 * 1024 * 1024, // 10MB
  allowedFileTypes: (process.env.ALLOWED_FILE_TYPES || 'image/jpeg,image/png,application/pdf,application/vnd.ms-excel').split(','),
  
  // Business Rules
  freeStorageDays: parseInt(process.env.FREE_STORAGE_DAYS, 10) || 3,
  maxStackHeight: parseInt(process.env.MAX_STACK_HEIGHT, 10) || 4,
  autoAssignmentTimeout: parseInt(process.env.AUTO_ASSIGNMENT_TIMEOUT, 10) || 5, // minutes
}));