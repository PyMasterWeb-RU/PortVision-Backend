import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { firstValueFrom } from 'rxjs';
import * as Tesseract from 'tesseract.js';
import * as sharp from 'sharp';
import * as fs from 'fs/promises';
import * as path from 'path';
import { IntegrationEndpoint } from '../entities/integration-endpoint.entity';

export interface OcrResult {
  text: string;
  confidence: number;
  boundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  preprocessingSteps?: string[];
  processingTime: number;
  engine: string;
}

export interface AnprResult {
  containerNumber: string;
  confidence: number;
  position: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  isValid: boolean;
  validationErrors?: string[];
  timestamp: Date;
  imageMetadata?: {
    width: number;
    height: number;
    format: string;
    size: number;
  };
}

export interface ImageSource {
  type: 'file' | 'url' | 'base64' | 'buffer';
  source: string | Buffer;
  metadata?: {
    cameraId?: string;
    location?: string;
    timestamp?: Date;
  };
}

@Injectable()
export class OcrAnprAdapter implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OcrAnprAdapter.name);
  private readonly activeWorkers = new Map<string, Tesseract.Worker>();
  private readonly processingQueue = new Map<string, Promise<any>>();

  // Регулярные выражения для различных форматов номеров контейнеров
  private readonly containerPatterns = [
    /^[A-Z]{4}\d{7}$/, // Стандартный ISO формат (4 буквы + 7 цифр)
    /^[A-Z]{3}U\d{7}$/, // С буквой U на 4 позиции
    /^[A-Z]{4}\s?\d{6}\s?\d{1}$/, // С пробелами
    /^[A-Z]{4}[-]\d{7}$/, // С дефисом
  ];

  constructor(
    private readonly httpService: HttpService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async onModuleInit() {
    this.logger.log('🔍 Инициализация OCR/ANPR адаптера...');
    
    // Предзагружаем Tesseract worker для ускорения первого распознавания
    try {
      const worker = await Tesseract.createWorker();
      await worker.loadLanguage('eng');
      await worker.initialize('eng');
      await worker.setParameters({
        tessedit_char_whitelist: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ-',
        tessedit_pageseg_mode: Tesseract.PSM.SINGLE_LINE,
      });
      
      this.activeWorkers.set('default', worker);
      this.logger.log('✅ Tesseract worker предзагружен');
    } catch (error) {
      this.logger.error('❌ Ошибка предзагрузки Tesseract worker:', error.message);
    }
  }

  async onModuleDestroy() {
    this.logger.log('🔄 Завершение работы OCR/ANPR адаптера...');
    
    // Завершаем все активные workers
    for (const [workerId, worker] of this.activeWorkers) {
      try {
        await worker.terminate();
        this.logger.debug(`✅ Worker ${workerId} завершен`);
      } catch (error) {
        this.logger.error(`❌ Ошибка завершения worker ${workerId}:`, error.message);
      }
    }
    
    this.activeWorkers.clear();
    this.processingQueue.clear();
  }

  async processImage(
    imageSource: ImageSource,
    endpoint: IntegrationEndpoint,
    requestId?: string,
  ): Promise<AnprResult> {
    const startTime = Date.now();
    const logId = requestId || `req_${Date.now()}`;
    
    try {
      this.logger.debug(`🔍 Начинаем обработку изображения ${logId} для ${endpoint.name}`);

      // Предотвращаем дублирование запросов
      if (this.processingQueue.has(logId)) {
        this.logger.warn(`⚠️ Запрос ${logId} уже обрабатывается`);
        return await this.processingQueue.get(logId);
      }

      const processingPromise = this.doProcessImage(imageSource, endpoint, logId, startTime);
      this.processingQueue.set(logId, processingPromise);

      try {
        const result = await processingPromise;
        return result;
      } finally {
        this.processingQueue.delete(logId);
      }

    } catch (error) {
      this.processingQueue.delete(logId);
      this.logger.error(`❌ Ошибка обработки изображения ${logId}:`, error.stack);
      
      this.eventEmitter.emit('ocr.processing.failed', {
        endpointId: endpoint.id,
        requestId: logId,
        error: error.message,
        processingTime: Date.now() - startTime,
      });
      
      throw error;
    }
  }

  private async doProcessImage(
    imageSource: ImageSource,
    endpoint: IntegrationEndpoint,
    logId: string,
    startTime: number,
  ): Promise<AnprResult> {
    // 1. Загружаем изображение
    const imageBuffer = await this.loadImage(imageSource);
    const imageMetadata = await this.getImageMetadata(imageBuffer);
    
    this.logger.debug(
      `📷 Изображение ${logId} загружено: ${imageMetadata.width}x${imageMetadata.height}, ` +
      `${imageMetadata.format}, ${(imageMetadata.size / 1024).toFixed(1)}KB`
    );

    // 2. Предобработка изображения
    const preprocessedBuffer = await this.preprocessImage(
      imageBuffer,
      endpoint.connectionConfig.ocrConfig?.preprocessingSteps || [],
    );

    // 3. OCR распознавание
    const ocrResult = await this.performOcr(
      preprocessedBuffer,
      endpoint.connectionConfig.ocrConfig || {},
      logId,
    );

    // 4. Извлечение номера контейнера из текста
    const anprResult = this.extractContainerNumber(
      ocrResult.text,
      ocrResult.confidence,
      ocrResult.boundingBox,
    );

    // 5. Финальная валидация и форматирование результата
    const finalResult: AnprResult = {
      containerNumber: anprResult.containerNumber,
      confidence: anprResult.confidence,
      position: anprResult.position || {
        x: 0,
        y: 0,
        width: imageMetadata.width,
        height: imageMetadata.height,
      },
      isValid: anprResult.isValid,
      validationErrors: anprResult.validationErrors,
      timestamp: new Date(),
      imageMetadata,
    };

    const processingTime = Date.now() - startTime;
    
    this.logger.log(
      `✅ Обработка ${logId} завершена: "${finalResult.containerNumber}" ` +
      `(confidence: ${finalResult.confidence.toFixed(2)}, ` +
      `valid: ${finalResult.isValid}, ` +
      `time: ${processingTime}ms)`
    );

    // Отправляем событие об успешной обработке
    this.eventEmitter.emit('ocr.processing.completed', {
      endpointId: endpoint.id,
      requestId: logId,
      result: finalResult,
      processingTime,
    });

    return finalResult;
  }

  private async loadImage(imageSource: ImageSource): Promise<Buffer> {
    switch (imageSource.type) {
      case 'file':
        return await fs.readFile(imageSource.source as string);
        
      case 'url':
        const response = await firstValueFrom(
          this.httpService.get(imageSource.source as string, {
            responseType: 'arraybuffer',
            timeout: 30000,
          })
        );
        return Buffer.from(response.data);
        
      case 'base64':
        const base64Data = (imageSource.source as string).replace(/^data:image\/[a-z]+;base64,/, '');
        return Buffer.from(base64Data, 'base64');
        
      case 'buffer':
        return imageSource.source as Buffer;
        
      default:
        throw new Error(`Неподдерживаемый тип источника изображения: ${imageSource.type}`);
    }
  }

  private async getImageMetadata(imageBuffer: Buffer) {
    const metadata = await sharp(imageBuffer).metadata();
    return {
      width: metadata.width || 0,
      height: metadata.height || 0,
      format: metadata.format || 'unknown',
      size: imageBuffer.length,
    };
  }

  private async preprocessImage(imageBuffer: Buffer, steps: string[]): Promise<Buffer> {
    if (!steps || steps.length === 0) {
      return imageBuffer;
    }

    let processedImage = sharp(imageBuffer);
    
    for (const step of steps) {
      switch (step.toLowerCase()) {
        case 'grayscale':
          processedImage = processedImage.grayscale();
          break;
          
        case 'contrast':
          processedImage = processedImage.normalise();
          break;
          
        case 'sharpen':
          processedImage = processedImage.sharpen();
          break;
          
        case 'denoise':
          processedImage = processedImage.median(3);
          break;
          
        case 'resize':
          // Увеличиваем до минимум 1000px по ширине для лучшего OCR
          processedImage = processedImage.resize(1000, null, {
            withoutEnlargement: false,
            fit: 'inside',
          });
          break;
          
        case 'enhance_text':
          // Комбинация операций для улучшения читаемости текста
          processedImage = processedImage
            .grayscale()
            .normalise()
            .sharpen()
            .threshold(128);
          break;
          
        default:
          this.logger.warn(`⚠️ Неизвестный шаг предобработки: ${step}`);
      }
    }

    return await processedImage.png().toBuffer();
  }

  private async performOcr(
    imageBuffer: Buffer,
    ocrConfig: any,
    requestId: string,
  ): Promise<OcrResult> {
    const startTime = Date.now();
    
    switch (ocrConfig.engine || 'tesseract') {
      case 'tesseract':
        return await this.performTesseractOcr(imageBuffer, ocrConfig, requestId);
        
      case 'cloud_vision':
        return await this.performCloudVisionOcr(imageBuffer, ocrConfig);
        
      case 'azure_cv':
        return await this.performAzureOcr(imageBuffer, ocrConfig);
        
      case 'custom':
        return await this.performCustomOcr(imageBuffer, ocrConfig);
        
      default:
        throw new Error(`Неподдерживаемый OCR движок: ${ocrConfig.engine}`);
    }
  }

  private async performTesseractOcr(
    imageBuffer: Buffer,
    ocrConfig: any,
    requestId: string,
  ): Promise<OcrResult> {
    const startTime = Date.now();
    
    // Получаем или создаем worker
    let worker = this.activeWorkers.get('default');
    if (!worker) {
      worker = await Tesseract.createWorker();
      await worker.loadLanguage(ocrConfig.language || 'eng');
      await worker.initialize(ocrConfig.language || 'eng');
      this.activeWorkers.set('default', worker);
    }

    // Настраиваем параметры для распознавания номеров контейнеров
    await worker.setParameters({
      tessedit_char_whitelist: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ-',
      tessedit_pageseg_mode: Tesseract.PSM.SPARSE_TEXT,
      tessedit_ocr_engine_mode: Tesseract.OEM.LSTM_ONLY,
    });

    try {
      const result = await worker.recognize(imageBuffer);
      
      const processingTime = Date.now() - startTime;
      
      this.logger.debug(
        `🔍 Tesseract OCR ${requestId}: "${result.data.text.trim()}" ` +
        `(confidence: ${result.data.confidence.toFixed(2)}, time: ${processingTime}ms)`
      );

      return {
        text: result.data.text.trim(),
        confidence: result.data.confidence,
        boundingBox: result.data.bbox ? {
          x: result.data.bbox.x0,
          y: result.data.bbox.y0,
          width: result.data.bbox.x1 - result.data.bbox.x0,
          height: result.data.bbox.y1 - result.data.bbox.y0,
        } : undefined,
        processingTime,
        engine: 'tesseract',
      };
    } catch (error) {
      this.logger.error(`❌ Ошибка Tesseract OCR ${requestId}:`, error.message);
      throw error;
    }
  }

  private async performCloudVisionOcr(imageBuffer: Buffer, ocrConfig: any): Promise<OcrResult> {
    // Заглушка для Google Cloud Vision API
    // В реальной реализации здесь будет интеграция с Google Cloud Vision
    throw new Error('Google Cloud Vision OCR пока не реализован');
  }

  private async performAzureOcr(imageBuffer: Buffer, ocrConfig: any): Promise<OcrResult> {
    // Заглушка для Azure Computer Vision API
    // В реальной реализации здесь будет интеграция с Azure Computer Vision
    throw new Error('Azure Computer Vision OCR пока не реализован');
  }

  private async performCustomOcr(imageBuffer: Buffer, ocrConfig: any): Promise<OcrResult> {
    // Заглушка для пользовательского OCR API
    if (!ocrConfig.customEndpoint) {
      throw new Error('Не указан endpoint для пользовательского OCR');
    }

    try {
      const response = await firstValueFrom(
        this.httpService.post(ocrConfig.customEndpoint, imageBuffer, {
          headers: {
            'Content-Type': 'application/octet-stream',
            ...(ocrConfig.apiKey && { 'Authorization': `Bearer ${ocrConfig.apiKey}` }),
          },
          timeout: 30000,
        })
      );

      return {
        text: response.data.text || '',
        confidence: response.data.confidence || 0,
        boundingBox: response.data.boundingBox,
        processingTime: response.data.processingTime || 0,
        engine: 'custom',
      };
    } catch (error) {
      this.logger.error('❌ Ошибка пользовательского OCR:', error.message);
      throw error;
    }
  }

  private extractContainerNumber(
    text: string,
    confidence: number,
    boundingBox?: any,
  ): {
    containerNumber: string;
    confidence: number;
    position?: any;
    isValid: boolean;
    validationErrors?: string[];
  } {
    const cleanText = text.replace(/\s+/g, '').replace(/[^A-Z0-9-]/g, '').toUpperCase();
    const validationErrors: string[] = [];
    
    // Пробуем найти номер контейнера по различным паттернам
    let bestMatch = '';
    let bestConfidence = confidence;
    
    for (const pattern of this.containerPatterns) {
      const match = cleanText.match(pattern);
      if (match) {
        bestMatch = match[0];
        break;
      }
    }

    // Если точного совпадения нет, пробуем извлечь по частям
    if (!bestMatch && cleanText.length >= 10) {
      // Ищем 4 буквы в начале
      const letterMatch = cleanText.match(/^[A-Z]{4}/);
      // Ищем 7 цифр
      const numberMatch = cleanText.match(/\d{7}/);
      
      if (letterMatch && numberMatch) {
        bestMatch = letterMatch[0] + numberMatch[0];
      }
    }

    // Валидация номера контейнера
    const isValid = this.validateContainerNumber(bestMatch, validationErrors);
    
    // Корректируем confidence в зависимости от валидности
    if (!isValid) {
      bestConfidence = Math.min(bestConfidence, 70); // Максимум 70% для невалидных номеров
    }

    return {
      containerNumber: bestMatch || cleanText,
      confidence: bestConfidence,
      position: boundingBox,
      isValid,
      validationErrors: validationErrors.length > 0 ? validationErrors : undefined,
    };
  }

  private validateContainerNumber(containerNumber: string, errors: string[]): boolean {
    if (!containerNumber) {
      errors.push('Номер контейнера пустой');
      return false;
    }

    if (containerNumber.length !== 11) {
      errors.push(`Неверная длина номера: ${containerNumber.length} (ожидается 11 символов)`);
      return false;
    }

    // Проверяем формат
    const formatValid = this.containerPatterns.some(pattern => pattern.test(containerNumber));
    if (!formatValid) {
      errors.push('Неверный формат номера контейнера');
      return false;
    }

    // Проверяем check digit (контрольную цифру) для ISO номеров
    if (containerNumber.match(/^[A-Z]{4}\d{7}$/)) {
      const checkDigitValid = this.validateCheckDigit(containerNumber);
      if (!checkDigitValid) {
        errors.push('Неверная контрольная цифра');
        return false;
      }
    }

    return true;
  }

  private validateCheckDigit(containerNumber: string): boolean {
    // Алгоритм проверки контрольной цифры по ISO 6346
    const letters = containerNumber.substring(0, 4);
    const digits = containerNumber.substring(4, 10);
    const checkDigit = parseInt(containerNumber.substring(10, 11));

    // Таблица весов для букв
    const letterValues: { [key: string]: number } = {
      A: 10, B: 12, C: 13, D: 14, E: 15, F: 16, G: 17, H: 18, I: 19, J: 20,
      K: 21, L: 23, M: 24, N: 25, O: 26, P: 27, Q: 28, R: 29, S: 30, T: 31,
      U: 32, V: 34, W: 35, X: 36, Y: 37, Z: 38
    };

    let sum = 0;
    const powers = [1, 2, 4, 8, 16, 32, 64, 128, 256, 512];

    // Считаем сумму для букв
    for (let i = 0; i < 4; i++) {
      sum += letterValues[letters[i]] * powers[i];
    }

    // Считаем сумму для цифр
    for (let i = 0; i < 6; i++) {
      sum += parseInt(digits[i]) * powers[i + 4];
    }

    // Вычисляем контрольную цифру
    const calculatedCheckDigit = (sum % 11) % 10;
    
    return calculatedCheckDigit === checkDigit;
  }

  // Публичные методы для внешнего использования
  async testConnection(endpoint: IntegrationEndpoint): Promise<boolean> {
    try {
      // Тестируем доступность OCR движка
      const testImageBuffer = await this.createTestImage();
      const result = await this.performOcr(
        testImageBuffer,
        endpoint.connectionConfig.ocrConfig || {},
        'test'
      );
      
      this.logger.log(`✅ Тест OCR соединения успешен для ${endpoint.name}: confidence ${result.confidence}`);
      return true;
    } catch (error) {
      this.logger.error(`❌ Тест OCR соединения неудачен для ${endpoint.name}:`, error.message);
      return false;
    }
  }

  private async createTestImage(): Promise<Buffer> {
    // Создаем простое тестовое изображение с текстом "TEST1234567"
    return await sharp({
      create: {
        width: 400,
        height: 100,
        channels: 3,
        background: { r: 255, g: 255, b: 255 }
      }
    })
    .png()
    .toBuffer();
  }

  async getProcessingStats(): Promise<{
    activeWorkers: number;
    queuedRequests: number;
    totalProcessed: number;
  }> {
    return {
      activeWorkers: this.activeWorkers.size,
      queuedRequests: this.processingQueue.size,
      totalProcessed: 0, // TODO: Подсчет из метрик
    };
  }

  async clearCache(): Promise<void> {
    // Очищаем кеш и перезапускаем workers
    for (const [workerId, worker] of this.activeWorkers) {
      await worker.terminate();
    }
    
    this.activeWorkers.clear();
    this.processingQueue.clear();
    
    // Создаем новый default worker
    await this.onModuleInit();
    
    this.logger.log('🧹 OCR кеш очищен и workers перезапущены');
  }
}