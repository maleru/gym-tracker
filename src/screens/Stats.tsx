import { useEffect, useState } from 'preact/hooks';
import './muscle-ui.css';
import { listExercises, listPlans, listSessions } from '../db';
import { addDays, localDate } from '../date';
import { exerciseHistory, METRIC_LABEL, percentChange, type Metric } from '../history';
import { LineChart } from '../components/LineChart';
import {
  LEVEL_LABELS,
  MUSCLES,
  exercisesForMuscle,
  isKnownMuscle,
  muscleLabel,
  muscleLoad,
  setsPerWeek,
  statusFor,
  windowWeeks,
  type LoadOptions,
} from '../muscles';
import type { Exercise, Plan, Session } from '../types';

type BodyMapComponent = typeof import('../components/BodyMap').BodyMap;

type RangeKey = '7d' | '4w' | 'plan' | 'all';

const RANGE_LABEL: Record<RangeKey, string> = {
  '7d': 'Letzte 7 Tage',
  '4w': 'Letzte 4 Wochen',
  plan: 'Aktueller Plan',
  all: 'Gesamt',
};

const byName = (a: Exercise, b: Exercise): number => a.name.localeCompare(b.name, 'de');
const fmtDate = (iso: string): string => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.`;
const fmtNum = (v: number): string => (Math.round(v * 10) / 10).toString().replace('.', ',');

/** Filter und Wochenzahl für den gewählten Zeitraum. */
function rangeFor(key: RangeKey, plans: Plan[], sessions: Session[]): { opts: LoadOptions; weeks: number } {
  const today = localDate();
  if (key === 'plan') {
    const active = plans.find((p) => p.active);
    // Ohne aktiven Plan wird kein Training gezählt
    if (!active) return { opts: { planId: '__none__' }, weeks: 1 };
    return { opts: { planId: active.id, from: active.start, to: today }, weeks: windowWeeks(active.start, today) };
  }
  if (key === 'all') {
    const first = sessions.reduce((acc, s) => (acc === '' || s.date < acc ? s.date : acc), '');
    return { opts: {}, weeks: first ? windowWeeks(first, today) : 1 };
  }
  const from = addDays(today, key === '7d' ? -6 : -27);
  return { opts: { from, to: today }, weeks: windowWeeks(from, today) };
}

export function StatsScreen() {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [exerciseId, setExerciseId] = useState('');
  const [planId, setPlanId] = useState('');
  const [metric, setMetric] = useState<Metric>('oneRM');
  const [loaded, setLoaded] = useState(false);
  const [range, setRange] = useState<RangeKey>('4w');
  const [BodyMap, setBodyMap] = useState<BodyMapComponent | null>(null);
  const [pickedMuscle, setPickedMuscle] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([listExercises(), listSessions(), listPlans()]).then(([ex, ses, pl]) => {
      setExercises(ex.sort(byName));
      setSessions(ses);
      setPlans(pl);
      setLoaded(true);
    });
    // Körperkarte erst bei Bedarf nachladen
    import('../components/BodyMap').then((m) => setBodyMap(() => m.BodyMap));
  }, []);

  if (!loaded) return <p class="muted">Lade …</p>;

  // Nur Übungen, die tatsächlich trainiert wurden
  const trained = exercises.filter((x) =>
    sessions.some((s) => s.log.some((l) => l.exerciseId === x.id && l.sets.length > 0)),
  );
  const selected = exerciseId || trained[0]?.id || '';
  const points = selected ? exerciseHistory(selected, sessions, planId || undefined) : [];
  const change = percentChange(points, metric);

  // Körperkarte und Balkenliste
  const { opts, weeks } = rangeFor(range, plans, sessions);
  const spw = setsPerWeek(muscleLoad(sessions, exercises, opts), weeks);
  const intensity = Object.fromEntries(Object.entries(spw).map(([k, v]) => [k, Math.min(1, v / 20)]));
  const ranked = MUSCLES.map((m) => ({ id: m.id, label: m.label, spw: spw[m.id] ?? 0 })).sort(
    (a, b) => b.spw - a.spw,
  );
  const unknown = Object.keys(spw)
    .filter((k) => !isKnownMuscle(k))
    .sort();
  const detail = pickedMuscle ? exercisesForMuscle(pickedMuscle, sessions, exercises, opts) : [];
  const pickedSpw = pickedMuscle ? (spw[pickedMuscle] ?? 0) : 0;

  return (
    <section>
      <h1>Fortschritt</h1>

      {trained.length === 0 ? (
        <p class="muted">Noch keine Trainingsdaten. Diagramm und Vergleich erscheinen nach dem ersten Training.</p>
      ) : (
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
              Plan
              <select value={planId} onChange={(e) => setPlanId(e.currentTarget.value)}>
                <option value="">Alle Pläne</option>
                {plans.map((p) => (
                  <option value={p.id}>{p.name}</option>
                ))}
              </select>
            </label>
          </div>
          <LineChart points={points.map((p) => ({ label: fmtDate(p.date), y: p[metric] }))} />
          {change !== undefined && (
            <p class={`delta ${change >= 0 ? 'up' : 'down'}`}>
              {change >= 0 ? '+' : ''}
              {fmtNum(change)} % seit dem ersten Training
            </p>
          )}
        </div>
      )}

      <div class="card">
        <h2>Muskelbelastung</h2>
        <label>
          Zeitraum
          <select value={range} onChange={(e) => setRange(e.currentTarget.value as RangeKey)}>
            {(Object.keys(RANGE_LABEL) as RangeKey[]).map((k) => (
              <option value={k}>{RANGE_LABEL[k]}</option>
            ))}
          </select>
        </label>

        {BodyMap ? (
          <BodyMap
            intensity={intensity}
            selected={pickedMuscle}
            onPick={(m) => setPickedMuscle(pickedMuscle === m ? null : m)}
          />
        ) : (
          <p class="muted">Körperkarte lädt …</p>
        )}

        <ul class="legend" aria-label="Legende Sätze pro Woche">
          {LEVEL_LABELS.map((label, i) => (
            <li>
              <span class={`swatch lvl-${i}`} /> {label}
            </li>
          ))}
          <li class="muted">Sätze/Woche</li>
        </ul>
        <p class="muted">Zielbereich 10–20 Sätze pro Woche. Antippen zeigt Details zum Muskel.</p>

        {pickedMuscle && (
          <div class="detail">
            <h2>{muscleLabel(pickedMuscle)}</h2>
            <p>
              <strong>{fmtNum(pickedSpw)}</strong> Sätze/Woche · {statusFor(pickedSpw)}
            </p>
            <ul class="list">
              {detail.length === 0 && <li class="muted">Im Zeitraum nicht trainiert.</li>}
              {detail.map((d) => (
                <li class="item">
                  <span class="strong">{d.exercise.name}</span>
                  <span class="muted"> · {d.sets} Sätze</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <h2>Alle Muskeln</h2>
        <ul class="bars">
          {ranked.map((m) => (
            <li>
              <button class="bar-btn" onClick={() => setPickedMuscle(m.id)} aria-label={`${m.label}: ${fmtNum(m.spw)} Sätze pro Woche`}>
                <span class="bar-label">{m.label}</span>
                <span class="bar-track">
                  <span class="bar-fill" style={{ width: `${Math.min(100, (m.spw / 20) * 100)}%` }} />
                </span>
                <span class="muted bar-value">{fmtNum(m.spw)}</span>
              </button>
            </li>
          ))}
        </ul>

        {unknown.length > 0 && (
          <div>
            <h2>Ohne Kartenposition</h2>
            <p class="muted">
              Diese Muskel-Namen stammen aus älteren Daten und sind keiner Körperstelle zugeordnet:{' '}
              {unknown.map((u) => `${u} (${fmtNum(spw[u])})`).join(', ')}
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
