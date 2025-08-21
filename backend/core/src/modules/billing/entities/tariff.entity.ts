import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

export enum TariffType {
  GATE_IN = 'gate_in',
  GATE_OUT = 'gate_out',
  STORAGE = 'storage',
  HANDLING = 'handling',
  LIFT_ON_LIFT_OFF = 'lift_on_lift_off',
  WEIGHING = 'weighing',
  INSPECTION = 'inspection',
  REPAIR = 'repair',
  CLEANING = 'cleaning',
  FUMIGATION = 'fumigation',
  REEFER_MONITORING = 'reefer_monitoring',
  DEMURRAGE = 'demurrage',
  DETENTION = 'detention',
  DOCUMENTATION = 'documentation',
  SPECIAL_HANDLING = 'special_handling',
}

export enum TariffStatus {
  DRAFT = 'draft',
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  EXPIRED = 'expired',
  SUPERSEDED = 'superseded',
}

export enum PricingModel {
  FIXED = 'fixed',
  VARIABLE = 'variable',
  TIERED = 'tiered',
  VOLUME_BASED = 'volume_based',
  TIME_BASED = 'time_based',
  WEIGHT_BASED = 'weight_based',
  DISTANCE_BASED = 'distance_based',
}

export enum UnitOfMeasure {
  CONTAINER = 'container',
  TEU = 'teu',
  TON = 'ton',
  HOUR = 'hour',
  DAY = 'day',
  WEEK = 'week',
  MONTH = 'month',
  MOVE = 'move',
  DOCUMENT = 'document',
  INSPECTION = 'inspection',
  KILOMETER = 'kilometer',
}

@Entity('tariffs', { schema: 'billing' })
@Index(['tariffType'])
@Index(['status'])
@Index(['clientId'])
@Index(['effectiveDate'])
@Index(['expiryDate'])
@Index(['tariffCode'], { unique: true })
export class Tariff {
  @ApiProperty({ description: 'Уникальный идентификатор тарифа' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ description: 'Код тарифа', example: 'TR-GATE-001' })
  @Column({ name: 'tariff_code', type: 'varchar', length: 50, unique: true })
  tariffCode: string;

  @ApiProperty({ description: 'Название тарифа' })
  @Column({ name: 'tariff_name' })
  tariffName: string;

  @ApiProperty({ description: 'Описание тарифа' })
  @Column({ type: 'text' })
  description: string;

  @ApiProperty({ description: 'Тип тарифа', enum: TariffType })
  @Column({
    name: 'tariff_type',
    type: 'enum',
    enum: TariffType,
  })
  tariffType: TariffType;

  @ApiProperty({ description: 'Статус тарифа', enum: TariffStatus })
  @Column({
    type: 'enum',
    enum: TariffStatus,
    default: TariffStatus.DRAFT,
  })
  status: TariffStatus;

  @ApiProperty({ description: 'Модель ценообразования', enum: PricingModel })
  @Column({
    name: 'pricing_model',
    type: 'enum',
    enum: PricingModel,
  })
  pricingModel: PricingModel;

  @ApiProperty({ description: 'ID клиента (null для общих тарифов)' })
  @Column({ name: 'client_id', nullable: true })
  clientId: string;

  @ApiProperty({ description: 'Название клиента' })
  @Column({ name: 'client_name', nullable: true })
  clientName: string;

  @ApiProperty({ description: 'Дата вступления в силу' })
  @Column({ name: 'effective_date', type: 'date' })
  effectiveDate: Date;

  @ApiProperty({ description: 'Дата истечения' })
  @Column({ name: 'expiry_date', type: 'date', nullable: true })
  expiryDate: Date;

  @ApiProperty({ description: 'Базовая цена' })
  @Column({ name: 'base_price', type: 'decimal', precision: 10, scale: 2 })
  basePrice: number;

  @ApiProperty({ description: 'Валюта' })
  @Column({ type: 'varchar', length: 3, default: 'USD' })
  currency: string;

  @ApiProperty({ description: 'Единица измерения', enum: UnitOfMeasure })
  @Column({
    name: 'unit_of_measure',
    type: 'enum',
    enum: UnitOfMeasure,
  })
  unitOfMeasure: UnitOfMeasure;

  @ApiProperty({ description: 'Минимальная плата' })
  @Column({ name: 'minimum_charge', type: 'decimal', precision: 10, scale: 2, nullable: true })
  minimumCharge: number;

  @ApiProperty({ description: 'Максимальная плата' })
  @Column({ name: 'maximum_charge', type: 'decimal', precision: 10, scale: 2, nullable: true })
  maximumCharge: number;

  @ApiProperty({ description: 'Структура ценообразования' })
  @Column({ name: 'pricing_structure', type: 'jsonb' })
  pricingStructure: {
    tiers?: Array<{
      tierName: string;
      minQuantity: number;
      maxQuantity?: number;
      pricePerUnit: number;
      flatFee?: number;
    }>;
    timeSlots?: Array<{
      slotName: string;
      startTime: string;
      endTime: string;
      days: string[];
      priceMultiplier: number;
    }>;
    volumeDiscounts?: Array<{
      discountName: string;
      minVolume: number;
      maxVolume?: number;
      discountType: 'percentage' | 'fixed_amount';
      discountValue: number;
    }>;
    seasonalRates?: Array<{
      seasonName: string;
      startDate: string; // MM-DD format
      endDate: string; // MM-DD format
      priceMultiplier: number;
    }>;
    additionalCharges?: Array<{
      chargeName: string;
      chargeType: 'fixed' | 'percentage';
      chargeValue: number;
      applicableConditions: string[];
      mandatory: boolean;
    }>;
  };

