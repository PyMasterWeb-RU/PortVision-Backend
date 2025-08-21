export interface ExportJob {
  id: string;
  type: ExportType;
  format: ExportFormat;
  status: ExportStatus;
  progress: number;
  title: string;
  description?: string;
  config: ExportConfig;
  result?: ExportResult;
  error?: string;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  createdBy: string;
  expiresAt: Date;
}

export enum ExportType {
  REPORT = 'report',
  DASHBOARD = 'dashboard',
  KPI = 'kpi',
  RAW_DATA = 'raw_data',
  CUSTOM_QUERY = 'custom_query',
}

export enum ExportFormat {
  PDF = 'pdf',
  EXCEL = 'excel',
  CSV = 'csv',
  JSON = 'json',
  XML = 'xml',
  PNG = 'png',
  JPEG = 'jpeg',
  SVG = 'svg',
}

export enum ExportStatus {
  QUEUED = 'queued',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  EXPIRED = 'expired',
}

export interface ExportConfig {
  source: ExportSource;
  options: ExportOptions;
  filters?: ExportFilters;
  template?: ExportTemplate;
  scheduling?: ExportScheduling;
}

export interface ExportSource {
  type: 'report' | 'dashboard' | 'kpi' | 'query';
  id?: string;
  query?: string;
  dateRange?: {
    start: Date;
    end: Date;
  };
  parameters?: Record<string, any>;
}

export interface ExportOptions {
  includeHeader?: boolean;
  includeFooter?: boolean;
  includeSummary?: boolean;
  includeCharts?: boolean;
  includeTables?: boolean;
  pageSize?: 'A4' | 'A3' | 'Letter' | 'Legal';
  orientation?: 'portrait' | 'landscape';
  compression?: boolean;
  quality?: number; // 1-100 for images
  locale?: string;
  timezone?: string;
  currency?: string;
  numberFormat?: string;
  dateFormat?: string;
  watermark?: string;
  password?: string;
}

export interface ExportFilters {
  columns?: string[];
  rows?: {
    limit?: number;
    offset?: number;
    where?: Record<string, any>;
  };
  aggregations?: {
    groupBy?: string[];
    functions?: Array<{
      field: string;
      function: 'sum' | 'avg' | 'count' | 'min' | 'max';
    }>;
  };
}

export interface ExportTemplate {
  id: string;
  name: string;
  type: ExportFormat;
  layout: TemplateLayout;
  styling: TemplateStyling;
  variables?: Record<string, any>;
}

export interface TemplateLayout {
  header?: TemplateSection;
  body: TemplateSection;
  footer?: TemplateSection;
  margin?: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
}

export interface TemplateSection {
  content: string;
  height?: number;
  styling?: TemplateStyling;
}

export interface TemplateStyling {
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: 'normal' | 'bold';
  color?: string;
  backgroundColor?: string;
  borderColor?: string;
  borderWidth?: number;
  padding?: number;
  margin?: number;
  textAlign?: 'left' | 'center' | 'right' | 'justify';
}

export interface ExportScheduling {
  enabled: boolean;
  cron?: string;
  timezone?: string;
  recipients?: string[];
  subject?: string;
  body?: string;
  retentionDays?: number;
}

export interface ExportResult {
  filePath: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  downloadUrl?: string;
  previewUrl?: string;
  metadata?: {
    pages?: number;
    rows?: number;
    columns?: number;
    processingTime?: number;
  };
}

// Специализированные интерфейсы для разных форматов
export interface PDFExportOptions extends ExportOptions {
  headerTemplate?: string;
  footerTemplate?: string;
  displayHeaderFooter?: boolean;
  printBackground?: boolean;
  scale?: number;
  paperWidth?: number;
  paperHeight?: number;
  marginTop?: number;
  marginBottom?: number;
  marginLeft?: number;
  marginRight?: number;
  generateTaggedPDF?: boolean;
}

export interface ExcelExportOptions extends ExportOptions {
  sheetName?: string;
  includeIndex?: boolean;
  freezeHeader?: boolean;
  autoFitColumns?: boolean;
  includeFormulas?: boolean;
  numberFormats?: Record<string, string>;
  columnWidths?: Record<string, number>;
  headerStyle?: ExcelCellStyle;
  dataStyle?: ExcelCellStyle;
  charts?: ExcelChart[];
}

