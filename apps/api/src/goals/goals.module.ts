import { Module } from "@nestjs/common";
import { CoreModule } from "../core/core.module";
import { GoalsService } from "./goals.service";
import { GoalsController } from "./goals.controller";

@Module({
  imports: [CoreModule],
  controllers: [GoalsController],
  providers: [GoalsService],
  exports: [GoalsService],
})
export class GoalsModule {}
