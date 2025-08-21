import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

@Entity('consignees', { schema: 'core' })
@Index(['code'], { unique: true })
@Index(['inn'])
export class Consignee {
  @ApiProperty({ description: 'Уникальный идентификатор грузополучателя' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ description: 'Код грузополучателя', example: 'CNS001' })
  @Column({ type: 'varchar', length: 20, unique: true })
  code: string;

  @ApiProperty({ description: 'Наименование компании' })
  @Column({ name: 'company_name' })
  companyName: string;

  @ApiProperty({ description: 'Краткое наименование' })
  @Column({ name: 'short_name', nullable: true })
  shortName: string;

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

  @ApiProperty({ description: 'Адрес доставки по умолчанию' })
  @Column({ name: 'delivery_address', type: 'text', nullable: true })
  deliveryAddress: string;

  @ApiProperty({ description: 'Контактное лицо' })
  @Column({ name: 'contact_person', nullable: true })
  contactPerson: string;

  @ApiProperty({ description: 'Телефон', example: '+7 (495) 123-45-67' })
  @Column({ nullable: true })
  phone: string;

  @ApiProperty({ description: 'Email', example: 'contact@consignee.com' })
  @Column({ nullable: true })
  email: string;

  @ApiProperty({ description: 'Код ОКПО' })
  @Column({ type: 'varchar', length: 10, nullable: true })
  okpo: string;

  @ApiProperty({ description: 'Код ОКВЭД' })
  @Column({ type: 'varchar', length: 8, nullable: true })
  okved: string;

  @ApiProperty({ description: 'Банковские реквизиты' })
  @Column({ name: 'bank_details', type: 'jsonb', nullable: true })
  bankDetails: {
    bankName?: string;
    bik?: string;
    correspondentAccount?: string;
    settlementAccount?: string;
  };

  @ApiProperty({ description: 'Требования к доставке' })
  @Column({ name: 'delivery_requirements', type: 'text', nullable: true })
  deliveryRequirements: string;

  @ApiProperty({ description: 'Рабочие часы' })
  @Column({ name: 'working_hours', type: 'jsonb', nullable: true })
  workingHours: {
    monday?: string;
    tuesday?: string;
    wednesday?: string;
    thursday?: string;
    friday?: string;
    saturday?: string;
    sunday?: string;
  };

  @ApiProperty({ description: 'Дополнительная информация' })
  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @ApiProperty({ description: 'Активен ли грузополучатель' })
  @Column({ default: true })
  isActive: boolean;

  @ApiProperty({ description: 'Дата создания' })
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ApiProperty({ description: 'Дата обновления' })
  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}