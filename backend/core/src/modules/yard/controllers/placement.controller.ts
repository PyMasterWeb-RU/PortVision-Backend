import {
  Controller,
  Get,
  Post,
  Put,
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
  PlacementService, 
  CreatePlacementDto, 
  UpdatePlacementDto, 
  PlacementSearchFilters 
} from '../services/placement.service';
import { Placement, PlacementStatus, PlacementType } from '../entities/placement.entity';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';

@ApiTags('placements')
@ApiBearerAuth()
@Controller('placements')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PlacementController {
  constructor(private readonly placementService: PlacementService) {}

  @Post()
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER', 'YARD_OPERATOR')
  @UsePipes(new ValidationPipe({ transform: true }))
  @ApiOperation({ summary: 'Создать новое размещение контейнера' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Размещение успешно создано',
    type: Placement,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Неверные данные или слот недоступен',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Контейнер или слот не найден',
  })
  async createPlacement(@Body() createPlacementDto: CreatePlacementDto): Promise<Placement> {
    return this.placementService.createPlacement(createPlacementDto);
  }

  @Get()
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER', 'YARD_OPERATOR', 'GATE_OPERATOR')
  @ApiOperation({ summary: 'Получить список всех размещений' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Список размещений получен',
    type: [Placement],
  })
  async getAllPlacements(): Promise<Placement[]> {
    return this.placementService.getAllPlacements();
  }

  @Get('search')
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER', 'YARD_OPERATOR', 'GATE_OPERATOR')
  @ApiOperation({ summary: 'Поиск размещений по критериям' })
  @ApiQuery({ name: 'status', enum: PlacementStatus, required: false })
  @ApiQuery({ name: 'type', enum: PlacementType, required: false })
  @ApiQuery({ name: 'yardId', type: String, required: false })
  @ApiQuery({ name: 'zoneId', type: String, required: false })
  @ApiQuery({ name: 'containerId', type: String, required: false })
  @ApiQuery({ name: 'containerNumber', type: String, required: false })
  @ApiQuery({ name: 'placedAfter', type: Date, required: false })
  @ApiQuery({ name: 'placedBefore', type: Date, required: false })
  @ApiQuery({ name: 'plannedRemovalAfter', type: Date, required: false })
  @ApiQuery({ name: 'plannedRemovalBefore', type: Date, required: false })
  @ApiQuery({ name: 'operatorId', type: String, required: false })
  @ApiQuery({ name: 'equipmentType', type: String, required: false })
  @ApiQuery({ name: 'stackLevel', type: Number, required: false })
  @ApiQuery({ name: 'hasRestrictions', type: Boolean, required: false })
  @ApiQuery({ name: 'requiresRemoval', type: Boolean, required: false })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Результаты поиска получены',
    type: [Placement],
  })
  async searchPlacements(@Query() query: any): Promise<Placement[]> {
    const filters: PlacementSearchFilters = {};

    if (query.status) filters.status = query.status;
    if (query.type) filters.type = query.type;
    if (query.yardId) filters.yardId = query.yardId;
    if (query.zoneId) filters.zoneId = query.zoneId;
    if (query.containerId) filters.containerId = query.containerId;
    if (query.containerNumber) filters.containerNumber = query.containerNumber;
    if (query.placedAfter) filters.placedAfter = new Date(query.placedAfter);
    if (query.placedBefore) filters.placedBefore = new Date(query.placedBefore);
    if (query.plannedRemovalAfter) filters.plannedRemovalAfter = new Date(query.plannedRemovalAfter);
    if (query.plannedRemovalBefore) filters.plannedRemovalBefore = new Date(query.plannedRemovalBefore);
    if (query.operatorId) filters.operatorId = query.operatorId;
    if (query.equipmentType) filters.equipmentType = query.equipmentType;
    if (query.stackLevel) filters.stackLevel = parseInt(query.stackLevel);
    if (query.hasRestrictions !== undefined) filters.hasRestrictions = query.hasRestrictions === 'true';
    if (query.requiresRemoval !== undefined) filters.requiresRemoval = query.requiresRemoval === 'true';

    return this.placementService.searchPlacements(filters);
  }

  @Get('statistics')
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER')
  @ApiOperation({ summary: 'Получить статистику размещений' })
  @ApiQuery({ name: 'yardId', type: String, required: false })
  @ApiQuery({ name: 'zoneId', type: String, required: false })
  @ApiQuery({ name: 'period', type: Number, required: false, description: 'Период в днях' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Статистика размещений получена',
  })
  async getPlacementStatistics(@Query() query: any) {
    const filters: any = {};
    if (query.yardId) filters.yardId = query.yardId;
    if (query.zoneId) filters.zoneId = query.zoneId;
    if (query.period) filters.period = parseInt(query.period);

    return this.placementService.getPlacementStatistics(filters);
  }

  @Post('find-optimal-slot')
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER', 'YARD_OPERATOR')
  @ApiOperation({ summary: 'Найти оптимальный слот для контейнера' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Результат поиска оптимального слота',
  })
  async findOptimalSlot(@Body() body: {
    containerId: string;
    preferredZoneId?: string;
    criteria?: {
      containerType?: string;
      hazmatClass?: string;
      temperatureControlled?: boolean;
      maxDwellTime?: number;
      equipmentAccess?: string[];
    };
  }) {
    return this.placementService.findOptimalSlot(
      body.containerId,
      body.preferredZoneId,
      body.criteria
    );
  }

  @Get(':id')
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER', 'YARD_OPERATOR', 'GATE_OPERATOR')
  @ApiOperation({ summary: 'Получить размещение по ID' })
  @ApiParam({ name: 'id', description: 'ID размещения' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Размещение найдено',
    type: Placement,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Размещение не найдено',
  })
  async getPlacementById(@Param('id') id: string): Promise<Placement> {
    return this.placementService.getPlacementById(id);
  }

  @Put(':id')
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER', 'YARD_OPERATOR')
  @UsePipes(new ValidationPipe({ transform: true }))
  @ApiOperation({ summary: 'Обновить размещение' })
  @ApiParam({ name: 'id', description: 'ID размещения' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Размещение обновлено',
    type: Placement,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Размещение не найдено',
  })
  async updatePlacement(
    @Param('id') id: string,
    @Body() updatePlacementDto: UpdatePlacementDto,
  ): Promise<Placement> {
    return this.placementService.updatePlacement(id, updatePlacementDto);
  }

  @Put(':id/complete')
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER', 'YARD_OPERATOR')
  @ApiOperation({ summary: 'Завершить размещение (изъять контейнер)' })
  @ApiParam({ name: 'id', description: 'ID размещения' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Размещение завершено',
    type: Placement,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Нельзя завершить размещение в текущем статусе',
  })
  async completePlacement(
    @Param('id') id: string,
    @Body() removalData: {
      operatorId: string;
      operatorName: string;
      equipmentId?: string;
      equipmentType: string;
      destination?: {
        type: 'gate' | 'vessel' | 'rail' | 'other_zone';
        location: string;
      };
      finalCondition?: {
        condition: string;
        damageReport?: string;
        photos?: string[];
      };
    },
  ): Promise<Placement> {
    return this.placementService.completePlacement(id, removalData);
  }
}