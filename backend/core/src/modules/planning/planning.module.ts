import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventEmitterModule } from '@nestjs/event-emitter';

// Entities
import { OperationPlan } from './entities/operation-plan.entity';

// Services
import { OperationPlanService } from './services/operation-plan.service';

// Controllers
import { OperationPlanController } from './controllers/operation-plan.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      // Planning module entities
      OperationPlan,
    ]),
    EventEmitterModule,
  ],
  controllers: [
    OperationPlanController,
  ],
  providers: [
    OperationPlanService,
  ],
  exports: [
    OperationPlanService,
    TypeOrmModule,
  ],
})
export class PlanningModule {}