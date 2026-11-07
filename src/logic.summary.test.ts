import { describe, expect, it } from 'vitest';
import { summarizeItem, summarizeSets } from './logic';
import type { PlanItem } from './types';

const base: PlanItem = { exerciseId: 'x', sets: 3, repMin: 8, repMax: 12 };

describe('summarizeItem', () => {
  it('fasst Sätze, Wiederholungsbereich und Gewicht zusammen', () => {
    expect(summarizeItem({ ...base, weight: 40 })).toBe('3×8–12 · 40 kg');
  });

  it('lässt das Gewicht weg, wenn keines gesetzt ist', () => {
    expect(summarizeItem(base)).toBe('3×8–12');
  });

  it('zeigt bei gleichem Min und Max nur eine Zahl', () => {
    expect(summarizeItem({ ...base, repMin: 10, repMax: 10 })).toBe('3×10');
  });

  it('nutzt Komma als Dezimaltrennzeichen', () => {
    expect(summarizeItem({ ...base, weight: 7.5 })).toBe('3×8–12 · 7,5 kg');
  });
});

describe('summarizeSets', () => {
  it('gibt einen einzelnen Satz als w×r aus', () => {
    expect(summarizeSets([{ w: 40, r: 10 }])).toBe('40×10');
  });

  it('fasst aufeinanderfolgende gleiche Sätze zusammen', () => {
    expect(
      summarizeSets([
        { w: 40, r: 10 },
        { w: 40, r: 10 },
        { w: 35, r: 8 },
      ]),
    ).toBe('2× 40×10, 35×8');
  });

  it('fasst nicht-aufeinanderfolgende gleiche Sätze nicht zusammen', () => {
    expect(
      summarizeSets([
        { w: 40, r: 10 },
        { w: 35, r: 8 },
        { w: 40, r: 10 },
      ]),
    ).toBe('40×10, 35×8, 40×10');
  });

  it('gibt bei leerer Liste einen leeren String zurück', () => {
    expect(summarizeSets([])).toBe('');
  });
});
