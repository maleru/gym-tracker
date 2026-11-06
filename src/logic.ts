import type { Equipment, Plan, PlanDay, PlanItem, Session, SetLog } from './types';

export interface LastPerformance {
  date: string;
  sets: SetLog[];
  note?: string;
}

/** Geschätztes 1RM nach Epley. */
export function estimate1RM(weight: number, reps: number): number {
  return reps === 1 ? weight : weight * (1 + reps / 30);
}

/** Letzte Ausführung einer Übung, optional nur innerhalb eines Plans. */
export function lastPerformance(
  exerciseId: string,
  sessions: Session[],
  planId?: string,
): LastPerformance | undefined {
  const sorted = [...sessions].sort((a, b) => b.date.localeCompare(a.date));
  for (const s of sorted) {
    if (planId && s.planId !== planId) continue;
    const entry = s.log.find((l) => l.exerciseId === exerciseId);
    if (entry && entry.sets.length > 0) {
      return { date: s.date, sets: entry.sets, note: entry.note };
    }
  }
  return undefined;
}

/** Tag des aktiven Plans, dessen letztes Training am längsten zurückliegt. */
export function nextDay(plan: Plan, sessions: Session[]): PlanDay | undefined {
  let best: { day: PlanDay; last: string } | undefined;
  for (const day of plan.days) {
    const last = sessions
      .filter((s) => s.planId === plan.id && s.dayId === day.id)
      .reduce((acc, s) => (s.date > acc ? s.date : acc), '');
    if (!best || last < best.last) best = { day, last };
  }
  return best?.day;
}

export type Hint =
  | { kind: 'up'; text: string }
  | { kind: 'hold'; text: string }
  | { kind: 'same'; text: string };

/** Hinweis für das nächste Training anhand der letzten Sätze. */
export function progressionHint(
  item: PlanItem,
  last: LastPerformance | undefined,
  increments: Record<Equipment, number>,
  equipment: Equipment,
): Hint | undefined {
  if (!last || last.sets.length === 0) return undefined;
  const maxW = Math.max(...last.sets.map((s) => s.w));
  const inc = increments[equipment];
  if (last.sets.every((s) => s.r >= item.repMax)) {
    return { kind: 'up', text: `Alle Sätze geschafft → ${maxW + inc} kg versuchen` };
  }
  if (last.sets.some((s) => s.r < item.repMin)) {
    return { kind: 'hold', text: `Unter ${item.repMin} Wdh. → ${maxW} kg halten` };
  }
  return { kind: 'same', text: `Bei ${maxW} kg Wdh. steigern` };
}

/**
 * Gewichtsvorschlag für einen Ziel-Wiederholungsbereich,
 * abgeleitet aus dem geschätzten 1RM der letzten Sätze.
 */
export function suggestWeight(
  last: LastPerformance,
  repMin: number,
  repMax: number,
  increment: number,
): number {
  const oneRM = Math.max(...last.sets.map((s) => estimate1RM(s.w, s.r)));
  const targetReps = Math.round((repMin + repMax) / 2);
  const raw = oneRM / (1 + targetReps / 30);
  if (increment <= 0) return Math.round(raw * 4) / 4;
  return Math.round(raw / increment) * increment;
}
