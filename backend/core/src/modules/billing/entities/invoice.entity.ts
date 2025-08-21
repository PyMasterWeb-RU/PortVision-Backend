import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

export enum InvoiceType {
  GATE_SERVICES = 'gate_services',
  STORAGE = 'storage',
  HANDLING = 'handling',
  REPAIR = 'repair',
  ADDITIONAL_SERVICES = 'additional_services',
  DEMURRAGE = 'demurrage',
  DETENTION = 'detention',
  MONTHLY_RECURRING = 'monthly_recurring',
  ONE_TIME = 'one_time',
}

export enum InvoiceStatus {
  DRAFT = 'draft',
  PENDING_APPROVAL = 'pending_approval',
  APPROVED = 'approved',
  SENT = 'sent',
  PAID = 'paid',
  PARTIALLY_PAID = 'partially_paid',
  OVERDUE = 'overdue',
  DISPUTED = 'disputed',
  CANCELLED = 'cancelled',
  REFUNDED = 'refunded',
}

export enum PaymentStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  REFUNDED = 'refunded',
  DISPUTED = 'disputed',
}

export enum PaymentMethod {
  BANK_TRANSFER = 'bank_transfer',
  CREDIT_CARD = 'credit_card',
  CHECK = 'check',
  CASH = 'cash',
  ELECTRONIC_PAYMENT = 'electronic_payment',
  LETTER_OF_CREDIT = 'letter_of_credit',
  OFFSET = 'offset',
}

@Entity('invoices', { schema: 'billing' })
@Index(['invoiceType'])
@Index(['status'])
@Index(['clientId'])
@Index(['issueDate'])
@Index(['dueDate'])
@Index(['invoiceNumber'], { unique: true })
export class Invoice {
  @ApiProperty({ description: 'Уникальный идентификатор счета' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ description: 'Номер счета', example: 'INV-2024-001234' })
  @Column({ name: 'invoice_number', type: 'varchar', length: 50, unique: true })
  invoiceNumber: string;

  @ApiProperty({ description: 'Тип счета', enum: InvoiceType })
  @Column({
    name: 'invoice_type',
    type: 'enum',
    enum: InvoiceType,
  })
  invoiceType: InvoiceType;

  @ApiProperty({ description: 'Статус счета', enum: InvoiceStatus })
  @Column({
    type: 'enum',
    enum: InvoiceStatus,
    default: InvoiceStatus.DRAFT,
  })
  status: InvoiceStatus;

  @ApiProperty({ description: 'ID клиента' })
  @Column({ name: 'client_id' })
  clientId: string;

  @ApiProperty({ description: 'Название клиента' })
  @Column({ name: 'client_name' })
  clientName: string;

  @ApiProperty({ description: 'Информация о клиенте' })
  @Column({ name: 'client_information', type: 'jsonb' })
  clientInformation: {
    companyName: string;
    registrationNumber: string;
    taxId: string;
    address: {
      street: string;
      city: string;
      state: string;
      postalCode: string;
      country: string;
    };
    contact: {
      name: string;
      email: string;
      phone: string;
    };
    billingContact: {
      name: string;
      email: string;
      phone: string;
      department?: string;
    };
  };

  @ApiProperty({ description: 'Дата выставления счета' })
  @Column({ name: 'issue_date', type: 'date' })
  issueDate: Date;

  @ApiProperty({ description: 'Дата оплаты' })
  @Column({ name: 'due_date', type: 'date' })
  dueDate: Date;

  @ApiProperty({ description: 'Период услуг' })
  @Column({ name: 'service_period', type: 'jsonb', nullable: true })
  servicePeriod: {
    startDate: Date;
    endDate: Date;
    description: string;
  };

  @ApiProperty({ description: 'Позиции счета' })
  @Column({ name: 'line_items', type: 'jsonb' })
  lineItems: Array<{
    itemId: string;
    serviceType: string;
    description: string;
    quantity: number;
    unitOfMeasure: string;
    unitPrice: number;
    totalAmount: number;
    taxRate: number;
    taxAmount: number;
    discountRate?: number;
    discountAmount?: number;
    period?: {
      startDate: Date;
      endDate: Date;
    };
    relatedEntityType?: string; // order, container, equipment, etc.
    relatedEntityId?: string;
    relatedEntityNumber?: string;
    tariffCode?: string;
    notes?: string;
  }>;

