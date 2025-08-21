import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import * as net from 'net';
import * as dgram from 'dgram';
import { IntegrationEndpoint } from '../entities/integration-endpoint.entity';

export interface RfidTag {
  epc: string; // Electronic Product Code
  tid?: string; // Tag ID
  user?: string; // User memory
  rssi?: number; // Signal strength (dBm)
  frequency?: number; // MHz
  phase?: number; // Phase angle
  antennaPort?: number; // Antenna port number
  timestamp: Date;
  readCount?: number; // Number of reads
  isMoving?: boolean; // Tag movement detection
}

export interface RfidRead {
  tagId: string;
  antennaId: string;
  readerId: string;
  timestamp: Date;
  rssi: number;
  epc: string;
  metadata?: {
    location?: string;
    zone?: string;
    direction?: 'in' | 'out';
    equipment?: string;
    operator?: string;
  };
}

export interface RfidConnectionConfig {
  host: string;
  port: number;
  protocol: 'tcp' | 'udp' | 'serial' | 'http';
  authentication?: {
    username?: string;
    password?: string;
    apiKey?: string;
  };
  readerType: 'impinj' | 'zebra' | 'alien' | 'custom';
  antennas: Array<{
    id: string;
    name: string;
    port: number;
    enabled: boolean;
    powerLevel?: number; // dBm
    position?: {
      x: number;
      y: number;
      z: number;
    };
  }>;
  readSettings: {
    mode: 'continuous' | 'triggered' | 'single';
    session: 0 | 1 | 2 | 3; // Gen2 session
    powerLevel: number; // dBm
    frequency?: number; // MHz
    filters?: Array<{
      bank: 'epc' | 'tid' | 'user';
      offset: number;
      length: number;
      data: string;
    }>;
  };
  advanced?: {
    tagReportContent?: string[];
    keepAliveInterval?: number;
    reconnectAttempts?: number;
    bufferSize?: number;
  };
}

