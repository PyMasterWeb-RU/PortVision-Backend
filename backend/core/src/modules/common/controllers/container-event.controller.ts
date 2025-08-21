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

import { ContainerEventService } from '../services/container-event.service';
import { CreateContainerEventDto } from '../dto/create-container-event.dto';
import { UpdateContainerEventDto } from '../dto/update-container-event.dto';
import { ContainerEvent } from '../entities/container-event.entity';
import { JwtAuthGuard } from '../../../guards/jwt-auth.guard';
import { RolesGuard } from '../../../guards/roles.guard';
import { Roles } from '../../../decorators/roles.decorator';
import { UserRole } from '../../../enums/user-role.enum';

@ApiTags('Container Events')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('container-events')
export class ContainerEventController {
  constructor(private readonly containerEventService: ContainerEventService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.DISPATCHER, UserRole.GATE_OPERATOR, UserRole.YARD_OPERATOR)
  @ApiOperation({ summary: 'Создать новое событие контейнера' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Событие успешно создано',
    type: ContainerEvent,
  })
  async create(@Body() createContainerEventDto: CreateContainerEventDto): Promise<ContainerEvent> {
    return this.containerEventService.create(createContainerEventDto);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.DISPATCHER, UserRole.GATE_OPERATOR, UserRole.YARD_OPERATOR)
  @ApiOperation({ summary: 'Получить список всех событий контейнеров' })
  @ApiQuery({ name: 'page', required: false, description: 'Номер страницы' })
  @ApiQuery({ name: 'limit', required: false, description: 'Количество элементов на странице' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Список событий получен',
  })
  async findAll(
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ): Promise<{
    events: ContainerEvent[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    return this.containerEventService.findAll(+page, +limit);
  }

  @Get('statistics')
  @Roles(UserRole.ADMIN, UserRole.DISPATCHER)
  @ApiOperation({ summary: 'Получить статистику по событиям' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Статистика получена',
  })
  async getStatistics(): Promise<{
    total: number;
    byType: Record<string, number>;
    last24Hours: number;
    last7Days: number;
  }> {
    return this.containerEventService.getEventStatistics();
  }

  @Get('by-container/:containerId')
  @Roles(UserRole.ADMIN, UserRole.DISPATCHER, UserRole.GATE_OPERATOR, UserRole.YARD_OPERATOR)
  @ApiOperation({ summary: 'Получить события контейнера' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'События контейнера получены',
    type: [ContainerEvent],
  })
  async findByContainer(@Param('containerId') containerId: string): Promise<ContainerEvent[]> {
    return this.containerEventService.findByContainer(containerId);
  }

  @Get('timeline/:containerId')
  @Roles(UserRole.ADMIN, UserRole.DISPATCHER, UserRole.GATE_OPERATOR, UserRole.YARD_OPERATOR)
  @ApiOperation({ summary: 'Получить временную линию контейнера' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Временная линия получена',
    type: [ContainerEvent],
  })
  async getContainerTimeline(@Param('containerId') containerId: string): Promise<ContainerEvent[]> {
    return this.containerEventService.getContainerTimeline(containerId);
  }

  @Get('by-type/:eventType')
  @Roles(UserRole.ADMIN, UserRole.DISPATCHER, UserRole.GATE_OPERATOR, UserRole.YARD_OPERATOR)
  @ApiOperation({ summary: 'Получить события по типу' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'События получены',
    type: [ContainerEvent],
  })
  async findByType(@Param('eventType') eventType: string): Promise<ContainerEvent[]> {
    return this.containerEventService.findByType(eventType);
  }

  @Get('by-date-range')
  @Roles(UserRole.ADMIN, UserRole.DISPATCHER)
  @ApiOperation({ summary: 'Получить события за период' })
  @ApiQuery({ name: 'startDate', required: true, description: 'Дата начала' })
  @ApiQuery({ name: 'endDate', required: true, description: 'Дата окончания' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'События получены',
    type: [ContainerEvent],
  })
  async findByDateRange(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ): Promise<ContainerEvent[]> {
    return this.containerEventService.findByDateRange(new Date(startDate), new Date(endDate));
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.DISPATCHER, UserRole.GATE_OPERATOR, UserRole.YARD_OPERATOR)
  @ApiOperation({ summary: 'Получить событие по ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Событие найдено',
    type: ContainerEvent,
  })
  async findOne(@Param('id') id: string): Promise<ContainerEvent> {
    return this.containerEventService.findOne(id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.DISPATCHER)
  @ApiOperation({ summary: 'Обновить событие' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Событие обновлено',
    type: ContainerEvent,
  })
  async update(
    @Param('id') id: string,
    @Body() updateContainerEventDto: UpdateContainerEventDto,
  ): Promise<ContainerEvent> {
    return this.containerEventService.update(id, updateContainerEventDto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Удалить событие' })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Событие удалено',
  })
  async remove(@Param('id') id: string): Promise<void> {
    return this.containerEventService.remove(id);
  }
}