import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  ValidationPipe,
  UsePipes,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { 
  ServiceProviderService, 
  CreateServiceProviderDto, 
  UpdateServiceProviderDto, 
  ProviderSearchFilters 
} from '../services/service-provider.service';
import { ServiceProvider, ProviderType, ProviderStatus } from '../entities/service-provider.entity';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';

@ApiTags('service-providers')
@ApiBearerAuth()
@Controller('service-providers')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ServiceProviderController {
  constructor(private readonly serviceProviderService: ServiceProviderService) {}

  @Post()
  @Roles('ADMIN', 'MANAGER')
  @UsePipes(new ValidationPipe({ transform: true }))
  @ApiOperation({ summary: 'Создать нового поставщика услуг' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Поставщик услуг успешно создан',
    type: ServiceProvider,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Неверные данные',
  })
  async createServiceProvider(@Body() createServiceProviderDto: CreateServiceProviderDto): Promise<ServiceProvider> {
    return this.serviceProviderService.createServiceProvider(createServiceProviderDto);
  }

  @Get()
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER')
  @ApiOperation({ summary: 'Получить список всех поставщиков услуг' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Список поставщиков услуг получен',
    type: [ServiceProvider],
  })
  async getAllServiceProviders(): Promise<ServiceProvider[]> {
    return this.serviceProviderService.getAllServiceProviders();
  }

  @Get('search')
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER')
  @ApiOperation({ summary: 'Поиск поставщиков услуг по критериям' })
  @ApiQuery({ name: 'providerType', enum: ProviderType, required: false })
  @ApiQuery({ name: 'status', enum: ProviderStatus, required: false })
  @ApiQuery({ name: 'serviceCategory', type: String, required: false })
  @ApiQuery({ name: 'serviceType', type: String, required: false })
  @ApiQuery({ name: 'city', type: String, required: false })
  @ApiQuery({ name: 'state', type: String, required: false })
  @ApiQuery({ name: 'country', type: String, required: false })
  @ApiQuery({ name: 'performanceRatingMin', type: Number, required: false })
  @ApiQuery({ name: 'performanceRatingMax', type: Number, required: false })
  @ApiQuery({ name: 'emergencyAvailable', type: Boolean, required: false })
  @ApiQuery({ name: 'certificationRequired', type: Boolean, required: false })
  @ApiQuery({ name: 'hasValidInsurance', type: Boolean, required: false })
  @ApiQuery({ name: 'searchText', type: String, required: false })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Результаты поиска получены',
    type: [ServiceProvider],
  })
  async searchServiceProviders(@Query() query: any): Promise<ServiceProvider[]> {
    const filters: ProviderSearchFilters = {};

    if (query.providerType) filters.providerType = query.providerType;
    if (query.status) filters.status = query.status;
    if (query.serviceCategory) filters.serviceCategory = query.serviceCategory;
    if (query.serviceType) filters.serviceType = query.serviceType;
    if (query.city) filters.city = query.city;
    if (query.state) filters.state = query.state;
    if (query.country) filters.country = query.country;
    if (query.performanceRatingMin) filters.performanceRatingMin = parseFloat(query.performanceRatingMin);
    if (query.performanceRatingMax) filters.performanceRatingMax = parseFloat(query.performanceRatingMax);
    if (query.emergencyAvailable !== undefined) filters.emergencyAvailable = query.emergencyAvailable === 'true';
    if (query.certificationRequired !== undefined) filters.certificationRequired = query.certificationRequired === 'true';
    if (query.hasValidInsurance !== undefined) filters.hasValidInsurance = query.hasValidInsurance === 'true';
    if (query.searchText) filters.searchText = query.searchText;

    return this.serviceProviderService.searchServiceProviders(filters);
  }

  @Get('statistics')
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Получить статистику поставщиков услуг' })
  @ApiQuery({ name: 'period', type: Number, required: false, description: 'Период в днях' })
  @ApiQuery({ name: 'providerType', enum: ProviderType, required: false })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Статистика поставщиков услуг получена',
  })
  async getProviderStatistics(@Query() query: any) {
    const filters: any = {};
    if (query.period) filters.period = parseInt(query.period);
    if (query.providerType) filters.providerType = query.providerType;

    return this.serviceProviderService.getProviderStatistics(filters);
  }

  @Get('active')
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER')
  @ApiOperation({ summary: 'Получить активных поставщиков услуг' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Активные поставщики услуг получены',
    type: [ServiceProvider],
  })
  async getActiveProviders(): Promise<ServiceProvider[]> {
    return this.serviceProviderService.getActiveProviders();
  }

  @Get('emergency')
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER')
  @ApiOperation({ summary: 'Получить поставщиков экстренных услуг' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Поставщики экстренных услуг получены',
    type: [ServiceProvider],
  })
  async getEmergencyProviders(): Promise<ServiceProvider[]> {
    return this.serviceProviderService.getEmergencyProviders();
  }

  @Get('top-rated')
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER')
  @ApiOperation({ summary: 'Получить поставщиков с высшим рейтингом' })
  @ApiQuery({ name: 'limit', type: Number, required: false, description: 'Количество поставщиков (по умолчанию 10)' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Поставщики с высшим рейтингом получены',
    type: [ServiceProvider],
  })
  async getTopRatedProviders(@Query('limit') limit?: number): Promise<ServiceProvider[]> {
    return this.serviceProviderService.getTopRatedProviders(limit);
  }

  @Get('expiring-certifications')
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Получить поставщиков с истекающими сертификатами' })
  @ApiQuery({ name: 'daysAhead', type: Number, required: false, description: 'Количество дней вперед (по умолчанию 90)' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Поставщики с истекающими сертификатами получены',
    type: [ServiceProvider],
  })
  async getProvidersWithExpiringCertifications(@Query('daysAhead') daysAhead?: number): Promise<ServiceProvider[]> {
    return this.serviceProviderService.getProvidersWithExpiringCertifications(daysAhead);
  }

  @Get('expiring-insurance')
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Получить поставщиков с истекающей страховкой' })
  @ApiQuery({ name: 'daysAhead', type: Number, required: false, description: 'Количество дней вперед (по умолчанию 30)' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Поставщики с истекающей страховкой получены',
    type: [ServiceProvider],
  })
  async getProvidersWithExpiringInsurance(@Query('daysAhead') daysAhead?: number): Promise<ServiceProvider[]> {
    return this.serviceProviderService.getProvidersWithExpiringInsurance(daysAhead);
  }

  @Get('type/:providerType')
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER')
  @ApiOperation({ summary: 'Получить поставщиков по типу' })
  @ApiParam({ name: 'providerType', enum: ProviderType, description: 'Тип поставщика' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Поставщики по типу получены',
    type: [ServiceProvider],
  })
  async getProvidersByType(@Param('providerType') providerType: ProviderType): Promise<ServiceProvider[]> {
    return this.serviceProviderService.getProvidersByType(providerType);
  }

  @Get('status/:status')
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER')
  @ApiOperation({ summary: 'Получить поставщиков по статусу' })
  @ApiParam({ name: 'status', enum: ProviderStatus, description: 'Статус поставщика' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Поставщики по статусу получены',
    type: [ServiceProvider],
  })
  async getProvidersByStatus(@Param('status') status: ProviderStatus): Promise<ServiceProvider[]> {
    return this.serviceProviderService.getProvidersByStatus(status);
  }

  @Get('service/:serviceCategory')
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER')
  @ApiOperation({ summary: 'Получить поставщиков по категории услуг' })
  @ApiParam({ name: 'serviceCategory', description: 'Категория услуг' })
  @ApiQuery({ name: 'serviceType', type: String, required: false, description: 'Тип услуги' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Поставщики по категории услуг получены',
    type: [ServiceProvider],
  })
  async getProvidersForService(
    @Param('serviceCategory') serviceCategory: string,
    @Query('serviceType') serviceType?: string,
  ): Promise<ServiceProvider[]> {
    return this.serviceProviderService.getProvidersForService(serviceCategory, serviceType);
  }

  @Get('code/:providerCode')
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER')
  @ApiOperation({ summary: 'Получить поставщика по коду' })
  @ApiParam({ name: 'providerCode', description: 'Код поставщика' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Поставщик найден',
    type: ServiceProvider,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Поставщик не найден',
  })
  async getServiceProviderByCode(@Param('providerCode') providerCode: string): Promise<ServiceProvider> {
    return this.serviceProviderService.getServiceProviderByCode(providerCode);
  }

  @Get(':id')
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER')
  @ApiOperation({ summary: 'Получить поставщика по ID' })
  @ApiParam({ name: 'id', description: 'ID поставщика' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Поставщик найден',
    type: ServiceProvider,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Поставщик не найден',
  })
  async getServiceProviderById(@Param('id') id: string): Promise<ServiceProvider> {
    return this.serviceProviderService.getServiceProviderById(id);
  }

  @Put(':id')
  @Roles('ADMIN', 'MANAGER')
  @UsePipes(new ValidationPipe({ transform: true }))
  @ApiOperation({ summary: 'Обновить поставщика услуг' })
  @ApiParam({ name: 'id', description: 'ID поставщика' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Поставщик обновлен',
    type: ServiceProvider,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Поставщик не найден',
  })
  async updateServiceProvider(
    @Param('id') id: string,
    @Body() updateServiceProviderDto: UpdateServiceProviderDto,
  ): Promise<ServiceProvider> {
    return this.serviceProviderService.updateServiceProvider(id, updateServiceProviderDto);
  }

  @Delete(':id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Удалить поставщика услуг' })
  @ApiParam({ name: 'id', description: 'ID поставщика' })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Поставщик удален',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Поставщик не найден',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Нельзя удалить активного поставщика',
  })
  async deleteServiceProvider(@Param('id') id: string): Promise<void> {
    return this.serviceProviderService.deleteServiceProvider(id);
  }

  @Put(':id/activate')
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Активировать поставщика услуг' })
  @ApiParam({ name: 'id', description: 'ID поставщика' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Поставщик активирован',
    type: ServiceProvider,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Нельзя активировать поставщика в текущем статусе или отсутствуют необходимые данные',
  })
  async activateProvider(@Param('id') id: string): Promise<ServiceProvider> {
    return this.serviceProviderService.activateProvider(id);
  }

  @Put(':id/suspend')
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Приостановить поставщика услуг' })
  @ApiParam({ name: 'id', description: 'ID поставщика' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Поставщик приостановлен',
    type: ServiceProvider,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Нельзя приостановить поставщика в текущем статусе',
  })
  async suspendProvider(
    @Param('id') id: string,
    @Body('reason') reason: string,
  ): Promise<ServiceProvider> {
    return this.serviceProviderService.suspendProvider(id, reason);
  }

  @Put(':id/performance')
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Обновить рейтинг производительности поставщика' })
  @ApiParam({ name: 'id', description: 'ID поставщика' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Рейтинг производительности обновлен',
    type: ServiceProvider,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Неверный рейтинг (должен быть от 0 до 10)',
  })
  async updatePerformanceRating(
    @Param('id') id: string,
    @Body() body: {
      rating: number;
      metrics?: any;
    },
  ): Promise<ServiceProvider> {
    return this.serviceProviderService.updatePerformanceRating(id, body.rating, body.metrics);
  }

  @Post(':id/reviews')
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER')
  @ApiOperation({ summary: 'Добавить отзыв о поставщике' })
  @ApiParam({ name: 'id', description: 'ID поставщика' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Отзыв добавлен',
    type: ServiceProvider,
  })
  async addReview(
    @Param('id') id: string,
    @Body() review: {
      reviewerName: string;
      jobType: string;
      overallRating: number;
      qualityRating: number;
      timelinessRating: number;
      communicationRating: number;
      valueRating: number;
      comments: string;
      wouldRecommend: boolean;
    },
  ): Promise<ServiceProvider> {
    return this.serviceProviderService.addReview(id, review);
  }

  @Post(':id/incidents')
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Добавить инцидент поставщика' })
  @ApiParam({ name: 'id', description: 'ID поставщика' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Инцидент добавлен',
    type: ServiceProvider,
  })
  async addIncident(
    @Param('id') id: string,
    @Body() incident: {
      incidentType: string;
      severity: string;
      description: string;
      rootCause: string;
      correctiveActions: string[];
      preventiveActions: string[];
      reportedBy: string;
      investigatedBy: string;
    },
  ): Promise<ServiceProvider> {
    return this.serviceProviderService.addIncident(id, incident);
  }
}