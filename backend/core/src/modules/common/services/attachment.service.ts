import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { Attachment } from '../entities/attachment.entity';
import { CreateAttachmentDto } from '../dto/create-attachment.dto';
import { UpdateAttachmentDto } from '../dto/update-attachment.dto';

@Injectable()
export class AttachmentService {
  constructor(
    @InjectRepository(Attachment)
    private readonly attachmentRepository: Repository<Attachment>,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async create(createAttachmentDto: CreateAttachmentDto): Promise<Attachment> {
    const attachment = this.attachmentRepository.create(createAttachmentDto);
    const savedAttachment = await this.attachmentRepository.save(attachment);

    this.eventEmitter.emit('attachment.created', {
      attachmentId: savedAttachment.id,
      fileName: savedAttachment.fileName,
      fileType: savedAttachment.fileType,
      fileSize: savedAttachment.fileSize,
    });

    return savedAttachment;
  }

  async findAll(page = 1, limit = 20): Promise<{
    attachments: Attachment[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    const [attachments, total] = await this.attachmentRepository.findAndCount({
      relations: ['document'],
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: 'DESC' },
    });

    return {
      attachments,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: string): Promise<Attachment> {
    const attachment = await this.attachmentRepository.findOne({
      where: { id },
      relations: ['document'],
    });

    if (!attachment) {
      throw new NotFoundException(`Вложение с ID ${id} не найдено`);
    }

    return attachment;
  }

  async findByDocument(documentId: string): Promise<Attachment[]> {
    return this.attachmentRepository.find({
      where: { documentId },
      order: { createdAt: 'ASC' },
    });
  }

  async findByType(fileType: string): Promise<Attachment[]> {
    return this.attachmentRepository.find({
      where: { fileType },
      relations: ['document'],
      order: { createdAt: 'DESC' },
    });
  }

  async update(id: string, updateAttachmentDto: UpdateAttachmentDto): Promise<Attachment> {
    const attachment = await this.findOne(id);
    
    Object.assign(attachment, updateAttachmentDto);
    const updatedAttachment = await this.attachmentRepository.save(attachment);

    this.eventEmitter.emit('attachment.updated', {
      attachmentId: id,
      changes: updateAttachmentDto,
    });

    return updatedAttachment;
  }

  async remove(id: string): Promise<void> {
    const attachment = await this.findOne(id);
    await this.attachmentRepository.remove(attachment);

    this.eventEmitter.emit('attachment.deleted', {
      attachmentId: id,
      fileName: attachment.fileName,
    });
  }

  async getAttachmentStatistics(): Promise<{
    total: number;
    byType: Record<string, number>;
    totalSize: number;
    averageSize: number;
  }> {
    const attachments = await this.attachmentRepository.find();
    
    const total = attachments.length;
    const byType = attachments.reduce((acc, attachment) => {
      acc[attachment.fileType] = (acc[attachment.fileType] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const totalSize = attachments.reduce((sum, attachment) => sum + attachment.fileSize, 0);
    const averageSize = total > 0 ? totalSize / total : 0;

    return { total, byType, totalSize, averageSize };
  }

  async searchAttachments(query: string): Promise<Attachment[]> {
    return this.attachmentRepository
      .createQueryBuilder('attachment')
      .where('attachment.fileName ILIKE :query', { query: `%${query}%` })
      .orWhere('attachment.description ILIKE :query', { query: `%${query}%` })
      .getMany();
  }

  async getTotalStorageUsed(): Promise<number> {
    const result = await this.attachmentRepository
      .createQueryBuilder('attachment')
      .select('SUM(attachment.fileSize)', 'total')
      .getRawOne();
    
    return parseInt(result.total) || 0;
  }
}