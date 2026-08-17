# ELAB-PAR-007: Virtual-MCU-Digitaleingangs-Programmlaufzeit

Stand: 2026-08-16  
Status: umgesetzt und getestet (2026-08-16)

## Ziel

Ein kleiner kontrollierter Interpreter führt einen begrenzten
Mikrocontroller-Quellcode für einen digitalen Eingang aus:

```cpp
int buttonState = LOW;

void setup() {
  pinMode(4, INPUT_PULLUP);
}

void loop() {
  buttonState = digitalRead(4);
}
```

Die Laufzeit bildet keine konkrete ESP32-Firmware und keinen vollständigen
C++-Compiler ab. Sie ist ein deterministisches Lernmodell und führt niemals
Nutzerquellcode nativ aus.

## Erlaubte Dateien

- neu:
  `modules/virtual-electronics-lab/virtual-mcu/digital-input-program-runtime.mjs`
- neu:
  `modules/virtual-electronics-lab/test/virtual-mcu/digital-input-program-runtime.test.mjs`

Alle bestehenden Dateien bleiben unverändert. Graph, zentrale Dokumentation
und Integration übernimmt der koordinierende Haupttask.

## Exportierter Vertrag

Die Runtime exportiert:

- `DIGITAL_INPUT_PROGRAM_RUNTIME_MODEL`,
- `DIGITAL_INPUT_PROGRAM_START_CODE`,
- `executeDigitalInputProgram(options)`.

`DIGITAL_INPUT_PROGRAM_RUNTIME_MODEL` ist tief unveränderlich und enthält
mindestens Modell-ID, Version `1.0.0`, Architektur `interpreter`,
Eingangs-/Ausgangsgröße sowie die Grenzen dieses Lernmodells.

## Aufruf

```js
executeDigitalInputProgram({
  sourceFile,
  digitalInputs: {
    4: "HIGH",
  },
});
```

Unterstützt werden ausschließlich:

- Pin `4`,
- `INPUT_PULLUP` und `INPUT_PULLDOWN`,
- Logikpegel `HIGH` und `LOW`,
- globale Variable `int buttonState = LOW;`,
- genau ein `pinMode(...)` in `setup()`,
- genau ein `buttonState = digitalRead(4)` in `loop()`.

Kommentare und unkritische Leerraumvarianten dürfen den gültigen Ablauf nicht
verändern. Groß-/Kleinschreibung der Arduino-Schlüsselwörter bleibt wie im
Startcode verbindlich; es wird keine zweite C++-Syntax erfunden.

## Erfolgreiches Ergebnis

Bei Erfolg liefert die Runtime ein tief unveränderliches Ergebnis mit
mindestens:

- normalisiertem Quellcode-Hash,
- Pin `4`,
- konfiguriertem Pull-Modus,
- gelesenem Logikpegel,
- normiertem Wert `0` oder `1`,
- `variables.buttonState` als `0` oder `1`,
- Modell-ID und Modellversion,
- leerer Warnungsliste.

`HIGH` ergibt `buttonState = 1`, `LOW` ergibt `buttonState = 0`.
Wiederholte Aufrufe mit identischem Eingang sind vollständig deterministisch.

## Validierung und Fehler

Stabile Fehlercodes:

- `DIGITAL_INPUT_PROGRAM_SOURCE_REQUIRED`
- `DIGITAL_INPUT_PROGRAM_SOURCE_TOO_LARGE`
- `DIGITAL_INPUT_PROGRAM_STATEMENT_LIMIT_EXCEEDED`
- `DIGITAL_INPUT_PROGRAM_SYNTAX_ERROR`
- `DIGITAL_INPUT_PROGRAM_PIN_NOT_AVAILABLE`
- `DIGITAL_INPUT_PROGRAM_PIN_NOT_CONFIGURED_AS_INPUT`
- `DIGITAL_INPUT_PROGRAM_INPUT_REQUIRED`
- `DIGITAL_INPUT_PROGRAM_LEVEL_INVALID`

Syntax- und Programmfehler enthalten soweit bestimmbar Zeile, Spalte und
Position. Fehler liefern kein Teilergebnis. Die Fehlerherkunft des direkten
Interpreters ist stabil `digital-input-program-runtime`.

Grenzen:

- maximal 4096 Zeichen Quellcode,
- maximal 16 relevante Anweisungen,
- keine Schleifen, Bedingungen, Funktionen, Makros oder zusätzlichen
  Variablen,
- keine implizite Typumwandlung digitaler Eingänge.

## Sicherheits- und Qualitätsregeln

- Kein `eval`, `Function`, WebAssembly oder nativer Prozess.
- Kein Netzwerk, Dateisystem, Browser-Speicher oder Persistenz.
- Keine Wall-Clock-Zeit, Timer oder Zufallswerte.
- Keine Veränderung der Eingabeobjekte.
- Modellmetadaten, Ergebnis, Variablen und Warnungen sind tief unveränderlich.
- Der Quellcode-Hash wird lokal und deterministisch berechnet.

## Pflichtabnahme

Tests prüfen mindestens:

1. unveränderlichen Modellvertrag und gültigen Startcode,
2. `HIGH -> 1` und `LOW -> 0`,
3. beide Pull-Modi,
4. Leerraum und Kommentare,
5. fehlendes oder doppeltes `setup()`/`loop()`,
6. falschen Pin in `pinMode` und `digitalRead`,
7. fehlende Eingangskonfiguration,
8. fehlenden und ungültigen digitalen Eingangspegel,
9. Quellcode- und Anweisungslimit,
10. Syntaxfehler mit Position,
11. unveränderte Eingabeobjekte,
12. tiefe Unveränderlichkeit,
13. deterministische Wiederholung und Hash,
14. keine verbotenen Laufzeitkonstrukte.

Pflichtbefehle:

```text
node --test modules/virtual-electronics-lab/test/virtual-mcu/digital-input-program-runtime.test.mjs
node --test modules/virtual-electronics-lab/test/input-models/button-contact.test.mjs
git diff --check
```

Kein Serverstart, Commit, Push oder Deployment.
