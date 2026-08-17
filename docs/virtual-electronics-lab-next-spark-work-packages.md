# Naechste Spark-Arbeitspakete fuer das Elektroniklabor

Stand: 2026-08-16  
Status: umgesetzt und getestet (2026-08-16)

Die anschließende Planung für Fehlersuche, fehlenden Pull-Widerstand,
Tasterprellen, gemeinsame Modusmetadaten und KI-Vertrag steht in
[Plan: nächste Arbeitspakete für Fehlersuche und Taster](virtual-electronics-lab-fault-search-roadmap.md).

Diese Pakete folgen auf ELAB-DS-003. Sie schaffen kleine, getestete
Grundbausteine fuer die spaetere PT1000-ADC-Anwendung, ohne bereits eine neue
Laboroberflaeche oder einen erweiterten Quellcodeinterpreter zu bauen.

Verbindlich gelten `AGENTS.md` und
`docs/codex-virtual-electronics-lab-implementation-procedure.md`.

## Reihenfolge

1. `ELAB-PAR-003`: idealisierter ADC-Quantisierer
2. `ELAB-PAR-004`: idealisiertes Taster-Eingangsmodell
3. `ELAB-SEQ-004`: PT1000-Spannungsteiler bis zum ADC-Code

`ELAB-PAR-003` und `ELAB-PAR-004` sind fachlich unabhaengig. Wegen der bereits
beobachteten Spark-Kapazitaetsgrenze werden sie trotzdem nacheinander
gestartet. `ELAB-SEQ-004` beginnt erst, wenn `ELAB-PAR-003` abgenommen ist.

## ELAB-PAR-003: Idealisierter ADC-Quantisierer

Status: umgesetzt und getestet

### Ziel

Eine reine Funktion quantisiert eine Eingangsspannung mit einer angegebenen
Referenzspannung und Aufloesung in einen reproduzierbaren ADC-Code.

### Erlaubte Dateien

- `modules/virtual-electronics-lab/peripherals/adc-quantizer.mjs`
- `modules/virtual-electronics-lab/test/peripherals/adc-quantizer.test.mjs`

Andere Dateien bleiben unveraendert. Insbesondere keine UI-, Runtime-, Graph-,
Architektur- oder Identity-Aenderungen.

### Vertrag

Das Modul exportiert eine unveraenderliche Modelldeskription und:

```js
quantizeAdcSample({
  inputVoltageV,
  referenceVoltageV,
  resolutionBits
})
```

Regeln:

- alle Spannungen muessen endliche Zahlen sein,
- `referenceVoltageV` muss groesser als `0` und hoechstens `100` sein,
- `resolutionBits` muss eine ganze Zahl von `1` bis `24` sein,
- `maxCode = 2 ** resolutionBits - 1`,
- Eingangsspannungen werden auf `0 ... referenceVoltageV` begrenzt,
- `code = round(clampedVoltageV / referenceVoltageV * maxCode)`,
- `quantizedVoltageV = code / maxCode * referenceVoltageV`,
- Unter- und Ueberschreitung erzeugen stabile Warncodes,
- ungueltige Eingaben erzeugen stabile Fehlercodes und kein Teilergebnis.

Mindestens folgende Codes sind verbindlich:

- `ADC_INPUT_VOLTAGE_NUMBER_REQUIRED`
- `ADC_REFERENCE_VOLTAGE_INVALID`
- `ADC_RESOLUTION_BITS_INVALID`
- `ADC_INPUT_BELOW_RANGE`
- `ADC_INPUT_ABOVE_RANGE`

### Abnahme

- `0 V`, `1,65 V` und `3,3 V` ergeben bei 12 Bit und 3,3 V Referenz die Codes
  `0`, `2048` und `4095`.
- Werte ausserhalb des Messbereichs werden mit Warnung begrenzt.
- Wiederholte Aufrufe ergeben tiefengleiche Resultate.
- Exportierte Modellmetadaten sind von aussen nicht veraenderbar.
- Tests laufen mit Node `--test` und pruefen auch verbotene Seiteneffekte wie
  Netzwerk-, Speicher- oder Wall-Clock-Nutzung.

## ELAB-PAR-004: Idealisierter Taster als GPIO-Eingangsmodell

Status: umgesetzt und getestet

### Ziel

