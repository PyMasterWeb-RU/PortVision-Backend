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
  InvoiceService, 
  CreateInvoiceDto, 
  UpdateInvoiceDto, 
  InvoiceSearchFilters 
} from '../services/invoice.service';
import { Invoice, InvoiceType, InvoiceStatus, PaymentMethod } from '../entities/invoice.entity';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';

@ApiTags('invoices')
@ApiBearerAuth()
@Controller('invoices')
@UseGuards(JwtAuthGuard, RolesGuard)
export class InvoiceController {
  constructor(private readonly invoiceService: InvoiceService) {}

  @Post()
  @Roles('ADMIN', 'MANAGER')
  @UsePipes(new ValidationPipe({ transform: true }))
  @ApiOperation({ summary: 'Создать новый счет' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Счет успешно создан',
    type: Invoice,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Неверные данные',
  })
  async createInvoice(@Body() createInvoiceDto: CreateInvoiceDto): Promise<Invoice> {
    return this.invoiceService.createInvoice(createInvoiceDto);
  }

  @Get()
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER')
  @ApiOperation({ summary: 'Получить список всех счетов' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Список счетов получен',
    type: [Invoice],
  })
  async getAllInvoices(): Promise<Invoice[]> {
    return this.invoiceService.getAllInvoices();
  }

