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
  MoveTaskService, 
  CreateMoveTaskDto, 
  UpdateMoveTaskDto, 
  MoveTaskSearchFilters 
} from '../services/move-task.service';
import { MoveTask, MoveTaskType, MoveTaskStatus, MoveTaskPriority, EquipmentType } from '../entities/move-task.entity';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';

@ApiTags('move-tasks')
@ApiBearerAuth()
@Controller('move-tasks')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MoveTaskController {
  constructor(private readonly moveTaskService: MoveTaskService) {}

  @Post()
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER')
  @UsePipes(new ValidationPipe({ transform: true }))
  @ApiOperation({ summary: 'Создать новую задачу перемещения' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Задача перемещения успешно создана',
    type: MoveTask,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Неверные данные или контейнер не найден',
  })
  async createMoveTask(@Body() createMoveTaskDto: CreateMoveTaskDto): Promise<MoveTask> {
    return this.moveTaskService.createMoveTask(createMoveTaskDto);
  }

  @Get()
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER', 'YARD_OPERATOR', 'GATE_OPERATOR')
  @ApiOperation({ summary: 'Получить список всех задач перемещения' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Список задач перемещения получен',
    type: [MoveTask],
  })
  async getAllMoveTasks(): Promise<MoveTask[]> {
    return this.moveTaskService.getAllMoveTasks();
  }

  @Get('search')
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER', 'YARD_OPERATOR', 'GATE_OPERATOR')
  @ApiOperation({ summary: 'Поиск задач перемещения по критериям' })
  @ApiQuery({ name: 'type', enum: MoveTaskType, required: false })
  @ApiQuery({ name: 'status', enum: MoveTaskStatus, required: false })
  @ApiQuery({ name: 'priority', enum: MoveTaskPriority, required: false })
  @ApiQuery({ name: 'containerId', type: String, required: false })
  @ApiQuery({ name: 'containerNumber', type: String, required: false })
  @ApiQuery({ name: 'orderId', type: String, required: false })
  @ApiQuery({ name: 'assignedOperatorId', type: String, required: false })
  @ApiQuery({ name: 'assignedEquipmentId', type: String, required: false })
  @ApiQuery({ name: 'requiredEquipmentType', enum: EquipmentType, required: false })
  @ApiQuery({ name: 'scheduledAfter', type: Date, required: false })
  @ApiQuery({ name: 'scheduledBefore', type: Date, required: false })
  @ApiQuery({ name: 'deadlineAfter', type: Date, required: false })
  @ApiQuery({ name: 'deadlineBefore', type: Date, required: false })
  @ApiQuery({ name: 'fromLocationYardId', type: String, required: false })
  @ApiQuery({ name: 'toLocationYardId', type: String, required: false })
  @ApiQuery({ name: 'hasDeadline', type: Boolean, required: false })
  @ApiQuery({ name: 'overdue', type: Boolean, required: false })
  @ApiQuery({ name: 'hasParent', type: Boolean, required: false })
  @ApiQuery({ name: 'parentTaskId', type: String, required: false })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Результаты поиска получены',
    type: [MoveTask],
  })
  async searchMoveTasks(@Query() query: any): Promise<MoveTask[]> {
    const filters: MoveTaskSearchFilters = {};

    if (query.type) filters.type = query.type;
    if (query.status) filters.status = query.status;
    if (query.priority) filters.priority = query.priority;
    if (query.containerId) filters.containerId = query.containerId;
    if (query.containerNumber) filters.containerNumber = query.containerNumber;
    if (query.orderId) filters.orderId = query.orderId;
    if (query.assignedOperatorId) filters.assignedOperatorId = query.assignedOperatorId;
    if (query.assignedEquipmentId) filters.assignedEquipmentId = query.assignedEquipmentId;
    if (query.requiredEquipmentType) filters.requiredEquipmentType = query.requiredEquipmentType;
    if (query.scheduledAfter) filters.scheduledAfter = new Date(query.scheduledAfter);
    if (query.scheduledBefore) filters.scheduledBefore = new Date(query.scheduledBefore);
    if (query.deadlineAfter) filters.deadlineAfter = new Date(query.deadlineAfter);
    if (query.deadlineBefore) filters.deadlineBefore = new Date(query.deadlineBefore);
    if (query.fromLocationYardId) filters.fromLocationYardId = query.fromLocationYardId;
    if (query.toLocationYardId) filters.toLocationYardId = query.toLocationYardId;
    if (query.hasDeadline !== undefined) filters.hasDeadline = query.hasDeadline === 'true';
    if (query.overdue !== undefined) filters.overdue = query.overdue === 'true';
    if (query.hasParent !== undefined) filters.hasParent = query.hasParent === 'true';
    if (query.parentTaskId) filters.parentTaskId = query.parentTaskId;

    return this.moveTaskService.searchMoveTasks(filters);
  }

  @Get('statistics')
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER')
  @ApiOperation({ summary: 'Получить статистику задач перемещения' })
  @ApiQuery({ name: 'period', type: Number, required: false, description: 'Период в днях' })
  @ApiQuery({ name: 'operatorId', type: String, required: false })
  @ApiQuery({ name: 'equipmentType', enum: EquipmentType, required: false })
  @ApiQuery({ name: 'yardId', type: String, required: false })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Статистика задач перемещения получена',
  })
  async getTaskStatistics(@Query() query: any) {
    const filters: any = {};
    if (query.period) filters.period = parseInt(query.period);
    if (query.operatorId) filters.operatorId = query.operatorId;
    if (query.equipmentType) filters.equipmentType = query.equipmentType;
    if (query.yardId) filters.yardId = query.yardId;

    return this.moveTaskService.getTaskStatistics(filters);
  }

  @Get('overdue')
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER')
  @ApiOperation({ summary: 'Получить просроченные задачи' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Просроченные задачи получены',
    type: [MoveTask],
  })
  async getOverdueTasks(): Promise<MoveTask[]> {
    return this.moveTaskService.getOverdueTasks();
  }

  @Get('container/:containerId')
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER', 'YARD_OPERATOR', 'GATE_OPERATOR')
  @ApiOperation({ summary: 'Получить задачи для контейнера' })
  @ApiParam({ name: 'containerId', description: 'ID контейнера' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Задачи для контейнера получены',
    type: [MoveTask],
  })
  async getTasksByContainer(@Param('containerId') containerId: string): Promise<MoveTask[]> {
    return this.moveTaskService.getTasksByContainer(containerId);
  }

  @Get('order/:orderId')
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER', 'YARD_OPERATOR', 'GATE_OPERATOR')
  @ApiOperation({ summary: 'Получить задачи для заявки' })
  @ApiParam({ name: 'orderId', description: 'ID заявки' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Задачи для заявки получены',
    type: [MoveTask],
  })
  async getTasksByOrder(@Param('orderId') orderId: string): Promise<MoveTask[]> {
    return this.moveTaskService.getTasksByOrder(orderId);
  }

  @Get('operator/:operatorId')
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER', 'YARD_OPERATOR')
  @ApiOperation({ summary: 'Получить задачи для оператора' })
  @ApiParam({ name: 'operatorId', description: 'ID оператора' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Задачи для оператора получены',
    type: [MoveTask],
  })
  async getTasksByOperator(@Param('operatorId') operatorId: string): Promise<MoveTask[]> {
    return this.moveTaskService.getTasksByOperator(operatorId);
  }

  @Get('number/:taskNumber')
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER', 'YARD_OPERATOR', 'GATE_OPERATOR')
  @ApiOperation({ summary: 'Получить задачу по номеру' })
  @ApiParam({ name: 'taskNumber', description: 'Номер задачи' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Задача найдена',
    type: MoveTask,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Задача не найдена',
  })
  async getMoveTaskByNumber(@Param('taskNumber') taskNumber: string): Promise<MoveTask> {
    return this.moveTaskService.getMoveTaskByNumber(taskNumber);
  }

  @Get(':id')
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER', 'YARD_OPERATOR', 'GATE_OPERATOR')
  @ApiOperation({ summary: 'Получить задачу по ID' })
  @ApiParam({ name: 'id', description: 'ID задачи' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Задача найдена',
    type: MoveTask,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Задача не найдена',
  })
  async getMoveTaskById(@Param('id') id: string): Promise<MoveTask> {
    return this.moveTaskService.getMoveTaskById(id);
  }

  @Put(':id')
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER')
  @UsePipes(new ValidationPipe({ transform: true }))
  @ApiOperation({ summary: 'Обновить задачу перемещения' })
  @ApiParam({ name: 'id', description: 'ID задачи' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Задача обновлена',
    type: MoveTask,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Задача не найдена',
  })
  async updateMoveTask(
    @Param('id') id: string,
    @Body() updateMoveTaskDto: UpdateMoveTaskDto,
  ): Promise<MoveTask> {
    return this.moveTaskService.updateMoveTask(id, updateMoveTaskDto);
  }

  @Delete(':id')
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Удалить задачу перемещения' })
  @ApiParam({ name: 'id', description: 'ID задачи' })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Задача удалена',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Задача не найдена',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Нельзя удалить задачу в процессе выполнения или с зависимостями',
  })
  async deleteMoveTask(@Param('id') id: string): Promise<void> {
    return this.moveTaskService.deleteMoveTask(id);
  }

  @Put(':id/assign')
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER')
  @ApiOperation({ summary: 'Назначить задачу оператору' })
  @ApiParam({ name: 'id', description: 'ID задачи' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Задача назначена',
    type: MoveTask,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Нельзя назначить задачу в текущем статусе',
  })
  async assignTask(
    @Param('id') id: string,
    @Body() body: {
      operatorId: string;
      operatorName: string;
      equipmentId?: string;
      equipmentNumber?: string;
    },
  ): Promise<MoveTask> {
    return this.moveTaskService.assignTask(
      id,
      body.operatorId,
      body.operatorName,
      body.equipmentId,
      body.equipmentNumber,
    );
  }

  @Put(':id/start')
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER', 'YARD_OPERATOR')
  @ApiOperation({ summary: 'Начать выполнение задачи' })
  @ApiParam({ name: 'id', description: 'ID задачи' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Задача начата',
    type: MoveTask,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Нельзя начать задачу в текущем статусе',
  })
  async startTask(
    @Param('id') id: string,
    @Body() body: {
      operatorId: string;
      equipmentId?: string;
    },
  ): Promise<MoveTask> {
    return this.moveTaskService.startTask(id, body.operatorId, body.equipmentId);
  }

  @Put(':id/complete')
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER', 'YARD_OPERATOR')
  @ApiOperation({ summary: 'Завершить задачу' })
  @ApiParam({ name: 'id', description: 'ID задачи' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Задача завершена',
    type: MoveTask,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Нельзя завершить задачу в текущем статусе',
  })
  async completeTask(
    @Param('id') id: string,
    @Body() results: {
      success?: boolean;
      completionRate?: number;
      qualityScore?: number;
      deliveryAccuracy?: any;
      issuesEncountered?: any[];
      performanceMetrics?: any;
    },
  ): Promise<MoveTask> {
    return this.moveTaskService.completeTask(id, results);
  }

  @Put(':id/cancel')
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER')
  @ApiOperation({ summary: 'Отменить задачу' })
  @ApiParam({ name: 'id', description: 'ID задачи' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Задача отменена',
    type: MoveTask,
  })
  async cancelTask(
    @Param('id') id: string,
    @Body('reason') reason: string,
  ): Promise<MoveTask> {
    return this.moveTaskService.cancelTask(id, reason);
  }

  @Post(':id/dependencies')
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER')
  @ApiOperation({ summary: 'Добавить зависимость между задачами' })
  @ApiParam({ name: 'id', description: 'ID задачи' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Зависимость добавлена',
    type: MoveTask,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Невозможно добавить зависимость - создаст циклическую зависимость',
  })
  async addDependency(
    @Param('id') id: string,
    @Body('prerequisiteTaskId') prerequisiteTaskId: string,
  ): Promise<MoveTask> {
    return this.moveTaskService.addDependency(id, prerequisiteTaskId);
  }
}