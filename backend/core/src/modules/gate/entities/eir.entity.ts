import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { Container } from '../../common/entities/container.entity';
import { GatePass } from './gate-pass.entity';

export enum EirType {
  GATE_IN = 'gate_in',
  GATE_OUT = 'gate_out',
  YARD_IN = 'yard_in',
  YARD_OUT = 'yard_out',
  INTERCHANGE = 'interchange',
}

export enum EirStatus {
  DRAFT = 'draft',
  COMPLETED = 'completed',
  SIGNED = 'signed',
  DISPUTED = 'disputed',
  CANCELLED = 'cancelled',
}

export enum DamageLocation {
  FRONT_WALL = 'front_wall',
  REAR_WALL = 'rear_wall',
  LEFT_SIDE = 'left_side',
  RIGHT_SIDE = 'right_side',
  ROOF = 'roof',
  FLOOR = 'floor',
  DOORS = 'doors',
  CORNER_POSTS = 'corner_posts',
  CORNER_CASTINGS = 'corner_castings',
  FORKLIFT_POCKETS = 'forklift_pockets',
  GOOSENECK_TUNNEL = 'gooseneck_tunnel',
  UNDERFRAME = 'underframe',
}

export enum DamageSeverity {
  MINOR = 'minor',
  MODERATE = 'moderate',
  MAJOR = 'major',
  SEVERE = 'severe',
}

@Entity('eirs', { schema: 'gate' })
@Index(['eirNumber'], { unique: true })
@Index(['type'])
@Index(['status'])
@Index(['containerId'])
@Index(['gatePassId'])
@Index(['inspectionDate'])
export class Eir {
  @ApiProperty({ description: 'Уникальный идентификатор EIR' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ description: 'Номер EIR', example: 'EIR-2023-001234' })
  @Column({ name: 'eir_number', type: 'varchar', length: 50, unique: true })
  eirNumber: string;

  @ApiProperty({ description: 'Тип EIR', enum: EirType })
  @Column({
    type: 'enum',
    enum: EirType,
  })
  type: EirType;

  @ApiProperty({ description: 'Статус EIR', enum: EirStatus })
  @Column({
    type: 'enum',
    enum: EirStatus,
    default: EirStatus.DRAFT,
  })
  status: EirStatus;

  @ApiProperty({ description: 'ID контейнера' })
  @Column({ name: 'container_id' })
  containerId: string;

  @ApiProperty({ description: 'Контейнер', type: () => Container })
  @ManyToOne(() => Container, { eager: true })
  @JoinColumn({ name: 'container_id' })
  container: Container;

  @ApiProperty({ description: 'ID пропуска' })
  @Column({ name: 'gate_pass_id', nullable: true })
  gatePassId: string;

  @ApiProperty({ description: 'Пропуск', type: () => GatePass })
  @ManyToOne(() => GatePass)
  @JoinColumn({ name: 'gate_pass_id' })
  gatePass: GatePass;

  @ApiProperty({ description: 'Дата и время осмотра' })
  @Column({ name: 'inspection_date', type: 'timestamp' })
  inspectionDate: Date;

  @ApiProperty({ description: 'Местоположение осмотра' })
  @Column({ name: 'inspection_location' })
  inspectionLocation: string;

  @ApiProperty({ description: 'ID инспектора' })
  @Column({ name: 'inspector_id' })
  inspectorId: string;

  @ApiProperty({ description: 'Имя инспектора' })
  @Column({ name: 'inspector_name' })
  inspectorName: string;

  @ApiProperty({ description: 'Данные транспорта' })
  @Column({ name: 'transport_info', type: 'jsonb' })
  transportInfo: {
    truckNumber: string;
    trailerNumber?: string;
    driverName: string;
    driverLicense?: string;
    transportCompany?: string;
  };

  @ApiProperty({ description: 'Общее состояние контейнера' })
  @Column({ name: 'overall_condition' })
  overallCondition: string;

  @ApiProperty({ description: 'Печати и пломбы' })
  @Column({ type: 'jsonb', nullable: true })
  seals: {
    customsSeal?: {
      number: string;
      condition: 'intact' | 'broken' | 'missing';
      photo?: string;
    };
    shippingLineSeal?: {
      number: string;
      condition: 'intact' | 'broken' | 'missing';
      photo?: string;
    };
    terminalSeal?: {
      number: string;
      condition: 'intact' | 'broken' | 'missing';
      photo?: string;
    };
    additionalSeals?: Array<{
      type: string;
      number: string;
      condition: 'intact' | 'broken' | 'missing';
      photo?: string;
    }>;
  };

