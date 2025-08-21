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
  EdiProcessor, 
  EdiProcessingRequest, 
  EdiMessageSummary 
} from '../processors/edi.processor';
import { EdiMessageType } from '../adapters/edi.adapter';
import { IntegrationEndpointService } from '../services/integration-endpoint.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { IntegrationType } from '../entities/integration-endpoint.entity';

@ApiTags('EDI Exchange')
@Controller('edi')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT')
export class EdiController {
  private readonly logger = new Logger(EdiController.name);

  constructor(
    private readonly ediProcessor: EdiProcessor,
    private readonly integrationEndpointService: IntegrationEndpointService,
  ) {}

  @Post(':endpointId/send-message')
  @ApiOperation({ 
    summary: 'Отправить EDI сообщение',
    description: 'Отправляет EDI сообщение указанного типа контейнерной линии'
  })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Сообщение отправлено',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: { type: 'string', description: 'ID отправленного сообщения' },
        processingTime: { type: 'number' },
        connectionStats: { type: 'object' }
      }
    }
  })
  @ApiParam({ name: 'endpointId', description: 'UUID интеграции EDI' })
  @ApiBody({
    description: 'Данные EDI сообщения',
    schema: {
      type: 'object',
      properties: {
        messageType: { 
          type: 'string', 
          enum: ['CODECO', 'COPRAR', 'COPARN', 'COARRI', 'CODEPS', 'COHAUL', 'MOVINS', 'BAPLIE', 'CALINF'],
          description: 'Тип EDI сообщения'
        },
        data: { type: 'object', description: 'Данные сообщения' },
        metadata: {
          type: 'object',
          properties: {
            operatorId: { type: 'string' },
            priority: { type: 'string', enum: ['low', 'normal', 'high', 'urgent'] },
            correlationId: { type: 'string' }
          }
        }
      },
      required: ['messageType', 'data']
    },
    examples: {
      codecoDischarge: {
        summary: 'CODECO - Выгрузка контейнеров',
        value: {
          messageType: 'CODECO',
          data: {
            operation: 'discharge',
            vessel: {
              vesselName: 'MSC OSCAR',
              voyage: '2401E',
              portCode: 'RUMP'
            },
            containers: [
              {
                containerNumber: 'MSCU1234567',
                containerType: 'GP',
                containerSize: '40',
                weight: { gross: 25000, unit: 'KGM' }
              }
            ]
          },
          metadata: {
            operatorId: 'OP_001',
            priority: 'high'
          }
        }
      },
      coprarReport: {
        summary: 'COPRAR - Отчет о выгрузке',
        value: {
          messageType: 'COPRAR',
          data: {
            events: [
              {
                eventCode: 'DIS',
                eventDate: '20240120',
                eventTime: '1430',
                location: 'RUMP'
              }
            ],
            containers: [
              {
                containerNumber: 'MSCU1234567',
                containerType: 'GP',
                containerSize: '40'
              }
            ]
          }
        }
      },
      baplieStowage: {
        summary: 'BAPLIE - План размещения',
        value: {
          messageType: 'BAPLIE',
          data: {
            vessel: {
              vesselName: 'MAERSK ESSEX',
              voyage: '2401W',
              portCode: 'RUMP'
            },
            stowagePlan: {
              occupiedLocations: ['010204', '010206'],
              emptyLocations: ['010208', '010210']
            }
          }
        }
      }
    }
  })
  async sendMessage(
    @Param('endpointId') endpointId: string,
    @Body() body: { messageType: EdiMessageType; data: any; metadata?: any },
  ) {
    const endpoint = await this.validateEdiEndpoint(endpointId);

    if (!body.messageType || !body.data) {
      throw new BadRequestException('Необходимо указать тип сообщения и данные');
    }

    const request: EdiProcessingRequest = {
      endpointId,
      action: 'send_message',
      messageType: body.messageType,
      data: body.data,
      metadata: body.metadata,
    };

    this.logger.log(`📤 Запрос отправки EDI сообщения ${body.messageType} для интеграции ${endpoint.name}`);

    return await this.ediProcessor.processEdiRequest(request, endpoint);
  }

  @Post(':endpointId/resend-message')
  @ApiOperation({ 
    summary: 'Повторно отправить EDI сообщение',
    description: 'Повторно отправляет ранее созданное EDI сообщение'
  })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Сообщение переотправлено'
  })
  @ApiParam({ name: 'endpointId', description: 'UUID интеграции EDI' })
  @ApiBody({
    description: 'ID сообщения для повторной отправки',
    schema: {
      type: 'object',
      properties: {
        messageId: { type: 'string', description: 'ID исходного сообщения' },
        metadata: { type: 'object' }
      },
      required: ['messageId']
    },
    examples: {
      resendMessage: {
        summary: 'Повторная отправка',
        value: {
          messageId: 'CODECO_12345678',
          metadata: {
            operatorId: 'OP_001',
            reason: 'transmission_failure'
          }
        }
      }
    }
  })
  async resendMessage(
    @Param('endpointId') endpointId: string,
    @Body() body: { messageId: string; metadata?: any },
  ) {
    const endpoint = await this.validateEdiEndpoint(endpointId);

    if (!body.messageId) {
      throw new BadRequestException('Необходимо указать ID сообщения');
    }

    const request: EdiProcessingRequest = {
      endpointId,
      action: 'resend_message',
      messageId: body.messageId,
      metadata: body.metadata,
    };

    this.logger.log(`🔄 Запрос повторной отправки EDI сообщения ${body.messageId} для интеграции ${endpoint.name}`);

    return await this.ediProcessor.processEdiRequest(request, endpoint);
  }

  @Get(':endpointId/messages')
  @ApiOperation({ 
    summary: 'Получить EDI сообщения',
    description: 'Возвращает сводку по EDI сообщениям для указанной интеграции'
  })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Сводка сообщений получена',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: {
          type: 'object',
          properties: {
            totalMessages: { type: 'number' },
            messagesByType: { type: 'object' },
            messagesByStatus: { type: 'object' },
            recentMessages: { type: 'array' },
            errorSummary: { type: 'object' },
            throughputStats: { type: 'object' }
          }
        }
      }
    }
  })
  @ApiParam({ name: 'endpointId', description: 'UUID интеграции EDI' })
  @ApiQuery({ name: 'messageType', required: false, description: 'Фильтр по типу сообщения' })
  @ApiQuery({ name: 'status', required: false, description: 'Фильтр по статусу' })
  async getMessages(
    @Param('endpointId') endpointId: string,
    @Query('messageType') messageType?: EdiMessageType,
    @Query('status') status?: string,
  ) {
    const endpoint = await this.validateEdiEndpoint(endpointId);

    const request: EdiProcessingRequest = {
      endpointId,
      action: 'get_messages',
      metadata: {
        messageType,
        status,
      },
    };

    this.logger.debug(`📋 Запрос списка EDI сообщений для интеграции ${endpoint.name}`);

    const result = await this.ediProcessor.processEdiRequest(request, endpoint);
    return result;
  }

  @Get(':endpointId/messages/:messageId')
  @ApiOperation({ 
    summary: 'Получить конкретное EDI сообщение',
    description: 'Возвращает детальную информацию о EDI сообщении'
  })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Сообщение найдено',
    schema: {
      type: 'object',
      properties: {
        messageId: { type: 'string' },
        messageType: { type: 'string' },
        status: { type: 'string' },
        timestamp: { type: 'string', format: 'date-time' },
        segments: { type: 'array' },
        businessData: { type: 'object' },
        errors: { type: 'array' }
      }
    }
  })
  @ApiResponse({ 
    status: HttpStatus.NOT_FOUND, 
    description: 'Сообщение не найдено' 
  })
  @ApiParam({ name: 'endpointId', description: 'UUID интеграции EDI' })
  @ApiParam({ name: 'messageId', description: 'ID EDI сообщения' })
  async getMessage(
    @Param('endpointId') endpointId: string,
    @Param('messageId') messageId: string,
  ) {
    const endpoint = await this.validateEdiEndpoint(endpointId);

    const message = await this.ediProcessor.getMessage(messageId);
    
    if (!message) {
      throw new BadRequestException(`EDI сообщение ${messageId} не найдено`);
    }

    this.logger.debug(`📋 Запрос информации о EDI сообщении ${messageId} для интеграции ${endpoint.name}`);

    return {
      messageId: message.messageId,
      messageType: message.messageType,
      status: message.status,
      timestamp: message.timestamp,
      controlNumber: message.controlNumber,
      sender: message.sender,
      receiver: message.receiver,
      segmentCount: message.segments.length,
      segments: message.segments.slice(0, 10), // Первые 10 сегментов для превью
      errors: message.errors,
      testIndicator: message.testIndicator,
    };
  }

  @Post(':endpointId/validate-message')
  @ApiOperation({ 
    summary: 'Валидировать EDI сообщение',
    description: 'Выполняет валидацию структуры и содержимого EDI сообщения'
  })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Результат валидации',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: {
          type: 'object',
          properties: {
            isValid: { type: 'boolean' },
            errors: { type: 'array' },
            segmentCount: { type: 'number' },
            validationDetails: { type: 'object' }
          }
        }
      }
    }
  })
  @ApiParam({ name: 'endpointId', description: 'UUID интеграции EDI' })
  @ApiBody({
    description: 'ID сообщения для валидации',
    schema: {
      type: 'object',
      properties: {
        messageId: { type: 'string', description: 'ID сообщения' }
      },
      required: ['messageId']
    },
    examples: {
      validateMessage: {
        summary: 'Валидация сообщения',
        value: {
          messageId: 'CODECO_12345678'
        }
      }
    }
  })
  async validateMessage(
    @Param('endpointId') endpointId: string,
    @Body() body: { messageId: string },
  ) {
    const endpoint = await this.validateEdiEndpoint(endpointId);

    if (!body.messageId) {
      throw new BadRequestException('Необходимо указать ID сообщения');
    }

    const request: EdiProcessingRequest = {
      endpointId,
      action: 'validate_message',
      messageId: body.messageId,
    };

    this.logger.log(`🔍 Запрос валидации EDI сообщения ${body.messageId} для интеграции ${endpoint.name}`);

    return await this.ediProcessor.processEdiRequest(request, endpoint);
  }

  @Get(':endpointId/business-events')
  @ApiOperation({ 
    summary: 'Получить бизнес-события',
    description: 'Возвращает список бизнес-событий, созданных на основе EDI сообщений'
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
              sourceMessage: { type: 'object' },
              businessData: { type: 'object' },
              affectedEntities: { type: 'array' }
            }
          }
        },
        total: { type: 'number' }
      }
    }
  })
  @ApiParam({ name: 'endpointId', description: 'UUID интеграции EDI' })
  @ApiQuery({ name: 'eventType', required: false, description: 'Фильтр по типу события' })
  @ApiQuery({ name: 'limit', required: false, description: 'Максимальное количество событий' })
  async getBusinessEvents(
    @Param('endpointId') endpointId: string,
    @Query('eventType') eventType?: string,
    @Query('limit') limit?: string,
  ) {
    const endpoint = await this.validateEdiEndpoint(endpointId);

    const events = await this.ediProcessor.getBusinessEvents(eventType as any);
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

  @Get(':endpointId/message-history')
  @ApiOperation({ 
    summary: 'Получить историю сообщений',
    description: 'Возвращает хронологическую историю EDI сообщений'
  })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'История получена',
    schema: {
      type: 'object',
      properties: {
        messages: { type: 'array' },
        total: { type: 'number' },
        summary: { type: 'object' }
      }
    }
  })
  @ApiParam({ name: 'endpointId', description: 'UUID интеграции EDI' })
  @ApiQuery({ name: 'days', required: false, description: 'Количество дней назад (по умолчанию 7)' })
  async getMessageHistory(
    @Param('endpointId') endpointId: string,
    @Query('days') days?: string,
  ) {
    const endpoint = await this.validateEdiEndpoint(endpointId);

    const daysNum = days ? parseInt(days) : 7;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysNum);

    const allMessages = await this.ediProcessor.getMessageHistory(endpointId);
    const recentMessages = allMessages.filter(m => m.timestamp >= cutoffDate);

    // Группируем по дням для сводки
    const dailySummary = recentMessages.reduce((acc, message) => {
      const day = message.timestamp.toDateString();
      if (!acc[day]) {
        acc[day] = { total: 0, byType: {}, byStatus: {} };
      }
      acc[day].total++;
      acc[day].byType[message.messageType] = (acc[day].byType[message.messageType] || 0) + 1;
      acc[day].byStatus[message.status] = (acc[day].byStatus[message.status] || 0) + 1;
      return acc;
    }, {});

    this.logger.debug(`📜 Запрос истории EDI сообщений для интеграции ${endpoint.name}: ${recentMessages.length} сообщений за ${daysNum} дней`);

    return {
      messages: recentMessages.map(m => ({
        messageId: m.messageId,
        messageType: m.messageType,
        status: m.status,
        timestamp: m.timestamp,
        controlNumber: m.controlNumber,
        errorCount: m.errors?.length || 0,
      })),
      total: recentMessages.length,
      period: `${daysNum} days`,
      summary: dailySummary,
    };
  }

  @Get(':endpointId/stats')
  @ApiOperation({ 
    summary: 'Получить статистику EDI обработки',
    description: 'Возвращает статистику работы EDI интеграции'
  })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Статистика получена',
    schema: {
      type: 'object',
      properties: {
        edi: { type: 'object' },
        processedMessages: { type: 'number' },
        businessEvents: { type: 'number' },
        messageHistory: { type: 'number' },
        lastUpdate: { type: 'string', format: 'date-time' }
      }
    }
  })
  @ApiParam({ name: 'endpointId', description: 'UUID интеграции EDI' })
  async getStats(@Param('endpointId') endpointId: string) {
    const endpoint = await this.validateEdiEndpoint(endpointId);

    return await this.ediProcessor.getProcessingStats(endpointId);
  }

  @Get(':endpointId/health')
  @ApiOperation({ 
    summary: 'Проверить здоровье EDI интеграции',
    description: 'Возвращает статус здоровья EDI интеграции'
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
  @ApiParam({ name: 'endpointId', description: 'UUID интеграции EDI' })
  async getHealth(@Param('endpointId') endpointId: string) {
    const endpoint = await this.validateEdiEndpoint(endpointId);

    return await this.ediProcessor.healthCheck();
  }

  @Post(':endpointId/test-connection')
  @ApiOperation({ 
    summary: 'Тестировать EDI соединение',
    description: 'Выполняет тест соединения с EDI партнером'
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
  @ApiParam({ name: 'endpointId', description: 'UUID интеграции EDI' })
  async testConnection(@Param('endpointId') endpointId: string) {
    const startTime = Date.now();
    const endpoint = await this.validateEdiEndpoint(endpointId);

    try {
      const success = await this.ediProcessor.testEdiConnection(endpoint);
      const responseTime = Date.now() - startTime;

      this.logger.log(`${success ? '✅' : '❌'} Тест EDI соединения для ${endpoint.name}: ${responseTime}ms`);

      return {
        success,
        message: success 
          ? `Тест соединения с EDI партнером ${endpoint.name} успешен`
          : `Ошибка соединения с EDI партнером ${endpoint.name}`,
        responseTime,
        details: {
          protocol: endpoint.connectionConfig.ediConfig?.protocol,
          messageTypes: endpoint.connectionConfig.ediConfig?.messageTypes || [],
          testMode: endpoint.connectionConfig.ediConfig?.testMode,
        },
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      this.logger.error(`❌ Тест EDI соединения неудачен для ${endpoint.name}:`, error.message);

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
    summary: 'Очистить данные EDI',
    description: 'Очищает кешированные EDI сообщения и события'
  })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Данные очищены'
  })
  @ApiParam({ name: 'endpointId', description: 'UUID интеграции EDI' })
  @ApiQuery({ name: 'messageId', required: false, description: 'ID конкретного сообщения (если не указан, очищаются все)' })
  async clearData(
    @Param('endpointId') endpointId: string,
    @Query('messageId') messageId?: string,
  ) {
    const endpoint = await this.validateEdiEndpoint(endpointId);

    await this.ediProcessor.clearMessageData(messageId);

    const message = messageId 
      ? `Данные EDI сообщения ${messageId} очищены`
      : 'Все данные EDI очищены';

    this.logger.log(`🧹 ${message} для интеграции ${endpoint.name}`);

    return {
      message,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('supported-messages')
  @ApiOperation({ 
    summary: 'Получить поддерживаемые типы EDI сообщений',
    description: 'Возвращает список поддерживаемых типов EDI сообщений и их описания'
  })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Список поддерживаемых сообщений',
    schema: {
      type: 'object',
      properties: {
        messageTypes: { type: 'array' },
        protocols: { type: 'array' },
        standards: { type: 'array' },
        features: { type: 'array' }
      }
    }
  })
  async getSupportedMessages() {
    return {
      messageTypes: [
        {
          code: 'CODECO',
          name: 'Container Discharge/Loading Order',
          description: 'Инструкция по выгрузке/погрузке контейнеров',
          direction: 'outbound',
          mandatory: ['containers', 'vessel']
        },
        {
          code: 'COPRAR',
          name: 'Container Discharge/Loading Report',
          description: 'Отчет о выгрузке/погрузке контейнеров',
          direction: 'outbound',
          mandatory: ['containers', 'events']
        },
        {
          code: 'COPARN',
          name: 'Container Announcement',
          description: 'Объявление о контейнерах',
          direction: 'inbound',
          mandatory: ['containers']
        },
        {
          code: 'COARRI',
          name: 'Container Arrival Report',
          description: 'Отчет о прибытии контейнеров',
          direction: 'inbound',
          mandatory: ['containers', 'arrival']
        },
        {
          code: 'BAPLIE',
          name: 'Bayplan/Stowage Plan',
          description: 'План размещения контейнеров на судне',
          direction: 'inbound',
          mandatory: ['vessel', 'stowagePlan']
        },
        {
          code: 'CALINF',
          name: 'Vessel Call Information',
          description: 'Информация о заходе судна',
          direction: 'inbound',
          mandatory: ['vessel']
        }
      ],
      protocols: [
        'ftp',    // File Transfer Protocol
        'sftp',   // Secure FTP
        'ftps',   // FTP over SSL/TLS
        'http',   // HTTP
        'https',  // HTTP over SSL/TLS
        'as2',    // Applicability Statement 2
        'directory' // File system directory
      ],
      standards: [
        'EDIFACT D.03B',  // UN/EDIFACT Directory
        'ANSI X12',       // American National Standards Institute
        'XML',            // Extensible Markup Language
        'JSON'            // JavaScript Object Notation
      ],
      features: [
        'message_validation',    // Валидация сообщений
        'acknowledgment_support', // Поддержка подтверждений
        'error_handling',        // Обработка ошибок
        'retry_logic',          // Логика повторных попыток
        'encryption_support',   // Поддержка шифрования
        'compression_support',  // Поддержка сжатия
        'test_mode',           // Тестовый режим
        'audit_trail',         // Аудиторский след
        'business_rules',      // Бизнес-правила валидации
        'format_conversion'    // Конвертация форматов
      ],
      businessEvents: [
        'vessel_arrival',        // Прибытие судна
        'vessel_departure',      // Отправление судна
        'container_discharge',   // Выгрузка контейнера
        'container_load',        // Погрузка контейнера
        'booking_update',        // Обновление бронирования
        'stowage_plan'          // План размещения
      ],
    };
  }

  private async validateEdiEndpoint(endpointId: string) {
    const endpoint = await this.integrationEndpointService.findOne(endpointId);
    
    if (endpoint.type !== IntegrationType.EDI_EXCHANGE) {
      throw new BadRequestException(`Интеграция ${endpoint.name} не является EDI интеграцией`);
    }

    if (!endpoint.isActive) {
      throw new BadRequestException(`Интеграция ${endpoint.name} неактивна`);
    }

    return endpoint;
  }
}