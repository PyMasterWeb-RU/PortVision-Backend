import { PartialType } from '@nestjs/swagger';
import {
  IsEnum,
  IsOptional,
  IsDateString,
  IsString,
  IsNumber,
  Min,
  Length,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { OrderStatus } from '../entities/order.entity';
import { CreateOrderDto } from './create-order.dto';

export class UpdateOrderDto extends PartialType(CreateOrderDto) {
  @ApiPropertyOptional({ description: 'Статус заявки', enum: OrderStatus })
  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;

  @ApiPropertyOptional({ description: 'Фактическая дата начала' })
  @IsOptional()
  @IsDateString()
  actualStartDate?: string;

  @ApiPropertyOptional({ description: 'Фактическая дата завершения' })
  @IsOptional()
  @IsDateString()
  actualEndDate?: string;

  @ApiPropertyOptional({ description: 'Фактическая стоимость' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  actualCost?: number;

  @ApiPropertyOptional({ description: 'ID пользователя, назначенного ответственным' })
  @IsOptional()
  @IsString()
  assignedTo?: string;

  @ApiPropertyOptional({ description: 'Активна ли заявка' })
  @IsOptional()
  isActive?: boolean;
}