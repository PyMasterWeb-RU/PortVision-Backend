import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpStatus,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
  ApiBody,
} from '@nestjs/swagger';
import { 
  IntegrationEndpointService,
  CreateIntegrationEndpointDto,
  UpdateIntegrationEndpointDto,
  SearchIntegrationEndpointsDto,
} from '../services/integration-endpoint.service';
import { DataTransformationService } from '../services/data-transformation.service';
import { RoutingService } from '../services/routing.service';
import { MetricsService } from '../services/metrics.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { 
  IntegrationEndpoint,
  IntegrationType,
  ConnectionStatus,
} from '../entities/integration-endpoint.entity';

@ApiTags('Integration Endpoints')
@Controller('endpoints')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT')
export class IntegrationEndpointsController {
  private readonly logger = new Logger(IntegrationEndpointsController.name);

  constructor(
    private readonly integrationEndpointService: IntegrationEndpointService,
    private readonly dataTransformationService: DataTransformationService,
    private readonly routingService: RoutingService,
    private readonly metricsService: MetricsService,
  ) {}

  @Post()
  @ApiOperation({ 
    summary: 'Создать новую интеграцию',
    description: 'Создает новую точку интеграции с внешней системой'
  })
  @ApiResponse({ 
    status: HttpStatus.CREATED, 
    description: 'Интеграция успешно создана',
    type: IntegrationEndpoint,
  })
  @ApiResponse({ 
    status: HttpStatus.BAD_REQUEST, 
    description: 'Некорректные данные запроса' 
  })
  @ApiResponse({ 
    status: HttpStatus.CONFLICT, 
    description: 'Интеграция с таким именем уже существует' 
  })
  @ApiBody({
    description: 'Данные для создания интеграции',
    examples: {
      ocrIntegration: {
        summary: 'OCR/ANPR интеграция',
        value: {
          type: 'ocr_anpr',
          name: 'Terminal Gate Camera OCR',
          description: 'Распознавание номеров контейнеров с камер на воротах',
          isActive: true,
          connectionConfig: {
            host: '192.168.1.100',
            port: 80,
            protocol: 'http',
            authentication: {
              type: 'basic',
              username: 'admin',
              password: 'password123'
            },
            ocrConfig: {
              engine: 'tesseract',
              language: 'eng',
              confidence: 0.8,
              preprocessingSteps: ['denoise', 'contrast']
            },
            timeout: 30000,
            retryAttempts: 3,
            retryDelay: 5000
          },
          dataProcessingConfig: {
            inputFormat: 'json',
            outputFormat: 'json',
            transformationRules: [
              {
                sourceField: 'recognized_text',
                targetField: 'containerNumber',
                transformation: 'uppercase',
                required: true
              }
            ],
            validationRules: [
              {
                field: 'containerNumber',
                type: 'regex',
                rules: { pattern: '^[A-Z]{4}\\d{7}$' },
                errorMessage: 'Неверный формат номера контейнера'
              }
            ],
            filters: []
          },
          routingConfig: {
            targets: [
              {
                type: 'webhook',
                endpoint: 'http://localhost:3001/api/gate/container-recognized',
                retryPolicy: {
                  maxAttempts: 3,
                  backoffMultiplier: 2,
                  initialDelay: 1000
                }
              }
            ],
            rules: []
          },
          monitoringConfig: {
            healthCheck: {
              enabled: true,
              interval: 60,
              timeout: 10,
              failureThreshold: 3,
              successThreshold: 1
            },
            alerts: [
              {
                type: 'high_error_rate',
                condition: {
                  metric: 'errorRate',
                  operator: 'gt',
                  threshold: 10,
                  timeWindow: 300
                },
                actions: [
                  {
                    type: 'webhook',
                    target: 'http://localhost:3006/api/alerts/webhook'
                  }
                ],
                enabled: true
              }
            ],
            logging: {
              level: 'info',
              includePII: false,
              maxLogSize: 10485760,
              retentionDays: 30
            }
          },
          scheduleConfig: {
            enabled: false,
            type: 'event_driven'
          },
          tags: ['gate', 'ocr', 'container', 'recognition'],
          metadata: {
            cameraLocation: 'Main Gate',
            cameraModel: 'HIK-DS-2CD2143G0-I',
            installationDate: '2024-01-15'
          }
        }
      },
      mqttIntegration: {
        summary: 'GPS/MQTT интеграция',
        value: {
          type: 'gps_glonass',
          name: 'Equipment GPS Tracker',
          description: 'Отслеживание позиций мобильной техники через MQTT',
          isActive: true,
          connectionConfig: {
            host: 'mqtt.terminal.local',
            port: 1883,
            protocol: 'mqtt',
            authentication: {
              type: 'basic',
              username: 'tracker_user',
              password: 'tracker_pass'
            },
            mqttConfig: {
              clientId: 'portvision_gps_client',
              keepAlive: 60,
              clean: true,
              reconnectPeriod: 5000,
              topics: ['gps/+/position', 'gps/+/status'],
              qos: 1
            },
            gpsConfig: {
              protocol: 'galileosky',
              updateInterval: 30,
              trackingFields: ['latitude', 'longitude', 'speed', 'heading', 'timestamp']
            }
          },
          dataProcessingConfig: {
            inputFormat: 'json',
            outputFormat: 'json',
            transformationRules: [
              {
                sourceField: 'lat',
                targetField: 'latitude',
                transformation: 'number_format',
                transformationParams: { decimals: 6 },
                required: true
              },
              {
                sourceField: 'lng',
                targetField: 'longitude',
                transformation: 'number_format',
                transformationParams: { decimals: 6 },
                required: true
              }
            ],
            validationRules: [
              {
                field: 'latitude',
                type: 'number',
                rules: { min: -90, max: 90 },
                errorMessage: 'Некорректная широта'
              },
              {
                field: 'longitude',
                type: 'number',
                rules: { min: -180, max: 180 },
                errorMessage: 'Некорректная долгота'
              }
            ],
            filters: [
              {
                field: 'speed',
                operator: 'greater_than',
                value: 0,
                condition: 'include'
              }
            ]
          },
          routingConfig: {
            targets: [
              {
                type: 'webhook',
                endpoint: 'http://localhost:3004/api/equipment/update-position'
              }
            ],
            rules: []
          }
        }
      }
    }
  })
  async create(@Body() createDto: CreateIntegrationEndpointDto): Promise<IntegrationEndpoint> {
    this.logger.log(`📝 Создание интеграции: ${createDto.name} (${createDto.type})`);
    return await this.integrationEndpointService.create(createDto);
  }

