import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

// Entities
import { Order } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import { TimeSlot } from './entities/time-slot.entity';
import { OrderWorkflow } from './entities/order-workflow.entity';
import { OrderNote } from './entities/order-note.entity';

// Services
import { OrderService } from './services/order.service';
import { TimeSlotService } from './services/time-slot.service';
import { OrderWorkflowService } from './services/order-workflow.service';
import { EdiService } from './services/edi.service';

// Controllers
import { OrderController } from './controllers/order.controller';
import { TimeSlotController } from './controllers/time-slot.controller';

// Common module для shared сервисов
import { CommonModule } from '../common/common.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Order,
      OrderItem,
      TimeSlot,
      OrderWorkflow,
      OrderNote,
    ]),
    CommonModule,
  ],
  controllers: [
    OrderController,
    TimeSlotController,
  ],
  providers: [
    OrderService,
    TimeSlotService,
    OrderWorkflowService,
    EdiService,
  ],
  exports: [
    OrderService,
    TimeSlotService,
    OrderWorkflowService,
    EdiService,
    TypeOrmModule,
  ],
})
export class OrdersModule {}