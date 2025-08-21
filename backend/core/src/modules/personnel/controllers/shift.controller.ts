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
  ShiftService, 
  CreateShiftDto, 
  UpdateShiftDto, 
  ShiftSearchFilters 
} from '../services/shift.service';
import { Shift, ShiftType, ShiftStatus } from '../entities/shift.entity';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';

@ApiTags('shifts')
@ApiBearerAuth()
@Controller('shifts')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ShiftController {
  constructor(private readonly shiftService: ShiftService) {}

  @Post()
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER')
  @UsePipes(new ValidationPipe({ transform: true }))
  @ApiOperation({ summary: 'Создать новую смену' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Смена успешно создана',
    type: Shift,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Неверные данные или оператор недоступен',
  })
  async createShift(@Body() createShiftDto: CreateShiftDto): Promise<Shift> {
    return this.shiftService.createShift(createShiftDto);
  }

  @Get()
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER')
  @ApiOperation({ summary: 'Получить список всех смен' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Список смен получен',
    type: [Shift],
  })
  async getAllShifts(): Promise<Shift[]> {
    return this.shiftService.getAllShifts();
  }

  @Get('search')
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER', 'YARD_OPERATOR')
  @ApiOperation({ summary: 'Поиск смен по критериям' })
  @ApiQuery({ name: 'operatorId', type: String, required: false })
  @ApiQuery({ name: 'shiftType', enum: ShiftType, required: false })
  @ApiQuery({ name: 'status', enum: ShiftStatus, required: false })
  @ApiQuery({ name: 'departmentId', type: String, required: false })
  @ApiQuery({ name: 'supervisorId', type: String, required: false })
  @ApiQuery({ name: 'workZone', type: String, required: false })
  @ApiQuery({ name: 'startTimeAfter', type: Date, required: false })
  @ApiQuery({ name: 'startTimeBefore', type: Date, required: false })
  @ApiQuery({ name: 'endTimeAfter', type: Date, required: false })
  @ApiQuery({ name: 'endTimeBefore', type: Date, required: false })
  @ApiQuery({ name: 'isOvertime', type: Boolean, required: false })
  @ApiQuery({ name: 'hasIssues', type: Boolean, required: false })
  @ApiQuery({ name: 'completionRateMin', type: Number, required: false })
  @ApiQuery({ name: 'completionRateMax', type: Number, required: false })
  @ApiQuery({ name: 'performanceRatingMin', type: Number, required: false })
  @ApiQuery({ name: 'performanceRatingMax', type: Number, required: false })
  @ApiQuery({ name: 'searchText', type: String, required: false })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Результаты поиска получены',
    type: [Shift],
  })
  async searchShifts(@Query() query: any): Promise<Shift[]> {
    const filters: ShiftSearchFilters = {};

    if (query.operatorId) filters.operatorId = query.operatorId;
    if (query.shiftType) filters.shiftType = query.shiftType;
    if (query.status) filters.status = query.status;
    if (query.departmentId) filters.departmentId = query.departmentId;
    if (query.supervisorId) filters.supervisorId = query.supervisorId;
    if (query.workZone) filters.workZone = query.workZone;
    if (query.startTimeAfter) filters.startTimeAfter = new Date(query.startTimeAfter);
    if (query.startTimeBefore) filters.startTimeBefore = new Date(query.startTimeBefore);
    if (query.endTimeAfter) filters.endTimeAfter = new Date(query.endTimeAfter);
    if (query.endTimeBefore) filters.endTimeBefore = new Date(query.endTimeBefore);
    if (query.isOvertime !== undefined) filters.isOvertime = query.isOvertime === 'true';
    if (query.hasIssues !== undefined) filters.hasIssues = query.hasIssues === 'true';
    if (query.completionRateMin || query.completionRateMax) {
      filters.completionRate = {
        min: query.completionRateMin ? parseFloat(query.completionRateMin) : 0,
        max: query.completionRateMax ? parseFloat(query.completionRateMax) : 100,
      };
    }
    if (query.performanceRatingMin || query.performanceRatingMax) {
      filters.performanceRating = {
        min: query.performanceRatingMin ? parseFloat(query.performanceRatingMin) : 0,
        max: query.performanceRatingMax ? parseFloat(query.performanceRatingMax) : 10,
      };
    }
    if (query.searchText) filters.searchText = query.searchText;

    return this.shiftService.searchShifts(filters);
  }

  @Get('statistics')
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER')
  @ApiOperation({ summary: 'Получить статистику смен' })
  @ApiQuery({ name: 'period', type: Number, required: false, description: 'Период в днях' })
  @ApiQuery({ name: 'departmentId', type: String, required: false })
  @ApiQuery({ name: 'operatorId', type: String, required: false })
  @ApiQuery({ name: 'shiftType', enum: ShiftType, required: false })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Статистика смен получена',
  })
  async getShiftStatistics(@Query() query: any) {
    const filters: any = {};
    if (query.period) filters.period = parseInt(query.period);
    if (query.departmentId) filters.departmentId = query.departmentId;
    if (query.operatorId) filters.operatorId = query.operatorId;
    if (query.shiftType) filters.shiftType = query.shiftType;

    return this.shiftService.getShiftStatistics(filters);
  }

  @Get('active')
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER')
  @ApiOperation({ summary: 'Получить активные смены' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Активные смены получены',
    type: [Shift],
  })
  async getActiveShifts(): Promise<Shift[]> {
    return this.shiftService.getActiveShifts();
  }

  @Get('scheduled')
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER')
  @ApiOperation({ summary: 'Получить запланированные смены' })
  @ApiQuery({ name: 'period', type: Number, required: false, description: 'Период в днях (по умолчанию 7)' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Запланированные смены получены',
    type: [Shift],
  })
  async getScheduledShifts(@Query('period') period?: number): Promise<Shift[]> {
    return this.shiftService.getScheduledShifts(period);
  }

  @Get('operator/:operatorId')
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER', 'YARD_OPERATOR')
  @ApiOperation({ summary: 'Получить смены оператора' })
  @ApiParam({ name: 'operatorId', description: 'ID оператора' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Смены оператора получены',
    type: [Shift],
  })
  async getShiftsByOperator(@Param('operatorId') operatorId: string): Promise<Shift[]> {
    return this.shiftService.getShiftsByOperator(operatorId);
  }

  @Get('department/:departmentId')
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER')
  @ApiOperation({ summary: 'Получить смены подразделения' })
  @ApiParam({ name: 'departmentId', description: 'ID подразделения' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Смены подразделения получены',
    type: [Shift],
  })
  async getShiftsByDepartment(@Param('departmentId') departmentId: string): Promise<Shift[]> {
    return this.shiftService.getShiftsByDepartment(departmentId);
  }

  @Get('number/:shiftNumber')
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER', 'YARD_OPERATOR')
  @ApiOperation({ summary: 'Получить смену по номеру' })
  @ApiParam({ name: 'shiftNumber', description: 'Номер смены' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Смена найдена',
    type: Shift,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Смена не найдена',
  })
  async getShiftByNumber(@Param('shiftNumber') shiftNumber: string): Promise<Shift> {
    return this.shiftService.getShiftByNumber(shiftNumber);
  }

  @Get(':id')
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER', 'YARD_OPERATOR')
  @ApiOperation({ summary: 'Получить смену по ID' })
  @ApiParam({ name: 'id', description: 'ID смены' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Смена найдена',
    type: Shift,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Смена не найдена',
  })
  async getShiftById(@Param('id') id: string): Promise<Shift> {
    return this.shiftService.getShiftById(id);
  }

  @Put(':id')
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER')
  @UsePipes(new ValidationPipe({ transform: true }))
  @ApiOperation({ summary: 'Обновить смену' })
  @ApiParam({ name: 'id', description: 'ID смены' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Смена обновлена',
    type: Shift,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Смена не найдена',
  })
  async updateShift(
    @Param('id') id: string,
    @Body() updateShiftDto: UpdateShiftDto,
  ): Promise<Shift> {
    return this.shiftService.updateShift(id, updateShiftDto);
  }

  @Delete(':id')
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Удалить смену' })
  @ApiParam({ name: 'id', description: 'ID смены' })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Смена удалена',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Смена не найдена',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Нельзя удалить активную смену',
  })
  async deleteShift(@Param('id') id: string): Promise<void> {
    return this.shiftService.deleteShift(id);
  }

  @Put(':id/start')
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER', 'YARD_OPERATOR')
  @ApiOperation({ summary: 'Начать смену' })
  @ApiParam({ name: 'id', description: 'ID смены' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Смена начата',
    type: Shift,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Нельзя начать смену в текущем статусе',
  })
  async startShift(@Param('id') id: string): Promise<Shift> {
    return this.shiftService.startShift(id);
  }

  @Put(':id/end')
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER', 'YARD_OPERATOR')
  @ApiOperation({ summary: 'Завершить смену' })
  @ApiParam({ name: 'id', description: 'ID смены' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Смена завершена',
    type: Shift,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Нельзя завершить смену в текущем статусе',
  })
  async endShift(
    @Param('id') id: string,
    @Body() shiftReport?: {
      summary: string;
      tasksCompleted: number;
      tasksRemaining: number;
      issues?: any[];
      achievements?: string[];
      recommendations?: string[];
      handoverNotes?: string;
      operatorFeedback?: any;
    },
  ): Promise<Shift> {
    return this.shiftService.endShift(id, shiftReport);
  }

  @Put(':id/cancel')
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER')
  @ApiOperation({ summary: 'Отменить смену' })
  @ApiParam({ name: 'id', description: 'ID смены' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Смена отменена',
    type: Shift,
  })
  async cancelShift(
    @Param('id') id: string,
    @Body('reason') reason: string,
  ): Promise<Shift> {
    return this.shiftService.cancelShift(id, reason);
  }

  @Put(':id/break/start')
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER', 'YARD_OPERATOR')
  @ApiOperation({ summary: 'Начать перерыв' })
  @ApiParam({ name: 'id', description: 'ID смены' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Перерыв начат',
    type: Shift,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Нельзя начать перерыв - смена не активна',
  })
  async startBreak(
    @Param('id') id: string,
    @Body() body: {
      breakType: 'lunch' | 'coffee' | 'rest' | 'emergency';
      location?: string;
    },
  ): Promise<Shift> {
    return this.shiftService.startBreak(id, body.breakType, body.location);
  }

  @Put(':id/break/end')
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER', 'YARD_OPERATOR')
  @ApiOperation({ summary: 'Завершить перерыв' })
  @ApiParam({ name: 'id', description: 'ID смены' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Перерыв завершен',
    type: Shift,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Нет активного перерыва для завершения',
  })
  async endBreak(@Param('id') id: string): Promise<Shift> {
    return this.shiftService.endBreak(id);
  }

  @Post(':id/tasks')
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER')
  @ApiOperation({ summary: 'Добавить задачу в смену' })
  @ApiParam({ name: 'id', description: 'ID смены' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Задача добавлена',
    type: Shift,
  })
  async addTask(
    @Param('id') id: string,
    @Body() task: {
      taskType: string;
      description: string;
      priority: 'low' | 'normal' | 'high' | 'urgent';
      estimatedDuration: number;
    },
  ): Promise<Shift> {
    return this.shiftService.addTask(id, task);
  }

  @Put(':id/tasks/:taskId')
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER', 'YARD_OPERATOR')
  @ApiOperation({ summary: 'Обновить статус задачи смены' })
  @ApiParam({ name: 'id', description: 'ID смены' })
  @ApiParam({ name: 'taskId', description: 'ID задачи' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Статус задачи обновлен',
    type: Shift,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Задача не найдена',
  })
  async updateTaskStatus(
    @Param('id') id: string,
    @Param('taskId') taskId: string,
    @Body() body: {
      status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
      notes?: string;
    },
  ): Promise<Shift> {
    return this.shiftService.updateTaskStatus(id, taskId, body.status, body.notes);
  }
}