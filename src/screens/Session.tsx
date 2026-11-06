import { useEffect, useState } from 'preact/hooks';
import { getSettings, listExercises, listPlans, listSessions, saveSession, updateSettings } from '../db';
import { DecimalInput } from '../components/DecimalInput';
import { localDate } from '../date';
import { lastPerformance } from '../logic';
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
  /** Nur UI-Zustand: nur abgehakte Sätze werden gespeichert. */
  done: boolean[];
  lastText?: string;
  note?: string;
}

/** Zwischenstand eines laufenden Trainings, im localStorage gehalten. */
interface Draft {
  locker: string;
  note: string;
  rows: { sets: SetLog[]; done: boolean[]; note?: string }[];
}

const uid = (): string => crypto.randomUUID();
const today = (): string => localDate();

function readDraft(key: string): Draft | undefined {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as Draft) : undefined;
  } catch {
    return undefined;
  }
}

export function SessionScreen({ planId, dayId }: Props) {
  const draftKey = `draft:${planId}:${dayId}`;
  const [plan, setPlan] = useState<Plan | null>();
  const [day, setDay] = useState<PlanDay>();
  const [rows, setRows] = useState<Row[]>([]);
  const [settings, setSettings] = useState<Settings>();
  const [locker, setLocker] = useState('');
  const [note, setNote] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [resumed, setResumed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

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
      if (!d) {
        setLoaded(true);
        return;
      }

      const exById = new Map(ex.map((e) => [e.id, e]));
      const built: Row[] = d.items.map((item) => {
        const exercise = exById.get(item.exerciseId);
        const last = lastPerformance(item.exerciseId, ses, planId);
        const lastAny = last ?? lastPerformance(item.exerciseId, ses);
        const lastText = lastAny
          ? `Zuletzt ${lastAny.date}: ${lastAny.sets.map((s) => `${s.w}×${s.r}`).join(', ')}`
          : undefined;
        // Jeder Satz übernimmt das Gewicht des gleichnummerigen Satzes vom letzten Mal
        const sets: SetLog[] = Array.from({ length: item.sets }, (_, i) => {
          const prev = lastAny?.sets[Math.min(i, (lastAny?.sets.length ?? 1) - 1)];
          return { w: prev?.w ?? item.weight ?? 0, r: item.repMin };
        });
        return {
          item,
          exercise,
          alt: item.altId ? exById.get(item.altId) : undefined,
          sets,
          done: sets.map(() => false),
          lastText,
          note: undefined,
        };
      });

      const draft = readDraft(draftKey);
      if (draft && draft.rows.length === built.length) {
        setLocker(draft.locker);
        setNote(draft.note);
        setRows(
          built.map((r, i) => ({
            ...r,
            sets: draft.rows[i].sets,
            done: draft.rows[i].done,
            note: draft.rows[i].note,
          })),
        );
        setResumed(true);
      } else {
        setLocker(st.lastLocker ?? '');
        setRows(built);
      }
      setLoaded(true);
    })();
  }, [planId, dayId]);

  // Entwurf bei jeder Änderung speichern, solange das Training nicht gespeichert ist
  useEffect(() => {
    if (!loaded || saved || !day) return;
    const hasProgress = note.trim() !== '' || rows.some((r) => r.done.some(Boolean) || !!r.note?.trim());
    if (!hasProgress) {
      localStorage.removeItem(draftKey);
      return;
    }
    const draft: Draft = {
      locker,
      note,
      rows: rows.map((r) => ({ sets: r.sets, done: r.done, note: r.note })),
    };
    localStorage.setItem(draftKey, JSON.stringify(draft));
  }, [rows, locker, note, loaded, saved]);

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

  const toggleDone = (rowIdx: number, setIdx: number, checked: boolean) =>
    setRows((rs) =>
      rs.map((r, i) =>
        i !== rowIdx ? r : { ...r, done: r.done.map((d, j) => (j === setIdx ? checked : d)) },
      ),
    );

  const save = async () => {
    if (busy || saved) return;
    setBusy(true);
    setError('');
    const session: Session = {
      id: uid(),
      planId,
      dayId,
      date: today(),
      createdAt: new Date().toISOString(),
      locker: locker.trim() || undefined,
      note: note.trim() || undefined,
      log: rows.map((r) => ({
        exerciseId: r.item.exerciseId,
        sets: r.sets.filter((_, i) => r.done[i]),
        note: r.note?.trim() || undefined,
      })),
    };
    try {
      await saveSession(session);
      const lastLocker = locker.trim();
      if (lastLocker) await updateSettings((s) => ({ ...s, lastLocker }));
      localStorage.removeItem(draftKey);
      setSaved(true);
      setTimeout(() => navigate('/'), 600);
    } catch (err) {
      setError(`Speichern fehlgeschlagen: ${(err as Error).message}`);
      setBusy(false);
    }
  };

  return (
    <section>
      <a href="#/" class="back">
        ‹ Start
      </a>
      <h1>{day.name}</h1>

      {resumed && <p class="hint">Angefangenes Training wiederhergestellt.</p>}

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
              <div class={`set${row.done[setIdx] ? ' done' : ''}`}>
                <label class="check setno">
                  <input
                    type="checkbox"
                    checked={row.done[setIdx]}
                    aria-label={`Satz ${setIdx + 1} erledigt`}
                    onChange={(e) => toggleDone(rowIdx, setIdx, e.currentTarget.checked)}
                  />
                  <span class="muted">#{setIdx + 1}</span>
                </label>
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

      {error && <p class="hint">{error}</p>}

      <button class="primary big" onClick={save} disabled={busy || saved}>
        {saved ? 'Gespeichert ✓' : busy ? 'Speichere …' : 'Training speichern'}
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
      <DecimalInput value={value} onChange={onChange} />
      <button onClick={() => onChange(round(value + step))} aria-label={`${unit} hoch`}>
        +
      </button>
      <span class="muted">{unit}</span>
    </div>
  );
}
