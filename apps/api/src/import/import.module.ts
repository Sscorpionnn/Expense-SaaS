import { Module } from "@nestjs/common";
import { CoreModule } from "../core/core.module";
import { QueueModule } from "../core/queue.module";
import { ImportService } from "./import.service";
import { ImportController } from "./import.controller";

@Module({
  imports: [CoreModule, QueueModule],
  controllers: [ImportController],
  providers: [ImportService],
})
export class ImportModule {}
