import { Module } from '@nestjs/common';
import { ClickHouseModule } from '../clickhouse/clickhouse.module';
import { KpiService } from './kpi.service';
import { KpiController } from './kpi.controller';

@Module({
  imports: [ClickHouseModule],
  providers: [KpiService],
  controllers: [KpiController],
  exports: [KpiService],
})
export class KpiModule {}