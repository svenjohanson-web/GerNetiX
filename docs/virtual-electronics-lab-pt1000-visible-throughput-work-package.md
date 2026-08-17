# ELAB-DS-004: Sichtbarer PT1000-ADC-Programmdurchstich

Stand: 2026-08-16  
Status: umgesetzt, getestet und im Browser abgenommen (2026-08-16)

## Ziel

Die vorhandene Runtime aus ELAB-PAR-006 wird als kompakter Bedienablauf in das
öffentliche virtuelle Elektroniklabor eingebunden:

```text
Umgebungstemperatur einstellen
-> PT1000 und Spannungsteiler im Schaltbild
-> Sense-Knoten an A0
-> Virtual-MCU-Quellcode bearbeiten
-> Simulation starten
-> Widerstand, Spannung, Strom und ADC-Wert ablesen
```

Die UI enthält keine zweite Rechenwahrheit. Alle fachlichen Werte und Fehler
stammen ausschließlich aus `createPt1000ThroughputRuntime`.

## Erlaubte Dateien

- neu: `modules/virtual-electronics-lab/labs/pt1000-adc-throughput.js`
- neu: `modules/virtual-electronics-lab/test/labs/pt1000-adc-throughput-ui.test.mjs`
- ändern: `modules/virtual-electronics-lab/app.js`
- ändern: `modules/virtual-electronics-lab/styles.css`
- ändern: `modules/virtual-electronics-lab/index.html`
- ändern: `modules/virtual-electronics-lab/dev-server.js`
- ändern: `services/identity-server/src/dev/server/web-routes.js`
- ändern: `services/identity-server/src/dev/http-utils.js`
- ändern: `services/identity-server/test/public-virtual-electronics-lab.test.js`

Alle anderen Dateien bleiben unverändert. Insbesondere werden Runtime,
PT1000-Modell, DC-Solver, ADC-Quantisierer und Virtual-MCU-Interpreter nicht
verändert.

## Navigation

Das neue Lab wird direkt nach dem vorhandenen GPIO-LED-Durchstich registriert:

- ID: `pt1000-adc-throughput`
- Titel: `Durchstich · PT1000 → ADC`
- Status: `Übung`
- Zusammenfassung: Temperatur über Spannungsteiler und ADC im Mikrocontroller
  messen.

Der Aufruf `/technik-labs/?lab=pt1000-adc-throughput` öffnet das Lab über den
bereits vorhandenen allgemeinen Query-Mechanismus.

## Bedienoberfläche

Die Oberfläche bleibt kompakt und verwendet die vorhandene
Elektroniklabor-Gestaltung. Sie enthält mindestens:

1. ein verständliches Schaltbild für
   `3,3 V -> 1000 Ω -> Sense/A0 -> PT1000 -> GND`,
2. eine als Umgebungseinfluss bezeichnete Temperatureinstellung von
   `-200 °C` bis `850 °C`,
3. einen Quellcodeeditor mit `ADC_PROGRAM_START_CODE`,
4. die Buttons `Simulation starten` und `Zurücksetzen`,
5. Ergebnisfelder für:
   - Umgebungstemperatur,
   - PT1000-Widerstand,
   - Sense-Spannung,
   - Teilerstrom,
   - ADC-Code,
   - quantisierte ADC-Spannung,
   - Programmvariable `adcValue`,
6. einen kompakten Status-/Fehlerbereich,
7. den Abschnitt `Vom virtuellen zum echten Labor`.

Die Temperatur darf über Range- und Number-Eingabe bedient werden. Beide
Eingaben bleiben synchron. Die Eingabe ist ein Umweltparameter und kein frei
parametriertes PWM- oder ADC-Ersatzbauteil.

## Command-Vertrag

Die UI importiert ausschließlich aus der Durchstich-Runtime:

- `COMMAND_TYPES`,
- `createPt1000ThroughputRuntime`,

und für den initialen Editorinhalt bei Bedarf `ADC_PROGRAM_START_CODE` aus
der bestehenden Virtual-MCU-Runtime.

Bedienaktionen verwenden ausschließlich:

