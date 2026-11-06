import { useEffect, useState } from 'preact/hooks';
import {
  deletePlan,
  getSettings,
  listExercises,
  listPlans,
  listSessions,
  savePlan,
} from '../db';
import { lastPerformance, suggestWeight } from '../logic';
import { navigate } from '../router';
import { ExerciseCatalog } from './ExerciseEditor';
import { TextImport } from './TextImport';
import type { Equipment, Exercise, Plan, PlanDay, PlanItem, Session, Settings } from '../types';

const uid = (): string => crypto.randomUUID();
const today = (): string => new Date().toISOString().slice(0, 10);
const EQUIPMENT: Equipment[] = ['KH', 'LH', 'SZ', 'Kabel', 'Maschine', 'Koerper'];
const byName = (a: { name: string }, b: { name: string }): number => a.name.localeCompare(b.name, 'de');

/** Split-Vorlagen: Name → Tagesnamen */
export const SPLITS: Record<string, string[]> = {
  '2er Ganzkörper A/B': ['Tag A', 'Tag B'],
  '2,5er (2× Oberkörper, 1× Beine)': ['Oberkörper 1', 'Beine', 'Oberkörper 2'],
  '3er Push/Pull/Beine': ['Push', 'Pull', 'Beine'],
  '4er Ober-/Unterkörper': ['Oberkörper A', 'Unterkörper A', 'Oberkörper B', 'Unterkörper B'],
  Eigener: [],
};

function updateDay(plan: Plan, dayId: string, fn: (d: PlanDay) => PlanDay): Plan {
  return { ...plan, days: plan.days.map((d) => (d.id === dayId ? fn(d) : d)) };
}

/* ------------------------------------------------------------------ */
/* Plan-Liste                                                          */
/* ------------------------------------------------------------------ */

