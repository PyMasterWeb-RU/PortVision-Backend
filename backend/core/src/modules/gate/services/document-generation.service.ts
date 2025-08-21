import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { GatePass } from '../entities/gate-pass.entity';
import { Eir } from '../entities/eir.entity';

export interface DocumentTemplate {
  id: string;
  name: string;
  type: 'gate_pass' | 'eir' | 'access_card' | 'invoice' | 'receipt';
  format: 'pdf' | 'excel' | 'word' | 'html';
  template: string;
  fields: string[];
  metadata?: Record<string, any>;
}

export interface GenerateDocumentDto {
  templateId: string;
  entityId: string;
  entityType: 'gate_pass' | 'eir';
  format?: 'pdf' | 'excel' | 'word' | 'html';
  customData?: Record<string, any>;
  options?: {
    includePhotos?: boolean;
    includeSignatures?: boolean;
    includeBarcode?: boolean;
    includeQRCode?: boolean;
    language?: 'ru' | 'en';
  };
}

export interface DocumentResult {
  success: boolean;
  documentUrl?: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  error?: string;
  metadata?: Record<string, any>;
}

export interface BulkGenerateDto {
  templateId: string;
  entities: Array<{
    entityId: string;
    entityType: 'gate_pass' | 'eir';
    customData?: Record<string, any>;
  }>;
  format?: 'pdf' | 'excel' | 'word' | 'html';
  options?: any;
  outputType?: 'separate' | 'combined';
}

@Injectable()
export class DocumentGenerationService {
  private readonly logger = new Logger(DocumentGenerationService.name);

  // Встроенные шаблоны документов
  private readonly defaultTemplates: DocumentTemplate[] = [
    {
      id: 'gate_pass_standard',
      name: 'Стандартный пропуск',
      type: 'gate_pass',
      format: 'pdf',
      template: 'gate_pass_standard.hbs',
      fields: ['passNumber', 'truckNumber', 'driverName', 'validFrom', 'validUntil'],
    },
    {
      id: 'gate_pass_detailed',
      name: 'Детальный пропуск',
      type: 'gate_pass',
      format: 'pdf',
      template: 'gate_pass_detailed.hbs',
      fields: ['passNumber', 'truckNumber', 'trailerNumber', 'driverName', 'transportCompany', 'validFrom', 'validUntil', 'purpose'],
    },
    {
      id: 'eir_standard',
      name: 'Стандартный EIR',
      type: 'eir',
      format: 'pdf',
      template: 'eir_standard.hbs',
      fields: ['eirNumber', 'containerNumber', 'inspectionDate', 'inspectorName', 'overallCondition'],
    },
    {
      id: 'eir_detailed',
      name: 'Детальный EIR',
      type: 'eir',
      format: 'pdf',
      template: 'eir_detailed.hbs',
      fields: ['eirNumber', 'containerNumber', 'inspectionDate', 'inspectorName', 'overallCondition', 'damages', 'photos'],
    },
    {
      id: 'access_card',
      name: 'Пропуск доступа',
      type: 'access_card',
      format: 'pdf',
      template: 'access_card.hbs',
      fields: ['cardNumber', 'holderName', 'validFrom', 'validUntil', 'accessLevel'],
    },
  ];

