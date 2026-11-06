import type { Exercise, Session } from './types';

/**
 * Muskelbelastung eines Plans: Anzahl Sätze je Muskel.
 * Primärer Muskel (erster Eintrag) zählt voll, alle weiteren halb.
 */
export function muscleLoad(
  sessions: Session[],
  exercises: Exercise[],
  planId?: string,
): Record<string, number> {
  const exById = new Map(exercises.map((e) => [e.id, e]));
  const load: Record<string, number> = {};
  for (const s of sessions) {
    if (planId && s.planId !== planId) continue;
    for (const entry of s.log) {
      const ex = exById.get(entry.exerciseId);
      if (!ex || entry.sets.length === 0) continue;
      ex.muscles.forEach((m, i) => {
        load[m] = (load[m] ?? 0) + (i === 0 ? 1 : 0.5) * entry.sets.length;
      });
    }
  }
  return load;
}

/** Normiert die Belastung auf 0..1 bezogen auf den stärksten Muskel. */
export function normalize(load: Record<string, number>): Record<string, number> {
  const max = Math.max(0, ...Object.values(load));
  if (max === 0) return {};
  return Object.fromEntries(Object.entries(load).map(([k, v]) => [k, v / max]));
}
