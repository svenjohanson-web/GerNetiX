# Architecture View

Diese Datei ist eine generierte Lesesicht auf technische Entscheidungen, Architekturbausteine und Datenmodelllogik.
Der validierte SQLite-Graph ist die kanonische Struktur.

## Zentrale Architekturentscheidungen

- `architecture.sqlite_graph_canonical_model`: SQLite-Graph ist kanonische Struktur; YAML ist Legacy-Import, Bootstrap oder Export.
- `architecture.yaml_first_repository`: abgeloeste YAML-first-Entscheidung.
- `architecture.top_down_development`: Business bestimmt Metamodell, Metamodell bestimmt Datenmodell, Datenmodell bestimmt Implementierung.
- `architecture.domain_ownership`: Jede Klasse besitzt genau eine fachliche Heimatdomaene.
- `architecture.no_central_knowledge_domain`: Keine zentrale Knowledge-Domaene.
- `architecture.capability_split`: TechnicalCapability und SystemCapability sind getrennt.
- `architecture.permission_precedence`: Account Override vor Plan vor System Default; DENY gewinnt.
- `architecture.registered_processor_board`: konkretes Board wird von Produkttyp getrennt.

## Domaenen

- Business
- Learning
- Hardware
- Device Management
- Authorization
- Account
- IDE

## Datenmodellrichtung

```text
SQLite Graph Model -> optionaler YAML Export -> generierte Dokumentation
```

Nicht:

```text
Markdown -> manuell rekonstruierte Daten
```

## Metamodell

`metamodel.learning_platform`

Wichtige Entitaetstypen:

- Course
- LearningGoal
- Competency
- LearningPath
- LearningPathStep
- LearningProject
- ProjectVariant
- ProjectIntroduction
- ProjectFlowItem
- Lesson
- ProjectStep
- Condition
- HardwareCatalog
- HardwareItem
- TechnicalCapability
- TechnicalConstraint
- RegisteredProcessorBoard
- BoardCredential
- AccountProjectProgress
- AccountCompetencyProgress
- Plan
- SystemCapability

## Architekturbausteine

- `component.backend`
- `component.frontend`
- `component.database`
- `component.generated_markdown`
- `component.openai_adapter`
- `component.ota`

## Architektur-Strukturelemente

Fuehrende Quelle:

- `data/architecture/structural-elements.yaml`

Strukturelemente:

- `app.user_ide`: Nutzerwerkzeug fuer Lernen, einfache Embedded-Entwicklung, komfortablen Hardwareeinstieg, Kundenidentifikation, berechtigte Services, Projektbearbeitung, Flashen und Pairing-Code-Eingabe.
- `app.hardware_shop`: Vertriebskanal fuer passende Hardware, der in der User IDE sichtbar wird.
- `app.admin_tool`: Verwaltungswerkzeug fuer Inhalte, Grants, Hardware-Katalog, neue Hardwaretypen, Capabilities, Accounts und Berechtigungen.
- `app.recovery_tool`: Wiederherstellungswerkzeug fuer Boards, USB-Erkennung, erneute Registrierung, Credential-Recovery und nachvollziehbare Supportpruefung.
- `app.provisioning_tool`: Inbetriebnahme-Werkzeug fuer Erstinstallation, vorbespielte Firmware, Credentials, Registrierung, Pairing-Vorbereitung, Cloud-/OTA-Flash-Vorbereitung und Absicherung von Support- und Reklamationsanspruechen.

Diese Elemente sind grundlegende Architektur-Strukturelemente. Sie sind keine LearningProjects und keine technischen Detail-Tasks.

## Hardware und Software

Hardware wird ueber TechnicalCapabilities beschrieben.
Projekte referenzieren Capabilities, nicht konkrete Hardware.

Software-Module in Projekt-YAMLs sind fachliche Bausteine, keine Code-Module.

## Cloud, OTA, KI

