import { describe, it, expect } from 'vitest';
import { isFatigued } from '@/lib/feedback-loop/fatigue';

describe('isFatigued', () => {
  it('frequency>2.5 で疲労', () => {
    expect(isFatigued({ ctrToday: 0.02, ctrPeak: 0.025, frequency: 2.6, cpmToday: 1000, cpmBaseline: 1000 })).toBe(true);
  });
  it('CTRがピークから30%超低下で疲労', () => {
    expect(isFatigued({ ctrToday: 0.01, ctrPeak: 0.02, frequency: 1.5, cpmToday: 1000, cpmBaseline: 1000 })).toBe(true);
  });
  it('CPMがベースライン+40%超で疲労', () => {
    expect(isFatigued({ ctrToday: 0.02, ctrPeak: 0.02, frequency: 1.5, cpmToday: 1500, cpmBaseline: 1000 })).toBe(true);
  });
  it('健全なら false', () => {
    expect(isFatigued({ ctrToday: 0.02, ctrPeak: 0.021, frequency: 1.5, cpmToday: 1050, cpmBaseline: 1000 })).toBe(false);
  });
});
