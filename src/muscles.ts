import type { Exercise, Session } from './types';

/* ------------------------------------------------------------------ */
/* Muskel-Register                                                     */
/* ------------------------------------------------------------------ */

export type MuscleView = 'front' | 'back' | 'both';

export interface MuscleDef {
  id: string;
  label: string;
  view: MuscleView;
}

/** Zentrale Liste aller Muskelgruppen der Körperkarte. */
export const MUSCLES: MuscleDef[] = [
  { id: 'brust', label: 'Brust', view: 'front' },
  { id: 'schulter_vorne', label: 'Schulter vorne', view: 'front' },
  { id: 'schulter_seite', label: 'Schulter seitlich', view: 'both' },
  { id: 'schulter_hinten', label: 'Schulter hinten', view: 'back' },
  { id: 'bizeps', label: 'Bizeps', view: 'front' },
  { id: 'trizeps', label: 'Trizeps', view: 'back' },
  { id: 'unterarme', label: 'Unterarme', view: 'both' },
  { id: 'bauch', label: 'Bauch', view: 'front' },
  { id: 'bauch_seitlich', label: 'Seitliche Bauchmuskeln', view: 'front' },
  { id: 'nacken', label: 'Nacken / Trapez', view: 'back' },
  { id: 'lat', label: 'Latissimus', view: 'back' },
  { id: 'oberer_ruecken', label: 'Oberer Rücken', view: 'back' },
  { id: 'unterer_ruecken', label: 'Unterer Rücken', view: 'back' },
  { id: 'gluteus', label: 'Gesäß', view: 'back' },
  { id: 'quadrizeps', label: 'Quadrizeps', view: 'front' },
  { id: 'adduktoren', label: 'Adduktoren', view: 'front' },
  { id: 'beinbeuger', label: 'Beinbeuger', view: 'back' },
  { id: 'waden', label: 'Waden', view: 'both' },
];

/**
 * Alte Muskel-IDs aus bestehenden Daten. Sie werden auf die feineren IDs
 * aufgeteilt, damit alte Backups ohne Migration korrekt dargestellt werden.
 */
const ALIASES: Record<string, string[]> = {
  ruecken: ['lat', 'oberer_ruecken'],
  schulter: ['schulter_vorne', 'schulter_seite', 'schulter_hinten'],
};

/** Löst eine (ggf. alte) Muskel-ID in Register-IDs auf. Unbekannte IDs bleiben unverändert. */
export function resolveMuscle(raw: string): string[] {
  const id = raw.trim().toLowerCase();
  return ALIASES[id] ?? [id];
}

export function isKnownMuscle(id: string): boolean {
  return MUSCLES.some((m) => m.id === id);
}

export function muscleLabel(id: string): string {
  return MUSCLES.find((m) => m.id === id)?.label ?? id;
}

/* ------------------------------------------------------------------ */
/* Belastung                                                           */
/* ------------------------------------------------------------------ */

export interface LoadOptions {
  /** Inklusive Startdatum, ISO YYYY-MM-DD */
  from?: string;
  /** Inklusive Enddatum, ISO YYYY-MM-DD */
  to?: string;
  planId?: string;
}

function inWindow(s: Session, opts: LoadOptions): boolean {
  if (opts.planId && s.planId !== opts.planId) return false;
  if (opts.from && s.date < opts.from) return false;
  if (opts.to && s.date > opts.to) return false;
  return true;
}

/**
 * Muskelbelastung als Satzsumme je Muskel.
 * Primärer Muskel (erster Eintrag) zählt 1 pro Satz, weitere 0,5.
 * Aufgeteilte Alt-IDs (z. B. „ruecken“) teilen den Anteil gleichmäßig.
 */
export function muscleLoad(
  sessions: Session[],
  exercises: Exercise[],
  opts: LoadOptions = {},
): Record<string, number> {
  const exById = new Map(exercises.map((e) => [e.id, e]));
  const load: Record<string, number> = {};
  for (const s of sessions) {
    if (!inWindow(s, opts)) continue;
    for (const entry of s.log) {
      const ex = exById.get(entry.exerciseId);
      if (!ex || entry.sets.length === 0) continue;
      ex.muscles.forEach((raw, i) => {
        const targets = resolveMuscle(raw);
        const share = ((i === 0 ? 1 : 0.5) * entry.sets.length) / targets.length;
        for (const t of targets) load[t] = (load[t] ?? 0) + share;
      });
    }
  }
  return load;
}

/** Übungen, die im Zeitraum einen bestimmten Muskel belastet haben, mit Satzzahl. */
export function exercisesForMuscle(
  muscle: string,
  sessions: Session[],
  exercises: Exercise[],
  opts: LoadOptions = {},
): { exercise: Exercise; sets: number }[] {
  const exById = new Map(exercises.map((e) => [e.id, e]));
  const counts = new Map<string, number>();
  for (const s of sessions) {
    if (!inWindow(s, opts)) continue;
    for (const entry of s.log) {
      const ex = exById.get(entry.exerciseId);
      if (!ex || entry.sets.length === 0) continue;
      const hits = ex.muscles.some((raw) => resolveMuscle(raw).includes(muscle));
      if (hits) counts.set(ex.id, (counts.get(ex.id) ?? 0) + entry.sets.length);
    }
  }
  return [...counts.entries()]
    .map(([id, sets]) => ({ exercise: exById.get(id)!, sets }))
    .sort((a, b) => b.sets - a.sets);
}

/** Anzahl Wochen im Zeitraum (mindestens eine Woche). */
export function windowWeeks(from: string, to: string): number {
  const days = (Date.parse(to) - Date.parse(from)) / 86_400_000 + 1;
  return Math.max(1, days / 7);
}

/** Satzsumme je Muskel umgerechnet auf Sätze pro Woche. */
export function setsPerWeek(load: Record<string, number>, weeks: number): Record<string, number> {
  return Object.fromEntries(Object.entries(load).map(([k, v]) => [k, v / weeks]));
}

/* ------------------------------------------------------------------ */
/* Stufen und Zielbereich                                              */
/* ------------------------------------------------------------------ */

/** Beschriftung der Stufen 0 bis 4 für die Legende. */
export const LEVEL_LABELS = ['0', '1–4', '5–9', '10–20', '>20'] as const;

/** Ordnet Sätze pro Woche einer Stufe 0..4 zu. */
export function levelFor(spw: number): number {
  if (spw <= 0) return 0;
  if (spw < 5) return 1;
  if (spw < 10) return 2;
  if (spw <= 20) return 3;
  return 4;
}

/** Einordnung zum Zielbereich (10–20 Sätze pro Woche). */
export function statusFor(spw: number): 'unter Ziel' | 'im Ziel' | 'über Ziel' {
  const level = levelFor(spw);
  if (level <= 2) return 'unter Ziel';
  if (level === 3) return 'im Ziel';
  return 'über Ziel';
}
