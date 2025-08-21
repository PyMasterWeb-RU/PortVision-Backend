import {
  IsString,
  IsOptional,
  IsArray,
  IsNumber,
  IsBoolean,
  IsEnum,
  IsObject,
  ValidateNested,
  IsUUID,
  Min,
  Max,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  WidgetType,
  FilterType,
  DashboardCategory,
} from '../interfaces/dashboard.interface';

export class CreateDashboardDto {
  @ApiProperty({
    description: 'Название дашборда',
    example: 'Операционный дашборд терминала',
  })
  @IsString()
  name: string;

  @ApiPropertyOptional({
    description: 'Описание дашборда',
    example: 'Основные метрики работы контейнерного терминала',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    description: 'Конфигурация макета дашборда',
    example: {
      type: 'grid',
      columns: 12,
      rows: 8,
      spacing: 16,
      responsive: true,
    },
  })
  @IsObject()
  layout: {
    type: 'grid' | 'flex' | 'tabs';
    columns?: number;
    rows?: number;
    spacing?: number;
    responsive?: boolean;
  };

  @ApiPropertyOptional({
    description: 'Виджеты дашборда',
    type: [Object],
  })
  @IsOptional()
  @IsArray()
  widgets?: any[];

  @ApiPropertyOptional({
    description: 'Фильтры дашборда',
    type: [Object],
  })
  @IsOptional()
  @IsArray()
  filters?: any[];

  @ApiPropertyOptional({
    description: 'Интервал обновления в секундах',
    example: 30,
    default: 30,
  })
  @IsOptional()
  @IsNumber()
  @Min(5)
  @Max(3600)
  refreshInterval?: number = 30;

