import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventEmitterModule } from '@nestjs/event-emitter';

// Entities
import { Invoice } from './entities/invoice.entity';
import { Tariff } from './entities/tariff.entity';

// Services
import { InvoiceService } from './services/invoice.service';
import { TariffService } from './services/tariff.service';

// Controllers
import { InvoiceController } from './controllers/invoice.controller';
import { TariffController } from './controllers/tariff.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      // Billing module entities
      Invoice,
      Tariff,
    ]),
    EventEmitterModule,
  ],
  controllers: [
    InvoiceController,
    TariffController,
  ],
  providers: [
    InvoiceService,
    TariffService,
  ],
  exports: [
    InvoiceService,
    TariffService,
    TypeOrmModule,
  ],
})
export class BillingModule {}