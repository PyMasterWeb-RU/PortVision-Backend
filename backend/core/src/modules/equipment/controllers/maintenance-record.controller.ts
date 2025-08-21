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
  MaintenanceRecordService, 
  CreateMaintenanceRecordDto, 
  UpdateMaintenanceRecordDto, 
  MaintenanceSearchFilters 
} from '../services/maintenance-record.service';
import { MaintenanceRecord, MaintenanceType, MaintenanceStatus, MaintenancePriority } from '../entities/maintenance-record.entity';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';

@ApiTags('maintenance-records')
@ApiBearerAuth()
@Controller('maintenance-records')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MaintenanceRecordController {
  constructor(private readonly maintenanceRecordService: MaintenanceRecordService) {}

  @Post()
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER')
  @UsePipes(new ValidationPipe({ transform: true }))
  @ApiOperation({ summary: 'Создать запись о техническом обслуживании' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Запись ТО успешно создана',
    type: MaintenanceRecord,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Неверные данные или оборудование не найдено',
  })
  async createMaintenanceRecord(@Body() createMaintenanceRecordDto: CreateMaintenanceRecordDto): Promise<MaintenanceRecord> {
    return this.maintenanceRecordService.createMaintenanceRecord(createMaintenanceRecordDto);
  }

  @Get()
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER', 'YARD_OPERATOR')
  @ApiOperation({ summary: 'Получить список всех записей ТО' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Список записей ТО получен',
    type: [MaintenanceRecord],
  })
  async getAllMaintenanceRecords(): Promise<MaintenanceRecord[]> {
    return this.maintenanceRecordService.getAllMaintenanceRecords();
  }

  @Get('search')
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER', 'YARD_OPERATOR')
  @ApiOperation({ summary: 'Поиск записей ТО по критериям' })
  @ApiQuery({ name: 'equipmentId', type: String, required: false })
  @ApiQuery({ name: 'maintenanceType', enum: MaintenanceType, required: false })
  @ApiQuery({ name: 'status', enum: MaintenanceStatus, required: false })
  @ApiQuery({ name: 'priority', enum: MaintenancePriority, required: false })
  @ApiQuery({ name: 'performedBy', type: String, required: false })
  @ApiQuery({ name: 'assignedBy', type: String, required: false })
  @ApiQuery({ name: 'supervisedBy', type: String, required: false })
  @ApiQuery({ name: 'scheduledAfter', type: Date, required: false })
  @ApiQuery({ name: 'scheduledBefore', type: Date, required: false })
  @ApiQuery({ name: 'completedAfter', type: Date, required: false })
  @ApiQuery({ name: 'completedBefore', type: Date, required: false })
  @ApiQuery({ name: 'equipmentType', type: String, required: false })
  @ApiQuery({ name: 'isOverdue', type: Boolean, required: false })
  @ApiQuery({ name: 'hasIssues', type: Boolean, required: false })
  @ApiQuery({ name: 'isExternal', type: Boolean, required: false })
  @ApiQuery({ name: 'searchText', type: String, required: false })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Результаты поиска получены',
    type: [MaintenanceRecord],
  })
  async searchMaintenanceRecords(@Query() query: any): Promise<MaintenanceRecord[]> {
    const filters: MaintenanceSearchFilters = {};

    if (query.equipmentId) filters.equipmentId = query.equipmentId;
    if (query.maintenanceType) filters.maintenanceType = query.maintenanceType;
    if (query.status) filters.status = query.status;
    if (query.priority) filters.priority = query.priority;
    if (query.performedBy) filters.performedBy = query.performedBy;
    if (query.assignedBy) filters.assignedBy = query.assignedBy;
    if (query.supervisedBy) filters.supervisedBy = query.supervisedBy;
    if (query.scheduledAfter) filters.scheduledAfter = new Date(query.scheduledAfter);
    if (query.scheduledBefore) filters.scheduledBefore = new Date(query.scheduledBefore);
    if (query.completedAfter) filters.completedAfter = new Date(query.completedAfter);
    if (query.completedBefore) filters.completedBefore = new Date(query.completedBefore);
    if (query.equipmentType) filters.equipmentType = query.equipmentType;
    if (query.isOverdue !== undefined) filters.isOverdue = query.isOverdue === 'true';
    if (query.hasIssues !== undefined) filters.hasIssues = query.hasIssues === 'true';
    if (query.isExternal !== undefined) filters.isExternal = query.isExternal === 'true';
    if (query.searchText) filters.searchText = query.searchText;

    return this.maintenanceRecordService.searchMaintenanceRecords(filters);
  }

  @Get('statistics')
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER')
  @ApiOperation({ summary: 'Получить статистику ТО' })
  @ApiQuery({ name: 'period', type: Number, required: false, description: 'Период в днях' })
  @ApiQuery({ name: 'equipmentType', type: String, required: false })
  @ApiQuery({ name: 'performedBy', type: String, required: false })
  @ApiQuery({ name: 'departmentId', type: String, required: false })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Статистика ТО получена',
  })
  async getMaintenanceStatistics(@Query() query: any) {
    const filters: any = {};
    if (query.period) filters.period = parseInt(query.period);
    if (query.equipmentType) filters.equipmentType = query.equipmentType;
    if (query.performedBy) filters.performedBy = query.performedBy;
    if (query.departmentId) filters.departmentId = query.departmentId;

    return this.maintenanceRecordService.getMaintenanceStatistics(filters);
  }

  @Get('overdue')
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER')
  @ApiOperation({ summary: 'Получить просроченные ТО' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Просроченные ТО получены',
    type: [MaintenanceRecord],
  })
  async getOverdueMaintenance(): Promise<MaintenanceRecord[]> {
    return this.maintenanceRecordService.getOverdueMaintenance();
  }

  @Get('scheduled')
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER')
  @ApiOperation({ summary: 'Получить запланированные ТО' })
  @ApiQuery({ name: 'period', type: Number, required: false, description: 'Период в днях (по умолчанию 30)' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Запланированные ТО получены',
    type: [MaintenanceRecord],
  })
  async getScheduledMaintenance(@Query('period') period?: number): Promise<MaintenanceRecord[]> {
    return this.maintenanceRecordService.getScheduledMaintenance(period);
  }

  @Get('equipment/:equipmentId')
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER', 'YARD_OPERATOR')
  @ApiOperation({ summary: 'Получить записи ТО для оборудования' })
  @ApiParam({ name: 'equipmentId', description: 'ID оборудования' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Записи ТО для оборудования получены',
    type: [MaintenanceRecord],
  })
  async getMaintenanceByEquipment(@Param('equipmentId') equipmentId: string): Promise<MaintenanceRecord[]> {
    return this.maintenanceRecordService.getMaintenanceByEquipment(equipmentId);
  }

  @Get('performer/:performedBy')
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER')
  @ApiOperation({ summary: 'Получить записи ТО для исполнителя' })
  @ApiParam({ name: 'performedBy', description: 'ID исполнителя' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Записи ТО для исполнителя получены',
    type: [MaintenanceRecord],
  })
  async getMaintenanceByPerformer(@Param('performedBy') performedBy: string): Promise<MaintenanceRecord[]> {
    return this.maintenanceRecordService.getMaintenanceByPerformer(performedBy);
  }

  @Get('work-order/:workOrderNumber')
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER', 'YARD_OPERATOR')
  @ApiOperation({ summary: 'Получить запись ТО по номеру наряда' })
  @ApiParam({ name: 'workOrderNumber', description: 'Номер наряда' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Запись ТО найдена',
    type: MaintenanceRecord,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Запись ТО не найдена',
  })
  async getMaintenanceRecordByWorkOrder(@Param('workOrderNumber') workOrderNumber: string): Promise<MaintenanceRecord> {
    return this.maintenanceRecordService.getMaintenanceRecordByWorkOrder(workOrderNumber);
  }

  @Get(':id')
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER', 'YARD_OPERATOR')
  @ApiOperation({ summary: 'Получить запись ТО по ID' })
  @ApiParam({ name: 'id', description: 'ID записи ТО' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Запись ТО найдена',
    type: MaintenanceRecord,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Запись ТО не найдена',
  })
  async getMaintenanceRecordById(@Param('id') id: string): Promise<MaintenanceRecord> {
    return this.maintenanceRecordService.getMaintenanceRecordById(id);
  }

  @Put(':id')
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER')
  @UsePipes(new ValidationPipe({ transform: true }))
  @ApiOperation({ summary: 'Обновить запись ТО' })
  @ApiParam({ name: 'id', description: 'ID записи ТО' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Запись ТО обновлена',
    type: MaintenanceRecord,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Запись ТО не найдена',
  })
  async updateMaintenanceRecord(
    @Param('id') id: string,
    @Body() updateMaintenanceRecordDto: UpdateMaintenanceRecordDto,
  ): Promise<MaintenanceRecord> {
    return this.maintenanceRecordService.updateMaintenanceRecord(id, updateMaintenanceRecordDto);
  }

  @Delete(':id')
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Удалить запись ТО' })
  @ApiParam({ name: 'id', description: 'ID записи ТО' })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Запись ТО удалена',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Запись ТО не найдена',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Нельзя удалить запись ТО в процессе выполнения',
  })
  async deleteMaintenanceRecord(@Param('id') id: string): Promise<void> {
    return this.maintenanceRecordService.deleteMaintenanceRecord(id);
  }

  @Put(':id/start')
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER', 'YARD_OPERATOR')
  @ApiOperation({ summary: 'Начать выполнение ТО' })
  @ApiParam({ name: 'id', description: 'ID записи ТО' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'ТО начато',
    type: MaintenanceRecord,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Нельзя начать ТО в текущем статусе',
  })
  async startMaintenance(
    @Param('id') id: string,
    @Body() body: {
      performedBy?: string;
      performedByName?: string;
    },
  ): Promise<MaintenanceRecord> {
    return this.maintenanceRecordService.startMaintenance(
      id,
      body.performedBy,
      body.performedByName,
    );
  }

  @Put(':id/complete')
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER', 'YARD_OPERATOR')
  @ApiOperation({ summary: 'Завершить ТО' })
  @ApiParam({ name: 'id', description: 'ID записи ТО' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'ТО завершено',
    type: MaintenanceRecord,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Нельзя завершить ТО в текущем статусе',
  })
  async completeMaintenance(
    @Param('id') id: string,
    @Body() completionData: {
      workChecklist?: any[];
      materialsUsed?: any[];
      toolsUsed?: any[];
      testResults?: any;
      issuesFound?: any[];
      recommendations?: any[];
      nextMaintenance?: any;
      costInformation?: any;
      certificationData?: any;
      downtimeTracking?: any;
      complianceInfo?: any;
      supervisedBy?: string;
      supervisedByName?: string;
    },
  ): Promise<MaintenanceRecord> {
    return this.maintenanceRecordService.completeMaintenance(id, completionData);
  }

  @Put(':id/cancel')
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER')
  @ApiOperation({ summary: 'Отменить ТО' })
  @ApiParam({ name: 'id', description: 'ID записи ТО' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'ТО отменено',
    type: MaintenanceRecord,
  })
  async cancelMaintenance(
    @Param('id') id: string,
    @Body('reason') reason: string,
  ): Promise<MaintenanceRecord> {
    return this.maintenanceRecordService.cancelMaintenance(id, reason);
  }

  @Put(':id/reschedule')
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER')
  @ApiOperation({ summary: 'Перенести ТО на другую дату' })
  @ApiParam({ name: 'id', description: 'ID записи ТО' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'ТО перенесено',
    type: MaintenanceRecord,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Нельзя перенести ТО в текущем статусе',
  })
  async rescheduleMaintenance(
    @Param('id') id: string,
    @Body('newScheduledDate') newScheduledDate: Date,
  ): Promise<MaintenanceRecord> {
    return this.maintenanceRecordService.rescheduleMaintenance(id, new Date(newScheduledDate));
  }
}