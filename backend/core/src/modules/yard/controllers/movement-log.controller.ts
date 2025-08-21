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
  MovementLogService, 
  CreateMovementLogDto, 
  UpdateMovementLogDto, 
  MovementSearchFilters 
} from '../services/movement-log.service';
import { MovementLog, MovementType, MovementStatus, MovementPriority } from '../entities/movement-log.entity';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';

@ApiTags('movement-logs')
@ApiBearerAuth()
@Controller('movement-logs')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MovementLogController {
  constructor(private readonly movementLogService: MovementLogService) {}

  @Post()
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER', 'YARD_OPERATOR', 'GATE_OPERATOR')
  @UsePipes(new ValidationPipe({ transform: true }))
  @ApiOperation({ summary: 'Создать запись о движении контейнера' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Запись о движении создана',
    type: MovementLog,
  })
  async createMovementLog(@Body() createMovementLogDto: CreateMovementLogDto): Promise<MovementLog> {
    return this.movementLogService.createMovementLog(createMovementLogDto);
  }

  @Get()
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER', 'YARD_OPERATOR', 'GATE_OPERATOR')
  @ApiOperation({ summary: 'Получить список всех записей движений' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Список записей движений получен',
    type: [MovementLog],
  })
  async getAllMovementLogs(): Promise<MovementLog[]> {
    return this.movementLogService.getAllMovementLogs();
  }

  @Get('search')
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER', 'YARD_OPERATOR', 'GATE_OPERATOR')
  @ApiOperation({ summary: 'Поиск записей движений по критериям' })
  @ApiQuery({ name: 'containerId', type: String, required: false })
  @ApiQuery({ name: 'type', enum: MovementType, required: false })
  @ApiQuery({ name: 'status', enum: MovementStatus, required: false })
  @ApiQuery({ name: 'priority', enum: MovementPriority, required: false })
  @ApiQuery({ name: 'operatorId', type: String, required: false })
  @ApiQuery({ name: 'equipmentId', type: String, required: false })
  @ApiQuery({ name: 'equipmentType', type: String, required: false })
  @ApiQuery({ name: 'fromYardId', type: String, required: false })
  @ApiQuery({ name: 'toYardId', type: String, required: false })
  @ApiQuery({ name: 'timestampAfter', type: Date, required: false })
  @ApiQuery({ name: 'timestampBefore', type: Date, required: false })
  @ApiQuery({ name: 'relatedOrderId', type: String, required: false })
  @ApiQuery({ name: 'gateTransactionId', type: String, required: false })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Результаты поиска получены',
    type: [MovementLog],
  })
  async searchMovementLogs(@Query() query: any): Promise<MovementLog[]> {
    const filters: MovementSearchFilters = {};

    if (query.containerId) filters.containerId = query.containerId;
    if (query.type) filters.type = query.type;
    if (query.status) filters.status = query.status;
    if (query.priority) filters.priority = query.priority;
    if (query.operatorId) filters.operatorId = query.operatorId;
    if (query.equipmentId) filters.equipmentId = query.equipmentId;
    if (query.equipmentType) filters.equipmentType = query.equipmentType;
    if (query.fromYardId) filters.fromYardId = query.fromYardId;
    if (query.toYardId) filters.toYardId = query.toYardId;
    if (query.timestampAfter) filters.timestampAfter = new Date(query.timestampAfter);
    if (query.timestampBefore) filters.timestampBefore = new Date(query.timestampBefore);
    if (query.relatedOrderId) filters.relatedOrderId = query.relatedOrderId;
    if (query.gateTransactionId) filters.gateTransactionId = query.gateTransactionId;

    return this.movementLogService.searchMovementLogs(filters);
  }

  @Get('active')
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER', 'YARD_OPERATOR')
  @ApiOperation({ summary: 'Получить активные движения' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Активные движения получены',
    type: [MovementLog],
  })
  async getActiveMovements(): Promise<MovementLog[]> {
    return this.movementLogService.getActiveMovements();
  }

  @Get('statistics')
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER')
  @ApiOperation({ summary: 'Получить статистику движений' })
  @ApiQuery({ name: 'period', type: Number, required: false, description: 'Период в днях' })
  @ApiQuery({ name: 'yardId', type: String, required: false })
  @ApiQuery({ name: 'equipmentType', type: String, required: false })
  @ApiQuery({ name: 'operatorId', type: String, required: false })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Статистика движений получена',
  })
  async getMovementStatistics(@Query() query: any) {
    const filters: any = {};
    if (query.period) filters.period = parseInt(query.period);
    if (query.yardId) filters.yardId = query.yardId;
    if (query.equipmentType) filters.equipmentType = query.equipmentType;
    if (query.operatorId) filters.operatorId = query.operatorId;

    return this.movementLogService.getMovementStatistics(filters);
  }

  @Get('container/:containerId/history')
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER', 'YARD_OPERATOR', 'GATE_OPERATOR')
  @ApiOperation({ summary: 'Получить историю движений контейнера' })
  @ApiParam({ name: 'containerId', description: 'ID контейнера' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'История движений контейнера получена',
    type: [MovementLog],
  })
  async getContainerMovementHistory(@Param('containerId') containerId: string): Promise<MovementLog[]> {
    return this.movementLogService.getContainerMovementHistory(containerId);
  }

  @Get(':id')
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER', 'YARD_OPERATOR', 'GATE_OPERATOR')
  @ApiOperation({ summary: 'Получить запись движения по ID' })
  @ApiParam({ name: 'id', description: 'ID записи движения' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Запись движения найдена',
    type: MovementLog,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Запись движения не найдена',
  })
  async getMovementLogById(@Param('id') id: string): Promise<MovementLog> {
    return this.movementLogService.getMovementLogById(id);
  }

  @Put(':id')
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER', 'YARD_OPERATOR')
  @UsePipes(new ValidationPipe({ transform: true }))
  @ApiOperation({ summary: 'Обновить запись движения' })
  @ApiParam({ name: 'id', description: 'ID записи движения' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Запись движения обновлена',
    type: MovementLog,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Запись движения не найдена',
  })
  async updateMovementLog(
    @Param('id') id: string,
    @Body() updateMovementLogDto: UpdateMovementLogDto,
  ): Promise<MovementLog> {
    return this.movementLogService.updateMovementLog(id, updateMovementLogDto);
  }

  @Put(':id/start')
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER', 'YARD_OPERATOR')
  @ApiOperation({ summary: 'Начать выполнение движения' })
  @ApiParam({ name: 'id', description: 'ID записи движения' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Движение начато',
    type: MovementLog,
  })
  async startMovement(
    @Param('id') id: string,
    @Body() additionalData?: any,
  ): Promise<MovementLog> {
    return this.movementLogService.startMovement(id, additionalData);
  }

  @Put(':id/complete')
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER', 'YARD_OPERATOR')
  @ApiOperation({ summary: 'Завершить движение' })
  @ApiParam({ name: 'id', description: 'ID записи движения' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Движение завершено',
    type: MovementLog,
  })
  async completeMovement(
    @Param('id') id: string,
    @Body() completionData: {
      accuracy?: 'precise' | 'approximate' | 'estimated';
      verificationMethod?: 'visual' | 'rfid' | 'barcode' | 'gps' | 'manual';
      finalPosition?: {
        latitude: number;
        longitude: number;
        accuracy: number;
      };
      positionDeviation?: {
        distance: number;
        unit: 'm' | 'ft';
        direction: number;
      };
      qualityMetrics?: {
        timeCompliance?: boolean;
        routeCompliance?: boolean;
        safetyCompliance?: boolean;
        procedureCompliance?: boolean;
      };
    },
  ): Promise<MovementLog> {
    return this.movementLogService.completeMovement(id, completionData);
  }

  @Put(':id/fail')
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER', 'YARD_OPERATOR')
  @ApiOperation({ summary: 'Отметить движение как неудачное' })
  @ApiParam({ name: 'id', description: 'ID записи движения' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Движение отмечено как неудачное',
    type: MovementLog,
  })
  async failMovement(
    @Param('id') id: string,
    @Body() body: {
      failureReason: string;
      incidentData?: any;
    },
  ): Promise<MovementLog> {
    return this.movementLogService.failMovement(id, body.failureReason, body.incidentData);
  }

  @Put(':id/cancel')
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER', 'YARD_OPERATOR')
  @ApiOperation({ summary: 'Отменить движение' })
  @ApiParam({ name: 'id', description: 'ID записи движения' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Движение отменено',
    type: MovementLog,
  })
  async cancelMovement(
    @Param('id') id: string,
    @Body('cancellationReason') cancellationReason: string,
  ): Promise<MovementLog> {
    return this.movementLogService.cancelMovement(id, cancellationReason);
  }

  @Post(':id/gps-position')
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER', 'YARD_OPERATOR')
  @ApiOperation({ summary: 'Добавить GPS позицию к движению' })
  @ApiParam({ name: 'id', description: 'ID записи движения' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'GPS позиция добавлена',
    type: MovementLog,
  })
  async addGPSPosition(
    @Param('id') id: string,
    @Body() position: {
      timestamp: Date;
      latitude: number;
      longitude: number;
      accuracy: number;
      speed?: number;
      heading?: number;
      altitude?: number;
    },
  ): Promise<MovementLog> {
    return this.movementLogService.addGPSPosition(id, position);
  }

  @Post(':id/incident')
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER', 'YARD_OPERATOR')
  @ApiOperation({ summary: 'Добавить инцидент к движению' })
  @ApiParam({ name: 'id', description: 'ID записи движения' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Инцидент добавлен',
    type: MovementLog,
  })
  async addIncident(
    @Param('id') id: string,
    @Body() incident: {
      type: 'delay' | 'equipment_failure' | 'safety' | 'damage' | 'other';
      severity: 'low' | 'medium' | 'high' | 'critical';
      description: string;
      location?: {
        latitude: number;
        longitude: number;
      };
      reportedBy: string;
      photos?: string[];
    },
  ): Promise<MovementLog> {
    return this.movementLogService.addIncident(id, incident);
  }
}