Eine reine Funktion bildet einen nicht prellenden Taster mit Pull-up- oder
Pull-down-Beschaltung auf einen digitalen Eingangspegel ab.

### Erlaubte Dateien

- `modules/virtual-electronics-lab/input-models/button-contact.mjs`
- `modules/virtual-electronics-lab/test/input-models/button-contact.test.mjs`

Andere Dateien bleiben unveraendert.

### Vertrag

```js
evaluateButtonContact({ pressed, pullMode })
```

Regeln:

- `pressed` ist ausschliesslich ein Boolean,
- `pullMode` ist ausschliesslich `pull-up` oder `pull-down`,
- Pull-up: offen = `HIGH`, gedrueckt = `LOW`,
- Pull-down: offen = `LOW`, gedrueckt = `HIGH`,
- das Ergebnis nennt `logicLevel`, `normalizedValue` (`0` oder `1`),
  Modellkennung, Modellversion und leere Warnungen,
- Fehlercodes: `BUTTON_PRESSED_BOOLEAN_REQUIRED` und
  `BUTTON_PULL_MODE_NOT_SUPPORTED`.

Nicht enthalten sind Prellen, Zeitverlauf, UI, GPIO-Runtime, Interrupts,
Schaltungssolver oder Quellcode.

### Abnahme

Alle vier Kombinationen aus Zustand und Pull-Modus sind getestet. Metadaten
sind unveraenderlich, Ergebnisse deterministisch und ohne Seiteneffekte.

## ELAB-SEQ-004: PT1000-Spannungsteiler bis zum ADC-Code

Status: umgesetzt und getestet

### Voraussetzung

Die vorhandenen Pakete PT1000, DC-Arbeitspunkt-Solver und `ELAB-PAR-003` sind
vollstaendig getestet.

### Ziel

Eine reine Integrationsfunktion bildet die erste vollstaendige Sensormesskette
ohne UI ab:

```text
Temperatur
-> PT1000-Widerstand
-> Spannungsteiler im DC-Solver
-> Sense-Spannung
-> ADC-Code
```

### Erlaubte Dateien

- `modules/virtual-electronics-lab/learning-circuits/pt1000-adc-divider.mjs`
- `modules/virtual-electronics-lab/test/learning-circuits/pt1000-adc-divider.test.mjs`

Bestehende PT1000-, Solver- und ADC-Dateien werden nur importiert, nicht
veraendert. Andere Dateien bleiben unveraendert.

### Feste Topologie

- ideale Spannungsquelle von `GND` nach `VCC`,
- Festwiderstand von `VCC` nach `SENSE`,
- PT1000 von `SENSE` nach `GND`,
- der ADC misst `SENSE` gegen `GND` mit der Versorgung als Referenz.

Einstiegspunkt:

```js
evaluatePt1000AdcDivider({
  temperatureC,
  supplyVoltageV = 3.3,
  fixedResistanceOhm = 1000,
  resolutionBits = 12
})
```

Das Ergebnis enthaelt mindestens Temperatur, Sensorwiderstand,
Sense-Spannung, Zweigstrom, ADC-Code, Modellversionen und Warnungen. Fehler der
drei Rechenkerne werden mit Herkunft weitergereicht und nicht in neue
Freitextfehler umgedeutet.

### Abnahme

- Bei `0 °C`, `3,3 V`, `1000 Ohm` und 12 Bit entstehen `1000 Ohm`, `1,65 V`
  und ADC-Code `2048`.
- Referenzwerte bei `-100 °C`, `100 °C` und `850 °C` werden gegen unabhaengig
  berechnete Golden Values getestet.
- Die Sense-Spannung steigt im getesteten Temperaturbereich monoton.
- Das Resultat ist deterministisch und nennt alle verwendeten Modellversionen.
- Keine UI, keine MCU-Runtime, keine Persistenz, kein Netzwerk und keine KI.

## Koordinationsregel

Spark bearbeitet immer nur das aktuell freigegebene Paket. Nach jedem Paket
werden Diff und Tests kontrolliert. Erst danach wird das naechste Paket an
Spark uebergeben. Graph und zentrale Dokumentation werden gesammelt durch den
koordinierenden Haupttask aktualisiert, damit parallele Pakete dieselben
Dateien nicht veraendern.
