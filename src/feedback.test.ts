import { describe, expect, it } from 'vitest';
import { CATALOG_DEFAULTS, withCatalogDefaults } from './catalogDefaults';
import { defaultStep, totalWeight } from './logic';
import { exerciseHistory } from './history';
import type { Exercise, Session } from './types';

describe('totalWeight', () => {
  it('lässt das Gewicht bei KH unverändert', () => {
    expect(totalWeight({ perSide: false }, 40)).toBe(40);
    expect(totalWeight(undefined, 40)).toBe(40);
  });

  it('rechnet Pro-Seite mit Standard-Stange 20 kg', () => {
    expect(totalWeight({ perSide: true }, 10)).toBe(40);
  });

  it('nutzt das eigene Stangengewicht, auch 0 kg', () => {
    expect(totalWeight({ perSide: true, barWeight: 0 }, 40)).toBe(80);
  });
});

describe('defaultStep', () => {
  const ex = (name: string, muscles: string[], equipment: Exercise['equipment']) => ({ name, muscles, equipment });

  it('gibt Beinpresse und Waden 5 kg', () => {
    expect(defaultStep(ex('Beinpresse', ['quadrizeps'], 'Maschine'))).toBe(5);
    expect(defaultStep(ex('Waden sitzend', ['waden'], 'Maschine'))).toBe(5);
  });

  it('gibt Arme und Schultern 0,5 kg', () => {
    expect(defaultStep(ex('Seitheben', ['schulter'], 'Kabel'))).toBe(0.5);
    expect(defaultStep(ex('Curls', ['bizeps'], 'KH'))).toBe(0.5);
  });

  it('gibt Maschinen 2,5 kg und sonst 1 kg', () => {
    expect(defaultStep(ex('Fly', ['brust'], 'Maschine'))).toBe(2.5);
    expect(defaultStep(ex('Bankdrücken', ['brust'], 'KH'))).toBe(1);
  });
});

describe('withCatalogDefaults', () => {
  const base: Exercise = { id: 'beinpresse', name: 'Beinpresse', equipment: 'Maschine', muscles: ['quadrizeps'] };

  it('setzt Katalogwerte bei fehlenden Feldern', () => {
    expect(withCatalogDefaults(base)).toMatchObject({ step: 5 });
  });

  it('überschreibt vorhandene Werte nicht', () => {
    expect(withCatalogDefaults({ ...base, step: 2 }).step).toBe(2);
    const lh = { ...base, id: 'schulterdruecken-lh', equipment: 'LH' as const, muscles: ['schulter'], perSide: false };
    expect(withCatalogDefaults(lh).perSide).toBe(false);
  });

  it('ist idempotent', () => {
    const once = withCatalogDefaults(base);
    expect(withCatalogDefaults(once)).toEqual(once);
  });

  it('übernimmt Pro-Seite und Stange aus dem Katalog', () => {
    expect(CATALOG_DEFAULTS['schulterdruecken-lh']).toMatchObject({ perSide: true, barWeight: 20 });
    expect(CATALOG_DEFAULTS['waden-sitzend']).toMatchObject({ perSide: true, barWeight: 0 });
  });

  it('bekommt unbekannte Übungen den Vorschlag', () => {
    const custom: Exercise = { id: 'eigen', name: 'Eigene', equipment: 'KH', muscles: ['brust'] };
    expect(withCatalogDefaults(custom).step).toBe(1);
  });
});

describe('exerciseHistory mit Pro-Seite', () => {
  const sessions: Session[] = [
    {
      id: 's1',
      planId: 'p',
      dayId: 'd',
      date: '2026-01-01',
      log: [{ exerciseId: 'sd', sets: [{ w: 10, r: 10 }] }],
    },
  ];

  it('rechnet das Gesamtgewicht ein', () => {
    const [pt] = exerciseHistory('sd', sessions, undefined, { perSide: true, barWeight: 20 });
    expect(pt.weight).toBe(40);
    expect(pt.volume).toBe(400);
  });

  it('lässt Werte ohne Pro-Seite unverändert', () => {
    const [pt] = exerciseHistory('sd', sessions);
    expect(pt.weight).toBe(10);
  });
});
