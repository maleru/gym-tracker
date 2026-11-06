import { useMemo, useState } from 'preact/hooks';
import { savePlan } from '../db';
import { navigate } from '../router';
import { parsePlanText, toPlanItems } from '../textImport';
import type { Exercise, Plan, PlanDay } from '../types';

const uid = (): string => crypto.randomUUID();

interface Props {
  catalog: Exercise[];
}

/** Fügt Text im bisherigen Notizformat ein, zeigt eine Vorschau und legt daraus einen Plan an. */
export function TextImport({ catalog }: Props) {
  const [text, setText] = useState('');
  const [name, setName] = useState('');
  const [start, setStart] = useState(new Date().toISOString().slice(0, 10));
  const [busy, setBusy] = useState(false);

  const preview = useMemo(() => {
    if (!text.trim()) return null;
    return parsePlanText(text).map((d) => ({ name: d.name, unparsed: d.unparsed, ...toPlanItems(d.items, catalog) }));
  }, [text, catalog]);

  const missingAll = preview ? [...new Set(preview.flatMap((d) => d.missing))] : [];
  const canSave = !!preview && preview.some((d) => d.items.length > 0) && !busy;

  const save = async () => {
    if (!preview) return;
    setBusy(true);
    const days: PlanDay[] = preview
      .filter((d) => d.items.length > 0)
      .map((d) => ({ id: uid(), name: d.name, items: d.items }));
    const plan: Plan = {
      id: uid(),
      name: name.trim() || 'Importierter Plan',
      split: 'Import',
      start,
      weeks: 6,
      active: false,
      days,
    };
    await savePlan(plan);
    navigate(`/plans/${plan.id}`);
  };

  return (
    <div class="card">
      <h2>Plan aus Text importieren</h2>
      <p class="muted">
        Eine Zeile pro Übung, z. B. <code>Bankdrücken KH 3x6-8 40</code>. Tagesüberschriften wie{' '}
        <code>Push 29.10. 115</code> trennen die Tage. Fehlende Übungen werden nicht automatisch angelegt.
      </p>
      <textarea
        value={text}
        placeholder={'Push 29.10. 115\nBankdrücken KH 3x6-8 40\nFly Maschine (5;2) 3x10-12 70'}
        onInput={(e) => setText(e.currentTarget.value)}
      />

      {preview && (
        <div>
          {preview.map((d) => (
            <div class="item">
              <div class="strong">
                {d.name} · {d.items.length} Übung(en)
              </div>
              {d.missing.length > 0 && (
                <div class="hint">Nicht im Katalog: {d.missing.join(', ')}</div>
              )}
              {d.unparsed.length > 0 && <div class="note">Nicht erkannt: {d.unparsed.join(' | ')}</div>}
            </div>
          ))}
          {missingAll.length > 0 && (
            <p class="muted">
              Lege die fehlenden Übungen zuerst im Übungskatalog an, dann wird der Import erneut geprüft.
            </p>
          )}
        </div>
      )}

      <div class="grid2">
        <label>
          Name
          <input value={name} placeholder="z. B. 3er Aufbau" onInput={(e) => setName(e.currentTarget.value)} />
        </label>
        <label>
          Start
          <input type="date" value={start} onInput={(e) => setStart(e.currentTarget.value)} />
        </label>
      </div>

      <button class="primary" disabled={!canSave} onClick={save}>
        Als Plan übernehmen
      </button>
    </div>
  );
}
