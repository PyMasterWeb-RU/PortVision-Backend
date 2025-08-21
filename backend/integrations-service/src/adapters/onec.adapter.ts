import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import axios, { AxiosInstance } from 'axios';
import * as https from 'https';
import * as crypto from 'crypto';
import { IntegrationEndpoint } from '../entities/integration-endpoint.entity';

export interface OneCDocument {
  documentId: string;
  documentType: OneCDocumentType;
  documentNumber: string;
  documentDate: Date;
  organization: string;
  counterparty?: string;
  currency: string;
  amount: number;
  status: 'draft' | 'posted' | 'canceled';
  lines: OneCDocumentLine[];
  metadata?: Record<string, any>;
}

export interface OneCDocumentLine {
  lineId: string;
  serviceType: string;
  description: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  vatRate?: number;
  vatAmount?: number;
  containerNumber?: string;
  vesselName?: string;
  voyage?: string;
  metadata?: Record<string, any>;
}

export type OneCDocumentType = 
  | 'SalesInvoice'           // Счет на оплату
  | 'PurchaseInvoice'        // Счет поставщика
  | 'CashReceipt'           // Приходный кассовый ордер
  | 'CashExpense'           // Расходный кассовый ордер
  | 'BankReceipt'           // Поступление на расчетный счет
  | 'BankExpense'           // Списание с расчетного счета
  | 'ServiceAct'            // Акт выполненных работ
  | 'InventoryTransfer'     // Перемещение товаров
  | 'PriceList'             // Прайс-лист
  | 'ContainerOperation'    // Операция с контейнером
  | 'VesselOperation';      // Операция с судном

export interface OneCClient {
  clientId: string;
  clientCode: string;
  fullName: string;
  shortName: string;
  inn?: string;          // ИНН (налоговый номер)
  kpp?: string;          // КПП
  ogrn?: string;         // ОГРН
  legalAddress?: string;
  actualAddress?: string;
  phone?: string;
  email?: string;
  contactPerson?: string;
  contractNumber?: string;
  contractDate?: Date;
  paymentTerms?: number; // дни
  creditLimit?: number;
  vatRegistration: boolean;
  clientType: 'legal' | 'individual' | 'foreign';
  isActive: boolean;
  metadata?: Record<string, any>;
}

export interface OneCService {
  serviceId: string;
  serviceCode: string;
  serviceName: string;
  serviceGroup: string;
  unitOfMeasure: string;
  basePrice: number;
  currency: string;
  vatRate: number;
  isActive: boolean;
  description?: string;
  serviceType: 'container_handling' | 'storage' | 'transport' | 'customs' | 'additional';
  billingRules?: {
    minimumCharge?: number;
    rateType: 'fixed' | 'per_unit' | 'per_day' | 'per_hour';
    freeTime?: number; // дни
    demurrageRate?: number;
  };
  metadata?: Record<string, any>;
}

export interface OneCConnectionConfig {
  baseUrl: string;
  database: string;
  username: string;
  password: string;
  webServicePath: string;
  authentication: {
    type: 'basic' | 'digest' | 'ntlm' | 'oauth';
    domain?: string;
    tokenUrl?: string;
  };
  exchangePlans: Array<{
    name: string;
    direction: 'import' | 'export' | 'bidirectional';
    schedule: string; // cron expression
    enabled: boolean;
  }>;
  dataMapping: {
    organizations: Record<string, string>;
    currencies: Record<string, string>;
    vatRates: Record<number, string>;
    services: Record<string, string>;
  };
  settings: {
    timeout: number;
    retryAttempts: number;
    batchSize: number;
    useCompression: boolean;
    validateCertificates: boolean;
    exchangeFormat: 'xml' | 'json';
  };
}

export interface OneCDataExchange {
  exchangeId: string;
  planName: string;
  direction: 'import' | 'export';
  status: 'pending' | 'running' | 'completed' | 'error';
  startTime: Date;
  endTime?: Date;
  recordsTotal: number;
  recordsProcessed: number;
  recordsSuccess: number;
  recordsError: number;
  errors: Array<{
    recordId: string;
    errorMessage: string;
    errorCode?: string;
  }>;
  metadata?: Record<string, any>;
}

