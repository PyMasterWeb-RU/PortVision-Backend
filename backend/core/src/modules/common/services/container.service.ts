import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { Container } from '../entities/container.entity';
import { CreateContainerDto } from '../dto/create-container.dto';
import { UpdateContainerDto } from '../dto/update-container.dto';

@Injectable()
export class ContainerService {
  constructor(
    @InjectRepository(Container)
    private readonly containerRepository: Repository<Container>,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async create(createContainerDto: CreateContainerDto): Promise<Container> {
    const container = this.containerRepository.create(createContainerDto);
    const savedContainer = await this.containerRepository.save(container);

    this.eventEmitter.emit('container.created', {
      containerId: savedContainer.id,
      containerNumber: savedContainer.number,
      type: savedContainer.type,
      size: savedContainer.size,
      status: savedContainer.status,
    });

    return savedContainer;
  }

  async findAll(page = 1, limit = 20): Promise<{
    containers: Container[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    const [containers, total] = await this.containerRepository.findAndCount({
      relations: ['client', 'currentPlacement'],
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: 'DESC' },
    });

    return {
      containers,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: string): Promise<Container> {
    const container = await this.containerRepository.findOne({
      where: { id },
      relations: ['client', 'currentPlacement', 'events'],
    });

    if (!container) {
      throw new NotFoundException(`Контейнер с ID ${id} не найден`);
    }

    return container;
  }

  async findByNumber(number: string): Promise<Container> {
    const container = await this.containerRepository.findOne({
      where: { number },
      relations: ['client', 'currentPlacement', 'events'],
    });

    if (!container) {
      throw new NotFoundException(`Контейнер с номером ${number} не найден`);
    }

    return container;
  }

  async update(id: string, updateContainerDto: UpdateContainerDto): Promise<Container> {
    const container = await this.findOne(id);
    
    Object.assign(container, updateContainerDto);
    const updatedContainer = await this.containerRepository.save(container);

    this.eventEmitter.emit('container.updated', {
      containerId: id,
      changes: updateContainerDto,
    });

    return updatedContainer;
  }

  async updateStatus(id: string, status: string): Promise<Container> {
    const container = await this.findOne(id);
    const oldStatus = container.status;
    
    container.status = status;
    const updatedContainer = await this.containerRepository.save(container);

    this.eventEmitter.emit('container.status.changed', {
      containerId: id,
      oldStatus,
      newStatus: status,
    });

    return updatedContainer;
  }

  async remove(id: string): Promise<void> {
    const container = await this.findOne(id);
    await this.containerRepository.remove(container);

    this.eventEmitter.emit('container.deleted', {
      containerId: id,
      containerNumber: container.number,
    });
  }

  async findByClient(clientId: string): Promise<Container[]> {
    return this.containerRepository.find({
      where: { clientId },
      relations: ['client', 'currentPlacement'],
      order: { createdAt: 'DESC' },
    });
  }

  async findByStatus(status: string): Promise<Container[]> {
    return this.containerRepository.find({
      where: { status },
      relations: ['client', 'currentPlacement'],
      order: { createdAt: 'DESC' },
    });
  }

  async getContainerStatistics(): Promise<{
    total: number;
    byType: Record<string, number>;
    bySize: Record<string, number>;
    byStatus: Record<string, number>;
  }> {
    const containers = await this.containerRepository.find();
    
    const total = containers.length;
    const byType = containers.reduce((acc, container) => {
      acc[container.type] = (acc[container.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const bySize = containers.reduce((acc, container) => {
      acc[container.size] = (acc[container.size] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const byStatus = containers.reduce((acc, container) => {
      acc[container.status] = (acc[container.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return { total, byType, bySize, byStatus };
  }
}