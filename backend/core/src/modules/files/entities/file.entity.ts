import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

export enum FileType {
  DOCUMENT = 'document',
  IMAGE = 'image',
  VIDEO = 'video',
  AUDIO = 'audio',
  ARCHIVE = 'archive',
  OTHER = 'other',
}

export enum FileStatus {
  UPLOADING = 'uploading',
  PROCESSING = 'processing',
  AVAILABLE = 'available',
  FAILED = 'failed',
  ARCHIVED = 'archived',
  DELETED = 'deleted',
}

export enum AccessLevel {
  PUBLIC = 'public',
  INTERNAL = 'internal',
  RESTRICTED = 'restricted',
  CONFIDENTIAL = 'confidential',
}

export enum StorageProvider {
  LOCAL = 'local',
  MINIO = 'minio',
  AWS_S3 = 'aws_s3',
  AZURE_BLOB = 'azure_blob',
  GOOGLE_CLOUD = 'google_cloud',
}

@Entity('files', { schema: 'files' })
@Index(['fileType'])
@Index(['status'])
@Index(['accessLevel'])
@Index(['uploadedBy'])
@Index(['entityType', 'entityId'])
@Index(['fileName'])
@Index(['mimeType'])
export class File {
  @ApiProperty({ description: 'Уникальный идентификатор файла' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ description: 'Имя файла' })
  @Column({ name: 'file_name' })
  fileName: string;

  @ApiProperty({ description: 'Оригинальное имя файла' })
  @Column({ name: 'original_name' })
  originalName: string;

  @ApiProperty({ description: 'MIME тип файла' })
  @Column({ name: 'mime_type' })
  mimeType: string;

  @ApiProperty({ description: 'Размер файла в байтах' })
  @Column({ name: 'file_size', type: 'bigint' })
  fileSize: number;

  @ApiProperty({ description: 'Тип файла', enum: FileType })
  @Column({
    name: 'file_type',
    type: 'enum',
    enum: FileType,
  })
  fileType: FileType;

  @ApiProperty({ description: 'Статус файла', enum: FileStatus })
  @Column({
    type: 'enum',
    enum: FileStatus,
    default: FileStatus.UPLOADING,
  })
  status: FileStatus;

  @ApiProperty({ description: 'Уровень доступа', enum: AccessLevel })
  @Column({
    name: 'access_level',
    type: 'enum',
    enum: AccessLevel,
    default: AccessLevel.INTERNAL,
  })
  accessLevel: AccessLevel;

  @ApiProperty({ description: 'Поставщик хранилища', enum: StorageProvider })
  @Column({
    name: 'storage_provider',
    type: 'enum',
    enum: StorageProvider,
    default: StorageProvider.MINIO,
  })
  storageProvider: StorageProvider;

  @ApiProperty({ description: 'Путь к файлу в хранилище' })
  @Column({ name: 'storage_path' })
  storagePath: string;

  @ApiProperty({ description: 'Bucket или контейнер' })
  @Column({ name: 'storage_bucket' })
  storageBucket: string;

  @ApiProperty({ description: 'URL для скачивания' })
  @Column({ name: 'download_url', nullable: true })
  downloadUrl: string;

  @ApiProperty({ description: 'URL для предварительного просмотра' })
  @Column({ name: 'preview_url', nullable: true })
  previewUrl: string;

  @ApiProperty({ description: 'URL миниатюры' })
  @Column({ name: 'thumbnail_url', nullable: true })
  thumbnailUrl: string;

  @ApiProperty({ description: 'Тип сущности, к которой привязан файл' })
  @Column({ name: 'entity_type', nullable: true })
  entityType: string;

  @ApiProperty({ description: 'ID сущности, к которой привязан файл' })
  @Column({ name: 'entity_id', nullable: true })
  entityId: string;

  @ApiProperty({ description: 'ID пользователя, загрузившего файл' })
  @Column({ name: 'uploaded_by' })
  uploadedBy: string;

  @ApiProperty({ description: 'Имя пользователя, загрузившего файл' })
  @Column({ name: 'uploaded_by_name' })
  uploadedByName: string;

  @ApiProperty({ description: 'Метаданные файла' })
  @Column({ type: 'jsonb', nullable: true })
  metadata: {
    dimensions?: {
      width: number;
      height: number;
    };
    duration?: number; // для видео/аудио в секундах
    pages?: number; // для документов
    exif?: Record<string, any>; // для изображений
    encoding?: string;
    bitrate?: number;
    format?: string;
    quality?: string;
    compression?: string;
    extractedText?: string; // для OCR результатов
    ocrStatus?: 'pending' | 'processing' | 'completed' | 'failed';
    ocrResults?: {
      confidence: number;
      language: string;
      extractedAt: Date;
      blocks: Array<{
        text: string;
        confidence: number;
        boundingBox: {
          x: number;
          y: number;
          width: number;
          height: number;
        };
      }>;
    };
  };

  @ApiProperty({ description: 'Теги файла' })
  @Column({ type: 'simple-array', nullable: true })
  tags: string[];

  @ApiProperty({ description: 'Описание файла' })
  @Column({ type: 'text', nullable: true })
  description: string;

  @ApiProperty({ description: 'Версия файла' })
  @Column({ type: 'int', default: 1 })
  version: number;

  @ApiProperty({ description: 'ID родительского файла (для версий)' })
  @Column({ name: 'parent_file_id', nullable: true })
  parentFileId: string;

  @ApiProperty({ description: 'Информация о версионировании' })
  @Column({ name: 'version_info', type: 'jsonb', nullable: true })
  versionInfo: {
    isLatest: boolean;
    versionHistory: Array<{
      version: number;
      fileId: string;
      uploadedAt: Date;
      uploadedBy: string;
      changeDescription: string;
    }>;
  };

