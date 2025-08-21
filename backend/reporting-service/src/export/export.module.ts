import { Module } from '@nestjs/common';
import { ClickHouseModule } from '../clickhouse/clickhouse.module';
import { ExportService } from './export.service';
import { ExportController } from './export.controller';

@Module({
  imports: [ClickHouseModule],
  providers: [ExportService],
  controllers: [ExportController],
  exports: [ExportService],
})
export class ExportModule {}