import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import { IntegrationEndpoint } from '../entities/integration-endpoint.entity';

export interface EdiMessage {
  messageId: string;
  messageType: EdiMessageType;
  version: string;
  sender: string;
  receiver: string;
  timestamp: Date;
  controlNumber: string;
  testIndicator?: boolean;
  segments: EdiSegment[];
  rawContent: string;
  status: 'pending' | 'processing' | 'processed' | 'error';
  errors?: string[];
}

export interface EdiSegment {
  tag: string;
  elements: string[];
  compositeElements?: { [key: number]: string[] };
}

export type EdiMessageType = 
  | 'CODECO'    // Container discharge/loading order
  | 'COPRAR'    // Container discharge/loading report
  | 'COPARN'    // Container announcement
  | 'COARRI'    // Container arrival report
  | 'CODEPS'    // Container departure/stuffing
  | 'COHAUL'    // Container haulage report
  | 'MOVINS'    // Stowage instruction
  | 'BAPLIE'    // Bayplan/stowage plan occupied and empty locations
  | 'CALINF'    // Vessel call information
  | 'IFTMIN'    // Instruction message
  | 'IFTMBC'    // Booking confirmation
  | 'IFTMCS'    // Instruction contract status
  | 'IFTDGN'    // Dangerous goods notification
  | 'IFTSTA'    // International multimodal status report;

export interface ContainerInfo {
  containerNumber: string;
  containerType: string;
  containerSize: string;
  sealNumbers?: string[];
  weight?: {
    gross?: number;
    tare?: number;
    net?: number;
    unit: 'KGM' | 'LBR' | 'TON';
  };
  dimensions?: {
    length?: number;
    width?: number;
    height?: number;
    unit: 'MTR' | 'FOT';
  };
  temperature?: {
    setting?: number;
    minimum?: number;
    maximum?: number;
    unit: 'CEL' | 'FAH';
  };
  dangerousGoods?: {
    unNumber?: string;
    class?: string;
    packingGroup?: string;
    properShippingName?: string;
    marinePollutant?: boolean;
  };
  status?: string;
  condition?: string;
}

export interface VesselInfo {
  vesselName: string;
  vesselCode?: string;
  imoNumber?: string;
  callSign?: string;
  voyage: string;
  eta?: Date;
  etd?: Date;
  ata?: Date;
  atd?: Date;
  berthCode?: string;
  portCode: string;
}

export interface EdiConnectionConfig {
  protocol: 'ftp' | 'sftp' | 'ftps' | 'http' | 'https' | 'as2' | 'directory';
  host?: string;
  port?: number;
  username?: string;
  password?: string;
  authentication?: {
    keyFile?: string;
    certFile?: string;
    passphrase?: string;
  };
  directories: {
    incoming: string;
    outgoing: string;
    processed: string;
    error: string;
  };
  messageTypes: EdiMessageType[];
  senderQualifier: string;
  senderId: string;
  receiverQualifier: string;
  receiverId: string;
  testMode: boolean;
  acknowledgmentRequired: boolean;
  encryption?: {
    enabled: boolean;
    algorithm?: string;
    keyFile?: string;
  };
  compression?: {
    enabled: boolean;
    level?: number;
  };
  polling: {
    interval: number; // seconds
    maxRetries: number;
    retryDelay: number;
  };
}

