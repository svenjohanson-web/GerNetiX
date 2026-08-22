# Elektroniklabor: nächste Arbeitspakete

Stand: 2026-08-17  
Status: FS-001 bis FS-012 lokal umgesetzt und getestet; Live-Provider-Nachweis ausstehend

Ziel ist eine sichtbare Fehlersuche mit Taster, fehlendem Pull-Widerstand und
Tasterprellen. Die Planung bündelt zusammengehörige Änderungen, damit Spark
nur dort eingesetzt wird, wo die Übergabe tatsächlich Arbeit spart.

## Reihenfolge

```text
ELAB-FS-001
    |
ELAB-FS-002 (Spark)
    |
ELAB-FS-003
    |
ELAB-FS-004 (Spark)
    |
ELAB-FS-005
    |
ELAB-FS-006
    |
ELAB-FS-007 (Spark)
    |
ELAB-FS-008 (Spark)
    |
ELAB-FS-009
    |
ELAB-FS-010
    |
ELAB-FS-011
    |
ELAB-FS-012
```

## ELAB-FS-001: Fehlverdrahteten Taster sichtbar reparieren

**Bearbeitung:** GPT-5.6  
**Status:** umgesetzt und getestet (2026-08-16)  
**Grund:** UI, Lernablauf und bestehende Runtime müssen gemeinsam beurteilt
werden.

Das vorhandene Tasterlabor erhält den Modus `Fehlersuche`. Der Taster ist
zunächst falsch nach VCC verdrahtet. Der Nutzer beobachtet den unveränderten
Pegel, verdrahtet nach GND und bestätigt die Reparatur durch eine neue Messung.

Scope:

- bestehende Laborfläche, kein neues Labor,
- tatsächliche Verdrahtung im Schaltbild,
- Fehler, Reparatur, Erfolg und Reset,
- UI-Tests und Browserprüfung.

Voraussichtliche Dateien:

- `modules/virtual-electronics-lab/labs/button-digital-input-throughput.js`
- `modules/virtual-electronics-lab/styles.css`
- `modules/virtual-electronics-lab/test/labs/button-digital-input-throughput-ui.test.mjs`

## ELAB-FS-002: Fehlender Pull vom Eingang bis `digitalRead`

**Bearbeitung:** Spark  
**Status:** umgesetzt und getestet (2026-08-17)  
**Grund:** größerer, aber vollständig deterministischer Kernvertrag ohne UI.

Dieses Paket bündelt das bisher getrennte Floating-Modell, den MCU-Modus
`INPUT` und die Durchstich-Runtime.

Scope:

- deterministisches Modell für einen schwebenden Eingang,
- `pinMode(4, INPUT)` in der kontrollierten MCU-Runtime,
- typisierter Sample-Wechsel in der Taster-Runtime,
- Warnung `DIGITAL_INPUT_FLOATING_IDEALIZED`,
- Reset, Grenzen, tiefe Unveränderlichkeit und Regressionstests,
- keine Zufallswerte und keine Wall-Clock-Zeit.

Voraussichtliche Dateien:

- `modules/virtual-electronics-lab/input-models/floating-digital-input.mjs`
- `modules/virtual-electronics-lab/virtual-mcu/digital-input-program-runtime.mjs`
- `modules/virtual-electronics-lab/labs/button-digital-input-throughput-runtime.mjs`
- die drei zugehörigen Testdateien.

## ELAB-FS-003: Fehlenden Pull sichtbar untersuchen

**Bearbeitung:** GPT-5.6  
**Status:** umgesetzt und getestet (2026-08-17)  
**Grund:** Lernführung und gemeinsame Modusstruktur sind Integrationsarbeit.

Das Tasterlabor erhält den zweiten Fehlerfall `Pull-Widerstand fehlt`. Mehrere
Messungen zeigen die feste Modellfolge. Der Nutzer repariert den Aufbau mit
einem internen Pull und prüft danach offene und gedrückte Zustände.

Zusätzlich werden die vorhandenen Modi als kleine gemeinsame Metadaten
beschrieben. Es entsteht keine neue Anwendung und keine Tariflogik.

Abnahme:

- Symptom vor Erklärung,
- sichtbare Modellgrenze zur realen Hardware,
- Erfolg nur nach stabiler Reparatur,
- Wiederverwendung derselben Schaltung, Runtime und Laborfläche.

## ELAB-FS-004: Tasterprellen und Messspur

**Bearbeitung:** Spark  
**Status:** umgesetzt, geprüft und nachgehärtet (2026-08-17)  
**Grund:** klarer Rechenkern mit festen Ein-/Ausgaben und Golden Tests.

