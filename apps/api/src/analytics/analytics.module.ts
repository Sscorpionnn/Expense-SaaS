import { Module } from "@nestjs/common";
import { CoreModule } from "../core/core.module";
import { BudgetsModule } from "../budgets/budgets.module";
import { AnalyticsService } from "./analytics.service";
import { AnalyticsController } from "./analytics.controller";

@Module({
  imports: [CoreModule, BudgetsModule],
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
})
export class AnalyticsModule {}
