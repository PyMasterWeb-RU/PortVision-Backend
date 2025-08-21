import { PartialType } from '@nestjs/swagger';
import {
  IsEnum,
  IsOptional,
  IsDateString,
  IsString,
  IsNumber,
  Min,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { TimeSlotStatus } from '../entities/time-slot.entity';
import { CreateTimeSlotDto } from './create-time-slot.dto';

export class UpdateTimeSlotDto extends PartialType(CreateTimeSlotDto) {
  @ApiPropertyOptional({ description: 'Статус тайм-слота', enum: TimeSlotStatus })
  @IsOptional()
  @IsEnum(TimeSlotStatus)
  status?: TimeSlotStatus;

  @ApiPropertyOptional({ description: 'Зарезервированное количество контейнеров' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  reservedContainers?: number;

  @ApiPropertyOptional({ description: 'ID заявки (если слот зарезервирован)' })
  @IsOptional()
  @IsString()
  orderId?: string;

  @ApiPropertyOptional({ description: 'ID клиента (если слот зарезервирован)' })
  @IsOptional()
  @IsString()
  clientId?: string;

  @ApiPropertyOptional({ description: 'Время резервирования' })
  @IsOptional()
  @IsDateString()
  reservedAt?: string;

  @ApiPropertyOptional({ description: 'ID пользователя, зарезервировавшего слот' })
  @IsOptional()
  @IsString()
  reservedBy?: string;

  @ApiPropertyOptional({ description: 'Время подтверждения' })
  @IsOptional()
  @IsDateString()
  confirmedAt?: string;

  @ApiPropertyOptional({ description: 'ID пользователя, подтвердившего слот' })
  @IsOptional()
  @IsString()
  confirmedBy?: string;

  @ApiPropertyOptional({ description: 'Фактическое время начала' })
  @IsOptional()
  @IsDateString()
  actualStartTime?: string;

  @ApiPropertyOptional({ description: 'Фактическое время окончания' })
  @IsOptional()
  @IsDateString()
  actualEndTime?: string;

  @ApiPropertyOptional({ description: 'Причина отмены (если слот отменен)' })
  @IsOptional()
  @IsString()
  cancellationReason?: string;

  @ApiPropertyOptional({ description: 'Время отмены' })
  @IsOptional()
  @IsDateString()
  cancelledAt?: string;

  @ApiPropertyOptional({ description: 'Активен ли слот' })
  @IsOptional()
  isActive?: boolean;
}