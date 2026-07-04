# SQLite-Graph-first Repository-Struktur

Dieses Dokument beschreibt eine SQLite-Graph-first Struktur fuer die Embedded-Lernplattform.
Markdown ist nur Ausgabe- und Lesbarkeitsformat.

Hinweis: Dieses Dokument ist aus der frueheren YAML-first-Planung hervorgegangen.
Die aktuelle Zielarchitektur fuehrt den validierten SQLite-Graphen als kanonische Pflege-, Pruef- und Abfragestruktur.
YAML ist nur noch Legacy-Import, Bootstrap oder Export.

## Grundsatz

Fuehrend ist:

```text
SQLite Graph Model -> optionaler YAML Export -> generierte Dokumentation
```

Nicht fuehrend ist:

```text
Markdown -> manuell rekonstruierte Daten
```

Alle fachlichen Beziehungen werden ueber stabile IDs hergestellt.

Aktuelle fuehrende YAML-Quellen liegen unter:

- `data/business/`
- `data/learning/`
- `data/hardware/`
- `data/authorization/`
- `data/architecture/`
- `data/risks/`
- `data/gaps/`
- `model/`

Markdown-Dateien unter `docs/` dienen der Lesbarkeit und werden langfristig aus YAML erzeugt oder gegen YAML validiert.

## Empfohlener Ordneraufbau

```text
data/
  catalog/
    products/
    product-ideas/
    audiences/
    value-propositions/
  learning/
    learning-goals/
    competencies/
    learning-paths/
    projects/
    project-stages/
    software-modules/
  hardware/
    components/
    processor-boards/
    sensors/
    actuators/
    displays/
    tools/
    power-supplies/
    capabilities/
    capability-categories/
  traceability/
    business-goals/
    customer-journeys/
    dependencies/
  governance/
    risks/
    open-decisions/
    roadmaps/
  generated/
    markdown/
```

Uebergangsweise kann `data/project-ideas/` weiter existieren.
Zielstruktur fuer konkrete Lernprojekte ist langfristig `data/learning/projects/`.

## Gemeinsame Pflichtfelder

Jede YAML-Datei sollte mindestens besitzen:

```yaml
schemaVersion: 1
id: domain.entity_name
type: entity_type
status: draft
title: Lesbarer Titel
ownerDomain: Learning
summary: Kurze Beschreibung
```

Empfohlene Statuswerte:

- draft
- review
- approved
- deprecated

## Produktideen

```yaml
schemaVersion: 1
id: product_idea.learning_platform
type: product_idea
status: draft
title: Learning Platform
ownerDomain: Business
problem: Einstieg und Weiterentwicklung in Embedded sind fuer viele Nutzer schwer.
targetAudiences:
  - audience.maker
businessGoals:
  - BG-001
valuePropositions:
  - value.guided_learning
resultingProducts:
  - product.learning_platform
```

## Projekte

```yaml
schemaVersion: 1
id: project.smart_plant_watering
type: learning_project
status: draft
title: Intelligente Pflanzenbewaesserungsstation
ownerDomain: Learning
businessGoals:
  - BG-002
customerJourneys:
  - CJ-003
audiences:
  primary:
    - audience.maker
valuePropositions:
  - value.practical_embedded_project
learningGoals:
  - learning_goal.embedded_basics
developsCompetencies:
  - competency.digital_outputs
variants:
  - id: project.smart_plant_watering.variant.arduino
    title: Arduino
    technicalConstraints:
      - capability.digital_output
stages:
  - stage.smart_plant_watering.1
risks:
  - risk.water_and_electronics
openDecisions:
  - decision.smart_plant_watering.start_variant
roadmap:
  - roadmap.smart_plant_watering
generatedDocuments:
  markdown: docs/generated/projects/smart-plant-watering.md
```

## Lernziele

```yaml
schemaVersion: 1
id: learning_goal.embedded_basics
type: learning_goal
status: draft
title: Embedded Grundlagen
ownerDomain: Learning
requiredCompetencies:
  - competency.digital_io
  - competency.flashing
  - competency.state_machine
```

