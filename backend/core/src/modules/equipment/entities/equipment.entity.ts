import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

export enum EquipmentType {
  CRANE = 'crane',
  REACH_STACKER = 'reach_stacker',
  FORKLIFT = 'forklift',
  TERMINAL_TRACTOR = 'terminal_tractor',
  CHASSIS = 'chassis',
  TRUCK = 'truck',
  RAIL_CRANE = 'rail_crane',
  SHIP_CRANE = 'ship_crane',
  MOBILE_CRANE = 'mobile_crane',
  RTG = 'rtg', // Rubber Tyred Gantry
  RMG = 'rmg', // Rail Mounted Gantry
  STRADDLE_CARRIER = 'straddle_carrier',
  CONTAINER_SPREADER = 'container_spreader',
  WEIGHBRIDGE = 'weighbridge',
  SCANNER = 'scanner',
  GENERATOR = 'generator',
  LIGHTING_TOWER = 'lighting_tower',
  COMMUNICATION_DEVICE = 'communication_device',
}

export enum EquipmentStatus {
  AVAILABLE = 'available',
  IN_USE = 'in_use',
  MAINTENANCE = 'maintenance',
  OUT_OF_SERVICE = 'out_of_service',
  REPAIR = 'repair',
  RESERVED = 'reserved',
  CALIBRATION = 'calibration',
  INSPECTION = 'inspection',
}

export enum EquipmentCondition {
  EXCELLENT = 'excellent',
  GOOD = 'good',
  FAIR = 'fair',
  POOR = 'poor',
  CRITICAL = 'critical',
}

export enum FuelType {
  DIESEL = 'diesel',
  ELECTRIC = 'electric',
  HYBRID = 'hybrid',
  GASOLINE = 'gasoline',
  CNG = 'cng', // Compressed Natural Gas
  LPG = 'lpg', // Liquefied Petroleum Gas
  HYDROGEN = 'hydrogen',
  BATTERY = 'battery',
}

@Entity('equipment', { schema: 'equipment' })
@Index(['equipmentNumber'], { unique: true })
@Index(['type'])
@Index(['status'])
@Index(['condition'])
@Index(['currentLocation'], { spatial: true })
@Index(['assignedOperatorId'])
@Index(['departmentId'])
@Index(['manufacturerId'])
export class Equipment {
  @ApiProperty({ description: 'Уникальный идентификатор оборудования' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ description: 'Номер оборудования', example: 'EQ-001-CRANE' })
  @Column({ name: 'equipment_number', type: 'varchar', length: 50, unique: true })
  equipmentNumber: string;

  @ApiProperty({ description: 'Название оборудования' })
  @Column({ name: 'equipment_name' })
  equipmentName: string;

  @ApiProperty({ description: 'Тип оборудования', enum: EquipmentType })
  @Column({
    type: 'enum',
    enum: EquipmentType,
  })
  type: EquipmentType;

  @ApiProperty({ description: 'Статус оборудования', enum: EquipmentStatus })
  @Column({
    type: 'enum',
    enum: EquipmentStatus,
    default: EquipmentStatus.AVAILABLE,
  })
  status: EquipmentStatus;

  @ApiProperty({ description: 'Техническое состояние', enum: EquipmentCondition })
  @Column({
    type: 'enum',
    enum: EquipmentCondition,
    default: EquipmentCondition.GOOD,
  })
  condition: EquipmentCondition;

  @ApiProperty({ description: 'Описание оборудования' })
  @Column({ type: 'text', nullable: true })
  description: string;

  @ApiProperty({ description: 'Производитель' })
  @Column()
  manufacturer: string;

  @ApiProperty({ description: 'ID производителя в системе' })
  @Column({ name: 'manufacturer_id', nullable: true })
  manufacturerId: string;

  @ApiProperty({ description: 'Модель' })
  @Column()
  model: string;

  @ApiProperty({ description: 'Год выпуска' })
  @Column({ name: 'manufacturing_year' })
  manufacturingYear: number;

  @ApiProperty({ description: 'Серийный номер' })
  @Column({ name: 'serial_number' })
  serialNumber: string;

  @ApiProperty({ description: 'VIN или номер шасси' })
  @Column({ name: 'vin_number', nullable: true })
  vinNumber: string;

  @ApiProperty({ description: 'Номерной знак (для транспортных средств)' })
  @Column({ name: 'license_plate', nullable: true })
  licensePlate: string;

