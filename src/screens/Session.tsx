import { useEffect, useRef, useState } from 'preact/hooks';
import { getSettings, listExercises, listPlans, listSessions, saveSession, updateSettings } from '../db';
import { DecimalInput } from '../components/DecimalInput';
import { ExerciseForm } from './ExerciseEditor';
import { isIsoDate, localDate } from '../date';
import { defaultStep, lastPerformance, summarizeItem, summarizeSets, totalWeight } from '../logic';
import { Collapsible } from '../components/Collapsible';
import { navigate } from '../router';
import type { Exercise, Plan, PlanDay, PlanItem, Session, SetLog, Settings } from '../types';

const fmtKg = (n: number): string => String(Math.round(n * 100) / 100).replace('.', ',');
/** Schrittweite einer Übung; ohne Übung (unbekannt) gilt 1 kg */
const stepOf = (ex?: Exercise): number => (ex ? (ex.step ?? defaultStep(ex)) : 1);

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
  /** nur gesetzt, wenn das Datum manuell geändert wurde */
  date?: string;
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
  const [date, setDate] = useState(today());
  const [dateTouched, setDateTouched] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [resumed, setResumed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  /** Index der aufgeklappten Übung; null = erste offene, -1 = alle zu */
  const [openRow, setOpenRow] = useState<number | null>(null);
  /** Index der Übung, deren Einstellungen gerade im Sheet offen sind */
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  /** Verhindert, dass nach dem Speichern noch ein Entwurf geschrieben wird */
  const savingRef = useRef(false);
  const draftTimer = useRef<number | undefined>(undefined);

  // Escape schließt das Einstellungs-Sheet
  useEffect(() => {
    if (editingIdx === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setEditingIdx(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [editingIdx]);

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
        if (draft.date && isIsoDate(draft.date)) {
          setDate(draft.date);
          setDateTouched(true);
        }
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

  // Entwurf kurz nach der letzten Änderung speichern (entprellt, entlastet die Eingabe).
  // Der Timer läuft auch nach dem Verlassen der Ansicht weiter, daher geht nichts verloren.
  useEffect(() => {
    if (!loaded || saved || !day) return;
    const write = () => {
      if (savingRef.current) return;
      const hasProgress =
        dateTouched || note.trim() !== '' || rows.some((r) => r.done.some(Boolean) || !!r.note?.trim());
      if (!hasProgress) {
        localStorage.removeItem(draftKey);
        return;
      }
      const draft: Draft = {
        locker,
        note,
        date: dateTouched ? date : undefined,
        rows: rows.map((r) => ({ sets: r.sets, done: r.done, note: r.note })),
      };
      localStorage.setItem(draftKey, JSON.stringify(draft));
    };
    window.clearTimeout(draftTimer.current);
    draftTimer.current = window.setTimeout(write, 300);
  }, [rows, locker, note, date, dateTouched, loaded, saved]);

  if (plan === undefined || settings === undefined) return <p class="muted">Lade …</p>;
  if (!plan || !day) return <p>Trainingstag nicht gefunden.</p>;

  // Standard: erste Übung mit offenen Sätzen ist aufgeklappt
  const activeIdx = openRow ?? rows.findIndex((r) => r.done.some((d) => !d));
  const totalDone = rows.reduce((acc, r) => acc + r.done.filter(Boolean).length, 0);
  const totalSets = rows.reduce((acc, r) => acc + r.sets.length, 0);

  const updateNote = (rowIdx: number, note: string) =>
    setRows((rs) => rs.map((r, i) => (i === rowIdx ? { ...r, note } : r)));

  /**
   * Ändert einen Wert funktional auf Basis des aktuellen Stands.
   * Mehrere schnelle Tipps vor dem nächsten Render zählen so alle mit.
   */
  const adjustSet = (rowIdx: number, setIdx: number, field: keyof SetLog, fn: (v: number) => number) =>
    setRows((rs) =>
      rs.map((r, i) =>
        i !== rowIdx
          ? r
          : {
              ...r,
              sets: r.sets.map((s, j) => (j === setIdx ? { ...s, [field]: fn(s[field]) } : s)),
            },
      ),
    );

  /** Übernimmt eine im Sheet geänderte Übung sofort in alle Zeilen, in denen sie vorkommt */
  const applyExercise = async (ex: Exercise) => {
    setRows((rs) =>
      rs.map((r) => ({
        ...r,
        exercise: r.item.exerciseId === ex.id ? ex : r.exercise,
        alt: r.item.altId === ex.id ? ex : r.alt,
      })),
    );
    setEditingIdx(null);
  };

  const toggleDone = (rowIdx: number, setIdx: number, checked: boolean) => {
    const nextDone = rows[rowIdx].done.map((d, j) => (j === setIdx ? checked : d));
    setRows((rs) => rs.map((r, i) => (i !== rowIdx ? r : { ...r, done: nextDone })));
    // Übung komplett abgehakt: nächste offene Übung aufklappen (zuerst danach, sonst davor)
    if (checked && nextDone.every(Boolean)) {
      const open = rows.map((_, i) => i).filter((i) => i !== rowIdx && rows[i].done.some((d) => !d));
      const later = open.find((i) => i > rowIdx);
      setOpenRow(later ?? open[0] ?? -1);
    }
  };

  const save = async () => {
    if (busy || saved) return;
    savingRef.current = true;
    setBusy(true);
    setError('');
    const session: Session = {
      id: uid(),
      planId,
      dayId,
      date: isIsoDate(date) ? date : today(),
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
      savingRef.current = false;
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

      <div class="card grid2">
        <label>
          Spindnummer
          <input inputMode="numeric" value={locker} onInput={(e) => setLocker(e.currentTarget.value)} />
        </label>
        <label>
          Datum
          <input
            type="date"
            max={today()}
            value={date}
            onInput={(e) => {
              setDate(e.currentTarget.value);
              setDateTouched(true);
            }}
          />
        </label>
      </div>

      {rows.map((row, rowIdx) => {
        const doneCount = row.done.filter(Boolean).length;
        const complete = row.sets.length > 0 && doneCount === row.sets.length;
        const doneSets = row.sets.filter((_, i) => row.done[i]);
        return (
          <Collapsible
            key={rowIdx}
            class={`card tight${complete ? ' complete' : ''}`}
            open={activeIdx === rowIdx}
            onToggle={(o) => setOpenRow(o ? rowIdx : -1)}
            header={
              <span class="row">
                <strong>{row.exercise?.name ?? 'Unbekannte Übung'}</strong>
                <span class="muted">
                  {doneCount}/{row.sets.length}
                </span>
              </span>
            }
            summary={doneSets.length > 0 ? summarizeSets(doneSets) : `Ziel: ${summarizeItem(row.item)}`}
            actions={
              row.exercise && (
                <button
                  type="button"
                  class="gear"
                  aria-label="Übung bearbeiten"
                  onClick={() => setEditingIdx(rowIdx)}
                >
                  ⚙
                </button>
              )
            }
          >
            {row.item.hint && <div class="note">{row.item.hint}</div>}

            <div class="sets">
              <div class="set set-head" aria-hidden="true">
                <span>Satz</span>
                <span>{row.exercise?.perSide ? 'kg / Seite' : 'Gewicht (kg)'}</span>
                <span>Wdh.</span>
              </div>
              {row.sets.map((s, setIdx) => (
                <div class={`set compact${row.done[setIdx] ? ' done' : ''}`}>
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
                    step={stepOf(row.exercise)}
                    unit="kg"
                    onAdjust={(fn) => adjustSet(rowIdx, setIdx, 'w', fn)}
                  />
                  <Stepper value={s.r} step={1} unit="Wdh." onAdjust={(fn) => adjustSet(rowIdx, setIdx, 'r', fn)} />
                  {row.exercise?.perSide && (
                    <span class="muted set-total">= {fmtKg(totalWeight(row.exercise, s.w))} kg gesamt</span>
                  )}
                </div>
              ))}
            </div>

            <details class="details">
              <summary>Details · {row.item.repMin}–{row.item.repMax} Wdh.</summary>
              {row.exercise?.setting && <div class="muted">Einstellung: {row.exercise.setting}</div>}
              {row.exercise?.note && <div class="note">📝 {row.exercise.note}</div>}
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
            </details>
          </Collapsible>
        );
      })}

      <div class="card">
        <label>
          Notiz zum Training
          <textarea value={note} onInput={(e) => setNote(e.currentTarget.value)} />
        </label>
      </div>

      {editingIdx !== null && rows[editingIdx]?.exercise && (
        <div class="sheet-backdrop" onClick={(e) => e.target === e.currentTarget && setEditingIdx(null)}>
          <div class="sheet" role="dialog" aria-modal="true" aria-label="Übung bearbeiten">
            <h2>Übung bearbeiten</h2>
            <p class="muted">Änderungen gelten für diese Übung in allen Plänen.</p>
            <ExerciseForm
              initial={rows[editingIdx].exercise}
              onSaved={applyExercise}
              onCancel={() => setEditingIdx(null)}
            />
          </div>
        </div>
      )}

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
  onAdjust,
}: {
  value: number;
  step: number;
  unit: string;
  /** Erhält eine Funktion, die auf dem aktuellen Wert arbeitet (kein veralteter Wert) */
  onAdjust: (fn: (v: number) => number) => void;
}) {
  const round = (n: number) => Math.round(n * 100) / 100;
  return (
    <div class="stepper">
      <button onClick={() => onAdjust((v) => round(Math.max(0, v - step)))} aria-label={`${unit} runter`}>
        −
      </button>
      <DecimalInput value={value} onChange={(n) => onAdjust(() => n)} />
      <button onClick={() => onAdjust((v) => round(v + step))} aria-label={`${unit} hoch`}>
        +
      </button>
      <span class="muted">{unit}</span>
    </div>
  );
}
