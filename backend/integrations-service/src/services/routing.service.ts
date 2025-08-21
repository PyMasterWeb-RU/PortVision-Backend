import {
  Injectable,
  Logger,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { firstValueFrom } from 'rxjs';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface RouteTarget {
  type: 'webhook' | 'kafka' | 'database' | 'file' | 'api';
  endpoint: string;
  condition?: {
    field: string;
    operator: string;
    value: any;
  };
  transformation?: string;
  retryPolicy?: {
    maxAttempts: number;
    backoffMultiplier: number;
    initialDelay: number;
  };
}

export interface RoutingRule {
  condition: {
    field: string;
    operator: string;
    value: any;
  };
  action: 'route' | 'discard' | 'alert' | 'store';
  target?: string;
  parameters?: any;
}

export interface DeadLetterQueueConfig {
  enabled: boolean;
  maxRetries: number;
  storageType: 'database' | 'file' | 'kafka';
  alertOnFailure: boolean;
}

export interface RoutingConfig {
  targets: RouteTarget[];
  rules: RoutingRule[];
  deadLetterQueue?: DeadLetterQueueConfig;
}

export interface RoutingResult {
  success: boolean;
  routedTargets: string[];
  failedTargets: string[];
  errors: string[];
  totalTargets: number;
  processingTime: number;
}

export interface RetryContext {
  endpointId: string;
  targetId: string;
  data: any;
  attempt: number;
  maxAttempts: number;
  nextRetryAt: Date;
  error?: string;
}

@Injectable()
export class RoutingService {
  private readonly logger = new Logger(RoutingService.name);
  private readonly retryQueue = new Map<string, RetryContext>();

  constructor(
    private readonly httpService: HttpService,
    private readonly eventEmitter: EventEmitter2,
    @InjectRedis() private readonly redis: Redis,
  ) {
    // Запускаем обработчик retry очереди
    this.startRetryProcessor();
  }

  async routeData(
    data: any,
    config: RoutingConfig,
    endpointId: string,
  ): Promise<RoutingResult> {
    const startTime = Date.now();
    const result: RoutingResult = {
      success: false,
      routedTargets: [],
      failedTargets: [],
      errors: [],
      totalTargets: 0,
      processingTime: 0,
    };

    try {
      this.logger.debug(`🚀 Начинаем маршрутизацию данных для интеграции ${endpointId}`);

      // Применяем правила маршрутизации
      const applicableTargets = this.filterTargetsByRules(data, config);
      result.totalTargets = applicableTargets.length;

      if (applicableTargets.length === 0) {
        this.logger.warn(`⚠️ Нет подходящих целей для маршрутизации данных из ${endpointId}`);
        result.success = true;
        result.processingTime = Date.now() - startTime;
        return result;
      }

      // Маршрутизируем данные к каждой цели
      const routingPromises = applicableTargets.map(async target => {
        try {
          await this.routeToTarget(data, target, endpointId);
          result.routedTargets.push(target.endpoint);
          return { success: true, target: target.endpoint };
        } catch (error) {
          result.failedTargets.push(target.endpoint);
          result.errors.push(`Ошибка маршрутизации к ${target.endpoint}: ${error.message}`);
          
          // Добавляем в retry очередь если настроена
          if (target.retryPolicy) {
            await this.addToRetryQueue(data, target, endpointId, error.message);
          }
          
          return { success: false, target: target.endpoint, error: error.message };
        }
      });

      const routingResults = await Promise.allSettled(routingPromises);
      
      // Подсчитываем успешные и неудачные попытки
      routingResults.forEach((result, index) => {
        if (result.status === 'rejected') {
          const target = applicableTargets[index];
          this.logger.error(`❌ Критическая ошибка маршрутизации к ${target.endpoint}:`, result.reason);
        }
      });

      result.success = result.failedTargets.length === 0;
      result.processingTime = Date.now() - startTime;

      this.logger.debug(
        `✅ Маршрутизация завершена для интеграции ${endpointId}: ` +
        `${result.routedTargets.length}/${result.totalTargets} успешно, ` +
        `${result.failedTargets.length} ошибок, ` +
        `время: ${result.processingTime}ms`
      );

      // Отправляем событие о завершении маршрутизации
      this.eventEmitter.emit('routing.completed', {
        endpointId,
        success: result.success,
        routedTargets: result.routedTargets.length,
        failedTargets: result.failedTargets.length,
        processingTime: result.processingTime,
      });

      return result;

    } catch (error) {
      result.success = false;
      result.errors.push(`Критическая ошибка маршрутизации: ${error.message}`);
      result.processingTime = Date.now() - startTime;

      this.logger.error(`❌ Критическая ошибка маршрутизации для интеграции ${endpointId}:`, error.stack);
      
      this.eventEmitter.emit('routing.failed', {
        endpointId,
        error: error.message,
        processingTime: result.processingTime,
      });

      return result;
    }
  }

  private filterTargetsByRules(data: any, config: RoutingConfig): RouteTarget[] {
    const applicableTargets: RouteTarget[] = [];

    // Сначала применяем правила маршрутизации
    for (const rule of config.rules) {
      const matches = this.evaluateCondition(data, rule.condition);
      
      if (matches) {
        switch (rule.action) {
          case 'route':
            if (rule.target) {
              const target = config.targets.find(t => t.endpoint === rule.target);
              if (target) {
                applicableTargets.push(target);
              }
            }
            break;
            
          case 'discard':
            this.logger.debug(`🗑️ Данные отброшены по правилу: ${JSON.stringify(rule.condition)}`);
            return [];
            
          case 'alert':
            this.eventEmitter.emit('routing.alert', {
              condition: rule.condition,
              data,
              parameters: rule.parameters,
            });
            break;
            
          case 'store':
            // Сохраняем данные для дальнейшей обработки
            this.storeDataForLaterProcessing(data, rule.parameters);
            break;
        }
      }
    }

    // Если нет специфических правил, проверяем условия для каждой цели
    if (applicableTargets.length === 0) {
      for (const target of config.targets) {
        if (!target.condition || this.evaluateCondition(data, target.condition)) {
          applicableTargets.push(target);
        }
      }
    }

    return applicableTargets;
  }

  private evaluateCondition(data: any, condition: { field: string; operator: string; value: any }): boolean {
    const fieldValue = this.getNestedValue(data, condition.field);
    
    switch (condition.operator) {
      case 'equals':
        return fieldValue === condition.value;
      case 'not_equals':
        return fieldValue !== condition.value;
      case 'contains':
        return String(fieldValue).toLowerCase().includes(String(condition.value).toLowerCase());
      case 'starts_with':
        return String(fieldValue).toLowerCase().startsWith(String(condition.value).toLowerCase());
      case 'ends_with':
        return String(fieldValue).toLowerCase().endsWith(String(condition.value).toLowerCase());
      case 'greater_than':
        return Number(fieldValue) > Number(condition.value);
      case 'less_than':
        return Number(fieldValue) < Number(condition.value);
      case 'greater_than_or_equal':
        return Number(fieldValue) >= Number(condition.value);
      case 'less_than_or_equal':
        return Number(fieldValue) <= Number(condition.value);
      case 'in_array':
        return Array.isArray(condition.value) && condition.value.includes(fieldValue);
      case 'regex':
        const regex = new RegExp(condition.value);
        return regex.test(String(fieldValue));
      case 'exists':
        return fieldValue !== undefined && fieldValue !== null;
      case 'not_exists':
        return fieldValue === undefined || fieldValue === null;
      default:
        this.logger.warn(`❓ Неизвестный оператор условия: ${condition.operator}`);
        return false;
    }
  }

  private async routeToTarget(data: any, target: RouteTarget, endpointId: string): Promise<void> {
    switch (target.type) {
      case 'webhook':
        await this.routeToWebhook(data, target, endpointId);
        break;
        
      case 'api':
        await this.routeToApi(data, target, endpointId);
        break;
        
      case 'kafka':
        await this.routeToKafka(data, target, endpointId);
        break;
        
      case 'database':
        await this.routeToDatabase(data, target, endpointId);
        break;
        
      case 'file':
        await this.routeToFile(data, target, endpointId);
        break;
        
      default:
        throw new Error(`Неподдерживаемый тип цели: ${target.type}`);
    }
  }

  private async routeToWebhook(data: any, target: RouteTarget, endpointId: string): Promise<void> {
    try {
      const response = await firstValueFrom(
        this.httpService.post(target.endpoint, data, {
          headers: {
            'Content-Type': 'application/json',
            'X-Integration-Source': endpointId,
          },
          timeout: 30000,
        })
      );

      this.logger.debug(`✅ Данные отправлены в webhook ${target.endpoint}: ${response.status}`);
    } catch (error) {
      this.logger.error(`❌ Ошибка отправки в webhook ${target.endpoint}:`, error.message);
      throw error;
    }
  }

  private async routeToApi(data: any, target: RouteTarget, endpointId: string): Promise<void> {
    try {
      // Определяем HTTP метод из endpoint URL или используем POST по умолчанию
      const method = target.endpoint.includes('|') 
        ? target.endpoint.split('|')[1].toUpperCase()
        : 'POST';
      const url = target.endpoint.includes('|') 
        ? target.endpoint.split('|')[0]
        : target.endpoint;

      let response;
      switch (method) {
        case 'GET':
          response = await firstValueFrom(this.httpService.get(url, { params: data }));
          break;
        case 'PUT':
          response = await firstValueFrom(this.httpService.put(url, data));
          break;
        case 'PATCH':
          response = await firstValueFrom(this.httpService.patch(url, data));
          break;
        case 'DELETE':
          response = await firstValueFrom(this.httpService.delete(url, { data }));
          break;
        default:
          response = await firstValueFrom(this.httpService.post(url, data));
      }

      this.logger.debug(`✅ Данные отправлены в API ${url} (${method}): ${response.status}`);
    } catch (error) {
      this.logger.error(`❌ Ошибка отправки в API ${target.endpoint}:`, error.message);
      throw error;
    }
  }

  private async routeToKafka(data: any, target: RouteTarget, endpointId: string): Promise<void> {
    try {
      // Интеграция с Kafka - здесь нужен KafkaJS или другой клиент
      // Пока что эмулируем отправку через Redis pub/sub
      const topic = target.endpoint.replace('kafka://', '');
      await this.redis.publish(`kafka:${topic}`, JSON.stringify({
        source: endpointId,
        timestamp: new Date().toISOString(),
        data,
      }));

      this.logger.debug(`✅ Данные отправлены в Kafka топик ${topic}`);
    } catch (error) {
      this.logger.error(`❌ Ошибка отправки в Kafka ${target.endpoint}:`, error.message);
      throw error;
    }
  }

  private async routeToDatabase(data: any, target: RouteTarget, endpointId: string): Promise<void> {
    try {
      // Сохраняем данные в Redis для дальнейшей обработки базой данных
      const key = `db_queue:${target.endpoint}:${Date.now()}`;
      await this.redis.setex(key, 3600, JSON.stringify({
        source: endpointId,
        timestamp: new Date().toISOString(),
        data,
      }));

      this.logger.debug(`✅ Данные добавлены в очередь для БД ${target.endpoint}`);
    } catch (error) {
      this.logger.error(`❌ Ошибка добавления в очередь БД ${target.endpoint}:`, error.message);
      throw error;
    }
  }

  private async routeToFile(data: any, target: RouteTarget, endpointId: string): Promise<void> {
    try {
      const filePath = target.endpoint.replace('file://', '');
      const fileContent = JSON.stringify({
        source: endpointId,
        timestamp: new Date().toISOString(),
        data,
      }, null, 2);

      // Создаем директорию если не существует
      const dir = path.dirname(filePath);
      await fs.mkdir(dir, { recursive: true });

      // Добавляем timestamp к имени файла для уникальности
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const uniqueFilePath = filePath.replace(/(\.[^.]+)$/, `_${timestamp}$1`);

      await fs.writeFile(uniqueFilePath, fileContent, 'utf-8');

      this.logger.debug(`✅ Данные сохранены в файл ${uniqueFilePath}`);
    } catch (error) {
      this.logger.error(`❌ Ошибка сохранения в файл ${target.endpoint}:`, error.message);
      throw error;
    }
  }

  private async addToRetryQueue(
    data: any,
    target: RouteTarget,
    endpointId: string,
    error: string,
  ): Promise<void> {
    const retryKey = `${endpointId}:${target.endpoint}`;
    const existingRetry = this.retryQueue.get(retryKey);
    
    const attempt = existingRetry ? existingRetry.attempt + 1 : 1;
    const maxAttempts = target.retryPolicy.maxAttempts || 3;
    
    if (attempt > maxAttempts) {
      this.logger.warn(`⚠️ Превышено максимальное количество попыток (${maxAttempts}) для ${target.endpoint}`);
      await this.sendToDeadLetterQueue(data, target, endpointId, error);
      this.retryQueue.delete(retryKey);
      return;
    }

    const initialDelay = target.retryPolicy.initialDelay || 1000;
    const backoffMultiplier = target.retryPolicy.backoffMultiplier || 2;
    const delay = initialDelay * Math.pow(backoffMultiplier, attempt - 1);
    
    const retryContext: RetryContext = {
      endpointId,
      targetId: target.endpoint,
      data,
      attempt,
      maxAttempts,
      nextRetryAt: new Date(Date.now() + delay),
      error,
    };

    this.retryQueue.set(retryKey, retryContext);
    
    this.logger.debug(
      `🔄 Добавлено в retry очередь: ${target.endpoint}, ` +
      `попытка ${attempt}/${maxAttempts}, ` +
      `следующая через ${delay}ms`
    );
  }

  private async sendToDeadLetterQueue(
    data: any,
    target: RouteTarget,
    endpointId: string,
    error: string,
  ): Promise<void> {
    try {
      const dlqMessage = {
        originalTarget: target.endpoint,
        endpointId,
        data,
        error,
        timestamp: new Date().toISOString(),
        attempts: target.retryPolicy?.maxAttempts || 0,
      };

      // Сохраняем в DLQ через Redis
      const dlqKey = `dlq:${endpointId}:${Date.now()}`;
      await this.redis.setex(dlqKey, 86400, JSON.stringify(dlqMessage)); // 24 часа

      this.logger.warn(`💀 Сообщение отправлено в Dead Letter Queue: ${dlqKey}`);

      // Отправляем событие для алертов
      this.eventEmitter.emit('routing.dead_letter', {
        endpointId,
        target: target.endpoint,
        error,
        data,
      });
    } catch (dlqError) {
      this.logger.error(`❌ Ошибка отправки в Dead Letter Queue:`, dlqError.message);
    }
  }

  private startRetryProcessor(): void {
    setInterval(async () => {
      try {
        const now = new Date();
        const retryPromises = [];

        for (const [key, context] of this.retryQueue) {
          if (context.nextRetryAt <= now) {
            retryPromises.push(this.processRetry(key, context));
          }
        }

        if (retryPromises.length > 0) {
          await Promise.allSettled(retryPromises);
        }
      } catch (error) {
        this.logger.error('❌ Ошибка обработки retry очереди:', error.message);
      }
    }, 5000); // Проверяем каждые 5 секунд
  }

  private async processRetry(key: string, context: RetryContext): Promise<void> {
    try {
      this.logger.debug(`🔄 Повторная попытка маршрутизации: ${context.targetId} (попытка ${context.attempt})`);

      // Находим оригинальную цель
      // В реальной реализации нужно сохранять полную конфигурацию цели
      const target: RouteTarget = {
        type: 'webhook', // Определяем тип по endpoint
        endpoint: context.targetId,
        retryPolicy: {
          maxAttempts: context.maxAttempts,
          backoffMultiplier: 2,
          initialDelay: 1000,
        },
      };

      await this.routeToTarget(context.data, target, context.endpointId);
      
      // Успешно - удаляем из очереди
      this.retryQueue.delete(key);
      
      this.logger.debug(`✅ Повторная попытка успешна: ${context.targetId}`);
    } catch (error) {
      // Неуспешно - увеличиваем счетчик попыток
      await this.addToRetryQueue(context.data, {
        type: 'webhook',
        endpoint: context.targetId,
        retryPolicy: {
          maxAttempts: context.maxAttempts,
          backoffMultiplier: 2,
          initialDelay: 1000,
        },
      }, context.endpointId, error.message);
    }
  }

  private async storeDataForLaterProcessing(data: any, parameters: any): Promise<void> {
    try {
      const storageKey = `stored_data:${parameters?.key || 'default'}:${Date.now()}`;
      await this.redis.setex(storageKey, parameters?.ttl || 3600, JSON.stringify({
        data,
        parameters,
        timestamp: new Date().toISOString(),
      }));

      this.logger.debug(`💾 Данные сохранены для дальнейшей обработки: ${storageKey}`);
    } catch (error) {
      this.logger.error('❌ Ошибка сохранения данных:', error.message);
    }
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  // Публичные методы для управления retry очередью
  async getRetryQueueStatus(): Promise<{ total: number; items: RetryContext[] }> {
    const items = Array.from(this.retryQueue.values());
    return {
      total: items.length,
      items,
    };
  }

  async clearRetryQueue(): Promise<void> {
    this.retryQueue.clear();
    this.logger.log('🧹 Retry очередь очищена');
  }

  async getDeadLetterQueue(): Promise<any[]> {
    try {
      const keys = await this.redis.keys('dlq:*');
      const dlqMessages = [];

      for (const key of keys) {
        const message = await this.redis.get(key);
        if (message) {
          dlqMessages.push(JSON.parse(message));
        }
      }

      return dlqMessages;
    } catch (error) {
      this.logger.error('❌ Ошибка получения DLQ:', error.message);
      return [];
    }
  }

  async clearDeadLetterQueue(): Promise<number> {
    try {
      const keys = await this.redis.keys('dlq:*');
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
      
      this.logger.log(`🧹 Dead Letter Queue очищена (удалено ${keys.length} сообщений)`);
      return keys.length;
    } catch (error) {
      this.logger.error('❌ Ошибка очистки DLQ:', error.message);
      return 0;
    }
  }
}