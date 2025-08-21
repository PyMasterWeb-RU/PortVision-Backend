import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { Container } from './container.entity';

export enum ClientType {
  SHIPPING_LINE = 'shipping_line',
  FREIGHT_FORWARDER = 'freight_forwarder',
  CONSIGNEE = 'consignee',
  CONSIGNOR = 'consignor',
  CUSTOMS_BROKER = 'customs_broker',
  TRANSPORT_COMPANY = 'transport_company',
  OTHER = 'other',
}

export enum ClientStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SUSPENDED = 'suspended',
  BLOCKED = 'blocked',
}

@Entity('clients', { schema: 'core' })
@Index(['code'], { unique: true })
@Index(['email'], { unique: true })
@Index(['inn'])
@Index(['type'])
@Index(['status'])
export class Client {
  @ApiProperty({ description: 'Уникальный идентификатор клиента' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ description: 'Код клиента', example: 'CL001' })
  @Column({ type: 'varchar', length: 20, unique: true })
  code: string;

  @ApiProperty({ description: 'Наименование компании' })
  @Column({ name: 'company_name' })
  companyName: string;

  @ApiProperty({ description: 'Тип клиента', enum: ClientType })
  @Column({
    type: 'enum',
    enum: ClientType,
    default: ClientType.OTHER,
  })
  type: ClientType;

  @ApiProperty({ description: 'Статус клиента', enum: ClientStatus })
  @Column({
    type: 'enum',
    enum: ClientStatus,
    default: ClientStatus.ACTIVE,
  })
  status: ClientStatus;

  @ApiProperty({ description: 'ИНН', example: '7707083893' })
  @Column({ type: 'varchar', length: 12, nullable: true })
  inn: string;

  @ApiProperty({ description: 'КПП', example: '770701001' })
  @Column({ type: 'varchar', length: 9, nullable: true })
  kpp: string;

  @ApiProperty({ description: 'ОГРН', example: '1027700132195' })
  @Column({ type: 'varchar', length: 15, nullable: true })
  ogrn: string;

  @ApiProperty({ description: 'Юридический адрес' })
  @Column({ name: 'legal_address', type: 'text', nullable: true })
  legalAddress: string;

  @ApiProperty({ description: 'Фактический адрес' })
  @Column({ name: 'actual_address', type: 'text', nullable: true })
  actualAddress: string;

  @ApiProperty({ description: 'Контактное лицо' })
  @Column({ name: 'contact_person', nullable: true })
  contactPerson: string;

  @ApiProperty({ description: 'Телефон', example: '+7 (495) 123-45-67' })
  @Column({ nullable: true })
  phone: string;

  @ApiProperty({ description: 'Email', example: 'contact@company.com' })
  @Column({ unique: true, nullable: true })
  email: string;

  @ApiProperty({ description: 'Сайт компании' })
  @Column({ nullable: true })
  website: string;

  @ApiProperty({ description: 'Банковские реквизиты' })
  @Column({ name: 'bank_details', type: 'jsonb', nullable: true })
  bankDetails: {
    bankName?: string;
    bik?: string;
    correspondentAccount?: string;
    settlementAccount?: string;
  };

  @ApiProperty({ description: 'Рейтинг клиента (1-5)' })
  @Column({ type: 'smallint', default: 3 })
  rating: number;

  @ApiProperty({ description: 'Кредитный лимит' })
  @Column({ name: 'credit_limit', type: 'decimal', precision: 12, scale: 2, default: 0 })
  creditLimit: number;

  @ApiProperty({ description: 'Валюта по умолчанию' })
  @Column({ name: 'default_currency', length: 3, default: 'RUB' })
  defaultCurrency: string;

  @ApiProperty({ description: 'Условия оплаты (дни)' })
  @Column({ name: 'payment_terms', type: 'smallint', default: 30 })
  paymentTerms: number;

  @ApiProperty({ description: 'Дополнительная информация' })
  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @ApiProperty({ description: 'Активен ли клиент' })
  @Column({ default: true })
  isActive: boolean;

  @ApiProperty({ description: 'Контейнеры клиента', type: () => [Container] })
  @OneToMany(() => Container, (container) => container.client)
  containers: Container[];

  @ApiProperty({ description: 'Дата создания' })
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ApiProperty({ description: 'Дата обновления' })
  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}