import { defaultStep } from './logic';
import type { Exercise } from './types';

export interface CatalogDefault {
  step: number;
  perSide?: boolean;
  barWeight?: number;
}

/**
 * Festgelegte Werte für die Katalog-Übungen (aus dem Praxistest).
 * Gilt für Neuinstallation (Seed) und einmalige Migration bestehender Daten.
 * Bereits gesetzte Werte einer Übung werden nie überschrieben.
 */
export const CATALOG_DEFAULTS: Record<string, CatalogDefault> = {
  'bankdruecken-kh': { step: 1 },
  'schulterdruecken-lh': { step: 0.5, perSide: true, barWeight: 20 },
  'fly-maschine': { step: 2.5 },
  'skull-crusher': { step: 0.5 },
  'seitheben-kabel': { step: 0.5 },
  'trizeps-einzeln-kabel': { step: 0.5 },
  't-bar-rudern': { step: 2.5, perSide: false },
  'rudern-breit-schraegbank-kh': { step: 1 },
  'einarmiger-latzug': { step: 1 },
  'bizeps-curls-schraegbank': { step: 1 },
  'face-pulls': { step: 0.5 },
  'bizeps-iso-curls': { step: 1 },
  'rumaenisches-kreuzheben': { step: 2.5, perSide: true, barWeight: 20 },
  beinpresse: { step: 5 },
  'waden-beinpresse': { step: 5 },
  wadenmaschine: { step: 1 },
  beinbeuger: { step: 2.5 },
  beinstrecker: { step: 2.5 },
  'l-sit': { step: 1 },
  'latzug-mittelbreit': { step: 1 },
  'flys-kabel-schulterhoehe': { step: 1 },
  'bizeps-curls-sz-polster': { step: 0.5 },
  'schraegbank-maschinenpresse': { step: 2.5 },
  'rudern-kh-eng-einzeln': { step: 2 },
  'seitheben-kh': { step: 1 },
  'butterfly-von-oben': { step: 1 },
  'reverse-fly-kabel': { step: 0.5 },
  'bizeps-schraegbank-curls': { step: 0.5 },
  'trizeps-kabel-seil': { step: 0.5 },
  'hack-squat': { step: 2.5 },
  ausfallschritte: { step: 1 },
  'waden-sitzend': { step: 5, perSide: true, barWeight: 0 },
  'beinbeuger-sitzend': { step: 2.5 },
  'bauch-maschine': { step: 1 },
  'bauch-heben-kh': { step: 1 },
};

/** Ergänzt fehlende Felder um die Katalogwerte bzw. den Startwert. Vorhandene Werte bleiben. */
export function withCatalogDefaults(ex: Exercise): Exercise {
  const d = CATALOG_DEFAULTS[ex.id];
  const perSide = ex.perSide ?? d?.perSide;
  const barWeight = ex.barWeight ?? d?.barWeight;
  return {
    ...ex,
    step: ex.step ?? d?.step ?? defaultStep(ex),
    ...(perSide !== undefined ? { perSide } : {}),
    ...(barWeight !== undefined ? { barWeight } : {}),
  };
}
