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
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { 
  TariffService, 
  CreateTariffDto, 
  UpdateTariffDto, 
  TariffSearchFilters 
} from '../services/tariff.service';
import { Tariff, TariffType, TariffStatus, PricingModel, UnitOfMeasure } from '../entities/tariff.entity';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';

@ApiTags('tariffs')
@ApiBearerAuth()
@Controller('tariffs')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TariffController {
  constructor(private readonly tariffService: TariffService) {}

  @Post()
  @Roles('ADMIN', 'MANAGER')
  @UsePipes(new ValidationPipe({ transform: true }))
  @ApiOperation({ summary: 'Создать новый тариф' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Тариф успешно создан',
    type: Tariff,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Неверные данные',
  })
  async createTariff(@Body() createTariffDto: CreateTariffDto): Promise<Tariff> {
    return this.tariffService.createTariff(createTariffDto);
  }

  @Get()
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER')
  @ApiOperation({ summary: 'Получить список всех тарифов' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Список тарифов получен',
    type: [Tariff],
  })
  async getAllTariffs(): Promise<Tariff[]> {
    return this.tariffService.getAllTariffs();
  }

  @Get('search')
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER')
  @ApiOperation({ summary: 'Поиск тарифов по критериям' })
  @ApiQuery({ name: 'tariffType', enum: TariffType, required: false })
  @ApiQuery({ name: 'status', enum: TariffStatus, required: false })
  @ApiQuery({ name: 'pricingModel', enum: PricingModel, required: false })
  @ApiQuery({ name: 'clientId', type: String, required: false })
  @ApiQuery({ name: 'effectiveDateAfter', type: Date, required: false })
  @ApiQuery({ name: 'effectiveDateBefore', type: Date, required: false })
  @ApiQuery({ name: 'expiryDateAfter', type: Date, required: false })
  @ApiQuery({ name: 'expiryDateBefore', type: Date, required: false })
  @ApiQuery({ name: 'basePriceMin', type: Number, required: false })
  @ApiQuery({ name: 'basePriceMax', type: Number, required: false })
  @ApiQuery({ name: 'currency', type: String, required: false })
  @ApiQuery({ name: 'unitOfMeasure', enum: UnitOfMeasure, required: false })
  @ApiQuery({ name: 'isActive', type: Boolean, required: false })
  @ApiQuery({ name: 'isExpiring', type: Boolean, required: false })
  @ApiQuery({ name: 'searchText', type: String, required: false })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Результаты поиска получены',
    type: [Tariff],
  })
  async searchTariffs(@Query() query: any): Promise<Tariff[]> {
    const filters: TariffSearchFilters = {};

    if (query.tariffType) filters.tariffType = query.tariffType;
    if (query.status) filters.status = query.status;
    if (query.pricingModel) filters.pricingModel = query.pricingModel;
    if (query.clientId) filters.clientId = query.clientId;
    if (query.effectiveDateAfter) filters.effectiveDateAfter = new Date(query.effectiveDateAfter);
    if (query.effectiveDateBefore) filters.effectiveDateBefore = new Date(query.effectiveDateBefore);
    if (query.expiryDateAfter) filters.expiryDateAfter = new Date(query.expiryDateAfter);
    if (query.expiryDateBefore) filters.expiryDateBefore = new Date(query.expiryDateBefore);
    if (query.basePriceMin) filters.basePriceMin = parseFloat(query.basePriceMin);
    if (query.basePriceMax) filters.basePriceMax = parseFloat(query.basePriceMax);
    if (query.currency) filters.currency = query.currency;
    if (query.unitOfMeasure) filters.unitOfMeasure = query.unitOfMeasure;
    if (query.isActive !== undefined) filters.isActive = query.isActive === 'true';
    if (query.isExpiring !== undefined) filters.isExpiring = query.isExpiring === 'true';
    if (query.searchText) filters.searchText = query.searchText;

    return this.tariffService.searchTariffs(filters);
  }

  @Get('statistics')
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Получить статистику тарифов' })
  @ApiQuery({ name: 'period', type: Number, required: false, description: 'Период в днях' })
  @ApiQuery({ name: 'tariffType', enum: TariffType, required: false })
  @ApiQuery({ name: 'clientId', type: String, required: false })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Статистика тарифов получена',
  })
  async getTariffStatistics(@Query() query: any) {
    const filters: any = {};
    if (query.period) filters.period = parseInt(query.period);
    if (query.tariffType) filters.tariffType = query.tariffType;
    if (query.clientId) filters.clientId = query.clientId;

    return this.tariffService.getTariffStatistics(filters);
  }

  @Get('active')
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER')
  @ApiOperation({ summary: 'Получить активные тарифы' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Активные тарифы получены',
    type: [Tariff],
  })
  async getActiveTariffs(): Promise<Tariff[]> {
    return this.tariffService.getActiveTariffs();
  }

  @Get('expiring')
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Получить истекающие тарифы' })
  @ApiQuery({ name: 'daysAhead', type: Number, required: false, description: 'Количество дней вперед (по умолчанию 30)' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Истекающие тарифы получены',
    type: [Tariff],
  })
  async getExpiringTariffs(@Query('daysAhead') daysAhead?: number): Promise<Tariff[]> {
    return this.tariffService.getExpiringTariffs(daysAhead);
  }

  @Get('general')
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER')
  @ApiOperation({ summary: 'Получить общие тарифы (не привязанные к клиентам)' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Общие тарифы получены',
    type: [Tariff],
  })
  async getGeneralTariffs(): Promise<Tariff[]> {
    return this.tariffService.getGeneralTariffs();
  }

  @Get('applicable')
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER')
  @ApiOperation({ summary: 'Найти применимый тариф' })
  @ApiQuery({ name: 'tariffType', enum: TariffType, required: true })
  @ApiQuery({ name: 'clientId', type: String, required: false })
  @ApiQuery({ name: 'containerType', type: String, required: false })
  @ApiQuery({ name: 'serviceDate', type: Date, required: false })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Применимый тариф найден',
    type: Tariff,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Применимый тариф не найден',
  })
  async getApplicableTariff(@Query() query: any): Promise<Tariff> {
    return this.tariffService.getApplicableTariff(
      query.tariffType,
      query.clientId,
      query.containerType,
      query.serviceDate ? new Date(query.serviceDate) : undefined,
    );
  }

  @Post(':id/calculate')
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER')
  @ApiOperation({ summary: 'Рассчитать стоимость по тарифу' })
  @ApiParam({ name: 'id', description: 'ID тарифа' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Стоимость рассчитана',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Тариф неактивен или неверные параметры',
  })
  async calculatePrice(
    @Param('id') id: string,
    @Body() calculation: {
      quantity: number;
      containerType?: string;
      weight?: number;
      serviceDate?: Date;
      timeSlot?: string;
    },
  ) {
    return this.tariffService.calculatePrice(id, calculation.quantity, {
      containerType: calculation.containerType,
      weight: calculation.weight,
      serviceDate: calculation.serviceDate,
      timeSlot: calculation.timeSlot,
    });
  }

  @Get('type/:tariffType')
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER')
  @ApiOperation({ summary: 'Получить тарифы по типу' })
  @ApiParam({ name: 'tariffType', enum: TariffType, description: 'Тип тарифа' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Тарифы по типу получены',
    type: [Tariff],
  })
  async getTariffsByType(@Param('tariffType') tariffType: TariffType): Promise<Tariff[]> {
    return this.tariffService.getTariffsByType(tariffType);
  }

  @Get('status/:status')
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER')
  @ApiOperation({ summary: 'Получить тарифы по статусу' })
  @ApiParam({ name: 'status', enum: TariffStatus, description: 'Статус тарифа' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Тарифы по статусу получены',
    type: [Tariff],
  })
  async getTariffsByStatus(@Param('status') status: TariffStatus): Promise<Tariff[]> {
    return this.tariffService.getTariffsByStatus(status);
  }

  @Get('client/:clientId')
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER')
  @ApiOperation({ summary: 'Получить тарифы клиента' })
  @ApiParam({ name: 'clientId', description: 'ID клиента' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Тарифы клиента получены',
    type: [Tariff],
  })
  async getTariffsByClient(@Param('clientId') clientId: string): Promise<Tariff[]> {
    return this.tariffService.getTariffsByClient(clientId);
  }

  @Get('code/:tariffCode')
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER')
  @ApiOperation({ summary: 'Получить тариф по коду' })
  @ApiParam({ name: 'tariffCode', description: 'Код тарифа' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Тариф найден',
    type: Tariff,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Тариф не найден',
  })
  async getTariffByCode(@Param('tariffCode') tariffCode: string): Promise<Tariff> {
    return this.tariffService.getTariffByCode(tariffCode);
  }

  @Get(':id')
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER')
  @ApiOperation({ summary: 'Получить тариф по ID' })
  @ApiParam({ name: 'id', description: 'ID тарифа' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Тариф найден',
    type: Tariff,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Тариф не найден',
  })
  async getTariffById(@Param('id') id: string): Promise<Tariff> {
    return this.tariffService.getTariffById(id);
  }

  @Put(':id')
  @Roles('ADMIN', 'MANAGER')
  @UsePipes(new ValidationPipe({ transform: true }))
  @ApiOperation({ summary: 'Обновить тариф' })
  @ApiParam({ name: 'id', description: 'ID тарифа' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Тариф обновлен',
    type: Tariff,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Тариф не найден',
  })
  async updateTariff(
    @Param('id') id: string,
    @Body() updateTariffDto: UpdateTariffDto,
  ): Promise<Tariff> {
    return this.tariffService.updateTariff(id, updateTariffDto);
  }

  @Delete(':id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Удалить тариф' })
  @ApiParam({ name: 'id', description: 'ID тарифа' })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Тариф удален',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Тариф не найден',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Нельзя удалить активный тариф',
  })
  async deleteTariff(@Param('id') id: string): Promise<void> {
    return this.tariffService.deleteTariff(id);
  }

  @Put(':id/activate')
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Активировать тариф' })
  @ApiParam({ name: 'id', description: 'ID тарифа' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Тариф активирован',
    type: Tariff,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Нельзя активировать тариф в текущем статусе или найдены пересекающиеся тарифы',
  })
  async activateTariff(@Param('id') id: string): Promise<Tariff> {
    return this.tariffService.activateTariff(id);
  }

  @Put(':id/deactivate')
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Деактивировать тариф' })
  @ApiParam({ name: 'id', description: 'ID тарифа' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Тариф деактивирован',
    type: Tariff,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Нельзя деактивировать тариф в текущем статусе',
  })
  async deactivateTariff(
    @Param('id') id: string,
    @Body('reason') reason: string,
  ): Promise<Tariff> {
    return this.tariffService.deactivateTariff(id, reason);
  }
}