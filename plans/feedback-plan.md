# Plan: Feedback aus dem ersten Praxistest

Fünf Punkte: Doppeltipp-Zoom, verzögerte Eingabe, Gesamtgewicht bei Pro-Seite-Übungen, Schrittweiten pro Übung und Übungseinstellungen direkt aus dem Training (Zahnrad).
Vorgeschlagene Reihenfolge: 1 + 2 (klein, sofort spürbar) → 4 → 3 → 5. Die Punkte 4 und 3 ändern beide das Übungsmodell und teilen sich eine Migration. Punkt 5 baut auf dem erweiterten Formular auf.

---

## 1. Doppeltipp zoomt die Ansicht

**Ursache:** iOS Safari zoomt bei Doppeltipp. Zwei schnelle Tipps auf `+` werden als Zoom-Geste erkannt statt als zwei Klicks.
Außerdem zoomt iOS beim Fokussieren von Eingabefeldern mit einer Schriftgröße unter 16 px heran. Die kompakten Stepper-Felder sind möglicherweise kleiner.

**Umsetzung:**
- [`src/styles.css`](../src/styles.css): global `touch-action: manipulation;` auf `html` (alternativ gezielt auf `button, input, select, label, a`).
  Damit ist Doppeltipp-Zoom aus, Pinch-Zoom geht weiter (wichtig für die Barrierefreiheit).
- Schriftgröße aller `input`/`select` auf mindestens `16px` setzen, besonders `.set.compact .stepper input`. Das verhindert den Fokus-Zoom.
- `user-scalable=no` / `maximum-scale=1` in [`index.html`](../index.html) **nicht** setzen, weil iOS das seit Version 10 sowieso ignoriert und es Pinch-Zoom blockieren würde.

**Test:** Auf dem iPhone `+` schnell hintereinander tippen. Erwartet: kein Zoom, jeder Tipp zählt.

---

## 2. Eingabe fühlt sich verzögert an

**Ursachen (nach Gewicht):**
1. **300-ms-Klickverzögerung:** Solange Doppeltipp-Zoom möglich ist, wartet der Browser nach jedem Tipp etwa 300 ms, ob noch ein zweiter folgt. Genau das ist der beschriebene „kurze Moment“. Wird mit Punkt 1 (`touch-action: manipulation`) gleich mit behoben.
2. **Verlorene Tipps:** [`Stepper`](../src/screens/Session.tsx:325) rechnet `value + step` mit dem Wert aus dem letzten Render. Kommen zwei Tipps vor dem nächsten Render, wird beide Male vom alten Wert aus gerechnet und nur einmal erhöht.
3. **Synchroner localStorage-Schreibvorgang:** Bei jeder Änderung wird der komplette Entwurf mit `JSON.stringify` serialisiert und geschrieben ([`Session.tsx`](../src/screens/Session.tsx:133)). Das blockiert den Haupt-Thread kurz.
4. **Komplettes Neurendern:** Jede Änderung rendert alle Übungen neu, auch die zugeklappten.
5. **Kein sofortiges visuelles Feedback** beim Antippen (kein `:active`-Zustand).

**Umsetzung:**
- Stepper auf Delta umstellen: `onStep(delta)` → `updateSet` rechnet im funktionalen `setRows` mit `s.w + delta`. So zählt jeder Tipp, auch wenn er vor dem nächsten Render kommt.
- Entwurf entprellt speichern (etwa 300 ms `setTimeout`) und zusätzlich bei `visibilitychange`/`pagehide` sofort schreiben, damit beim App-Wechsel nichts verloren geht.
- Übungszeile als eigene Komponente `ExerciseRow` mit `memo` herauslösen. Handler mit `useCallback` stabil halten, damit nur die geänderte Zeile neu rendert.
- CSS: `.stepper button:active { background: … ; transform: scale(0.96); }` für direktes Feedback.
- Optional: Gedrückt halten wiederholt den Schritt (nach 400 ms alle 100 ms). Erst einmal weglassen, nur falls gewünscht.

**Test:** Unit-Test für die Delta-Logik (zwei schnelle Updates ergeben +2 Schritte). Manuell auf dem iPhone prüfen.

---

## 3. Gesamtgewicht bei Pro-Seite-Übungen

