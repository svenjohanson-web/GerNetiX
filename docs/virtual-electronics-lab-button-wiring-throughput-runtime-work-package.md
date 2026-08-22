# ELAB-SEQ-006: Kontaktverdrahtung im Tasterdurchstich

Stand: 2026-08-16  
Status: umgesetzt und getestet (2026-08-16)

Verbindlich gelten `AGENTS.md` und
`docs/codex-virtual-electronics-lab-implementation-procedure.md`.

## Ziel

Die bestehende Taster-Digitaleingangs-Runtime kann über einen typisierten
Command zwischen automatischer korrekter Verdrahtung, Kontakt nach GND und
Kontakt nach VCC wechseln und dadurch eine Betätigung ohne Pegeländerung bis
zum ausgeführten `digitalRead(4)` abbilden.

## Ausgangssituation

`ELAB-PAR-008` trennt im Tastermodell Pull-Widerstand und Kontaktreferenz. Die
Runtime aus `ELAB-SEQ-005` verwendet weiterhin nur den rückwärtskompatiblen
Automatikfall. Damit ist eine falsche Kontaktverdrahtung zwar im Kernmodell,
aber noch nicht im gemeinsamen Programmdurchstich darstellbar.

## Enthalten

- additive Erweiterung der vorhandenen Runtime um den Zustand
  `contactReferenceMode`,
- erlaubte Werte `auto`, `gnd` und `vcc`,
- neuer typisierter Command `SetContactReference`,
- Factory-Option `contactReferenceMode`,
- Weitergabe expliziter Kontaktreferenzen an `evaluateButtonContact`,
- resolved `contactReference` und gewählter `contactReferenceMode` im
  Messergebnis,
- Warnungsdurchleitung aus dem Tastermodell,
- Abbildung des Zustands im vorhandenen LabProject-Vorläufer,
- Reset auf die bisherige automatische korrekte Verdrahtung,
- gezielte Unit- und Regressionstests.

## Nicht enthalten

- sichtbare UI, Fehlersuchmodus oder Navigation,
- Aufgabenstellung, Hypothesen, Tipps, Lösung oder Bewertung,
- versteckte oder geschützte Fault-Scenario-Lösung,
- fehlender Pull-Widerstand oder schwebender Eingang,
- Tasterprellen, Zeitverlauf oder Zufall,
- Änderung von Tastermodell oder Digitaleingangs-Programmlaufzeit,
- neue Runtime-Datei oder zweite Parser-/Pegelwahrheit,
- Persistenz, Netzwerk, KI, Tarif oder Credits,
- Graph-, Architektur- oder zentrale Dokumentationsänderungen durch Spark.

## Architekturbezug

Die bestehende Command-Runtime aus `ELAB-SEQ-005` bleibt die einzige
Integrationswahrheit. Sie verwendet weiterhin direkt:

- `executeDigitalInputProgram` für den kontrollierten Quellcode,
- `evaluateButtonContact` für Taster und Verdrahtung.

Der neue Zustand ist ein versionierter Vorläufer des späteren
`LabProject.scenario.publicScenarioState`. Es wird noch keine eigenständige
Fault Scenario Engine eingeführt.

## Erlaubte Dateien

- `modules/virtual-electronics-lab/labs/button-digital-input-throughput-runtime.mjs`
- `modules/virtual-electronics-lab/test/labs/button-digital-input-throughput-runtime.test.mjs`

Alle anderen Dateien bleiben unverändert.

## Fachlicher Vertrag

### Zustandswerte

Die Runtime kennt ausschließlich:

- `auto`: Tastermodell wählt rückwärtskompatibel den Gegenpol des Pull-Modus,
- `gnd`: gedrückter Taster verbindet explizit mit GND,
- `vcc`: gedrückter Taster verbindet explizit mit VCC.

Der Default bleibt `auto`.

### Factory

```js
createButtonDigitalInputThroughputRuntime({
  pressed,
  sourceFile,
  contactReferenceMode = "auto"
})
```

Eine ungültige Factory-Option wird deterministisch auf `auto` normalisiert.
Das übergebene Optionsobjekt bleibt unverändert.

### Command

`COMMAND_TYPES` wird additiv ergänzt um:

```js
SetContactReference: "SetContactReference"
```

Der Command lautet:

```js
{
  type: COMMAND_TYPES.SetContactReference,
  contactReferenceMode: "auto" | "gnd" | "vcc"
}
```