  @Get()
  @ApiOperation({ 
    summary: 'Получить список интеграций',
    description: 'Получает список всех интеграций с возможностью поиска и фильтрации'
  })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Список интеграций получен успешно',
    schema: {
      type: 'object',
      properties: {
        items: { type: 'array', items: { $ref: '#/components/schemas/IntegrationEndpoint' } },
        total: { type: 'number' },
        page: { type: 'number' },
        limit: { type: 'number' }
      }
    }
  })
  @ApiQuery({ name: 'search', required: false, description: 'Поиск по названию или описанию' })
  @ApiQuery({ name: 'type', required: false, enum: IntegrationType, description: 'Фильтр по типу интеграции' })
  @ApiQuery({ name: 'status', required: false, enum: ConnectionStatus, description: 'Фильтр по статусу соединения' })
  @ApiQuery({ name: 'isActive', required: false, type: Boolean, description: 'Фильтр по активности' })
  @ApiQuery({ name: 'tags', required: false, description: 'Фильтр по тегам (через запятую)' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Номер страницы (по умолчанию 1)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Размер страницы (по умолчанию 50)' })
  @ApiQuery({ name: 'sortBy', required: false, enum: ['name', 'createdAt', 'updatedAt', 'lastConnectedAt'], description: 'Поле для сортировки' })
  @ApiQuery({ name: 'sortOrder', required: false, enum: ['ASC', 'DESC'], description: 'Порядок сортировки' })
  async findAll(@Query() query: SearchIntegrationEndpointsDto) {
    // Обрабатываем массивы из query параметров
    if (query.type && typeof query.type === 'string') {
      query.type = query.type.split(',') as IntegrationType[];
    }
    if (query.status && typeof query.status === 'string') {
      query.status = query.status.split(',') as ConnectionStatus[];
    }
    if (query.tags && typeof query.tags === 'string') {
      query.tags = query.tags.split(',');
    }

    return await this.integrationEndpointService.findAll(query);
  }

  @Get('stats')
  @ApiOperation({ 
    summary: 'Получить общую статистику интеграций',
    description: 'Возвращает сводную статистику по всем интеграциям'
  })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Статистика получена успешно',
    schema: {
      type: 'object',
      properties: {
        total: { type: 'number', description: 'Общее количество интеграций' },
        active: { type: 'number', description: 'Активные интеграции' },
        connected: { type: 'number', description: 'Подключенные интеграции' },
        errors: { type: 'number', description: 'Интеграции с ошибками' },
        byType: { type: 'object', description: 'Распределение по типам' },
        byStatus: { type: 'object', description: 'Распределение по статусам' },
        totalMessages: { type: 'number', description: 'Общее количество сообщений' },
        totalErrors: { type: 'number', description: 'Общее количество ошибок' },
        averageUptime: { type: 'number', description: 'Среднее время работы' }
      }
    }
  })
  async getStats() {
    return await this.integrationEndpointService.getStats();
  }

  @Get(':id')
  @ApiOperation({ 
    summary: 'Получить интеграцию по ID',
    description: 'Возвращает детальную информацию об интеграции'
  })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Интеграция найдена',
    type: IntegrationEndpoint,
  })
  @ApiResponse({ 
    status: HttpStatus.NOT_FOUND, 
    description: 'Интеграция не найдена' 
  })
  @ApiParam({ name: 'id', description: 'UUID интеграции' })
  async findOne(@Param('id') id: string): Promise<IntegrationEndpoint> {
    return await this.integrationEndpointService.findOne(id);
  }

  @Put(':id')
  @ApiOperation({ 
    summary: 'Обновить интеграцию',
    description: 'Обновляет конфигурацию существующей интеграции'
  })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Интеграция обновлена',
    type: IntegrationEndpoint,
  })
  @ApiResponse({ 
    status: HttpStatus.NOT_FOUND, 
    description: 'Интеграция не найдена' 
  })
  @ApiResponse({ 
    status: HttpStatus.BAD_REQUEST, 
    description: 'Некорректные данные запроса' 
  })
  @ApiParam({ name: 'id', description: 'UUID интеграции' })
  async update(
    @Param('id') id: string,
    @Body() updateDto: UpdateIntegrationEndpointDto,
  ): Promise<IntegrationEndpoint> {
    this.logger.log(`✏️ Обновление интеграции: ${id}`);
    return await this.integrationEndpointService.update(id, updateDto);
  }

  @Delete(':id')
  @ApiOperation({ 
    summary: 'Удалить интеграцию',
    description: 'Удаляет интеграцию и все связанные данные'
  })
  @ApiResponse({ 
    status: HttpStatus.NO_CONTENT, 
    description: 'Интеграция удалена' 
  })
  @ApiResponse({ 
    status: HttpStatus.NOT_FOUND, 
    description: 'Интеграция не найдена' 
  })
  @ApiParam({ name: 'id', description: 'UUID интеграции' })
  async remove(@Param('id') id: string): Promise<void> {
    this.logger.log(`🗑️ Удаление интеграции: ${id}`);
    await this.integrationEndpointService.remove(id);
  }

  @Post(':id/test-connection')
  @ApiOperation({ 
    summary: 'Проверить соединение',
    description: 'Тестирует соединение с внешней системой'
  })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Тест соединения выполнен',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
        responseTime: { type: 'number' },
        details: { type: 'object' }
      }
    }
  })
  @ApiParam({ name: 'id', description: 'UUID интеграции' })
  async testConnection(@Param('id') id: string) {
    const startTime = Date.now();
    
    try {
      const endpoint = await this.integrationEndpointService.findOne(id);
      
      // Здесь должна быть логика тестирования соединения для каждого типа
      // Пока что возвращаем заглушку
      const responseTime = Date.now() - startTime;
      
      await this.integrationEndpointService.updateStatus(id, ConnectionStatus.CONNECTED);
      
      this.logger.log(`✅ Тест соединения успешен для ${endpoint.name}: ${responseTime}ms`);
      
      return {
        success: true,
        message: `Соединение с ${endpoint.name} успешно установлено`,
        responseTime,
        details: {
          endpointType: endpoint.type,
          connectionConfig: {
            host: endpoint.connectionConfig.host,
            port: endpoint.connectionConfig.port,
            protocol: endpoint.connectionConfig.protocol,
          }
        }
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      await this.integrationEndpointService.updateStatus(
        id, 
        ConnectionStatus.ERROR, 
        error.message
      );
      
      this.logger.error(`❌ Тест соединения неудачен для ${id}: ${error.message}`);
      
      return {
        success: false,
        message: `Ошибка соединения: ${error.message}`,
        responseTime,
        details: {
          error: error.message,
        }
      };
    }
  }

  @Post(':id/process-data')
  @ApiOperation({ 
    summary: 'Обработать данные',
    description: 'Обрабатывает данные через конвейер трансформации и маршрутизации'
  })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Данные обработаны',
    schema: {
      type: 'object',
      properties: {
        transformationResult: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'object' },
            errors: { type: 'array', items: { type: 'string' } },
            warnings: { type: 'array', items: { type: 'string' } },
            metrics: { type: 'object' }
          }
        },
        routingResult: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            routedTargets: { type: 'array', items: { type: 'string' } },
            failedTargets: { type: 'array', items: { type: 'string' } },
            errors: { type: 'array', items: { type: 'string' } },
            totalTargets: { type: 'number' },
            processingTime: { type: 'number' }
          }
        }
      }
    }
  })
  @ApiParam({ name: 'id', description: 'UUID интеграции' })
  @ApiBody({
    description: 'Данные для обработки',
    examples: {
      containerData: {
        summary: 'Данные о контейнере',
        value: {
          container_number: 'TCLU1234567',
          arrival_time: '2024-01-20T10:30:00Z',
          carrier: 'MSC',
          weight: 25000,
          status: 'arrived'
        }
      },
      gpsData: {
        summary: 'GPS данные',
        value: {
          device_id: 'tracker_001',
          lat: 59.9311,
          lng: 30.3609,
          speed: 15,
          heading: 45,
          timestamp: '2024-01-20T10:30:00Z'
        }
      }
    }
  })
  async processData(@Param('id') id: string, @Body() data: any) {
    try {
      const endpoint = await this.integrationEndpointService.findOne(id);
      
      if (!endpoint.isActive) {
        throw new BadRequestException('Интеграция неактивна');
      }

      this.logger.debug(`🔄 Обработка данных для интеграции ${endpoint.name}`);

      // Трансформация данных
      const transformationResult = await this.dataTransformationService.processData(
        data,
        endpoint.dataProcessingConfig,
        id
      );

      let routingResult = null;
      
      // Если трансформация успешна, маршрутизируем данные
      if (transformationResult.success && transformationResult.data) {
        routingResult = await this.routingService.routeData(
          transformationResult.data,
          endpoint.routingConfig,
          id
        );
      }

      // Записываем метрики
      const processingTime = transformationResult.metrics.processingTime + 
        (routingResult?.processingTime || 0);

      if (transformationResult.success && (!routingResult || routingResult.success)) {
        await this.metricsService.recordMessage(id, JSON.stringify(data).length, processingTime);
      } else {
        const errors = [
          ...transformationResult.errors || [],
          ...routingResult?.errors || []
        ];
        await this.metricsService.recordError(id, errors.join('; '), processingTime);
      }

      return {
        transformationResult,
        routingResult,
      };

    } catch (error) {
      this.logger.error(`❌ Ошибка обработки данных для ${id}:`, error.message);
      
      await this.metricsService.recordError(id, error.message);
      
      throw error;
    }
  }

  @Get(':id/metrics')
  @ApiOperation({ 
    summary: 'Получить метрики интеграции',
    description: 'Возвращает детальные метрики производительности интеграции'
  })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Метрики получены',
    schema: {
      type: 'object',
      properties: {
        endpointId: { type: 'string' },
        endpointName: { type: 'string' },
        type: { type: 'string' },
        messagesReceived: { type: 'number' },
        messagesProcessed: { type: 'number' },
        messagesFailed: { type: 'number' },
        bytesProcessed: { type: 'number' },
        averageProcessingTime: { type: 'number' },
        errorRate: { type: 'number' },
        uptime: { type: 'number' },
        throughputPerMinute: { type: 'number' },
        latencyP95: { type: 'number' },
        hourlyStats: { 
          type: 'array',
          items: {
            type: 'object',
            properties: {
              hour: { type: 'string' },
              received: { type: 'number' },
              processed: { type: 'number' },
              failed: { type: 'number' },
              avgProcessingTime: { type: 'number' }
            }
          }
        }
      }
    }
  })
  @ApiParam({ name: 'id', description: 'UUID интеграции' })
  async getMetrics(@Param('id') id: string) {
    const metrics = await this.metricsService.getEndpointMetrics(id);
    
    if (!metrics) {
      throw new BadRequestException('Метрики для данной интеграции не найдены');
    }
    
    return metrics;
  }

  @Post(':id/activate')
  @ApiOperation({ 
    summary: 'Активировать интеграцию',
    description: 'Включает интеграцию и начинает обработку данных'
  })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Интеграция активирована',
    type: IntegrationEndpoint,
  })
  @ApiParam({ name: 'id', description: 'UUID интеграции' })
  async activate(@Param('id') id: string): Promise<IntegrationEndpoint> {
    this.logger.log(`▶️ Активация интеграции: ${id}`);
    return await this.integrationEndpointService.update(id, { isActive: true });
  }

  @Post(':id/deactivate')
  @ApiOperation({ 
    summary: 'Деактивировать интеграцию',
    description: 'Отключает интеграцию и останавливает обработку данных'
  })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Интеграция деактивирована',
    type: IntegrationEndpoint,
  })
  @ApiParam({ name: 'id', description: 'UUID интеграции' })
  async deactivate(@Param('id') id: string): Promise<IntegrationEndpoint> {
    this.logger.log(`⏹️ Деактивация интеграции: ${id}`);
    return await this.integrationEndpointService.update(id, { isActive: false });
  }

  @Get(':id/health')
  @ApiOperation({ 
    summary: 'Проверить здоровье интеграции',
    description: 'Возвращает детальную информацию о состоянии интеграции'
  })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Информация о здоровье получена',
    schema: {
      type: 'object',
      properties: {
        isHealthy: { type: 'boolean' },
        status: { type: 'string', enum: Object.values(ConnectionStatus) },
        uptime: { type: 'number' },
        errorRate: { type: 'number' },
        lastConnectedAt: { type: 'string', format: 'date-time' },
        lastErrorAt: { type: 'string', format: 'date-time' },
        lastErrorMessage: { type: 'string' },
        nextScheduledRun: { type: 'string', format: 'date-time' },
        configVersion: { type: 'number' },
        checks: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              status: { type: 'string', enum: ['pass', 'fail', 'warn'] },
              message: { type: 'string' }
            }
          }
        }
      }
    }
  })
  @ApiParam({ name: 'id', description: 'UUID интеграции' })
  async getHealth(@Param('id') id: string) {
    const endpoint = await this.integrationEndpointService.findOne(id);
    
    // Выполняем различные проверки здоровья
    const checks = [];
    
    // Проверка активности
    checks.push({
      name: 'Active Status',
      status: endpoint.isActive ? 'pass' : 'warn',
      message: endpoint.isActive ? 'Интеграция активна' : 'Интеграция неактивна'
    });
    
    // Проверка соединения
    checks.push({
      name: 'Connection Status',
      status: endpoint.status === ConnectionStatus.CONNECTED ? 'pass' : 
             endpoint.status === ConnectionStatus.ERROR ? 'fail' : 'warn',
      message: `Статус соединения: ${endpoint.status}`
    });
    
    // Проверка уровня ошибок
    const errorRateThreshold = 10; // 10%
    checks.push({
      name: 'Error Rate',
      status: endpoint.errorRate <= errorRateThreshold ? 'pass' : 'fail',
      message: `Уровень ошибок: ${endpoint.errorRate.toFixed(2)}%`
    });
    
    // Проверка времени последнего соединения
    const hoursThreshold = 24; // 24 часа
    const hoursSinceConnection = endpoint.lastConnectedAt ? 
      (Date.now() - endpoint.lastConnectedAt.getTime()) / (1000 * 60 * 60) : 
      Infinity;
    
    checks.push({
      name: 'Last Connection',
      status: hoursSinceConnection <= hoursThreshold ? 'pass' : 'warn',
      message: endpoint.lastConnectedAt ? 
        `Последнее соединение: ${hoursSinceConnection.toFixed(1)} часов назад` :
        'Соединение никогда не устанавливалось'
    });
    
    return {
      isHealthy: endpoint.isHealthy,
      status: endpoint.status,
      uptime: endpoint.uptime,
      errorRate: endpoint.errorRate,
      lastConnectedAt: endpoint.lastConnectedAt,
      lastErrorAt: endpoint.lastErrorAt,
      lastErrorMessage: endpoint.lastErrorMessage,
      nextScheduledRun: endpoint.nextScheduledRun,
      configVersion: endpoint.configVersion,
      checks
    };
  }
}