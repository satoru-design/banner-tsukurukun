import { describe, it, expect } from "vitest";
import { startOfDayUTC, nextPeriodStart } from "@/lib/billing/stores/period";

describe("startOfDayUTC", () => {
  it("strips time portion and returns midnight UTC", () => {
    const d = new Date("2026-06-22T15:30:00Z");
    const result = startOfDayUTC(d);
    expect(result.toISOString()).toBe("2026-06-22T00:00:00.000Z");
  });
});

describe("nextPeriodStart", () => {
  const now = new Date("2026-06-22T10:00:00Z");

  it("returns planExpiresAt when it is in the future (renewal anchors to current expiry)", () => {
    const future = new Date("2026-07-15T00:00:00Z");
    expect(nextPeriodStart(future, now)).toBe(future);
  });

  it("returns startOfDayUTC(now) when planExpiresAt is null (new signup)", () => {
    const result = nextPeriodStart(null, now);
    expect(result.toISOString()).toBe("2026-06-22T00:00:00.000Z");
  });

  it("returns startOfDayUTC(now) when planExpiresAt is in the past (lapsed)", () => {
    const past = new Date("2026-05-01T00:00:00Z");
    const result = nextPeriodStart(past, now);
    expect(result.toISOString()).toBe("2026-06-22T00:00:00.000Z");
  });
});
