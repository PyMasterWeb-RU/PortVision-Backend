import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventEmitterModule } from '@nestjs/event-emitter';

// Entities
import { MoveTask } from './entities/move-task.entity';
import { WorkOrder } from './entities/work-order.entity';
import { TaskAssignment } from './entities/task-assignment.entity';

// Services
import { MoveTaskService } from './services/move-task.service';
import { TaskAssignmentService } from './services/task-assignment.service';

// Controllers
import { MoveTaskController } from './controllers/move-task.controller';
import { TaskAssignmentController } from './controllers/task-assignment.controller';

// Import common entities needed for relations
import { Container } from '../common/entities/container.entity';
import { Order } from '../orders/entities/order.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      // Moves module entities
      MoveTask,
      WorkOrder,
      TaskAssignment,
      // Common entities for relations
      Container,
      Order,
    ]),
    EventEmitterModule,
  ],
  controllers: [
    MoveTaskController,
    TaskAssignmentController,
  ],
  providers: [
    MoveTaskService,
    TaskAssignmentService,
  ],
  exports: [
    MoveTaskService,
    TaskAssignmentService,
    TypeOrmModule,
  ],
})
export class MovesModule {}