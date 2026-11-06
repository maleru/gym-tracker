import { describe, expect, it } from 'vitest';
import { estimate1RM, nextDay, lastPerformance } from './logic';
import type { Plan, Session } from './types';

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
  it('zählt einen Satz ohne Wiederholungen nicht als 1RM', () => {
    expect(estimate1RM(100, 0)).toBe(0);
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

describe('lastPerformance bei gleichem Datum', () => {
  it('nimmt bei zwei Sessions am selben Tag die zuletzt gespeicherte', () => {
    const early = { ...session('a', '2026-03-01', 'd1', 40), createdAt: '2026-03-01T18:00:00.000Z' };
    const late = { ...session('b', '2026-03-01', 'd1', 45), createdAt: '2026-03-01T19:30:00.000Z' };
    expect(lastPerformance('x', [late, early])?.sets[0].w).toBe(45);
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
