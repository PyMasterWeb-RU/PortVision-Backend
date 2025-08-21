import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrderWorkflow } from '../entities/order-workflow.entity';
import { OrderStatus } from '../entities/order.entity';

@Injectable()
export class OrderWorkflowService {
  private readonly logger = new Logger(OrderWorkflowService.name);

  constructor(
    @InjectRepository(OrderWorkflow)
    private readonly orderWorkflowRepository: Repository<OrderWorkflow>,
  ) {}

  /**
   * Получение истории workflow для заявки
   */
  async getOrderWorkflow(orderId: string): Promise<OrderWorkflow[]> {
    return this.orderWorkflowRepository.find({
      where: { orderId },
      order: { changedAt: 'ASC' },
    });
  }

  /**
   * Создание записи workflow
   */
  async createWorkflowEntry(
    orderId: string,
    fromStatus: OrderStatus | null,
    toStatus: OrderStatus,
    changedBy: string,
    comment?: string
  ): Promise<OrderWorkflow> {
    const workflow = this.orderWorkflowRepository.create({
      orderId,
      fromStatus,
      toStatus,
      changedBy,
      comment,
      changedAt: new Date(),
    });

    const savedWorkflow = await this.orderWorkflowRepository.save(workflow);
    
    this.logger.log(`Workflow entry created for order ${orderId}: ${fromStatus} -> ${toStatus}`);
    return savedWorkflow;
  }

  /**
   * Получение последнего изменения статуса заявки
   */
  async getLastStatusChange(orderId: string): Promise<OrderWorkflow | null> {
    return this.orderWorkflowRepository.findOne({
      where: { orderId },
      order: { changedAt: 'DESC' },
    });
  }

  /**
   * Получение статистики по времени выполнения статусов
   */
  async getStatusDurationStats(orderId: string): Promise<{
    totalDuration: number;
    statusDurations: Array<{
      status: OrderStatus;
      duration: number; // в минутах
      startTime: Date;
      endTime?: Date;
    }>;
  }> {
    const workflow = await this.getOrderWorkflow(orderId);
    
    if (workflow.length === 0) {
      return {
        totalDuration: 0,
        statusDurations: [],
      };
    }

    const statusDurations: Array<{
      status: OrderStatus;
      duration: number;
      startTime: Date;
      endTime?: Date;
    }> = [];

    for (let i = 0; i < workflow.length; i++) {
      const current = workflow[i];
      const next = workflow[i + 1];
      
      const duration = next 
        ? Math.round((next.changedAt.getTime() - current.changedAt.getTime()) / (1000 * 60))
        : Math.round((new Date().getTime() - current.changedAt.getTime()) / (1000 * 60));

      statusDurations.push({
        status: current.toStatus,
        duration,
        startTime: current.changedAt,
        endTime: next?.changedAt,
      });
    }

    const totalDuration = statusDurations.reduce((sum, item) => sum + item.duration, 0);

    return {
      totalDuration,
      statusDurations,
    };
  }
}