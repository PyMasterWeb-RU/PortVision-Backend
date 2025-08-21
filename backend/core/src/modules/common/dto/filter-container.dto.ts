import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsEnum, IsUUID, IsString } from 'class-validator';
import { ContainerStatus, ContainerCondition } from '../entities/container.entity';

export class FilterContainerDto {
  @ApiProperty({
    description: 'Фильтр по статусу контейнера',
    enum: ContainerStatus,
    required: false,
  })
  @IsEnum(ContainerStatus)
  @IsOptional()
  status?: ContainerStatus;

  @ApiProperty({
    description: 'Фильтр по состоянию контейнера',
    enum: ContainerCondition,
    required: false,
  })
  @IsEnum(ContainerCondition)
  @IsOptional()
  condition?: ContainerCondition;

  @ApiProperty({
    description: 'Фильтр по ID клиента',
    format: 'uuid',
    required: false,
  })
  @IsUUID()
  @IsOptional()
  clientId?: string;

  @ApiProperty({
    description: 'Фильтр по ID типа контейнера',
    format: 'uuid',
    required: false,
  })
  @IsUUID()
  @IsOptional()
  containerTypeId?: string;

  @ApiProperty({
    description: 'Фильтр по текущему местоположению (частичное совпадение)',
    example: 'A-01',
    required: false,
  })
  @IsString()
  @IsOptional()
  currentLocation?: string;

  @ApiProperty({
    description: 'Фильтр по номеру контейнера (частичное совпадение)',
    example: 'MSKU',
    required: false,
  })
  @IsString()
  @IsOptional()
  number?: string;
}