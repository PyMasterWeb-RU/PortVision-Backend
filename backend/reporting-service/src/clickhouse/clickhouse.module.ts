import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ClickHouseService } from './clickhouse.service';
import { ClickHouseSchemaService } from './clickhouse-schema.service';

@Module({
  imports: [ConfigModule],
  providers: [ClickHouseService, ClickHouseSchemaService],
  exports: [ClickHouseService, ClickHouseSchemaService],
})
export class ClickHouseModule {}