# GerNetiX Workspace

Dieser Workspace dient zunaechst der Planung und Dokumentation von GerNetiX.
GerNetiX wird als Engineering Knowledge Platform verstanden.

Leitsatz:

> Wissen ist teurer als Code.

## Dokumentation

Die Dokumentationsthemen werden in [docs/documentation-topics.md](docs/documentation-topics.md) gesammelt und priorisiert.

Kanonisches Modell:

- [SQLite Graph Model](tools/yaml-graph-sqlite/README.md)
- [SQLite-Graph-Validierung](docs/generated/sqlite-graph-validation.md)

Legacy-Importquellen aus der YAML-Migration:

- [YAML-Quellenindex](docs/generated/yaml-source-index.md)
- [Business Goals](data/business/business-goals.yaml)
- [Customer Journeys](data/business/customer-journeys.yaml)
- [Produkte](data/business/products.yaml)
- [Learning Projects](data/learning/projects)
- [Technical Capabilities](data/hardware/technical-capabilities.yaml)
- [System Capabilities](data/authorization/system-capabilities.yaml)
- [Architekturentscheidungen](data/architecture/decisions.yaml)
- [Architektur-Strukturelemente](data/architecture/structural-elements.yaml)
- [Offene Punkte](data/gaps/open-gaps.yaml)

Startdokumente:

- [Leitprinzipien](docs/principles.md)
- [Dokumentationsstrategie](docs/documentation-strategy.md)
- [Vision, Business Goals und Customer Journeys](docs/vision-business-goals-customer-journeys.md)
- [Produkte](docs/products.md)
- [Metamodell](docs/metamodel.md)
- [Metamodell - Learning Platform](docs/metamodel-learning-platform.md)
- [Review - Metamodell Learning Platform](docs/metamodel-learning-platform-review.md)
- [SQLite Graph Model](tools/yaml-graph-sqlite/README.md)
- [Datenmodell fuer Projektideen](docs/project-idea-data-model.md)
- [Traceability-Modell](model/traceability.yaml)
- [Beziehungsmodell](model/relations.yaml)
- [Traceability-Uebersicht](docs/generated/traceability-overview.md)
- [Dokumentations-Checkpoint](docs/generated/documentation-checkpoint.md)
- [Projektdefinition - KI-Haustier fuer ESP32](docs/project-ai-pet-esp32.md)
- [Projektdefinition - Intelligente Pflanzenbewaesserungsstation](docs/project-smart-plant-watering.md)
- [Domaenen](docs/domains.md)
- [Zielgruppen, Rollen, Berechtigungen und Initialdaten](docs/personas-roles-permissions.md)
- [Entwicklungsprozess](docs/development-process.md)
- [Requirements Engineering](docs/requirements.md)
- [Customer Journey](docs/customer-journey.md)
- [Nachweis und Traceability](docs/traceability.md)
- [Workspace und Arbeitsweise](docs/workspace.md)
- [Offene Fragen](docs/open-questions.md)

## Zielbild

GerNetiX besteht aktuell aus zwei fachlich getrennten Produkten:

- Learning Platform: Menschen systematisch zu Embedded- und Softwareentwicklern ausbilden.
- Simple IDE: Embedded-Projekte moeglichst einfach entwickeln.

Beide Produkte greifen auf dieselbe Wissensbasis zu.
Die Dokumentation beginnt bei der Nachvollziehbarkeit.
Der validierte SQLite-Graph ist die kanonische Pflege-, Pruef- und Abfragestruktur fuer das strukturierte Engineering-Wissen.
YAML unter `data/` und `model/` bleibt nur Legacy-Import, Bootstrap oder Export, sofern der Graph dieselbe Struktur fehlerfrei abbildet.
Markdown dient der Lesbarkeit und Dokumentation.

## Arbeitsweise

- Zuerst Dokumentation und Konfiguration klaeren.
- Noch keine Software implementieren.
- Dokumentation erfolgt top-down: Vision -> Business Goals -> Customer Journey -> Requirements -> Metamodell -> Datenmodell -> Implementierung -> Nachweis.
- Neue Metamodell-Klassen entstehen nur, wenn sie durch Customer Journey oder Requirement begruendet sind.
- Entscheidungen nachvollziehbar in den Dokumenten festhalten.
