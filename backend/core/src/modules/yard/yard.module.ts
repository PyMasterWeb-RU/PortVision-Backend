import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventEmitterModule } from '@nestjs/event-emitter';

// Entities
import { Yard } from './entities/yard.entity';
import { Zone } from './entities/zone.entity';
import { Slot } from './entities/slot.entity';
import { Placement } from './entities/placement.entity';
import { MovementLog } from './entities/movement-log.entity';

// Services
import { YardService } from './services/yard.service';
import { PlacementService } from './services/placement.service';
import { MovementLogService } from './services/movement-log.service';

// Controllers
import { YardController } from './controllers/yard.controller';
import { PlacementController } from './controllers/placement.controller';
import { MovementLogController } from './controllers/movement-log.controller';

// Import common entities needed for relations
import { Container } from '../common/entities/container.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      // Yard module entities
      Yard,
      Zone,
      Slot,
      Placement,
      MovementLog,
      // Common entities for relations
      Container,
    ]),
    EventEmitterModule,
  ],
  controllers: [
    YardController,
    PlacementController,
    MovementLogController,
  ],
  providers: [
    YardService,
    PlacementService,
    MovementLogService,
  ],
  exports: [
    YardService,
    PlacementService,
    MovementLogService,
    TypeOrmModule,
  ],
})
export class YardModule {}