export interface RealtimeSubscription {
  id: string;
  userId: string;
  sessionId: string;
  type: SubscriptionType;
  topic: string;
  filters: RealtimeFilter[];
  config: SubscriptionConfig;
  status: SubscriptionStatus;
  createdAt: Date;
  lastActivity: Date;
  metrics: SubscriptionMetrics;
}

export enum SubscriptionType {
  TERMINAL_OPERATIONS = 'terminal_operations',
  EQUIPMENT_STATUS = 'equipment_status',
  CONTAINER_MOVEMENTS = 'container_movements',
  VESSEL_OPERATIONS = 'vessel_operations',
  GATE_OPERATIONS = 'gate_operations',
  YARD_STATUS = 'yard_status',
  KPI_METRICS = 'kpi_metrics',
  ALERTS = 'alerts',
  NOTIFICATIONS = 'notifications',
  CUSTOM = 'custom',
}

export enum SubscriptionStatus {
  ACTIVE = 'active',
  PAUSED = 'paused',
  DISCONNECTED = 'disconnected',
  ERROR = 'error',
  TERMINATED = 'terminated',
}

export interface RealtimeFilter {
  field: string;
  operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'not_in' | 'contains' | 'regex';
  value: any;
  condition?: 'AND' | 'OR';
}

export interface SubscriptionConfig {
  refreshInterval?: number; // ms
  bufferSize?: number;
  compression?: boolean;
  throttle?: ThrottleConfig;
  aggregation?: AggregationConfig;
  transforms?: TransformConfig[];
  persistence?: PersistenceConfig;
}

export interface ThrottleConfig {
  enabled: boolean;
  maxUpdatesPerSecond: number;
  strategy: 'drop' | 'buffer' | 'debounce';
}

export interface AggregationConfig {
  enabled: boolean;
  window: number; // ms
  functions: AggregationFunction[];
  groupBy?: string[];
}

export interface AggregationFunction {
  field: string;
  operation: 'sum' | 'avg' | 'min' | 'max' | 'count' | 'last' | 'first';
  alias?: string;
}

export interface TransformConfig {
  type: 'map' | 'filter' | 'reduce' | 'sort' | 'group' | 'custom';
  expression: string;
  params?: Record<string, any>;
}

export interface PersistenceConfig {
  enabled: boolean;
  storage: 'memory' | 'redis' | 'clickhouse';
  retention: number; // seconds
  batchSize?: number;
}

export interface SubscriptionMetrics {
  totalMessages: number;
  messagesPerSecond: number;
  lastMessageAt?: Date;
  errors: number;
  bytesTransferred: number;
  latency: LatencyMetrics;
}

export interface LatencyMetrics {
  min: number;
  max: number;
  avg: number;
  p95: number;
  p99: number;
}

// Типы данных реального времени

export interface RealtimeEvent {
  id: string;
  type: string;
  topic: string;
  timestamp: Date;
  source: EventSource;
  data: any;
  metadata?: EventMetadata;
}

export interface EventSource {
  type: 'terminal' | 'equipment' | 'integration' | 'system' | 'user';
  id: string;
  name?: string;
  location?: GeoLocation;
}

export interface EventMetadata {
  priority: 'low' | 'normal' | 'high' | 'critical';
  category: string;
  tags?: string[];
  correlationId?: string;
  causationId?: string;
  version?: string;
}

export interface GeoLocation {
  latitude: number;
  longitude: number;
  altitude?: number;
  accuracy?: number;
}

// Специализированные события

export interface TerminalOperationEvent extends RealtimeEvent {
  data: {
    operationType: 'gate_in' | 'gate_out' | 'yard_move' | 'vessel_load' | 'vessel_discharge';
    containerId: string;
    containerNumber: string;
    vesselId?: string;
    truckId?: string;
    equipmentId?: string;
    location: {
      from?: string;
      to?: string;
      coordinates?: GeoLocation;
    };
    status: 'started' | 'completed' | 'failed' | 'cancelled';
    duration?: number;
    details?: Record<string, any>;
  };
}

export interface EquipmentStatusEvent extends RealtimeEvent {
  data: {
    equipmentId: string;
    equipmentType: 'crane' | 'reach_stacker' | 'forklift' | 'truck' | 'scanner';
    status: 'active' | 'idle' | 'maintenance' | 'error' | 'offline';
    position?: GeoLocation;
    telemetry: {
      cpu?: number;
      memory?: number;
      fuel?: number;
      temperature?: number;
      load?: number;
      speed?: number;
      heading?: number;
    };
    operator?: {
      id: string;
      name: string;
    };
    task?: {
      id: string;
      type: string;
      progress: number;
    };
  };
}

