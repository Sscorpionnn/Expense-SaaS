import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { formatMinorUnits } from "@expense-saas/config";
import type { RecurringTransaction } from "@expense-saas/database";
import { PrismaService } from "../core/prisma.service";
import { computeNextOccurrence } from "./next-occurrence.util";

@Injectable()
export class RecurringSweepService {
  private readonly logger = new Logger(RecurringSweepService.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_HOUR)
  async sweep(): Promise<void> {
    const now = new Date();
    const due = await this.prisma.recurringTransaction.findMany({
      where: {
        isActive: true,
        nextOccurrenceAt: { lte: now },
      },
    });

    for (const recurring of due) {
      await this.remindAndAdvance(recurring, now);
    }

    if (due.length > 0) {
      this.logger.log(`Sent ${due.length} recurring-transaction reminder(s).`);
    }
  }

  /**
   * Advances `nextOccurrenceAt` fully past `now` (in case the sweep hasn't
   * run in a while) but sends only ONE reminder per run, regardless of how
   * many occurrences were missed — a dormant weekly reminder shouldn't
   * flood the user with a week's worth of backlogged notifications.
   */
  private async remindAndAdvance(recurring: RecurringTransaction, now: Date): Promise<void> {
    let next = recurring.nextOccurrenceAt;
    while (next <= now) {
      next = computeNextOccurrence(next, recurring.frequency, recurring.interval);
    }

    const stillActive = !recurring.endDate || next <= recurring.endDate;
    const amount = formatMinorUnits(recurring.amountMinor, recurring.currency);
    const label = recurring.description ?? recurring.merchant ?? "recurring transaction";

    await this.prisma.$transaction([
      this.prisma.recurringTransaction.update({
        where: { id: recurring.id },
        data: { nextOccurrenceAt: next, lastReminderSentAt: now, isActive: stillActive },
      }),
      this.prisma.notification.create({
        data: {
          userId: recurring.userId,
          type: "RECURRING_REMINDER",
          title: `Reminder: ${label}`,
          body: `Your recurring ${recurring.type.toLowerCase()} of ${amount} ${recurring.currency} (${label}) was due. This is only a reminder — no transaction was created automatically.`,
          metadata: { recurringTransactionId: recurring.id },
        },
      }),
    ]);
  }
}
