export interface KPIMetric {
  id: string;
  name: string;
  category: KPICategory;
  description: string;
  value: number;
  unit: string;
  target?: number;
  threshold?: KPIThreshold;
  trend: KPITrend;
  status: KPIStatus;
  calculatedAt: Date;
  period: TimePeriod;
  tags: string[];
  metadata?: Record<string, any>;
}

export enum KPICategory {
  OPERATIONAL = 'operational',
  FINANCIAL = 'financial',
  SAFETY = 'safety',
  ENVIRONMENTAL = 'environmental',
  CUSTOMER = 'customer',
  EQUIPMENT = 'equipment',
  HUMAN_RESOURCES = 'human_resources',
}

export interface KPIThreshold {
  excellent: { min?: number; max?: number; color: string };
  good: { min?: number; max?: number; color: string };
  warning: { min?: number; max?: number; color: string };
  critical: { min?: number; max?: number; color: string };
}

export interface KPITrend {
  direction: 'up' | 'down' | 'stable';
  percentage: number;
  period: string;
  previousValue?: number;
  changeValue?: number;
}

export enum KPIStatus {
  EXCELLENT = 'excellent',
  GOOD = 'good',
  WARNING = 'warning',
  CRITICAL = 'critical',
  NO_DATA = 'no_data',
}

export interface TimePeriod {
  start: Date;
  end: Date;
  type: 'real-time' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
}

export interface KPITarget {
  metricId: string;
  targetValue: number;
  targetType: 'minimum' | 'maximum' | 'exact' | 'range';
  targetRange?: { min: number; max: number };
  effectiveFrom: Date;
  effectiveTo?: Date;
  description?: string;
  owner?: string;
}

