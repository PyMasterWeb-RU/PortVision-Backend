import {
  IsString,
  IsEnum,
  IsOptional,
  IsDateString,
  IsObject,
  IsNumber,
  IsArray,
  ValidateNested,
  IsBoolean,
  Length,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OrderType, OrderPriority } from '../entities/order.entity';

class TemperatureRangeDto {
  @ApiPropertyOptional({ description: 'Минимальная температура' })
  @IsOptional()
  @IsNumber()
  min?: number;

  @ApiPropertyOptional({ description: 'Максимальная температура' })
  @IsOptional()
  @IsNumber()
  max?: number;

  @ApiPropertyOptional({ description: 'Единица измерения', example: 'C' })
  @IsOptional()
  @IsString()
  unit?: string;
}

class HandlingRequirementsDto {
  @ApiPropertyOptional({ description: 'Требуется таможенная инспекция' })
  @IsOptional()
  @IsBoolean()
  requiresCustomsInspection?: boolean;

  @ApiPropertyOptional({ description: 'Требуется фитосанитарная инспекция' })
  @IsOptional()
  @IsBoolean()
  requiresPhytosanitaryInspection?: boolean;

  @ApiPropertyOptional({ description: 'Требуется взвешивание' })
  @IsOptional()
  @IsBoolean()
  requiresWeighing?: boolean;

  @ApiPropertyOptional({ description: 'Требуется очистка' })
  @IsOptional()
  @IsBoolean()
  requiresCleaning?: boolean;

  @ApiPropertyOptional({ description: 'Требуется ремонт' })
  @IsOptional()
  @IsBoolean()
  requiresRepair?: boolean;

  @ApiPropertyOptional({ description: 'Опасный груз' })
  @IsOptional()
  @IsBoolean()
  hazardousCargo?: boolean;

  @ApiPropertyOptional({ description: 'Негабаритный груз' })
  @IsOptional()
  @IsBoolean()
  oversizedCargo?: boolean;
}

class CustomsDataDto {
  @ApiPropertyOptional({ description: 'Номер таможенной декларации' })
  @IsOptional()
  @IsString()
  declarationNumber?: string;

  @ApiPropertyOptional({ description: 'Таможенный брокер' })
  @IsOptional()
  @IsString()
  customsBroker?: string;

  @ApiPropertyOptional({ description: 'Статус таможенного оформления' })
  @IsOptional()
  @IsString()
  customsStatus?: string;

  @ApiPropertyOptional({ description: 'Требуется инспекция' })
  @IsOptional()
  @IsBoolean()
  inspectionRequired?: boolean;

  @ApiPropertyOptional({ description: 'Дата выпуска' })
  @IsOptional()
  @IsDateString()
  releaseDate?: string;
}

class OrderItemDto {
  @ApiProperty({ description: 'Номер контейнера' })
  @IsString()
  @Length(11, 11)
  containerNumber: string;

  @ApiProperty({ description: 'ID типа контейнера' })
  @IsString()
  containerTypeId: string;

  @ApiPropertyOptional({ description: 'Вес брутто в кг' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  weight?: number;

  @ApiPropertyOptional({ description: 'Коносамент' })
  @IsOptional()
  @IsString()
  billOfLading?: string;

  @ApiPropertyOptional({ description: 'Название товара' })
  @IsOptional()
  @IsString()
  commodity?: string;

  @ApiPropertyOptional({ description: 'Опасный груз' })
  @IsOptional()
  @IsBoolean()
  isDangerous?: boolean;

  @ApiPropertyOptional({ description: 'Температурный режим', type: TemperatureRangeDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => TemperatureRangeDto)
  temperatureRange?: TemperatureRangeDto;

  @ApiPropertyOptional({ description: 'Особые инструкции' })
  @IsOptional()
  @IsString()
  specialInstructions?: string;
}

export class CreateOrderDto {
  @ApiProperty({ description: 'Тип заявки', enum: OrderType })
  @IsEnum(OrderType)
  type: OrderType;

  @ApiPropertyOptional({ description: 'Приоритет заявки', enum: OrderPriority })
  @IsOptional()
  @IsEnum(OrderPriority)
  priority?: OrderPriority;

  @ApiProperty({ description: 'ID клиента' })
  @IsString()
  clientId: string;

  @ApiPropertyOptional({ description: 'ID грузополучателя' })
  @IsOptional()
  @IsString()
  consigneeId?: string;

  @ApiPropertyOptional({ description: 'Название судна' })
  @IsOptional()
  @IsString()
  vesselName?: string;

  @ApiPropertyOptional({ description: 'Рейс' })
  @IsOptional()
  @IsString()
  vesselVoyage?: string;

  @ApiPropertyOptional({ description: 'IMO номер судна' })
  @IsOptional()
  @IsString()
  @Length(7, 7)
  vesselImo?: string;

  @ApiPropertyOptional({ description: 'Коносамент/Bill of Lading номер' })
  @IsOptional()
  @IsString()
  billOfLading?: string;

  @ApiPropertyOptional({ description: 'Booking номер' })
  @IsOptional()
  @IsString()
  bookingNumber?: string;

  @ApiProperty({ description: 'Запрошенная дата выполнения' })
  @IsDateString()
  requestedDate: string;

  @ApiPropertyOptional({ description: 'Планируемая дата начала' })
  @IsOptional()
  @IsDateString()
  plannedStartDate?: string;

  @ApiPropertyOptional({ description: 'Планируемая дата завершения' })
  @IsOptional()
  @IsDateString()
  plannedEndDate?: string;

  @ApiPropertyOptional({ description: 'Место доставки/получения' })
  @IsOptional()
  @IsString()
  deliveryAddress?: string;

  @ApiPropertyOptional({ description: 'Контактное лицо клиента' })
  @IsOptional()
  @IsString()
  contactPerson?: string;

  @ApiPropertyOptional({ description: 'Телефон контактного лица' })
  @IsOptional()
  @IsString()
  contactPhone?: string;

  @ApiPropertyOptional({ description: 'Email контактного лица' })
  @IsOptional()
  @IsString()
  contactEmail?: string;

  @ApiPropertyOptional({ description: 'Особые инструкции' })
  @IsOptional()
  @IsString()
  specialInstructions?: string;

  @ApiPropertyOptional({ description: 'Температурный режим', type: TemperatureRangeDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => TemperatureRangeDto)
  temperatureRange?: TemperatureRangeDto;

  @ApiPropertyOptional({ description: 'Требования к обработке', type: HandlingRequirementsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => HandlingRequirementsDto)
  handlingRequirements?: HandlingRequirementsDto;

  @ApiPropertyOptional({ description: 'Таможенные данные', type: CustomsDataDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => CustomsDataDto)
  customsData?: CustomsDataDto;

  @ApiPropertyOptional({ description: 'Расчетная стоимость' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  estimatedCost?: number;

  @ApiPropertyOptional({ description: 'Валюта', example: 'RUB' })
  @IsOptional()
  @IsString()
  @Length(3, 3)
  currency?: string;

  @ApiPropertyOptional({ description: 'ID назначенного ответственного' })
  @IsOptional()
  @IsString()
  assignedTo?: string;

  @ApiPropertyOptional({ description: 'Позиции заявки', type: [OrderItemDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items?: OrderItemDto[];

  @ApiPropertyOptional({ description: 'Дополнительные метаданные' })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}