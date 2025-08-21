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
import { YardService, CreateYardDto, UpdateYardDto, YardSearchFilters } from '../services/yard.service';
import { Yard, YardStatus, YardType } from '../entities/yard.entity';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';

@ApiTags('yards')
@ApiBearerAuth()
@Controller('yards')
@UseGuards(JwtAuthGuard, RolesGuard)
export class YardController {
  constructor(private readonly yardService: YardService) {}

  @Post()
  @Roles('ADMIN', 'MANAGER')
  @UsePipes(new ValidationPipe({ transform: true }))
  @ApiOperation({ summary: 'Создать новый склад' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Склад успешно создан',
    type: Yard,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Неверные данные или склад с таким кодом уже существует',
  })
  async createYard(@Body() createYardDto: CreateYardDto): Promise<Yard> {
    return this.yardService.createYard(createYardDto);
  }

  @Get()
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER', 'GATE_OPERATOR', 'YARD_OPERATOR')
  @ApiOperation({ summary: 'Получить список всех складов' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Список складов получен',
    type: [Yard],
  })
  async getAllYards(): Promise<Yard[]> {
    return this.yardService.getAllYards();
  }

  @Get('search')
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER', 'GATE_OPERATOR', 'YARD_OPERATOR')
  @ApiOperation({ summary: 'Поиск складов по критериям' })
  @ApiQuery({ name: 'status', enum: YardStatus, required: false })
  @ApiQuery({ name: 'type', enum: YardType, required: false })
  @ApiQuery({ name: 'hasCapacity', type: Boolean, required: false })
  @ApiQuery({ name: 'minCapacity', type: Number, required: false })
  @ApiQuery({ name: 'maxCapacity', type: Number, required: false })
  @ApiQuery({ name: 'surfaceType', type: String, required: false })
  @ApiQuery({ name: 'hasDrainage', type: Boolean, required: false })
  @ApiQuery({ name: 'hasLighting', type: Boolean, required: false })
  @ApiQuery({ name: 'reeferPlugs', type: Boolean, required: false })
  @ApiQuery({ name: 'hasCctv', type: Boolean, required: false })
  @ApiQuery({ name: 'latitude', type: Number, required: false })
  @ApiQuery({ name: 'longitude', type: Number, required: false })
  @ApiQuery({ name: 'radiusKm', type: Number, required: false })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Результаты поиска получены',
    type: [Yard],
  })
  async searchYards(@Query() query: any): Promise<Yard[]> {
    const filters: YardSearchFilters = {};

    if (query.status) filters.status = query.status;
    if (query.type) filters.type = query.type;
    if (query.hasCapacity !== undefined) filters.hasCapacity = query.hasCapacity === 'true';
    if (query.minCapacity) filters.minCapacity = parseInt(query.minCapacity);
    if (query.maxCapacity) filters.maxCapacity = parseInt(query.maxCapacity);
    if (query.surfaceType) filters.surfaceType = query.surfaceType;
    if (query.hasDrainage !== undefined) filters.hasDrainage = query.hasDrainage === 'true';
    if (query.hasLighting !== undefined) filters.hasLighting = query.hasLighting === 'true';
    if (query.reeferPlugs !== undefined) filters.reeferPlugs = query.reeferPlugs === 'true';
    if (query.hasCctv !== undefined) filters.hasCctv = query.hasCctv === 'true';

    if (query.latitude && query.longitude && query.radiusKm) {
      filters.nearPoint = {
        latitude: parseFloat(query.latitude),
        longitude: parseFloat(query.longitude),
        radiusKm: parseFloat(query.radiusKm),
      };
    }

    return this.yardService.searchYards(filters);
  }

  @Get('nearby')
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER', 'GATE_OPERATOR', 'YARD_OPERATOR')
  @ApiOperation({ summary: 'Найти склады в радиусе от точки' })
  @ApiQuery({ name: 'latitude', type: Number, required: true })
  @ApiQuery({ name: 'longitude', type: Number, required: true })
  @ApiQuery({ name: 'radiusKm', type: Number, required: true })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Склады в радиусе найдены',
  })
  async getYardsWithinRadius(
    @Query('latitude') latitude: number,
    @Query('longitude') longitude: number,
    @Query('radiusKm') radiusKm: number,
  ) {
    return this.yardService.getYardsWithinRadius(latitude, longitude, radiusKm);
  }

  @Get(':id')
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER', 'GATE_OPERATOR', 'YARD_OPERATOR')
  @ApiOperation({ summary: 'Получить склад по ID' })
  @ApiParam({ name: 'id', description: 'ID склада' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Склад найден',
    type: Yard,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Склад не найден',
  })
  async getYardById(@Param('id') id: string): Promise<Yard> {
    return this.yardService.getYardById(id);
  }

  @Get('code/:yardCode')
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER', 'GATE_OPERATOR', 'YARD_OPERATOR')
  @ApiOperation({ summary: 'Получить склад по коду' })
  @ApiParam({ name: 'yardCode', description: 'Код склада' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Склад найден',
    type: Yard,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Склад не найден',
  })
  async getYardByCode(@Param('yardCode') yardCode: string): Promise<Yard> {
    return this.yardService.getYardByCode(yardCode);
  }

  @Put(':id')
  @Roles('ADMIN', 'MANAGER')
  @UsePipes(new ValidationPipe({ transform: true }))
  @ApiOperation({ summary: 'Обновить склад' })
  @ApiParam({ name: 'id', description: 'ID склада' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Склад обновлен',
    type: Yard,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Склад не найден',
  })
  async updateYard(
    @Param('id') id: string,
    @Body() updateYardDto: UpdateYardDto,
  ): Promise<Yard> {
    return this.yardService.updateYard(id, updateYardDto);
  }

  @Delete(':id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Удалить склад' })
  @ApiParam({ name: 'id', description: 'ID склада' })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Склад удален',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Склад не найден',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Нельзя удалить склад с активными размещениями',
  })
  async deleteYard(@Param('id') id: string): Promise<void> {
    return this.yardService.deleteYard(id);
  }

  @Get(':id/capacity')
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER')
  @ApiOperation({ summary: 'Получить информацию о вместимости склада' })
  @ApiParam({ name: 'id', description: 'ID склада' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Информация о вместимости получена',
  })
  async getYardCapacityInfo(@Param('id') id: string) {
    return this.yardService.getYardCapacityInfo(id);
  }

  @Get(':id/statistics')
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER')
  @ApiOperation({ summary: 'Получить статистику склада' })
  @ApiParam({ name: 'id', description: 'ID склада' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Статистика склада получена',
  })
  async getYardStatistics(@Param('id') id: string) {
    return this.yardService.getYardStatistics(id);
  }

  @Put(':id/activate')
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Активировать склад' })
  @ApiParam({ name: 'id', description: 'ID склада' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Склад активирован',
    type: Yard,
  })
  async activateYard(@Param('id') id: string): Promise<Yard> {
    return this.yardService.activateYard(id);
  }

  @Put(':id/deactivate')
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Деактивировать склад' })
  @ApiParam({ name: 'id', description: 'ID склада' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Склад деактивирован',
    type: Yard,
  })
  async deactivateYard(@Param('id') id: string): Promise<Yard> {
    return this.yardService.deactivateYard(id);
  }

  @Put(':id/maintenance')
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Перевести склад в режим обслуживания' })
  @ApiParam({ name: 'id', description: 'ID склада' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Склад переведен в режим обслуживания',
    type: Yard,
  })
  async setMaintenanceMode(@Param('id') id: string): Promise<Yard> {
    return this.yardService.setMaintenanceMode(id);
  }

  @Put(':id/emergency-close')
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Экстренное закрытие склада' })
  @ApiParam({ name: 'id', description: 'ID склада' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Склад экстренно закрыт',
    type: Yard,
  })
  async emergencyClose(
    @Param('id') id: string,
    @Body('reason') reason: string,
  ): Promise<Yard> {
    return this.yardService.emergencyClose(id, reason);
  }

  @Put(':id/update-occupancy')
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER')
  @ApiOperation({ summary: 'Обновить текущую заполненность склада' })
  @ApiParam({ name: 'id', description: 'ID склада' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Заполненность обновлена',
  })
  async updateOccupancy(@Param('id') id: string): Promise<void> {
    return this.yardService.updateOccupancy(id);
  }
}