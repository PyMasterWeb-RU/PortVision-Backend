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
  FileMonitorProcessor, 
  FileMonitorProcessingRequest, 
  FileBatchReport 
} from '../processors/file-monitor.processor';
import { IntegrationEndpointService } from '../services/integration-endpoint.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { IntegrationType } from '../entities/integration-endpoint.entity';

@ApiTags('File Monitor')
@Controller('file-monitor')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT')
export class FileMonitorController {
  private readonly logger = new Logger(FileMonitorController.name);

  constructor(
    private readonly fileMonitorProcessor: FileMonitorProcessor,
    private readonly integrationEndpointService: IntegrationEndpointService,
  ) {}

  @Post(':endpointId/start-monitoring')
  @ApiOperation({ 
    summary: 'Запустить мониторинг файлов',
    description: 'Начинает мониторинг указанных путей для обнаружения файлов'
  })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Мониторинг запущен',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            watchPaths: { type: 'array' },
            eventId: { type: 'string' }
          }
        },
        processingTime: { type: 'number' },
        monitoringStats: { type: 'object' }
      }
    }
  })
  @ApiParam({ name: 'endpointId', description: 'UUID интеграции File Monitor' })
  @ApiBody({
    description: 'Параметры запуска мониторинга',
    schema: {
      type: 'object',
      properties: {
        metadata: {
          type: 'object',
          properties: {
            operatorId: { type: 'string' },
            sessionId: { type: 'string' },
            priority: { type: 'string', enum: ['low', 'normal', 'high', 'urgent'] }
          }
        }
      }
    },
    examples: {
      startMonitoring: {
        summary: 'Запуск мониторинга',
        value: {
          metadata: {
            operatorId: 'OP_001',
            sessionId: 'session_123',
            priority: 'normal'
          }
        }
      }
    }
  })
  async startMonitoring(
    @Param('endpointId') endpointId: string,
    @Body() body: { metadata?: any },
  ) {
    const endpoint = await this.validateFileMonitorEndpoint(endpointId);

    const request: FileMonitorProcessingRequest = {
      endpointId,
      action: 'start_monitoring',
      metadata: body.metadata,
    };

    this.logger.log(`📂 Запрос запуска мониторинга файлов для интеграции ${endpoint.name}`);

    return await this.fileMonitorProcessor.processFileMonitorRequest(request, endpoint);
  }

  @Post(':endpointId/stop-monitoring')
  @ApiOperation({ 
    summary: 'Остановить мониторинг файлов',
    description: 'Останавливает мониторинг файлов для указанной интеграции'
  })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Мониторинг остановлен',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            eventId: { type: 'string' }
          }
        }
      }
    }
  })
  @ApiParam({ name: 'endpointId', description: 'UUID интеграции File Monitor' })
  async stopMonitoring(@Param('endpointId') endpointId: string) {
    const endpoint = await this.validateFileMonitorEndpoint(endpointId);

    const request: FileMonitorProcessingRequest = {
      endpointId,
      action: 'stop_monitoring',
    };

    this.logger.log(`🛑 Запрос остановки мониторинга файлов для интеграции ${endpoint.name}`);

    return await this.fileMonitorProcessor.processFileMonitorRequest(request, endpoint);
  }

  @Get(':endpointId/events')
  @ApiOperation({ 
    summary: 'Получить файловые события',
    description: 'Возвращает список обнаруженных файловых событий'
  })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'События получены',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: {
          type: 'object',
          properties: {
            totalFiles: { type: 'number' },
            filesByType: { type: 'object' },
            filesByStatus: { type: 'object' },
            processingJobs: { type: 'object' },
            recentFiles: { type: 'array' },
            errorSummary: { type: 'object' },
            throughputStats: { type: 'object' }
          }
        }
      }
    }
  })
  @ApiParam({ name: 'endpointId', description: 'UUID интеграции File Monitor' })
  @ApiQuery({ name: 'fileType', required: false, description: 'Фильтр по типу файла (расширение)' })
  @ApiQuery({ name: 'status', required: false, description: 'Фильтр по статусу обработки' })
  async getEvents(
    @Param('endpointId') endpointId: string,
    @Query('fileType') fileType?: string,
    @Query('status') status?: string,
  ) {
    const endpoint = await this.validateFileMonitorEndpoint(endpointId);

    const request: FileMonitorProcessingRequest = {
      endpointId,
      action: 'get_events',
      metadata: {
        fileType,
        status,
      },
    };

    this.logger.debug(`📋 Запрос файловых событий для интеграции ${endpoint.name}`);

    return await this.fileMonitorProcessor.processFileMonitorRequest(request, endpoint);
  }

  @Get(':endpointId/jobs')
  @ApiOperation({ 
    summary: 'Получить задачи обработки',
    description: 'Возвращает список задач обработки файлов'
  })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Задачи получены',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: {
          type: 'object',
          properties: {
            jobs: { type: 'array' },
            total: { type: 'number' },
            summary: { type: 'object' }
          }
        }
      }
    }
  })
  @ApiParam({ name: 'endpointId', description: 'UUID интеграции File Monitor' })
  @ApiQuery({ name: 'status', required: false, description: 'Фильтр по статусу задачи' })
  async getJobs(
    @Param('endpointId') endpointId: string,
    @Query('status') status?: string,
  ) {
    const endpoint = await this.validateFileMonitorEndpoint(endpointId);

    const request: FileMonitorProcessingRequest = {
      endpointId,
      action: 'get_jobs',
      metadata: {
        status,
      },
    };

    this.logger.debug(`📋 Запрос задач обработки для интеграции ${endpoint.name}`);

    return await this.fileMonitorProcessor.processFileMonitorRequest(request, endpoint);
  }

  @Post(':endpointId/process-file')
  @ApiOperation({ 
    summary: 'Обработать файл вручную',
    description: 'Принудительно запускает обработку указанного файла'
  })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Файл обработан',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: {
          type: 'object',
          properties: {
            filePath: { type: 'string' },
            status: { type: 'string' },
            timestamp: { type: 'string', format: 'date-time' }
          }
        },
        processingTime: { type: 'number' }
      }
    }
  })
  @ApiParam({ name: 'endpointId', description: 'UUID интеграции File Monitor' })
  @ApiBody({
    description: 'Параметры обработки файла',
    schema: {
      type: 'object',
      properties: {
        filePath: { type: 'string', description: 'Абсолютный путь к файлу' },
        metadata: {
          type: 'object',
          properties: {
            operatorId: { type: 'string' },
            priority: { type: 'string', enum: ['low', 'normal', 'high', 'urgent'] },
            reason: { type: 'string' }
          }
        }
      },
      required: ['filePath']
    },
    examples: {
      processFile: {
        summary: 'Ручная обработка файла',
        value: {
          filePath: '/data/import/container_data_20240120.csv',
          metadata: {
            operatorId: 'OP_001',
            priority: 'high',
            reason: 'manual_processing'
          }
        }
      }
    }
  })
  async processFile(
    @Param('endpointId') endpointId: string,
    @Body() body: { filePath: string; metadata?: any },
  ) {
    const endpoint = await this.validateFileMonitorEndpoint(endpointId);

    if (!body.filePath) {
      throw new BadRequestException('Необходимо указать путь к файлу');
    }

    const request: FileMonitorProcessingRequest = {
      endpointId,
      action: 'process_file',
      filePath: body.filePath,
      metadata: body.metadata,
    };

    this.logger.log(`🔄 Запрос ручной обработки файла ${body.filePath} для интеграции ${endpoint.name}`);

    return await this.fileMonitorProcessor.processFileMonitorRequest(request, endpoint);
  }

  @Post(':endpointId/retry-failed')
  @ApiOperation({ 
    summary: 'Повторить неудачные задачи',
    description: 'Перезапускает обработку неудачных задач'
  })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Задачи перезапущены',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: {
          type: 'object',
          properties: {
            retriedJobs: { type: 'number' },
            status: { type: 'string' }
          }
        }
      }
    }
  })
  @ApiParam({ name: 'endpointId', description: 'UUID интеграции File Monitor' })
  @ApiBody({
    description: 'Параметры повторной обработки',
    schema: {
      type: 'object',
      properties: {
        jobId: { type: 'string', description: 'ID конкретной задачи (если не указан, перезапускаются все неудачные)' },
        metadata: { type: 'object' }
      }
    },
    examples: {
      retryAllFailed: {
        summary: 'Повторить все неудачные',
        value: {
          metadata: {
            operatorId: 'OP_001'
          }
        }
      },
      retrySpecificJob: {
        summary: 'Повторить конкретную задачу',
        value: {
          jobId: 'job_file_123_456789',
          metadata: {
            operatorId: 'OP_001'
          }
        }
      }
    }
  })
  async retryFailed(
    @Param('endpointId') endpointId: string,
    @Body() body: { jobId?: string; metadata?: any },
  ) {
    const endpoint = await this.validateFileMonitorEndpoint(endpointId);

    const request: FileMonitorProcessingRequest = {
      endpointId,
      action: 'retry_failed',
      jobId: body.jobId,
      metadata: body.metadata,
    };

    this.logger.log(`🔄 Запрос повторной обработки ${body.jobId ? `задачи ${body.jobId}` : 'всех неудачных задач'} для интеграции ${endpoint.name}`);

    return await this.fileMonitorProcessor.processFileMonitorRequest(request, endpoint);
  }

  @Get(':endpointId/business-events')
  @ApiOperation({ 
    summary: 'Получить бизнес-события',
    description: 'Возвращает список бизнес-событий, созданных на основе файловых операций'
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
              sourceFile: { type: 'object' },
              businessData: { type: 'object' },
              affectedEntities: { type: 'array' }
            }
          }
        },
        total: { type: 'number' }
      }
    }
  })
  @ApiParam({ name: 'endpointId', description: 'UUID интеграции File Monitor' })
  @ApiQuery({ name: 'eventType', required: false, description: 'Фильтр по типу события' })
  @ApiQuery({ name: 'limit', required: false, description: 'Максимальное количество событий' })
  async getBusinessEvents(
    @Param('endpointId') endpointId: string,
    @Query('eventType') eventType?: string,
    @Query('limit') limit?: string,
  ) {
    const endpoint = await this.validateFileMonitorEndpoint(endpointId);

    const events = await this.fileMonitorProcessor.getBusinessEvents(eventType as any);
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
    summary: 'Получить статистику файлового мониторинга',
    description: 'Возвращает статистику работы файлового мониторинга'
  })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Статистика получена',
    schema: {
      type: 'object',
      properties: {
        fileMonitor: { type: 'object' },
        processedDetected: { type: 'number' },
        processedCompleted: { type: 'number' },
        processedErrors: { type: 'number' },
        businessEvents: { type: 'number' },
        lastUpdate: { type: 'string', format: 'date-time' }
      }
    }
  })
  @ApiParam({ name: 'endpointId', description: 'UUID интеграции File Monitor' })
  async getStats(@Param('endpointId') endpointId: string) {
    const endpoint = await this.validateFileMonitorEndpoint(endpointId);

    return await this.fileMonitorProcessor.getProcessingStats(endpointId);
  }

  @Get(':endpointId/health')
  @ApiOperation({ 
    summary: 'Проверить здоровье файлового мониторинга',
    description: 'Возвращает статус здоровья файлового мониторинга'
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
  @ApiParam({ name: 'endpointId', description: 'UUID интеграции File Monitor' })
  async getHealth(@Param('endpointId') endpointId: string) {
    const endpoint = await this.validateFileMonitorEndpoint(endpointId);

    return await this.fileMonitorProcessor.healthCheck();
  }

  @Post(':endpointId/test-connection')
  @ApiOperation({ 
    summary: 'Тестировать файловые пути',
    description: 'Выполняет проверку доступности путей для мониторинга'
  })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Тест выполнен',
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
  @ApiParam({ name: 'endpointId', description: 'UUID интеграции File Monitor' })
  async testConnection(@Param('endpointId') endpointId: string) {
    const startTime = Date.now();
    const endpoint = await this.validateFileMonitorEndpoint(endpointId);

    try {
      const success = await this.fileMonitorProcessor.testFileMonitorConnection(endpoint);
      const responseTime = Date.now() - startTime;

      this.logger.log(`${success ? '✅' : '❌'} Тест файлового мониторинга для ${endpoint.name}: ${responseTime}ms`);

      return {
        success,
        message: success 
          ? `Тест файлового мониторинга ${endpoint.name} успешен`
          : `Ошибка тестирования файлового мониторинга ${endpoint.name}`,
        responseTime,
        details: {
          watchPaths: endpoint.connectionConfig.fileMonitorConfig?.watchPaths?.length || 0,
          enabledPaths: endpoint.connectionConfig.fileMonitorConfig?.watchPaths?.filter((p: any) => p.enabled).length || 0,
          fileTypes: endpoint.connectionConfig.fileMonitorConfig?.processingRules?.fileTypes?.length || 0,
          maxConcurrentFiles: endpoint.connectionConfig.fileMonitorConfig?.settings?.maxConcurrentFiles || 0,
        },
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      this.logger.error(`❌ Тест файлового мониторинга неудачен для ${endpoint.name}:`, error.message);

      return {
        success: false,
        message: `Ошибка тестирования: ${error.message}`,
        responseTime,
        details: {
          error: error.message,
        },
      };
    }
  }

  @Post(':endpointId/clear-data')
  @ApiOperation({ 
    summary: 'Очистить данные файлового мониторинга',
    description: 'Очищает кешированные события и задачи обработки'
  })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Данные очищены'
  })
  @ApiParam({ name: 'endpointId', description: 'UUID интеграции File Monitor' })
  @ApiQuery({ name: 'eventId', required: false, description: 'ID конкретного события (если не указан, очищаются все)' })
  async clearData(
    @Param('endpointId') endpointId: string,
    @Query('eventId') eventId?: string,
  ) {
    const endpoint = await this.validateFileMonitorEndpoint(endpointId);

    await this.fileMonitorProcessor.clearBusinessData(eventId);

    const message = eventId 
      ? `Данные файлового события ${eventId} очищены`
      : 'Все данные файлового мониторинга очищены';

    this.logger.log(`🧹 ${message} для интеграции ${endpoint.name}`);

    return {
      message,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('supported-types')
  @ApiOperation({ 
    summary: 'Получить поддерживаемые типы файлов',
    description: 'Возвращает список поддерживаемых типов файлов и обработчиков'
  })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Список поддерживаемых типов',
    schema: {
      type: 'object',
      properties: {
        fileTypes: { type: 'array' },
        processors: { type: 'array' },
        encodings: { type: 'array' },
        features: { type: 'array' }
      }
    }
  })
  async getSupportedTypes() {
    return {
      fileTypes: [
        {
          extension: '.csv',
          processor: 'csv',
          description: 'Файлы с разделителями (CSV)',
          encoding: 'utf8',
          maxSize: '50MB',
          features: ['header_detection', 'delimiter_auto', 'encoding_detection']
        },
        {
          extension: '.json',
          processor: 'json',
          description: 'JSON файлы',
          encoding: 'utf8',
          maxSize: '10MB',
          features: ['validation', 'schema_check', 'pretty_print']
        },
        {
          extension: '.xml',
          processor: 'xml',
          description: 'XML файлы',
          encoding: 'utf8',
          maxSize: '20MB',
          features: ['validation', 'schema_check', 'namespace_support']
        },
        {
          extension: '.txt',
          processor: 'txt',
          description: 'Текстовые файлы',
          encoding: 'utf8',
          maxSize: '5MB',
          features: ['encoding_detection', 'line_counting', 'word_counting']
        },
        {
          extension: '.xlsx',
          processor: 'excel',
          description: 'Excel файлы',
          encoding: 'binary',
          maxSize: '100MB',
          features: ['multiple_sheets', 'cell_formatting', 'formulas']
        },
        {
          extension: '.pdf',
          processor: 'pdf',
          description: 'PDF документы',
          encoding: 'binary',
          maxSize: '50MB',
          features: ['text_extraction', 'metadata_reading', 'page_counting']
        },
        {
          extension: '.jpg',
          processor: 'image',
          description: 'JPEG изображения',
          encoding: 'binary',
          maxSize: '10MB',
          features: ['metadata_extraction', 'resize', 'format_conversion']
        },
        {
          extension: '.png',
          processor: 'image',
          description: 'PNG изображения',
          encoding: 'binary',
          maxSize: '10MB',
          features: ['metadata_extraction', 'transparency', 'compression']
        }
      ],
      processors: [
        'csv',      // CSV парсер
        'json',     // JSON парсер с валидацией
        'xml',      // XML парсер с поддержкой схем
        'txt',      // Текстовый анализатор
        'excel',    // Excel обработчик
        'pdf',      // PDF текст-экстрактор
        'image',    // Обработчик изображений
        'generic'   // Универсальный обработчик
      ],
      encodings: [
        'utf8',     // UTF-8 (по умолчанию)
        'utf16le',  // UTF-16 Little Endian
        'latin1',   // Latin-1 / ISO-8859-1
        'ascii',    // ASCII
        'binary',   // Бинарные данные
        'base64',   // Base64 кодирование
        'hex'       // Hex кодирование
      ],
      monitoringFeatures: [
        'real_time_watching',    // Мониторинг в реальном времени
        'pattern_filtering',     // Фильтрация по паттернам
        'recursive_scanning',    // Рекурсивное сканирование
        'size_limits',          // Ограничения по размеру
        'retry_logic',          // Логика повторных попыток
        'batch_processing',     // Пакетная обработка
        'error_handling',       // Обработка ошибок
        'file_locking',         // Блокировка файлов
        'checksum_validation',  // Валидация контрольных сумм
        'post_processing'       // Пост-обработка
      ],
      postProcessingOptions: [
        'move_to_processed',    // Перемещение в папку обработанных
        'move_to_error',       // Перемещение в папку ошибок
        'delete_after_processing', // Удаление после обработки
        'create_backup',       // Создание резервной копии
        'compress_processed',  // Сжатие обработанных файлов
        'log_processing'       // Логирование обработки
      ],
      businessIntegrations: [
        'container_manifests',   // Манифесты контейнеров
        'vessel_schedules',     // Расписания судов
        'gate_transactions',    // Транзакции КПП
        'yard_operations',      // Операции на терминале
        'billing_data',         // Данные для биллинга
        'equipment_logs',       // Логи оборудования
        'customs_declarations', // Таможенные декларации
        'client_documents'      // Документы клиентов
      ],
    };
  }

  private async validateFileMonitorEndpoint(endpointId: string) {
    const endpoint = await this.integrationEndpointService.findOne(endpointId);
    
    if (endpoint.type !== IntegrationType.FILE_MONITOR) {
      throw new BadRequestException(`Интеграция ${endpoint.name} не является File Monitor интеграцией`);
    }

    if (!endpoint.isActive) {
      throw new BadRequestException(`Интеграция ${endpoint.name} неактивна`);
    }

    return endpoint;
  }
}