# ELAB-FS-004: Tasterprellen und Messspur

Stand: 2026-08-16  
Status: umgesetzt und getestet (2026-08-17)

## Ziel

Ein deterministisches Lehrmodell erzeugt aus virtueller Zeit einen prellenden
Kontakt. Eine zweite reine Funktion tastet ihn als digitale Messspur ab.

## Erlaubte Dateien

- neu: `modules/virtual-electronics-lab/input-models/button-bounce.mjs`
- neu: `modules/virtual-electronics-lab/test/input-models/button-bounce.test.mjs`
- neu: `modules/virtual-electronics-lab/labs/button-bounce-trace.mjs`
- neu: `modules/virtual-electronics-lab/test/labs/button-bounce-trace.test.mjs`

Keine anderen Änderungen.

## Prellmodell

```js
evaluateButtonBounce({ targetPressed, elapsedUs, profile: "teaching-default" })
```

- `targetPressed` ist Boolean.
- `elapsedUs` ist ganzzahlig von `0` bis `1_000_000`.
- einziges Profil: `teaching-default`.
- Zustand relativ zum Ziel:
  - `0...149 us`: Ausgangszustand,
  - `150...349 us`: Zielzustand,
  - `350...699 us`: Ausgangszustand,
  - `700...1199 us`: Zielzustand,
  - `1200...1799 us`: Ausgangszustand,
  - ab `1800 us`: stabiler Zielzustand.
- Ergebnis enthält `pressed`, `stable`, Zeit, Profil und Modellversion.
- Jedes Ergebnis weist mit `BUTTON_BOUNCE_IDEALIZED` auf die Modellgrenze hin.

## Messspur

```js
createButtonBounceTrace({
  targetPressed,
  pullMode,
  contactReference,
  sampleIntervalUs,
  durationUs,
  profile: "teaching-default"
})
```

- verwendet direkt Prellmodell und bestehendes Tastermodell,
- `pullMode`: `pull-up` oder `pull-down`,
- `contactReference` optional `gnd` oder `vcc`,
- Intervall ganzzahlig `10...100_000 us`,
- Dauer ganzzahlig `0...1_000_000 us`,
- höchstens `501` Samples,
- Samples einschließlich `0` und, wenn rastergleich, Endzeit,
- jedes Sample enthält `timeUs`, `pressed`, `logicLevel` und normierten Wert,
- Ausgabe enthält `schemaVersion: "1.0.0"`, Einheiten, Modellversionen und
  deduplizierte Warnungen.

## Qualitätsregeln

- tiefe Unveränderlichkeit,
- stabile Fehlercodes ohne Teilergebnis,
- unveränderte Eingaben,
- deterministisch,
- keine Wall-Clock, Timer, Zufallswerte, DOM, Netzwerk oder Persistenz.

## Pflichtprüfungen

```text
node --test modules/virtual-electronics-lab/test/input-models/button-bounce.test.mjs
node --test modules/virtual-electronics-lab/test/labs/button-bounce-trace.test.mjs
node --test modules/virtual-electronics-lab/test/input-models/button-contact.test.mjs
git diff --check
```

Kein Commit, Push oder Deployment.
