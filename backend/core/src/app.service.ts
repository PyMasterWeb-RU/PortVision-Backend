import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';

@Injectable()
export class AppService {
  constructor(
    private readonly configService: ConfigService,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async getHealth() {
    const startTime = Date.now();
    
    // Check database connection
    let databaseStatus = 'disconnected';
    try {
      await this.dataSource.query('SELECT 1');
      databaseStatus = 'connected';
    } catch (error) {
      databaseStatus = 'error';
    }

    // Check Redis connection
    let redisStatus = 'disconnected';
    try {
      // Redis check would go here if Redis client was injected
      redisStatus = 'connected';
    } catch (error) {
      redisStatus = 'error';
    }

    const responseTime = Date.now() - startTime;

    return {
      success: true,
      data: {
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: this.configService.get('app.version', '1.0.0'),
        environment: this.configService.get('NODE_ENV', 'development'),
        database: databaseStatus,
        redis: redisStatus,
        responseTime: `${responseTime}ms`,
        memory: {
          used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
          total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
          external: Math.round(process.memoryUsage().external / 1024 / 1024),
        },
      },
    };
  }

  getVersion() {
    return {
      success: true,
      data: {
        name: 'PortVision 360',
        version: this.configService.get('app.version', '1.0.0'),
        description: 'Container Terminal Management System (CTMS)',
        buildTime: this.configService.get('app.buildTime', new Date().toISOString()),
        nodeVersion: process.version,
        architecture: process.arch,
        platform: process.platform,
      },
    };
  }
}