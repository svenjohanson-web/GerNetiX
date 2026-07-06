# YAML-Quellenindex

Diese Datei ist eine Lesesicht auf die fuehrenden YAML-Dateien.
Der validierte SQLite-Graph ist die kanonische Struktur. Markdown dient nur der Orientierung.

## Business

- `data/business/vision.yaml`: Vision und Produktauftrag
- `data/business/business-traceability-metamodel.yaml`: Business-Traceability-Metamodell mit Artefaktarten, Kardinalitaeten und Statusmodell
- `data/business/business-goals.yaml`: Business Goals, z. B. `BG-001`
- `data/business/business-capabilities.yaml`: Business Capabilities, z. B. `BC-001`
- `data/business/community-domain.yaml`: Business-Domain Community und deren Premium-Wissensfunktionen
- `data/business/business-strategies.yaml`: Business Strategies als betriebswirtschaftliche Hebel
- `data/business/strategies.yaml`: konkrete Strategies unter Business Strategies
- `data/business/measures.yaml`: rekursive Measures und Initiativen
- `data/business/business-rules.yaml`: Business Rules und Policies
- `data/business/customer-journeys.yaml`: Customer Journeys, z. B. `CJ-001`
- `data/business/products.yaml`: Produkte und Produktzuordnung
- `data/business/product-offerings.yaml`: kaufmaennische Produktangebote und Bundles, z. B. mehrere Courses als Kombinationsangebot
- `data/business/courses.yaml`: kaufbare Learning-Angebote gemaess Metamodell `Course`
- `data/business/offers.yaml`: veraltete Uebergangsnotiz; nicht fuehrend
- `data/business/audiences.yaml`: Zielgruppen / Personas
- `data/business/value-propositions.yaml`: Kundennutzen / Value Propositions
- `data/business/principles.yaml`: Leitprinzipien und Validierungsregeln

## Learning

- `data/learning/learning-goals.yaml`: Learning Goals
- `data/learning/learning-paths.yaml`: Learning Paths, z. B. `learning_path.cross_platform_development`
- `data/learning/learning-units.yaml`: verkaufsnahe und fachliche Learning-Einheiten
- `data/learning/projects/tamagotchi-entry-course.yaml`: Tamagotchi Entry Course
- `data/learning/projects/cross-platform-tamagotchi.yaml`: Cross-Platform-Development-Projekte mit austauschbarer Tamagotchi-Beispieldomaene
- `data/learning/projects/smart-plant-watering.yaml`: Intelligente Pflanzenbewaesserungsstation
- `data/learning/projects/rfid-safe.yaml`: RFID-Tresor
- `data/learning/projects/book-vault.yaml`: Buchtresor / Tagebuchschloss
- `data/learning/projects/kanban-gridfinity-inventory.yaml`: Kanban-/Gridfinity-Inventarsystem

## Hardware

- `data/hardware/technical-capabilities.yaml`: TechnicalCapabilities fuer Hardware-Matching

## Authorization

- `data/authorization/system-capabilities.yaml`: SystemCapabilities fuer Berechtigungen
- `data/authorization/roles.yaml`: Rollen fuer Community, Moderation und KI-Administration
- `data/authorization/plans.yaml`: Plaene und deren SystemCapabilities

## Features, UI und Events

- `data/features/community-features.yaml`: kostenlose Community-Funktionen und Premium-KI-Community-Assistent-Features
- `data/ui/ui-models.yaml`: UI-Modelle fuer KI-Community-Assistent und Admin-Konfiguration
- `data/events/events.yaml`: Domain Events fuer Community-KI-Anfragen, Antworten, Blockierungen und Index-Updates

## Architecture

- `data/architecture/decisions.yaml`: Architekturentscheidungen und Modellregeln
- `data/architecture/structural-elements.yaml`: grundlegende Architektur-Strukturelemente wie User IDE, Admin Tool, Recovery Tool und Provisioning Tool

## Risiken und offene Punkte

- `data/requirements/business-requirements.yaml`: pruefbare Requirements aus Business Capabilities und Business Rules
- `data/requirements/non-functional-requirements.yaml`: Non-Functional Requirements
- `data/risks/risks.yaml`: Risiken
- `data/gaps/open-gaps.yaml`: Offene Luecken und offene Fragen

## Abgeleitete technische Artefaktarten

- `data/architecture/artifacts.yaml`: Architecture Artifacts
- `data/data-models/data-models.yaml`: Data Models
- `data/api/api-artifacts.yaml`: API Artifacts
- `data/implementation/implementation-artifacts.yaml`: Implementation Artifacts
- `data/tests/test-artifacts.yaml`: Test Artifacts
- `data/validation/validation-artifacts.yaml`: Validation Artifacts

## Themenbezogene Lesesichten

- `docs/generated/business-traceability-view.md`: Business-Traceability von Vision bis Validation
- `docs/generated/ai-cost-protection-view.md`: KI-Kostenkontrolle, Usage Monitoring und Admin Dashboard
- `docs/generated/community-ai-assistant-view.md`: Premium-Funktion KI-Community-Assistent
- `docs/generated/project-traceability-validation.md`: Validierungsbericht zur bereinigten Projekt-Traceability

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