- `SetTemperature`,
- `UpdateSourceFile`,
- `StartSimulation`,
- `ResetSimulation`.

Temperatur- oder Quellcodeänderungen leeren die sichtbaren Messwerte. Reset
stellt `0 °C`, Startcode, leere Messwerte und leeren Fehlerzustand wieder her.
Syntaxfehler zeigen mindestens Meldung sowie, soweit vorhanden, Zeile und
Spalte. Dynamische Inhalte werden mit `textContent` beziehungsweise
Form-Control-`value` gesetzt, nicht als HTML eingesetzt.

## Darstellung

- Zahlen werden deutsch lesbar und mit Einheit dargestellt.
- Noch nicht vorhandene Messwerte erscheinen als `—`.
- Bei `0 °C` zeigt der Ablauf nach dem Start mindestens:
  `1000,00 Ω`, `1,650 V` und ADC-Code `2048`.
- Das Schaltbild macht den Sense-Knoten und A0 sichtbar.
- Es wird klar benannt, dass dies ein generisches, idealisiertes Lernmodell und
  keine konkrete ESP32- oder Bauteilebibliothek ist.
- Der Realitätsübergang nennt PT1000, Festwiderstand, gemeinsame Masse,
  Versorgung/ADC-Referenz und die Prüfung zulässiger Eingangsspannungen.
- Dark- und Light-Theme sowie iPad-, Tablet- und Mobilbreite bleiben nutzbar.

## Öffentliche Modulroute

Der Browser muss die neue UI und ihre bestehenden `.mjs`-Abhängigkeiten
laden können. Die statische Route wird nur so weit erweitert, wie hierfür
nötig:

- `labs/<ein Dateiname>.js`
- `labs/<ein Dateiname>.mjs`
- je ein flacher `.mjs`-Dateiname unter
  `environment-models`, `learning-circuits`, `learning-solver`,
  `peripherals` und `virtual-mcu`.

Keine beliebigen Unterverzeichnisse, JSON-Dateien, Source Maps oder
Pfadsegmente mit Slash werden freigegeben. Die vorhandene `serveStatic`-
Funktion und das statische öffentliche Architekturmodell bleiben erhalten.
Der Identity-`serveStatic`-Pfad und der eigenständige Labor-Devserver liefern
`.mjs` mit `text/javascript; charset=utf-8` aus.

`index.html` erhält für `app.js` und `styles.css` gemeinsam den
Cache-Buster `20260816-pt1000-ui-1`.

## Tests

Der neue UI-Contract-Test prüft mindestens:

1. Runtime-Import statt duplizierter PT1000-/ADC-/Teilerformeln,
2. Lab-Metadaten und Registrierung nach dem GPIO-Lab,
3. Schaltbild, Temperatursteuerung, Editor, Start und Reset,
4. alle sieben Ergebnisfelder,
5. Command-Verwendung und Ausgabe über `textContent`,
6. Fehleranzeige mit Zeile und Spalte,
7. Realitätsübergang und Lernmodell-Hinweis,
8. responsive PT1000-spezifische Styles,
9. eng begrenzte Browser-Routen für die erforderlichen Module,
10. korrekten JavaScript-MIME-Type für `.mjs` in beiden statischen Servern,
11. kein Netzwerk, keine Persistenz, keine Wall-Clock und kein Zufall in der
    neuen UI-Datei.

Der öffentliche Identity-Integrationstest wird um Modul, Navigation,
Cache-Buster und Route ergänzt.

## Pflichtabnahme

```text
node --test modules/virtual-electronics-lab/test/labs/pt1000-adc-throughput-ui.test.mjs
node --test modules/virtual-electronics-lab/test/labs/pt1000-adc-throughput-runtime.test.mjs
node --test services/identity-server/test/public-virtual-electronics-lab.test.js
git diff --check
```

Keine Serverstarts, kein Commit, kein Push und kein Deployment. Graph,
zentrale Dokumentation und abschließende Gesamtabnahme übernimmt der
koordinierende Haupttask nach fachlicher Prüfung.
