import { IsEnum, IsString, IsOptional, IsDateString, IsObject, ValidateNested, IsArray } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EirType } from '../entities/eir.entity';

export class TransportInfoDto {
  @ApiProperty({ description: 'Номер грузовика' })
  @IsString()
  truckNumber: string;

  @ApiPropertyOptional({ description: 'Номер прицепа' })
  @IsOptional()
  @IsString()
  trailerNumber?: string;

  @ApiProperty({ description: 'Имя водителя' })
  @IsString()
  driverName: string;

  @ApiPropertyOptional({ description: 'Номер водительского удостоверения' })
  @IsOptional()
  @IsString()
  driverLicense?: string;

  @ApiPropertyOptional({ description: 'Транспортная компания' })
  @IsOptional()
  @IsString()
  transportCompany?: string;
}

export class CreateEirDto {
  @ApiProperty({ description: 'Тип EIR', enum: EirType })
  @IsEnum(EirType)
  type: EirType;

  @ApiProperty({ description: 'ID контейнера' })
  @IsString()
  containerId: string;

  @ApiPropertyOptional({ description: 'ID пропуска' })
  @IsOptional()
  @IsString()
  gatePassId?: string;

  @ApiProperty({ description: 'Дата и время осмотра' })
  @IsDateString()
  @Transform(({ value }) => new Date(value))
  inspectionDate: Date;

  @ApiProperty({ description: 'Местоположение осмотра' })
  @IsString()
  inspectionLocation: string;

  @ApiProperty({ description: 'Имя инспектора' })
  @IsString()
  inspectorName: string;

  @ApiProperty({ description: 'Данные транспорта', type: TransportInfoDto })
  @ValidateNested()
  @Type(() => TransportInfoDto)
  transportInfo: TransportInfoDto;

  @ApiProperty({ description: 'Общее состояние контейнера' })
  @IsString()
  overallCondition: string;

  @ApiPropertyOptional({ description: 'Печати и пломбы' })
  @IsOptional()
  @IsObject()
  seals?: any;

  @ApiPropertyOptional({ description: 'Повреждения' })
  @IsOptional()
  @IsArray()
  damages?: any[];

  @ApiPropertyOptional({ description: 'Чистота контейнера' })
  @IsOptional()
  @IsObject()
  cleanliness?: any;

  @ApiPropertyOptional({ description: 'Функциональные элементы' })
  @IsOptional()
  @IsObject()
  functionalElements?: any;

  @ApiPropertyOptional({ description: 'Измерения и вес' })
  @IsOptional()
  @IsObject()
  measurements?: any;

  @ApiProperty({ description: 'Фотографии' })
  @IsObject()
  photos: any;

  @ApiPropertyOptional({ description: 'Примечания инспектора' })
  @IsOptional()
  @IsString()
  inspectorNotes?: string;
}