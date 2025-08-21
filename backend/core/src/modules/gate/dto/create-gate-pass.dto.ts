import {
  IsString,
  IsEnum,
  IsOptional,
  IsDateString,
  IsBoolean,
  IsArray,
  ValidateNested,
  Length,
  IsPhoneNumber,
  IsEmail,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { GatePassType, GateDirection } from '../entities/gate-pass.entity';

class TimeRestrictionsDto {
  @ApiPropertyOptional({ 
    description: 'Разрешенные часы работы',
    example: [{ from: '08:00', to: '18:00' }]
  })
  @IsOptional()
  @IsArray()
  allowedHours?: Array<{ from: string; to: string }>;

  @ApiPropertyOptional({ 
    description: 'Исключенные дни недели',
    example: ['saturday', 'sunday']
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  excludedDays?: string[];

  @ApiPropertyOptional({ 
    description: 'Максимальное время пребывания в минутах',
    example: 480
  })
  @IsOptional()
  maxStayDuration?: number;
}

class ZoneRestrictionsDto {
  @ApiPropertyOptional({ 
    description: 'Разрешенные зоны',
    example: ['zone-a', 'zone-b']
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allowedZones?: string[];

  @ApiPropertyOptional({ 
    description: 'Запрещенные зоны',
    example: ['restricted-area']
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  restrictedZones?: string[];

  @ApiPropertyOptional({ 
    description: 'Зоны, требующие дополнительного разрешения',
    example: ['customs-zone']
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  requiresPermissionFor?: string[];
}

export class CreateGatePassDto {
  @ApiProperty({ description: 'Тип пропуска', enum: GatePassType })
  @IsEnum(GatePassType)
  type: GatePassType;

  @ApiPropertyOptional({ description: 'Направление движения', enum: GateDirection })
  @IsOptional()
  @IsEnum(GateDirection)
  direction?: GateDirection;

  @ApiPropertyOptional({ description: 'ID заявки' })
  @IsOptional()
  @IsString()
  orderId?: string;

  @ApiPropertyOptional({ description: 'ID контейнера' })
  @IsOptional()
  @IsString()
  containerId?: string;

  @ApiPropertyOptional({ description: 'Номер контейнера' })
  @IsOptional()
  @IsString()
  @Length(11, 11)
  containerNumber?: string;

  @ApiProperty({ description: 'Номер грузовика' })
  @IsString()
  truckNumber: string;

  @ApiPropertyOptional({ description: 'Номер прицепа' })
  @IsOptional()
  @IsString()
  trailerNumber?: string;

  @ApiProperty({ description: 'Имя водителя' })
  @IsString()
  driverName: string;

  @ApiPropertyOptional({ description: 'Номер водительского удостоверения' })
  @IsOptional()
  @IsString()
  driverLicense?: string;

  @ApiPropertyOptional({ description: 'Телефон водителя' })
  @IsOptional()
  @IsPhoneNumber('RU')
  driverPhone?: string;

  @ApiPropertyOptional({ description: 'Транспортная компания' })
  @IsOptional()
  @IsString()
  transportCompany?: string;

  @ApiPropertyOptional({ description: 'Контактное лицо компании' })
  @IsOptional()
  @IsString()
  companyContact?: string;

  @ApiPropertyOptional({ description: 'Телефон компании' })
  @IsOptional()
  @IsPhoneNumber('RU')
  companyPhone?: string;

  @ApiProperty({ description: 'Дата начала действия пропуска' })
  @IsDateString()
  validFrom: string;

  @ApiProperty({ description: 'Дата окончания действия пропуска' })
  @IsDateString()
  validUntil: string;

  @ApiPropertyOptional({ description: 'Цель визита' })
  @IsOptional()
  @IsString()
  purpose?: string;

  @ApiPropertyOptional({ description: 'Особые инструкции' })
  @IsOptional()
  @IsString()
  specialInstructions?: string;

  @ApiPropertyOptional({ description: 'Требуется сопровождение' })
  @IsOptional()
  @IsBoolean()
  requiresEscort?: boolean;

  @ApiPropertyOptional({ 
    description: 'Ограничения по времени',
    type: TimeRestrictionsDto
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => TimeRestrictionsDto)
  timeRestrictions?: TimeRestrictionsDto;

  @ApiPropertyOptional({ 
    description: 'Ограничения по зонам',
    type: ZoneRestrictionsDto
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => ZoneRestrictionsDto)
  zoneRestrictions?: ZoneRestrictionsDto;
}