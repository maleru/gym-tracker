import { estimate1RM, totalWeight } from './logic';
import type { Exercise, Session } from './types';

export interface HistoryPoint {
  date: string;
  /** höchstes Gewicht in der Session (kg) */
  weight: number;
  /** höchste Wiederholungszahl in der Session */
  reps: number;
  /** bestes geschätztes 1RM (Epley) */
  oneRM: number;
  /** Volumen: Summe aus Gewicht × Wdh. */
  volume: number;
}

export type Metric = 'weight' | 'reps' | 'oneRM' | 'volume';

export const METRIC_LABEL: Record<Metric, string> = {
  weight: 'Gewicht (max, kg)',
  reps: 'Wiederholungen (max)',
  oneRM: 'Geschätztes 1RM (kg)',
  volume: 'Volumen (kg × Wdh.)',
};

/**
 * Verlauf einer Übung über alle Sessions, optional auf einen Plan begrenzt.
 * Gewichte werden über `totalWeight` in Gesamtgewicht umgerechnet (Pro-Seite-Übungen).
 */
export function exerciseHistory(
  exerciseId: string,
  sessions: Session[],
  planId?: string,
  ex?: Pick<Exercise, 'perSide' | 'barWeight'>,
): HistoryPoint[] {
  return sessions
    .filter((s) => !planId || s.planId === planId)
    .flatMap((s) =>
      s.log
        .filter((l) => l.exerciseId === exerciseId && l.sets.length > 0)
        .map((l) => {
          const totals = l.sets.map((x) => ({ w: totalWeight(ex, x.w), r: x.r }));
          return {
            date: s.date,
            weight: Math.max(...totals.map((x) => x.w)),
            reps: Math.max(...totals.map((x) => x.r)),
            oneRM: Math.max(...totals.map((x) => estimate1RM(x.w, x.r))),
            volume: totals.reduce((acc, x) => acc + x.w * x.r, 0),
          };
        }),
    )
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** Prozentuale Veränderung zwischen erstem und letztem Punkt. */
export function percentChange(points: HistoryPoint[], metric: Metric): number | undefined {
  if (points.length < 2) return undefined;
  const first = points[0][metric];
  const last = points[points.length - 1][metric];
  if (first === 0) return undefined;
  return ((last - first) / first) * 100;
}