## Zielgruppen

Zielgruppen sind Business-/Marketing-Daten und keine Metamodell-Artefakte.
Sie steuern keine Berechtigungen.

```yaml
schemaVersion: 1
id: audience.maker
type: audience
status: draft
title: Maker
ownerDomain: Business
description: Nutzer, die eigene technische Projekte bauen und erweitern moechten.
usedFor:
  - Vision
  - Business Goals
  - Customer Journeys
  - Marketing
```

## Kundennutzen / Value Propositions

```yaml
schemaVersion: 1
id: value.practical_embedded_project
type: value_proposition
status: draft
title: Praxisnahes Embedded-Projekt
ownerDomain: Business
customerBenefit: Nutzer erhalten ein sichtbares Ergebnis mit echtem Alltagsnutzen.
supportsBusinessGoals:
  - BG-001
  - BG-002
```

## Hardware-Komponenten

```yaml
schemaVersion: 1
id: hardware.component.small_water_pump
type: hardware_component
status: draft
title: Kleine Wasserpumpe
ownerDomain: Hardware
category: actuator
providesCapabilities:
  - capability.water_pumping
notes: Anschaulich fuer Einsteigerprojekte.
```

## Sensoren

```yaml
schemaVersion: 1
id: hardware.sensor.capacitive_soil_moisture
type: sensor
status: draft
title: Kapazitiver Bodenfeuchtigkeitssensor
ownerDomain: Hardware
providesCapabilities:
  - capability.soil_moisture_measurement
typicalProjects:
  - project.smart_plant_watering
```

## Aktoren

```yaml
schemaVersion: 1
id: hardware.actuator.servo
type: actuator
status: draft
title: Servo
ownerDomain: Hardware
providesCapabilities:
  - capability.rotary_motion
```

## Software-Module

Software-Module beschreiben fachliche Bausteine eines Projektes.
Sie sind keine Code-Module.

```yaml
schemaVersion: 1
id: software_module.state_engine
type: software_module
status: draft
title: State Engine
ownerDomain: Learning
responsibility: Beschreibt und verwaltet fachliche Zustaende.
developsCompetencies:
  - competency.state_machine
```

## Capabilities

Es muss zwischen `TechnicalCapability` und `SystemCapability` unterschieden werden.

```yaml
schemaVersion: 1
id: capability.wifi
type: technical_capability
status: draft
title: WiFi
ownerDomain: Hardware
category: capability_category.communication
```

```yaml
schemaVersion: 1
id: system_capability.ide_flash_ota
type: system_capability
status: draft
title: IDE OTA Flash
ownerDomain: Authorization
key: ide.flash.ota
```

## Ausbaustufen / Projektstufen

```yaml
schemaVersion: 1
id: stage.smart_plant_watering.1
type: project_stage
status: draft
title: Zeitgesteuerte Bewaesserung
ownerDomain: Learning
project: project.smart_plant_watering
orderIndex: 1
goal: Einfache Steuerung, Aktorik und Zeitlogik verstehen.
developsCompetencies:
  - competency.digital_outputs
```

## Lernpfade

```yaml
schemaVersion: 1
id: learning_path.automation_basics
type: learning_path
status: draft
title: Automatisierung Grundlagen
ownerDomain: Learning
learningGoal: learning_goal.embedded_basics
steps:
  - orderIndex: 1
    project: project.smart_plant_watering
    mandatory: true
  - orderIndex: 2
    project: project.rfid_safe
    mandatory: false
```

## Risiken

```yaml
schemaVersion: 1
id: risk.water_and_electronics
type: risk
status: draft
title: Wasser und Elektronik
ownerDomain: Learning
category: technical
description: Wasser kann Elektronik beschaedigen und muss didaktisch als Sicherheitsrisiko behandelt werden.
appliesTo:
  projects:
    - project.smart_plant_watering
```

