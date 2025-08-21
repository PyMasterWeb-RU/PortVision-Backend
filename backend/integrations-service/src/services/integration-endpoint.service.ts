import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptions, Like, In } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Cron, CronExpression } from '@nestjs/schedule';
import { 
  IntegrationEndpoint, 
  IntegrationType, 
  ConnectionStatus,
  AuthenticationType,
  DataFormat,
} from '../entities/integration-endpoint.entity';

export interface CreateIntegrationEndpointDto {
  type: IntegrationType;
  name: string;
  description?: string;
  isActive?: boolean;
  connectionConfig: any;
  dataProcessingConfig: any;
  routingConfig: any;
  monitoringConfig?: any;
  scheduleConfig?: any;
  tags?: string[];
  metadata?: Record<string, any>;
}

export interface UpdateIntegrationEndpointDto {
  name?: string;
  description?: string;
  isActive?: boolean;
  connectionConfig?: any;
  dataProcessingConfig?: any;
  routingConfig?: any;
  monitoringConfig?: any;
  scheduleConfig?: any;
  tags?: string[];
  metadata?: Record<string, any>;
}

export interface SearchIntegrationEndpointsDto {
  search?: string;
  type?: IntegrationType[];
  status?: ConnectionStatus[];
  isActive?: boolean;
  tags?: string[];
  page?: number;
  limit?: number;
  sortBy?: 'name' | 'createdAt' | 'updatedAt' | 'lastConnectedAt';
  sortOrder?: 'ASC' | 'DESC';
}

export interface IntegrationEndpointStats {
  total: number;
  active: number;
  connected: number;
  errors: number;
  byType: Record<IntegrationType, number>;
  byStatus: Record<ConnectionStatus, number>;
  totalMessages: number;
  totalErrors: number;
  averageUptime: number;
}

@Injectable()
export class IntegrationEndpointService {
  private readonly logger = new Logger(IntegrationEndpointService.name);

