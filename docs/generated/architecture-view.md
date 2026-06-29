# Architecture View

Diese Datei ist eine generierte Lesesicht auf technische Entscheidungen, Architekturbausteine und Datenmodelllogik.
YAML bleibt die Source of Truth.

## Zentrale Architekturentscheidungen

- `architecture.yaml_first_repository`: YAML ist Source of Truth, Markdown ist generierter Output.
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
YAML -> Datenbank -> generierte Dokumentation
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

- `app.user_ide`: Nutzerwerkzeug fuer einfache Embedded-Entwicklung, Projektbearbeitung, Flashen und Pairing-Code-Eingabe.
- `app.admin_tool`: Verwaltungswerkzeug fuer Inhalte, Hardware-Katalog, Capabilities, Accounts und Berechtigungen.
- `app.recovery_tool`: Wiederherstellungswerkzeug fuer Boards, USB-Erkennung, erneute Registrierung und Credential-Recovery.
- `app.provisioning_tool`: Inbetriebnahme-Werkzeug fuer Erstinstallation, Firmware, Credentials, Registrierung und Pairing-Vorbereitung.

Diese Elemente sind grundlegende Architektur-Strukturelemente. Sie sind keine LearningProjects und keine technischen Detail-Tasks.

## Hardware und Software

Hardware wird ueber TechnicalCapabilities beschrieben.
Projekte referenzieren Capabilities, nicht konkrete Hardware.

Software-Module in Projekt-YAMLs sind fachliche Bausteine, keine Code-Module.

## Cloud, OTA, KI

- OTA gehoert zum Device Management und setzt gepairte Boards mit aktivem Credential voraus.
- Recovery Tool und Provisioning Tool gehoeren fachlich zum Device Management.
- Die User IDE ist Konsument der Fachdomaenen und besitzt moeglichst keine eigene Fachlogik.
- Das Admin Tool ist ein Cross-Domain-Verwaltungswerkzeug, besitzt aber nicht die Fachlogik der verwalteten Domaenen.
- KI/OpenAI ist aktuell optionaler Adapter fuer das KI-Haustier.
- Cloud-Anbindung ist in der Pflanzenbewaesserung als spaetere Ausbaustufe modelliert, aber noch nicht als zentrale Architektur-Entitaet ausgearbeitet.

## Architektur-Gaps

- Zentraler Capability-Katalog wurde initial unter `data/hardware/technical-capabilities.yaml` angelegt; Detailmodellierung fehlt noch.
- Zentrale Hardware-Komponenten-Dateien fehlen.
- Zentrale Software-Module-Dateien fehlen.
- Konkretes Datenbankschema ist bewusst noch nicht abgeleitet.
- Generierung von Markdown/Mermaid aus YAML ist noch nicht implementiert.
