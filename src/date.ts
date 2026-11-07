/** Lokales Datum als ISO-String YYYY-MM-DD (Ortszeit, nicht UTC). */
export function localDate(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Datum um n Tage verschoben, lokal berechnet. */
export function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  return localDate(new Date(y, m - 1, d + n));
}

/** Prüft, ob ein String ein gültiges ISO-Datum YYYY-MM-DD ist (inkl. Kalenderprüfung). */
export function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}
