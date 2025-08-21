import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';

import { AttachmentService } from '../services/attachment.service';
import { CreateAttachmentDto } from '../dto/create-attachment.dto';
import { UpdateAttachmentDto } from '../dto/update-attachment.dto';
import { Attachment } from '../entities/attachment.entity';
import { JwtAuthGuard } from '../../../guards/jwt-auth.guard';
import { RolesGuard } from '../../../guards/roles.guard';
import { Roles } from '../../../decorators/roles.decorator';
import { UserRole } from '../../../enums/user-role.enum';

@ApiTags('Attachments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('attachments')
export class AttachmentController {
  constructor(private readonly attachmentService: AttachmentService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.DISPATCHER, UserRole.GATE_OPERATOR)
  @ApiOperation({ summary: 'Создать новое вложение' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Вложение успешно создано',
    type: Attachment,
  })
  async create(@Body() createAttachmentDto: CreateAttachmentDto): Promise<Attachment> {
    return this.attachmentService.create(createAttachmentDto);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.DISPATCHER, UserRole.GATE_OPERATOR)
  @ApiOperation({ summary: 'Получить список всех вложений' })
  @ApiQuery({ name: 'page', required: false, description: 'Номер страницы' })
  @ApiQuery({ name: 'limit', required: false, description: 'Количество элементов на странице' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Список вложений получен',
  })
  async findAll(
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ): Promise<{
    attachments: Attachment[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    return this.attachmentService.findAll(+page, +limit);
  }

  @Get('search')
  @Roles(UserRole.ADMIN, UserRole.DISPATCHER, UserRole.GATE_OPERATOR)
  @ApiOperation({ summary: 'Поиск вложений' })
  @ApiQuery({ name: 'q', required: true, description: 'Поисковый запрос' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Результаты поиска получены',
    type: [Attachment],
  })
  async search(@Query('q') query: string): Promise<Attachment[]> {
    return this.attachmentService.searchAttachments(query);
  }

  @Get('statistics')
  @Roles(UserRole.ADMIN, UserRole.DISPATCHER)
  @ApiOperation({ summary: 'Получить статистику по вложениям' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Статистика получена',
  })
  async getStatistics(): Promise<{
    total: number;
    byType: Record<string, number>;
    totalSize: number;
    averageSize: number;
  }> {
    return this.attachmentService.getAttachmentStatistics();
  }

  @Get('storage-usage')
  @Roles(UserRole.ADMIN, UserRole.DISPATCHER)
  @ApiOperation({ summary: 'Получить использование хранилища' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Информация о хранилище получена',
  })
  async getStorageUsage(): Promise<{ totalSize: number }> {
    const totalSize = await this.attachmentService.getTotalStorageUsed();
    return { totalSize };
  }

  @Get('by-document/:documentId')
  @Roles(UserRole.ADMIN, UserRole.DISPATCHER, UserRole.GATE_OPERATOR)
  @ApiOperation({ summary: 'Получить вложения документа' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Вложения документа получены',
    type: [Attachment],
  })
  async findByDocument(@Param('documentId') documentId: string): Promise<Attachment[]> {
    return this.attachmentService.findByDocument(documentId);
  }

  @Get('by-type/:fileType')
  @Roles(UserRole.ADMIN, UserRole.DISPATCHER, UserRole.GATE_OPERATOR)
  @ApiOperation({ summary: 'Получить вложения по типу файла' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Вложения получены',
    type: [Attachment],
  })
  async findByType(@Param('fileType') fileType: string): Promise<Attachment[]> {
    return this.attachmentService.findByType(fileType);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.DISPATCHER, UserRole.GATE_OPERATOR)
  @ApiOperation({ summary: 'Получить вложение по ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Вложение найдено',
    type: Attachment,
  })
  async findOne(@Param('id') id: string): Promise<Attachment> {
    return this.attachmentService.findOne(id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.DISPATCHER)
  @ApiOperation({ summary: 'Обновить вложение' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Вложение обновлено',
    type: Attachment,
  })
  async update(
    @Param('id') id: string,
    @Body() updateAttachmentDto: UpdateAttachmentDto,
  ): Promise<Attachment> {
    return this.attachmentService.update(id, updateAttachmentDto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Удалить вложение' })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Вложение удалено',
  })
  async remove(@Param('id') id: string): Promise<void> {
    return this.attachmentService.remove(id);
  }
}