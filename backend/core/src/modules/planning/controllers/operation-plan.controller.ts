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
  OperationPlanService, 
  CreateOperationPlanDto, 
  UpdateOperationPlanDto, 
  PlanSearchFilters 
} from '../services/operation-plan.service';
import { OperationPlan, PlanType, PlanStatus, PlanPriority } from '../entities/operation-plan.entity';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';

@ApiTags('operation-plans')
@ApiBearerAuth()
@Controller('operation-plans')
@UseGuards(JwtAuthGuard, RolesGuard)
export class OperationPlanController {
  constructor(private readonly operationPlanService: OperationPlanService) {}

  @Post()
  @Roles('ADMIN', 'MANAGER')
  @UsePipes(new ValidationPipe({ transform: true }))
  @ApiOperation({ summary: 'Создать новый план операций' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'План операций успешно создан',
    type: OperationPlan,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Неверные данные',
  })
  async createOperationPlan(@Body() createOperationPlanDto: CreateOperationPlanDto): Promise<OperationPlan> {
    return this.operationPlanService.createOperationPlan(createOperationPlanDto);
  }

  @Get()
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER')
  @ApiOperation({ summary: 'Получить список всех планов операций' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Список планов операций получен',
    type: [OperationPlan],
  })
  async getAllOperationPlans(): Promise<OperationPlan[]> {
    return this.operationPlanService.getAllOperationPlans();
  }