**Anforderung:** Bei manchen Übungen wird das Gewicht **pro Seite** eingetragen. Für Fortschritt/Statistik zählt aber das Gesamtgewicht = `2 × Eingabe + Stange`.
Die Stange wiegt in der Regel 20 kg, an der Multipresse 0 kg (z. B. Waden sitzend). KH bleibt unverändert (Eingabe pro Hand = Vergleichswert).

**Datenmodell** ([`src/types.ts`](../src/types.ts:4)):
```ts
export interface Exercise {
  // …
  /** Eingabe ist Gewicht pro Seite; Gesamt = 2 × Eingabe + barWeight */
  perSide?: boolean;
  /** Stangengewicht in kg, Standard 20 */
  barWeight?: number;
}
```

**Grundsatzentscheidung: gespeichert wird weiterhin die Eingabe, umgerechnet wird beim Lesen.**
- `SetLog.w` bleibt genau das, was eingetippt wurde. Das Training sieht also aus wie gewohnt.
- Neue Funktion in [`src/logic.ts`](../src/logic.ts): `totalWeight(ex, w) = ex.perSide ? 2*w + (ex.barWeight ?? 20) : w`.
- Vorteil: Alte Einträge (z. B. Schulterdrücken mit 10 kg) werden automatisch richtig berechnet, sobald das Häkchen gesetzt ist. Es muss keine Historie umgeschrieben werden.
- Nachteil: Wird das Stangengewicht später geändert, ändert sich auch die alte Historie. Das ist für den Anwendungsfall akzeptabel.

**Betroffene Stellen:**
- [`exerciseHistory()`](../src/history.ts:26): bekommt die `Exercise` mit übergeben. `weight`, `oneRM` und `volume` werden mit `totalWeight` berechnet.
- [`Stats.tsx`](../src/screens/Stats.tsx:83): Übung an `exerciseHistory` übergeben. Achsenbeschriftung bei perSide-Übungen: „Gesamtgewicht“.
- [`Session.tsx`](../src/screens/Session.tsx:262): Spaltenkopf „kg / Seite“ statt „Gewicht (kg)“. Unter dem Satz bzw. in der Zusammenfassung klein `= 40 kg gesamt` anzeigen.
- [`ExerciseForm`](../src/screens/ExerciseEditor.tsx:18): Checkbox „Gewicht pro Seite eintragen (Langhantel)“ plus Feld „Stange (kg)“, Standard 20. Die Checkbox wird beim **Neuanlegen** automatisch vorausgewählt, wenn Gerät = LH. Sie bleibt abwählbar, z. B. für die T-Bar.
- [`validateBackup()`](../src/db.ts:128): optionale Felder prüfen (`perSide` boolean, `barWeight` Zahl ≥ 0).
- `summarizeSets`/Plan-Zielgewicht bleiben Eingabewerte, also pro Seite. Das entspricht dem, was an der Stange gemacht wird.

**Migration bestehender Übungen:** einmalig, siehe Tabelle unten in Punkt 4 (Spalte „Pro Seite“).

**Tests:** `totalWeight` (perSide an/aus, eigenes Stangengewicht), `exerciseHistory` mit perSide-Übung.

---

## 4. Schrittweiten pro Übung statt pro Gerät

**Anforderung:** Jede Übung hat eine eigene Schrittweite mit sinnvollem Standardwert, die man in der Übung selbst ändern kann.

**Datenmodell:**
```ts
export interface Exercise {
  // …
  /** Schrittweite für +/− in kg (bezogen auf die Eingabe) */
  step?: number;
}
```

**Festgelegte Werte für den Katalog** (mit dem Nutzer abgestimmt). Sie gelten für die Migration **und** für [`src/seed.ts`](../src/seed.ts), damit auch eine Neuinstallation sie bekommt:

