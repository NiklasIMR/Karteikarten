# Karteikarten-PWA – Version 1

Ziel: Minimale Lern-App als PWA für das iPhone (Safari → „Zum Home-Bildschirm“), gehostet über GitHub Pages. V1 fragt die 5 Sicherheitsregeln nach DIN VDE 0105-100 ab. Weitere Decks kommen per JSON-Import.

## Arbeitsweise (Budget sparen)
- Nur das umsetzen, was hier steht. Keine zusätzlichen Features und keine Rückfragen zu Details, die hier geregelt sind.
- Kein Browser-Testing, keine Screenshots, kein npm, kein Build-Tool. Der Nutzer testet selbst auf dem iPhone.
- Knapp antworten: Am Ende nur die geänderten Dateien auflisten.
- Bei Korrekturen nur die betroffene Datei lesen und ändern.

## Technik
- Vanilla HTML/CSS/JS (ES-Module), keine Frameworks, keine externen Bibliotheken, kein CDN.
- Alle Pfade relativ (`./`), weil die App unter `https://<user>.github.io/<repo>/` läuft.
- Speicher: `localStorage` über `store.js`. Alle Zugriffe laufen nur über dieses Modul, damit später ein Wechsel auf IndexedDB möglich ist.
- Offline: `sw.js` mit Cache-First-Strategie für alle App-Dateien. Die Konstante `CACHE_VERSION` muss bei jeder Änderung erhöht werden.
- `manifest.webmanifest`: `display: standalone`, Theme-Farbe `#001E50`. In `index.html` zusätzlich die Apple-Meta-Tags (`apple-mobile-web-app-capable`, `apple-touch-icon`).
- Icons `icons/icon-180.png`, `icon-192.png` und `icon-512.png` einmalig per Python/Pillow erzeugen: dunkelblauer Hintergrund mit weißer „5“.

## Dateien
```
index.html  style.css  app.js  store.js  quiz.js  import.js
sw.js  manifest.webmanifest  icons/  decks/vde-5-sicherheitsregeln.json
```
- `app.js`: Routing per Hash: `#home`, `#quiz`, `#import`.
- `quiz.js`: Abfragelogik und die drei Kartentypen.
- `import.js`: Datei einlesen, validieren und speichern; „Format für KI kopieren“.
- Das Startdeck wird beim ersten Start automatisch geladen, wenn noch kein Deck existiert.

## UI
- Sprache Deutsch, mobile-first, große Tippflächen (mindestens 44 px), `env(safe-area-inset-*)` beachten.
- Farben: Dunkelblau `#001E50`, Hellblau `#00B0F0`, Weiß; Dark Mode über `prefers-color-scheme`.
- Eingabefelder mit `font-size: 16px`, damit iOS beim Antippen nicht hineinzoomt.
- Startseite: Liste der Decks mit Checkbox zur Auswahl, Button „Los“, je Deck die Trefferquote, Button „Import“, je Deck „Fortschritt zurücksetzen“ und „Löschen“ (jeweils mit Bestätigung).

## Abfrage
- „Los“ startet sofort mit allen Karten der gewählten Decks. Es gibt keine Lektionen und kein festes Ende. Oben stehen ein Zähler (richtig/gesamt) und ein Button „Beenden“.
- Reihenfolge: gemischt. Karten mit schlechter Quote kommen häufiger dran (Gewichtung nach Fehlern). Eine falsch beantwortete Karte erscheint nach 3 weiteren Karten erneut.
- Jede Antwort wird sofort gespeichert, pro Karte `{right, wrong, lastSeen}`. Abbrechen ist jederzeit möglich.
- Nach jeder Antwort: Feedback grün/rot, die richtige Lösung, die `explanation` (falls vorhanden) und der Button „Weiter“.

## Kartentypen
**`input`**: Antwort eintippen, bestätigen per Button oder Enter.
- `mode: "fuzzy"` (Standard): Vor dem Vergleich normalisieren (Kleinschreibung, trimmen, Satzzeichen und Mehrfach-Leerzeichen entfernen, ä→ae, ö→oe, ü→ue, ß→ss). Als richtig gilt eine Levenshtein-Distanz ≤ 15 % der Länge zu einer der `answers`.
- `mode: "exact"`: nach dem Normalisieren exakt gleich. Gedacht für Zahlen.
- `inputmode` wird ans Eingabefeld durchgereicht, z. B. `"numeric"` für die Zahlentastatur.
- Bei einer falschen Antwort gibt es den Button „Doch richtig“: Er zählt die Antwort als richtig.