  constructor(
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Генерация документа
   */
  async generateDocument(generateDto: GenerateDocumentDto, userId: string): Promise<DocumentResult> {
    try {
      this.logger.log(`Generating document with template: ${generateDto.templateId} for entity: ${generateDto.entityId}`);

      // Получение шаблона
      const template = await this.getTemplate(generateDto.templateId);
      if (!template) {
        throw new BadRequestException(`Template ${generateDto.templateId} not found`);
      }

      // Получение данных сущности
      const entityData = await this.getEntityData(generateDto.entityId, generateDto.entityType);
      
      // Подготовка данных для шаблона
      const templateData = await this.prepareTemplateData(entityData, generateDto.customData, generateDto.options);

      // Генерация документа
      const result = await this.renderDocument(template, templateData, generateDto.format, generateDto.options);

      // Событие генерации документа
      this.eventEmitter.emit('document.generated', {
        templateId: generateDto.templateId,
        entityId: generateDto.entityId,
        entityType: generateDto.entityType,
        documentUrl: result.documentUrl,
        userId,
      });

      this.logger.log(`Document generated successfully: ${result.fileName}`);
      return result;

    } catch (error) {
      this.logger.error(`Failed to generate document: ${error.message}`);
      
      this.eventEmitter.emit('document.generation.failed', {
        templateId: generateDto.templateId,
        entityId: generateDto.entityId,
        error: error.message,
        userId,
      });

      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Пакетная генерация документов
   */
  async generateBulk(bulkDto: BulkGenerateDto, userId: string): Promise<DocumentResult[]> {
    this.logger.log(`Generating bulk documents: ${bulkDto.entities.length} documents`);

    const results: DocumentResult[] = [];
    
    for (const entity of bulkDto.entities) {
      try {
        const generateDto: GenerateDocumentDto = {
          templateId: bulkDto.templateId,
          entityId: entity.entityId,
          entityType: entity.entityType,
          format: bulkDto.format,
          customData: entity.customData,
          options: bulkDto.options,
        };

        const result = await this.generateDocument(generateDto, userId);
        results.push(result);
      } catch (error) {
        this.logger.error(`Failed to generate document for entity ${entity.entityId}: ${error.message}`);
        results.push({
          success: false,
          error: error.message,
          metadata: { entityId: entity.entityId },
        });
      }
    }

    // Если требуется объединить документы
    if (bulkDto.outputType === 'combined' && results.some(r => r.success)) {
      try {
        const combinedResult = await this.combineDocuments(results.filter(r => r.success), bulkDto.format);
        this.eventEmitter.emit('documents.bulk.combined', {
          templateId: bulkDto.templateId,
          entityCount: bulkDto.entities.length,
          combinedDocumentUrl: combinedResult.documentUrl,
          userId,
        });
        return [combinedResult];
      } catch (error) {
        this.logger.error(`Failed to combine documents: ${error.message}`);
      }
    }

    this.eventEmitter.emit('documents.bulk.generated', {
      templateId: bulkDto.templateId,
      totalRequested: bulkDto.entities.length,
      successCount: results.filter(r => r.success).length,
      failureCount: results.filter(r => !r.success).length,
      userId,
    });

    return results;
  }

  /**
   * Получение доступных шаблонов
   */
  async getAvailableTemplates(type?: string): Promise<DocumentTemplate[]> {
    let templates = this.defaultTemplates;
    
    if (type) {
      templates = templates.filter(t => t.type === type);
    }

    return templates;
  }

  /**
   * Предварительный просмотр документа
   */
  async previewDocument(generateDto: GenerateDocumentDto, userId: string): Promise<DocumentResult> {
    // Генерируем HTML версию для предварительного просмотра
    const previewDto = {
      ...generateDto,
      format: 'html' as const,
    };

    const result = await this.generateDocument(previewDto, userId);
    
    this.eventEmitter.emit('document.previewed', {
      templateId: generateDto.templateId,
      entityId: generateDto.entityId,
      userId,
    });

    return result;
  }

  /**
   * Валидация шаблона
   */
  async validateTemplate(template: DocumentTemplate): Promise<{
    valid: boolean;
    errors: string[];
    warnings: string[];
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Проверка обязательных полей
    if (!template.id) errors.push('Template ID is required');
    if (!template.name) errors.push('Template name is required');
    if (!template.type) errors.push('Template type is required');
    if (!template.template) errors.push('Template content is required');

    // Проверка формата
    const validFormats = ['pdf', 'excel', 'word', 'html'];
    if (!validFormats.includes(template.format)) {
      errors.push(`Invalid format: ${template.format}`);
    }

    // Проверка типа
    const validTypes = ['gate_pass', 'eir', 'access_card', 'invoice', 'receipt'];
    if (!validTypes.includes(template.type)) {
      errors.push(`Invalid type: ${template.type}`);
    }

    // Проверка полей шаблона
    if (!template.fields || template.fields.length === 0) {
      warnings.push('Template has no defined fields');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Получение шаблона по ID
   */
  private async getTemplate(templateId: string): Promise<DocumentTemplate | null> {
    return this.defaultTemplates.find(t => t.id === templateId) || null;
  }

  /**
   * Получение данных сущности
   */
  private async getEntityData(entityId: string, entityType: string): Promise<any> {
    // В реальной реализации здесь должны быть вызовы к соответствующим сервисам
    // Для демонстрации используем моки
    
    switch (entityType) {
      case 'gate_pass':
        return this.mockGatePassData(entityId);
      case 'eir':
        return this.mockEirData(entityId);
      default:
        throw new BadRequestException(`Unknown entity type: ${entityType}`);
    }
  }

  /**
   * Подготовка данных для шаблона
   */
  private async prepareTemplateData(entityData: any, customData?: Record<string, any>, options?: any): Promise<any> {
    const templateData = {
      ...entityData,
      ...customData,
      generatedAt: new Date().toISOString(),
      generatedBy: 'PortVision360 System',
      options: options || {},
    };

    // Форматирование дат
    if (templateData.validFrom) {
      templateData.validFromFormatted = new Date(templateData.validFrom).toLocaleDateString('ru-RU');
    }
    if (templateData.validUntil) {
      templateData.validUntilFormatted = new Date(templateData.validUntil).toLocaleDateString('ru-RU');
    }
    if (templateData.inspectionDate) {
      templateData.inspectionDateFormatted = new Date(templateData.inspectionDate).toLocaleString('ru-RU');
    }

    // Генерация штрих-кода и QR-кода
    if (options?.includeBarcode && templateData.passNumber) {
      templateData.barcodeUrl = await this.generateBarcode(templateData.passNumber);
    }
    if (options?.includeQRCode && (templateData.passNumber || templateData.eirNumber)) {
      templateData.qrCodeUrl = await this.generateQRCode(templateData.passNumber || templateData.eirNumber);
    }

    return templateData;
  }

  /**
   * Рендеринг документа
   */
  private async renderDocument(template: DocumentTemplate, data: any, format?: string, options?: any): Promise<DocumentResult> {
    const targetFormat = format || template.format;
    
    // Генерация HTML контента
    const htmlContent = await this.renderHtmlTemplate(template.template, data);
    
    // Конвертация в нужный формат
    switch (targetFormat) {
      case 'html':
        return this.saveHtmlDocument(htmlContent, template.name);
      case 'pdf':
        return this.convertToPdf(htmlContent, template.name, options);
      case 'excel':
        return this.convertToExcel(data, template.name);
      case 'word':
        return this.convertToWord(htmlContent, template.name);
      default:
        throw new BadRequestException(`Unsupported format: ${targetFormat}`);
    }
  }

  /**
   * Рендеринг HTML шаблона
   */
  private async renderHtmlTemplate(templateName: string, data: any): Promise<string> {
    // В реальной реализации здесь должна быть интеграция с движком шаблонов (Handlebars, Mustache, etc.)
    // Для демонстрации возвращаем простой HTML
    
    const mockTemplates = {
      'gate_pass_standard.hbs': `
        <html>
          <head>
            <title>Пропуск № {{passNumber}}</title>
            <style>
              body { font-family: Arial, sans-serif; }
              .header { text-align: center; margin-bottom: 20px; }
              .content { margin: 20px; }
              .footer { margin-top: 40px; font-size: 12px; }
            </style>
          </head>
          <body>
            <div class="header">
              <h1>ПРОПУСК НА ТЕРРИТОРИЮ ТЕРМИНАЛА</h1>
              <h2>№ {{passNumber}}</h2>
            </div>
            <div class="content">
              <p><strong>Тип:</strong> {{type}}</p>
              <p><strong>Номер грузовика:</strong> {{truckNumber}}</p>
              <p><strong>Водитель:</strong> {{driverName}}</p>
              <p><strong>Действителен с:</strong> {{validFromFormatted}}</p>
              <p><strong>Действителен до:</strong> {{validUntilFormatted}}</p>
              {{#if purpose}}<p><strong>Цель визита:</strong> {{purpose}}</p>{{/if}}
            </div>
            <div class="footer">
              <p>Сгенерировано: {{generatedAt}}</p>
              {{#if qrCodeUrl}}<img src="{{qrCodeUrl}}" alt="QR Code" />{{/if}}
            </div>
          </body>
        </html>
      `,
      'eir_standard.hbs': `
        <html>
          <head>
            <title>EIR № {{eirNumber}}</title>
            <style>
              body { font-family: Arial, sans-serif; }
              .header { text-align: center; margin-bottom: 20px; }
              .content { margin: 20px; }
              .damage-item { border: 1px solid #ccc; padding: 10px; margin: 10px 0; }
            </style>
          </head>
          <body>
            <div class="header">
              <h1>EQUIPMENT INTERCHANGE RECEIPT</h1>
              <h2>№ {{eirNumber}}</h2>
            </div>
            <div class="content">
              <p><strong>Контейнер:</strong> {{containerNumber}}</p>
              <p><strong>Дата осмотра:</strong> {{inspectionDateFormatted}}</p>
              <p><strong>Инспектор:</strong> {{inspectorName}}</p>
              <p><strong>Общее состояние:</strong> {{overallCondition}}</p>
              
              {{#if damages}}
              <h3>Повреждения:</h3>
              {{#each damages}}
              <div class="damage-item">
                <p><strong>Местоположение:</strong> {{location}}</p>
                <p><strong>Описание:</strong> {{description}}</p>
                <p><strong>Серьезность:</strong> {{severity}}</p>
              </div>
              {{/each}}
              {{/if}}
            </div>
            <div class="footer">
              <p>Сгенерировано: {{generatedAt}}</p>
            </div>
          </body>
        </html>
      `,
    };

    const template = mockTemplates[templateName] || mockTemplates['gate_pass_standard.hbs'];
    
    // Простая замена переменных (в реальности должен использоваться полноценный движок шаблонов)
    let html = template;
    for (const [key, value] of Object.entries(data)) {
      const regex = new RegExp(`{{${key}}}`, 'g');
      html = html.replace(regex, String(value || ''));
    }

    // Обработка условных блоков и циклов (упрощенная)
    html = html.replace(/{{#if\s+(\w+)}}(.*?){{\/if}}/gs, (match, condition, content) => {
      return data[condition] ? content : '';
    });

    return html;
  }

  /**
   * Сохранение HTML документа
   */
  private async saveHtmlDocument(htmlContent: string, templateName: string): Promise<DocumentResult> {
    const fileName = `${templateName}_${Date.now()}.html`;
    const fileUrl = `/documents/${fileName}`;

    // В реальной реализации здесь должно быть сохранение файла
    // Для демонстрации возвращаем мок
    
    return {
      success: true,
      documentUrl: fileUrl,
      fileName,
      fileSize: htmlContent.length,
      mimeType: 'text/html',
    };
  }

  /**
   * Конвертация в PDF
   */
  private async convertToPdf(htmlContent: string, templateName: string, options?: any): Promise<DocumentResult> {
    const fileName = `${templateName}_${Date.now()}.pdf`;
    const fileUrl = `/documents/${fileName}`;

    // В реальной реализации здесь должна быть интеграция с библиотекой PDF (puppeteer, wkhtmltopdf, etc.)
    
    return {
      success: true,
      documentUrl: fileUrl,
      fileName,
      fileSize: 50000, // Мок размера
      mimeType: 'application/pdf',
      metadata: {
        format: 'pdf',
        pages: 1,
        options,
      },
    };
  }

  /**
   * Конвертация в Excel
   */
  private async convertToExcel(data: any, templateName: string): Promise<DocumentResult> {
    const fileName = `${templateName}_${Date.now()}.xlsx`;
    const fileUrl = `/documents/${fileName}`;

    // В реальной реализации здесь должна быть интеграция с библиотекой Excel (exceljs, xlsx, etc.)
    
    return {
      success: true,
      documentUrl: fileUrl,
      fileName,
      fileSize: 25000, // Мок размера
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };
  }

  /**
   * Конвертация в Word
   */
  private async convertToWord(htmlContent: string, templateName: string): Promise<DocumentResult> {
    const fileName = `${templateName}_${Date.now()}.docx`;
    const fileUrl = `/documents/${fileName}`;

    // В реальной реализации здесь должна быть интеграция с библиотекой Word (docx, etc.)
    
    return {
      success: true,
      documentUrl: fileUrl,
      fileName,
      fileSize: 35000, // Мок размера
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    };
  }

  /**
   * Объединение документов
   */
  private async combineDocuments(documents: DocumentResult[], format?: string): Promise<DocumentResult> {
    const fileName = `combined_documents_${Date.now()}.${format || 'pdf'}`;
    const fileUrl = `/documents/${fileName}`;

    // В реальной реализации здесь должно быть объединение документов
    
    return {
      success: true,
      documentUrl: fileUrl,
      fileName,
      fileSize: documents.reduce((sum, doc) => sum + (doc.fileSize || 0), 0),
      mimeType: format === 'pdf' ? 'application/pdf' : 'application/octet-stream',
      metadata: {
        combinedDocuments: documents.length,
        originalDocuments: documents.map(d => d.fileName),
      },
    };
  }

  /**
   * Генерация штрих-кода
   */
  private async generateBarcode(text: string): Promise<string> {
    // В реальной реализации здесь должна быть интеграция с библиотекой штрих-кодов
    return `/barcodes/${text}.png`;
  }

  /**
   * Генерация QR-кода
   */
  private async generateQRCode(text: string): Promise<string> {
    // В реальной реализации здесь должна быть интеграция с библиотекой QR-кодов
    return `/qrcodes/${text}.png`;
  }

  /**
   * Мок данных пропуска
   */
  private mockGatePassData(id: string): any {
    return {
      id,
      passNumber: `GP-2023-${Math.floor(Math.random() * 100000).toString().padStart(6, '0')}`,
      type: 'import',
      truckNumber: 'А123БВ77',
      trailerNumber: 'АТ456ГД99',
      driverName: 'Иванов Иван Иванович',
      driverLicense: '77АА123456',
      transportCompany: 'ООО "Транспорт-Логистик"',
      validFrom: new Date(),
      validUntil: new Date(Date.now() + 24 * 60 * 60 * 1000), // +1 день
      purpose: 'Погрузка контейнера',
      containerNumber: 'MSCU1234567',
    };
  }

  /**
   * Мок данных EIR
   */
  private mockEirData(id: string): any {
    return {
      id,
      eirNumber: `EIR-2023-${Math.floor(Math.random() * 100000).toString().padStart(6, '0')}`,
      type: 'gate_in',
      containerNumber: 'MSCU1234567',
      inspectionDate: new Date(),
      inspectorName: 'Петров Петр Петрович',
      overallCondition: 'Хорошее',
      damages: [
        {
          id: 'DMG001',
          location: 'front_wall',
          description: 'Небольшая царапина',
          severity: 'minor',
        },
      ],
      transportInfo: {
        truckNumber: 'А123БВ77',
        driverName: 'Иванов Иван Иванович',
        transportCompany: 'ООО "Транспорт-Логистик"',
      },
    };
  }
}