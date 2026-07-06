# Traceability Overview

Quelle:

- [model/traceability.yaml](../../model/traceability.yaml)
- [model/relations.yaml](../../model/relations.yaml)

Diese Datei ist eine Lesesicht. Der validierte SQLite-Graph ist die kanonische Struktur.

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
- `BG-006`: Hardwarevertrieb und Support absichern.
- `BG-007`: Robustheit und Kundenakzeptanz sichern.
- `BG-008`: Nachhaltig profitabel wirtschaften.

## Business Capabilities

- `BC-001`: Value-based Bundling und Upselling
- `BC-015`: Experten beantworten Fragen zeitnah
- `BC-016`: Antworten werden fachlich verifiziert
- `BC-017`: Kurze FAQ-artige Loesungsantworten bereitstellen
- `BC-039`: KI-Zusatzkontingente verkaufen
- `BC-041`: Kostenkontrolle

## Business Traceability

```text
Vision
-> Business Goal
-> Business Capability
-> Strategy
-> Measure
-> Requirement
-> Architecture Artifact
-> Data Model / API Artifact
-> Implementation Artifact
-> Test Artifact
-> Validation Artifact
```

Beispiel:

```text
vision.gernetix
-> BG-008
-> BC-041
-> business_strategy.optimize_costs
-> measure.ai_usage_monitoring
-> system_capability.admin_ai_usage_monitoring
```

Beispiel:

```text
vision.gernetix
-> BG-008
-> BC-040
-> business_strategy.increase_revenue
-> strategy.retain_existing_customers
-> measure.community_knowledge_platform
-> BC-015
-> requirement.community_question_triage_time
-> architecture_artifact.community_knowledge_platform
-> data_model.community_question / api_artifact.community_questions
-> implementation_artifact.community_question_triage
-> test_artifact.community_question_triage_time
-> validation_artifact.community_response_sla
```

KI Cost Protection:

```text
BR-006
-> BC-041
-> measure.ai_usage_monitoring
-> system_capability.admin_ai_usage_monitoring
-> requirement.ai_admin_usage_dashboard
-> architecture_artifact.ai_usage_observability
-> app.admin_tool
-> system_capability.admin_ai_usage_monitoring
```

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
- `CJ-008`: Administrator pflegt Grants und Hardwarekatalog.
- `CJ-009`: Benutzer identifiziert sich in der IDE.
- `CJ-010`: Support prueft registriertes Board.
- `CJ-011`: Benutzer kauft passende Hardware in der IDE.

## Projekt-Traceability

Regel:

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

Projekte besitzen keine direkten Upstream-Beziehungen zu Vision, Business Goals, Customer Journeys, Business Capabilities, Requirements, Monetarisierung, KPIs oder Strategien.

Aktuelle Learning-Path-Zuordnung:

- `learning_path.ai_pet_embedded_interaction` -> `project.tamagotchi_entry_course`
- `learning_path.automation_control_and_regulation` -> `project.smart_plant_watering`
- `learning_path.embedded_access_control` -> `project.rfid_safe`
- `learning_path.maker_access_and_mechanics` -> `project.book_vault`
- `learning_path.workshop_inventory_and_tooling` -> `project.kanban_gridfinity_inventory`
- `learning_path.cross_platform_development` -> Cross-Platform-Tamagotchi-Projekte

## Kaufbare Learning-Angebote

- `product_offering.embedded_basics_bundle`: Embedded Grundlagen Gesamtpaket
- `product_offering.ai_credit_addon`: KI-Zusatzkontingent
- `product_offering.book_vault_hardware_bundle`: Buchtresor Hardware-Bundle
- `course.home_automation_understand_and_extend`: Hausautomatisierung verstehen und erweitern
- `course.embedded_games_programming`: Embedded Spiele programmieren
- `learning_unit.home_automation_understand_and_extend`: Learning-Einheit fuer individuelle, schrittweise erweiterbare Hausautomatisierung
- `learning_goal.home_automation_topologies`: Vergleich von Embedded-only, PC-/Mobile-App-Anbindung, HomeServer, verteiltem IoT und intelligenten Edge-Devices
- `learning_goal.home_automation_app_integration`: Statuswerte von Embedded Devices in PC-Software oder Mobile-App sichtbar machen
- `learning_goal.cross_platform_development`: Anwendungen fuer Embedded, Desktop, Mobile, Web und Cloud entwickeln und Zielsysteme vergleichen
- `learning_path.cross_platform_development`: Durchgaengiger Lernpfad mit austauschbarer Tamagotchi-Beispieldomaene

## Cross-Platform Development

Fuehrende YAML-Quellen:

- `data/learning/learning-goals.yaml`
- `data/learning/learning-paths.yaml`
- `data/learning/projects/cross-platform-tamagotchi.yaml`

Trennung:

- Das Learning Goal ist `learning_goal.cross_platform_development`.
- Der Learning Path ist `learning_path.cross_platform_development`.
- Das digitale Tamagotchi ist `example_domain.digital_tamagotchi` und darf ausgetauscht werden.

Learning-Path-Projekte:

