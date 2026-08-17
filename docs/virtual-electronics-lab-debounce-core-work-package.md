# ELAB-FS-007: Deterministischer Entprellkern

Stand: 2026-08-17  
Status: umgesetzt und getestet (2026-08-17)

## Erlaubte Dateien

- neu: `modules/virtual-electronics-lab/input-models/digital-trace-debouncer.mjs`
- neu: `modules/virtual-electronics-lab/test/input-models/digital-trace-debouncer.test.mjs`

Keine anderen Änderungen.

## Vertrag

```js
debounceDigitalTrace({ trace, stableWindowUs })
```

- `trace` enthält 1 bis 501 Samples mit streng steigender ganzzahliger
  `timeUs` von `0` bis `1_000_000` und `logicLevel` als `LOW` oder `HIGH`.
- `stableWindowUs` ist ganzzahlig von `50` bis `100_000`.
- Der erste Rohpegel ist zugleich der anfängliche entprellte Pegel.
- Weicht der Rohpegel ab, beginnt ein Kandidat. Erst das erste Sample, an dem
  derselbe Kandidat mindestens `stableWindowUs` lang anliegt, übernimmt den
  neuen entprellten Pegel.
- Rückkehr zum bisherigen Pegel verwirft den Kandidaten.
- Ein Wechsel auf den jeweils anderen Kandidaten startet dessen Zeitfenster
  neu.

Jedes Ergebnissample enthält `timeUs`, `rawLogicLevel`,
`debouncedLogicLevel`, `debouncedNormalizedValue` und `changed`. Das Ergebnis
nennt Schema-, Modellversion, Einheit, Zeitfenster und Warnung
`DIGITAL_TRACE_DEBOUNCE_IDEALIZED`.

## Qualitätsgrenzen

- stabile Fehlercodes und kein Teilergebnis,
- tiefe Unveränderlichkeit und unveränderte Eingaben,
- deterministisch,
- kein DOM, Netzwerk, Speicher, Timer, Wall-Clock oder Zufall.

## Pflichtfälle

- konstante LOW- und HIGH-Spur,
- Prellspur aus FS-004 mit `300 µs` Fenster,
- kurzer Puls unterhalb des Fensters wird unterdrückt,
- stabiler Wechsel wird exakt am ersten zulässigen Sample übernommen,
- ungültige Reihenfolge, Pegel, Samplezahl und Zeitfenster werden abgewiesen.

Kein Commit, Push oder Deployment.
