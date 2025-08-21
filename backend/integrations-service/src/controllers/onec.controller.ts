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
import { 
  OneCProcessor, 
  OneCProcessingRequest, 
  OneCReportData 
} from '../processors/onec.processor';
import { OneCDocumentType } from '../adapters/onec.adapter';
import { IntegrationEndpointService } from '../services/integration-endpoint.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { IntegrationType } from '../entities/integration-endpoint.entity';

@ApiTags('1C Integration')
@Controller('onec')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT')
export class OneCController {
  private readonly logger = new Logger(OneCController.name);

  constructor(
    private readonly onecProcessor: OneCProcessor,
    private readonly integrationEndpointService: IntegrationEndpointService,
  ) {}

  @Post(':endpointId/sync-clients')
  @ApiOperation({ 
    summary: 'Синхронизировать клиентов из 1С',
    description: 'Импортирует справочник контрагентов из 1С в PortVision 360'
  })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Клиенты синхронизированы',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: {
          type: 'object',
          properties: {
            clientsCount: { type: 'number' },
            clients: { type: 'array' },
            eventId: { type: 'string' }
          }
        },
        processingTime: { type: 'number' },
        exchangeStats: { type: 'object' }
      }
    }
  })
  @ApiParam({ name: 'endpointId', description: 'UUID интеграции 1С' })
  @ApiBody({
    description: 'Параметры синхронизации',
    schema: {
      type: 'object',
      properties: {
        metadata: {
          type: 'object',
          properties: {
            operatorId: { type: 'string' },
            sessionId: { type: 'string' },
            organizationId: { type: 'string' }
          }
        }
      }
    },
    examples: {
      syncClients: {
        summary: 'Синхронизация клиентов',
        value: {
          metadata: {
            operatorId: 'OP_001',
            sessionId: 'session_123',
            organizationId: 'main_org'
          }
        }
      }
    }
  })
  async syncClients(
    @Param('endpointId') endpointId: string,
    @Body() body: { metadata?: any },
  ) {
    const endpoint = await this.validateOneCEndpoint(endpointId);

    const request: OneCProcessingRequest = {
      endpointId,
      action: 'sync_clients',
      metadata: body.metadata,
    };

    this.logger.log(`👥 Запрос синхронизации клиентов из 1С для интеграции ${endpoint.name}`);

    return await this.onecProcessor.processOneCRequest(request, endpoint);
  }

  @Post(':endpointId/sync-services')
  @ApiOperation({ 
    summary: 'Синхронизировать услуги из 1С',
    description: 'Импортирует справочник услуг из 1С в PortVision 360'
  })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Услуги синхронизированы',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: {
          type: 'object',
          properties: {
            servicesCount: { type: 'number' },
            services: { type: 'array' },
            eventId: { type: 'string' }
          }
        },
        processingTime: { type: 'number' }
      }
    }
  })
  @ApiParam({ name: 'endpointId', description: 'UUID интеграции 1С' })
  @ApiBody({
    description: 'Параметры синхронизации',
    schema: {
      type: 'object',
      properties: {
        metadata: { type: 'object' }
      }
    },
    examples: {
      syncServices: {
        summary: 'Синхронизация услуг',
        value: {
          metadata: {
            operatorId: 'OP_001',
            organizationId: 'main_org'
          }
        }
      }
    }
  })
  async syncServices(
    @Param('endpointId') endpointId: string,
    @Body() body: { metadata?: any },
  ) {
    const endpoint = await this.validateOneCEndpoint(endpointId);

    const request: OneCProcessingRequest = {
      endpointId,
      action: 'sync_services',
      metadata: body.metadata,
    };

    this.logger.log(`🔧 Запрос синхронизации услуг из 1С для интеграции ${endpoint.name}`);

    return await this.onecProcessor.processOneCRequest(request, endpoint);
  }

  @Post(':endpointId/create-invoice')
  @ApiOperation({ 
    summary: 'Создать счет в 1С',
    description: 'Создает счет на оплату в 1С на основе данных из PortVision 360'
  })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Счет создан в 1С',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: { type: 'string', description: 'ID созданного документа в 1С' },
        processingTime: { type: 'number' }
      }
    }
  })
  @ApiParam({ name: 'endpointId', description: 'UUID интеграции 1С' })
  @ApiBody({
    description: 'Данные счета для создания',
    schema: {
      type: 'object',
      properties: {
        invoiceData: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            number: { type: 'string' },
            date: { type: 'string', format: 'date' },
            clientId: { type: 'string', description: 'ID клиента в 1С' },
            currency: { type: 'string', default: 'RUB' },
            totalAmount: { type: 'number' },
            lines: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  serviceId: { type: 'string' },
                  serviceName: { type: 'string' },
                  description: { type: 'string' },
                  quantity: { type: 'number' },
                  unitPrice: { type: 'number' },
                  totalAmount: { type: 'number' },
                  vatRate: { type: 'number', default: 20 },
                  containerNumber: { type: 'string' },
                  vesselName: { type: 'string' },
                  voyage: { type: 'string' }
                }
              }
            }
          },
          required: ['clientId', 'lines']
        },
        metadata: { type: 'object' }
      },
      required: ['invoiceData']
    },
    examples: {
      containerHandlingInvoice: {
        summary: 'Счет за обработку контейнеров',
        value: {
          invoiceData: {
            id: 'PV_INV_001',
            number: 'СЧ-001-2024',
            date: '2024-01-20',
            clientId: '1c_client_123',
            currency: 'RUB',
            totalAmount: 75000,
            lines: [
              {
                id: 'line_1',
                serviceId: '1c_service_discharge',
                serviceName: 'Выгрузка контейнера 40HC',
                description: 'Выгрузка контейнера с судна MSC OSCAR',
                quantity: 10,
                unitPrice: 5000,
                totalAmount: 50000,
                vatRate: 20,
                containerNumber: 'MSCU1234567',
                vesselName: 'MSC OSCAR',
                voyage: '2401E'
              },
              {
                id: 'line_2',
                serviceId: '1c_service_storage',
                serviceName: 'Хранение контейнера',
                description: 'Хранение контейнера на терминале',
                quantity: 5,
                unitPrice: 5000,
                totalAmount: 25000,
                vatRate: 20,
                containerNumber: 'MSCU1234567'
              }
            ]
          },
          metadata: {
            operatorId: 'OP_001',
            organizationId: 'main_org',
            priority: 'normal'
          }
        }
      }
    }
  })
  async createInvoice(
    @Param('endpointId') endpointId: string,
    @Body() body: { invoiceData: any; metadata?: any },
  ) {
    const endpoint = await this.validateOneCEndpoint(endpointId);

    if (!body.invoiceData) {
      throw new BadRequestException('Необходимо указать данные счета');
    }

    const request: OneCProcessingRequest = {
      endpointId,
      action: 'create_invoice',
      documentData: body.invoiceData,
      metadata: body.metadata,
    };

    this.logger.log(`💰 Запрос создания счета в 1С для интеграции ${endpoint.name}`);

    return await this.onecProcessor.processOneCRequest(request, endpoint);
  }

  @Post(':endpointId/create-operation')
  @ApiOperation({ 
    summary: 'Создать операцию в 1С',
    description: 'Создает документ операции в 1С на основе данных из PortVision 360'
  })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Операция создана в 1С'
  })
  @ApiParam({ name: 'endpointId', description: 'UUID интеграции 1С' })
  @ApiBody({
    description: 'Данные операции для создания',
    schema: {
      type: 'object',
      properties: {
        operationData: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            operationType: { type: 'string', enum: ['gate_in', 'gate_out', 'discharge', 'load', 'shift', 'inspection'] },
            containerNumber: { type: 'string' },
            vesselName: { type: 'string' },
            voyage: { type: 'string' },
            equipmentId: { type: 'string' },
            operatorId: { type: 'string' },
            timestamp: { type: 'string', format: 'date-time' },
            locationFrom: { type: 'string' },
            locationTo: { type: 'string' }
          },
          required: ['operationType', 'containerNumber']
        },
        metadata: { type: 'object' }
      },
      required: ['operationData']
    },
    examples: {
      dischargeOperation: {
        summary: 'Операция выгрузки контейнера',
        value: {
          operationData: {
            id: 'PV_OP_001',
            operationType: 'discharge',
            containerNumber: 'MSCU1234567',
            vesselName: 'MSC OSCAR',
            voyage: '2401E',
            equipmentId: 'STS_CRANE_01',
            operatorId: 'CRANE_OP_001',
            timestamp: '2024-01-20T14:30:00Z',
            locationFrom: 'VESSEL_BAY_01',
            locationTo: 'YARD_A_01_02'
          },
          metadata: {
            operatorId: 'OP_001',
            organizationId: 'main_org'
          }
        }
      },
      gateOperation: {
        summary: 'Операция въезда на терминал',
        value: {
          operationData: {
            id: 'PV_OP_002',
            operationType: 'gate_in',
            containerNumber: 'TCLU7654321',
            equipmentId: 'TRUCK_12345',
            operatorId: 'GATE_OP_001',
            timestamp: '2024-01-20T09:15:00Z',
            locationFrom: 'GATE_01',
            locationTo: 'YARD_B_05_10'
          }
        }
      }
    }
  })
  async createOperation(
    @Param('endpointId') endpointId: string,
    @Body() body: { operationData: any; metadata?: any },
  ) {
    const endpoint = await this.validateOneCEndpoint(endpointId);

    if (!body.operationData) {
      throw new BadRequestException('Необходимо указать данные операции');
    }

    const request: OneCProcessingRequest = {
      endpointId,
      action: 'create_operation',
      documentData: body.operationData,
      metadata: body.metadata,
    };

    this.logger.log(`⚙️ Запрос создания операции в 1С для интеграции ${endpoint.name}`);

    return await this.onecProcessor.processOneCRequest(request, endpoint);
  }

  @Get(':endpointId/exchanges')
  @ApiOperation({ 
    summary: 'Получить обмены с 1С',
    description: 'Возвращает историю и статистику обменов данными с 1С'
  })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Обмены получены',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: {
          type: 'object',
          properties: {
            totalClients: { type: 'number' },
            totalServices: { type: 'number' },
            totalDocuments: { type: 'number' },
            exchangesByType: { type: 'object' },
            exchangesByStatus: { type: 'object' },
            recentExchanges: { type: 'array' },
            errorSummary: { type: 'object' },
            performanceStats: { type: 'object' }
          }
        }
      }
    }
  })
  @ApiParam({ name: 'endpointId', description: 'UUID интеграции 1С' })
  async getExchanges(@Param('endpointId') endpointId: string) {
    const endpoint = await this.validateOneCEndpoint(endpointId);

    const request: OneCProcessingRequest = {
      endpointId,
      action: 'get_exchanges',
    };

    this.logger.debug(`📋 Запрос обменов с 1С для интеграции ${endpoint.name}`);

    return await this.onecProcessor.processOneCRequest(request, endpoint);
  }

  @Post(':endpointId/manual-export')
  @ApiOperation({ 
    summary: 'Запустить ручной экспорт в 1С',
    description: 'Запускает ручной экспорт готовых к отправке данных в 1С'
  })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Экспорт запущен',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: {
          type: 'object',
          properties: {
            invoices: { type: 'object' },
            operations: { type: 'object' },
            totalProcessed: { type: 'number' }
          }
        },
        processingTime: { type: 'number' }
      }
    }
  })
  @ApiParam({ name: 'endpointId', description: 'UUID интеграции 1С' })
  @ApiBody({
    description: 'Параметры экспорта',
    schema: {
      type: 'object',
      properties: {
        metadata: {
          type: 'object',
          properties: {
            operatorId: { type: 'string' },
            organizationId: { type: 'string' },
            priority: { type: 'string', enum: ['low', 'normal', 'high', 'urgent'] }
          }
        }
      }
    },
    examples: {
      manualExport: {
        summary: 'Ручной экспорт',
        value: {
          metadata: {
            operatorId: 'OP_001',
            organizationId: 'main_org',
            priority: 'high'
          }
        }
      }
    }
  })
  async manualExport(
    @Param('endpointId') endpointId: string,
    @Body() body: { metadata?: any },
  ) {
    const endpoint = await this.validateOneCEndpoint(endpointId);

    const request: OneCProcessingRequest = {
      endpointId,
      action: 'manual_export',
      metadata: body.metadata,
    };

    this.logger.log(`📤 Запрос ручного экспорта в 1С для интеграции ${endpoint.name}`);

    return await this.onecProcessor.processOneCRequest(request, endpoint);
  }

  @Get(':endpointId/business-events')
  @ApiOperation({ 
    summary: 'Получить бизнес-события',
    description: 'Возвращает список бизнес-событий, созданных на основе обменов с 1С'
  })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Бизнес-события получены',
    schema: {
      type: 'object',
      properties: {
        events: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              eventId: { type: 'string' },
              eventType: { type: 'string' },
              timestamp: { type: 'string', format: 'date-time' },
              businessData: { type: 'object' },
              affectedEntities: { type: 'array' }
            }
          }
        },
        total: { type: 'number' }
      }
    }
  })
  @ApiParam({ name: 'endpointId', description: 'UUID интеграции 1С' })
  @ApiQuery({ name: 'eventType', required: false, description: 'Фильтр по типу события' })
  @ApiQuery({ name: 'limit', required: false, description: 'Максимальное количество событий' })
  async getBusinessEvents(
    @Param('endpointId') endpointId: string,
    @Query('eventType') eventType?: string,
    @Query('limit') limit?: string,
  ) {
    const endpoint = await this.validateOneCEndpoint(endpointId);

    const events = await this.onecProcessor.getBusinessEvents(eventType as any);
    const limitNum = limit ? parseInt(limit) : 50;
    const limitedEvents = events.slice(0, limitNum);

    this.logger.debug(`🎯 Запрос бизнес-событий для интеграции ${endpoint.name}: ${limitedEvents.length} событий`);

    return {
      events: limitedEvents,
      total: events.length,
      filtered: !!eventType,
      lastUpdate: new Date(),
    };
  }

  @Get(':endpointId/stats')
  @ApiOperation({ 
    summary: 'Получить статистику 1С интеграции',
    description: 'Возвращает статистику работы интеграции с 1С'
  })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Статистика получена',
    schema: {
      type: 'object',
      properties: {
        oneC: { type: 'object' },
        processedClients: { type: 'number' },
        processedServices: { type: 'number' },
        processedDocuments: { type: 'number' },
        businessEvents: { type: 'number' },
        exchangeHistory: { type: 'number' },
        lastUpdate: { type: 'string', format: 'date-time' }
      }
    }
  })
  @ApiParam({ name: 'endpointId', description: 'UUID интеграции 1С' })
  async getStats(@Param('endpointId') endpointId: string) {
    const endpoint = await this.validateOneCEndpoint(endpointId);

    return await this.onecProcessor.getProcessingStats(endpointId);
  }

  @Get(':endpointId/health')
  @ApiOperation({ 
    summary: 'Проверить здоровье 1С интеграции',
    description: 'Возвращает статус здоровья интеграции с 1С'
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
  @ApiParam({ name: 'endpointId', description: 'UUID интеграции 1С' })
  async getHealth(@Param('endpointId') endpointId: string) {
    const endpoint = await this.validateOneCEndpoint(endpointId);

    return await this.onecProcessor.healthCheck();
  }

  @Post(':endpointId/test-connection')
  @ApiOperation({ 
    summary: 'Тестировать 1С соединение',
    description: 'Выполняет тест соединения с базой 1С'
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
  @ApiParam({ name: 'endpointId', description: 'UUID интеграции 1С' })
  async testConnection(@Param('endpointId') endpointId: string) {
    const startTime = Date.now();
    const endpoint = await this.validateOneCEndpoint(endpointId);

    try {
      const success = await this.onecProcessor.testOneCConnection(endpoint);
      const responseTime = Date.now() - startTime;

      this.logger.log(`${success ? '✅' : '❌'} Тест 1С соединения для ${endpoint.name}: ${responseTime}ms`);

      return {
        success,
        message: success 
          ? `Тест соединения с 1С базой ${endpoint.name} успешен`
          : `Ошибка соединения с 1С базой ${endpoint.name}`,
        responseTime,
        details: {
          database: endpoint.connectionConfig.onecConfig?.database,
          webServicePath: endpoint.connectionConfig.onecConfig?.webServicePath,
          authType: endpoint.connectionConfig.onecConfig?.authentication?.type,
          exchangePlans: endpoint.connectionConfig.onecConfig?.exchangePlans?.length || 0,
        },
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      this.logger.error(`❌ Тест 1С соединения неудачен для ${endpoint.name}:`, error.message);

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
    summary: 'Очистить данные 1С',
    description: 'Очищает кешированные данные и историю обменов'
  })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Данные очищены'
  })
  @ApiParam({ name: 'endpointId', description: 'UUID интеграции 1С' })
  @ApiQuery({ name: 'eventId', required: false, description: 'ID конкретного события (если не указан, очищаются все)' })
  async clearData(
    @Param('endpointId') endpointId: string,
    @Query('eventId') eventId?: string,
  ) {
    const endpoint = await this.validateOneCEndpoint(endpointId);

    await this.onecProcessor.clearBusinessData(eventId);

    const message = eventId 
      ? `Данные 1С события ${eventId} очищены`
      : 'Все данные 1С обменов очищены';

    this.logger.log(`🧹 ${message} для интеграции ${endpoint.name}`);

    return {
      message,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('supported-documents')
  @ApiOperation({ 
    summary: 'Получить поддерживаемые типы документов 1С',
    description: 'Возвращает список поддерживаемых типов документов и операций'
  })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Список поддерживаемых документов',
    schema: {
      type: 'object',
      properties: {
        documentTypes: { type: 'array' },
        operationTypes: { type: 'array' },
        exchangePlans: { type: 'array' },
        features: { type: 'array' }
      }
    }
  })
  async getSupportedDocuments() {
    return {
      documentTypes: [
        {
          code: 'SalesInvoice',
          name: 'Счет на оплату',
          description: 'Счет на оплату услуг терминала',
          direction: 'export',
          mandatory: ['clientId', 'lines'],
          fields: ['documentNumber', 'documentDate', 'organization', 'counterparty', 'currency', 'amount']
        },
        {
          code: 'PurchaseInvoice',
          name: 'Счет поставщика',
          description: 'Счет от поставщика услуг',
          direction: 'import',
          mandatory: ['organization', 'counterparty'],
          fields: ['documentNumber', 'documentDate', 'currency', 'amount']
        },
        {
          code: 'ServiceAct',
          name: 'Акт выполненных работ',
          description: 'Акт об оказанных услугах терминала',
          direction: 'export',
          mandatory: ['clientId', 'lines'],
          fields: ['documentNumber', 'documentDate', 'services']
        },
        {
          code: 'ContainerOperation',
          name: 'Операция с контейнером',
          description: 'Документ операции с контейнером',
          direction: 'export',
          mandatory: ['containerNumber', 'operationType'],
          fields: ['operationType', 'equipmentId', 'operatorId', 'timestamp']
        },
        {
          code: 'VesselOperation',
          name: 'Операция с судном',
          description: 'Документ операции с судном',
          direction: 'export',
          mandatory: ['vesselName', 'operationType'],
          fields: ['vesselName', 'voyage', 'portCode', 'operationType']
        }
      ],
      operationTypes: [
        'gate_in',           // Въезд на терминал
        'gate_out',          // Выезд с терминала
        'discharge',         // Выгрузка с судна
        'load',             // Погрузка на судно
        'shift',            // Перемещение по терминалу
        'inspection',       // Осмотр контейнера
        'weighing',         // Взвешивание
        'customs_inspection', // Таможенный осмотр
        'repair_start',     // Начало ремонта
        'repair_complete'   // Завершение ремонта
      ],
      exchangePlans: [
        {
          name: 'clients',
          direction: 'import',
          description: 'Импорт справочника контрагентов',
          schedule: 'daily',
          entities: ['Catalog.Counterparties']
        },
        {
          name: 'services',
          direction: 'import',
          description: 'Импорт справочника услуг',
          schedule: 'daily',
          entities: ['Catalog.Services']
        },
        {
          name: 'invoices',
          direction: 'export',
          description: 'Экспорт счетов на оплату',
          schedule: 'realtime',
          entities: ['Document.SalesInvoice']
        },
        {
          name: 'operations',
          direction: 'export',
          description: 'Экспорт операций с контейнерами',
          schedule: 'hourly',
          entities: ['Document.ContainerOperation', 'Document.VesselOperation']
        },
        {
          name: 'documents',
          direction: 'import',
          description: 'Импорт финансовых документов',
          schedule: 'hourly',
          entities: ['Document.*']
        }
      ],
      russianFeatures: [
        'inn_validation',     // Валидация ИНН
        'kpp_validation',     // Валидация КПП
        'ogrn_validation',    // Валидация ОГРН
        'vat_calculation',    // Расчет НДС
        'ruble_currency',     // Поддержка рублей
        'russian_addresses',  // Российские адреса
        'contract_management', // Управление договорами
        'payment_terms'       // Условия оплаты
      ],
      features: [
        'web_service_integration',  // Интеграция через веб-сервисы
        'real_time_sync',          // Синхронизация в реальном времени
        'batch_operations',        // Пакетные операции
        'error_handling',          // Обработка ошибок
        'data_validation',         // Валидация данных
        'audit_trail',             // Аудиторский след
        'retry_logic',             // Логика повторных попыток
        'data_mapping',            // Сопоставление данных
        'exchange_monitoring',     // Мониторинг обменов
        'manual_override'          // Ручное управление
      ],
      authenticationTypes: [
        'basic',    // Basic Authentication
        'digest',   // Digest Authentication
        'ntlm',     // NTLM (Windows)
        'oauth'     // OAuth 2.0
      ],
      supportedFormats: ['xml', 'json'],
      supportedProtocols: ['http', 'https'],
    };
  }

  private async validateOneCEndpoint(endpointId: string) {
    const endpoint = await this.integrationEndpointService.findOne(endpointId);
    
    if (endpoint.type !== IntegrationType.ONEC_INTEGRATION) {
      throw new BadRequestException(`Интеграция ${endpoint.name} не является 1С интеграцией`);
    }

    if (!endpoint.isActive) {
      throw new BadRequestException(`Интеграция ${endpoint.name} неактивна`);
    }

    return endpoint;
  }
}