  @ApiProperty({ description: 'Финансовые итоги' })
  @Column({ name: 'financial_summary', type: 'jsonb' })
  financialSummary: {
    subtotal: number;
    totalDiscount: number;
    totalTax: number;
    totalAmount: number;
    currency: string;
    exchangeRate?: number;
    baseCurrency?: string;
    baseAmount?: number;
  };

  @ApiProperty({ description: 'Информация о налогах' })
  @Column({ name: 'tax_information', type: 'jsonb', nullable: true })
  taxInformation: Array<{
    taxType: string;
    taxRate: number;
    taxableAmount: number;
    taxAmount: number;
    jurisdiction: string;
    exemptionReason?: string;
  }>;

  @ApiProperty({ description: 'Информация о скидках' })
  @Column({ name: 'discount_information', type: 'jsonb', nullable: true })
  discountInformation: Array<{
    discountType: 'percentage' | 'fixed_amount' | 'volume' | 'loyalty';
    discountName: string;
    discountRate?: number;
    discountAmount: number;
    applicableItems: string[];
    reason: string;
    approvedBy: string;
    approvalDate: Date;
  }>;

  @ApiProperty({ description: 'Условия оплаты' })
  @Column({ name: 'payment_terms', type: 'jsonb' })
  paymentTerms: {
    termsDescription: string;
    paymentDueDays: number;
    earlyPaymentDiscount?: {
      discountRate: number;
      discountDays: number;
    };
    latePaymentPenalty?: {
      penaltyRate: number;
      gracePeriodDays: number;
    };
    installmentAllowed: boolean;
    installmentTerms?: {
      numberOfInstallments: number;
      installmentFrequency: 'weekly' | 'monthly' | 'quarterly';
      installmentAmount: number;
    };
  };

  @ApiProperty({ description: 'Информация об оплате' })
  @Column({ name: 'payment_information', type: 'jsonb', nullable: true })
  paymentInformation: {
    totalPaid: number;
    remainingBalance: number;
    lastPaymentDate?: Date;
    lastPaymentAmount?: number;
    lastPaymentMethod?: PaymentMethod;
    payments: Array<{
      paymentId: string;
      paymentDate: Date;
      paymentAmount: number;
      paymentMethod: PaymentMethod;
      paymentStatus: PaymentStatus;
      transactionReference: string;
      bankReference?: string;
      notes?: string;
    }>;
  };

  @ApiProperty({ description: 'Связанные документы' })
  @Column({ name: 'related_documents', type: 'jsonb', nullable: true })
  relatedDocuments: Array<{
    documentType: 'purchase_order' | 'delivery_receipt' | 'work_order' | 'contract' | 'credit_note' | 'debit_note';
    documentNumber: string;
    documentDate: Date;
    documentUrl?: string;
    amount?: number;
    status: string;
  }>;

  @ApiProperty({ description: 'История статусов' })
  @Column({ name: 'status_history', type: 'jsonb', nullable: true })
  statusHistory: Array<{
    status: InvoiceStatus;
    changedBy: string;
    changedAt: Date;
    reason: string;
    comments?: string;
  }>;

  @ApiProperty({ description: 'Коммуникации' })
  @Column({ name: 'communications', type: 'jsonb', nullable: true })
  communications: Array<{
    communicationType: 'email' | 'phone' | 'letter' | 'portal' | 'fax';
    direction: 'inbound' | 'outbound';
    subject: string;
    content: string;
    sentBy: string;
    receivedBy: string;
    timestamp: Date;
    attachments?: string[];
    status: 'sent' | 'delivered' | 'read' | 'replied';
  }>;

