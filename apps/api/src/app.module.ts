import { MiddlewareConsumer, Module, type NestModule } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { RATE_LIMITS } from "@expense-saas/config";
import { CoreModule } from "./core/core.module";
import { CsrfMiddleware } from "./core/csrf.middleware";
import { RedisThrottlerStorage } from "./core/throttler-redis.storage";
import { REDIS_CLIENT } from "./core/redis.module";
import { AuthModule } from "./auth/auth.module";
import { SessionAuthGuard } from "./auth/session-auth.guard";
import { HealthModule } from "./health/health.module";
import { AccountsModule } from "./accounts/accounts.module";
import { CategoriesModule } from "./categories/categories.module";
import { TransactionsModule } from "./transactions/transactions.module";
import { BudgetsModule } from "./budgets/budgets.module";
import { GoalsModule } from "./goals/goals.module";
import { RecurringModule } from "./recurring/recurring.module";
import { NotificationsModule } from "./notifications/notifications.module";
import { ImportModule } from "./import/import.module";
import { ExportModule } from "./exports/export.module";
import { AnalyticsModule } from "./analytics/analytics.module";
import { UsersModule } from "./users/users.module";
import { AccountDeletionModule } from "./account-deletion/account-deletion.module";

@Module({
  imports: [
    CoreModule,
    ThrottlerModule.forRootAsync({
      imports: [CoreModule],
      inject: [REDIS_CLIENT],
      useFactory: (redis) => ({
        throttlers: [
          { ttl: RATE_LIMITS.DEFAULT.ttlSeconds * 1000, limit: RATE_LIMITS.DEFAULT.limit },
        ],
        storage: new RedisThrottlerStorage(redis),
      }),
    }),
    AuthModule,
    HealthModule,
    AccountsModule,
    CategoriesModule,
    TransactionsModule,
    BudgetsModule,
    GoalsModule,
    RecurringModule,
    NotificationsModule,
    ImportModule,
    ExportModule,
    AnalyticsModule,
    UsersModule,
    AccountDeletionModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: SessionAuthGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(CsrfMiddleware).forRoutes("*");
  }
}
