# Traceability Overview

Quelle:

- [model/traceability.yaml](../../model/traceability.yaml)
- [model/relations.yaml](../../model/relations.yaml)

Diese Datei ist eine Lesesicht. YAML bleibt die Source of Truth.

## Hauptkette

```text
Vision
-> Business Goals
-> Zielgruppen / Customer Journeys
-> Produkte / Angebote
-> Projekte / Use Cases
-> Capabilities
-> Requirements
-> technische Entscheidungen
-> Architekturbausteine
-> Hardware / Software-Komponenten
-> Tasks / offene Fragen / Risiken
```

## Vision

`vision.gernetix` - GerNetiX Engineering Knowledge Platform

Leitprinzip:

`principle.knowledge_more_expensive_than_code` - Wissen ist teurer als Code

## Business Goals

- `BG-001`: Bestehende Kunden kontinuierlich mit passenden neuen Lernangeboten begleiten.
- `BG-002`: Den Einstieg in Embedded-Entwicklung moeglichst einfach machen.
- `BG-003`: Die Einstiegshuerde durch eine einfache IDE reduzieren.
- `BG-004`: Vorhandene Hardware optimal nutzen und passende Projekte empfehlen.
- `BG-005`: Engineering-Wissen dauerhaft erhalten.

## Produkte

- `product.learning_platform`: Learning Platform
- `product.simple_ide`: Simple IDE

## Customer Journeys

- `CJ-001`: Neuer Benutzer entdeckt die Plattform.
- `CJ-002`: Benutzer inventarisiert vorhandene Hardware.
- `CJ-003`: Benutzer beginnt ein Projekt.
- `CJ-004`: Benutzer kehrt spaeter zurueck.
- `CJ-005`: Benutzer besitzt Hardware, aber noch nicht alle Lernziele.
- `CJ-006`: Benutzer besitzt ein neues ProcessorBoard.
- `CJ-007`: Administrator erweitert die Plattform.

## Projekte

- `project.ai_pet_esp32`: KI-Haustier / Tamagotchi AI
- `project.smart_plant_watering`: Intelligente Pflanzenbewaesserungsstation
- `project.rfid_safe`: RFID-Tresor
- `project.kanban_gridfinity_inventory`: Kanban-/Gridfinity-Inventarsystem

## Capabilities

TechnicalCapabilities:

- `capability.processor_esp32`
- `capability.display_output`
- `capability.digital_input`
- `capability.digital_output`
- `capability.actuator_driver`
- `capability.soil_moisture_measurement`
- `capability.wifi`
- `capability.ota`
- `capability.spi`
- `capability.rfid_reading`
- `capability.servo_control`
- `capability.item_identification`

SystemCapabilities:

- `system_capability.ide_flash_usb`
- `system_capability.ide_flash_ota`
- `system_capability.ai_assistant`

## Requirements

Es gibt aktuell ein klares Requirements-Regelmodell:

- Requirements beschreiben das Warum.
- Work Packages beschreiben das Was.
- Implementierung beschreibt das Wie.
- Die Dekomposition endet bei Work Packages.

Offene Luecke:

- `gap.concrete_requirements_missing`: Konkrete Requirements pro Customer Journey und Projekt fehlen noch.

## Technische Entscheidungen

- `architecture.yaml_first_repository`: YAML-first Repository-Struktur.
- `architecture.top_down_development`: Top-down-Entwicklung.
- `architecture.domain_ownership`: Fachliche Heimatdomaene je Artefakt.
- `architecture.no_central_knowledge_domain`: Keine zentrale Knowledge-Domaene.
- `architecture.project_flow_item`: ProjectFlowItem statt ProjectContentItem.
- `architecture.condition_entity`: Condition als eigenstaendiges Artefakt.
- `architecture.capability_split`: TechnicalCapability und SystemCapability trennen.
- `architecture.permission_precedence`: Berechtigungsprioritaet Override vor Plan vor Default.
- `architecture.registered_processor_board`: RegisteredProcessorBoard trennt konkretes Board vom Produkttyp.

## Architekturbausteine

- `component.backend`: spaeterer Backend-Baustein.
- `component.frontend`: spaeterer Frontend-Baustein.
- `component.database`: aus YAML/Metamodell abgeleitete Datenbank.
- `component.generated_markdown`: generierte Lesedokumentation.
- `component.openai_adapter`: optionaler AI Adapter.
- `component.ota`: OTA als Device-Management-Baustein.

## Risiken und offene Punkte

Risiken:

- `risk.water_and_electronics`
- `risk.online_dependency`
- `risk.weak_security_expectation`
- `risk.overmodeling_inventory`

Offene Punkte:

- `gap.concrete_requirements_missing`
- `gap.capability_catalog_missing` ist initial mitigiert; Detailmodellierung der TechnicalCapabilities fehlt noch.
- `gap.task_model_missing`
- `open_question.account_skill_level_scope`
- `open_question.teacher_plan_scope`

## Konsistenzbefund

- Produkte ohne Business Goal: keine kritische Luecke; Produkte sind ueber Vision und Ziele begruendet.
- Requirements ohne Produkt/Capability: konkrete Requirements fehlen noch, daher nicht pruefbar.
- Capabilities ohne Projektbezug: die erfassten TechnicalCapabilities liegen initial in `data/hardware/technical-capabilities.yaml`; Detailattribute und Kategorien fehlen noch.
- Technische Entscheidungen ohne Architekturbezug: keine kritische Luecke; Entscheidungen sind Architektur- oder Metamodellbausteinen zugeordnet.
- Offene Fragen ohne Entitaet: zwei zentrale offene Fragen wurden als eigene Entitaeten modelliert.
- Tasks ohne Zielbezug: Task-Entitaeten fehlen noch.
- Widerspruechliche Begriffe: "Capability" ist geklaert in `TechnicalCapability` und `SystemCapability`; alte allgemeine Verwendung bleibt als Risiko fuer Alttexte sichtbar.