Das Paket bündelt das deterministische Prellmodell mit einer versionierten
digitalen Messspur.

Scope:

- explizite virtuelle Zeit in Mikrosekunden,
- festes Lehrprofil ohne Zufall,
- begrenzte Samplezahl,
- Zeitpunkte und Logikpegel als unveränderliche `MeasurementTrace`,
- keine UI, Timer, Interrupts oder vollständige Entprellsoftware.

Voraussichtliche Dateien:

- `modules/virtual-electronics-lab/input-models/button-bounce.mjs`
- `modules/virtual-electronics-lab/labs/button-bounce-trace.mjs`
- die beiden zugehörigen Testdateien.

## ELAB-FS-005: Tasterprellen messen

**Bearbeitung:** GPT-5.6  
**Status:** umgesetzt und im Browser getestet (2026-08-17)  
**Grund:** Messdarstellung, Bedienung und Realitätsbrücke benötigen visuelle
Kontrolle.

Die vorhandene Laborfläche zeigt die gemeinsame digitale Messspur. Nutzer
vergleichen idealisierten Kontakt, Prellen und eine stabile Programmauswertung.
Messcursor und Flankenzählung lesen ausschließlich die gemeinsame Spur.

Nicht enthalten sind ein separates Oszilloskop-Labor, native MCU-Ausführung
oder echte Hardwarekopplung.

## ELAB-FS-006: KI-Vertrag für geführte Fehlersuche

**Bearbeitung:** GPT-5.6  
**Status:** providerunabhängiger Vertrag umgesetzt und getestet (2026-08-17)  
**Voraussetzung:** Die Fehlersuche funktioniert vollständig ohne KI.

Die KI darf:

- eine Beobachtung erklären,
- eine nächste Messung vorschlagen,
- eine Reparatur als bestätigungspflichtigen Command-Diff vorschlagen.

Zunächst entstehen nur Schema-, Sicherheits- und Contract-Tests mit festen
Fixtures. Kein Live-LLM-Aufruf, keine direkte Zustandsänderung und kein
Provider-Key im Browser.

## Arbeitsregel

- Ein Paket wird erst vor seiner Umsetzung detailliert spezifiziert.
- Spark erhält höchstens einen Implementierungsauftrag und einen gebündelten
  Korrekturauftrag je Paket.
- Kleine Nacharbeiten übernimmt GPT-5.6 direkt.
- Graph und zentrale Dokumentation werden erst nach Abnahme aktualisiert.
- Kein Paket erlaubt Commit, Push, Deployment oder Live-LLM-Aufrufe.

Die bestätigten Anforderungen, Implementierungsartefakte und Tests sind im
SQLite-Graphen erfasst.

## ELAB-FS-007 bis FS-010: Quellcodegesteuerte Entprellung

**Status:** umgesetzt, getestet und im Browser geprüft (2026-08-17)

Der deterministische Entprellkern und die kontrollierte Virtual-MCU-Runtime
verbinden die FS-004-Messspur mit einem realitätsnahen Mikrocontrollerprogramm.
Rohsignal und `buttonState` liegen auf derselben Zeitachse. Die Fehlerfälle
`300 µs` und `2.000 µs` werden ausschließlich im Quellcode repariert; `700 µs`
ist nur der Referenzwert des festen Lehrprofils.

## ELAB-FS-011: Bestätigungspflichtiger Assistentenablauf

**Status:** umgesetzt, getestet und im Browser geprüft (2026-08-17)

Ein sichtbarer lokaler Fixture-Modus erklärt Beobachtungen, schlägt Messungen
vor und zeigt Reparatur-Diffs. Vor „Vorschlag übernehmen“ bleiben Quellcode,
Verdrahtung und Messzustand unverändert.

## ELAB-FS-012: Session- und creditgebundene Live-KI

**Status:** lokal umgesetzt und contract-getestet (2026-08-17)

Die öffentliche Laborsimulation bleibt statisch und anonym. Nur der optionale
Assistent nutzt den sessiongeschützten Identity-Endpunkt, AI Usage und OpenAI
Responses mit `store: false` und Structured Output. Providerantworten werden
serverseitig erneut validiert; ein Live-Provider- und Staging-Nachweis wurde
nicht ausgeführt.

Die detaillierte Paketfolge steht in
[Elektroniklabor: Planung nach ELAB-FS-006](virtual-electronics-lab-next-fault-search-work-packages.md).

Die geplante Fortsetzung mit KI-Härtung, Template-Katalog und
LED-Stromrücklesung steht in
[Elektroniklabor: nächste Arbeitspakete nach FS-012](virtual-electronics-lab-next-work-packages-after-fs-012.md).
