import { Module } from "@nestjs/common";
import { CoreModule } from "../core/core.module";
import { BudgetsService } from "./budgets.service";
import { BudgetsController } from "./budgets.controller";

@Module({
  imports: [CoreModule],
  controllers: [BudgetsController],
  providers: [BudgetsService],
  exports: [BudgetsService],
})
export class BudgetsModule {}