  @ApiProperty({ description: 'Настройки безопасности' })
  @Column({ name: 'security_settings', type: 'jsonb', nullable: true })
  securitySettings: {
    encrypted: boolean;
    encryptionAlgorithm?: string;
    passwordProtected: boolean;
    allowedUsers?: string[];
    allowedRoles?: string[];
    downloadRestrictions?: {
      maxDownloads?: number;
      currentDownloads?: number;
      expiryDate?: Date;
      allowPrint?: boolean;
      allowCopy?: boolean;
      watermark?: boolean;
    };
    auditLog?: Array<{
      action: 'view' | 'download' | 'share' | 'delete' | 'update';
      userId: string;
      userName: string;
      timestamp: Date;
      ipAddress?: string;
      userAgent?: string;
    }>;
  };

  @ApiProperty({ description: 'Настройки обработки' })
  @Column({ name: 'processing_settings', type: 'jsonb', nullable: true })
  processingSettings: {
    autoOcr: boolean;
    autoThumbnail: boolean;
    autoCompress: boolean;
    autoVirusScan: boolean;
    compressionLevel?: number;
    thumbnailSizes?: string[];
    ocrLanguages?: string[];
    maxRetries?: number;
    retryCount?: number;
    lastProcessedAt?: Date;
    processingErrors?: Array<{
      error: string;
      timestamp: Date;
      step: string;
    }>;
  };

  @ApiProperty({ description: 'Настройки интеграции' })
  @Column({ name: 'integration_settings', type: 'jsonb', nullable: true })
  integrationSettings: {
    syncToExternal?: boolean;
    externalSystems?: Array<{
      system: string;
      externalId: string;
      syncStatus: 'pending' | 'synced' | 'failed';
      lastSyncAt?: Date;
      syncUrl?: string;
    }>;
    shareSettings?: {
      isShared: boolean;
      shareToken?: string;
      shareExpiryDate?: Date;
      shareDownloadLimit?: number;
      shareViewLimit?: number;
      publicAccess?: boolean;
    };
  };

  @ApiProperty({ description: 'Дата создания' })
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ApiProperty({ description: 'Дата обновления' })
  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ApiProperty({ description: 'Дата последнего доступа' })
  @Column({ name: 'last_accessed_at', nullable: true })
  lastAccessedAt: Date;

  @ApiProperty({ description: 'Дата истечения срока действия' })
  @Column({ name: 'expires_at', nullable: true })
  expiresAt: Date;

  // Вычисляемые поля
  get isImage(): boolean {
    return this.fileType === FileType.IMAGE;
  }

  get isDocument(): boolean {
    return this.fileType === FileType.DOCUMENT;
  }

  get isVideo(): boolean {
    return this.fileType === FileType.VIDEO;
  }

  get isAudio(): boolean {
    return this.fileType === FileType.AUDIO;
  }

  get isAvailable(): boolean {
    return this.status === FileStatus.AVAILABLE;
  }

  get isExpired(): boolean {
    return this.expiresAt && this.expiresAt < new Date();
  }

  get fileSizeFormatted(): string {
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    if (this.fileSize === 0) return '0 Byte';
    const i = parseInt(Math.floor(Math.log(this.fileSize) / Math.log(1024)).toString());
    return Math.round(this.fileSize / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  }

  get fileExtension(): string {
    return this.fileName.split('.').pop()?.toLowerCase() || '';
  }

  get canDownload(): boolean {
    if (!this.isAvailable || this.isExpired) return false;
    
    const restrictions = this.securitySettings?.downloadRestrictions;
    if (!restrictions) return true;
    
    if (restrictions.maxDownloads && (restrictions.currentDownloads || 0) >= restrictions.maxDownloads) {
      return false;
    }
    
    if (restrictions.expiryDate && restrictions.expiryDate < new Date()) {
      return false;
    }
    
    return true;
  }

  get hasPreview(): boolean {
    return !!this.previewUrl;
  }

  get hasThumbnail(): boolean {
    return !!this.thumbnailUrl;
  }

  get isLatestVersion(): boolean {
    return this.versionInfo?.isLatest !== false;
  }

  get downloadCount(): number {
    return this.securitySettings?.downloadRestrictions?.currentDownloads || 0;
  }

  get isOcrProcessed(): boolean {
    return this.metadata?.ocrStatus === 'completed';
  }

  get extractedText(): string {
    return this.metadata?.extractedText || '';
  }

  get isShared(): boolean {
    return this.integrationSettings?.shareSettings?.isShared || false;
  }

  get shareToken(): string {
    return this.integrationSettings?.shareSettings?.shareToken || '';
  }

  get isPubliclyAccessible(): boolean {
    return this.accessLevel === AccessLevel.PUBLIC || this.integrationSettings?.shareSettings?.publicAccess;
  }

  get processingInProgress(): boolean {
    return this.status === FileStatus.PROCESSING;
  }

  get lastModifiedBy(): string {
    const lastEntry = this.securitySettings?.auditLog?.slice(-1)[0];
    return lastEntry?.userName || this.uploadedByName;
  }

  get lastModifiedAt(): Date {
    const lastEntry = this.securitySettings?.auditLog?.slice(-1)[0];
    return lastEntry?.timestamp || this.updatedAt;
  }

  get viewCount(): number {
    const viewActions = this.securitySettings?.auditLog?.filter(log => log.action === 'view') || [];
    return viewActions.length;
  }

  get downloadHistory(): Array<{ userId: string; userName: string; timestamp: Date }> {
    const downloads = this.securitySettings?.auditLog?.filter(log => log.action === 'download') || [];
    return downloads.map(download => ({
      userId: download.userId,
      userName: download.userName,
      timestamp: download.timestamp,
    }));
  }
}