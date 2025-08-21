import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { GatePass } from './gate-pass.entity';
import { Container } from '../../common/entities/container.entity';

export enum TransactionType {
  ENTRY = 'entry',
  EXIT = 'exit',
  INSPECTION = 'inspection',
  WEIGHING = 'weighing',
  PHOTOGRAPHY = 'photography',
  DOCUMENT_CHECK = 'document_check',
  CUSTOMS_CHECK = 'customs_check',
  SECURITY_CHECK = 'security_check',
  REJECTED = 'rejected',
}

export enum TransactionStatus {
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

@Entity('gate_transactions', { schema: 'gate' })
@Index(['type'])
@Index(['status'])
@Index(['gatePassId'])
@Index(['containerId'])
@Index(['timestamp'])
@Index(['gateLocation'])
@Index(['processedBy'])
export class GateTransaction {
  @ApiProperty({ description: 'Уникальный идентификатор транзакции' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ description: 'Тип транзакции', enum: TransactionType })
  @Column({
    type: 'enum',
    enum: TransactionType,
  })
  type: TransactionType;

  @ApiProperty({ description: 'Статус транзакции', enum: TransactionStatus })
  @Column({
    type: 'enum',
    enum: TransactionStatus,
    default: TransactionStatus.IN_PROGRESS,
  })
  status: TransactionStatus;

  @ApiProperty({ description: 'Временная метка транзакции' })
  @Column({ type: 'timestamp' })
  timestamp: Date;

  @ApiProperty({ description: 'ID пропуска' })
  @Column({ name: 'gate_pass_id', nullable: true })
  gatePassId: string;

  @ApiProperty({ description: 'Пропуск', type: () => GatePass })
  @ManyToOne(() => GatePass, { eager: true })
  @JoinColumn({ name: 'gate_pass_id' })
  gatePass: GatePass;

  @ApiProperty({ description: 'ID контейнера' })
  @Column({ name: 'container_id', nullable: true })
  containerId: string;

  @ApiProperty({ description: 'Контейнер', type: () => Container })
  @ManyToOne(() => Container, { eager: true })
  @JoinColumn({ name: 'container_id' })
  container: Container;

  @ApiProperty({ description: 'Номер контейнера (если контейнер не в системе)' })
  @Column({ name: 'container_number', nullable: true })
  containerNumber: string;

  @ApiProperty({ description: 'Расположение ворот', example: 'Gate A1' })
  @Column({ name: 'gate_location' })
  gateLocation: string;

  @ApiProperty({ description: 'Направление движения' })
  @Column()
  direction: 'in' | 'out';

  @ApiProperty({ description: 'ID пользователя, обработавшего транзакцию' })
  @Column({ name: 'processed_by' })
  processedBy: string;

  @ApiProperty({ description: 'Имя пользователя' })
  @Column({ name: 'processed_by_name', nullable: true })
  processedByName: string;

  @ApiProperty({ description: 'Данные транспорта' })
  @Column({ name: 'vehicle_info', type: 'jsonb' })
  vehicleInfo: {
    truckNumber: string;
    trailerNumber?: string;
    driverName: string;
    driverLicense?: string;
    driverPhone?: string;
    transportCompany?: string;
  };

  @ApiProperty({ description: 'Результат OCR распознавания' })
  @Column({ name: 'ocr_results', type: 'jsonb', nullable: true })
  ocrResults: {
    containerNumber?: {
      recognized: string;
      confidence: number;
      manual_correction?: string;
    };
    truckNumber?: {
      recognized: string;
      confidence: number;
      manual_correction?: string;
    };
    driverLicense?: {
      recognized: string;
      confidence: number;
      manual_correction?: string;
    };
  };

  @ApiProperty({ description: 'Результаты проверок' })
  @Column({ name: 'check_results', type: 'jsonb' })
  checkResults: {
    documentsValid: boolean;
    passValid: boolean;
    containerCondition?: 'good' | 'damaged' | 'needs_inspection';
    weightCheck?: {
      measured: number;
      allowed: number;
      unit: 'kg' | 'lbs';
      compliant: boolean;
    };
    securityCheck?: {
      passed: boolean;
      notes?: string;
    };
    customsCheck?: {
      required: boolean;
      completed: boolean;
      status?: 'cleared' | 'hold' | 'examination_required';
    };
  };

  @ApiProperty({ description: 'Фотографии' })
  @Column({ type: 'jsonb' })
  photos: {
    vehicle: {
      front?: string;
      rear?: string;
      side?: string;
      licenseplate?: string;
    };
    container?: {
      front?: string;
      rear?: string;
      sides?: string[];
      number?: string;
      damages?: string[];
    };
    documents?: {
      driverLicense?: string;
      transportDocument?: string;
      containerSeal?: string;
    };
    general?: string[];
  };

  @ApiProperty({ description: 'Время начала обработки' })
  @Column({ name: 'start_time', type: 'timestamp' })
  startTime: Date;

  @ApiProperty({ description: 'Время завершения обработки' })
  @Column({ name: 'end_time', type: 'timestamp', nullable: true })
  endTime: Date;

  @ApiProperty({ description: 'Продолжительность обработки (секунды)' })
  @Column({ name: 'processing_duration', type: 'integer', nullable: true })
  processingDuration: number;

  @ApiProperty({ description: 'Причина отклонения (если транзакция отклонена)' })
  @Column({ name: 'rejection_reason', type: 'text', nullable: true })
  rejectionReason: string;

  @ApiProperty({ description: 'Примечания оператора' })
  @Column({ name: 'operator_notes', type: 'text', nullable: true })
  operatorNotes: string;

  @ApiProperty({ description: 'Системные уведомления' })
  @Column({ type: 'jsonb', nullable: true })
  notifications: Array<{
    type: 'sms' | 'email' | 'push' | 'webhook';
    recipient: string;
    status: 'sent' | 'failed' | 'pending';
    timestamp: Date;
    content?: string;
    error?: string;
  }>;

  @ApiProperty({ description: 'Автоматическая обработка' })
  @Column({ name: 'automated_processing', type: 'jsonb', nullable: true })
  automatedProcessing: {
    ocrProcessed: boolean;
    rfidScanned: boolean;
    barcodeScanned: boolean;
    weightsCalculated: boolean;
    rulesValidated: boolean;
    documentsGenerated: boolean;
  };

  @ApiProperty({ description: 'Нарушения и предупреждения' })
  @Column({ type: 'jsonb', nullable: true })
  violations: Array<{
    type: 'security' | 'documentation' | 'weight' | 'time' | 'route' | 'other';
    severity: 'info' | 'warning' | 'error' | 'critical';
    description: string;
    autoDetected: boolean;
    resolved: boolean;
    action_taken?: string;
  }>;

  @ApiProperty({ description: 'GPS координаты транзакции' })
  @Column({ name: 'gps_coordinates', type: 'jsonb', nullable: true })
  gpsCoordinates: {
    latitude: number;
    longitude: number;
    accuracy: number;
    timestamp: Date;
  };

  @ApiProperty({ description: 'Дополнительные метаданные' })
  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @ApiProperty({ description: 'Дата создания записи' })
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}