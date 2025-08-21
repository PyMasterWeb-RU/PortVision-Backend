import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
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
} from '@nestjs/swagger';
import { GateService } from '../services/gate.service';
import { CreateGatePassDto, UpdateGatePassDto, FilterGatePassesDto } from '../dto';
import { GatePass } from '../entities/gate-pass.entity';
import { GateTransaction } from '../entities/gate-transaction.entity';
import { JwtAuthGuard } from '../../../guards/jwt-auth.guard';
import { RolesGuard } from '../../../guards/roles.guard';
import { Roles } from '../../../decorators/roles.decorator';

@ApiTags('Gate Operations')
@Controller('gate')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class GateController {
  constructor(private readonly gateService: GateService) {}

  @Post('passes')
  @ApiOperation({ summary: 'Создание пропуска на территорию' })
  @ApiResponse({
    status: 201,
    description: 'Пропуск успешно создан',
    type: GatePass,
  })
  @Roles('gate_operator', 'dispatcher', 'admin')
  async createPass(
    @Body() createGatePassDto: CreateGatePassDto,
    @Request() req: any
  ): Promise<GatePass> {
    return this.gateService.createPass(createGatePassDto, req.user.sub);
  }

  @Get('passes')
  @ApiOperation({ summary: 'Получение списка пропусков' })
  @ApiResponse({
    status: 200,
    description: 'Список пропусков получен',
  })
  @Roles('gate_operator', 'dispatcher', 'admin', 'viewer')
  async findAllPasses(@Query() filters: FilterGatePassesDto) {
    return this.gateService.findAllPasses(filters);
  }

  @Get('passes/:id')
  @ApiOperation({ summary: 'Получение пропуска по ID' })
  @ApiParam({ name: 'id', description: 'ID пропуска', format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: 'Пропуск найден',
    type: GatePass,
  })
  @Roles('gate_operator', 'dispatcher', 'admin', 'viewer')
  async findOnePass(@Param('id', ParseUUIDPipe) id: string): Promise<GatePass> {
    return this.gateService.findOnePass(id);
  }

  @Get('passes/number/:passNumber')
  @ApiOperation({ summary: 'Получение пропуска по номеру' })
  @ApiParam({ name: 'passNumber', description: 'Номер пропуска' })
  @ApiResponse({
    status: 200,
    description: 'Пропуск найден',
    type: GatePass,
  })
  @Roles('gate_operator', 'dispatcher', 'admin')
  async findPassByNumber(@Param('passNumber') passNumber: string): Promise<GatePass> {
    return this.gateService.findPassByNumber(passNumber);
  }

  @Get('passes/truck/:truckNumber')
  @ApiOperation({ summary: 'Получение активных пропусков для грузовика' })
  @ApiParam({ name: 'truckNumber', description: 'Номер грузовика' })
  @ApiResponse({
    status: 200,
    description: 'Пропуска найдены',
    type: [GatePass],
  })
  @Roles('gate_operator', 'dispatcher', 'admin')
  async findPassesByTruck(@Param('truckNumber') truckNumber: string): Promise<GatePass[]> {
    return this.gateService.findPassesByTruck(truckNumber);
  }

  @Post('passes/:id/entry')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Регистрация въезда по пропуску' })
  @ApiParam({ name: 'id', description: 'ID пропуска', format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: 'Въезд зарегистрирован',
    type: GateTransaction,
  })
  @Roles('gate_operator', 'admin')
  async processEntry(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { gateId: string; notes?: string; photos?: any },
    @Request() req: any
  ): Promise<GateTransaction> {
    return this.gateService.processEntry(id, body.gateId, req.user.sub, body.notes, body.photos);
  }

  @Post('passes/:id/exit')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Регистрация выезда по пропуску' })
  @ApiParam({ name: 'id', description: 'ID пропуска', format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: 'Выезд зарегистрирован',
    type: GateTransaction,
  })
  @Roles('gate_operator', 'admin')
  async processExit(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { gateId: string; notes?: string; photos?: any },
    @Request() req: any
  ): Promise<GateTransaction> {
    return this.gateService.processExit(id, body.gateId, req.user.sub, body.notes, body.photos);
  }

  @Post('passes/:id/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Отмена пропуска' })
  @ApiParam({ name: 'id', description: 'ID пропуска', format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: 'Пропуск отменен',
    type: GatePass,
  })
  @Roles('gate_operator', 'dispatcher', 'admin')
  async cancelPass(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { reason: string },
    @Request() req: any
  ): Promise<GatePass> {
    if (!body.reason) {
      throw new BadRequestException('Cancellation reason is required');
    }
    return this.gateService.cancelPass(id, body.reason, req.user.sub);
  }

  @Get('transactions')
  @ApiOperation({ summary: 'Получение истории транзакций ворот' })
  @ApiResponse({
    status: 200,
    description: 'История транзакций получена',
  })
  @Roles('gate_operator', 'dispatcher', 'admin', 'viewer')
  async findAllTransactions(@Query() filters: any) {
    return this.gateService.findAllTransactions(filters);
  }

  @Get('statistics')
  @ApiOperation({ summary: 'Получение статистики работы ворот' })
  @ApiResponse({
    status: 200,
    description: 'Статистика получена',
  })
  @Roles('dispatcher', 'admin', 'manager')
  async getStatistics(@Query() filters: any) {
    return this.gateService.getStatistics(filters);
  }

  @Post('validate-truck')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Валидация грузовика на въезде' })
  @ApiResponse({
    status: 200,
    description: 'Результат валидации',
    schema: {
      type: 'object',
      properties: {
        isValid: { type: 'boolean' },
        pass: { $ref: '#/components/schemas/GatePass' },
        violations: { type: 'array', items: { type: 'string' } },
      },
    },
  })
  @Roles('gate_operator', 'admin')
  async validateTruck(
    @Body() body: { 
      truckNumber: string; 
      containerNumber?: string; 
      gateId: string;
    }
  ) {
    return this.gateService.validateTruckEntry(
      body.truckNumber,
      body.containerNumber,
      body.gateId
    );
  }

  @Get('active-passes/truck/:truckNumber')
  @ApiOperation({ summary: 'Проверка активных пропусков для грузовика' })
  @ApiParam({ name: 'truckNumber', description: 'Номер грузовика' })
  @ApiResponse({
    status: 200,
    description: 'Статус доступа грузовика',
  })
  @Roles('gate_operator', 'admin')
  async checkTruckAccess(@Param('truckNumber') truckNumber: string) {
    return this.gateService.checkTruckAccess(truckNumber);
  }
}