import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventEmitterModule } from '@nestjs/event-emitter';

// Entities
import { MaintenanceRequest } from './entities/maintenance-request.entity';
import { ServiceProvider } from './entities/service-provider.entity';

// Services
import { MaintenanceRequestService } from './services/maintenance-request.service';
import { ServiceProviderService } from './services/service-provider.service';

// Controllers
import { MaintenanceRequestController } from './controllers/maintenance-request.controller';
import { ServiceProviderController } from './controllers/service-provider.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      // MR Services module entities
      MaintenanceRequest,
      ServiceProvider,
    ]),
    EventEmitterModule,
  ],
  controllers: [
    MaintenanceRequestController,
    ServiceProviderController,
  ],
  providers: [
    MaintenanceRequestService,
    ServiceProviderService,
  ],
  exports: [
    MaintenanceRequestService,
    ServiceProviderService,
    TypeOrmModule,
  ],
})
export class MrServicesModule {}