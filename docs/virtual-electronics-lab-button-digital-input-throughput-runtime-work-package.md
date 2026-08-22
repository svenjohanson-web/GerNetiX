# ELAB-SEQ-005: Taster-zu-Digitaleingang-Programmdurchstich

Stand: 2026-08-16  
Status: umgesetzt und getestet (2026-08-16)

## Ziel

Eine kleine Command-Runtime verbindet erstmals die beiden bereits getesteten
Bausteine:

1. idealisiertes Tastermodell,
2. kontrollierte Virtual-MCU-Digitaleingangs-Programmlaufzeit.

Der virtuelle Mikrocontroller bestimmt durch seinen Quellcode den Pull-Modus.
Der Taster erzeugt daraus abhängig von `pressed` den elektrischen Logikpegel,
den `digitalRead(4)` anschließend in `buttonState` einliest. Es gibt noch keine
sichtbare UI und bewusst kein Tasterprellen.

## Erlaubte Dateien

- neu:
  `modules/virtual-electronics-lab/labs/button-digital-input-throughput-runtime.mjs`
- neu:
  `modules/virtual-electronics-lab/test/labs/button-digital-input-throughput-runtime.test.mjs`

Alle bestehenden Dateien bleiben unverändert. Graph, zentrale Dokumentation
und Integration übernimmt der koordinierende Haupttask.

## Verbindliche Wiederverwendung

Die Runtime importiert und verwendet direkt:

- `evaluateButtonContact` und `BUTTON_CONTACT_MODEL` aus
  `../input-models/button-contact.mjs`,
- `executeDigitalInputProgram`, `DIGITAL_INPUT_PROGRAM_START_CODE` und
  `DIGITAL_INPUT_PROGRAM_RUNTIME_MODEL` aus
  `../virtual-mcu/digital-input-program-runtime.mjs`.

Die Tasterlogik, Pull-up-/Pull-down-Zuordnung, Quellcodeanalyse und
`digitalRead`-Auswertung dürfen nicht kopiert oder als zweite Wahrheit neu
implementiert werden.

## Exportierter Vertrag

Die Datei exportiert mindestens:

- ein tief unveränderliches `COMMAND_TYPES` mit
  `SetButtonPressed`, `UpdateSourceFile`, `StartSimulation` und
  `ResetSimulation`,
- `createButtonDigitalInputThroughputRuntime(options = {})`.

Optionale Startwerte:

```js
{
  pressed: false,
  sourceFile: DIGITAL_INPUT_PROGRAM_START_CODE,
}
```

Die Factory liefert:

- `dispatch(command)`,
- `getSnapshot()`.

## Command-Vertrag

```js
runtime.dispatch({ type: COMMAND_TYPES.SetButtonPressed, pressed: true });
runtime.dispatch({ type: COMMAND_TYPES.UpdateSourceFile, sourceFile });
runtime.dispatch({ type: COMMAND_TYPES.StartSimulation });
runtime.dispatch({ type: COMMAND_TYPES.ResetSimulation });
```

`SetButtonPressed` akzeptiert nur echte Boolean-Werte. Änderungen an Taster
oder Quellcode löschen ein altes Messergebnis und einen alten Laufzeitfehler.
`StartSimulation` berechnet den gesamten Durchstich. `ResetSimulation` setzt
auf `pressed: false`, den verbindlichen Startcode, kein Messergebnis und keinen
Fehler zurück.

Stabile Command-Fehlercodes:

- `BUTTON_DIGITAL_RUNTIME_COMMAND_INVALID`
- `BUTTON_DIGITAL_RUNTIME_COMMAND_NOT_SUPPORTED`

Ein unerwarteter Widerspruch zwischen den beiden Kernmodellen liefert:

- `BUTTON_DIGITAL_CHAIN_INCONSISTENT`

Fehler des Digitaleingangs-Interpreters werden mit unverändertem Fehlercode
und `errorSource: "digital-input-program-runtime"` weitergereicht. Die Runtime
erfindet keine Übersetzung dieser Fehler.

## Berechnungsablauf ohne zweite Parser-Wahrheit

