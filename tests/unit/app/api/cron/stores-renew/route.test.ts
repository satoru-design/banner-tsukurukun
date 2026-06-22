import { describe, it, expect, vi, beforeEach } from "vitest";

const prisma = { user: { findMany: vi.fn(), update: vi.fn() } };
vi.mock("@/lib/prisma", () => ({ getPrisma: () => prisma }));

import { GET } from "@/app/api/cron/stores-renew/route";

beforeEach(() => {
  vi.clearAllMocks();
  process.env.CRON_SECRET = "cronsecret";
});
const authed = () =>
  new Request("https://x/api/cron/stores-renew", { headers: new Headers({ authorization: "Bearer cronsecret" }) });

it("401 without cron secret", async () => {
  const res = await GET(new Request("https://x", { headers: new Headers({ authorization: "Bearer nope" }) }));
  expect(res.status).toBe(401);
});

it("downgrades paid users whose planExpiresAt has lapsed", async () => {
  prisma.user.findMany.mockResolvedValue([{ id: "u1" }, { id: "u2" }]);
  prisma.user.update.mockResolvedValue({});
  const res = await GET(authed());
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ ok: true, downgraded: 2 });
  expect(prisma.user.update).toHaveBeenCalledWith({ where: { id: "u1" }, data: { plan: "free" } });
  expect(prisma.user.update).toHaveBeenCalledWith({ where: { id: "u2" }, data: { plan: "free" } });
});

it("returns downgraded:0 when no users have lapsed", async () => {
  prisma.user.findMany.mockResolvedValue([]);
  const res = await GET(authed());
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ ok: true, downgraded: 0 });
  expect(prisma.user.update).not.toHaveBeenCalled();
});

it("continues and counts only successes if an update throws", async () => {
  prisma.user.findMany.mockResolvedValue([{ id: "u1" }, { id: "u2" }]);
  prisma.user.update.mockRejectedValueOnce(new Error("boom")).mockResolvedValueOnce({});
  const res = await GET(authed());
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ ok: true, downgraded: 1 });
});
