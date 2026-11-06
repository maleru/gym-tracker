import { useEffect, useState } from 'preact/hooks';
import { getSettings, listExercises, listPlans, listSessions, saveSession, saveSettings } from '../db';
import { lastPerformance, progressionHint } from '../logic';
import { navigate } from '../router';
import type { Exercise, Plan, PlanDay, PlanItem, Session, SetLog, Settings } from '../types';

interface Props {
  planId: string;
  dayId: string;
}

interface Row {
  item: PlanItem;
  exercise?: Exercise;
  alt?: Exercise;
  sets: SetLog[];
  hint?: string;
  lastText?: string;
  note?: string;
}

const uid = (): string => crypto.randomUUID();
const today = (): string => new Date().toISOString().slice(0, 10);

export function SessionScreen({ planId, dayId }: Props) {
  const [plan, setPlan] = useState<Plan | null>();
  const [day, setDay] = useState<PlanDay>();
  const [rows, setRows] = useState<Row[]>([]);
  const [settings, setSettings] = useState<Settings>();
  const [locker, setLocker] = useState('');
  const [note, setNote] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    (async () => {
      const [plans, ex, ses, st] = await Promise.all([
        listPlans(),
        listExercises(),
        listSessions(),
        getSettings(),
      ]);
      const p = plans.find((x) => x.id === planId) ?? null;
      const d = p?.days.find((x) => x.id === dayId);
      setPlan(p);
      setDay(d);
      setSettings(st);
      setLocker(st.lastLocker ?? '');
      if (!d) return;

      const exById = new Map(ex.map((e) => [e.id, e]));
      setRows(
        d.items.map((item) => {
          const exercise = exById.get(item.exerciseId);
          const last = lastPerformance(item.exerciseId, ses, planId);
          const lastAny = last ?? lastPerformance(item.exerciseId, ses);
          const hint = exercise
            ? progressionHint(item, lastAny, st.increments, exercise.equipment)
            : undefined;
          const lastText = lastAny
            ? `Zuletzt ${lastAny.date}: ${lastAny.sets.map((s) => `${s.w}×${s.r}`).join(', ')}`
            : undefined;
          const startW = lastAny?.sets[0]?.w ?? item.weight ?? 0;
          const sets: SetLog[] = Array.from({ length: item.sets }, () => ({ w: startW, r: item.repMin }));
          return {
            item,
            exercise,
            alt: item.altId ? exById.get(item.altId) : undefined,
            sets,
            hint: hint?.text,
            lastText,
            note: undefined,
          };
        }),
      );
    })();
  }, [planId, dayId]);

  if (plan === undefined || settings === undefined) return <p class="muted">Lade …</p>;
  if (!plan || !day) return <p>Trainingstag nicht gefunden.</p>;

  const updateNote = (rowIdx: number, note: string) =>
    setRows((rs) => rs.map((r, i) => (i === rowIdx ? { ...r, note } : r)));

  const updateSet = (rowIdx: number, setIdx: number, patch: Partial<SetLog>) =>
    setRows((rs) =>
      rs.map((r, i) =>
        i !== rowIdx
          ? r
          : { ...r, sets: r.sets.map((s, j) => (j === setIdx ? { ...s, ...patch } : s)) },
      ),
    );

  const save = async () => {
    const session: Session = {
      id: uid(),
      planId,
      dayId,
      date: today(),
      locker: locker.trim() || undefined,
      note: note.trim() || undefined,
      log: rows.map((r) => ({
        exerciseId: r.item.exerciseId,
        sets: r.sets.filter((s) => s.w > 0 || s.r > 0),
        note: r.note?.trim() || undefined,
      })),
    };
    await saveSession(session);
    if (settings) await saveSettings({ ...settings, lastLocker: locker.trim() || settings.lastLocker });
    setSaved(true);
    setTimeout(() => navigate('/'), 600);
  };

  return (
    <section>
      <a href="#/" class="back">
        ‹ Start
      </a>
      <h1>{day.name}</h1>

      <div class="card">
        <label>
          Spindnummer
          <input inputMode="numeric" value={locker} onInput={(e) => setLocker(e.currentTarget.value)} />
        </label>
      </div>

      {rows.map((row, rowIdx) => (
        <div class="card">
          <div class="row">
            <strong>{row.exercise?.name ?? 'Unbekannte Übung'}</strong>
            <span class="muted">
              {row.item.repMin}–{row.item.repMax} Wdh.
            </span>
          </div>
          {row.exercise?.setting && <div class="muted">Einstellung: {row.exercise.setting}</div>}
          {row.exercise?.note && <div class="note">📝 {row.exercise.note}</div>}
          {row.item.hint && <div class="note">⚠️ {row.item.hint}</div>}
          {row.alt && <div class="muted">Alternative: {row.alt.name}</div>}
          {row.lastText && <div class="muted">{row.lastText}</div>}
          {row.hint && <div class="hint">💡 {row.hint}</div>}
          <label>
            Notiz zu dieser Übung
            <input
              value={row.note ?? ''}
              placeholder="z. B. Gewicht war schwer, Schulter zog"
              onInput={(e) => updateNote(rowIdx, e.currentTarget.value)}
            />
          </label>

          <div class="sets">
            {row.sets.map((s, setIdx) => (
              <div class="set">
                <span class="muted">#{setIdx + 1}</span>
                <Stepper
                  value={s.w}
                  step={row.exercise ? settings.increments[row.exercise.equipment] || 1 : 1}
                  unit="kg"
                  onChange={(w) => updateSet(rowIdx, setIdx, { w })}
                />
                <Stepper value={s.r} step={1} unit="Wdh." onChange={(r) => updateSet(rowIdx, setIdx, { r })} />
              </div>
            ))}
          </div>
        </div>
      ))}

      <div class="card">
        <label>
          Notiz zum Training
          <textarea value={note} onInput={(e) => setNote(e.currentTarget.value)} />
        </label>
      </div>

      <button class="primary big" onClick={save} disabled={saved}>
        {saved ? 'Gespeichert ✓' : 'Training speichern'}
      </button>
    </section>
  );
}

function Stepper({
  value,
  step,
  unit,
  onChange,
}: {
  value: number;
  step: number;
  unit: string;
  onChange: (v: number) => void;
}) {
  const round = (n: number) => Math.round(n * 100) / 100;
  return (
    <div class="stepper">
      <button onClick={() => onChange(round(Math.max(0, value - step)))} aria-label={`${unit} runter`}>
        −
      </button>
      <input
        type="text"
        inputMode="decimal"
        value={String(value).replace('.', ',')}
        onInput={(e) => {
          const n = Number(e.currentTarget.value.replace(',', '.'));
          if (!Number.isNaN(n)) onChange(n);
        }}
      />
      <button onClick={() => onChange(round(value + step))} aria-label={`${unit} hoch`}>
        +
      </button>
      <span class="muted">{unit}</span>
    </div>
  );
}
