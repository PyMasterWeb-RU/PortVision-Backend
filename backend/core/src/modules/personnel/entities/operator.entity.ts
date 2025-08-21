import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  OneToMany,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

export enum OperatorStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  ON_LEAVE = 'on_leave',
  SUSPENDED = 'suspended',
  TERMINATED = 'terminated',
}

export enum EmploymentType {
  FULL_TIME = 'full_time',
  PART_TIME = 'part_time',
  CONTRACT = 'contract',
  TEMPORARY = 'temporary',
  INTERN = 'intern',
}

export enum ShiftPattern {
  DAY_SHIFT = 'day_shift',
  NIGHT_SHIFT = 'night_shift',
  ROTATING = 'rotating',
  FLEXIBLE = 'flexible',
  ON_CALL = 'on_call',
}

@Entity('operators', { schema: 'personnel' })
@Index(['operatorNumber'], { unique: true })
@Index(['email'], { unique: true })
@Index(['status'])
@Index(['departmentId'])
@Index(['positionId'])
@Index(['supervisorId'])
@Index(['employmentType'])
@Index(['shiftPattern'])
export class Operator {
  @ApiProperty({ description: 'Уникальный идентификатор оператора' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ description: 'Табельный номер оператора', example: 'OP-2024-001' })
  @Column({ name: 'operator_number', type: 'varchar', length: 50, unique: true })
  operatorNumber: string;

  @ApiProperty({ description: 'Имя' })
  @Column({ name: 'first_name' })
  firstName: string;

  @ApiProperty({ description: 'Отчество' })
  @Column({ name: 'middle_name', nullable: true })
  middleName: string;

  @ApiProperty({ description: 'Фамилия' })
  @Column({ name: 'last_name' })
  lastName: string;

  @ApiProperty({ description: 'Полное имя' })
  @Column({ name: 'full_name' })
  fullName: string;

  @ApiProperty({ description: 'Email' })
  @Column({ unique: true })
  email: string;

  @ApiProperty({ description: 'Номер телефона' })
  @Column({ name: 'phone_number', nullable: true })
  phoneNumber: string;

  @ApiProperty({ description: 'Дата рождения' })
  @Column({ name: 'birth_date', type: 'date', nullable: true })
  birthDate: Date;

  @ApiProperty({ description: 'Статус оператора', enum: OperatorStatus })
  @Column({
    type: 'enum',
    enum: OperatorStatus,
    default: OperatorStatus.ACTIVE,
  })
  status: OperatorStatus;

  @ApiProperty({ description: 'Тип трудоустройства', enum: EmploymentType })
  @Column({
    name: 'employment_type',
    type: 'enum',
    enum: EmploymentType,
    default: EmploymentType.FULL_TIME,
  })
  employmentType: EmploymentType;

  @ApiProperty({ description: 'Должность' })
  @Column()
  position: string;

  @ApiProperty({ description: 'ID должности в системе' })
  @Column({ name: 'position_id', nullable: true })
  positionId: string;

  @ApiProperty({ description: 'Подразделение' })
  @Column()
  department: string;

  @ApiProperty({ description: 'ID подразделения' })
  @Column({ name: 'department_id' })
  departmentId: string;

  @ApiProperty({ description: 'ID непосредственного руководителя' })
  @Column({ name: 'supervisor_id', nullable: true })
  supervisorId: string;

  @ApiProperty({ description: 'Имя руководителя' })
  @Column({ name: 'supervisor_name', nullable: true })
  supervisorName: string;

  @ApiProperty({ description: 'Дата приема на работу' })
  @Column({ name: 'hire_date', type: 'date' })
  hireDate: Date;

  @ApiProperty({ description: 'Дата увольнения' })
  @Column({ name: 'termination_date', type: 'date', nullable: true })
  terminationDate: Date;

  @ApiProperty({ description: 'Паттерн смены', enum: ShiftPattern })
  @Column({
    name: 'shift_pattern',
    type: 'enum',
    enum: ShiftPattern,
    default: ShiftPattern.DAY_SHIFT,
  })
  shiftPattern: ShiftPattern;

