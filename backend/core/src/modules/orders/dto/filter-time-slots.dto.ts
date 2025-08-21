import {
  IsOptional,
  IsEnum,
  IsString,
  IsDateString,
  IsNumber,
  Min,
  Max,
  IsArray,
  IsBoolean,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { TimeSlotType, TimeSlotStatus } from '../entities/time-slot.entity';

export class FilterTimeSlotsDto {
  @ApiPropertyOptional({ description: 'Номер страницы', minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Количество записей на странице', minimum: 1, maximum: 100, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({ description: 'Поле для сортировки', example: 'startTime' })
  @IsOptional()
  @IsString()
  sortBy?: string = 'startTime';

  @ApiPropertyOptional({ description: 'Порядок сортировки', enum: ['ASC', 'DESC'], default: 'ASC' })
  @IsOptional()
  @IsEnum(['ASC', 'DESC'])
  sortOrder?: 'ASC' | 'DESC' = 'ASC';

  @ApiPropertyOptional({ description: 'Тип тайм-слота', enum: TimeSlotType, isArray: true })
  @IsOptional()
  @IsArray()
  @IsEnum(TimeSlotType, { each: true })
  @Transform(({ value }) => Array.isArray(value) ? value : [value])
  type?: TimeSlotType[];

  @ApiPropertyOptional({ description: 'Статус тайм-слота', enum: TimeSlotStatus, isArray: true })
  @IsOptional()
  @IsArray()
  @IsEnum(TimeSlotStatus, { each: true })
  @Transform(({ value }) => Array.isArray(value) ? value : [value])
  status?: TimeSlotStatus[];

  @ApiPropertyOptional({ description: 'Время начала от (включительно)' })
  @IsOptional()
  @IsDateString()
  startTimeFrom?: string;

  @ApiPropertyOptional({ description: 'Время начала до (включительно)' })
  @IsOptional()
  @IsDateString()
  startTimeTo?: string;

  @ApiPropertyOptional({ description: 'Время окончания от' })
  @IsOptional()
  @IsDateString()
  endTimeFrom?: string;

  @ApiPropertyOptional({ description: 'Время окончания до' })
  @IsOptional()
  @IsDateString()
  endTimeTo?: string;

  @ApiPropertyOptional({ description: 'Местоположение/ресурс', isArray: true })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }) => Array.isArray(value) ? value : [value])
  location?: string[];

  @ApiPropertyOptional({ description: 'ID заявки' })
  @IsOptional()
  @IsString()
  orderId?: string;

  @ApiPropertyOptional({ description: 'ID клиента' })
  @IsOptional()
  @IsString()
  clientId?: string;

  @ApiPropertyOptional({ description: 'Минимальное количество свободных мест' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minAvailableSlots?: number;

  @ApiPropertyOptional({ description: 'Минимальная продолжительность (в минутах)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  minDurationMinutes?: number;

  @ApiPropertyOptional({ description: 'Максимальная продолжительность (в минутах)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  maxDurationMinutes?: number;

  @ApiPropertyOptional({ description: 'Минимальная стоимость' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minCost?: number;

  @ApiPropertyOptional({ description: 'Максимальная стоимость' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxCost?: number;

  @ApiPropertyOptional({ description: 'Валюта для фильтрации по стоимости', example: 'RUB' })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional({ description: 'ID пользователя, зарезервировавшего слот' })
  @IsOptional()
  @IsString()
  reservedBy?: string;

  @ApiPropertyOptional({ description: 'Время резервирования от' })
  @IsOptional()
  @IsDateString()
  reservedAtFrom?: string;

  @ApiPropertyOptional({ description: 'Время резервирования до' })
  @IsOptional()
  @IsDateString()
  reservedAtTo?: string;

  @ApiPropertyOptional({ description: 'ID пользователя, подтвердившего слот' })
  @IsOptional()
  @IsString()
  confirmedBy?: string;

  @ApiPropertyOptional({ description: 'Только активные слоты' })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isActive?: boolean = true;

  @ApiPropertyOptional({ description: 'Только доступные слоты' })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  availableOnly?: boolean;

  @ApiPropertyOptional({ description: 'Требуется взвешивание' })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  requiresWeighing?: boolean;

  @ApiPropertyOptional({ description: 'Требуется инспекция' })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  requiresInspection?: boolean;

  @ApiPropertyOptional({ description: 'Требуется таможенное оформление' })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  requiresCustoms?: boolean;

  @ApiPropertyOptional({ description: 'Опасный груз' })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  hazardousCargo?: boolean;

  @ApiPropertyOptional({ description: 'Негабаритный груз' })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  oversized?: boolean;

  @ApiPropertyOptional({ description: 'Типы контейнеров', isArray: true })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }) => Array.isArray(value) ? value : [value])
  containerTypes?: string[];

  @ApiPropertyOptional({ description: 'Включать связанные сущности (order)' })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  includeRelations?: boolean = false;
}