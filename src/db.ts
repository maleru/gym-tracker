import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Equipment, Exercise, Plan, Session, Settings } from './types';

interface GymDB extends DBSchema {
  exercises: { key: string; value: Exercise };
  plans: { key: string; value: Plan };
  sessions: {
    key: string;
    value: Session;
    indexes: { date: string; planId: string };
  };
  settings: { key: string; value: Settings };
}

export const DEFAULT_INCREMENTS: Settings['increments'] = {
  KH: 1,
  LH: 1,
  SZ: 1,
  Kabel: 1,
  Maschine: 1,
  Koerper: 1,
};

const DB_NAME = 'gym-tracker';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<GymDB>> | null = null;

export function getDb(): Promise<IDBPDatabase<GymDB>> {
  if (!dbPromise) {
    dbPromise = openDB<GymDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        db.createObjectStore('exercises', { keyPath: 'id' });
        db.createObjectStore('plans', { keyPath: 'id' });
        const sessions = db.createObjectStore('sessions', { keyPath: 'id' });
        sessions.createIndex('date', 'date');
        sessions.createIndex('planId', 'planId');
        db.createObjectStore('settings', { keyPath: 'key' });
      },
    });
  }
  return dbPromise;
}

/** Verhindert, dass iOS die lokalen Daten bei Speicherknappheit löscht. */
export async function requestPersistence(): Promise<boolean> {
  if (navigator.storage?.persist) {
    return navigator.storage.persist();
  }
  return false;
}

/** Ergänzt fehlende Schrittweiten (z. B. ältere Backups) um die Defaults. */
export function normalizeSettings(s: Settings): Settings {
  return { ...s, key: 'settings', increments: { ...DEFAULT_INCREMENTS, ...s.increments } };
}

/**
 * Liest, ändert und schreibt die Settings in einer einzigen readwrite-Transaktion.
 * Verhindert, dass parallele Schreibvorgänge sich gegenseitig überschreiben.
 */
export async function updateSettings(mutate: (s: Settings) => Settings): Promise<Settings> {
  const db = await getDb();
  const tx = db.transaction('settings', 'readwrite');
  const store = tx.objectStore('settings');
  const current = normalizeSettings((await store.get('settings')) ?? { key: 'settings', increments: { ...DEFAULT_INCREMENTS } });
  const next = normalizeSettings(mutate(current));
  await store.put(next);
  await tx.done;
  return next;
}

export async function getSettings(): Promise<Settings> {
  const db = await getDb();
  const stored = await db.get('settings', 'settings');
  if (stored) return normalizeSettings(stored);
  return updateSettings((s) => s);
}

export async function listPlans(): Promise<Plan[]> {
  return (await getDb()).getAll('plans');
}

export async function savePlan(plan: Plan): Promise<void> {
  await (await getDb()).put('plans', plan);
}

export async function deletePlan(id: string): Promise<void> {
  await (await getDb()).delete('plans', id);
}

export async function listExercises(): Promise<Exercise[]> {
  return (await getDb()).getAll('exercises');
}

export async function saveExercise(ex: Exercise): Promise<void> {
  await (await getDb()).put('exercises', ex);
}

export async function listSessions(): Promise<Session[]> {
  return (await getDb()).getAllFromIndex('sessions', 'date');
}

export async function saveSession(s: Session): Promise<void> {
  await (await getDb()).put('sessions', s);
}

