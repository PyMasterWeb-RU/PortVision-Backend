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
  EquipmentService, 
  CreateEquipmentDto, 
  UpdateEquipmentDto, 
  EquipmentSearchFilters,
  EquipmentAvailabilityFilters 
} from '../services/equipment.service';
import { Equipment, EquipmentType, EquipmentStatus, EquipmentCondition, FuelType } from '../entities/equipment.entity';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';

@ApiTags('equipment')
@ApiBearerAuth()
@Controller('equipment')
@UseGuards(JwtAuthGuard, RolesGuard)
export class EquipmentController {
  constructor(private readonly equipmentService: EquipmentService) {}

  @Post()
  @Roles('ADMIN', 'MANAGER')
  @UsePipes(new ValidationPipe({ transform: true }))
  @ApiOperation({ summary: 'Создать новое оборудование' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Оборудование успешно создано',
    type: Equipment,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Неверные данные',
  })
  async createEquipment(@Body() createEquipmentDto: CreateEquipmentDto): Promise<Equipment> {
    return this.equipmentService.createEquipment(createEquipmentDto);
  }

  @Get()
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER', 'YARD_OPERATOR', 'GATE_OPERATOR')
  @ApiOperation({ summary: 'Получить список всего оборудования' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Список оборудования получен',
    type: [Equipment],
  })
  async getAllEquipment(): Promise<Equipment[]> {
    return this.equipmentService.getAllEquipment();
  }

