# ELAB-CORE-001: Gemeinsamer LabProject-Messpfad

Stand: 2026-08-17  
Status: lokal umgesetzt und getestet

## Ziel

Die freie Elektroniksimulation übergibt Schaltung, Messaufbau und
Analysekonfiguration als einen versionierten `LabProject`-Slice an einen
gemeinsamen Messpfad.

## Ausgangssituation

`CircuitDocument` und `MeasurementSetup` sind bereits getrennt validiert. Die
Tastkopfauswertung liest Solverantworten bislang jedoch unmittelbar und besitzt
noch keinen gemeinsamen, typisierten Measurement-Trace.

## Enthalten

- versionierter `LabProject`-Slice für Schaltung, Instrumente und Simulation,
- Validierung der bestehenden Circuit- und Measurement-Verträge,
- typisierter Trace für analoge Knotenspannungen,
- differentielle Tastkopfauswertung ausschließlich aus diesem Trace,
- Adaptererhalt für die bestehende DC- und Transientenoberfläche.

## Nicht enthalten

- neuer Solver oder echter SPICE-Provider,
- neue Komponenten oder Messgeräte,
- Mikrocontroller-, Umwelt-, KI- oder Persistenzfunktionen,
- Migration der getrennten Bestandsinstrumente,
- Änderung des sichtbaren Laborablaufs.

## Architekturbezug

Das Paket ist ein versionierter Vorläufer des gemeinsamen `LabProject`, des
`MeasurementTraceSchema` und des Measurement Bus aus der Zielarchitektur. Es
erzeugt keinen Serverprozess und keine dauerhafte fachliche Wahrheit.

## Betroffene Dateien

- `modules/virtual-electronics-lab/domain/lab-project-contract.mjs`
- `modules/virtual-electronics-lab/instruments/measurement-bus.mjs`
- `modules/virtual-electronics-lab/free-simulation/voltage-probe-evaluator.mjs`
- gezielte Contract- und Regressionstests
- Elektroniklabor- und Architekturdokumentation
- SQLite-Graph

## Abnahmekriterien

- ungültige Schaltungen oder Messaufbauten werden vor einer Messung abgelehnt,
- DC und Transiente erzeugen dasselbe versionierte Traceformat,
- ein Tastkopf misst ausschließlich die Differenz zweier Knoten im Trace,
- vertauschte Spitzen kehren das Vorzeichen um,
- vorhandene UI-Adapter liefern weiterhin ihr bisheriges Ergebnisformat,
- gleiche Eingaben liefern identische, tief unveränderliche Ergebnisse.

## Tests

- neue Unit-Tests für `LabProject` und Measurement Bus,
- bestehende Voltage-Probe-, DC-, Transienten- und UI-Tests,
- vollständige gezielte Elektroniklabor-Regression.

## Dokumentation und Graph

Requirement, Implementierungsartefakt und Testartefakt werden nach erfolgreicher
Abnahme direkt im SQLite-Graphen erfasst. Prozess-UML und Sicherheitsgrenze
bleiben unverändert, weil kein Prozess, Endpoint oder Datenfluss hinzukommt.
