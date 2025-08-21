import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { 
  File, 
  FileType, 
  FileStatus, 
  AccessLevel,
  StorageProvider 
} from '../entities/file.entity';
import * as path from 'path';
import * as crypto from 'crypto';
import * as mime from 'mime-types';

export interface CreateFileDto {
  fileName: string;
  originalName: string;
  mimeType: string;
  fileSize: number;
  fileType: FileType;
  accessLevel?: AccessLevel;
  storageProvider?: StorageProvider;
  storagePath: string;
  storageBucket: string;
  entityType?: string;
  entityId?: string;
  uploadedBy: string;
  uploadedByName: string;
  description?: string;
  tags?: string[];
  metadata?: any;
  securitySettings?: any;
  processingSettings?: any;
  integrationSettings?: any;
  expiresAt?: Date;
}

export interface UpdateFileDto {
  fileName?: string;
  status?: FileStatus;
  accessLevel?: AccessLevel;
  downloadUrl?: string;
  previewUrl?: string;
  thumbnailUrl?: string;
  description?: string;
  tags?: string[];
  metadata?: any;
  securitySettings?: any;
  processingSettings?: any;
  integrationSettings?: any;
  versionInfo?: any;
  expiresAt?: Date;
  lastAccessedAt?: Date;
}

export interface FileSearchFilters {
  fileType?: FileType;
  status?: FileStatus;
  accessLevel?: AccessLevel;
  storageProvider?: StorageProvider;
  entityType?: string;
  entityId?: string;
  uploadedBy?: string;
  mimeType?: string;
  fileSizeMin?: number;
  fileSizeMax?: number;
  uploadedAfter?: Date;
  uploadedBefore?: Date;
  lastAccessedAfter?: Date;
  lastAccessedBefore?: Date;
  expiresAfter?: Date;
  expiresBefore?: Date;
  hasPreview?: boolean;
  hasThumbnail?: boolean;
  isExpired?: boolean;
  isShared?: boolean;
  tags?: string[];
  searchText?: string;
}

@Injectable()
export class FileService {
  private readonly logger = new Logger(FileService.name);

