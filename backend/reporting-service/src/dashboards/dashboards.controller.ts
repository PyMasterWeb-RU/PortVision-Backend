import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
  Logger,
  Request,
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
import { DashboardsService } from './dashboards.service';
import {
  CreateDashboardDto,
  UpdateDashboardDto,
  CreateWidgetDto,
  UpdateWidgetDto,
  GetDashboardsDto,
  GetWidgetDataDto,
  CloneDashboardDto,
  ShareDashboardDto,
  ExportDashboardDto,
} from './dto/dashboard.dto';
import { DashboardConfig, DashboardTemplate, WidgetData } from './interfaces/dashboard.interface';

// Базовые guards будут добавлены позже при интеграции с Keycloak
// import { JwtAuthGuard } from '../auth/jwt-auth.guard';
// import { RolesGuard } from '../auth/roles.guard';
// import { Roles } from '../auth/roles.decorator';

@ApiTags('dashboards')
@Controller('dashboards')
// @UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT')
export class DashboardsController {
  private readonly logger = new Logger(DashboardsController.name);

  constructor(private readonly dashboardsService: DashboardsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Создание нового дашборда',
    description: 'Создает новый интерактивный дашборд с заданной конфигурацией',
  })
  @ApiResponse({
    status: 201,
    description: 'Дашборд успешно создан',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'dashboard-uuid' },
            name: { type: 'string', example: 'Операционный дашборд' },
            description: { type: 'string' },
            layout: { type: 'object' },
            widgets: { type: 'array' },
            filters: { type: 'array' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        message: { type: 'string', example: 'Дашборд успешно создан' },
      },
    },
  })
  @ApiBody({
    type: CreateDashboardDto,
    description: 'Конфигурация нового дашборда',
    examples: {
      'operational-dashboard': {
        summary: 'Операционный дашборд',
        value: {
          name: 'Операционный дашборд терминала',
          description: 'Основные метрики работы контейнерного терминала',
          layout: {
            type: 'grid',
            columns: 12,
            rows: 8,
            spacing: 16,
            responsive: true,
          },
          widgets: [],
          filters: [],
          refreshInterval: 30,
          isPublic: false,
        },
      },
    },
  })
  // @Roles('MANAGER', 'DISPATCHER', 'ANALYST')
  async createDashboard(
    @Body() dto: CreateDashboardDto,
    @Request() req: any,
  ): Promise<{
    success: boolean;
    data: DashboardConfig;
    message: string;
  }> {
    const userId = req.user?.id || 'demo-user'; // Временная заглушка
    this.logger.log(`📊 Создание дашборда: ${dto.name} пользователем ${userId}`);
    
    const dashboard = await this.dashboardsService.createDashboard(dto, userId);
    
    return {
      success: true,
      data: dashboard,
      message: 'Дашборд успешно создан',
    };
  }

  @Get()
  @ApiOperation({
    summary: 'Получение списка дашбордов',
    description: 'Возвращает список доступных дашбордов с фильтрацией и пагинацией',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Номер страницы' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Количество элементов' })
  @ApiQuery({ name: 'category', required: false, description: 'Фильтр по категории' })
  @ApiQuery({ name: 'search', required: false, type: String, description: 'Поиск по названию' })
  @ApiQuery({ name: 'publicOnly', required: false, type: Boolean, description: 'Только публичные' })
  @ApiQuery({ name: 'myOnly', required: false, type: Boolean, description: 'Только мои дашборды' })
  @ApiResponse({
    status: 200,
    description: 'Список дашбордов получен',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: {
          type: 'object',
          properties: {
            dashboards: { type: 'array', items: { type: 'object' } },
            total: { type: 'number', example: 25 },
            page: { type: 'number', example: 1 },
            limit: { type: 'number', example: 20 },
          },
        },
        message: { type: 'string', example: 'Список дашбордов получен' },
      },
    },
  })
  // @Roles('MANAGER', 'DISPATCHER', 'ANALYST', 'VIEWER')
  async getDashboards(
    @Query() dto: GetDashboardsDto,
    @Request() req: any,
  ): Promise<{
    success: boolean;
    data: {
      dashboards: DashboardConfig[];
      total: number;
      page: number;
      limit: number;
    };
    message: string;
  }> {
    const userId = req.user?.id || 'demo-user';
    const data = await this.dashboardsService.getDashboards(dto, userId);
    
    return {
      success: true,
      data,
      message: 'Список дашбордов получен',
    };
  }

  @Get('templates')
  @ApiOperation({
    summary: 'Получение шаблонов дашбордов',
    description: 'Возвращает список предустановленных шаблонов дашбордов',
  })
  @ApiResponse({
    status: 200,
    description: 'Шаблоны дашбордов получены',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', example: 'operational-overview' },
              name: { type: 'string', example: 'Операционный обзор' },
              description: { type: 'string' },
              category: { type: 'string', example: 'operations' },
              tags: { type: 'array', items: { type: 'string' } },
              previewImage: { type: 'string' },
            },
          },
        },
        message: { type: 'string', example: 'Шаблоны получены' },
      },
    },
  })
  // @Roles('MANAGER', 'DISPATCHER', 'ANALYST', 'VIEWER')
  async getTemplates(): Promise<{
    success: boolean;
    data: DashboardTemplate[];
    message: string;
  }> {
    const templates = await this.dashboardsService.getTemplates();
    
    return {
      success: true,
      data: templates,
      message: 'Шаблоны получены',
    };
  }

  @Post('templates/:templateId')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Создание дашборда из шаблона',
    description: 'Создает новый дашборд на основе предустановленного шаблона',
  })
  @ApiParam({
    name: 'templateId',
    description: 'ID шаблона дашборда',
    example: 'operational-overview',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string', example: 'Мой операционный дашборд' },
      },
      required: ['name'],
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Дашборд создан из шаблона',
  })
  // @Roles('MANAGER', 'DISPATCHER', 'ANALYST')
  async createFromTemplate(
    @Param('templateId') templateId: string,
    @Body('name') name: string,
    @Request() req: any,
  ): Promise<{
    success: boolean;
    data: DashboardConfig;
    message: string;
  }> {
    const userId = req.user?.id || 'demo-user';
    const dashboard = await this.dashboardsService.createFromTemplate(templateId, name, userId);
    
    return {
      success: true,
      data: dashboard,
      message: 'Дашборд создан из шаблона',
    };
  }

  @Get(':dashboardId')
  @ApiOperation({
    summary: 'Получение дашборда по ID',
    description: 'Возвращает полную конфигурацию дашборда включая виджеты и фильтры',
  })
  @ApiParam({
    name: 'dashboardId',
    description: 'Уникальный ID дашборда',
    example: 'dashboard-uuid',
  })
  @ApiResponse({
    status: 200,
    description: 'Конфигурация дашборда получена',
  })
  @ApiResponse({
    status: 404,
    description: 'Дашборд не найден',
  })
  @ApiResponse({
    status: 403,
    description: 'Доступ запрещен',
  })
  // @Roles('MANAGER', 'DISPATCHER', 'ANALYST', 'VIEWER')
  async getDashboard(
    @Param('dashboardId') dashboardId: string,
    @Request() req: any,
  ): Promise<{
    success: boolean;
    data: DashboardConfig;
    message: string;
  }> {
    const userId = req.user?.id || 'demo-user';
    const dashboard = await this.dashboardsService.getDashboard(dashboardId, userId);
    
    return {
      success: true,
      data: dashboard,
      message: 'Дашборд получен',
    };
  }

  @Put(':dashboardId')
  @ApiOperation({
    summary: 'Обновление дашборда',
    description: 'Обновляет конфигурацию существующего дашборда',
  })
  @ApiParam({
    name: 'dashboardId',
    description: 'ID дашборда для обновления',
  })
  @ApiBody({ type: UpdateDashboardDto })
  @ApiResponse({
    status: 200,
    description: 'Дашборд успешно обновлен',
  })
  // @Roles('MANAGER', 'DISPATCHER', 'ANALYST')
  async updateDashboard(
    @Param('dashboardId') dashboardId: string,
    @Body() dto: UpdateDashboardDto,
    @Request() req: any,
  ): Promise<{
    success: boolean;
    data: DashboardConfig;
    message: string;
  }> {
    const userId = req.user?.id || 'demo-user';
    const dashboard = await this.dashboardsService.updateDashboard(dashboardId, dto, userId);
    
    return {
      success: true,
      data: dashboard,
      message: 'Дашборд обновлен',
    };
  }

  @Delete(':dashboardId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Удаление дашборда',
    description: 'Удаляет дашборд и все связанные с ним данные',
  })
  @ApiParam({
    name: 'dashboardId',
    description: 'ID дашборда для удаления',
  })
  @ApiResponse({
    status: 204,
    description: 'Дашборд успешно удален',
  })
  // @Roles('MANAGER', 'ADMIN')
  async deleteDashboard(
    @Param('dashboardId') dashboardId: string,
    @Request() req: any,
  ): Promise<void> {
    const userId = req.user?.id || 'demo-user';
    this.logger.log(`🗑️ Удаление дашборда: ${dashboardId} пользователем ${userId}`);
    await this.dashboardsService.deleteDashboard(dashboardId, userId);
  }

  @Post(':dashboardId/clone')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Клонирование дашборда',
    description: 'Создает копию существующего дашборда с новым именем',
  })
  @ApiParam({
    name: 'dashboardId',
    description: 'ID дашборда для клонирования',
  })
  @ApiBody({ type: CloneDashboardDto })
  @ApiResponse({
    status: 201,
    description: 'Дашборд успешно клонирован',
  })
  // @Roles('MANAGER', 'DISPATCHER', 'ANALYST')
  async cloneDashboard(
    @Param('dashboardId') dashboardId: string,
    @Body() dto: CloneDashboardDto,
    @Request() req: any,
  ): Promise<{
    success: boolean;
    data: DashboardConfig;
    message: string;
  }> {
    const userId = req.user?.id || 'demo-user';
    const dashboard = await this.dashboardsService.cloneDashboard(dashboardId, dto, userId);
    
    return {
      success: true,
      data: dashboard,
      message: 'Дашборд клонирован',
    };
  }

  // Управление виджетами
  @Post(':dashboardId/widgets')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Добавление виджета в дашборд',
    description: 'Добавляет новый виджет в существующий дашборд',
  })
  @ApiParam({
    name: 'dashboardId',
    description: 'ID дашборда',
  })
  @ApiBody({ type: CreateWidgetDto })
  @ApiResponse({
    status: 201,
    description: 'Виджет успешно добавлен',
  })
  // @Roles('MANAGER', 'DISPATCHER', 'ANALYST')
  async addWidget(
    @Param('dashboardId') dashboardId: string,
    @Body() dto: CreateWidgetDto,
    @Request() req: any,
  ): Promise<{
    success: boolean;
    data: DashboardConfig;
    message: string;
  }> {
    const userId = req.user?.id || 'demo-user';
    const dashboard = await this.dashboardsService.addWidget(dashboardId, dto, userId);
    
    return {
      success: true,
      data: dashboard,
      message: 'Виджет добавлен',
    };
  }

  @Put(':dashboardId/widgets/:widgetId')
  @ApiOperation({
    summary: 'Обновление виджета',
    description: 'Обновляет конфигурацию существующего виджета',
  })
  @ApiParam({ name: 'dashboardId', description: 'ID дашборда' })
  @ApiParam({ name: 'widgetId', description: 'ID виджета' })
  @ApiBody({ type: UpdateWidgetDto })
  @ApiResponse({
    status: 200,
    description: 'Виджет успешно обновлен',
  })
  // @Roles('MANAGER', 'DISPATCHER', 'ANALYST')
  async updateWidget(
    @Param('dashboardId') dashboardId: string,
    @Param('widgetId') widgetId: string,
    @Body() dto: UpdateWidgetDto,
    @Request() req: any,
  ): Promise<{
    success: boolean;
    data: DashboardConfig;
    message: string;
  }> {
    const userId = req.user?.id || 'demo-user';
    const dashboard = await this.dashboardsService.updateWidget(dashboardId, widgetId, dto, userId);
    
    return {
      success: true,
      data: dashboard,
      message: 'Виджет обновлен',
    };
  }

  @Delete(':dashboardId/widgets/:widgetId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Удаление виджета',
    description: 'Удаляет виджет из дашборда',
  })
  @ApiParam({ name: 'dashboardId', description: 'ID дашборда' })
  @ApiParam({ name: 'widgetId', description: 'ID виджета' })
  @ApiResponse({
    status: 204,
    description: 'Виджет успешно удален',
  })
  // @Roles('MANAGER', 'DISPATCHER', 'ANALYST')
  async removeWidget(
    @Param('dashboardId') dashboardId: string,
    @Param('widgetId') widgetId: string,
    @Request() req: any,
  ): Promise<void> {
    const userId = req.user?.id || 'demo-user';
    await this.dashboardsService.removeWidget(dashboardId, widgetId, userId);
  }

  @Get(':dashboardId/widgets/:widgetId/data')
  @ApiOperation({
    summary: 'Получение данных виджета',
    description: 'Возвращает актуальные данные для отображения в виджете',
  })
  @ApiParam({ name: 'dashboardId', description: 'ID дашборда' })
  @ApiParam({ name: 'widgetId', description: 'ID виджета' })
  @ApiQuery({ name: 'dateFrom', required: false, description: 'Дата начала фильтрации' })
  @ApiQuery({ name: 'dateTo', required: false, description: 'Дата окончания фильтрации' })
  @ApiQuery({ name: 'forceRefresh', required: false, type: Boolean, description: 'Принудительное обновление' })
  @ApiResponse({
    status: 200,
    description: 'Данные виджета получены',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: {
          type: 'object',
          properties: {
            widgetId: { type: 'string' },
            data: { type: 'object', description: 'Данные виджета в соответствующем формате' },
            metadata: {
              type: 'object',
              properties: {
                lastUpdated: { type: 'string', format: 'date-time' },
                executionTime: { type: 'number', example: 150 },
                dataPoints: { type: 'number', example: 24 },
                error: { type: 'string' },
              },
            },
          },
        },
        message: { type: 'string', example: 'Данные виджета получены' },
      },
    },
  })
  // @Roles('MANAGER', 'DISPATCHER', 'ANALYST', 'VIEWER')
  async getWidgetData(
    @Param('dashboardId') dashboardId: string,
    @Param('widgetId') widgetId: string,
    @Query() dto: GetWidgetDataDto,
    @Request() req: any,
  ): Promise<{
    success: boolean;
    data: WidgetData;
    message: string;
  }> {
    const userId = req.user?.id || 'demo-user';
    const data = await this.dashboardsService.getWidgetData(dashboardId, widgetId, dto, userId);
    
    return {
      success: true,
      data,
      message: 'Данные виджета получены',
    };
  }

  @Get('stats/service')
  @ApiOperation({
    summary: 'Статистика работы сервиса дашбордов',
    description: 'Возвращает статистику работы сервиса дашбордов',
  })
  @ApiResponse({
    status: 200,
    description: 'Статистика получена',
  })
  // @Roles('ADMIN', 'MANAGER')
  async getServiceStats(): Promise<{
    success: boolean;
    data: any;
    message: string;
  }> {
    const stats = this.dashboardsService.getServiceStats();
    
    return {
      success: true,
      data: stats,
      message: 'Статистика сервиса получена',
    };
  }
}