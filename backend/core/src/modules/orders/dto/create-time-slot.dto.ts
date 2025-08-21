import {
  IsEnum,
  IsDateString,
  IsNumber,
  IsString,
  IsOptional,
  Min,
  Max,
  ValidateNested,
  IsArray,
  IsBoolean,
  IsObject,
  Length,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TimeSlotType } from '../entities/time-slot.entity';

class TimeSlotContactInfoDto {
  @ApiPropertyOptional({ description: 'Контактное лицо' })
  @IsOptional()
  @IsString()
  contactPerson?: string;

  @ApiPropertyOptional({ description: 'Телефон' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ description: 'Email' })
  @IsOptional()
  @IsString()
  email?: string;

  @ApiPropertyOptional({ description: 'Номер грузовика' })
  @IsOptional()
  @IsString()
  truckNumber?: string;

  @ApiPropertyOptional({ description: 'Имя водителя' })
  @IsOptional()
  @IsString()
  driverName?: string;

  @ApiPropertyOptional({ description: 'Телефон водителя' })
  @IsOptional()
  @IsString()
  driverPhone?: string;
}

class TimeSlotRequirementsDto {
  @ApiPropertyOptional({ description: 'Типы контейнеров', isArray: true })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  containerTypes?: string[];

  @ApiPropertyOptional({ description: 'Требуется взвешивание' })
  @IsOptional()
  @IsBoolean()
  requiresWeighing?: boolean;

  @ApiPropertyOptional({ description: 'Требуется инспекция' })
  @IsOptional()
  @IsBoolean()
  requiresInspection?: boolean;

  @ApiPropertyOptional({ description: 'Требуется таможенное оформление' })
  @IsOptional()
  @IsBoolean()
  requiresCustoms?: boolean;

  @ApiPropertyOptional({ description: 'Специальное оборудование', isArray: true })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  specialEquipment?: string[];

  @ApiPropertyOptional({ description: 'Опасный груз' })
  @IsOptional()
  @IsBoolean()
  hazardousCargo?: boolean;

  @ApiPropertyOptional({ description: 'Негабаритный груз' })
  @IsOptional()
  @IsBoolean()
  oversized?: boolean;
}

export class CreateTimeSlotDto {
  @ApiProperty({ description: 'Тип тайм-слота', enum: TimeSlotType })
  @IsEnum(TimeSlotType)
  type: TimeSlotType;

  @ApiProperty({ description: 'Время начала слота' })
  @IsDateString()
  startTime: string;

  @ApiProperty({ description: 'Время окончания слота' })
  @IsDateString()
  endTime: string;

  @ApiProperty({ description: 'Продолжительность в минутах' })
  @IsNumber()
  @Min(1)
  @Max(1440) // 24 hours maximum
  durationMinutes: number;

  @ApiProperty({ description: 'Местоположение/ресурс', example: 'Gate A1' })
  @IsString()
  @Length(1, 100)
  location: string;

  @ApiPropertyOptional({ description: 'Максимальное количество контейнеров в слоте', default: 1 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(50)
  maxContainers?: number = 1;

  @ApiPropertyOptional({ description: 'Контактная информация', type: TimeSlotContactInfoDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => TimeSlotContactInfoDto)
  contactInfo?: TimeSlotContactInfoDto;

  @ApiPropertyOptional({ description: 'Требования к слоту', type: TimeSlotRequirementsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => TimeSlotRequirementsDto)
  requirements?: TimeSlotRequirementsDto;

  @ApiPropertyOptional({ description: 'Стоимость слота' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  cost?: number;

  @ApiPropertyOptional({ description: 'Валюта стоимости', example: 'RUB' })
  @IsOptional()
  @IsString()
  @Length(3, 3)
  currency?: string = 'RUB';

  @ApiPropertyOptional({ description: 'Примечания к слоту' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ description: 'Дополнительные метаданные' })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}