  constructor(
    @InjectRepository(File)
    private readonly fileRepository: Repository<File>,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async createFile(createFileDto: CreateFileDto): Promise<File> {
    this.logger.log(`Creating file: ${createFileDto.originalName}`);

    // Determine file type if not provided
    if (!createFileDto.fileType) {
      createFileDto.fileType = this.determineFileType(createFileDto.mimeType);
    }

    // Set default access level
    if (!createFileDto.accessLevel) {
      createFileDto.accessLevel = AccessLevel.INTERNAL;
    }

    // Set default storage provider
    if (!createFileDto.storageProvider) {
      createFileDto.storageProvider = StorageProvider.MINIO;
    }

    // Initialize processing settings
    if (!createFileDto.processingSettings) {
      createFileDto.processingSettings = {
        autoOcr: this.shouldAutoOcr(createFileDto.fileType, createFileDto.mimeType),
        autoThumbnail: this.shouldAutoThumbnail(createFileDto.fileType),
        autoCompress: this.shouldAutoCompress(createFileDto.fileSize),
        autoVirusScan: true,
        maxRetries: 3,
        retryCount: 0,
      };
    }

    const file = this.fileRepository.create({
      ...createFileDto,
      status: FileStatus.UPLOADING,
    });

    const savedFile = await this.fileRepository.save(file);

    this.eventEmitter.emit('file.created', {
      fileId: savedFile.id,
      fileName: savedFile.fileName,
      originalName: savedFile.originalName,
      fileType: savedFile.fileType,
      fileSize: savedFile.fileSize,
      uploadedBy: savedFile.uploadedBy,
      entityType: savedFile.entityType,
      entityId: savedFile.entityId,
    });

    this.logger.log(`File created: ${savedFile.id}`);
    return savedFile;
  }

  async getAllFiles(): Promise<File[]> {
    return this.fileRepository.find({
      order: { createdAt: 'DESC' },
    });
  }

  async getFileById(id: string): Promise<File> {
    const file = await this.fileRepository.findOne({
      where: { id },
    });

    if (!file) {
      throw new NotFoundException(`File with ID ${id} not found`);
    }

    return file;
  }

  async updateFile(id: string, updateFileDto: UpdateFileDto): Promise<File> {
    const file = await this.getFileById(id);

    Object.assign(file, updateFileDto);
    const updatedFile = await this.fileRepository.save(file);

    this.eventEmitter.emit('file.updated', {
      fileId: updatedFile.id,
      fileName: updatedFile.fileName,
      changes: updateFileDto,
    });

    this.logger.log(`File updated: ${updatedFile.id}`);
    return updatedFile;
  }

  async deleteFile(id: string, permanent: boolean = false): Promise<void> {
    const file = await this.getFileById(id);

    if (permanent) {
      await this.fileRepository.remove(file);
      this.eventEmitter.emit('file.deleted.permanent', {
        fileId: file.id,
        fileName: file.fileName,
      });
    } else {
      await this.updateFile(id, { status: FileStatus.DELETED });
      this.eventEmitter.emit('file.deleted.soft', {
        fileId: file.id,
        fileName: file.fileName,
      });
    }

    this.logger.log(`File ${permanent ? 'permanently ' : ''}deleted: ${file.id}`);
  }

  async searchFiles(filters: FileSearchFilters): Promise<File[]> {
    const query = this.fileRepository.createQueryBuilder('file');

    // Apply status filter - exclude deleted by default
    query.andWhere('file.status != :deletedStatus', { deletedStatus: FileStatus.DELETED });

    if (filters.fileType) {
      query.andWhere('file.fileType = :fileType', { fileType: filters.fileType });
    }

    if (filters.status) {
      query.andWhere('file.status = :status', { status: filters.status });
    }

    if (filters.accessLevel) {
      query.andWhere('file.accessLevel = :accessLevel', { accessLevel: filters.accessLevel });
    }

    if (filters.storageProvider) {
      query.andWhere('file.storageProvider = :storageProvider', { storageProvider: filters.storageProvider });
    }

    if (filters.entityType) {
      query.andWhere('file.entityType = :entityType', { entityType: filters.entityType });
    }

    if (filters.entityId) {
      query.andWhere('file.entityId = :entityId', { entityId: filters.entityId });
    }

    if (filters.uploadedBy) {
      query.andWhere('file.uploadedBy = :uploadedBy', { uploadedBy: filters.uploadedBy });
    }

    if (filters.mimeType) {
      query.andWhere('file.mimeType = :mimeType', { mimeType: filters.mimeType });
    }

    if (filters.fileSizeMin) {
      query.andWhere('file.fileSize >= :fileSizeMin', { fileSizeMin: filters.fileSizeMin });
    }

    if (filters.fileSizeMax) {
      query.andWhere('file.fileSize <= :fileSizeMax', { fileSizeMax: filters.fileSizeMax });
    }

    if (filters.uploadedAfter) {
      query.andWhere('file.createdAt >= :uploadedAfter', { uploadedAfter: filters.uploadedAfter });
    }

    if (filters.uploadedBefore) {
      query.andWhere('file.createdAt <= :uploadedBefore', { uploadedBefore: filters.uploadedBefore });
    }

    if (filters.lastAccessedAfter) {
      query.andWhere('file.lastAccessedAt >= :lastAccessedAfter', { lastAccessedAfter: filters.lastAccessedAfter });
    }

    if (filters.lastAccessedBefore) {
      query.andWhere('file.lastAccessedAt <= :lastAccessedBefore', { lastAccessedBefore: filters.lastAccessedBefore });
    }

    if (filters.expiresAfter) {
      query.andWhere('file.expiresAt >= :expiresAfter', { expiresAfter: filters.expiresAfter });
    }

    if (filters.expiresBefore) {
      query.andWhere('file.expiresAt <= :expiresBefore', { expiresBefore: filters.expiresBefore });
    }

    if (filters.hasPreview) {
      query.andWhere('file.previewUrl IS NOT NULL');
    }

    if (filters.hasThumbnail) {
      query.andWhere('file.thumbnailUrl IS NOT NULL');
    }

    if (filters.isExpired) {
      query.andWhere('file.expiresAt < NOW()');
    }

    if (filters.isShared) {
      query.andWhere('file.integrationSettings->>\'shareSettings\'->>\'isShared\' = \'true\'');
    }

    if (filters.tags && filters.tags.length > 0) {
      query.andWhere('file.tags && :tags', { tags: filters.tags });
    }

    if (filters.searchText) {
      query.andWhere(`(
        file.fileName ILIKE :searchText
        OR file.originalName ILIKE :searchText
        OR file.description ILIKE :searchText
        OR file.metadata->>'extractedText' ILIKE :searchText
      )`, { searchText: `%${filters.searchText}%` });
    }

    query.orderBy('file.createdAt', 'DESC');

    return query.getMany();
  }

  async getFilesByEntity(entityType: string, entityId: string): Promise<File[]> {
    return this.searchFiles({ entityType, entityId });
  }

  async getFilesByType(fileType: FileType): Promise<File[]> {
    return this.searchFiles({ fileType });
  }

  async getFilesByStatus(status: FileStatus): Promise<File[]> {
    return this.searchFiles({ status });
  }

  async getFilesByUploader(uploadedBy: string): Promise<File[]> {
    return this.searchFiles({ uploadedBy });
  }

  async getExpiredFiles(): Promise<File[]> {
    return this.searchFiles({ isExpired: true });
  }

  async getSharedFiles(): Promise<File[]> {
    return this.searchFiles({ isShared: true });
  }

  async markAsProcessed(id: string, processedUrls: {
    downloadUrl?: string;
    previewUrl?: string;
    thumbnailUrl?: string;
  }, metadata?: any): Promise<File> {
    const updateData: UpdateFileDto = {
      status: FileStatus.AVAILABLE,
      ...processedUrls,
    };

    if (metadata) {
      updateData.metadata = metadata;
    }

    const updatedFile = await this.updateFile(id, updateData);

    this.eventEmitter.emit('file.processed', {
      fileId: updatedFile.id,
      fileName: updatedFile.fileName,
      processedUrls,
    });

    return updatedFile;
  }

  async markAsProcessingFailed(id: string, error: string): Promise<File> {
    const file = await this.getFileById(id);
    
    const processingSettings = file.processingSettings || {};
    const processingErrors = processingSettings.processingErrors || [];
    
    processingErrors.push({
      error,
      timestamp: new Date(),
      step: 'general_processing',
    });

    processingSettings.processingErrors = processingErrors;
    processingSettings.retryCount = (processingSettings.retryCount || 0) + 1;

    const updatedFile = await this.updateFile(id, {
      status: FileStatus.FAILED,
      processingSettings,
    });

    this.eventEmitter.emit('file.processing.failed', {
      fileId: updatedFile.id,
      fileName: updatedFile.fileName,
      error,
      retryCount: processingSettings.retryCount,
    });

    return updatedFile;
  }

  async recordAccess(id: string, userId: string, userName: string, action: 'view' | 'download' | 'share', 
                     request?: { ipAddress?: string; userAgent?: string }): Promise<File> {
    const file = await this.getFileById(id);

    // Update last accessed date
    const updateData: UpdateFileDto = {
      lastAccessedAt: new Date(),
    };

    // Add to security audit log
    const securitySettings = file.securitySettings || {};
    const auditLog = securitySettings.auditLog || [];
    
    auditLog.push({
      action,
      userId,
      userName,
      timestamp: new Date(),
      ipAddress: request?.ipAddress,
      userAgent: request?.userAgent,
    });

    securitySettings.auditLog = auditLog;

    // Update download count if it's a download
    if (action === 'download' && securitySettings.downloadRestrictions) {
      securitySettings.downloadRestrictions.currentDownloads = 
        (securitySettings.downloadRestrictions.currentDownloads || 0) + 1;
    }

    updateData.securitySettings = securitySettings;

    const updatedFile = await this.updateFile(id, updateData);

    this.eventEmitter.emit('file.accessed', {
      fileId: updatedFile.id,
      fileName: updatedFile.fileName,
      action,
      userId,
      userName,
    });

    return updatedFile;
  }

  async createShare(id: string, settings: {
    expiryDate?: Date;
    downloadLimit?: number;
    viewLimit?: number;
    publicAccess?: boolean;
    passwordProtected?: boolean;
  }): Promise<{ shareToken: string; shareUrl: string }> {
    const file = await this.getFileById(id);

    if (file.accessLevel === AccessLevel.CONFIDENTIAL) {
      throw new BadRequestException('Confidential files cannot be shared');
    }

    const shareToken = crypto.randomBytes(32).toString('hex');
    
    const integrationSettings = file.integrationSettings || {};
    integrationSettings.shareSettings = {
      isShared: true,
      shareToken,
      shareExpiryDate: settings.expiryDate,
      shareDownloadLimit: settings.downloadLimit,
      shareViewLimit: settings.viewLimit,
      publicAccess: settings.publicAccess || false,
    };

    await this.updateFile(id, { integrationSettings });

    const shareUrl = `${process.env.BASE_URL}/api/files/share/${shareToken}`;

    this.eventEmitter.emit('file.shared', {
      fileId: file.id,
      fileName: file.fileName,
      shareToken,
      shareUrl,
      settings,
    });

    return { shareToken, shareUrl };
  }

  async revokeShare(id: string): Promise<File> {
    const file = await this.getFileById(id);

    const integrationSettings = file.integrationSettings || {};
    if (integrationSettings.shareSettings) {
      integrationSettings.shareSettings.isShared = false;
      delete integrationSettings.shareSettings.shareToken;
    }

    const updatedFile = await this.updateFile(id, { integrationSettings });

    this.eventEmitter.emit('file.share.revoked', {
      fileId: updatedFile.id,
      fileName: updatedFile.fileName,
    });

    return updatedFile;
  }

  async getFileByShareToken(shareToken: string): Promise<File> {
    const file = await this.fileRepository
      .createQueryBuilder('file')
      .where('file.integrationSettings->>\'shareSettings\'->>\'shareToken\' = :shareToken', { shareToken })
      .andWhere('file.integrationSettings->>\'shareSettings\'->>\'isShared\' = \'true\'')
      .getOne();

    if (!file) {
      throw new NotFoundException('Shared file not found or share has been revoked');
    }

    // Check if share is expired
    const shareSettings = file.integrationSettings?.shareSettings;
    if (shareSettings?.shareExpiryDate && shareSettings.shareExpiryDate < new Date()) {
      throw new BadRequestException('Share link has expired');
    }

    return file;
  }

  async createNewVersion(originalFileId: string, createFileDto: CreateFileDto): Promise<File> {
    const originalFile = await this.getFileById(originalFileId);

    // Create new file with incremented version
    const newVersion = originalFile.version + 1;
    const newFile = await this.createFile({
      ...createFileDto,
      parentFileId: originalFileId,
      version: newVersion,
    });

    // Update version info for both files
    const versionHistory = originalFile.versionInfo?.versionHistory || [];
    versionHistory.push({
      version: newVersion,
      fileId: newFile.id,
      uploadedAt: new Date(),
      uploadedBy: createFileDto.uploadedBy,
      changeDescription: `Version ${newVersion}`,
    });

    // Mark original as not latest
    await this.updateFile(originalFileId, {
      versionInfo: {
        isLatest: false,
        versionHistory,
      },
    });

    // Mark new file as latest
    await this.updateFile(newFile.id, {
      versionInfo: {
        isLatest: true,
        versionHistory,
      },
    });

    this.eventEmitter.emit('file.version.created', {
      originalFileId,
      newFileId: newFile.id,
      version: newVersion,
    });

    return newFile;
  }

  async getFileVersions(fileId: string): Promise<File[]> {
    const file = await this.getFileById(fileId);
    
    // Get all versions of this file
    const parentId = file.parentFileId || file.id;
    
    return this.fileRepository.find({
      where: [
        { id: parentId },
        { parentFileId: parentId },
      ],
      order: { version: 'DESC' },
    });
  }

  private determineFileType(mimeType: string): FileType {
    if (mimeType.startsWith('image/')) return FileType.IMAGE;
    if (mimeType.startsWith('video/')) return FileType.VIDEO;
    if (mimeType.startsWith('audio/')) return FileType.AUDIO;
    if (mimeType.includes('application/pdf') || 
        mimeType.includes('application/msword') ||
        mimeType.includes('application/vnd.openxmlformats') ||
        mimeType.includes('text/')) return FileType.DOCUMENT;
    if (mimeType.includes('application/zip') ||
        mimeType.includes('application/x-rar') ||
        mimeType.includes('application/x-7z')) return FileType.ARCHIVE;
    
    return FileType.OTHER;
  }

  private shouldAutoOcr(fileType: FileType, mimeType: string): boolean {
    return fileType === FileType.IMAGE || 
           mimeType === 'application/pdf' ||
           fileType === FileType.DOCUMENT;
  }

  private shouldAutoThumbnail(fileType: FileType): boolean {
    return fileType === FileType.IMAGE || 
           fileType === FileType.VIDEO ||
           fileType === FileType.DOCUMENT;
  }

  private shouldAutoCompress(fileSize: number): boolean {
    // Auto-compress files larger than 10MB
    return fileSize > 10 * 1024 * 1024;
  }

  async getFileStatistics(filters?: {
    period?: number;
    uploadedBy?: string;
    fileType?: FileType;
    entityType?: string;
  }) {
    const whereClause = [];
    const params = [];

    // Exclude deleted files
    whereClause.push('status != \'deleted\'');

    if (filters?.period) {
      whereClause.push('created_at >= NOW() - INTERVAL \\'' + filters.period + ' days\\'');
    }

    if (filters?.fileType) {
      whereClause.push('file_type = $' + (params.length + 1));
      params.push(filters.fileType);
    }

    if (filters?.uploadedBy) {
      whereClause.push('uploaded_by = $' + (params.length + 1));
      params.push(filters.uploadedBy);
    }

    if (filters?.entityType) {
      whereClause.push('entity_type = $' + (params.length + 1));
      params.push(filters.entityType);
    }

    const whereSQL = whereClause.length > 0 ? 'WHERE ' + whereClause.join(' AND ') : '';

    const [
      totalFiles,
      filesByType,
      filesByStatus,
      totalSize,
      accessStats,
    ] = await Promise.all([
      this.fileRepository.query(`
        SELECT COUNT(*) as count
        FROM files.files
        ${whereSQL}
      `, params),
      this.fileRepository.query(`
        SELECT file_type, COUNT(*) as count, SUM(file_size) as total_size
        FROM files.files
        ${whereSQL}
        GROUP BY file_type
        ORDER BY count DESC
      `, params),
      this.fileRepository.query(`
        SELECT status, COUNT(*) as count
        FROM files.files
        ${whereSQL}
        GROUP BY status
        ORDER BY count DESC
      `, params),
      this.fileRepository.query(`
        SELECT SUM(file_size) as total_size, AVG(file_size) as avg_size
        FROM files.files
        ${whereSQL}
      `, params),
      this.fileRepository.query(`
        SELECT 
          COUNT(CASE WHEN last_accessed_at IS NOT NULL THEN 1 END) as accessed_files,
          COUNT(CASE WHEN preview_url IS NOT NULL THEN 1 END) as files_with_preview,
          COUNT(CASE WHEN integration_settings->'shareSettings'->>'isShared' = 'true' THEN 1 END) as shared_files
        FROM files.files
        ${whereSQL}
      `, params),
    ]);

    return {
      totals: {
        totalFiles: parseInt(totalFiles[0].count),
        totalSize: parseInt(totalSize[0].total_size || 0),
        avgSize: parseFloat(totalSize[0].avg_size || 0),
        accessedFiles: parseInt(accessStats[0].accessed_files),
        filesWithPreview: parseInt(accessStats[0].files_with_preview),
        sharedFiles: parseInt(accessStats[0].shared_files),
      },
      breakdown: {
        byType: filesByType,
        byStatus: filesByStatus,
      },
    };
  }
}