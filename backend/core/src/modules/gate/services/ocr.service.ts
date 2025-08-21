import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { OcrEvent } from '../entities/ocr-event.entity';

export interface OcrProcessingDto {
  imageUrl: string;
  type: 'container_number' | 'truck_number' | 'trailer_number' | 'driver_license' | 'document_scan' | 'seal_number' | 'damage_detection';
  gateTransactionId?: string;
  gatePassId?: string;
  cameraId?: string;
  gateLocation: string;
  metadata?: Record<string, any>;
}

export interface OcrResult {
  success: boolean;
  text: string;
  confidence: number;
  coordinates?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  metadata?: Record<string, any>;
}

export interface FilterOcrEventsDto {
  page?: number;
  limit?: number;
  eventType?: string;
  status?: string;
  confidenceMin?: number;
  confidenceMax?: number;
  dateFrom?: Date;
  dateTo?: Date;
  gatePassId?: string;
  gateTransactionId?: string;
  gateLocation?: string;
  cameraId?: string;
  search?: string;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
}

@Injectable()
export class OcrService {
  private readonly logger = new Logger(OcrService.name);

  constructor(
    @InjectRepository(OcrEvent)
    private readonly ocrEventRepository: Repository<OcrEvent>,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Обработка изображения с помощью OCR
   */
  async processImage(processingDto: OcrProcessingDto, userId: string): Promise<OcrResult> {
    try {
      this.logger.log(`Processing OCR for type: ${processingDto.type}`);

      // Создание события OCR
      const ocrEvent = await this.createOcrEvent({
        eventType: processingDto.type,
        sourceImageUrl: processingDto.imageUrl,
        gateLocation: processingDto.gateLocation,
        cameraId: processingDto.cameraId,
        gateTransactionId: processingDto.gateTransactionId,
        gatePassId: processingDto.gatePassId,
        userId,
        status: 'processing',
        timestamp: new Date(),
        imageMetadata: {
          filename: processingDto.imageUrl.split('/').pop() || '',
          fileSize: 0,
          dimensions: { width: 0, height: 0 },
          format: 'jpg',
          capturedAt: new Date(),
        },
        metadata: processingDto.metadata,
      });

      // Обработка изображения в зависимости от типа
      let ocrResult: OcrResult;
      
      switch (processingDto.type) {
        case 'container_number':
          ocrResult = await this.processContainerNumber(processingDto.imageUrl);
          break;
        case 'license_plate':
          ocrResult = await this.processLicensePlate(processingDto.imageUrl);
          break;
        case 'document':
          ocrResult = await this.processDocument(processingDto.imageUrl);
          break;
        case 'seal_number':
          ocrResult = await this.processSealNumber(processingDto.imageUrl);
          break;
        default:
          ocrResult = await this.processGeneric(processingDto.imageUrl);
      }

      // Обновление события OCR результатом
      await this.updateOcrEvent(ocrEvent.id, {
        ocrResults: {
          rawText: ocrResult.text,
          extractedValue: ocrResult.text,
          confidence: ocrResult.confidence,
          boundingBoxes: ocrResult.coordinates ? [{
            text: ocrResult.text,
            coordinates: ocrResult.coordinates,
            confidence: ocrResult.confidence,
          }] : [],
          processingTime: ocrResult.metadata?.processingTime || 0,
        },
        confidence: ocrResult.confidence,
        status: ocrResult.success ? 'completed' : 'failed',
        processingCompletedAt: new Date(),
        processingDurationMs: ocrResult.metadata?.processingTime || 0,
        requiresManualReview: ocrResult.confidence < 0.8,
      });

      // Событие завершения OCR
      this.eventEmitter.emit('ocr.processing.completed', {
        ocrEventId: ocrEvent.id,
        type: processingDto.type,
        success: ocrResult.success,
        text: ocrResult.text,
        confidence: ocrResult.confidence,
        userId,
      });

      this.logger.log(`OCR processing completed. Success: ${ocrResult.success}, Text: ${ocrResult.text}`);
      return ocrResult;

    } catch (error) {
      this.logger.error(`OCR processing failed: ${error.message}`);
      throw new BadRequestException('OCR processing failed');
    }
  }

  /**
   * Пакетная обработка изображений
   */
  async processBatch(images: OcrProcessingDto[], userId: string): Promise<OcrResult[]> {
    this.logger.log(`Processing OCR batch of ${images.length} images`);

    const results: OcrResult[] = [];
    
    for (const imageDto of images) {
      try {
        const result = await this.processImage(imageDto, userId);
        results.push(result);
      } catch (error) {
        this.logger.error(`Failed to process image in batch: ${error.message}`);
        results.push({
          success: false,
          text: '',
          confidence: 0,
          metadata: { error: error.message },
        });
      }
    }

    this.eventEmitter.emit('ocr.batch.completed', {
      batchSize: images.length,
      successCount: results.filter(r => r.success).length,
      failureCount: results.filter(r => !r.success).length,
      userId,
    });

    return results;
  }

  /**
   * Получение всех событий OCR с фильтрацией
   */
  async findAllEvents(filters: FilterOcrEventsDto): Promise<{
    events: OcrEvent[];
    total: number;
    page: number;
    limit: number;
  }> {
    const {
      page = 1,
      limit = 20,
      eventType,
      status,
      confidenceMin,
      confidenceMax,
      dateFrom,
      dateTo,
      gatePassId,
      gateTransactionId,
      gateLocation,
      cameraId,
      search,
      sortBy = 'timestamp',
      sortOrder = 'DESC',
    } = filters;

    const query = this.ocrEventRepository.createQueryBuilder('event');

    // Применение фильтров
    if (eventType) {
      query.andWhere('event.eventType = :eventType', { eventType });
    }

    if (status) {
      query.andWhere('event.status = :status', { status });
    }

    if (confidenceMin !== undefined) {
      query.andWhere('event.confidence >= :confidenceMin', { confidenceMin });
    }

    if (confidenceMax !== undefined) {
      query.andWhere('event.confidence <= :confidenceMax', { confidenceMax });
    }

    if (dateFrom) {
      query.andWhere('event.timestamp >= :dateFrom', { dateFrom });
    }

    if (dateTo) {
      query.andWhere('event.timestamp <= :dateTo', { dateTo });
    }

    if (gatePassId) {
      query.andWhere('event.gatePassId = :gatePassId', { gatePassId });
    }

    if (gateTransactionId) {
      query.andWhere('event.gateTransactionId = :gateTransactionId', { gateTransactionId });
    }

    if (gateLocation) {
      query.andWhere('event.gateLocation = :gateLocation', { gateLocation });
    }

    if (cameraId) {
      query.andWhere('event.cameraId = :cameraId', { cameraId });
    }

    if (search) {
      query.andWhere(
        "(event.ocrResults->>'extractedValue' ILIKE :search OR event.sourceImageUrl ILIKE :search)",
        { search: `%${search}%` }
      );
    }

    // Сортировка
    query.orderBy(`event.${sortBy}`, sortOrder);

    // Пагинация
    const skip = (page - 1) * limit;
    query.skip(skip).take(limit);

    const [events, total] = await query.getManyAndCount();

    return {
      events,
      total,
      page,
      limit,
    };
  }

  /**
   * Получение события OCR по ID
   */
  async findEventById(id: string): Promise<OcrEvent> {
    const event = await this.ocrEventRepository.findOne({
      where: { id },
    });

    if (!event) {
      throw new BadRequestException(`OCR event with ID ${id} not found`);
    }

    return event;
  }

  /**
   * Валидация результата OCR
   */
  async validateOcrResult(eventId: string, isValid: boolean, userId: string): Promise<OcrEvent> {
    const event = await this.findEventById(eventId);

    await this.ocrEventRepository.update(eventId, {
      userFeedback: {
        correct: isValid,
        feedback: isValid ? 'Validated as correct' : 'Validated as incorrect',
        userId,
        timestamp: new Date(),
      },
    });

    this.eventEmitter.emit('ocr.result.validated', {
      ocrEventId: eventId,
      isValid,
      originalText: event.ocrResults?.extractedValue || '',
      userId,
    });

    this.logger.log(`OCR result validated: ${eventId}, valid: ${isValid}`);
    return this.findEventById(eventId);
  }

  /**
   * Создание события OCR
   */
  private async createOcrEvent(data: any): Promise<OcrEvent> {
    const ocrEvent = this.ocrEventRepository.create({
      ...data,
      processedAt: new Date(),
    });

    return await this.ocrEventRepository.save(ocrEvent);
  }

  /**
   * Обновление события OCR
   */
  private async updateOcrEvent(id: string, updateData: any): Promise<void> {
    await this.ocrEventRepository.update(id, updateData);
  }

  /**
   * Обработка номера контейнера
   */
  private async processContainerNumber(imageUrl: string): Promise<OcrResult> {
    // Здесь должна быть интеграция с внешним OCR сервисом
    // Для демонстрации используем мок
    const mockResult = this.mockOcrProcessing(imageUrl, 'container');
    
    // Валидация формата номера контейнера (4 буквы + 6 цифр + 1 контрольная цифра)
    const containerPattern = /^[A-Z]{4}[0-9]{6}[0-9]$/;
    const isValidFormat = containerPattern.test(mockResult.text);
    
    return {
      ...mockResult,
      confidence: isValidFormat ? mockResult.confidence : mockResult.confidence * 0.5,
      metadata: {
        ...mockResult.metadata,
        formatValid: isValidFormat,
        expectedPattern: 'ABCD1234567',
      },
    };
  }

  /**
   * Обработка номера автомобиля
   */
  private async processLicensePlate(imageUrl: string): Promise<OcrResult> {
    const mockResult = this.mockOcrProcessing(imageUrl, 'license_plate');
    
    // Валидация российского формата номера
    const russianPlatePattern = /^[АВЕКМНОРСТУХ]\d{3}[АВЕКМНОРСТУХ]{2}\d{2,3}$/;
    const isValidFormat = russianPlatePattern.test(mockResult.text);
    
    return {
      ...mockResult,
      confidence: isValidFormat ? mockResult.confidence : mockResult.confidence * 0.6,
      metadata: {
        ...mockResult.metadata,
        formatValid: isValidFormat,
        country: 'RU',
      },
    };
  }

  /**
   * Обработка документа
   */
  private async processDocument(imageUrl: string): Promise<OcrResult> {
    return this.mockOcrProcessing(imageUrl, 'document');
  }

  /**
   * Обработка номера пломбы
   */
  private async processSealNumber(imageUrl: string): Promise<OcrResult> {
    const mockResult = this.mockOcrProcessing(imageUrl, 'seal');
    
    // Валидация формата пломбы (обычно буквы и цифры)
    const sealPattern = /^[A-Z0-9]{4,20}$/;
    const isValidFormat = sealPattern.test(mockResult.text);
    
    return {
      ...mockResult,
      confidence: isValidFormat ? mockResult.confidence : mockResult.confidence * 0.7,
      metadata: {
        ...mockResult.metadata,
        formatValid: isValidFormat,
      },
    };
  }

  /**
   * Обработка общего текста
   */
  private async processGeneric(imageUrl: string): Promise<OcrResult> {
    return this.mockOcrProcessing(imageUrl, 'generic');
  }

  /**
   * Мок OCR обработки (заменить на реальную интеграцию)
   */
  private mockOcrProcessing(imageUrl: string, type: string): OcrResult {
    // Симуляция OCR обработки
    const mockTexts = {
      container: ['MSCU1234567', 'TCLU9876543', 'GESU5555555'],
      license_plate: ['А123БВ77', 'М456ГД99', 'Н789ЕЖ177'],
      document: ['Document text here', 'Various document content'],
      seal: ['SEAL123456', 'PLB789012', 'CST456789'],
      generic: ['Generic text', 'Sample text content'],
    };

    const texts = mockTexts[type] || mockTexts.generic;
    const randomText = texts[Math.floor(Math.random() * texts.length)];
    const confidence = 0.7 + Math.random() * 0.3; // 70-100%

    return {
      success: confidence > 0.5,
      text: randomText,
      confidence: Math.round(confidence * 100) / 100,
      coordinates: {
        x: Math.floor(Math.random() * 100),
        y: Math.floor(Math.random() * 100),
        width: Math.floor(Math.random() * 200) + 100,
        height: Math.floor(Math.random() * 50) + 20,
      },
      metadata: {
        processingTime: Math.floor(Math.random() * 2000) + 500, // 500-2500ms
        algorithm: 'mock-ocr-v1.0',
        imageSize: '1920x1080',
      },
    };
  }

  /**
   * Получение статистики OCR
   */
  async getStatistics(): Promise<{
    total: number;
    byType: Record<string, number>;
    byStatus: Record<string, number>;
    averageConfidence: number;
    todayProcessed: number;
    successRate: number;
  }> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [total, typeStats, statusStats, avgConfidence, todayProcessed, successCount] = await Promise.all([
      this.ocrEventRepository.count(),
      this.ocrEventRepository
        .createQueryBuilder('event')
        .select('event.eventType', 'eventType')
        .addSelect('COUNT(*)', 'count')
        .groupBy('event.eventType')
        .getRawMany(),
      this.ocrEventRepository
        .createQueryBuilder('event')
        .select('event.status', 'status')
        .addSelect('COUNT(*)', 'count')
        .groupBy('event.status')
        .getRawMany(),
      this.ocrEventRepository
        .createQueryBuilder('event')
        .select('AVG(event.confidence)', 'avg')
        .getRawOne(),
      this.ocrEventRepository.count({
        where: {
          timestamp: {
            gte: today,
            lt: tomorrow,
          } as any,
        },
      }),
      this.ocrEventRepository.count({
        where: {
          status: 'completed',
        },
      }),
    ]);

    const successRate = total > 0 ? (successCount / total) * 100 : 0;
    const averageConfidence = avgConfidence?.avg ? parseFloat(avgConfidence.avg) : 0;

    return {
      total,
      byType: this.mapStatsToRecord(typeStats),
      byStatus: this.mapStatsToRecord(statusStats),
      averageConfidence: Math.round(averageConfidence * 100) / 100,
      todayProcessed,
      successRate: Math.round(successRate * 100) / 100,
    };
  }

  /**
   * Преобразование статистики в объект
   */
  private mapStatsToRecord(stats: any[]): Record<string, number> {
    const result: Record<string, number> = {};

    stats.forEach((stat) => {
      const key = stat.eventType || stat.status;
      result[key] = parseInt(stat.count, 10);
    });

    return result;
  }
}