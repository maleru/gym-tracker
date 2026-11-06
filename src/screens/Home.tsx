import { useEffect, useState } from 'preact/hooks';
import { getSettings, listPlans, listSessions, updateSettings } from '../db';
import { nextDay } from '../logic';
import type { Plan, Session, Settings } from '../types';

export function HomeScreen() {
  const [plan, setPlan] = useState<Plan | null | undefined>(undefined);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [settings, setSettings] = useState<Settings>();

  useEffect(() => {
    (async () => {
      const [plans, ses, st] = await Promise.all([listPlans(), listSessions(), getSettings()]);
      setPlan(plans.find((p) => p.active) ?? null);
      setSessions(ses);
      setSettings(st);
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
      <h1>Start</h1>
      <div class="muted">{plan.name}</div>

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
          <li class="card">
            <a href={`#/train/${plan.id}/${d.id}`} class="strong">
              {d.name}
            </a>
            <div class="muted">Zuletzt: {lastDate(d.id)}</div>
          </li>
        ))}
      </ul>
    </section>
  );
}
