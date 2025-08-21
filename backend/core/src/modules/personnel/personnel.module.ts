import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventEmitterModule } from '@nestjs/event-emitter';

// Entities
import { Operator } from './entities/operator.entity';
import { Shift } from './entities/shift.entity';

// Services
import { OperatorService } from './services/operator.service';
import { ShiftService } from './services/shift.service';

// Controllers
import { OperatorController } from './controllers/operator.controller';
import { ShiftController } from './controllers/shift.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      // Personnel module entities
      Operator,
      Shift,
    ]),
    EventEmitterModule,
  ],
  controllers: [
    OperatorController,
    ShiftController,
  ],
  providers: [
    OperatorService,
    ShiftService,
  ],
  exports: [
    OperatorService,
    ShiftService,
    TypeOrmModule,
  ],
})
export class PersonnelModule {}