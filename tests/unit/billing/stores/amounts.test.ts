import { describe, it, expect, beforeEach } from "vitest";
import { monthlyAmount, type PaidPlan } from "@/lib/billing/stores/amounts";

beforeEach(() => {
  process.env.STORES_AMOUNT_STARTER = "2980";
  process.env.STORES_AMOUNT_PRO = "9800";
  process.env.STORES_AMOUNT_BUSINESS = "29800";
});

describe("monthlyAmount", () => {
  it("returns the env-configured amount for each paid plan", () => {
    expect(monthlyAmount("starter")).toBe(2980);
    expect(monthlyAmount("pro")).toBe(9800);
    expect(monthlyAmount("business")).toBe(29800);
  });

  it("throws when the env var is missing or non-numeric", () => {
    delete process.env.STORES_AMOUNT_PRO;
    expect(() => monthlyAmount("pro")).toThrow(/STORES_AMOUNT_PRO/);
  });
});