- `project.cross_platform_tamagotchi.embedded`
- `project.cross_platform_tamagotchi.desktop`
- `project.cross_platform_tamagotchi.mobile`
- `project.cross_platform_tamagotchi.web`
- `project.cross_platform_tamagotchi.cloud`
- `project.cross_platform_tamagotchi.synchronization`
- `project.cross_platform_tamagotchi.ai_extension` optional

## KI-Community-Assistent

Fuehrende YAML-Quellen:

- `data/business/community-domain.yaml`
- `data/features/community-features.yaml`
- `data/requirements/business-requirements.yaml`
- `data/architecture/artifacts.yaml`
- `data/data-models/data-models.yaml`
- `data/api/api-artifacts.yaml`
- `data/ui/ui-models.yaml`
- `data/events/events.yaml`
- `data/authorization/system-capabilities.yaml`

Traceability:

```text
learning_path.community_knowledge_usage
-> business_domain.community
-> BC-040
-> requirement.community_ai_assistant_query
-> architecture_artifact.community_ai_assistant
```

Regel:

- Keine direkten neuen Beziehungen zu Vision, Business Goals oder Customer Journeys.
- Die normale Community bleibt kostenlos.
- `product_offering.community_ai_assistant_premium` ist die kostenpflichtige Premium-Funktion.
- Nutzung wird ueber `system_capability.community_ai_assistant`, Credits, Limits und Usage Events kontrolliert.

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
- `capability.mechanical_locking`
- `capability.fallback_unlock`
- `capability.item_identification`

SystemCapabilities:

- `system_capability.ide_flash_usb`
- `system_capability.ide_flash_ota`
- `system_capability.ai_assistant`
- `system_capability.ai_premium_models`
- `system_capability.admin_ai_usage_monitoring`
- `system_capability.admin_ai_cost_controls`
- `system_capability.admin_grants`
- `system_capability.admin_product_ideas`
- `system_capability.admin_project_ideas`
- `system_capability.admin_courses`
- `system_capability.account_identification`
- `system_capability.support_registered_board_check`
- `system_capability.hardware_shop_access`
- `system_capability.cloud_flash`

## Architektur-Strukturelemente

- `app.user_ide`: realisiert Lernen, einfache IDE-Nutzung, Kundenidentifikation, Hardware-Shop-Zugang, berechtigte Services und Cloud-/OTA-Flash.
- `app.hardware_shop`: realisiert den komfortablen Hardwareeinstieg in der IDE.
- `app.admin_tool`: realisiert Verwaltung von Grants, Hardwarekatalog, Hardwaretypen, Accounts und Berechtigungen.
- `app.recovery_tool`: unterstuetzt Wiederherstellung und Supportpruefung registrierter Boards.
- `app.provisioning_tool`: unterstuetzt Inbetriebnahme, vorbespielte Firmware, Registrierung, Pairing, Cloud-/OTA-Flash-Vorbereitung und Support-/Reklamationsnachweis.

## Requirements

Es gibt aktuell ein klares Requirements-Regelmodell:

- Requirements beschreiben das Warum.
- Work Packages beschreiben das Was.
- Implementierung beschreibt das Wie.
- Die Dekomposition endet bei Work Packages.

Non-Functional Requirements:

- `nfr.firmware_flash_must_not_brick_board`: Firmware-Flash ueber USB, OTA oder Cloud/OTA darf Boards nicht dauerhaft unbrauchbar machen.
- `nfr.ai_cost_protection_auditability`: KI-Kostenkontrolle und Admin-Eingriffe muessen auditierbar und serverseitig pruefbar sein.

Status:

- Erste konkrete Business-Requirements existieren unter `data/requirements/business-requirements.yaml`.
- `gap.concrete_requirements_missing` bleibt teilweise offen: Eine vollstaendige Requirement-Abdeckung pro Customer Journey und Projekt fehlt noch.

## Technische Entscheidungen

- `architecture.yaml_first_repository`: SQLite-Graph-first Repository-Struktur.
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
- `risk.board_bricked_by_flash`

Offene Punkte:

- `gap.concrete_requirements_missing`
- `gap.capability_catalog_missing` ist initial mitigiert; Detailmodellierung der TechnicalCapabilities fehlt noch.
- `gap.task_model_missing`
- `open_question.account_skill_level_scope`
- `open_question.teacher_plan_scope`

## Konsistenzbefund

- Produkte ohne Business Goal: keine kritische Luecke; Produkte sind ueber Vision und Ziele begruendet.
- Requirements ohne Produkt/Capability: erste Business-Requirements sind ueber Business Capabilities abgeleitet; vollstaendige Abdeckung fuer alle Customer Journeys und Projekte fehlt noch.
- Capabilities ohne Projektbezug: die erfassten TechnicalCapabilities liegen initial in `data/hardware/technical-capabilities.yaml`; Detailattribute und Kategorien fehlen noch.
- Technische Entscheidungen ohne Architekturbezug: keine kritische Luecke; Entscheidungen sind Architektur- oder Metamodellbausteinen zugeordnet.
- Offene Fragen ohne Entitaet: zwei zentrale offene Fragen wurden als eigene Entitaeten modelliert.
- Tasks ohne Zielbezug: Task-Entitaeten fehlen noch.
- Widerspruechliche Begriffe: "Capability" ist geklaert in `TechnicalCapability` und `SystemCapability`; alte allgemeine Verwendung bleibt als Risiko fuer Alttexte sichtbar.