  @ApiProperty({ description: 'Технические характеристики' })
  @Column({ type: 'jsonb' })
  specifications: {
    maxCapacity: {
      value: number;
      unit: 'kg' | 'tons' | 'TEU';
    };
    dimensions: {
      length: number;
      width: number;
      height: number;
      unit: 'm' | 'ft';
    };
    operatingWeights: {
      emptyWeight: number;
      maxGrossWeight: number;
      unit: 'kg' | 'tons';
    };
    performance: {
      maxSpeed: number;
      speedUnit: 'km/h' | 'mph' | 'm/min';
      maxReach?: number;
      reachUnit?: 'm' | 'ft';
      liftHeight?: number;
      liftUnit?: 'm' | 'ft';
    };
    powerSystem: {
      fuelType: FuelType;
      enginePower?: number;
      powerUnit?: 'hp' | 'kW';
      fuelCapacity?: number;
      fuelUnit?: 'L' | 'gal';
      batteryCapacity?: number;
      batteryUnit?: 'kWh' | 'Ah';
    };
    operational: {
      operatingTemperatureRange: {
        min: number;
        max: number;
        unit: 'C' | 'F';
      };
      maxGradient?: number; // percentage
      turningRadius?: number;
      radiusUnit?: 'm' | 'ft';
    };
  };

  @ApiProperty({ description: 'Навесное оборудование и аксессуары' })
  @Column({ type: 'jsonb', nullable: true })
  attachments: Array<{
    attachmentId: string;
    name: string;
    type: string;
    specifications: Record<string, any>;
    installed: boolean;
    installedAt?: Date;
    condition: EquipmentCondition;
    notes?: string;
  }>;

  @ApiProperty({ description: 'Сертификаты и разрешения' })
  @Column({ type: 'jsonb', nullable: true })
  certifications: Array<{
    certificateType: string;
    certificateNumber: string;
    issuedBy: string;
    issuedAt: Date;
    expiresAt: Date;
    status: 'valid' | 'expired' | 'suspended';
    documentUrl?: string;
  }>;

  @ApiProperty({ description: 'Текущее местоположение' })
  @Column({
    name: 'current_location',
    type: 'geometry',
    spatialFeatureType: 'Point',
    srid: 4326,
    nullable: true,
  })
  currentLocation: string;

  @ApiProperty({ description: 'Адрес местоположения' })
  @Column({ name: 'location_address', nullable: true })
  locationAddress: string;

  @ApiProperty({ description: 'Зона/участок размещения' })
  @Column({ name: 'location_zone', nullable: true })
  locationZone: string;

  @ApiProperty({ description: 'ID назначенного оператора' })
  @Column({ name: 'assigned_operator_id', nullable: true })
  assignedOperatorId: string;

  @ApiProperty({ description: 'Имя назначенного оператора' })
  @Column({ name: 'assigned_operator_name', nullable: true })
  assignedOperatorName: string;

  @ApiProperty({ description: 'Время назначения оператора' })
  @Column({ name: 'operator_assigned_at', type: 'timestamp', nullable: true })
  operatorAssignedAt: Date;

  @ApiProperty({ description: 'ID подразделения' })
  @Column({ name: 'department_id', nullable: true })
  departmentId: string;

  @ApiProperty({ description: 'Название подразделения' })
  @Column({ name: 'department_name', nullable: true })
  departmentName: string;

  @ApiProperty({ description: 'Центр затрат' })
  @Column({ name: 'cost_center', nullable: true })
  costCenter: string;

  @ApiProperty({ description: 'Дата ввода в эксплуатацию' })
  @Column({ name: 'commissioned_at', type: 'date' })
  commissionedAt: Date;

  @ApiProperty({ description: 'Дата вывода из эксплуатации' })
  @Column({ name: 'decommissioned_at', type: 'date', nullable: true })
  decommissionedAt: Date;

  @ApiProperty({ description: 'Стоимостная информация' })
  @Column({ name: 'financial_data', type: 'jsonb', nullable: true })
  financialData: {
    purchasePrice: {
      amount: number;
      currency: string;
      purchaseDate: Date;
    };
    currentValue: {
      bookValue: number;
      marketValue?: number;
      currency: string;
      valuationDate: Date;
    };
    depreciation: {
      method: 'straight_line' | 'declining_balance' | 'units_of_production';
      annualRate: number;
      accumulatedDepreciation: number;
      usefulLife: number; // years
    };
    operatingCosts: {
      dailyRate?: number;
      hourlyRate?: number;
      perOperationRate?: number;
      currency: string;
    };
  };

