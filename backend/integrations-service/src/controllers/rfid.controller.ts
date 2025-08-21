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
import { RfidProcessor, RfidProcessingRequest, TagInventoryReport } from '../processors/rfid.processor';
import { IntegrationEndpointService } from '../services/integration-endpoint.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { IntegrationType } from '../entities/integration-endpoint.entity';

@ApiTags('RFID Readers')
@Controller('rfid')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT')
export class RfidController {
  private readonly logger = new Logger(RfidController.name);

  constructor(
    private readonly rfidProcessor: RfidProcessor,
    private readonly integrationEndpointService: IntegrationEndpointService,
  ) {}

  @Post(':endpointId/start-reading')
  @ApiOperation({ 
    summary: 'Запустить чтение RFID тегов',
    description: 'Начинает процесс чтения RFID тегов на указанном считывателе'
  })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Чтение запущено',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        action: { type: 'string' },
        endpointId: { type: 'string' },
        readerStats: { type: 'object' },
        processingTime: { type: 'number' }
      }
    }
  })
  @ApiParam({ name: 'endpointId', description: 'UUID интеграции RFID' })
  @ApiBody({
    description: 'Параметры запуска чтения',
    schema: {
      type: 'object',
      properties: {
        antennas: { 
          type: 'array', 
          items: { type: 'string' },
          description: 'Список антенн для активации'
        },
        metadata: {
          type: 'object',
          properties: {
            operatorId: { type: 'string' },
            sessionId: { type: 'string' },
            location: { type: 'string' },
            equipment: { type: 'string' }
          }
        }
      }
    },
    examples: {
      startReading: {
        summary: 'Запуск чтения',
        value: {
          antennas: ['1', '2', '3', '4'],
          metadata: {
            operatorId: 'OP_001',
            sessionId: 'session_123',
            location: 'GATE_01',
            equipment: 'RFID_READER_01'
          }
        }
      }
    }
  })
  async startReading(
    @Param('endpointId') endpointId: string,
    @Body() body: { antennas?: string[]; metadata?: any },
  ) {
    const endpoint = await this.validateRfidEndpoint(endpointId);

    const request: RfidProcessingRequest = {
      endpointId,
      action: 'start_reading',
      antennas: body.antennas,
      metadata: body.metadata,
    };

    this.logger.log(`📡 Запрос запуска RFID чтения для интеграции ${endpoint.name}`);

    return await this.rfidProcessor.processRfidRequest(request, endpoint);
  }

  @Post(':endpointId/stop-reading')
  @ApiOperation({ 
    summary: 'Остановить чтение RFID тегов',
    description: 'Останавливает процесс чтения RFID тегов на указанном считывателе'
  })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Чтение остановлено'
  })
  @ApiParam({ name: 'endpointId', description: 'UUID интеграции RFID' })
  async stopReading(@Param('endpointId') endpointId: string) {
    const endpoint = await this.validateRfidEndpoint(endpointId);

    const request: RfidProcessingRequest = {
      endpointId,
      action: 'stop_reading',
    };

    this.logger.log(`🛑 Запрос остановки RFID чтения для интеграции ${endpoint.name}`);

    return await this.rfidProcessor.processRfidRequest(request, endpoint);
  }

  @Get(':endpointId/tags')
  @ApiOperation({ 
    summary: 'Получить подключенные RFID теги',
    description: 'Возвращает список всех обнаруженных RFID тегов'
  })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Список тегов получен',
    schema: {
      type: 'object',
      properties: {
        tags: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              epc: { type: 'string' },
              rssi: { type: 'number' },
              readCount: { type: 'number' },
              timestamp: { type: 'string', format: 'date-time' },
              isMoving: { type: 'boolean' }
            }
          }
        },
        total: { type: 'number' },
        lastUpdate: { type: 'string', format: 'date-time' }
      }
    }
  })
  @ApiParam({ name: 'endpointId', description: 'UUID интеграции RFID' })
  async getTags(@Param('endpointId') endpointId: string) {
    const endpoint = await this.validateRfidEndpoint(endpointId);

    const connectedTags = await this.rfidProcessor.getConnectedTags(endpointId);
    const tags = Array.from(connectedTags.values());

    this.logger.debug(`📋 Запрос списка RFID тегов для интеграции ${endpoint.name}: ${tags.length} тегов`);

    return {
      tags,
      total: tags.length,
      lastUpdate: new Date(),
    };
  }

  @Get(':endpointId/tags/:tagId')
  @ApiOperation({ 
    summary: 'Получить информацию о конкретном RFID теге',
    description: 'Возвращает детальную информацию о RFID теге включая историю'
  })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Информация о теге получена',
    schema: {
      type: 'object',
      properties: {
        tag: { type: 'object' },
        history: { type: 'array' },
        totalReads: { type: 'number' },
        zones: { type: 'array' }
      }
    }
  })
  @ApiResponse({ 
    status: HttpStatus.NOT_FOUND, 
    description: 'Тег не найден' 
  })
  @ApiParam({ name: 'endpointId', description: 'UUID интеграции RFID' })
  @ApiParam({ name: 'tagId', description: 'EPC код RFID тега' })
  async getTag(
    @Param('endpointId') endpointId: string,
    @Param('tagId') tagId: string,
  ) {
    const endpoint = await this.validateRfidEndpoint(endpointId);

    const tag = await this.rfidProcessor.getTag(tagId);
    
    if (!tag) {
      throw new BadRequestException(`RFID тег ${tagId} не найден`);
    }

    const history = await this.rfidProcessor.getTagHistory(tagId);

    this.logger.debug(`📋 Запрос информации о RFID теге ${tagId} для интеграции ${endpoint.name}`);

    return {
      tag,
      history,
      totalReads: tag.readCount || 0,
      zones: [...new Set(history.map(h => h.location.zone).filter(Boolean))],
    };
  }

  @Post(':endpointId/read-tag')
  @ApiOperation({ 
    summary: 'Прочитать конкретный RFID тег',
    description: 'Выполняет единичное чтение указанного RFID тега'
  })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Тег прочитан',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: { type: 'object' },
        processingTime: { type: 'number' }
      }
    }
  })
  @ApiParam({ name: 'endpointId', description: 'UUID интеграции RFID' })
  @ApiBody({
    description: 'Параметры чтения тега',
    schema: {
      type: 'object',
      properties: {
        tagId: { type: 'string', description: 'EPC код тега для чтения' },
        metadata: { type: 'object' }
      },
      required: ['tagId']
    },
    examples: {
      readSingleTag: {
        summary: 'Чтение одного тега',
        value: {
          tagId: 'E2002047381502180820C296',
          metadata: {
            operatorId: 'OP_001',
            reason: 'manual_check'
          }
        }
      }
    }
  })
  async readTag(
    @Param('endpointId') endpointId: string,
    @Body() body: { tagId: string; metadata?: any },
  ) {
    const endpoint = await this.validateRfidEndpoint(endpointId);

    if (!body.tagId) {
      throw new BadRequestException('Не указан ID тега для чтения');
    }

    const request: RfidProcessingRequest = {
      endpointId,
      action: 'read_tag',
      tagId: body.tagId,
      metadata: body.metadata,
    };

    this.logger.log(`📖 Запрос чтения RFID тега ${body.tagId} для интеграции ${endpoint.name}`);

    return await this.rfidProcessor.processRfidRequest(request, endpoint);
  }

  @Post(':endpointId/write-tag')
  @ApiOperation({ 
    summary: 'Записать данные в RFID тег',
    description: 'Записывает данные в указанный банк памяти RFID тега'
  })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Данные записаны в тег'
  })
  @ApiParam({ name: 'endpointId', description: 'UUID интеграции RFID' })
  @ApiBody({
    description: 'Данные для записи в тег',
    schema: {
      type: 'object',
      properties: {
        tagId: { type: 'string', description: 'EPC код тега' },
        data: { type: 'string', description: 'Данные для записи (hex)' },
        bank: { type: 'string', enum: ['epc', 'tid', 'user'], description: 'Банк памяти' },
        metadata: { type: 'object' }
      },
      required: ['tagId', 'data']
    },
    examples: {
      writeUserData: {
        summary: 'Запись в User память',
        value: {
          tagId: 'E2002047381502180820C296',
          data: '1234567890ABCDEF',
          bank: 'user',
          metadata: {
            operatorId: 'OP_001',
            purpose: 'container_id'
          }
        }
      },
      writeEpc: {
        summary: 'Запись нового EPC',
        value: {
          tagId: 'E2002047381502180820C296',
          data: 'E2002047381502180820C297',
          bank: 'epc',
          metadata: {
            operatorId: 'OP_001',
            purpose: 'tag_replacement'
          }
        }
      }
    }
  })
  async writeTag(
    @Param('endpointId') endpointId: string,
    @Body() body: { tagId: string; data: string; bank?: 'epc' | 'tid' | 'user'; metadata?: any },
  ) {
    const endpoint = await this.validateRfidEndpoint(endpointId);

    if (!body.tagId || !body.data) {
      throw new BadRequestException('Не указаны данные для записи в тег');
    }

    const request: RfidProcessingRequest = {
      endpointId,
      action: 'write_tag',
      tagId: body.tagId,
      data: body.data,
      bank: body.bank || 'user',
      metadata: body.metadata,
    };

    this.logger.log(`✏️ Запрос записи в RFID тег ${body.tagId} для интеграции ${endpoint.name}`);

    return await this.rfidProcessor.processRfidRequest(request, endpoint);
  }

  @Post(':endpointId/lock-tag')
  @ApiOperation({ 
    summary: 'Заблокировать RFID тег',
    description: 'Блокирует указанные банки памяти RFID тега от записи'
  })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Тег заблокирован'
  })
  @ApiParam({ name: 'endpointId', description: 'UUID интеграции RFID' })
  @ApiBody({
    description: 'Параметры блокировки тега',
    schema: {
      type: 'object',
      properties: {
        tagId: { type: 'string', description: 'EPC код тега' },
        metadata: { type: 'object' }
      },
      required: ['tagId']
    },
    examples: {
      lockTag: {
        summary: 'Блокировка тега',
        value: {
          tagId: 'E2002047381502180820C296',
          metadata: {
            operatorId: 'OP_001',
            reason: 'data_protection'
          }
        }
      }
    }
  })
  async lockTag(
    @Param('endpointId') endpointId: string,
    @Body() body: { tagId: string; metadata?: any },
  ) {
    const endpoint = await this.validateRfidEndpoint(endpointId);

    if (!body.tagId) {
      throw new BadRequestException('Не указан ID тега для блокировки');
    }

    const request: RfidProcessingRequest = {
      endpointId,
      action: 'lock_tag',
      tagId: body.tagId,
      metadata: body.metadata,
    };

    this.logger.log(`🔒 Запрос блокировки RFID тега ${body.tagId} для интеграции ${endpoint.name}`);

    return await this.rfidProcessor.processRfidRequest(request, endpoint);
  }

  @Post(':endpointId/inventory')
  @ApiOperation({ 
    summary: 'Выполнить инвентаризацию RFID тегов',
    description: 'Создает отчет инвентаризации всех обнаруженных RFID тегов'
  })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Инвентаризация выполнена',
    type: Object,
  })
  @ApiParam({ name: 'endpointId', description: 'UUID интеграции RFID' })
  @ApiBody({
    description: 'Параметры инвентаризации',
    schema: {
      type: 'object',
      properties: {
        timeRange: {
          type: 'object',
          properties: {
            start: { type: 'string', format: 'date-time' },
            end: { type: 'string', format: 'date-time' }
          }
        },
        metadata: { type: 'object' }
      }
    },
    examples: {
      fullInventory: {
        summary: 'Полная инвентаризация',
        value: {
          timeRange: {
            start: '2024-01-20T00:00:00Z',
            end: '2024-01-20T23:59:59Z'
          },
          metadata: {
            operatorId: 'OP_001',
            purpose: 'daily_inventory'
          }
        }
      }
    }
  })
  async inventory(
    @Param('endpointId') endpointId: string,
    @Body() body: { timeRange?: { start: string; end: string }; metadata?: any },
  ): Promise<TagInventoryReport> {
    const endpoint = await this.validateRfidEndpoint(endpointId);

    let timeRange;
    if (body.timeRange) {
      timeRange = {
        start: new Date(body.timeRange.start),
        end: new Date(body.timeRange.end),
      };
      
      if (isNaN(timeRange.start.getTime()) || isNaN(timeRange.end.getTime())) {
        throw new BadRequestException('Некорректные даты периода инвентаризации');
      }
    }

    this.logger.log(`📊 Запрос инвентаризации RFID для интеграции ${endpoint.name}`);

    return await this.rfidProcessor.generateInventoryReport(endpointId, timeRange);
  }

  @Get(':endpointId/zones')
  @ApiOperation({ 
    summary: 'Получить присутствие тегов по зонам',
    description: 'Возвращает информацию о том, какие теги находятся в каких зонах'
  })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Информация о зонах получена',
    schema: {
      type: 'object',
      properties: {
        zones: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              zone: { type: 'string' },
              tagCount: { type: 'number' },
              tags: { type: 'array', items: { type: 'string' } }
            }
          }
        },
        totalTags: { type: 'number' },
        lastUpdate: { type: 'string', format: 'date-time' }
      }
    }
  })
  @ApiParam({ name: 'endpointId', description: 'UUID интеграции RFID' })
  @ApiQuery({ name: 'zone', required: false, description: 'Фильтр по конкретной зоне' })
  async getZones(
    @Param('endpointId') endpointId: string,
    @Query('zone') zone?: string,
  ) {
    const endpoint = await this.validateRfidEndpoint(endpointId);

    const zonePresence = await this.rfidProcessor.getZonePresence(zone);
    
    const zones = Array.from(zonePresence.entries()).map(([zoneName, tagSet]) => ({
      zone: zoneName,
      tagCount: tagSet.size,
      tags: Array.from(tagSet),
    }));

    const totalTags = zones.reduce((sum, z) => sum + z.tagCount, 0);

    this.logger.debug(`📍 Запрос информации о зонах для интеграции ${endpoint.name}: ${zones.length} зон`);

    return {
      zones,
      totalTags,
      lastUpdate: new Date(),
    };
  }

  @Get(':endpointId/stats')
  @ApiOperation({ 
    summary: 'Получить статистику RFID обработки',
    description: 'Возвращает статистику работы RFID считывателя'
  })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Статистика получена',
    schema: {
      type: 'object',
      properties: {
        rfid: { type: 'object' },
        processedReads: { type: 'number' },
        tagHistory: { type: 'number' },
        zonePresence: { type: 'array' },
        lastUpdate: { type: 'string', format: 'date-time' }
      }
    }
  })
  @ApiParam({ name: 'endpointId', description: 'UUID интеграции RFID' })
  async getStats(@Param('endpointId') endpointId: string) {
    const endpoint = await this.validateRfidEndpoint(endpointId);

    return await this.rfidProcessor.getProcessingStats(endpointId);
  }

  @Get(':endpointId/health')
  @ApiOperation({ 
    summary: 'Проверить здоровье RFID интеграции',
    description: 'Возвращает статус здоровья RFID считывателя'
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
  @ApiParam({ name: 'endpointId', description: 'UUID интеграции RFID' })
  async getHealth(@Param('endpointId') endpointId: string) {
    const endpoint = await this.validateRfidEndpoint(endpointId);

    return await this.rfidProcessor.healthCheck();
  }

  @Post(':endpointId/test-connection')
  @ApiOperation({ 
    summary: 'Тестировать RFID соединение',
    description: 'Выполняет тест соединения с RFID считывателем'
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
  @ApiParam({ name: 'endpointId', description: 'UUID интеграции RFID' })
  async testConnection(@Param('endpointId') endpointId: string) {
    const startTime = Date.now();
    const endpoint = await this.validateRfidEndpoint(endpointId);

    try {
      const success = await this.rfidProcessor.testRfidConnection(endpoint);
      const responseTime = Date.now() - startTime;

      this.logger.log(`${success ? '✅' : '❌'} Тест RFID соединения для ${endpoint.name}: ${responseTime}ms`);

      return {
        success,
        message: success 
          ? `Тест соединения с RFID считывателем ${endpoint.name} успешен`
          : `Ошибка соединения с RFID считывателем ${endpoint.name}`,
        responseTime,
        details: {
          protocol: endpoint.connectionConfig.rfidConfig?.protocol,
          readerType: endpoint.connectionConfig.rfidConfig?.readerType,
          antennas: endpoint.connectionConfig.rfidConfig?.antennas?.length || 0,
        },
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      this.logger.error(`❌ Тест RFID соединения неудачен для ${endpoint.name}:`, error.message);

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

  @Post(':endpointId/clear-data')
  @ApiOperation({ 
    summary: 'Очистить данные RFID тегов',
    description: 'Очищает кешированные данные тегов и историю'
  })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Данные очищены'
  })
  @ApiParam({ name: 'endpointId', description: 'UUID интеграции RFID' })
  @ApiQuery({ name: 'tagId', required: false, description: 'ID конкретного тега (если не указан, очищаются все)' })
  async clearData(
    @Param('endpointId') endpointId: string,
    @Query('tagId') tagId?: string,
  ) {
    const endpoint = await this.validateRfidEndpoint(endpointId);

    await this.rfidProcessor.clearTagData(tagId);

    const message = tagId 
      ? `Данные RFID тега ${tagId} очищены`
      : 'Все данные RFID тегов очищены';

    this.logger.log(`🧹 ${message} для интеграции ${endpoint.name}`);

    return {
      message,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('supported-readers')
  @ApiOperation({ 
    summary: 'Получить поддерживаемые типы RFID считывателей',
    description: 'Возвращает список поддерживаемых типов RFID считывателей и протоколов'
  })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Список поддерживаемых считывателей',
    schema: {
      type: 'object',
      properties: {
        readerTypes: { type: 'array', items: { type: 'string' } },
        protocols: { type: 'array', items: { type: 'string' } },
        memoryBanks: { type: 'array', items: { type: 'string' } },
        readModes: { type: 'array', items: { type: 'string' } },
        features: { type: 'array', items: { type: 'string' } }
      }
    }
  })
  async getSupportedReaders() {
    return {
      readerTypes: [
        'impinj',      // Impinj Speedway/xPortal
        'zebra',       // Zebra FX series
        'alien',       // Alien Technology
        'custom'       // Пользовательские протоколы
      ],
      protocols: ['tcp', 'udp', 'serial', 'http'],
      memoryBanks: ['epc', 'tid', 'user', 'reserved'],
      readModes: ['continuous', 'triggered', 'single'],
      sessions: [0, 1, 2, 3],
      powerLevels: {
        min: 10,  // dBm
        max: 32,  // dBm
        default: 25
      },
      features: [
        'inventory',          // Инвентаризация тегов
        'tag_write',         // Запись в теги
        'tag_lock',          // Блокировка тегов
        'tag_kill',          // Уничтожение тегов
        'filtering',         // Фильтрация тегов
        'rssi_measurement',  // Измерение силы сигнала
        'phase_measurement', // Измерение фазы
        'antenna_switching', // Переключение антенн
        'real_time_reading', // Чтение в реальном времени
        'batch_operations'   // Пакетные операции
      ],
      antennaOptions: {
        maxCount: 16,
        powerLevelRange: { min: 10, max: 32 },
        positions: ['x', 'y', 'z']
      },
    };
  }

  private async validateRfidEndpoint(endpointId: string) {
    const endpoint = await this.integrationEndpointService.findOne(endpointId);
    
    if (endpoint.type !== IntegrationType.RFID_READER) {
      throw new BadRequestException(`Интеграция ${endpoint.name} не является RFID интеграцией`);
    }

    if (!endpoint.isActive) {
      throw new BadRequestException(`Интеграция ${endpoint.name} неактивна`);
    }

    return endpoint;
  }
}