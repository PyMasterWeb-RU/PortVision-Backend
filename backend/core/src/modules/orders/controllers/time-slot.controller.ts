import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
  Request,
  ParseUUIDPipe,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { TimeSlotService } from '../services/time-slot.service';
import {
  CreateTimeSlotDto,
  UpdateTimeSlotDto,
  FilterTimeSlotsDto,
  ReserveTimeSlotDto,
} from '../dto';
import { TimeSlot } from '../entities/time-slot.entity';
import { JwtAuthGuard } from '../../../guards/jwt-auth.guard';
import { RolesGuard } from '../../../guards/roles.guard';
import { Roles } from '../../../decorators/roles.decorator';

@ApiTags('Time Slots')
@Controller('time-slots')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class TimeSlotController {
  constructor(private readonly timeSlotService: TimeSlotService) {}

  @Post()
  @ApiOperation({ summary: 'Создание нового тайм-слота' })
  @ApiResponse({
    status: 201,
    description: 'Тайм-слот успешно создан',
    type: TimeSlot,
  })
  @ApiResponse({
    status: 400,
    description: 'Ошибка валидации данных или пересечение с существующим слотом',
  })
  @Roles('dispatcher', 'admin', 'manager')
  async create(
    @Body() createTimeSlotDto: CreateTimeSlotDto,
    @Request() req: any
  ): Promise<TimeSlot> {
    return this.timeSlotService.create(createTimeSlotDto, req.user.sub);
  }

  @Get()
  @ApiOperation({ summary: 'Получение списка тайм-слотов с фильтрацией' })
  @ApiResponse({
    status: 200,
    description: 'Список тайм-слотов получен',
    schema: {
      type: 'object',
      properties: {
        timeSlots: {
          type: 'array',
          items: { $ref: '#/components/schemas/TimeSlot' },
        },
        total: { type: 'number' },
        page: { type: 'number' },
        limit: { type: 'number' },
      },
    },
  })
  @Roles('dispatcher', 'admin', 'operator', 'viewer', 'client')
  async findAll(@Query() filters: FilterTimeSlotsDto): Promise<{
    timeSlots: TimeSlot[];
    total: number;
    page: number;
    limit: number;
  }> {
    return this.timeSlotService.findAll(filters);
  }

  @Get('available')
  @ApiOperation({ summary: 'Получение доступных тайм-слотов' })
  @ApiResponse({
    status: 200,
    description: 'Список доступных тайм-слотов',
    schema: {
      type: 'object',
      properties: {
        timeSlots: {
          type: 'array',
          items: { $ref: '#/components/schemas/TimeSlot' },
        },
        total: { type: 'number' },
      },
    },
  })
  @Roles('dispatcher', 'admin', 'operator', 'client')
  async findAvailable(@Query() filters: FilterTimeSlotsDto): Promise<{
    timeSlots: TimeSlot[];
    total: number;
  }> {
    return this.timeSlotService.findAvailable(filters);
  }

  @Get('statistics')
  @ApiOperation({ summary: 'Получение статистики тайм-слотов' })
  @ApiResponse({
    status: 200,
    description: 'Статистика тайм-слотов',
    schema: {
      type: 'object',
      properties: {
        total: { type: 'number' },
        byStatus: { type: 'object' },
        byType: { type: 'object' },
        utilizationRate: { type: 'number' },
        avgDuration: { type: 'number' },
      },
    },
  })
  @ApiQuery({ name: 'dateFrom', required: false, type: 'string', format: 'date-time' })
  @ApiQuery({ name: 'dateTo', required: false, type: 'string', format: 'date-time' })
  @Roles('dispatcher', 'admin', 'manager')
  async getStatistics(
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string
  ) {
    const dateFromParsed = dateFrom ? new Date(dateFrom) : undefined;
    const dateToParsed = dateTo ? new Date(dateTo) : undefined;
    
    return this.timeSlotService.getStatistics(dateFromParsed, dateToParsed);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Получение тайм-слота по ID' })
  @ApiParam({ name: 'id', description: 'ID тайм-слота', format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: 'Тайм-слот найден',
    type: TimeSlot,
  })
  @ApiResponse({
    status: 404,
    description: 'Тайм-слот не найден',
  })
  @Roles('dispatcher', 'admin', 'operator', 'viewer', 'client')
  async findOne(@Param('id', ParseUUIDPipe) id: string): Promise<TimeSlot> {
    return this.timeSlotService.findOne(id);
  }

  @Post(':id/reserve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Резервирование тайм-слота' })
  @ApiParam({ name: 'id', description: 'ID тайм-слота', format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: 'Тайм-слот зарезервирован',
    type: TimeSlot,
  })
  @ApiResponse({
    status: 400,
    description: 'Тайм-слот недоступен для резервирования или недостаточно места',
  })
  @ApiResponse({
    status: 404,
    description: 'Тайм-слот не найден',
  })
  @Roles('dispatcher', 'admin', 'operator', 'client')
  async reserve(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() reserveDto: ReserveTimeSlotDto,
    @Request() req: any
  ): Promise<TimeSlot> {
    return this.timeSlotService.reserve(id, reserveDto, req.user.sub);
  }

  @Post(':id/confirm')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Подтверждение тайм-слота' })
  @ApiParam({ name: 'id', description: 'ID тайм-слота', format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: 'Тайм-слот подтвержден',
    type: TimeSlot,
  })
  @ApiResponse({
    status: 400,
    description: 'Тайм-слот должен быть зарезервирован перед подтверждением',
  })
  @Roles('dispatcher', 'admin', 'operator')
  async confirm(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: any
  ): Promise<TimeSlot> {
    return this.timeSlotService.confirm(id, req.user.sub);
  }

  @Post(':id/start')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Начало выполнения тайм-слота' })
  @ApiParam({ name: 'id', description: 'ID тайм-слота', format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: 'Выполнение тайм-слота начато',
    type: TimeSlot,
  })
  @ApiResponse({
    status: 400,
    description: 'Тайм-слот должен быть подтвержден перед началом выполнения',
  })
  @Roles('dispatcher', 'admin', 'operator')
  async start(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: any
  ): Promise<TimeSlot> {
    return this.timeSlotService.start(id, req.user.sub);
  }

  @Post(':id/complete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Завершение тайм-слота' })
  @ApiParam({ name: 'id', description: 'ID тайм-слота', format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: 'Тайм-слот завершен',
    type: TimeSlot,
  })
  @ApiResponse({
    status: 400,
    description: 'Тайм-слот должен быть в процессе выполнения перед завершением',
  })
  @Roles('dispatcher', 'admin', 'operator')
  async complete(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: any
  ): Promise<TimeSlot> {
    return this.timeSlotService.complete(id, req.user.sub);
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Отмена тайм-слота' })
  @ApiParam({ name: 'id', description: 'ID тайм-слота', format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: 'Тайм-слот отменен',
    type: TimeSlot,
  })
  @ApiResponse({
    status: 400,
    description: 'Невозможно отменить завершенный тайм-слот',
  })
  @Roles('dispatcher', 'admin', 'operator', 'client')
  async cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { reason: string },
    @Request() req: any
  ): Promise<TimeSlot> {
    if (!body.reason) {
      throw new BadRequestException('Cancellation reason is required');
    }

    return this.timeSlotService.cancel(id, body.reason, req.user.sub);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Обновление тайм-слота' })
  @ApiParam({ name: 'id', description: 'ID тайм-слота', format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: 'Тайм-слот обновлен',
    type: TimeSlot,
  })
  @ApiResponse({
    status: 400,
    description: 'Ошибка валидации данных или невозможно обновить тайм-слот в текущем статусе',
  })
  @ApiResponse({
    status: 404,
    description: 'Тайм-слот не найден',
  })
  @Roles('dispatcher', 'admin', 'manager')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateTimeSlotDto: UpdateTimeSlotDto,
    @Request() req: any
  ): Promise<TimeSlot> {
    return this.timeSlotService.update(id, updateTimeSlotDto, req.user.sub);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Удаление тайм-слота' })
  @ApiParam({ name: 'id', description: 'ID тайм-слота', format: 'uuid' })
  @ApiResponse({
    status: 204,
    description: 'Тайм-слот удален',
  })
  @ApiResponse({
    status: 400,
    description: 'Невозможно удалить тайм-слот в использовании',
  })
  @ApiResponse({
    status: 404,
    description: 'Тайм-слот не найден',
  })
  @Roles('admin', 'manager')
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: any
  ): Promise<void> {
    // Сначала отменяем слот, затем помечаем как неактивный
    await this.timeSlotService.cancel(id, 'Слот удален администратором', req.user.sub);
  }
}