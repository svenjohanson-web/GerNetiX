# ELAB-PAR-008: Tasteranschluss unabhängig vom Pull-Widerstand modellieren

Stand: 2026-08-16  
Status: umgesetzt und getestet (2026-08-16)

Verbindlich gelten `AGENTS.md` und
`docs/codex-virtual-electronics-lab-implementation-procedure.md`.

## Ziel

Das idealisierte Tastermodell unterscheidet erstmals zwischen dem
Pull-Widerstand des Eingangs und dem Pegel, mit dem der gedrückte Kontakt
verbunden ist. Damit entsteht der kleinste fachliche Baustein für eine spätere
Fehlersuche „Taster reagiert nicht“.

## Ausgangssituation

`evaluateButtonContact({ pressed, pullMode })` leitet den Kontaktanschluss
derzeit implizit aus `pullMode` ab:

- Pull-up: Taster schaltet nach GND,
- Pull-down: Taster schaltet nach 3,3 V.

Diese Kopplung bildet nur die korrekte Verdrahtung ab. Ein Taster, der
versehentlich an denselben Pegel wie der Pull-Widerstand angeschlossen ist,
kann damit nicht dargestellt werden.

## Enthalten

- additive Erweiterung von `evaluateButtonContact` um den optionalen Eingang
  `contactReference`,
- unterstützte Werte `gnd` und `vcc`,
- rückwärtskompatible Ableitung des korrekten Gegenpols, wenn
  `contactReference` fehlt,
- unabhängige Berechnung des offenen und geschlossenen Tasterpegels,
- stabile Warnung, wenn das Drücken den Eingangspegel nicht verändert,
- erweiterte, tief unveränderliche Modellmetadaten,
- gezielte Unit- und Regressionstests.

## Nicht enthalten

- sichtbare Laboroberfläche oder neuer Navigationseintrag,
- Fehlersuchmodus, Aufgabenstellung, Lösung oder Bewertung,
- Änderung der Taster-Digitaleingangs-Runtime,
- fehlender Pull-Widerstand oder schwebender Eingang,
- Tasterprellen, Zeitverlauf, Rauschen oder Zufall,
- Interrupts, GPIO-Ausgang, ADC, SPICE oder Circuit Solver,
- Persistenz, Netzwerk, KI, Tarife oder Credits,
- Graph-, Architektur- oder zentrale Dokumentationsänderungen durch Spark.

## Architekturbezug

Das Paket erweitert ausschließlich das vorhandene idealisierte Eingangsmodell
aus `ELAB-PAR-004`. Es führt weder eine zweite Tasterlogik noch eine
Fault-Scenario-Engine ein. Eine spätere Runtime darf dieses Modell verwenden,
um eine opake Fehlervariante anzuwenden.

Öffentliche lokale Demofälle benötigen keine Geheimhaltungszusage. Eine
spätere geschützte Fehlerlösung bleibt ausdrücklich außerhalb dieses Pakets.

## Erlaubte Dateien

- `modules/virtual-electronics-lab/input-models/button-contact.mjs`
- `modules/virtual-electronics-lab/test/input-models/button-contact.test.mjs`

Alle anderen Dateien bleiben unverändert.

## Fachlicher Vertrag

Der Einstiegspunkt bleibt:

```js
evaluateButtonContact({
  pressed,
  pullMode,
  contactReference
})
```

### Eingaben

- `pressed` ist ausschließlich ein Boolean.
- `pullMode` ist ausschließlich `pull-up` oder `pull-down`.
- `contactReference` ist, wenn angegeben, ausschließlich `gnd` oder `vcc`.
- Fehlt `contactReference`, wird zur Rückwärtskompatibilität der korrekte
  Gegenpol gewählt:
  - `pull-up` -> `gnd`,
  - `pull-down` -> `vcc`.

### Pegelmodell

Bei gelöstem Taster bestimmt nur der Pull-Widerstand den Pegel:

