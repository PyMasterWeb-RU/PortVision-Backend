import { IsOptional, IsEnum, IsDateString, IsString, IsNumber, Min, Max } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { GatePassStatus, GatePassType, GateDirection } from '../entities/gate-pass.entity';

export class FilterGatePassesDto {
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

  @ApiPropertyOptional({ description: 'Фильтр по статусу', enum: GatePassStatus })
  @IsOptional()
  @IsEnum(GatePassStatus)
  status?: GatePassStatus;

  @ApiPropertyOptional({ description: 'Фильтр по типу', enum: GatePassType })
  @IsOptional()
  @IsEnum(GatePassType)
  type?: GatePassType;

  @ApiPropertyOptional({ description: 'Фильтр по направлению', enum: GateDirection })
  @IsOptional()
  @IsEnum(GateDirection)
  direction?: GateDirection;

  @ApiPropertyOptional({ description: 'Дата начала периода' })
  @IsOptional()
  @IsDateString()
  @Transform(({ value }) => value ? new Date(value) : undefined)
  dateFrom?: Date;

  @ApiPropertyOptional({ description: 'Дата окончания периода' })
  @IsOptional()
  @IsDateString()
  @Transform(({ value }) => value ? new Date(value) : undefined)
  dateTo?: Date;

  @ApiPropertyOptional({ description: 'Номер грузовика' })
  @IsOptional()
  @IsString()
  truckNumber?: string;

  @ApiPropertyOptional({ description: 'Номер контейнера' })
  @IsOptional()
  @IsString()
  containerNumber?: string;

  @ApiPropertyOptional({ description: 'Поиск по тексту' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Поле для сортировки', default: 'createdAt' })
  @IsOptional()
  @IsString()
  sortBy?: string = 'createdAt';

  @ApiPropertyOptional({ description: 'Направление сортировки', enum: ['ASC', 'DESC'], default: 'DESC' })
  @IsOptional()
  @IsEnum(['ASC', 'DESC'])
  sortOrder?: 'ASC' | 'DESC' = 'DESC';
}