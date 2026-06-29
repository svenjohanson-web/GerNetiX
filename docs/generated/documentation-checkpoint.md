# Dokumentations-Checkpoint

Stand: 2026-06-29

Diese Datei dokumentiert den aktuellen Pruefstand des Chats.
Sie ist eine Lesesicht. Fuehrende Quellen bleiben die YAML-Modelle und die fachlichen Ausgangsdokumente.
Fachliche Kerndaten liegen fuehrend unter `data/`; `model/traceability.yaml` und `model/relations.yaml` bilden aggregierte Traceability-Sichten.

## Ergebnis

Die wesentlichen Inhalte aus dem bisherigen Chat sind dokumentiert und im Workspace auffindbar.

Abgedeckt sind:

- Leitprinzip `Wissen ist teurer als Code`
- Top-Down-Vorgehen von Vision bis Nachweis
- Metamodell als fachliche Wahrheit
- YAML-first als fuehrende Datenstruktur fuer pflegbare Modellinformationen
- Traceability ueber zentrale IDs und Beziehungen
- Domaenenverantwortung und erlaubte Referenzen
- keine zentrale Knowledge-Domaene
- Trennung von Zielgruppen, Rollen, Plaenen und SystemCapabilities
- Trennung von TechnicalCapability und SystemCapability
- LearningProject-Verantwortung
- ProjectFlowItem statt ProjectContentItem
- ProjectIntroduction als Bestandteil eines LearningProject
- Condition als wiederverwendbarer Zustandsbaustein
- TechnicalConstraint mit `mandatory` und `optional`
- AccountProjectProgress als Arbeitskontext eines Benutzers
- AccountCompetencyProgress und AccountCompetencyEvidence
- RegisteredProcessorBoard, Pairing, BoardCredential, Firmware und OTA
- Berechtigungs-Vorrangregeln
- Anforderungen, Work Packages, Implementierung und Tests als getrennte Ebenen
- Business Goals BG-001 bis BG-005
- Customer Journeys CJ-001 bis CJ-007
- Projektideen KI-Haustier, Pflanzenbewaesserungsstation, RFID-Tresor und Kanban-/Gridfinity-Inventarsystem
- YAML-first Repository-Struktur
- Mermaid-Graph und Mindmap-Lesesichten

## Zentrale Quellen

- `model/traceability.yaml`
- `model/relations.yaml`
- `data/business/business-goals.yaml`
- `data/business/customer-journeys.yaml`
- `data/business/products.yaml`
- `data/business/principles.yaml`
- `data/architecture/decisions.yaml`
- `data/hardware/technical-capabilities.yaml`
- `data/authorization/system-capabilities.yaml`
- `data/gaps/open-gaps.yaml`
- `docs/generated/traceability-overview.md`
- `docs/generated/business-view.md`
- `docs/generated/product-view.md`
- `docs/generated/architecture-view.md`
- `docs/generated/decision-log.md`
- `docs/generated/open-gaps.md`
- `docs/metamodel-learning-platform.md`
- `docs/domains.md`
- `docs/requirements.md`
- `docs/documentation-strategy.md`
- `docs/vision-business-goals-customer-journeys.md`
- `docs/yaml-first-repository-structure.md`

## YAML-Projektquellen

- `data/learning/projects/ai-pet-esp32.yaml`
- `data/learning/projects/smart-plant-watering.yaml`
- `data/learning/projects/rfid-safe.yaml`
- `data/learning/projects/kanban-gridfinity-inventory.yaml`

## Generierte Lesesichten

- `docs/generated/traceability-overview.md`
- `docs/generated/business-view.md`
- `docs/generated/product-view.md`
- `docs/generated/architecture-view.md`
- `docs/generated/decision-log.md`
- `docs/generated/open-gaps.md`
- `docs/generated/traceability-graph.md`
- `docs/generated/business-mindmap.md`
- `docs/generated/mindmaps/index.md`

## Aktuelle offene Punkte

Die aktuelle modellbezogene Lueckenliste steht in `docs/generated/open-gaps.md`.

Wesentliche offene Punkte:

- Konkrete Requirements je Customer Journey und Projekt fehlen noch.
- Der zentrale Capability-Katalog wurde initial unter `data/hardware/technical-capabilities.yaml` angelegt; Detailattribute und Kategorien fehlen noch.
- Task-Modell mit Zielbezug fehlt noch.
- `AccountSkillLevel` ist noch nicht final eingeordnet.
- `Teacher Plan` ist noch nicht final als produktiver Plan oder Test-/Schulkontext entschieden.
- `data/project-ideas/smart-plant-watering.yaml` ist eine Legacy-/Altstruktur neben der aktuellen YAML-Projektstruktur.
- Einige referenzierte IDs existieren noch nicht als eigene zentrale YAML-Entitaeten.
- Markdown- und Mermaid-Dateien sind aktuell Lesesichten; ein automatischer Generator ist noch nicht umgesetzt.

## Konsistenzbewertung

Keine kritische Dokumentationsluecke fuer die bisher getroffenen Entscheidungen gefunden.

Die groesste naechste Strukturarbeit ist nicht weitere freie Dokumentation, sondern die Ableitung konkreter Requirements und Work Packages aus den priorisierten Customer Journeys.

## Pruefregel

Fuer die weitere Arbeit gilt:

Kein nicht-root Artefakt ohne nachvollziehbare Upstream-Beziehung.

Jedes Artefakt muss beantworten koennen:

- Warum existiere ich?
- Wem gehoere ich fachlich?
- Wofuer werde ich verwendet?
