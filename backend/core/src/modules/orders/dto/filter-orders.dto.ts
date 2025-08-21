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
import { OrderType, OrderStatus, OrderPriority } from '../entities/order.entity';

export class FilterOrdersDto {
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

  @ApiPropertyOptional({ description: 'Поле для сортировки', example: 'createdAt' })
  @IsOptional()
  @IsString()
  sortBy?: string = 'createdAt';

  @ApiPropertyOptional({ description: 'Порядок сортировки', enum: ['ASC', 'DESC'], default: 'DESC' })
  @IsOptional()
  @IsEnum(['ASC', 'DESC'])
  sortOrder?: 'ASC' | 'DESC' = 'DESC';

  @ApiPropertyOptional({ description: 'Поиск по номеру заявки или номеру контейнера' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Тип заявки', enum: OrderType, isArray: true })
  @IsOptional()
  @IsArray()
  @IsEnum(OrderType, { each: true })
  @Transform(({ value }) => Array.isArray(value) ? value : [value])
  type?: OrderType[];

  @ApiPropertyOptional({ description: 'Статус заявки', enum: OrderStatus, isArray: true })
  @IsOptional()
  @IsArray()
  @IsEnum(OrderStatus, { each: true })
  @Transform(({ value }) => Array.isArray(value) ? value : [value])
  status?: OrderStatus[];

  @ApiPropertyOptional({ description: 'Приоритет заявки', enum: OrderPriority, isArray: true })
  @IsOptional()
  @IsArray()
  @IsEnum(OrderPriority, { each: true })
  @Transform(({ value }) => Array.isArray(value) ? value : [value])
  priority?: OrderPriority[];

  @ApiPropertyOptional({ description: 'ID клиента', isArray: true })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }) => Array.isArray(value) ? value : [value])
  clientId?: string[];

  @ApiPropertyOptional({ description: 'ID грузополучателя', isArray: true })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }) => Array.isArray(value) ? value : [value])
  consigneeId?: string[];

  @ApiPropertyOptional({ description: 'Название судна' })
  @IsOptional()
  @IsString()
  vesselName?: string;

  @ApiPropertyOptional({ description: 'Рейс судна' })
  @IsOptional()
  @IsString()
  vesselVoyage?: string;

  @ApiPropertyOptional({ description: 'Дата запроса от (включительно)' })
  @IsOptional()
  @IsDateString()
  requestedDateFrom?: string;

  @ApiPropertyOptional({ description: 'Дата запроса до (включительно)' })
  @IsOptional()
  @IsDateString()
  requestedDateTo?: string;

  @ApiPropertyOptional({ description: 'Планируемая дата начала от' })
  @IsOptional()
  @IsDateString()
  plannedStartDateFrom?: string;

  @ApiPropertyOptional({ description: 'Планируемая дата начала до' })
  @IsOptional()
  @IsDateString()
  plannedStartDateTo?: string;

  @ApiPropertyOptional({ description: 'Дата создания от' })
  @IsOptional()
  @IsDateString()
  createdAtFrom?: string;

  @ApiPropertyOptional({ description: 'Дата создания до' })
  @IsOptional()
  @IsDateString()
  createdAtTo?: string;

  @ApiPropertyOptional({ description: 'ID назначенного ответственного' })
  @IsOptional()
  @IsString()
  assignedTo?: string;

  @ApiPropertyOptional({ description: 'ID создателя заявки' })
  @IsOptional()
  @IsString()
  createdBy?: string;

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

  @ApiPropertyOptional({ description: 'Активные заявки' })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Заявки с опасным грузом' })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  hasHazardousCargo?: boolean;

  @ApiPropertyOptional({ description: 'Заявки с негабаритным грузом' })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  hasOversizedCargo?: boolean;

  @ApiPropertyOptional({ description: 'Заявки, требующие таможенной инспекции' })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  requiresCustomsInspection?: boolean;

  @ApiPropertyOptional({ description: 'Включать связанные сущности (client, consignee, items)' })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  includeRelations?: boolean = false;
}