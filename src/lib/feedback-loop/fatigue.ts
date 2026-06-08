export interface FatigueInput {
  ctrToday: number;
  ctrPeak: number;
  frequency: number;
  cpmToday: number;
  cpmBaseline: number;
}

/** Meta 一般則: CTRピーク比 -30% / frequency>2.5 / CPMベースライン比 +40% のいずれかで疲労 */
export function isFatigued(i: FatigueInput): boolean {
  if (i.frequency > 2.5) return true;
  if (i.ctrPeak > 0 && i.ctrToday <= i.ctrPeak * 0.7) return true;
  if (i.cpmBaseline > 0 && i.cpmToday >= i.cpmBaseline * 1.4) return true;
  return false;
}
