export interface DashboardConfig {
  id: string;
  name: string;
  description?: string;
  layout: DashboardLayout;
  widgets: DashboardWidget[];
  filters: DashboardFilter[];
  refreshInterval: number; // seconds
  isPublic: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface DashboardLayout {
  type: 'grid' | 'flex' | 'tabs';
  columns?: number;
  rows?: number;
  spacing?: number;
  responsive?: boolean;
}

export interface DashboardWidget {
  id: string;
  type: WidgetType;
  title: string;
  position: WidgetPosition;
  size: WidgetSize;
  config: WidgetConfig;
  dataSource: DataSourceConfig;
  styling?: WidgetStyling;
}

export enum WidgetType {
  CHART_LINE = 'chart_line',
  CHART_BAR = 'chart_bar',
  CHART_PIE = 'chart_pie',
  CHART_AREA = 'chart_area',
  METRIC_CARD = 'metric_card',
  TABLE = 'table',
  MAP = 'map',
  GAUGE = 'gauge',
  PROGRESS_BAR = 'progress_bar',
  STATUS_INDICATOR = 'status_indicator',
  TEXT = 'text',
  IMAGE = 'image',
}

export interface WidgetPosition {
  x: number;
  y: number;
  row?: number;
  col?: number;
}

export interface WidgetSize {
  width: number;
  height: number;
  minWidth?: number;
  minHeight?: number;
  maxWidth?: number;
  maxHeight?: number;
}

export interface WidgetConfig {
  query?: string;
  aggregation?: string;
  groupBy?: string[];
  dateRange?: DateRange;
  refreshInterval?: number;
  displayOptions?: any;
  thresholds?: Threshold[];
  formatters?: Formatter[];
}

export interface DataSourceConfig {
  type: 'clickhouse' | 'api' | 'static';
  query?: string;
  endpoint?: string;
  parameters?: Record<string, any>;
  cacheTime?: number;
}

export interface WidgetStyling {
  backgroundColor?: string;
  textColor?: string;
  borderColor?: string;
  borderWidth?: number;
  borderRadius?: number;
  padding?: number;
  margin?: number;
  fontSize?: number;
  fontFamily?: string;
}

export interface DashboardFilter {
  id: string;
  name: string;
  type: FilterType;
  field: string;
  defaultValue?: any;
  options?: FilterOption[];
  dependent?: string[];
}

export enum FilterType {
  DATE_RANGE = 'date_range',
  SELECT = 'select',
  MULTI_SELECT = 'multi_select',
  TEXT = 'text',
  NUMBER = 'number',
  BOOLEAN = 'boolean',
}

export interface FilterOption {
  label: string;
  value: any;
}

export interface DateRange {
  start: Date | string;
  end: Date | string;
  period?: 'hour' | 'day' | 'week' | 'month' | 'quarter' | 'year';
}

export interface Threshold {
  value: number;
  color: string;
  operator: '>' | '<' | '=' | '>=' | '<=';
  label?: string;
}

export interface Formatter {
  type: 'number' | 'currency' | 'percentage' | 'date' | 'duration';
  options?: {
    decimals?: number;
    currency?: string;
    locale?: string;
    format?: string;
  };
}

// Предустановленные конфигурации дашбордов
export interface DashboardTemplate {
  id: string;
  name: string;
  description: string;
  category: DashboardCategory;
  config: Omit<DashboardConfig, 'id' | 'createdBy' | 'createdAt' | 'updatedAt'>;
  previewImage?: string;
  tags: string[];
}

export enum DashboardCategory {
  OPERATIONS = 'operations',
  FINANCIAL = 'financial',
  EQUIPMENT = 'equipment',
  SECURITY = 'security',
  EXECUTIVE = 'executive',
  CUSTOM = 'custom',
}

// Данные для виджетов
export interface WidgetData {
  widgetId: string;
  data: any;
  metadata: {
    lastUpdated: Date;
    executionTime: number;
    dataPoints: number;
    error?: string;
  };
}

export interface ChartData {
  labels: string[];
  datasets: ChartDataset[];
  options?: ChartOptions;
}

export interface ChartDataset {
  label: string;
  data: number[];
  backgroundColor?: string | string[];
  borderColor?: string | string[];
  borderWidth?: number;
  fill?: boolean;
  tension?: number;
}

export interface ChartOptions {
  responsive?: boolean;
  maintainAspectRatio?: boolean;
  scales?: {
    x?: ScaleOptions;
    y?: ScaleOptions;
  };
  plugins?: {
    legend?: LegendOptions;
    tooltip?: TooltipOptions;
  };
}

export interface ScaleOptions {
  display?: boolean;
  title?: {
    display: boolean;
    text: string;
  };
  ticks?: {
    beginAtZero?: boolean;
    callback?: string;
  };
}

export interface LegendOptions {
  display?: boolean;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

export interface TooltipOptions {
  enabled?: boolean;
  mode?: 'index' | 'dataset' | 'point' | 'nearest';
  intersect?: boolean;
}

export interface MetricCardData {
  value: number | string;
  label: string;
  unit?: string;
  trend?: {
    value: number;
    direction: 'up' | 'down' | 'stable';
    period: string;
  };
  status?: 'success' | 'warning' | 'error' | 'info';
}

export interface TableData {
  columns: TableColumn[];
  rows: any[];
  pagination?: {
    page: number;
    pageSize: number;
    total: number;
  };
  sorting?: {
    column: string;
    direction: 'asc' | 'desc';
  };
}

export interface TableColumn {
  key: string;
  title: string;
  dataType: 'string' | 'number' | 'date' | 'boolean';
  sortable?: boolean;
  filterable?: boolean;
  formatter?: Formatter;
  width?: number;
}

export interface GaugeData {
  value: number;
  min: number;
  max: number;
  label: string;
  unit?: string;
  thresholds?: Threshold[];
  color?: string;
}

export interface MapData {
  type: 'terminal' | 'heatmap' | 'markers';
  center?: [number, number];
  zoom?: number;
  layers: MapLayer[];
}

export interface MapLayer {
  id: string;
  type: 'containers' | 'equipment' | 'zones' | 'tracks';
  data: any[];
  style?: any;
  visible?: boolean;
}