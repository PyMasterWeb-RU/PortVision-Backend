import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  HttpStatus,
  HttpException,
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
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { WebSocketService, UpdateConnectionDto } from '../services/websocket.service';
import { WebSocketConnection } from '../entities/websocket-connection.entity';

@ApiTags('WebSocket Connections')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('websocket')
export class WebSocketController {
  constructor(private readonly webSocketService: WebSocketService) {}

  @Get('connections')
  @ApiOperation({ 
    summary: 'Получить список всех WebSocket соединений',
    description: 'Возвращает список активных и неактивных WebSocket соединений с возможностью фильтрации',
  })
  @ApiQuery({ name: 'status', required: false, description: 'Статус соединения для фильтрации' })
  @ApiQuery({ name: 'userId', required: false, description: 'ID пользователя для фильтрации' })
  @ApiQuery({ name: 'role', required: false, description: 'Роль пользователя для фильтрации' })
  @ApiQuery({ name: 'clientType', required: false, description: 'Тип клиента для фильтрации' })
  @ApiResponse({ 
    status: 200, 
    description: 'Список соединений получен успешно',
    type: [WebSocketConnection],
  })
  async getConnections(
    @Query('status') status?: string,
    @Query('userId') userId?: string,
    @Query('role') role?: string,
    @Query('clientType') clientType?: string,
  ): Promise<WebSocketConnection[]> {
    try {
      if (userId) {
        return await this.webSocketService.getConnectionsByUser(userId);
      }
      
      if (role) {
        return await this.webSocketService.getConnectionsByRole(role);
      }
      
      if (status) {
        if (status === 'active') {
          return await this.webSocketService.getActiveConnections();
        }
        // Для других статусов можно добавить дополнительные фильтры
      }
      
      return await this.webSocketService.getActiveConnections();
    } catch (error) {
      throw new HttpException(
        `Ошибка получения соединений: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('connections/:socketId')
  @ApiOperation({ 
    summary: 'Получить информацию о конкретном WebSocket соединении',
    description: 'Возвращает подробную информацию о WebSocket соединении по его ID',
  })
  @ApiParam({ name: 'socketId', description: 'ID WebSocket соединения' })
  @ApiResponse({ 
    status: 200, 
    description: 'Информация о соединении получена успешно',
    type: WebSocketConnection,
  })
  @ApiResponse({ 
    status: 404, 
    description: 'Соединение не найдено',
  })
  async getConnection(@Param('socketId') socketId: string): Promise<WebSocketConnection> {
    try {
      const connection = await this.webSocketService.getConnection(socketId);
      
      if (!connection) {
        throw new HttpException(
          `Соединение ${socketId} не найдено`,
          HttpStatus.NOT_FOUND,
        );
      }
      
      return connection;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      
      throw new HttpException(
        `Ошибка получения соединения: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Put('connections/:socketId')
  @ApiOperation({ 
    summary: 'Обновить информацию о WebSocket соединении',
    description: 'Обновляет метаданные, настройки или статус WebSocket соединения',
  })
  @ApiParam({ name: 'socketId', description: 'ID WebSocket соединения' })
  @ApiResponse({ 
    status: 200, 
    description: 'Соединение обновлено успешно',
    type: WebSocketConnection,
  })
  @ApiResponse({ 
    status: 404, 
    description: 'Соединение не найдено',
  })
  async updateConnection(
    @Param('socketId') socketId: string,
    @Body() updateData: UpdateConnectionDto,
  ): Promise<WebSocketConnection> {
    try {
      return await this.webSocketService.updateConnection(socketId, updateData);
    } catch (error) {
      if (error.message.includes('not found')) {
        throw new HttpException(error.message, HttpStatus.NOT_FOUND);
      }
      
      throw new HttpException(
        `Ошибка обновления соединения: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Delete('connections/:socketId')
  @ApiOperation({ 
    summary: 'Принудительно отключить WebSocket соединение',
    description: 'Отключает WebSocket соединение и обновляет его статус в базе данных',
  })
  @ApiParam({ name: 'socketId', description: 'ID WebSocket соединения' })
  @ApiResponse({ 
    status: 200, 
    description: 'Соединение отключено успешно',
  })
  async disconnectConnection(@Param('socketId') socketId: string): Promise<{ message: string }> {
    try {
      await this.webSocketService.disconnectConnection(socketId);
      return { message: `Соединение ${socketId} отключено` };
    } catch (error) {
      throw new HttpException(
        `Ошибка отключения соединения: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('connections/:socketId/rooms')
  @ApiOperation({ 
    summary: 'Получить список комнат WebSocket соединения',
    description: 'Возвращает список комнат, к которым подключено WebSocket соединение',
  })
  @ApiParam({ name: 'socketId', description: 'ID WebSocket соединения' })
  @ApiResponse({ 
    status: 200, 
    description: 'Список комнат получен успешно',
  })
  async getConnectionRooms(@Param('socketId') socketId: string): Promise<{ rooms: string[] }> {
    try {
      const connection = await this.webSocketService.getConnection(socketId);
      
      if (!connection) {
        throw new HttpException(
          `Соединение ${socketId} не найдено`,
          HttpStatus.NOT_FOUND,
        );
      }
      
      return { rooms: connection.rooms };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      
      throw new HttpException(
        `Ошибка получения комнат соединения: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('connections/:socketId/rooms/:roomName')
  @ApiOperation({ 
    summary: 'Добавить WebSocket соединение в комнату',
    description: 'Добавляет WebSocket соединение в указанную комнату для группового обмена сообщениями',
  })
  @ApiParam({ name: 'socketId', description: 'ID WebSocket соединения' })
  @ApiParam({ name: 'roomName', description: 'Название комнаты' })
  @ApiResponse({ 
    status: 200, 
    description: 'Соединение добавлено в комнату успешно',
  })
  async addConnectionToRoom(
    @Param('socketId') socketId: string,
    @Param('roomName') roomName: string,
  ): Promise<{ message: string }> {
    try {
      await this.webSocketService.addConnectionToRoom(socketId, roomName);
      return { message: `Соединение ${socketId} добавлено в комнату ${roomName}` };
    } catch (error) {
      throw new HttpException(
        `Ошибка добавления соединения в комнату: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Delete('connections/:socketId/rooms/:roomName')
  @ApiOperation({ 
    summary: 'Удалить WebSocket соединение из комнаты',
    description: 'Удаляет WebSocket соединение из указанной комнаты',
  })
  @ApiParam({ name: 'socketId', description: 'ID WebSocket соединения' })
  @ApiParam({ name: 'roomName', description: 'Название комнаты' })
  @ApiResponse({ 
    status: 200, 
    description: 'Соединение удалено из комнаты успешно',
  })
  async removeConnectionFromRoom(
    @Param('socketId') socketId: string,
    @Param('roomName') roomName: string,
  ): Promise<{ message: string }> {
    try {
      await this.webSocketService.removeConnectionFromRoom(socketId, roomName);
      return { message: `Соединение ${socketId} удалено из комнаты ${roomName}` };
    } catch (error) {
      throw new HttpException(
        `Ошибка удаления соединения из комнаты: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('rooms/:roomName/connections')
  @ApiOperation({ 
    summary: 'Получить список соединений в комнате',
    description: 'Возвращает список всех WebSocket соединений в указанной комнате',
  })
  @ApiParam({ name: 'roomName', description: 'Название комнаты' })
  @ApiResponse({ 
    status: 200, 
    description: 'Список соединений в комнате получен успешно',
    type: [WebSocketConnection],
  })
  async getConnectionsInRoom(@Param('roomName') roomName: string): Promise<WebSocketConnection[]> {
    try {
      return await this.webSocketService.getConnectionsInRoom(roomName);
    } catch (error) {
      throw new HttpException(
        `Ошибка получения соединений в комнате: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('statistics')
  @ApiOperation({ 
    summary: 'Получить статистику WebSocket соединений',
    description: 'Возвращает подробную статистику о WebSocket соединениях, включая количество активных соединений, метрики производительности и разбивки по типам',
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Статистика получена успешно',
  })
  async getStatistics(): Promise<any> {
    try {
      return await this.webSocketService.getConnectionStatistics();
    } catch (error) {
      throw new HttpException(
        `Ошибка получения статистики: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('health')
  @ApiOperation({ 
    summary: 'Проверить здоровье WebSocket соединений',
    description: 'Возвращает информацию о состоянии WebSocket соединений, включая количество здоровых и проблемных соединений',
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Информация о здоровье получена успешно',
  })
  async getConnectionHealth(): Promise<any> {
    try {
      return await this.webSocketService.checkConnectionHealth();
    } catch (error) {
      throw new HttpException(
        `Ошибка проверки здоровья соединений: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('high-latency')
  @ApiOperation({ 
    summary: 'Получить соединения с высокой задержкой',
    description: 'Возвращает список WebSocket соединений с задержкой выше указанного порога',
  })
  @ApiQuery({ name: 'threshold', required: false, description: 'Порог задержки в миллисекундах (по умолчанию 1000)' })
  @ApiResponse({ 
    status: 200, 
    description: 'Список соединений с высокой задержкой получен успешно',
    type: [WebSocketConnection],
  })
  async getHighLatencyConnections(
    @Query('threshold') threshold?: string,
  ): Promise<WebSocketConnection[]> {
    try {
      const thresholdValue = threshold ? parseInt(threshold, 10) : 1000;
      return await this.webSocketService.getHighLatencyConnections(thresholdValue);
    } catch (error) {
      throw new HttpException(
        `Ошибка получения соединений с высокой задержкой: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('top-users')
  @ApiOperation({ 
    summary: 'Получить список самых активных пользователей',
    description: 'Возвращает список пользователей с наибольшим количеством сообщений',
  })
  @ApiQuery({ name: 'limit', required: false, description: 'Количество пользователей для возврата (по умолчанию 10)' })
  @ApiResponse({ 
    status: 200, 
    description: 'Список активных пользователей получен успешно',
  })
  async getTopActiveUsers(@Query('limit') limit?: string): Promise<any[]> {
    try {
      const limitValue = limit ? parseInt(limit, 10) : 10;
      return await this.webSocketService.getTopActiveUsers(limitValue);
    } catch (error) {
      throw new HttpException(
        `Ошибка получения активных пользователей: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('cleanup')
  @ApiOperation({ 
    summary: 'Очистить старые соединения',
    description: 'Удаляет записи о старых отключенных WebSocket соединениях для освобождения места в базе данных',
  })
  @ApiQuery({ name: 'olderThanHours', required: false, description: 'Удалить соединения старше указанного количества часов (по умолчанию 24)' })
  @ApiResponse({ 
    status: 200, 
    description: 'Очистка выполнена успешно',
  })
  async cleanupOldConnections(
    @Query('olderThanHours') olderThanHours?: string,
  ): Promise<{ message: string; deletedCount: number }> {
    try {
      const hours = olderThanHours ? parseInt(olderThanHours, 10) : 24;
      const deletedCount = await this.webSocketService.cleanupOldConnections(hours);
      
      return {
        message: `Очистка завершена`,
        deletedCount,
      };
    } catch (error) {
      throw new HttpException(
        `Ошибка очистки старых соединений: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Put('connections/:socketId/session')
  @ApiOperation({ 
    summary: 'Обновить контекст сессии',
    description: 'Обновляет контекстную информацию о сессии WebSocket соединения',
  })
  @ApiParam({ name: 'socketId', description: 'ID WebSocket соединения' })
  @ApiResponse({ 
    status: 200, 
    description: 'Контекст сессии обновлен успешно',
  })
  async updateSessionContext(
    @Param('socketId') socketId: string,
    @Body() context: any,
  ): Promise<{ message: string }> {
    try {
      await this.webSocketService.updateSessionContext(socketId, context);
      return { message: `Контекст сессии для соединения ${socketId} обновлен` };
    } catch (error) {
      throw new HttpException(
        `Ошибка обновления контекста сессии: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Put('connections/:socketId/idle')
  @ApiOperation({ 
    summary: 'Пометить соединение как неактивное',
    description: 'Помечает WebSocket соединение как неактивное (idle)',
  })
  @ApiParam({ name: 'socketId', description: 'ID WebSocket соединения' })
  @ApiResponse({ 
    status: 200, 
    description: 'Соединение помечено как неактивное',
  })
  async markConnectionAsIdle(@Param('socketId') socketId: string): Promise<{ message: string }> {
    try {
      await this.webSocketService.markConnectionAsIdle(socketId);
      return { message: `Соединение ${socketId} помечено как неактивное` };
    } catch (error) {
      throw new HttpException(
        `Ошибка пометки соединения как неактивное: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Put('connections/:socketId/reactivate')
  @ApiOperation({ 
    summary: 'Реактивировать соединение',
    description: 'Реактивирует неактивное WebSocket соединение',
  })
  @ApiParam({ name: 'socketId', description: 'ID WebSocket соединения' })
  @ApiResponse({ 
    status: 200, 
    description: 'Соединение реактивировано',
  })
  async reactivateConnection(@Param('socketId') socketId: string): Promise<{ message: string }> {
    try {
      await this.webSocketService.reactivateConnection(socketId);
      return { message: `Соединение ${socketId} реактивировано` };
    } catch (error) {
      throw new HttpException(
        `Ошибка реактивации соединения: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}