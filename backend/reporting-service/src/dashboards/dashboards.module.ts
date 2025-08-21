import { Module } from '@nestjs/common';
import { ClickHouseModule } from '../clickhouse/clickhouse.module';
import { DashboardsService } from './dashboards.service';
import { DashboardsController } from './dashboards.controller';

@Module({
  imports: [ClickHouseModule],
  providers: [DashboardsService],
  controllers: [DashboardsController],
  exports: [DashboardsService],
})
export class DashboardsModule {}