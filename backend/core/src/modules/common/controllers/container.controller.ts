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

import { ContainerService } from '../services/container.service';
import { CreateContainerDto } from '../dto/create-container.dto';
import { UpdateContainerDto } from '../dto/update-container.dto';
import { Container } from '../entities/container.entity';
import { JwtAuthGuard } from '../../../guards/jwt-auth.guard';
import { RolesGuard } from '../../../guards/roles.guard';
import { Roles } from '../../../decorators/roles.decorator';
import { UserRole } from '../../../enums/user-role.enum';

@ApiTags('Containers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('containers')
export class ContainerController {
  constructor(private readonly containerService: ContainerService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.DISPATCHER, UserRole.GATE_OPERATOR)
  @ApiOperation({ summary: 'Создать новый контейнер' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Контейнер успешно создан',
    type: Container,
  })
  async create(@Body() createContainerDto: CreateContainerDto): Promise<Container> {
    return this.containerService.create(createContainerDto);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.DISPATCHER, UserRole.GATE_OPERATOR, UserRole.YARD_OPERATOR)
  @ApiOperation({ summary: 'Получить список всех контейнеров' })
  @ApiQuery({ name: 'page', required: false, description: 'Номер страницы' })
  @ApiQuery({ name: 'limit', required: false, description: 'Количество элементов на странице' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Список контейнеров получен',
  })
  async findAll(
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ): Promise<{
    containers: Container[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    return this.containerService.findAll(+page, +limit);
  }

  @Get('statistics')
  @Roles(UserRole.ADMIN, UserRole.DISPATCHER)
  @ApiOperation({ summary: 'Получить статистику по контейнерам' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Статистика получена',
  })
  async getStatistics(): Promise<{
    total: number;
    byType: Record<string, number>;
    bySize: Record<string, number>;
    byStatus: Record<string, number>;
  }> {
    return this.containerService.getContainerStatistics();
  }

  @Get('by-client/:clientId')
  @Roles(UserRole.ADMIN, UserRole.DISPATCHER, UserRole.GATE_OPERATOR)
  @ApiOperation({ summary: 'Получить контейнеры клиента' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Контейнеры клиента получены',
    type: [Container],
  })
  async findByClient(@Param('clientId') clientId: string): Promise<Container[]> {
    return this.containerService.findByClient(clientId);
  }

  @Get('by-status/:status')
  @Roles(UserRole.ADMIN, UserRole.DISPATCHER, UserRole.YARD_OPERATOR)
  @ApiOperation({ summary: 'Получить контейнеры по статусу' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Контейнеры получены',
    type: [Container],
  })
  async findByStatus(@Param('status') status: string): Promise<Container[]> {
    return this.containerService.findByStatus(status);
  }

  @Get('by-number/:number')
  @Roles(UserRole.ADMIN, UserRole.DISPATCHER, UserRole.GATE_OPERATOR, UserRole.YARD_OPERATOR)
  @ApiOperation({ summary: 'Найти контейнер по номеру' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Контейнер найден',
    type: Container,
  })
  async findByNumber(@Param('number') number: string): Promise<Container> {
    return this.containerService.findByNumber(number);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.DISPATCHER, UserRole.GATE_OPERATOR, UserRole.YARD_OPERATOR)
  @ApiOperation({ summary: 'Получить контейнер по ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Контейнер найден',
    type: Container,
  })
  async findOne(@Param('id') id: string): Promise<Container> {
    return this.containerService.findOne(id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.DISPATCHER)
  @ApiOperation({ summary: 'Обновить контейнер' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Контейнер обновлен',
    type: Container,
  })
  async update(
    @Param('id') id: string,
    @Body() updateContainerDto: UpdateContainerDto,
  ): Promise<Container> {
    return this.containerService.update(id, updateContainerDto);
  }

  @Patch(':id/status')
  @Roles(UserRole.ADMIN, UserRole.DISPATCHER, UserRole.YARD_OPERATOR)
  @ApiOperation({ summary: 'Обновить статус контейнера' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Статус контейнера обновлен',
    type: Container,
  })
  async updateStatus(
    @Param('id') id: string,
    @Body('status') status: string,
  ): Promise<Container> {
    return this.containerService.updateStatus(id, status);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Удалить контейнер' })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Контейнер удален',
  })
  async remove(@Param('id') id: string): Promise<void> {
    return this.containerService.remove(id);
  }
}