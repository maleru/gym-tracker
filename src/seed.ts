import { getDb } from './db';
import type { Exercise } from './types';

/**
 * Übungskatalog aus den Beispielplänen (3er Split, 2,5er Split).
 * Bewusst ohne Notizen und Geräteeinstellungen: die Infos werden vom Nutzer selbst ergänzt.
 * Die Muskelzuordnung bleibt, sie wird für die Körperkarte benötigt.
 * Wird nur angelegt, wenn der Katalog noch leer ist.
 */
const EXERCISES: Exercise[] = [
  // Push
  { id: 'bankdruecken-kh', name: 'Bankdrücken KH', equipment: 'KH', muscles: ['brust', 'trizeps', 'schulter'] },
  { id: 'schulterdruecken-lh', name: 'Schulterdrücken LH', equipment: 'LH', muscles: ['schulter', 'trizeps'] },
  { id: 'fly-maschine', name: 'Fly Maschine', equipment: 'Maschine', muscles: ['brust'] },
  { id: 'skull-crusher', name: 'Skull Crusher', equipment: 'SZ', muscles: ['trizeps'] },
  { id: 'seitheben-kabel', name: 'Seitheben Kabelzug', equipment: 'Kabel', muscles: ['schulter'] },
  { id: 'trizeps-einzeln-kabel', name: 'Trizeps einzeln (Kabel)', equipment: 'Kabel', muscles: ['trizeps'] },
  // Pull
  { id: 't-bar-rudern', name: 'T-Bar rudern eng', equipment: 'LH', muscles: ['ruecken', 'bizeps'] },
  { id: 'rudern-breit-schraegbank-kh', name: 'Rudern breit Schrägbank KH', equipment: 'KH', muscles: ['ruecken', 'schulter'] },
  { id: 'einarmiger-latzug', name: 'Einarmiger Latzug kniend von oben', equipment: 'Kabel', muscles: ['ruecken', 'bizeps'] },
  { id: 'bizeps-curls-schraegbank', name: 'Bizeps Curls Schrägbank', equipment: 'KH', muscles: ['bizeps'] },
  { id: 'face-pulls', name: 'Face Pulls', equipment: 'Kabel', muscles: ['schulter', 'ruecken'] },
  { id: 'bizeps-iso-curls', name: 'Bizeps Iso Curls', equipment: 'Maschine', muscles: ['bizeps'] },
  // Beine
  { id: 'rumaenisches-kreuzheben', name: 'Rumänisches Kreuzheben', equipment: 'LH', muscles: ['beinbeuger', 'gluteus', 'ruecken'] },
  { id: 'beinpresse', name: 'Beinpresse', equipment: 'Maschine', muscles: ['quadrizeps', 'gluteus'] },
  { id: 'waden-beinpresse', name: 'Waden an Beinpresse', equipment: 'Maschine', muscles: ['waden'] },
  { id: 'wadenmaschine', name: 'Wadenmaschine', equipment: 'Maschine', muscles: ['waden'] },
  { id: 'beinbeuger', name: 'Beinbeuger', equipment: 'Maschine', muscles: ['beinbeuger'] },
  { id: 'beinstrecker', name: 'Beinstrecker', equipment: 'Maschine', muscles: ['quadrizeps'] },
  // Oberkörper (2,5er Split)
  { id: 'l-sit', name: 'L-Sit', equipment: 'Koerper', muscles: ['bauch'] },
  { id: 'latzug-mittelbreit', name: 'Latzug mittelbreit', equipment: 'Kabel', muscles: ['ruecken', 'bizeps'] },
  { id: 'flys-kabel-schulterhoehe', name: 'Flys Kabelzug Schulterhöhe', equipment: 'Kabel', muscles: ['brust'] },
  { id: 'bizeps-curls-sz-polster', name: 'Bizeps Curls SZ mit Polster', equipment: 'SZ', muscles: ['bizeps'] },
  { id: 'schraegbank-maschinenpresse', name: 'Schrägbank MP', equipment: 'Maschine', muscles: ['brust', 'trizeps'] },
  { id: 'rudern-kh-eng-einzeln', name: 'Rudern KH eng einzeln', equipment: 'KH', muscles: ['ruecken', 'bizeps'] },
  { id: 'seitheben-kh', name: 'Seitheben KH', equipment: 'KH', muscles: ['schulter'] },
  { id: 'butterfly-von-oben', name: 'Butterfly von oben', equipment: 'Maschine', muscles: ['brust'] },
  { id: 'reverse-fly-kabel', name: 'Reverse Fly Kabelzug', equipment: 'Kabel', muscles: ['schulter', 'ruecken'] },
  { id: 'bizeps-schraegbank-curls', name: 'Bizeps Schrägbank Curls', equipment: 'KH', muscles: ['bizeps'] },
  { id: 'trizeps-kabel-seil', name: 'Trizeps Kabelzug Seil', equipment: 'Kabel', muscles: ['trizeps'] },
  // Beine (2,5er Split)
  { id: 'hack-squat', name: 'Hack Squat', equipment: 'Maschine', muscles: ['quadrizeps', 'gluteus'] },
  { id: 'ausfallschritte', name: 'Ausfallschritte', equipment: 'KH', muscles: ['quadrizeps', 'gluteus'] },
  { id: 'waden-sitzend', name: 'Waden sitzend', equipment: 'Maschine', muscles: ['waden'] },
  { id: 'beinbeuger-sitzend', name: 'Beinbeuger sitzend', equipment: 'Maschine', muscles: ['beinbeuger'] },
  // Bauch
  { id: 'bauch-maschine', name: 'Bauch Maschine', equipment: 'Maschine', muscles: ['bauch'] },
  { id: 'bauch-heben-kh', name: 'Bauch heben mit KH', equipment: 'KH', muscles: ['bauch'] },
];

export async function seedIfEmpty(): Promise<void> {
  const db = await getDb();
  if ((await db.count('exercises')) > 0) return;
  const tx = db.transaction('exercises', 'readwrite');
  for (const ex of EXERCISES) await tx.store.put(ex);
  await tx.done;
}