**`choice`**: Ankreuzen.
- `multi: false` → Radio-Verhalten, `multi: true` → Checkboxen und Button „Prüfen“.
- Optionen werden gemischt, außer bei `shuffle: false`. Richtig ist nur die exakt richtige Menge der angekreuzten Optionen.

**`order`**: Reihenfolge herstellen.
- `items` stehen in der richtigen Reihenfolge in der Datei und werden gemischt angezeigt.
- Bedienung per Antippen: Das angetippte Element wandert in die Zielliste (nummeriert). Ein Antippen in der Zielliste schiebt das Element zurück. Kein Drag & Drop.
- Wenn alle Elemente einsortiert sind, folgt „Prüfen“. Falsch platzierte Elemente werden rot markiert.

## Importformat (`karteikarten-v1`)
```json
{
  "format": "karteikarten-v1",
  "deck": { "id": "vde-5-regeln", "title": "5 Sicherheitsregeln (VDE)" },
  "cards": [
    { "id": "r3-text", "type": "input", "question": "…", "answers": ["…", "…"],
      "mode": "fuzzy", "inputmode": "text", "explanation": "…" },
    { "id": "mc1", "type": "choice", "question": "…", "options": ["…"],
      "correct": [0], "multi": false, "shuffle": true, "explanation": "…" },
    { "id": "ord1", "type": "order", "question": "…", "items": ["1.", "2.", "…"],
      "explanation": "…" }
  ]
}
```
- Import über `<input type="file" accept=".json,application/json">`. Das öffnet am iPhone die Dateien-App.
- Validierung: Bei Fehlern eine verständliche Meldung mit Kartennummer und Feld, und dann nichts importieren.
- Gleiche `deck.id` wie ein vorhandenes Deck: nachfragen, ob ersetzt werden soll. Dabei bleibt der Fortschritt für Karten-IDs erhalten, die es weiterhin gibt.
- Button „Format für KI kopieren“: kopiert einen fertigen Prompt in die Zwischenablage. Der Prompt enthält dieses Schema, Regeln für eindeutige IDs, die Vorgabe „nur reines JSON ausgeben“ und ein Beispiel je Typ.

## Startdeck `decks/vde-5-sicherheitsregeln.json`
Die Regeln (nach DIN VDE 0105-100) mit den akzeptierten Varianten für `input`:
1. Freischalten
2. Gegen Wiedereinschalten sichern | Sichern gegen Wiedereinschalten
3. Spannungsfreiheit feststellen | Spannungsfreiheit allpolig feststellen | Spannungsfreiheit allpolig an der Arbeitsstelle feststellen
4. Erden und kurzschließen | Erden und Kurzschließen
5. Benachbarte, unter Spannung stehende Teile abdecken oder abschranken | Benachbarte spannungsführende Teile abdecken oder abschranken

Karten:
- 5× `input`: „Wie lautet die Sicherheitsregel Nr. N?“
- 5× `input`, `mode: "exact"`, `inputmode: "numeric"`: „Welche Nummer hat die Regel ‚…‘?“
- 4× `choice` single: „Welche Regel folgt direkt auf ‚…‘?“ für die Regeln 1–4, mit jeweils 4 Optionen.
- 1× `choice` multi: „Welche gehören zu den 5 Sicherheitsregeln?“. Die Optionen sind die 5 Regeln plus die Ablenker „Schutzkleidung anlegen“, „Isolationswiderstand messen“ und „Fehlerstrom-Schutzschalter prüfen“.
- 1× `order`: alle 5 Regeln in der richtigen Reihenfolge.
- 1× `order`: „Reihenfolge beim Aufheben nach Arbeitsende“ = die Regeln 5→1 (die Aufhebung erfolgt in umgekehrter Reihenfolge).
- Jede Karte bekommt eine kurze `explanation`, z. B. warum vor dem Erden die Spannungsfreiheit festgestellt werden muss.

## Deployment (Hinweis für den Nutzer)
Repo pushen → Settings → Pages → Branch `main`, Ordner `/root`. Danach die URL in Safari öffnen und „Zum Home-Bildschirm“ wählen.
