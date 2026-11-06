import { describe, expect, it } from 'vitest';
import { matchExercise, parsePlanText, toPlanItems } from './textImport';
import type { Exercise } from './types';

const SAMPLE = `3er Split Aufbau 22.10.2026

Push 29.10. 115
Bankdrücken KH 3x6-8 40
Fly Maschine (5;2) 3x10-12 70
Skull Crusher 3x8 15 leicht Stange ja wirklich 15
Seitheben Kabelzug 3x10-12 6,25+

Beine 10.10. 109
Beinpresse 3x8 235
Waden an Beinpresse 3x8 220 (Wadenmaschine 3x10 115)`;

describe('parsePlanText', () => {
  const days = parsePlanText(SAMPLE);

  it('erkennt Tagesüberschriften', () => {
    expect(days.map((d) => d.name)).toEqual(expect.arrayContaining(['Push', 'Beine']));
  });

  it('liest Sätze, Wiederholungsbereich und Gewicht', () => {
    const bank = days[0].items.find((i) => i.name === 'Bankdrücken KH');
    expect(bank).toMatchObject({ sets: 3, repMin: 6, repMax: 8, weight: 40 });
  });

  it('trennt Geräteeinstellung in Klammern ab', () => {
    const fly = days[0].items.find((i) => i.name === 'Fly Maschine');
    expect(fly).toMatchObject({ setting: '(5;2)', weight: 70 });
  });

  it('übernimmt Dezimalgewichte mit Komma und behält das Plus-Zeichen als Hinweis', () => {
    const seit = days[0].items.find((i) => i.name === 'Seitheben Kabelzug');
    expect(seit?.weight).toBe(6.25);
    expect(seit?.hint).toBe('+');
  });

  it('behält Zusatztext als Hinweis', () => {
    const skull = days[0].items.find((i) => i.name === 'Skull Crusher');
    expect(skull?.hint).toContain('leicht');
  });

  it('ignoriert leere Zeilen und meldet Zeilen ohne Übungsnamen', () => {
    const d = parsePlanText('Push\n\nFoo bar ohne Sätze\n3x8 40');
    expect(d[0].unparsed).toEqual(['Foo bar ohne Sätze', '3x8 40']);
  });
});

describe('matchExercise', () => {
  const catalog: Exercise[] = [
    { id: 'b', name: 'Bankdrücken KH', equipment: 'KH', muscles: ['brust'] },
    { id: 'f', name: 'Fly Maschine', equipment: 'Maschine', muscles: ['brust'] },
  ];

  it('findet exakte Treffer ohne Groß-/Kleinschreibung', () => {
    expect(matchExercise('bankdrücken kh', catalog)?.id).toBe('b');
  });
  it('findet eindeutige Teiltreffer', () => {
    expect(matchExercise('Fly', catalog)?.id).toBe('f');
  });
  it('rät nicht bei mehrdeutigen Teiltreffern', () => {
    const ambiguous: Exercise[] = [
      { id: 'c1', name: 'Curls KH', equipment: 'KH', muscles: ['bizeps'] },
      { id: 'c2', name: 'Curls SZ', equipment: 'SZ', muscles: ['bizeps'] },
    ];
    expect(matchExercise('Curls', ambiguous)).toBeUndefined();
  });
  it('ignoriert Groß-/Kleinschreibung und doppelte Leerzeichen', () => {
    expect(matchExercise('  BANKDRÜCKEN    kh ', catalog)?.id).toBe('b');
  });
  it('liefert undefined ohne Treffer', () => {
    expect(matchExercise('Kniebeuge', catalog)).toBeUndefined();
  });
});

describe('toPlanItems', () => {
  it('gibt Geräteeinstellungen nur für Übungen ohne eigene Einstellung zurück', () => {
    const catalog: Exercise[] = [
      { id: 'f', name: 'Fly Maschine', equipment: 'Maschine', muscles: ['brust'] },
      { id: 'g', name: 'Fly Gerät', equipment: 'Maschine', muscles: ['brust'], setting: '(1;1)' },
    ];
    const withSetting = [{ name: 'Fly Maschine', sets: 3, repMin: 10, repMax: 12, setting: '(5;2)' }];
    const withOwn = [{ name: 'Fly Gerät', sets: 3, repMin: 10, repMax: 12, setting: '(5;2)' }];
    expect(toPlanItems(withSetting, catalog).settingUpdates).toEqual([{ exerciseId: 'f', setting: '(5;2)' }]);
    expect(toPlanItems(withOwn, catalog).settingUpdates).toEqual([]);
  });
  it('meldet fehlende Übungen statt sie zu erfinden', () => {
    const catalog: Exercise[] = [{ id: 'b', name: 'Bankdrücken KH', equipment: 'KH', muscles: ['brust'] }];
    const { items, missing } = toPlanItems(
      [
        { name: 'Bankdrücken KH', sets: 3, repMin: 6, repMax: 8, weight: 40 },
        { name: 'Kniebeuge', sets: 3, repMin: 5, repMax: 5 },
      ],
      catalog,
    );
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ exerciseId: 'b', weight: 40 });
    expect(missing).toEqual(['Kniebeuge']);
  });
});
