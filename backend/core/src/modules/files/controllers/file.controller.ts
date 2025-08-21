import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  ValidationPipe,
  UsePipes,
  HttpStatus,
  UseGuards,
  UploadedFile,
  UseInterceptors,
  Req,
  Res,
  StreamableFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBearerAuth,
  ApiConsumes,
} from '@nestjs/swagger';
import { Request, Response } from 'express';
import { 
  FileService, 
  CreateFileDto, 
  UpdateFileDto, 
  FileSearchFilters 
} from '../services/file.service';
import { File, FileType, FileStatus, AccessLevel } from '../entities/file.entity';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';

@ApiTags('files')
@ApiBearerAuth()
@Controller('files')
@UseGuards(JwtAuthGuard, RolesGuard)
export class FileController {
  constructor(private readonly fileService: FileService) {}

  @Post('upload')
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Загрузить файл' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Файл успешно загружен',
    type: File,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Неверные данные файла',
  })
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Body() metadata: {
      entityType?: string;
      entityId?: string;
      description?: string;
      tags?: string;
      accessLevel?: AccessLevel;
    },
    @Req() req: any,
  ): Promise<File> {
    if (!file) {
      throw new Error('File is required');
    }

    // Parse tags if provided as string
    const tags = metadata.tags ? metadata.tags.split(',').map(tag => tag.trim()) : [];

    const createFileDto: CreateFileDto = {
      fileName: `${Date.now()}_${file.originalname}`,
      originalName: file.originalname,
      mimeType: file.mimetype,
      fileSize: file.size,
      fileType: this.determineFileType(file.mimetype),
      accessLevel: metadata.accessLevel || AccessLevel.INTERNAL,
      storagePath: `/uploads/${Date.now()}_${file.originalname}`,
      storageBucket: 'default',
      entityType: metadata.entityType,
      entityId: metadata.entityId,
      uploadedBy: req.user.sub,
      uploadedByName: req.user.name || req.user.email,
      description: metadata.description,
      tags,
    };

    return this.fileService.createFile(createFileDto);
  }

  @Get()
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER')
  @ApiOperation({ summary: 'Получить список всех файлов' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Список файлов получен',
    type: [File],
  })
  async getAllFiles(): Promise<File[]> {
    return this.fileService.getAllFiles();
  }

  @Get('search')
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER')
  @ApiOperation({ summary: 'Поиск файлов по критериям' })
  @ApiQuery({ name: 'fileType', enum: FileType, required: false })
  @ApiQuery({ name: 'status', enum: FileStatus, required: false })
  @ApiQuery({ name: 'accessLevel', enum: AccessLevel, required: false })
  @ApiQuery({ name: 'entityType', type: String, required: false })
  @ApiQuery({ name: 'entityId', type: String, required: false })
  @ApiQuery({ name: 'uploadedBy', type: String, required: false })
  @ApiQuery({ name: 'mimeType', type: String, required: false })
  @ApiQuery({ name: 'fileSizeMin', type: Number, required: false })
  @ApiQuery({ name: 'fileSizeMax', type: Number, required: false })
  @ApiQuery({ name: 'uploadedAfter', type: Date, required: false })
  @ApiQuery({ name: 'uploadedBefore', type: Date, required: false })
  @ApiQuery({ name: 'hasPreview', type: Boolean, required: false })
  @ApiQuery({ name: 'hasThumbnail', type: Boolean, required: false })
  @ApiQuery({ name: 'isExpired', type: Boolean, required: false })
  @ApiQuery({ name: 'isShared', type: Boolean, required: false })
  @ApiQuery({ name: 'tags', type: String, required: false, description: 'Comma-separated tags' })
  @ApiQuery({ name: 'searchText', type: String, required: false })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Результаты поиска получены',
    type: [File],
  })
  async searchFiles(@Query() query: any): Promise<File[]> {
    const filters: FileSearchFilters = {};

    if (query.fileType) filters.fileType = query.fileType;
    if (query.status) filters.status = query.status;
    if (query.accessLevel) filters.accessLevel = query.accessLevel;
    if (query.entityType) filters.entityType = query.entityType;
    if (query.entityId) filters.entityId = query.entityId;
    if (query.uploadedBy) filters.uploadedBy = query.uploadedBy;
    if (query.mimeType) filters.mimeType = query.mimeType;
    if (query.fileSizeMin) filters.fileSizeMin = parseInt(query.fileSizeMin);
    if (query.fileSizeMax) filters.fileSizeMax = parseInt(query.fileSizeMax);
    if (query.uploadedAfter) filters.uploadedAfter = new Date(query.uploadedAfter);
    if (query.uploadedBefore) filters.uploadedBefore = new Date(query.uploadedBefore);
    if (query.hasPreview !== undefined) filters.hasPreview = query.hasPreview === 'true';
    if (query.hasThumbnail !== undefined) filters.hasThumbnail = query.hasThumbnail === 'true';
    if (query.isExpired !== undefined) filters.isExpired = query.isExpired === 'true';
    if (query.isShared !== undefined) filters.isShared = query.isShared === 'true';
    if (query.tags) filters.tags = query.tags.split(',').map(tag => tag.trim());
    if (query.searchText) filters.searchText = query.searchText;

    return this.fileService.searchFiles(filters);
  }

  @Get('statistics')
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Получить статистику файлов' })
  @ApiQuery({ name: 'period', type: Number, required: false, description: 'Период в днях' })
  @ApiQuery({ name: 'uploadedBy', type: String, required: false })
  @ApiQuery({ name: 'fileType', enum: FileType, required: false })
  @ApiQuery({ name: 'entityType', type: String, required: false })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Статистика файлов получена',
  })
  async getFileStatistics(@Query() query: any) {
    const filters: any = {};
    if (query.period) filters.period = parseInt(query.period);
    if (query.uploadedBy) filters.uploadedBy = query.uploadedBy;
    if (query.fileType) filters.fileType = query.fileType;
    if (query.entityType) filters.entityType = query.entityType;

    return this.fileService.getFileStatistics(filters);
  }

  @Get('entity/:entityType/:entityId')
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER')
  @ApiOperation({ summary: 'Получить файлы сущности' })
  @ApiParam({ name: 'entityType', description: 'Тип сущности' })
  @ApiParam({ name: 'entityId', description: 'ID сущности' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Файлы сущности получены',
    type: [File],
  })
  async getFilesByEntity(
    @Param('entityType') entityType: string,
    @Param('entityId') entityId: string,
  ): Promise<File[]> {
    return this.fileService.getFilesByEntity(entityType, entityId);
  }

  @Get('type/:fileType')
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER')
  @ApiOperation({ summary: 'Получить файлы по типу' })
  @ApiParam({ name: 'fileType', enum: FileType, description: 'Тип файла' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Файлы по типу получены',
    type: [File],
  })
  async getFilesByType(@Param('fileType') fileType: FileType): Promise<File[]> {
    return this.fileService.getFilesByType(fileType);
  }

  @Get('expired')
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Получить просроченные файлы' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Просроченные файлы получены',
    type: [File],
  })
  async getExpiredFiles(): Promise<File[]> {
    return this.fileService.getExpiredFiles();
  }

  @Get('shared')
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER')
  @ApiOperation({ summary: 'Получить расшаренные файлы' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Расшаренные файлы получены',
    type: [File],
  })
  async getSharedFiles(): Promise<File[]> {
    return this.fileService.getSharedFiles();
  }

  @Get('share/:shareToken')
  @ApiOperation({ summary: 'Получить файл по токену доступа' })
  @ApiParam({ name: 'shareToken', description: 'Токен доступа к файлу' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Файл найден',
    type: File,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Файл не найден или доступ отозван',
  })
  async getFileByShareToken(@Param('shareToken') shareToken: string): Promise<File> {
    return this.fileService.getFileByShareToken(shareToken);
  }

  @Get(':id')
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER')
  @ApiOperation({ summary: 'Получить файл по ID' })
  @ApiParam({ name: 'id', description: 'ID файла' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Файл найден',
    type: File,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Файл не найден',
  })
  async getFileById(@Param('id') id: string): Promise<File> {
    return this.fileService.getFileById(id);
  }

  @Get(':id/download')
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER')
  @ApiOperation({ summary: 'Скачать файл' })
  @ApiParam({ name: 'id', description: 'ID файла' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Файл скачан',
  })
  async downloadFile(
    @Param('id') id: string,
    @Req() req: any,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const file = await this.fileService.getFileById(id);

    if (!file.canDownload) {
      throw new Error('File download not allowed');
    }

    // Record access
    await this.fileService.recordAccess(
      id,
      req.user.sub,
      req.user.name || req.user.email,
      'download',
      {
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      },
    );

    // Set response headers
    res.set({
      'Content-Type': file.mimeType,
      'Content-Disposition': `attachment; filename="${file.originalName}"`,
    });

    // TODO: Implement actual file streaming from storage
    // This is a placeholder - actual implementation would stream from MinIO/S3
    const fileBuffer = Buffer.from('File content placeholder');
    return new StreamableFile(fileBuffer);
  }

  @Get(':id/preview')
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER')
  @ApiOperation({ summary: 'Предварительный просмотр файла' })
  @ApiParam({ name: 'id', description: 'ID файла' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Предварительный просмотр файла',
  })
  async previewFile(
    @Param('id') id: string,
    @Req() req: any,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const file = await this.fileService.getFileById(id);

    if (!file.hasPreview) {
      throw new Error('File preview not available');
    }

    // Record access
    await this.fileService.recordAccess(
      id,
      req.user.sub,
      req.user.name || req.user.email,
      'view',
      {
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      },
    );

    // Set response headers
    res.set({
      'Content-Type': file.mimeType,
      'Content-Disposition': 'inline',
    });

    // TODO: Implement actual preview streaming from storage
    const previewBuffer = Buffer.from('Preview content placeholder');
    return new StreamableFile(previewBuffer);
  }

  @Get(':id/versions')
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER')
  @ApiOperation({ summary: 'Получить версии файла' })
  @ApiParam({ name: 'id', description: 'ID файла' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Версии файла получены',
    type: [File],
  })
  async getFileVersions(@Param('id') id: string): Promise<File[]> {
    return this.fileService.getFileVersions(id);
  }

  @Put(':id')
  @Roles('ADMIN', 'MANAGER')
  @UsePipes(new ValidationPipe({ transform: true }))
  @ApiOperation({ summary: 'Обновить метаданные файла' })
  @ApiParam({ name: 'id', description: 'ID файла' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Файл обновлен',
    type: File,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Файл не найден',
  })
  async updateFile(
    @Param('id') id: string,
    @Body() updateFileDto: UpdateFileDto,
  ): Promise<File> {
    return this.fileService.updateFile(id, updateFileDto);
  }

  @Put(':id/processed')
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Отметить файл как обработанный' })
  @ApiParam({ name: 'id', description: 'ID файла' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Файл отмечен как обработанный',
    type: File,
  })
  async markAsProcessed(
    @Param('id') id: string,
    @Body() data: {
      downloadUrl?: string;
      previewUrl?: string;
      thumbnailUrl?: string;
      metadata?: any;
    },
  ): Promise<File> {
    return this.fileService.markAsProcessed(id, data, data.metadata);
  }

  @Post(':id/versions')
  @Roles('ADMIN', 'MANAGER')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Создать новую версию файла' })
  @ApiParam({ name: 'id', description: 'ID оригинального файла' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Новая версия файла создана',
    type: File,
  })
  async createNewVersion(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() metadata: { changeDescription?: string },
    @Req() req: any,
  ): Promise<File> {
    if (!file) {
      throw new Error('File is required');
    }

    const createFileDto: CreateFileDto = {
      fileName: `${Date.now()}_${file.originalname}`,
      originalName: file.originalname,
      mimeType: file.mimetype,
      fileSize: file.size,
      fileType: this.determineFileType(file.mimetype),
      storagePath: `/uploads/${Date.now()}_${file.originalname}`,
      storageBucket: 'default',
      uploadedBy: req.user.sub,
      uploadedByName: req.user.name || req.user.email,
    };

    return this.fileService.createNewVersion(id, createFileDto);
  }

  @Post(':id/share')
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Создать ссылку для совместного доступа' })
  @ApiParam({ name: 'id', description: 'ID файла' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Ссылка для совместного доступа создана',
  })
  async createShare(
    @Param('id') id: string,
    @Body() settings: {
      expiryDate?: Date;
      downloadLimit?: number;
      viewLimit?: number;
      publicAccess?: boolean;
      passwordProtected?: boolean;
    },
  ): Promise<{ shareToken: string; shareUrl: string }> {
    return this.fileService.createShare(id, settings);
  }

  @Delete(':id/share')
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Отозвать ссылку для совместного доступа' })
  @ApiParam({ name: 'id', description: 'ID файла' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Ссылка для совместного доступа отозвана',
    type: File,
  })
  async revokeShare(@Param('id') id: string): Promise<File> {
    return this.fileService.revokeShare(id);
  }

  @Delete(':id')
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Удалить файл' })
  @ApiParam({ name: 'id', description: 'ID файла' })
  @ApiQuery({ name: 'permanent', type: Boolean, required: false, description: 'Полное удаление' })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Файл удален',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Файл не найден',
  })
  async deleteFile(
    @Param('id') id: string,
    @Query('permanent') permanent: boolean = false,
  ): Promise<void> {
    return this.fileService.deleteFile(id, permanent);
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
}