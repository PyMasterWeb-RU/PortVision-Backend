import {
  Injectable,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import * as moment from 'moment';
import { validate } from 'class-validator';
import * as xml2js from 'xml2js';
import { DataFormat } from '../entities/integration-endpoint.entity';

export interface TransformationRule {
  sourceField: string;
  targetField: string;
  transformation?: 'uppercase' | 'lowercase' | 'trim' | 'date_format' | 'number_format' | 'custom';
  transformationParams?: any;
  required: boolean;
  defaultValue?: any;
}

export interface ValidationRule {
  field: string;
  type: 'string' | 'number' | 'date' | 'email' | 'regex' | 'custom';
  rules: any;
  errorMessage: string;
}

export interface FilterRule {
  field: string;
  operator: 'equals' | 'contains' | 'starts_with' | 'ends_with' | 'greater_than' | 'less_than' | 'in_array';
  value: any;
  condition: 'include' | 'exclude';
}

export interface AggregationConfig {
  enabled: boolean;
  groupBy: string[];
  timeWindow: number;
  functions: Array<{
    field: string;
    function: 'count' | 'sum' | 'avg' | 'min' | 'max' | 'first' | 'last';
  }>;
}

export interface DataProcessingConfig {
  inputFormat: DataFormat;
  outputFormat: DataFormat;
  transformationRules: TransformationRule[];
  validationRules: ValidationRule[];
  filters: FilterRule[];
  aggregation?: AggregationConfig;
}

export interface ProcessingResult {
  success: boolean;
  data?: any;
  errors?: string[];
  warnings?: string[];
  metrics: {
    recordsProcessed: number;
    recordsFiltered: number;
    recordsTransformed: number;
    recordsFailed: number;
    processingTime: number;
  };
}

@Injectable()
export class DataTransformationService {
  private readonly logger = new Logger(DataTransformationService.name);

  constructor(private readonly eventEmitter: EventEmitter2) {}

  async processData(
    rawData: any,
    config: DataProcessingConfig,
    endpointId: string,
  ): Promise<ProcessingResult> {
    const startTime = Date.now();
    const result: ProcessingResult = {
      success: false,
      errors: [],
      warnings: [],
      metrics: {
        recordsProcessed: 0,
        recordsFiltered: 0,
        recordsTransformed: 0,
        recordsFailed: 0,
        processingTime: 0,
      },
    };

    try {
      this.logger.debug(`🔄 Начинаем обработку данных для интеграции ${endpointId}`);

      // 1. Парсинг входных данных
      let parsedData = await this.parseInputData(rawData, config.inputFormat);
      if (!parsedData) {
        result.errors.push('Не удалось распарсить входные данные');
        return result;
      }

      // Нормализуем данные в массив для обработки
      const dataArray = Array.isArray(parsedData) ? parsedData : [parsedData];
      result.metrics.recordsProcessed = dataArray.length;

      // 2. Фильтрация данных
      let filteredData = dataArray;
      if (config.filters && config.filters.length > 0) {
        filteredData = this.applyFilters(dataArray, config.filters);
        result.metrics.recordsFiltered = dataArray.length - filteredData.length;
      }

      if (filteredData.length === 0) {
        result.warnings.push('Все записи были отфильтрованы');
        result.success = true;
        result.data = [];
        return result;
      }

      // 3. Трансформация данных
      const transformedData = [];
      for (const item of filteredData) {
        try {
          const transformed = await this.transformRecord(item, config.transformationRules);
          transformedData.push(transformed);
          result.metrics.recordsTransformed++;
        } catch (error) {
          result.errors.push(`Ошибка трансформации записи: ${error.message}`);
          result.metrics.recordsFailed++;
        }
      }

      // 4. Валидация данных
      const validatedData = [];
      for (const item of transformedData) {
        const validationResult = await this.validateRecord(item, config.validationRules);
        if (validationResult.isValid) {
          validatedData.push(item);
        } else {
          result.errors.push(...validationResult.errors);
          result.metrics.recordsFailed++;
        }
      }

      // 5. Агрегация данных (если включена)
      let finalData = validatedData;
      if (config.aggregation?.enabled && validatedData.length > 0) {
        finalData = await this.aggregateData(validatedData, config.aggregation);
      }

      // 6. Форматирование выходных данных
      result.data = await this.formatOutputData(finalData, config.outputFormat);
      result.success = true;

      // Вычисляем время обработки
      result.metrics.processingTime = Date.now() - startTime;

      this.logger.debug(
        `✅ Обработка завершена для интеграции ${endpointId}: ` +
        `${result.metrics.recordsProcessed} входных, ` +
        `${result.metrics.recordsTransformed} трансформировано, ` +
        `${result.metrics.recordsFailed} ошибок, ` +
        `время: ${result.metrics.processingTime}ms`
      );

      // Отправляем событие о завершении обработки
      this.eventEmitter.emit('data.processing.completed', {
        endpointId,
        success: result.success,
        recordsProcessed: result.metrics.recordsProcessed,
        recordsTransformed: result.metrics.recordsTransformed,
        recordsFailed: result.metrics.recordsFailed,
        processingTime: result.metrics.processingTime,
      });

      return result;

    } catch (error) {
      result.success = false;
      result.errors.push(`Критическая ошибка обработки: ${error.message}`);
      result.metrics.processingTime = Date.now() - startTime;

      this.logger.error(`❌ Ошибка обработки данных для интеграции ${endpointId}:`, error.stack);
      
      this.eventEmitter.emit('data.processing.failed', {
        endpointId,
        error: error.message,
        processingTime: result.metrics.processingTime,
      });

      return result;
    }
  }

  private async parseInputData(rawData: any, format: DataFormat): Promise<any> {
    try {
      switch (format) {
        case DataFormat.JSON:
          return typeof rawData === 'string' ? JSON.parse(rawData) : rawData;

        case DataFormat.XML:
          if (typeof rawData !== 'string') {
            throw new Error('XML data must be a string');
          }
          const parser = new xml2js.Parser({ explicitArray: false, mergeAttrs: true });
          return parser.parseStringPromise(rawData);

        case DataFormat.CSV:
          return this.parseCsv(rawData);

        case DataFormat.FIXED_WIDTH:
          return this.parseFixedWidth(rawData);

        case DataFormat.EDI:
          return this.parseEdi(rawData);

        case DataFormat.BINARY:
          return rawData; // Бинарные данные возвращаем как есть

        case DataFormat.CUSTOM:
          return rawData; // Пользовательский формат - без обработки

        default:
          return rawData;
      }
    } catch (error) {
      this.logger.error(`❌ Ошибка парсинга ${format} данных:`, error.message);
      throw new BadRequestException(`Не удалось распарсить данные формата ${format}: ${error.message}`);
    }
  }

  private async formatOutputData(data: any[], format: DataFormat): Promise<any> {
    try {
      switch (format) {
        case DataFormat.JSON:
          return data;

        case DataFormat.XML:
          const builder = new xml2js.Builder({ rootName: 'root', renderOpts: { pretty: true } });
          return builder.buildObject({ items: data });

        case DataFormat.CSV:
          return this.formatCsv(data);

        case DataFormat.FIXED_WIDTH:
          return this.formatFixedWidth(data);

        case DataFormat.EDI:
          return this.formatEdi(data);

        default:
          return data;
      }
    } catch (error) {
      this.logger.error(`❌ Ошибка форматирования в ${format}:`, error.message);
      throw new BadRequestException(`Не удалось отформатировать данные в ${format}: ${error.message}`);
    }
  }

  private applyFilters(data: any[], filters: FilterRule[]): any[] {
    return data.filter(item => {
      for (const filter of filters) {
        const fieldValue = this.getNestedValue(item, filter.field);
        const matches = this.checkFilterCondition(fieldValue, filter.operator, filter.value);

        if (filter.condition === 'include' && !matches) {
          return false;
        }
        if (filter.condition === 'exclude' && matches) {
          return false;
        }
      }
      return true;
    });
  }

  private checkFilterCondition(value: any, operator: FilterRule['operator'], filterValue: any): boolean {
    if (value == null) return false;

    switch (operator) {
      case 'equals':
        return value === filterValue;
      case 'contains':
        return String(value).toLowerCase().includes(String(filterValue).toLowerCase());
      case 'starts_with':
        return String(value).toLowerCase().startsWith(String(filterValue).toLowerCase());
      case 'ends_with':
        return String(value).toLowerCase().endsWith(String(filterValue).toLowerCase());
      case 'greater_than':
        return Number(value) > Number(filterValue);
      case 'less_than':
        return Number(value) < Number(filterValue);
      case 'in_array':
        return Array.isArray(filterValue) && filterValue.includes(value);
      default:
        return false;
    }
  }

  private async transformRecord(record: any, rules: TransformationRule[]): Promise<any> {
    const result = {};

    for (const rule of rules) {
      try {
        let value = this.getNestedValue(record, rule.sourceField);

        // Применяем значение по умолчанию если поле пустое
        if (value == null && rule.defaultValue !== undefined) {
          value = rule.defaultValue;
        }

        // Проверяем обязательность поля
        if (rule.required && value == null) {
          throw new Error(`Обязательное поле "${rule.sourceField}" отсутствует`);
        }

        // Применяем трансформацию
        if (value != null && rule.transformation) {
          value = await this.applyTransformation(value, rule.transformation, rule.transformationParams);
        }

        // Устанавливаем значение в результат
        this.setNestedValue(result, rule.targetField, value);
      } catch (error) {
        throw new Error(`Ошибка трансформации поля "${rule.sourceField}": ${error.message}`);
      }
    }

    return result;
  }

  private async applyTransformation(
    value: any,
    transformation: TransformationRule['transformation'],
    params?: any
  ): Promise<any> {
    switch (transformation) {
      case 'uppercase':
        return String(value).toUpperCase();
      case 'lowercase':
        return String(value).toLowerCase();
      case 'trim':
        return String(value).trim();
      case 'date_format':
        const format = params?.format || 'YYYY-MM-DD';
        return moment(value).format(format);
      case 'number_format':
        const num = Number(value);
        if (isNaN(num)) throw new Error('Value is not a number');
        return params?.decimals ? num.toFixed(params.decimals) : num;
      case 'custom':
        // Здесь можно добавить вызов пользовательской функции трансформации
        return params?.customFunction ? params.customFunction(value) : value;
      default:
        return value;
    }
  }

  private async validateRecord(record: any, rules: ValidationRule[]): Promise<{
    isValid: boolean;
    errors: string[];
  }> {
    const errors = [];

    for (const rule of rules) {
      const value = this.getNestedValue(record, rule.field);

      try {
        const isValid = await this.validateValue(value, rule);
        if (!isValid) {
          errors.push(rule.errorMessage || `Поле "${rule.field}" не прошло валидацию`);
        }
      } catch (error) {
        errors.push(`Ошибка валидации поля "${rule.field}": ${error.message}`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  private async validateValue(value: any, rule: ValidationRule): Promise<boolean> {
    if (value == null) return !rule.rules?.required;

    switch (rule.type) {
      case 'string':
        if (typeof value !== 'string') return false;
        if (rule.rules?.minLength && value.length < rule.rules.minLength) return false;
        if (rule.rules?.maxLength && value.length > rule.rules.maxLength) return false;
        return true;

      case 'number':
        const num = Number(value);
        if (isNaN(num)) return false;
        if (rule.rules?.min !== undefined && num < rule.rules.min) return false;
        if (rule.rules?.max !== undefined && num > rule.rules.max) return false;
        return true;

      case 'date':
        const date = moment(value);
        return date.isValid();

      case 'email':
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(String(value));

      case 'regex':
        const regex = new RegExp(rule.rules?.pattern);
        return regex.test(String(value));

      case 'custom':
        // Здесь можно добавить вызов пользовательской функции валидации
        return rule.rules?.customValidator ? rule.rules.customValidator(value) : true;

      default:
        return true;
    }
  }

  private async aggregateData(data: any[], config: AggregationConfig): Promise<any[]> {
    // Группируем данные по указанным полям
    const groups = new Map();

    for (const item of data) {
      const groupKey = config.groupBy.map(field => this.getNestedValue(item, field)).join('|');
      
      if (!groups.has(groupKey)) {
        groups.set(groupKey, []);
      }
      
      groups.get(groupKey).push(item);
    }

    // Применяем функции агрегации
    const aggregatedData = [];
    
    for (const [groupKey, groupItems] of groups) {
      const aggregatedItem = {};
      
      // Копируем поля группировки
      config.groupBy.forEach((field, index) => {
        const value = groupKey.split('|')[index];
        this.setNestedValue(aggregatedItem, field, value);
      });

      // Применяем функции агрегации
      for (const func of config.functions) {
        const values = groupItems.map(item => this.getNestedValue(item, func.field)).filter(v => v != null);
        
        let result;
        switch (func.function) {
          case 'count':
            result = values.length;
            break;
          case 'sum':
            result = values.reduce((sum, val) => sum + Number(val), 0);
            break;
          case 'avg':
            result = values.length > 0 ? values.reduce((sum, val) => sum + Number(val), 0) / values.length : 0;
            break;
          case 'min':
            result = values.length > 0 ? Math.min(...values.map(Number)) : null;
            break;
          case 'max':
            result = values.length > 0 ? Math.max(...values.map(Number)) : null;
            break;
          case 'first':
            result = values[0];
            break;
          case 'last':
            result = values[values.length - 1];
            break;
          default:
            result = null;
        }
        
        this.setNestedValue(aggregatedItem, `${func.field}_${func.function}`, result);
      }

      aggregatedData.push(aggregatedItem);
    }

    return aggregatedData;
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  private setNestedValue(obj: any, path: string, value: any): void {
    const keys = path.split('.');
    const lastKey = keys.pop();
    
    let current = obj;
    for (const key of keys) {
      if (current[key] == null) {
        current[key] = {};
      }
      current = current[key];
    }
    
    current[lastKey] = value;
  }

  // Вспомогательные методы для специфических форматов
  private parseCsv(csvData: string): any[] {
    const lines = csvData.split('\n').filter(line => line.trim());
    if (lines.length === 0) return [];

    const headers = lines[0].split(',').map(h => h.trim());
    const data = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim());
      const record = {};
      
      headers.forEach((header, index) => {
        record[header] = values[index] || null;
      });
      
      data.push(record);
    }

    return data;
  }

  private parseFixedWidth(data: string): any[] {
    // Пример парсинга fixed-width формата
    // В реальной реализации нужны настройки позиций полей
    return [{ rawData: data }];
  }

  private parseEdi(ediData: string): any[] {
    // Простой парсер EDI - в реальности нужен более сложный
    const segments = ediData.split('~').filter(s => s.trim());
    return segments.map(segment => ({
      segment,
      elements: segment.split('+'),
    }));
  }

  private formatCsv(data: any[]): string {
    if (data.length === 0) return '';

    const headers = Object.keys(data[0]);
    const csvLines = [headers.join(',')];

    for (const item of data) {
      const values = headers.map(header => item[header] || '');
      csvLines.push(values.join(','));
    }

    return csvLines.join('\n');
  }

  private formatFixedWidth(data: any[]): string {
    // Простое форматирование в fixed-width
    return data.map(item => JSON.stringify(item)).join('\n');
  }

  private formatEdi(data: any[]): string {
    // Простое форматирование в EDI
    return data.map(item => item.segment || JSON.stringify(item)).join('~');
  }
}