export interface AggregationJob {
  id: string;
  name: string;
  type: AggregationType;
  status: AggregationStatus;
  schedule: AggregationSchedule;
  source: AggregationSource;
  target: AggregationTarget;
  transformation: AggregationTransformation;
  progress: number;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  nextRun?: Date;
  lastRun?: Date;
  result?: AggregationResult;
  error?: string;
  createdBy: string;
  isActive: boolean;
}

export enum AggregationType {
  SCHEDULED = 'scheduled',
  REALTIME = 'realtime',
  ON_DEMAND = 'on_demand',
  EVENT_DRIVEN = 'event_driven',
}

export enum AggregationStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  DISABLED = 'disabled',
}

export interface AggregationSchedule {
  type: 'cron' | 'interval' | 'once' | 'event';
  expression?: string; // cron expression
  interval?: number; // milliseconds for interval
  timezone?: string;
  enabled: boolean;
  priority?: number; // 1-10 (10 = highest)
}

export interface AggregationSource {
  type: 'clickhouse' | 'postgresql' | 'kafka' | 'api' | 'file';
  connection: AggregationConnection;
  query?: string;
  table?: string;
  topic?: string;
  endpoint?: string;
  filePath?: string;
  filters?: AggregationFilter[];
  incremental?: boolean;
  incrementalField?: string;
  batchSize?: number;
}

export interface AggregationConnection {
  host?: string;
  port?: number;
  database?: string;
  username?: string;
  password?: string;
  connectionString?: string;
  options?: Record<string, any>;
}

export interface AggregationFilter {
  field: string;
  operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'not_in' | 'like' | 'between';
  value: any;
  condition?: 'AND' | 'OR';
}

export interface AggregationTarget {
  type: 'clickhouse' | 'postgresql' | 'redis' | 'file';
  connection: AggregationConnection;
  table?: string;
  collection?: string;
  filePath?: string;
  format?: 'json' | 'csv' | 'parquet' | 'avro';
  partitioning?: AggregationPartitioning;
  retention?: AggregationRetention;
  compression?: boolean;
}

export interface AggregationPartitioning {
  enabled: boolean;
  field: string;
  type: 'time' | 'hash' | 'range';
  interval?: 'hour' | 'day' | 'week' | 'month' | 'year';
  partitions?: number;
}

export interface AggregationRetention {
  enabled: boolean;
  period: number; // days
  archiveAfter?: number; // days
  deleteAfter?: number; // days
}

export interface AggregationTransformation {
  operations: AggregationOperation[];
  groupBy?: string[];
  orderBy?: Array<{
    field: string;
    direction: 'ASC' | 'DESC';
  }>;
  having?: AggregationFilter[];
  limit?: number;
  offset?: number;
}

export interface AggregationOperation {
  type: AggregationOperationType;
  field: string;
  alias?: string;
  params?: Record<string, any>;
  condition?: string;
}

export enum AggregationOperationType {
  // Базовые агрегации
  COUNT = 'count',
  SUM = 'sum',
  AVG = 'avg',
  MIN = 'min',
  MAX = 'max',
  MEDIAN = 'median',
  
  // Статистические функции
  STDDEV = 'stddev',
  VARIANCE = 'variance',
  PERCENTILE = 'percentile',
  
  // Временные функции
  DATE_TRUNC = 'date_trunc',
  TIME_BUCKET = 'time_bucket',
  LAG = 'lag',
  LEAD = 'lead',
  
  // Строковые функции
  CONCAT = 'concat',
  UPPER = 'upper',
  LOWER = 'lower',
  TRIM = 'trim',
  
  // Пользовательские функции
  CUSTOM = 'custom',
  
  // Аналитические функции
  ROW_NUMBER = 'row_number',
  RANK = 'rank',
  DENSE_RANK = 'dense_rank',
  FIRST_VALUE = 'first_value',
  LAST_VALUE = 'last_value',
}

export interface AggregationResult {
  recordsProcessed: number;
  recordsInserted: number;
  recordsUpdated: number;
  recordsDeleted: number;
  bytesProcessed: number;
  executionTime: number;
  startTime: Date;
  endTime: Date;
  errors?: string[];
  warnings?: string[];
  metadata?: Record<string, any>;
}

