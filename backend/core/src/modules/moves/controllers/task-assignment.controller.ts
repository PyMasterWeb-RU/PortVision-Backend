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
  TaskAssignmentService, 
  CreateTaskAssignmentDto, 
  UpdateTaskAssignmentDto, 
  AssignmentSearchFilters,
  AutoAssignmentCriteria 
} from '../services/task-assignment.service';
import { TaskAssignment, AssignmentStatus, AssignmentType } from '../entities/task-assignment.entity';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';

@ApiTags('task-assignments')
@ApiBearerAuth()
@Controller('task-assignments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TaskAssignmentController {
  constructor(private readonly taskAssignmentService: TaskAssignmentService) {}

  @Post()
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER')
  @UsePipes(new ValidationPipe({ transform: true }))
  @ApiOperation({ summary: 'Создать назначение задачи' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Назначение задачи успешно создано',
    type: TaskAssignment,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Неверные данные или задача уже назначена',
  })
  async createTaskAssignment(@Body() createTaskAssignmentDto: CreateTaskAssignmentDto): Promise<TaskAssignment> {
    return this.taskAssignmentService.createTaskAssignment(createTaskAssignmentDto);
  }

  @Get()
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER', 'YARD_OPERATOR')
  @ApiOperation({ summary: 'Получить список всех назначений задач' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Список назначений задач получен',
    type: [TaskAssignment],
  })
  async getAllTaskAssignments(): Promise<TaskAssignment[]> {
    return this.taskAssignmentService.getAllTaskAssignments();
  }

  @Get('search')
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER', 'YARD_OPERATOR')
  @ApiOperation({ summary: 'Поиск назначений задач по критериям' })
  @ApiQuery({ name: 'taskId', type: String, required: false })
  @ApiQuery({ name: 'workOrderId', type: String, required: false })
  @ApiQuery({ name: 'operatorId', type: String, required: false })
  @ApiQuery({ name: 'equipmentId', type: String, required: false })
  @ApiQuery({ name: 'status', enum: AssignmentStatus, required: false })
  @ApiQuery({ name: 'assignmentType', enum: AssignmentType, required: false })
  @ApiQuery({ name: 'assignedAfter', type: Date, required: false })
  @ApiQuery({ name: 'assignedBefore', type: Date, required: false })
  @ApiQuery({ name: 'scheduledStartAfter', type: Date, required: false })
  @ApiQuery({ name: 'scheduledStartBefore', type: Date, required: false })
  @ApiQuery({ name: 'assignedBy', type: String, required: false })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Результаты поиска получены',
    type: [TaskAssignment],
  })
  async searchTaskAssignments(@Query() query: any): Promise<TaskAssignment[]> {
    const filters: AssignmentSearchFilters = {};

    if (query.taskId) filters.taskId = query.taskId;
    if (query.workOrderId) filters.workOrderId = query.workOrderId;
    if (query.operatorId) filters.operatorId = query.operatorId;
    if (query.equipmentId) filters.equipmentId = query.equipmentId;
    if (query.status) filters.status = query.status;
    if (query.assignmentType) filters.assignmentType = query.assignmentType;
    if (query.assignedAfter) filters.assignedAfter = new Date(query.assignedAfter);
    if (query.assignedBefore) filters.assignedBefore = new Date(query.assignedBefore);
    if (query.scheduledStartAfter) filters.scheduledStartAfter = new Date(query.scheduledStartAfter);
    if (query.scheduledStartBefore) filters.scheduledStartBefore = new Date(query.scheduledStartBefore);
    if (query.assignedBy) filters.assignedBy = query.assignedBy;

    return this.taskAssignmentService.searchTaskAssignments(filters);
  }

  @Get('statistics')
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER')
  @ApiOperation({ summary: 'Получить статистику назначений' })
  @ApiQuery({ name: 'period', type: Number, required: false, description: 'Период в днях' })
  @ApiQuery({ name: 'operatorId', type: String, required: false })
  @ApiQuery({ name: 'equipmentType', type: String, required: false })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Статистика назначений получена',
  })
  async getAssignmentStatistics(@Query() query: any) {
    const filters: any = {};
    if (query.period) filters.period = parseInt(query.period);
    if (query.operatorId) filters.operatorId = query.operatorId;
    if (query.equipmentType) filters.equipmentType = query.equipmentType;

    return this.taskAssignmentService.getAssignmentStatistics(filters);
  }

  @Get('operator/:operatorId')
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER', 'YARD_OPERATOR')
  @ApiOperation({ summary: 'Получить назначения для оператора' })
  @ApiParam({ name: 'operatorId', description: 'ID оператора' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Назначения для оператора получены',
    type: [TaskAssignment],
  })
  async getAssignmentsByOperator(@Param('operatorId') operatorId: string): Promise<TaskAssignment[]> {
    return this.taskAssignmentService.getAssignmentsByOperator(operatorId);
  }

  @Get('operator/:operatorId/active')
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER', 'YARD_OPERATOR')
  @ApiOperation({ summary: 'Получить активные назначения для оператора' })
  @ApiParam({ name: 'operatorId', description: 'ID оператора' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Активные назначения для оператора получены',
    type: [TaskAssignment],
  })
  async getActiveAssignmentsByOperator(@Param('operatorId') operatorId: string): Promise<TaskAssignment[]> {
    return this.taskAssignmentService.getActiveAssignmentsByOperator(operatorId);
  }

  @Get('task/:taskId')
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER', 'YARD_OPERATOR')
  @ApiOperation({ summary: 'Получить назначения для задачи' })
  @ApiParam({ name: 'taskId', description: 'ID задачи' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Назначения для задачи получены',
    type: [TaskAssignment],
  })
  async getAssignmentsByTask(@Param('taskId') taskId: string): Promise<TaskAssignment[]> {
    return this.taskAssignmentService.getAssignmentsByTask(taskId);
  }

  @Post('recommendations')
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER')
  @ApiOperation({ summary: 'Получить рекомендации по назначению задачи' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Рекомендации по назначению получены',
  })
  async getAssignmentRecommendations(@Body() body: {
    taskId: string;
    criteria: AutoAssignmentCriteria;
  }) {
    return this.taskAssignmentService.getAssignmentRecommendations(body.taskId, body.criteria);
  }

  @Get(':id')
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER', 'YARD_OPERATOR')
  @ApiOperation({ summary: 'Получить назначение по ID' })
  @ApiParam({ name: 'id', description: 'ID назначения' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Назначение найдено',
    type: TaskAssignment,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Назначение не найдено',
  })
  async getTaskAssignmentById(@Param('id') id: string): Promise<TaskAssignment> {
    return this.taskAssignmentService.getTaskAssignmentById(id);
  }

  @Put(':id')
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER')
  @UsePipes(new ValidationPipe({ transform: true }))
  @ApiOperation({ summary: 'Обновить назначение задачи' })
  @ApiParam({ name: 'id', description: 'ID назначения' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Назначение обновлено',
    type: TaskAssignment,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Назначение не найдено',
  })
  async updateTaskAssignment(
    @Param('id') id: string,
    @Body() updateTaskAssignmentDto: UpdateTaskAssignmentDto,
  ): Promise<TaskAssignment> {
    return this.taskAssignmentService.updateTaskAssignment(id, updateTaskAssignmentDto);
  }

  @Put(':id/accept')
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER', 'YARD_OPERATOR')
  @ApiOperation({ summary: 'Принять назначение' })
  @ApiParam({ name: 'id', description: 'ID назначения' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Назначение принято',
    type: TaskAssignment,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Нельзя принять назначение в текущем статусе',
  })
  async acceptAssignment(
    @Param('id') id: string,
    @Body('operatorId') operatorId: string,
  ): Promise<TaskAssignment> {
    return this.taskAssignmentService.acceptAssignment(id, operatorId);
  }

  @Put(':id/reject')
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER', 'YARD_OPERATOR')
  @ApiOperation({ summary: 'Отклонить назначение' })
  @ApiParam({ name: 'id', description: 'ID назначения' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Назначение отклонено',
    type: TaskAssignment,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Нельзя отклонить назначение в текущем статусе',
  })
  async rejectAssignment(
    @Param('id') id: string,
    @Body() body: {
      operatorId: string;
      reason: string;
    },
  ): Promise<TaskAssignment> {
    return this.taskAssignmentService.rejectAssignment(id, body.operatorId, body.reason);
  }

  @Put(':id/start')
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER', 'YARD_OPERATOR')
  @ApiOperation({ summary: 'Начать выполнение назначения' })
  @ApiParam({ name: 'id', description: 'ID назначения' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Назначение начато',
    type: TaskAssignment,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Нельзя начать назначение в текущем статусе',
  })
  async startAssignment(@Param('id') id: string): Promise<TaskAssignment> {
    return this.taskAssignmentService.startAssignment(id);
  }

  @Put(':id/complete')
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER', 'YARD_OPERATOR')
  @ApiOperation({ summary: 'Завершить назначение' })
  @ApiParam({ name: 'id', description: 'ID назначения' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Назначение завершено',
    type: TaskAssignment,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Нельзя завершить назначение в текущем статусе',
  })
  async completeAssignment(
    @Param('id') id: string,
    @Body() results: {
      qualityScore?: number;
      timeEfficiency?: number;
      qualityMeasures?: Record<string, number>;
      safetyCompliance?: boolean;
      costEfficiency?: number;
      feedback?: {
        operatorFeedback?: string;
        supervisorFeedback?: string;
        customerFeedback?: string;
        improvementSuggestions?: string[];
      };
      documentation?: {
        photos?: string[];
        reports?: string[];
        certificates?: string[];
        signatures?: string[];
      };
    },
  ): Promise<TaskAssignment> {
    return this.taskAssignmentService.completeAssignment(id, results);
  }

  @Put('task/:taskId/reassign')
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER')
  @ApiOperation({ summary: 'Переназначить задачу другому оператору' })
  @ApiParam({ name: 'taskId', description: 'ID задачи' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Задача переназначена',
    type: TaskAssignment,
  })
  async reassignTask(
    @Param('taskId') taskId: string,
    @Body() body: {
      newOperatorId: string;
      newOperatorName: string;
      reason: string;
    },
  ): Promise<TaskAssignment> {
    return this.taskAssignmentService.reassignTask(
      taskId,
      body.newOperatorId,
      body.newOperatorName,
      body.reason,
    );
  }
}