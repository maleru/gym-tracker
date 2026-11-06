import { describe, expect, it } from 'vitest';
import { muscleLoad, normalize } from './muscles';
import type { Exercise, Session } from './types';

const exercises: Exercise[] = [
  { id: 'bank', name: 'Bankdrücken', equipment: 'KH', muscles: ['brust', 'trizeps'] },
  { id: 'curl', name: 'Curls', equipment: 'KH', muscles: ['bizeps'] },
];

const sessions: Session[] = [
  {
    id: 's1',
    planId: 'p1',
    dayId: 'd1',
    date: '2026-01-01',
    log: [
      { exerciseId: 'bank', sets: [{ w: 40, r: 8 }, { w: 40, r: 8 }] },
      { exerciseId: 'curl', sets: [{ w: 10, r: 10 }] },
    ],
  },
  {
    id: 's2',
    planId: 'p2',
    dayId: 'd1',
    date: '2026-02-01',
    log: [{ exerciseId: 'bank', sets: [{ w: 40, r: 8 }] }],
  },
];

describe('muscleLoad', () => {
  it('zählt den primären Muskel voll und Hilfsmuskeln halb', () => {
    const load = muscleLoad([sessions[0]], exercises);
    expect(load.brust).toBe(2);
    expect(load.trizeps).toBe(1);
    expect(load.bizeps).toBe(1);
  });
  it('begrenzt die Auswertung auf einen Plan', () => {
    const load = muscleLoad(sessions, exercises, 'p2');
    expect(load.brust).toBe(1);
  });
  it('ignoriert leere Sätze', () => {
    const empty: Session = { ...sessions[0], log: [{ exerciseId: 'bank', sets: [] }] };
    expect(muscleLoad([empty], exercises)).toEqual({});
  });
});

describe('normalize', () => {
  it('skaliert auf den stärksten Muskel', () => {
    expect(normalize({ brust: 4, trizeps: 2 })).toEqual({ brust: 1, trizeps: 0.5 });
  });
  it('liefert ein leeres Objekt ohne Belastung', () => {
    expect(normalize({})).toEqual({});
  });
});
