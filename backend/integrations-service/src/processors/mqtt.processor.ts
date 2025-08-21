import {
  Injectable,
  Logger,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { GpsMqttAdapter, EquipmentStatus, GpsPosition } from '../adapters/gps-mqtt.adapter';
import { DataTransformationService } from '../services/data-transformation.service';
import { RoutingService } from '../services/routing.service';
import { MetricsService } from '../services/metrics.service';
import { IntegrationEndpoint } from '../entities/integration-endpoint.entity';

export interface MqttProcessingRequest {
  endpointId: string;
  action: 'connect' | 'subscribe' | 'publish' | 'disconnect';
  topics?: string[];
  message?: any;
  qos?: 0 | 1 | 2;
  metadata?: {
    operatorId?: string;
    sessionId?: string;
    requestSource?: string;
  };
}

export interface MqttProcessingResult {
  success: boolean;
  action: string;
  endpointId: string;
  data?: any;
  errors?: string[];
  processingTime: number;
  connectedDevices?: number;
  activeSubscriptions?: number;
  metadata?: any;
}

export interface EquipmentTrackingReport {
  reportId: string;
  generatedAt: Date;
  timeRange: {
    start: Date;
    end: Date;
  };
  devices: Array<{
    deviceId: string;
    equipmentId: string;
    equipmentType: string;
    totalDistance: number; // км
    averageSpeed: number; // км/ч
    maxSpeed: number; // км/ч
    operatingTime: number; // минуты
    idleTime: number; // минуты
    fuelConsumption?: number; // литры
    engineHours?: number; // часы
    alertsCount: number;
    zonesVisited: string[];
    route: Array<{
      timestamp: Date;
      latitude: number;
      longitude: number;
      speed: number;
      zone?: string;
    }>;
  }>;
  summary: {
    totalDevices: number;
    totalDistance: number;
    totalOperatingTime: number;
    totalAlerts: number;
    deviceUtilization: number; // процент
    fuelEfficiency?: number; // км/литр
  };
}

@Injectable()
export class MqttProcessor {
  private readonly logger = new Logger(MqttProcessor.name);
  private readonly activeConnections = new Map<string, Date>();
  private readonly processedMessages = new Map<string, number>();

  constructor(
    private readonly gpsMqttAdapter: GpsMqttAdapter,
    private readonly dataTransformationService: DataTransformationService,
    private readonly routingService: RoutingService,
    private readonly metricsService: MetricsService,
    private readonly eventEmitter: EventEmitter2,
  ) {
    this.setupEventListeners();
  }

  async processMqttRequest(
    request: MqttProcessingRequest,
    endpoint: IntegrationEndpoint,
  ): Promise<MqttProcessingResult> {
    const startTime = Date.now();
    
    this.logger.log(`📡 Обработка MQTT запроса ${request.action} для интеграции ${endpoint.name}`);

    const result: MqttProcessingResult = {
      success: false,
      action: request.action,
      endpointId: request.endpointId,
      errors: [],
      processingTime: 0,
    };

    try {
      switch (request.action) {
        case 'connect':
          result.success = await this.handleConnect(endpoint);
          if (result.success) {
            this.activeConnections.set(request.endpointId, new Date());
          }
          break;

        case 'disconnect':
          await this.handleDisconnect(endpoint);
          result.success = true;
          this.activeConnections.delete(request.endpointId);
          break;

        case 'subscribe':
          if (!request.topics || request.topics.length === 0) {
            throw new Error('Не указаны топики для подписки');
          }
          await this.handleSubscribe(endpoint, request.topics, request.qos);
          result.success = true;
          break;

        case 'publish':
          if (!request.message) {
            throw new Error('Не указано сообщение для публикации');
          }
          await this.handlePublish(endpoint, request.message, request.metadata);
          result.success = true;
          break;

        default:
          throw new Error(`Неподдерживаемое действие: ${request.action}`);
      }

      // Получаем статистику подключений
      const stats = await this.gpsMqttAdapter.getConnectionStats(request.endpointId);
      result.connectedDevices = stats.activeDevices;
      result.activeSubscriptions = stats.totalConnections;

      result.processingTime = Date.now() - startTime;

      // Записываем метрики
      await this.metricsService.recordMessage(
        endpoint.id,
        JSON.stringify(request).length,
        result.processingTime,
      );

      this.logger.log(
        `✅ MQTT запрос ${request.action} обработан для ${endpoint.name}: ` +
        `${result.processingTime}ms`
      );

      return result;

    } catch (error) {
      result.success = false;
      result.errors.push(error.message);
      result.processingTime = Date.now() - startTime;

      this.logger.error(`❌ Ошибка обработки MQTT запроса ${request.action}:`, error.stack);

      await this.metricsService.recordError(
        endpoint.id,
        error.message,
        result.processingTime,
      );

      return result;
    }
  }

  private async handleConnect(endpoint: IntegrationEndpoint): Promise<boolean> {
    try {
      const connected = await this.gpsMqttAdapter.connect(endpoint);
      
      if (connected) {
        this.logger.log(`🔗 MQTT подключение установлено для ${endpoint.name}`);
        
        // Автоматически подписываемся на настроенные топики
        const topics = endpoint.connectionConfig.mqttConfig?.topics || [];
        if (topics.length > 0) {
          await this.gpsMqttAdapter.subscribe(
            endpoint.id,
            topics,
            endpoint.connectionConfig.mqttConfig?.qos || 1,
          );
        }
      }
      
      return connected;
    } catch (error) {
      this.logger.error(`❌ Ошибка MQTT подключения для ${endpoint.name}:`, error.message);
      throw error;
    }
  }

  private async handleDisconnect(endpoint: IntegrationEndpoint): Promise<void> {
    try {
      await this.gpsMqttAdapter.disconnect(endpoint.id);
      this.logger.log(`🔌 MQTT отключение выполнено для ${endpoint.name}`);
    } catch (error) {
      this.logger.error(`❌ Ошибка MQTT отключения для ${endpoint.name}:`, error.message);
      throw error;
    }
  }

  private async handleSubscribe(
    endpoint: IntegrationEndpoint,
    topics: string[],
    qos?: 0 | 1 | 2,
  ): Promise<void> {
    try {
      await this.gpsMqttAdapter.subscribe(endpoint.id, topics, qos || 1);
      this.logger.log(`📡 Подписка на топики выполнена для ${endpoint.name}: ${topics.join(', ')}`);
    } catch (error) {
      this.logger.error(`❌ Ошибка подписки MQTT для ${endpoint.name}:`, error.message);
      throw error;
    }
  }

  private async handlePublish(
    endpoint: IntegrationEndpoint,
    message: any,
    metadata?: any,
  ): Promise<void> {
    try {
      // Трансформируем данные перед отправкой
      let transformedData = message;
      
      if (endpoint.dataProcessingConfig) {
        const transformationResult = await this.dataTransformationService.processData(
          message,
          endpoint.dataProcessingConfig,
          endpoint.id,
        );

        if (transformationResult.success) {
          transformedData = transformationResult.data;
        } else {
          throw new Error(`Ошибка трансформации данных: ${transformationResult.errors?.join(', ')}`);
        }
      }

      // Маршрутизируем данные
      if (endpoint.routingConfig) {
        const routingResult = await this.routingService.routeData(
          transformedData,
          endpoint.routingConfig,
          endpoint.id,
        );

        if (!routingResult.success) {
          throw new Error(`Ошибка маршрутизации: ${routingResult.errors?.join(', ')}`);
        }
      }

      this.logger.log(`📤 Сообщение обработано и отправлено для ${endpoint.name}`);
    } catch (error) {
      this.logger.error(`❌ Ошибка публикации MQTT для ${endpoint.name}:`, error.message);
      throw error;
    }
  }

  private setupEventListeners(): void {
    // Обрабатываем события от GPS/MQTT адаптера
    this.eventEmitter.on('gps.position.updated', this.handlePositionUpdate.bind(this));
    this.eventEmitter.on('gps.mqtt.connected', this.handleMqttConnected.bind(this));
    this.eventEmitter.on('gps.mqtt.disconnected', this.handleMqttDisconnected.bind(this));
    this.eventEmitter.on('gps.mqtt.error', this.handleMqttError.bind(this));
    this.eventEmitter.on('equipment.critical.alert', this.handleCriticalAlert.bind(this));
  }

  private async handlePositionUpdate(event: {
    endpointId: string;
    equipmentStatus: EquipmentStatus;
    previousPosition?: GpsPosition;
    zone?: any;
    timestamp: Date;
  }): Promise<void> {
    try {
      const messageCount = this.processedMessages.get(event.endpointId) || 0;
      this.processedMessages.set(event.endpointId, messageCount + 1);

      this.logger.debug(
        `📍 Обновление позиции устройства ${event.equipmentStatus.deviceId}: ` +
        `${event.equipmentStatus.position.latitude.toFixed(6)}, ` +
        `${event.equipmentStatus.position.longitude.toFixed(6)}, ` +
        `скорость: ${event.equipmentStatus.position.speed} км/ч, ` +
        `зона: ${event.zone?.name || 'неизвестна'}`
      );

      // Отправляем уведомление о смене зоны
      if (event.zone && event.previousPosition) {
        this.eventEmitter.emit('equipment.zone.changed', {
          endpointId: event.endpointId,
          deviceId: event.equipmentStatus.deviceId,
          equipmentId: event.equipmentStatus.equipmentId,
          newZone: event.zone,
          position: event.equipmentStatus.position,
          timestamp: event.timestamp,
        });
      }

    } catch (error) {
      this.logger.error('❌ Ошибка обработки обновления позиции:', error.message);
    }
  }

  private async handleMqttConnected(event: {
    endpointId: string;
    endpointName: string;
    timestamp: Date;
  }): Promise<void> {
    this.logger.log(`🔗 MQTT соединение установлено: ${event.endpointName}`);
    
    await this.metricsService.recordConnectionAttempt(event.endpointId, true);
  }

  private async handleMqttDisconnected(event: {
    endpointId: string;
    endpointName: string;
    timestamp: Date;
  }): Promise<void> {
    this.logger.warn(`🔌 MQTT соединение разорвано: ${event.endpointName}`);
    
    this.activeConnections.delete(event.endpointId);
  }

  private async handleMqttError(event: {
    endpointId: string;
    endpointName: string;
    error: string;
    timestamp: Date;
  }): Promise<void> {
    this.logger.error(`❌ MQTT ошибка ${event.endpointName}: ${event.error}`);
    
    await this.metricsService.recordConnectionAttempt(event.endpointId, false);
  }

  private async handleCriticalAlert(event: {
    endpointId: string;
    deviceId: string;
    equipmentId: string;
    equipmentType: string;
    alert: string;
    position: GpsPosition;
    severity: string;
    timestamp: Date;
  }): Promise<void> {
    this.logger.error(
      `🚨 КРИТИЧЕСКИЙ АЛЕРТ для ${event.equipmentType} ${event.equipmentId}: ` +
      `${event.alert} в позиции ${event.position.latitude}, ${event.position.longitude}`
    );

    // Отправляем критический алерт в систему уведомлений
    this.eventEmitter.emit('alert.critical', {
      type: 'equipment_alert',
      severity: event.severity,
      message: `${event.equipmentType} ${event.equipmentId}: ${event.alert}`,
      data: event,
      timestamp: event.timestamp,
    });
  }

  // Публичные методы для внешнего использования
  async getConnectedDevices(endpointId?: string): Promise<Map<string, EquipmentStatus>> {
    return await this.gpsMqttAdapter.getConnectedDevices(endpointId);
  }

  async getDeviceStatus(deviceId: string): Promise<EquipmentStatus | undefined> {
    return await this.gpsMqttAdapter.getDeviceStatus(deviceId);
  }

  async getDevicesInZone(zoneId: string): Promise<EquipmentStatus[]> {
    return await this.gpsMqttAdapter.getDevicesInZone(zoneId);
  }

  async getProcessingStats(endpointId?: string) {
    const connectionStats = await this.gpsMqttAdapter.getConnectionStats(endpointId);
    const processedCount = endpointId ? 
      this.processedMessages.get(endpointId) || 0 :
      Array.from(this.processedMessages.values()).reduce((sum, count) => sum + count, 0);

    return {
      connections: connectionStats,
      processedMessages: processedCount,
      activeConnections: this.activeConnections.size,
      lastUpdate: new Date(),
    };
  }

  async generateTrackingReport(
    deviceIds: string[],
    startTime: Date,
    endTime: Date,
  ): Promise<EquipmentTrackingReport> {
    const reportId = `tracking_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    this.logger.log(
      `📊 Генерация отчета отслеживания ${reportId} для ${deviceIds.length} устройств ` +
      `с ${startTime.toISOString()} по ${endTime.toISOString()}`
    );

    const devices = [];
    let totalDistance = 0;
    let totalOperatingTime = 0;
    let totalAlerts = 0;

    for (const deviceId of deviceIds) {
      const deviceStatus = await this.gpsMqttAdapter.getDeviceStatus(deviceId);
      
      if (deviceStatus) {
        // В реальной системе здесь должен быть запрос к истории позиций из БД
        const deviceData = {
          deviceId,
          equipmentId: deviceStatus.equipmentId,
          equipmentType: deviceStatus.equipmentType,
          totalDistance: Math.random() * 100, // заглушка
          averageSpeed: Math.random() * 30,
          maxSpeed: Math.random() * 50,
          operatingTime: Math.random() * 480, // минуты
          idleTime: Math.random() * 120,
          alertsCount: deviceStatus.alerts?.length || 0,
          zonesVisited: ['main_gate', 'container_yard'], // заглушка
          route: [
            {
              timestamp: deviceStatus.position.timestamp,
              latitude: deviceStatus.position.latitude,
              longitude: deviceStatus.position.longitude,
              speed: deviceStatus.position.speed,
              zone: deviceStatus.workingArea,
            }
          ],
        };

        devices.push(deviceData);
        totalDistance += deviceData.totalDistance;
        totalOperatingTime += deviceData.operatingTime;
        totalAlerts += deviceData.alertsCount;
      }
    }

    const report: EquipmentTrackingReport = {
      reportId,
      generatedAt: new Date(),
      timeRange: { start: startTime, end: endTime },
      devices,
      summary: {
        totalDevices: devices.length,
        totalDistance,
        totalOperatingTime,
        totalAlerts,
        deviceUtilization: devices.length > 0 ? (totalOperatingTime / (devices.length * 480)) * 100 : 0,
      },
    };

    this.logger.log(`✅ Отчет отслеживания ${reportId} сгенерирован`);
    
    return report;
  }

  async testMqttConnection(endpoint: IntegrationEndpoint): Promise<boolean> {
    return await this.gpsMqttAdapter.testConnection(endpoint);
  }

  async clearDeviceData(deviceId?: string): Promise<void> {
    await this.gpsMqttAdapter.clearDeviceData(deviceId);
    
    if (deviceId) {
      this.logger.log(`🧹 Данные устройства ${deviceId} очищены`);
    } else {
      this.processedMessages.clear();
      this.logger.log('🧹 Все данные устройств очищены');
    }
  }

  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    details: any;
  }> {
    try {
      const stats = await this.getProcessingStats();
      
      const status = stats.activeConnections > 0 ? 'healthy' : 
                    stats.connections.totalConnections > 0 ? 'degraded' : 'unhealthy';
      
      return {
        status,
        details: {
          activeConnections: stats.activeConnections,
          totalConnections: stats.connections.totalConnections,
          activeDevices: stats.connections.activeDevices,
          processedMessages: stats.processedMessages,
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