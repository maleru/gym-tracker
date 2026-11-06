import { useState } from 'preact/hooks';
import './muscle-ui.css';
import { saveExercise } from '../db';
import { MUSCLES, isKnownMuscle, muscleLabel, resolveMuscle } from '../muscles';
import type { Equipment, Exercise } from '../types';

const EQUIPMENT: Equipment[] = ['KH', 'LH', 'SZ', 'Kabel', 'Maschine', 'Koerper'];
const uid = (): string => crypto.randomUUID();
const unique = (xs: string[]): string[] => [...new Set(xs)];

interface FormProps {
  initial?: Exercise;
  onSaved: () => Promise<void>;
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

  const toggle = (id: string) =>
    setMuscles((ms) => (ms.includes(id) ? ms.filter((m) => m !== id) : [...ms, id]));

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
    };
    await saveExercise(ex);
    await onSaved();
  };

  const unknownSelected = muscles.filter((m) => !isKnownMuscle(m));

  return (
    <form onSubmit={submit}>
      <label>
        Name
        <input value={name} onInput={(e) => setName(e.currentTarget.value)} />
      </label>
      <div class="grid2">
        <label>
          Gerät
          <select value={equipment} onChange={(e) => setEquipment(e.currentTarget.value as Equipment)}>
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

  const done = async () => {
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
