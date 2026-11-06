export type Equipment = 'KH' | 'LH' | 'SZ' | 'Kabel' | 'Maschine' | 'Koerper';

/** Globaler Übungskatalog, planübergreifend */
export interface Exercise {
  id: string;
  name: string;
  equipment: Equipment;
  /** erster Eintrag = primärer Muskel */
  muscles: string[];
  /** allgemeine Notiz, z. B. "Schultern unten lassen" */
  note?: string;
  /** Geräteeinstellung, z. B. "(5;2)" */
  setting?: string;
}

export interface PlanItem {
  exerciseId: string;
  sets: number;
  repMin: number;
  repMax: number;
  /** Zielgewicht für den Plan */
  weight?: number;
  /** Sonderschema, z. B. "10/10/10" bei L-Sit */
  scheme?: string;
  /** Hinweis fürs nächste Mal, z. B. "++" oder "Zughilfe" */
  hint?: string;
  /** Alternative Übung, z. B. Wadenmaschine statt Waden an der Beinpresse */
  altId?: string;
  superset?: boolean;
}

export interface PlanDay {
  id: string;
  name: string;
  items: PlanItem[];
}

export interface Plan {
  id: string;
  name: string;
  /** z. B. "3er PPL", "2,5er" */
  split: string;
  /** ISO-Datum YYYY-MM-DD */
  start: string;
  weeks: number;
  active: boolean;
  days: PlanDay[];
}

export interface SetLog {
  w: number;
  r: number;
}

export interface ExerciseLog {
  exerciseId: string;
  sets: SetLog[];
  note?: string;
}

export interface Session {
  id: string;
  planId: string;
  dayId: string;
  /** ISO-Datum YYYY-MM-DD */
  date: string;
  /** Spindnummer */
  locker?: string;
  note?: string;
  log: ExerciseLog[];
}

export interface Settings {
  key: 'settings';
  /** Schrittweiten je Equipment in kg */
  increments: Record<Equipment, number>;
  lastLocker?: string;
  /** Einmalige Bereinigung der Katalog-Notizen durchgeführt */
  catalogCleaned?: boolean;
}
