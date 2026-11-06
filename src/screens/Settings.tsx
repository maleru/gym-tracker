import { useEffect, useState } from 'preact/hooks';
import { DecimalInput } from '../components/DecimalInput';
import { DEFAULT_INCREMENTS, exportAll, getSettings, importAll, updateSettings } from '../db';
import { localDate } from '../date';
import type { Equipment, Settings } from '../types';

const EQUIPMENT: Equipment[] = ['KH', 'LH', 'SZ', 'Kabel', 'Maschine', 'Koerper'];

const EQUIPMENT_LABEL: Record<Equipment, string> = {
  KH: 'KH',
  LH: 'LH',
  SZ: 'SZ',
  Kabel: 'Kabel',
  Maschine: 'Maschine',
  Koerper: 'Körper',
};

export function SettingsScreen() {
  const [settings, setSettings] = useState<Settings>();
  const [status, setStatus] = useState('');

  useEffect(() => {
    getSettings().then(setSettings);
  }, []);

  if (!settings) return <p class="muted">Lade …</p>;

  const setInc = async (eq: Equipment, value: number) => {
    setSettings({ ...settings, increments: { ...settings.increments, [eq]: value } });
    setSettings(await updateSettings((s) => ({ ...s, increments: { ...s.increments, [eq]: value } })));
  };

  const resetIncrements = async () => {
    setSettings(await updateSettings((s) => ({ ...s, increments: { ...DEFAULT_INCREMENTS } })));
  };

  const download = async () => {
    const json = await exportAll();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gym-backup-${localDate()}.json`;
    a.click();
    // Sofort widerrufen kann den Download auf iOS abbrechen
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setStatus('Backup erstellt.');
  };

  const restore = async (file: File) => {
    if (!confirm('Alle aktuellen Daten werden durch das Backup ersetzt. Fortfahren?')) return;
    try {
      await importAll(await file.text());
      setStatus('Import erfolgreich. App wird neu geladen …');
      setTimeout(() => location.reload(), 800);
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
              {EQUIPMENT_LABEL[eq]}
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
              const input = e.currentTarget;
              const f = input.files?.[0];
              // Zurücksetzen, damit dieselbe Datei erneut gewählt werden kann
              input.value = '';
              if (f) restore(f);
            }}
          />
        </label>
        {status && <p>{status}</p>}
      </div>
    </section>
  );
}
