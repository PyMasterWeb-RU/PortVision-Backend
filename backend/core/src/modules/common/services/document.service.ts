import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { Document } from '../entities/document.entity';
import { CreateDocumentDto } from '../dto/create-document.dto';
import { UpdateDocumentDto } from '../dto/update-document.dto';

@Injectable()
export class DocumentService {
  constructor(
    @InjectRepository(Document)
    private readonly documentRepository: Repository<Document>,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async create(createDocumentDto: CreateDocumentDto): Promise<Document> {
    const document = this.documentRepository.create(createDocumentDto);
    const savedDocument = await this.documentRepository.save(document);

    this.eventEmitter.emit('document.created', {
      documentId: savedDocument.id,
      documentType: savedDocument.type,
      fileName: savedDocument.fileName,
    });

    return savedDocument;
  }

  async findAll(page = 1, limit = 20): Promise<{
    documents: Document[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    const [documents, total] = await this.documentRepository.findAndCount({
      relations: ['attachments'],
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: 'DESC' },
    });

    return {
      documents,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: string): Promise<Document> {
    const document = await this.documentRepository.findOne({
      where: { id },
      relations: ['attachments'],
    });

    if (!document) {
      throw new NotFoundException(`Документ с ID ${id} не найден`);
    }

    return document;
  }

  async findByType(type: string): Promise<Document[]> {
    return this.documentRepository.find({
      where: { type },
      relations: ['attachments'],
      order: { createdAt: 'DESC' },
    });
  }

  async findByEntity(entityType: string, entityId: string): Promise<Document[]> {
    return this.documentRepository.find({
      where: { entityType, entityId },
      relations: ['attachments'],
      order: { createdAt: 'DESC' },
    });
  }

  async update(id: string, updateDocumentDto: UpdateDocumentDto): Promise<Document> {
    const document = await this.findOne(id);
    
    Object.assign(document, updateDocumentDto);
    const updatedDocument = await this.documentRepository.save(document);

    this.eventEmitter.emit('document.updated', {
      documentId: id,
      changes: updateDocumentDto,
    });

    return updatedDocument;
  }

  async remove(id: string): Promise<void> {
    const document = await this.findOne(id);
    await this.documentRepository.remove(document);

    this.eventEmitter.emit('document.deleted', {
      documentId: id,
      fileName: document.fileName,
    });
  }

  async searchDocuments(query: string): Promise<Document[]> {
    return this.documentRepository
      .createQueryBuilder('document')
      .where('document.fileName ILIKE :query', { query: `%${query}%` })
      .orWhere('document.description ILIKE :query', { query: `%${query}%` })
      .orWhere('document.metadata ILIKE :query', { query: `%${query}%` })
      .getMany();
  }

  async getDocumentStatistics(): Promise<{
    total: number;
    byType: Record<string, number>;
    totalSize: number;
    averageSize: number;
  }> {
    const documents = await this.documentRepository.find();
    
    const total = documents.length;
    const byType = documents.reduce((acc, doc) => {
      acc[doc.type] = (acc[doc.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const totalSize = documents.reduce((sum, doc) => sum + (doc.fileSize || 0), 0);
    const averageSize = total > 0 ? totalSize / total : 0;

    return { total, byType, totalSize, averageSize };
  }
}