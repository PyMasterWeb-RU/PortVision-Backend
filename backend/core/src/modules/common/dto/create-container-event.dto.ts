import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsEnum,
  IsUUID,
  IsOptional,
  IsObject,
  IsISO8601,
} from 'class-validator';
import { ContainerEventType } from '../entities/container-event.entity';

export class CreateContainerEventDto {
  @ApiProperty({
    description: 'ID контейнера',
    format: 'uuid',
  })
  @IsUUID()
  containerId: string;

  @ApiProperty({
    description: 'Тип события',
    enum: ContainerEventType,
  })
  @IsEnum(ContainerEventType)
  eventType: ContainerEventType;

  @ApiProperty({
    description: 'Временная метка события',
    type: 'string',
    format: 'date-time',
    required: false,
  })
  @IsISO8601()
  @IsOptional()
  timestamp?: Date;

  @ApiProperty({
    description: 'Местоположение события',
    example: 'Gate A1',
    required: false,
  })
  @IsString()
  @IsOptional()
  location?: string;

  @ApiProperty({
    description: 'Описание события',
    required: false,
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({
    description: 'ID пользователя, инициировавшего событие',
    format: 'uuid',
    required: false,
  })
  @IsUUID()
  @IsOptional()
  userId?: string;

  @ApiProperty({
    description: 'ID оборудования, связанного с событием',
    format: 'uuid',
    required: false,
  })
  @IsUUID()
  @IsOptional()
  equipmentId?: string;

  @ApiProperty({
    description: 'ID заявки, связанной с событием',
    format: 'uuid',
    required: false,
  })
  @IsUUID()
  @IsOptional()
  orderId?: string;

  @ApiProperty({
    description: 'Источник события',
    example: 'manual',
    default: 'manual',
    required: false,
  })
  @IsString()
  @IsOptional()
  source?: string = 'manual';

  @ApiProperty({
    description: 'Дополнительные данные события',
    type: 'object',
    required: false,
  })
  @IsObject()
  @IsOptional()
  data?: Record<string, any>;

  @ApiProperty({
    description: 'Координаты GPS',
    type: 'object',
    required: false,
    properties: {
      latitude: { type: 'number', example: 55.7558 },
      longitude: { type: 'number', example: 37.6176 },
      accuracy: { type: 'number', example: 10 },
    },
  })
  @IsObject()
  @IsOptional()
  gpsCoordinates?: {
    latitude?: number;
    longitude?: number;
    accuracy?: number;
  };

  @ApiProperty({
    description: 'Вложения события',
    type: 'array',
    items: {
      type: 'object',
      properties: {
        fileId: { type: 'string', format: 'uuid' },
        fileName: { type: 'string' },
        fileType: { type: 'string' },
        fileSize: { type: 'number' },
      },
    },
    required: false,
  })
  @IsOptional()
  attachments?: {
    fileId: string;
    fileName: string;
    fileType: string;
    fileSize: number;
  }[];

  @ApiProperty({
    description: 'Статус обработки события',
    default: 'completed',
    required: false,
  })
  @IsString()
  @IsOptional()
  processingStatus?: string = 'completed';
}