import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventEmitterModule } from '@nestjs/event-emitter';

// Entities
import { Contact } from './entities/contact.entity';

// Services
import { ContactService } from './services/contact.service';

// Controllers
import { ContactController } from './controllers/contact.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      // CRM module entities
      Contact,
    ]),
    EventEmitterModule,
  ],
  controllers: [
    ContactController,
  ],
  providers: [
    ContactService,
  ],
  exports: [
    ContactService,
    TypeOrmModule,
  ],
})
export class CrmModule {}