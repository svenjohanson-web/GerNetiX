# ELAB-FS-008: Kontrollierte Virtual-MCU-Entprellung

Stand: 2026-08-17  
Status: umgesetzt und getestet (2026-08-17)

## Erlaubte Dateien

- neu: `modules/virtual-electronics-lab/virtual-mcu/button-debounce-program-runtime.mjs`
- neu: `modules/virtual-electronics-lab/test/virtual-mcu/button-debounce-program-runtime.test.mjs`

Keine anderen Änderungen.

## Exportierter Startcode

```cpp
const unsigned long debounceUs = 700;
int buttonState = HIGH;
int lastRawState = HIGH;
unsigned long changedAtUs = 0;

void setup() {
  pinMode(4, INPUT_PULLUP);
}

void loop() {
  int rawState = digitalRead(4);
  if (rawState != lastRawState) {
    changedAtUs = micros();
    lastRawState = rawState;
  }
  if (micros() - changedAtUs >= debounceUs) {
    buttonState = rawState;
  }
}
```

## Vertrag

```js
executeButtonDebounceProgram({ sourceFile, measurementTrace })
```

- kontrollierter, nicht nativer Sprachvertrag,
- `sourceFile` maximal 12.000 Zeichen,
- genau die gezeigte Programmstruktur; Kommentare und Whitespace dürfen
  variieren,
- `debounceUs` darf als einzige fachliche Konstante ganzzahlig von `50` bis
  `100_000` verändert werden,
- Pin `4`, `INPUT_PULLUP`, `digitalRead(4)`, `micros()` und die Zustandsvariablen
  sind verpflichtend,
- `measurementTrace` wird unverändert an den FS-007-Entprellkern übergeben,
- keine native Ausführung und kein allgemeiner C++-Interpreter.

Das Ergebnis enthält Quellhash, `debounceUs`, Roh- und entprellte Trace,
finalen `buttonState`, Modellversionen sowie deduplizierte Warnungen.

## Qualitätsgrenzen

- direkte Wiederverwendung von `debounceDigitalTrace`,
- stabile Syntax-/Pin-/Bereichsfehler mit Zeile und Spalte,
- kein Teilergebnis,
- tiefe Unveränderlichkeit und unveränderte Eingaben,
- deterministisch,
- kein DOM, Netzwerk, Speicher, Timer, Wall-Clock, `eval` oder Zufall.

## Pflichtfälle

- Startcode mit FS-004-Druckspur,
- `300`, `700` und `2.000 µs`,
- Kommentare und CRLF,
- fehlende oder veränderte Pflichtanweisungen,
- falscher Pin oder Pull-Modus,
- Grenzwerte, Quelllänge, Determinismus und Immutabilität.

Kein Commit, Push oder Deployment.
