import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

export enum AccessEventType {
  CARD_SCAN = 'card_scan',
  BIOMETRIC_SCAN = 'biometric_scan',
  PIN_ENTRY = 'pin_entry',
  QR_CODE_SCAN = 'qr_code_scan',
  MANUAL_OVERRIDE = 'manual_override',
  EMERGENCY_OPEN = 'emergency_open',
  FORCED_ENTRY = 'forced_entry',
}

export enum AccessResult {
  GRANTED = 'granted',
  DENIED = 'denied',
  EXPIRED = 'expired',
  BLACKLISTED = 'blacklisted',
  INVALID_CREDENTIALS = 'invalid_credentials',
  SYSTEM_ERROR = 'system_error',
}

export enum PersonType {
  EMPLOYEE = 'employee',
  CONTRACTOR = 'contractor',
  VISITOR = 'visitor',
  DRIVER = 'driver',
  INSPECTOR = 'inspector',
  EMERGENCY = 'emergency',
  MAINTENANCE = 'maintenance',
  UNKNOWN = 'unknown',
}

@Entity('access_control', { schema: 'gate' })
@Index(['eventType'])
@Index(['result'])
@Index(['personType'])
@Index(['timestamp'])
@Index(['deviceId'])
@Index(['zoneId'])
@Index(['personId'])
@Index(['cardNumber'])
export class AccessControl {
  @ApiProperty({ description: 'Уникальный идентификатор события доступа' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ description: 'Тип события доступа', enum: AccessEventType })
  @Column({
    name: 'event_type',
    type: 'enum',
    enum: AccessEventType,
  })
  eventType: AccessEventType;

  @ApiProperty({ description: 'Результат проверки доступа', enum: AccessResult })
  @Column({
    type: 'enum',
    enum: AccessResult,
  })
  result: AccessResult;

  @ApiProperty({ description: 'Временная метка события' })
  @Column({ type: 'timestamp' })
  timestamp: Date;

  @ApiProperty({ description: 'ID устройства доступа' })
  @Column({ name: 'device_id' })
  deviceId: string;

  @ApiProperty({ description: 'Название устройства' })
  @Column({ name: 'device_name' })
  deviceName: string;

  @ApiProperty({ description: 'Расположение устройства' })
  @Column({ name: 'device_location' })
  deviceLocation: string;

  @ApiProperty({ description: 'ID зоны доступа' })
  @Column({ name: 'zone_id' })
  zoneId: string;

  @ApiProperty({ description: 'Название зоны' })
  @Column({ name: 'zone_name' })
  zoneName: string;

  @ApiProperty({ description: 'Направление прохода' })
  @Column()
  direction: 'entry' | 'exit';

  @ApiProperty({ description: 'ID пользователя (если идентифицирован)' })
  @Column({ name: 'person_id', nullable: true })
  personId: string;

  @ApiProperty({ description: 'Имя пользователя' })
  @Column({ name: 'person_name', nullable: true })
  personName: string;

  @ApiProperty({ description: 'Тип пользователя', enum: PersonType })
  @Column({
    name: 'person_type',
    type: 'enum',
    enum: PersonType,
    default: PersonType.UNKNOWN,
  })
  personType: PersonType;

  @ApiProperty({ description: 'Номер карты доступа' })
  @Column({ name: 'card_number', nullable: true })
  cardNumber: string;

  @ApiProperty({ description: 'Тип карты' })
  @Column({ name: 'card_type', nullable: true })
  cardType: string;

  @ApiProperty({ description: 'Биометрические данные' })
  @Column({ name: 'biometric_data', type: 'jsonb', nullable: true })
  biometricData: {
    type: 'fingerprint' | 'face' | 'iris' | 'palm';
    template_hash?: string;
    confidence?: number;
    match_score?: number;
    quality_score?: number;
  };

  @ApiProperty({ description: 'PIN код (хешированный)' })
  @Column({ name: 'pin_hash', nullable: true })
  pinHash: string;

  @ApiProperty({ description: 'QR код данные' })
  @Column({ name: 'qr_code_data', nullable: true })
  qrCodeData: string;

  @ApiProperty({ description: 'Права доступа на момент события' })
  @Column({ name: 'access_permissions', type: 'jsonb', nullable: true })
  accessPermissions: {
    zones: string[];
    timeRestrictions?: {
      allowedHours: { from: string; to: string }[];
      allowedDays: string[];
      validFrom: Date;
      validUntil: Date;
    };
    specialPermissions?: string[];
    escortRequired?: boolean;
  };

  @ApiProperty({ description: 'Причина отказа (если доступ запрещен)' })
  @Column({ name: 'denial_reason', nullable: true })
  denialReason: string;

  @ApiProperty({ description: 'Фотография с камеры' })
  @Column({ name: 'photo_url', nullable: true })
  photoUrl: string;

  @ApiProperty({ description: 'Видеозапись события' })
  @Column({ name: 'video_url', nullable: true })
  videoUrl: string;

  @ApiProperty({ description: 'Температура тела (если измерялась)' })
  @Column({ name: 'body_temperature', type: 'decimal', precision: 4, scale: 1, nullable: true })
  bodyTemperature: number;

  @ApiProperty({ description: 'Компаньоны (сопровождающие)' })
  @Column({ type: 'jsonb', nullable: true })
  companions: Array<{
    personId?: string;
    name: string;
    type: PersonType;
    cardNumber?: string;
    relationship: string;
  }>;

  @ApiProperty({ description: 'Информация о транспорте' })
  @Column({ name: 'vehicle_info', type: 'jsonb', nullable: true })
  vehicleInfo: {
    licensePlate?: string;
    vehicleType?: string;
    driverName?: string;
    company?: string;
    purpose?: string;
  };

  @ApiProperty({ description: 'Время нахождения в зоне' })
  @Column({ name: 'zone_duration', type: 'integer', nullable: true })
  zoneDuration: number;

  @ApiProperty({ description: 'Предыдущая зона' })
  @Column({ name: 'previous_zone', nullable: true })
  previousZone: string;

  @ApiProperty({ description: 'Следующая зона (планируемая)' })
  @Column({ name: 'next_zone', nullable: true })
  nextZone: string;

  @ApiProperty({ description: 'Аварийные события' })
  @Column({ name: 'emergency_events', type: 'jsonb', nullable: true })
  emergencyEvents: Array<{
    type: 'duress' | 'tailgating' | 'forced_entry' | 'alarm';
    triggered: boolean;
    timestamp: Date;
    handled: boolean;
    response_time?: number;
  }>;

  @ApiProperty({ description: 'Системная информация' })
  @Column({ name: 'system_info', type: 'jsonb', nullable: true })
  systemInfo: {
    deviceFirmware?: string;
    deviceStatus?: string;
    networkLatency?: number;
    batteryLevel?: number;
    signalStrength?: number;
    lastMaintenance?: Date;
  };

  @ApiProperty({ description: 'Логи безопасности' })
  @Column({ name: 'security_logs', type: 'jsonb', nullable: true })
  securityLogs: Array<{
    level: 'info' | 'warning' | 'error' | 'critical';
    message: string;
    timestamp: Date;
    source: string;
  }>;

  @ApiProperty({ description: 'ID пользователя, подтвердившего доступ (ручной режим)' })
  @Column({ name: 'authorized_by', nullable: true })
  authorizedBy: string;

  @ApiProperty({ description: 'Причина ручного вмешательства' })
  @Column({ name: 'manual_override_reason', type: 'text', nullable: true })
  manualOverrideReason: string;

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