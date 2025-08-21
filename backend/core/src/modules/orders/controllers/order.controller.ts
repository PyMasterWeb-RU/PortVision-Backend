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
import { OrderService } from '../services/order.service';
import { CreateOrderDto, UpdateOrderDto, FilterOrdersDto } from '../dto';
import { Order, OrderStatus } from '../entities/order.entity';
import { JwtAuthGuard } from '../../../guards/jwt-auth.guard';
import { RolesGuard } from '../../../guards/roles.guard';
import { Roles } from '../../../decorators/roles.decorator';

@ApiTags('Orders')
@Controller('orders')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @Post()
  @ApiOperation({ summary: 'Создание новой заявки' })
  @ApiResponse({
    status: 201,
    description: 'Заявка успешно создана',
    type: Order,
  })
  @ApiResponse({
    status: 400,
    description: 'Ошибка валидации данных',
  })
  @Roles('dispatcher', 'admin', 'operator')
  async create(
    @Body() createOrderDto: CreateOrderDto,
    @Request() req: any
  ): Promise<Order> {
    return this.orderService.create(createOrderDto, req.user.sub);
  }

  @Get()
  @ApiOperation({ summary: 'Получение списка заявок с фильтрацией' })
  @ApiResponse({
    status: 200,
    description: 'Список заявок получен',
    schema: {
      type: 'object',
      properties: {
        orders: {
          type: 'array',
          items: { $ref: '#/components/schemas/Order' },
        },
        total: { type: 'number' },
        page: { type: 'number' },
        limit: { type: 'number' },
      },
    },
  })
  @Roles('dispatcher', 'admin', 'operator', 'viewer')
  async findAll(@Query() filters: FilterOrdersDto): Promise<{
    orders: Order[];
    total: number;
    page: number;
    limit: number;
  }> {
    return this.orderService.findAll(filters);
  }

  @Get('statistics')
  @ApiOperation({ summary: 'Получение статистики заявок' })
  @ApiResponse({
    status: 200,
    description: 'Статистика заявок',
    schema: {
      type: 'object',
      properties: {
        total: { type: 'number' },
        byStatus: { type: 'object' },
        byType: { type: 'object' },
        byPriority: { type: 'object' },
      },
    },
  })
  @Roles('dispatcher', 'admin', 'manager')
  async getStatistics() {
    return this.orderService.getStatistics();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Получение заявки по ID' })
  @ApiParam({ name: 'id', description: 'ID заявки', format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: 'Заявка найдена',
    type: Order,
  })
  @ApiResponse({
    status: 404,
    description: 'Заявка не найдена',
  })
  @Roles('dispatcher', 'admin', 'operator', 'viewer')
  async findOne(@Param('id', ParseUUIDPipe) id: string): Promise<Order> {
    return this.orderService.findOne(id);
  }

  @Get('number/:orderNumber')
  @ApiOperation({ summary: 'Получение заявки по номеру' })
  @ApiParam({ name: 'orderNumber', description: 'Номер заявки', example: 'ORD-2023-001234' })
  @ApiResponse({
    status: 200,
    description: 'Заявка найдена',
    type: Order,
  })
  @ApiResponse({
    status: 404,
    description: 'Заявка не найдена',
  })
  @Roles('dispatcher', 'admin', 'operator', 'viewer')
  async findByNumber(@Param('orderNumber') orderNumber: string): Promise<Order> {
    return this.orderService.findByNumber(orderNumber);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Обновление заявки' })
  @ApiParam({ name: 'id', description: 'ID заявки', format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: 'Заявка обновлена',
    type: Order,
  })
  @ApiResponse({
    status: 400,
    description: 'Ошибка валидации данных',
  })
  @ApiResponse({
    status: 404,
    description: 'Заявка не найдена',
  })
  @Roles('dispatcher', 'admin', 'operator')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateOrderDto: UpdateOrderDto,
    @Request() req: any
  ): Promise<Order> {
    return this.orderService.update(id, updateOrderDto, req.user.sub);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Изменение статуса заявки' })
  @ApiParam({ name: 'id', description: 'ID заявки', format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: 'Статус заявки изменен',
    type: Order,
  })
  @ApiResponse({
    status: 400,
    description: 'Некорректный переход статуса',
  })
  @ApiResponse({
    status: 404,
    description: 'Заявка не найдена',
  })
  @Roles('dispatcher', 'admin', 'operator')
  async changeStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { status: OrderStatus; comment?: string },
    @Request() req: any
  ): Promise<Order> {
    if (!body.status) {
      throw new BadRequestException('Status is required');
    }

    return this.orderService.changeStatus(id, body.status, req.user.sub, body.comment);
  }

  @Post(':id/submit')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Подача заявки (смена статуса на SUBMITTED)' })
  @ApiParam({ name: 'id', description: 'ID заявки', format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: 'Заявка подана',
    type: Order,
  })
  @Roles('dispatcher', 'admin', 'operator')
  async submit(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: any
  ): Promise<Order> {
    return this.orderService.changeStatus(id, OrderStatus.SUBMITTED, req.user.sub, 'Заявка подана');
  }

  @Post(':id/confirm')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Подтверждение заявки (смена статуса на CONFIRMED)' })
  @ApiParam({ name: 'id', description: 'ID заявки', format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: 'Заявка подтверждена',
    type: Order,
  })
  @Roles('dispatcher', 'admin', 'manager')
  async confirm(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: any
  ): Promise<Order> {
    return this.orderService.changeStatus(id, OrderStatus.CONFIRMED, req.user.sub, 'Заявка подтверждена');
  }

  @Post(':id/start')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Начало выполнения заявки (смена статуса на IN_PROGRESS)' })
  @ApiParam({ name: 'id', description: 'ID заявки', format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: 'Выполнение заявки начато',
    type: Order,
  })
  @Roles('dispatcher', 'admin', 'operator')
  async start(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: any
  ): Promise<Order> {
    return this.orderService.changeStatus(id, OrderStatus.IN_PROGRESS, req.user.sub, 'Выполнение начато');
  }

  @Post(':id/complete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Завершение заявки (смена статуса на COMPLETED)' })
  @ApiParam({ name: 'id', description: 'ID заявки', format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: 'Заявка завершена',
    type: Order,
  })
  @Roles('dispatcher', 'admin', 'operator')
  async complete(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: any
  ): Promise<Order> {
    return this.orderService.changeStatus(id, OrderStatus.COMPLETED, req.user.sub, 'Заявка завершена');
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Отмена заявки (смена статуса на CANCELLED)' })
  @ApiParam({ name: 'id', description: 'ID заявки', format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: 'Заявка отменена',
    type: Order,
  })
  @Roles('dispatcher', 'admin', 'manager')
  async cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { reason?: string },
    @Request() req: any
  ): Promise<Order> {
    return this.orderService.changeStatus(
      id,
      OrderStatus.CANCELLED,
      req.user.sub,
      body.reason || 'Заявка отменена'
    );
  }

  @Post(':id/hold')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Приостановка заявки (смена статуса на ON_HOLD)' })
  @ApiParam({ name: 'id', description: 'ID заявки', format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: 'Заявка приостановлена',
    type: Order,
  })
  @Roles('dispatcher', 'admin', 'manager')
  async hold(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { reason?: string },
    @Request() req: any
  ): Promise<Order> {
    return this.orderService.changeStatus(
      id,
      OrderStatus.ON_HOLD,
      req.user.sub,
      body.reason || 'Заявка приостановлена'
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Мягкое удаление заявки' })
  @ApiParam({ name: 'id', description: 'ID заявки', format: 'uuid' })
  @ApiResponse({
    status: 204,
    description: 'Заявка удалена',
  })
  @ApiResponse({
    status: 400,
    description: 'Невозможно удалить заявку в процессе выполнения',
  })
  @ApiResponse({
    status: 404,
    description: 'Заявка не найдена',
  })
  @Roles('admin', 'manager')
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: any
  ): Promise<void> {
    return this.orderService.remove(id, req.user.sub);
  }
}