  @ApiPropertyOptional({
    description: 'Публичный доступ к дашборду',
    example: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  isPublic?: boolean = false;
}

export class UpdateDashboardDto {
  @ApiPropertyOptional({
    description: 'Новое название дашборда',
    example: 'Обновленный операционный дашборд',
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({
    description: 'Новое описание дашборда',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: 'Обновленная конфигурация макета',
  })
  @IsOptional()
  @IsObject()
  layout?: any;

  @ApiPropertyOptional({
    description: 'Обновленные виджеты',
  })
  @IsOptional()
  @IsArray()
  widgets?: any[];

  @ApiPropertyOptional({
    description: 'Обновленные фильтры',
  })
  @IsOptional()
  @IsArray()
  filters?: any[];

  @ApiPropertyOptional({
    description: 'Новый интервал обновления',
  })
  @IsOptional()
  @IsNumber()
  @Min(5)
  @Max(3600)
  refreshInterval?: number;

  @ApiPropertyOptional({
    description: 'Изменить публичный доступ',
  })
  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;
}

export class CreateWidgetDto {
  @ApiProperty({
    enum: WidgetType,
    description: 'Тип виджета',
    example: WidgetType.CHART_LINE,
  })
  @IsEnum(WidgetType)
  type: WidgetType;

  @ApiProperty({
    description: 'Заголовок виджета',
    example: 'Операции контейнеров по часам',
  })
  @IsString()
  title: string;

  @ApiProperty({
    description: 'Позиция виджета',
    example: { x: 0, y: 0, row: 1, col: 1 },
  })
  @IsObject()
  position: {
    x: number;
    y: number;
    row?: number;
    col?: number;
  };

  @ApiProperty({
    description: 'Размер виджета',
    example: { width: 6, height: 4 },
  })
  @IsObject()
  size: {
    width: number;
    height: number;
    minWidth?: number;
    minHeight?: number;
    maxWidth?: number;
    maxHeight?: number;
  };

  @ApiProperty({
    description: 'Конфигурация виджета',
    example: {
      query: 'SELECT * FROM container_operations',
      groupBy: ['hour'],
      refreshInterval: 60,
    },
  })
  @IsObject()
  config: any;

  @ApiProperty({
    description: 'Конфигурация источника данных',
    example: {
      type: 'clickhouse',
      query: 'SELECT count() FROM container_operations GROUP BY toHour(timestamp)',
    },
  })
  @IsObject()
  dataSource: {
    type: 'clickhouse' | 'api' | 'static';
    query?: string;
    endpoint?: string;
    parameters?: Record<string, any>;
    cacheTime?: number;
  };

  @ApiPropertyOptional({
    description: 'Стилизация виджета',
    example: {
      backgroundColor: '#ffffff',
      textColor: '#333333',
      borderRadius: 8,
    },
  })
  @IsOptional()
  @IsObject()
  styling?: any;
}

export class UpdateWidgetDto {
  @ApiPropertyOptional({
    description: 'Новый заголовок виджета',
  })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({
    description: 'Новая позиция виджета',
  })
  @IsOptional()
  @IsObject()
  position?: any;

  @ApiPropertyOptional({
    description: 'Новый размер виджета',
  })
  @IsOptional()
  @IsObject()
  size?: any;

  @ApiPropertyOptional({
    description: 'Обновленная конфигурация',
  })
  @IsOptional()
  @IsObject()
  config?: any;

  @ApiPropertyOptional({
    description: 'Обновленный источник данных',
  })
  @IsOptional()
  @IsObject()
  dataSource?: any;

  @ApiPropertyOptional({
    description: 'Обновленная стилизация',
  })
  @IsOptional()
  @IsObject()
  styling?: any;
}

export class GetDashboardsDto {
  @ApiPropertyOptional({
    description: 'Номер страницы',
    example: 1,
    default: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Количество элементов на странице',
    example: 20,
    default: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({
    enum: DashboardCategory,
    description: 'Фильтр по категории',
  })
  @IsOptional()
  @IsEnum(DashboardCategory)
  category?: DashboardCategory;

  @ApiPropertyOptional({
    description: 'Поиск по названию',
    example: 'операционный',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Только публичные дашборды',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  publicOnly?: boolean;

  @ApiPropertyOptional({
    description: 'Только мои дашборды',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  myOnly?: boolean;
}

export class GetWidgetDataDto {
  @ApiPropertyOptional({
    description: 'Дата начала для фильтрации данных',
    example: '2024-12-01T00:00:00.000Z',
  })
  @IsOptional()
  @IsString()
  dateFrom?: string;

  @ApiPropertyOptional({
    description: 'Дата окончания для фильтрации данных',
    example: '2024-12-31T23:59:59.999Z',
  })
  @IsOptional()
  @IsString()
  dateTo?: string;

  @ApiPropertyOptional({
    description: 'Дополнительные параметры фильтрации',
    example: { clientId: 'client-123', status: 'active' },
  })
  @IsOptional()
  @IsObject()
  filters?: Record<string, any>;

  @ApiPropertyOptional({
    description: 'Принудительное обновление (игнорировать кэш)',
    example: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  forceRefresh?: boolean = false;
}

export class CloneDashboardDto {
  @ApiProperty({
    description: 'Название нового дашборда',
    example: 'Копия операционного дашборда',
  })
  @IsString()
  name: string;

  @ApiPropertyOptional({
    description: 'Описание нового дашборда',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: 'Сделать копию публичной',
    example: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  isPublic?: boolean = false;
}

export class ShareDashboardDto {
  @ApiProperty({
    description: 'Список пользователей для предоставления доступа',
    type: [String],
    example: ['user-123', 'user-456'],
  })
  @IsArray()
  @IsString({ each: true })
  userIds: string[];

  @ApiPropertyOptional({
    description: 'Уровень доступа',
    enum: ['view', 'edit'],
    example: 'view',
    default: 'view',
  })
  @IsOptional()
  @IsEnum(['view', 'edit'])
  permission?: 'view' | 'edit' = 'view';

  @ApiPropertyOptional({
    description: 'Срок действия доступа (дни)',
    example: 30,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(365)
  expiryDays?: number;
}

export class ExportDashboardDto {
  @ApiPropertyOptional({
    description: 'Формат экспорта',
    enum: ['pdf', 'png', 'jpeg', 'json'],
    example: 'pdf',
    default: 'pdf',
  })
  @IsOptional()
  @IsEnum(['pdf', 'png', 'jpeg', 'json'])
  format?: 'pdf' | 'png' | 'jpeg' | 'json' = 'pdf';

  @ApiPropertyOptional({
    description: 'Включить данные виджетов',
    example: true,
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  includeData?: boolean = true;

  @ApiPropertyOptional({
    description: 'Качество изображения (для png/jpeg)',
    example: 80,
    default: 80,
  })
  @IsOptional()
  @IsNumber()
  @Min(10)
  @Max(100)
  quality?: number = 80;

  @ApiPropertyOptional({
    description: 'Размер экспорта',
    enum: ['small', 'medium', 'large', 'custom'],
    example: 'large',
    default: 'large',
  })
  @IsOptional()
  @IsEnum(['small', 'medium', 'large', 'custom'])
  size?: 'small' | 'medium' | 'large' | 'custom' = 'large';

  @ApiPropertyOptional({
    description: 'Кастомные размеры (для size: custom)',
    example: { width: 1920, height: 1080 },
  })
  @IsOptional()
  @IsObject()
  customSize?: {
    width: number;
    height: number;
  };
}