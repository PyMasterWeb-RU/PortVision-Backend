import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import * as mqtt from 'mqtt';
import { IntegrationEndpoint } from '../entities/integration-endpoint.entity';

export interface GpsPosition {
  deviceId: string;
  latitude: number;
  longitude: number;
  altitude?: number;
  speed: number; // км/ч
  heading?: number; // градусы (0-360)
  accuracy?: number; // метры
  timestamp: Date;
  satelliteCount?: number;
  hdop?: number; // Horizontal Dilution of Precision
  battery?: number; // процент заряда
  ignition?: boolean; // зажигание включено
  engineHours?: number; // моточасы
  odometer?: number; // одометр в км
  fuel?: number; // уровень топлива в %
  temperature?: number; // температура двигателя
  status: 'moving' | 'idle' | 'parked' | 'maintenance' | 'offline';
}

export interface EquipmentStatus {
  deviceId: string;
  equipmentId: string;
  equipmentType: 'rtg' | 'rmg' | 'reach_stacker' | 'forklift' | 'truck' | 'trailer' | 'chassis';
  position: GpsPosition;
  operationalStatus: 'operational' | 'maintenance' | 'breakdown' | 'idle';
  workingArea?: string;
  assignedTask?: string;
  operatorId?: string;
  lastMaintenance?: Date;
  nextMaintenance?: Date;
  alerts?: string[];
  sensor1?: number; // Датчик 1 (например, температура гидравлики)
  sensor2?: number; // Датчик 2 (например, давление)
  sensor3?: number; // Датчик 3 (например, вибрация)
  metadata?: Record<string, any>;
}

export interface MqttConnectionConfig {
  host: string;
  port: number;
  clientId: string;
  username?: string;
  password?: string;
  keepAlive: number;
  clean: boolean;
  reconnectPeriod: number;
  topics: string[];
  qos: 0 | 1 | 2;
  ssl?: {
    enabled: boolean;
    rejectUnauthorized: boolean;
    certificatePath?: string;
  };
}

export interface GpsProtocolConfig {
  protocol: 'wialon' | 'galileosky' | 'teltonika' | 'custom';
  deviceIds?: string[];
  updateInterval: number; // секунды
  trackingFields: string[];
  messageFormat?: 'json' | 'binary' | 'text';
  coordinate_system?: 'wgs84' | 'gsk-2011' | 'pulkovo42';
}

