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
  Req,
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
  DigitalTwinService, 
  CreateTerminalViewDto, 
  UpdateTerminalViewDto,
  CreateTerminalObjectDto,
  UpdateTerminalObjectDto,
  DigitalTwinSearchFilters 
} from '../services/digital-twin.service';
import { TerminalView, ViewType, ViewStatus, ViewMode } from '../entities/terminal-view.entity';
import { TerminalObject, ObjectType, ObjectStatus, RenderMode } from '../entities/terminal-object.entity';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';

@ApiTags('digital-twin')
@ApiBearerAuth()
@Controller('digital-twin')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DigitalTwinController {
  constructor(private readonly digitalTwinService: DigitalTwinService) {}

  // Terminal Views Endpoints
  @Post('views')
  @Roles('ADMIN', 'MANAGER')
  @UsePipes(new ValidationPipe({ transform: true }))
  @ApiOperation({ summary: 'Создать новый вид терминала' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Вид терминала успешно создан',
    type: TerminalView,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Неверные данные',
  })
  async createTerminalView(
    @Body() createViewDto: CreateTerminalViewDto,
    @Req() req: any,
  ): Promise<TerminalView> {
    createViewDto.createdBy = req.user.sub;
    createViewDto.createdByName = req.user.name || req.user.email;
    return this.digitalTwinService.createTerminalView(createViewDto);
  }

  @Get('views')
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER')
  @ApiOperation({ summary: 'Получить список всех видов терминала' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Список видов получен',
    type: [TerminalView],
  })
  async getAllTerminalViews(): Promise<TerminalView[]> {
    return this.digitalTwinService.getAllTerminalViews();
  }

  @Get('views/public')
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER', 'YARD_OPERATOR', 'GATE_OPERATOR')
  @ApiOperation({ summary: 'Получить публичные виды терминала' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Публичные виды получены',
    type: [TerminalView],
  })
  async getPublicViews(): Promise<TerminalView[]> {
    return this.digitalTwinService.getPublicViews();
  }

  @Get('views/my')
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER', 'YARD_OPERATOR', 'GATE_OPERATOR')
  @ApiOperation({ summary: 'Получить мои виды терминала' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Пользовательские виды получены',
    type: [TerminalView],
  })
  async getUserViews(@Req() req: any): Promise<TerminalView[]> {
    return this.digitalTwinService.getUserViews(req.user.sub);
  }

  @Get('views/type/:viewType')
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER')
  @ApiOperation({ summary: 'Получить виды по типу' })
  @ApiParam({ name: 'viewType', enum: ViewType, description: 'Тип вида' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Виды по типу получены',
    type: [TerminalView],
  })
  async getViewsByType(@Param('viewType') viewType: ViewType): Promise<TerminalView[]> {
    return this.digitalTwinService.getViewsByType(viewType);
  }

  @Get('views/default/:viewType')
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER', 'YARD_OPERATOR', 'GATE_OPERATOR')
  @ApiOperation({ summary: 'Получить вид по умолчанию для типа' })
  @ApiParam({ name: 'viewType', enum: ViewType, description: 'Тип вида' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Вид по умолчанию найден',
    type: TerminalView,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Вид по умолчанию не найден',
  })
  async getDefaultView(@Param('viewType') viewType: ViewType): Promise<TerminalView | null> {
    return this.digitalTwinService.getDefaultView(viewType);
  }

  @Get('views/:id')
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER', 'YARD_OPERATOR', 'GATE_OPERATOR')
  @ApiOperation({ summary: 'Получить вид терминала по ID' })
  @ApiParam({ name: 'id', description: 'ID вида' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Вид найден',
    type: TerminalView,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Вид не найден',
  })
  async getTerminalViewById(@Param('id') id: string): Promise<TerminalView> {
    return this.digitalTwinService.getTerminalViewById(id);
  }

  @Put('views/:id')
  @Roles('ADMIN', 'MANAGER')
  @UsePipes(new ValidationPipe({ transform: true }))
  @ApiOperation({ summary: 'Обновить вид терминала' })
  @ApiParam({ name: 'id', description: 'ID вида' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Вид обновлен',
    type: TerminalView,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Вид не найден',
  })
  async updateTerminalView(
    @Param('id') id: string,
    @Body() updateViewDto: UpdateTerminalViewDto,
  ): Promise<TerminalView> {
    return this.digitalTwinService.updateTerminalView(id, updateViewDto);
  }

  @Put('views/:id/use')
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER', 'YARD_OPERATOR', 'GATE_OPERATOR')
  @ApiOperation({ summary: 'Зафиксировать использование вида' })
  @ApiParam({ name: 'id', description: 'ID вида' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Использование зафиксировано',
    type: TerminalView,
  })
  async recordViewUsage(@Param('id') id: string): Promise<TerminalView> {
    return this.digitalTwinService.recordViewUsage(id);
  }

  @Delete('views/:id')
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Удалить вид терминала' })
  @ApiParam({ name: 'id', description: 'ID вида' })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Вид удален',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Вид не найден',
  })
  async deleteTerminalView(@Param('id') id: string): Promise<void> {
    return this.digitalTwinService.deleteTerminalView(id);
  }

  // Terminal Objects Endpoints
  @Post('objects')
  @Roles('ADMIN', 'MANAGER')
  @UsePipes(new ValidationPipe({ transform: true }))
  @ApiOperation({ summary: 'Создать новый 3D объект терминала' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: '3D объект успешно создан',
    type: TerminalObject,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Неверные данные',
  })
  async createTerminalObject(@Body() createObjectDto: CreateTerminalObjectDto): Promise<TerminalObject> {
    return this.digitalTwinService.createTerminalObject(createObjectDto);
  }

  @Get('objects')
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER')
  @ApiOperation({ summary: 'Получить список всех 3D объектов' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Список объектов получен',
    type: [TerminalObject],
  })
  async getAllTerminalObjects(): Promise<TerminalObject[]> {
    return this.digitalTwinService.getAllTerminalObjects();
  }

  @Get('objects/search')
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER')
  @ApiOperation({ summary: 'Поиск 3D объектов по критериям' })
  @ApiQuery({ name: 'objectType', enum: ObjectType, required: false })
  @ApiQuery({ name: 'status', enum: ObjectStatus, required: false })
  @ApiQuery({ name: 'renderMode', enum: RenderMode, required: false })
  @ApiQuery({ name: 'entityType', type: String, required: false })
  @ApiQuery({ name: 'entityId', type: String, required: false })
  @ApiQuery({ name: 'isVisible', type: Boolean, required: false })
  @ApiQuery({ name: 'isInteractive', type: Boolean, required: false })
  @ApiQuery({ name: 'hasAnimations', type: Boolean, required: false })
  @ApiQuery({ name: 'hasPhysics', type: Boolean, required: false })
  @ApiQuery({ name: 'tags', type: String, required: false, description: 'Comma-separated tags' })
  @ApiQuery({ name: 'searchText', type: String, required: false })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Результаты поиска получены',
    type: [TerminalObject],
  })
  async searchObjects(@Query() query: any): Promise<TerminalObject[]> {
    const filters: DigitalTwinSearchFilters = {};

    if (query.objectType) filters.objectType = query.objectType;
    if (query.status) filters.status = query.status;
    if (query.renderMode) filters.renderMode = query.renderMode;
    if (query.entityType) filters.entityType = query.entityType;
    if (query.entityId) filters.entityId = query.entityId;
    if (query.isVisible !== undefined) filters.isVisible = query.isVisible === 'true';
    if (query.isInteractive !== undefined) filters.isInteractive = query.isInteractive === 'true';
    if (query.hasAnimations !== undefined) filters.hasAnimations = query.hasAnimations === 'true';
    if (query.hasPhysics !== undefined) filters.hasPhysics = query.hasPhysics === 'true';
    if (query.tags) filters.tags = query.tags.split(',').map(tag => tag.trim());
    if (query.searchText) filters.searchText = query.searchText;

    return this.digitalTwinService.searchObjects(filters);
  }

  @Get('objects/visible')
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER', 'YARD_OPERATOR', 'GATE_OPERATOR')
  @ApiOperation({ summary: 'Получить видимые 3D объекты' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Видимые объекты получены',
    type: [TerminalObject],
  })
  async getVisibleObjects(): Promise<TerminalObject[]> {
    return this.digitalTwinService.getVisibleObjects();
  }

  @Get('objects/type/:objectType')
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER')
  @ApiOperation({ summary: 'Получить объекты по типу' })
  @ApiParam({ name: 'objectType', enum: ObjectType, description: 'Тип объекта' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Объекты по типу получены',
    type: [TerminalObject],
  })
  async getObjectsByType(@Param('objectType') objectType: ObjectType): Promise<TerminalObject[]> {
    return this.digitalTwinService.getObjectsByType(objectType);
  }

  @Get('objects/entity/:entityType/:entityId')
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER')
  @ApiOperation({ summary: 'Получить объекты сущности' })
  @ApiParam({ name: 'entityType', description: 'Тип сущности' })
  @ApiParam({ name: 'entityId', description: 'ID сущности' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Объекты сущности получены',
    type: [TerminalObject],
  })
  async getObjectsByEntity(
    @Param('entityType') entityType: string,
    @Param('entityId') entityId: string,
  ): Promise<TerminalObject[]> {
    return this.digitalTwinService.getObjectsByEntity(entityType, entityId);
  }

  @Get('objects/bounds')
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER', 'YARD_OPERATOR', 'GATE_OPERATOR')
  @ApiOperation({ summary: 'Получить объекты в заданных границах' })
  @ApiQuery({ name: 'minX', type: Number, required: true })
  @ApiQuery({ name: 'maxX', type: Number, required: true })
  @ApiQuery({ name: 'minY', type: Number, required: true })
  @ApiQuery({ name: 'maxY', type: Number, required: true })
  @ApiQuery({ name: 'minZ', type: Number, required: false })
  @ApiQuery({ name: 'maxZ', type: Number, required: false })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Объекты в границах получены',
    type: [TerminalObject],
  })
  async getObjectsInBounds(@Query() query: any): Promise<TerminalObject[]> {
    const bounds = {
      minX: parseFloat(query.minX),
      maxX: parseFloat(query.maxX),
      minY: parseFloat(query.minY),
      maxY: parseFloat(query.maxY),
      minZ: query.minZ ? parseFloat(query.minZ) : undefined,
      maxZ: query.maxZ ? parseFloat(query.maxZ) : undefined,
    };

    return this.digitalTwinService.getObjectsInBounds(bounds);
  }

  @Get('objects/:id')
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER', 'YARD_OPERATOR', 'GATE_OPERATOR')
  @ApiOperation({ summary: 'Получить 3D объект по ID' })
  @ApiParam({ name: 'id', description: 'ID объекта' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Объект найден',
    type: TerminalObject,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Объект не найден',
  })
  async getTerminalObjectById(@Param('id') id: string): Promise<TerminalObject> {
    return this.digitalTwinService.getTerminalObjectById(id);
  }

  @Put('objects/:id')
  @Roles('ADMIN', 'MANAGER')
  @UsePipes(new ValidationPipe({ transform: true }))
  @ApiOperation({ summary: 'Обновить 3D объект' })
  @ApiParam({ name: 'id', description: 'ID объекта' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Объект обновлен',
    type: TerminalObject,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Объект не найден',
  })
  async updateTerminalObject(
    @Param('id') id: string,
    @Body() updateObjectDto: UpdateTerminalObjectDto,
  ): Promise<TerminalObject> {
    return this.digitalTwinService.updateTerminalObject(id, updateObjectDto);
  }

  @Put('objects/:id/position')
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER')
  @ApiOperation({ summary: 'Обновить позицию объекта' })
  @ApiParam({ name: 'id', description: 'ID объекта' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Позиция объекта обновлена',
    type: TerminalObject,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Нельзя перемещать статический объект',
  })
  async updateObjectPosition(
    @Param('id') id: string,
    @Body() position: { x: number; y: number; z: number },
  ): Promise<TerminalObject> {
    return this.digitalTwinService.updateObjectPosition(id, position);
  }

  @Put('objects/:id/visibility')
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER')
  @ApiOperation({ summary: 'Обновить видимость объекта' })
  @ApiParam({ name: 'id', description: 'ID объекта' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Видимость объекта обновлена',
    type: TerminalObject,
  })
  async updateObjectVisibility(
    @Param('id') id: string,
    @Body() body: { isVisible: boolean },
  ): Promise<TerminalObject> {
    return this.digitalTwinService.updateObjectVisibility(id, body.isVisible);
  }

  @Put('objects/:childId/parent/:parentId')
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Установить родительский объект' })
  @ApiParam({ name: 'childId', description: 'ID дочернего объекта' })
  @ApiParam({ name: 'parentId', description: 'ID родительского объекта (null для удаления)' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Родительский объект установлен',
    type: TerminalObject,
  })
  async setObjectParent(
    @Param('childId') childId: string,
    @Param('parentId') parentId: string,
  ): Promise<TerminalObject> {
    const actualParentId = parentId === 'null' ? null : parentId;
    return this.digitalTwinService.setObjectParent(childId, actualParentId);
  }

  @Delete('objects/:id')
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Удалить 3D объект' })
  @ApiParam({ name: 'id', description: 'ID объекта' })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Объект удален',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Объект не найден',
  })
  async deleteTerminalObject(@Param('id') id: string): Promise<void> {
    return this.digitalTwinService.deleteTerminalObject(id);
  }

  // Statistics Endpoint
  @Get('statistics')
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Получить статистику Digital Twin' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Статистика получена',
  })
  async getDigitalTwinStatistics() {
    return this.digitalTwinService.getDigitalTwinStatistics();
  }
}