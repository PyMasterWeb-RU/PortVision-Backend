import {
  Injectable,
  Logger,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { OcrAnprAdapter, AnprResult, ImageSource } from '../adapters/ocr-anpr.adapter';
import { DataTransformationService } from '../services/data-transformation.service';
import { RoutingService } from '../services/routing.service';
import { MetricsService } from '../services/metrics.service';
import { IntegrationEndpoint } from '../entities/integration-endpoint.entity';

export interface OcrProcessingRequest {
  endpointId: string;
  imageSource: ImageSource;
  requestId?: string;
  metadata?: {
    gateId?: string;
    laneNumber?: number;
    direction?: 'in' | 'out';
    vehicleType?: 'truck' | 'trailer' | 'chassis';
    operatorId?: string;
    timestamp?: Date;
  };
}

export interface OcrProcessingResult {
  success: boolean;
  requestId: string;
  containerNumber?: string;
  confidence?: number;
  isValid?: boolean;
  rawOcrResult?: AnprResult;
  transformedData?: any;
  routingResult?: any;
  errors?: string[];
  processingTime: number;
  metadata?: any;
}

@Injectable()
export class OcrProcessor {
  private readonly logger = new Logger(OcrProcessor.name);

  constructor(
    private readonly ocrAnprAdapter: OcrAnprAdapter,
    private readonly dataTransformationService: DataTransformationService,
    private readonly routingService: RoutingService,
    private readonly metricsService: MetricsService,
    private readonly eventEmitter: EventEmitter2,
  ) {
    // Подписываемся на события OCR адаптера
    this.eventEmitter.on('ocr.processing.completed', this.handleOcrSuccess.bind(this));
    this.eventEmitter.on('ocr.processing.failed', this.handleOcrFailure.bind(this));
  }

  async processOcrRequest(
    request: OcrProcessingRequest,
    endpoint: IntegrationEndpoint,
  ): Promise<OcrProcessingResult> {
    const startTime = Date.now();
    const requestId = request.requestId || `ocr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    this.logger.log(`🔍 Начинаем OCR обработку запроса ${requestId} для интеграции ${endpoint.name}`);

    const result: OcrProcessingResult = {
      success: false,
      requestId,
      errors: [],
      processingTime: 0,
    };

    try {
      // 1. Валидация запроса
      this.validateRequest(request);

      // 2. OCR распознавание изображения
      this.logger.debug(`📷 Выполняем OCR распознавание для ${requestId}`);
      const ocrResult = await this.ocrAnprAdapter.processImage(
        request.imageSource,
        endpoint,
        requestId,
      );

      result.rawOcrResult = ocrResult;
      result.containerNumber = ocrResult.containerNumber;
      result.confidence = ocrResult.confidence;
      result.isValid = ocrResult.isValid;

      // Добавляем ошибки валидации
      if (ocrResult.validationErrors && ocrResult.validationErrors.length > 0) {
        result.errors.push(...ocrResult.validationErrors);
      }

      // 3. Создаем структурированные данные для дальнейшей обработки
      const structuredData = this.createStructuredData(ocrResult, request, endpoint);

      // 4. Трансформация данных согласно конфигурации
      if (endpoint.dataProcessingConfig) {
        this.logger.debug(`🔄 Выполняем трансформацию данных для ${requestId}`);
        const transformationResult = await this.dataTransformationService.processData(
          structuredData,
          endpoint.dataProcessingConfig,
          endpoint.id,
        );

        if (transformationResult.success) {
          result.transformedData = transformationResult.data;
        } else {
          result.errors.push(...(transformationResult.errors || []));
        }
      } else {
        result.transformedData = structuredData;
      }

      // 5. Маршрутизация данных (только если трансформация успешна)
      if (result.transformedData && endpoint.routingConfig) {
        this.logger.debug(`📤 Выполняем маршрутизацию данных для ${requestId}`);
        const routingResult = await this.routingService.routeData(
          result.transformedData,
          endpoint.routingConfig,
          endpoint.id,
        );

        result.routingResult = routingResult;

        if (!routingResult.success) {
          result.errors.push(...(routingResult.errors || []));
        }
      }

      // 6. Определяем успешность обработки
      result.success = result.errors.length === 0 && ocrResult.isValid;
      result.processingTime = Date.now() - startTime;
      result.metadata = {
        ...request.metadata,
        imageMetadata: ocrResult.imageMetadata,
        ocrEngine: 'tesseract', // или из конфигурации
        preprocessingSteps: endpoint.connectionConfig.ocrConfig?.preprocessingSteps,
      };

      // 7. Записываем метрики
      if (result.success) {
        await this.metricsService.recordMessage(
          endpoint.id,
          JSON.stringify(result.transformedData).length,
          result.processingTime,
        );
      } else {
        await this.metricsService.recordError(
          endpoint.id,
          result.errors.join('; '),
          result.processingTime,
        );
      }

      // 8. Отправляем события
      this.eventEmitter.emit('ocr.request.completed', {
        endpointId: endpoint.id,
        requestId,
        success: result.success,
        containerNumber: result.containerNumber,
        confidence: result.confidence,
        isValid: result.isValid,
        processingTime: result.processingTime,
        metadata: request.metadata,
      });

      this.logger.log(
        `${result.success ? '✅' : '⚠️'} OCR обработка ${requestId} завершена: ` +
        `"${result.containerNumber}" (confidence: ${result.confidence?.toFixed(2)}, ` +
        `valid: ${result.isValid}, errors: ${result.errors.length}, ` +
        `time: ${result.processingTime}ms)`
      );

      return result;

    } catch (error) {
      result.success = false;
      result.errors.push(`Критическая ошибка обработки: ${error.message}`);
      result.processingTime = Date.now() - startTime;

      this.logger.error(`❌ Критическая ошибка OCR обработки ${requestId}:`, error.stack);

      // Записываем ошибку в метрики
      await this.metricsService.recordError(
        endpoint.id,
        error.message,
        result.processingTime,
      );

      // Отправляем событие об ошибке
      this.eventEmitter.emit('ocr.request.failed', {
        endpointId: endpoint.id,
        requestId,
        error: error.message,
        processingTime: result.processingTime,
        metadata: request.metadata,
      });

      return result;
    }
  }

  private validateRequest(request: OcrProcessingRequest): void {
    if (!request.endpointId) {
      throw new Error('Не указан ID интеграции');
    }

    if (!request.imageSource) {
      throw new Error('Не указан источник изображения');
    }

    if (!request.imageSource.type || !request.imageSource.source) {
      throw new Error('Неполные данные источника изображения');
    }

    // Валидация размера для base64 изображений
    if (request.imageSource.type === 'base64') {
      const base64Size = ((request.imageSource.source as string).length * 3) / 4;
      const maxSize = 10 * 1024 * 1024; // 10MB
      
      if (base64Size > maxSize) {
        throw new Error(`Изображение слишком большое: ${(base64Size / 1024 / 1024).toFixed(1)}MB (максимум ${maxSize / 1024 / 1024}MB)`);
      }
    }
  }

  private createStructuredData(
    ocrResult: AnprResult,
    request: OcrProcessingRequest,
    endpoint: IntegrationEndpoint,
  ): any {
    return {
      // Основные данные распознавания
      containerNumber: ocrResult.containerNumber,
      confidence: ocrResult.confidence,
      isValid: ocrResult.isValid,
      validationErrors: ocrResult.validationErrors,
      
      // Позиция номера на изображении
      position: ocrResult.position,
      
      // Метаданные изображения
      image: {
        width: ocrResult.imageMetadata?.width,
        height: ocrResult.imageMetadata?.height,
        format: ocrResult.imageMetadata?.format,
        size: ocrResult.imageMetadata?.size,
      },
      
      // Метаданные запроса
      request: {
        id: request.requestId,
        gateId: request.metadata?.gateId,
        laneNumber: request.metadata?.laneNumber,
        direction: request.metadata?.direction,
        vehicleType: request.metadata?.vehicleType,
        operatorId: request.metadata?.operatorId,
        timestamp: request.metadata?.timestamp || ocrResult.timestamp,
      },
      
      // Метаданные интеграции
      integration: {
        endpointId: endpoint.id,
        endpointName: endpoint.name,
        endpointType: endpoint.type,
      },
      
      // Метаданные обработки
      processing: {
        timestamp: ocrResult.timestamp,
        ocrEngine: endpoint.connectionConfig.ocrConfig?.engine || 'tesseract',
        preprocessingSteps: endpoint.connectionConfig.ocrConfig?.preprocessingSteps || [],
        language: endpoint.connectionConfig.ocrConfig?.language || 'eng',
      },
      
      // Дополнительные данные источника изображения
      source: {
        type: request.imageSource.type,
        cameraId: request.imageSource.metadata?.cameraId,
        location: request.imageSource.metadata?.location,
        captureTimestamp: request.imageSource.metadata?.timestamp,
      },
    };
  }

  async processBatchOcrRequests(
    requests: OcrProcessingRequest[],
    endpoint: IntegrationEndpoint,
  ): Promise<OcrProcessingResult[]> {
    this.logger.log(`📋 Начинаем пакетную OCR обработку ${requests.length} запросов для ${endpoint.name}`);

    const results: OcrProcessingResult[] = [];
    const batchStartTime = Date.now();

    // Обрабатываем запросы параллельно (с ограничением одновременности)
    const concurrency = Math.min(requests.length, 3); // Максимум 3 одновременных OCR операции
    const semaphore = Array(concurrency).fill(null);
    
    let processedCount = 0;

    const processRequest = async (request: OcrProcessingRequest): Promise<OcrProcessingResult> => {
      const result = await this.processOcrRequest(request, endpoint);
      processedCount++;
      
      this.logger.debug(
        `📊 Пакетная обработка: ${processedCount}/${requests.length} завершено ` +
        `(${((processedCount / requests.length) * 100).toFixed(1)}%)`
      );
      
      return result;
    };

    // Запускаем обработку с контролем concurrency
    for (let i = 0; i < requests.length; i += concurrency) {
      const batch = requests.slice(i, i + concurrency);
      const batchResults = await Promise.all(
        batch.map(request => processRequest(request))
      );
      results.push(...batchResults);
    }

    const batchProcessingTime = Date.now() - batchStartTime;
    const successCount = results.filter(r => r.success).length;
    const failureCount = results.length - successCount;

    this.logger.log(
      `✅ Пакетная OCR обработка завершена: ${successCount} успешно, ` +
      `${failureCount} ошибок, время: ${batchProcessingTime}ms ` +
      `(среднее: ${(batchProcessingTime / requests.length).toFixed(1)}ms на запрос)`
    );

    // Отправляем событие о завершении пакетной обработки
    this.eventEmitter.emit('ocr.batch.completed', {
      endpointId: endpoint.id,
      totalRequests: requests.length,
      successfulRequests: successCount,
      failedRequests: failureCount,
      processingTime: batchProcessingTime,
      averageProcessingTime: batchProcessingTime / requests.length,
    });

    return results;
  }

  async getProcessingStats(endpointId?: string) {
    const ocrStats = await this.ocrAnprAdapter.getProcessingStats();
    
    return {
      ocr: ocrStats,
      metrics: endpointId ? await this.metricsService.getEndpointMetrics(endpointId) : null,
    };
  }

  private async handleOcrSuccess(event: any): Promise<void> {
    this.logger.debug(`📊 OCR успех для ${event.endpointId}: ${event.requestId}`);
    
    // Здесь можно добавить дополнительную логику обработки успешных результатов
    // Например, кеширование, уведомления и т.д.
  }

  private async handleOcrFailure(event: any): Promise<void> {
    this.logger.warn(`📊 OCR ошибка для ${event.endpointId}: ${event.requestId} - ${event.error}`);
    
    // Здесь можно добавить логику обработки ошибок
    // Например, повторные попытки, уведомления администраторов и т.д.
    
    // Если это критическая ошибка, можем отправить алерт
    if (event.error.includes('Worker') || event.error.includes('timeout')) {
      this.eventEmitter.emit('integration.critical.error', {
        endpointId: event.endpointId,
        service: 'OCR',
        error: event.error,
        severity: 'high',
        timestamp: new Date(),
      });
    }
  }

  // Методы для управления OCR обработкой
  async clearCache(): Promise<void> {
    await this.ocrAnprAdapter.clearCache();
    this.logger.log('🧹 OCR кеш очищен');
  }

  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    details: any;
  }> {
    try {
      const stats = await this.ocrAnprAdapter.getProcessingStats();
      
      const status = stats.activeWorkers > 0 ? 'healthy' : 
                    stats.queuedRequests > 10 ? 'degraded' : 'unhealthy';
      
      return {
        status,
        details: {
          activeWorkers: stats.activeWorkers,
          queuedRequests: stats.queuedRequests,
          totalProcessed: stats.totalProcessed,
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

  // Полезные утилиты для валидации номеров контейнеров
  validateContainerNumber(containerNumber: string): {
    isValid: boolean;
    errors: string[];
    normalizedNumber?: string;
  } {
    const errors: string[] = [];
    const cleanNumber = containerNumber.replace(/\s+/g, '').replace(/[^A-Z0-9-]/g, '').toUpperCase();
    
    // Базовая валидация длины
    if (cleanNumber.length !== 11) {
      errors.push(`Неверная длина: ${cleanNumber.length} (ожидается 11)`);
    }
    
    // Валидация формата
    const formatPattern = /^[A-Z]{4}\d{7}$/;
    if (!formatPattern.test(cleanNumber)) {
      errors.push('Неверный формат (ожидается: 4 буквы + 7 цифр)');
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      normalizedNumber: cleanNumber,
    };
  }

  formatContainerNumber(containerNumber: string): string {
    const clean = containerNumber.replace(/\s+/g, '').replace(/[^A-Z0-9]/g, '').toUpperCase();
    
    if (clean.length === 11) {
      return `${clean.substring(0, 4)} ${clean.substring(4, 10)} ${clean.substring(10)}`;
    }
    
    return clean;
  }
}