import type { Plan, PlanDay, PlanItem, Session, SetLog } from './types';

/** Zahl in deutscher Schreibweise (Komma statt Punkt). */
const fmtNum = (n: number): string => String(n).replace('.', ',');

/** Kurzform eines Plan-Eintrags, z. B. "3×8–12 · 40 kg". */
export function summarizeItem(item: PlanItem): string {
  const reps = item.repMin === item.repMax ? `${item.repMin}` : `${item.repMin}–${item.repMax}`;
  const base = `${item.sets}×${reps}`;
  return item.weight !== undefined ? `${base} · ${fmtNum(item.weight)} kg` : base;
}

/**
 * Kurzform geloggter Sätze, z. B. "40×10, 40×10, 35×8".
 * Aufeinanderfolgende gleiche Sätze werden zusammengefasst: "2× 40×10".
 */
export function summarizeSets(sets: SetLog[]): string {
  const groups: { w: number; r: number; count: number }[] = [];
  for (const s of sets) {
    const last = groups[groups.length - 1];
    if (last && last.w === s.w && last.r === s.r) last.count++;
    else groups.push({ w: s.w, r: s.r, count: 1 });
  }
  return groups
    .map((g) => (g.count > 1 ? `${g.count}× ${fmtNum(g.w)}×${g.r}` : `${fmtNum(g.w)}×${g.r}`))
    .join(', ');
}

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