## Offene Entscheidungen

```yaml
schemaVersion: 1
id: decision.smart_plant_watering.start_variant
type: open_decision
status: open
title: Startvariante fuer Pflanzenbewaesserung
ownerDomain: Learning
question: Soll das Projekt mit Arduino oder ESP32 starten?
options:
  - Arduino zuerst
  - ESP32 zuerst
impact: Beeinflusst Einstiegshoehe, Kosten und IoT-Ausbau.
```

## Roadmaps

```yaml
schemaVersion: 1
id: roadmap.smart_plant_watering
type: roadmap
status: draft
title: Roadmap Pflanzenbewaesserung
ownerDomain: Learning
items:
  - phase: 1
    title: Zeitsteuerung
    goal: Einstieg in Aktorik.
```

## Abhaengigkeiten

Abhaengigkeiten werden explizit modelliert, wenn sie ueber normale Referenzen hinausgehen.

```yaml
schemaVersion: 1
id: dependency.smart_plant_watering.requires_digital_output
type: dependency
status: draft
from: project.smart_plant_watering
to: capability.digital_output
relation: requires
reason: Aktorik benoetigt einen schaltbaren Ausgang.
```

## Beispielinstanzen

Erste Projektinstanzen:

- [ai-pet-esp32.yaml](../data/learning/projects/ai-pet-esp32.yaml)
- [smart-plant-watering.yaml](../data/learning/projects/smart-plant-watering.yaml)
- [rfid-safe.yaml](../data/learning/projects/rfid-safe.yaml)
- [kanban-gridfinity-inventory.yaml](../data/learning/projects/kanban-gridfinity-inventory.yaml)

## Datenbankfaehige YAML-Dateien

Sehr gut in Tabellen ueberfuehrbar sind:

- `products`
- `product-ideas`
- `audiences`
- `value-propositions`
- `learning-goals`
- `competencies`
- `learning-paths`
- `projects`
- `project-stages`
- `hardware/components`
- `hardware/sensors`
- `hardware/actuators`
- `hardware/capabilities`
- `software-modules`
- `risks`
- `open-decisions`
- `roadmaps`
- `dependencies`

Typische Tabellen:

- Product
- ProductIdea
- Audience
- ValueProposition
- LearningGoal
- Competency
- LearningPath
- LearningPathStep
- LearningProject
- ProjectVariant
- ProjectStage
- HardwareComponent
- TechnicalCapability
- ProjectTechnicalConstraint
- SoftwareModule
- Risk
- OpenDecision
- Roadmap
- RoadmapItem
- Dependency

## Generierbare Markdown-Dokumente

Aus YAML sollten automatisch erzeugt werden:

- Projektkatalog
- einzelne Projektdefinitionen
- Lernzieluebersicht
- Kompetenzmatrix
- Lernpfad-Dokumentation
- Hardware-Katalog
- Capability-Katalog
- Projekt-Hardware-Matching-Uebersichten
- Risiko-Register
- Entscheidungslog
- Roadmap-Uebersichten
- Traceability-Berichte

## Redundanzregeln

Redundanz vermeiden:

- Beziehungen immer ueber IDs herstellen.
- Capabilities zentral pflegen.
- Hardware zentral pflegen.
- Competencies zentral pflegen.
- Learning Goals zentral pflegen.
- Zielgruppen zentral pflegen.

Bewusste Redundanz erlauben:

- `summary.short` fuer schnelle Uebersichten.
- `title` neben IDs fuer menschliche Lesbarkeit.
- kurze `notes` in referenzierenden Dateien, wenn sie KI-Pflege erleichtern.
- generierte Markdown-Zusammenfassungen.
- denormalisierte Suchfelder, wenn sie spaeter fuer Web-App oder KI hilfreich sind.

Regel:

Die fachliche Wahrheit liegt in der referenzierten ID.
Lesetexte duerfen redundant sein, duerfen aber keine eigenstaendige Wahrheit erzeugen.
