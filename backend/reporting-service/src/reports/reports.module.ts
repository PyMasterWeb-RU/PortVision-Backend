import { Module } from '@nestjs/common';
import { ClickHouseModule } from '../clickhouse/clickhouse.module';
import { ReportsService } from './reports.service';
import { ReportsController } from './reports.controller';

@Module({
  imports: [ClickHouseModule],
  providers: [ReportsService],
  controllers: [ReportsController],
  exports: [ReportsService],
})
export class ReportsModule {}