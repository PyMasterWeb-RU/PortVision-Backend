import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { Tariff } from '../entities/tariff.entity';
import { CreateTariffDto } from '../dto/create-tariff.dto';
import { UpdateTariffDto } from '../dto/update-tariff.dto';

@Injectable()
export class TariffService {
  constructor(
    @InjectRepository(Tariff)
    private readonly tariffRepository: Repository<Tariff>,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async create(createTariffDto: CreateTariffDto): Promise<Tariff> {
    const tariff = this.tariffRepository.create(createTariffDto);
    const savedTariff = await this.tariffRepository.save(tariff);

    this.eventEmitter.emit('tariff.created', {
      tariffId: savedTariff.id,
      tariffName: savedTariff.name,
      serviceType: savedTariff.serviceType,
      price: savedTariff.price,
    });

    return savedTariff;
  }

  async findAll(page = 1, limit = 20): Promise<{
    tariffs: Tariff[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    const [tariffs, total] = await this.tariffRepository.findAndCount({
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: 'DESC' },
    });

    return {
      tariffs,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: string): Promise<Tariff> {
    const tariff = await this.tariffRepository.findOne({
      where: { id },
    });

    if (!tariff) {
      throw new NotFoundException(`Тариф с ID ${id} не найден`);
    }

    return tariff;
  }

  async findByServiceType(serviceType: string): Promise<Tariff[]> {
    return this.tariffRepository.find({
      where: { serviceType },
      order: { price: 'ASC' },
    });
  }

  async findActiveByServiceType(serviceType: string): Promise<Tariff[]> {
    return this.tariffRepository.find({
      where: { 
        serviceType,
        isActive: true 
      },
      order: { price: 'ASC' },
    });
  }

  async update(id: string, updateTariffDto: UpdateTariffDto): Promise<Tariff> {
    const tariff = await this.findOne(id);
    
    Object.assign(tariff, updateTariffDto);
    const updatedTariff = await this.tariffRepository.save(tariff);

    this.eventEmitter.emit('tariff.updated', {
      tariffId: id,
      changes: updateTariffDto,
    });

    return updatedTariff;
  }

  async remove(id: string): Promise<void> {
    const tariff = await this.findOne(id);
    await this.tariffRepository.remove(tariff);

    this.eventEmitter.emit('tariff.deleted', {
      tariffId: id,
      tariffName: tariff.name,
    });
  }

  async calculatePrice(
    serviceType: string,
    containerSize: string,
    duration?: number,
    quantity?: number,
  ): Promise<number> {
    const tariff = await this.tariffRepository.findOne({
      where: { 
        serviceType,
        isActive: true,
        ...(containerSize && { applicableContainerSizes: { contains: [containerSize] } })
      },
    });

    if (!tariff) {
      throw new NotFoundException(`Активный тариф для услуги ${serviceType} не найден`);
    }

    let totalPrice = tariff.price;

    if (duration && tariff.unitType === 'per_day') {
      totalPrice *= duration;
    }

    if (quantity && tariff.unitType === 'per_unit') {
      totalPrice *= quantity;
    }

    return totalPrice;
  }

  async getTariffStatistics(): Promise<{
    total: number;
    active: number;
    inactive: number;
    byServiceType: Record<string, number>;
    averagePrice: number;
  }> {
    const tariffs = await this.tariffRepository.find();
    
    const total = tariffs.length;
    const active = tariffs.filter(t => t.isActive).length;
    const inactive = total - active;
    
    const byServiceType = tariffs.reduce((acc, tariff) => {
      acc[tariff.serviceType] = (acc[tariff.serviceType] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const averagePrice = tariffs.length > 0 
      ? tariffs.reduce((sum, t) => sum + t.price, 0) / tariffs.length 
      : 0;

    return { total, active, inactive, byServiceType, averagePrice };
  }

  async activateTariff(id: string): Promise<Tariff> {
    const tariff = await this.findOne(id);
    tariff.isActive = true;
    const updatedTariff = await this.tariffRepository.save(tariff);

    this.eventEmitter.emit('tariff.activated', {
      tariffId: id,
      tariffName: tariff.name,
    });

    return updatedTariff;
  }

  async deactivateTariff(id: string): Promise<Tariff> {
    const tariff = await this.findOne(id);
    tariff.isActive = false;
    const updatedTariff = await this.tariffRepository.save(tariff);

    this.eventEmitter.emit('tariff.deactivated', {
      tariffId: id,
      tariffName: tariff.name,
    });

    return updatedTariff;
  }
}