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

import { DocumentService } from '../services/document.service';
import { CreateDocumentDto } from '../dto/create-document.dto';
import { UpdateDocumentDto } from '../dto/update-document.dto';
import { Document } from '../entities/document.entity';
import { JwtAuthGuard } from '../../../guards/jwt-auth.guard';
import { RolesGuard } from '../../../guards/roles.guard';
import { Roles } from '../../../decorators/roles.decorator';
import { UserRole } from '../../../enums/user-role.enum';

@ApiTags('Documents')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('documents')
export class DocumentController {
  constructor(private readonly documentService: DocumentService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.DISPATCHER, UserRole.GATE_OPERATOR)
  @ApiOperation({ summary: 'Создать новый документ' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Документ успешно создан',
    type: Document,
  })
  async create(@Body() createDocumentDto: CreateDocumentDto): Promise<Document> {
    return this.documentService.create(createDocumentDto);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.DISPATCHER, UserRole.GATE_OPERATOR)
  @ApiOperation({ summary: 'Получить список всех документов' })
  @ApiQuery({ name: 'page', required: false, description: 'Номер страницы' })
  @ApiQuery({ name: 'limit', required: false, description: 'Количество элементов на странице' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Список документов получен',
  })
  async findAll(
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ): Promise<{
    documents: Document[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    return this.documentService.findAll(+page, +limit);
  }

  @Get('search')
  @Roles(UserRole.ADMIN, UserRole.DISPATCHER, UserRole.GATE_OPERATOR)
  @ApiOperation({ summary: 'Поиск документов' })
  @ApiQuery({ name: 'q', required: true, description: 'Поисковый запрос' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Результаты поиска получены',
    type: [Document],
  })
  async search(@Query('q') query: string): Promise<Document[]> {
    return this.documentService.searchDocuments(query);
  }

  @Get('statistics')
  @Roles(UserRole.ADMIN, UserRole.DISPATCHER)
  @ApiOperation({ summary: 'Получить статистику по документам' })
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
    return this.documentService.getDocumentStatistics();
  }

  @Get('by-type/:type')
  @Roles(UserRole.ADMIN, UserRole.DISPATCHER, UserRole.GATE_OPERATOR)
  @ApiOperation({ summary: 'Получить документы по типу' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Документы получены',
    type: [Document],
  })
  async findByType(@Param('type') type: string): Promise<Document[]> {
    return this.documentService.findByType(type);
  }

  @Get('by-entity/:entityType/:entityId')
  @Roles(UserRole.ADMIN, UserRole.DISPATCHER, UserRole.GATE_OPERATOR)
  @ApiOperation({ summary: 'Получить документы сущности' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Документы сущности получены',
    type: [Document],
  })
  async findByEntity(
    @Param('entityType') entityType: string,
    @Param('entityId') entityId: string,
  ): Promise<Document[]> {
    return this.documentService.findByEntity(entityType, entityId);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.DISPATCHER, UserRole.GATE_OPERATOR)
  @ApiOperation({ summary: 'Получить документ по ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Документ найден',
    type: Document,
  })
  async findOne(@Param('id') id: string): Promise<Document> {
    return this.documentService.findOne(id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.DISPATCHER)
  @ApiOperation({ summary: 'Обновить документ' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Документ обновлен',
    type: Document,
  })
  async update(
    @Param('id') id: string,
    @Body() updateDocumentDto: UpdateDocumentDto,
  ): Promise<Document> {
    return this.documentService.update(id, updateDocumentDto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Удалить документ' })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Документ удален',
  })
  async remove(@Param('id') id: string): Promise<void> {
    return this.documentService.remove(id);
  }
}