  constructor(
    @InjectRepository(IntegrationEndpoint)
    private readonly integrationEndpointRepository: Repository<IntegrationEndpoint>,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async create(createDto: CreateIntegrationEndpointDto): Promise<IntegrationEndpoint> {
    try {
      // Проверяем уникальность имени
      const existingEndpoint = await this.integrationEndpointRepository.findOne({
        where: { name: createDto.name },
      });

      if (existingEndpoint) {
        throw new ConflictException(`Интеграция с именем "${createDto.name}" уже существует`);
      }

      // Валидируем конфигурацию
      this.validateConfiguration(createDto.type, createDto.connectionConfig);

      const endpoint = this.integrationEndpointRepository.create({
        ...createDto,
        status: ConnectionStatus.DISCONNECTED,
        metrics: {
          messagesReceived: 0,
          messagesProcessed: 0,
          messagesFailed: 0,
          bytesProcessed: 0,
          averageProcessingTime: 0,
          errorRate: 0,
          uptime: 0,
          connectionAttempts: 0,
          successfulConnections: 0,
        },
        configVersion: 1,
      });

      const savedEndpoint = await this.integrationEndpointRepository.save(endpoint);

      this.logger.log(`✅ Создана интеграция: ${savedEndpoint.name} (${savedEndpoint.type})`);
      
      this.eventEmitter.emit('integration.endpoint.created', {
        endpointId: savedEndpoint.id,
        type: savedEndpoint.type,
        name: savedEndpoint.name,
      });

      return savedEndpoint;
    } catch (error) {
      this.logger.error(`❌ Ошибка создания интеграции: ${error.message}`, error.stack);
      throw error;
    }
  }

  async findAll(searchDto?: SearchIntegrationEndpointsDto): Promise<{
    items: IntegrationEndpoint[];
    total: number;
    page: number;
    limit: number;
  }> {
    const {
      search,
      type,
      status,
      isActive,
      tags,
      page = 1,
      limit = 50,
      sortBy = 'createdAt',
      sortOrder = 'DESC',
    } = searchDto || {};

    const queryBuilder = this.integrationEndpointRepository.createQueryBuilder('endpoint');

    // Поиск по тексту
    if (search) {
      queryBuilder.andWhere(
        '(endpoint.name ILIKE :search OR endpoint.description ILIKE :search)',
        { search: `%${search}%` }
      );
    }

    // Фильтр по типу
    if (type && type.length > 0) {
      queryBuilder.andWhere('endpoint.type IN (:...types)', { types: type });
    }

    // Фильтр по статусу
    if (status && status.length > 0) {
      queryBuilder.andWhere('endpoint.status IN (:...statuses)', { statuses: status });
    }

    // Фильтр по активности
    if (isActive !== undefined) {
      queryBuilder.andWhere('endpoint.isActive = :isActive', { isActive });
    }

    // Фильтр по тегам
    if (tags && tags.length > 0) {
      queryBuilder.andWhere('endpoint.tags && :tags', { tags });
    }

    // Сортировка
    queryBuilder.orderBy(`endpoint.${sortBy}`, sortOrder);

    // Пагинация
    const offset = (page - 1) * limit;
    queryBuilder.skip(offset).take(limit);

    const [items, total] = await queryBuilder.getManyAndCount();

    return {
      items,
      total,
      page,
      limit,
    };
  }

  async findOne(id: string): Promise<IntegrationEndpoint> {
    const endpoint = await this.integrationEndpointRepository.findOne({
      where: { id },
    });

    if (!endpoint) {
      throw new NotFoundException(`Интеграция с ID ${id} не найдена`);
    }

    return endpoint;
  }

  async update(id: string, updateDto: UpdateIntegrationEndpointDto): Promise<IntegrationEndpoint> {
    try {
      const endpoint = await this.findOne(id);

      // Проверяем уникальность имени при изменении
      if (updateDto.name && updateDto.name !== endpoint.name) {
        const existingEndpoint = await this.integrationEndpointRepository.findOne({
          where: { name: updateDto.name },
        });

        if (existingEndpoint) {
          throw new ConflictException(`Интеграция с именем "${updateDto.name}" уже существует`);
        }
      }

      // Валидируем конфигурацию при изменении
      if (updateDto.connectionConfig) {
        this.validateConfiguration(endpoint.type, updateDto.connectionConfig);
      }

      // Обновляем версию конфигурации при изменении критических параметров
      const criticalFields = ['connectionConfig', 'dataProcessingConfig', 'routingConfig'];
      const shouldIncrementVersion = criticalFields.some(field => updateDto[field]);

      const updatedEndpoint = await this.integrationEndpointRepository.save({
        ...endpoint,
        ...updateDto,
        configVersion: shouldIncrementVersion 
          ? endpoint.configVersion + 1 
          : endpoint.configVersion,
        updatedAt: new Date(),
      });

      this.logger.log(`✅ Обновлена интеграция: ${updatedEndpoint.name} (версия ${updatedEndpoint.configVersion})`);
      
      this.eventEmitter.emit('integration.endpoint.updated', {
        endpointId: updatedEndpoint.id,
        type: updatedEndpoint.type,
        name: updatedEndpoint.name,
        configVersion: updatedEndpoint.configVersion,
      });

      return updatedEndpoint;
    } catch (error) {
      this.logger.error(`❌ Ошибка обновления интеграции ${id}: ${error.message}`, error.stack);
      throw error;
    }
  }

  async remove(id: string): Promise<void> {
    const endpoint = await this.findOne(id);

    await this.integrationEndpointRepository.remove(endpoint);

    this.logger.log(`🗑️ Удалена интеграция: ${endpoint.name}`);
    
    this.eventEmitter.emit('integration.endpoint.deleted', {
      endpointId: id,
      type: endpoint.type,
      name: endpoint.name,
    });
  }

  async updateStatus(id: string, status: ConnectionStatus, errorMessage?: string): Promise<IntegrationEndpoint> {
    const endpoint = await this.findOne(id);

    const updates: Partial<IntegrationEndpoint> = {
      status,
      ...(status === ConnectionStatus.CONNECTED && { lastConnectedAt: new Date() }),
      ...(status === ConnectionStatus.ERROR && {
        lastErrorAt: new Date(),
        lastErrorMessage: errorMessage,
      }),
    };

    const updatedEndpoint = await this.integrationEndpointRepository.save({
      ...endpoint,
      ...updates,
    });

    this.eventEmitter.emit('integration.endpoint.status_changed', {
      endpointId: id,
      type: endpoint.type,
      name: endpoint.name,
      oldStatus: endpoint.status,
      newStatus: status,
      errorMessage,
    });

    return updatedEndpoint;
  }

  async updateMetrics(id: string, metricsUpdate: Partial<IntegrationEndpoint['metrics']>): Promise<IntegrationEndpoint> {
    const endpoint = await this.findOne(id);

    const updatedMetrics = {
      ...endpoint.metrics,
      ...metricsUpdate,
      lastProcessedAt: new Date(),
    };

    return this.integrationEndpointRepository.save({
      ...endpoint,
      metrics: updatedMetrics,
    });
  }

  async getStats(): Promise<IntegrationEndpointStats> {
    const endpoints = await this.integrationEndpointRepository.find();

    const stats: IntegrationEndpointStats = {
      total: endpoints.length,
      active: endpoints.filter(e => e.isActive).length,
      connected: endpoints.filter(e => e.status === ConnectionStatus.CONNECTED).length,
      errors: endpoints.filter(e => e.status === ConnectionStatus.ERROR).length,
      byType: {} as Record<IntegrationType, number>,
      byStatus: {} as Record<ConnectionStatus, number>,
      totalMessages: 0,
      totalErrors: 0,
      averageUptime: 0,
    };

    // Инициализируем счетчики
    Object.values(IntegrationType).forEach(type => {
      stats.byType[type] = 0;
    });

    Object.values(ConnectionStatus).forEach(status => {
      stats.byStatus[status] = 0;
    });

    // Считаем статистику
    let totalUptime = 0;
    endpoints.forEach(endpoint => {
      stats.byType[endpoint.type]++;
      stats.byStatus[endpoint.status]++;
      
      if (endpoint.metrics) {
        stats.totalMessages += endpoint.metrics.messagesReceived || 0;
        stats.totalErrors += endpoint.metrics.messagesFailed || 0;
        totalUptime += endpoint.uptime;
      }
    });

    stats.averageUptime = endpoints.length > 0 ? totalUptime / endpoints.length : 0;

    return stats;
  }

  async getHealthyEndpoints(): Promise<IntegrationEndpoint[]> {
    return this.integrationEndpointRepository.find({
      where: {
        isActive: true,
        status: ConnectionStatus.CONNECTED,
      },
    });
  }

  async getEndpointsByType(type: IntegrationType): Promise<IntegrationEndpoint[]> {
    return this.integrationEndpointRepository.find({
      where: { type },
    });
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async performHealthCheck(): Promise<void> {
    try {
      const activeEndpoints = await this.integrationEndpointRepository.find({
        where: {
          isActive: true,
        },
      });

      for (const endpoint of activeEndpoints) {
        if (!endpoint.monitoringConfig?.healthCheck?.enabled) {
          continue;
        }

        const { interval, failureThreshold } = endpoint.monitoringConfig.healthCheck;
        const now = Date.now();
        const lastConnected = endpoint.lastConnectedAt?.getTime() || 0;
        const timeSinceLastConnection = now - lastConnected;

        // Проверяем, не превышен ли интервал для health check
        if (timeSinceLastConnection > interval * 1000) {
          // Если превышен порог failures, помечаем как ERROR
          if (endpoint.status !== ConnectionStatus.ERROR) {
            await this.updateStatus(
              endpoint.id,
              ConnectionStatus.ERROR,
              `Health check failed: no connection for ${Math.round(timeSinceLastConnection / 1000)}s`
            );

            this.logger.warn(`⚠️ Health check failed for ${endpoint.name}: no connection for ${Math.round(timeSinceLastConnection / 1000)}s`);
          }
        }
      }
    } catch (error) {
      this.logger.error('❌ Ошибка health check:', error.message);
    }
  }

  private validateConfiguration(type: IntegrationType, config: any): void {
    if (!config.authentication || !config.authentication.type) {
      throw new BadRequestException('Не указан тип аутентификации в конфигурации');
    }

    switch (type) {
      case IntegrationType.OCR_ANPR:
        if (!config.ocrConfig) {
          throw new BadRequestException('Не указана конфигурация OCR');
        }
        break;

      case IntegrationType.GPS_GLONASS:
      case IntegrationType.MQTT_BROKER:
        if (!config.host || !config.port) {
          throw new BadRequestException('Не указаны host и port для MQTT подключения');
        }
        if (!config.mqttConfig) {
          throw new BadRequestException('Не указана конфигурация MQTT');
        }
        break;

      case IntegrationType.RFID_READER:
        if (!config.rfidConfig) {
          throw new BadRequestException('Не указана конфигурация RFID');
        }
        break;

      case IntegrationType.EDI_GATEWAY:
        if (!config.ediConfig) {
          throw new BadRequestException('Не указана конфигурация EDI');
        }
        break;

      case IntegrationType.ERP_1C:
        if (!config.oneСConfig) {
          throw new BadRequestException('Не указана конфигурация 1С');
        }
        break;

      case IntegrationType.FILE_WATCHER:
        if (!config.fileConfig || !config.fileConfig.watchPath) {
          throw new BadRequestException('Не указан путь для мониторинга файлов');
        }
        break;

      case IntegrationType.DATABASE:
        if (!config.databaseConfig) {
          throw new BadRequestException('Не указана конфигурация базы данных');
        }
        break;

      case IntegrationType.CUSTOM_API:
        if (!config.url && !config.host) {
          throw new BadRequestException('Не указан URL или host для API подключения');
        }
        break;
    }
  }
}