@Injectable()
export class GpsMqttAdapter implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(GpsMqttAdapter.name);
  private readonly mqttClients = new Map<string, mqtt.MqttClient>();
  private readonly subscriptions = new Map<string, Set<string>>();
  private readonly deviceStatuses = new Map<string, EquipmentStatus>();
  private readonly lastPositions = new Map<string, GpsPosition>();
  
  // Геозоны терминала для определения местоположения техники
  private readonly terminalZones = new Map<string, {
    name: string;
    type: 'yard' | 'gate' | 'quay' | 'storage' | 'maintenance' | 'parking';
    polygon: Array<[number, number]>; // [lat, lng]
    description?: string;
  }>();

  constructor(private readonly eventEmitter: EventEmitter2) {
    this.initializeTerminalZones();
  }

  async onModuleInit() {
    this.logger.log('🛰️ Инициализация GPS/MQTT адаптера...');
  }

  async onModuleDestroy() {
    this.logger.log('🔄 Завершение работы GPS/MQTT адаптера...');
    
    // Отключаем все MQTT клиенты
    for (const [clientId, client] of this.mqttClients) {
      try {
        client.end(true);
        this.logger.debug(`✅ MQTT клиент ${clientId} отключен`);
      } catch (error) {
        this.logger.error(`❌ Ошибка отключения MQTT клиента ${clientId}:`, error.message);
      }
    }
    
    this.mqttClients.clear();
    this.subscriptions.clear();
    this.deviceStatuses.clear();
    this.lastPositions.clear();
  }

  async connect(endpoint: IntegrationEndpoint): Promise<boolean> {
    const clientId = endpoint.id;
    const config = endpoint.connectionConfig;

    try {
      this.logger.log(`🔌 Подключение к MQTT брокеру для интеграции ${endpoint.name}...`);

      if (this.mqttClients.has(clientId)) {
        this.logger.warn(`⚠️ MQTT клиент ${clientId} уже подключен`);
        return true;
      }

      const mqttConfig = config.mqttConfig as MqttConnectionConfig;
      const gpsConfig = config.gpsConfig as GpsProtocolConfig;

      // Формируем URL подключения
      const protocol = config.ssl?.enabled ? 'mqtts' : 'mqtt';
      const brokerUrl = `${protocol}://${config.host}:${config.port}`;

      // Опции подключения
      const connectOptions: mqtt.IClientOptions = {
        clientId: mqttConfig.clientId || `portvision_${clientId}`,
        username: config.authentication?.username,
        password: config.authentication?.password,
        keepalive: mqttConfig.keepAlive || 60,
        clean: mqttConfig.clean !== false,
        reconnectPeriod: mqttConfig.reconnectPeriod || 5000,
        connectTimeout: config.timeout || 30000,
        ...(config.ssl?.enabled && {
          rejectUnauthorized: config.ssl.rejectUnauthorized !== false,
          ...(config.ssl.certificatePath && {
            cert: config.ssl.certificatePath,
          }),
        }),
      };

      // Создаем MQTT клиент
      const client = mqtt.connect(brokerUrl, connectOptions);
      
      // Устанавливаем обработчики событий
      this.setupClientEventHandlers(client, endpoint, gpsConfig);
      
      // Сохраняем клиент
      this.mqttClients.set(clientId, client);
      this.subscriptions.set(clientId, new Set());

      // Ждем подключения
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Таймаут подключения к MQTT брокеру'));
        }, connectOptions.connectTimeout);

        client.once('connect', () => {
          clearTimeout(timeout);
          this.logger.log(`✅ MQTT клиент ${endpoint.name} подключен к ${brokerUrl}`);
          resolve(true);
        });

        client.once('error', (error) => {
          clearTimeout(timeout);
          this.logger.error(`❌ Ошибка подключения MQTT для ${endpoint.name}:`, error.message);
          reject(error);
        });
      });

    } catch (error) {
      this.logger.error(`❌ Ошибка создания MQTT подключения для ${endpoint.name}:`, error.stack);
      return false;
    }
  }

  async disconnect(endpointId: string): Promise<void> {
    const client = this.mqttClients.get(endpointId);
    
    if (client) {
      try {
        client.end(true);
        this.mqttClients.delete(endpointId);
        this.subscriptions.delete(endpointId);
        
        this.logger.log(`🔌 MQTT клиент ${endpointId} отключен`);
      } catch (error) {
        this.logger.error(`❌ Ошибка отключения MQTT клиента ${endpointId}:`, error.message);
      }
    }
  }

  async subscribe(endpointId: string, topics: string[], qos: mqtt.QoS = 1): Promise<void> {
    const client = this.mqttClients.get(endpointId);
    
    if (!client) {
      throw new Error(`MQTT клиент ${endpointId} не найден`);
    }

    const subscriptions = this.subscriptions.get(endpointId);
    
    for (const topic of topics) {
      if (!subscriptions.has(topic)) {
        try {
          await new Promise<void>((resolve, reject) => {
            client.subscribe(topic, { qos }, (error) => {
              if (error) {
                reject(error);
              } else {
                subscriptions.add(topic);
                this.logger.debug(`📡 Подписка на топик ${topic} для ${endpointId}`);
                resolve();
              }
            });
          });
        } catch (error) {
          this.logger.error(`❌ Ошибка подписки на топик ${topic}:`, error.message);
          throw error;
        }
      }
    }
  }

  private setupClientEventHandlers(
    client: mqtt.MqttClient,
    endpoint: IntegrationEndpoint,
    gpsConfig: GpsProtocolConfig,
  ): void {
    client.on('connect', async () => {
      this.logger.log(`🔗 MQTT клиент ${endpoint.name} подключен`);
      
      // Подписываемся на топики
      const topics = endpoint.connectionConfig.mqttConfig?.topics || [];
      if (topics.length > 0) {
        await this.subscribe(endpoint.id, topics, endpoint.connectionConfig.mqttConfig?.qos || 1);
      }

      // Отправляем событие о подключении
      this.eventEmitter.emit('gps.mqtt.connected', {
        endpointId: endpoint.id,
        endpointName: endpoint.name,
        timestamp: new Date(),
      });
    });

    client.on('message', (topic, message) => {
      this.handleIncomingMessage(endpoint, topic, message, gpsConfig);
    });

    client.on('error', (error) => {
      this.logger.error(`❌ MQTT ошибка для ${endpoint.name}:`, error.message);
      
      this.eventEmitter.emit('gps.mqtt.error', {
        endpointId: endpoint.id,
        endpointName: endpoint.name,
        error: error.message,
        timestamp: new Date(),
      });
    });

    client.on('disconnect', () => {
      this.logger.warn(`🔌 MQTT клиент ${endpoint.name} отключен`);
      
      this.eventEmitter.emit('gps.mqtt.disconnected', {
        endpointId: endpoint.id,
        endpointName: endpoint.name,
        timestamp: new Date(),
      });
    });

    client.on('reconnect', () => {
      this.logger.log(`🔄 MQTT клиент ${endpoint.name} переподключается...`);
    });

    client.on('close', () => {
      this.logger.debug(`📪 MQTT соединение ${endpoint.name} закрыто`);
    });
  }

  private async handleIncomingMessage(
    endpoint: IntegrationEndpoint,
    topic: string,
    message: Buffer,
    gpsConfig: GpsProtocolConfig,
  ): Promise<void> {
    try {
      this.logger.debug(`📨 Получено MQTT сообщение от ${endpoint.name} в топике ${topic}: ${message.length} байт`);

      // Парсим сообщение в зависимости от протокола
      const gpsData = await this.parseGpsMessage(message, gpsConfig, topic);
      
      if (!gpsData) {
        this.logger.warn(`⚠️ Не удалось распарсить GPS сообщение от ${endpoint.name}`);
        return;
      }

      // Валидируем GPS данные
      const validationResult = this.validateGpsData(gpsData);
      if (!validationResult.isValid) {
        this.logger.warn(`⚠️ Невалидные GPS данные от ${endpoint.name}: ${validationResult.errors.join(', ')}`);
        return;
      }

      // Определяем зону нахождения техники
      const currentZone = this.determineCurrentZone(gpsData.latitude, gpsData.longitude);
      
      // Создаем статус оборудования
      const equipmentStatus: EquipmentStatus = {
        deviceId: gpsData.deviceId,
        equipmentId: this.mapDeviceToEquipment(gpsData.deviceId),
        equipmentType: this.determineEquipmentType(gpsData.deviceId),
        position: gpsData,
        operationalStatus: this.determineOperationalStatus(gpsData),
        workingArea: currentZone?.name,
        lastMaintenance: this.getLastMaintenanceDate(gpsData.deviceId),
        nextMaintenance: this.getNextMaintenanceDate(gpsData.deviceId),
        alerts: this.checkDeviceAlerts(gpsData),
      };

      // Сохраняем текущую позицию и статус
      this.lastPositions.set(gpsData.deviceId, gpsData);
      this.deviceStatuses.set(gpsData.deviceId, equipmentStatus);

      // Отправляем событие о новой позиции
      this.eventEmitter.emit('gps.position.updated', {
        endpointId: endpoint.id,
        equipmentStatus,
        previousPosition: this.getPreviousPosition(gpsData.deviceId),
        zone: currentZone,
        timestamp: gpsData.timestamp,
      });

      // Проверяем критические алерты
      await this.checkCriticalAlerts(equipmentStatus, endpoint);

    } catch (error) {
      this.logger.error(`❌ Ошибка обработки MQTT сообщения от ${endpoint.name}:`, error.stack);
      
      this.eventEmitter.emit('gps.processing.error', {
        endpointId: endpoint.id,
        topic,
        error: error.message,
        timestamp: new Date(),
      });
    }
  }

  private async parseGpsMessage(
    message: Buffer,
    config: GpsProtocolConfig,
    topic: string,
  ): Promise<GpsPosition | null> {
    try {
      switch (config.protocol) {
        case 'wialon':
          return this.parseWialonMessage(message, topic);
        case 'galileosky':
          return this.parseGalileoskyMessage(message, topic);
        case 'teltonika':
          return this.parseTeltonikaMessage(message, topic);
        case 'custom':
          return this.parseCustomMessage(message, topic, config);
        default:
          // Пробуем парсить как JSON
          return this.parseJsonMessage(message, topic);
      }
    } catch (error) {
      this.logger.error(`❌ Ошибка парсинга GPS сообщения (${config.protocol}):`, error.message);
      return null;
    }
  }

  private parseJsonMessage(message: Buffer, topic: string): GpsPosition | null {
    try {
      const data = JSON.parse(message.toString());
      
      // Извлекаем deviceId из топика или данных
      const deviceId = data.deviceId || 
                      data.device_id || 
                      data.imei || 
                      topic.split('/').pop() || 
                      'unknown';

      return {
        deviceId,
        latitude: parseFloat(data.lat || data.latitude),
        longitude: parseFloat(data.lng || data.longitude || data.lon),
        altitude: data.altitude ? parseFloat(data.altitude) : undefined,
        speed: parseFloat(data.speed || 0),
        heading: data.heading ? parseFloat(data.heading) : undefined,
        accuracy: data.accuracy ? parseFloat(data.accuracy) : undefined,
        timestamp: data.timestamp ? new Date(data.timestamp) : new Date(),
        satelliteCount: data.satellites ? parseInt(data.satellites) : undefined,
        hdop: data.hdop ? parseFloat(data.hdop) : undefined,
        battery: data.battery ? parseFloat(data.battery) : undefined,
        ignition: data.ignition,
        engineHours: data.engine_hours ? parseFloat(data.engine_hours) : undefined,
        odometer: data.odometer ? parseFloat(data.odometer) : undefined,
        fuel: data.fuel ? parseFloat(data.fuel) : undefined,
        temperature: data.temperature ? parseFloat(data.temperature) : undefined,
        status: this.determineDeviceStatus(data),
      };
    } catch (error) {
      this.logger.error('❌ Ошибка парсинга JSON GPS сообщения:', error.message);
      return null;
    }
  }

  private parseWialonMessage(message: Buffer, topic: string): GpsPosition | null {
    // Реализация парсинга протокола Wialon
    // Это бинарный протокол, требует специальной обработки
    this.logger.warn('⚠️ Парсинг протокола Wialon пока не реализован');
    return null;
  }

  private parseGalileoskyMessage(message: Buffer, topic: string): GpsPosition | null {
    // Реализация парсинга протокола Galileosky
    this.logger.warn('⚠️ Парсинг протокола Galileosky пока не реализован');
    return null;
  }

  private parseTeltonikaMessage(message: Buffer, topic: string): GpsPosition | null {
    // Реализация парсинга протокола Teltonika
    this.logger.warn('⚠️ Парсинг протокола Teltonika пока не реализован');
    return null;
  }

  private parseCustomMessage(message: Buffer, topic: string, config: GpsProtocolConfig): GpsPosition | null {
    // Пользовательский парсер - можно настроить через конфигурацию
    this.logger.warn('⚠️ Пользовательский парсер GPS пока не реализован');
    return this.parseJsonMessage(message, topic); // Fallback к JSON
  }

  private determineDeviceStatus(data: any): GpsPosition['status'] {
    if (data.ignition === false) return 'parked';
    if (data.speed > 5) return 'moving';
    if (data.ignition === true && data.speed <= 5) return 'idle';
    if (!data.timestamp || (Date.now() - new Date(data.timestamp).getTime()) > 300000) return 'offline';
    return 'idle';
  }

  private validateGpsData(gpsData: GpsPosition): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Проверка координат
    if (isNaN(gpsData.latitude) || gpsData.latitude < -90 || gpsData.latitude > 90) {
      errors.push('Некорректная широта');
    }

    if (isNaN(gpsData.longitude) || gpsData.longitude < -180 || gpsData.longitude > 180) {
      errors.push('Некорректная долгота');
    }

    // Проверка скорости
    if (gpsData.speed < 0 || gpsData.speed > 200) {
      errors.push('Некорректная скорость');
    }

    // Проверка временной метки
    const now = Date.now();
    const timestampAge = now - gpsData.timestamp.getTime();
    if (timestampAge > 3600000) { // старше 1 часа
      errors.push('Устаревшая временная метка');
    }

    // Проверка deviceId
    if (!gpsData.deviceId || gpsData.deviceId === 'unknown') {
      errors.push('Отсутствует идентификатор устройства');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  private determineCurrentZone(latitude: number, longitude: number) {
    for (const [zoneId, zone] of this.terminalZones) {
      if (this.isPointInPolygon([latitude, longitude], zone.polygon)) {
        return { id: zoneId, ...zone };
      }
    }
    return null;
  }

  private isPointInPolygon(point: [number, number], polygon: Array<[number, number]>): boolean {
    const [x, y] = point;
    let inside = false;

    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const [xi, yi] = polygon[i];
      const [xj, yj] = polygon[j];

      if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
        inside = !inside;
      }
    }

    return inside;
  }

  private mapDeviceToEquipment(deviceId: string): string {
    // Здесь должна быть логика сопоставления device ID с ID оборудования
    // Пока что возвращаем тот же ID
    return deviceId;
  }

  private determineEquipmentType(deviceId: string): EquipmentStatus['equipmentType'] {
    // Логика определения типа оборудования по deviceId
    // Можно использовать префиксы, базу данных или конфигурацию
    if (deviceId.startsWith('RTG')) return 'rtg';
    if (deviceId.startsWith('RMG')) return 'rmg';
    if (deviceId.startsWith('RS')) return 'reach_stacker';
    if (deviceId.startsWith('FK')) return 'forklift';
    if (deviceId.startsWith('TR')) return 'truck';
    return 'truck'; // по умолчанию
  }

  private determineOperationalStatus(gpsData: GpsPosition): EquipmentStatus['operationalStatus'] {
    if (gpsData.status === 'offline') return 'breakdown';
    if (gpsData.speed > 0) return 'operational';
    return 'idle';
  }

  private getLastMaintenanceDate(deviceId: string): Date | undefined {
    // Здесь должна быть интеграция с системой планирования ТО
    return undefined;
  }

  private getNextMaintenanceDate(deviceId: string): Date | undefined {
    // Здесь должна быть интеграция с системой планирования ТО
    return undefined;
  }

  private checkDeviceAlerts(gpsData: GpsPosition): string[] {
    const alerts: string[] = [];

    if (gpsData.battery && gpsData.battery < 20) {
      alerts.push('Низкий заряд батареи');
    }

    if (gpsData.temperature && gpsData.temperature > 100) {
      alerts.push('Перегрев двигателя');
    }

    if (gpsData.accuracy && gpsData.accuracy > 50) {
      alerts.push('Низкая точность GPS');
    }

    if (gpsData.satelliteCount && gpsData.satelliteCount < 4) {
      alerts.push('Недостаточно спутников');
    }

    return alerts;
  }

  private async checkCriticalAlerts(
    equipmentStatus: EquipmentStatus,
    endpoint: IntegrationEndpoint,
  ): Promise<void> {
    const alerts = equipmentStatus.alerts || [];

    for (const alert of alerts) {
      if (alert.includes('Перегрев') || alert.includes('breakdown')) {
        this.eventEmitter.emit('equipment.critical.alert', {
          endpointId: endpoint.id,
          deviceId: equipmentStatus.deviceId,
          equipmentId: equipmentStatus.equipmentId,
          equipmentType: equipmentStatus.equipmentType,
          alert,
          position: equipmentStatus.position,
          severity: 'critical',
          timestamp: new Date(),
        });
      }
    }
  }

  private getPreviousPosition(deviceId: string): GpsPosition | undefined {
    return this.lastPositions.get(deviceId);
  }

  private initializeTerminalZones(): void {
    // Инициализация геозон терминала
    // В реальной системе это должно загружаться из базы данных
    
    this.terminalZones.set('main_gate', {
      name: 'Главные ворота',
      type: 'gate',
      polygon: [
        [59.931089, 30.360655],
        [59.931189, 30.360755],
        [59.931089, 30.360855],
        [59.930989, 30.360755],
      ],
      description: 'Зона главных ворот терминала'
    });

    this.terminalZones.set('container_yard', {
      name: 'Контейнерная площадка',
      type: 'yard',
      polygon: [
        [59.930500, 30.360000],
        [59.931500, 30.360000],
        [59.931500, 30.362000],
        [59.930500, 30.362000],
      ],
      description: 'Основная контейнерная площадка'
    });

    this.terminalZones.set('quay_area', {
      name: 'Причальная зона',
      type: 'quay',
      polygon: [
        [59.931000, 30.359000],
        [59.932000, 30.359000],
        [59.932000, 30.360000],
        [59.931000, 30.360000],
      ],
      description: 'Зона причалов для судов'
    });

    this.terminalZones.set('maintenance_area', {
      name: 'Зона ТО',
      type: 'maintenance',
      polygon: [
        [59.930000, 30.359000],
        [59.930500, 30.359000],
        [59.930500, 30.359500],
        [59.930000, 30.359500],
      ],
      description: 'Зона технического обслуживания'
    });
  }

  // Публичные методы для внешнего использования
  async testConnection(endpoint: IntegrationEndpoint): Promise<boolean> {
    try {
      const connected = await this.connect(endpoint);
      if (connected) {
        // Тестируем отправку сообщения
        await this.publishTestMessage(endpoint.id);
        await this.disconnect(endpoint.id);
      }
      return connected;
    } catch (error) {
      this.logger.error(`❌ Тест MQTT соединения неудачен для ${endpoint.name}:`, error.message);
      return false;
    }
  }

  private async publishTestMessage(endpointId: string): Promise<void> {
    const client = this.mqttClients.get(endpointId);
    if (client) {
      const testMessage = JSON.stringify({
        deviceId: 'test_device',
        latitude: 59.931089,
        longitude: 30.360655,
        speed: 0,
        timestamp: new Date().toISOString(),
        status: 'test'
      });

      await new Promise<void>((resolve, reject) => {
        client.publish('test/position', testMessage, { qos: 1 }, (error) => {
          if (error) {
            reject(error);
          } else {
            resolve();
          }
        });
      });
    }
  }

  async getConnectedDevices(endpointId?: string): Promise<Map<string, EquipmentStatus>> {
    if (endpointId) {
      // Возвращаем устройства для конкретной интеграции
      const filteredStatuses = new Map<string, EquipmentStatus>();
      for (const [deviceId, status] of this.deviceStatuses) {
        filteredStatuses.set(deviceId, status);
      }
      return filteredStatuses;
    }
    
    return new Map(this.deviceStatuses);
  }

  async getDeviceStatus(deviceId: string): Promise<EquipmentStatus | undefined> {
    return this.deviceStatuses.get(deviceId);
  }

  async getLastPosition(deviceId: string): Promise<GpsPosition | undefined> {
    return this.lastPositions.get(deviceId);
  }

  async getDevicesInZone(zoneId: string): Promise<EquipmentStatus[]> {
    const zone = this.terminalZones.get(zoneId);
    if (!zone) return [];

    const devicesInZone: EquipmentStatus[] = [];
    
    for (const status of this.deviceStatuses.values()) {
      if (this.isPointInPolygon(
        [status.position.latitude, status.position.longitude],
        zone.polygon
      )) {
        devicesInZone.push(status);
      }
    }

    return devicesInZone;
  }

  async getConnectionStats(endpointId?: string) {
    const stats = {
      totalConnections: this.mqttClients.size,
      activeDevices: this.deviceStatuses.size,
      lastPositions: this.lastPositions.size,
      zones: this.terminalZones.size,
      devicesByStatus: {} as Record<string, number>,
      devicesByType: {} as Record<string, number>,
    };

    // Подсчитываем устройства по статусам и типам
    for (const status of this.deviceStatuses.values()) {
      const deviceStatus = status.operationalStatus;
      const deviceType = status.equipmentType;
      
      stats.devicesByStatus[deviceStatus] = (stats.devicesByStatus[deviceStatus] || 0) + 1;
      stats.devicesByType[deviceType] = (stats.devicesByType[deviceType] || 0) + 1;
    }

    return stats;
  }

  async clearDeviceData(deviceId?: string): Promise<void> {
    if (deviceId) {
      this.deviceStatuses.delete(deviceId);
      this.lastPositions.delete(deviceId);
      this.logger.log(`🧹 Данные устройства ${deviceId} очищены`);
    } else {
      this.deviceStatuses.clear();
      this.lastPositions.clear();
      this.logger.log('🧹 Все данные устройств очищены');
    }
  }
}