export interface ReportFilter {
  dateFrom: Date;
  dateTo: Date;
  clientIds?: string[];
  containerTypes?: string[];
  operationTypes?: string[];
  equipmentTypes?: string[];
  statuses?: string[];
  locations?: string[];
  groupBy?: 'hour' | 'day' | 'week' | 'month';
}

export interface ReportResult {
  id: string;
  name: string;
  type: string;
  generatedAt: Date;
  filters: ReportFilter;
  data: any[];
  metadata: {
    totalRows: number;
    executionTime: number;
    dataSource: string;
    columns: Array<{
      name: string;
      type: string;
      description?: string;
    }>;
  };
  summary?: {
    totalOperations?: number;
    totalContainers?: number;
    totalRevenue?: number;
    averageProcessingTime?: number;
    utilizationRate?: number;
  };
}

export interface ContainerOperationsReportData {
  period: string;
  operation_type: string;
  operations_count: number;
  unique_containers: number;
  avg_duration_seconds: number;
  total_teu: number;
  success_rate: number;
  peak_hour?: string;
}

export interface GateTransactionsReportData {
  period: string;
  gate_direction: 'in' | 'out';
  transactions_count: number;
  avg_processing_time_seconds: number;
  total_weight: number;
  trucks_count: number;
  peak_hour?: string;
}

export interface EquipmentPerformanceReportData {
  period: string;
  equipment_type: string;
  equipment_id: string;
  utilization_percent: number;
  moves_per_hour: number;
  fuel_consumption: number;
  breakdown_count: number;
  maintenance_hours: number;
  efficiency_score: number;
}

export interface FinancialReportData {
  period: string;
  client_id: string;
  client_name?: string;
  service_type: string;
  transactions_count: number;
  total_amount: number;
  currency: string;
  payment_status: string;
  average_transaction_value: number;
}

export interface InventoryReportData {
  snapshot_date: string;
  location: string;
  location_type: string;
  container_count: number;
  teu_count: number;
  utilization_percent: number;
  dwell_time_avg: number;
  container_types: Record<string, number>;
  occupancy_trend: 'increasing' | 'decreasing' | 'stable';
}

export interface ProductivityReportData {
  period: string;
  total_moves: number;
  moves_per_hour: number;
  vessel_operations: number;
  truck_operations: number;
  equipment_utilization: number;
  labor_productivity: number;
  berth_productivity: number;
  yard_productivity: number;
}

export interface ClientActivityReportData {
  client_id: string;
  client_name?: string;
  period: string;
  total_operations: number;
  container_count: number;
  total_revenue: number;
  avg_dwell_time: number;
  service_types: string[];
  growth_rate: number;
  satisfaction_score?: number;
}

export interface TerminalKPIReportData {
  period: string;
  berth_occupancy: number;
  yard_utilization: number;
  equipment_availability: number;
  avg_vessel_turnaround: number;
  avg_truck_turnaround: number;
  throughput_teu: number;
  cost_per_move: number;
  revenue_per_teu: number;
  safety_incidents: number;
  environmental_score: number;
}