/** Komplettes Backup als JSON-String. */
export async function exportAll(): Promise<string> {
  const db = await getDb();
  const data = {
    version: DB_VERSION,
    exportedAt: new Date().toISOString(),
    exercises: await db.getAll('exercises'),
    plans: await db.getAll('plans'),
    sessions: await db.getAll('sessions'),
    settings: await db.getAll('settings'),
  };
  return JSON.stringify(data, null, 2);
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
const isStr = (v: unknown): v is string => typeof v === 'string';
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const EQUIPMENT_VALUES: readonly string[] = ['KH', 'LH', 'SZ', 'Kabel', 'Maschine', 'Koerper'];

/** Prüft die Felder jedes Eintrags, bevor etwas gelöscht wird. */
export function validateBackup(data: unknown): void {
  if (!isObj(data)) throw new Error('Ungültiges Backup: keine Objektstruktur');
  if (data.version !== undefined && (!isNum(data.version) || data.version > DB_VERSION)) {
    throw new Error('Backup stammt aus einer neueren App-Version');
  }
  const { exercises, plans, sessions, settings } = data;
  if (!Array.isArray(exercises) || !Array.isArray(plans) || !Array.isArray(sessions)) {
    throw new Error('Ungültiges Backup: exercises, plans oder sessions fehlen');
  }
  if (settings !== undefined && !Array.isArray(settings)) {
    throw new Error('Ungültiges Backup: settings muss eine Liste sein');
  }
  for (const e of exercises) {
    if (
      !isObj(e) ||
      !isStr(e.id) ||
      !isStr(e.name) ||
      !isStr(e.equipment) ||
      !EQUIPMENT_VALUES.includes(e.equipment) ||
      !Array.isArray(e.muscles) ||
      !e.muscles.every(isStr) ||
      (e.step !== undefined && !(isNum(e.step) && e.step > 0)) ||
      (e.perSide !== undefined && typeof e.perSide !== 'boolean') ||
      (e.barWeight !== undefined && !(isNum(e.barWeight) && e.barWeight >= 0))
    ) {
      throw new Error('Ungültige Übung im Backup');
    }
  }
  for (const p of plans) {
    if (!isObj(p) || !isStr(p.id) || !isStr(p.name) || !isStr(p.start) || !isNum(p.weeks) || !Array.isArray(p.days)) {
      throw new Error('Ungültiger Plan im Backup');
    }
    for (const d of p.days as unknown[]) {
      if (!isObj(d) || !isStr(d.id) || !Array.isArray(d.items)) throw new Error('Ungültiger Trainingstag im Backup');
      for (const it of d.items as unknown[]) {
        if (!isObj(it) || !isStr(it.exerciseId) || !isNum(it.sets) || !isNum(it.repMin) || !isNum(it.repMax)) {
          throw new Error('Ungültige Übung im Plan');
        }
      }
    }
  }
  for (const s of sessions) {
    if (!isObj(s) || !isStr(s.id) || !isStr(s.planId) || !isStr(s.dayId) || !isStr(s.date) || !Array.isArray(s.log)) {
      throw new Error('Ungültige Trainingseinheit im Backup');
    }
    for (const l of s.log as unknown[]) {
      if (!isObj(l) || !isStr(l.exerciseId) || !Array.isArray(l.sets)) throw new Error('Ungültiger Satz im Backup');
      for (const set of l.sets as unknown[]) {
        if (!isObj(set) || !isNum(set.w) || !isNum(set.r)) throw new Error('Ungültiger Satz im Backup');
      }
    }
  }
}

/** Ersetzt alle Daten durch das Backup. Validiert vorher alle Einträge. */
export async function importAll(json: string): Promise<void> {
  const data: unknown = JSON.parse(json);
  validateBackup(data);
  const d = data as { exercises: Exercise[]; plans: Plan[]; sessions: Session[]; settings?: Settings[] };
  const db = await getDb();
  const tx = db.transaction(['exercises', 'plans', 'sessions', 'settings'], 'readwrite');
  await Promise.all([
    tx.objectStore('exercises').clear(),
    tx.objectStore('plans').clear(),
    tx.objectStore('sessions').clear(),
    tx.objectStore('settings').clear(),
  ]);
  for (const e of d.exercises) await tx.objectStore('exercises').put(e);
  for (const p of d.plans) await tx.objectStore('plans').put(p);
  for (const s of d.sessions) await tx.objectStore('sessions').put(s);
  for (const s of d.settings ?? []) await tx.objectStore('settings').put(normalizeSettings(s));
  await tx.done;
}