  @ApiProperty({ description: 'Повреждения' })
  @Column({ type: 'jsonb', nullable: true })
  damages: Array<{
    id: string;
    location: DamageLocation;
    description: string;
    severity: DamageSeverity;
    size?: {
      length: number;
      width: number;
      depth?: number;
      unit: 'mm' | 'cm' | 'm';
    };
    photos: string[];
    preExisting: boolean;
    repairRequired: boolean;
    estimatedCost?: number;
    notes?: string;
  }>;

  @ApiProperty({ description: 'Чистота контейнера' })
  @Column({ type: 'jsonb', nullable: true })
  cleanliness: {
    interior: 'clean' | 'dirty' | 'contaminated';
    exterior: 'clean' | 'dirty' | 'contaminated';
    odor: 'none' | 'mild' | 'strong' | 'offensive';
    residue: boolean;
    residueDescription?: string;
    cleaningRequired: boolean;
    cleaningType?: 'general' | 'washing' | 'steaming' | 'chemical';
  };

  @ApiProperty({ description: 'Функциональные элементы' })
  @Column({ name: 'functional_elements', type: 'jsonb', nullable: true })
  functionalElements: {
    doors: {
      operation: 'normal' | 'stiff' | 'damaged' | 'inoperable';
      lockingMechanism: 'normal' | 'damaged' | 'missing';
      gaskets: 'good' | 'worn' | 'damaged' | 'missing';
    };
    floorBoards?: {
      condition: 'good' | 'worn' | 'damaged' | 'missing';
      moisture: boolean;
      holes: boolean;
    };
    refrigeration?: {
      unit: 'operational' | 'not_tested' | 'defective';
      temperature: number;
      powerCord: 'good' | 'damaged' | 'missing';
      dataLogger: 'present' | 'missing' | 'damaged';
    };
  };

  @ApiProperty({ description: 'Измерения и вес' })
  @Column({ type: 'jsonb', nullable: true })
  measurements: {
    grossWeight?: number;
    tareWeight?: number;
    netWeight?: number;
    weightUnit: 'kg' | 'lbs';
    dimensions?: {
      length: number;
      width: number;
      height: number;
      unit: 'mm' | 'cm' | 'm' | 'ft';
    };
    verified: boolean;
    verificationMethod?: 'scale' | 'estimated' | 'documentation';
  };

  @ApiProperty({ description: 'Фотографии' })
  @Column({ type: 'jsonb' })
  photos: {
    general: {
      front: string;
      rear: string;
      leftSide: string;
      rightSide: string;
      top?: string;
    };
    damages: Array<{
      damageId: string;
      photos: string[];
    }>;
    seals: Array<{
      sealType: string;
      photo: string;
    }>;
    interior?: {
      frontWall: string;
      rearWall: string;
      leftWall: string;
      rightWall: string;
      floor: string;
      ceiling: string;
    };
    markings?: {
      containerNumber: string;
      ownerCode: string;
      sizeType: string;
      tareWeight: string;
      maxGross: string;
    };
  };

  @ApiProperty({ description: 'Примечания инспектора' })
  @Column({ name: 'inspector_notes', type: 'text', nullable: true })
  inspectorNotes: string;

  @ApiProperty({ description: 'Подпись водителя получена' })
  @Column({ name: 'driver_signature_received', default: false })
  driverSignatureReceived: boolean;

  @ApiProperty({ description: 'Подпись водителя (изображение)' })
  @Column({ name: 'driver_signature', type: 'text', nullable: true })
  driverSignature: string;

  @ApiProperty({ description: 'Время подписания водителем' })
  @Column({ name: 'driver_signed_at', type: 'timestamp', nullable: true })
  driverSignedAt: Date;

  @ApiProperty({ description: 'Подпись инспектора получена' })
  @Column({ name: 'inspector_signature_received', default: false })
  inspectorSignatureReceived: boolean;

  @ApiProperty({ description: 'Подпись инспектора (изображение)' })
  @Column({ name: 'inspector_signature', type: 'text', nullable: true })
  inspectorSignature: string;

  @ApiProperty({ description: 'Спорные моменты' })
  @Column({ type: 'jsonb', nullable: true })
  disputes: Array<{
    id: string;
    type: 'damage' | 'cleanliness' | 'seal' | 'other';
    description: string;
    reportedBy: 'driver' | 'inspector';
    evidence: string[];
    status: 'open' | 'resolved' | 'escalated';
    resolution?: string;
    resolvedAt?: Date;
  }>;

  @ApiProperty({ description: 'PDF документ (URL)' })
  @Column({ name: 'pdf_url', nullable: true })
  pdfUrl: string;

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