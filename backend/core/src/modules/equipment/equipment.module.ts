import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventEmitterModule } from '@nestjs/event-emitter';

// Entities
import { Equipment } from './entities/equipment.entity';
import { MaintenanceRecord } from './entities/maintenance-record.entity';
import { EquipmentAssignment } from './entities/equipment-assignment.entity';

// Services
import { EquipmentService } from './services/equipment.service';
import { MaintenanceRecordService } from './services/maintenance-record.service';

// Controllers
import { EquipmentController } from './controllers/equipment.controller';
import { MaintenanceRecordController } from './controllers/maintenance-record.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      // Equipment module entities
      Equipment,
      MaintenanceRecord,
      EquipmentAssignment,
    ]),
    EventEmitterModule,
  ],
  controllers: [
    EquipmentController,
    MaintenanceRecordController,
  ],
  providers: [
    EquipmentService,
    MaintenanceRecordService,
  ],
  exports: [
    EquipmentService,
    MaintenanceRecordService,
    TypeOrmModule,
  ],
})
export class EquipmentModule {}