import { describe, expect, it } from 'vitest';
import { isIsoDate } from './date';

describe('isIsoDate', () => {
  it('akzeptiert gültige Kalenderdaten', () => {
    expect(isIsoDate('2026-11-07')).toBe(true);
    expect(isIsoDate('2024-02-29')).toBe(true);
  });

  it('lehnt ungültige Formate und Kalenderdaten ab', () => {
    expect(isIsoDate('')).toBe(false);
    expect(isIsoDate('07.11.2026')).toBe(false);
    expect(isIsoDate('2026-13-01')).toBe(false);
    expect(isIsoDate('2025-02-29')).toBe(false);
    expect(isIsoDate('2026-11-7')).toBe(false);
  });
});
