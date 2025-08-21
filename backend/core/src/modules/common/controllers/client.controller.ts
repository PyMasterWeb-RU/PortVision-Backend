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

import { ClientService } from '../services/client.service';
import { CreateClientDto } from '../dto/create-client.dto';
import { UpdateClientDto } from '../dto/update-client.dto';
import { Client } from '../entities/client.entity';
import { JwtAuthGuard } from '../../../guards/jwt-auth.guard';
import { RolesGuard } from '../../../guards/roles.guard';
import { Roles } from '../../../decorators/roles.decorator';
import { UserRole } from '../../../enums/user-role.enum';

@ApiTags('Clients')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('clients')
export class ClientController {
  constructor(private readonly clientService: ClientService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.DISPATCHER)
  @ApiOperation({ summary: 'Создать нового клиента' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Клиент успешно создан',
    type: Client,
  })
  async create(@Body() createClientDto: CreateClientDto): Promise<Client> {
    return this.clientService.create(createClientDto);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.DISPATCHER, UserRole.GATE_OPERATOR)
  @ApiOperation({ summary: 'Получить список всех клиентов' })
  @ApiQuery({ name: 'page', required: false, description: 'Номер страницы' })
  @ApiQuery({ name: 'limit', required: false, description: 'Количество элементов на странице' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Список клиентов получен',
  })
  async findAll(
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ): Promise<{
    clients: Client[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    return this.clientService.findAll(+page, +limit);
  }

  @Get('search')
  @Roles(UserRole.ADMIN, UserRole.DISPATCHER, UserRole.GATE_OPERATOR)
  @ApiOperation({ summary: 'Поиск клиентов' })
  @ApiQuery({ name: 'q', required: true, description: 'Поисковый запрос' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Результаты поиска получены',
    type: [Client],
  })
  async search(@Query('q') query: string): Promise<Client[]> {
    return this.clientService.searchClients(query);
  }

  @Get('statistics')
  @Roles(UserRole.ADMIN, UserRole.DISPATCHER)
  @ApiOperation({ summary: 'Получить статистику по клиентам' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Статистика получена',
  })
  async getStatistics(): Promise<{
    total: number;
    byType: Record<string, number>;
    active: number;
    inactive: number;
  }> {
    return this.clientService.getClientStatistics();
  }

  @Get('by-type/:type')
  @Roles(UserRole.ADMIN, UserRole.DISPATCHER)
  @ApiOperation({ summary: 'Получить клиентов по типу' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Клиенты получены',
    type: [Client],
  })
  async findByType(@Param('type') type: string): Promise<Client[]> {
    return this.clientService.findByType(type);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.DISPATCHER, UserRole.GATE_OPERATOR)
  @ApiOperation({ summary: 'Получить клиента по ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Клиент найден',
    type: Client,
  })
  async findOne(@Param('id') id: string): Promise<Client> {
    return this.clientService.findOne(id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.DISPATCHER)
  @ApiOperation({ summary: 'Обновить клиента' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Клиент обновлен',
    type: Client,
  })
  async update(
    @Param('id') id: string,
    @Body() updateClientDto: UpdateClientDto,
  ): Promise<Client> {
    return this.clientService.update(id, updateClientDto);
  }

  @Patch(':id/activate')
  @Roles(UserRole.ADMIN, UserRole.DISPATCHER)
  @ApiOperation({ summary: 'Активировать клиента' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Клиент активирован',
    type: Client,
  })
  async activate(@Param('id') id: string): Promise<Client> {
    return this.clientService.activateClient(id);
  }

  @Patch(':id/deactivate')
  @Roles(UserRole.ADMIN, UserRole.DISPATCHER)
  @ApiOperation({ summary: 'Деактивировать клиента' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Клиент деактивирован',
    type: Client,
  })
  async deactivate(@Param('id') id: string): Promise<Client> {
    return this.clientService.deactivateClient(id);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Удалить клиента' })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Клиент удален',
  })
  async remove(@Param('id') id: string): Promise<void> {
    return this.clientService.remove(id);
  }
}