# ELAB-FREE-009: Leere Laborfläche

Stand: 2026-08-17  
Status: lokal umgesetzt und getestet

## Ziel

Der Nutzer kann die freie Elektroniksimulation mit einer wirklich leeren,
vollständig bearbeitbaren Laborfläche beginnen.

## Ausgangssituation

Der freie Command-Pfad unterstützt bereits ein leeres `CircuitDocument`. Die
sichtbare Vorlagenauswahl startet bislang jedoch nur mit Spannungsteiler oder
RC-Ladevorgang.

## Enthalten

- leerer, versionierter Circuit- und Measurement-Startzustand,
- auswählbares Template im Bereich `Freie Simulation`,
- sichtbarer Hinweis auf der leeren Arbeitsfläche,
- Hinzufügen, Verdrahten, Messen, Undo/Redo und Reset über bestehende Commands.

## Nicht enthalten

- KI-Schaltungserzeugung,
- neue Bauteile, Solver oder Instrumente,
- Persistenz oder accountgebundene Projekte,
- Änderung der bisherigen Standardvorlage beim direkten Laboraufruf.

## Abnahmekriterien

- das Template startet mit null Bauteilen, null Knoten und null Messpunkten,
- der Leerzustand ist verständlich sichtbar,
- ein Bauteil kann über den bestehenden Command-Pfad hinzugefügt werden,
- Reset stellt den leeren Templatezustand wieder her,
- Spannungsteiler- und RC-Template bleiben unverändert.

## Tests

- Preset-Contract-Test,
- Template-Katalog- und UI-Contract-Tests,
- bestehende freie Simulations- und Elektroniklabor-Regression.

## Dokumentation und Graph

Requirement, Implementierungsartefakt und Testartefakt werden nach erfolgreicher
Abnahme im SQLite-Graphen erfasst. Prozess-, Persistenz- und Sicherheitsgrenzen
bleiben unverändert.
