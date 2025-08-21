import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { EirService, CreateEirDto, UpdateEirDto, FilterEirsDto, CreateDamageDto } from '../services/eir.service';
import { Eir } from '../entities/eir.entity';

@ApiTags('EIR Management')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('gate/eir')
export class EirController {
  constructor(private readonly eirService: EirService) {}

  /**
   * Создание нового EIR
   */
  @Post()
  @ApiOperation({ summary: 'Создание нового EIR' })
  @ApiResponse({ status: 201, description: 'EIR успешно создан', type: Eir })
  @ApiResponse({ status: 400, description: 'Некорректные данные' })
  @ApiResponse({ status: 401, description: 'Не авторизован' })
  async create(@Body() createEirDto: CreateEirDto, @Request() req): Promise<Eir> {
    return this.eirService.create(createEirDto, req.user.sub);
  }

  /**
   * Получение всех EIR с фильтрацией и пагинацией
   */
  @Get()
  @ApiOperation({ summary: 'Получение списка EIR' })
  @ApiResponse({ status: 200, description: 'Список EIR получен успешно' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Номер страницы' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Количество записей на странице' })
  @ApiQuery({ name: 'status', required: false, type: String, description: 'Фильтр по статусу' })
  @ApiQuery({ name: 'type', required: false, type: String, description: 'Фильтр по типу' })
  @ApiQuery({ name: 'containerId', required: false, type: String, description: 'Фильтр по ID контейнера' })
  @ApiQuery({ name: 'gatePassId', required: false, type: String, description: 'Фильтр по ID пропуска' })
  @ApiQuery({ name: 'inspectorId', required: false, type: String, description: 'Фильтр по ID инспектора' })
  @ApiQuery({ name: 'dateFrom', required: false, type: Date, description: 'Дата начала периода' })
  @ApiQuery({ name: 'dateTo', required: false, type: Date, description: 'Дата окончания периода' })
  @ApiQuery({ name: 'search', required: false, type: String, description: 'Поиск по тексту' })
  @ApiQuery({ name: 'sortBy', required: false, type: String, description: 'Поле для сортировки' })
  @ApiQuery({ name: 'sortOrder', required: false, enum: ['ASC', 'DESC'], description: 'Направление сортировки' })
  async findAll(@Query() filters: FilterEirsDto): Promise<{
    eirs: Eir[];
    total: number;
    page: number;
    limit: number;
  }> {
    return this.eirService.findAll(filters);
  }

  /**
   * Получение EIR по ID
   */
  @Get(':id')
  @ApiOperation({ summary: 'Получение EIR по ID' })
  @ApiResponse({ status: 200, description: 'EIR найден', type: Eir })
  @ApiResponse({ status: 404, description: 'EIR не найден' })
  async findOne(@Param('id') id: string): Promise<Eir> {
    return this.eirService.findOne(id);
  }

  /**
   * Получение EIR по номеру
   */
  @Get('number/:eirNumber')
  @ApiOperation({ summary: 'Получение EIR по номеру' })
  @ApiResponse({ status: 200, description: 'EIR найден', type: Eir })
  @ApiResponse({ status: 404, description: 'EIR не найден' })
  async findByNumber(@Param('eirNumber') eirNumber: string): Promise<Eir> {
    return this.eirService.findByNumber(eirNumber);
  }

  /**
   * Обновление EIR
   */
  @Put(':id')
  @ApiOperation({ summary: 'Обновление EIR' })
  @ApiResponse({ status: 200, description: 'EIR успешно обновлен', type: Eir })
  @ApiResponse({ status: 400, description: 'Некорректные данные' })
  @ApiResponse({ status: 404, description: 'EIR не найден' })
  async update(
    @Param('id') id: string,
    @Body() updateEirDto: UpdateEirDto,
    @Request() req,
  ): Promise<Eir> {
    return this.eirService.update(id, updateEirDto, req.user.sub);
  }

  /**
   * Добавление повреждения к EIR
   */
  @Post(':id/damages')
  @ApiOperation({ summary: 'Добавление повреждения к EIR' })
  @ApiResponse({ status: 201, description: 'Повреждение успешно добавлено', type: Eir })
  @ApiResponse({ status: 400, description: 'Некорректные данные' })
  @ApiResponse({ status: 404, description: 'EIR не найден' })
  async addDamage(
    @Param('id') id: string,
    @Body() damageDto: Omit<CreateDamageDto, 'eirId'>,
    @Request() req,
  ): Promise<Eir> {
    const createDamageDto: CreateDamageDto = {
      ...damageDto,
      eirId: id,
    };
    return this.eirService.addDamage(createDamageDto, req.user.sub);
  }