| # | ID | Übung | Schritt (kg) | Pro Seite / Stange |
|---|---|---|---|---|
| 1 | bankdruecken-kh | Bankdrücken KH | 1 | – |
| 2 | schulterdruecken-lh | Schulterdrücken LH | 0,5 | ja / 20 kg |
| 3 | fly-maschine | Fly Maschine | 2,5 | – |
| 4 | skull-crusher | Skull Crusher | 0,5 | – |
| 5 | seitheben-kabel | Seitheben Kabelzug | 0,5 | – |
| 6 | trizeps-einzeln-kabel | Trizeps einzeln (Kabel) | 0,5 | – |
| 7 | t-bar-rudern | T-Bar rudern eng | 2,5 | **nein** (keine Umrechnung) |
| 8 | rudern-breit-schraegbank-kh | Rudern breit Schrägbank KH | 1 | – |
| 9 | einarmiger-latzug | Einarmiger Latzug | 1 | – |
| 10 | bizeps-curls-schraegbank | Bizeps Curls Schrägbank | 1 | – |
| 11 | face-pulls | Face Pulls | 0,5 | – |
| 12 | bizeps-iso-curls | Bizeps Iso Curls | 1 | – |
| 13 | rumaenisches-kreuzheben | Rumänisches Kreuzheben | 2,5 | ja / 20 kg |
| 14 | beinpresse | Beinpresse | 5 | – |
| 15 | waden-beinpresse | Waden an Beinpresse | 5 | – |
| 16 | wadenmaschine | Wadenmaschine | 1 | – |
| 17 | beinbeuger | Beinbeuger | 2,5 | – |
| 18 | beinstrecker | Beinstrecker | 2,5 | – |
| 19 | l-sit | L-Sit | 1 (ohne Bedeutung) | – |
| 20 | latzug-mittelbreit | Latzug mittelbreit | 1 | – |
| 21 | flys-kabel-schulterhoehe | Flys Kabelzug Schulterhöhe | 1 | – |
| 22 | bizeps-curls-sz-polster | Bizeps Curls SZ mit Polster | 0,5 | – |
| 23 | schraegbank-maschinenpresse | Schrägbank MP | 2,5 | – |
| 24 | rudern-kh-eng-einzeln | Rudern KH eng einzeln | 2 | – |
| 25 | seitheben-kh | Seitheben KH | 1 | – |
| 26 | butterfly-von-oben | Butterfly von oben | 1 | – |
| 27 | reverse-fly-kabel | Reverse Fly Kabelzug | 0,5 | – |
| 28 | bizeps-schraegbank-curls | Bizeps Schrägbank Curls | 0,5 | – |
| 29 | trizeps-kabel-seil | Trizeps Kabelzug Seil | 0,5 | – |
| 30 | hack-squat | Hack Squat | 2,5 | – |
| 31 | ausfallschritte | Ausfallschritte | 1 | – |
| 32 | waden-sitzend | Waden sitzend | 5 | ja / **0 kg** (Multipresse) |
| 33 | beinbeuger-sitzend | Beinbeuger sitzend | 2,5 | – |
| 34 | bauch-maschine | Bauch Maschine | 1 | – |
| 35 | bauch-heben-kh | Bauch heben mit KH | 1 | – |

Bei Pro-Seite-Übungen gilt der Schritt für die Eingabe pro Seite. 2,5 kg pro Seite ergeben also +5 kg gesamt.

**Vorschlag für neue oder unbekannte Übungen**, als reine Funktion `defaultStep(ex)` in [`src/logic.ts`](../src/logic.ts). Nur ein Startwert, danach frei änderbar:

| Regel (in dieser Reihenfolge) | Schritt |
|---|---|
| Name enthält „Beinpresse“ oder „Waden“ | 5 |
| Primärmuskel ist Bizeps, Trizeps oder Schulter | 0,5 |
| Gerät Maschine | 2,5 |
| sonst | 1 |

Der Startwert für perSide richtet sich nach dem Gerät: LH → an, Stange 20 kg.

**Umsetzung:**
- Migration einmalig über das Flag `Settings.exerciseMigrationV2` (Muster wie `catalogCleaned`). Für Übungen mit einer ID aus der Tabelle werden `step`, `perSide` und `barWeight` aus der Tabelle gesetzt. Selbst angelegte Übungen ohne `step` bekommen `defaultStep`. Bereits gesetzte Werte werden nie überschrieben.
- Die Tabelle steht als Konstante `CATALOG_DEFAULTS` an genau einer Stelle (z. B. `src/seed.ts`). Seed und Migration nutzen beide diese Konstante.
- [`ExerciseForm`](../src/screens/ExerciseEditor.tsx:18): Feld „Schrittweite (kg)“ als `DecimalInput`, dazu Schnellwahl-Chips `0,5 · 1 · 2,5 · 5`. Beim Neuanlegen wird der Vorschlag live aus Name und Primärmuskel berechnet. Hat der Nutzer das Feld selbst geändert, wird nichts mehr überschrieben.
- Katalogliste: Schrittweite in der Zeile mit anzeigen, z. B. „KH · Schulter · ±0,5 kg“.
- [`Session.tsx`](../src/screens/Session.tsx:281): `step = exercise.step ?? defaultStep(exercise)`.
- [`Settings.tsx`](../src/screens/Settings.tsx:28): Bereich „Schrittweiten je Gerät“ entfernen. `Settings.increments` bleibt im Typ und in `normalizeSettings`, damit alte Backups weiter importiert werden können, wird aber nicht mehr verwendet.
- [`validateBackup()`](../src/db.ts:128): `step` optional, Zahl > 0.