export interface ExcelCellStyle {
  font?: {
    name?: string;
    size?: number;
    bold?: boolean;
    italic?: boolean;
    color?: string;
  };
  fill?: {
    type?: 'pattern' | 'gradient';
    fgColor?: string;
    bgColor?: string;
  };
  border?: {
    top?: ExcelBorder;
    right?: ExcelBorder;
    bottom?: ExcelBorder;
    left?: ExcelBorder;
  };
  alignment?: {
    horizontal?: 'left' | 'center' | 'right';
    vertical?: 'top' | 'middle' | 'bottom';
    wrapText?: boolean;
  };
}

export interface ExcelBorder {
  style: 'thin' | 'medium' | 'thick' | 'dotted' | 'dashed';
  color: string;
}

export interface ExcelChart {
  type: 'line' | 'bar' | 'pie' | 'area' | 'scatter';
  title: string;
  position: {
    row: number;
    col: number;
    width: number;
    height: number;
  };
  dataRange: string;
  categoryRange?: string;
}

export interface CSVExportOptions extends ExportOptions {
  delimiter?: string;
  quoteChar?: string;
  escapeChar?: string;
  lineTerminator?: string;
  includeIndex?: boolean;
  encoding?: 'utf8' | 'utf16' | 'ascii' | 'latin1';
}

export interface ImageExportOptions extends ExportOptions {
  width?: number;
  height?: number;
  deviceScaleFactor?: number;
  type?: 'png' | 'jpeg' | 'webp';
  fullPage?: boolean;
  clip?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  omitBackground?: boolean;
}

// Готовые шаблоны экспорта
export interface ExportPreset {
  id: string;
  name: string;
  description: string;
  category: ExportPresetCategory;
  format: ExportFormat;
  config: ExportConfig;
  isDefault: boolean;
  tags: string[];
}

export enum ExportPresetCategory {
  OPERATIONAL = 'operational',
  FINANCIAL = 'financial',
  COMPLIANCE = 'compliance',
  EXECUTIVE = 'executive',
  TECHNICAL = 'technical',
}

// Статистика экспорта
export interface ExportStatistics {
  totalJobs: number;
  completedJobs: number;
  failedJobs: number;
  avgProcessingTime: number;
  totalFileSize: number;
  popularFormats: Array<{
    format: ExportFormat;
    count: number;
    percentage: number;
  }>;
  popularTypes: Array<{
    type: ExportType;
    count: number;
    percentage: number;
  }>;
  recentJobs: ExportJob[];
}

// Пакетный экспорт
export interface BatchExportJob {
  id: string;
  name: string;
  jobs: ExportJob[];
  status: ExportStatus;
  progress: number;
  createdAt: Date;
  completedAt?: Date;
  createdBy: string;
  archivePath?: string;
}

// Конфигурация для автоматического экспорта
export interface AutoExportConfig {
  id: string;
  name: string;
  enabled: boolean;
  trigger: AutoExportTrigger;
  source: ExportSource;
  format: ExportFormat;
  recipients: string[];
  schedule?: string; // cron expression
  conditions?: AutoExportCondition[];
  template?: ExportTemplate;
  retentionDays: number;
  createdBy: string;
  createdAt: Date;
  lastRun?: Date;
  nextRun?: Date;
}

export interface AutoExportTrigger {
  type: 'schedule' | 'event' | 'threshold';
  schedule?: string;
  event?: string;
  threshold?: {
    metric: string;
    operator: '>' | '<' | '=' | '>=' | '<=';
    value: number;
  };
}

export interface AutoExportCondition {
  field: string;
  operator: '=' | '!=' | '>' | '<' | '>=' | '<=' | 'in' | 'not_in' | 'contains';
  value: any;
}

// API интерфейсы для экспорта данных
export interface ExportDataSource {
  query: string;
  parameters?: Record<string, any>;
  cache?: boolean;
  timeout?: number;
}

export interface ExportProgress {
  jobId: string;
  stage: ExportStage;
  progress: number;
  message: string;
  estimatedTimeRemaining?: number;
}

export enum ExportStage {
  QUEUED = 'queued',
  FETCHING_DATA = 'fetching_data',
  PROCESSING_DATA = 'processing_data',
  GENERATING_FILE = 'generating_file',
  UPLOADING = 'uploading',
  COMPLETED = 'completed',
  FAILED = 'failed',
}