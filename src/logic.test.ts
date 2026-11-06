import { describe, expect, it } from 'vitest';
import { estimate1RM, nextDay, progressionHint, suggestWeight, lastPerformance } from './logic';
import type { Plan, PlanItem, Session } from './types';

const inc = { KH: 2, LH: 2.5, SZ: 2.5, Kabel: 1.25, Maschine: 5, Koerper: 0 };
const item: PlanItem = { exerciseId: 'x', sets: 3, repMin: 8, repMax: 12 };

const session = (id: string, date: string, dayId = 'd1', w = 40, r = 10): Session => ({
  id,
  planId: 'p1',
  dayId,
  date,
  log: [{ exerciseId: 'x', sets: [{ w, r }, { w, r }, { w, r }] }],
});

describe('estimate1RM', () => {
  it('liefert Gewicht bei einer Wiederholung', () => {
    expect(estimate1RM(100, 1)).toBe(100);
  });
  it('rechnet nach Epley', () => {
    expect(estimate1RM(40, 10)).toBeCloseTo(53.33, 2);
  });
});

describe('progressionHint', () => {
  it('schlägt mehr Gewicht vor, wenn alle Sätze den oberen Bereich erreichen', () => {
    const hint = progressionHint(item, { date: '2026-01-01', sets: [{ w: 40, r: 12 }, { w: 40, r: 12 }] }, inc, 'KH');
    expect(hint?.kind).toBe('up');
    expect(hint?.text).toContain('42');
  });
  it('rät zum Halten, wenn ein Satz unter dem unteren Bereich liegt', () => {
    const hint = progressionHint(item, { date: '2026-01-01', sets: [{ w: 40, r: 6 }] }, inc, 'KH');
    expect(hint?.kind).toBe('hold');
  });
  it('gibt nichts zurück ohne Vorwerte', () => {
    expect(progressionHint(item, undefined, inc, 'KH')).toBeUndefined();
  });
});

describe('suggestWeight', () => {
  it('rundet auf die Schrittweite des Geräts', () => {
    const w = suggestWeight({ date: '2026-01-01', sets: [{ w: 40, r: 10 }] }, 10, 12, 2.5);
    expect(w % 2.5).toBeCloseTo(0, 5);
  });
  it('liefert bei Schrittweite 0 ein Viertel-Kilo-Raster', () => {
    const w = suggestWeight({ date: '2026-01-01', sets: [{ w: 40, r: 10 }] }, 10, 10, 0);
    expect(w * 4).toBeCloseTo(Math.round(w * 4), 5);
  });
});

describe('lastPerformance', () => {
  it('nimmt die jüngste Session', () => {
    const last = lastPerformance('x', [session('a', '2026-01-01'), session('b', '2026-02-01', 'd1', 50)]);
    expect(last?.date).toBe('2026-02-01');
    expect(last?.sets[0].w).toBe(50);
  });
  it('filtert nach Plan', () => {
    const other = { ...session('c', '2026-03-01'), planId: 'p2' };
    expect(lastPerformance('x', [other], 'p1')).toBeUndefined();
  });
});

describe('nextDay', () => {
  const plan: Plan = {
    id: 'p1',
    name: 'Test',
    split: 'Eigener',
    start: '2026-01-01',
    weeks: 6,
    active: true,
    days: [
      { id: 'd1', name: 'Push', items: [] },
      { id: 'd2', name: 'Pull', items: [] },
    ],
  };

  it('wählt den Tag mit dem ältesten letzten Training', () => {
    const sessions = [session('a', '2026-02-01', 'd1')];
    expect(nextDay(plan, sessions)?.id).toBe('d2');
  });
  it('wählt bei fehlender Historie den ersten Tag', () => {
    expect(nextDay(plan, [])?.id).toBe('d1');
  });
});