  @ApiProperty({ description: 'Персональная информация' })
  @Column({ name: 'personal_info', type: 'jsonb', nullable: true })
  personalInfo: {
    nationality?: string;
    idNumber?: string;
    passportNumber?: string;
    address?: {
      street: string;
      city: string;
      region: string;
      postalCode?: string;
      country: string;
    };
    emergencyContact?: {
      name: string;
      relationship: string;
      phone: string;
      email?: string;
    };
    medicalInfo?: {
      bloodType?: string;
      allergies?: string[];
      medications?: string[];
      medicalClearance?: {
        issuedDate: Date;
        expiresDate: Date;
        issuedBy: string;
        restrictions?: string[];
      };
    };
  };

  @ApiProperty({ description: 'Навыки и квалификации' })
  @Column({ name: 'skills_qualifications', type: 'jsonb' })
  skillsQualifications: {
    primarySkills: string[];
    secondarySkills: string[];
    equipmentQualifications: Array<{
      equipmentType: string;
      proficiencyLevel: 'beginner' | 'intermediate' | 'advanced' | 'expert';
      certifiedDate: Date;
      expiresDate?: Date;
      instructorId?: string;
    }>;
    certifications: Array<{
      certificationType: string;
      certificateNumber: string;
      issuedBy: string;
      issuedDate: Date;
      expiresDate: Date;
      isActive: boolean;
      documentUrl?: string;
    }>;
    trainingHistory: Array<{
      trainingType: string;
      trainingName: string;
      completedDate: Date;
      duration: number; // hours
      score?: number;
      instructorId?: string;
      certificateIssued: boolean;
    }>;
    languages: Array<{
      language: string;
      proficiency: 'basic' | 'intermediate' | 'advanced' | 'native';
    }>;
  };

  @ApiProperty({ description: 'График работы' })
  @Column({ name: 'work_schedule', type: 'jsonb' })
  workSchedule: {
    standardHours: {
      monday?: { start: string; end: string; break?: { start: string; end: string } };
      tuesday?: { start: string; end: string; break?: { start: string; end: string } };
      wednesday?: { start: string; end: string; break?: { start: string; end: string } };
      thursday?: { start: string; end: string; break?: { start: string; end: string } };
      friday?: { start: string; end: string; break?: { start: string; end: string } };
      saturday?: { start: string; end: string; break?: { start: string; end: string } };
      sunday?: { start: string; end: string; break?: { start: string; end: string } };
    };
    workingDaysPerWeek: number;
    hoursPerWeek: number;
    maxOvertimeHours: number;
    availableForOvertime: boolean;
    preferredShifts: ShiftPattern[];
    unavailableDates: Array<{
      startDate: Date;
      endDate: Date;
      reason: string;
      approved: boolean;
    }>;
  };

  @ApiProperty({ description: 'Производительность и метрики' })
  @Column({ name: 'performance_metrics', type: 'jsonb', nullable: true })
  performanceMetrics: {
    currentPeriod: {
      startDate: Date;
      endDate: Date;
      hoursWorked: number;
      tasksCompleted: number;
      qualityScore: number; // 1-10
      productivityScore: number; // 1-10
      safetyScore: number; // 1-10
      customerSatisfaction?: number; // 1-10
    };
    yearToDate: {
      totalHours: number;
      totalTasks: number;
      avgQualityScore: number;
      avgProductivityScore: number;
      safetyIncidents: number;
      trainingHours: number;
      promotions: number;
    };
    competencies: Record<string, {
      level: number; // 1-5
      lastAssessed: Date;
      assessedBy: string;
      notes?: string;
    }>;
    goalTracking: Array<{
      goalId: string;
      goalType: string;
      description: string;
      targetDate: Date;
      progress: number; // percentage
      status: 'not_started' | 'in_progress' | 'completed' | 'cancelled';
    }>;
  };

  @ApiProperty({ description: 'Данные безопасности' })
  @Column({ name: 'safety_data', type: 'jsonb' })
  safetyData: {
    safetyTraining: Array<{
      trainingType: string;
      completedDate: Date;
      expiresDate: Date;
      instructorId: string;
      score: number;
    }>;
    safetyIncidents: Array<{
      incidentDate: Date;
      incidentType: string;
      severity: 'minor' | 'moderate' | 'serious' | 'critical';
      description: string;
      equipmentInvolved?: string;
      injuryReported: boolean;
      actionsTaken: string[];
      followUpRequired: boolean;
    }>;
    ppeRequirements: Array<{
      equipment: string;
      required: boolean;
      provided: boolean;
      lastInspection?: Date;
      nextInspection?: Date;
    }>;
    securityClearance: {
      level: string;
      issuedDate: Date;
      expiresDate: Date;
      issuedBy: string;
      accessAreas: string[];
      restrictions?: string[];
    };
  };

