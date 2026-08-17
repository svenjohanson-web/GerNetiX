# ELAB-PAR-006: PT1000-Programmdurchstich-Runtime

Stand: 2026-08-16  
Status: umgesetzt und getestet (2026-08-16)

## Ziel

Eine reine Command-Runtime verbindet die vorhandene PT1000-Messkette mit der
kontrollierten Virtual-MCU-ADC-Programmlaufzeit:

```text
SetTemperature
-> PT1000 + Spannungsteiler
-> Sense-Spannung an A0
-> Virtual-MCU-Quellcode mit analogRead(A0)
-> adcValue
```

Keine UI und keine neue Rechenformel werden eingeführt.

## Erlaubte Dateien

- `modules/virtual-electronics-lab/labs/pt1000-adc-throughput-runtime.mjs`
- `modules/virtual-electronics-lab/test/labs/pt1000-adc-throughput-runtime.test.mjs`

Alle bestehenden Dateien bleiben unverändert.

## Verbindliche Abhängigkeiten

Die Runtime importiert unverändert:

- `evaluatePt1000AdcDivider`,
- `executeAdcProgram`,
- `ADC_PROGRAM_START_CODE`.

Die vom Programmdurchstich angezeigte ADC-Wahrheit stammt aus
`executeAdcProgram`. Der ADC-Code aus der bestehenden Messkette muss damit
übereinstimmen; bei einer Abweichung wird kontrolliert
`ADC_MEASUREMENT_CHAIN_INCONSISTENT` gemeldet.

## Commands

```text
UpdateSourceFile
SetTemperature
StartSimulation
ResetSimulation
```

Defaultzustand:

- Temperatur `0 °C`,
- Versorgung und ADC-Referenz `3,3 V`,
- Festwiderstand `1000 Ω`,
- Auflösung 12 Bit,
- `ADC_PROGRAM_START_CODE`,
- noch kein Messergebnis.

`UpdateSourceFile` und `SetTemperature` löschen vorhandene Messung und Fehler.
`ResetSimulation` stellt Temperatur, Startcode und leeren Ergebniszustand
wieder her.

`SetTemperature` akzeptiert ausschließlich endliche Zahlen im bestehenden
PT1000-Modellbereich. PT1000-Fehler werden unverändert mit
`errorSource: "pt1000"` weitergereicht.

## Snapshot

`getSnapshot()` liefert eine defensive, tief unveränderliche Kopie mit:

- `sourceFile`,
- `temperatureC`,
- `measurement`,
- `error`,
- `errorSource`,
- versioniertem `labProject`-Vorläufer.

Der `labProject` enthält mindestens:

- `schemaVersion`,
- Metadaten des PT1000-ADC-Durchstichs,
- Umgebungstemperatur,
- feste Schaltungsparameter,
- Controller-Quellcode,
- Modellversionen.

Zustandsänderungen sind nur über Commands möglich.

## Erfolgreiche Messung

Das Ergebnis enthält mindestens:

- Temperatur,
- PT1000-Widerstand,
- Sense-Spannung,
- Teilerstrom,
- ADC-Code aus der Programmlaufzeit,
- quantisierte Spannung,
- Variable `adcValue`,
- Quellcode-Hash,
- alle beteiligten Modellversionen,
- Warnungen.

Bei `0 °C` entstehen `1000 Ω`, `1,65 V` und ADC-Code `2048`.

## Fehler und Grenzen

- Commandfehler: `PT1000_RUNTIME_COMMAND_INVALID` und
  `PT1000_RUNTIME_COMMAND_NOT_SUPPORTED`.
- Fehler aus PT1000, DC-Solver, ADC-Messkette und ADC-Programmlaufzeit werden
  mit ursprünglichem Code und stabiler Herkunft weitergereicht.
- Keine native Codeausführung, kein Netzwerk, keine Persistenz, keine
  Wall-Clock-Zeit und kein Zufall.

## Pflichtabnahme

Tests prüfen mindestens:

1. Defaultzustand und vollständigen `labProject`-Vorläufer,
2. 0-°C-Golden-Case,
3. monotone Messwerte bei `-100`, `0`, `100` und `850 °C`,
4. Temperaturänderung und Quellcodeänderung über Commands,
5. Syntaxfehler im ADC-Programm samt Fehlerherkunft,
6. Reset von Temperatur, Quellcode, Messung und Fehler,
7. deterministische Wiederholung,
8. defensive und tiefe Snapshot-Unveränderlichkeit,
9. unbekannte oder ungültige Commands,
10. keine verbotenen Seiteneffekte.

Pflichtbefehle:

```text
node --test modules/virtual-electronics-lab/test/labs/pt1000-adc-throughput-runtime.test.mjs
node --test modules/virtual-electronics-lab/test/learning-circuits/pt1000-adc-divider.test.mjs
node --test modules/virtual-electronics-lab/test/virtual-mcu/adc-program-runtime.test.mjs
git diff --check
```

Kein Commit, Push oder Deployment.
