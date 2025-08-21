import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsOptional, IsPositive, Max, Min } from 'class-validator';

export class PaginationDto {
  @ApiProperty({
    description: 'Номер страницы',
    minimum: 1,
    default: 1,
    required: false,
  })
  @Type(() => Number)
  @IsOptional()
  @IsPositive()
  page?: number = 1;

  @ApiProperty({
    description: 'Количество записей на странице',
    minimum: 1,
    maximum: 100,
    default: 20,
    required: false,
  })
  @Type(() => Number)
  @IsOptional()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}