// Специализированные интерфейсы для разных типов агрегации

export interface TerminalOperationAggregation {
  period: 'hour' | 'day' | 'week' | 'month';
  metrics: {
    containerMovements: number;
    vesselOperations: number;
    truckOperations: number;
    totalTEU: number;
    averageProcessingTime: number;
    peakHourThroughput: number;
  };
  breakdown: {
    byOperation: Record<string, number>;
    byEquipment: Record<string, number>;
    byLocation: Record<string, number>;
    byClient: Record<string, number>;
  };
}

export interface EquipmentPerformanceAggregation {
  period: 'hour' | 'day' | 'week' | 'month';
  equipmentId: string;
  metrics: {
    totalOperations: number;
    successfulOperations: number;
    failedOperations: number;
    averageOperationTime: number;
    utilizationRate: number;
    downtimeMinutes: number;
    maintenanceEvents: number;
  };
  kpis: {
    efficiency: number;
    reliability: number;
    availability: number;
    performance: number;
  };
}

export interface FinancialAggregation {
  period: 'day' | 'week' | 'month' | 'quarter' | 'year';
  metrics: {
    totalRevenue: number;
    operatingCosts: number;
    grossProfit: number;
    revenuePerTEU: number;
    costPerMove: number;
    profitMargin: number;
  };
  breakdown: {
    byService: Record<string, number>;
    byClient: Record<string, number>;
    byEquipment: Record<string, number>;
    byCostCenter: Record<string, number>;
  };
}

export interface SafetyAggregation {
  period: 'day' | 'week' | 'month' | 'quarter' | 'year';
  metrics: {
    totalIncidents: number;
    nearMisses: number;
    injuries: number;
    propertyDamage: number;
    environmentalEvents: number;
    trainingHours: number;
    complianceScore: number;
  };
  breakdown: {
    byType: Record<string, number>;
    byLocation: Record<string, number>;
    byEquipment: Record<string, number>;
    bySeverity: Record<string, number>;
  };
}

// Конфигурация агрегации

export interface AggregationTemplate {
  id: string;
  name: string;
  description: string;
  category: AggregationCategory;
  type: AggregationType;
  template: {
    source: Partial<AggregationSource>;
    target: Partial<AggregationTarget>;
    transformation: Partial<AggregationTransformation>;
    schedule: Partial<AggregationSchedule>;
  };
  variables: AggregationVariable[];
  isDefault: boolean;
  tags: string[];
}

export enum AggregationCategory {
  OPERATIONAL = 'operational',
  FINANCIAL = 'financial',
  EQUIPMENT = 'equipment',
  SAFETY = 'safety',
  ENVIRONMENTAL = 'environmental',
  CUSTOMER = 'customer',
  CUSTOM = 'custom',
}

export interface AggregationVariable {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'date' | 'array';
  description: string;
  required: boolean;
  defaultValue?: any;
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
    enum?: any[];
  };
}

// Мониторинг и алерты

export interface AggregationMonitoring {
  jobId: string;
  metrics: {
    executionTime: number;
    recordsProcessed: number;
    memoryUsage: number;
    cpuUsage: number;
    errorRate: number;
    successRate: number;
  };
  thresholds: {
    maxExecutionTime: number;
    maxMemoryUsage: number;
    maxErrorRate: number;
    minSuccessRate: number;
  };
  alerts: AggregationAlert[];
  lastChecked: Date;
  status: 'healthy' | 'warning' | 'critical';
}

export interface AggregationAlert {
  id: string;
  jobId: string;
  type: AggregationAlertType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  threshold: any;
  actualValue: any;
  triggeredAt: Date;
  acknowledgedAt?: Date;
  acknowledgedBy?: string;
  resolved: boolean;
  resolvedAt?: Date;
  actions: AggregationAlertAction[];
}

