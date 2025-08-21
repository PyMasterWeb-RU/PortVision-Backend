import { IsEnum, IsString, IsOptional, IsObject, IsArray } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ProcessGateTransactionDto {
  @ApiProperty({ description: 'Тип транзакции', enum: ['entry', 'exit'] })
  @IsEnum(['entry', 'exit'])
  type: 'entry' | 'exit';

  @ApiProperty({ description: 'ID ворот' })
  @IsString()
  gateId: string;

  @ApiProperty({ description: 'ID пользователя, обрабатывающего транзакцию' })
  @IsString()
  processedBy: string;

  @ApiProperty({ description: 'Информация о транспорте' })
  @IsObject()
  vehicleInfo: {
    truckNumber: string;
    trailerNumber?: string;
    driverName: string;
    driverLicense?: string;
    driverPhone?: string;
    transportCompany?: string;
  };

  @ApiPropertyOptional({ description: 'Документы' })
  @IsOptional()
  @IsObject()
  documents?: any;

  @ApiPropertyOptional({ description: 'Фотографии' })
  @IsOptional()
  @IsObject()
  photos?: any;

  @ApiPropertyOptional({ description: 'Примечания' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ description: 'Результаты проверок' })
  @IsOptional()
  @IsObject()
  checkResults?: {
    documentsValid: boolean;
    passValid: boolean;
    containerCondition?: 'good' | 'damaged' | 'needs_inspection';
    weightCheck?: any;
    securityCheck?: any;
    customsCheck?: any;
  };

  @ApiPropertyOptional({ description: 'Результаты OCR' })
  @IsOptional()
  @IsObject()
  ocrResults?: any;

  @ApiPropertyOptional({ description: 'Нарушения' })
  @IsOptional()
  @IsArray()
  violations?: any[];
}