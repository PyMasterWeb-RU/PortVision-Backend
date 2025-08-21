import {
  IsString,
  IsNumber,
  IsOptional,
  Min,
  Max,
  ValidateNested,
  IsObject,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class ReservationContactInfoDto {
  @ApiProperty({ description: 'Контактное лицо' })
  @IsString()
  contactPerson: string;

  @ApiProperty({ description: 'Телефон' })
  @IsString()
  phone: string;

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

export class ReserveTimeSlotDto {
  @ApiProperty({ description: 'ID заявки для резервирования слота' })
  @IsString()
  orderId: string;

  @ApiProperty({ description: 'ID клиента' })
  @IsString()
  clientId: string;

  @ApiProperty({ description: 'Количество контейнеров для резервирования' })
  @IsNumber()
  @Min(1)
  @Max(50)
  containerCount: number;

  @ApiProperty({ description: 'Контактная информация', type: ReservationContactInfoDto })
  @ValidateNested()
  @Type(() => ReservationContactInfoDto)
  contactInfo: ReservationContactInfoDto;

  @ApiPropertyOptional({ description: 'Специальные требования или примечания' })
  @IsOptional()
  @IsString()
  specialRequirements?: string;

  @ApiPropertyOptional({ description: 'Дополнительные метаданные для резервирования' })
  @IsOptional()
  @IsObject()
  reservationMetadata?: Record<string, any>;
}