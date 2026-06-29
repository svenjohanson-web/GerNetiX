# YAML-Quellenindex

Diese Datei ist eine Lesesicht auf die fuehrenden YAML-Dateien.
YAML bleibt die Source of Truth; Markdown dient nur der Orientierung.

## Business

- `data/business/vision.yaml`: Vision und Produktauftrag
- `data/business/business-goals.yaml`: Business Goals, z. B. `BG-001`
- `data/business/customer-journeys.yaml`: Customer Journeys, z. B. `CJ-001`
- `data/business/products.yaml`: Produkte und Produktzuordnung
- `data/business/audiences.yaml`: Zielgruppen / Personas
- `data/business/value-propositions.yaml`: Kundennutzen / Value Propositions
- `data/business/principles.yaml`: Leitprinzipien und Validierungsregeln

## Learning

- `data/learning/learning-goals.yaml`: Learning Goals
- `data/learning/projects/ai-pet-esp32.yaml`: KI-Haustier / Tamagotchi AI
- `data/learning/projects/smart-plant-watering.yaml`: Intelligente Pflanzenbewaesserungsstation
- `data/learning/projects/rfid-safe.yaml`: RFID-Tresor
- `data/learning/projects/kanban-gridfinity-inventory.yaml`: Kanban-/Gridfinity-Inventarsystem

## Hardware

- `data/hardware/technical-capabilities.yaml`: TechnicalCapabilities fuer Hardware-Matching

## Authorization

- `data/authorization/system-capabilities.yaml`: SystemCapabilities fuer Berechtigungen

## Architecture

- `data/architecture/decisions.yaml`: Architekturentscheidungen und Modellregeln

## Risiken und offene Punkte

- `data/risks/risks.yaml`: Risiken
- `data/gaps/open-gaps.yaml`: Offene Luecken und offene Fragen

## Aggregierte Modelle

- `model/traceability.yaml`: aggregierte Entitaetsuebersicht
- `model/relations.yaml`: explizite Beziehungen zwischen IDs

## Beispiel

`BG-001` liegt fuehrend in:

```text
data/business/business-goals.yaml
```

Lesesichten dazu finden sich unter anderem in:

```text
docs/vision-business-goals-customer-journeys.md
docs/generated/traceability-overview.md
docs/generated/business-view.md
```

