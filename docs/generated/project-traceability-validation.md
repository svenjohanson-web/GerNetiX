# Project Traceability Validation

Diese Datei ist eine generierte Validierungssicht.
Der validierte SQLite-Graph ist die kanonische Struktur.

## Zielregel

Ein Projekt kennt nach oben ausschliesslich genau einen Learning Path.

Erlaubte Upstream-Kante:

```text
Learning Path -> Projekt
```

Nicht mehr erlaubt:

- Projekt -> Vision
- Projekt -> Business Domain
- Projekt -> Business Goal
- Projekt -> Customer Journey
- Projekt -> Business Capability
- Projekt -> Requirement
- Projekt -> Monetarisierung
- Projekt -> KPI
- Projekt -> Strategie
- Learning Step -> Projekt
- Product Offering -> Projekt
- Risiko -> Projekt

## Neue Hierarchie

```text
Vision
-> Business Goal
-> Customer Journey
-> Learning Goal
-> Learning Path
-> Projekt
-> Learning Step
-> Learning Outcome
```

## Aktuelle Projektzuordnung

| Learning Path | Projekt |
|---|---|
| `learning_path.ai_pet_embedded_interaction` | `project.ai_pet_esp32` |
| `learning_path.automation_control_and_regulation` | `project.smart_plant_watering` |
| `learning_path.embedded_access_control` | `project.rfid_safe` |
| `learning_path.maker_access_and_mechanics` | `project.book_vault` |
| `learning_path.workshop_inventory_and_tooling` | `project.kanban_gridfinity_inventory` |
| `learning_path.cross_platform_development` | `project.cross_platform_tamagotchi.embedded` |
| `learning_path.cross_platform_development` | `project.cross_platform_tamagotchi.desktop` |
| `learning_path.cross_platform_development` | `project.cross_platform_tamagotchi.mobile` |
| `learning_path.cross_platform_development` | `project.cross_platform_tamagotchi.web` |
| `learning_path.cross_platform_development` | `project.cross_platform_tamagotchi.cloud` |
| `learning_path.cross_platform_development` | `project.cross_platform_tamagotchi.synchronization` |
| `learning_path.cross_platform_development` | `project.cross_platform_tamagotchi.ai_extension` |

## Entfernte direkte Beziehungen

Aus Projekt-YAMLs entfernt:

- `project.ai_pet_esp32` -> Business Goals, Customer Journeys, Audiences, Value Propositions, Learning Goals
- `project.smart_plant_watering` -> Business Goals, Customer Journeys, Audiences, Value Propositions, Learning Goals
- `project.rfid_safe` -> Business Goals, Customer Journeys, Audiences, Value Propositions, Learning Goals
- `project.book_vault` -> Business Goals, Customer Journeys, Audiences, Value Propositions, Learning Goals, direkte Product-Offering-Verweise
- `project.kanban_gridfinity_inventory` -> Business Goals, Customer Journeys, Audiences, Value Propositions, Learning Goals
- `project.cross_platform_tamagotchi.*` -> direkte Learning-Goal-Verweise
- `project.cross_platform_tamagotchi.ai_extension` -> direkte Business-Rule-/NFR-Verweise
- `data/project-ideas/smart-plant-watering.yaml` -> direkte Business-Goal-/Customer-Journey-/Learning-Goal-Verweise

Aus `model/relations.yaml` entfernt:

- Projekt -> Product
- Projekt -> Business Goal
- Projekt -> Customer Journey
- Projekt -> Learning Goal
- Projekt -> Product Offering
- Projekt -> Business Rule / NFR
- Learning Unit -> Projekt
- Learning Path Step -> Projekt
- Product Offering -> Projekt
- Component -> Projekt
- Risk -> Projekt

Aus anderen YAML-Quellen entfernt oder umgehangen:

- Business Goals listen keine Projekte mehr in `usedBy`.
- Risiken betreffen Learning Paths statt Projekte.
- Product Offerings referenzieren Learning Paths statt Projekte.
- Learning Units referenzieren Learning Paths statt Projekte.

## Validierung

Bestanden:

- Jedes aktuelle Projekt besitzt genau einen Learning Path.
- Kein Projekt referenziert Business Goals.
- Kein Projekt referenziert Customer Journeys.
- Kein Projekt referenziert Vision.
- Kein Projekt referenziert Business Capabilities.
- Kein Projekt referenziert Requirements.
- Kein Projekt referenziert Monetarisierung.
- `model/relations.yaml` enthaelt als eingehende Projekt-Kanten nur noch `LearningPath -> contains -> Project`.

Hinweis:

Technische Projektbeziehungen wie `Project -> TechnicalCapability` bleiben erhalten. Sie beschreiben technische Anforderungen und sind keine Upstream-Traceability.
