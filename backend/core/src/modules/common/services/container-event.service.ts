import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { ContainerEvent } from '../entities/container-event.entity';
import { CreateContainerEventDto } from '../dto/create-container-event.dto';
import { UpdateContainerEventDto } from '../dto/update-container-event.dto';

@Injectable()
export class ContainerEventService {
  constructor(
    @InjectRepository(ContainerEvent)
    private readonly containerEventRepository: Repository<ContainerEvent>,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async create(createContainerEventDto: CreateContainerEventDto): Promise<ContainerEvent> {
    const containerEvent = this.containerEventRepository.create(createContainerEventDto);
    const savedEvent = await this.containerEventRepository.save(containerEvent);

    this.eventEmitter.emit('container.event.created', {
      eventId: savedEvent.id,
      containerId: savedEvent.containerId,
      eventType: savedEvent.eventType,
      timestamp: savedEvent.timestamp,
    });

    return savedEvent;
  }

  async findAll(page = 1, limit = 20): Promise<{
    events: ContainerEvent[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    const [events, total] = await this.containerEventRepository.findAndCount({
      relations: ['container'],
      skip: (page - 1) * limit,
      take: limit,
      order: { timestamp: 'DESC' },
    });

    return {
      events,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: string): Promise<ContainerEvent> {
    const containerEvent = await this.containerEventRepository.findOne({
      where: { id },
      relations: ['container'],
    });

    if (!containerEvent) {
      throw new NotFoundException(`Событие контейнера с ID ${id} не найдено`);
    }

    return containerEvent;
  }

  async findByContainer(containerId: string): Promise<ContainerEvent[]> {
    return this.containerEventRepository.find({
      where: { containerId },
      order: { timestamp: 'DESC' },
    });
  }

  async findByType(eventType: string): Promise<ContainerEvent[]> {
    return this.containerEventRepository.find({
      where: { eventType },
      relations: ['container'],
      order: { timestamp: 'DESC' },
    });
  }

  async findByDateRange(startDate: Date, endDate: Date): Promise<ContainerEvent[]> {
    return this.containerEventRepository
      .createQueryBuilder('event')
      .where('event.timestamp >= :startDate', { startDate })
      .andWhere('event.timestamp <= :endDate', { endDate })
      .leftJoinAndSelect('event.container', 'container')
      .orderBy('event.timestamp', 'DESC')
      .getMany();
  }

  async update(id: string, updateContainerEventDto: UpdateContainerEventDto): Promise<ContainerEvent> {
    const containerEvent = await this.findOne(id);
    
    Object.assign(containerEvent, updateContainerEventDto);
    const updatedEvent = await this.containerEventRepository.save(containerEvent);

    this.eventEmitter.emit('container.event.updated', {
      eventId: id,
      changes: updateContainerEventDto,
    });

    return updatedEvent;
  }

  async remove(id: string): Promise<void> {
    const containerEvent = await this.findOne(id);
    await this.containerEventRepository.remove(containerEvent);

    this.eventEmitter.emit('container.event.deleted', {
      eventId: id,
      containerId: containerEvent.containerId,
    });
  }

  async getEventStatistics(): Promise<{
    total: number;
    byType: Record<string, number>;
    last24Hours: number;
    last7Days: number;
  }> {
    const events = await this.containerEventRepository.find();
    
    const total = events.length;
    const byType = events.reduce((acc, event) => {
      acc[event.eventType] = (acc[event.eventType] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const now = new Date();
    const last24Hours = events.filter(event => 
      new Date(event.timestamp).getTime() > now.getTime() - 24 * 60 * 60 * 1000
    ).length;
    
    const last7Days = events.filter(event => 
      new Date(event.timestamp).getTime() > now.getTime() - 7 * 24 * 60 * 60 * 1000
    ).length;

    return { total, byType, last24Hours, last7Days };
  }

  async createAutomaticEvent(
    containerId: string,
    eventType: string,
    description: string,
    metadata?: Record<string, any>
  ): Promise<ContainerEvent> {
    const eventDto: CreateContainerEventDto = {
      containerId,
      eventType,
      description,
      timestamp: new Date(),
      metadata,
    };

    return this.create(eventDto);
  }

  async getContainerTimeline(containerId: string): Promise<ContainerEvent[]> {
    return this.containerEventRepository.find({
      where: { containerId },
      order: { timestamp: 'ASC' },
    });
  }
}