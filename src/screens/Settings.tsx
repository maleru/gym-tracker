import { useEffect, useState } from 'preact/hooks';
import { exportAll, getSettings, importAll, saveSettings } from '../db';
import type { Equipment, Settings } from '../types';

const EQUIPMENT: Equipment[] = ['KH', 'LH', 'SZ', 'Kabel', 'Maschine'];

export function SettingsScreen() {
  const [settings, setSettings] = useState<Settings>();
  const [status, setStatus] = useState('');

  useEffect(() => {
    getSettings().then(setSettings);
  }, []);

  if (!settings) return <p class="muted">Lade …</p>;

  const setInc = async (eq: Equipment, value: number) => {
    const next: Settings = { ...settings, increments: { ...settings.increments, [eq]: value } };
    setSettings(next);
    await saveSettings(next);
  };

  const download = async () => {
    const json = await exportAll();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gym-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setStatus('Backup erstellt.');
  };

  const restore = async (file: File) => {
    if (!confirm('Alle aktuellen Daten werden durch das Backup ersetzt. Fortfahren?')) return;
    try {
      await importAll(await file.text());
      setStatus('Import erfolgreich. Bitte App neu laden.');
    } catch (err) {
      setStatus(`Import fehlgeschlagen: ${(err as Error).message}`);
    }
  };

  return (
    <section>
      <h1>Einstellungen</h1>

      <div class="card">
        <h2>Schrittweiten (kg)</h2>
        <div class="grid2">
          {EQUIPMENT.map((eq) => (
            <label>
              {eq}
              <input
                type="text"
                inputMode="decimal"
                value={String(settings.increments[eq]).replace('.', ',')}
                onInput={(e) => {
                  const n = Number(e.currentTarget.value.replace(',', '.'));
                  if (!Number.isNaN(n) && n >= 0) setInc(eq, n);
                }}
              />
            </label>
          ))}
        </div>
      </div>

      <div class="card">
        <h2>Backup</h2>
        <p class="muted">Deine Daten liegen nur auf diesem Gerät. Erstelle regelmäßig ein Backup.</p>
        <button class="primary" onClick={download}>
          Backup exportieren
        </button>
        <label class="file">
          Backup importieren
          <input
            type="file"
            accept="application/json"
            onChange={(e) => {
              const f = e.currentTarget.files?.[0];
              if (f) restore(f);
            }}
          />
        </label>
        {status && <p>{status}</p>}
      </div>
    </section>
  );
}
