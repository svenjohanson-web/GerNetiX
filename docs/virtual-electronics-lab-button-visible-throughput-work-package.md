# ELAB-DS-005: Sichtbarer Taster-Digitaleingangs-Programmdurchstich

Stand: 2026-08-16  
Status: umgesetzt, getestet und im Browser abgenommen (2026-08-16)

## Ziel

Die vorhandene Runtime aus ELAB-SEQ-005 wird als kompakter Bedienablauf in das
öffentliche virtuelle Elektroniklabor eingebunden:

```text
Taster lösen oder drücken
-> internen Pull-Modus im MCU-Quellcode festlegen
-> elektrischen Pegel an GPIO 4 beobachten
-> digitalRead(4) ausführen
-> Variable buttonState ablesen
```

Die UI enthält keine zweite Parser-, Taster- oder Pegelwahrheit. Alle
fachlichen Werte und Fehler stammen ausschließlich aus
`createButtonDigitalInputThroughputRuntime`.

## Erlaubte Dateien

- neu:
  `modules/virtual-electronics-lab/labs/button-digital-input-throughput.js`
- neu:
  `modules/virtual-electronics-lab/test/labs/button-digital-input-throughput-ui.test.mjs`
- ändern: `modules/virtual-electronics-lab/app.js`
- ändern: `modules/virtual-electronics-lab/styles.css`
- ändern: `modules/virtual-electronics-lab/index.html`
- ändern: `services/identity-server/src/dev/server/web-routes.js`
- ändern: `services/identity-server/test/public-virtual-electronics-lab.test.js`

Alle anderen Dateien bleiben unverändert. Insbesondere werden Tastermodell,
Digitaleingangs-Interpreter, Durchstich-Runtime und bestehende Labs nicht
verändert. Graph, zentrale Dokumentation und abschließende Integration
übernimmt der koordinierende Haupttask.

## Navigation

Das neue Lab wird direkt nach dem PT1000-Durchstich registriert:

- ID: `button-digital-input-throughput`
- Titel: `Durchstich · Taster → digitalRead`
- Status: `Übung`
- Zusammenfassung: `Taster mit internem Pull-Widerstand über GPIO 4 einlesen.`

Der Aufruf
`/technik-labs/?lab=button-digital-input-throughput` öffnet das Lab über den
vorhandenen Query-Mechanismus.

## Bedienoberfläche

Die Oberfläche bleibt kompakt und verwendet die vorhandene
Elektroniklabor-Gestaltung. Sie enthält mindestens:

1. ein verständliches Schaltbild mit virtuellem Mikrocontroller, GPIO `4`,
   internem Pull-Widerstand, Tasterkontakt sowie `3,3 V` und `GND`,
2. einen deutlich erkennbaren rastenden Bedientaster für `gelöst` und
   `gedrückt`,
3. einen Quellcodeeditor mit `DIGITAL_INPUT_PROGRAM_START_CODE`,
4. die Buttons `Simulation starten` und `Zurücksetzen`,
5. Ergebnisfelder für:
   - Tasterzustand,
   - Arduino-Pull-Modus,
   - Pegel an GPIO 4,
   - normierten Eingangswert,
   - Programmvariable `buttonState`,
   - Pin,
6. einen kompakten Status-/Fehlerbereich,
7. den Abschnitt `Vom virtuellen zum echten Labor`.

Der Bedientaster ist kein frei parametriertes Pegelbauteil. Ein Klick wechselt
zwischen `gelöst` und `gedrückt`, sendet ausschließlich
`SetButtonPressed` und startet danach erneut über `StartSimulation`. So wird
die fortlaufende `loop()` eines echten Mikrocontrollers didaktisch
nachgebildet, ohne Timer oder eine zweite Laufzeit einzuführen. Das
Bedienelement verwendet `aria-pressed` und einen verständlichen Textzustand.

## Command-Vertrag

Die UI importiert ausschließlich aus der Durchstich-Runtime:

- `COMMAND_TYPES`,
- `createButtonDigitalInputThroughputRuntime`,

und für den initialen Editorinhalt
`DIGITAL_INPUT_PROGRAM_START_CODE` aus der bestehenden Virtual-MCU-Runtime.

Bedienaktionen verwenden ausschließlich:

