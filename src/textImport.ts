import type { Exercise, PlanItem } from './types';

export interface ParsedDay {
  name: string;
  /** Zeilen, die nicht als Übung erkannt wurden (werden dem Nutzer angezeigt) */
  unparsed: string[];
  items: ParsedItem[];
}

export interface ParsedItem {
  /** Name aus dem Text, z. B. "Bankdrücken KH" */
  name: string;
  sets: number;
  repMin: number;
  repMax: number;
  /** Gewicht aus dem Text, falls vorhanden */
  weight?: number;
  /** Restlicher Text, z. B. "Zughilfe" oder "Schultern unten lassen", inkl. „+“/„++“ */
  hint?: string;
  /** Geräteeinstellung in Klammern, z. B. "(5;2)" */
  setting?: string;
}

/** Erkennt "3x8", "3x6-8", "2x20", "3x12" usw. */
const SETS_RE = /(\d+)\s*[x×]\s*(\d+)(?:\s*[-–]\s*(\d+))?/i;
/** Erkennt ein Gewicht am Ende, z. B. "40", "6,25+", "37,5", "70++" */
const WEIGHT_RE = /(\d+(?:[.,]\d+)?)\s*(\+{0,2})\s*$/;
/** Erkennt Datumsangaben wie "29.10." oder "22.10.2026" */
const DATE_RE = /\b\d{1,2}\.\d{1,2}\.?(\d{2,4})?\b/;

const num = (raw: string): number => Number(raw.replace(',', '.'));

/**
 * Wandelt Text im bisherigen Notizformat in Tage mit Übungen um.
 * Format pro Zeile: "<Name> <Sätze>x<Wdh> <Gewicht>" bzw. "<Name> <Sätze>x<Min>-<Max> <Gewicht>".
 * Eine Zeile ohne Sätz-Angabe, die nach einem Tag steht, wird als Tagesname verwendet,
 * wenn sie mit einem Datum endet oder keinen Übungsteil hat.
 */
export function parsePlanText(text: string): ParsedDay[] {
  const days: ParsedDay[] = [];
  let current: ParsedDay | null = null;

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;

    const setsMatch = line.match(SETS_RE);
    if (!setsMatch) {
      // Kopfzeile eines Tages: Text ohne Sätze-Angabe, typischerweise mit Datum
      if (DATE_RE.test(line) || /^(push|pull|beine|oberk[öo]rper|unterk[öo]rper|tag)/i.test(line)) {
        // Datum und Gewichtsangabe am Ende entfernen, Satzzeichen am Ende bereinigen
        const name =
          line
            .replace(DATE_RE, '')
            .replace(/\s\d+(?:[.,]\d+)?\+*\s*$/, '')
            .replace(/[\s.:,-]+$/, '')
            .trim() || line;
        current = { name, unparsed: [], items: [] };
        days.push(current);
      } else if (current) {
        current.unparsed.push(line);
      }
      continue;
    }

    if (!current) {
      current = { name: 'Tag 1', unparsed: [], items: [] };
      days.push(current);
    }

    const [full, sets, repA, repB] = setsMatch;
    const before = line.slice(0, setsMatch.index).trim();
    const after = line.slice((setsMatch.index ?? 0) + full.length).trim();

    const { name, setting } = splitSetting(before);
    if (!name) {
      current.unparsed.push(line);
      continue;
    }

    const { weight, rest, marker } = splitWeight(after);
    const repMin = Number(repA);
    const repMax = repB ? Number(repB) : repMin;

    current.items.push({
      name,
      sets: Number(sets),
      repMin,
      repMax,
      weight,
      hint: [rest, marker].filter(Boolean).join(' ') || undefined,
      setting,
    });
  }

  // Titelzeilen wie "3er Split Aufbau 22.10.2026" erzeugen leere Tage: verwerfen.
  return days.filter((d) => d.items.length > 0 || d.unparsed.length > 0);
}

/** Trennt Geräteeinstellung in Klammern vom Namen ab: "Fly Maschine (5;2)". */
function splitSetting(text: string): { name: string; setting?: string } {
  const m = text.match(/\(([^)]+)\)\s*$/);
  if (!m) return { name: text.trim() };
  return { name: text.slice(0, m.index).trim(), setting: `(${m[1]})` };
}

/** Holt das Gewicht vom Ende des Textes; der Rest wird als Hinweis verwendet, „+“/„++“ getrennt. */
function splitWeight(text: string): { weight?: number; rest: string; marker: string } {
  const m = text.match(WEIGHT_RE);
  if (!m) return { rest: text.trim(), marker: '' };
  const rest = text.slice(0, m.index).trim();
  return { weight: num(m[1]), rest, marker: m[2] ?? '' };
}

/** Vereinheitlicht Namen für den Vergleich: Kleinbuchstaben, Umlaute, Leerzeichen. */
const norm = (s: string): string =>
  s
    .toLowerCase()
    .replace(/ß/g, 'ss')
    .replace(/ä/g, 'a')
    .replace(/ö/g, 'o')
    .replace(/ü/g, 'u')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * Ordnet einen geparsten Namen einer bestehenden Übung im Katalog zu.
 * Reihenfolge: exakter (normalisierter) Treffer, sonst ein eindeutiger Teiltreffer.
 * Mehrdeutige Teiltreffer werden nicht geraten, sondern als „fehlt“ behandelt.
 */
export function matchExercise(name: string, catalog: Exercise[]): Exercise | undefined {
  const n = norm(name);
  if (!n) return undefined;
  const exact = catalog.find((x) => norm(x.name) === n);
  if (exact) return exact;
  const partial = catalog.filter((x) => norm(x.name).includes(n));
  return partial.length === 1 ? partial[0] : undefined;
}

export interface SettingUpdate {
  exerciseId: string;
  setting: string;
}

/**
 * Baut PlanItems aus geparsten Zeilen. Nicht erkannte Übungen erhalten keine ID.
 * Geräteeinstellungen aus dem Text werden als `settingUpdates` zurückgegeben,
 * damit sie nur an Übungen ohne eigene Einstellung geschrieben werden.
 */
export function toPlanItems(
  items: ParsedItem[],
  catalog: Exercise[],
): { items: PlanItem[]; missing: string[]; settingUpdates: SettingUpdate[] } {
  const missing: string[] = [];
  const out: PlanItem[] = [];
  const settingUpdates: SettingUpdate[] = [];
  for (const it of items) {
    const ex = matchExercise(it.name, catalog);
    if (!ex) {
      missing.push(it.name);
      continue;
    }
    if (it.setting && !ex.setting) settingUpdates.push({ exerciseId: ex.id, setting: it.setting });
    out.push({
      exerciseId: ex.id,
      sets: it.sets,
      repMin: it.repMin,
      repMax: it.repMax,
      weight: it.weight,
      hint: it.hint,
    });
  }
  return { items: out, missing, settingUpdates };
}
