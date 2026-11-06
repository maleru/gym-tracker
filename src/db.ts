import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Exercise, Plan, Session, Settings } from './types';

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
  KH: 2,
  LH: 2.5,
  SZ: 2.5,
  Kabel: 1.25,
  Maschine: 5,
  Koerper: 0,
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

export async function getSettings(): Promise<Settings> {
  const db = await getDb();
  const stored = await db.get('settings', 'settings');
  if (stored) return stored;
  const initial: Settings = { key: 'settings', increments: { ...DEFAULT_INCREMENTS } };
  await db.put('settings', initial);
  return initial;
}

export async function saveSettings(s: Settings): Promise<void> {
  const db = await getDb();
  await db.put('settings', s);
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

/** Ersetzt alle Daten durch das Backup. Validierung ist minimal (Struktur). */
export async function importAll(json: string): Promise<void> {
  const data = JSON.parse(json);
  const isArr = (v: unknown) => Array.isArray(v);
  if (!isArr(data.exercises) || !isArr(data.plans) || !isArr(data.sessions)) {
    throw new Error('Ungültiges Backup-Format');
  }
  const db = await getDb();
  const tx = db.transaction(['exercises', 'plans', 'sessions', 'settings'], 'readwrite');
  await Promise.all([
    tx.objectStore('exercises').clear(),
    tx.objectStore('plans').clear(),
    tx.objectStore('sessions').clear(),
    tx.objectStore('settings').clear(),
  ]);
  for (const e of data.exercises) await tx.objectStore('exercises').put(e);
  for (const p of data.plans) await tx.objectStore('plans').put(p);
  for (const s of data.sessions) await tx.objectStore('sessions').put(s);
  for (const s of data.settings ?? []) await tx.objectStore('settings').put(s);
  await tx.done;
}
