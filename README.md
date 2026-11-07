# Gym Tracker

Eine mobile Web-App (PWA) zum Protokollieren von Krafttraining. Pläne, Trainingstage, Übungen, Gewichte und Wiederholungen werden lokal im Browser gespeichert. Die App funktioniert offline und lässt sich auf dem Smartphone als Homescreen-App installieren.

## Funktionen

- **Start:** Zeigt den aktiven Plan und das nächste fällige Training. Jeder Trainingstag ist eine große Schaltfläche. Mit „Übungen · N" klappt eine Vorschau mit Gewicht und Wiederholungen auf.
- **Training:**
  - Datum (Standard: heute, keine Zukunftsdaten), Spindnummer und Notiz zum Training.
  - Jede Übung ist einklappbar und zeigt Ziel und Fortschritt. Nach dem Abhaken aller Sätze klappt die nächste offene Übung auf.
  - Gewicht und Wiederholungen pro Satz lassen sich mit Schrittweite-Buttons oder direkt eingeben.
  - Ein angefangenes Training wird als Entwurf im Browser gesichert und beim nächsten Öffnen wiederhergestellt.
- **Pläne:** Pläne anlegen (Splits wie 3er Push/Pull/Beine), Tage und Übungen mit Sätzen, Wiederholungsbereich, Gewicht, Schema, Hinweis, Alternative und Supersatz bearbeiten. Ein Plan ist aktiv. Pläne können auch aus Text importiert werden.
- **Übungskatalog:** Übungen mit Gerät, Muskeln, Notiz und Geräteeinstellung. Die Katalogdaten werden für alle Pläne gemeinsam genutzt.
- **Fortschritt:** Verlauf einer Übung als Diagramm (Gewicht, Wiederholungen, geschätztes 1RM nach Epley, Volumen). Zusätzlich eine Körperkarte mit den trainierten Muskeln.
- **Einstellungen:** Schrittweiten je Gerätetyp und Backup (Export und Import).

## Technik

- [Preact](https://preactjs.com/) mit TypeScript
- [Vite](https://vitejs.dev/) als Build-Werkzeug, [vite-plugin-pwa](https://vite-pwa-org.netlify.app/) für Offline-Nutzung
- [idb](https://github.com/jakearchibald/idb) für IndexedDB als Datenspeicher
- [Vitest](https://vitest.dev/) für Tests

Es gibt kein Backend. Alle Daten liegen im Browser des Geräts (IndexedDB, Entwürfe in localStorage). Regelmäßig ein Backup über die Einstellungen exportieren.

## Entwicklung

Voraussetzung: Node.js mit npm.

```bash
npm install
npm run dev        # Entwicklungsserver
npm run test       # Tests (Vitest)
npm run typecheck  # TypeScript-Prüfung
npm run build      # Typecheck und Produktions-Build nach dist/
npm run preview    # Produktions-Build lokal ansehen
```

## Projektstruktur

```
src/
  main.tsx          Einstiegspunkt und Routing (Hash-basiert)
  router.ts         Hash-Router
  db.ts             IndexedDB-Zugriff (Pläne, Übungen, Sessions, Einstellungen) inkl. Backup-Import
  types.ts          Datentypen
  logic.ts          Auswertungen: letzte Leistung, nächster Tag, Zusammenfassungen
  history.ts        Verlauf und Veränderung für Diagramme
  muscles.ts        Muskelgruppen für die Körperkarte
  date.ts           Lokale Datumshilfen
  seed.ts           Startdaten beim ersten Start
  textImport.ts     Import von Plänen aus Text
  screens/          Ansichten (Start, Training, Pläne, Fortschritt, Einstellungen)
  components/       Wiederverwendbare Bausteine (z. B. Collapsible, DecimalInput)
public/icons/       App-Icons
scripts/            Hilfsskripte (Icon-Erzeugung)
plans/              Planungsnotizen
```

## Lizenz

Keine Lizenz angegeben.
