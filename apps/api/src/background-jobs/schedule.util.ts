/**
 * Minimal recurring-schedule vocabulary for `BackgroundJob.cron` - deliberately
 * NOT full POSIX cron syntax (no parser dependency added for this phase).
 * Supported formats:
 *   "every:<n><unit>"   - e.g. "every:30s", "every:15m", "every:6h", "every:1d"
 *   "daily:HH:mm"       - next occurrence of that time of day (UTC)
 *   "weekly:D:HH:mm"    - D = 0 (Sunday) .. 6 (Saturday)
 *   "monthly:DD:HH:mm"  - DD = day of month (1-28, kept safe for every month)
 */
export function computeNextRun(spec: string, from: Date): Date {
  const every = /^every:(\d+)(s|m|h|d)$/.exec(spec);
  if (every) {
    const amount = Number(every[1]);
    const unitMs = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }[
      every[2] as "s" | "m" | "h" | "d"
    ];
    return new Date(from.getTime() + amount * unitMs);
  }

  const daily = /^daily:(\d{1,2}):(\d{2})$/.exec(spec);
  if (daily) {
    return nextAtTimeOfDay(from, Number(daily[1]), Number(daily[2]));
  }

  const weekly = /^weekly:(\d):(\d{1,2}):(\d{2})$/.exec(spec);
  if (weekly) {
    const targetDay = Number(weekly[1]);
    let next = nextAtTimeOfDay(from, Number(weekly[2]), Number(weekly[3]));
    while (next.getUTCDay() !== targetDay) {
      next = new Date(next.getTime() + 86_400_000);
    }
    return next;
  }

  const monthly = /^monthly:(\d{1,2}):(\d{1,2}):(\d{2})$/.exec(spec);
  if (monthly) {
    const targetDate = Math.min(Number(monthly[1]), 28);
    const hour = Number(monthly[2]);
    const minute = Number(monthly[3]);
    let next = new Date(
      Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), targetDate, hour, minute, 0, 0),
    );
    if (next <= from) {
      next = new Date(
        Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + 1, targetDate, hour, minute, 0, 0),
      );
    }
    return next;
  }

  throw new Error(`Unrecognized recurring schedule spec: "${spec}"`);
}

function nextAtTimeOfDay(from: Date, hour: number, minute: number): Date {
  const next = new Date(
    Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate(), hour, minute, 0, 0),
  );
  if (next <= from) {
    next.setUTCDate(next.getUTCDate() + 1);
  }
  return next;
}
