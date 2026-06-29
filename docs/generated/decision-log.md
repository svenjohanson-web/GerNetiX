# Decision Log

Diese Datei ist eine generierte Lesesicht auf bereits getroffene Entscheidungen.
YAML bleibt die Source of Truth.

## Entscheidungen

### YAML-first Repository-Struktur

ID: `architecture.yaml_first_repository`

Entscheidung:

YAML ist Source of Truth. Markdown ist nur generierter Output.

Begruendung:

Projektideen und Plattformwissen sollen spaeter durch Web-App, Datenbank und automatische Dokumentation gepflegt werden koennen.

Alternativen:

- Markdown als fuehrende Quelle.

Auswirkung:

- YAML-Dateien muessen stabile IDs und Beziehungen enthalten.
- Markdown-Dateien unter `docs/generated/` sind Lesesichten.

Betroffene Entitaeten:

- `knowledge_base.distributed_engineering_knowledge`
- `component.database`
- `component.generated_markdown`

### Top-down-Entwicklung

ID: `architecture.top_down_development`

Entscheidung:

Die Reihenfolge ist Vision -> Business Goals -> Customer Journey -> Requirements -> Metamodell -> Datenmodell -> Implementierung -> Nachweis.

Begruendung:

Nachvollziehbarkeit hat Vorrang vor Implementierung.

Alternativen:

- direkt mit Code, Datenmodell oder Metamodell beginnen.

Auswirkung:

- Neue Metamodell-Klassen brauchen Customer Journey oder Requirement.

### Keine zentrale Knowledge-Domaene

ID: `architecture.no_central_knowledge_domain`

Entscheidung:

Es gibt keine zentrale Knowledge-Domaene.

Begruendung:

Wissen ist fachlich verteilt und entsteht aus Artefakten, Beziehungen und Traceability.

Auswirkung:

- Jede Domaene besitzt eigene Artefakte.
- Andere Domaenen referenzieren nur.

### Fachliche Heimatdomaene je Artefakt

ID: `architecture.domain_ownership`

Entscheidung:

Jedes Artefakt besitzt genau einen fachlichen Eigentuemer.

Auswirkung:

- Fremde Artefakte duerfen nicht kopiert oder fachlich erweitert werden.

### TechnicalCapability und SystemCapability trennen

ID: `architecture.capability_split`

Entscheidung:

Hardware-Faehigkeiten heissen `TechnicalCapability`; Produktberechtigungen heissen `SystemCapability`.

Begruendung:

Der Begriff Capability war doppeldeutig.

Auswirkung:

- Hardware-Matching nutzt TechnicalCapability.
- Berechtigungen nutzen SystemCapability.

### ProjectFlowItem statt ProjectContentItem

ID: `architecture.project_flow_item`

Entscheidung:

Die Reihenfolge im Projektablauf wird ueber ProjectFlowItem modelliert.

Begruendung:

Lessons und ProjectSteps bleiben wiederverwendbar.

Auswirkung:

- ProjectIntroduction ist kein ProjectFlowItem.
- Reihenfolge gehoert nicht an Lesson oder ProjectStep.

### Condition als eigenstaendiges Artefakt

ID: `architecture.condition_entity`

Entscheidung:

Pre- und PostConditions werden als Conditions modelliert.

Begruendung:

Wiederkehrende Systemzustaende duerfen nicht mehrfach als Freitext gepflegt werden.

Auswirkung:

- Lesson und ProjectStep referenzieren Conditions ueber requires und ensures.

### Berechtigungsprioritaet

ID: `architecture.permission_precedence`

Entscheidung:

AccountSystemCapabilityOverride gewinnt vor PlanSystemCapability, danach System Default. DENY gewinnt vor ALLOW.

Auswirkung:

- Rollen und Zielgruppen steuern keine Produktfunktionen.

### RegisteredProcessorBoard

ID: `architecture.registered_processor_board`

Entscheidung:

ProcessorBoard beschreibt Produkttyp; RegisteredProcessorBoard beschreibt konkretes physisches Board.

Auswirkung:

- Pairing aendert Besitzer, nicht Board-Typ.
- HMAC-Credential authentisiert das Board.
- OTA ist an Pairing und aktives Credential gebunden.

### Requirement-Dekomposition

ID: `requirement_model.decomposition_ends_at_work_package`

Entscheidung:

Requirements beschreiben das Warum; Work Packages das Was; Implementierung das Wie.

Auswirkung:

- APIs, Views, Services, Controller, Migrationen und Tests werden nicht als eigene Requirements modelliert.
