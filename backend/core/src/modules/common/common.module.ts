import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

// Entities
import { Container } from './entities/container.entity';
import { Client } from './entities/client.entity';
import { Consignee } from './entities/consignee.entity';
import { Document } from './entities/document.entity';
import { Attachment } from './entities/attachment.entity';
import { ContainerEvent } from './entities/container-event.entity';
import { ContainerType } from './entities/container-type.entity';
import { Tariff } from './entities/tariff.entity';

// Services
import { ContainerService } from './services/container.service';
import { ClientService } from './services/client.service';
import { DocumentService } from './services/document.service';
import { AttachmentService } from './services/attachment.service';
import { ContainerEventService } from './services/container-event.service';
import { TariffService } from './services/tariff.service';
import { EventBusService } from './services/event-bus.service';
import { NotificationService } from './services/notification.service';

// Controllers
import { ContainerController } from './controllers/container.controller';
import { ClientController } from './controllers/client.controller';
import { DocumentController } from './controllers/document.controller';
import { AttachmentController } from './controllers/attachment.controller';
import { ContainerEventController } from './controllers/container-event.controller';
import { TariffController } from './controllers/tariff.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Container,
      Client,
      Consignee,
      Document,
      Attachment,
      ContainerEvent,
      ContainerType,
      Tariff,
    ]),
  ],
  controllers: [
    ContainerController,
    ClientController,
    DocumentController,
    AttachmentController,
    ContainerEventController,
    TariffController,
  ],
  providers: [
    ContainerService,
    ClientService,
    DocumentService,
    AttachmentService,
    ContainerEventService,
    TariffService,
    EventBusService,
    NotificationService,
  ],
  exports: [
    ContainerService,
    ClientService,
    DocumentService,
    AttachmentService,
    ContainerEventService,
    TariffService,
    EventBusService,
    NotificationService,
    TypeOrmModule,
  ],
})
export class CommonModule {}