- OTA gehoert zum Device Management und setzt gepairte Boards mit aktivem Credential voraus.
- Firmware-Flashen ueber USB, OTA oder Cloud/OTA muss das NFR `nfr.firmware_flash_must_not_brick_board` erfuellen.
- Fehlgeschlagene Flash-Vorgaenge duerfen Boards nicht dauerhaft unbrauchbar machen und muessen einen definierten Recovery-Pfad besitzen.
- Recovery Tool und Provisioning Tool gehoeren fachlich zum Device Management.
- Die User IDE ist Konsument der Fachdomaenen und besitzt moeglichst keine eigene Fachlogik.
- Das Admin Tool ist ein Cross-Domain-Verwaltungswerkzeug, besitzt aber nicht die Fachlogik der verwalteten Domaenen.
- Register and Pairing dient auch dazu, Support- und Reklamationsansprueche fuer konkrete Boards nachvollziehbar zu pruefen.
- Das Admin Tool realisiert die Pflege von Grants und Hardwarekatalogeintraegen, z. B. neue ProcessorBoard-Typen.
- Das Admin Tool muss Produktideen, Projektideen, kaufbare Courses, Learning Goals, Projekte und Capabilities sichten und bearbeiten koennen.
- Die User IDE identifiziert den Nutzer, damit nur berechtigte Services angezeigt oder freigeschaltet werden.
- Die User IDE realisiert den Lernarbeitsplatz: Sie fuehrt durch LearningProjects, Lessons, ProjectSteps, ProjectFlowItems und Conditions, besitzt deren Fachlogik aber nicht.
- Der Hardware Shop wird in der User IDE realisiert und bietet passende Hardware fuer Lernziele und Projekte an.
- Verkaufte ProcessorBoards koennen mit Initial-Firmware vorbespielt werden.
- Cloud-/OTA-Flash setzt WiFi, OTA-faehige Firmware, Registrierung, Pairing und Berechtigung voraus.
- KI/OpenAI ist aktuell optionaler Adapter fuer das KI-Haustier.
- Kostenpflichtige KI-Nutzung wird ueber `architecture_artifact.ai_cost_protection` und `architecture_artifact.ai_usage_observability` kontrolliert.
- Das Admin Tool muss KI Usage Monitoring, Credit-Verbrauch, Token-Verbrauch, Kosten, Budgetnaehe, Fehler, Ablehnungen und Margen sichtbar machen.
- Admin-Kostensteuerung nutzt `system_capability.admin_ai_usage_monitoring` und `system_capability.admin_ai_cost_controls`.
- Der KI-Community-Assistent nutzt `architecture_artifact.community_ai_assistant` fuer RAG, Vektordatenbank, Embeddings, LLM, Prompt Templates, Quellenreferenzen und Conversation Memory.
- Der KI-Community-Assistent ist unter `business_domain.community` eingeordnet; Traceability nach oben laeuft ausschliesslich ueber Community-Domain und `learning_path.community_knowledge_usage`.
- Der KI-Community-Assistent erweitert das bestehende KI-Admin-Dashboard um aktive Premium-Nutzer, Antwortzeiten, Kosten pro Community, Cache-Trefferquote, RAG-Trefferquote, haeufigste Fragen und Budgetwarnungen.
- Cloud-Anbindung ist in der Pflanzenbewaesserung als spaetere Ausbaustufe modelliert, aber noch nicht als zentrale Architektur-Entitaet ausgearbeitet.

## Architektur-Gaps

- Zentraler Capability-Katalog wurde initial unter `data/hardware/technical-capabilities.yaml` angelegt; Detailmodellierung fehlt noch.
- Zentrale Hardware-Komponenten-Dateien fehlen.
- Zentrale Software-Module-Dateien fehlen.
- Konkretes Datenbankschema ist bewusst noch nicht abgeleitet.
- Generierung von Markdown/Mermaid aus YAML ist noch nicht implementiert.