  /**
   * Удаление повреждения из EIR
   */
  @Delete(':id/damages/:damageId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Удаление повреждения из EIR' })
  @ApiResponse({ status: 200, description: 'Повреждение успешно удалено', type: Eir })
  @ApiResponse({ status: 404, description: 'EIR или повреждение не найдено' })
  async removeDamage(
    @Param('id') id: string,
    @Param('damageId') damageId: string,
    @Request() req,
  ): Promise<Eir> {
    return this.eirService.removeDamage(id, damageId, req.user.sub);
  }

  /**
   * Завершение осмотра
   */
  @Post(':id/complete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Завершение осмотра' })
  @ApiResponse({ status: 200, description: 'Осмотр успешно завершен', type: Eir })
  @ApiResponse({ status: 400, description: 'Невозможно завершить осмотр' })
  @ApiResponse({ status: 404, description: 'EIR не найден' })
  async completeInspection(@Param('id') id: string, @Request() req): Promise<Eir> {
    return this.eirService.completeInspection(id, req.user.sub);
  }

  /**
   * Подписание EIR водителем
   */
  @Post(':id/sign/driver')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Подписание EIR водителем' })
  @ApiResponse({ status: 200, description: 'EIR успешно подписан водителем', type: Eir })
  @ApiResponse({ status: 400, description: 'Невозможно подписать EIR' })
  @ApiResponse({ status: 404, description: 'EIR не найден' })
  async signByDriver(
    @Param('id') id: string,
    @Body('signature') signature: string,
    @Request() req,
  ): Promise<Eir> {
    return this.eirService.signByDriver(id, signature, req.user.sub);
  }

  /**
   * Подписание EIR инспектором
   */
  @Post(':id/sign/inspector')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Подписание EIR инспектором' })
  @ApiResponse({ status: 200, description: 'EIR успешно подписан инспектором', type: Eir })
  @ApiResponse({ status: 400, description: 'Невозможно подписать EIR' })
  @ApiResponse({ status: 404, description: 'EIR не найден' })
  async signByInspector(
    @Param('id') id: string,
    @Body('signature') signature: string,
    @Request() req,
  ): Promise<Eir> {
    return this.eirService.signByInspector(id, signature, req.user.sub);
  }

  /**
   * Создание спора
   */
  @Post(':id/disputes')
  @ApiOperation({ summary: 'Создание спора по EIR' })
  @ApiResponse({ status: 201, description: 'Спор успешно создан', type: Eir })
  @ApiResponse({ status: 400, description: 'Некорректные данные' })
  @ApiResponse({ status: 404, description: 'EIR не найден' })
  async createDispute(
    @Param('id') id: string,
    @Body() dispute: {
      type: 'damage' | 'cleanliness' | 'seal' | 'other';
      description: string;
      reportedBy: 'driver' | 'inspector';
      evidence: string[];
    },
    @Request() req,
  ): Promise<Eir> {
    return this.eirService.createDispute(id, dispute, req.user.sub);
  }

  /**
   * Отмена EIR
   */
  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Отмена EIR' })
  @ApiResponse({ status: 200, description: 'EIR успешно отменен', type: Eir })
  @ApiResponse({ status: 400, description: 'Невозможно отменить EIR' })
  @ApiResponse({ status: 404, description: 'EIR не найден' })
  async cancel(
    @Param('id') id: string,
    @Body('reason') reason: string,
    @Request() req,
  ): Promise<Eir> {
    return this.eirService.cancel(id, reason, req.user.sub);
  }

  /**
   * Получение статистики EIR
   */
  @Get('analytics/statistics')
  @ApiOperation({ summary: 'Получение статистики EIR' })
  @ApiResponse({ status: 200, description: 'Статистика получена успешно' })
  async getStatistics(): Promise<{
    total: number;
    byStatus: Record<string, number>;
    byType: Record<string, number>;
    todayInspections: number;
    pendingSignatures: number;
    disputedCount: number;
  }> {
    return this.eirService.getStatistics();
  }
}