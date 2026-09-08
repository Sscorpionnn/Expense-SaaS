import type { RecurringFrequency } from "@expense-saas/database";

/**
 * Adds calendar months to a UTC date, clamping the day-of-month to the
 * target month's last day instead of overflowing (e.g. Jan 31 + 1 month
 * lands on Feb 28/29, not Mar 3 like naive `setUTCMonth` arithmetic would).
 */
export function addMonthsClamped(date: Date, months: number): Date {
  const day = date.getUTCDate();
  const anchor = new Date(date);
  anchor.setUTCDate(1);
  anchor.setUTCMonth(anchor.getUTCMonth() + months);

  const lastDayOfTargetMonth = new Date(
    Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + 1, 0),
  ).getUTCDate();

  anchor.setUTCDate(Math.min(day, lastDayOfTargetMonth));
  anchor.setUTCHours(date.getUTCHours(), date.getUTCMinutes(), date.getUTCSeconds(), date.getUTCMilliseconds());
  return anchor;
}

export function computeNextOccurrence(
  current: Date,
  frequency: RecurringFrequency,
  interval: number,
): Date {
  switch (frequency) {
    case "DAILY": {
      const next = new Date(current);
      next.setUTCDate(next.getUTCDate() + interval);
      return next;
    }
    case "WEEKLY": {
      const next = new Date(current);
      next.setUTCDate(next.getUTCDate() + interval * 7);
      return next;
    }
    case "MONTHLY":
      return addMonthsClamped(current, interval);
    case "YEARLY":
      return addMonthsClamped(current, interval * 12);
  }
}