  @ApiProperty({ description: 'Применимые условия' })
  @Column({ name: 'applicable_conditions', type: 'jsonb', nullable: true })
  applicableConditions: {
    containerTypes?: string[];
    containerSizes?: string[];
    cargoTypes?: string[];
    serviceHours?: {
      weekdays: { start: string; end: string };
      weekends?: { start: string; end: string };
      holidays: boolean;
    };
    weightLimits?: {
      minWeight?: number;
      maxWeight?: number;
      weightUnit: 'kg' | 'ton';
    };
    locationRestrictions?: {
      allowedAreas?: string[];
      restrictedAreas?: string[];
    };
    clientRequirements?: {
      minimumVolume?: number;
      contractType?: string;
      paymentTerms?: string[];
    };
    specialConditions?: string[];
  };

  @ApiProperty({ description: 'Политика скидок' })
  @Column({ name: 'discount_policy', type: 'jsonb', nullable: true })
  discountPolicy: {
    volumeDiscounts: Array<{
      discountId: string;
      discountName: string;
      thresholdQuantity: number;
      thresholdPeriod: 'daily' | 'weekly' | 'monthly' | 'yearly';
      discountType: 'percentage' | 'fixed_amount';
      discountValue: number;
      maxDiscountAmount?: number;
      stackable: boolean;
    }>;
    loyaltyDiscounts: Array<{
      discountId: string;
      discountName: string;
      clientTenure: number; // months
      discountType: 'percentage' | 'fixed_amount';
      discountValue: number;
      applicableServices: string[];
    }>;
    promotionalDiscounts: Array<{
      discountId: string;
      discountName: string;
      startDate: Date;
      endDate: Date;
      discountType: 'percentage' | 'fixed_amount';
      discountValue: number;
      applicableConditions: string[];
      usageLimit?: number;
      usedCount?: number;
    }>;
  };

  @ApiProperty({ description: 'Налоговая информация' })
  @Column({ name: 'tax_information', type: 'jsonb', nullable: true })
  taxInformation: {
    taxable: boolean;
    taxRate?: number;
    taxType?: string;
    taxJurisdiction?: string;
    taxExemptions?: Array<{
      exemptionType: string;
      exemptionReason: string;
      exemptionCode: string;
      validFrom: Date;
      validTo?: Date;
    }>;
  };

  @ApiProperty({ description: 'История версий' })
  @Column({ name: 'version_history', type: 'jsonb', nullable: true })
  versionHistory: Array<{
    version: string;
    changeDate: Date;
    changedBy: string;
    changeReason: string;
    changes: Array<{
      field: string;
      oldValue: any;
      newValue: any;
    }>;
    approvedBy?: string;
    approvalDate?: Date;
  }>;

  @ApiProperty({ description: 'Процесс утверждения' })
  @Column({ name: 'approval_workflow', type: 'jsonb', nullable: true })
  approvalWorkflow: {
    requiredApprovals: Array<{
      approverRole: string;
      approverName?: string;
      approverId?: string;
      required: boolean;
    }>;
    approvalHistory: Array<{
      approverName: string;
      approverId: string;
      action: 'approved' | 'rejected' | 'requested_changes';
      timestamp: Date;
      comments?: string;
    }>;
    currentApprovalLevel: number;
    finalApproval: boolean;
  };

  @ApiProperty({ description: 'Связанные документы' })
  @Column({ name: 'related_documents', type: 'jsonb', nullable: true })
  relatedDocuments: Array<{
    documentType: 'contract' | 'agreement' | 'rate_sheet' | 'approval' | 'amendment';
    documentName: string;
    documentUrl: string;
    documentDate: Date;
    version: string;
    uploadedBy: string;
    uploadedAt: Date;
  }>;

  @ApiProperty({ description: 'Примечания' })
  @Column({ type: 'text', nullable: true })
  notes: string;

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
  get isActive(): boolean {
    const now = new Date();
    return this.status === TariffStatus.ACTIVE &&
           this.effectiveDate <= now &&
           (!this.expiryDate || this.expiryDate >= now);
  }

  get isExpired(): boolean {
    return this.expiryDate && new Date() > this.expiryDate;
  }

  get daysUntilExpiry(): number {
    if (!this.expiryDate) return -1;
    const now = new Date();
    const diffTime = this.expiryDate.getTime() - now.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  get isClientSpecific(): boolean {
    return !!this.clientId;
  }

  get hasVolumeDiscounts(): boolean {
    return this.pricingStructure?.volumeDiscounts?.length > 0 ||
           this.discountPolicy?.volumeDiscounts?.length > 0;
  }

  get hasTieredPricing(): boolean {
    return this.pricingModel === PricingModel.TIERED &&
           this.pricingStructure?.tiers?.length > 0;
  }

  get hasTimeBasedPricing(): boolean {
    return this.pricingModel === PricingModel.TIME_BASED ||
           this.pricingStructure?.timeSlots?.length > 0;
  }

  get requiresApproval(): boolean {
    return !this.approvalWorkflow?.finalApproval && 
           this.status === TariffStatus.DRAFT;
  }

  get effectivePriceRange(): { min: number; max: number } {
    let min = this.basePrice;
    let max = this.basePrice;

    if (this.pricingStructure?.tiers) {
      const prices = this.pricingStructure.tiers.map(tier => tier.pricePerUnit);
      min = Math.min(min, ...prices);
      max = Math.max(max, ...prices);
    }

    if (this.minimumCharge && min < this.minimumCharge) {
      min = this.minimumCharge;
    }

    if (this.maximumCharge && max > this.maximumCharge) {
      max = this.maximumCharge;
    }

    return { min, max };
  }
}