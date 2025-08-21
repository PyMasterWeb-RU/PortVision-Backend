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
  OperatorService, 
  CreateOperatorDto, 
  UpdateOperatorDto, 
  OperatorSearchFilters,
  OperatorAvailabilityFilters 
} from '../services/operator.service';
import { Operator, OperatorStatus, EmploymentType, ShiftPattern } from '../entities/operator.entity';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';

@ApiTags('operators')
@ApiBearerAuth()
@Controller('operators')
@UseGuards(JwtAuthGuard, RolesGuard)
export class OperatorController {
  constructor(private readonly operatorService: OperatorService) {}

  @Post()
  @Roles('ADMIN', 'MANAGER')
  @UsePipes(new ValidationPipe({ transform: true }))
  @ApiOperation({ summary: 'Создать нового оператора' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Оператор успешно создан',
    type: Operator,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Неверные данные',
  })
  async createOperator(@Body() createOperatorDto: CreateOperatorDto): Promise<Operator> {
    return this.operatorService.createOperator(createOperatorDto);
  }

  @Get()
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER')
  @ApiOperation({ summary: 'Получить список всех операторов' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Список операторов получен',
    type: [Operator],
  })
  async getAllOperators(): Promise<Operator[]> {
    return this.operatorService.getAllOperators();
  }

