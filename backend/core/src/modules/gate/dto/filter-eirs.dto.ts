import { IsOptional, IsEnum, IsDateString, IsString, IsNumber, Min, Max } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { EirStatus, EirType } from '../entities/eir.entity';

export class FilterEirsDto {
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

  @ApiPropertyOptional({ description: 'Фильтр по статусу', enum: EirStatus })
  @IsOptional()
  @IsEnum(EirStatus)
  status?: EirStatus;

  @ApiPropertyOptional({ description: 'Фильтр по типу', enum: EirType })
  @IsOptional()
  @IsEnum(EirType)
  type?: EirType;

  @ApiPropertyOptional({ description: 'ID контейнера' })
  @IsOptional()
  @IsString()
  containerId?: string;

  @ApiPropertyOptional({ description: 'ID пропуска' })
  @IsOptional()
  @IsString()
  gatePassId?: string;

  @ApiPropertyOptional({ description: 'ID инспектора' })
  @IsOptional()
  @IsString()
  inspectorId?: string;

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