export function PlansScreen() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [name, setName] = useState('');
  const [split, setSplit] = useState('3er Push/Pull/Beine');
  const [start, setStart] = useState(today());
  const [weeks, setWeeks] = useState(6);

  const reload = async () => {
    const all = await listPlans();
    setPlans(all.sort((a, b) => b.start.localeCompare(a.start)));
  };

  useEffect(() => {
    reload();
    listExercises().then((ex) => setExercises(ex.sort(byName)));
  }, []);

  const create = async (e: Event) => {
    e.preventDefault();
    const plan: Plan = {
      id: uid(),
      name: name.trim() || split,
      split,
      start,
      weeks,
      active: false,
      days: SPLITS[split].map((n) => ({ id: uid(), name: n, items: [] })),
    };
    await savePlan(plan);
    navigate(`/plans/${plan.id}`);
  };

  const setActive = async (target: Plan) => {
    for (const p of await listPlans()) {
      const shouldBeActive = p.id === target.id;
      if (p.active !== shouldBeActive) await savePlan({ ...p, active: shouldBeActive });
    }
    reload();
  };

  const remove = async (p: Plan) => {
    if (!confirm(`Plan „${p.name}“ löschen? Die Trainingshistorie bleibt erhalten.`)) return;
    await deletePlan(p.id);
    reload();
  };

  return (
    <section>
      <h1>Pläne</h1>

      <form class="card" onSubmit={create}>
        <h2>Neuer Plan</h2>
        <label>
          Name
          <input value={name} onInput={(e) => setName(e.currentTarget.value)} placeholder="z. B. 3er Aufbau" />
        </label>
        <label>
          Split
          <select value={split} onChange={(e) => setSplit(e.currentTarget.value)}>
            {Object.keys(SPLITS).map((s) => (
              <option value={s}>{s}</option>
            ))}
          </select>
        </label>
        <div class="grid2">
          <label>
            Start
            <input type="date" value={start} onInput={(e) => setStart(e.currentTarget.value)} />
          </label>
          <label>
            Wochen
            <input
              type="number"
              inputMode="numeric"
              value={weeks}
              onInput={(e) => setWeeks(Number(e.currentTarget.value) || 6)}
            />
          </label>
        </div>
        <button type="submit" class="primary">
          Plan anlegen
        </button>
      </form>

      <TextImport catalog={exercises} />

      <ul class="list">
        {plans.map((p) => (
          <li class="card">
            <div class="row">
              <a href={`#/plans/${p.id}`} class="strong">
                {p.name}
              </a>
              {p.active && <span class="badge">aktiv</span>}
            </div>
            <div class="muted">
              {p.split} · seit {p.start} · {p.weeks} Wochen
            </div>
            <div class="row gap">
              {!p.active && <button onClick={() => setActive(p)}>Aktivieren</button>}
              <button class="danger" onClick={() => remove(p)}>
                Löschen
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Plan-Editor                                                         */
/* ------------------------------------------------------------------ */

export function PlanEditor({ id }: { id: string }) {
  const [plan, setPlan] = useState<Plan | null | undefined>(undefined);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [increments, setIncrements] = useState<Settings['increments']>();
  const [picked, setPicked] = useState<Record<string, string>>({});

  useEffect(() => {
    (async () => {
      const [plans, ex, ses, st] = await Promise.all([
        listPlans(),
        listExercises(),
        listSessions(),
        getSettings(),
      ]);
      setPlan(plans.find((p) => p.id === id) ?? null);
      setExercises(ex.sort(byName));
      setSessions(ses);
      setIncrements(st.increments);
    })();
  }, [id]);

  if (plan === undefined || !increments) return <p class="muted">Lade …</p>;
  if (plan === null) return <p>Plan nicht gefunden.</p>;

  const commit = async (next: Plan) => {
    setPlan(next);
    await savePlan(next);
  };

  const reloadExercises = async () => {
    setExercises((await listExercises()).sort(byName));
  };

  const exById = new Map(exercises.map((x) => [x.id, x]));

  const suggestionFor = (item: PlanItem): string | undefined => {
    const ex = exById.get(item.exerciseId);
    const last = lastPerformance(item.exerciseId, sessions);
    if (!last) return undefined;
    const top = last.sets.map((s) => `${s.w} kg × ${s.r}`).join(', ');
    const w = suggestWeight(last, item.repMin, item.repMax, ex ? increments[ex.equipment] : 0);
    return `Zuletzt am ${last.date}: ${top} → Vorschlag ${item.repMin}–${item.repMax} Wdh.: ${w} kg`;
  };

  const addDay = () =>
    commit({
      ...plan,
      days: [...plan.days, { id: uid(), name: `Tag ${plan.days.length + 1}`, items: [] }],
    });

  const addItem = (day: PlanDay) => {
    const exerciseId = picked[day.id];
    if (!exerciseId) return;
    const item: PlanItem = { exerciseId, sets: 3, repMin: 8, repMax: 12 };
    commit(updateDay(plan, day.id, (d) => ({ ...d, items: [...d.items, item] })));
  };

  const patchItem = (day: PlanDay, idx: number, patch: Partial<PlanItem>) =>
    commit(
      updateDay(plan, day.id, (d) => ({
        ...d,
        items: d.items.map((it, i) => (i === idx ? { ...it, ...patch } : it)),
      })),
    );

  const moveItem = (day: PlanDay, idx: number, dir: -1 | 1) =>
    commit(
      updateDay(plan, day.id, (d) => {
        const items = [...d.items];
        const j = idx + dir;
        if (j < 0 || j >= items.length) return d;
        [items[idx], items[j]] = [items[j], items[idx]];
        return { ...d, items };
      }),
    );

  const removeItem = (day: PlanDay, idx: number) =>
    commit(updateDay(plan, day.id, (d) => ({ ...d, items: d.items.filter((_, i) => i !== idx) })));

  return (
    <section>
      <a href="#/plans" class="back">
        ‹ Pläne
      </a>
      <h1>{plan.name}</h1>

      <div class="card">
        <label>
          Name
          <input value={plan.name} onInput={(e) => commit({ ...plan, name: e.currentTarget.value })} />
        </label>
        <div class="grid2">
          <label>
            Start
            <input type="date" value={plan.start} onInput={(e) => commit({ ...plan, start: e.currentTarget.value })} />
          </label>
          <label>
            Wochen
            <input
              type="number"
              inputMode="numeric"
              value={plan.weeks}
              onInput={(e) => commit({ ...plan, weeks: Number(e.currentTarget.value) || plan.weeks })}
            />
          </label>
        </div>
        <div class="muted">{plan.split}</div>
      </div>

      {plan.days.map((day) => (
        <div class="card">
          <div class="row">
            <input
              class="dayname"
              value={day.name}
              onInput={(e) => {
                const name = e.currentTarget.value;
                commit(updateDay(plan, day.id, (d) => ({ ...d, name })));
              }}
            />
            <button
              class="danger"
              onClick={() => commit({ ...plan, days: plan.days.filter((d) => d.id !== day.id) })}
            >
              Tag löschen
            </button>
          </div>

          {day.items.map((item, idx) => (
            <ItemRow
              key={`${item.exerciseId}-${idx}`}
              item={item}
              exercise={exById.get(item.exerciseId)}
              exercises={exercises}
              hint={suggestionFor(item)}
              onChange={(patch) => patchItem(day, idx, patch)}
              onMove={(dir) => moveItem(day, idx, dir)}
              onRemove={() => removeItem(day, idx)}
            />
          ))}

          <div class="row gap">
            <select
              value={picked[day.id] ?? ''}
              onChange={(e) => setPicked({ ...picked, [day.id]: e.currentTarget.value })}
            >
              <option value="">Übung wählen …</option>
              {exercises.map((x) => (
                <option value={x.id}>{x.name}</option>
              ))}
            </select>
            <button onClick={() => addItem(day)}>+ Übung</button>
          </div>
        </div>
      ))}

      <button onClick={addDay}>+ Tag</button>

      <div class="card">
        <h2>Übungskatalog</h2>
        <ExerciseCatalog exercises={exercises} onChanged={reloadExercises} />
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Bausteine                                                           */
/* ------------------------------------------------------------------ */

interface ItemRowProps {
  item: PlanItem;
  exercise?: Exercise;
  exercises: Exercise[];
  hint?: string;
  onChange: (patch: Partial<PlanItem>) => void;
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
}

function ItemRow({ item, exercise, exercises, hint, onChange, onMove, onRemove }: ItemRowProps) {
  return (
    <div class="item">
      <div class="row">
        <strong>{exercise?.name ?? 'Unbekannte Übung'}</strong>
        <span class="btns">
          <button onClick={() => onMove(-1)} aria-label="nach oben">
            ↑
          </button>
          <button onClick={() => onMove(1)} aria-label="nach unten">
            ↓
          </button>
          <button class="danger" onClick={onRemove} aria-label="entfernen">
            ✕
          </button>
        </span>
      </div>
      {exercise?.note && <div class="note">📝 {exercise.note}</div>}
      {hint && <div class="hint">💡 {hint}</div>}

      <div class="grid4">
        <NumField label="Sätze" value={item.sets} onChange={(v) => onChange({ sets: v ?? 0 })} />
        <NumField label="Min" value={item.repMin} onChange={(v) => onChange({ repMin: v ?? 0 })} />
        <NumField label="Max" value={item.repMax} onChange={(v) => onChange({ repMax: v ?? 0 })} />
        <NumField label="Gewicht" value={item.weight} onChange={(v) => onChange({ weight: v })} />
      </div>

      <div class="grid2">
        <label>
          Schema
          <input
            value={item.scheme ?? ''}
            placeholder="z. B. 10/10/10"
            onInput={(e) => onChange({ scheme: e.currentTarget.value || undefined })}
          />
        </label>
        <label>
          Hinweis
          <input
            value={item.hint ?? ''}
            placeholder="z. B. ++ oder Zughilfe"
            onInput={(e) => onChange({ hint: e.currentTarget.value || undefined })}
          />
        </label>
      </div>

      <label>
        Alternative
        <select value={item.altId ?? ''} onChange={(e) => onChange({ altId: e.currentTarget.value || undefined })}>
          <option value="">–</option>
          {exercises
            .filter((x) => x.id !== item.exerciseId)
            .map((x) => (
              <option value={x.id}>{x.name}</option>
            ))}
        </select>
      </label>

      <label class="check">
        <input
          type="checkbox"
          checked={!!item.superset}
          onChange={(e) => onChange({ superset: e.currentTarget.checked })}
        />
        Supersatz
      </label>
    </div>
  );
}

const fmt = (v?: number): string => (v === undefined ? '' : String(v).replace('.', ','));
const parse = (raw: string): number | undefined => {
  if (raw.trim() === '') return undefined;
  const n = Number(raw.replace(',', '.'));
  return Number.isNaN(n) ? undefined : n;
};

/** Zahlenfeld, das "6,25" erlaubt, ohne das Komma beim Tippen zu verschlucken. */
function NumField({ label, value, onChange }: { label: string; value?: number; onChange: (v?: number) => void }) {
  const [text, setText] = useState(fmt(value));
  useEffect(() => {
    if (parse(text) !== value) setText(fmt(value));
  }, [value]);
  return (
    <label>
      {label}
      <input
        type="text"
        inputMode="decimal"
        value={text}
        onInput={(e) => {
          const raw = e.currentTarget.value;
          setText(raw);
          onChange(parse(raw));
        }}
      />
    </label>
  );
}