@Injectable()
export class RfidAdapter implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RfidAdapter.name);
  private readonly connections = new Map<string, any>();
  private readonly tagCache = new Map<string, RfidTag>();
  private readonly readerStats = new Map<string, {
    totalReads: number;
    uniqueTags: Set<string>;
    lastRead: Date;
    connectionTime: Date;
    errors: number;
  }>();

  constructor(private readonly eventEmitter: EventEmitter2) {}

  async onModuleInit() {
    this.logger.log('📡 Инициализация RFID адаптера...');
  }

  async onModuleDestroy() {
    this.logger.log('🔄 Завершение работы RFID адаптера...');
    
    for (const [endpointId, connection] of this.connections) {
      try {
        await this.disconnect(endpointId);
      } catch (error) {
        this.logger.error(`❌ Ошибка отключения RFID ${endpointId}:`, error.message);
      }
    }
  }

  async connect(endpoint: IntegrationEndpoint): Promise<boolean> {
    const endpointId = endpoint.id;
    const config = endpoint.connectionConfig.rfidConfig as RfidConnectionConfig;

    try {
      this.logger.log(`🔌 Подключение к RFID считывателю ${endpoint.name}...`);

      if (this.connections.has(endpointId)) {
        this.logger.warn(`⚠️ RFID считыватель ${endpointId} уже подключен`);
        return true;
      }

      let connection: any;

      switch (config.protocol) {
        case 'tcp':
          connection = await this.createTcpConnection(config, endpoint);
          break;
        case 'udp':
          connection = await this.createUdpConnection(config, endpoint);
          break;
        case 'http':
          connection = await this.createHttpConnection(config, endpoint);
          break;
        default:
          throw new Error(`Неподдерживаемый протокол RFID: ${config.protocol}`);
      }

      this.connections.set(endpointId, connection);
      this.readerStats.set(endpointId, {
        totalReads: 0,
        uniqueTags: new Set(),
        lastRead: new Date(),
        connectionTime: new Date(),
        errors: 0,
      });

      // Настраиваем считыватель
      await this.configureReader(connection, config, endpoint);

      this.logger.log(`✅ RFID считыватель ${endpoint.name} подключен`);

      this.eventEmitter.emit('rfid.connected', {
        endpointId,
        endpointName: endpoint.name,
        timestamp: new Date(),
      });

      return true;

    } catch (error) {
      this.logger.error(`❌ Ошибка подключения RFID ${endpoint.name}:`, error.stack);
      return false;
    }
  }

  async disconnect(endpointId: string): Promise<void> {
    const connection = this.connections.get(endpointId);
    
    if (connection) {
      try {
        if (connection.close) {
          connection.close();
        } else if (connection.destroy) {
          connection.destroy();
        }
        
        this.connections.delete(endpointId);
        this.logger.log(`🔌 RFID считыватель ${endpointId} отключен`);
      } catch (error) {
        this.logger.error(`❌ Ошибка отключения RFID ${endpointId}:`, error.message);
      }
    }
  }

  private async createTcpConnection(
    config: RfidConnectionConfig,
    endpoint: IntegrationEndpoint,
  ): Promise<net.Socket> {
    return new Promise((resolve, reject) => {
      const socket = new net.Socket();
      
      socket.setTimeout(endpoint.connectionConfig.timeout || 30000);
      
      socket.on('connect', () => {
        this.logger.log(`🔗 TCP соединение с RFID ${endpoint.name} установлено`);
        resolve(socket);
      });

      socket.on('data', (data) => {
        this.handleIncomingData(data, endpoint, config);
      });

      socket.on('error', (error) => {
        this.logger.error(`❌ TCP ошибка RFID ${endpoint.name}:`, error.message);
        this.updateReaderStats(endpoint.id, { error: true });
        
        this.eventEmitter.emit('rfid.error', {
          endpointId: endpoint.id,
          endpointName: endpoint.name,
          error: error.message,
          timestamp: new Date(),
        });
        
        reject(error);
      });

      socket.on('close', () => {
        this.logger.warn(`🔌 TCP соединение с RFID ${endpoint.name} закрыто`);
        this.connections.delete(endpoint.id);
        
        this.eventEmitter.emit('rfid.disconnected', {
          endpointId: endpoint.id,
          endpointName: endpoint.name,
          timestamp: new Date(),
        });
      });

      socket.connect(config.port, config.host);
    });
  }

  private async createUdpConnection(
    config: RfidConnectionConfig,
    endpoint: IntegrationEndpoint,
  ): Promise<dgram.Socket> {
    const socket = dgram.createSocket('udp4');

    socket.on('message', (message, rinfo) => {
      this.logger.debug(`📨 UDP данные от RFID ${endpoint.name}: ${message.length} байт от ${rinfo.address}:${rinfo.port}`);
      this.handleIncomingData(message, endpoint, config);
    });

    socket.on('error', (error) => {
      this.logger.error(`❌ UDP ошибка RFID ${endpoint.name}:`, error.message);
      this.updateReaderStats(endpoint.id, { error: true });
    });

    socket.on('listening', () => {
      const address = socket.address();
      this.logger.log(`📡 UDP RFID слушатель запущен на ${address.address}:${address.port}`);
    });

    socket.bind(config.port, config.host);

    return socket;
  }

  private async createHttpConnection(
    config: RfidConnectionConfig,
    endpoint: IntegrationEndpoint,
  ): Promise<any> {
    // HTTP polling connection для RFID считывателей с REST API
    const connection = {
      config,
      endpoint,
      intervalId: null as NodeJS.Timeout | null,
    };

    // Запускаем периодический опрос
    connection.intervalId = setInterval(async () => {
      try {
        await this.pollHttpRfidData(connection);
      } catch (error) {
        this.logger.error(`❌ HTTP опрос RFID ${endpoint.name} неудачен:`, error.message);
        this.updateReaderStats(endpoint.id, { error: true });
      }
    }, config.advanced?.keepAliveInterval || 5000);

    return connection;
  }

  private async pollHttpRfidData(connection: any): Promise<void> {
    // Реализация HTTP опроса RFID данных
    // Здесь должен быть HTTP клиент для получения данных от считывателя
    this.logger.debug(`🔄 HTTP опрос RFID данных для ${connection.endpoint.name}`);
  }

  private async configureReader(
    connection: any,
    config: RfidConnectionConfig,
    endpoint: IntegrationEndpoint,
  ): Promise<void> {
    try {
      this.logger.debug(`⚙️ Настройка RFID считывателя ${endpoint.name}`);

      switch (config.readerType) {
        case 'impinj':
          await this.configureImpinjReader(connection, config);
          break;
        case 'zebra':
          await this.configureZebraReader(connection, config);
          break;
        case 'alien':
          await this.configureAlienReader(connection, config);
          break;
        case 'custom':
          await this.configureCustomReader(connection, config);
          break;
      }

      this.logger.log(`⚙️ RFID считыватель ${endpoint.name} настроен`);
    } catch (error) {
      this.logger.error(`❌ Ошибка настройки RFID ${endpoint.name}:`, error.message);
      throw error;
    }
  }

  private async configureImpinjReader(connection: any, config: RfidConnectionConfig): Promise<void> {
    // Конфигурация для Impinj считывателей
    if (connection.write) {
      // Настройка антенн
      for (const antenna of config.antennas) {
        if (antenna.enabled) {
          const command = `SET ANTENNA ${antenna.port} POWER ${antenna.powerLevel || config.readSettings.powerLevel}\r\n`;
          connection.write(command);
        }
      }

      // Настройка режима чтения
      const modeCommand = `SET MODE ${config.readSettings.mode.toUpperCase()}\r\n`;
      connection.write(modeCommand);

      // Настройка сессии
      const sessionCommand = `SET SESSION ${config.readSettings.session}\r\n`;
      connection.write(sessionCommand);

      // Старт чтения
      connection.write('START\r\n');
    }
  }

  private async configureZebraReader(connection: any, config: RfidConnectionConfig): Promise<void> {
    // Конфигурация для Zebra считывателей
    this.logger.debug('⚙️ Настройка Zebra RFID считывателя');
  }

  private async configureAlienReader(connection: any, config: RfidConnectionConfig): Promise<void> {
    // Конфигурация для Alien считывателей
    this.logger.debug('⚙️ Настройка Alien RFID считывателя');
  }

  private async configureCustomReader(connection: any, config: RfidConnectionConfig): Promise<void> {
    // Пользовательская конфигурация
    this.logger.debug('⚙️ Настройка пользовательского RFID считывателя');
  }

  private async handleIncomingData(
    data: Buffer,
    endpoint: IntegrationEndpoint,
    config: RfidConnectionConfig,
  ): Promise<void> {
    try {
      this.logger.debug(`📨 Получены RFID данные от ${endpoint.name}: ${data.length} байт`);

      // Парсим данные в зависимости от типа считывателя
      const rfidReads = await this.parseRfidData(data, config, endpoint);

      for (const read of rfidReads) {
        // Создаем или обновляем тег в кеше
        const tag = this.updateTagCache(read);
        
        // Обновляем статистику
        this.updateReaderStats(endpoint.id, { read: true, tagId: read.tagId });
        
        // Отправляем событие о новом чтении
        this.eventEmitter.emit('rfid.tag.read', {
          endpointId: endpoint.id,
          endpointName: endpoint.name,
          read,
          tag,
          timestamp: read.timestamp,
        });

        this.logger.debug(
          `📋 RFID чтение: ${read.tagId} на антенне ${read.antennaId} ` +
          `(RSSI: ${read.rssi}dBm, считыватель: ${read.readerId})`
        );
      }

    } catch (error) {
      this.logger.error(`❌ Ошибка обработки RFID данных от ${endpoint.name}:`, error.stack);
      this.updateReaderStats(endpoint.id, { error: true });
    }
  }

  private async parseRfidData(
    data: Buffer,
    config: RfidConnectionConfig,
    endpoint: IntegrationEndpoint,
  ): Promise<RfidRead[]> {
    const reads: RfidRead[] = [];

    try {
      switch (config.readerType) {
        case 'impinj':
          return this.parseImpinjData(data, config, endpoint);
        case 'zebra':
          return this.parseZebraData(data, config, endpoint);
        case 'alien':
          return this.parseAlienData(data, config, endpoint);
        case 'custom':
          return this.parseCustomData(data, config, endpoint);
        default:
          // Пробуем парсить как текст
          return this.parseTextData(data, config, endpoint);
      }
    } catch (error) {
      this.logger.error(`❌ Ошибка парсинга RFID данных (${config.readerType}):`, error.message);
      return [];
    }
  }

  private parseImpinjData(data: Buffer, config: RfidConnectionConfig, endpoint: IntegrationEndpoint): RfidRead[] {
    const reads: RfidRead[] = [];
    
    try {
      // Парсинг данных Impinj формата
      const text = data.toString('utf8');
      const lines = text.split('\n');

      for (const line of lines) {
        if (line.includes('EPC:')) {
          const parts = line.split(',');
          if (parts.length >= 4) {
            const epc = parts.find(p => p.includes('EPC:'))?.split(':')[1]?.trim();
            const antenna = parts.find(p => p.includes('ANT:'))?.split(':')[1]?.trim();
            const rssi = parts.find(p => p.includes('RSSI:'))?.split(':')[1]?.trim();

            if (epc && antenna && rssi) {
              reads.push({
                tagId: epc,
                antennaId: antenna,
                readerId: endpoint.id,
                timestamp: new Date(),
                rssi: parseInt(rssi),
                epc,
                metadata: {
                  location: endpoint.name,
                  zone: this.determineZoneFromAntenna(antenna, config),
                },
              });
            }
          }
        }
      }
    } catch (error) {
      this.logger.error('❌ Ошибка парсинга Impinj данных:', error.message);
    }

    return reads;
  }

  private parseZebraData(data: Buffer, config: RfidConnectionConfig, endpoint: IntegrationEndpoint): RfidRead[] {
    // Парсинг данных Zebra формата
    this.logger.debug('📊 Парсинг Zebra RFID данных');
    return [];
  }

  private parseAlienData(data: Buffer, config: RfidConnectionConfig, endpoint: IntegrationEndpoint): RfidRead[] {
    // Парсинг данных Alien формата
    this.logger.debug('📊 Парсинг Alien RFID данных');
    return [];
  }

  private parseCustomData(data: Buffer, config: RfidConnectionConfig, endpoint: IntegrationEndpoint): RfidRead[] {
    // Пользовательский парсер
    this.logger.debug('📊 Парсинг пользовательских RFID данных');
    return this.parseTextData(data, config, endpoint);
  }

  private parseTextData(data: Buffer, config: RfidConnectionConfig, endpoint: IntegrationEndpoint): RfidRead[] {
    const reads: RfidRead[] = [];
    
    try {
      const text = data.toString('utf8');
      
      // Простой парсер для текстовых данных
      if (text.includes('TAG:') || text.includes('EPC:')) {
        reads.push({
          tagId: text.trim(),
          antennaId: '1',
          readerId: endpoint.id,
          timestamp: new Date(),
          rssi: -50, // Значение по умолчанию
          epc: text.trim(),
        });
      }
    } catch (error) {
      this.logger.error('❌ Ошибка парсинга текстовых RFID данных:', error.message);
    }

    return reads;
  }

  private updateTagCache(read: RfidRead): RfidTag {
    const existing = this.tagCache.get(read.tagId);
    
    const tag: RfidTag = {
      epc: read.epc,
      rssi: read.rssi,
      timestamp: read.timestamp,
      readCount: (existing?.readCount || 0) + 1,
      isMoving: this.detectTagMovement(read, existing),
    };

    this.tagCache.set(read.tagId, tag);
    return tag;
  }

  private detectTagMovement(current: RfidRead, previous?: RfidTag): boolean {
    if (!previous) return false;
    
    // Простая логика определения движения по изменению RSSI
    const rssiDiff = Math.abs(current.rssi - (previous.rssi || 0));
    const timeDiff = current.timestamp.getTime() - previous.timestamp.getTime();
    
    return rssiDiff > 10 && timeDiff < 5000; // Изменение RSSI > 10dBm за последние 5 секунд
  }

  private determineZoneFromAntenna(antennaId: string, config: RfidConnectionConfig): string {
    const antenna = config.antennas.find(a => a.id === antennaId || a.port.toString() === antennaId);
    
    if (antenna?.name.toLowerCase().includes('gate')) return 'gate';
    if (antenna?.name.toLowerCase().includes('yard')) return 'yard';
    if (antenna?.name.toLowerCase().includes('quay')) return 'quay';
    
    return 'unknown';
  }

  private updateReaderStats(endpointId: string, update: { read?: boolean; tagId?: string; error?: boolean }): void {
    const stats = this.readerStats.get(endpointId);
    if (!stats) return;

    if (update.read && update.tagId) {
      stats.totalReads++;
      stats.uniqueTags.add(update.tagId);
      stats.lastRead = new Date();
    }

    if (update.error) {
      stats.errors++;
    }
  }

  // Публичные методы для внешнего использования
  async getConnectedTags(endpointId?: string): Promise<Map<string, RfidTag>> {
    if (endpointId) {
      // Фильтрация по конкретной интеграции (в реальной системе нужно хранить связь тег-интеграция)
      return new Map(this.tagCache);
    }
    
    return new Map(this.tagCache);
  }

  async getTag(tagId: string): Promise<RfidTag | undefined> {
    return this.tagCache.get(tagId);
  }

  async getReaderStats(endpointId?: string) {
    if (endpointId) {
      const stats = this.readerStats.get(endpointId);
      return stats ? {
        ...stats,
        uniqueTags: stats.uniqueTags.size,
      } : null;
    }

    const aggregatedStats = {
      totalReads: 0,
      uniqueTags: new Set<string>(),
      errors: 0,
      activeReaders: this.connections.size,
    };

    for (const stats of this.readerStats.values()) {
      aggregatedStats.totalReads += stats.totalReads;
      aggregatedStats.errors += stats.errors;
      for (const tag of stats.uniqueTags) {
        aggregatedStats.uniqueTags.add(tag);
      }
    }

    return {
      ...aggregatedStats,
      uniqueTags: aggregatedStats.uniqueTags.size,
    };
  }

  async testConnection(endpoint: IntegrationEndpoint): Promise<boolean> {
    try {
      const connected = await this.connect(endpoint);
      if (connected) {
        // Тестируем получение данных
        await new Promise(resolve => setTimeout(resolve, 2000));
        await this.disconnect(endpoint.id);
      }
      return connected;
    } catch (error) {
      this.logger.error(`❌ Тест RFID соединения неудачен для ${endpoint.name}:`, error.message);
      return false;
    }
  }

  async clearTagCache(tagId?: string): Promise<void> {
    if (tagId) {
      this.tagCache.delete(tagId);
      this.logger.log(`🧹 Данные тега ${tagId} очищены`);
    } else {
      this.tagCache.clear();
      this.logger.log('🧹 Все данные тегов очищены');
    }
  }

  async writeTag(endpointId: string, tagId: string, data: string, bank: 'epc' | 'tid' | 'user' = 'user'): Promise<boolean> {
    const connection = this.connections.get(endpointId);
    
    if (!connection || !connection.write) {
      throw new Error(`RFID соединение ${endpointId} недоступно для записи`);
    }

    try {
      // Команда записи в тег (пример для Impinj)
      const writeCommand = `WRITE ${bank.toUpperCase()} ${tagId} ${data}\r\n`;
      connection.write(writeCommand);
      
      this.logger.log(`✏️ Запись в RFID тег ${tagId}, банк ${bank}: ${data}`);
      return true;
    } catch (error) {
      this.logger.error(`❌ Ошибка записи в RFID тег ${tagId}:`, error.message);
      return false;
    }
  }

  async lockTag(endpointId: string, tagId: string, lockMask: string): Promise<boolean> {
    const connection = this.connections.get(endpointId);
    
    if (!connection || !connection.write) {
      throw new Error(`RFID соединение ${endpointId} недоступно для блокировки`);
    }

    try {
      // Команда блокировки тега
      const lockCommand = `LOCK ${tagId} ${lockMask}\r\n`;
      connection.write(lockCommand);
      
      this.logger.log(`🔒 Блокировка RFID тега ${tagId} с маской ${lockMask}`);
      return true;
    } catch (error) {
      this.logger.error(`❌ Ошибка блокировки RFID тега ${tagId}:`, error.message);
      return false;
    }
  }
}