Ungültige Werte liefern wie andere ungültige Commands den bestehenden Code
`BUTTON_DIGITAL_RUNTIME_COMMAND_INVALID`. Der Command verändert seinen Input
nicht. Eine erfolgreiche Änderung löscht Messung, Fehler und Fehlerherkunft.

### LabProject-Vorläufer

`labProject.button` enthält zusätzlich den gewählten
`contactReferenceMode`. Wegen der additiven Schemaänderung wird
`labProject.schemaVersion` von `1.0.0` auf `1.1.0` erhöht.

### Simulation

- Bei `auto` wird `contactReference` nicht explizit an das Tastermodell
  erzwungen; das bisherige Verhalten bleibt exakt erhalten.
- Bei `gnd` oder `vcc` wird der Wert explizit an das Tastermodell gegeben.
- Das Messergebnis enthält:
  - `contactReferenceMode`,
  - die vom Tastermodell tatsächlich verwendete `contactReference`,
  - alle bisherigen Felder unverändert.
- Warnungen des Tastermodells werden unverändert und dedupliziert in
  `measurement.warnings` und der Runtime-Antwort weitergegeben.

### Fehlverdrahtungs-Golden-Cases

Bei `INPUT_PULLUP`, Kontakt nach `vcc` und gedrücktem Taster:

- `logicLevel = HIGH`,
- `normalizedValue = 1`,
- `buttonState = 1`,
- Warnung `BUTTON_CONTACT_NO_LEVEL_CHANGE`.

Bei `INPUT_PULLDOWN`, Kontakt nach `gnd` und gedrücktem Taster:

- `logicLevel = LOW`,
- `normalizedValue = 0`,
- `buttonState = 0`,
- dieselbe Warnung.

Bei gelöstem Taster gibt es in beiden Fällen keine Warnung, da die
Fehlverdrahtung erst durch die Betätigung beobachtbar wird.

### Reset

`ResetSimulation` setzt zusätzlich `contactReferenceMode` auf `auto` zurück.

## Abnahmekriterien

1. Alle bisherigen Runtime-Aufrufe ohne neue Option bleiben funktional
   unverändert.
2. Default-Snapshot und LabProject zeigen `contactReferenceMode: auto`.
3. Der neue Command akzeptiert ausschließlich `auto`, `gnd` und `vcc`.
4. Der Command löscht vorherige Messungen und Fehler.
5. Beide Fehlverdrahtungs-Golden-Cases liefern den erwarteten stabilen Pegel
   und die Warnung aus `ELAB-PAR-008`.
6. Gelöste Fehlverdrahtungsfälle liefern keine Warnung.
7. Rückkehr zu korrekter Verdrahtung ändert den Pegel beim Drücken wieder.
8. Messergebnis nennt gewählten und tatsächlich verwendeten Anschluss.
9. Reset stellt `auto` wieder her.
10. Factory-Option, Commands und Snapshots bleiben unverändert beziehungsweise
    tief unveränderlich nach bestehendem Runtime-Vertrag.
11. Es gibt keine zweite Taster-, Pull-, Parser- oder Pegellogik.
12. Keine Netzwerk-, Speicher-, Wall-Clock- oder Zufallsnutzung.
13. Alle bisherigen Runtime- und Tastermodelltests bleiben erfolgreich.

## Tests

Spark führt mindestens aus:

```bash
/Users/sven/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node \
  --test \
  modules/virtual-electronics-lab/test/input-models/button-contact.test.mjs \
  modules/virtual-electronics-lab/test/labs/button-digital-input-throughput-runtime.test.mjs
```

Danach zusätzlich:

```bash
git diff --check
```

## Dokumentation und Graph

Spark verändert weder den SQLite-Graphen noch zentrale Dokumentation. Der
koordinierende Haupttask pflegt Requirement, Implementierungs- und
Testartefakt nach erfolgreicher Abnahme gesammelt in den Graphen ein.

## Arbeitsanweisung für Spark

> Implementiere ausschließlich `ELAB-SEQ-006` aus
> `docs/virtual-electronics-lab-button-wiring-throughput-runtime-work-package.md`.
> Lies zuerst `AGENTS.md`, `docs/codex-reminder-procedure.md`,
> `docs/codex-virtual-electronics-lab-implementation-procedure.md` und das
> vollständige Arbeitspaket. Ändere nur die beiden erlaubten Runtime- und
> Testdateien. Verwende weiterhin direkt die vorhandene Digitaleingangs-
> Programmlaufzeit und das vorhandene Tastermodell. Implementiere keine UI und
> keine zweite Parser-, Pull- oder Pegellogik. Führe beide benannten Tests und
> `git diff --check` aus. Committe, pushe und deploye nicht.