export interface KPIDashboard {
  id: string;
  name: string;
  description: string;
  category: KPICategory;
  metrics: KPIMetric[];
  layout: KPIDashboardLayout;
  refreshInterval: number;
  isDefault: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface KPIDashboardLayout {
  type: 'grid' | 'list' | 'cards';
  columns?: number;
  groupBy?: 'category' | 'status' | 'none';
  sorting?: 'name' | 'value' | 'status' | 'trend';
  filters?: string[];
}

// Специфичные KPI для контейнерного терминала
export interface TerminalKPIs {
  operational: OperationalKPIs;
  financial: FinancialKPIs;
  equipment: EquipmentKPIs;
  safety: SafetyKPIs;
  environmental: EnvironmentalKPIs;
  customer: CustomerKPIs;
}

export interface OperationalKPIs {
  containerThroughput: KPIMetric; // TEU/день
  vesselTurnaroundTime: KPIMetric; // часы
  truckTurnaroundTime: KPIMetric; // минуты
  berthProductivity: KPIMetric; // контейнеров/час
  yardUtilization: KPIMetric; // %
  equipmentUtilization: KPIMetric; // %
  gateProcessingTime: KPIMetric; // минуты
  dwellTime: KPIMetric; // дни
  onTimePerformance: KPIMetric; // %
  operationalEfficiency: KPIMetric; // общий индекс
}

export interface FinancialKPIs {
  revenue: KPIMetric; // руб/месяц
  revenuePerTEU: KPIMetric; // руб/TEU
  costPerMove: KPIMetric; // руб/операция
  profitMargin: KPIMetric; // %
  cashFlow: KPIMetric; // руб
  receivables: KPIMetric; // руб
  costEfficiency: KPIMetric; // индекс
  budgetVariance: KPIMetric; // %
}

export interface EquipmentKPIs {
  equipmentAvailability: KPIMetric; // %
  equipmentReliability: KPIMetric; // %
  maintenanceCost: KPIMetric; // руб/месяц
  fuelConsumption: KPIMetric; // л/час
  breakdownFrequency: KPIMetric; // инциденты/месяц
  maintenanceCompliance: KPIMetric; // %
  assetUtilization: KPIMetric; // %
}

export interface SafetyKPIs {
  accidentRate: KPIMetric; // инциденты/месяц
  injuryRate: KPIMetric; // травмы/месяц
  nearMissReports: KPIMetric; // отчеты/месяц
  safetyTrainingCompliance: KPIMetric; // %
  securityIncidents: KPIMetric; // инциденты/месяц
  complianceScore: KPIMetric; // %
  emergencyResponseTime: KPIMetric; // минуты
}

export interface EnvironmentalKPIs {
  carbonEmissions: KPIMetric; // тонн CO2/месяц
  energyConsumption: KPIMetric; // кВт⋅ч/TEU
  wasteReduction: KPIMetric; // %
  waterUsage: KPIMetric; // м³/месяц
  noiseLevel: KPIMetric; // дБ
  dustLevel: KPIMetric; // мг/м³
  environmentalCompliance: KPIMetric; // %
}

export interface CustomerKPIs {
  customerSatisfaction: KPIMetric; // балл/10
  serviceLevel: KPIMetric; // %
  complaintResolutionTime: KPIMetric; // часы
  customerRetention: KPIMetric; // %
  deliveryAccuracy: KPIMetric; // %
  documentAccuracy: KPIMetric; // %
  responsiveness: KPIMetric; // часы
}

// Типы для расчета KPI
export interface KPICalculationConfig {
  metricId: string;
  calculationType: 'sum' | 'avg' | 'count' | 'ratio' | 'percentage' | 'custom';
  sourceQuery: string;
  aggregationPeriod: 'hour' | 'day' | 'week' | 'month';
  dependencies?: string[];
  customFormula?: string;
  filters?: Record<string, any>;
}

export interface KPIAlert {
  id: string;
  metricId: string;
  alertType: 'threshold' | 'trend' | 'anomaly';
  condition: AlertCondition;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  triggeredAt: Date;
  acknowledgedAt?: Date;
  acknowledgedBy?: string;
  resolvedAt?: Date;
  actions?: AlertAction[];
}

export interface AlertCondition {
  operator: '>' | '<' | '=' | '>=' | '<=' | 'between' | 'outside';
  value: number | [number, number];
  duration?: number; // минуты
  consecutive?: boolean;
}

export interface AlertAction {
  type: 'email' | 'sms' | 'webhook' | 'notification';
  target: string;
  template?: string;
  parameters?: Record<string, any>;
}

// Бенчмаркинг и сравнение
export interface KPIBenchmark {
  metricId: string;
  benchmarkType: 'industry' | 'internal' | 'target' | 'historical';
  value: number;
  source: string;
  period: TimePeriod;
  confidence?: number;
  description?: string;
}

export interface KPIComparison {
  metricId: string;
  currentValue: number;
  comparisons: Array<{
    type: 'previous_period' | 'same_period_last_year' | 'benchmark' | 'target';
    value: number;
    difference: number;
    percentageChange: number;
    status: 'better' | 'worse' | 'same';
  }>;
}

// Экспорт и отчетность
export interface KPIReport {
  id: string;
  title: string;
  description: string;
  category: KPICategory;
  period: TimePeriod;
  metrics: KPIMetric[];
  summary: KPIReportSummary;
  insights: KPIInsight[];
  recommendations: KPIRecommendation[];
  generatedAt: Date;
  generatedBy: string;
}

export interface KPIReportSummary {
  totalMetrics: number;
  excellentCount: number;
  goodCount: number;
  warningCount: number;
  criticalCount: number;
  overallScore: number;
  keyHighlights: string[];
  majorConcerns: string[];
}

export interface KPIInsight {
  type: 'trend' | 'correlation' | 'anomaly' | 'pattern';
  title: string;
  description: string;
  metrics: string[];
  confidence: number;
  impact: 'high' | 'medium' | 'low';
}

export interface KPIRecommendation {
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  category: string;
  estimatedImpact: string;
  implementationTime: string;
  resources: string[];
  metrics: string[];
}