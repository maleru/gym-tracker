import { useState } from 'preact/hooks';
import './muscle-ui.css';
import { DecimalInput } from '../components/DecimalInput';
import { saveExercise } from '../db';
import { defaultStep, DEFAULT_BAR_WEIGHT } from '../logic';
import { MUSCLES, isKnownMuscle, muscleLabel, resolveMuscle } from '../muscles';
import type { Equipment, Exercise } from '../types';

const EQUIPMENT: Equipment[] = ['KH', 'LH', 'SZ', 'Kabel', 'Maschine', 'Koerper'];
const STEP_CHIPS = [0.5, 1, 2.5, 5];
const uid = (): string => crypto.randomUUID();
const unique = (xs: string[]): string[] => [...new Set(xs)];
const fmt = (n: number): string => String(n).replace('.', ',');

interface FormProps {
  initial?: Exercise;
  /** Liefert die gespeicherte Übung, damit Aufrufer sie direkt übernehmen können */
  onSaved: (ex: Exercise) => Promise<void>;
  onCancel?: () => void;
}

/** Formular zum Anlegen oder Bearbeiten einer Übung. */
export function ExerciseForm({ initial, onSaved, onCancel }: FormProps) {
  const [name, setName] = useState(initial?.name ?? '');
  const [equipment, setEquipment] = useState<Equipment>(initial?.equipment ?? 'KH');
  // Alte Muskel-Namen werden beim Öffnen auf die neuen IDs abgebildet
  const [muscles, setMuscles] = useState<string[]>(() =>
    unique((initial?.muscles ?? []).flatMap(resolveMuscle)),
  );
  const [note, setNote] = useState(initial?.note ?? '');
  const [setting, setSetting] = useState(initial?.setting ?? '');
  // Neue LH-Übungen starten mit "pro Seite"; bestehende behalten ihren Wert
  const [perSide, setPerSide] = useState<boolean>(initial?.perSide ?? false);
  const [barWeight, setBarWeight] = useState<number>(initial?.barWeight ?? DEFAULT_BAR_WEIGHT);
  // Neue Übungen: Vorschlag für die Schrittweite, bis der Nutzer selbst etwas einstellt
  const [step, setStep] = useState<number>(initial?.step ?? 1);
  const [stepTouched, setStepTouched] = useState(initial?.step !== undefined);

  const toggle = (id: string) =>
    setMuscles((ms) => (ms.includes(id) ? ms.filter((m) => m !== id) : [...ms, id]));

  /** Bei neuen Übungen Vorschlag live nachführen, solange nichts manuell gesetzt wurde */
  const suggest = (n: string, ms: string[], eq: Equipment) => {
    if (initial || stepTouched) return;
    setStep(defaultStep({ name: n, muscles: ms, equipment: eq }));
  };

  const changeEquipment = (eq: Equipment) => {
    setEquipment(eq);
    if (!initial) setPerSide(eq === 'LH');
    suggest(name, muscles, eq);
  };

  const submit = async (e: Event) => {
    e.preventDefault();
    if (!name.trim()) return;
    const ex: Exercise = {
      id: initial?.id ?? uid(),
      name: name.trim(),
      equipment,
      muscles,
      note: note.trim() || undefined,
      setting: setting.trim() || undefined,
      step: step > 0 ? step : 1,
      perSide: perSide || undefined,
      barWeight: perSide ? Math.max(0, barWeight) : undefined,
    };
    await saveExercise(ex);
    await onSaved(ex);
  };

  const unknownSelected = muscles.filter((m) => !isKnownMuscle(m));

  return (
    <form onSubmit={submit}>
      <label>
        Name
        <input
          value={name}
          onInput={(e) => {
            setName(e.currentTarget.value);
            suggest(e.currentTarget.value, muscles, equipment);
          }}
        />
      </label>
      <div class="grid2">
        <label>
          Gerät
          <select value={equipment} onChange={(e) => changeEquipment(e.currentTarget.value as Equipment)}>
            {EQUIPMENT.map((eq) => (
              <option value={eq}>{eq}</option>
            ))}
          </select>
        </label>
        <label>
          Einstellung
          <input value={setting} placeholder="z. B. (5;2)" onInput={(e) => setSetting(e.currentTarget.value)} />
        </label>
      </div>

      <div class="grid2">
        <label>
          Schrittweite (kg)
          <DecimalInput
            value={step}
            onChange={(n) => {
              setStepTouched(true);
              if (n > 0) setStep(n);
            }}
          />
        </label>
        <div class="row gap">
          {STEP_CHIPS.map((c) => (
            <button
              type="button"
              class={step === c ? 'primary' : ''}
              onClick={() => {
                setStepTouched(true);
                setStep(c);
              }}
            >
              {fmt(c)}
            </button>
          ))}
        </div>
      </div>

      <label class="check">
        <input type="checkbox" checked={perSide} onChange={(e) => setPerSide(e.currentTarget.checked)} />
        Gewicht pro Seite eintragen (Langhantel, Gesamt = 2 × Eingabe + Stange)
      </label>
      {perSide && (
        <label>
          Stange (kg)
          <DecimalInput value={barWeight} onChange={(n) => n >= 0 && setBarWeight(n)} />
        </label>
      )}

      <div class="muscle-picker">
        <span class="muted">
          Muskeln wählen. Der erste gewählte Muskel ist der primäre, weitere sind Hilfsmuskeln.
        </span>
        <div class="chips">
          {MUSCLES.map((m) => {
            const on = muscles.includes(m.id);
            const primary = muscles[0] === m.id;
            return (
              <button
                type="button"
                class={`chip${on ? ' on' : ''}${primary ? ' primary' : ''}`}
                aria-pressed={on}
                onClick={() => toggle(m.id)}
              >
                {m.label}
                {primary ? ' (primär)' : ''}
              </button>
            );
          })}
          {unknownSelected.map((m) => (
            <button type="button" class="chip on" aria-pressed={true} onClick={() => toggle(m)}>
              {m} ✕
            </button>
          ))}
        </div>
      </div>

      <label>
        Allgemeine Notiz
        <input
          value={note}
          placeholder="z. B. Schultern unten lassen"
          onInput={(e) => setNote(e.currentTarget.value)}
        />
      </label>
      <div class="row gap">
        <button type="submit" class="primary">
          Speichern
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel}>
            Abbrechen
          </button>
        )}
      </div>
    </form>
  );
}