  @Get('search')
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER')
  @ApiOperation({ summary: 'Поиск операторов по критериям' })
  @ApiQuery({ name: 'status', enum: OperatorStatus, required: false })
  @ApiQuery({ name: 'employmentType', enum: EmploymentType, required: false })
  @ApiQuery({ name: 'departmentId', type: String, required: false })
  @ApiQuery({ name: 'positionId', type: String, required: false })
  @ApiQuery({ name: 'supervisorId', type: String, required: false })
  @ApiQuery({ name: 'shiftPattern', enum: ShiftPattern, required: false })
  @ApiQuery({ name: 'skillsRequired', type: [String], required: false })
  @ApiQuery({ name: 'equipmentQualified', type: [String], required: false })
  @ApiQuery({ name: 'availabilityStatus', type: String, required: false })
  @ApiQuery({ name: 'locationZone', type: String, required: false })
  @ApiQuery({ name: 'hireDateAfter', type: Date, required: false })
  @ApiQuery({ name: 'hireDateBefore', type: Date, required: false })
  @ApiQuery({ name: 'performanceRatingMin', type: Number, required: false })
  @ApiQuery({ name: 'performanceRatingMax', type: Number, required: false })
  @ApiQuery({ name: 'experienceYearsMin', type: Number, required: false })
  @ApiQuery({ name: 'experienceYearsMax', type: Number, required: false })
  @ApiQuery({ name: 'searchText', type: String, required: false })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Результаты поиска получены',
    type: [Operator],
  })
  async searchOperators(@Query() query: any): Promise<Operator[]> {
    const filters: OperatorSearchFilters = {};

    if (query.status) filters.status = query.status;
    if (query.employmentType) filters.employmentType = query.employmentType;
    if (query.departmentId) filters.departmentId = query.departmentId;
    if (query.positionId) filters.positionId = query.positionId;
    if (query.supervisorId) filters.supervisorId = query.supervisorId;
    if (query.shiftPattern) filters.shiftPattern = query.shiftPattern;
    if (query.skillsRequired) {
      filters.skillsRequired = Array.isArray(query.skillsRequired) 
        ? query.skillsRequired 
        : [query.skillsRequired];
    }
    if (query.equipmentQualified) {
      filters.equipmentQualified = Array.isArray(query.equipmentQualified)
        ? query.equipmentQualified
        : [query.equipmentQualified];
    }
    if (query.availabilityStatus) filters.availabilityStatus = query.availabilityStatus;
    if (query.locationZone) filters.locationZone = query.locationZone;
    if (query.hireDateAfter) filters.hireDateAfter = new Date(query.hireDateAfter);
    if (query.hireDateBefore) filters.hireDateBefore = new Date(query.hireDateBefore);
    if (query.performanceRatingMin || query.performanceRatingMax) {
      filters.performanceRating = {
        min: query.performanceRatingMin ? parseFloat(query.performanceRatingMin) : 0,
        max: query.performanceRatingMax ? parseFloat(query.performanceRatingMax) : 10,
      };
    }
    if (query.experienceYearsMin || query.experienceYearsMax) {
      filters.experienceYears = {
        min: query.experienceYearsMin ? parseInt(query.experienceYearsMin) : 0,
        max: query.experienceYearsMax ? parseInt(query.experienceYearsMax) : 50,
      };
    }
    if (query.searchText) filters.searchText = query.searchText;

    return this.operatorService.searchOperators(filters);
  }

  @Get('available')
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER')
  @ApiOperation({ summary: 'Получить доступных операторов' })
  @ApiQuery({ name: 'startTime', type: Date, required: true })
  @ApiQuery({ name: 'endTime', type: Date, required: true })
  @ApiQuery({ name: 'requiredSkills', type: [String], required: false })
  @ApiQuery({ name: 'equipmentTypes', type: [String], required: false })
  @ApiQuery({ name: 'locationZone', type: String, required: false })
  @ApiQuery({ name: 'shiftPattern', enum: ShiftPattern, required: false })
  @ApiQuery({ name: 'excludeOperatorIds', type: [String], required: false })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Доступные операторы получены',
    type: [Operator],
  })
  async getAvailableOperators(@Query() query: any): Promise<Operator[]> {
    const filters: OperatorAvailabilityFilters = {
      startTime: new Date(query.startTime),
      endTime: new Date(query.endTime),
    };

    if (query.requiredSkills) {
      filters.requiredSkills = Array.isArray(query.requiredSkills) 
        ? query.requiredSkills 
        : [query.requiredSkills];
    }
    if (query.equipmentTypes) {
      filters.equipmentTypes = Array.isArray(query.equipmentTypes)
        ? query.equipmentTypes
        : [query.equipmentTypes];
    }
    if (query.locationZone) filters.locationZone = query.locationZone;
    if (query.shiftPattern) filters.shiftPattern = query.shiftPattern;
    if (query.excludeOperatorIds) {
      filters.excludeOperatorIds = Array.isArray(query.excludeOperatorIds)
        ? query.excludeOperatorIds
        : [query.excludeOperatorIds];
    }

    return this.operatorService.getAvailableOperators(filters);
  }

  @Get('statistics')
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER')
  @ApiOperation({ summary: 'Получить статистику операторов' })
  @ApiQuery({ name: 'period', type: Number, required: false, description: 'Период в днях' })
  @ApiQuery({ name: 'departmentId', type: String, required: false })
  @ApiQuery({ name: 'supervisorId', type: String, required: false })
  @ApiQuery({ name: 'positionId', type: String, required: false })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Статистика операторов получена',
  })
  async getOperatorStatistics(@Query() query: any) {
    const filters: any = {};
    if (query.period) filters.period = parseInt(query.period);
    if (query.departmentId) filters.departmentId = query.departmentId;
    if (query.supervisorId) filters.supervisorId = query.supervisorId;
    if (query.positionId) filters.positionId = query.positionId;

    return this.operatorService.getOperatorStatistics(filters);
  }

  @Get('status/:status')
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER')
  @ApiOperation({ summary: 'Получить операторов по статусу' })
  @ApiParam({ name: 'status', enum: OperatorStatus, description: 'Статус оператора' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Операторы по статусу получены',
    type: [Operator],
  })
  async getOperatorsByStatus(@Param('status') status: OperatorStatus): Promise<Operator[]> {
    return this.operatorService.getOperatorsByStatus(status);
  }

  @Get('department/:departmentId')
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER')
  @ApiOperation({ summary: 'Получить операторов подразделения' })
  @ApiParam({ name: 'departmentId', description: 'ID подразделения' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Операторы подразделения получены',
    type: [Operator],
  })
  async getOperatorsByDepartment(@Param('departmentId') departmentId: string): Promise<Operator[]> {
    return this.operatorService.getOperatorsByDepartment(departmentId);
  }

  @Get('supervisor/:supervisorId')
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER')
  @ApiOperation({ summary: 'Получить операторов супервайзера' })
  @ApiParam({ name: 'supervisorId', description: 'ID супервайзера' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Операторы супервайзера получены',
    type: [Operator],
  })
  async getOperatorsBySupervisor(@Param('supervisorId') supervisorId: string): Promise<Operator[]> {
    return this.operatorService.getOperatorsBySupervisor(supervisorId);
  }

  @Get('email/:email')
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER')
  @ApiOperation({ summary: 'Получить оператора по email' })
  @ApiParam({ name: 'email', description: 'Email оператора' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Оператор найден',
    type: Operator,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Оператор не найден',
  })
  async getOperatorByEmail(@Param('email') email: string): Promise<Operator> {
    return this.operatorService.getOperatorByEmail(email);
  }

  @Get('number/:operatorNumber')
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER')
  @ApiOperation({ summary: 'Получить оператора по табельному номеру' })
  @ApiParam({ name: 'operatorNumber', description: 'Табельный номер оператора' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Оператор найден',
    type: Operator,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Оператор не найден',
  })
  async getOperatorByNumber(@Param('operatorNumber') operatorNumber: string): Promise<Operator> {
    return this.operatorService.getOperatorByNumber(operatorNumber);
  }

  @Get(':id')
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER', 'YARD_OPERATOR')
  @ApiOperation({ summary: 'Получить оператора по ID' })
  @ApiParam({ name: 'id', description: 'ID оператора' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Оператор найден',
    type: Operator,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Оператор не найден',
  })
  async getOperatorById(@Param('id') id: string): Promise<Operator> {
    return this.operatorService.getOperatorById(id);
  }

  @Put(':id')
  @Roles('ADMIN', 'MANAGER')
  @UsePipes(new ValidationPipe({ transform: true }))
  @ApiOperation({ summary: 'Обновить оператора' })
  @ApiParam({ name: 'id', description: 'ID оператора' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Оператор обновлен',
    type: Operator,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Оператор не найден',
  })
  async updateOperator(
    @Param('id') id: string,
    @Body() updateOperatorDto: UpdateOperatorDto,
  ): Promise<Operator> {
    return this.operatorService.updateOperator(id, updateOperatorDto);
  }

  @Delete(':id')
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Удалить оператора' })
  @ApiParam({ name: 'id', description: 'ID оператора' })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Оператор удален',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Оператор не найден',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Нельзя удалить активного оператора',
  })
  async deleteOperator(@Param('id') id: string): Promise<void> {
    return this.operatorService.deleteOperator(id);
  }

  @Put(':id/status')
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Обновить статус оператора' })
  @ApiParam({ name: 'id', description: 'ID оператора' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Статус оператора обновлен',
    type: Operator,
  })
  async updateOperatorStatus(
    @Param('id') id: string,
    @Body() body: {
      status: OperatorStatus;
      reason?: string;
    },
  ): Promise<Operator> {
    return this.operatorService.updateOperatorStatus(id, body.status, body.reason);
  }

  @Put(':id/location')
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER', 'YARD_OPERATOR')
  @ApiOperation({ summary: 'Обновить местоположение оператора' })
  @ApiParam({ name: 'id', description: 'ID оператора' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Местоположение оператора обновлено',
    type: Operator,
  })
  async updateOperatorLocation(
    @Param('id') id: string,
    @Body() location: {
      latitude: number;
      longitude: number;
      zone?: string;
      accuracy?: number;
    },
  ): Promise<Operator> {
    return this.operatorService.updateOperatorLocation(id, location);
  }

  @Put(':id/availability')
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER', 'YARD_OPERATOR')
  @ApiOperation({ summary: 'Обновить доступность оператора' })
  @ApiParam({ name: 'id', description: 'ID оператора' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Доступность оператора обновлена',
    type: Operator,
  })
  async updateOperatorAvailability(
    @Param('id') id: string,
    @Body() availability: {
      isAvailable: boolean;
      reason?: string;
      availableFrom?: Date;
    },
  ): Promise<Operator> {
    return this.operatorService.updateOperatorAvailability(id, availability);
  }

  @Post(':id/qualifications')
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Добавить квалификацию оператору' })
  @ApiParam({ name: 'id', description: 'ID оператора' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Квалификация добавлена',
    type: Operator,
  })
  async addSkillQualification(
    @Param('id') id: string,
    @Body() qualification: {
      equipmentType: string;
      proficiencyLevel: 'beginner' | 'intermediate' | 'advanced' | 'expert';
      certifiedDate: Date;
      expiresDate?: Date;
      instructorId?: string;
    },
  ): Promise<Operator> {
    return this.operatorService.addSkillQualification(id, qualification);
  }

  @Post(':id/certifications')
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Добавить сертификат оператору' })
  @ApiParam({ name: 'id', description: 'ID оператора' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Сертификат добавлен',
    type: Operator,
  })
  async addCertification(
    @Param('id') id: string,
    @Body() certification: {
      certificationType: string;
      certificateNumber: string;
      issuedBy: string;
      issuedDate: Date;
      expiresDate: Date;
      documentUrl?: string;
    },
  ): Promise<Operator> {
    return this.operatorService.addCertification(id, certification);
  }

  @Put(':id/performance')
  @Roles('ADMIN', 'MANAGER', 'DISPATCHER')
  @ApiOperation({ summary: 'Обновить метрики производительности' })
  @ApiParam({ name: 'id', description: 'ID оператора' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Метрики производительности обновлены',
    type: Operator,
  })
  async updatePerformanceMetrics(
    @Param('id') id: string,
    @Body() metrics: {
      hoursWorked?: number;
      tasksCompleted?: number;
      qualityScore?: number;
      productivityScore?: number;
      safetyScore?: number;
      customerSatisfaction?: number;
    },
  ): Promise<Operator> {
    return this.operatorService.updatePerformanceMetrics(id, metrics);
  }
}