  @Get('search')
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER')
  @ApiOperation({ summary: 'Поиск счетов по критериям' })
  @ApiQuery({ name: 'invoiceType', enum: InvoiceType, required: false })
  @ApiQuery({ name: 'status', enum: InvoiceStatus, required: false })
  @ApiQuery({ name: 'clientId', type: String, required: false })
  @ApiQuery({ name: 'issueDateAfter', type: Date, required: false })
  @ApiQuery({ name: 'issueDateBefore', type: Date, required: false })
  @ApiQuery({ name: 'dueDateAfter', type: Date, required: false })
  @ApiQuery({ name: 'dueDateBefore', type: Date, required: false })
  @ApiQuery({ name: 'amountMin', type: Number, required: false })
  @ApiQuery({ name: 'amountMax', type: Number, required: false })
  @ApiQuery({ name: 'isOverdue', type: Boolean, required: false })
  @ApiQuery({ name: 'isDisputed', type: Boolean, required: false })
  @ApiQuery({ name: 'isPaid', type: Boolean, required: false })
  @ApiQuery({ name: 'searchText', type: String, required: false })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Результаты поиска получены',
    type: [Invoice],
  })
  async searchInvoices(@Query() query: any): Promise<Invoice[]> {
    const filters: InvoiceSearchFilters = {};

    if (query.invoiceType) filters.invoiceType = query.invoiceType;
    if (query.status) filters.status = query.status;
    if (query.clientId) filters.clientId = query.clientId;
    if (query.issueDateAfter) filters.issueDateAfter = new Date(query.issueDateAfter);
    if (query.issueDateBefore) filters.issueDateBefore = new Date(query.issueDateBefore);
    if (query.dueDateAfter) filters.dueDateAfter = new Date(query.dueDateAfter);
    if (query.dueDateBefore) filters.dueDateBefore = new Date(query.dueDateBefore);
    if (query.amountMin) filters.amountMin = parseFloat(query.amountMin);
    if (query.amountMax) filters.amountMax = parseFloat(query.amountMax);
    if (query.isOverdue !== undefined) filters.isOverdue = query.isOverdue === 'true';
    if (query.isDisputed !== undefined) filters.isDisputed = query.isDisputed === 'true';
    if (query.isPaid !== undefined) filters.isPaid = query.isPaid === 'true';
    if (query.searchText) filters.searchText = query.searchText;

    return this.invoiceService.searchInvoices(filters);
  }

  @Get('statistics')
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Получить статистику счетов' })
  @ApiQuery({ name: 'period', type: Number, required: false, description: 'Период в днях' })
  @ApiQuery({ name: 'clientId', type: String, required: false })
  @ApiQuery({ name: 'invoiceType', enum: InvoiceType, required: false })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Статистика счетов получена',
  })
  async getInvoiceStatistics(@Query() query: any) {
    const filters: any = {};
    if (query.period) filters.period = parseInt(query.period);
    if (query.clientId) filters.clientId = query.clientId;
    if (query.invoiceType) filters.invoiceType = query.invoiceType;

    return this.invoiceService.getInvoiceStatistics(filters);
  }

  @Get('pending')
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Получить счета в ожидании' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Счета в ожидании получены',
    type: [Invoice],
  })
  async getPendingInvoices(): Promise<Invoice[]> {
    return this.invoiceService.getPendingInvoices();
  }

  @Get('overdue')
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER')
  @ApiOperation({ summary: 'Получить просроченные счета' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Просроченные счета получены',
    type: [Invoice],
  })
  async getOverdueInvoices(): Promise<Invoice[]> {
    return this.invoiceService.getOverdueInvoices();
  }

  @Get('disputed')
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Получить спорные счета' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Спорные счета получены',
    type: [Invoice],
  })
  async getDisputedInvoices(): Promise<Invoice[]> {
    return this.invoiceService.getDisputedInvoices();
  }

  @Get('type/:invoiceType')
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER')
  @ApiOperation({ summary: 'Получить счета по типу' })
  @ApiParam({ name: 'invoiceType', enum: InvoiceType, description: 'Тип счета' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Счета по типу получены',
    type: [Invoice],
  })
  async getInvoicesByType(@Param('invoiceType') invoiceType: InvoiceType): Promise<Invoice[]> {
    return this.invoiceService.getInvoicesByType(invoiceType);
  }

  @Get('status/:status')
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER')
  @ApiOperation({ summary: 'Получить счета по статусу' })
  @ApiParam({ name: 'status', enum: InvoiceStatus, description: 'Статус счета' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Счета по статусу получены',
    type: [Invoice],
  })
  async getInvoicesByStatus(@Param('status') status: InvoiceStatus): Promise<Invoice[]> {
    return this.invoiceService.getInvoicesByStatus(status);
  }

  @Get('client/:clientId')
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER')
  @ApiOperation({ summary: 'Получить счета клиента' })
  @ApiParam({ name: 'clientId', description: 'ID клиента' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Счета клиента получены',
    type: [Invoice],
  })
  async getInvoicesByClient(@Param('clientId') clientId: string): Promise<Invoice[]> {
    return this.invoiceService.getInvoicesByClient(clientId);
  }

  @Get('number/:invoiceNumber')
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER')
  @ApiOperation({ summary: 'Получить счет по номеру' })
  @ApiParam({ name: 'invoiceNumber', description: 'Номер счета' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Счет найден',
    type: Invoice,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Счет не найден',
  })
  async getInvoiceByNumber(@Param('invoiceNumber') invoiceNumber: string): Promise<Invoice> {
    return this.invoiceService.getInvoiceByNumber(invoiceNumber);
  }

  @Get(':id')
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER')
  @ApiOperation({ summary: 'Получить счет по ID' })
  @ApiParam({ name: 'id', description: 'ID счета' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Счет найден',
    type: Invoice,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Счет не найден',
  })
  async getInvoiceById(@Param('id') id: string): Promise<Invoice> {
    return this.invoiceService.getInvoiceById(id);
  }

  @Put(':id')
  @Roles('ADMIN', 'MANAGER')
  @UsePipes(new ValidationPipe({ transform: true }))
  @ApiOperation({ summary: 'Обновить счет' })
  @ApiParam({ name: 'id', description: 'ID счета' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Счет обновлен',
    type: Invoice,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Счет не найден',
  })
  async updateInvoice(
    @Param('id') id: string,
    @Body() updateInvoiceDto: UpdateInvoiceDto,
  ): Promise<Invoice> {
    return this.invoiceService.updateInvoice(id, updateInvoiceDto);
  }

  @Delete(':id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Удалить счет' })
  @ApiParam({ name: 'id', description: 'ID счета' })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Счет удален',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Счет не найден',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Нельзя удалить отправленный или оплаченный счет',
  })
  async deleteInvoice(@Param('id') id: string): Promise<void> {
    return this.invoiceService.deleteInvoice(id);
  }

  @Put(':id/approve')
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Утвердить счет' })
  @ApiParam({ name: 'id', description: 'ID счета' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Счет утвержден',
    type: Invoice,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Нельзя утвердить счет в текущем статусе',
  })
  async approveInvoice(
    @Param('id') id: string,
    @Body() body: {
      approvedBy: string;
      comments?: string;
    },
  ): Promise<Invoice> {
    return this.invoiceService.approveInvoice(id, body.approvedBy, body.comments);
  }

  @Put(':id/send')
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Отправить счет клиенту' })
  @ApiParam({ name: 'id', description: 'ID счета' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Счет отправлен',
    type: Invoice,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Нельзя отправить счет в текущем статусе',
  })
  async sendInvoice(
    @Param('id') id: string,
    @Body() body: {
      sentBy: string;
    },
  ): Promise<Invoice> {
    return this.invoiceService.sendInvoice(id, body.sentBy);
  }

  @Post(':id/payments')
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER')
  @ApiOperation({ summary: 'Зарегистрировать платеж' })
  @ApiParam({ name: 'id', description: 'ID счета' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Платеж зарегистрирован',
    type: Invoice,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Нельзя зарегистрировать платеж для счета в текущем статусе',
  })
  async recordPayment(
    @Param('id') id: string,
    @Body() payment: {
      paymentAmount: number;
      paymentMethod: PaymentMethod;
      transactionReference: string;
      paymentDate?: Date;
      notes?: string;
    },
  ): Promise<Invoice> {
    return this.invoiceService.recordPayment(
      id,
      payment.paymentAmount,
      payment.paymentMethod,
      payment.transactionReference,
      payment.paymentDate,
      payment.notes,
    );
  }

  @Post(':id/disputes')
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER')
  @ApiOperation({ summary: 'Создать спор по счету' })
  @ApiParam({ name: 'id', description: 'ID счета' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Спор создан',
    type: Invoice,
  })
  async createDispute(
    @Param('id') id: string,
    @Body() dispute: {
      disputeAmount: number;
      disputeReason: string;
      disputeDescription: string;
      raisedBy: string;
    },
  ): Promise<Invoice> {
    return this.invoiceService.createDispute(
      id,
      dispute.disputeAmount,
      dispute.disputeReason,
      dispute.disputeDescription,
      dispute.raisedBy,
    );
  }

  @Put(':id/cancel')
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Отменить счет' })
  @ApiParam({ name: 'id', description: 'ID счета' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Счет отменен',
    type: Invoice,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Нельзя отменить счет в текущем статусе',
  })
  async cancelInvoice(
    @Param('id') id: string,
    @Body() body: {
      reason: string;
      cancelledBy: string;
    },
  ): Promise<Invoice> {
    return this.invoiceService.cancelInvoice(id, body.reason, body.cancelledBy);
  }

  @Post(':id/communications')
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER')
  @ApiOperation({ summary: 'Добавить коммуникацию по счету' })
  @ApiParam({ name: 'id', description: 'ID счета' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Коммуникация добавлена',
    type: Invoice,
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
  ): Promise<Invoice> {
    return this.invoiceService.addCommunication(id, communication);
  }
}