import { useEffect, useState } from 'preact/hooks';
import { listExercises, listPlans, listSessions } from '../db';
import { exerciseHistory, METRIC_LABEL, percentChange, type Metric } from '../history';
import { LineChart } from '../components/LineChart';
import type { Exercise, Plan, Session } from '../types';

const byName = (a: Exercise, b: Exercise): number => a.name.localeCompare(b.name, 'de');
const fmtDate = (iso: string): string => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.`;

export function StatsScreen() {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [exerciseId, setExerciseId] = useState('');
  const [planId, setPlanId] = useState('');
  const [metric, setMetric] = useState<Metric>('oneRM');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    Promise.all([listExercises(), listSessions(), listPlans()]).then(([ex, ses, pl]) => {
      setExercises(ex.sort(byName));
      setSessions(ses);
      setPlans(pl);
      setLoaded(true);
    });
  }, []);

  if (!loaded) return <p class="muted">Lade …</p>;

  // Nur Übungen, die tatsächlich trainiert wurden
  const trained = exercises.filter((x) => sessions.some((s) => s.log.some((l) => l.exerciseId === x.id && l.sets.length > 0)));
  const selected = exerciseId || trained[0]?.id || '';
  const points = selected ? exerciseHistory(selected, sessions, planId || undefined) : [];
  const change = percentChange(points, metric);

  if (trained.length === 0) {
    return (
      <section>
        <h1>Fortschritt</h1>
        <p class="muted">Noch keine Trainingsdaten vorhanden.</p>
      </section>
    );
  }

  return (
    <section>
      <h1>Fortschritt</h1>

      <div class="card">
        <label>
          Übung
          <select value={selected} onChange={(e) => setExerciseId(e.currentTarget.value)}>
            {trained.map((x) => (
              <option value={x.id}>{x.name}</option>
            ))}
          </select>
        </label>
        <div class="grid2">
          <label>
            Kennzahl
            <select value={metric} onChange={(e) => setMetric(e.currentTarget.value as Metric)}>
              {(Object.keys(METRIC_LABEL) as Metric[]).map((m) => (
                <option value={m}>{METRIC_LABEL[m]}</option>
              ))}
            </select>
          </label>
          <label>
            Zeitraum
            <select value={planId} onChange={(e) => setPlanId(e.currentTarget.value)}>
              <option value="">Alle Pläne</option>
              {plans.map((p) => (
                <option value={p.id}>{p.name}</option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div class="card">
        <LineChart points={points.map((p) => ({ label: fmtDate(p.date), y: p[metric] }))} />
        {change !== undefined && (
          <p class={`delta ${change >= 0 ? 'up' : 'down'}`}>
            {change >= 0 ? '+' : ''}
            {change.toFixed(1).replace('.', ',')} % seit dem ersten Training
          </p>
        )}
      </div>
    </section>
  );
}
