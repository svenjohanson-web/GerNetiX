# Offene Fragen

Diese Datei sammelt offene Fragen fuer die naechste fachliche Klaerung.
Die aktuelle modellbezogene Lueckenliste steht in `docs/generated/open-gaps.md`.

## Aktuelle offene Fragen

### Produkt und Business

- Ist "GerNetiX" der finale Name der gesamten Engineering Knowledge Platform?
- Sind "Learning Platform" und "Simple IDE" die finalen Produktnamen oder Arbeitsnamen?
- Welche Zielgruppe wird fuer CJ-001 zuerst konkret beschrieben?

### Requirements

- Welche konkreten Requirements werden zuerst aus CJ-001 abgeleitet?
- Welche Work Packages entstehen daraus?
- Welche Definition of Done gilt fuer ein Requirement in Version 1?

### Metamodell

- Ist `AccountSkillLevel` global, domaenenbezogen oder beides?
- Wird der `Teacher` Plan als produktiver Standardplan benoetigt oder nur als Test-/Schulkontext?
- Welche referenzierten Capabilities werden als erste zentrale YAML-Entitaeten angelegt?
- Wann wird die Legacy-Datei `data/project-ideas/smart-plant-watering.yaml` konsolidiert oder als Importquelle markiert?

### Nachweis und Generierung

- Welche Traceability-Berichte sollen spaeter automatisch erzeugt werden?
- Wann wird ein Generator fuer Markdown- und Mermaid-Lesesichten eingefuehrt?
- Welche YAML-Schemas muessen vor einer Web-App zuerst stabilisiert werden?

## Bereits geklaerte Leitplanken

- Es wird noch keine Software erstellt.
- YAML ist die fuehrende Quelle fuer strukturierte Daten.
- Markdown ist Lesesicht oder generierter Output.
- Das Metamodell beschreibt fachliche Wahrheit, nicht Implementierungsstand.
- Entwicklung erfolgt top-down.
- Jede Klasse besitzt genau eine fachliche Heimatdomaene.
- Zielgruppen, Rollen, Plaene und SystemCapabilities werden nicht vermischt.
- TechnicalCapability und SystemCapability sind getrennte Konzepte.
- Requirements enden fachlich auf Work Packages; technische Tasks gehoeren zur Umsetzung.
