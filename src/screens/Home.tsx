import { useEffect, useState } from 'preact/hooks';
import { getSettings, listExercises, listPlans, listSessions, updateSettings } from '../db';
import { nextDay, summarizeItem } from '../logic';
import type { Exercise, Plan, Session, Settings } from '../types';

export function HomeScreen() {
  const [plan, setPlan] = useState<Plan | null | undefined>(undefined);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [settings, setSettings] = useState<Settings>();
  const [exercises, setExercises] = useState<Exercise[]>([]);

  useEffect(() => {
    (async () => {
      const [plans, ses, st, ex] = await Promise.all([
        listPlans(),
        listSessions(),
        getSettings(),
        listExercises(),
      ]);
      setPlan(plans.find((p) => p.active) ?? null);
      setSessions(ses);
      setSettings(st);
      setExercises(ex);
    })();
  }, []);

  if (plan === undefined || !settings) return <p class="muted">Lade …</p>;

  if (plan === null) {
    return (
      <section>
        <h1>Start</h1>
        <div class="card">
          <p>Noch kein aktiver Plan.</p>
          <a href="#/plans" class="primary button">
            Plan anlegen oder aktivieren
          </a>
        </div>
      </section>
    );
  }

  const next = nextDay(plan, sessions);
  const exById = new Map(exercises.map((e) => [e.id, e]));
  const lastDate = (dayId: string): string =>
    sessions
      .filter((s) => s.planId === plan.id && s.dayId === dayId)
      .reduce((acc, s) => (s.date > acc ? s.date : acc), '') || 'noch nie';

  const setLocker = async (locker: string) => {
    setSettings({ ...settings, lastLocker: locker });
    await updateSettings((s) => ({ ...s, lastLocker: locker }));
  };

  return (
    <section>
      <div class="row">
        <h1>Start</h1>
        <span class="muted">{plan.name}</span>
      </div>

      <label class="card">
        Spindnummer
        <input
          inputMode="numeric"
          value={settings.lastLocker ?? ''}
          onInput={(e) => setLocker(e.currentTarget.value)}
        />
      </label>

      {next && (
        <a class="primary button big" href={`#/train/${plan.id}/${next.id}`}>
          Weiter mit: {next.name}
        </a>
      )}

      <h2>Tage</h2>
      <ul class="list">
        {plan.days.map((d) => (
          <li>
            <a href={`#/train/${plan.id}/${d.id}`} class="card daylink">
              <span>
                <span class="strong">{d.name}</span>
                <span class="muted">Zuletzt: {lastDate(d.id)}</span>
              </span>
              <span class="daylink-arrow" aria-hidden="true">
                ›
              </span>
            </a>
            {d.items.length > 0 && (
              <details class="details day-preview">
                <summary>Übungen · {d.items.length}</summary>
                <ul class="list">
                  {d.items.map((item) => (
                    <li class="preview-row">
                      <span>{exById.get(item.exerciseId)?.name ?? 'Unbekannte Übung'}</span>
                      <span class="muted">{summarizeItem(item)}</span>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