@Injectable()
export class EdiAdapter implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EdiAdapter.name);
  private readonly connections = new Map<string, any>();
  private readonly processingQueue = new Map<string, EdiMessage[]>();
  private readonly messageCache = new Map<string, EdiMessage>();
  private readonly pollingIntervals = new Map<string, NodeJS.Timeout>();

  // EDI control characters
  private readonly ELEMENT_SEPARATOR = '+';
  private readonly COMPOSITE_SEPARATOR = ':';
  private readonly SEGMENT_TERMINATOR = "'";
  private readonly DECIMAL_NOTATION = '.';
  private readonly RELEASE_CHARACTER = '?';

  constructor(private readonly eventEmitter: EventEmitter2) {}

  async onModuleInit() {
    this.logger.log('📋 Инициализация EDI адаптера...');
  }

  async onModuleDestroy() {
    this.logger.log('🔄 Завершение работы EDI адаптера...');
    
    // Очищаем все polling интервалы
    for (const [endpointId, interval] of this.pollingIntervals) {
      clearInterval(interval);
    }
    
    // Отключаем все соединения
    for (const [endpointId, connection] of this.connections) {
      try {
        await this.disconnect(endpointId);
      } catch (error) {
        this.logger.error(`❌ Ошибка отключения EDI ${endpointId}:`, error.message);
      }
    }
  }

  async connect(endpoint: IntegrationEndpoint): Promise<boolean> {
    const endpointId = endpoint.id;
    const config = endpoint.connectionConfig.ediConfig as EdiConnectionConfig;

    try {
      this.logger.log(`🔌 Подключение к EDI партнеру ${endpoint.name}...`);

      if (this.connections.has(endpointId)) {
        this.logger.warn(`⚠️ EDI соединение ${endpointId} уже активно`);
        return true;
      }

      // Создаем необходимые директории
      await this.ensureDirectories(config);

      // Инициализируем соединение в зависимости от протокола
      let connection: any;
      
      switch (config.protocol) {
        case 'ftp':
        case 'sftp':
        case 'ftps':
          connection = await this.createFtpConnection(config, endpoint);
          break;
        case 'http':
        case 'https':
          connection = await this.createHttpConnection(config, endpoint);
          break;
        case 'as2':
          connection = await this.createAs2Connection(config, endpoint);
          break;
        case 'directory':
          connection = await this.createDirectoryConnection(config, endpoint);
          break;
        default:
          throw new Error(`Неподдерживаемый EDI протокол: ${config.protocol}`);
      }

      this.connections.set(endpointId, connection);
      this.processingQueue.set(endpointId, []);

      // Запускаем периодическую проверку входящих сообщений
      this.startPolling(endpointId, config, endpoint);

      this.logger.log(`✅ EDI соединение ${endpoint.name} установлено`);

      this.eventEmitter.emit('edi.connected', {
        endpointId,
        endpointName: endpoint.name,
        protocol: config.protocol,
        timestamp: new Date(),
      });

      return true;

    } catch (error) {
      this.logger.error(`❌ Ошибка подключения EDI ${endpoint.name}:`, error.stack);
      return false;
    }
  }

  async disconnect(endpointId: string): Promise<void> {
    const connection = this.connections.get(endpointId);
    const interval = this.pollingIntervals.get(endpointId);
    
    if (interval) {
      clearInterval(interval);
      this.pollingIntervals.delete(endpointId);
    }
    
    if (connection) {
      try {
        // Закрываем соединение в зависимости от типа
        if (connection.close) {
          await connection.close();
        } else if (connection.destroy) {
          connection.destroy();
        }
        
        this.connections.delete(endpointId);
        this.processingQueue.delete(endpointId);
        
        this.logger.log(`🔌 EDI соединение ${endpointId} отключено`);
      } catch (error) {
        this.logger.error(`❌ Ошибка отключения EDI ${endpointId}:`, error.message);
      }
    }
  }

  private async ensureDirectories(config: EdiConnectionConfig): Promise<void> {
    const directories = [
      config.directories.incoming,
      config.directories.outgoing,
      config.directories.processed,
      config.directories.error,
    ];

    for (const dir of directories) {
      try {
        await fs.mkdir(dir, { recursive: true });
      } catch (error) {
        this.logger.warn(`⚠️ Не удалось создать директорию ${dir}:`, error.message);
      }
    }
  }

  private async createFtpConnection(
    config: EdiConnectionConfig,
    endpoint: IntegrationEndpoint,
  ): Promise<any> {
    // Здесь должна быть реализация FTP/SFTP подключения
    // Используем заглушку для демонстрации
    return {
      type: 'ftp',
      config,
      endpoint,
      connected: true,
      close: async () => {
        this.logger.debug(`📪 FTP соединение ${endpoint.name} закрыто`);
      },
    };
  }

  private async createHttpConnection(
    config: EdiConnectionConfig,
    endpoint: IntegrationEndpoint,
  ): Promise<any> {
    return {
      type: 'http',
      config,
      endpoint,
      connected: true,
    };
  }

  private async createAs2Connection(
    config: EdiConnectionConfig,
    endpoint: IntegrationEndpoint,
  ): Promise<any> {
    return {
      type: 'as2',
      config,
      endpoint,
      connected: true,
    };
  }

  private async createDirectoryConnection(
    config: EdiConnectionConfig,
    endpoint: IntegrationEndpoint,
  ): Promise<any> {
    return {
      type: 'directory',
      config,
      endpoint,
      connected: true,
    };
  }

  private startPolling(
    endpointId: string,
    config: EdiConnectionConfig,
    endpoint: IntegrationEndpoint,
  ): void {
    const interval = setInterval(async () => {
      try {
        await this.pollIncomingMessages(endpointId, config, endpoint);
      } catch (error) {
        this.logger.error(`❌ Ошибка polling EDI ${endpoint.name}:`, error.message);
      }
    }, config.polling.interval * 1000);

    this.pollingIntervals.set(endpointId, interval);
  }

  private async pollIncomingMessages(
    endpointId: string,
    config: EdiConnectionConfig,
    endpoint: IntegrationEndpoint,
  ): Promise<void> {
    try {
      const files = await this.getIncomingFiles(config);
      
      for (const file of files) {
        const content = await fs.readFile(file, 'utf-8');
        const messages = await this.parseEdiContent(content, config);
        
        for (const message of messages) {
          await this.processIncomingMessage(message, endpoint, config);
          
          // Перемещаем файл в папку обработанных
          const processedPath = path.join(
            config.directories.processed,
            path.basename(file) + '_' + Date.now()
          );
          await fs.rename(file, processedPath);
        }
      }
    } catch (error) {
      this.logger.error(`❌ Ошибка обработки входящих EDI сообщений:`, error.message);
    }
  }

  private async getIncomingFiles(config: EdiConnectionConfig): Promise<string[]> {
    try {
      const files = await fs.readdir(config.directories.incoming);
      return files
        .filter(file => file.endsWith('.edi') || file.endsWith('.txt'))
        .map(file => path.join(config.directories.incoming, file));
    } catch (error) {
      return [];
    }
  }

  private async parseEdiContent(content: string, config: EdiConnectionConfig): Promise<EdiMessage[]> {
    const messages: EdiMessage[] = [];
    
    try {
      // Разбиваем контент на отдельные сообщения (по UNH/UNT парам)
      const messageBlocks = this.extractMessageBlocks(content);
      
      for (const block of messageBlocks) {
        const message = await this.parseEdiMessage(block, config);
        if (message) {
          messages.push(message);
        }
      }
    } catch (error) {
      this.logger.error('❌ Ошибка парсинга EDI контента:', error.message);
    }

    return messages;
  }

  private extractMessageBlocks(content: string): string[] {
    const blocks: string[] = [];
    const lines = content.split('\n');
    let currentBlock = '';
    let inMessage = false;

    for (const line of lines) {
      const trimmedLine = line.trim();
      
      if (trimmedLine.startsWith('UNH+')) {
        if (inMessage && currentBlock) {
          blocks.push(currentBlock);
        }
        currentBlock = trimmedLine + '\n';
        inMessage = true;
      } else if (trimmedLine.startsWith('UNT+')) {
        currentBlock += trimmedLine + '\n';
        if (inMessage) {
          blocks.push(currentBlock);
          currentBlock = '';
          inMessage = false;
        }
      } else if (inMessage) {
        currentBlock += trimmedLine + '\n';
      }
    }

    return blocks.filter(block => block.trim().length > 0);
  }

  private async parseEdiMessage(content: string, config: EdiConnectionConfig): Promise<EdiMessage | null> {
    try {
      const segments = this.parseEdiSegments(content);
      
      if (segments.length === 0) {
        return null;
      }

      // Ищем заголовок сообщения (UNH)
      const headerSegment = segments.find(s => s.tag === 'UNH');
      if (!headerSegment) {
        throw new Error('Заголовок сообщения UNH не найден');
      }

      const messageReference = headerSegment.elements[0];
      const messageTypeInfo = headerSegment.elements[1]?.split(':');
      const messageType = messageTypeInfo?.[0] as EdiMessageType;
      const version = messageTypeInfo?.[1];

      const messageId = this.generateMessageId(messageType, messageReference);

      const message: EdiMessage = {
        messageId,
        messageType,
        version: version || '1.0',
        sender: config.senderId,
        receiver: config.receiverId,
        timestamp: new Date(),
        controlNumber: messageReference,
        testIndicator: config.testMode,
        segments,
        rawContent: content,
        status: 'pending',
      };

      // Валидируем сообщение
      const validation = this.validateEdiMessage(message, config);
      if (!validation.isValid) {
        message.status = 'error';
        message.errors = validation.errors;
      }

      return message;

    } catch (error) {
      this.logger.error('❌ Ошибка парсинга EDI сообщения:', error.message);
      return null;
    }
  }

  private parseEdiSegments(content: string): EdiSegment[] {
    const segments: EdiSegment[] = [];
    const lines = content.split('\n');

    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine || !trimmedLine.includes('+')) {
        continue;
      }

      try {
        const segment = this.parseEdiSegment(trimmedLine);
        if (segment) {
          segments.push(segment);
        }
      } catch (error) {
        this.logger.warn(`⚠️ Ошибка парсинга сегмента EDI: ${trimmedLine}`, error.message);
      }
    }

    return segments;
  }

  private parseEdiSegment(line: string): EdiSegment | null {
    if (!line.includes('+')) {
      return null;
    }

    const parts = line.split('+');
    const tag = parts[0];
    const elements = parts.slice(1);

    const segment: EdiSegment = {
      tag,
      elements: elements.map(e => e.replace(this.SEGMENT_TERMINATOR, '')),
      compositeElements: {},
    };

    // Обрабатываем составные элементы (содержащие ':')
    elements.forEach((element, index) => {
      if (element.includes(':')) {
        segment.compositeElements![index] = element.split(':');
      }
    });

    return segment;
  }

  private validateEdiMessage(message: EdiMessage, config: EdiConnectionConfig): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    // Проверяем поддерживаемые типы сообщений
    if (!config.messageTypes.includes(message.messageType)) {
      errors.push(`Неподдерживаемый тип сообщения: ${message.messageType}`);
    }

    // Проверяем обязательные сегменты
    const hasHeader = message.segments.some(s => s.tag === 'UNH');
    const hasTrailer = message.segments.some(s => s.tag === 'UNT');
    
    if (!hasHeader) {
      errors.push('Отсутствует заголовок сообщения UNH');
    }
    
    if (!hasTrailer) {
      errors.push('Отсутствует завершение сообщения UNT');
    }

    // Специфическая валидация для разных типов сообщений
    switch (message.messageType) {
      case 'CODECO':
        this.validateCodecoMessage(message, errors);
        break;
      case 'COPRAR':
        this.validateCoprarMessage(message, errors);
        break;
      case 'BAPLIE':
        this.validateBaplieMessage(message, errors);
        break;
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  private validateCodecoMessage(message: EdiMessage, errors: string[]): void {
    // CODECO должен содержать информацию о контейнерах
    const hasContainer = message.segments.some(s => s.tag === 'EQD');
    if (!hasContainer) {
      errors.push('CODECO сообщение должно содержать сегмент EQD (Equipment Details)');
    }
  }

  private validateCoprarMessage(message: EdiMessage, errors: string[]): void {
    // COPRAR должен содержать информацию о событиях
    const hasEvent = message.segments.some(s => s.tag === 'STS');
    if (!hasEvent) {
      errors.push('COPRAR сообщение должно содержать сегмент STS (Status)');
    }
  }

  private validateBaplieMessage(message: EdiMessage, errors: string[]): void {
    // BAPLIE должен содержать информацию о судне
    const hasVessel = message.segments.some(s => s.tag === 'TDT');
    if (!hasVessel) {
      errors.push('BAPLIE сообщение должно содержать сегмент TDT (Details of Transport)');
    }
  }

  private generateMessageId(messageType: EdiMessageType, controlNumber: string): string {
    const timestamp = Date.now();
    const hash = crypto.createHash('md5')
      .update(`${messageType}_${controlNumber}_${timestamp}`)
      .digest('hex')
      .substring(0, 8);
    
    return `${messageType}_${hash}`;
  }

  private async processIncomingMessage(
    message: EdiMessage,
    endpoint: IntegrationEndpoint,
    config: EdiConnectionConfig,
  ): Promise<void> {
    try {
      this.logger.log(
        `📨 Обработка входящего EDI сообщения ${message.messageType} ` +
        `от ${endpoint.name}: ${message.messageId}`
      );

      // Сохраняем в кеше
      this.messageCache.set(message.messageId, message);

      // Добавляем в очередь обработки
      const queue = this.processingQueue.get(endpoint.id) || [];
      queue.push(message);
      this.processingQueue.set(endpoint.id, queue);

      // Извлекаем бизнес-данные из сообщения
      const businessData = await this.extractBusinessData(message);

      // Отправляем событие о получении сообщения
      this.eventEmitter.emit('edi.message.received', {
        endpointId: endpoint.id,
        endpointName: endpoint.name,
        message,
        businessData,
        timestamp: new Date(),
      });

      // Отправляем подтверждение если требуется
      if (config.acknowledgmentRequired) {
        await this.sendAcknowledgment(message, endpoint, config);
      }

      message.status = 'processed';
      this.logger.log(`✅ EDI сообщение ${message.messageId} обработано`);

    } catch (error) {
      message.status = 'error';
      message.errors = message.errors || [];
      message.errors.push(error.message);
      
      this.logger.error(`❌ Ошибка обработки EDI сообщения ${message.messageId}:`, error.stack);
      
      // Отправляем событие об ошибке
      this.eventEmitter.emit('edi.message.error', {
        endpointId: endpoint.id,
        messageId: message.messageId,
        error: error.message,
        timestamp: new Date(),
      });
    }
  }

  private async extractBusinessData(message: EdiMessage): Promise<any> {
    const data: any = {
      messageType: message.messageType,
      messageId: message.messageId,
      controlNumber: message.controlNumber,
      timestamp: message.timestamp,
    };

    switch (message.messageType) {
      case 'CODECO':
        data.containers = this.extractContainerData(message);
        data.vessel = this.extractVesselData(message);
        break;
      case 'COPRAR':
        data.containers = this.extractContainerData(message);
        data.events = this.extractEventData(message);
        break;
      case 'BAPLIE':
        data.vessel = this.extractVesselData(message);
        data.stowagePlan = this.extractStowageData(message);
        break;
      case 'COARRI':
        data.containers = this.extractContainerData(message);
        data.arrival = this.extractArrivalData(message);
        break;
      default:
        data.segments = message.segments;
    }

    return data;
  }

  private extractContainerData(message: EdiMessage): ContainerInfo[] {
    const containers: ContainerInfo[] = [];
    const eqdSegments = message.segments.filter(s => s.tag === 'EQD');

    for (const segment of eqdSegments) {
      try {
        const container: ContainerInfo = {
          containerNumber: segment.elements[1] || '',
          containerType: segment.elements[0] || '',
          containerSize: segment.elements[2] || '',
        };

        // Ищем связанные сегменты (MEA для веса, DIM для размеров и т.д.)
        const containerIndex = eqdSegments.indexOf(segment);
        const nextEqdIndex = containerIndex + 1 < eqdSegments.length ? 
          message.segments.indexOf(eqdSegments[containerIndex + 1]) : 
          message.segments.length;

        // Извлекаем вес (MEA сегменты)
        const meaSegments = message.segments.slice(
          message.segments.indexOf(segment) + 1,
          nextEqdIndex
        ).filter(s => s.tag === 'MEA');

        for (const mea of meaSegments) {
          if (mea.elements[0] === 'AAE') { // Gross weight
            container.weight = container.weight || { unit: 'KGM' };
            container.weight.gross = parseFloat(mea.elements[2]);
            container.weight.unit = mea.elements[3] as any || 'KGM';
          }
        }

        containers.push(container);
      } catch (error) {
        this.logger.warn(`⚠️ Ошибка извлечения данных контейнера:`, error.message);
      }
    }

    return containers;
  }

  private extractVesselData(message: EdiMessage): VesselInfo | null {
    const tdtSegment = message.segments.find(s => s.tag === 'TDT');
    if (!tdtSegment) {
      return null;
    }

    try {
      return {
        vesselName: tdtSegment.elements[7] || '',
        vesselCode: tdtSegment.elements[8] || '',
        voyage: tdtSegment.elements[1] || '',
        portCode: 'RUMP', // Извлекается из других сегментов
      };
    } catch (error) {
      this.logger.warn(`⚠️ Ошибка извлечения данных судна:`, error.message);
      return null;
    }
  }

  private extractEventData(message: EdiMessage): any[] {
    const events: any[] = [];
    const stsSegments = message.segments.filter(s => s.tag === 'STS');

    for (const segment of stsSegments) {
      try {
        events.push({
          eventCode: segment.elements[0],
          eventDate: segment.elements[1],
          eventTime: segment.elements[2],
          location: segment.elements[3],
        });
      } catch (error) {
        this.logger.warn(`⚠️ Ошибка извлечения данных события:`, error.message);
      }
    }

    return events;
  }

  private extractStowageData(message: EdiMessage): any {
    // Извлечение данных плана размещения из BAPLIE сообщения
    const locSegments = message.segments.filter(s => s.tag === 'LOC');
    const stowage = {
      bayPlan: [],
      occupiedLocations: [],
      emptyLocations: [],
    };

    for (const segment of locSegments) {
      try {
        const locationType = segment.elements[0];
        const location = segment.elements[1];
        
        if (locationType === '147') { // Stowage location
          stowage.occupiedLocations.push(location);
        } else if (locationType === '11') { // Available location
          stowage.emptyLocations.push(location);
        }
      } catch (error) {
        this.logger.warn(`⚠️ Ошибка извлечения данных размещения:`, error.message);
      }
    }

    return stowage;
  }

  private extractArrivalData(message: EdiMessage): any {
    const dtmSegments = message.segments.filter(s => s.tag === 'DTM');
    const arrival: any = {};

    for (const segment of dtmSegments) {
      try {
        const dateQualifier = segment.elements[0];
        const dateTime = segment.elements[1];
        
        if (dateQualifier === '132') { // Estimated arrival
          arrival.eta = new Date(dateTime);
        } else if (dateQualifier === '133') { // Actual arrival
          arrival.ata = new Date(dateTime);
        }
      } catch (error) {
        this.logger.warn(`⚠️ Ошибка извлечения данных прибытия:`, error.message);
      }
    }

    return arrival;
  }

  private async sendAcknowledgment(
    originalMessage: EdiMessage,
    endpoint: IntegrationEndpoint,
    config: EdiConnectionConfig,
  ): Promise<void> {
    try {
      // Создаем CONTRL сообщение (функциональное подтверждение)
      const ackMessage = this.createAcknowledgmentMessage(originalMessage, config);
      const ackContent = this.formatEdiMessage(ackMessage);
      
      // Сохраняем в исходящую папку
      const filename = `ACK_${originalMessage.messageId}_${Date.now()}.edi`;
      const filepath = path.join(config.directories.outgoing, filename);
      
      await fs.writeFile(filepath, ackContent, 'utf-8');
      
      this.logger.log(`📤 Подтверждение отправлено для сообщения ${originalMessage.messageId}`);
      
      this.eventEmitter.emit('edi.acknowledgment.sent', {
        endpointId: endpoint.id,
        originalMessageId: originalMessage.messageId,
        acknowledgmentId: ackMessage.messageId,
        timestamp: new Date(),
      });
      
    } catch (error) {
      this.logger.error(`❌ Ошибка отправки подтверждения:`, error.message);
    }
  }

  private createAcknowledgmentMessage(
    originalMessage: EdiMessage,
    config: EdiConnectionConfig,
  ): EdiMessage {
    const controlNumber = this.generateControlNumber();
    const messageId = `CONTRL_${controlNumber}`;

    const segments: EdiSegment[] = [
      {
        tag: 'UNH',
        elements: [controlNumber, 'CONTRL:D:03B:UN:EAN008'],
      },
      {
        tag: 'BGM',
        elements: ['85', originalMessage.controlNumber, '29'],
      },
      {
        tag: 'DTM',
        elements: ['137', new Date().toISOString().replace(/[-:]/g, '').split('.')[0]],
      },
      {
        tag: 'UNT',
        elements: ['4', controlNumber],
      },
    ];

    return {
      messageId,
      messageType: 'CONTRL' as any,
      version: '03B',
      sender: config.senderId,
      receiver: config.receiverId,
      timestamp: new Date(),
      controlNumber,
      segments,
      rawContent: '',
      status: 'pending',
    };
  }

  private formatEdiMessage(message: EdiMessage): string {
    let content = '';
    
    for (const segment of message.segments) {
      content += segment.tag;
      
      for (const element of segment.elements) {
        content += this.ELEMENT_SEPARATOR + element;
      }
      
      content += this.SEGMENT_TERMINATOR + '\n';
    }
    
    return content;
  }

  private generateControlNumber(): string {
    return Date.now().toString().substring(-9); // Последние 9 цифр
  }

  // Публичные методы для отправки EDI сообщений
  async sendMessage(
    endpointId: string,
    messageType: EdiMessageType,
    data: any,
  ): Promise<string> {
    const connection = this.connections.get(endpointId);
    if (!connection) {
      throw new Error(`EDI соединение ${endpointId} не найдено`);
    }

    const config = connection.config as EdiConnectionConfig;
    const endpoint = connection.endpoint as IntegrationEndpoint;

    // Создаем EDI сообщение
    const message = await this.createEdiMessage(messageType, data, config);
    const content = this.formatEdiMessage(message);

    // Сохраняем в исходящую папку
    const filename = `${messageType}_${message.controlNumber}_${Date.now()}.edi`;
    const filepath = path.join(config.directories.outgoing, filename);
    
    await fs.writeFile(filepath, content, 'utf-8');

    this.logger.log(`📤 EDI сообщение ${messageType} отправлено: ${message.messageId}`);

    this.eventEmitter.emit('edi.message.sent', {
      endpointId,
      endpointName: endpoint.name,
      messageId: message.messageId,
      messageType,
      timestamp: new Date(),
    });

    return message.messageId;
  }

  private async createEdiMessage(
    messageType: EdiMessageType,
    data: any,
    config: EdiConnectionConfig,
  ): Promise<EdiMessage> {
    const controlNumber = this.generateControlNumber();
    const messageId = `${messageType}_${controlNumber}`;

    let segments: EdiSegment[] = [];

    // Создаем сегменты в зависимости от типа сообщения
    switch (messageType) {
      case 'CODECO':
        segments = this.createCodecoSegments(data, controlNumber);
        break;
      case 'COPRAR':
        segments = this.createCoprarSegments(data, controlNumber);
        break;
      case 'BAPLIE':
        segments = this.createBaplieSegments(data, controlNumber);
        break;
      default:
        throw new Error(`Неподдерживаемый тип исходящего сообщения: ${messageType}`);
    }

    return {
      messageId,
      messageType,
      version: '03B',
      sender: config.senderId,
      receiver: config.receiverId,
      timestamp: new Date(),
      controlNumber,
      segments,
      rawContent: '',
      status: 'pending',
    };
  }

  private createCodecoSegments(data: any, controlNumber: string): EdiSegment[] {
    const segments: EdiSegment[] = [
      {
        tag: 'UNH',
        elements: [controlNumber, 'CODECO:D:03B:UN'],
      },
      {
        tag: 'BGM',
        elements: ['85', data.documentNumber || controlNumber, '9'],
      },
      {
        tag: 'DTM',
        elements: ['137', new Date().toISOString().replace(/[-:]/g, '').split('.')[0]],
      },
    ];

    // Добавляем информацию о судне
    if (data.vessel) {
      segments.push({
        tag: 'TDT',
        elements: ['20', data.vessel.voyage, '', '', '', '', '', data.vessel.vesselName],
      });
    }

    // Добавляем контейнеры
    if (data.containers && Array.isArray(data.containers)) {
      for (const container of data.containers) {
        segments.push({
          tag: 'EQD',
          elements: [container.containerType, container.containerNumber, container.containerSize],
        });

        // Добавляем вес если есть
        if (container.weight?.gross) {
          segments.push({
            tag: 'MEA',
            elements: ['AAE', '', container.weight.gross.toString(), container.weight.unit],
          });
        }
      }
    }

    // Завершающий сегмент
    segments.push({
      tag: 'UNT',
      elements: [(segments.length + 1).toString(), controlNumber],
    });

    return segments;
  }

  private createCoprarSegments(data: any, controlNumber: string): EdiSegment[] {
    const segments: EdiSegment[] = [
      {
        tag: 'UNH',
        elements: [controlNumber, 'COPRAR:D:03B:UN'],
      },
      {
        tag: 'BGM',
        elements: ['85', data.documentNumber || controlNumber, '9'],
      },
      {
        tag: 'DTM',
        elements: ['137', new Date().toISOString().replace(/[-:]/g, '').split('.')[0]],
      },
    ];

    // Добавляем события
    if (data.events && Array.isArray(data.events)) {
      for (const event of data.events) {
        segments.push({
          tag: 'STS',
          elements: [event.eventCode, event.eventDate, event.eventTime, event.location],
        });
      }
    }

    segments.push({
      tag: 'UNT',
      elements: [(segments.length + 1).toString(), controlNumber],
    });

    return segments;
  }

  private createBaplieSegments(data: any, controlNumber: string): EdiSegment[] {
    // Упрощенная реализация BAPLIE сообщения
    const segments: EdiSegment[] = [
      {
        tag: 'UNH',
        elements: [controlNumber, 'BAPLIE:D:03B:UN'],
      },
      {
        tag: 'BGM',
        elements: ['85', data.documentNumber || controlNumber, '9'],
      },
      {
        tag: 'DTM',
        elements: ['137', new Date().toISOString().replace(/[-:]/g, '').split('.')[0]],
      },
    ];

    // Информация о судне
    if (data.vessel) {
      segments.push({
        tag: 'TDT',
        elements: ['20', data.vessel.voyage, '', '', '', '', '', data.vessel.vesselName],
      });
    }

    segments.push({
      tag: 'UNT',
      elements: [(segments.length + 1).toString(), controlNumber],
    });

    return segments;
  }

  // Публичные методы для внешнего использования
  async getMessages(endpointId?: string): Promise<EdiMessage[]> {
    if (endpointId) {
      return this.processingQueue.get(endpointId) || [];
    }
    
    const allMessages: EdiMessage[] = [];
    for (const messages of this.processingQueue.values()) {
      allMessages.push(...messages);
    }
    
    return allMessages;
  }

  async getMessage(messageId: string): Promise<EdiMessage | undefined> {
    return this.messageCache.get(messageId);
  }

  async getConnectionStats(endpointId?: string) {
    const stats = {
      totalConnections: this.connections.size,
      totalMessages: this.messageCache.size,
      messagesByType: {} as Record<string, number>,
      messagesByStatus: {} as Record<string, number>,
      activePolling: this.pollingIntervals.size,
    };

    // Подсчитываем сообщения по типам и статусам
    for (const message of this.messageCache.values()) {
      const messageType = message.messageType;
      const status = message.status;
      
      stats.messagesByType[messageType] = (stats.messagesByType[messageType] || 0) + 1;
      stats.messagesByStatus[status] = (stats.messagesByStatus[status] || 0) + 1;
    }

    return stats;
  }

  async testConnection(endpoint: IntegrationEndpoint): Promise<boolean> {
    try {
      const connected = await this.connect(endpoint);
      if (connected) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        await this.disconnect(endpoint.id);
      }
      return connected;
    } catch (error) {
      this.logger.error(`❌ Тест EDI соединения неудачен для ${endpoint.name}:`, error.message);
      return false;
    }
  }

  async clearMessageCache(messageId?: string): Promise<void> {
    if (messageId) {
      this.messageCache.delete(messageId);
      this.logger.log(`🧹 EDI сообщение ${messageId} удалено из кеша`);
    } else {
      this.messageCache.clear();
      this.processingQueue.clear();
      this.logger.log('🧹 Весь кеш EDI сообщений очищен');
    }
  }
}