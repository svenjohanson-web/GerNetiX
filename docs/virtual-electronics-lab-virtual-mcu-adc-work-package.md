# ELAB-PAR-005: Kontrollierte Virtual-MCU-ADC-Programmlaufzeit

Stand: 2026-08-16  
Status: umgesetzt und getestet (2026-08-16)

## Ziel

Ein kleiner, kontrollierter Quellcodevertrag liest eine vorgegebene analoge
Spannung über den bestehenden ADC-Quantisierer ein. Damit entsteht die noch
fehlende Brücke zwischen Sensormesskette und späterem Quellcode-Editor:

```text
analoge Eingangsspannung an A0
-> kontrolliertes Virtual-MCU-Programm
-> analogRead(A0)
-> bestehender ADC-Quantisierer
-> Variable adcValue
```

Das Paket implementiert keine UI und verbindet die Laufzeit noch nicht mit
der PT1000-Messkette.

## Erlaubte Dateien

- `modules/virtual-electronics-lab/virtual-mcu/adc-program-runtime.mjs`
- `modules/virtual-electronics-lab/test/virtual-mcu/adc-program-runtime.test.mjs`

Andere Dateien bleiben unverändert. Insbesondere werden bestehender
ADC-Quantisierer, PT1000-Modell, DC-Solver, Durchstich-Runtime, UI,
Dokumentation und SQLite-Graph nicht verändert.

## Öffentlicher Vertrag

Das Modul exportiert:

```js
ADC_PROGRAM_RUNTIME_MODEL
ADC_PROGRAM_START_CODE
parseAdcProgram(sourceFile)
executeAdcProgram({
  sourceFile,
  analogInputs,
  referenceVoltageV = 3.3,
  resolutionBits = 12
})
```

Verbindlicher Startcode:

```cpp
int adcValue = 0;

void setup() {
  pinMode(A0, INPUT);
}

void loop() {
  adcValue = analogRead(A0);
}
```

## Kontrollierte Sprache

Unterstützt wird ausschließlich:

- genau eine globale Deklaration `int adcValue = 0;`,
- genau eine Funktion `setup()` vor `loop()`,
- `pinMode(A0, INPUT);` in `setup()`,
- `adcValue = analogRead(A0);` in `loop()`,
- Leerraum sowie geschlossene Zeilen- und Blockkommentare.

Nicht unterstützt werden andere Variablen, Pins, Modi, Funktionen,
Kontrollstrukturen, Ausdrücke oder Bibliotheken. Nutzertext wird nie mit
`eval`, `new Function`, WebAssembly oder nativer Codeausführung gestartet.

Grenzen:

- höchstens 4096 Zeichen,
- höchstens 16 Anweisungen,
- ausschließlich der virtuelle Analogeingang `A0`,
- `analogInputs` muss einen endlichen Zahlenwert für `A0` enthalten.

## Ausführungsregeln

- `pinMode(A0, INPUT)` muss vor `analogRead(A0)` ausgeführt werden.
- Der Laufzeitadapter ruft ausschließlich `quantizeAdcSample()` aus dem
  bestehenden ADC-Modul auf; er implementiert keine zweite Quantisierung.
- Referenzspannung, Auflösung, Bereichsbegrenzung und Warnungen bleiben damit
  durch den bestehenden ADC-Vertrag bestimmt.
- Die Ausführung ist synchron, rein und ohne Wall-Clock-Zeit.
- Wiederholte Ausführung gleicher Eingaben ergibt tiefengleiche Resultate.

Erfolgreiches Ergebnis:

```js
{
  ok: true,
  result: {
    sourceHash,
    pinModes: { A0: "INPUT" },
    variables: { adcValue: 2048 },
    adc: {
      pin: "A0",
      inputVoltageV: 1.65,
      referenceVoltageV: 3.3,
      resolutionBits: 12,
      code: 2048,
      quantizedVoltageV: Number
    },
    modelVersions: {
      runtime: "1.0.0",
      adcQuantizer: "1.0.0"
    }
  },
  warnings: []
}
```

## Fehlercodes

Mindestens:

- `ADC_PROGRAM_SOURCE_TOO_LARGE`
- `ADC_PROGRAM_SYNTAX_ERROR`
- `ADC_PROGRAM_STATEMENT_LIMIT_EXCEEDED`
- `ADC_PROGRAM_PIN_NOT_AVAILABLE`
- `ADC_PROGRAM_PIN_NOT_CONFIGURED_AS_INPUT`
- `ADC_PROGRAM_ANALOG_INPUT_REQUIRED`

Fehler des ADC-Quantisierers werden unverändert weitergereicht und erhalten
am Top-Level `errorSource: "adc-quantizer"`. Parser- und Laufzeitfehler tragen
`errorSource: "adc-program-runtime"`.

## Abnahmekriterien

1. Der Startcode wird erfolgreich geparst.
2. `A0 = 1,65 V`, `3,3 V` Referenz und 12 Bit ergeben `adcValue = 2048`.
3. `A0 = 0 V` und `A0 = 3,3 V` ergeben `0` und `4095`.
4. Unter- und Überspannung übernehmen die ADC-Warncodes.
5. Fehlendes `pinMode`, falscher Pin, fehlender Eingang und offene Kommentare
   erzeugen die stabilen Fehlercodes.
6. Ungültige Referenzspannung und Auflösung behalten ADC-Fehlercode und
   Fehlerherkunft.
7. Quellgrenze und Anweisungsgrenze sind getestet.
8. Ergebnisse und Modellmetadaten sind unveränderlich und deterministisch.
9. Der Quelltext enthält keine verbotene Ausführungs-, Netzwerk-, Speicher-,
   Zufalls- oder Wall-Clock-Abhängigkeit.

## Pflichtnachweis

```text
node --test modules/virtual-electronics-lab/test/virtual-mcu/adc-program-runtime.test.mjs
node --test modules/virtual-electronics-lab/test/peripherals/adc-quantizer.test.mjs
git diff --check
```

Kein Commit, Push oder Deployment.
