import {
  Injectable,
  Logger,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { 
  OneCAdapter, 
  OneCDocument, 
  OneCClient, 
  OneCService,
  OneCDocumentType,
  OneCDataExchange 
} from '../adapters/onec.adapter';
import { DataTransformationService } from '../services/data-transformation.service';
import { RoutingService } from '../services/routing.service';
import { MetricsService } from '../services/metrics.service';
import { IntegrationEndpoint } from '../entities/integration-endpoint.entity';

export interface OneCProcessingRequest {
  endpointId: string;
  action: 'sync_clients' | 'sync_services' | 'create_invoice' | 'create_operation' | 'get_exchanges' | 'manual_export';
  documentType?: OneCDocumentType;
  documentData?: any;
  clientData?: Partial<OneCClient>;
  serviceData?: Partial<OneCService>;
  metadata?: {
    operatorId?: string;
    sessionId?: string;
    priority?: 'low' | 'normal' | 'high' | 'urgent';
    correlationId?: string;
    organizationId?: string;
  };
}

export interface OneCProcessingResult {
  success: boolean;
  action: string;
  endpointId: string;
  data?: any;
  errors?: string[];
  processingTime: number;
  documentCount?: number;
  exchangeStats?: any;
  metadata?: any;
}

export interface OneCBusinessEvent {
  eventId: string;
  eventType: 'client_imported' | 'service_imported' | 'document_created' | 'invoice_exported' | 'operation_exported' | 'exchange_completed';
  timestamp: Date;
  sourceExchange?: {
    exchangeId: string;
    planName: string;
    direction: 'import' | 'export';
  };
  businessData: {
    clients?: OneCClient[];
    services?: OneCService[];
    documents?: OneCDocument[];
    invoices?: any[];
    operations?: any[];
    exchangeResults?: OneCDataExchange;
  };
  affectedEntities: Array<{
    entityType: 'client' | 'service' | 'document' | 'invoice' | 'operation';
    entityId: string;
    action: 'create' | 'update' | 'sync' | 'export';
  }>;
  metadata?: any;
}

export interface OneCReportData {
  totalClients: number;
  totalServices: number;
  totalDocuments: number;
  exchangesByType: Record<string, number>;
  exchangesByStatus: Record<string, number>;
  recentExchanges: Array<{
    exchangeId: string;
    planName: string;
    direction: string;
    status: string;
    timestamp: Date;
    recordsProcessed: number;
  }>;
  errorSummary: {
    totalErrors: number;
    errorsByType: Record<string, number>;
    recentErrors: string[];
  };
  performanceStats: {
    averageExchangeTime: number;
    documentsPerHour: number;
    successRate: number;
  };
}

@Injectable()
export class OneCProcessor {
  private readonly logger = new Logger(OneCProcessor.name);
  private readonly businessEvents = new Map<string, OneCBusinessEvent>();
  private readonly exchangeHistory = new Map<string, OneCDataExchange[]>();
  private readonly processingMetrics = new Map<string, number>();

  constructor(
    private readonly onecAdapter: OneCAdapter,
    private readonly dataTransformationService: DataTransformationService,
    private readonly routingService: RoutingService,
    private readonly metricsService: MetricsService,
    private readonly eventEmitter: EventEmitter2,
  ) {
    this.setupEventListeners();
  }

  async processOneCRequest(
    request: OneCProcessingRequest,
    endpoint: IntegrationEndpoint,
  ): Promise<OneCProcessingResult> {
    const startTime = Date.now();
    
    this.logger.log(`💰 Обработка 1С запроса ${request.action} для интеграции ${endpoint.name}`);

    const result: OneCProcessingResult = {
      success: false,
      action: request.action,
      endpointId: request.endpointId,
      errors: [],
      processingTime: 0,
    };

    try {
      switch (request.action) {
        case 'sync_clients':
          result.data = await this.handleSyncClients(endpoint);
          result.success = true;
          break;

        case 'sync_services':
          result.data = await this.handleSyncServices(endpoint);
          result.success = true;
          break;

        case 'create_invoice':
          if (!request.documentData) {
            throw new Error('Не указаны данные счета для создания');
          }
          result.data = await this.handleCreateInvoice(endpoint, request.documentData, request.metadata);
          result.success = !!result.data;
          break;

        case 'create_operation':
          if (!request.documentData) {
            throw new Error('Не указаны данные операции для создания');
          }
          result.data = await this.handleCreateOperation(endpoint, request.documentData, request.metadata);
          result.success = !!result.data;
          break;

        case 'get_exchanges':
          result.data = await this.handleGetExchanges(endpoint);
          result.success = true;
          break;

        case 'manual_export':
          result.data = await this.handleManualExport(endpoint, request.metadata);
          result.success = true;
          break;

        default:
          throw new Error(`Неподдерживаемое действие: ${request.action}`);
      }

      // Получаем статистику соединения
      const stats = await this.onecAdapter.getConnectionStats(request.endpointId);
      result.exchangeStats = stats;
      result.documentCount = stats?.completedExchanges || 0;

      result.processingTime = Date.now() - startTime;

      // Записываем метрики
      await this.metricsService.recordMessage(
        endpoint.id,
        JSON.stringify(request).length,
        result.processingTime,
      );

      this.logger.log(
        `✅ 1С запрос ${request.action} обработан для ${endpoint.name}: ` +
        `${result.processingTime}ms`
      );

      return result;

    } catch (error) {
      result.success = false;
      result.errors.push(error.message);
      result.processingTime = Date.now() - startTime;

      this.logger.error(`❌ Ошибка обработки 1С запроса ${request.action}:`, error.stack);

      await this.metricsService.recordError(
        endpoint.id,
        error.message,
        result.processingTime,
      );

      return result;
    }
  }

  private async handleSyncClients(endpoint: IntegrationEndpoint): Promise<any> {
    try {
      const clients = await this.onecAdapter.getClients(endpoint.id);
      
      this.logger.log(`📥 Синхронизация клиентов из 1С: ${clients.length} записей`);

      // Создаем бизнес-событие
      const businessEvent = await this.createBusinessEvent(
        'client_imported',
        { clients },
        endpoint,
      );

      // Сохраняем событие
      this.businessEvents.set(businessEvent.eventId, businessEvent);

      // Отправляем для дальнейшей обработки
      this.eventEmitter.emit('onec.clients.synchronized', {
        endpointId: endpoint.id,
        clients,
        businessEvent,
        timestamp: new Date(),
      });

      return {
        clientsCount: clients.length,
        clients: clients.slice(0, 10), // Первые 10 для предпросмотра
        eventId: businessEvent.eventId,
      };

    } catch (error) {
      this.logger.error('❌ Ошибка синхронизации клиентов из 1С:', error.message);
      throw error;
    }
  }

  private async handleSyncServices(endpoint: IntegrationEndpoint): Promise<any> {
    try {
      const services = await this.onecAdapter.getServices(endpoint.id);
      
      this.logger.log(`📥 Синхронизация услуг из 1С: ${services.length} записей`);

      // Создаем бизнес-событие
      const businessEvent = await this.createBusinessEvent(
        'service_imported',
        { services },
        endpoint,
      );

      // Сохраняем событие
      this.businessEvents.set(businessEvent.eventId, businessEvent);

      // Отправляем для дальнейшей обработки
      this.eventEmitter.emit('onec.services.synchronized', {
        endpointId: endpoint.id,
        services,
        businessEvent,
        timestamp: new Date(),
      });

      return {
        servicesCount: services.length,
        services: services.slice(0, 10), // Первые 10 для предпросмотра
        eventId: businessEvent.eventId,
      };

    } catch (error) {
      this.logger.error('❌ Ошибка синхронизации услуг из 1С:', error.message);
      throw error;
    }
  }

  private async handleCreateInvoice(
    endpoint: IntegrationEndpoint,
    invoiceData: any,
    metadata?: any,
  ): Promise<string> {
    try {
      // Валидируем данные счета
      this.validateInvoiceData(invoiceData);

      // Преобразуем в формат 1С
      const onecDocument = this.transformToOneCInvoice(invoiceData, metadata);

      // Создаем документ в 1С
      const documentId = await this.onecAdapter.createDocument(
        endpoint.id,
        'SalesInvoice',
        onecDocument,
      );

      this.logger.log(`📄 Счет создан в 1С: ${documentId}`);

      // Создаем бизнес-событие
      const businessEvent = await this.createBusinessEvent(
        'invoice_exported',
        { invoices: [{ ...invoiceData, onecDocumentId: documentId }] },
        endpoint,
        metadata,
      );

      // Сохраняем событие
      this.businessEvents.set(businessEvent.eventId, businessEvent);

      // Отправляем уведомление
      this.eventEmitter.emit('onec.invoice.created', {
        endpointId: endpoint.id,
        invoiceId: invoiceData.id,
        onecDocumentId: documentId,
        businessEvent,
        metadata,
        timestamp: new Date(),
      });

      return documentId;

    } catch (error) {
      this.logger.error('❌ Ошибка создания счета в 1С:', error.message);
      throw error;
    }
  }

  private async handleCreateOperation(
    endpoint: IntegrationEndpoint,
    operationData: any,
    metadata?: any,
  ): Promise<string> {
    try {
      // Валидируем данные операции
      this.validateOperationData(operationData);

      // Преобразуем в формат 1С
      const onecDocument = this.transformToOneCOperation(operationData, metadata);

      // Создаем документ в 1С
      const documentId = await this.onecAdapter.createDocument(
        endpoint.id,
        'ContainerOperation',
        onecDocument,
      );

      this.logger.log(`📄 Операция создана в 1С: ${documentId}`);

      // Создаем бизнес-событие
      const businessEvent = await this.createBusinessEvent(
        'operation_exported',
        { operations: [{ ...operationData, onecDocumentId: documentId }] },
        endpoint,
        metadata,
      );

      // Сохраняем событие
      this.businessEvents.set(businessEvent.eventId, businessEvent);

      // Отправляем уведомление
      this.eventEmitter.emit('onec.operation.created', {
        endpointId: endpoint.id,
        operationId: operationData.id,
        onecDocumentId: documentId,
        businessEvent,
        metadata,
        timestamp: new Date(),
      });

      return documentId;

    } catch (error) {
      this.logger.error('❌ Ошибка создания операции в 1С:', error.message);
      throw error;
    }
  }

  private async handleGetExchanges(endpoint: IntegrationEndpoint): Promise<any> {
    try {
      const exchanges = await this.onecAdapter.getExchanges(endpoint.id);
      
      return this.buildExchangeReport(exchanges, endpoint);

    } catch (error) {
      this.logger.error('❌ Ошибка получения обменов 1С:', error.message);
      throw error;
    }
  }

  private async handleManualExport(endpoint: IntegrationEndpoint, metadata?: any): Promise<any> {
    try {
      this.logger.log('📤 Запуск ручного экспорта данных в 1С...');

      // Получаем готовые к экспорту данные из PortVision 360
      const pendingInvoices = await this.getPendingInvoicesForExport();
      const pendingOperations = await this.getPendingOperationsForExport();

      const results = {
        invoices: { success: 0, errors: 0 },
        operations: { success: 0, errors: 0 },
        totalProcessed: 0,
      };

      // Экспортируем счета
      for (const invoice of pendingInvoices) {
        try {
          await this.handleCreateInvoice(endpoint, invoice, metadata);
          results.invoices.success++;
        } catch (error) {
          results.invoices.errors++;
          this.logger.error(`❌ Ошибка экспорта счета ${invoice.id}:`, error.message);
        }
      }

      // Экспортируем операции
      for (const operation of pendingOperations) {
        try {
          await this.handleCreateOperation(endpoint, operation, metadata);
          results.operations.success++;
        } catch (error) {
          results.operations.errors++;
          this.logger.error(`❌ Ошибка экспорта операции ${operation.id}:`, error.message);
        }
      }

      results.totalProcessed = pendingInvoices.length + pendingOperations.length;

      this.logger.log(
        `✅ Ручной экспорт завершен: ${results.totalProcessed} записей, ` +
        `успешно: ${results.invoices.success + results.operations.success}, ` +
        `ошибок: ${results.invoices.errors + results.operations.errors}`
      );

      return results;

    } catch (error) {
      this.logger.error('❌ Ошибка ручного экспорта в 1С:', error.message);
      throw error;
    }
  }

  private validateInvoiceData(data: any): void {
    if (!data.clientId) {
      throw new Error('Не указан клиент для счета');
    }

    if (!data.lines || !Array.isArray(data.lines) || data.lines.length === 0) {
      throw new Error('Счет должен содержать строки с услугами');
    }

    for (const line of data.lines) {
      if (!line.serviceId || !line.quantity || !line.unitPrice) {
        throw new Error('Все строки счета должны содержать услугу, количество и цену');
      }
    }
  }

  private validateOperationData(data: any): void {
    if (!data.containerNumber) {
      throw new Error('Не указан номер контейнера для операции');
    }

    if (!data.operationType) {
      throw new Error('Не указан тип операции');
    }

    if (!data.equipmentId && data.operationType !== 'gate_in') {
      throw new Error('Для большинства операций требуется указание оборудования');
    }
  }

  private transformToOneCInvoice(invoiceData: any, metadata?: any): Partial<OneCDocument> {
    const lines = invoiceData.lines.map((line: any) => ({
      lineId: line.id || line.lineNumber?.toString() || '',
      serviceType: line.serviceName || '',
      description: line.description || line.serviceName || '',
      quantity: line.quantity || 1,
      unitPrice: line.unitPrice || 0,
      totalAmount: line.totalAmount || (line.quantity * line.unitPrice),
      vatRate: line.vatRate || 20,
      vatAmount: line.vatAmount || (line.totalAmount * 0.2),
      containerNumber: line.containerNumber,
      vesselName: line.vesselName,
      voyage: line.voyage,
      metadata: {
        portVisionLineId: line.id,
        serviceId: line.serviceId,
      },
    }));

    return {
      documentType: 'SalesInvoice',
      documentNumber: invoiceData.number || '',
      documentDate: invoiceData.date ? new Date(invoiceData.date) : new Date(),
      organization: metadata?.organizationId || 'default_org',
      counterparty: invoiceData.clientId,
      currency: invoiceData.currency || 'RUB',
      amount: invoiceData.totalAmount || lines.reduce((sum, line) => sum + line.totalAmount, 0),
      status: 'draft',
      lines,
      metadata: {
        portVisionInvoiceId: invoiceData.id,
        operatorId: metadata?.operatorId,
        exportTimestamp: new Date().toISOString(),
      },
    };
  }

  private transformToOneCOperation(operationData: any, metadata?: any): Partial<OneCDocument> {
    return {
      documentType: 'ContainerOperation',
      documentNumber: operationData.id || '',
      documentDate: operationData.timestamp ? new Date(operationData.timestamp) : new Date(),
      organization: metadata?.organizationId || 'default_org',
      currency: 'RUB',
      amount: 0, // Операции обычно не имеют стоимости напрямую
      status: 'posted',
      lines: [{
        lineId: '1',
        serviceType: operationData.operationType,
        description: `${operationData.operationType} - ${operationData.containerNumber}`,
        quantity: 1,
        unitPrice: 0,
        totalAmount: 0,
        containerNumber: operationData.containerNumber,
        vesselName: operationData.vesselName,
        voyage: operationData.voyage,
        metadata: {
          equipmentId: operationData.equipmentId,
          operatorId: operationData.operatorId,
          locationFrom: operationData.locationFrom,
          locationTo: operationData.locationTo,
        },
      }],
      metadata: {
        portVisionOperationId: operationData.id,
        operationType: operationData.operationType,
        equipmentId: operationData.equipmentId,
        operatorId: metadata?.operatorId,
        exportTimestamp: new Date().toISOString(),
      },
    };
  }

  private async createBusinessEvent(
    eventType: OneCBusinessEvent['eventType'],
    businessData: any,
    endpoint: IntegrationEndpoint,
    metadata?: any,
  ): Promise<OneCBusinessEvent> {
    const eventId = `biz_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const affectedEntities = this.extractAffectedEntities(eventType, businessData);

    const businessEvent: OneCBusinessEvent = {
      eventId,
      eventType,
      timestamp: new Date(),
      businessData,
      affectedEntities,
      metadata: {
        endpointId: endpoint.id,
        endpointName: endpoint.name,
        ...metadata,
      },
    };

    return businessEvent;
  }

  private extractAffectedEntities(
    eventType: OneCBusinessEvent['eventType'],
    businessData: any,
  ): OneCBusinessEvent['affectedEntities'] {
    const entities: OneCBusinessEvent['affectedEntities'] = [];

    switch (eventType) {
      case 'client_imported':
        if (businessData.clients) {
          for (const client of businessData.clients) {
            entities.push({
              entityType: 'client',
              entityId: client.clientId,
              action: 'sync',
            });
          }
        }
        break;

      case 'service_imported':
        if (businessData.services) {
          for (const service of businessData.services) {
            entities.push({
              entityType: 'service',
              entityId: service.serviceId,
              action: 'sync',
            });
          }
        }
        break;

      case 'invoice_exported':
        if (businessData.invoices) {
          for (const invoice of businessData.invoices) {
            entities.push({
              entityType: 'invoice',
              entityId: invoice.id || invoice.onecDocumentId,
              action: 'export',
            });
          }
        }
        break;

      case 'operation_exported':
        if (businessData.operations) {
          for (const operation of businessData.operations) {
            entities.push({
              entityType: 'operation',
              entityId: operation.id || operation.onecDocumentId,
              action: 'export',
            });
          }
        }
        break;
    }

    return entities;
  }

  private buildExchangeReport(exchanges: OneCDataExchange[], endpoint: IntegrationEndpoint): OneCReportData {
    const exchangesByType: Record<string, number> = {};
    const exchangesByStatus: Record<string, number> = {};
    const errorsByType: Record<string, number> = {};
    const recentErrors: string[] = [];
    let totalProcessingTime = 0;
    let completedExchanges = 0;

    for (const exchange of exchanges) {
      // Подсчет по типам планов
      exchangesByType[exchange.planName] = (exchangesByType[exchange.planName] || 0) + 1;
      
      // Подсчет по статусам
      exchangesByStatus[exchange.status] = (exchangesByStatus[exchange.status] || 0) + 1;

      // Ошибки
      if (exchange.status === 'error' && exchange.errors) {
        for (const error of exchange.errors) {
          errorsByType[error.errorMessage] = (errorsByType[error.errorMessage] || 0) + 1;
          if (recentErrors.length < 10) {
            recentErrors.push(`${exchange.exchangeId}: ${error.errorMessage}`);
          }
        }
      }

      // Время обработки
      if (exchange.status === 'completed' && exchange.startTime && exchange.endTime) {
        totalProcessingTime += exchange.endTime.getTime() - exchange.startTime.getTime();
        completedExchanges++;
      }
    }

    const recentExchanges = exchanges
      .slice(-10)
      .map(exchange => ({
        exchangeId: exchange.exchangeId,
        planName: exchange.planName,
        direction: exchange.direction,
        status: exchange.status,
        timestamp: exchange.startTime,
        recordsProcessed: exchange.recordsProcessed,
      }));

    return {
      totalClients: 0, // Будет обновлено через события
      totalServices: 0, // Будет обновлено через события
      totalDocuments: exchanges.reduce((sum, ex) => sum + ex.recordsTotal, 0),
      exchangesByType,
      exchangesByStatus,
      recentExchanges,
      errorSummary: {
        totalErrors: Object.values(errorsByType).reduce((sum, count) => sum + count, 0),
        errorsByType,
        recentErrors,
      },
      performanceStats: {
        averageExchangeTime: completedExchanges > 0 ? totalProcessingTime / completedExchanges : 0,
        documentsPerHour: 0, // Расчет за последний час
        successRate: exchanges.length > 0 ? 
          exchanges.filter(ex => ex.status === 'completed').length / exchanges.length * 100 : 0,
      },
    };
  }

  private setupEventListeners(): void {
    // Обрабатываем события от 1С адаптера
    this.eventEmitter.on('onec.client.imported', this.handleClientImported.bind(this));
    this.eventEmitter.on('onec.service.imported', this.handleServiceImported.bind(this));
    this.eventEmitter.on('onec.document.imported', this.handleDocumentImported.bind(this));
    this.eventEmitter.on('onec.exchange.completed', this.handleExchangeCompleted.bind(this));
  }

  private async handleClientImported(event: {
    client: OneCClient;
    timestamp: Date;
  }): Promise<void> {
    try {
      const count = this.processingMetrics.get('clients') || 0;
      this.processingMetrics.set('clients', count + 1);

      this.logger.log(`👤 Клиент импортирован из 1С: ${event.client.fullName} (${event.client.inn || 'без ИНН'})`);

      // Создаем структурированные данные для трансформации
      const structuredData = this.createStructuredClientData(event.client);

      // Отправляем для дальнейшей обработки
      this.eventEmitter.emit('onec.business.event', {
        eventType: 'client_imported',
        structuredData,
        timestamp: event.timestamp,
      });

    } catch (error) {
      this.logger.error('❌ Ошибка обработки импортированного клиента:', error.message);
    }
  }

  private async handleServiceImported(event: {
    service: OneCService;
    timestamp: Date;
  }): Promise<void> {
    try {
      const count = this.processingMetrics.get('services') || 0;
      this.processingMetrics.set('services', count + 1);

      this.logger.log(`🔧 Услуга импортирована из 1С: ${event.service.serviceName} (${event.service.basePrice} ${event.service.currency})`);

      // Создаем структурированные данные для трансформации
      const structuredData = this.createStructuredServiceData(event.service);

      // Отправляем для дальнейшей обработки
      this.eventEmitter.emit('onec.business.event', {
        eventType: 'service_imported',
        structuredData,
        timestamp: event.timestamp,
      });

    } catch (error) {
      this.logger.error('❌ Ошибка обработки импортированной услуги:', error.message);
    }
  }

  private async handleDocumentImported(event: {
    document: OneCDocument;
    timestamp: Date;
  }): Promise<void> {
    try {
      const count = this.processingMetrics.get('documents') || 0;
      this.processingMetrics.set('documents', count + 1);

      this.logger.log(`📄 Документ импортирован из 1С: ${event.document.documentType} №${event.document.documentNumber}`);

      // Создаем структурированные данные для трансформации
      const structuredData = this.createStructuredDocumentData(event.document);

      // Отправляем для дальнейшей обработки
      this.eventEmitter.emit('onec.business.event', {
        eventType: 'document_imported',
        structuredData,
        timestamp: event.timestamp,
      });

    } catch (error) {
      this.logger.error('❌ Ошибка обработки импортированного документа:', error.message);
    }
  }

  private async handleExchangeCompleted(event: {
    endpointId: string;
    endpointName: string;
    exchange: OneCDataExchange;
    timestamp: Date;
  }): Promise<void> {
    try {
      this.logger.log(
        `🔄 Обмен с 1С завершен: ${event.exchange.planName} (${event.exchange.direction}) ` +
        `- ${event.exchange.recordsSuccess}/${event.exchange.recordsTotal} записей`
      );

      // Сохраняем в историю
      const history = this.exchangeHistory.get(event.endpointId) || [];
      history.push(event.exchange);
      this.exchangeHistory.set(event.endpointId, history);

      // Создаем бизнес-событие
      const businessEvent = await this.createBusinessEvent(
        'exchange_completed',
        { exchangeResults: event.exchange },
        { id: event.endpointId, name: event.endpointName } as any,
      );

      // Сохраняем событие
      this.businessEvents.set(businessEvent.eventId, businessEvent);

      await this.metricsService.recordMessage(event.endpointId, event.exchange.recordsTotal, 0);

    } catch (error) {
      this.logger.error('❌ Ошибка обработки завершения обмена:', error.message);
    }
  }

  private createStructuredClientData(client: OneCClient): any {
    return {
      // 1С данные
      oneC: {
        clientId: client.clientId,
        clientCode: client.clientCode,
        inn: client.inn,
        kpp: client.kpp,
        ogrn: client.ogrn,
        vatRegistration: client.vatRegistration,
        clientType: client.clientType,
      },

      // Бизнес-данные для PortVision 360
      business: {
        fullName: client.fullName,
        shortName: client.shortName,
        legalAddress: client.legalAddress,
        actualAddress: client.actualAddress,
        contactInfo: {
          phone: client.phone,
          email: client.email,
          contactPerson: client.contactPerson,
        },
        contractDetails: {
          number: client.contractNumber,
          date: client.contractDate,
          paymentTerms: client.paymentTerms,
          creditLimit: client.creditLimit,
        },
        isActive: client.isActive,
      },

      // Метаданные обработки
      processing: {
        timestamp: new Date(),
        source: '1c_import',
        clientCount: this.processingMetrics.get('clients') || 0,
      },
    };
  }

  private createStructuredServiceData(service: OneCService): any {
    return {
      // 1С данные
      oneC: {
        serviceId: service.serviceId,
        serviceCode: service.serviceCode,
        serviceGroup: service.serviceGroup,
        vatRate: service.vatRate,
      },

      // Бизнес-данные для PortVision 360
      business: {
        serviceName: service.serviceName,
        serviceType: service.serviceType,
        unitOfMeasure: service.unitOfMeasure,
        pricing: {
          basePrice: service.basePrice,
          currency: service.currency,
          billingRules: service.billingRules,
        },
        description: service.description,
        isActive: service.isActive,
      },

      // Метаданные обработки
      processing: {
        timestamp: new Date(),
        source: '1c_import',
        serviceCount: this.processingMetrics.get('services') || 0,
      },
    };
  }

  private createStructuredDocumentData(document: OneCDocument): any {
    return {
      // 1С данные
      oneC: {
        documentId: document.documentId,
        documentType: document.documentType,
        documentNumber: document.documentNumber,
        organization: document.organization,
        status: document.status,
      },

      // Бизнес-данные для PortVision 360
      business: {
        documentDate: document.documentDate,
        counterparty: document.counterparty,
        currency: document.currency,
        amount: document.amount,
        lines: document.lines.map(line => ({
          serviceType: line.serviceType,
          description: line.description,
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          totalAmount: line.totalAmount,
          vatInfo: {
            rate: line.vatRate,
            amount: line.vatAmount,
          },
          containerInfo: {
            containerNumber: line.containerNumber,
            vesselName: line.vesselName,
            voyage: line.voyage,
          },
        })),
      },

      // Метаданные обработки
      processing: {
        timestamp: new Date(),
        source: '1c_import',
        documentCount: this.processingMetrics.get('documents') || 0,
      },
    };
  }

  private async getPendingInvoicesForExport(): Promise<any[]> {
    // Заглушка - здесь должен быть запрос к БД PortVision 360
    // для получения счетов, готовых к экспорту в 1С
    return [];
  }

  private async getPendingOperationsForExport(): Promise<any[]> {
    // Заглушка - здесь должен быть запрос к БД PortVision 360
    // для получения операций, готовых к экспорту в 1С
    return [];
  }

  // Публичные методы для внешнего использования
  async getBusinessEvents(eventType?: OneCBusinessEvent['eventType']): Promise<OneCBusinessEvent[]> {
    const events = Array.from(this.businessEvents.values());
    
    if (eventType) {
      return events.filter(event => event.eventType === eventType);
    }
    
    return events;
  }

  async getBusinessEvent(eventId: string): Promise<OneCBusinessEvent | undefined> {
    return this.businessEvents.get(eventId);
  }

  async getExchangeHistory(endpointId: string): Promise<OneCDataExchange[]> {
    return this.exchangeHistory.get(endpointId) || [];
  }

  async getProcessingStats(endpointId?: string) {
    const connectionStats = await this.onecAdapter.getConnectionStats(endpointId);
    
    return {
      oneC: connectionStats,
      processedClients: this.processingMetrics.get('clients') || 0,
      processedServices: this.processingMetrics.get('services') || 0,
      processedDocuments: this.processingMetrics.get('documents') || 0,
      businessEvents: this.businessEvents.size,
      exchangeHistory: Array.from(this.exchangeHistory.values()).reduce((sum, exchanges) => sum + exchanges.length, 0),
      lastUpdate: new Date(),
    };
  }

  async testOneCConnection(endpoint: IntegrationEndpoint): Promise<boolean> {
    return await this.onecAdapter.testConnection(endpoint);
  }

  async clearBusinessData(eventId?: string): Promise<void> {
    if (eventId) {
      this.businessEvents.delete(eventId);
      this.logger.log(`🧹 Данные бизнес-события ${eventId} очищены`);
    } else {
      this.businessEvents.clear();
      this.exchangeHistory.clear();
      this.processingMetrics.clear();
      this.logger.log('🧹 Все данные 1С бизнес-событий очищены');
    }
  }

  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    details: any;
  }> {
    try {
      const stats = await this.getProcessingStats();
      
      const status = (stats.oneC?.totalConnections || 0) > 0 ? 'healthy' : 
                    (stats.processedClients + stats.processedServices + stats.processedDocuments) > 0 ? 'degraded' : 'unhealthy';
      
      return {
        status,
        details: {
          totalConnections: stats.oneC?.totalConnections || 0,
          activeExchanges: stats.oneC?.activeExchanges || 0,
          completedExchanges: stats.oneC?.completedExchanges || 0,
          processedClients: stats.processedClients,
          processedServices: stats.processedServices,
          processedDocuments: stats.processedDocuments,
          businessEvents: stats.businessEvents,
          exchangeHistory: stats.exchangeHistory,
          lastUpdate: stats.lastUpdate,
        },
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        details: {
          error: error.message,
        },
      };
    }
  }
}