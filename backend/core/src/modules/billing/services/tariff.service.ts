import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { 
  Tariff, 
  TariffType, 
  TariffStatus, 
  PricingModel,
  UnitOfMeasure 
} from '../entities/tariff.entity';

export interface CreateTariffDto {
  tariffName: string;
  description: string;
  tariffType: TariffType;
  pricingModel: PricingModel;
  clientId?: string;
  clientName?: string;
  effectiveDate: Date;
  expiryDate?: Date;
  basePrice: number;
  currency?: string;
  unitOfMeasure: UnitOfMeasure;
  minimumCharge?: number;
  maximumCharge?: number;
  pricingStructure: any;
  applicableConditions?: any;
  discountPolicy?: any;
  taxInformation?: any;
  notes?: string;
  metadata?: Record<string, any>;
}

export interface UpdateTariffDto {
  tariffName?: string;
  description?: string;
  tariffType?: TariffType;
  status?: TariffStatus;
  pricingModel?: PricingModel;
  clientId?: string;
  clientName?: string;
  effectiveDate?: Date;
  expiryDate?: Date;
  basePrice?: number;
  currency?: string;
  unitOfMeasure?: UnitOfMeasure;
  minimumCharge?: number;
  maximumCharge?: number;
  pricingStructure?: any;
  applicableConditions?: any;
  discountPolicy?: any;
  taxInformation?: any;
  approvalWorkflow?: any;
  relatedDocuments?: any[];
  notes?: string;
  metadata?: Record<string, any>;
}

export interface TariffSearchFilters {
  tariffType?: TariffType;
  status?: TariffStatus;
  pricingModel?: PricingModel;
  clientId?: string;
  effectiveDateAfter?: Date;
  effectiveDateBefore?: Date;
  expiryDateAfter?: Date;
  expiryDateBefore?: Date;
  basePriceMin?: number;
  basePriceMax?: number;
  currency?: string;
  unitOfMeasure?: UnitOfMeasure;
  isActive?: boolean;
  isExpiring?: boolean;
  searchText?: string;
}

@Injectable()
export class TariffService {
  private readonly logger = new Logger(TariffService.name);

