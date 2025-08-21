import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { Client } from '../entities/client.entity';
import { CreateClientDto } from '../dto/create-client.dto';
import { UpdateClientDto } from '../dto/update-client.dto';

@Injectable()
export class ClientService {
  constructor(
    @InjectRepository(Client)
    private readonly clientRepository: Repository<Client>,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async create(createClientDto: CreateClientDto): Promise<Client> {
    const client = this.clientRepository.create(createClientDto);
    const savedClient = await this.clientRepository.save(client);

    this.eventEmitter.emit('client.created', {
      clientId: savedClient.id,
      clientName: savedClient.name,
      clientType: savedClient.type,
    });

    return savedClient;
  }

  async findAll(page = 1, limit = 20): Promise<{
    clients: Client[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    const [clients, total] = await this.clientRepository.findAndCount({
      relations: ['containers', 'orders'],
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: 'DESC' },
    });

    return {
      clients,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: string): Promise<Client> {
    const client = await this.clientRepository.findOne({
      where: { id },
      relations: ['containers', 'orders'],
    });

    if (!client) {
      throw new NotFoundException(`Клиент с ID ${id} не найден`);
    }

    return client;
  }

  async findByName(name: string): Promise<Client[]> {
    return this.clientRepository.find({
      where: { name: name },
      relations: ['containers', 'orders'],
    });
  }

  async findByType(type: string): Promise<Client[]> {
    return this.clientRepository.find({
      where: { type },
      relations: ['containers', 'orders'],
      order: { name: 'ASC' },
    });
  }

  async update(id: string, updateClientDto: UpdateClientDto): Promise<Client> {
    const client = await this.findOne(id);
    
    Object.assign(client, updateClientDto);
    const updatedClient = await this.clientRepository.save(client);

    this.eventEmitter.emit('client.updated', {
      clientId: id,
      changes: updateClientDto,
    });

    return updatedClient;
  }

  async remove(id: string): Promise<void> {
    const client = await this.findOne(id);
    await this.clientRepository.remove(client);

    this.eventEmitter.emit('client.deleted', {
      clientId: id,
      clientName: client.name,
    });
  }

  async getClientStatistics(): Promise<{
    total: number;
    byType: Record<string, number>;
    active: number;
    inactive: number;
  }> {
    const clients = await this.clientRepository.find();
    
    const total = clients.length;
    const byType = clients.reduce((acc, client) => {
      acc[client.type] = (acc[client.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const active = clients.filter(client => client.isActive).length;
    const inactive = total - active;

    return { total, byType, active, inactive };
  }

  async searchClients(query: string): Promise<Client[]> {
    return this.clientRepository
      .createQueryBuilder('client')
      .where('client.name ILIKE :query', { query: `%${query}%` })
      .orWhere('client.code ILIKE :query', { query: `%${query}%` })
      .orWhere('client.contactEmail ILIKE :query', { query: `%${query}%` })
      .getMany();
  }

  async activateClient(id: string): Promise<Client> {
    const client = await this.findOne(id);
    client.isActive = true;
    const updatedClient = await this.clientRepository.save(client);

    this.eventEmitter.emit('client.activated', {
      clientId: id,
      clientName: client.name,
    });

    return updatedClient;
  }

  async deactivateClient(id: string): Promise<Client> {
    const client = await this.findOne(id);
    client.isActive = false;
    const updatedClient = await this.clientRepository.save(client);

    this.eventEmitter.emit('client.deactivated', {
      clientId: id,
      clientName: client.name,
    });

    return updatedClient;
  }
}