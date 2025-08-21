import { PartialType } from '@nestjs/swagger';
import { CreateEirDto } from './create-eir.dto';
import { IsOptional, IsEnum, IsBoolean, IsString, IsArray, IsObject } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { EirStatus } from '../entities/eir.entity';

export class UpdateEirDto extends PartialType(CreateEirDto) {
  @ApiPropertyOptional({ description: 'Статус EIR', enum: EirStatus })
  @IsOptional()
  @IsEnum(EirStatus)
  status?: EirStatus;

  @ApiPropertyOptional({ description: 'Подпись водителя получена' })
  @IsOptional()
  @IsBoolean()
  driverSignatureReceived?: boolean;

  @ApiPropertyOptional({ description: 'Подпись водителя (изображение)' })
  @IsOptional()
  @IsString()
  driverSignature?: string;

  @ApiPropertyOptional({ description: 'Подпись инспектора получена' })
  @IsOptional()
  @IsBoolean()
  inspectorSignatureReceived?: boolean;

  @ApiPropertyOptional({ description: 'Подпись инспектора (изображение)' })
  @IsOptional()
  @IsString()
  inspectorSignature?: string;

  @ApiPropertyOptional({ description: 'Спорные моменты' })
  @IsOptional()
  @IsArray()
  disputes?: any[];

  @ApiPropertyOptional({ description: 'PDF документ (URL)' })
  @IsOptional()
  @IsString()
  pdfUrl?: string;

  @ApiPropertyOptional({ description: 'Дополнительные метаданные' })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}