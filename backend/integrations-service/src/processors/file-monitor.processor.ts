import {
  Injectable,
  Logger,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { 
  FileMonitorAdapter, 
  FileEvent, 
  FileContent, 
  ProcessingJob,
  FileMonitorConfig 
} from '../adapters/file-monitor.adapter';
import { DataTransformationService } from '../services/data-transformation.service';
import { RoutingService } from '../services/routing.service';
import { MetricsService } from '../services/metrics.service';
import { IntegrationEndpoint } from '../entities/integration-endpoint.entity';

export interface FileMonitorProcessingRequest {
  endpointId: string;
  action: 'start_monitoring' | 'stop_monitoring' | 'get_events' | 'get_jobs' | 'process_file' | 'retry_failed';
  eventId?: string;
  jobId?: string;
  filePath?: string;
  metadata?: {
    operatorId?: string;
    sessionId?: string;
    priority?: 'low' | 'normal' | 'high' | 'urgent';
    correlationId?: string;
  };
}

export interface FileMonitorProcessingResult {
  success: boolean;
  action: string;
  endpointId: string;
  data?: any;
  errors?: string[];
  processingTime: number;
  eventCount?: number;
  monitoringStats?: any;
  metadata?: any;
}

export interface FileBusinessEvent {
  eventId: string;
  eventType: 'file_detected' | 'file_processed' | 'batch_completed' | 'monitoring_started' | 'monitoring_stopped' | 'processing_error';
  timestamp: Date;
  sourceFile?: {
    filePath: string;
    fileName: string;
    fileSize: number;
    checksum?: string;
  };
  businessData: {
    fileEvents?: FileEvent[];
    processingJobs?: ProcessingJob[];
    batchInfo?: any;
    monitoringConfig?: any;
    processedData?: any;
  };
  affectedEntities: Array<{
    entityType: 'file' | 'batch' | 'directory' | 'job';
    entityId: string;
    action: 'create' | 'update' | 'process' | 'error' | 'complete';
  }>;
  metadata?: any;
}

export interface FileBatchReport {
  totalFiles: number;
  filesByType: Record<string, number>;
  filesByStatus: Record<string, number>;
  processingJobs: {
    total: number;
    queued: number;
    processing: number;
    completed: number;
    failed: number;
  };
  recentFiles: Array<{
    eventId: string;
    fileName: string;
    fileSize: number;
    processingStatus: string;
    timestamp: Date;
  }>;
  errorSummary: {
    totalErrors: number;
    errorsByType: Record<string, number>;
    recentErrors: string[];
  };
  throughputStats: {
    filesPerHour: number;
    filesPerDay: number;
    averageProcessingTime: number;
    totalDataProcessed: number;
  };
}

@Injectable()
export class FileMonitorProcessor {
  private readonly logger = new Logger(FileMonitorProcessor.name);
  private readonly businessEvents = new Map<string, FileBusinessEvent>();
  private readonly batchSummaries = new Map<string, any>();
  private readonly processingMetrics = new Map<string, number>();

  constructor(
    private readonly fileMonitorAdapter: FileMonitorAdapter,
    private readonly dataTransformationService: DataTransformationService,
    private readonly routingService: RoutingService,
    private readonly metricsService: MetricsService,
    private readonly eventEmitter: EventEmitter2,
  ) {
    this.setupEventListeners();
  }

  async processFileMonitorRequest(
    request: FileMonitorProcessingRequest,
    endpoint: IntegrationEndpoint,
  ): Promise<FileMonitorProcessingResult> {
    const startTime = Date.now();
    
    this.logger.log(`📁 Обработка File Monitor запроса ${request.action} для интеграции ${endpoint.name}`);

    const result: FileMonitorProcessingResult = {
      success: false,
      action: request.action,
      endpointId: request.endpointId,
      errors: [],
      processingTime: 0,
    };

    try {
      switch (request.action) {
        case 'start_monitoring':
          result.data = await this.handleStartMonitoring(endpoint);
          result.success = !!result.data;
          break;

        case 'stop_monitoring':
          result.data = await this.handleStopMonitoring(endpoint);
          result.success = true;
          break;

        case 'get_events':
          result.data = await this.handleGetEvents(endpoint, request.metadata);
          result.success = true;
          break;

        case 'get_jobs':
          result.data = await this.handleGetJobs(endpoint, request.metadata);
          result.success = true;
          break;

        case 'process_file':
          if (!request.filePath) {
            throw new Error('Не указан путь к файлу для обработки');
          }
          result.data = await this.handleProcessFile(endpoint, request.filePath, request.metadata);
          result.success = !!result.data;
          break;

        case 'retry_failed':
          result.data = await this.handleRetryFailed(endpoint, request.jobId);
          result.success = true;
          break;

        default:
          throw new Error(`Неподдерживаемое действие: ${request.action}`);
      }

      // Получаем статистику мониторинга
      const stats = await this.fileMonitorAdapter.getMonitoringStats(request.endpointId);
      result.monitoringStats = stats;
      result.eventCount = stats?.totalEvents || 0;

      result.processingTime = Date.now() - startTime;

      // Записываем метрики
      await this.metricsService.recordMessage(
        endpoint.id,
        JSON.stringify(request).length,
        result.processingTime,
      );

      this.logger.log(
        `✅ File Monitor запрос ${request.action} обработан для ${endpoint.name}: ` +
        `${result.processingTime}ms`
      );

      return result;

    } catch (error) {
      result.success = false;
      result.errors.push(error.message);
      result.processingTime = Date.now() - startTime;

      this.logger.error(`❌ Ошибка обработки File Monitor запроса ${request.action}:`, error.stack);

      await this.metricsService.recordError(
        endpoint.id,
        error.message,
        result.processingTime,
      );

      return result;
    }
  }

  private async handleStartMonitoring(endpoint: IntegrationEndpoint): Promise<any> {
    try {
      const success = await this.fileMonitorAdapter.startMonitoring(endpoint);
      
      if (success) {
        this.logger.log(`📂 Мониторинг файлов запущен для интеграции ${endpoint.name}`);

        // Создаем бизнес-событие
        const businessEvent = await this.createBusinessEvent(
          'monitoring_started',
          { monitoringConfig: endpoint.connectionConfig.fileMonitorConfig },
          endpoint,
        );

        // Сохраняем событие
        this.businessEvents.set(businessEvent.eventId, businessEvent);

        // Отправляем уведомление
        this.eventEmitter.emit('file-monitor.monitoring.started', {
          endpointId: endpoint.id,
          businessEvent,
          timestamp: new Date(),
        });

        return {
          status: 'started',
          watchPaths: endpoint.connectionConfig.fileMonitorConfig.watchPaths.filter((p: any) => p.enabled),
          eventId: businessEvent.eventId,
        };
      } else {
        throw new Error('Не удалось запустить мониторинг файлов');
      }

    } catch (error) {
      this.logger.error('❌ Ошибка запуска мониторинга файлов:', error.message);
      throw error;
    }
  }

  private async handleStopMonitoring(endpoint: IntegrationEndpoint): Promise<any> {
    try {
      await this.fileMonitorAdapter.stopMonitoring(endpoint.id);
      
      this.logger.log(`📂 Мониторинг файлов остановлен для интеграции ${endpoint.name}`);

      // Создаем бизнес-событие
      const businessEvent = await this.createBusinessEvent(
        'monitoring_stopped',
        {},
        endpoint,
      );

      // Сохраняем событие
      this.businessEvents.set(businessEvent.eventId, businessEvent);

      // Отправляем уведомление
      this.eventEmitter.emit('file-monitor.monitoring.stopped', {
        endpointId: endpoint.id,
        businessEvent,
        timestamp: new Date(),
      });

      return {
        status: 'stopped',
        eventId: businessEvent.eventId,
      };

    } catch (error) {
      this.logger.error('❌ Ошибка остановки мониторинга файлов:', error.message);
      throw error;
    }
  }

  private async handleGetEvents(endpoint: IntegrationEndpoint, metadata?: any): Promise<any> {
    try {
      const events = await this.fileMonitorAdapter.getFileEvents(endpoint.id);
      const stats = await this.fileMonitorAdapter.getMonitoringStats(endpoint.id);

      return this.buildFileReport(events, stats, endpoint);

    } catch (error) {
      this.logger.error('❌ Ошибка получения файловых событий:', error.message);
      throw error;
    }
  }

  private async handleGetJobs(endpoint: IntegrationEndpoint, metadata?: any): Promise<any> {
    try {
      const jobs = await this.fileMonitorAdapter.getProcessingJobs(endpoint.id);
      
      return {
        jobs: jobs.map(job => ({
          jobId: job.jobId,
          fileName: job.fileEvent.fileName,
          status: job.status,
          attempts: job.attempts,
          startTime: job.startTime,
          endTime: job.endTime,
          error: job.error,
        })),
        total: jobs.length,
        summary: {
          queued: jobs.filter(j => j.status === 'queued').length,
          processing: jobs.filter(j => j.status === 'processing').length,
          completed: jobs.filter(j => j.status === 'completed').length,
          failed: jobs.filter(j => j.status === 'failed').length,
        },
      };

    } catch (error) {
      this.logger.error('❌ Ошибка получения задач обработки:', error.message);
      throw error;
    }
  }

  private async handleProcessFile(
    endpoint: IntegrationEndpoint,
    filePath: string,
    metadata?: any,
  ): Promise<any> {
    try {
      this.logger.log(`🔄 Ручная обработка файла ${filePath}`);

      // Здесь должна быть логика принудительной обработки файла
      // Для демонстрации возвращаем заглушку
      
      return {
        filePath,
        status: 'processed',
        timestamp: new Date(),
        metadata,
      };

    } catch (error) {
      this.logger.error(`❌ Ошибка ручной обработки файла ${filePath}:`, error.message);
      throw error;
    }
  }

  private async handleRetryFailed(endpoint: IntegrationEndpoint, jobId?: string): Promise<any> {
    try {
      if (jobId) {
        const job = await this.fileMonitorAdapter.getProcessingJob(jobId);
        if (!job || job.status !== 'failed') {
          throw new Error(`Задача ${jobId} не найдена или не в состоянии ошибки`);
        }

        this.logger.log(`🔄 Повторная попытка обработки задачи ${jobId}`);
        
        // Здесь должна быть логика повторного запуска задачи
        return {
          jobId,
          status: 'restarted',
        };
      } else {
        // Перезапускаем все неудачные задачи
        const jobs = await this.fileMonitorAdapter.getProcessingJobs(endpoint.id);
        const failedJobs = jobs.filter(job => job.status === 'failed');

        this.logger.log(`🔄 Повторная попытка обработки ${failedJobs.length} неудачных задач`);

        return {
          retriedJobs: failedJobs.length,
          status: 'restarted',
        };
      }

    } catch (error) {
      this.logger.error('❌ Ошибка повторного запуска задач:', error.message);
      throw error;
    }
  }

  private async createBusinessEvent(
    eventType: FileBusinessEvent['eventType'],
    businessData: any,
    endpoint: IntegrationEndpoint,
    sourceFile?: any,
    metadata?: any,
  ): Promise<FileBusinessEvent> {
    const eventId = `biz_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const affectedEntities = this.extractAffectedEntities(eventType, businessData);

    const businessEvent: FileBusinessEvent = {
      eventId,
      eventType,
      timestamp: new Date(),
      sourceFile,
      businessData,
      affectedEntities,
      metadata: {
        endpointId: endpoint.id,
        endpointName: endpoint.name,
        ...metadata,
      },
    };

    return businessEvent;
  }

  private extractAffectedEntities(
    eventType: FileBusinessEvent['eventType'],
    businessData: any,
  ): FileBusinessEvent['affectedEntities'] {
    const entities: FileBusinessEvent['affectedEntities'] = [];

    switch (eventType) {
      case 'file_detected':
        if (businessData.fileEvents) {
          for (const event of businessData.fileEvents) {
            entities.push({
              entityType: 'file',
              entityId: event.eventId,
              action: 'create',
            });
          }
        }
        break;

      case 'file_processed':
        if (businessData.processingJobs) {
          for (const job of businessData.processingJobs) {
            entities.push({
              entityType: 'job',
              entityId: job.jobId,
              action: 'complete',
            });
          }
        }
        break;

      case 'batch_completed':
        if (businessData.batchInfo) {
          entities.push({
            entityType: 'batch',
            entityId: businessData.batchInfo.batchId,
            action: 'complete',
          });
        }
        break;

      case 'processing_error':
        if (businessData.fileEvents) {
          for (const event of businessData.fileEvents) {
            entities.push({
              entityType: 'file',
              entityId: event.eventId,
              action: 'error',
            });
          }
        }
        break;
    }

    return entities;
  }

  private buildFileReport(events: FileEvent[], stats: any, endpoint: IntegrationEndpoint): FileBatchReport {
    const filesByType: Record<string, number> = {};
    const filesByStatus: Record<string, number> = {};
    const errorsByType: Record<string, number> = {};
    const recentErrors: string[] = [];
    let totalDataProcessed = 0;

    for (const event of events) {
      // Подсчет по типам файлов
      const extension = event.metadata?.extension || 'unknown';
      filesByType[extension] = (filesByType[extension] || 0) + 1;
      
      // Подсчет по статусам
      filesByStatus[event.processingStatus] = (filesByStatus[event.processingStatus] || 0) + 1;

      // Ошибки
      if (event.processingStatus === 'error' && event.errorMessage) {
        const errorType = this.categorizeError(event.errorMessage);
        errorsByType[errorType] = (errorsByType[errorType] || 0) + 1;
        if (recentErrors.length < 10) {
          recentErrors.push(`${event.fileName}: ${event.errorMessage}`);
        }
      }

      // Общий объем обработанных данных
      if (event.processingStatus === 'completed') {
        totalDataProcessed += event.fileSize;
      }
    }

    const recentFiles = events
      .slice(-10)
      .map(event => ({
        eventId: event.eventId,
        fileName: event.fileName,
        fileSize: event.fileSize,
        processingStatus: event.processingStatus,
        timestamp: event.timestamp,
      }));

    const now = Date.now();
    const oneHour = 60 * 60 * 1000;
    const oneDay = 24 * oneHour;

    const filesLastHour = events.filter(e => 
      (now - e.timestamp.getTime()) < oneHour
    ).length;

    const filesLastDay = events.filter(e => 
      (now - e.timestamp.getTime()) < oneDay
    ).length;

    return {
      totalFiles: events.length,
      filesByType,
      filesByStatus,
      processingJobs: stats.processingQueue || {
        total: 0,
        queued: 0,
        processing: 0,
        completed: 0,
        failed: 0,
      },
      recentFiles,
      errorSummary: {
        totalErrors: Object.values(errorsByType).reduce((sum, count) => sum + count, 0),
        errorsByType,
        recentErrors,
      },
      throughputStats: {
        filesPerHour: filesLastHour,
        filesPerDay: filesLastDay,
        averageProcessingTime: 0, // Нужно добавить расчет
        totalDataProcessed,
      },
    };
  }

  private categorizeError(errorMessage: string): string {
    if (errorMessage.includes('размер')) return 'file_size';
    if (errorMessage.includes('доступ') || errorMessage.includes('permission')) return 'access_error';
    if (errorMessage.includes('формат') || errorMessage.includes('JSON') || errorMessage.includes('XML')) return 'format_error';
    if (errorMessage.includes('сеть') || errorMessage.includes('timeout')) return 'network_error';
    return 'other';
  }

  private setupEventListeners(): void {
    // Обрабатываем события от File Monitor адаптера
    this.eventEmitter.on('file-monitor.file.detected', this.handleFileDetected.bind(this));
    this.eventEmitter.on('file-monitor.file.processing', this.handleFileProcessing.bind(this));
    this.eventEmitter.on('file-monitor.file.processed', this.handleFileProcessed.bind(this));
    this.eventEmitter.on('file-monitor.file.error', this.handleFileError.bind(this));
  }

  private async handleFileDetected(event: {
    endpointId: string;
    endpointName: string;
    fileEvent: FileEvent;
    timestamp: Date;
  }): Promise<void> {
    try {
      const count = this.processingMetrics.get('detected') || 0;
      this.processingMetrics.set('detected', count + 1);

      this.logger.log(`📄 Файл обнаружен: ${event.fileEvent.fileName} (${event.fileEvent.fileSize} bytes)`);

      // Создаем бизнес-событие
      const businessEvent = await this.createBusinessEvent(
        'file_detected',
        { fileEvents: [event.fileEvent] },
        { id: event.endpointId, name: event.endpointName } as any,
        {
          filePath: event.fileEvent.filePath,
          fileName: event.fileEvent.fileName,
          fileSize: event.fileEvent.fileSize,
          checksum: event.fileEvent.checksum,
        },
      );

      // Сохраняем событие
      this.businessEvents.set(businessEvent.eventId, businessEvent);

      // Создаем структурированные данные для трансформации
      const structuredData = this.createStructuredFileData(event);

      // Отправляем для дальнейшей обработки
      this.eventEmitter.emit('file-monitor.business.event', {
        eventType: 'file_detected',
        structuredData,
        timestamp: event.timestamp,
      });

    } catch (error) {
      this.logger.error('❌ Ошибка обработки обнаружения файла:', error.message);
    }
  }

  private async handleFileProcessing(event: {
    endpointId: string;
    endpointName: string;
    fileEvent: FileEvent;
    fileContent: FileContent;
    timestamp: Date;
  }): Promise<void> {
    try {
      this.logger.log(`⚙️ Обработка файла: ${event.fileEvent.fileName}`);

      // Создаем структурированные данные для трансформации
      const structuredData = this.createStructuredProcessingData(event);

      // Отправляем для дальнейшей обработки
      this.eventEmitter.emit('file-monitor.business.event', {
        eventType: 'file_processing',
        structuredData,
        timestamp: event.timestamp,
      });

    } catch (error) {
      this.logger.error('❌ Ошибка обработки файла:', error.message);
    }
  }

  private async handleFileProcessed(event: {
    endpointId: string;
    endpointName: string;
    fileEvent: FileEvent;
    result: any;
    processingTime: number;
    timestamp: Date;
  }): Promise<void> {
    try {
      const count = this.processingMetrics.get('processed') || 0;
      this.processingMetrics.set('processed', count + 1);

      this.logger.log(`✅ Файл обработан: ${event.fileEvent.fileName} (${event.processingTime}ms)`);

      await this.metricsService.recordMessage(event.endpointId, event.fileEvent.fileSize, event.processingTime);

    } catch (error) {
      this.logger.error('❌ Ошибка обработки завершения файла:', error.message);
    }
  }

  private async handleFileError(event: {
    endpointId: string;
    endpointName: string;
    fileEvent: FileEvent;
    error: string;
    attempts: number;
    timestamp: Date;
  }): Promise<void> {
    try {
      const count = this.processingMetrics.get('errors') || 0;
      this.processingMetrics.set('errors', count + 1);

      this.logger.error(`❌ Ошибка обработки файла ${event.fileEvent.fileName}: ${event.error}`);

      await this.metricsService.recordError(event.endpointId, event.error, 0);

    } catch (error) {
      this.logger.error('❌ Ошибка обработки ошибки файла:', error.message);
    }
  }

  private createStructuredFileData(event: {
    endpointId: string;
    endpointName: string;
    fileEvent: FileEvent;
    timestamp: Date;
  }): any {
    return {
      // Файловые данные
      file: {
        eventId: event.fileEvent.eventId,
        filePath: event.fileEvent.filePath,
        fileName: event.fileEvent.fileName,
        fileSize: event.fileEvent.fileSize,
        checksum: event.fileEvent.checksum,
        metadata: event.fileEvent.metadata,
      },

      // Событие
      event: {
        eventType: event.fileEvent.eventType,
        processingStatus: event.fileEvent.processingStatus,
        timestamp: event.fileEvent.timestamp,
      },

      // Источник
      source: {
        endpointId: event.endpointId,
        endpointName: event.endpointName,
      },

      // Метаданные обработки
      processing: {
        timestamp: event.timestamp,
        detectedCount: this.processingMetrics.get('detected') || 0,
      },
    };
  }

  private createStructuredProcessingData(event: {
    endpointId: string;
    endpointName: string;
    fileEvent: FileEvent;
    fileContent: FileContent;
    timestamp: Date;
  }): any {
    return {
      // Файловые данные
      file: {
        eventId: event.fileEvent.eventId,
        filePath: event.fileEvent.filePath,
        fileName: event.fileEvent.fileName,
        fileSize: event.fileEvent.fileSize,
      },

      // Содержимое файла
      content: {
        encoding: event.fileContent.encoding,
        size: event.fileContent.size,
        checksum: event.fileContent.checksum,
        mimeType: event.fileContent.metadata.mimeType,
        // content не включаем для экономии памяти
      },

      // Источник
      source: {
        endpointId: event.endpointId,
        endpointName: event.endpointName,
      },

      // Метаданные обработки
      processing: {
        timestamp: event.timestamp,
        processedCount: this.processingMetrics.get('processed') || 0,
      },
    };
  }

  // Публичные методы для внешнего использования
  async getBusinessEvents(eventType?: FileBusinessEvent['eventType']): Promise<FileBusinessEvent[]> {
    const events = Array.from(this.businessEvents.values());
    
    if (eventType) {
      return events.filter(event => event.eventType === eventType);
    }
    
    return events;
  }

  async getBusinessEvent(eventId: string): Promise<FileBusinessEvent | undefined> {
    return this.businessEvents.get(eventId);
  }

  async getProcessingStats(endpointId?: string) {
    const monitoringStats = await this.fileMonitorAdapter.getMonitoringStats(endpointId);
    
    return {
      fileMonitor: monitoringStats,
      processedDetected: this.processingMetrics.get('detected') || 0,
      processedCompleted: this.processingMetrics.get('processed') || 0,
      processedErrors: this.processingMetrics.get('errors') || 0,
      businessEvents: this.businessEvents.size,
      lastUpdate: new Date(),
    };
  }

  async testFileMonitorConnection(endpoint: IntegrationEndpoint): Promise<boolean> {
    return await this.fileMonitorAdapter.testConnection(endpoint);
  }

  async clearBusinessData(eventId?: string): Promise<void> {
    if (eventId) {
      this.businessEvents.delete(eventId);
      this.logger.log(`🧹 Данные бизнес-события ${eventId} очищены`);
    } else {
      this.businessEvents.clear();
      this.batchSummaries.clear();
      this.processingMetrics.clear();
      this.logger.log('🧹 Все данные File Monitor бизнес-событий очищены');
    }
  }

  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    details: any;
  }> {
    try {
      const stats = await this.getProcessingStats();
      
      const status = (stats.fileMonitor?.totalWatchers || 0) > 0 ? 'healthy' : 
                    (stats.processedDetected + stats.processedCompleted) > 0 ? 'degraded' : 'unhealthy';
      
      return {
        status,
        details: {
          totalWatchers: stats.fileMonitor?.totalWatchers || 0,
          totalEvents: stats.fileMonitor?.totalEvents || 0,
          activeProcessing: stats.fileMonitor?.activeProcessing || 0,
          processedDetected: stats.processedDetected,
          processedCompleted: stats.processedCompleted,
          processedErrors: stats.processedErrors,
          businessEvents: stats.businessEvents,
          lastUpdate: stats.lastUpdate,
        },
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        details: {
          error: error.message,
        },
      };
    }
  }
}