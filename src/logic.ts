import type { Plan, PlanDay, Session, SetLog } from './types';

export interface LastPerformance {
  date: string;
  sets: SetLog[];
  note?: string;
}

/** Geschätztes 1RM nach Epley. Sätze ohne Wiederholungen zählen nicht (0). */
export function estimate1RM(weight: number, reps: number): number {
  if (reps <= 0) return 0;
  return reps === 1 ? weight : weight * (1 + reps / 30);
}

/** Letzte Ausführung einer Übung, optional nur innerhalb eines Plans. */
export function lastPerformance(
  exerciseId: string,
  sessions: Session[],
  planId?: string,
): LastPerformance | undefined {
  const sorted = [...sessions].sort(
    (a, b) => b.date.localeCompare(a.date) || (b.createdAt ?? '').localeCompare(a.createdAt ?? ''),
  );
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