Die Runtime darf den Pull-Modus nicht selbst mit regulären Ausdrücken aus dem
Quellcode lesen. Stattdessen wird der vorhandene Interpreter zunächst mit
einem zulässigen provisorischen Pegel ausgeführt, um den validierten
`pullMode` zu erhalten. Danach gilt:

- `INPUT_PULLUP` wird als `pull-up` an das Tastermodell übergeben,
- `INPUT_PULLDOWN` wird als `pull-down` an das Tastermodell übergeben,
- dessen `logicLevel` wird als tatsächlicher Pegel erneut an
  `executeDigitalInputProgram` übergeben.

Nur diese kleine, explizite Adapterzuordnung ist in der Durchstich-Runtime
zulässig. Quellcodeparser und elektrische Tasterlogik bleiben in den
bestehenden Modulen.

## Snapshot und Ergebnis

`getSnapshot()` liefert eine defensive, tief unveränderliche Kopie mit
mindestens:

- `pressed`,
- `sourceFile`,
- `measurement` oder `null`,
- `error` oder `null`,
- `errorSource` oder `null`,
- einem `labProject`-Vorläufer.

Der `labProject`-Vorläufer enthält mindestens:

- `schemaVersion: "1.0.0"`,
- stabile Metadaten mit ID
  `elab-seq-005-button-digital-input-throughput`,
- Tasterzustand und Pin `4`,
- Controller-Quellcode,
- Modellversionen von Taster und Digitaleingangs-Programmlaufzeit.

Ein erfolgreiches `measurement` enthält mindestens:

- `pressed`,
- Arduino-Pull-Modus `INPUT_PULLUP` oder `INPUT_PULLDOWN`,
- Tastermodell-Pull-Modus `pull-up` oder `pull-down`,
- `logicLevel` als `HIGH` oder `LOW`,
- `normalizedValue` als `0` oder `1`,
- `buttonState` als `0` oder `1`,
- Pin `4`,
- Quellcode-Hash,
- beide Modellversionen,
- deduplizierte Warnungen.

Golden Cases:

| Quellcode-Pull | pressed | Pegel | buttonState |
| --- | ---: | --- | ---: |
| `INPUT_PULLUP` | `false` | `HIGH` | `1` |
| `INPUT_PULLUP` | `true` | `LOW` | `0` |
| `INPUT_PULLDOWN` | `false` | `LOW` | `0` |
| `INPUT_PULLDOWN` | `true` | `HIGH` | `1` |

## Sicherheits- und Qualitätsregeln

- Kein `eval`, `Function`, WebAssembly oder nativer Prozess.
- Kein Netzwerk, Dateisystem, Browser-Speicher oder Persistenz.
- Keine Wall-Clock-Zeit, Timer oder Zufallswerte.
- Keine Veränderung von Commands, Optionen oder Resultaten der Kernmodelle.
- Snapshots, LabProject, Messergebnis, Modellversionen und Warnungen sind tief
  unveränderlich.
- Identische Befehlsfolgen liefern identische Snapshots.

## Pflichtabnahme

Tests prüfen mindestens:

1. Defaultzustand und vollständigen LabProject-Vorläufer,
2. alle vier Golden Cases,
3. Tasteränderung ausschließlich über Command,
4. Quellcodeänderung von Pull-up auf Pull-down,
5. unveränderte Weitergabe eines Interpreter-Syntaxfehlers,
6. ungültige und unbekannte Commands,
7. Reset von Taster, Quellcode, Ergebnis und Fehler,
8. defensive, tief unveränderliche Snapshots,
9. unveränderte Eingabeobjekte und Commands,
10. deterministische Wiederholung,
11. direkte Imports statt kopierter Modelllogik,
12. keine verbotenen Laufzeitkonstrukte.

Pflichtbefehle:

```text
node --test modules/virtual-electronics-lab/test/labs/button-digital-input-throughput-runtime.test.mjs
node --test modules/virtual-electronics-lab/test/input-models/button-contact.test.mjs
node --test modules/virtual-electronics-lab/test/virtual-mcu/digital-input-program-runtime.test.mjs
git diff --check
```

Kein Serverstart, Commit, Push oder Deployment.
