import { useEffect, useState } from 'preact/hooks';
import { DecimalInput } from '../components/DecimalInput';
import { DEFAULT_INCREMENTS, exportAll, getSettings, importAll, saveSettings } from '../db';
import type { Equipment, Settings } from '../types';

const EQUIPMENT: Equipment[] = ['KH', 'LH', 'SZ', 'Kabel', 'Maschine'];

export function SettingsScreen() {
  const [settings, setSettings] = useState<Settings>();
  const [status, setStatus] = useState('');

  useEffect(() => {
    getSettings().then(setSettings);
  }, []);

  if (!settings) return <p class="muted">Lade …</p>;

  const persist = async (next: Settings) => {
    setSettings(next);
    await saveSettings(next);
  };

  const setInc = (eq: Equipment, value: number) =>
    persist({ ...settings, increments: { ...settings.increments, [eq]: value } });

  const resetIncrements = () => persist({ ...settings, increments: { ...DEFAULT_INCREMENTS } });

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
        <h2>Version</h2>
        <p class="mono">
          v{__APP_VERSION__} · {__GIT_HASH__} · Build {__BUILD_DATE__}
        </p>
        <p class="muted">Diese Angabe hilft beim Prüfen, ob die neueste Version installiert ist.</p>
      </div>

      <div class="card">
        <h2>Schrittweiten (kg)</h2>
        <div class="grid2">
          {EQUIPMENT.map((eq) => (
            <label>
              {eq}
              <DecimalInput value={settings.increments[eq]} onChange={(v) => v >= 0 && setInc(eq, v)} />
            </label>
          ))}
        </div>
        <button class="gap" onClick={resetIncrements}>
          Alle auf 1,0 setzen
        </button>
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
