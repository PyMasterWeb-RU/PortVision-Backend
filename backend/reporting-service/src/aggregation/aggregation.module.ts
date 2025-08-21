import { Module } from '@nestjs/common';
import { ClickHouseModule } from '../clickhouse/clickhouse.module';
import { AggregationService } from './aggregation.service';
import { AggregationController } from './aggregation.controller';

@Module({
  imports: [ClickHouseModule],
  providers: [AggregationService],
  controllers: [AggregationController],
  exports: [AggregationService],
})
export class AggregationModule {}