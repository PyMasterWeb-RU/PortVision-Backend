import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsEnum,
  IsUUID,
  IsOptional,
  IsNumber,
  IsBoolean,
  IsObject,
  Matches,
  Length,
  Min,
  Max,
} from 'class-validator';
import { ContainerStatus, ContainerCondition } from '../entities/container.entity';

export class CreateContainerDto {
  @ApiProperty({
    description: 'Номер контейнера (ISO стандарт)',
    example: 'MSKU9070420',
    pattern: '^[A-Z]{4}[0-9]{6}[0-9]$',
  })
  @IsString()
  @Length(11, 11)
  @Matches(/^[A-Z]{4}[0-9]{6}[0-9]$/, {
    message: 'Container number must follow ISO 6346 standard (4 letters + 7 digits)',
  })
  number: string;

  @ApiProperty({
    description: 'Статус контейнера',
    enum: ContainerStatus,
    default: ContainerStatus.EMPTY,
  })
  @IsEnum(ContainerStatus)
  @IsOptional()
  status?: ContainerStatus = ContainerStatus.EMPTY;

  @ApiProperty({
    description: 'Состояние контейнера',
    enum: ContainerCondition,
    default: ContainerCondition.GOOD,
  })
  @IsEnum(ContainerCondition)
  @IsOptional()
  condition?: ContainerCondition = ContainerCondition.GOOD;

  @ApiProperty({
    description: 'ID типа контейнера',
    format: 'uuid',
  })
  @IsUUID()
  containerTypeId: string;

  @ApiProperty({
    description: 'ID клиента-владельца',
    format: 'uuid',
    required: false,
  })
  @IsUUID()
  @IsOptional()
  clientId?: string;

  @ApiProperty({
    description: 'Текущее местоположение',
    example: 'A-01-02-01',
    required: false,
  })
  @IsString()
  @IsOptional()
  currentLocation?: string;

  @ApiProperty({
    description: 'Вес тары (кг)',
    example: 2200,
    minimum: 0,
    maximum: 50000,
  })
  @IsNumber()
  @Min(0)
  @Max(50000)
  tareWeight: number;

  @ApiProperty({
    description: 'Максимальный вес груза (кг)',
    example: 28280,
    minimum: 0,
    maximum: 100000,
  })
  @IsNumber()
  @Min(0)
  @Max(100000)
  maxGrossWeight: number;

  @ApiProperty({
    description: 'Текущий вес груза (кг)',
    minimum: 0,
    maximum: 100000,
    required: false,
  })
  @IsNumber()
  @Min(0)
  @Max(100000)
  @IsOptional()
  currentGrossWeight?: number;

  @ApiProperty({
    description: 'Дата последнего осмотра',
    type: 'string',
    format: 'date-time',
    required: false,
  })
  @IsOptional()
  lastInspectionDate?: Date;

  @ApiProperty({
    description: 'Дата последнего ремонта',
    type: 'string',
    format: 'date-time',
    required: false,
  })
  @IsOptional()
  lastRepairDate?: Date;

  @ApiProperty({
    description: 'Дата следующего обязательного осмотра',
    type: 'string',
    format: 'date-time',
    required: false,
  })
  @IsOptional()
  nextInspectionDue?: Date;

  @ApiProperty({
    description: 'Сертификат CSC действителен до',
    type: 'string',
    format: 'date-time',
    required: false,
  })
  @IsOptional()
  cscValidUntil?: Date;

  @ApiProperty({
    description: 'Дополнительная информация',
    type: 'object',
    required: false,
  })
  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;

  @ApiProperty({
    description: 'Активен ли контейнер',
    default: true,
    required: false,
  })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean = true;
}