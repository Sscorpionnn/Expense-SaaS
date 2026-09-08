import { Module } from "@nestjs/common";
import { CoreModule } from "../core/core.module";
import { RecurringService } from "./recurring.service";
import { RecurringController } from "./recurring.controller";

@Module({
  imports: [CoreModule],
  controllers: [RecurringController],
  providers: [RecurringService],
  exports: [RecurringService],
})
export class RecurringModule {}