  @ApiProperty({ description: 'Информация о спорах' })
  @Column({ name: 'dispute_information', type: 'jsonb', nullable: true })
  disputeInformation: {
    disputeId: string;
    disputeDate: Date;
    disputeAmount: number;
    disputeReason: string;
    disputeDescription: string;
    disputeStatus: 'open' | 'investigating' | 'resolved' | 'escalated';
    raisedBy: string;
    assignedTo: string;
    resolution?: {
      resolutionDate: Date;
      resolutionType: 'accepted' | 'rejected' | 'partially_accepted' | 'credit_issued';
      resolutionAmount?: number;
      resolutionNotes: string;
      resolvedBy: string;
    };
    documents: Array<{
      documentType: string;
      documentUrl: string;
      uploadedBy: string;
      uploadedAt: Date;
    }>;
  };

  @ApiProperty({ description: 'Информация о возврате' })
  @Column({ name: 'refund_information', type: 'jsonb', nullable: true })
  refundInformation: {
    refundId: string;
    refundDate: Date;
    refundAmount: number;
    refundReason: string;
    refundMethod: PaymentMethod;
    refundStatus: 'pending' | 'processed' | 'completed' | 'failed';
    requestedBy: string;
    approvedBy: string;
    processedBy: string;
    transactionReference: string;
    notes?: string;
  };

  @ApiProperty({ description: 'Банковские реквизиты для оплаты' })
  @Column({ name: 'payment_details', type: 'jsonb', nullable: true })
  paymentDetails: {
    bankName: string;
    accountName: string;
    accountNumber: string;
    routingNumber: string;
    swiftCode?: string;
    iban?: string;
    currency: string;
    paymentInstructions?: string;
    paymentReference: string;
  };

  @ApiProperty({ description: 'Примечания' })
  @Column({ type: 'text', nullable: true })
  notes: string;

  @ApiProperty({ description: 'Внутренние примечания' })
  @Column({ name: 'internal_notes', type: 'text', nullable: true })
  internalNotes: string;

  @ApiProperty({ description: 'Дополнительные метаданные' })
  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @ApiProperty({ description: 'Дата создания' })
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ApiProperty({ description: 'Дата обновления' })
  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Вычисляемые поля
  get isOverdue(): boolean {
    if (this.status === InvoiceStatus.PAID || !this.dueDate) return false;
    return new Date() > this.dueDate;
  }

  get daysPastDue(): number {
    if (!this.isOverdue) return 0;
    const today = new Date();
    const diffTime = today.getTime() - this.dueDate.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  get remainingBalance(): number {
    const totalPaid = this.paymentInformation?.totalPaid || 0;
    return this.financialSummary.totalAmount - totalPaid;
  }

  get paymentProgress(): number {
    const totalPaid = this.paymentInformation?.totalPaid || 0;
    return (totalPaid / this.financialSummary.totalAmount) * 100;
  }

  get isFullyPaid(): boolean {
    return this.remainingBalance <= 0.01; // Allow for rounding differences
  }

  get isPartiallyPaid(): boolean {
    const totalPaid = this.paymentInformation?.totalPaid || 0;
    return totalPaid > 0 && !this.isFullyPaid;
  }

  get effectiveTaxRate(): number {
    if (this.financialSummary.subtotal === 0) return 0;
    return (this.financialSummary.totalTax / this.financialSummary.subtotal) * 100;
  }

  get effectiveDiscountRate(): number {
    if (this.financialSummary.subtotal === 0) return 0;
    return (this.financialSummary.totalDiscount / (this.financialSummary.subtotal + this.financialSummary.totalDiscount)) * 100;
  }

  get hasDispute(): boolean {
    return this.disputeInformation?.disputeStatus === 'open' || 
           this.disputeInformation?.disputeStatus === 'investigating' ||
           this.disputeInformation?.disputeStatus === 'escalated';
  }

  get agingCategory(): 'current' | '1-30' | '31-60' | '61-90' | '90+' {
    const days = this.daysPastDue;
    if (days <= 0) return 'current';
    if (days <= 30) return '1-30';
    if (days <= 60) return '31-60';
    if (days <= 90) return '61-90';
    return '90+';
  }
}