@Injectable()
export class OneCAdapter implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OneCAdapter.name);
  private readonly connections = new Map<string, AxiosInstance>();
  private readonly exchanges = new Map<string, OneCDataExchange>();
  private readonly scheduledJobs = new Map<string, NodeJS.Timeout>();

  constructor(private readonly eventEmitter: EventEmitter2) {}

  async onModuleInit() {
    this.logger.log('💰 Инициализация 1С адаптера...');
  }

  async onModuleDestroy() {
    this.logger.log('🔄 Завершение работы 1С адаптера...');
    
    // Очищаем все scheduled jobs
    for (const [endpointId, job] of this.scheduledJobs) {
      clearInterval(job);
    }
    
    // Отключаем все соединения
    for (const [endpointId, connection] of this.connections) {
      try {
        await this.disconnect(endpointId);
      } catch (error) {
        this.logger.error(`❌ Ошибка отключения 1С ${endpointId}:`, error.message);
      }
    }
  }

  async connect(endpoint: IntegrationEndpoint): Promise<boolean> {
    const endpointId = endpoint.id;
    const config = endpoint.connectionConfig.onecConfig as OneCConnectionConfig;

    try {
      this.logger.log(`🔌 Подключение к 1С базе ${endpoint.name}...`);

      if (this.connections.has(endpointId)) {
        this.logger.warn(`⚠️ 1С соединение ${endpointId} уже установлено`);
        return true;
      }

      // Создаем HTTP клиент для 1С веб-сервисов
      const axiosInstance = this.createAxiosInstance(config, endpoint);
      
      // Тестируем соединение
      const connectionTest = await this.testOneСConnection(axiosInstance, config);
      
      if (!connectionTest.success) {
        throw new Error(`Ошибка подключения к 1С: ${connectionTest.error}`);
      }

      this.connections.set(endpointId, axiosInstance);

      // Запускаем планы обмена
      this.startExchangePlans(endpointId, config, endpoint);

      this.logger.log(`✅ 1С база ${endpoint.name} подключена`);

      this.eventEmitter.emit('onec.connected', {
        endpointId,
        endpointName: endpoint.name,
        database: config.database,
        timestamp: new Date(),
      });

      return true;

    } catch (error) {
      this.logger.error(`❌ Ошибка подключения к 1С ${endpoint.name}:`, error.stack);
      return false;
    }
  }

  async disconnect(endpointId: string): Promise<void> {
    const job = this.scheduledJobs.get(endpointId);
    
    if (job) {
      clearInterval(job);
      this.scheduledJobs.delete(endpointId);
    }
    
    if (this.connections.has(endpointId)) {
      this.connections.delete(endpointId);
      this.logger.log(`🔌 1С соединение ${endpointId} отключено`);
    }
  }

  private createAxiosInstance(
    config: OneCConnectionConfig,
    endpoint: IntegrationEndpoint,
  ): AxiosInstance {
    const baseURL = `${config.baseUrl}/${config.database}/${config.webServicePath}`;
    
    const axiosConfig: any = {
      baseURL,
      timeout: config.settings.timeout || 30000,
      headers: {
        'Content-Type': config.settings.exchangeFormat === 'json' 
          ? 'application/json' 
          : 'application/xml',
        'Accept': config.settings.exchangeFormat === 'json' 
          ? 'application/json' 
          : 'application/xml',
      },
    };

    // Настройка аутентификации
    if (config.authentication.type === 'basic') {
      axiosConfig.auth = {
        username: config.username,
        password: config.password,
      };
    }

    // Настройка HTTPS
    if (config.baseUrl.startsWith('https://')) {
      axiosConfig.httpsAgent = new https.Agent({
        rejectUnauthorized: config.settings.validateCertificates,
      });
    }

    // Сжатие
    if (config.settings.useCompression) {
      axiosConfig.headers['Accept-Encoding'] = 'gzip, deflate';
    }

    const instance = axios.create(axiosConfig);

    // Interceptors для логирования
    instance.interceptors.request.use(
      (config) => {
        this.logger.debug(`➡️ 1С запрос: ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      },
      (error) => {
        this.logger.error('❌ Ошибка 1С запроса:', error.message);
        return Promise.reject(error);
      }
    );

    instance.interceptors.response.use(
      (response) => {
        this.logger.debug(`⬅️ 1С ответ: ${response.status} ${response.statusText}`);
        return response;
      },
      (error) => {
        this.logger.error('❌ Ошибка 1С ответа:', error.response?.data || error.message);
        return Promise.reject(error);
      }
    );

    return instance;
  }

  private async testOneСConnection(
    axiosInstance: AxiosInstance,
    config: OneCConnectionConfig,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Тестируем соединение запросом информации о базе
      const response = await axiosInstance.get('/InfoBase');
      
      if (response.status === 200) {
        return { success: true };
      } else {
        return { success: false, error: `HTTP ${response.status}` };
      }
    } catch (error) {
      return { 
        success: false, 
        error: error.response?.data?.message || error.message 
      };
    }
  }

  private startExchangePlans(
    endpointId: string,
    config: OneCConnectionConfig,
    endpoint: IntegrationEndpoint,
  ): void {
    const enabledPlans = config.exchangePlans.filter(plan => plan.enabled);
    
    if (enabledPlans.length === 0) {
      return;
    }

    // Для простоты используем интервал вместо cron
    const job = setInterval(async () => {
      for (const plan of enabledPlans) {
        try {
          await this.executeExchangePlan(endpointId, plan, config, endpoint);
        } catch (error) {
          this.logger.error(`❌ Ошибка выполнения плана обмена ${plan.name}:`, error.message);
        }
      }
    }, 60000); // каждую минуту

    this.scheduledJobs.set(endpointId, job);
  }

  private async executeExchangePlan(
    endpointId: string,
    plan: OneCConnectionConfig['exchangePlans'][0],
    config: OneCConnectionConfig,
    endpoint: IntegrationEndpoint,
  ): Promise<void> {
    const exchangeId = `${plan.name}_${Date.now()}`;
    
    const exchange: OneCDataExchange = {
      exchangeId,
      planName: plan.name,
      direction: plan.direction,
      status: 'running',
      startTime: new Date(),
      recordsTotal: 0,
      recordsProcessed: 0,
      recordsSuccess: 0,
      recordsError: 0,
      errors: [],
    };

    this.exchanges.set(exchangeId, exchange);

    try {
      if (plan.direction === 'import' || plan.direction === 'bidirectional') {
        await this.importDataFromOneC(endpointId, plan, config, exchange);
      }

      if (plan.direction === 'export' || plan.direction === 'bidirectional') {
        await this.exportDataToOneC(endpointId, plan, config, exchange);
      }

      exchange.status = 'completed';
      exchange.endTime = new Date();

      this.logger.log(
        `✅ План обмена ${plan.name} выполнен: ` +
        `${exchange.recordsSuccess}/${exchange.recordsTotal} записей`
      );

    } catch (error) {
      exchange.status = 'error';
      exchange.endTime = new Date();
      exchange.errors.push({
        recordId: 'GENERAL',
        errorMessage: error.message,
      });

      this.logger.error(`❌ Ошибка плана обмена ${plan.name}:`, error.message);
    }

    // Отправляем событие о завершении обмена
    this.eventEmitter.emit('onec.exchange.completed', {
      endpointId,
      endpointName: endpoint.name,
      exchange,
      timestamp: new Date(),
    });
  }

  private async importDataFromOneC(
    endpointId: string,
    plan: OneCConnectionConfig['exchangePlans'][0],
    config: OneCConnectionConfig,
    exchange: OneCDataExchange,
  ): Promise<void> {
    const axiosInstance = this.connections.get(endpointId);
    if (!axiosInstance) {
      throw new Error('1С соединение не найдено');
    }

    try {
      switch (plan.name) {
        case 'clients':
          await this.importClients(axiosInstance, config, exchange);
          break;
        case 'services':
          await this.importServices(axiosInstance, config, exchange);
          break;
        case 'documents':
          await this.importDocuments(axiosInstance, config, exchange);
          break;
        default:
          this.logger.warn(`⚠️ Неизвестный план импорта: ${plan.name}`);
      }
    } catch (error) {
      this.logger.error(`❌ Ошибка импорта ${plan.name} из 1С:`, error.message);
      throw error;
    }
  }

  private async exportDataToOneC(
    endpointId: string,
    plan: OneCConnectionConfig['exchangePlans'][0],
    config: OneCConnectionConfig,
    exchange: OneCDataExchange,
  ): Promise<void> {
    const axiosInstance = this.connections.get(endpointId);
    if (!axiosInstance) {
      throw new Error('1С соединение не найдено');
    }

    try {
      switch (plan.name) {
        case 'invoices':
          await this.exportInvoices(axiosInstance, config, exchange);
          break;
        case 'operations':
          await this.exportOperations(axiosInstance, config, exchange);
          break;
        default:
          this.logger.warn(`⚠️ Неизвестный план экспорта: ${plan.name}`);
      }
    } catch (error) {
      this.logger.error(`❌ Ошибка экспорта ${plan.name} в 1С:`, error.message);
      throw error;
    }
  }

  private async importClients(
    axiosInstance: AxiosInstance,
    config: OneCConnectionConfig,
    exchange: OneCDataExchange,
  ): Promise<void> {
    try {
      const response = await axiosInstance.get('/Catalog/Counterparties', {
        params: {
          $format: config.settings.exchangeFormat,
          $top: config.settings.batchSize,
        },
      });

      const clients = this.parseClientsResponse(response.data, config);
      exchange.recordsTotal = clients.length;

      for (const client of clients) {
        try {
          // Отправляем событие о новом/обновленном клиенте
          this.eventEmitter.emit('onec.client.imported', {
            client,
            timestamp: new Date(),
          });

          exchange.recordsProcessed++;
          exchange.recordsSuccess++;
        } catch (error) {
          exchange.recordsError++;
          exchange.errors.push({
            recordId: client.clientId,
            errorMessage: error.message,
          });
        }
      }
    } catch (error) {
      this.logger.error('❌ Ошибка импорта клиентов:', error.message);
      throw error;
    }
  }

  private async importServices(
    axiosInstance: AxiosInstance,
    config: OneCConnectionConfig,
    exchange: OneCDataExchange,
  ): Promise<void> {
    try {
      const response = await axiosInstance.get('/Catalog/Services', {
        params: {
          $format: config.settings.exchangeFormat,
          $top: config.settings.batchSize,
        },
      });

      const services = this.parseServicesResponse(response.data, config);
      exchange.recordsTotal = services.length;

      for (const service of services) {
        try {
          // Отправляем событие о новой/обновленной услуге
          this.eventEmitter.emit('onec.service.imported', {
            service,
            timestamp: new Date(),
          });

          exchange.recordsProcessed++;
          exchange.recordsSuccess++;
        } catch (error) {
          exchange.recordsError++;
          exchange.errors.push({
            recordId: service.serviceId,
            errorMessage: error.message,
          });
        }
      }
    } catch (error) {
      this.logger.error('❌ Ошибка импорта услуг:', error.message);
      throw error;
    }
  }

  private async importDocuments(
    axiosInstance: AxiosInstance,
    config: OneCConnectionConfig,
    exchange: OneCDataExchange,
  ): Promise<void> {
    try {
      // Импортируем различные типы документов
      const documentTypes = ['SalesInvoice', 'ServiceAct', 'CashReceipt'];
      
      for (const docType of documentTypes) {
        const response = await axiosInstance.get(`/Document/${docType}`, {
          params: {
            $format: config.settings.exchangeFormat,
            $filter: "Posted eq true",
            $top: config.settings.batchSize,
          },
        });

        const documents = this.parseDocumentsResponse(response.data, docType as OneCDocumentType, config);
        exchange.recordsTotal += documents.length;

        for (const document of documents) {
          try {
            // Отправляем событие о новом/обновленном документе
            this.eventEmitter.emit('onec.document.imported', {
              document,
              timestamp: new Date(),
            });

            exchange.recordsProcessed++;
            exchange.recordsSuccess++;
          } catch (error) {
            exchange.recordsError++;
            exchange.errors.push({
              recordId: document.documentId,
              errorMessage: error.message,
            });
          }
        }
      }
    } catch (error) {
      this.logger.error('❌ Ошибка импорта документов:', error.message);
      throw error;
    }
  }

  private async exportInvoices(
    axiosInstance: AxiosInstance,
    config: OneCConnectionConfig,
    exchange: OneCDataExchange,
  ): Promise<void> {
    // Здесь должна быть логика получения счетов из PortVision 360
    // и отправки их в 1С
    this.logger.debug('📤 Экспорт счетов в 1С...');
    
    // Заглушка для демонстрации
    const invoices = await this.getPendingInvoicesForExport();
    exchange.recordsTotal = invoices.length;

    for (const invoice of invoices) {
      try {
        const onecDocument = this.mapInvoiceToOneCFormat(invoice, config);
        
        const response = await axiosInstance.post('/Document/SalesInvoice', onecDocument);
        
        if (response.status === 201) {
          exchange.recordsProcessed++;
          exchange.recordsSuccess++;
          
          // Отправляем событие об успешном экспорте
          this.eventEmitter.emit('onec.invoice.exported', {
            invoiceId: invoice.id,
            onecDocumentId: response.data.Ref_Key,
            timestamp: new Date(),
          });
        }
      } catch (error) {
        exchange.recordsError++;
        exchange.errors.push({
          recordId: invoice.id,
          errorMessage: error.message,
        });
      }
    }
  }

  private async exportOperations(
    axiosInstance: AxiosInstance,
    config: OneCConnectionConfig,
    exchange: OneCDataExchange,
  ): Promise<void> {
    // Экспорт операций (контейнерные операции, движения и т.д.)
    this.logger.debug('📤 Экспорт операций в 1С...');
    
    // Заглушка для демонстрации
    const operations = await this.getPendingOperationsForExport();
    exchange.recordsTotal = operations.length;

    for (const operation of operations) {
      try {
        const onecDocument = this.mapOperationToOneCFormat(operation, config);
        
        const response = await axiosInstance.post('/Document/ContainerOperation', onecDocument);
        
        if (response.status === 201) {
          exchange.recordsProcessed++;
          exchange.recordsSuccess++;
        }
      } catch (error) {
        exchange.recordsError++;
        exchange.errors.push({
          recordId: operation.id,
          errorMessage: error.message,
        });
      }
    }
  }

  private parseClientsResponse(data: any, config: OneCConnectionConfig): OneCClient[] {
    const clients: OneCClient[] = [];
    
    // Парсинг зависит от формата ответа (JSON или XML)
    if (config.settings.exchangeFormat === 'json') {
      const items = data.value || [];
      
      for (const item of items) {
        clients.push({
          clientId: item.Ref_Key,
          clientCode: item.Code,
          fullName: item.Description,
          shortName: item.ShortName || item.Description,
          inn: item.INN,
          kpp: item.KPP,
          ogrn: item.OGRN,
          legalAddress: item.LegalAddress,
          actualAddress: item.ActualAddress,
          phone: item.Phone,
          email: item.Email,
          contactPerson: item.ContactPerson,
          contractNumber: item.MainContract?.Number,
          contractDate: item.MainContract?.Date ? new Date(item.MainContract.Date) : undefined,
          paymentTerms: item.PaymentTerms || 0,
          creditLimit: item.CreditLimit || 0,
          vatRegistration: item.VATRegistration === true,
          clientType: this.mapClientType(item.ClientType),
          isActive: !item.DeletionMark,
        });
      }
    }

    return clients;
  }

  private parseServicesResponse(data: any, config: OneCConnectionConfig): OneCService[] {
    const services: OneCService[] = [];
    
    if (config.settings.exchangeFormat === 'json') {
      const items = data.value || [];
      
      for (const item of items) {
        services.push({
          serviceId: item.Ref_Key,
          serviceCode: item.Code,
          serviceName: item.Description,
          serviceGroup: item.ServiceGroup?.Description || 'Общие',
          unitOfMeasure: item.BaseUnit?.Description || 'шт',
          basePrice: item.BasePrice || 0,
          currency: config.dataMapping.currencies[item.Currency?.Code] || 'RUB',
          vatRate: item.VATRate || 20,
          isActive: !item.DeletionMark,
          description: item.Comment,
          serviceType: this.mapServiceType(item.ServiceType),
          billingRules: {
            rateType: item.RateType || 'fixed',
            minimumCharge: item.MinimumCharge,
            freeTime: item.FreeTime,
            demurrageRate: item.DemurrageRate,
          },
        });
      }
    }

    return services;
  }

  private parseDocumentsResponse(
    data: any, 
    documentType: OneCDocumentType, 
    config: OneCConnectionConfig
  ): OneCDocument[] {
    const documents: OneCDocument[] = [];
    
    if (config.settings.exchangeFormat === 'json') {
      const items = data.value || [];
      
      for (const item of items) {
        const lines: OneCDocumentLine[] = [];
        
        // Парсинг табличной части
        if (item.Services && Array.isArray(item.Services)) {
          for (const line of item.Services) {
            lines.push({
              lineId: line.LineNumber.toString(),
              serviceType: line.Service?.Description || '',
              description: line.Description || '',
              quantity: line.Quantity || 1,
              unitPrice: line.Price || 0,
              totalAmount: line.Amount || 0,
              vatRate: line.VATRate || 20,
              vatAmount: line.VATAmount || 0,
              containerNumber: line.ContainerNumber,
              vesselName: line.VesselName,
              voyage: line.Voyage,
            });
          }
        }

        documents.push({
          documentId: item.Ref_Key,
          documentType,
          documentNumber: item.Number,
          documentDate: new Date(item.Date),
          organization: item.Company?.Description || '',
          counterparty: item.Counterparty?.Description,
          currency: config.dataMapping.currencies[item.Currency?.Code] || 'RUB',
          amount: item.DocumentAmount || 0,
          status: item.Posted ? 'posted' : 'draft',
          lines,
        });
      }
    }

    return documents;
  }

  private mapClientType(onecType: string): OneCClient['clientType'] {
    switch (onecType) {
      case 'LegalEntity':
        return 'legal';
      case 'Individual':
        return 'individual';
      case 'ForeignEntity':
        return 'foreign';
      default:
        return 'legal';
    }
  }

  private mapServiceType(onecType: string): OneCService['serviceType'] {
    switch (onecType) {
      case 'ContainerHandling':
        return 'container_handling';
      case 'Storage':
        return 'storage';
      case 'Transport':
        return 'transport';
      case 'Customs':
        return 'customs';
      default:
        return 'additional';
    }
  }

  private async getPendingInvoicesForExport(): Promise<any[]> {
    // Заглушка - здесь должен быть запрос к БД PortVision 360
    return [];
  }

  private async getPendingOperationsForExport(): Promise<any[]> {
    // Заглушка - здесь должен быть запрос к БД PortVision 360
    return [];
  }

  private mapInvoiceToOneCFormat(invoice: any, config: OneCConnectionConfig): any {
    return {
      Date: invoice.date,
      Company: config.dataMapping.organizations[invoice.organizationId],
      Counterparty: invoice.clientId,
      Currency: config.dataMapping.currencies[invoice.currency],
      Services: invoice.lines.map((line: any) => ({
        Service: config.dataMapping.services[line.serviceId],
        Quantity: line.quantity,
        Price: line.unitPrice,
        Amount: line.totalAmount,
        VATRate: config.dataMapping.vatRates[line.vatRate],
        ContainerNumber: line.containerNumber,
        VesselName: line.vesselName,
        Voyage: line.voyage,
      })),
    };
  }

  private mapOperationToOneCFormat(operation: any, config: OneCConnectionConfig): any {
    return {
      Date: operation.date,
      Company: config.dataMapping.organizations[operation.organizationId],
      OperationType: operation.type,
      ContainerNumber: operation.containerNumber,
      VesselName: operation.vesselName,
      Voyage: operation.voyage,
      Equipment: operation.equipmentId,
      Operator: operation.operatorId,
    };
  }

  // Публичные методы для внешнего использования
  async getClients(endpointId: string): Promise<OneCClient[]> {
    const axiosInstance = this.connections.get(endpointId);
    if (!axiosInstance) {
      throw new Error('1С соединение не найдено');
    }

    try {
      const response = await axiosInstance.get('/Catalog/Counterparties');
      return this.parseClientsResponse(response.data, {} as OneCConnectionConfig);
    } catch (error) {
      this.logger.error('❌ Ошибка получения клиентов из 1С:', error.message);
      throw error;
    }
  }

  async getServices(endpointId: string): Promise<OneCService[]> {
    const axiosInstance = this.connections.get(endpointId);
    if (!axiosInstance) {
      throw new Error('1С соединение не найдено');
    }

    try {
      const response = await axiosInstance.get('/Catalog/Services');
      return this.parseServicesResponse(response.data, {} as OneCConnectionConfig);
    } catch (error) {
      this.logger.error('❌ Ошибка получения услуг из 1С:', error.message);
      throw error;
    }
  }

  async createDocument(
    endpointId: string,
    documentType: OneCDocumentType,
    documentData: Partial<OneCDocument>,
  ): Promise<string> {
    const axiosInstance = this.connections.get(endpointId);
    if (!axiosInstance) {
      throw new Error('1С соединение не найдено');
    }

    try {
      const response = await axiosInstance.post(`/Document/${documentType}`, documentData);
      
      this.logger.log(`📄 Документ ${documentType} создан в 1С: ${response.data.Ref_Key}`);
      
      return response.data.Ref_Key;
    } catch (error) {
      this.logger.error(`❌ Ошибка создания документа ${documentType} в 1С:`, error.message);
      throw error;
    }
  }

  async getExchanges(endpointId?: string): Promise<OneCDataExchange[]> {
    if (endpointId) {
      return Array.from(this.exchanges.values()).filter(
        exchange => exchange.exchangeId.includes(endpointId)
      );
    }
    
    return Array.from(this.exchanges.values());
  }

  async getExchange(exchangeId: string): Promise<OneCDataExchange | undefined> {
    return this.exchanges.get(exchangeId);
  }

  async getConnectionStats(endpointId?: string) {
    const stats = {
      totalConnections: this.connections.size,
      activeExchanges: Array.from(this.exchanges.values()).filter(e => e.status === 'running').length,
      completedExchanges: Array.from(this.exchanges.values()).filter(e => e.status === 'completed').length,
      errorExchanges: Array.from(this.exchanges.values()).filter(e => e.status === 'error').length,
      scheduledJobs: this.scheduledJobs.size,
    };

    return stats;
  }

  async testConnection(endpoint: IntegrationEndpoint): Promise<boolean> {
    try {
      const config = endpoint.connectionConfig.onecConfig as OneCConnectionConfig;
      const axiosInstance = this.createAxiosInstance(config, endpoint);
      const result = await this.testOneСConnection(axiosInstance, config);
      return result.success;
    } catch (error) {
      this.logger.error(`❌ Тест 1С соединения неудачен для ${endpoint.name}:`, error.message);
      return false;
    }
  }

  async clearExchangeHistory(exchangeId?: string): Promise<void> {
    if (exchangeId) {
      this.exchanges.delete(exchangeId);
      this.logger.log(`🧹 История обмена ${exchangeId} очищена`);
    } else {
      this.exchanges.clear();
      this.logger.log('🧹 Вся история обменов 1С очищена');
    }
  }
}