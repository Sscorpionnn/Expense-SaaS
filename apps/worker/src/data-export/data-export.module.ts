import { Module } from "@nestjs/common";
import { PrismaModule } from "../core/prisma.module";
import { StorageModule } from "../core/storage.module";
import { QueueModule } from "../core/queue.module";
import { DataExportProcessor } from "./data-export.processor";
import { ExportCleanupService } from "./export-cleanup.service";

@Module({
  imports: [PrismaModule, StorageModule, QueueModule],
  providers: [DataExportProcessor, ExportCleanupService],
})
export class DataExportModule {}
