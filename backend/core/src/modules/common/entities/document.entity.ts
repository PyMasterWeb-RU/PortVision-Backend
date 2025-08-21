import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { Attachment } from './attachment.entity';

export enum DocumentType {
  EIR = 'eir',
  CMR = 'cmr',
  BILL_OF_LADING = 'bill_of_lading',
  COMMERCIAL_INVOICE = 'commercial_invoice',
  PACKING_LIST = 'packing_list',
  CERTIFICATE_OF_ORIGIN = 'certificate_of_origin',
  PHYTOSANITARY_CERTIFICATE = 'phytosanitary_certificate',
  CUSTOMS_DECLARATION = 'customs_declaration',
  INSPECTION_REPORT = 'inspection_report',
  REPAIR_ESTIMATE = 'repair_estimate',
  REPAIR_ACT = 'repair_act',
  DAMAGE_REPORT = 'damage_report',
  DELIVERY_ORDER = 'delivery_order',
  GATE_PASS = 'gate_pass',
  WEIGHING_CERTIFICATE = 'weighing_certificate',
  TEMPERATURE_LOG = 'temperature_log',
  OTHER = 'other',
}

export enum DocumentStatus {
  DRAFT = 'draft',
  PENDING_APPROVAL = 'pending_approval',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  SIGNED = 'signed',
  CANCELLED = 'cancelled',
  ARCHIVED = 'archived',
}

@Entity('documents', { schema: 'core' })
@Index(['number'], { unique: true })
@Index(['type'])
@Index(['status'])
@Index(['entityType', 'entityId'])
export class Document {
  @ApiProperty({ description: 'Уникальный идентификатор документа' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ description: 'Номер документа', example: 'EIR-2023-001234' })
  @Column({ type: 'varchar', length: 50, unique: true })
  number: string;

  @ApiProperty({ description: 'Тип документа', enum: DocumentType })
  @Column({
    type: 'enum',
    enum: DocumentType,
  })
  type: DocumentType;

  @ApiProperty({ description: 'Заголовок документа' })
  @Column()
  title: string;

  @ApiProperty({ description: 'Описание документа' })
  @Column({ type: 'text', nullable: true })
  description: string;

  @ApiProperty({ description: 'Статус документа', enum: DocumentStatus })
  @Column({
    type: 'enum',
    enum: DocumentStatus,
    default: DocumentStatus.DRAFT,
  })
  status: DocumentStatus;

  @ApiProperty({ description: 'Тип связанной сущности', example: 'order' })
  @Column({ name: 'entity_type' })
  entityType: string;

  @ApiProperty({ description: 'ID связанной сущности' })
  @Column({ name: 'entity_id' })
  entityId: string;

  @ApiProperty({ description: 'Дата документа' })
  @Column({ name: 'document_date', type: 'date' })
  documentDate: Date;

  @ApiProperty({ description: 'Дата действия документа с' })
  @Column({ name: 'valid_from', type: 'date', nullable: true })
  validFrom: Date;

  @ApiProperty({ description: 'Дата действия документа до' })
  @Column({ name: 'valid_until', type: 'date', nullable: true })
  validUntil: Date;

  @ApiProperty({ description: 'ID пользователя, создавшего документ' })
  @Column({ name: 'created_by' })
  createdBy: string;

  @ApiProperty({ description: 'ID пользователя, подписавшего документ' })
  @Column({ name: 'signed_by', nullable: true })
  signedBy: string;

  @ApiProperty({ description: 'Дата подписания' })
  @Column({ name: 'signed_at', type: 'timestamp', nullable: true })
  signedAt: Date;

  @ApiProperty({ description: 'Хеш для верификации целостности' })
  @Column({ name: 'integrity_hash', nullable: true })
  integrityHash: string;

  @ApiProperty({ description: 'Данные документа в формате JSON' })
  @Column({ type: 'jsonb' })
  data: Record<string, any>;

  @ApiProperty({ description: 'Шаблон документа' })
  @Column({ name: 'template_id', nullable: true })
  templateId: string;

  @ApiProperty({ description: 'Язык документа' })
  @Column({ length: 2, default: 'ru' })
  language: string;

  @ApiProperty({ description: 'Валюта документа' })
  @Column({ length: 3, default: 'RUB' })
  currency: string;

  @ApiProperty({ description: 'Комментарии к документу' })
  @Column({ type: 'text', nullable: true })
  comments: string;

  @ApiProperty({ description: 'Дополнительные метаданные' })
  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @ApiProperty({ description: 'Активен ли документ' })
  @Column({ default: true })
  isActive: boolean;

  @ApiProperty({ description: 'Вложения документа', type: () => [Attachment] })
  @OneToMany(() => Attachment, (attachment) => attachment.document)
  attachments: Attachment[];

  @ApiProperty({ description: 'Дата создания' })
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ApiProperty({ description: 'Дата обновления' })
  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}