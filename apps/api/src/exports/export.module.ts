import { Module } from "@nestjs/common";
import { CoreModule } from "../core/core.module";
import { QueueModule } from "../core/queue.module";
import { ExportService } from "./export.service";
import { ExportController } from "./export.controller";

@Module({
  imports: [CoreModule, QueueModule],
  controllers: [ExportController],
  providers: [ExportService],
})
export class ExportModule {}
