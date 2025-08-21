import {
  Controller,
  Post,
  Get,
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
import { MqttProcessor, MqttProcessingRequest, EquipmentTrackingReport } from '../processors/mqtt.processor';
import { IntegrationEndpointService } from '../services/integration-endpoint.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { IntegrationType } from '../entities/integration-endpoint.entity';

@ApiTags('GPS/MQTT Tracking')
@Controller('gps-mqtt')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT')
export class GpsMqttController {
  private readonly logger = new Logger(GpsMqttController.name);

  constructor(
    private readonly mqttProcessor: MqttProcessor,
    private readonly integrationEndpointService: IntegrationEndpointService,
  ) {}

  @Post(':endpointId/connect')
  @ApiOperation({ 
    summary: 'Подключиться к MQTT брокеру',
    description: 'Устанавливает соединение с MQTT брокером для GPS отслеживания'
  })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Подключение установлено',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        action: { type: 'string' },
        endpointId: { type: 'string' },
        connectedDevices: { type: 'number' },
        activeSubscriptions: { type: 'number' },
        processingTime: { type: 'number' }
      }
    }
  })
  @ApiParam({ name: 'endpointId', description: 'UUID интеграции GPS/MQTT' })
  async connect(@Param('endpointId') endpointId: string) {
    const endpoint = await this.validateGpsEndpoint(endpointId);

    const request: MqttProcessingRequest = {
      endpointId,
      action: 'connect',
    };

    this.logger.log(`🔗 Запрос подключения MQTT для интеграции ${endpoint.name}`);

    return await this.mqttProcessor.processMqttRequest(request, endpoint);
  }

  @Post(':endpointId/disconnect')
  @ApiOperation({ 
    summary: 'Отключиться от MQTT брокера',
    description: 'Разрывает соединение с MQTT брокером'
  })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Отключение выполнено'
  })
  @ApiParam({ name: 'endpointId', description: 'UUID интеграции GPS/MQTT' })
  async disconnect(@Param('endpointId') endpointId: string) {
    const endpoint = await this.validateGpsEndpoint(endpointId);

    const request: MqttProcessingRequest = {
      endpointId,
      action: 'disconnect',
    };

    this.logger.log(`🔌 Запрос отключения MQTT для интеграции ${endpoint.name}`);

    return await this.mqttProcessor.processMqttRequest(request, endpoint);
  }

  @Post(':endpointId/subscribe')
  @ApiOperation({ 
    summary: 'Подписаться на MQTT топики',
    description: 'Подписывается на указанные MQTT топики для получения GPS данных'
  })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Подписка выполнена'
  })
  @ApiParam({ name: 'endpointId', description: 'UUID интеграции GPS/MQTT' })
  @ApiBody({
    description: 'Топики для подписки',
    schema: {
      type: 'object',
      properties: {
        topics: { 
          type: 'array', 
          items: { type: 'string' },
          description: 'Список MQTT топиков'
        },
        qos: { 
          type: 'number', 
          enum: [0, 1, 2],
          description: 'Уровень качества обслуживания MQTT'
        }
      },
      required: ['topics']
    },
    examples: {
      gpsTopics: {
        summary: 'GPS топики',
        value: {
          topics: [
            'gps/+/position',
            'gps/+/status',
            'equipment/+/telemetry'
          ],
          qos: 1
        }
      },
      deviceSpecific: {
        summary: 'Конкретные устройства',
        value: {
          topics: [
            'gps/RTG001/position',
            'gps/RS002/position',
            'gps/TR003/position'
          ],
          qos: 2
        }
      }
    }
  })
  async subscribe(
    @Param('endpointId') endpointId: string,
    @Body() body: { topics: string[]; qos?: 0 | 1 | 2 },
  ) {
    const endpoint = await this.validateGpsEndpoint(endpointId);

    if (!body.topics || !Array.isArray(body.topics) || body.topics.length === 0) {
      throw new BadRequestException('Необходимо указать топики для подписки');
    }

    const request: MqttProcessingRequest = {
      endpointId,
      action: 'subscribe',
      topics: body.topics,
      qos: body.qos || 1,
    };

    this.logger.log(`📡 Запрос подписки на топики для интеграции ${endpoint.name}: ${body.topics.join(', ')}`);

    return await this.mqttProcessor.processMqttRequest(request, endpoint);
  }

  @Post(':endpointId/publish')
  @ApiOperation({ 
    summary: 'Опубликовать сообщение в MQTT',
    description: 'Публикует сообщение в MQTT топик'
  })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Сообщение опубликовано'
  })
  @ApiParam({ name: 'endpointId', description: 'UUID интеграции GPS/MQTT' })
  @ApiBody({
    description: 'Сообщение для публикации',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'object', description: 'Данные сообщения' },
        metadata: { type: 'object', description: 'Метаданные' }
      },
      required: ['message']
    },
    examples: {
      commandMessage: {
        summary: 'Команда оборудованию',
        value: {
          message: {
            deviceId: 'RTG001',
            command: 'move_to_position',
            parameters: {
              latitude: 59.931089,
              longitude: 30.360655,
              speed: 10
            }
          },
          metadata: {
            operatorId: 'OP_001',
            sessionId: 'session_123'
          }
        }
      },
      statusUpdate: {
        summary: 'Обновление статуса',
        value: {
          message: {
            deviceId: 'RS002',
            status: 'maintenance_required',
            timestamp: '2024-01-20T10:30:00Z'
          }
        }
      }
    }
  })
  async publish(
    @Param('endpointId') endpointId: string,
    @Body() body: { message: any; metadata?: any },
  ) {
    const endpoint = await this.validateGpsEndpoint(endpointId);

    if (!body.message) {
      throw new BadRequestException('Необходимо указать сообщение для публикации');
    }

    const request: MqttProcessingRequest = {
      endpointId,
      action: 'publish',
      message: body.message,
      metadata: body.metadata,
    };

    this.logger.log(`📤 Запрос публикации сообщения для интеграции ${endpoint.name}`);

    return await this.mqttProcessor.processMqttRequest(request, endpoint);
  }

  @Get(':endpointId/devices')
  @ApiOperation({ 
    summary: 'Получить подключенные устройства',
    description: 'Возвращает список всех подключенных GPS устройств и их статусы'
  })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Список устройств получен',
    schema: {
      type: 'object',
      properties: {
        devices: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              deviceId: { type: 'string' },
              equipmentId: { type: 'string' },
              equipmentType: { type: 'string' },
              position: { type: 'object' },
              operationalStatus: { type: 'string' },
              workingArea: { type: 'string' },
              alerts: { type: 'array', items: { type: 'string' } }
            }
          }
        },
        total: { type: 'number' },
        lastUpdate: { type: 'string', format: 'date-time' }
      }
    }
  })
  @ApiParam({ name: 'endpointId', description: 'UUID интеграции GPS/MQTT' })
  async getDevices(@Param('endpointId') endpointId: string) {
    const endpoint = await this.validateGpsEndpoint(endpointId);

    const connectedDevices = await this.mqttProcessor.getConnectedDevices(endpointId);
    const devices = Array.from(connectedDevices.values());

    this.logger.debug(`📱 Запрос списка устройств для интеграции ${endpoint.name}: ${devices.length} устройств`);

    return {
      devices,
      total: devices.length,
      lastUpdate: new Date(),
    };
  }

  @Get(':endpointId/devices/:deviceId')
  @ApiOperation({ 
    summary: 'Получить статус устройства',
    description: 'Возвращает детальный статус конкретного GPS устройства'
  })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Статус устройства получен',
    schema: {
      type: 'object',
      properties: {
        deviceId: { type: 'string' },
        equipmentId: { type: 'string' },
        equipmentType: { type: 'string' },
        position: {
          type: 'object',
          properties: {
            latitude: { type: 'number' },
            longitude: { type: 'number' },
            speed: { type: 'number' },
            heading: { type: 'number' },
            timestamp: { type: 'string', format: 'date-time' },
            status: { type: 'string' }
          }
        },
        operationalStatus: { type: 'string' },
        workingArea: { type: 'string' },
        assignedTask: { type: 'string' },
        operatorId: { type: 'string' },
        alerts: { type: 'array', items: { type: 'string' } },
        lastMaintenance: { type: 'string', format: 'date-time' },
        nextMaintenance: { type: 'string', format: 'date-time' }
      }
    }
  })
  @ApiResponse({ 
    status: HttpStatus.NOT_FOUND, 
    description: 'Устройство не найдено' 
  })
  @ApiParam({ name: 'endpointId', description: 'UUID интеграции GPS/MQTT' })
  @ApiParam({ name: 'deviceId', description: 'ID GPS устройства' })
  async getDevice(
    @Param('endpointId') endpointId: string,
    @Param('deviceId') deviceId: string,
  ) {
    const endpoint = await this.validateGpsEndpoint(endpointId);

    const deviceStatus = await this.mqttProcessor.getDeviceStatus(deviceId);
    
    if (!deviceStatus) {
      throw new BadRequestException(`Устройство ${deviceId} не найдено`);
    }

    this.logger.debug(`📱 Запрос статуса устройства ${deviceId} для интеграции ${endpoint.name}`);

    return deviceStatus;
  }

  @Get(':endpointId/zones/:zoneId/devices')
  @ApiOperation({ 
    summary: 'Получить устройства в зоне',
    description: 'Возвращает список устройств, находящихся в указанной зоне терминала'
  })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Список устройств в зоне получен',
    schema: {
      type: 'object',
      properties: {
        zoneId: { type: 'string' },
        devices: { type: 'array' },
        total: { type: 'number' }
      }
    }
  })
  @ApiParam({ name: 'endpointId', description: 'UUID интеграции GPS/MQTT' })
  @ApiParam({ name: 'zoneId', description: 'ID зоны терминала (main_gate, container_yard, quay_area, maintenance_area)' })
  async getDevicesInZone(
    @Param('endpointId') endpointId: string,
    @Param('zoneId') zoneId: string,
  ) {
    const endpoint = await this.validateGpsEndpoint(endpointId);

    const devices = await this.mqttProcessor.getDevicesInZone(zoneId);

    this.logger.debug(`📍 Запрос устройств в зоне ${zoneId} для интеграции ${endpoint.name}: ${devices.length} устройств`);

    return {
      zoneId,
      devices,
      total: devices.length,
    };
  }

  @Get(':endpointId/stats')
  @ApiOperation({ 
    summary: 'Получить статистику GPS/MQTT',
    description: 'Возвращает статистику обработки GPS данных и MQTT соединений'
  })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Статистика получена',
    schema: {
      type: 'object',
      properties: {
        connections: { type: 'object' },
        processedMessages: { type: 'number' },
        activeConnections: { type: 'number' },
        lastUpdate: { type: 'string', format: 'date-time' }
      }
    }
  })
  @ApiParam({ name: 'endpointId', description: 'UUID интеграции GPS/MQTT' })
  async getStats(@Param('endpointId') endpointId: string) {
    const endpoint = await this.validateGpsEndpoint(endpointId);

    return await this.mqttProcessor.getProcessingStats(endpointId);
  }

  @Get(':endpointId/health')
  @ApiOperation({ 
    summary: 'Проверить здоровье GPS/MQTT',
    description: 'Возвращает статус здоровья GPS/MQTT интеграции'
  })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Статус здоровья получен',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['healthy', 'degraded', 'unhealthy'] },
        details: { type: 'object' }
      }
    }
  })
  @ApiParam({ name: 'endpointId', description: 'UUID интеграции GPS/MQTT' })
  async getHealth(@Param('endpointId') endpointId: string) {
    const endpoint = await this.validateGpsEndpoint(endpointId);

    return await this.mqttProcessor.healthCheck();
  }

  @Post(':endpointId/test-connection')
  @ApiOperation({ 
    summary: 'Тестировать MQTT соединение',
    description: 'Выполняет тест соединения с MQTT брокером'
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
  @ApiParam({ name: 'endpointId', description: 'UUID интеграции GPS/MQTT' })
  async testConnection(@Param('endpointId') endpointId: string) {
    const startTime = Date.now();
    const endpoint = await this.validateGpsEndpoint(endpointId);

    try {
      const success = await this.mqttProcessor.testMqttConnection(endpoint);
      const responseTime = Date.now() - startTime;

      this.logger.log(`${success ? '✅' : '❌'} Тест MQTT соединения для ${endpoint.name}: ${responseTime}ms`);

      return {
        success,
        message: success 
          ? `Тест соединения с MQTT брокером ${endpoint.connectionConfig.host} успешен`
          : `Ошибка соединения с MQTT брокером ${endpoint.connectionConfig.host}`,
        responseTime,
        details: {
          host: endpoint.connectionConfig.host,
          port: endpoint.connectionConfig.port,
          protocol: endpoint.connectionConfig.protocol,
          clientId: endpoint.connectionConfig.mqttConfig?.clientId,
        },
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      this.logger.error(`❌ Тест MQTT соединения неудачен для ${endpoint.name}:`, error.message);

      return {
        success: false,
        message: `Ошибка тестирования соединения: ${error.message}`,
        responseTime,
        details: {
          error: error.message,
        },
      };
    }
  }

  @Post(':endpointId/reports/tracking')
  @ApiOperation({ 
    summary: 'Сгенерировать отчет отслеживания',
    description: 'Создает отчет по отслеживанию оборудования за указанный период'
  })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Отчет сгенерирован',
    type: Object,
  })
  @ApiParam({ name: 'endpointId', description: 'UUID интеграции GPS/MQTT' })
  @ApiBody({
    description: 'Параметры отчета',
    schema: {
      type: 'object',
      properties: {
        deviceIds: { 
          type: 'array', 
          items: { type: 'string' },
          description: 'Список ID устройств для отчета'
        },
        startTime: { 
          type: 'string', 
          format: 'date-time',
          description: 'Начало периода отчета'
        },
        endTime: { 
          type: 'string', 
          format: 'date-time',
          description: 'Конец периода отчета'
        }
      },
      required: ['deviceIds', 'startTime', 'endTime']
    },
    examples: {
      dailyReport: {
        summary: 'Дневной отчет',
        value: {
          deviceIds: ['RTG001', 'RS002', 'TR003'],
          startTime: '2024-01-20T00:00:00Z',
          endTime: '2024-01-20T23:59:59Z'
        }
      },
      weeklyReport: {
        summary: 'Недельный отчет',
        value: {
          deviceIds: ['RTG001', 'RTG002', 'RMG001'],
          startTime: '2024-01-14T00:00:00Z',
          endTime: '2024-01-20T23:59:59Z'
        }
      }
    }
  })
  async generateTrackingReport(
    @Param('endpointId') endpointId: string,
    @Body() body: {
      deviceIds: string[];
      startTime: string;
      endTime: string;
    },
  ): Promise<EquipmentTrackingReport> {
    const endpoint = await this.validateGpsEndpoint(endpointId);

    if (!body.deviceIds || !Array.isArray(body.deviceIds) || body.deviceIds.length === 0) {
      throw new BadRequestException('Необходимо указать ID устройств для отчета');
    }

    const startTime = new Date(body.startTime);
    const endTime = new Date(body.endTime);

    if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) {
      throw new BadRequestException('Некорректные даты периода отчета');
    }

    if (startTime >= endTime) {
      throw new BadRequestException('Дата начала должна быть раньше даты окончания');
    }

    this.logger.log(
      `📊 Генерация отчета отслеживания для интеграции ${endpoint.name}: ` +
      `${body.deviceIds.length} устройств, период ${startTime.toISOString()} - ${endTime.toISOString()}`
    );

    return await this.mqttProcessor.generateTrackingReport(body.deviceIds, startTime, endTime);
  }

  @Post(':endpointId/clear-data')
  @ApiOperation({ 
    summary: 'Очистить данные устройств',
    description: 'Очищает кешированные данные устройств'
  })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Данные очищены'
  })
  @ApiParam({ name: 'endpointId', description: 'UUID интеграции GPS/MQTT' })
  @ApiQuery({ name: 'deviceId', required: false, description: 'ID конкретного устройства (если не указан, очищаются все)' })
  async clearData(
    @Param('endpointId') endpointId: string,
    @Query('deviceId') deviceId?: string,
  ) {
    const endpoint = await this.validateGpsEndpoint(endpointId);

    await this.mqttProcessor.clearDeviceData(deviceId);

    const message = deviceId 
      ? `Данные устройства ${deviceId} очищены`
      : 'Все данные устройств очищены';

    this.logger.log(`🧹 ${message} для интеграции ${endpoint.name}`);

    return {
      message,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('supported-protocols')
  @ApiOperation({ 
    summary: 'Получить поддерживаемые протоколы',
    description: 'Возвращает список поддерживаемых GPS протоколов и форматов'
  })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Список поддерживаемых протоколов',
    schema: {
      type: 'object',
      properties: {
        gpsProtocols: { type: 'array', items: { type: 'string' } },
        mqttVersions: { type: 'array', items: { type: 'string' } },
        coordinateSystems: { type: 'array', items: { type: 'string' } },
        equipmentTypes: { type: 'array', items: { type: 'string' } },
        zones: { type: 'array', items: { type: 'object' } }
      }
    }
  })
  async getSupportedProtocols() {
    return {
      gpsProtocols: ['wialon', 'galileosky', 'teltonika', 'custom', 'json'],
      mqttVersions: ['3.1.1', '5.0'],
      coordinateSystems: ['wgs84', 'gsk-2011', 'pulkovo42'],
      equipmentTypes: ['rtg', 'rmg', 'reach_stacker', 'forklift', 'truck', 'trailer', 'chassis'],
      messageFormats: ['json', 'binary', 'text'],
      qosLevels: [0, 1, 2],
      zones: [
        { id: 'main_gate', name: 'Главные ворота', type: 'gate' },
        { id: 'container_yard', name: 'Контейнерная площадка', type: 'yard' },
        { id: 'quay_area', name: 'Причальная зона', type: 'quay' },
        { id: 'maintenance_area', name: 'Зона ТО', type: 'maintenance' },
      ],
    };
  }

  private async validateGpsEndpoint(endpointId: string) {
    const endpoint = await this.integrationEndpointService.findOne(endpointId);
    
    if (endpoint.type !== IntegrationType.GPS_GLONASS && endpoint.type !== IntegrationType.MQTT_BROKER) {
      throw new BadRequestException(`Интеграция ${endpoint.name} не является GPS/MQTT интеграцией`);
    }

    if (!endpoint.isActive) {
      throw new BadRequestException(`Интеграция ${endpoint.name} неактивна`);
    }

    return endpoint;
  }
}