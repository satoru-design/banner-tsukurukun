export function startOfDayUTC(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/** The start of the user's next billing period (anniversary-based). */
export function nextPeriodStart(planExpiresAt: Date | null, now: Date): Date {
  if (planExpiresAt && planExpiresAt > now) return planExpiresAt;
  return startOfDayUTC(now);
}
