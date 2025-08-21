import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AppService } from './app.service';

@ApiTags('health')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('health')
  @ApiOperation({ summary: 'Health check endpoint' })
  @ApiResponse({
    status: 200,
    description: 'Service is healthy',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: {
          type: 'object',
          properties: {
            status: { type: 'string', example: 'ok' },
            timestamp: { type: 'string', example: '2023-12-01T10:00:00.000Z' },
            uptime: { type: 'number', example: 3600 },
            version: { type: 'string', example: '1.0.0' },
            environment: { type: 'string', example: 'development' },
            database: { type: 'string', example: 'connected' },
            redis: { type: 'string', example: 'connected' },
          },
        },
      },
    },
  })
  getHealth() {
    return this.appService.getHealth();
  }

  @Get('version')
  @ApiOperation({ summary: 'Get application version' })
  @ApiResponse({
    status: 200,
    description: 'Application version information',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: {
          type: 'object',
          properties: {
            name: { type: 'string', example: 'PortVision 360' },
            version: { type: 'string', example: '1.0.0' },
            description: { type: 'string', example: 'Container Terminal Management System' },
            buildTime: { type: 'string', example: '2023-12-01T10:00:00.000Z' },
          },
        },
      },
    },
  })
  getVersion() {
    return this.appService.getVersion();
  }
}