  @ApiProperty({ description: 'График технического обслуживания' })
  @Column({ name: 'maintenance_schedule', type: 'jsonb' })
  maintenanceSchedule: {
    routine: Array<{
      taskType: string;
      description: string;
      frequency: {
        interval: number;
        unit: 'hours' | 'days' | 'weeks' | 'months' | 'kilometers';
      };
      lastPerformed?: Date;
      nextDue: Date;
      estimatedDuration: number; // hours
      requiredSkills: string[];
      requiredParts?: string[];
    }>;
    inspections: Array<{
      inspectionType: string;
      description: string;
      frequency: {
        interval: number;
        unit: 'months' | 'years';
      };
      lastInspection?: Date;
      nextInspection: Date;
      inspectorRequirements: string[];
      certificateRequired: boolean;
    }>;
    majorOverhauls: Array<{
      overhaulType: string;
      description: string;
      frequency: {
        interval: number;
        unit: 'years' | 'hours';
      };
      lastOverhaul?: Date;
      nextOverhaul: Date;
      estimatedDuration: number; // days
      estimatedCost: number;
      outsourced: boolean;
    }>;
  };

  @ApiProperty({ description: 'Операционные данные' })
  @Column({ name: 'operational_data', type: 'jsonb', nullable: true })
  operationalData: {
    totalOperatingHours: number;
    hoursThisMonth: number;
    distanceTraveled?: number;
    distanceUnit?: 'km' | 'miles';
    cyclesCompleted?: number; // for cranes, stackers
    currentFuelLevel?: number;
    fuelUnit?: '%' | 'L' | 'gal';
    batteryLevel?: number; // percentage
    lastOperationAt?: Date;
    averageUtilization: number; // percentage
    efficiencyRating: number; // 1-10
  };

  @ApiProperty({ description: 'Мониторинг состояния' })
  @Column({ name: 'monitoring_data', type: 'jsonb', nullable: true })
  monitoringData: {
    sensors: Array<{
      sensorId: string;
      sensorType: string;
      parameter: string;
      currentValue: number;
      unit: string;
      normalRange: {
        min: number;
        max: number;
      };
      warningThresholds: {
        low: number;
        high: number;
      };
      criticalThresholds: {
        low: number;
        high: number;
      };
      lastUpdated: Date;
      status: 'normal' | 'warning' | 'critical' | 'offline';
    }>;
    alerts: Array<{
      alertId: string;
      severity: 'info' | 'warning' | 'critical';
      message: string;
      triggeredAt: Date;
      acknowledgedAt?: Date;
      resolvedAt?: Date;
      status: 'active' | 'acknowledged' | 'resolved';
    }>;
    diagnostics: {
      lastDiagnosticRun: Date;
      overallHealth: number; // percentage
      systemStatus: Record<string, 'ok' | 'warning' | 'error'>;
      faultCodes: Array<{
        code: string;
        description: string;
        severity: 'low' | 'medium' | 'high';
        firstOccurred: Date;
        lastOccurred: Date;
        occurrenceCount: number;
      }>;
    };
  };

  @ApiProperty({ description: 'История перемещений' })
  @Column({ name: 'movement_history', type: 'jsonb', nullable: true })
  movementHistory: Array<{
    timestamp: Date;
    location: {
      latitude: number;
      longitude: number;
      accuracy?: number;
    };
    address?: string;
    zone?: string;
    activity: string;
    operatorId?: string;
    notes?: string;
  }>;

  @ApiProperty({ description: 'Требования безопасности' })
  @Column({ name: 'safety_requirements', type: 'jsonb', nullable: true })
  safetyRequirements: {
    operatorCertifications: string[];
    requiredPPE: string[];
    safetyChecklist: Array<{
      item: string;
      required: boolean;
      frequency: 'daily' | 'weekly' | 'monthly';
    }>;
    hazardIdentification: Array<{
      hazardType: string;
      riskLevel: 'low' | 'medium' | 'high' | 'critical';
      mitigationMeasures: string[];
    }>;
    emergencyProcedures: Array<{
      scenario: string;
      procedure: string[];
      emergencyContacts: string[];
    }>;
  };

  @ApiProperty({ description: 'Конфигурация подключения' })
  @Column({ name: 'connectivity_config', type: 'jsonb', nullable: true })
  connectivityConfig: {
    gpsTracking: {
      enabled: boolean;
      deviceId?: string;
      updateInterval: number; // seconds
      accuracy: number; // meters
    };
    telematics: {
      enabled: boolean;
      systemType?: string;
      deviceId?: string;
      dataPoints: string[];
      transmissionInterval: number; // seconds
    };
    communication: {
      radioFrequency?: string;
      mobilePhone?: string;
      emergencyButton: boolean;
      panicAlarm: boolean;
    };
    automation: {
      remoteControl: boolean;
      autonomousCapable: boolean;
      automationLevel: 'manual' | 'assisted' | 'semi_autonomous' | 'fully_autonomous';
      apiEndpoints?: string[];
    };
  };

  @ApiProperty({ description: 'Дополнительные метаданные' })
  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @ApiProperty({ description: 'Дата создания' })
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ApiProperty({ description: 'Дата обновления' })
  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}