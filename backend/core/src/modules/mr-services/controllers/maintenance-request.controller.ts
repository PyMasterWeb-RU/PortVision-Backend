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
  MaintenanceRequestService, 
  CreateMaintenanceRequestDto, 
  UpdateMaintenanceRequestDto, 
  RequestSearchFilters 
} from '../services/maintenance-request.service';
import { MaintenanceRequest, MaintenanceRequestType, RequestStatus, RequestPriority, RequestSource } from '../entities/maintenance-request.entity';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';

@ApiTags('maintenance-requests')
@ApiBearerAuth()
@Controller('maintenance-requests')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MaintenanceRequestController {
  constructor(private readonly maintenanceRequestService: MaintenanceRequestService) {}

  @Post()
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER')
  @UsePipes(new ValidationPipe({ transform: true }))
  @ApiOperation({ summary: 'Создать новую заявку на обслуживание' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Заявка успешно создана',
    type: MaintenanceRequest,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Неверные данные',
  })
  async createMaintenanceRequest(@Body() createMaintenanceRequestDto: CreateMaintenanceRequestDto): Promise<MaintenanceRequest> {
    return this.maintenanceRequestService.createMaintenanceRequest(createMaintenanceRequestDto);
  }

  @Get()
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER')
  @ApiOperation({ summary: 'Получить список всех заявок на обслуживание' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Список заявок получен',
    type: [MaintenanceRequest],
  })
  async getAllMaintenanceRequests(): Promise<MaintenanceRequest[]> {
    return this.maintenanceRequestService.getAllMaintenanceRequests();
  }

  @Get('search')
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER', 'YARD_OPERATOR')
  @ApiOperation({ summary: 'Поиск заявок по критериям' })
  @ApiQuery({ name: 'requestType', enum: MaintenanceRequestType, required: false })
  @ApiQuery({ name: 'status', enum: RequestStatus, required: false })
  @ApiQuery({ name: 'priority', enum: RequestPriority, required: false })
  @ApiQuery({ name: 'requestSource', enum: RequestSource, required: false })
  @ApiQuery({ name: 'clientId', type: String, required: false })
  @ApiQuery({ name: 'containerId', type: String, required: false })
  @ApiQuery({ name: 'containerType', type: String, required: false })
  @ApiQuery({ name: 'scheduledDateAfter', type: Date, required: false })
  @ApiQuery({ name: 'scheduledDateBefore', type: Date, required: false })
  @ApiQuery({ name: 'actualStartAfter', type: Date, required: false })
  @ApiQuery({ name: 'actualStartBefore', type: Date, required: false })
  @ApiQuery({ name: 'isOverdue', type: Boolean, required: false })
  @ApiQuery({ name: 'hasQuote', type: Boolean, required: false })
  @ApiQuery({ name: 'isCompleted', type: Boolean, required: false })
  @ApiQuery({ name: 'assignedSupervisor', type: String, required: false })
  @ApiQuery({ name: 'workLocation', type: String, required: false })
  @ApiQuery({ name: 'searchText', type: String, required: false })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Результаты поиска получены',
    type: [MaintenanceRequest],
  })
  async searchMaintenanceRequests(@Query() query: any): Promise<MaintenanceRequest[]> {
    const filters: RequestSearchFilters = {};

    if (query.requestType) filters.requestType = query.requestType;
    if (query.status) filters.status = query.status;
    if (query.priority) filters.priority = query.priority;
    if (query.requestSource) filters.requestSource = query.requestSource;
    if (query.clientId) filters.clientId = query.clientId;
    if (query.containerId) filters.containerId = query.containerId;
    if (query.containerType) filters.containerType = query.containerType;
    if (query.scheduledDateAfter) filters.scheduledDateAfter = new Date(query.scheduledDateAfter);
    if (query.scheduledDateBefore) filters.scheduledDateBefore = new Date(query.scheduledDateBefore);
    if (query.actualStartAfter) filters.actualStartAfter = new Date(query.actualStartAfter);
    if (query.actualStartBefore) filters.actualStartBefore = new Date(query.actualStartBefore);
    if (query.isOverdue !== undefined) filters.isOverdue = query.isOverdue === 'true';
    if (query.hasQuote !== undefined) filters.hasQuote = query.hasQuote === 'true';
    if (query.isCompleted !== undefined) filters.isCompleted = query.isCompleted === 'true';
    if (query.assignedSupervisor) filters.assignedSupervisor = query.assignedSupervisor;
    if (query.workLocation) filters.workLocation = query.workLocation;
    if (query.searchText) filters.searchText = query.searchText;

    return this.maintenanceRequestService.searchMaintenanceRequests(filters);
  }

  @Get('statistics')
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER')
  @ApiOperation({ summary: 'Получить статистику заявок на обслуживание' })
  @ApiQuery({ name: 'period', type: Number, required: false, description: 'Период в днях' })
  @ApiQuery({ name: 'clientId', type: String, required: false })
  @ApiQuery({ name: 'requestType', enum: MaintenanceRequestType, required: false })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Статистика заявок получена',
  })
  async getRequestStatistics(@Query() query: any) {
    const filters: any = {};
    if (query.period) filters.period = parseInt(query.period);
    if (query.clientId) filters.clientId = query.clientId;
    if (query.requestType) filters.requestType = query.requestType;

    return this.maintenanceRequestService.getRequestStatistics(filters);
  }

  @Get('pending')
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER')
  @ApiOperation({ summary: 'Получить заявки в ожидании' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Заявки в ожидании получены',
    type: [MaintenanceRequest],
  })
  async getPendingRequests(): Promise<MaintenanceRequest[]> {
    return this.maintenanceRequestService.getPendingRequests();
  }

  @Get('active')
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER')
  @ApiOperation({ summary: 'Получить активные заявки' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Активные заявки получены',
    type: [MaintenanceRequest],
  })
  async getActiveRequests(): Promise<MaintenanceRequest[]> {
    return this.maintenanceRequestService.getActiveRequests();
  }

  @Get('overdue')
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER')
  @ApiOperation({ summary: 'Получить просроченные заявки' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Просроченные заявки получены',
    type: [MaintenanceRequest],
  })
  async getOverdueRequests(): Promise<MaintenanceRequest[]> {
    return this.maintenanceRequestService.getOverdueRequests();
  }

  @Get('requiring-quotes')
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER')
  @ApiOperation({ summary: 'Получить заявки, требующие квот' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Заявки, требующие квот, получены',
    type: [MaintenanceRequest],
  })
  async getRequestsRequiringQuotes(): Promise<MaintenanceRequest[]> {
    return this.maintenanceRequestService.getRequestsRequiringQuotes();
  }

  @Get('type/:requestType')
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER')
  @ApiOperation({ summary: 'Получить заявки по типу' })
  @ApiParam({ name: 'requestType', enum: MaintenanceRequestType, description: 'Тип заявки' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Заявки по типу получены',
    type: [MaintenanceRequest],
  })
  async getRequestsByType(@Param('requestType') requestType: MaintenanceRequestType): Promise<MaintenanceRequest[]> {
    return this.maintenanceRequestService.getRequestsByType(requestType);
  }

  @Get('status/:status')
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER')
  @ApiOperation({ summary: 'Получить заявки по статусу' })
  @ApiParam({ name: 'status', enum: RequestStatus, description: 'Статус заявки' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Заявки по статусу получены',
    type: [MaintenanceRequest],
  })
  async getRequestsByStatus(@Param('status') status: RequestStatus): Promise<MaintenanceRequest[]> {
    return this.maintenanceRequestService.getRequestsByStatus(status);
  }

  @Get('client/:clientId')
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER')
  @ApiOperation({ summary: 'Получить заявки клиента' })
  @ApiParam({ name: 'clientId', description: 'ID клиента' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Заявки клиента получены',
    type: [MaintenanceRequest],
  })
  async getRequestsByClient(@Param('clientId') clientId: string): Promise<MaintenanceRequest[]> {
    return this.maintenanceRequestService.getRequestsByClient(clientId);
  }

  @Get('container/:containerId')
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER')
  @ApiOperation({ summary: 'Получить заявки по контейнеру' })
  @ApiParam({ name: 'containerId', description: 'ID контейнера' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Заявки по контейнеру получены',
    type: [MaintenanceRequest],
  })
  async getRequestsByContainer(@Param('containerId') containerId: string): Promise<MaintenanceRequest[]> {
    return this.maintenanceRequestService.getRequestsByContainer(containerId);
  }

  @Get('number/:requestNumber')
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER', 'YARD_OPERATOR')
  @ApiOperation({ summary: 'Получить заявку по номеру' })
  @ApiParam({ name: 'requestNumber', description: 'Номер заявки' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Заявка найдена',
    type: MaintenanceRequest,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Заявка не найдена',
  })
  async getMaintenanceRequestByNumber(@Param('requestNumber') requestNumber: string): Promise<MaintenanceRequest> {
    return this.maintenanceRequestService.getMaintenanceRequestByNumber(requestNumber);
  }

  @Get(':id')
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER', 'YARD_OPERATOR')
  @ApiOperation({ summary: 'Получить заявку по ID' })
  @ApiParam({ name: 'id', description: 'ID заявки' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Заявка найдена',
    type: MaintenanceRequest,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Заявка не найдена',
  })
  async getMaintenanceRequestById(@Param('id') id: string): Promise<MaintenanceRequest> {
    return this.maintenanceRequestService.getMaintenanceRequestById(id);
  }

  @Put(':id')
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER')
  @UsePipes(new ValidationPipe({ transform: true }))
  @ApiOperation({ summary: 'Обновить заявку на обслуживание' })
  @ApiParam({ name: 'id', description: 'ID заявки' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Заявка обновлена',
    type: MaintenanceRequest,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Заявка не найдена',
  })
  async updateMaintenanceRequest(
    @Param('id') id: string,
    @Body() updateMaintenanceRequestDto: UpdateMaintenanceRequestDto,
  ): Promise<MaintenanceRequest> {
    return this.maintenanceRequestService.updateMaintenanceRequest(id, updateMaintenanceRequestDto);
  }

  @Delete(':id')
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Удалить заявку на обслуживание' })
  @ApiParam({ name: 'id', description: 'ID заявки' })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Заявка удалена',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Заявка не найдена',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Нельзя удалить активную заявку',
  })
  async deleteMaintenanceRequest(@Param('id') id: string): Promise<void> {
    return this.maintenanceRequestService.deleteMaintenanceRequest(id);
  }

  @Put(':id/quote')
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Подать квоту на заявку' })
  @ApiParam({ name: 'id', description: 'ID заявки' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Квота подана',
    type: MaintenanceRequest,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Нельзя подать квоту на заявку в текущем статусе',
  })
  async submitQuote(
    @Param('id') id: string,
    @Body() body: {
      quoteInformation: any;
      quotedBy: string;
    },
  ): Promise<MaintenanceRequest> {
    return this.maintenanceRequestService.submitQuote(id, body.quoteInformation, body.quotedBy);
  }

  @Put(':id/quote/accept')
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Принять квоту' })
  @ApiParam({ name: 'id', description: 'ID заявки' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Квота принята',
    type: MaintenanceRequest,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Нельзя принять квоту в текущем статусе',
  })
  async acceptQuote(
    @Param('id') id: string,
    @Body() body: {
      acceptedBy: string;
    },
  ): Promise<MaintenanceRequest> {
    return this.maintenanceRequestService.acceptQuote(id, body.acceptedBy);
  }

  @Put(':id/quote/reject')
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Отклонить квоту' })
  @ApiParam({ name: 'id', description: 'ID заявки' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Квота отклонена',
    type: MaintenanceRequest,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Нельзя отклонить квоту в текущем статусе',
  })
  async rejectQuote(
    @Param('id') id: string,
    @Body() body: {
      rejectionReason: string;
    },
  ): Promise<MaintenanceRequest> {
    return this.maintenanceRequestService.rejectQuote(id, body.rejectionReason);
  }

  @Put(':id/schedule')
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Запланировать работы' })
  @ApiParam({ name: 'id', description: 'ID заявки' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Работы запланированы',
    type: MaintenanceRequest,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Нельзя запланировать работы в текущем статусе',
  })
  async scheduleWork(
    @Param('id') id: string,
    @Body() body: {
      scheduledDate: Date;
      scheduledCompletion: Date;
      assignedTeam?: any;
    },
  ): Promise<MaintenanceRequest> {
    return this.maintenanceRequestService.scheduleWork(
      id,
      body.scheduledDate,
      body.scheduledCompletion,
      body.assignedTeam,
    );
  }

  @Put(':id/start')
  @Roles('ADMIN', 'MANAGER', 'YARD_OPERATOR')
  @ApiOperation({ summary: 'Начать работы' })
  @ApiParam({ name: 'id', description: 'ID заявки' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Работы начаты',
    type: MaintenanceRequest,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Нельзя начать работы в текущем статусе',
  })
  async startWork(@Param('id') id: string): Promise<MaintenanceRequest> {
    return this.maintenanceRequestService.startWork(id);
  }

  @Put(':id/complete')
  @Roles('ADMIN', 'MANAGER', 'YARD_OPERATOR')
  @ApiOperation({ summary: 'Завершить работы' })
  @ApiParam({ name: 'id', description: 'ID заявки' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Работы завершены',
    type: MaintenanceRequest,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Нельзя завершить работы в текущем статусе',
  })
  async completeWork(
    @Param('id') id: string,
    @Body() workReport?: any,
  ): Promise<MaintenanceRequest> {
    return this.maintenanceRequestService.completeWork(id, workReport);
  }

  @Put(':id/hold')
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Приостановить заявку' })
  @ApiParam({ name: 'id', description: 'ID заявки' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Заявка приостановлена',
    type: MaintenanceRequest,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Нельзя приостановить заявку в текущем статусе',
  })
  async putOnHold(
    @Param('id') id: string,
    @Body('reason') reason: string,
  ): Promise<MaintenanceRequest> {
    return this.maintenanceRequestService.putOnHold(id, reason);
  }

  @Put(':id/cancel')
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Отменить заявку' })
  @ApiParam({ name: 'id', description: 'ID заявки' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Заявка отменена',
    type: MaintenanceRequest,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Нельзя отменить заявку в текущем статусе',
  })
  async cancelRequest(
    @Param('id') id: string,
    @Body('cancellationReason') cancellationReason: string,
  ): Promise<MaintenanceRequest> {
    return this.maintenanceRequestService.cancelRequest(id, cancellationReason);
  }

  @Post(':id/communications')
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER')
  @ApiOperation({ summary: 'Добавить коммуникацию с клиентом' })
  @ApiParam({ name: 'id', description: 'ID заявки' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Коммуникация добавлена',
    type: MaintenanceRequest,
  })
  async addCommunication(
    @Param('id') id: string,
    @Body() communication: {
      communicationType: string;
      direction: string;
      subject: string;
      content: string;
      sentBy: string;
      receivedBy: string;
    },
  ): Promise<MaintenanceRequest> {
    return this.maintenanceRequestService.addCommunication(id, communication);
  }
}