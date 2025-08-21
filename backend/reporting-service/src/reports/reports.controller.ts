import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
  Logger,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBearerAuth,
  ApiBody,
} from '@nestjs/swagger';
import { ReportsService } from './reports.service';
import {
  GenerateReportDto,
  ReportListDto,
  UpdateReportDto,
  BulkDeleteReportsDto,
  ReportType,
  ReportFormat,
} from './dto/report.dto';
import { ReportResult } from './interfaces/report.interface';

// Базовые guards будут добавлены позже при интеграции с Keycloak
// import { JwtAuthGuard } from '../auth/jwt-auth.guard';
// import { RolesGuard } from '../auth/roles.guard';
// import { Roles } from '../auth/roles.decorator';

@ApiTags('reports')
@Controller('reports')
// @UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT')
export class ReportsController {
  private readonly logger = new Logger(ReportsController.name);

  constructor(private readonly reportsService: ReportsService) {}

  @Post('generate')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Генерация нового отчета',
    description: 'Создает новый отчет на основе указанных параметров и фильтров',
  })
  @ApiResponse({
    status: 201,
    description: 'Отчет успешно сгенерирован',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'uuid-report-id' },
            name: { type: 'string', example: 'Операции контейнеров за декабрь 2024' },
            type: { type: 'string', example: 'container_operations' },
            generatedAt: { type: 'string', format: 'date-time' },
            metadata: {
              type: 'object',
              properties: {
                totalRows: { type: 'number', example: 1500 },
                executionTime: { type: 'number', example: 2340 },
                dataSource: { type: 'string', example: 'ClickHouse' },
              },
            },
          },
        },
        message: { type: 'string', example: 'Отчет успешно сгенерирован' },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Неверные параметры запроса',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: false },
        error: { type: 'string', example: 'Неподдерживаемый тип отчета' },
        message: { type: 'string', example: 'Ошибка валидации данных' },
      },
    },
  })
  @ApiBody({
    type: GenerateReportDto,
    description: 'Параметры для генерации отчета',
    examples: {
      'container-operations': {
        summary: 'Отчет по операциям контейнеров',
        value: {
          type: 'container_operations',
          name: 'Операции контейнеров за декабрь 2024',
          dateFrom: '2024-12-01T00:00:00.000Z',
          dateTo: '2024-12-31T23:59:59.999Z',
          groupBy: 'day',
          containerTypes: ['20FT', '40FT'],
          operationTypes: ['loading', 'unloading'],
          includeSummary: true,
          includeDetails: false,
        },
      },
      'gate-transactions': {
        summary: 'Отчет по КПП транзакциям',
        value: {
          type: 'gate_transactions',
          name: 'Активность КПП за неделю',
          dateFrom: '2024-12-01T00:00:00.000Z',
          dateTo: '2024-12-07T23:59:59.999Z',
          groupBy: 'hour',
          includeSummary: true,
          includeDetails: true,
        },
      },
      'financial-analysis': {
        summary: 'Финансовый анализ',
        value: {
          type: 'financial_analysis',
          name: 'Выручка по клиентам за квартал',
          dateFrom: '2024-10-01T00:00:00.000Z',
          dateTo: '2024-12-31T23:59:59.999Z',
          groupBy: 'month',
          clientIds: ['client-123', 'client-456'],
          includeSummary: true,
        },
      },
    },
  })
  // @Roles('MANAGER', 'DISPATCHER', 'ANALYST')
  async generateReport(@Body() dto: GenerateReportDto): Promise<{
    success: boolean;
    data: ReportResult;
    message: string;
  }> {
    this.logger.log(`📊 Запрос на генерацию отчета: ${dto.type} - ${dto.name}`);
    
    const report = await this.reportsService.generateReport(dto);
    
    return {
      success: true,
      data: report,
      message: 'Отчет успешно сгенерирован',
    };
  }

  @Get()
  @ApiOperation({
    summary: 'Получение списка отчетов',
    description: 'Возвращает список всех доступных отчетов с возможностью фильтрации и пагинации',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Номер страницы',
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Количество элементов на странице',
    example: 20,
  })
  @ApiQuery({
    name: 'type',
    required: false,
    enum: ReportType,
    description: 'Фильтр по типу отчета',
    example: ReportType.CONTAINER_OPERATIONS,
  })
  @ApiQuery({
    name: 'search',
    required: false,
    type: String,
    description: 'Поиск по названию отчета',
    example: 'операции контейнеров',
  })
  @ApiResponse({
    status: 200,
    description: 'Список отчетов получен',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: {
          type: 'object',
          properties: {
            reports: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  name: { type: 'string' },
                  type: { type: 'string' },
                  generatedAt: { type: 'string', format: 'date-time' },
                  metadata: {
                    type: 'object',
                    properties: {
                      totalRows: { type: 'number' },
                      executionTime: { type: 'number' },
                    },
                  },
                },
              },
            },
            total: { type: 'number', example: 45 },
            page: { type: 'number', example: 1 },
            limit: { type: 'number', example: 20 },
          },
        },
        message: { type: 'string', example: 'Список отчетов получен' },
      },
    },
  })
  // @Roles('MANAGER', 'DISPATCHER', 'ANALYST', 'VIEWER')
  async getReportsList(@Query() dto: ReportListDto): Promise<{
    success: boolean;
    data: {
      reports: Partial<ReportResult>[];
      total: number;
      page: number;
      limit: number;
    };
    message: string;
  }> {
    const data = await this.reportsService.getReportsList(dto);
    
    return {
      success: true,
      data,
      message: 'Список отчетов получен',
    };
  }

  @Get(':reportId')
  @ApiOperation({
    summary: 'Получение отчета по ID',
    description: 'Возвращает полные данные отчета включая результаты запроса',
  })
  @ApiParam({
    name: 'reportId',
    description: 'Уникальный ID отчета',
    example: 'uuid-report-id',
  })
  @ApiResponse({
    status: 200,
    description: 'Данные отчета получены',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: {
          type: 'object',
          description: 'Полные данные отчета включая результаты',
        },
        message: { type: 'string', example: 'Отчет получен' },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Отчет не найден',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: false },
        error: { type: 'string', example: 'Отчет с указанным ID не найден' },
        message: { type: 'string', example: 'Ресурс не найден' },
      },
    },
  })
  // @Roles('MANAGER', 'DISPATCHER', 'ANALYST', 'VIEWER')
  async getReport(@Param('reportId') reportId: string): Promise<{
    success: boolean;
    data: ReportResult;
    message: string;
  }> {
    const report = await this.reportsService.getReport(reportId);
    
    return {
      success: true,
      data: report,
      message: 'Отчет получен',
    };
  }

  @Delete(':reportId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Удаление отчета',
    description: 'Удаляет отчет из системы по указанному ID',
  })
  @ApiParam({
    name: 'reportId',
    description: 'Уникальный ID отчета для удаления',
    example: 'uuid-report-id',
  })
  @ApiResponse({
    status: 204,
    description: 'Отчет успешно удален',
  })
  @ApiResponse({
    status: 404,
    description: 'Отчет не найден',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: false },
        error: { type: 'string', example: 'Отчет с указанным ID не найден' },
        message: { type: 'string', example: 'Ресурс не найден' },
      },
    },
  })
  // @Roles('MANAGER', 'ADMIN')
  async deleteReport(@Param('reportId') reportId: string): Promise<void> {
    this.logger.log(`🗑️ Запрос на удаление отчета: ${reportId}`);
    await this.reportsService.deleteReport(reportId);
  }

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Массовое удаление отчетов',
    description: 'Удаляет несколько отчетов за один запрос',
  })
  @ApiBody({
    type: BulkDeleteReportsDto,
    description: 'Список ID отчетов для удаления',
    examples: {
      'bulk-delete': {
        summary: 'Пример массового удаления',
        value: {
          reportIds: ['report-123', 'report-456', 'report-789'],
        },
      },
    },
  })
  @ApiResponse({
    status: 204,
    description: 'Отчеты успешно удалены',
  })
  @ApiResponse({
    status: 400,
    description: 'Неверные параметры запроса',
  })
  // @Roles('MANAGER', 'ADMIN')
  async bulkDeleteReports(@Body() dto: BulkDeleteReportsDto): Promise<void> {
    this.logger.log(`🗑️ Массовое удаление отчетов: ${dto.reportIds.length} элементов`);
    
    for (const reportId of dto.reportIds) {
      try {
        await this.reportsService.deleteReport(reportId);
      } catch (error) {
        this.logger.warn(`Не удалось удалить отчет ${reportId}: ${error.message}`);
      }
    }
  }

  @Get('types/available')
  @ApiOperation({
    summary: 'Получение доступных типов отчетов',
    description: 'Возвращает список всех поддерживаемых типов отчетов с описанием',
  })
  @ApiResponse({
    status: 200,
    description: 'Список типов отчетов получен',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              type: { type: 'string', example: 'container_operations' },
              name: { type: 'string', example: 'Операции контейнеров' },
              description: { type: 'string', example: 'Анализ операций с контейнерами' },
              categories: { type: 'array', items: { type: 'string' } },
              features: { type: 'array', items: { type: 'string' } },
            },
          },
        },
        message: { type: 'string', example: 'Типы отчетов получены' },
      },
    },
  })
  // @Roles('MANAGER', 'DISPATCHER', 'ANALYST', 'VIEWER')
  async getAvailableReportTypes(): Promise<{
    success: boolean;
    data: Array<{
      type: string;
      name: string;
      description: string;
      categories: string[];
      features: string[];
    }>;
    message: string;
  }> {
    const reportTypes = [
      {
        type: ReportType.CONTAINER_OPERATIONS,
        name: 'Операции контейнеров',
        description: 'Детальный анализ всех операций с контейнерами включая загрузку, выгрузку и перемещения',
        categories: ['Операции', 'Производительность'],
        features: ['Группировка по периодам', 'Фильтрация по типам', 'Анализ длительности'],
      },
      {
        type: ReportType.GATE_TRANSACTIONS,
        name: 'Транзакции КПП',
        description: 'Анализ работы контрольно-пропускных пунктов и времени обработки транспорта',
        categories: ['КПП', 'Логистика'],
        features: ['Время обработки', 'Направления движения', 'Статистика весов'],
      },
      {
        type: ReportType.EQUIPMENT_PERFORMANCE,
        name: 'Производительность оборудования',
        description: 'Мониторинг эффективности работы терминального оборудования',
        categories: ['Оборудование', 'Производительность'],
        features: ['Утилизация', 'Поломки', 'Расход топлива', 'Техобслуживание'],
      },
      {
        type: ReportType.FINANCIAL_ANALYSIS,
        name: 'Финансовый анализ',
        description: 'Анализ доходов, расходов и финансовых показателей терминала',
        categories: ['Финансы', 'Аналитика'],
        features: ['Доходы по клиентам', 'Анализ услуг', 'Тренды платежей'],
      },
      {
        type: ReportType.INVENTORY_STATUS,
        name: 'Состояние инвентаря',
        description: 'Отчеты о заполненности терминала и времени хранения контейнеров',
        categories: ['Склад', 'Планирование'],
        features: ['Заполненность', 'Время хранения', 'Типы контейнеров'],
      },
      {
        type: ReportType.PRODUCTIVITY_ANALYSIS,
        name: 'Анализ производительности',
        description: 'Комплексный анализ производительности всех процессов терминала',
        categories: ['Производительность', 'KPI'],
        features: ['Пропускная способность', 'Эффективность берегов', 'Общие KPI'],
      },
      {
        type: ReportType.CLIENT_ACTIVITY,
        name: 'Активность клиентов',
        description: 'Анализ деятельности клиентов и их использования услуг терминала',
        categories: ['Клиенты', 'CRM'],
        features: ['Активность клиентов', 'Объемы операций', 'Время обслуживания'],
      },
      {
        type: ReportType.TERMINAL_KPI,
        name: 'KPI терминала',
        description: 'Ключевые показатели эффективности работы терминала',
        categories: ['KPI', 'Управление'],
        features: ['Загрузка берегов', 'Оборачиваемость', 'Показатели безопасности'],
      },
    ];

    return {
      success: true,
      data: reportTypes,
      message: 'Типы отчетов получены',
    };
  }

  @Get('formats/supported')
  @ApiOperation({
    summary: 'Получение поддерживаемых форматов экспорта',
    description: 'Возвращает список всех поддерживаемых форматов для экспорта отчетов',
  })
  @ApiResponse({
    status: 200,
    description: 'Список форматов получен',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              format: { type: 'string', example: 'excel' },
              name: { type: 'string', example: 'Microsoft Excel' },
              extension: { type: 'string', example: '.xlsx' },
              mimeType: { type: 'string', example: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
              features: { type: 'array', items: { type: 'string' } },
            },
          },
        },
        message: { type: 'string', example: 'Форматы получены' },
      },
    },
  })
  // @Roles('MANAGER', 'DISPATCHER', 'ANALYST', 'VIEWER')
  async getSupportedFormats(): Promise<{
    success: boolean;
    data: Array<{
      format: string;
      name: string;
      extension: string;
      mimeType: string;
      features: string[];
    }>;
    message: string;
  }> {
    const formats = [
      {
        format: ReportFormat.JSON,
        name: 'JSON',
        extension: '.json',
        mimeType: 'application/json',
        features: ['Программная обработка', 'API интеграция', 'Веб-отображение'],
      },
      {
        format: ReportFormat.CSV,
        name: 'CSV',
        extension: '.csv',
        mimeType: 'text/csv',
        features: ['Импорт в Excel', 'Обработка данных', 'Универсальность'],
      },
      {
        format: ReportFormat.EXCEL,
        name: 'Microsoft Excel',
        extension: '.xlsx',
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        features: ['Форматирование', 'Диаграммы', 'Расчеты'],
      },
      {
        format: ReportFormat.PDF,
        name: 'PDF',
        extension: '.pdf',
        mimeType: 'application/pdf',
        features: ['Печать', 'Презентации', 'Архивирование'],
      },
    ];

    return {
      success: true,
      data: formats,
      message: 'Форматы получены',
    };
  }

  @Get('stats/service')
  @ApiOperation({
    summary: 'Статистика работы сервиса отчетов',
    description: 'Возвращает статистику работы сервиса отчетности',
  })
  @ApiResponse({
    status: 200,
    description: 'Статистика получена',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: {
          type: 'object',
          properties: {
            cachedReports: { type: 'number', example: 15 },
            memoryUsage: {
              type: 'object',
              properties: {
                rss: { type: 'number' },
                heapTotal: { type: 'number' },
                heapUsed: { type: 'number' },
                external: { type: 'number' },
              },
            },
            uptime: { type: 'number', example: 3600 },
          },
        },
        message: { type: 'string', example: 'Статистика сервиса получена' },
      },
    },
  })
  // @Roles('ADMIN', 'MANAGER')
  async getServiceStats(): Promise<{
    success: boolean;
    data: any;
    message: string;
  }> {
    const stats = this.reportsService.getServiceStats();
    
    return {
      success: true,
      data: stats,
      message: 'Статистика сервиса получена',
    };
  }
}