  constructor(
    @InjectRepository(Tariff)
    private readonly tariffRepository: Repository<Tariff>,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async createTariff(createTariffDto: CreateTariffDto): Promise<Tariff> {
    this.logger.log(`Creating tariff: ${createTariffDto.tariffName}`);

    // Generate tariff code
    const tariffCode = await this.generateTariffCode(createTariffDto.tariffType);

    // Validate effective date
    if (createTariffDto.expiryDate && createTariffDto.expiryDate <= createTariffDto.effectiveDate) {
      throw new BadRequestException('Expiry date must be after effective date');
    }

    const tariff = this.tariffRepository.create({
      ...createTariffDto,
      tariffCode,
      status: TariffStatus.DRAFT,
      currency: createTariffDto.currency || 'USD',
    });

    const savedTariff = await this.tariffRepository.save(tariff);

    this.eventEmitter.emit('tariff.created', {
      tariffId: savedTariff.id,
      tariffCode: savedTariff.tariffCode,
      tariffName: savedTariff.tariffName,
      tariffType: savedTariff.tariffType,
      clientId: savedTariff.clientId,
    });

    this.logger.log(`Tariff created: ${savedTariff.tariffCode}`);
    return savedTariff;
  }

  async getAllTariffs(): Promise<Tariff[]> {
    return this.tariffRepository.find({
      order: { createdAt: 'DESC' },
    });
  }

  async getTariffById(id: string): Promise<Tariff> {
    const tariff = await this.tariffRepository.findOne({
      where: { id },
    });

    if (!tariff) {
      throw new NotFoundException(`Tariff with ID ${id} not found`);
    }

    return tariff;
  }

  async getTariffByCode(tariffCode: string): Promise<Tariff> {
    const tariff = await this.tariffRepository.findOne({
      where: { tariffCode },
    });

    if (!tariff) {
      throw new NotFoundException(`Tariff with code ${tariffCode} not found`);
    }

    return tariff;
  }

  async updateTariff(id: string, updateTariffDto: UpdateTariffDto): Promise<Tariff> {
    const tariff = await this.getTariffById(id);

    // Validate status transitions
    if (updateTariffDto.status) {
      this.validateStatusTransition(tariff.status, updateTariffDto.status);
    }

    // Validate dates
    if (updateTariffDto.effectiveDate || updateTariffDto.expiryDate) {
      const effectiveDate = updateTariffDto.effectiveDate || tariff.effectiveDate;
      const expiryDate = updateTariffDto.expiryDate || tariff.expiryDate;
      
      if (expiryDate && expiryDate <= effectiveDate) {
        throw new BadRequestException('Expiry date must be after effective date');
      }
    }

    // Add version history entry if significant changes
    if (this.isSignificantChange(updateTariffDto)) {
      const versionHistory = tariff.versionHistory || [];
      versionHistory.push({
        version: `v${versionHistory.length + 1}`,
        changeDate: new Date(),
        changedBy: 'system', // TODO: get from current user context
        changeReason: 'Manual update via API',
        changes: this.getChanges(tariff, updateTariffDto),
      });
      updateTariffDto.versionHistory = versionHistory;
    }

    Object.assign(tariff, updateTariffDto);
    const updatedTariff = await this.tariffRepository.save(tariff);

    this.eventEmitter.emit('tariff.updated', {
      tariffId: updatedTariff.id,
      tariffCode: updatedTariff.tariffCode,
      changes: updateTariffDto,
    });

    this.logger.log(`Tariff updated: ${updatedTariff.tariffCode}`);
    return updatedTariff;
  }

  async deleteTariff(id: string): Promise<void> {
    const tariff = await this.getTariffById(id);

    if (tariff.status === TariffStatus.ACTIVE) {
      throw new BadRequestException(`Cannot delete active tariff ${tariff.tariffCode}`);
    }

    await this.tariffRepository.remove(tariff);

    this.eventEmitter.emit('tariff.deleted', {
      tariffId: tariff.id,
      tariffCode: tariff.tariffCode,
    });

    this.logger.log(`Tariff deleted: ${tariff.tariffCode}`);
  }

  async searchTariffs(filters: TariffSearchFilters): Promise<Tariff[]> {
    const query = this.tariffRepository.createQueryBuilder('tariff');

    if (filters.tariffType) {
      query.andWhere('tariff.tariffType = :tariffType', { tariffType: filters.tariffType });
    }

    if (filters.status) {
      query.andWhere('tariff.status = :status', { status: filters.status });
    }

    if (filters.pricingModel) {
      query.andWhere('tariff.pricingModel = :pricingModel', { pricingModel: filters.pricingModel });
    }

    if (filters.clientId) {
      query.andWhere('tariff.clientId = :clientId', { clientId: filters.clientId });
    }

    if (filters.effectiveDateAfter) {
      query.andWhere('tariff.effectiveDate >= :effectiveDateAfter', { effectiveDateAfter: filters.effectiveDateAfter });
    }

    if (filters.effectiveDateBefore) {
      query.andWhere('tariff.effectiveDate <= :effectiveDateBefore', { effectiveDateBefore: filters.effectiveDateBefore });
    }

    if (filters.expiryDateAfter) {
      query.andWhere('tariff.expiryDate >= :expiryDateAfter', { expiryDateAfter: filters.expiryDateAfter });
    }

    if (filters.expiryDateBefore) {
      query.andWhere('tariff.expiryDate <= :expiryDateBefore', { expiryDateBefore: filters.expiryDateBefore });
    }

    if (filters.basePriceMin) {
      query.andWhere('tariff.basePrice >= :basePriceMin', { basePriceMin: filters.basePriceMin });
    }

    if (filters.basePriceMax) {
      query.andWhere('tariff.basePrice <= :basePriceMax', { basePriceMax: filters.basePriceMax });
    }

    if (filters.currency) {
      query.andWhere('tariff.currency = :currency', { currency: filters.currency });
    }

    if (filters.unitOfMeasure) {
      query.andWhere('tariff.unitOfMeasure = :unitOfMeasure', { unitOfMeasure: filters.unitOfMeasure });
    }

    if (filters.isActive) {
      query.andWhere('tariff.status = :activeStatus', { activeStatus: TariffStatus.ACTIVE })
        .andWhere('tariff.effectiveDate <= NOW()')
        .andWhere('(tariff.expiryDate IS NULL OR tariff.expiryDate >= NOW())');
    }

    if (filters.isExpiring) {
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
      
      query.andWhere('tariff.status = :activeStatus', { activeStatus: TariffStatus.ACTIVE })
        .andWhere('tariff.expiryDate <= :expiringDate', { expiringDate: thirtyDaysFromNow })
        .andWhere('tariff.expiryDate >= NOW()');
    }

    if (filters.searchText) {
      query.andWhere(`(
        tariff.tariffCode ILIKE :searchText
        OR tariff.tariffName ILIKE :searchText
        OR tariff.description ILIKE :searchText
        OR tariff.clientName ILIKE :searchText
      )`, { searchText: `%${filters.searchText}%` });
    }

    query.orderBy('tariff.effectiveDate', 'DESC');

    return query.getMany();
  }

  async getTariffsByType(tariffType: TariffType): Promise<Tariff[]> {
    return this.searchTariffs({ tariffType });
  }

  async getTariffsByStatus(status: TariffStatus): Promise<Tariff[]> {
    return this.searchTariffs({ status });
  }

  async getTariffsByClient(clientId: string): Promise<Tariff[]> {
    return this.searchTariffs({ clientId });
  }

  async getActiveTariffs(): Promise<Tariff[]> {
    return this.searchTariffs({ isActive: true });
  }

  async getExpiringTariffs(daysAhead: number = 30): Promise<Tariff[]> {
    return this.searchTariffs({ isExpiring: true });
  }

  async getGeneralTariffs(): Promise<Tariff[]> {
    return this.tariffRepository.find({
      where: { clientId: null, status: TariffStatus.ACTIVE },
      order: { tariffType: 'ASC', effectiveDate: 'DESC' },
    });
  }

  async getApplicableTariff(
    tariffType: TariffType,
    clientId?: string,
    containerType?: string,
    serviceDate?: Date
  ): Promise<Tariff | null> {
    const query = this.tariffRepository.createQueryBuilder('tariff')
      .where('tariff.tariffType = :tariffType', { tariffType })
      .andWhere('tariff.status = :status', { status: TariffStatus.ACTIVE });

    const effectiveDate = serviceDate || new Date();
    query.andWhere('tariff.effectiveDate <= :effectiveDate', { effectiveDate });
    query.andWhere('(tariff.expiryDate IS NULL OR tariff.expiryDate >= :effectiveDate)', { effectiveDate });

    // Priority: client-specific tariff first, then general tariff
    if (clientId) {
      query.andWhere('(tariff.clientId = :clientId OR tariff.clientId IS NULL)', { clientId });
      query.orderBy('tariff.clientId', 'DESC'); // client-specific first
    } else {
      query.andWhere('tariff.clientId IS NULL');
    }

    query.addOrderBy('tariff.effectiveDate', 'DESC'); // most recent first

    const tariffs = await query.getMany();

    // Filter by container type if specified
    if (containerType && tariffs.length > 0) {
      const applicableTariff = tariffs.find(tariff => {
        const conditions = tariff.applicableConditions;
        if (!conditions || !conditions.containerTypes) return true;
        return conditions.containerTypes.includes(containerType);
      });
      return applicableTariff || null;
    }

    return tariffs[0] || null;
  }

  async calculatePrice(
    tariffId: string,
    quantity: number,
    additionalParams?: {
      containerType?: string;
      weight?: number;
      serviceDate?: Date;
      timeSlot?: string;
    }
  ): Promise<{
    baseAmount: number;
    discountAmount: number;
    taxAmount: number;
    totalAmount: number;
    appliedDiscounts: any[];
    calculation: any;
  }> {
    const tariff = await this.getTariffById(tariffId);

    if (!tariff.isActive) {
      throw new BadRequestException(`Tariff ${tariff.tariffCode} is not currently active`);
    }

    let calculation = {
      basePrice: tariff.basePrice,
      quantity,
      subtotal: 0,
      adjustments: [],
    };

    // Calculate base amount based on pricing model
    switch (tariff.pricingModel) {
      case PricingModel.FIXED:
        calculation.subtotal = tariff.basePrice;
        break;

      case PricingModel.VARIABLE:
        calculation.subtotal = tariff.basePrice * quantity;
        break;

      case PricingModel.TIERED:
        calculation.subtotal = this.calculateTieredPrice(tariff.pricingStructure.tiers, quantity);
        break;

      case PricingModel.VOLUME_BASED:
        calculation.subtotal = this.calculateVolumeBasedPrice(tariff, quantity);
        break;

      case PricingModel.TIME_BASED:
        calculation.subtotal = this.calculateTimeBasedPrice(tariff, quantity, additionalParams?.timeSlot);
        break;

      case PricingModel.WEIGHT_BASED:
        if (!additionalParams?.weight) {
          throw new BadRequestException('Weight is required for weight-based pricing');
        }
        calculation.subtotal = this.calculateWeightBasedPrice(tariff, additionalParams.weight);
        break;

      default:
        calculation.subtotal = tariff.basePrice * quantity;
    }

    // Apply minimum/maximum charges
    if (tariff.minimumCharge && calculation.subtotal < tariff.minimumCharge) {
      calculation.adjustments.push({
        type: 'minimum_charge',
        description: 'Minimum charge applied',
        amount: tariff.minimumCharge - calculation.subtotal,
      });
      calculation.subtotal = tariff.minimumCharge;
    }

    if (tariff.maximumCharge && calculation.subtotal > tariff.maximumCharge) {
      calculation.adjustments.push({
        type: 'maximum_charge',
        description: 'Maximum charge applied',
        amount: tariff.maximumCharge - calculation.subtotal,
      });
      calculation.subtotal = tariff.maximumCharge;
    }

    // Calculate discounts
    const { discountAmount, appliedDiscounts } = this.calculateDiscounts(tariff, calculation.subtotal, quantity);

    // Calculate taxes
    const taxAmount = this.calculateTax(tariff, calculation.subtotal - discountAmount);

    const totalAmount = calculation.subtotal - discountAmount + taxAmount;

    return {
      baseAmount: calculation.subtotal,
      discountAmount,
      taxAmount,
      totalAmount,
      appliedDiscounts,
      calculation,
    };
  }

  async activateTariff(id: string): Promise<Tariff> {
    const tariff = await this.getTariffById(id);

    if (tariff.status !== TariffStatus.DRAFT) {
      throw new BadRequestException(`Cannot activate tariff ${tariff.tariffCode} - status is ${tariff.status}`);
    }

    // Check for overlapping tariffs
    await this.checkForOverlappingTariffs(tariff);

    const updatedTariff = await this.updateTariff(id, {
      status: TariffStatus.ACTIVE,
    });

    this.eventEmitter.emit('tariff.activated', {
      tariffId: updatedTariff.id,
      tariffCode: updatedTariff.tariffCode,
      effectiveDate: updatedTariff.effectiveDate,
    });

    return updatedTariff;
  }

  async deactivateTariff(id: string, reason: string): Promise<Tariff> {
    const tariff = await this.getTariffById(id);

    if (tariff.status !== TariffStatus.ACTIVE) {
      throw new BadRequestException(`Cannot deactivate tariff ${tariff.tariffCode} - status is ${tariff.status}`);
    }

    const updatedTariff = await this.updateTariff(id, {
      status: TariffStatus.INACTIVE,
      notes: `${tariff.notes || ''}\nDeactivated: ${reason}`,
    });

    this.eventEmitter.emit('tariff.deactivated', {
      tariffId: updatedTariff.id,
      tariffCode: updatedTariff.tariffCode,
      reason,
    });

    return updatedTariff;
  }

  private calculateTieredPrice(tiers: any[], quantity: number): number {
    let totalPrice = 0;
    let remainingQuantity = quantity;

    for (const tier of tiers.sort((a, b) => a.minQuantity - b.minQuantity)) {
      if (remainingQuantity <= 0) break;

      const tierQuantity = Math.min(
        remainingQuantity,
        (tier.maxQuantity || Infinity) - tier.minQuantity + 1
      );

      totalPrice += tierQuantity * tier.pricePerUnit;
      if (tier.flatFee) totalPrice += tier.flatFee;

      remainingQuantity -= tierQuantity;
    }

    return totalPrice;
  }

  private calculateVolumeBasedPrice(tariff: Tariff, quantity: number): number {
    const volumeDiscounts = tariff.pricingStructure.volumeDiscounts || [];
    let basePrice = tariff.basePrice * quantity;

    for (const discount of volumeDiscounts) {
      if (quantity >= discount.minVolume && 
          (!discount.maxVolume || quantity <= discount.maxVolume)) {
        if (discount.discountType === 'percentage') {
          basePrice *= (1 - discount.discountValue / 100);
        } else {
          basePrice -= discount.discountValue;
        }
        break; // Apply only the first matching discount
      }
    }

    return basePrice;
  }

  private calculateTimeBasedPrice(tariff: Tariff, quantity: number, timeSlot?: string): number {
    let basePrice = tariff.basePrice * quantity;
    
    if (timeSlot && tariff.pricingStructure.timeSlots) {
      const slot = tariff.pricingStructure.timeSlots.find(slot => slot.slotName === timeSlot);
      if (slot) {
        basePrice *= slot.priceMultiplier;
      }
    }

    return basePrice;
  }

  private calculateWeightBasedPrice(tariff: Tariff, weight: number): number {
    return tariff.basePrice * weight;
  }

  private calculateDiscounts(tariff: Tariff, baseAmount: number, quantity: number): {
    discountAmount: number;
    appliedDiscounts: any[];
  } {
    let discountAmount = 0;
    const appliedDiscounts = [];

    // Apply volume discounts from discount policy
    if (tariff.discountPolicy?.volumeDiscounts) {
      for (const discount of tariff.discountPolicy.volumeDiscounts) {
        if (quantity >= discount.thresholdQuantity) {
          let discountValue = 0;
          if (discount.discountType === 'percentage') {
            discountValue = baseAmount * (discount.discountValue / 100);
          } else {
            discountValue = discount.discountValue;
          }

          if (discount.maxDiscountAmount) {
            discountValue = Math.min(discountValue, discount.maxDiscountAmount);
          }

          discountAmount += discountValue;
          appliedDiscounts.push({
            ...discount,
            appliedAmount: discountValue,
          });

          if (!discount.stackable) break;
        }
      }
    }

    return { discountAmount, appliedDiscounts };
  }

  private calculateTax(tariff: Tariff, taxableAmount: number): number {
    if (!tariff.taxInformation?.taxable || !tariff.taxInformation?.taxRate) {
      return 0;
    }

    return taxableAmount * (tariff.taxInformation.taxRate / 100);
  }

  private async checkForOverlappingTariffs(tariff: Tariff): Promise<void> {
    const query = this.tariffRepository.createQueryBuilder('existing')
      .where('existing.tariffType = :tariffType', { tariffType: tariff.tariffType })
      .andWhere('existing.status = :status', { status: TariffStatus.ACTIVE })
      .andWhere('existing.id != :id', { id: tariff.id });

    // Check client specificity
    if (tariff.clientId) {
      query.andWhere('existing.clientId = :clientId', { clientId: tariff.clientId });
    } else {
      query.andWhere('existing.clientId IS NULL');
    }

    // Check date overlaps
    query.andWhere(`(
      (existing.effectiveDate <= :effectiveDate AND (existing.expiryDate IS NULL OR existing.expiryDate >= :effectiveDate))
      OR (existing.effectiveDate <= :expiryDate AND (existing.expiryDate IS NULL OR existing.expiryDate >= :expiryDate))
      OR (existing.effectiveDate >= :effectiveDate AND (existing.expiryDate IS NULL OR existing.expiryDate <= :expiryDate))
    )`, {
      effectiveDate: tariff.effectiveDate,
      expiryDate: tariff.expiryDate || new Date('2099-12-31'),
    });

    const overlappingTariffs = await query.getMany();

    if (overlappingTariffs.length > 0) {
      throw new BadRequestException(
        `Overlapping tariff found: ${overlappingTariffs[0].tariffCode}. ` +
        'Deactivate existing tariff or adjust dates before activating.'
      );
    }
  }

  private validateStatusTransition(currentStatus: TariffStatus, newStatus: TariffStatus): void {
    const validTransitions: Record<TariffStatus, TariffStatus[]> = {
      [TariffStatus.DRAFT]: [TariffStatus.ACTIVE, TariffStatus.INACTIVE],
      [TariffStatus.ACTIVE]: [TariffStatus.INACTIVE, TariffStatus.EXPIRED, TariffStatus.SUPERSEDED],
      [TariffStatus.INACTIVE]: [TariffStatus.ACTIVE, TariffStatus.EXPIRED],
      [TariffStatus.EXPIRED]: [TariffStatus.SUPERSEDED],
      [TariffStatus.SUPERSEDED]: [],
    };

    if (!validTransitions[currentStatus]?.includes(newStatus)) {
      throw new BadRequestException(
        `Invalid status transition from ${currentStatus} to ${newStatus}`
      );
    }
  }

  private isSignificantChange(updateDto: UpdateTariffDto): boolean {
    const significantFields = ['basePrice', 'pricingStructure', 'applicableConditions', 'discountPolicy'];
    return significantFields.some(field => updateDto[field] !== undefined);
  }

  private getChanges(originalTariff: Tariff, updateDto: UpdateTariffDto): any[] {
    const changes = [];
    for (const [key, value] of Object.entries(updateDto)) {
      if (originalTariff[key] !== value) {
        changes.push({
          field: key,
          oldValue: originalTariff[key],
          newValue: value,
        });
      }
    }
    return changes;
  }

  private async generateTariffCode(tariffType: TariffType): Promise<string> {
    const typePrefix = {
      [TariffType.GATE_IN]: 'TR-GI',
      [TariffType.GATE_OUT]: 'TR-GO',
      [TariffType.STORAGE]: 'TR-ST',
      [TariffType.HANDLING]: 'TR-HD',
      [TariffType.LIFT_ON_LIFT_OFF]: 'TR-LL',
      [TariffType.WEIGHING]: 'TR-WG',
      [TariffType.INSPECTION]: 'TR-IN',
      [TariffType.REPAIR]: 'TR-RP',
      [TariffType.CLEANING]: 'TR-CL',
      [TariffType.FUMIGATION]: 'TR-FM',
      [TariffType.REEFER_MONITORING]: 'TR-RF',
      [TariffType.DEMURRAGE]: 'TR-DM',
      [TariffType.DETENTION]: 'TR-DT',
      [TariffType.DOCUMENTATION]: 'TR-DC',
      [TariffType.SPECIAL_HANDLING]: 'TR-SH',
    };

    const prefix = typePrefix[tariffType] || 'TR';
    const year = new Date().getFullYear();
    
    // Find the next sequence number for this type and year
    const lastTariff = await this.tariffRepository
      .createQueryBuilder('tariff')
      .where('tariff.tariffCode LIKE :pattern', { 
        pattern: `${prefix}-${year}-%` 
      })
      .orderBy('tariff.tariffCode', 'DESC')
      .getOne();

    let sequence = 1;
    if (lastTariff) {
      const lastNumber = lastTariff.tariffCode.split('-')[2];
      sequence = parseInt(lastNumber) + 1;
    }

    return `${prefix}-${year}-${sequence.toString().padStart(3, '0')}`;
  }

  async getTariffStatistics(filters?: {
    period?: number;
    tariffType?: TariffType;
    clientId?: string;
  }) {
    const whereClause = [];
    const params = [];

    if (filters?.period) {
      whereClause.push('created_at >= NOW() - INTERVAL \\'' + filters.period + ' days\\'');
    }

    if (filters?.tariffType) {
      whereClause.push('tariff_type = $' + (params.length + 1));
      params.push(filters.tariffType);
    }

    if (filters?.clientId) {
      whereClause.push('client_id = $' + (params.length + 1));
      params.push(filters.clientId);
    }

    const whereSQL = whereClause.length > 0 ? 'WHERE ' + whereClause.join(' AND ') : '';

    const [
      totalTariffs,
      tariffsByStatus,
      tariffsByType,
      avgBasePrice,
      expiringCount,
    ] = await Promise.all([
      this.tariffRepository.query(`
        SELECT COUNT(*) as count
        FROM billing.tariffs
        ${whereSQL}
      `, params),
      this.tariffRepository.query(`
        SELECT status, COUNT(*) as count
        FROM billing.tariffs
        ${whereSQL}
        GROUP BY status
        ORDER BY count DESC
      `, params),
      this.tariffRepository.query(`
        SELECT tariff_type, COUNT(*) as count, AVG(base_price) as avg_price
        FROM billing.tariffs
        ${whereSQL}
        GROUP BY tariff_type
        ORDER BY count DESC
      `, params),
      this.tariffRepository.query(`
        SELECT AVG(base_price) as avg_price
        FROM billing.tariffs
        ${whereSQL}
      `, params),
      this.tariffRepository.query(`
        SELECT COUNT(*) as count
        FROM billing.tariffs
        WHERE status = 'active'
        AND expiry_date <= NOW() + INTERVAL '30 days'
        AND expiry_date >= NOW()
      `),
    ]);

    return {
      totals: {
        totalTariffs: parseInt(totalTariffs[0].count),
        avgBasePrice: parseFloat(avgBasePrice[0].avg_price || 0),
        expiringCount: parseInt(expiringCount[0].count),
      },
      breakdown: {
        byStatus: tariffsByStatus,
        byType: tariffsByType,
      },
    };
  }
}