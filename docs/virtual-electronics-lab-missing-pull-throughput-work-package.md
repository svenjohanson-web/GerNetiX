# ELAB-FS-002: Fehlender Pull bis `digitalRead(4)`

Stand: 2026-08-16  
Status: umgesetzt und getestet (2026-08-17)

## Ziel

Ein gelöster Taster an `pinMode(4, INPUT)` liefert eine feste idealisierte
Floating-Folge bis zur Programmvariable `buttonState`. Ein gedrückter Kontakt
liefert weiterhin den eindeutig verdrahteten Pegel.

## Erlaubte Dateien

- neu: `modules/virtual-electronics-lab/input-models/floating-digital-input.mjs`
- neu: `modules/virtual-electronics-lab/test/input-models/floating-digital-input.test.mjs`
- ändern: `modules/virtual-electronics-lab/virtual-mcu/digital-input-program-runtime.mjs`
- ändern: `modules/virtual-electronics-lab/test/virtual-mcu/digital-input-program-runtime.test.mjs`
- ändern: `modules/virtual-electronics-lab/labs/button-digital-input-throughput-runtime.mjs`
- ändern: `modules/virtual-electronics-lab/test/labs/button-digital-input-throughput-runtime.test.mjs`

Keine anderen Dateien ändern. Keine UI, Dokumentation, Graphänderung,
Persistenz, Netzwerk- oder Serverfunktion.

## Floating-Modell

Exportiere eine tief unveränderliche Modelldeskription und:

```js
evaluateFloatingDigitalInput({ sampleIndex })
```

Regeln:

- `sampleIndex` ist eine ganze Zahl von `0` bis `63`.
- Die Folge ist fest: `LOW, HIGH, HIGH, LOW`; Auswahl per Modulo.
- Erfolg liefert Logikpegel, normierten Wert, Sampleindex, Modellkennung,
  Modellversion und genau die Warnung `DIGITAL_INPUT_FLOATING_IDEALIZED`.
- Die Warnung erklärt, dass dies ein Lernmuster und keine Vorhersage einer
  realen Leiterplatte ist.
- Ungültige Optionen oder Indizes liefern stabile Fehlercodes und kein
  Teilergebnis.
- Eingaben bleiben unverändert; alle Rückgaben sind tief eingefroren.
- Kein Zufall, keine Zeit, kein Netzwerk und keine Persistenz.

## Virtual MCU

- `pinMode(4, INPUT)` wird zusätzlich akzeptiert.
- `supportedPinModes` und Modellversion werden passend erweitert.
- Der Pegel kommt weiterhin ausschließlich aus `digitalInputs[4]`.
- Der Interpreter ruft das Floating-Modell nicht selbst auf.
- `INPUT_PULLUP` und `INPUT_PULLDOWN` bleiben vollständig kompatibel.
- Syntax-, Pin-, Eingabe-, Limit- und Sicherheitsverträge bleiben erhalten.

## Taster-Runtime

- Importiert das neue Floating-Modell direkt.
- Neuer Zustand `floatingSampleIndex`, initial `0`.
- Neuer Command `AdvanceFloatingSample` erhöht den Index zyklisch innerhalb
  `0...63` und löscht Messung sowie Fehler.
- Reset setzt den Index auf `0`.
- Bei `INPUT` und gelöstem Taster stammt der Pegel ausschließlich aus dem
  Floating-Modell.
- Bei `INPUT` und gedrücktem Taster stammt der Pegel aus der sichtbaren
  Kontaktreferenz: `gnd -> LOW`, `vcc -> HIGH`; `auto` verwendet für diesen
  vorhandenen Lernaufbau `gnd`.
- Bestehende Pull-up-/Pull-down-Fälle verwenden unverändert das vorhandene
  Tastermodell.
- Messung, Snapshot und LabProject enthalten den Sampleindex; die Messung
  führt die Floating-Warnung und Modellversion durch.
- Wiederholungen mit gleichem Zustand sind deterministisch.

## Abnahme

- Die ersten vier offenen Samples ergeben `LOW/0`, `HIGH/1`, `HIGH/1`,
  `LOW/0` bis `buttonState`.
- Gedrückt mit GND ergibt unabhängig vom Sample `LOW/0` ohne Floating-Warnung.
- Gedrückt mit VCC ergibt `HIGH/1` ohne Floating-Warnung.
- Wechsel zurück zu `INPUT_PULLUP` verhält sich wie bisher.
- Advance und Reset sind command-basiert, defensiv und getestet.
- Alle sechs Ziel-Dateien bestehen ihre Unit-/Contract-Tests.

## Pflichtprüfungen

```text
node --test modules/virtual-electronics-lab/test/input-models/floating-digital-input.test.mjs
node --test modules/virtual-electronics-lab/test/virtual-mcu/digital-input-program-runtime.test.mjs
node --test modules/virtual-electronics-lab/test/labs/button-digital-input-throughput-runtime.test.mjs
node --test modules/virtual-electronics-lab/test/input-models/button-contact.test.mjs
git diff --check
```

Kein Commit, Push oder Deployment.
