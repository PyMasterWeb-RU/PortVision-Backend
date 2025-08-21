import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventEmitterModule } from '@nestjs/event-emitter';

// Entities
import { TerminalView } from './entities/terminal-view.entity';
import { TerminalObject } from './entities/terminal-object.entity';

// Services
import { DigitalTwinService } from './services/digital-twin.service';

// Controllers
import { DigitalTwinController } from './controllers/digital-twin.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      // Digital Twin module entities
      TerminalView,
      TerminalObject,
    ]),
    EventEmitterModule,
  ],
  controllers: [
    DigitalTwinController,
  ],
  providers: [
    DigitalTwinService,
  ],
  exports: [
    DigitalTwinService,
    TypeOrmModule,
  ],
})
export class DigitalTwinModule {}