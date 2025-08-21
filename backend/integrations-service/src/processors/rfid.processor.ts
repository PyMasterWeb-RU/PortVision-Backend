import {
  Injectable,
  Logger,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { RfidAdapter, RfidRead, RfidTag } from '../adapters/rfid.adapter';
import { DataTransformationService } from '../services/data-transformation.service';
import { RoutingService } from '../services/routing.service';
import { MetricsService } from '../services/metrics.service';
import { IntegrationEndpoint } from '../entities/integration-endpoint.entity';

export interface RfidProcessingRequest {
  endpointId: string;
  action: 'start_reading' | 'stop_reading' | 'read_tag' | 'write_tag' | 'lock_tag' | 'inventory';
  tagId?: string;
  data?: string;
  bank?: 'epc' | 'tid' | 'user';
  antennas?: string[];
  metadata?: {
    operatorId?: string;
    sessionId?: string;
    location?: string;
    direction?: 'in' | 'out';
    equipment?: string;
  };
}

export interface RfidProcessingResult {
  success: boolean;
  action: string;
  endpointId: string;
  data?: any;
  errors?: string[];
  processingTime: number;
  tagCount?: number;
  readerStats?: any;
  metadata?: any;
}

export interface TagInventoryReport {
  reportId: string;
  generatedAt: Date;
  readerId: string;
  readerName: string;
  totalTags: number;
  uniqueTags: number;
  tags: Array<{
    epc: string;
    rssi: number;
    readCount: number;
    firstSeen: Date;
    lastSeen: Date;
    antennas: string[];
    isMoving: boolean;
    metadata?: any;
  }>;
  antennaStats: Array<{
    antennaId: string;
    antennaName: string;
    tagCount: number;
    averageRssi: number;
    tags: string[];
  }>;
  timeRange: {
    start: Date;
    end: Date;
    duration: number; // minutes
  };
}

export interface TagTrackingEvent {
  eventId: string;
  tagId: string;
  eventType: 'tag_first_seen' | 'tag_moved' | 'tag_lost' | 'zone_entry' | 'zone_exit';
  timestamp: Date;
  location: {
    readerId: string;
    readerName: string;
    antennaId: string;
    zone?: string;
  };
  previousLocation?: {
    readerId: string;
    antennaId: string;
    zone?: string;
  };
  data: {
    rssi: number;
    readCount: number;
    dwellTime?: number; // время нахождения в зоне в секундах
  };
  metadata?: any;
}

@Injectable()
export class RfidProcessor {
  private readonly logger = new Logger(RfidProcessor.name);
  private readonly tagHistory = new Map<string, TagTrackingEvent[]>();
  private readonly zonePresence = new Map<string, Set<string>>(); // zone -> tagIds
  private readonly processedReads = new Map<string, number>();

  constructor(
    private readonly rfidAdapter: RfidAdapter,
    private readonly dataTransformationService: DataTransformationService,
    private readonly routingService: RoutingService,
    private readonly metricsService: MetricsService,
    private readonly eventEmitter: EventEmitter2,
  ) {
    this.setupEventListeners();
  }

  async processRfidRequest(
    request: RfidProcessingRequest,
    endpoint: IntegrationEndpoint,
  ): Promise<RfidProcessingResult> {
    const startTime = Date.now();
    
    this.logger.log(`📡 Обработка RFID запроса ${request.action} для интеграции ${endpoint.name}`);

    const result: RfidProcessingResult = {
      success: false,
      action: request.action,
      endpointId: request.endpointId,
      errors: [],
      processingTime: 0,
    };

    try {
      switch (request.action) {
        case 'start_reading':
          result.success = await this.handleStartReading(endpoint);
          break;

        case 'stop_reading':
          await this.handleStopReading(endpoint);
          result.success = true;
          break;

        case 'read_tag':
          if (!request.tagId) {
            throw new Error('Не указан ID тега для чтения');
          }
          result.data = await this.handleReadTag(request.tagId);
          result.success = !!result.data;
          break;

        case 'write_tag':
          if (!request.tagId || !request.data) {
            throw new Error('Не указаны данные для записи в тег');
          }
          result.success = await this.handleWriteTag(
            endpoint,
            request.tagId,
            request.data,
            request.bank,
          );
          break;

        case 'lock_tag':
          if (!request.tagId) {
            throw new Error('Не указан ID тега для блокировки');
          }
          result.success = await this.handleLockTag(endpoint, request.tagId);
          break;

        case 'inventory':
          result.data = await this.handleInventory(endpoint);
          result.success = true;
          break;

        default:
          throw new Error(`Неподдерживаемое действие: ${request.action}`);
      }

      // Получаем статистику считывателя
      const stats = await this.rfidAdapter.getReaderStats(request.endpointId);
      result.readerStats = stats;
      result.tagCount = stats?.uniqueTags || 0;

      result.processingTime = Date.now() - startTime;

      // Записываем метрики
      await this.metricsService.recordMessage(
        endpoint.id,
        JSON.stringify(request).length,
        result.processingTime,
      );

      this.logger.log(
        `✅ RFID запрос ${request.action} обработан для ${endpoint.name}: ` +
        `${result.processingTime}ms`
      );

      return result;

    } catch (error) {
      result.success = false;
      result.errors.push(error.message);
      result.processingTime = Date.now() - startTime;

      this.logger.error(`❌ Ошибка обработки RFID запроса ${request.action}:`, error.stack);

      await this.metricsService.recordError(
        endpoint.id,
        error.message,
        result.processingTime,
      );

      return result;
    }
  }

  private async handleStartReading(endpoint: IntegrationEndpoint): Promise<boolean> {
    try {
      const connected = await this.rfidAdapter.connect(endpoint);
      
      if (connected) {
        this.logger.log(`📡 RFID чтение запущено для ${endpoint.name}`);
      }
      
      return connected;
    } catch (error) {
      this.logger.error(`❌ Ошибка запуска RFID чтения для ${endpoint.name}:`, error.message);
      throw error;
    }
  }

  private async handleStopReading(endpoint: IntegrationEndpoint): Promise<void> {
    try {
      await this.rfidAdapter.disconnect(endpoint.id);
      this.logger.log(`🛑 RFID чтение остановлено для ${endpoint.name}`);
    } catch (error) {
      this.logger.error(`❌ Ошибка остановки RFID чтения для ${endpoint.name}:`, error.message);
      throw error;
    }
  }

  private async handleReadTag(tagId: string): Promise<RfidTag | null> {
    try {
      const tag = await this.rfidAdapter.getTag(tagId);
      
      if (tag) {
        this.logger.debug(`📋 RFID тег найден: ${tagId} (RSSI: ${tag.rssi}dBm, reads: ${tag.readCount})`);
      } else {
        this.logger.warn(`⚠️ RFID тег не найден: ${tagId}`);
      }
      
      return tag || null;
    } catch (error) {
      this.logger.error(`❌ Ошибка чтения RFID тега ${tagId}:`, error.message);
      throw error;
    }
  }

  private async handleWriteTag(
    endpoint: IntegrationEndpoint,
    tagId: string,
    data: string,
    bank: 'epc' | 'tid' | 'user' = 'user',
  ): Promise<boolean> {
    try {
      const success = await this.rfidAdapter.writeTag(endpoint.id, tagId, data, bank);
      
      if (success) {
        this.logger.log(`✏️ Запись в RFID тег ${tagId} успешна (банк: ${bank}, данные: ${data})`);
        
        // Отправляем событие о записи
        this.eventEmitter.emit('rfid.tag.written', {
          endpointId: endpoint.id,
          tagId,
          bank,
          data,
          timestamp: new Date(),
        });
      }
      
      return success;
    } catch (error) {
      this.logger.error(`❌ Ошибка записи в RFID тег ${tagId}:`, error.message);
      throw error;
    }
  }

  private async handleLockTag(endpoint: IntegrationEndpoint, tagId: string): Promise<boolean> {
    try {
      // Маска блокировки по умолчанию (блокируем EPC и User memory)
      const lockMask = '0x03';
      const success = await this.rfidAdapter.lockTag(endpoint.id, tagId, lockMask);
      
      if (success) {
        this.logger.log(`🔒 Блокировка RFID тега ${tagId} успешна`);
        
        // Отправляем событие о блокировке
        this.eventEmitter.emit('rfid.tag.locked', {
          endpointId: endpoint.id,
          tagId,
          lockMask,
          timestamp: new Date(),
        });
      }
      
      return success;
    } catch (error) {
      this.logger.error(`❌ Ошибка блокировки RFID тега ${tagId}:`, error.message);
      throw error;
    }
  }

  private async handleInventory(endpoint: IntegrationEndpoint): Promise<TagInventoryReport> {
    try {
      const connectedTags = await this.rfidAdapter.getConnectedTags(endpoint.id);
      const stats = await this.rfidAdapter.getReaderStats(endpoint.id);
      
      const reportId = `inventory_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const now = new Date();
      
      const tags = Array.from(connectedTags.values()).map(tag => ({
        epc: tag.epc,
        rssi: tag.rssi || 0,
        readCount: tag.readCount || 0,
        firstSeen: tag.timestamp,
        lastSeen: tag.timestamp,
        antennas: ['1'], // В реальной системе нужно отслеживать антенны
        isMoving: tag.isMoving || false,
        metadata: tag,
      }));
      
      // Группируем по антеннам (заглушка)
      const antennaStats = [{
        antennaId: '1',
        antennaName: 'Антенна 1',
        tagCount: tags.length,
        averageRssi: tags.length > 0 ? 
          tags.reduce((sum, tag) => sum + tag.rssi, 0) / tags.length : 0,
        tags: tags.map(tag => tag.epc),
      }];

      const report: TagInventoryReport = {
        reportId,
        generatedAt: now,
        readerId: endpoint.id,
        readerName: endpoint.name,
        totalTags: tags.length,
        uniqueTags: tags.length,
        tags,
        antennaStats,
        timeRange: {
          start: new Date(now.getTime() - 3600000), // последний час
          end: now,
          duration: 60,
        },
      };

      this.logger.log(`📊 Инвентаризация RFID завершена для ${endpoint.name}: ${tags.length} тегов`);
      
      return report;
    } catch (error) {
      this.logger.error(`❌ Ошибка инвентаризации RFID для ${endpoint.name}:`, error.message);
      throw error;
    }
  }

  private setupEventListeners(): void {
    // Обрабатываем события от RFID адаптера
    this.eventEmitter.on('rfid.tag.read', this.handleTagRead.bind(this));
    this.eventEmitter.on('rfid.connected', this.handleRfidConnected.bind(this));
    this.eventEmitter.on('rfid.disconnected', this.handleRfidDisconnected.bind(this));
    this.eventEmitter.on('rfid.error', this.handleRfidError.bind(this));
  }

  private async handleTagRead(event: {
    endpointId: string;
    endpointName: string;
    read: RfidRead;
    tag: RfidTag;
    timestamp: Date;
  }): Promise<void> {
    try {
      const messageCount = this.processedReads.get(event.endpointId) || 0;
      this.processedReads.set(event.endpointId, messageCount + 1);

      // Создаем событие отслеживания тега
      const trackingEvent = await this.createTrackingEvent(event);
      
      // Сохраняем в историю
      const history = this.tagHistory.get(event.read.tagId) || [];
      history.push(trackingEvent);
      this.tagHistory.set(event.read.tagId, history);

      // Обновляем присутствие в зонах
      await this.updateZonePresence(event.read);

      this.logger.debug(
        `📋 RFID тег обработан: ${event.read.tagId} в зоне ${event.read.metadata?.zone || 'неизвестной'} ` +
        `(RSSI: ${event.read.rssi}dBm, антенна: ${event.read.antennaId})`
      );

      // Создаем структурированные данные для трансформации и маршрутизации
      const structuredData = this.createStructuredData(event);
      
      // Находим интеграцию для обработки
      // В реальной системе здесь должен быть запрос к базе данных
      // const endpoint = await this.integrationEndpointService.findOne(event.endpointId);
      
      // Пока что просто отправляем событие дальше
      this.eventEmitter.emit('rfid.tag.processed', {
        endpointId: event.endpointId,
        tagId: event.read.tagId,
        trackingEvent,
        structuredData,
        timestamp: event.timestamp,
      });

    } catch (error) {
      this.logger.error('❌ Ошибка обработки RFID чтения:', error.message);
    }
  }

  private async createTrackingEvent(event: {
    endpointId: string;
    endpointName: string;
    read: RfidRead;
    tag: RfidTag;
    timestamp: Date;
  }): Promise<TagTrackingEvent> {
    const eventId = `track_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Определяем тип события
    let eventType: TagTrackingEvent['eventType'] = 'tag_first_seen';
    const history = this.tagHistory.get(event.read.tagId) || [];
    
    if (history.length > 0) {
      const lastEvent = history[history.length - 1];
      
      if (lastEvent.location.antennaId !== event.read.antennaId) {
        eventType = 'tag_moved';
      } else if (event.tag.isMoving) {
        eventType = 'tag_moved';
      } else {
        eventType = 'tag_first_seen'; // Повторное чтение в той же зоне
      }
    }

    const trackingEvent: TagTrackingEvent = {
      eventId,
      tagId: event.read.tagId,
      eventType,
      timestamp: event.timestamp,
      location: {
        readerId: event.read.readerId,
        readerName: event.endpointName,
        antennaId: event.read.antennaId,
        zone: event.read.metadata?.zone,
      },
      data: {
        rssi: event.read.rssi,
        readCount: event.tag.readCount || 1,
      },
      metadata: {
        equipment: event.read.metadata?.equipment,
        operator: event.read.metadata?.operator,
        direction: event.read.metadata?.direction,
      },
    };

    // Добавляем предыдущее местоположение если есть
    if (history.length > 0) {
      const lastEvent = history[history.length - 1];
      trackingEvent.previousLocation = lastEvent.location;
      
      // Вычисляем время пребывания
      const dwellTime = (event.timestamp.getTime() - lastEvent.timestamp.getTime()) / 1000;
      trackingEvent.data.dwellTime = dwellTime;
    }

    return trackingEvent;
  }

  private async updateZonePresence(read: RfidRead): Promise<void> {
    const zone = read.metadata?.zone || 'unknown';
    
    if (!this.zonePresence.has(zone)) {
      this.zonePresence.set(zone, new Set());
    }
    
    const zoneSet = this.zonePresence.get(zone);
    zoneSet.add(read.tagId);
    
    // Очищаем тег из других зон (предполагаем, что тег может быть только в одной зоне)
    for (const [otherZone, otherSet] of this.zonePresence) {
      if (otherZone !== zone) {
        otherSet.delete(read.tagId);
      }
    }
  }

  private createStructuredData(event: {
    endpointId: string;
    endpointName: string;
    read: RfidRead;
    tag: RfidTag;
    timestamp: Date;
  }): any {
    return {
      // Основные данные RFID
      rfid: {
        tagId: event.read.tagId,
        epc: event.read.epc,
        rssi: event.read.rssi,
        readCount: event.tag.readCount,
        timestamp: event.read.timestamp,
        isMoving: event.tag.isMoving,
      },
      
      // Местоположение
      location: {
        readerId: event.read.readerId,
        readerName: event.endpointName,
        antennaId: event.read.antennaId,
        zone: event.read.metadata?.zone,
      },
      
      // Контекст
      context: {
        direction: event.read.metadata?.direction,
        equipment: event.read.metadata?.equipment,
        operator: event.read.metadata?.operator,
        location: event.read.metadata?.location,
      },
      
      // Метаданные интеграции
      integration: {
        endpointId: event.endpointId,
        endpointName: event.endpointName,
        endpointType: 'RFID',
      },
      
      // Метаданные обработки
      processing: {
        timestamp: event.timestamp,
        messageCount: this.processedReads.get(event.endpointId) || 0,
      },
    };
  }

  private async handleRfidConnected(event: {
    endpointId: string;
    endpointName: string;
    timestamp: Date;
  }): Promise<void> {
    this.logger.log(`🔗 RFID считыватель подключен: ${event.endpointName}`);
    
    await this.metricsService.recordConnectionAttempt(event.endpointId, true);
  }

  private async handleRfidDisconnected(event: {
    endpointId: string;
    endpointName: string;
    timestamp: Date;
  }): Promise<void> {
    this.logger.warn(`🔌 RFID считыватель отключен: ${event.endpointName}`);
    
    // Очищаем данные для этого считывателя
    this.processedReads.delete(event.endpointId);
  }

  private async handleRfidError(event: {
    endpointId: string;
    endpointName: string;
    error: string;
    timestamp: Date;
  }): Promise<void> {
    this.logger.error(`❌ RFID ошибка ${event.endpointName}: ${event.error}`);
    
    await this.metricsService.recordConnectionAttempt(event.endpointId, false);
  }

  // Публичные методы для внешнего использования
  async getConnectedTags(endpointId?: string): Promise<Map<string, RfidTag>> {
    return await this.rfidAdapter.getConnectedTags(endpointId);
  }

  async getTag(tagId: string): Promise<RfidTag | undefined> {
    return await this.rfidAdapter.getTag(tagId);
  }

  async getTagHistory(tagId: string): Promise<TagTrackingEvent[]> {
    return this.tagHistory.get(tagId) || [];
  }

  async getZonePresence(zone?: string): Promise<Map<string, Set<string>>> {
    if (zone) {
      const zoneSet = this.zonePresence.get(zone) || new Set();
      return new Map([[zone, zoneSet]]);
    }
    
    return new Map(this.zonePresence);
  }

  async getProcessingStats(endpointId?: string) {
    const readerStats = await this.rfidAdapter.getReaderStats(endpointId);
    const processedCount = endpointId ? 
      this.processedReads.get(endpointId) || 0 :
      Array.from(this.processedReads.values()).reduce((sum, count) => sum + count, 0);

    return {
      rfid: readerStats,
      processedReads: processedCount,
      tagHistory: this.tagHistory.size,
      zonePresence: Array.from(this.zonePresence.entries()).map(([zone, tags]) => ({
        zone,
        tagCount: tags.size,
        tags: Array.from(tags),
      })),
      lastUpdate: new Date(),
    };
  }

  async generateInventoryReport(
    endpointId: string,
    timeRange?: { start: Date; end: Date },
  ): Promise<TagInventoryReport> {
    // Находим интеграцию (заглушка)
    const endpoint = { id: endpointId, name: `RFID Reader ${endpointId}` };
    
    return await this.handleInventory(endpoint as IntegrationEndpoint);
  }

  async testRfidConnection(endpoint: IntegrationEndpoint): Promise<boolean> {
    return await this.rfidAdapter.testConnection(endpoint);
  }

  async clearTagData(tagId?: string): Promise<void> {
    await this.rfidAdapter.clearTagCache(tagId);
    
    if (tagId) {
      this.tagHistory.delete(tagId);
      
      // Удаляем из всех зон
      for (const zoneSet of this.zonePresence.values()) {
        zoneSet.delete(tagId);
      }
      
      this.logger.log(`🧹 Данные RFID тега ${tagId} очищены`);
    } else {
      this.tagHistory.clear();
      this.zonePresence.clear();
      this.processedReads.clear();
      this.logger.log('🧹 Все данные RFID тегов очищены');
    }
  }

  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    details: any;
  }> {
    try {
      const stats = await this.getProcessingStats();
      
      const status = (stats.rfid?.activeReaders || 0) > 0 ? 'healthy' : 
                    stats.processedReads > 0 ? 'degraded' : 'unhealthy';
      
      return {
        status,
        details: {
          activeReaders: stats.rfid?.activeReaders || 0,
          totalTags: stats.rfid?.uniqueTags || 0,
          processedReads: stats.processedReads,
          tagHistory: stats.tagHistory,
          zonesWithTags: stats.zonePresence.filter(z => z.tagCount > 0).length,
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