  @Get('search')
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER')
  @ApiOperation({ summary: 'Поиск планов операций по критериям' })
  @ApiQuery({ name: 'planType', enum: PlanType, required: false })
  @ApiQuery({ name: 'status', enum: PlanStatus, required: false })
  @ApiQuery({ name: 'priority', enum: PlanPriority, required: false })
  @ApiQuery({ name: 'planManagerId', type: String, required: false })
  @ApiQuery({ name: 'departmentId', type: String, required: false })
  @ApiQuery({ name: 'parentPlanId', type: String, required: false })
  @ApiQuery({ name: 'startDateAfter', type: Date, required: false })
  @ApiQuery({ name: 'startDateBefore', type: Date, required: false })
  @ApiQuery({ name: 'endDateAfter', type: Date, required: false })
  @ApiQuery({ name: 'endDateBefore', type: Date, required: false })
  @ApiQuery({ name: 'isOverdue', type: Boolean, required: false })
  @ApiQuery({ name: 'requiresApproval', type: Boolean, required: false })
  @ApiQuery({ name: 'hasOpenIssues', type: Boolean, required: false })
  @ApiQuery({ name: 'budgetVarianceMin', type: Number, required: false })
  @ApiQuery({ name: 'budgetVarianceMax', type: Number, required: false })
  @ApiQuery({ name: 'progressMin', type: Number, required: false })
  @ApiQuery({ name: 'progressMax', type: Number, required: false })
  @ApiQuery({ name: 'searchText', type: String, required: false })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Результаты поиска получены',
    type: [OperationPlan],
  })
  async searchOperationPlans(@Query() query: any): Promise<OperationPlan[]> {
    const filters: PlanSearchFilters = {};

    if (query.planType) filters.planType = query.planType;
    if (query.status) filters.status = query.status;
    if (query.priority) filters.priority = query.priority;
    if (query.planManagerId) filters.planManagerId = query.planManagerId;
    if (query.departmentId) filters.departmentId = query.departmentId;
    if (query.parentPlanId) filters.parentPlanId = query.parentPlanId;
    if (query.startDateAfter) filters.startDateAfter = new Date(query.startDateAfter);
    if (query.startDateBefore) filters.startDateBefore = new Date(query.startDateBefore);
    if (query.endDateAfter) filters.endDateAfter = new Date(query.endDateAfter);
    if (query.endDateBefore) filters.endDateBefore = new Date(query.endDateBefore);
    if (query.isOverdue !== undefined) filters.isOverdue = query.isOverdue === 'true';
    if (query.requiresApproval !== undefined) filters.requiresApproval = query.requiresApproval === 'true';
    if (query.hasOpenIssues !== undefined) filters.hasOpenIssues = query.hasOpenIssues === 'true';
    if (query.budgetVarianceMin || query.budgetVarianceMax) {
      filters.budgetVariance = {
        min: query.budgetVarianceMin ? parseFloat(query.budgetVarianceMin) : -Infinity,
        max: query.budgetVarianceMax ? parseFloat(query.budgetVarianceMax) : Infinity,
      };
    }
    if (query.progressMin || query.progressMax) {
      filters.progressRange = {
        min: query.progressMin ? parseFloat(query.progressMin) : 0,
        max: query.progressMax ? parseFloat(query.progressMax) : 100,
      };
    }
    if (query.searchText) filters.searchText = query.searchText;

    return this.operationPlanService.searchOperationPlans(filters);
  }

  @Get('statistics')
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER')
  @ApiOperation({ summary: 'Получить статистику планов операций' })
  @ApiQuery({ name: 'period', type: Number, required: false, description: 'Период в днях' })
  @ApiQuery({ name: 'departmentId', type: String, required: false })
  @ApiQuery({ name: 'planManagerId', type: String, required: false })
  @ApiQuery({ name: 'planType', enum: PlanType, required: false })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Статистика планов операций получена',
  })
  async getPlanStatistics(@Query() query: any) {
    const filters: any = {};
    if (query.period) filters.period = parseInt(query.period);
    if (query.departmentId) filters.departmentId = query.departmentId;
    if (query.planManagerId) filters.planManagerId = query.planManagerId;
    if (query.planType) filters.planType = query.planType;

    return this.operationPlanService.getPlanStatistics(filters);
  }

  @Get('active')
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER')
  @ApiOperation({ summary: 'Получить активные планы' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Активные планы получены',
    type: [OperationPlan],
  })
  async getActivePlans(): Promise<OperationPlan[]> {
    return this.operationPlanService.getActivePlans();
  }

  @Get('overdue')
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER')
  @ApiOperation({ summary: 'Получить просроченные планы' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Просроченные планы получены',
    type: [OperationPlan],
  })
  async getOverduePlans(): Promise<OperationPlan[]> {
    return this.operationPlanService.getOverduePlans();
  }

  @Get('pending-approval')
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Получить планы, требующие утверждения' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Планы, требующие утверждения, получены',
    type: [OperationPlan],
  })
  async getPlansRequiringApproval(): Promise<OperationPlan[]> {
    return this.operationPlanService.getPlansRequiringApproval();
  }

  @Get('type/:planType')
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER')
  @ApiOperation({ summary: 'Получить планы по типу' })
  @ApiParam({ name: 'planType', enum: PlanType, description: 'Тип плана' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Планы по типу получены',
    type: [OperationPlan],
  })
  async getPlansByType(@Param('planType') planType: PlanType): Promise<OperationPlan[]> {
    return this.operationPlanService.getPlansByType(planType);
  }

  @Get('status/:status')
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER')
  @ApiOperation({ summary: 'Получить планы по статусу' })
  @ApiParam({ name: 'status', enum: PlanStatus, description: 'Статус плана' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Планы по статусу получены',
    type: [OperationPlan],
  })
  async getPlansByStatus(@Param('status') status: PlanStatus): Promise<OperationPlan[]> {
    return this.operationPlanService.getPlansByStatus(status);
  }

  @Get('manager/:planManagerId')
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER')
  @ApiOperation({ summary: 'Получить планы менеджера' })
  @ApiParam({ name: 'planManagerId', description: 'ID менеджера плана' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Планы менеджера получены',
    type: [OperationPlan],
  })
  async getPlansByManager(@Param('planManagerId') planManagerId: string): Promise<OperationPlan[]> {
    return this.operationPlanService.getPlansByManager(planManagerId);
  }

  @Get('department/:departmentId')
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER')
  @ApiOperation({ summary: 'Получить планы подразделения' })
  @ApiParam({ name: 'departmentId', description: 'ID подразделения' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Планы подразделения получены',
    type: [OperationPlan],
  })
  async getPlansByDepartment(@Param('departmentId') departmentId: string): Promise<OperationPlan[]> {
    return this.operationPlanService.getPlansByDepartment(departmentId);
  }

  @Get('number/:planNumber')
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER')
  @ApiOperation({ summary: 'Получить план по номеру' })
  @ApiParam({ name: 'planNumber', description: 'Номер плана' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'План найден',
    type: OperationPlan,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'План не найден',
  })
  async getOperationPlanByNumber(@Param('planNumber') planNumber: string): Promise<OperationPlan> {
    return this.operationPlanService.getOperationPlanByNumber(planNumber);
  }

  @Get(':id')
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER')
  @ApiOperation({ summary: 'Получить план по ID' })
  @ApiParam({ name: 'id', description: 'ID плана' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'План найден',
    type: OperationPlan,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'План не найден',
  })
  async getOperationPlanById(@Param('id') id: string): Promise<OperationPlan> {
    return this.operationPlanService.getOperationPlanById(id);
  }

  @Put(':id')
  @Roles('ADMIN', 'MANAGER')
  @UsePipes(new ValidationPipe({ transform: true }))
  @ApiOperation({ summary: 'Обновить план операций' })
  @ApiParam({ name: 'id', description: 'ID плана' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'План обновлен',
    type: OperationPlan,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'План не найден',
  })
  async updateOperationPlan(
    @Param('id') id: string,
    @Body() updateOperationPlanDto: UpdateOperationPlanDto,
  ): Promise<OperationPlan> {
    return this.operationPlanService.updateOperationPlan(id, updateOperationPlanDto);
  }

  @Delete(':id')
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Удалить план операций' })
  @ApiParam({ name: 'id', description: 'ID плана' })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'План удален',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'План не найден',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Нельзя удалить активный план',
  })
  async deleteOperationPlan(@Param('id') id: string): Promise<void> {
    return this.operationPlanService.deleteOperationPlan(id);
  }

  @Put(':id/submit-approval')
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Отправить план на утверждение' })
  @ApiParam({ name: 'id', description: 'ID плана' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'План отправлен на утверждение',
    type: OperationPlan,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Нельзя отправить план на утверждение в текущем статусе',
  })
  async submitForApproval(@Param('id') id: string): Promise<OperationPlan> {
    return this.operationPlanService.submitForApproval(id);
  }

  @Put(':id/approve')
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Утвердить план' })
  @ApiParam({ name: 'id', description: 'ID плана' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'План утвержден',
    type: OperationPlan,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Нельзя утвердить план в текущем статусе',
  })
  async approvePlan(
    @Param('id') id: string,
    @Body() body: {
      approverId: string;
      approverName: string;
      comments?: string;
    },
  ): Promise<OperationPlan> {
    return this.operationPlanService.approvePlan(
      id,
      body.approverId,
      body.approverName,
      body.comments,
    );
  }

  @Put(':id/reject')
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Отклонить план' })
  @ApiParam({ name: 'id', description: 'ID плана' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'План отклонен',
    type: OperationPlan,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Нельзя отклонить план в текущем статусе',
  })
  async rejectPlan(
    @Param('id') id: string,
    @Body() body: {
      approverId: string;
      approverName: string;
      reason: string;
    },
  ): Promise<OperationPlan> {
    return this.operationPlanService.rejectPlan(
      id,
      body.approverId,
      body.approverName,
      body.reason,
    );
  }

  @Put(':id/activate')
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Активировать план' })
  @ApiParam({ name: 'id', description: 'ID плана' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'План активирован',
    type: OperationPlan,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Нельзя активировать план в текущем статусе',
  })
  async activatePlan(@Param('id') id: string): Promise<OperationPlan> {
    return this.operationPlanService.activatePlan(id);
  }

  @Put(':id/complete')
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Завершить план' })
  @ApiParam({ name: 'id', description: 'ID плана' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'План завершен',
    type: OperationPlan,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Нельзя завершить план в текущем статусе',
  })
  async completePlan(
    @Param('id') id: string,
    @Body() completionReport?: {
      summary: string;
      achievements: string[];
      challenges: string[];
      lessonsLearned: string[];
      recommendations: string[];
      finalMetrics: Record<string, number>;
    },
  ): Promise<OperationPlan> {
    return this.operationPlanService.completePlan(id, completionReport);
  }

  @Put(':id/progress')
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER')
  @ApiOperation({ summary: 'Обновить прогресс выполнения плана' })
  @ApiParam({ name: 'id', description: 'ID плана' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Прогресс обновлен',
    type: OperationPlan,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Неверный прогресс (должен быть от 0 до 100)',
  })
  async updateProgress(
    @Param('id') id: string,
    @Body() body: {
      progress: number;
      notes?: string;
    },
  ): Promise<OperationPlan> {
    return this.operationPlanService.updateProgress(id, body.progress, body.notes);
  }

  @Post(':id/issues')
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER')
  @ApiOperation({ summary: 'Добавить проблему в план' })
  @ApiParam({ name: 'id', description: 'ID плана' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Проблема добавлена',
    type: OperationPlan,
  })
  async addIssue(
    @Param('id') id: string,
    @Body() issue: {
      category: string;
      description: string;
      severity: 'low' | 'medium' | 'high' | 'critical';
      reportedBy: string;
      impact?: string;
    },
  ): Promise<OperationPlan> {
    return this.operationPlanService.addIssue(id, issue);
  }
}