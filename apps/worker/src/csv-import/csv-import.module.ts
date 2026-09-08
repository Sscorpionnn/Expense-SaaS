import { Module } from "@nestjs/common";
import { PrismaModule } from "../core/prisma.module";
import { StorageModule } from "../core/storage.module";
import { QueueModule } from "../core/queue.module";
import { CsvImportProcessor } from "./csv-import.processor";

@Module({
  imports: [PrismaModule, StorageModule, QueueModule],
  providers: [CsvImportProcessor],
})
export class CsvImportModule {}