interface CatalogProps {
  exercises: Exercise[];
  onChanged: () => Promise<void>;
}

/** Übungskatalog mit Bearbeiten- und Neu-Funktion. */
export function ExerciseCatalog({ exercises, onChanged }: CatalogProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const done = async (_ex: Exercise) => {
    setEditingId(null);
    setCreating(false);
    await onChanged();
  };

  return (
    <div>
      <ul class="list">
        {exercises.map((x) =>
          editingId === x.id ? (
            <li class="card">
              <ExerciseForm initial={x} onSaved={done} onCancel={() => setEditingId(null)} />
            </li>
          ) : (
            <li class="item row">
              <div>
                <div class="strong">{x.name}</div>
                <div class="muted">
                  {x.equipment} · {x.muscles.map((m) => muscleLabel(m)).join(', ')}
                </div>
                <div class="muted">
                  Schritt {fmt(x.step ?? 1)} kg
                  {x.perSide ? ` · pro Seite, Stange ${fmt(x.barWeight ?? DEFAULT_BAR_WEIGHT)} kg` : ''}
                </div>
                {x.note && <div class="note">📝 {x.note}</div>}
              </div>
              <button onClick={() => setEditingId(x.id)}>Bearbeiten</button>
            </li>
          ),
        )}
      </ul>

      {creating ? (
        <div class="card">
          <ExerciseForm onSaved={done} onCancel={() => setCreating(false)} />
        </div>
      ) : (
        <button onClick={() => setCreating(true)}>+ Neue Übung</button>
      )}
    </div>
  );
}
