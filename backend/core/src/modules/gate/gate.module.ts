import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { EventEmitterModule } from '@nestjs/event-emitter';

// Entities
import { GatePass } from './entities/gate-pass.entity';
import { Eir } from './entities/eir.entity';
import { GateTransaction } from './entities/gate-transaction.entity';
import { OcrEvent } from './entities/ocr-event.entity';
import { AccessControl } from './entities/access-control.entity';

// Services
import { GateService } from './services/gate.service';
import { EirService } from './services/eir.service';
import { OcrService } from './services/ocr.service';
import { AccessControlService } from './services/access-control.service';
import { DocumentGenerationService } from './services/document-generation.service';

// Controllers
import { GateController } from './controllers/gate.controller';
import { EirController } from './controllers/eir.controller';
import { OcrController } from './controllers/ocr.controller';

// Common module для shared сервисов
import { CommonModule } from '../common/common.module';
import { OrdersModule } from '../orders/orders.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      GatePass,
      Eir,
      GateTransaction,
      OcrEvent,
      AccessControl,
    ]),
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'defaultSecret',
      signOptions: { expiresIn: '24h' },
    }),
    EventEmitterModule.forRoot(),
    CommonModule,
    OrdersModule,
  ],
  controllers: [
    GateController,
    EirController,
    OcrController,
  ],
  providers: [
    GateService,
    EirService,
    OcrService,
    AccessControlService,
    DocumentGenerationService,
  ],
  exports: [
    GateService,
    EirService,
    OcrService,
    AccessControlService,
    DocumentGenerationService,
    TypeOrmModule,
  ],
})
export class GateModule {}