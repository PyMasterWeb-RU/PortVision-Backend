import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

export enum OcrEventType {
  CONTAINER_NUMBER = 'container_number',
  TRUCK_NUMBER = 'truck_number',
  TRAILER_NUMBER = 'trailer_number',
  DRIVER_LICENSE = 'driver_license',
  DOCUMENT_SCAN = 'document_scan',
  SEAL_NUMBER = 'seal_number',
  DAMAGE_DETECTION = 'damage_detection',
}

export enum OcrStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  MANUAL_REVIEW = 'manual_review',
}

@Entity('ocr_events', { schema: 'gate' })
@Index(['eventType'])
@Index(['status'])
@Index(['timestamp'])
@Index(['confidence'])
@Index(['gateLocation'])
@Index(['userId'])
export class OcrEvent {
  @ApiProperty({ description: 'Уникальный идентификатор OCR события' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ description: 'Тип OCR события', enum: OcrEventType })
  @Column({
    name: 'event_type',
    type: 'enum',
    enum: OcrEventType,
  })
  eventType: OcrEventType;

  @ApiProperty({ description: 'Статус обработки', enum: OcrStatus })
  @Column({
    type: 'enum',
    enum: OcrStatus,
    default: OcrStatus.PENDING,
  })
  status: OcrStatus;

  @ApiProperty({ description: 'Временная метка события' })
  @Column({ type: 'timestamp' })
  timestamp: Date;

  @ApiProperty({ description: 'URL исходного изображения' })
  @Column({ name: 'source_image_url' })
  sourceImageUrl: string;

  @ApiProperty({ description: 'Метаданные изображения' })
  @Column({ name: 'image_metadata', type: 'jsonb' })
  imageMetadata: {
    filename: string;
    fileSize: number;
    dimensions: {
      width: number;
      height: number;
    };
    format: string;
    quality?: number;
    capturedAt: Date;
    cameraId?: string;
    exposureSettings?: {
      iso?: number;
      shutter?: string;
      aperture?: string;
    };
  };

  @ApiProperty({ description: 'Результаты распознавания' })
  @Column({ name: 'ocr_results', type: 'jsonb' })
  ocrResults: {
    rawText: string;
    extractedValue: string;
    confidence: number;
    alternatives?: Array<{
      value: string;
      confidence: number;
    }>;
    boundingBoxes?: Array<{
      text: string;
      coordinates: {
        x: number;
        y: number;
        width: number;
        height: number;
      };
      confidence: number;
    }>;
    processingTime: number;
    model_version?: string;
  };

  @ApiProperty({ description: 'Общий уровень уверенности (0-100)' })
  @Column({ type: 'decimal', precision: 5, scale: 2 })
  confidence: number;

  @ApiProperty({ description: 'Требуется ручная проверка' })
  @Column({ name: 'requires_manual_review', default: false })
  requiresManualReview: boolean;

  @ApiProperty({ description: 'Ручная коррекция' })
  @Column({ name: 'manual_correction', nullable: true })
  manualCorrection: string;

  @ApiProperty({ description: 'Расположение камеры/ворот' })
  @Column({ name: 'gate_location' })
  gateLocation: string;

  @ApiProperty({ description: 'ID камеры' })
  @Column({ name: 'camera_id', nullable: true })
  cameraId: string;

  @ApiProperty({ description: 'Связанная транзакция ворот' })
  @Column({ name: 'gate_transaction_id', nullable: true })
  gateTransactionId: string;

  @ApiProperty({ description: 'Связанный пропуск' })
  @Column({ name: 'gate_pass_id', nullable: true })
  gatePassId: string;

  @ApiProperty({ description: 'ID пользователя (если ручная обработка)' })
  @Column({ name: 'user_id', nullable: true })
  userId: string;

  @ApiProperty({ description: 'Время начала обработки' })
  @Column({ name: 'processing_started_at', type: 'timestamp', nullable: true })
  processingStartedAt: Date;

  @ApiProperty({ description: 'Время завершения обработки' })
  @Column({ name: 'processing_completed_at', type: 'timestamp', nullable: true })
  processingCompletedAt: Date;

  @ApiProperty({ description: 'Продолжительность обработки (мс)' })
  @Column({ name: 'processing_duration_ms', type: 'integer', nullable: true })
  processingDurationMs: number;

  @ApiProperty({ description: 'Сообщения об ошибках' })
  @Column({ name: 'error_messages', type: 'jsonb', nullable: true })
  errorMessages: Array<{
    code: string;
    message: string;
    timestamp: Date;
    severity: 'info' | 'warning' | 'error' | 'critical';
  }>;

  @ApiProperty({ description: 'Валидация результатов' })
  @Column({ type: 'jsonb', nullable: true })
  validation: {
    formatValid: boolean;
    checksumValid?: boolean;
    existsInDatabase?: boolean;
    matchesExpected?: boolean;
    validationRules: Array<{
      rule: string;
      passed: boolean;
      message?: string;
    }>;
  };

  @ApiProperty({ description: 'Улучшения изображения' })
  @Column({ name: 'image_enhancements', type: 'jsonb', nullable: true })
  imageEnhancements: {
    applied: string[];
    before_url?: string;
    after_url?: string;
    enhancement_settings?: Record<string, any>;
  };

  @ApiProperty({ description: 'Параметры OCR движка' })
  @Column({ name: 'ocr_engine_config', type: 'jsonb', nullable: true })
  ocrEngineConfig: {
    engine: string;
    version: string;
    language: string;
    mode: string;
    customSettings?: Record<string, any>;
  };

  @ApiProperty({ description: 'Статистика производительности' })
  @Column({ name: 'performance_metrics', type: 'jsonb', nullable: true })
  performanceMetrics: {
    queueTime: number;
    imagePreprocessingTime: number;
    recognitionTime: number;
    postprocessingTime: number;
    totalTime: number;
    memoryUsage?: number;
    cpuUsage?: number;
  };

  @ApiProperty({ description: 'Feedback от пользователя' })
  @Column({ name: 'user_feedback', type: 'jsonb', nullable: true })
  userFeedback: {
    correct: boolean;
    correctedValue?: string;
    feedback: string;
    userId: string;
    timestamp: Date;
  };

  @ApiProperty({ description: 'Дополнительные метаданные' })
  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @ApiProperty({ description: 'Дата создания' })
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}