export interface ContainerMovementEvent extends RealtimeEvent {
  data: {
    containerId: string;
    containerNumber: string;
    movementType: 'arrival' | 'departure' | 'repositioning' | 'inspection';
    fromLocation?: string;
    toLocation?: string;
    equipmentId?: string;
    operatorId?: string;
    coordinates?: GeoLocation;
    timestamp: Date;
    status: 'planned' | 'in_progress' | 'completed' | 'delayed' | 'cancelled';
    metadata?: {
      weight?: number;
      size?: string;
      hazardous?: boolean;
      temperature?: number;
      customsStatus?: string;
    };
  };
}

export interface KPIMetricEvent extends RealtimeEvent {
  data: {
    metricId: string;
    metricName: string;
    category: 'operational' | 'financial' | 'equipment' | 'safety' | 'environmental' | 'customer';
    value: number;
    unit: string;
    target?: number;
    threshold?: {
      warning: number;
      critical: number;
    };
    trend: {
      direction: 'up' | 'down' | 'stable';
      percentage: number;
      period: string;
    };
    calculatedAt: Date;
    period: 'realtime' | 'hourly' | 'daily' | 'weekly' | 'monthly';
  };
}

export interface AlertEvent extends RealtimeEvent {
  data: {
    alertId: string;
    severity: 'info' | 'warning' | 'error' | 'critical';
    title: string;
    message: string;
    source: {
      type: string;
      id: string;
      name?: string;
    };
    category: string;
    triggeredAt: Date;
    acknowledgedAt?: Date;
    acknowledgedBy?: string;
    resolvedAt?: Date;
    actions?: AlertAction[];
    metadata?: Record<string, any>;
  };
}

export interface AlertAction {
  type: 'email' | 'sms' | 'webhook' | 'escalation' | 'auto_resolve';
  target: string;
  executed: boolean;
  executedAt?: Date;
  result?: string;
}

// Конфигурация WebSocket соединений

export interface WebSocketConnection {
  id: string;
  userId: string;
  sessionId: string;
  socket: any; // WebSocket instance
  subscriptions: Set<string>;
  status: ConnectionStatus;
  connectedAt: Date;
  lastPingAt: Date;
  metadata: ConnectionMetadata;
  metrics: ConnectionMetrics;
}

export enum ConnectionStatus {
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  RECONNECTING = 'reconnecting',
  DISCONNECTED = 'disconnected',
  ERROR = 'error',
  TERMINATED = 'terminated',
}

export interface ConnectionMetadata {
  userAgent?: string;
  ipAddress?: string;
  location?: string;
  device?: {
    type: 'desktop' | 'mobile' | 'tablet';
    os?: string;
    browser?: string;
  };
  roles?: string[];
  permissions?: string[];
}

export interface ConnectionMetrics {
  messagesReceived: number;
  messagesSent: number;
  bytesReceived: number;
  bytesSent: number;
  reconnections: number;
  avgLatency: number;
  lastActivity: Date;
}

// Очереди сообщений

export interface MessageQueue {
  id: string;
  topic: string;
  type: QueueType;
  config: QueueConfig;
  metrics: QueueMetrics;
  status: QueueStatus;
  createdAt: Date;
}

export enum QueueType {
  FIFO = 'fifo',
  PRIORITY = 'priority',
  BROADCAST = 'broadcast',
  TOPIC = 'topic',
  FANOUT = 'fanout',
}

export enum QueueStatus {
  ACTIVE = 'active',
  PAUSED = 'paused',
  DRAINING = 'draining',
  ERROR = 'error',
  DISABLED = 'disabled',
}

export interface QueueConfig {
  maxSize: number;
  ttl: number; // seconds
  persistent: boolean;
  compression: boolean;
  priority?: {
    enabled: boolean;
    levels: number;
  };
  deduplication?: {
    enabled: boolean;
    window: number; // seconds
    keyFields: string[];
  };
}

export interface QueueMetrics {
  size: number;
  throughputPerSecond: number;
  avgProcessingTime: number;
  totalProcessed: number;
  errors: number;
  lastProcessedAt?: Date;
}

export interface QueuedMessage {
  id: string;
  queueId: string;
  event: RealtimeEvent;
  priority: number;
  enqueuedAt: Date;
  processedAt?: Date;
  attempts: number;
  maxAttempts: number;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'expired';
  error?: string;
}

// Аналитика в реальном времени

export interface RealtimeAnalytics {
  sessionId: string;
  timeframe: AnalyticsTimeframe;
  metrics: AnalyticsMetrics;
  dimensions: AnalyticsDimension[];
  filters?: RealtimeFilter[];
  generatedAt: Date;
}

export interface AnalyticsTimeframe {
  start: Date;
  end: Date;
  granularity: 'second' | 'minute' | 'hour';
  timezone?: string;
}

export interface AnalyticsMetrics {
  events: EventMetrics;
  connections: ConnectionAnalytics;
  performance: PerformanceMetrics;
  errors: ErrorMetrics;
}

export interface EventMetrics {
  total: number;
  byType: Record<string, number>;
  byTopic: Record<string, number>;
  rate: number; // events per second
  peakRate: number;
  trend: TrendData[];
}

