import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';

import { TariffService } from '../services/tariff.service';
import { CreateTariffDto } from '../dto/create-tariff.dto';
import { UpdateTariffDto } from '../dto/update-tariff.dto';
import { Tariff } from '../entities/tariff.entity';
import { JwtAuthGuard } from '../../../guards/jwt-auth.guard';
import { RolesGuard } from '../../../guards/roles.guard';
import { Roles } from '../../../decorators/roles.decorator';
import { UserRole } from '../../../enums/user-role.enum';

@ApiTags('Tariffs')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('tariffs')
export class TariffController {
  constructor(private readonly tariffService: TariffService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.DISPATCHER)
  @ApiOperation({ summary: 'Создать новый тариф' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Тариф успешно создан',
    type: Tariff,
  })
  async create(@Body() createTariffDto: CreateTariffDto): Promise<Tariff> {
    return this.tariffService.create(createTariffDto);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.DISPATCHER, UserRole.BILLING_OPERATOR)
  @ApiOperation({ summary: 'Получить список всех тарифов' })
  @ApiQuery({ name: 'page', required: false, description: 'Номер страницы' })
  @ApiQuery({ name: 'limit', required: false, description: 'Количество элементов на странице' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Список тарифов получен',
  })
  async findAll(
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ): Promise<{
    tariffs: Tariff[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    return this.tariffService.findAll(+page, +limit);
  }

  @Get('statistics')
  @Roles(UserRole.ADMIN, UserRole.DISPATCHER)
  @ApiOperation({ summary: 'Получить статистику по тарифам' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Статистика получена',
  })
  async getStatistics(): Promise<{
    total: number;
    active: number;
    inactive: number;
    byServiceType: Record<string, number>;
    averagePrice: number;
  }> {
    return this.tariffService.getTariffStatistics();
  }

  @Get('by-service/:serviceType')
  @Roles(UserRole.ADMIN, UserRole.DISPATCHER, UserRole.BILLING_OPERATOR)
  @ApiOperation({ summary: 'Получить тарифы по типу услуги' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Тарифы получены',
    type: [Tariff],
  })
  async findByServiceType(@Param('serviceType') serviceType: string): Promise<Tariff[]> {
    return this.tariffService.findByServiceType(serviceType);
  }

  @Get('active/:serviceType')
  @Roles(UserRole.ADMIN, UserRole.DISPATCHER, UserRole.BILLING_OPERATOR)
  @ApiOperation({ summary: 'Получить активные тарифы по типу услуги' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Активные тарифы получены',
    type: [Tariff],
  })
  async findActiveByServiceType(@Param('serviceType') serviceType: string): Promise<Tariff[]> {
    return this.tariffService.findActiveByServiceType(serviceType);
  }

  @Post('calculate-price')
  @Roles(UserRole.ADMIN, UserRole.DISPATCHER, UserRole.BILLING_OPERATOR)
  @ApiOperation({ summary: 'Рассчитать стоимость услуги' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Стоимость рассчитана',
  })
  async calculatePrice(
    @Body() calculateDto: {
      serviceType: string;
      containerSize?: string;
      duration?: number;
      quantity?: number;
    },
  ): Promise<{ price: number }> {
    const price = await this.tariffService.calculatePrice(
      calculateDto.serviceType,
      calculateDto.containerSize,
      calculateDto.duration,
      calculateDto.quantity,
    );
    return { price };
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.DISPATCHER, UserRole.BILLING_OPERATOR)
  @ApiOperation({ summary: 'Получить тариф по ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Тариф найден',
    type: Tariff,
  })
  async findOne(@Param('id') id: string): Promise<Tariff> {
    return this.tariffService.findOne(id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.DISPATCHER)
  @ApiOperation({ summary: 'Обновить тариф' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Тариф обновлен',
    type: Tariff,
  })
  async update(
    @Param('id') id: string,
    @Body() updateTariffDto: UpdateTariffDto,
  ): Promise<Tariff> {
    return this.tariffService.update(id, updateTariffDto);
  }

  @Patch(':id/activate')
  @Roles(UserRole.ADMIN, UserRole.DISPATCHER)
  @ApiOperation({ summary: 'Активировать тариф' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Тариф активирован',
    type: Tariff,
  })
  async activate(@Param('id') id: string): Promise<Tariff> {
    return this.tariffService.activateTariff(id);
  }

  @Patch(':id/deactivate')
  @Roles(UserRole.ADMIN, UserRole.DISPATCHER)
  @ApiOperation({ summary: 'Деактивировать тариф' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Тариф деактивирован',
    type: Tariff,
  })
  async deactivate(@Param('id') id: string): Promise<Tariff> {
    return this.tariffService.deactivateTariff(id);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Удалить тариф' })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Тариф удален',
  })
  async remove(@Param('id') id: string): Promise<void> {
    return this.tariffService.remove(id);
  }
}