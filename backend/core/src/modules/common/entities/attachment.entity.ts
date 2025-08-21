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
import { Document } from './document.entity';

@Entity('attachments', { schema: 'core' })
@Index(['documentId'])
@Index(['fileType'])
@Index(['fileName'])
export class Attachment {
  @ApiProperty({ description: 'Уникальный идентификатор вложения' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ description: 'ID документа' })
  @Column({ name: 'document_id' })
  documentId: string;

  @ApiProperty({ description: 'Документ', type: () => Document })
  @ManyToOne(() => Document, (document) => document.attachments)
  @JoinColumn({ name: 'document_id' })
  document: Document;

  @ApiProperty({ description: 'Название файла' })
  @Column({ name: 'file_name' })
  fileName: string;

  @ApiProperty({ description: 'Оригинальное название файла' })
  @Column({ name: 'original_name' })
  originalName: string;

  @ApiProperty({ description: 'MIME тип файла' })
  @Column({ name: 'file_type' })
  fileType: string;

  @ApiProperty({ description: 'Размер файла в байтах' })
  @Column({ name: 'file_size', type: 'bigint' })
  fileSize: number;

  @ApiProperty({ description: 'Путь к файлу в хранилище' })
  @Column({ name: 'file_path' })
  filePath: string;

  @ApiProperty({ description: 'URL файла (S3 или локальный)' })
  @Column({ name: 'file_url', nullable: true })
  fileUrl: string;

  @ApiProperty({ description: 'Bucket в S3 (если используется)' })
  @Column({ name: 's3_bucket', nullable: true })
  s3Bucket: string;

  @ApiProperty({ description: 'Ключ в S3 (если используется)' })
  @Column({ name: 's3_key', nullable: true })
  s3Key: string;

  @ApiProperty({ description: 'MD5 хеш файла для проверки целостности' })
  @Column({ name: 'file_hash', nullable: true })
  fileHash: string;

  @ApiProperty({ description: 'Описание вложения' })
  @Column({ type: 'text', nullable: true })
  description: string;

  @ApiProperty({ description: 'Тип вложения (photo, scan, signature, etc.)' })
  @Column({ name: 'attachment_type', default: 'file' })
  attachmentType: string;

  @ApiProperty({ description: 'Порядок отображения' })
  @Column({ name: 'sort_order', type: 'smallint', default: 0 })
  sortOrder: number;

  @ApiProperty({ description: 'Метаданные файла (EXIF, размеры изображения, etc.)' })
  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @ApiProperty({ description: 'ID пользователя, загрузившего файл' })
  @Column({ name: 'uploaded_by' })
  uploadedBy: string;

  @ApiProperty({ description: 'Активен ли файл' })
  @Column({ default: true })
  isActive: boolean;

  @ApiProperty({ description: 'Дата создания' })
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}