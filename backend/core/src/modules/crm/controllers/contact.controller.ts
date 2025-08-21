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
  ContactService, 
  CreateContactDto, 
  UpdateContactDto, 
  ContactSearchFilters 
} from '../services/contact.service';
import { Contact, ContactType, ContactStatus, LeadSource, Industry } from '../entities/contact.entity';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';

@ApiTags('contacts')
@ApiBearerAuth()
@Controller('contacts')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ContactController {
  constructor(private readonly contactService: ContactService) {}

  @Post()
  @Roles('ADMIN', 'MANAGER')
  @UsePipes(new ValidationPipe({ transform: true }))
  @ApiOperation({ summary: 'Создать новый контакт' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Контакт успешно создан',
    type: Contact,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Неверные данные или контакт уже существует',
  })
  async createContact(@Body() createContactDto: CreateContactDto): Promise<Contact> {
    return this.contactService.createContact(createContactDto);
  }

  @Get()
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER')
  @ApiOperation({ summary: 'Получить список всех контактов' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Список контактов получен',
    type: [Contact],
  })
  async getAllContacts(): Promise<Contact[]> {
    return this.contactService.getAllContacts();
  }

  @Get('search')
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER')
  @ApiOperation({ summary: 'Поиск контактов по критериям' })
  @ApiQuery({ name: 'contactType', enum: ContactType, required: false })
  @ApiQuery({ name: 'status', enum: ContactStatus, required: false })
  @ApiQuery({ name: 'leadSource', enum: LeadSource, required: false })
  @ApiQuery({ name: 'industry', enum: Industry, required: false })
  @ApiQuery({ name: 'assignedTo', type: String, required: false })
  @ApiQuery({ name: 'leadScoreMin', type: Number, required: false })
  @ApiQuery({ name: 'leadScoreMax', type: Number, required: false })
  @ApiQuery({ name: 'pipelineStage', type: String, required: false })
  @ApiQuery({ name: 'expectedValueMin', type: Number, required: false })
  @ApiQuery({ name: 'expectedValueMax', type: Number, required: false })
  @ApiQuery({ name: 'hasOpenTasks', type: Boolean, required: false })
  @ApiQuery({ name: 'needsFollowUp', type: Boolean, required: false })
  @ApiQuery({ name: 'lastInteractionBefore', type: Date, required: false })
  @ApiQuery({ name: 'lastInteractionAfter', type: Date, required: false })
  @ApiQuery({ name: 'isHighPotential', type: Boolean, required: false })
  @ApiQuery({ name: 'riskLevel', type: String, required: false })
  @ApiQuery({ name: 'country', type: String, required: false })
  @ApiQuery({ name: 'city', type: String, required: false })
  @ApiQuery({ name: 'searchText', type: String, required: false })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Результаты поиска получены',
    type: [Contact],
  })
  async searchContacts(@Query() query: any): Promise<Contact[]> {
    const filters: ContactSearchFilters = {};

    if (query.contactType) filters.contactType = query.contactType;
    if (query.status) filters.status = query.status;
    if (query.leadSource) filters.leadSource = query.leadSource;
    if (query.industry) filters.industry = query.industry;
    if (query.assignedTo) filters.assignedTo = query.assignedTo;
    if (query.leadScoreMin) filters.leadScoreMin = parseInt(query.leadScoreMin);
    if (query.leadScoreMax) filters.leadScoreMax = parseInt(query.leadScoreMax);
    if (query.pipelineStage) filters.pipelineStage = query.pipelineStage;
    if (query.expectedValueMin) filters.expectedValueMin = parseFloat(query.expectedValueMin);
    if (query.expectedValueMax) filters.expectedValueMax = parseFloat(query.expectedValueMax);
    if (query.hasOpenTasks !== undefined) filters.hasOpenTasks = query.hasOpenTasks === 'true';
    if (query.needsFollowUp !== undefined) filters.needsFollowUp = query.needsFollowUp === 'true';
    if (query.lastInteractionBefore) filters.lastInteractionBefore = new Date(query.lastInteractionBefore);
    if (query.lastInteractionAfter) filters.lastInteractionAfter = new Date(query.lastInteractionAfter);
    if (query.isHighPotential !== undefined) filters.isHighPotential = query.isHighPotential === 'true';
    if (query.riskLevel) filters.riskLevel = query.riskLevel;
    if (query.country) filters.country = query.country;
    if (query.city) filters.city = query.city;
    if (query.searchText) filters.searchText = query.searchText;

    return this.contactService.searchContacts(filters);
  }

  @Get('statistics')
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Получить статистику контактов' })
  @ApiQuery({ name: 'period', type: Number, required: false, description: 'Период в днях' })
  @ApiQuery({ name: 'assignedTo', type: String, required: false })
  @ApiQuery({ name: 'contactType', enum: ContactType, required: false })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Статистика контактов получена',
  })
  async getContactStatistics(@Query() query: any) {
    const filters: any = {};
    if (query.period) filters.period = parseInt(query.period);
    if (query.assignedTo) filters.assignedTo = query.assignedTo;
    if (query.contactType) filters.contactType = query.contactType;

    return this.contactService.getContactStatistics(filters);
  }

  @Get('leads')
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER')
  @ApiOperation({ summary: 'Получить лиды' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Лиды получены',
    type: [Contact],
  })
  async getLeads(): Promise<Contact[]> {
    return this.contactService.getLeads();
  }

  @Get('clients')
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER')
  @ApiOperation({ summary: 'Получить клиентов' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Клиенты получены',
    type: [Contact],
  })
  async getClients(): Promise<Contact[]> {
    return this.contactService.getClients();
  }

  @Get('high-potential')
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Получить высокопотенциальные контакты' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Высокопотенциальные контакты получены',
    type: [Contact],
  })
  async getHighPotentialContacts(): Promise<Contact[]> {
    return this.contactService.getHighPotentialContacts();
  }

  @Get('follow-up-needed')
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER')
  @ApiOperation({ summary: 'Получить контакты, требующие последующих действий' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Контакты, требующие последующих действий, получены',
    type: [Contact],
  })
  async getContactsNeedingFollowUp(): Promise<Contact[]> {
    return this.contactService.getContactsNeedingFollowUp();
  }

  @Get('type/:contactType')
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER')
  @ApiOperation({ summary: 'Получить контакты по типу' })
  @ApiParam({ name: 'contactType', enum: ContactType, description: 'Тип контакта' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Контакты по типу получены',
    type: [Contact],
  })
  async getContactsByType(@Param('contactType') contactType: ContactType): Promise<Contact[]> {
    return this.contactService.getContactsByType(contactType);
  }

  @Get('status/:status')
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER')
  @ApiOperation({ summary: 'Получить контакты по статусу' })
  @ApiParam({ name: 'status', enum: ContactStatus, description: 'Статус контакта' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Контакты по статусу получены',
    type: [Contact],
  })
  async getContactsByStatus(@Param('status') status: ContactStatus): Promise<Contact[]> {
    return this.contactService.getContactsByStatus(status);
  }

  @Get('assigned/:assignedTo')
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER')
  @ApiOperation({ summary: 'Получить контакты назначенного менеджера' })
  @ApiParam({ name: 'assignedTo', description: 'ID назначенного менеджера' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Контакты назначенного менеджера получены',
    type: [Contact],
  })
  async getContactsByAssignee(@Param('assignedTo') assignedTo: string): Promise<Contact[]> {
    return this.contactService.getContactsByAssignee(assignedTo);
  }

  @Get(':id')
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER')
  @ApiOperation({ summary: 'Получить контакт по ID' })
  @ApiParam({ name: 'id', description: 'ID контакта' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Контакт найден',
    type: Contact,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Контакт не найден',
  })
  async getContactById(@Param('id') id: string): Promise<Contact> {
    return this.contactService.getContactById(id);
  }

  @Put(':id')
  @Roles('ADMIN', 'MANAGER')
  @UsePipes(new ValidationPipe({ transform: true }))
  @ApiOperation({ summary: 'Обновить контакт' })
  @ApiParam({ name: 'id', description: 'ID контакта' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Контакт обновлен',
    type: Contact,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Контакт не найден',
  })
  async updateContact(
    @Param('id') id: string,
    @Body() updateContactDto: UpdateContactDto,
  ): Promise<Contact> {
    return this.contactService.updateContact(id, updateContactDto);
  }

  @Delete(':id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Удалить контакт' })
  @ApiParam({ name: 'id', description: 'ID контакта' })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Контакт удален',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Контакт не найден',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Нельзя удалить конвертированный контакт',
  })
  async deleteContact(@Param('id') id: string): Promise<void> {
    return this.contactService.deleteContact(id);
  }

  @Post(':id/interactions')
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER')
  @ApiOperation({ summary: 'Добавить взаимодействие с контактом' })
  @ApiParam({ name: 'id', description: 'ID контакта' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Взаимодействие добавлено',
    type: Contact,
  })
  async addInteraction(
    @Param('id') id: string,
    @Body() interaction: {
      interactionType: 'call' | 'email' | 'meeting' | 'visit' | 'demo' | 'proposal' | 'contract' | 'support';
      subject: string;
      description: string;
      outcome: string;
      followUpRequired: boolean;
      followUpDate?: Date;
      contactedBy: string;
      contactedPerson: string;
      duration?: number;
      location?: string;
      attachments?: string[];
    },
  ): Promise<Contact> {
    return this.contactService.addInteraction(id, interaction);
  }

  @Post(':id/tasks')
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER')
  @ApiOperation({ summary: 'Добавить задачу для контакта' })
  @ApiParam({ name: 'id', description: 'ID контакта' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Задача добавлена',
    type: Contact,
  })
  async addTask(
    @Param('id') id: string,
    @Body() task: {
      taskType: 'follow_up' | 'call' | 'email' | 'meeting' | 'proposal' | 'contract_review' | 'other';
      title: string;
      description: string;
      assignedTo: string;
      dueDate: Date;
      priority: 'low' | 'medium' | 'high' | 'urgent';
      notes?: string;
    },
  ): Promise<Contact> {
    return this.contactService.addTask(id, task);
  }

  @Put(':id/tasks/:taskId/complete')
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER')
  @ApiOperation({ summary: 'Завершить задачу' })
  @ApiParam({ name: 'id', description: 'ID контакта' })
  @ApiParam({ name: 'taskId', description: 'ID задачи' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Задача завершена',
    type: Contact,
  })
  async completeTask(
    @Param('id') id: string,
    @Param('taskId') taskId: string,
    @Body() body: { notes?: string },
  ): Promise<Contact> {
    return this.contactService.completeTask(id, taskId, body.notes);
  }

  @Put(':id/pipeline')
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Обновить стадию продажного цикла' })
  @ApiParam({ name: 'id', description: 'ID контакта' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Стадия продажного цикла обновлена',
    type: Contact,
  })
  async updatePipelineStage(
    @Param('id') id: string,
    @Body() update: {
      stage: 'prospecting' | 'qualification' | 'needs_analysis' | 'proposal' | 'negotiation' | 'closed_won' | 'closed_lost';
      probability: number;
      expectedValue?: number;
      expectedCloseDate?: Date;
    },
  ): Promise<Contact> {
    return this.contactService.updatePipelineStage(
      id,
      update.stage,
      update.probability,
      update.expectedValue,
      update.expectedCloseDate,
    );
  }

  @Put(':id/convert')
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Конвертировать в клиента' })
  @ApiParam({ name: 'id', description: 'ID контакта' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Контакт конвертирован в клиента',
    type: Contact,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Только проспекты могут быть конвертированы в клиентов',
  })
  async convertToClient(@Param('id') id: string): Promise<Contact> {
    return this.contactService.convertToClient(id);
  }
}