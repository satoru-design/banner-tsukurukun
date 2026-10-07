/**
 * 特性テスト: webhook の二重処理ガードを固定する。
 *
 * ここが壊れると金が出る。決済プロバイダは同じ event をリトライで複数回送るため、
 * 「処理済み判定」が崩れるとプラン付与や使用枠リセットが二重に走る。
 *
 * prisma はモックするので DB もネットワークも不要。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type Stripe from 'stripe';

const prisma = {
  webhookEvent: {
    findUnique: vi.fn(),
    upsert: vi.fn(),
    update: vi.fn(),
  },
};
vi.mock('@/lib/prisma', () => ({ getPrisma: () => prisma }));

import {
  isAlreadyProcessed,
  recordEventReceived,
  recordEventReceivedGeneric,
  markEventProcessed,
} from '@/lib/billing/idempotency';

beforeEach(() => vi.clearAllMocks());

describe('isAlreadyProcessed', () => {
  it('未受信（レコード無し）なら false', () => {
    // 壊れたら落ちる: 初回の event が処理済みと誤判定され、決済が一切反映されない。
    prisma.webhookEvent.findUnique.mockResolvedValue(null);
    return expect(isAlreadyProcessed('evt_test_00000000')).resolves.toBe(false);
  });

  it('受信済みだが processedAt が null なら false（リトライを通す）', () => {
    // 壊れたら落ちる: 処理が途中で落ちた event が「済み」と見なされて永久に再処理されず、
    // 入金済みなのにプランが付与されない。
    prisma.webhookEvent.findUnique.mockResolvedValue({
      id: 'evt_test_00000000',
      processedAt: null,
    });
    return expect(isAlreadyProcessed('evt_test_00000000')).resolves.toBe(false);
  });

  it('processedAt が入っていれば true（二重処理を止める）', async () => {
    // 壊れたら落ちる: リトライで同じ event が再処理され、プラン付与や
    // 枠リセットが二重に走る（実質の二重課金・二重付与）。
    prisma.webhookEvent.findUnique.mockResolvedValue({
      id: 'evt_test_00000000',
      processedAt: new Date('2026-07-01T00:00:00Z'),
    });

    await expect(isAlreadyProcessed('evt_test_00000000')).resolves.toBe(true);
    expect(prisma.webhookEvent.findUnique).toHaveBeenCalledWith({
      where: { id: 'evt_test_00000000' },
    });
  });
});

describe('recordEventReceived', () => {
  it('event.id を主キーに upsert し、既存行は一切書き換えない', async () => {
    // 壊れたら落ちる: update が空でなくなると、リトライ時に既存行の
    // processedAt を上書きして二重処理の扉が開く。
    prisma.webhookEvent.upsert.mockResolvedValue({});
    const event = {
      id: 'evt_test_00000000',
      type: 'checkout.session.completed',
      data: { object: { id: 'cs_test_00000000' } },
    } as unknown as Stripe.Event;

    await recordEventReceived(event);

    expect(prisma.webhookEvent.upsert).toHaveBeenCalledTimes(1);
    const arg = prisma.webhookEvent.upsert.mock.calls[0][0];
    expect(arg.where).toEqual({ id: 'evt_test_00000000' });
    expect(arg.create).toMatchObject({
      id: 'evt_test_00000000',
      type: 'checkout.session.completed',
    });
    // 既存行を触らないことが二重処理ガードの前提。
    expect(arg.update).toEqual({});
  });

  it('payload は JSON 化して保存する', async () => {
    // 壊れたら落ちる: payload が保存されず、二重課金時の調査ができなくなる。
    prisma.webhookEvent.upsert.mockResolvedValue({});
    const event = {
      id: 'evt_test_11111111',
      type: 'invoice.payment_succeeded',
      data: { object: { amount_paid: 9800 } },
    } as unknown as Stripe.Event;

    await recordEventReceived(event);

    const arg = prisma.webhookEvent.upsert.mock.calls[0][0];
    expect(arg.create.payload).toEqual({
      id: 'evt_test_11111111',
      type: 'invoice.payment_succeeded',
      data: { object: { amount_paid: 9800 } },
    });
  });
});

describe('recordEventReceivedGeneric（Pay.jp / STORES 用）', () => {
  it('Stripe 版と同じ形で upsert し、既存行を書き換えない', async () => {
    // 壊れたら落ちる: provider 非依存版だけガードが緩み、Pay.jp 側で二重処理が起きる。
    prisma.webhookEvent.upsert.mockResolvedValue({});

    await recordEventReceivedGeneric('evt_payjp_test_0000', 'subscription.renewed', {
      amount: 9800,
    });

    const arg = prisma.webhookEvent.upsert.mock.calls[0][0];
    expect(arg.where).toEqual({ id: 'evt_payjp_test_0000' });
    expect(arg.create).toMatchObject({
      id: 'evt_payjp_test_0000',
      type: 'subscription.renewed',
      payload: { amount: 9800 },
    });
    expect(arg.update).toEqual({});
  });
});

describe('markEventProcessed', () => {
  it('processedAt に日時をセットする', async () => {
    // 壊れたら落ちる: 完了印が付かず、全 event が毎回再処理される。
    prisma.webhookEvent.update.mockResolvedValue({});

    await markEventProcessed('evt_test_00000000');

    expect(prisma.webhookEvent.update).toHaveBeenCalledTimes(1);
    const arg = prisma.webhookEvent.update.mock.calls[0][0];
    expect(arg.where).toEqual({ id: 'evt_test_00000000' });
    expect(arg.data.processedAt).toBeInstanceOf(Date);
  });
});
