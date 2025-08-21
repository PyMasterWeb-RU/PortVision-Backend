import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { 
  Invoice, 
  InvoiceType, 
  InvoiceStatus, 
  PaymentMethod,
  PaymentStatus 
} from '../entities/invoice.entity';

export interface CreateInvoiceDto {
  invoiceType: InvoiceType;
  clientId: string;
  clientName: string;
  clientInformation: any;
  issueDate: Date;
  dueDate: Date;
  servicePeriod?: any;
  lineItems: any[];
  paymentTerms: any;
  taxInformation?: any[];
  discountInformation?: any[];
  paymentDetails?: any;
  notes?: string;
  metadata?: Record<string, any>;
}

export interface UpdateInvoiceDto {
  invoiceType?: InvoiceType;
  status?: InvoiceStatus;
  clientInformation?: any;
  issueDate?: Date;
  dueDate?: Date;
  servicePeriod?: any;
  lineItems?: any[];
  paymentTerms?: any;
  taxInformation?: any[];
  discountInformation?: any[];
  disputeInformation?: any;
  refundInformation?: any;
  paymentDetails?: any;
  notes?: string;
  internalNotes?: string;
  metadata?: Record<string, any>;
}

export interface InvoiceSearchFilters {
  invoiceType?: InvoiceType;
  status?: InvoiceStatus;
  clientId?: string;
  issueDateAfter?: Date;
  issueDateBefore?: Date;
  dueDateAfter?: Date;
  dueDateBefore?: Date;
  amountMin?: number;
  amountMax?: number;
  isOverdue?: boolean;
  isDisputed?: boolean;
  isPaid?: boolean;
  searchText?: string;
}

@Injectable()
export class InvoiceService {
  private readonly logger = new Logger(InvoiceService.name);

