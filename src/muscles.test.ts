import { describe, expect, it } from 'vitest';
import {
  exercisesForMuscle,
  isKnownMuscle,
  levelFor,
  muscleLoad,
  resolveMuscle,
  setsPerWeek,
  statusFor,
  windowWeeks,
} from './muscles';
import type { Exercise, Session } from './types';

const exercises: Exercise[] = [
  { id: 'bank', name: 'Bankdrücken', equipment: 'KH', muscles: ['brust', 'trizeps'] },
  { id: 'curl', name: 'Curls', equipment: 'KH', muscles: ['bizeps'] },
  { id: 'alt', name: 'Alt-Rudern', equipment: 'LH', muscles: ['ruecken'] },
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

describe('resolveMuscle', () => {
  it('löst alte Sammel-IDs auf die feineren Muskeln auf', () => {
    expect(resolveMuscle('ruecken')).toEqual(['lat', 'oberer_ruecken']);
    expect(resolveMuscle('schulter')).toEqual(['schulter_vorne', 'schulter_seite', 'schulter_hinten']);
  });
  it('normalisiert Groß-/Kleinschreibung und Leerzeichen', () => {
    expect(resolveMuscle(' Brust ')).toEqual(['brust']);
  });
  it('lässt unbekannte IDs unverändert', () => {
    expect(resolveMuscle('xyz')).toEqual(['xyz']);
    expect(isKnownMuscle('xyz')).toBe(false);
    expect(isKnownMuscle('brust')).toBe(true);
  });
});

describe('muscleLoad', () => {
  it('zählt den primären Muskel voll und Hilfsmuskeln halb', () => {
    const load = muscleLoad([sessions[0]], exercises);
    expect(load.brust).toBe(2);
    expect(load.trizeps).toBe(1);
    expect(load.bizeps).toBe(1);
  });
  it('begrenzt die Auswertung auf einen Plan', () => {
    const load = muscleLoad(sessions, exercises, { planId: 'p2' });
    expect(load.brust).toBe(1);
  });
  it('begrenzt die Auswertung auf ein Zeitfenster', () => {
    const load = muscleLoad(sessions, exercises, { from: '2026-01-15', to: '2026-02-15' });
    expect(load.brust).toBe(1);
    expect(load.bizeps).toBeUndefined();
  });
  it('teilt den Anteil alter Sammel-IDs auf', () => {
    const load = muscleLoad(
      [{ ...sessions[0], log: [{ exerciseId: 'alt', sets: [{ w: 1, r: 1 }, { w: 1, r: 1 }] }] }],
      exercises,
    );
    expect(load.lat).toBe(1);
    expect(load.oberer_ruecken).toBe(1);
  });
  it('ignoriert leere Sätze', () => {
    const empty: Session = { ...sessions[0], log: [{ exerciseId: 'bank', sets: [] }] };
    expect(muscleLoad([empty], exercises)).toEqual({});
  });
});

describe('exercisesForMuscle', () => {
  it('listet nur Übungen des Muskels mit Satzzahl, absteigend', () => {
    const list = exercisesForMuscle('brust', sessions, exercises);
    expect(list).toEqual([{ exercise: exercises[0], sets: 3 }]);
  });
  it('findet Übungen über alte Sammel-IDs', () => {
    const withAlt: Session[] = [
      { ...sessions[0], log: [{ exerciseId: 'alt', sets: [{ w: 1, r: 1 }] }] },
    ];
    expect(exercisesForMuscle('lat', withAlt, exercises)).toEqual([{ exercise: exercises[2], sets: 1 }]);
  });
});

describe('windowWeeks und setsPerWeek', () => {
  it('rechnet 28 Tage als vier Wochen', () => {
    expect(windowWeeks('2026-01-01', '2026-01-28')).toBe(4);
  });
  it('mindestens eine Woche bei kurzen Zeiträumen', () => {
    expect(windowWeeks('2026-01-01', '2026-01-02')).toBe(1);
  });
  it('teilt die Satzsumme durch die Wochen', () => {
    expect(setsPerWeek({ brust: 8 }, 4)).toEqual({ brust: 2 });
  });
});

describe('levelFor und statusFor', () => {
  it.each([
    [0, 0],
    [0.5, 1],
    [4.9, 1],
    [5, 2],
    [9.9, 2],
    [10, 3],
    [20, 3],
    [20.5, 4],
  ])('ordnet %s Sätzen pro Woche der Stufe %s zu', (spw, level) => {
    expect(levelFor(spw)).toBe(level);
  });
  it('ordnet den Zielbereich ein', () => {
    expect(statusFor(3)).toBe('unter Ziel');
    expect(statusFor(12)).toBe('im Ziel');
    expect(statusFor(25)).toBe('über Ziel');
  });
});