export enum AggregationAlertType {
  EXECUTION_TIME_EXCEEDED = 'execution_time_exceeded',
  MEMORY_USAGE_HIGH = 'memory_usage_high',
  ERROR_RATE_HIGH = 'error_rate_high',
  SUCCESS_RATE_LOW = 'success_rate_low',
  DATA_QUALITY_ISSUE = 'data_quality_issue',
  CONNECTION_FAILED = 'connection_failed',
  DISK_SPACE_LOW = 'disk_space_low',
  QUEUE_BACKLOG = 'queue_backlog',
}

export interface AggregationAlertAction {
  type: 'email' | 'webhook' | 'sms' | 'retry' | 'disable_job';
  target: string;
  params?: Record<string, any>;
  executed: boolean;
  executedAt?: Date;
  result?: string;
}

// Статистика и метрики

export interface AggregationStatistics {
  totalJobs: number;
  activeJobs: number;
  completedJobs: number;
  failedJobs: number;
  totalRecordsProcessed: number;
  totalBytesProcessed: number;
  averageExecutionTime: number;
  successRate: number;
  jobsByCategory: Array<{
    category: AggregationCategory;
    count: number;
    percentage: number;
  }>;
  jobsByType: Array<{
    type: AggregationType;
    count: number;
    percentage: number;
  }>;
  performanceMetrics: {
    fastestJob: { id: string; name: string; executionTime: number };
    slowestJob: { id: string; name: string; executionTime: number };
    mostActiveJob: { id: string; name: string; runsCount: number };
    biggestJob: { id: string; name: string; recordsProcessed: number };
  };
  recentActivity: Array<{
    jobId: string;
    jobName: string;
    status: AggregationStatus;
    executionTime: number;
    recordsProcessed: number;
    completedAt: Date;
  }>;
}

// Очередь заданий

export interface AggregationQueue {
  id: string;
  name: string;
  priority: number;
  maxConcurrency: number;
  currentJobs: number;
  queuedJobs: number;
  totalProcessed: number;
  averageWaitTime: number;
  status: 'active' | 'paused' | 'disabled';
  createdAt: Date;
  updatedAt: Date;
}

export interface AggregationQueueItem {
  id: string;
  jobId: string;
  queueId: string;
  priority: number;
  enqueuedAt: Date;
  startedAt?: Date;
  estimatedDuration?: number;
  dependencies?: string[];
  retryCount: number;
  maxRetries: number;
  status: 'waiting' | 'running' | 'completed' | 'failed' | 'cancelled';
}

// Data Quality контроль

export interface AggregationDataQuality {
  jobId: string;
  rules: DataQualityRule[];
  results: DataQualityResult[];
  overallScore: number;
  lastChecked: Date;
  autoCorrection: boolean;
  notificationThreshold: number;
}

export interface DataQualityRule {
  id: string;
  name: string;
  type: DataQualityRuleType;
  field?: string;
  condition: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  autoCorrect?: boolean;
  enabled: boolean;
}

export enum DataQualityRuleType {
  NULL_CHECK = 'null_check',
  RANGE_CHECK = 'range_check',
  FORMAT_CHECK = 'format_check',
  UNIQUENESS_CHECK = 'uniqueness_check',
  COMPLETENESS_CHECK = 'completeness_check',
  CONSISTENCY_CHECK = 'consistency_check',
  FRESHNESS_CHECK = 'freshness_check',
  CUSTOM_RULE = 'custom_rule',
}

export interface DataQualityResult {
  ruleId: string;
  passed: boolean;
  score: number;
  affectedRecords: number;
  totalRecords: number;
  details: string;
  suggestions?: string[];
  executedAt: Date;
}

// Инкрементальная обработка

export interface IncrementalState {
  jobId: string;
  lastProcessedValue: any;
  lastProcessedTime: Date;
  watermark: any;
  checkpointData: Record<string, any>;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

// Линеаж данных (Data Lineage)

export interface DataLineage {
  jobId: string;
  sources: Array<{
    type: string;
    identifier: string;
    schema?: string;
    fields: string[];
  }>;
  targets: Array<{
    type: string;
    identifier: string;
    schema?: string;
    fields: string[];
  }>;
  transformations: Array<{
    operation: string;
    inputFields: string[];
    outputFields: string[];
    logic: string;
  }>;
  dependencies: string[];
  impact: string[];
  createdAt: Date;
  updatedAt: Date;
}