- `SetButtonPressed`,
- `UpdateSourceFile`,
- `StartSimulation`,
- `ResetSimulation`.

Quellcodeänderungen leeren die sichtbaren Messergebnisse. Reset stellt
`pressed: false`, den Startcode, leere Messwerte und leeren Fehlerzustand
wieder her. Syntaxfehler zeigen mindestens Meldung sowie, soweit vorhanden,
Zeile und Spalte. Dynamische Inhalte werden mit `textContent`, `value`,
`classList` oder `dataset` gesetzt, niemals als dynamisches HTML.

## Schaltbild und Darstellung

- Vor dem ersten Lauf zeigt das Schaltbild den Startzustand mit internem
  Pull-up als Lernhinweis, aber keinen erfundenen Messwert.
- Nach einer Simulation stammen Pull-Modus, Pegel und Tasterzustand aus dem
  Runtime-Snapshot.
- Bei `INPUT_PULLUP` verbindet der gedrückte Taster den Eingang didaktisch mit
  `GND`; gelöst ergibt er `HIGH`.
- Bei `INPUT_PULLDOWN` verbindet der gedrückte Taster den Eingang didaktisch
  mit `3,3 V`; gelöst ergibt er `LOW`.
- Diese Zuordnung wird nur aus `measurement.buttonContactPullMode`,
  `measurement.logicLevel` und `measurement.pressed` dargestellt. Die UI
  berechnet den Pegel nicht selbst.
- Noch nicht vorhandene Messwerte erscheinen als `—`.
- Es wird klar benannt, dass das Modell idealisiert ist, kein Prellen enthält
  und keine konkrete ESP32-Emulation darstellt.
- Der Realitätsübergang nennt internen Pull-Widerstand, gemeinsame Masse,
  zulässige GPIO-Spannung, Tasterverdrahtung und Entprellung.
- Dark- und Light-Theme sowie iPad-, Tablet- und Mobilbreite bleiben nutzbar.

## Öffentliche Modulroute

Die bestehende flache Laborroute erlaubt bereits `labs/*.js`, `labs/*.mjs`
und `virtual-mcu/*.mjs`. Für die neue Runtime-Abhängigkeit wird genau ein
weiteres flaches Segment ergänzt:

- `input-models/<ein Dateiname>.mjs`

Keine beliebigen Unterverzeichnisse, JSON-Dateien, Source Maps oder
zusätzlichen Slash-Segmente werden freigegeben. Die vorhandene
`serveStatic`-Funktion und das statische öffentliche Architekturmodell bleiben
erhalten.

`index.html` erhält für `app.js` und `styles.css` gemeinsam den Cache-Buster
`20260816-button-ui-1`. Der neue Import in `app.js` verwendet denselben
Cache-Buster.

## Tests

Der neue UI-Contract-Test prüft mindestens:

1. Runtime-Import statt duplizierter Parser-/Taster-/Pegellogik,
2. Lab-Metadaten und Registrierung direkt nach dem PT1000-Durchstich,
3. Schaltbild mit MCU, GPIO 4, Pull-Widerstand, Taster, 3,3 V und GND,
4. zugänglichen Tasterzustand, Editor, Start und Reset,
5. alle sechs Ergebnisfelder,
6. ausschließlich die vier erlaubten Commands,
7. automatische Neuberechnung nach Tasterwechsel,
8. Ausgabe über `textContent` und Fehleranzeige mit Zeile und Spalte,
9. Realitätsübergang, Idealisierung und fehlendes Prellen,
10. responsive Taster-spezifische Styles für Dark und Light,
11. eng begrenzte öffentliche Route für `input-models/*.mjs`,
12. neuen gemeinsamen Cache-Buster,
13. kein Netzwerk, keine Persistenz, keine Wall-Clock, keine Timer und kein
    Zufall in der neuen UI-Datei.

Der öffentliche Identity-Integrationstest wird um Modul, Navigation,
Cache-Buster und Route ergänzt.

## Pflichtabnahme

```text
node --test modules/virtual-electronics-lab/test/labs/button-digital-input-throughput-ui.test.mjs
node --test modules/virtual-electronics-lab/test/labs/button-digital-input-throughput-runtime.test.mjs
node --test services/identity-server/test/public-virtual-electronics-lab.test.js
git diff --check
```

Keine Serverstarts, kein Commit, kein Push und kein Deployment.