  @Get('search')
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER', 'YARD_OPERATOR', 'GATE_OPERATOR')
  @ApiOperation({ summary: 'Поиск оборудования по критериям' })
  @ApiQuery({ name: 'type', enum: EquipmentType, required: false })
  @ApiQuery({ name: 'status', enum: EquipmentStatus, required: false })
  @ApiQuery({ name: 'condition', enum: EquipmentCondition, required: false })
  @ApiQuery({ name: 'manufacturer', type: String, required: false })
  @ApiQuery({ name: 'manufacturerId', type: String, required: false })
  @ApiQuery({ name: 'model', type: String, required: false })
  @ApiQuery({ name: 'manufacturingYearFrom', type: Number, required: false })
  @ApiQuery({ name: 'manufacturingYearTo', type: Number, required: false })
  @ApiQuery({ name: 'assignedOperatorId', type: String, required: false })
  @ApiQuery({ name: 'departmentId', type: String, required: false })
  @ApiQuery({ name: 'locationZone', type: String, required: false })
  @ApiQuery({ name: 'fuelType', enum: FuelType, required: false })
  @ApiQuery({ name: 'commissionedAfter', type: Date, required: false })
  @ApiQuery({ name: 'commissionedBefore', type: Date, required: false })
  @ApiQuery({ name: 'hasLocation', type: Boolean, required: false })
  @ApiQuery({ name: 'hasAssignedOperator', type: Boolean, required: false })
  @ApiQuery({ name: 'maintenanceDue', type: Boolean, required: false })
  @ApiQuery({ name: 'maxCapacityFrom', type: Number, required: false })
  @ApiQuery({ name: 'maxCapacityTo', type: Number, required: false })
  @ApiQuery({ name: 'searchText', type: String, required: false })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Результаты поиска получены',
    type: [Equipment],
  })
  async searchEquipment(@Query() query: any): Promise<Equipment[]> {
    const filters: EquipmentSearchFilters = {};

    if (query.type) filters.type = query.type;
    if (query.status) filters.status = query.status;
    if (query.condition) filters.condition = query.condition;
    if (query.manufacturer) filters.manufacturer = query.manufacturer;
    if (query.manufacturerId) filters.manufacturerId = query.manufacturerId;
    if (query.model) filters.model = query.model;
    if (query.manufacturingYearFrom) filters.manufacturingYearFrom = parseInt(query.manufacturingYearFrom);
    if (query.manufacturingYearTo) filters.manufacturingYearTo = parseInt(query.manufacturingYearTo);
    if (query.assignedOperatorId) filters.assignedOperatorId = query.assignedOperatorId;
    if (query.departmentId) filters.departmentId = query.departmentId;
    if (query.locationZone) filters.locationZone = query.locationZone;
    if (query.fuelType) filters.fuelType = query.fuelType;
    if (query.commissionedAfter) filters.commissionedAfter = new Date(query.commissionedAfter);
    if (query.commissionedBefore) filters.commissionedBefore = new Date(query.commissionedBefore);
    if (query.hasLocation !== undefined) filters.hasLocation = query.hasLocation === 'true';
    if (query.hasAssignedOperator !== undefined) filters.hasAssignedOperator = query.hasAssignedOperator === 'true';
    if (query.maintenanceDue !== undefined) filters.maintenanceDue = query.maintenanceDue === 'true';
    if (query.maxCapacityFrom) filters.maxCapacityFrom = parseFloat(query.maxCapacityFrom);
    if (query.maxCapacityTo) filters.maxCapacityTo = parseFloat(query.maxCapacityTo);
    if (query.searchText) filters.searchText = query.searchText;

    return this.equipmentService.searchEquipment(filters);
  }

  @Get('available')
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER', 'YARD_OPERATOR')
  @ApiOperation({ summary: 'Получить доступное оборудование' })
  @ApiQuery({ name: 'equipmentTypes', type: [String], required: false })
  @ApiQuery({ name: 'locationZone', type: String, required: false })
  @ApiQuery({ name: 'requiredCapacity', type: Number, required: false })
  @ApiQuery({ name: 'startTime', type: Date, required: true })
  @ApiQuery({ name: 'endTime', type: Date, required: true })
  @ApiQuery({ name: 'excludeEquipmentIds', type: [String], required: false })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Доступное оборудование получено',
    type: [Equipment],
  })
  async getAvailableEquipment(@Query() query: any): Promise<Equipment[]> {
    const filters: EquipmentAvailabilityFilters = {
      startTime: new Date(query.startTime),
      endTime: new Date(query.endTime),
    };

    if (query.equipmentTypes) {
      filters.equipmentTypes = Array.isArray(query.equipmentTypes) 
        ? query.equipmentTypes 
        : [query.equipmentTypes];
    }
    if (query.locationZone) filters.locationZone = query.locationZone;
    if (query.requiredCapacity) filters.requiredCapacity = parseFloat(query.requiredCapacity);
    if (query.excludeEquipmentIds) {
      filters.excludeEquipmentIds = Array.isArray(query.excludeEquipmentIds)
        ? query.excludeEquipmentIds
        : [query.excludeEquipmentIds];
    }

    return this.equipmentService.getAvailableEquipment(filters);
  }

  @Get('statistics')
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER')
  @ApiOperation({ summary: 'Получить статистику оборудования' })
  @ApiQuery({ name: 'period', type: Number, required: false, description: 'Период в днях' })
  @ApiQuery({ name: 'departmentId', type: String, required: false })
  @ApiQuery({ name: 'equipmentType', enum: EquipmentType, required: false })
  @ApiQuery({ name: 'locationZone', type: String, required: false })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Статистика оборудования получена',
  })
  async getEquipmentStatistics(@Query() query: any) {
    const filters: any = {};
    if (query.period) filters.period = parseInt(query.period);
    if (query.departmentId) filters.departmentId = query.departmentId;
    if (query.equipmentType) filters.equipmentType = query.equipmentType;
    if (query.locationZone) filters.locationZone = query.locationZone;

    return this.equipmentService.getEquipmentStatistics(filters);
  }

  @Get('type/:type')
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER', 'YARD_OPERATOR', 'GATE_OPERATOR')
  @ApiOperation({ summary: 'Получить оборудование по типу' })
  @ApiParam({ name: 'type', enum: EquipmentType, description: 'Тип оборудования' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Оборудование по типу получено',
    type: [Equipment],
  })
  async getEquipmentByType(@Param('type') type: EquipmentType): Promise<Equipment[]> {
    return this.equipmentService.getEquipmentByType(type);
  }

  @Get('status/:status')
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER', 'YARD_OPERATOR')
  @ApiOperation({ summary: 'Получить оборудование по статусу' })
  @ApiParam({ name: 'status', enum: EquipmentStatus, description: 'Статус оборудования' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Оборудование по статусу получено',
    type: [Equipment],
  })
  async getEquipmentByStatus(@Param('status') status: EquipmentStatus): Promise<Equipment[]> {
    return this.equipmentService.getEquipmentByStatus(status);
  }

  @Get('operator/:operatorId')
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER', 'YARD_OPERATOR')
  @ApiOperation({ summary: 'Получить оборудование оператора' })
  @ApiParam({ name: 'operatorId', description: 'ID оператора' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Оборудование оператора получено',
    type: [Equipment],
  })
  async getEquipmentByOperator(@Param('operatorId') operatorId: string): Promise<Equipment[]> {
    return this.equipmentService.getEquipmentByOperator(operatorId);
  }

  @Get('department/:departmentId')
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER')
  @ApiOperation({ summary: 'Получить оборудование подразделения' })
  @ApiParam({ name: 'departmentId', description: 'ID подразделения' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Оборудование подразделения получено',
    type: [Equipment],
  })
  async getEquipmentByDepartment(@Param('departmentId') departmentId: string): Promise<Equipment[]> {
    return this.equipmentService.getEquipmentByDepartment(departmentId);
  }

  @Get('zone/:locationZone')
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER', 'YARD_OPERATOR')
  @ApiOperation({ summary: 'Получить оборудование в зоне' })
  @ApiParam({ name: 'locationZone', description: 'Зона размещения' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Оборудование в зоне получено',
    type: [Equipment],
  })
  async getEquipmentByZone(@Param('locationZone') locationZone: string): Promise<Equipment[]> {
    return this.equipmentService.getEquipmentByZone(locationZone);
  }

  @Get('number/:equipmentNumber')
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER', 'YARD_OPERATOR', 'GATE_OPERATOR')
  @ApiOperation({ summary: 'Получить оборудование по номеру' })
  @ApiParam({ name: 'equipmentNumber', description: 'Номер оборудования' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Оборудование найдено',
    type: Equipment,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Оборудование не найдено',
  })
  async getEquipmentByNumber(@Param('equipmentNumber') equipmentNumber: string): Promise<Equipment> {
    return this.equipmentService.getEquipmentByNumber(equipmentNumber);
  }

  @Get(':id')
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER', 'YARD_OPERATOR', 'GATE_OPERATOR')
  @ApiOperation({ summary: 'Получить оборудование по ID' })
  @ApiParam({ name: 'id', description: 'ID оборудования' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Оборудование найдено',
    type: Equipment,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Оборудование не найдено',
  })
  async getEquipmentById(@Param('id') id: string): Promise<Equipment> {
    return this.equipmentService.getEquipmentById(id);
  }

  @Put(':id')
  @Roles('ADMIN', 'MANAGER')
  @UsePipes(new ValidationPipe({ transform: true }))
  @ApiOperation({ summary: 'Обновить оборудование' })
  @ApiParam({ name: 'id', description: 'ID оборудования' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Оборудование обновлено',
    type: Equipment,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Оборудование не найдено',
  })
  async updateEquipment(
    @Param('id') id: string,
    @Body() updateEquipmentDto: UpdateEquipmentDto,
  ): Promise<Equipment> {
    return this.equipmentService.updateEquipment(id, updateEquipmentDto);
  }

  @Delete(':id')
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Удалить оборудование' })
  @ApiParam({ name: 'id', description: 'ID оборудования' })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Оборудование удалено',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Оборудование не найдено',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Нельзя удалить оборудование в использовании',
  })
  async deleteEquipment(@Param('id') id: string): Promise<void> {
    return this.equipmentService.deleteEquipment(id);
  }

  @Put(':id/assign-operator')
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER')
  @ApiOperation({ summary: 'Назначить оператора на оборудование' })
  @ApiParam({ name: 'id', description: 'ID оборудования' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Оператор назначен',
    type: Equipment,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Нельзя назначить оператора на недоступное оборудование',
  })
  async assignOperator(
    @Param('id') id: string,
    @Body() body: {
      operatorId: string;
      operatorName: string;
    },
  ): Promise<Equipment> {
    return this.equipmentService.assignOperator(
      id,
      body.operatorId,
      body.operatorName,
    );
  }

  @Put(':id/unassign-operator')
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER')
  @ApiOperation({ summary: 'Снять назначение оператора с оборудования' })
  @ApiParam({ name: 'id', description: 'ID оборудования' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Назначение оператора снято',
    type: Equipment,
  })
  async unassignOperator(@Param('id') id: string): Promise<Equipment> {
    return this.equipmentService.unassignOperator(id);
  }

  @Put(':id/location')
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER', 'YARD_OPERATOR')
  @ApiOperation({ summary: 'Обновить местоположение оборудования' })
  @ApiParam({ name: 'id', description: 'ID оборудования' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Местоположение обновлено',
    type: Equipment,
  })
  async updateLocation(
    @Param('id') id: string,
    @Body() location: {
      coordinates?: string;
      address?: string;
      zone?: string;
    },
  ): Promise<Equipment> {
    return this.equipmentService.updateLocation(id, location);
  }

  @Put(':id/status')
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER')
  @ApiOperation({ summary: 'Обновить статус оборудования' })
  @ApiParam({ name: 'id', description: 'ID оборудования' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Статус обновлен',
    type: Equipment,
  })
  async updateStatus(
    @Param('id') id: string,
    @Body('status') status: EquipmentStatus,
  ): Promise<Equipment> {
    return this.equipmentService.updateStatus(id, status);
  }

  @Put(':id/condition')
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER')
  @ApiOperation({ summary: 'Обновить техническое состояние оборудования' })
  @ApiParam({ name: 'id', description: 'ID оборудования' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Техническое состояние обновлено',
    type: Equipment,
  })
  async updateCondition(
    @Param('id') id: string,
    @Body('condition') condition: EquipmentCondition,
  ): Promise<Equipment> {
    return this.equipmentService.updateCondition(id, condition);
  }
}