- `pull-up` -> `HIGH` / `1`,
- `pull-down` -> `LOW` / `0`.

Bei gedrücktem Taster bestimmt `contactReference` den Pegel:

- `vcc` -> `HIGH` / `1`,
- `gnd` -> `LOW` / `0`.

Das Ergebnis nennt zusätzlich den tatsächlich verwendeten Wert
`contactReference`.

### Fehlverdrahtung

Wenn der Taster an denselben Pegel wie der Pull-Widerstand angeschlossen ist,
bleibt die Auswertung erfolgreich, aber das Drücken ändert den Pegel nicht:

- `pull-up` + `vcc` -> immer `HIGH`,
- `pull-down` + `gnd` -> immer `LOW`.

Nur bei `pressed: true` wird dafür die stabile Warnung
`BUTTON_CONTACT_NO_LEVEL_CHANGE` ausgegeben. Der Warnhinweis ist sowohl in
`result.warnings` als auch im äußeren `warnings`-Array vorhanden und enthält
keine versteckte Lösung oder lokalisierte UI-Texte.

### Fehler

Die bestehenden Fehlercodes bleiben unverändert. Neu kommt hinzu:

- `BUTTON_CONTACT_REFERENCE_NOT_SUPPORTED`

Bei ungültiger Referenz wird kein Teilergebnis zurückgegeben.

### Modellmetadaten

- `modelId` bleibt unverändert,
- `modelVersion` wird auf `1.1.0` erhöht,
- `allowedContactReferences` enthält unveränderlich `gnd` und `vcc`,
- die neue Warnung und der neue Fehler sind in den unveränderlichen Metadaten
  beschrieben,
- alle Ergebnisse und Metadaten bleiben tief unveränderlich.

## Abnahmekriterien

1. Alle bisherigen Aufrufe ohne `contactReference` behalten exakt ihre Pegel.
2. Pull-up mit Kontakt nach GND liefert offen `HIGH` und gedrückt `LOW`.
3. Pull-down mit Kontakt nach VCC liefert offen `LOW` und gedrückt `HIGH`.
4. Pull-up mit Kontakt nach VCC liefert offen und gedrückt `HIGH`; nur der
   gedrückte Zustand enthält `BUTTON_CONTACT_NO_LEVEL_CHANGE`.
5. Pull-down mit Kontakt nach GND liefert offen und gedrückt `LOW`; nur der
   gedrückte Zustand enthält `BUTTON_CONTACT_NO_LEVEL_CHANGE`.
6. Das Ergebnis nennt die verwendete Kontaktreferenz.
7. Ungültige Kontaktreferenzen liefern den stabilen neuen Fehlercode.
8. Eingabeobjekte werden nicht verändert.
9. Wiederholte Aufrufe liefern tiefengleiche Ergebnisse.
10. Metadaten, Warnungen, Fehler und Ergebnisse sind von außen nicht
    veränderbar.
11. Es gibt keine Netzwerk-, Speicher-, Wall-Clock- oder Zufallsnutzung.
12. Alle bisherigen Tastermodelltests bleiben erfolgreich.

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

> Implementiere ausschließlich `ELAB-PAR-008` aus
> `docs/virtual-electronics-lab-button-contact-wiring-work-package.md`.
> Lies zuerst `AGENTS.md`, `docs/codex-reminder-procedure.md` und
> `docs/codex-virtual-electronics-lab-implementation-procedure.md`. Ändere nur
> die beiden ausdrücklich erlaubten Dateien. Bewahre den bisherigen
> Zwei-Parameter-Aufruf vollständig rückwärtskompatibel. Verwende keine
> Laufzeit-, UI-, Graph- oder Dokumentationsänderungen. Führe beide im Paket
> genannten Testdateien sowie `git diff --check` aus und berichte knapp die
> geänderten Bereiche, Testergebnisse und offene Punkte. Committe, pushe und
> deploye nicht.