**Tests:** `defaultStep` für alle Regeln. Migration: Katalogwerte werden gesetzt, vorhandene Werte bleiben erhalten, unbekannte Übungen bekommen den Vorschlag, ein zweiter Lauf ändert nichts. Backup mit und ohne `step`.

---

## 5. Zahnrad: Übung direkt im Training bearbeiten

**Anforderung:** Jede Übung in der Trainingsansicht bekommt ein Zahnrad. Darüber öffnet sich die Konfiguration der Übung: Name, Schrittweite, Pro Seite/Stange, Gerät, Muskeln, Einstellung, Notiz. Also alles, was es auch beim Anlegen gibt.

**Umsetzung:**
- [`Collapsible`](../src/components/Collapsible.tsx:21) bekommt einen optionalen Slot `actions`. Er wird **neben** dem Kopf-Button gerendert, nicht darin, denn ein Button in einem Button ist ungültiges HTML und würde beim Antippen auch auf- und zuklappen.
- In [`Session.tsx`](../src/screens/Session.tsx:245) gibt es pro Übung einen Button `⚙` (`aria-label="Übung bearbeiten"`, Tippfläche mindestens 44 px).
- Antippen öffnet ein Bottom-Sheet bzw. Overlay mit dem bestehenden [`ExerciseForm`](../src/screens/ExerciseEditor.tsx:18) (`initial = row.exercise`). Das Formular wird nicht dupliziert.
- `ExerciseForm.onSaved` liefert die gespeicherte `Exercise` zurück. Die Session ersetzt sie in `rows` (bei `exercise` und `alt`), damit eine neue Schrittweite, ein neuer Name oder die Pro-Seite-Anzeige **sofort** wirken, ohne Neuladen und ohne den Trainingsentwurf zu verlieren.
- Hinweis im Sheet: „Änderungen gelten für diese Übung in allen Plänen“, weil der Katalog global ist.
- Gibt es für eine Zeile keine Übung (`Unbekannte Übung`), wird kein Zahnrad angezeigt.
- Sheet schließen per „Abbrechen“, Tipp auf den Hintergrund oder Escape. Beim Öffnen springt der Fokus ins Namensfeld, beim Schließen zurück zum Zahnrad.

**Tests:** Session-Zustand nach dem Speichern: Die Zeile nutzt den neuen Schritt, die bereits eingetragenen Sätze bleiben erhalten.

---

## Arbeitspakete (Reihenfolge)

1. CSS: `touch-action`, Input-Schriftgröße, `:active`-Feedback *(Punkte 1 und 2, schnell erledigt)*
2. Stepper auf Delta, Entwurf entprellt speichern, `ExerciseRow` mit `memo`
3. Typen erweitern (`step`, `perSide`, `barWeight`), `validateBackup` anpassen
4. `defaultStep` und `totalWeight` in `logic.ts`, `CATALOG_DEFAULTS` plus Tests
5. Einmalige Migration für vorhandene Übungen und Seed aktualisieren
6. ExerciseForm: Schrittweite (mit Chips), perSide-Checkbox, Stangengewicht. `onSaved` gibt die Übung zurück.
7. Session: Schritt pro Übung, Anzeige „kg / Seite“ und „= X kg gesamt“
8. Session: Zahnrad mit `Collapsible.actions` und Bottom-Sheet mit ExerciseForm
9. History/Stats auf Gesamtgewicht umstellen
10. Settings: Gerätebasierte Schrittweiten entfernen
11. `npm test` und `npm run build`, danach Praxistest auf dem iPhone

## Geklärte Fragen

- T-Bar rudern: keine Umrechnung, Schritt 2,5.
- Rumänisches Kreuzheben: pro Seite + 20 kg Stange, Schritt 2,5.
- Waden sitzend (Multipresse): pro Seite, Stange 0 kg, Schritt 5.
- SZ-Übungen: Gesamtgewicht, keine Umrechnung.
- Die 60-kg-Regel entfällt. Alle Katalogwerte sind explizit festgelegt, der Vorschlag gilt nur für neue Übungen.
