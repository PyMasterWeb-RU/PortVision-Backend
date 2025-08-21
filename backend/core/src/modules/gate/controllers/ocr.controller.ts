import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
  Request,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery, ApiConsumes } from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { OcrService, OcrProcessingDto, OcrResult, FilterOcrEventsDto } from '../services/ocr.service';
import { OcrEvent } from '../entities/ocr-event.entity';

@ApiTags('OCR Processing')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('gate/ocr')
export class OcrController {
  constructor(private readonly ocrService: OcrService) {}

  /**
   * Обработка одного изображения
   */
  @Post('process')
  @ApiOperation({ summary: 'Обработка изображения с помощью OCR' })
  @ApiResponse({ status: 201, description: 'Изображение успешно обработано' })
  @ApiResponse({ status: 400, description: 'Некорректные данные' })
  @ApiResponse({ status: 401, description: 'Не авторизован' })
  async processImage(
    @Body() processingDto: OcrProcessingDto,
    @Request() req,
  ): Promise<OcrResult> {
    return this.ocrService.processImage(processingDto, req.user.sub);
  }

  /**
   * Загрузка и обработка изображения
   */
  @Post('process/upload')
  @UseInterceptors(FileInterceptor('image'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Загрузка и обработка изображения' })
  @ApiResponse({ status: 201, description: 'Изображение успешно загружено и обработано' })
  @ApiResponse({ status: 400, description: 'Некорректные данные или формат файла' })
  async processUploadedImage(
    @UploadedFile() file: Express.Multer.File,
    @Body('type') type: 'container_number' | 'truck_number' | 'trailer_number' | 'driver_license' | 'document_scan' | 'seal_number' | 'damage_detection',
    @Body('gatePassId') gatePassId?: string,
    @Body('gateTransactionId') gateTransactionId?: string,
    @Body('gateLocation') gateLocation?: string,
    @Body('cameraId') cameraId?: string,
    @Body('metadata') metadata?: string,
    @Request() req?,
  ): Promise<OcrResult> {
    if (!file) {
      throw new Error('Image file is required');
    }

    // В реальной реализации здесь должна быть загрузка файла в хранилище
    const imageUrl = `/uploads/${file.filename}`;

    const processingDto: OcrProcessingDto = {
      imageUrl,
      type,
      gatePassId,
      gateTransactionId,
      gateLocation: gateLocation || 'Gate A1',
      cameraId,
      metadata: metadata ? JSON.parse(metadata) : undefined,
    };

    return this.ocrService.processImage(processingDto, req.user.sub);
  }

  /**
   * Пакетная обработка изображений
   */
  @Post('process/batch')
  @ApiOperation({ summary: 'Пакетная обработка изображений' })
  @ApiResponse({ status: 201, description: 'Пакет изображений успешно обработан' })
  @ApiResponse({ status: 400, description: 'Некорректные данные' })
  async processBatch(
    @Body() images: OcrProcessingDto[],
    @Request() req,
  ): Promise<OcrResult[]> {
    return this.ocrService.processBatch(images, req.user.sub);
  }

  /**
   * Получение всех событий OCR с фильтрацией
   */
  @Get('events')
  @ApiOperation({ summary: 'Получение списка событий OCR' })
  @ApiResponse({ status: 200, description: 'Список событий OCR получен успешно' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Номер страницы' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Количество записей на странице' })
  @ApiQuery({ name: 'eventType', required: false, type: String, description: 'Фильтр по типу события' })
  @ApiQuery({ name: 'status', required: false, type: String, description: 'Фильтр по статусу' })
  @ApiQuery({ name: 'confidenceMin', required: false, type: Number, description: 'Минимальная уверенность' })
  @ApiQuery({ name: 'confidenceMax', required: false, type: Number, description: 'Максимальная уверенность' })
  @ApiQuery({ name: 'dateFrom', required: false, type: Date, description: 'Дата начала периода' })
  @ApiQuery({ name: 'dateTo', required: false, type: Date, description: 'Дата окончания периода' })
  @ApiQuery({ name: 'gatePassId', required: false, type: String, description: 'Фильтр по ID пропуска' })
  @ApiQuery({ name: 'gateTransactionId', required: false, type: String, description: 'Фильтр по ID транзакции ворот' })
  @ApiQuery({ name: 'gateLocation', required: false, type: String, description: 'Фильтр по расположению ворот' })
  @ApiQuery({ name: 'cameraId', required: false, type: String, description: 'Фильтр по ID камеры' })
  @ApiQuery({ name: 'search', required: false, type: String, description: 'Поиск по тексту' })
  @ApiQuery({ name: 'sortBy', required: false, type: String, description: 'Поле для сортировки' })
  @ApiQuery({ name: 'sortOrder', required: false, enum: ['ASC', 'DESC'], description: 'Направление сортировки' })
  async findAllEvents(@Query() filters: FilterOcrEventsDto): Promise<{
    events: OcrEvent[];
    total: number;
    page: number;
    limit: number;
  }> {
    return this.ocrService.findAllEvents(filters);
  }

  /**
   * Получение события OCR по ID
   */
  @Get('events/:id')
  @ApiOperation({ summary: 'Получение события OCR по ID' })
  @ApiResponse({ status: 200, description: 'Событие OCR найдено', type: OcrEvent })
  @ApiResponse({ status: 404, description: 'Событие OCR не найдено' })
  async findEventById(@Param('id') id: string): Promise<OcrEvent> {
    return this.ocrService.findEventById(id);
  }

  /**
   * Валидация результата OCR
   */
  @Put('events/:id/validate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Валидация результата OCR' })
  @ApiResponse({ status: 200, description: 'Результат OCR успешно валидирован', type: OcrEvent })
  @ApiResponse({ status: 404, description: 'Событие OCR не найдено' })
  async validateResult(
    @Param('id') id: string,
    @Body('isValid') isValid: boolean,
    @Request() req,
  ): Promise<OcrEvent> {
    return this.ocrService.validateOcrResult(id, isValid, req.user.sub);
  }

  /**
   * Получение статистики OCR
   */
  @Get('analytics/statistics')
  @ApiOperation({ summary: 'Получение статистики OCR' })
  @ApiResponse({ status: 200, description: 'Статистика получена успешно' })
  async getStatistics(): Promise<{
    total: number;
    byType: Record<string, number>;
    byStatus: Record<string, number>;
    averageConfidence: number;
    todayProcessed: number;
    successRate: number;
  }> {
    return this.ocrService.getStatistics();
  }

  /**
   * Получение метрик качества OCR
   */
  @Get('analytics/quality')
  @ApiOperation({ summary: 'Получение метрик качества OCR' })
  @ApiResponse({ status: 200, description: 'Метрики качества получены успешно' })
  @ApiQuery({ name: 'dateFrom', required: false, type: Date, description: 'Дата начала периода' })
  @ApiQuery({ name: 'dateTo', required: false, type: Date, description: 'Дата окончания периода' })
  @ApiQuery({ name: 'type', required: false, type: String, description: 'Тип OCR' })
  async getQualityMetrics(
    @Query('dateFrom') dateFrom?: Date,
    @Query('dateTo') dateTo?: Date,
    @Query('type') type?: string,
  ): Promise<{
    averageConfidence: number;
    successRate: number;
    validationRate: number;
    accuracyRate: number;
    processingTime: {
      average: number;
      median: number;
      min: number;
      max: number;
    };
    errorTypes: Record<string, number>;
  }> {
    // В реальной реализации здесь должна быть логика расчета метрик качества
    return {
      averageConfidence: 0.87,
      successRate: 0.92,
      validationRate: 0.78,
      accuracyRate: 0.85,
      processingTime: {
        average: 1250,
        median: 1100,
        min: 500,
        max: 3000,
      },
      errorTypes: {
        'low_quality_image': 15,
        'insufficient_lighting': 8,
        'text_not_found': 12,
        'format_mismatch': 5,
        'processing_timeout': 2,
      },
    };
  }

  /**
   * Повторная обработка неудачного события
   */
  @Post('events/:id/retry')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Повторная обработка неудачного события OCR' })
  @ApiResponse({ status: 200, description: 'Событие успешно обработано повторно' })
  @ApiResponse({ status: 400, description: 'Невозможно повторно обработать событие' })
  @ApiResponse({ status: 404, description: 'Событие OCR не найдено' })
  async retryProcessing(
    @Param('id') id: string,
    @Body('options') options?: any,
    @Request() req?,
  ): Promise<OcrResult> {
    const event = await this.ocrService.findEventById(id);
    
    if (event.status === 'completed') {
      throw new Error('Cannot retry completed OCR event');
    }

    const processingDto: OcrProcessingDto = {
      imageUrl: event.sourceImageUrl,
      type: event.eventType as any,
      gatePassId: event.gatePassId,
      gateTransactionId: event.gateTransactionId,
      gateLocation: event.gateLocation,
      cameraId: event.cameraId,
      metadata: { ...event.metadata, retryOptions: options },
    };

    return this.ocrService.processImage(processingDto, req.user.sub);
  }

  /**
   * Получение истории обработки для изображения
   */
  @Get('images/:imageUrl/history')
  @ApiOperation({ summary: 'Получение истории обработки изображения' })
  @ApiResponse({ status: 200, description: 'История обработки получена успешно' })
  async getImageProcessingHistory(@Param('imageUrl') imageUrl: string): Promise<OcrEvent[]> {
    const filters: FilterOcrEventsDto = {
      search: decodeURIComponent(imageUrl),
      sortBy: 'processedAt',
      sortOrder: 'DESC',
    };

    const result = await this.ocrService.findAllEvents(filters);
    return result.events;
  }

  /**
   * Сравнение результатов обработки
   */
  @Post('compare')
  @ApiOperation({ summary: 'Сравнение результатов обработки OCR' })
  @ApiResponse({ status: 200, description: 'Сравнение выполнено успешно' })
  async compareResults(
    @Body() eventIds: string[],
  ): Promise<{
    events: OcrEvent[];
    comparison: {
      confidence: { min: number; max: number; average: number };
      textSimilarity: number;
      processingTime: { min: number; max: number; average: number };
      recommendation: string;
    };
  }> {
    if (eventIds.length < 2) {
      throw new Error('At least 2 events are required for comparison');
    }

    const events = await Promise.all(
      eventIds.map(id => this.ocrService.findEventById(id))
    );

    const confidences = events.map(e => e.confidence || 0);
    const processingTimes = events.map(e => e.metadata?.processingTime || 0);
    
    // Простое сравнение текстов (в реальности должен быть более сложный алгоритм)
    const texts = events.map(e => e.recognizedText || '');
    const uniqueTexts = [...new Set(texts)];
    const textSimilarity = uniqueTexts.length === 1 ? 1 : 0.5;

    const comparison = {
      confidence: {
        min: Math.min(...confidences),
        max: Math.max(...confidences),
        average: confidences.reduce((a, b) => a + b, 0) / confidences.length,
      },
      textSimilarity,
      processingTime: {
        min: Math.min(...processingTimes),
        max: Math.max(...processingTimes),
        average: processingTimes.reduce((a, b) => a + b, 0) / processingTimes.length,
      },
      recommendation: textSimilarity === 1 ? 'Results are consistent' : 'Results differ, manual review recommended',
    };

    return {
      events,
      comparison,
    };
  }
}