  constructor(
    @InjectRepository(Invoice)
    private readonly invoiceRepository: Repository<Invoice>,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async createInvoice(createInvoiceDto: CreateInvoiceDto): Promise<Invoice> {
    this.logger.log(`Creating invoice for client: ${createInvoiceDto.clientName}`);

    // Generate invoice number
    const invoiceNumber = await this.generateInvoiceNumber(createInvoiceDto.invoiceType);

    // Calculate financial summary
    const financialSummary = this.calculateFinancialSummary(
      createInvoiceDto.lineItems,
      createInvoiceDto.taxInformation,
      createInvoiceDto.discountInformation
    );

    const invoice = this.invoiceRepository.create({
      ...createInvoiceDto,
      invoiceNumber,
      financialSummary,
      status: InvoiceStatus.DRAFT,
    });

    const savedInvoice = await this.invoiceRepository.save(invoice);

    this.eventEmitter.emit('invoice.created', {
      invoiceId: savedInvoice.id,
      invoiceNumber: savedInvoice.invoiceNumber,
      clientId: savedInvoice.clientId,
      totalAmount: savedInvoice.financialSummary.totalAmount,
    });

    this.logger.log(`Invoice created: ${savedInvoice.invoiceNumber}`);
    return savedInvoice;
  }

  async getAllInvoices(): Promise<Invoice[]> {
    return this.invoiceRepository.find({
      order: { createdAt: 'DESC' },
    });
  }

  async getInvoiceById(id: string): Promise<Invoice> {
    const invoice = await this.invoiceRepository.findOne({
      where: { id },
    });

    if (!invoice) {
      throw new NotFoundException(`Invoice with ID ${id} not found`);
    }

    return invoice;
  }

  async getInvoiceByNumber(invoiceNumber: string): Promise<Invoice> {
    const invoice = await this.invoiceRepository.findOne({
      where: { invoiceNumber },
    });

    if (!invoice) {
      throw new NotFoundException(`Invoice with number ${invoiceNumber} not found`);
    }

    return invoice;
  }

  async updateInvoice(id: string, updateInvoiceDto: UpdateInvoiceDto): Promise<Invoice> {
    const invoice = await this.getInvoiceById(id);

    // Validate status transitions
    if (updateInvoiceDto.status) {
      this.validateStatusTransition(invoice.status, updateInvoiceDto.status);
    }

    // Recalculate financial summary if line items changed
    if (updateInvoiceDto.lineItems) {
      const financialSummary = this.calculateFinancialSummary(
        updateInvoiceDto.lineItems,
        updateInvoiceDto.taxInformation || invoice.taxInformation,
        updateInvoiceDto.discountInformation || invoice.discountInformation
      );
      updateInvoiceDto['financialSummary'] = financialSummary;
    }

    // Update status history if status is changing
    if (updateInvoiceDto.status && updateInvoiceDto.status !== invoice.status) {
      const statusHistory = invoice.statusHistory || [];
      statusHistory.push({
        status: updateInvoiceDto.status,
        changedBy: 'system', // TODO: get from current user context
        changedAt: new Date(),
        reason: 'Status updated via API',
      });
      updateInvoiceDto['statusHistory'] = statusHistory;
    }

    Object.assign(invoice, updateInvoiceDto);
    const updatedInvoice = await this.invoiceRepository.save(invoice);

    this.eventEmitter.emit('invoice.updated', {
      invoiceId: updatedInvoice.id,
      invoiceNumber: updatedInvoice.invoiceNumber,
      changes: updateInvoiceDto,
    });

    this.logger.log(`Invoice updated: ${updatedInvoice.invoiceNumber}`);
    return updatedInvoice;
  }

  async deleteInvoice(id: string): Promise<void> {
    const invoice = await this.getInvoiceById(id);

    if ([InvoiceStatus.SENT, InvoiceStatus.PAID, InvoiceStatus.PARTIALLY_PAID].includes(invoice.status)) {
      throw new BadRequestException(`Cannot delete invoice ${invoice.invoiceNumber} - status is ${invoice.status}`);
    }

    await this.invoiceRepository.remove(invoice);

    this.eventEmitter.emit('invoice.deleted', {
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
    });

    this.logger.log(`Invoice deleted: ${invoice.invoiceNumber}`);
  }

  async searchInvoices(filters: InvoiceSearchFilters): Promise<Invoice[]> {
    const query = this.invoiceRepository.createQueryBuilder('invoice');

    if (filters.invoiceType) {
      query.andWhere('invoice.invoiceType = :invoiceType', { invoiceType: filters.invoiceType });
    }

    if (filters.status) {
      query.andWhere('invoice.status = :status', { status: filters.status });
    }

    if (filters.clientId) {
      query.andWhere('invoice.clientId = :clientId', { clientId: filters.clientId });
    }

    if (filters.issueDateAfter) {
      query.andWhere('invoice.issueDate >= :issueDateAfter', { issueDateAfter: filters.issueDateAfter });
    }

    if (filters.issueDateBefore) {
      query.andWhere('invoice.issueDate <= :issueDateBefore', { issueDateBefore: filters.issueDateBefore });
    }

    if (filters.dueDateAfter) {
      query.andWhere('invoice.dueDate >= :dueDateAfter', { dueDateAfter: filters.dueDateAfter });
    }

    if (filters.dueDateBefore) {
      query.andWhere('invoice.dueDate <= :dueDateBefore', { dueDateBefore: filters.dueDateBefore });
    }

    if (filters.amountMin) {
      query.andWhere('(invoice.financialSummary->>\'totalAmount\')::numeric >= :amountMin', { amountMin: filters.amountMin });
    }

    if (filters.amountMax) {
      query.andWhere('(invoice.financialSummary->>\'totalAmount\')::numeric <= :amountMax', { amountMax: filters.amountMax });
    }

    if (filters.isOverdue) {
      query.andWhere('invoice.dueDate < NOW()')
        .andWhere('invoice.status NOT IN (:...paidStatuses)', { 
          paidStatuses: [InvoiceStatus.PAID, InvoiceStatus.CANCELLED, InvoiceStatus.REFUNDED] 
        });
    }

    if (filters.isDisputed) {
      query.andWhere('invoice.disputeInformation IS NOT NULL')
        .andWhere('invoice.disputeInformation->>\'disputeStatus\' IN (:...disputeStatuses)', {
          disputeStatuses: ['open', 'investigating', 'escalated']
        });
    }

    if (filters.isPaid) {
      query.andWhere('invoice.status = :paidStatus', { paidStatus: InvoiceStatus.PAID });
    }

    if (filters.searchText) {
      query.andWhere(`(
        invoice.invoiceNumber ILIKE :searchText
        OR invoice.clientName ILIKE :searchText
        OR invoice.notes ILIKE :searchText
      )`, { searchText: `%${filters.searchText}%` });
    }

    query.orderBy('invoice.issueDate', 'DESC');

    return query.getMany();
  }

  async getInvoicesByType(invoiceType: InvoiceType): Promise<Invoice[]> {
    return this.searchInvoices({ invoiceType });
  }

  async getInvoicesByStatus(status: InvoiceStatus): Promise<Invoice[]> {
    return this.searchInvoices({ status });
  }

  async getInvoicesByClient(clientId: string): Promise<Invoice[]> {
    return this.searchInvoices({ clientId });
  }

  async getOverdueInvoices(): Promise<Invoice[]> {
    return this.searchInvoices({ isOverdue: true });
  }

  async getDisputedInvoices(): Promise<Invoice[]> {
    return this.searchInvoices({ isDisputed: true });
  }

  async getPendingInvoices(): Promise<Invoice[]> {
    return this.invoiceRepository.find({
      where: [
        { status: InvoiceStatus.DRAFT },
        { status: InvoiceStatus.PENDING_APPROVAL },
      ],
      order: { issueDate: 'ASC' },
    });
  }

  async approveInvoice(id: string, approvedBy: string, comments?: string): Promise<Invoice> {
    const invoice = await this.getInvoiceById(id);

    if (invoice.status !== InvoiceStatus.PENDING_APPROVAL) {
      throw new BadRequestException(`Cannot approve invoice ${invoice.invoiceNumber} - status is ${invoice.status}`);
    }

    const updatedInvoice = await this.updateInvoice(id, {
      status: InvoiceStatus.APPROVED,
    });

    this.eventEmitter.emit('invoice.approved', {
      invoiceId: updatedInvoice.id,
      invoiceNumber: updatedInvoice.invoiceNumber,
      approvedBy,
      comments,
    });

    return updatedInvoice;
  }

  async sendInvoice(id: string, sentBy: string): Promise<Invoice> {
    const invoice = await this.getInvoiceById(id);

    if (![InvoiceStatus.APPROVED, InvoiceStatus.DRAFT].includes(invoice.status)) {
      throw new BadRequestException(`Cannot send invoice ${invoice.invoiceNumber} - status is ${invoice.status}`);
    }

    const updatedInvoice = await this.updateInvoice(id, {
      status: InvoiceStatus.SENT,
    });

    this.eventEmitter.emit('invoice.sent', {
      invoiceId: updatedInvoice.id,
      invoiceNumber: updatedInvoice.invoiceNumber,
      clientId: invoice.clientId,
      sentBy,
    });

    return updatedInvoice;
  }

  async recordPayment(
    id: string,
    paymentAmount: number,
    paymentMethod: PaymentMethod,
    transactionReference: string,
    paymentDate?: Date,
    notes?: string
  ): Promise<Invoice> {
    const invoice = await this.getInvoiceById(id);

    if (![InvoiceStatus.SENT, InvoiceStatus.PARTIALLY_PAID, InvoiceStatus.OVERDUE].includes(invoice.status)) {
      throw new BadRequestException(`Cannot record payment for invoice ${invoice.invoiceNumber} - status is ${invoice.status}`);
    }

    const paymentInfo = invoice.paymentInformation || {
      totalPaid: 0,
      remainingBalance: invoice.financialSummary.totalAmount,
      payments: [],
    };

    const newPayment = {
      paymentId: `pay-${Date.now()}`,
      paymentDate: paymentDate || new Date(),
      paymentAmount,
      paymentMethod,
      paymentStatus: PaymentStatus.COMPLETED,
      transactionReference,
      notes,
    };

    paymentInfo.payments.push(newPayment);
    paymentInfo.totalPaid += paymentAmount;
    paymentInfo.remainingBalance = invoice.financialSummary.totalAmount - paymentInfo.totalPaid;
    paymentInfo.lastPaymentDate = newPayment.paymentDate;
    paymentInfo.lastPaymentAmount = paymentAmount;
    paymentInfo.lastPaymentMethod = paymentMethod;

    // Determine new status
    let newStatus: InvoiceStatus;
    if (paymentInfo.remainingBalance <= 0.01) { // Allow for rounding differences
      newStatus = InvoiceStatus.PAID;
    } else {
      newStatus = InvoiceStatus.PARTIALLY_PAID;
    }

    const updatedInvoice = await this.updateInvoice(id, {
      status: newStatus,
      paymentInformation: paymentInfo,
    });

    this.eventEmitter.emit('invoice.payment_recorded', {
      invoiceId: updatedInvoice.id,
      invoiceNumber: updatedInvoice.invoiceNumber,
      paymentAmount,
      paymentMethod,
      transactionReference,
      remainingBalance: paymentInfo.remainingBalance,
    });

    return updatedInvoice;
  }

  async createDispute(
    id: string,
    disputeAmount: number,
    disputeReason: string,
    disputeDescription: string,
    raisedBy: string
  ): Promise<Invoice> {
    const invoice = await this.getInvoiceById(id);

    const disputeInformation = {
      disputeId: `dispute-${Date.now()}`,
      disputeDate: new Date(),
      disputeAmount,
      disputeReason,
      disputeDescription,
      disputeStatus: 'open' as const,
      raisedBy,
      assignedTo: 'billing_team', // TODO: implement assignment logic
      documents: [],
    };

    const updatedInvoice = await this.updateInvoice(id, {
      status: InvoiceStatus.DISPUTED,
      disputeInformation,
    });

    this.eventEmitter.emit('invoice.dispute_created', {
      invoiceId: updatedInvoice.id,
      invoiceNumber: updatedInvoice.invoiceNumber,
      disputeAmount,
      disputeReason,
      raisedBy,
    });

    return updatedInvoice;
  }

  async cancelInvoice(id: string, reason: string, cancelledBy: string): Promise<Invoice> {
    const invoice = await this.getInvoiceById(id);

    if ([InvoiceStatus.PAID, InvoiceStatus.CANCELLED, InvoiceStatus.REFUNDED].includes(invoice.status)) {
      throw new BadRequestException(`Cannot cancel invoice ${invoice.invoiceNumber} - status is ${invoice.status}`);
    }

    const updatedInvoice = await this.updateInvoice(id, {
      status: InvoiceStatus.CANCELLED,
      internalNotes: `${invoice.internalNotes || ''}\nCancelled: ${reason}`,
    });

    this.eventEmitter.emit('invoice.cancelled', {
      invoiceId: updatedInvoice.id,
      invoiceNumber: updatedInvoice.invoiceNumber,
      reason,
      cancelledBy,
    });

    return updatedInvoice;
  }

  async addCommunication(
    id: string,
    communication: {
      communicationType: string;
      direction: string;
      subject: string;
      content: string;
      sentBy: string;
      receivedBy: string;
    }
  ): Promise<Invoice> {
    const invoice = await this.getInvoiceById(id);

    const newCommunication = {
      ...communication,
      timestamp: new Date(),
      status: 'sent' as const,
    };

    const communications = invoice.communications || [];
    communications.push(newCommunication);

    const updatedInvoice = await this.updateInvoice(id, {
      communications,
    });

    this.eventEmitter.emit('invoice.communication_added', {
      invoiceId: updatedInvoice.id,
      invoiceNumber: updatedInvoice.invoiceNumber,
      communication: newCommunication,
    });

    return updatedInvoice;
  }

  private calculateFinancialSummary(
    lineItems: any[],
    taxInformation?: any[],
    discountInformation?: any[]
  ): any {
    let subtotal = 0;
    let totalTax = 0;
    let totalDiscount = 0;

    // Calculate subtotal and item-level taxes/discounts
    lineItems.forEach(item => {
      subtotal += item.totalAmount;
      totalTax += item.taxAmount || 0;
      totalDiscount += item.discountAmount || 0;
    });

    // Add invoice-level taxes
    if (taxInformation) {
      taxInformation.forEach(tax => {
        totalTax += tax.taxAmount;
      });
    }

    // Add invoice-level discounts
    if (discountInformation) {
      discountInformation.forEach(discount => {
        totalDiscount += discount.discountAmount;
      });
    }

    const totalAmount = subtotal - totalDiscount + totalTax;

    return {
      subtotal,
      totalDiscount,
      totalTax,
      totalAmount,
      currency: 'USD', // TODO: support multiple currencies
    };
  }

  private validateStatusTransition(currentStatus: InvoiceStatus, newStatus: InvoiceStatus): void {
    const validTransitions: Record<InvoiceStatus, InvoiceStatus[]> = {
      [InvoiceStatus.DRAFT]: [InvoiceStatus.PENDING_APPROVAL, InvoiceStatus.APPROVED, InvoiceStatus.SENT, InvoiceStatus.CANCELLED],
      [InvoiceStatus.PENDING_APPROVAL]: [InvoiceStatus.APPROVED, InvoiceStatus.DRAFT, InvoiceStatus.CANCELLED],
      [InvoiceStatus.APPROVED]: [InvoiceStatus.SENT, InvoiceStatus.CANCELLED],
      [InvoiceStatus.SENT]: [InvoiceStatus.PAID, InvoiceStatus.PARTIALLY_PAID, InvoiceStatus.OVERDUE, InvoiceStatus.DISPUTED, InvoiceStatus.CANCELLED],
      [InvoiceStatus.PARTIALLY_PAID]: [InvoiceStatus.PAID, InvoiceStatus.OVERDUE, InvoiceStatus.DISPUTED, InvoiceStatus.CANCELLED],
      [InvoiceStatus.OVERDUE]: [InvoiceStatus.PAID, InvoiceStatus.PARTIALLY_PAID, InvoiceStatus.DISPUTED, InvoiceStatus.CANCELLED],
      [InvoiceStatus.DISPUTED]: [InvoiceStatus.SENT, InvoiceStatus.PAID, InvoiceStatus.PARTIALLY_PAID, InvoiceStatus.CANCELLED],
      [InvoiceStatus.PAID]: [InvoiceStatus.REFUNDED],
      [InvoiceStatus.CANCELLED]: [],
      [InvoiceStatus.REFUNDED]: [],
    };

    if (!validTransitions[currentStatus]?.includes(newStatus)) {
      throw new BadRequestException(
        `Invalid status transition from ${currentStatus} to ${newStatus}`
      );
    }
  }

  private async generateInvoiceNumber(invoiceType: InvoiceType): Promise<string> {
    const typePrefix = {
      [InvoiceType.GATE_SERVICES]: 'INV-GT',
      [InvoiceType.STORAGE]: 'INV-ST',
      [InvoiceType.HANDLING]: 'INV-HD',
      [InvoiceType.REPAIR]: 'INV-RP',
      [InvoiceType.ADDITIONAL_SERVICES]: 'INV-AS',
      [InvoiceType.DEMURRAGE]: 'INV-DM',
      [InvoiceType.DETENTION]: 'INV-DT',
      [InvoiceType.MONTHLY_RECURRING]: 'INV-MR',
      [InvoiceType.ONE_TIME]: 'INV-OT',
    };

    const prefix = typePrefix[invoiceType] || 'INV';
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');
    
    // Find the next sequence number for this type, year, and month
    const lastInvoice = await this.invoiceRepository
      .createQueryBuilder('invoice')
      .where('invoice.invoiceNumber LIKE :pattern', { 
        pattern: `${prefix}-${year}${month}-%` 
      })
      .orderBy('invoice.invoiceNumber', 'DESC')
      .getOne();

    let sequence = 1;
    if (lastInvoice) {
      const lastNumber = lastInvoice.invoiceNumber.split('-')[2];
      sequence = parseInt(lastNumber.substring(4)) + 1;
    }

    return `${prefix}-${year}${month}-${sequence.toString().padStart(4, '0')}`;
  }

  async getInvoiceStatistics(filters?: {
    period?: number;
    clientId?: string;
    invoiceType?: InvoiceType;
  }) {
    const whereClause = [];
    const params = [];

    if (filters?.period) {
      whereClause.push('issue_date >= NOW() - INTERVAL \\'' + filters.period + ' days\\'');
    }

    if (filters?.clientId) {
      whereClause.push('client_id = $' + (params.length + 1));
      params.push(filters.clientId);
    }

    if (filters?.invoiceType) {
      whereClause.push('invoice_type = $' + (params.length + 1));
      params.push(filters.invoiceType);
    }

    const whereSQL = whereClause.length > 0 ? 'WHERE ' + whereClause.join(' AND ') : '';

    const [
      totalInvoices,
      invoicesByStatus,
      invoicesByType,
      totalAmount,
      paidAmount,
      overdueAmount,
    ] = await Promise.all([
      this.invoiceRepository.query(`
        SELECT COUNT(*) as count
        FROM billing.invoices
        ${whereSQL}
      `, params),
      this.invoiceRepository.query(`
        SELECT status, COUNT(*) as count, SUM((financial_summary->>'totalAmount')::numeric) as amount
        FROM billing.invoices
        ${whereSQL}
        GROUP BY status
        ORDER BY count DESC
      `, params),
      this.invoiceRepository.query(`
        SELECT invoice_type, COUNT(*) as count, SUM((financial_summary->>'totalAmount')::numeric) as amount
        FROM billing.invoices
        ${whereSQL}
        GROUP BY invoice_type
        ORDER BY count DESC
      `, params),
      this.invoiceRepository.query(`
        SELECT SUM((financial_summary->>'totalAmount')::numeric) as total_amount
        FROM billing.invoices
        ${whereSQL}
      `, params),
      this.invoiceRepository.query(`
        SELECT SUM((payment_information->>'totalPaid')::numeric) as paid_amount
        FROM billing.invoices
        ${whereSQL ? whereSQL + ' AND' : 'WHERE'} payment_information IS NOT NULL
      `, params),
      this.invoiceRepository.query(`
        SELECT SUM((financial_summary->>'totalAmount')::numeric) as overdue_amount
        FROM billing.invoices
        ${whereSQL ? whereSQL + ' AND' : 'WHERE'} due_date < NOW() 
        AND status NOT IN ('paid', 'cancelled', 'refunded')
      `, params),
    ]);

    return {
      totals: {
        totalInvoices: parseInt(totalInvoices[0].count),
        totalAmount: parseFloat(totalAmount[0].total_amount || 0),
        paidAmount: parseFloat(paidAmount[0].paid_amount || 0),
        overdueAmount: parseFloat(overdueAmount[0].overdue_amount || 0),
        collectionRate: totalAmount[0].total_amount ? 
          (parseFloat(paidAmount[0].paid_amount || 0) / parseFloat(totalAmount[0].total_amount)) * 100 : 0,
      },
      breakdown: {
        byStatus: invoicesByStatus,
        byType: invoicesByType,
      },
    };
  }
}