export interface ConnectionAnalytics {
  active: number;
  total: number;
  byRole: Record<string, number>;
  avgSessionDuration: number;
  reconnectionRate: number;
}

export interface PerformanceMetrics {
  latency: LatencyMetrics;
  throughput: number; // messages per second
  errorRate: number; // percentage
  memoryUsage: number; // bytes
  cpuUsage: number; // percentage
}

export interface ErrorMetrics {
  total: number;
  byType: Record<string, number>;
  rate: number; // errors per second
  criticalErrors: number;
  recentErrors: ErrorDetails[];
}

export interface ErrorDetails {
  timestamp: Date;
  type: string;
  message: string;
  source?: string;
  stackTrace?: string;
}

export interface TrendData {
  timestamp: Date;
  value: number;
}

export interface AnalyticsDimension {
  name: string;
  values: DimensionValue[];
}

export interface DimensionValue {
  value: string;
  count: number;
  percentage: number;
}

// Конфигурация системы

export interface RealtimeConfig {
  websocket: WebSocketConfig;
  queues: QueueConfig[];
  analytics: AnalyticsConfig;
  performance: PerformanceConfig;
  security: SecurityConfig;
}

export interface WebSocketConfig {
  port: number;
  path: string;
  pingInterval: number; // ms
  pingTimeout: number; // ms
  maxConnections: number;
  compression: boolean;
  cors: {
    origin: string[];
    credentials: boolean;
  };
}

export interface AnalyticsConfig {
  enabled: boolean;
  retention: number; // days
  sampling: {
    enabled: boolean;
    rate: number; // 0-1
  };
  storage: 'memory' | 'redis' | 'clickhouse';
}

export interface PerformanceConfig {
  maxSubscriptionsPerUser: number;
  maxFiltersPerSubscription: number;
  defaultThrottleRate: number; // messages per second
  memoryLimit: number; // bytes
  gcInterval: number; // ms
}

export interface SecurityConfig {
  authentication: {
    required: boolean;
    methods: ('jwt' | 'session' | 'api_key')[];
  };
  authorization: {
    enabled: boolean;
    defaultRole: string;
  };
  rateLimit: {
    enabled: boolean;
    requestsPerMinute: number;
    subscriptionsPerMinute: number;
  };
}

// События жизненного цикла

export interface LifecycleEvent {
  type: LifecycleEventType;
  timestamp: Date;
  details: any;
}

export enum LifecycleEventType {
  SERVICE_STARTED = 'service_started',
  SERVICE_STOPPED = 'service_stopped',
  CONNECTION_OPENED = 'connection_opened',
  CONNECTION_CLOSED = 'connection_closed',
  SUBSCRIPTION_CREATED = 'subscription_created',
  SUBSCRIPTION_CANCELLED = 'subscription_cancelled',
  QUEUE_CREATED = 'queue_created',
  QUEUE_DELETED = 'queue_deleted',
  ERROR_OCCURRED = 'error_occurred',
  MAINTENANCE_STARTED = 'maintenance_started',
  MAINTENANCE_COMPLETED = 'maintenance_completed',
}

// Мониторинг и диагностика

export interface SystemHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  components: ComponentHealth[];
  metrics: SystemMetrics;
  lastChecked: Date;
}

export interface ComponentHealth {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  message?: string;
  metrics?: Record<string, number>;
}

export interface SystemMetrics {
  uptime: number; // seconds
  memoryUsage: number; // percentage
  cpuUsage: number; // percentage
  connectionsCount: number;
  subscriptionsCount: number;
  messagesPerSecond: number;
  errorRate: number; // percentage
}

// Интеграции с внешними системами

export interface ExternalIntegration {
  id: string;
  name: string;
  type: IntegrationType;
  config: IntegrationConfig;
  status: IntegrationStatus;
  lastSync?: Date;
  metrics: IntegrationMetrics;
}

export enum IntegrationType {
  KAFKA = 'kafka',
  MQTT = 'mqtt',
  WEBHOOK = 'webhook',
  DATABASE = 'database',
  API = 'api',
  FILE = 'file',
}

export enum IntegrationStatus {
  CONNECTED = 'connected',
  DISCONNECTED = 'disconnected',
  ERROR = 'error',
  DISABLED = 'disabled',
}

export interface IntegrationConfig {
  endpoint?: string;
  credentials?: Record<string, string>;
  headers?: Record<string, string>;
  timeout?: number;
  retries?: number;
  batchSize?: number;
  mappings?: FieldMapping[];
}

export interface FieldMapping {
  source: string;
  target: string;
  transform?: string;
  required?: boolean;
}

export interface IntegrationMetrics {
  totalEvents: number;
  successfulEvents: number;
  failedEvents: number;
  avgLatency: number;
  lastEventAt?: Date;
  errorRate: number;
}