  @ApiProperty({ description: 'Финансовая информация' })
  @Column({ name: 'compensation_info', type: 'jsonb', nullable: true })
  compensationInfo: {
    baseSalary: {
      amount: number;
      currency: string;
      payPeriod: 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly';
    };
    overtime: {
      rate: number;
      currency: string;
      eligibility: boolean;
    };
    benefits: Array<{
      benefitType: string;
      description: string;
      value?: number;
      startDate: Date;
      endDate?: Date;
    }>;
    deductions: Array<{
      deductionType: string;
      amount: number;
      percentage?: number;
      mandatory: boolean;
    }>;
    payrollInfo: {
      bankAccount?: string;
      taxId?: string;
      insuranceNumber?: string;
    };
  };

  @ApiProperty({ description: 'Текущий статус и местоположение' })
  @Column({ name: 'current_status', type: 'jsonb', nullable: true })
  currentStatus: {
    currentShift?: {
      shiftId: string;
      startTime: Date;
      endTime: Date;
      status: 'scheduled' | 'started' | 'break' | 'ended';
    };
    currentLocation?: {
      latitude: number;
      longitude: number;
      accuracy?: number;
      timestamp: Date;
      zone?: string;
    };
    currentActivity?: string;
    currentEquipment?: {
      equipmentId: string;
      equipmentNumber: string;
      assignedAt: Date;
    };
    availability: {
      isAvailable: boolean;
      reason?: string;
      availableFrom?: Date;
    };
    workload: {
      activeTasks: number;
      plannedTasks: number;
      utilizationPercentage: number;
    };
  };

  @ApiProperty({ description: 'Настройки уведомлений' })
  @Column({ name: 'notification_preferences', type: 'jsonb', nullable: true })
  notificationPreferences: {
    email: {
      enabled: boolean;
      shiftReminders: boolean;
      taskAssignments: boolean;
      emergencyAlerts: boolean;
      scheduleChanges: boolean;
    };
    sms: {
      enabled: boolean;
      emergencyOnly: boolean;
      shiftReminders: boolean;
    };
    push: {
      enabled: boolean;
      taskUpdates: boolean;
      locationBased: boolean;
      workflowNotifications: boolean;
    };
    preferredLanguage: string;
    timeZone: string;
  };

  @ApiProperty({ description: 'История карьеры' })
  @Column({ name: 'career_history', type: 'jsonb', nullable: true })
  careerHistory: Array<{
    positionId: string;
    positionName: string;
    departmentId: string;
    departmentName: string;
    startDate: Date;
    endDate?: Date;
    salaryRange?: {
      min: number;
      max: number;
      currency: string;
    };
    achievements?: string[];
    reasonForChange?: string;
  }>;

  @ApiProperty({ description: 'Дополнительные метаданные' })
  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @ApiProperty({ description: 'Дата создания' })
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ApiProperty({ description: 'Дата обновления' })
  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Вычисляемые поля
  get age(): number {
    if (!this.birthDate) return null;
    const today = new Date();
    let age = today.getFullYear() - this.birthDate.getFullYear();
    const monthDiff = today.getMonth() - this.birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < this.birthDate.getDate())) {
      age--;
    }
    return age;
  }

  get yearsOfService(): number {
    if (!this.hireDate) return 0;
    const endDate = this.terminationDate || new Date();
    const years = endDate.getFullYear() - this.hireDate.getFullYear();
    const monthDiff = endDate.getMonth() - this.hireDate.getMonth();
    return monthDiff < 0 || (monthDiff === 0 && endDate.getDate() < this.hireDate.getDate()) 
      ? years - 1 
      : years;
  }

  get displayName(): string {
    return this.fullName || `${this.firstName} ${this.lastName}`.trim();
  }

  get isActive(): boolean {
    return this.status === OperatorStatus.ACTIVE;
  }

  get currentUtilization(): number {
    return this.currentStatus?.workload?.utilizationPercentage || 0;
  }
}