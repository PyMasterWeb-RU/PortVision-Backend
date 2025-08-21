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
  Request,
} from '@nestjs/common';
import { 
  ApiTags, 
  ApiOperation, 
  ApiResponse, 
  ApiParam, 
  ApiQuery,
  ApiBearerAuth,
  ApiBody,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { 
  NotificationService, 
  CreateNotificationDto,
  UpdateNotificationDto,
} from '../services/notification.service';
import { 
  Notification,
  NotificationType,
  NotificationPriority,
  NotificationStatus,
} from '../entities/notification.entity';

@ApiTags('Notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationService: NotificationService) {}

  @Post()
  @ApiOperation({ 
    summary: 'Создать новое уведомление',
    description: 'Создает новое уведомление и отправляет его через указанные каналы доставки',
  })
  @ApiBody({ type: CreateNotificationDto })
  @ApiResponse({ 
    status: 201, 
    description: 'Уведомление создано успешно',
    type: Notification,
  })
  async createNotification(@Body() createDto: CreateNotificationDto): Promise<Notification> {
    try {
      return await this.notificationService.createNotification(createDto);
    } catch (error) {
      throw new HttpException(
        `Ошибка создания уведомления: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get()
  @ApiOperation({ 
    summary: 'Получить список уведомлений пользователя',
    description: 'Возвращает список уведомлений для текущего пользователя с возможностью фильтрации',
  })
  @ApiQuery({ name: 'status', required: false, enum: NotificationStatus, description: 'Статус уведомления для фильтрации' })
  @ApiQuery({ name: 'type', required: false, enum: NotificationType, description: 'Тип уведомления для фильтрации' })
  @ApiQuery({ name: 'priority', required: false, enum: NotificationPriority, description: 'Приоритет уведомления для фильтрации' })
  @ApiQuery({ name: 'limit', required: false, description: 'Количество уведомлений для возврата (по умолчанию 50)' })
  @ApiQuery({ name: 'category', required: false, description: 'Категория уведомления для фильтрации' })
  @ApiResponse({ 
    status: 200, 
    description: 'Список уведомлений получен успешно',
    type: [Notification],
  })
  async getUserNotifications(
    @Request() req: any,
    @Query('status') status?: NotificationStatus,
    @Query('type') type?: NotificationType,
    @Query('priority') priority?: NotificationPriority,
    @Query('limit') limit?: string,
    @Query('category') category?: string,
  ): Promise<Notification[]> {
    try {
      const userId = req.user.sub;
      const limitValue = limit ? parseInt(limit, 10) : 50;
      
      let notifications = await this.notificationService.getUserNotifications(userId, status, limitValue);
      
      // Дополнительная фильтрация
      if (type) {
        notifications = notifications.filter(n => n.type === type);
      }
      
      if (priority) {
        notifications = notifications.filter(n => n.priority === priority);
      }
      
      if (category) {
        notifications = notifications.filter(n => n.category === category);
      }
      
      return notifications;
    } catch (error) {
      throw new HttpException(
        `Ошибка получения уведомлений: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('unread')
  @ApiOperation({ 
    summary: 'Получить непрочитанные уведомления',
    description: 'Возвращает список всех непрочитанных уведомлений для текущего пользователя',
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Список непрочитанных уведомлений получен успешно',
    type: [Notification],
  })
  async getUnreadNotifications(@Request() req: any): Promise<Notification[]> {
    try {
      const userId = req.user.sub;
      return await this.notificationService.getUnreadNotifications(userId);
    } catch (error) {
      throw new HttpException(
        `Ошибка получения непрочитанных уведомлений: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('critical')
  @ApiOperation({ 
    summary: 'Получить критические уведомления',
    description: 'Возвращает список критических и срочных уведомлений',
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Список критических уведомлений получен успешно',
    type: [Notification],
  })
  async getCriticalNotifications(): Promise<Notification[]> {
    try {
      return await this.notificationService.getCriticalNotifications();
    } catch (error) {
      throw new HttpException(
        `Ошибка получения критических уведомлений: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('by-type/:type')
  @ApiOperation({ 
    summary: 'Получить уведомления по типу',
    description: 'Возвращает уведомления определенного типа за указанный период',
  })
  @ApiParam({ name: 'type', enum: NotificationType, description: 'Тип уведомления' })
  @ApiQuery({ name: 'hours', required: false, description: 'Период в часах (по умолчанию 24)' })
  @ApiResponse({ 
    status: 200, 
    description: 'Уведомления по типу получены успешно',
    type: [Notification],
  })
  async getNotificationsByType(
    @Param('type') type: NotificationType,
    @Query('hours') hours?: string,
  ): Promise<Notification[]> {
    try {
      const hoursValue = hours ? parseInt(hours, 10) : 24;
      return await this.notificationService.getNotificationsByType(type, hoursValue);
    } catch (error) {
      throw new HttpException(
        `Ошибка получения уведомлений по типу: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get(':id')
  @ApiOperation({ 
    summary: 'Получить уведомление по ID',
    description: 'Возвращает подробную информацию об уведомлении по его идентификатору',
  })
  @ApiParam({ name: 'id', description: 'ID уведомления' })
  @ApiResponse({ 
    status: 200, 
    description: 'Уведомление получено успешно',
    type: Notification,
  })
  @ApiResponse({ 
    status: 404, 
    description: 'Уведомление не найдено',
  })
  async getNotification(@Param('id') id: string): Promise<Notification> {
    try {
      const notification = await this.notificationService.getNotification(id);
      
      if (!notification) {
        throw new HttpException(
          `Уведомление ${id} не найдено`,
          HttpStatus.NOT_FOUND,
        );
      }
      
      return notification;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      
      throw new HttpException(
        `Ошибка получения уведомления: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Put(':id')
  @ApiOperation({ 
    summary: 'Обновить уведомление',
    description: 'Обновляет существующее уведомление',
  })
  @ApiParam({ name: 'id', description: 'ID уведомления' })
  @ApiBody({ type: UpdateNotificationDto })
  @ApiResponse({ 
    status: 200, 
    description: 'Уведомление обновлено успешно',
    type: Notification,
  })
  @ApiResponse({ 
    status: 404, 
    description: 'Уведомление не найдено',
  })
  async updateNotification(
    @Param('id') id: string,
    @Body() updateDto: UpdateNotificationDto,
  ): Promise<Notification> {
    try {
      return await this.notificationService.updateNotification(id, updateDto);
    } catch (error) {
      if (error.message.includes('не найдено')) {
        throw new HttpException(error.message, HttpStatus.NOT_FOUND);
      }
      
      throw new HttpException(
        `Ошибка обновления уведомления: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Put(':id/read')
  @ApiOperation({ 
    summary: 'Отметить уведомление как прочитанное',
    description: 'Помечает уведомление как прочитанное для текущего пользователя',
  })
  @ApiParam({ name: 'id', description: 'ID уведомления' })
  @ApiResponse({ 
    status: 200, 
    description: 'Уведомление отмечено как прочитанное',
    type: Notification,
  })
  @ApiResponse({ 
    status: 404, 
    description: 'Уведомление не найдено',
  })
  async markAsRead(
    @Param('id') id: string,
    @Request() req: any,
  ): Promise<Notification> {
    try {
      const userId = req.user.sub;
      return await this.notificationService.markAsRead(id, userId);
    } catch (error) {
      if (error.message.includes('не найдено')) {
        throw new HttpException(error.message, HttpStatus.NOT_FOUND);
      }
      
      throw new HttpException(
        `Ошибка отметки уведомления как прочитанного: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Put('read')
  @ApiOperation({ 
    summary: 'Отметить несколько уведомлений как прочитанные',
    description: 'Помечает указанные уведомления как прочитанные для текущего пользователя',
  })
  @ApiBody({ 
    schema: {
      type: 'object',
      properties: {
        notificationIds: {
          type: 'array',
          items: { type: 'string' },
          description: 'Массив ID уведомлений для отметки как прочитанные',
        },
      },
      required: ['notificationIds'],
    },
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Уведомления отмечены как прочитанные',
  })
  async markMultipleAsRead(
    @Body('notificationIds') notificationIds: string[],
    @Request() req: any,
  ): Promise<{ message: string; count: number }> {
    try {
      const userId = req.user.sub;
      await this.notificationService.markMultipleAsRead(notificationIds, userId);
      
      return {
        message: 'Уведомления отмечены как прочитанные',
        count: notificationIds.length,
      };
    } catch (error) {
      throw new HttpException(
        `Ошибка отметки уведомлений как прочитанные: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Put('read-all')
  @ApiOperation({ 
    summary: 'Отметить все уведомления как прочитанные',
    description: 'Помечает все непрочитанные уведомления пользователя как прочитанные',
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Все уведомления отмечены как прочитанные',
  })
  async markAllAsRead(@Request() req: any): Promise<{ message: string; count: number }> {
    try {
      const userId = req.user.sub;
      const unreadNotifications = await this.notificationService.getUnreadNotifications(userId);
      const notificationIds = unreadNotifications.map(n => n.id);
      
      if (notificationIds.length > 0) {
        await this.notificationService.markMultipleAsRead(notificationIds, userId);
      }
      
      return {
        message: 'Все уведомления отмечены как прочитанные',
        count: notificationIds.length,
      };
    } catch (error) {
      throw new HttpException(
        `Ошибка отметки всех уведомлений как прочитанные: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Delete(':id')
  @ApiOperation({ 
    summary: 'Удалить уведомление',
    description: 'Удаляет уведомление из системы',
  })
  @ApiParam({ name: 'id', description: 'ID уведомления' })
  @ApiResponse({ 
    status: 200, 
    description: 'Уведомление удалено успешно',
  })
  @ApiResponse({ 
    status: 404, 
    description: 'Уведомление не найдено',
  })
  async deleteNotification(@Param('id') id: string): Promise<{ message: string }> {
    try {
      await this.notificationService.deleteNotification(id);
      return { message: `Уведомление ${id} удалено` };
    } catch (error) {
      if (error.message.includes('не найдено')) {
        throw new HttpException(error.message, HttpStatus.NOT_FOUND);
      }
      
      throw new HttpException(
        `Ошибка удаления уведомления: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('retry-failed')
  @ApiOperation({ 
    summary: 'Повторить доставку неуспешных уведомлений',
    description: 'Повторяет попытки доставки для уведомлений со статусом "failed"',
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Повторная доставка запущена',
  })
  async retryFailedNotifications(): Promise<{ message: string; retryCount: number }> {
    try {
      const retryCount = await this.notificationService.retryFailedNotifications();
      
      return {
        message: 'Повторная доставка неуспешных уведомлений запущена',
        retryCount,
      };
    } catch (error) {
      throw new HttpException(
        `Ошибка повторной доставки уведомлений: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('failed/list')
  @ApiOperation({ 
    summary: 'Получить список неуспешных уведомлений',
    description: 'Возвращает список уведомлений с неуспешной доставкой',
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Список неуспешных уведомлений получен успешно',
    type: [Notification],
  })
  async getFailedNotifications(): Promise<Notification[]> {
    try {
      return await this.notificationService.getFailedNotifications();
    } catch (error) {
      throw new HttpException(
        `Ошибка получения неуспешных уведомлений: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('cleanup')
  @ApiOperation({ 
    summary: 'Очистить старые уведомления',
    description: 'Удаляет старые прочитанные, истекшие и неуспешные уведомления',
  })
  @ApiQuery({ name: 'daysOld', required: false, description: 'Удалить уведомления старше указанного количества дней (по умолчанию 30)' })
  @ApiResponse({ 
    status: 200, 
    description: 'Очистка выполнена успешно',
  })
  async cleanupOldNotifications(
    @Query('daysOld') daysOld?: string,
  ): Promise<{ message: string; deletedCount: number }> {
    try {
      const days = daysOld ? parseInt(daysOld, 10) : 30;
      const deletedCount = await this.notificationService.cleanupOldNotifications(days);
      
      return {
        message: `Очистка старых уведомлений завершена`,
        deletedCount,
      };
    } catch (error) {
      throw new HttpException(
        `Ошибка очистки старых уведомлений: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('expire-old')
  @ApiOperation({ 
    summary: 'Пометить истекшие уведомления',
    description: 'Помечает уведомления с истекшим сроком действия как "expired"',
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Истекшие уведомления помечены',
  })
  async expireOldNotifications(): Promise<{ message: string; expiredCount: number }> {
    try {
      const expiredCount = await this.notificationService.expireOldNotifications();
      
      return {
        message: `Истекшие уведомления помечены`,
        expiredCount,
      };
    } catch (error) {
      throw new HttpException(
        `Ошибка пометки истекших уведомлений: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('statistics/overview')
  @ApiOperation({ 
    summary: 'Получить статистику уведомлений',
    description: 'Возвращает подробную статистику по уведомлениям включая разбивки по типам, приоритетам и метрики производительности',
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Статистика получена успешно',
  })
  async getNotificationStatistics(): Promise<any> {
    try {
      return await this.notificationService.getNotificationStatistics();
    } catch (error) {
      throw new HttpException(
        `Ошибка получения статистики уведомлений: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('statistics/high-priority')
  @ApiOperation({ 
    summary: 'Получить высокоприоритетные уведомления',
    description: 'Возвращает список высокоприоритетных уведомлений за указанный период',
  })
  @ApiQuery({ name: 'hours', required: false, description: 'Период в часах (по умолчанию 1)' })
  @ApiResponse({ 
    status: 200, 
    description: 'Высокоприоритетные уведомления получены успешно',
    type: [Notification],
  })
  async getHighPriorityNotifications(
    @Query('hours') hours?: string,
  ): Promise<Notification[]> {
    try {
      const hoursValue = hours ? parseInt(hours, 10) : 1;
      return await this.notificationService.getHighPriorityNotifications(hoursValue);
    } catch (error) {
      throw new HttpException(
        `Ошибка получения высокоприоритетных уведомлений: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}