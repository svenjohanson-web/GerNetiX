# Domaenen

Alle Domaenen sind fachlich getrennt und greifen auf dieselbe Wissensbasis zu.
Jede Klasse besitzt genau eine fachliche Heimatdomaene.

Es existiert keine zentrale Domaene, die die gemeinsame Wissensbasis besitzt.
Das System besitzt keine zusaetzliche `Knowledge`-Domaene.
Die gemeinsame Wissensbasis entsteht durch eindeutige Artefakte, definierte Beziehungen, Traceability und Referenzen zwischen Domaenen.

Die Heimatdomaene:

- definiert die Klasse
- verwaltet den Lebenszyklus
- beschreibt die Fachlogik

Andere Domaenen duerfen Klassen referenzieren, besitzen sie jedoch nicht und duerfen deren Fachlogik nicht veraendern.

Nicht eine Domaene verwaltet das Wissen.
Alle Domaenen tragen gemeinsam zur Wissensbasis bei.
Die gemeinsame Wissensbasis entsteht aus der Summe der fachlich korrekt modellierten Artefakte und ihrer nachvollziehbaren Beziehungen.

## Uebersicht

- Business
- Learning
- Hardware
- Device Management
- Authorization
- Account
- IDE

## Architekturregeln

- Jede Klasse besitzt genau einen fachlichen Eigentuemer.
- Wissen ist fachlich verteilt.
- Es gibt keine zentrale Wissensdomaene.
- Abhaengigkeiten sollen grundsaetzlich in Richtung der Fachlogik erfolgen.
- Eine Domaene darf Klassen anderer Domaenen referenzieren.
- Eine Domaene darf fremde Klassen niemals besitzen oder deren Fachlogik veraendern.
- Eine Domaene darf fremde Artefakte niemals kopieren oder fachlich erweitern.
- Die IDE ist Konsument der Fachdomaenen und besitzt moeglichst keine eigene Fachlogik.
- Zielgruppen und Personas sind keine Metamodell-Artefakte.
- Zielgruppen, Rollen und Produktberechtigungen duerfen nicht vermischt werden.
- Rollen beschreiben administrative Aufgaben, aber keine Produktfunktionen.
- Plaene und SystemCapabilities beschreiben Produktfunktionen, aber keine Zielgruppen.

Beispielrichtung:

Business -> Learning -> Hardware

Nicht umgekehrt.

## Verantwortlichkeiten und erlaubte Referenzen

| Domaene | Verantwortlich fuer | Darf referenzieren |
| --- | --- | --- |
| Business | Product Offering, Course, Business Goal, Customer Journey | Learning |
| Learning | LearningGoal, Competency, LearningPath, LearningProject, Lesson, ProjectStep, ProjectFlowItem, ProjectVariant, Condition | Hardware, Authorization |
| Hardware | HardwareCatalog, HardwareItem, ProcessorBoard, Sensor, Actuator, Display, CommunicationModule, Tool, MeasurementDevice, PowerSupply, TechnicalCapability, TechnicalConstraint, CapabilityCategory | keine anderen Domaenen |
| Device Management | RegisteredProcessorBoard, Pairing, Provisioning, FirmwareState, OTAState, BoardCredential | Hardware, Account |
| Account | Account, HardwareInventory, AccountSkillLevel, AccountCompetencyProgress, AccountProjectProgress | Learning, Device Management, Authorization |
| Authorization | Role, Plan, SystemCapability, PlanSystemCapability, AccountSystemCapabilityOverride, Subscription | Account |
| IDE | keine eigene Fachlogik, Konsument der Fachdomaenen | Learning, Hardware, Device Management, Account, Authorization |

## Referenzierungsbeispiele

- `LearningProject` referenziert `TechnicalConstraint`.
- `HardwareItem` realisiert `TechnicalCapability`.
- `RegisteredProcessorBoard` referenziert `ProcessorBoard`.
- `AccountProjectProgress` referenziert `LearningProject`.
- `AccountProjectProgress` referenziert `LearningPath`.

## Learning

Der detaillierte aktuelle Stand ist in [metamodel-learning-platform.md](metamodel-learning-platform.md) beschrieben.

Struktur:

Course -> LearningGoal -> Competency

LearningGoal -> LearningPath -> LearningPathStep -> LearningProject -> ProjectVariant

LearningProject -> ProjectIntroduction

LearningProject -> ProjectFlowItem -> Lesson / ProjectStep / Summary / Quiz

Lesson / ProjectStep -> Condition

Regeln:

- Learning besitzt die Fachlogik fuer Lernziele, Lernpfade, Projekte, Inhalte, Projektvarianten und Conditions.
- Learning darf Hardware und Authorization referenzieren.
- LearningProjects entwickeln Kompetenzen.
- LearningProject ist die zentrale fachliche Lerneinheit.
- LearningProject beschreibt, was gebaut wird, warum es gebaut wird, welche Kompetenzen aufgebaut werden und wie das Projekt didaktisch ablaeuft.
- LearningProject enthaelt keine Hardware, keine Benutzer, keine Berechtigungen, keine Firmware und keine technische Machbarkeit.
- Hardwarebezug entsteht ausschliesslich ueber ProjectVariant -> TechnicalConstraint -> TechnicalCapability -> HardwareItem.
- ProjectIntroduction ist Bestandteil eines LearningProject und kein FlowItem.
- LearningPathSteps bestimmen die Reihenfolge im Lernpfad.
- ProjectFlowItems bestimmen die Reihenfolge im Projektablauf.
- Lessons erklaeren.
- ProjectSteps lassen den Nutzer handeln.
- Conditions beschreiben wiederverwendbare Systemzustaende.
- Lessons und ProjectSteps referenzieren Conditions ueber requires und ensures.

## Hardware

Der detaillierte aktuelle Stand ist in [metamodel-learning-platform.md](metamodel-learning-platform.md) beschrieben.

Struktur:

HardwareCatalog -> HardwareItem -> TechnicalCapability -> CapabilityCategory

ProjectVariant -> TechnicalConstraint -> TechnicalCapability

Regeln:

- Hardware beschreibt ausschliesslich technische Eigenschaften.
- Hardware darf keine anderen Domaenen referenzieren.
- HardwareCatalog enthaelt HardwareItems.
- HardwareItems realisieren TechnicalCapabilities.
- ProjectVariants besitzen TechnicalConstraints.
- TechnicalConstraints werden durch TechnicalCapabilities erfuellt.
- TechnicalConstraints sind in Version 1 `mandatory` oder `optional`.
- Fehlende mandatory Constraints machen eine ProjectVariant technisch nicht durchfuehrbar.
- Fehlende optional Constraints verhindern den Projektstart nicht.
- Matching erfolgt ueber TechnicalConstraint und TechnicalCapability, nicht ueber konkrete Hardware.

## Device Management

Device Management darf Hardware und Account referenzieren.

ProcessorBoard beschreibt den Produkttyp.

RegisteredProcessorBoard beschreibt das konkrete Board.

RegisteredProcessorBoard enthaelt:

- ownerAccountId
- pairingState
- provisioningState
- firmwareVersion
- otaEnabled
- boardCredentialId
- firstSeen
- lastSeen

Pairing erfolgt ueber:

- Board Webserver
- Recovery Tool
- Provisioning Tool
- IDE Pairing Code

Regeln:

- Ein RegisteredProcessorBoard gehoert maximal einem Account.
- Ein Account kann beliebig viele RegisteredProcessorBoards besitzen.
- Pro Board existiert genau ein aktives BoardCredential.
- Ein Board authentisiert sich immer ueber HMAC.
- OTA darf nur fuer gepairte Boards mit aktivem Credential verwendet werden.
- Verlorene oder widerrufene Boards duerfen keine OTA-Auftraege mehr erhalten.
- Pairing darf ausschliesslich den Besitzer eines RegisteredProcessorBoard aendern, niemals den ProcessorBoard-Typ.

RegisteredProcessorBoard Status:

- created
- provisioning
- paired
- active
- inactive
- lost
- revoked
- retired

BoardCredential Status:

- created
- active
- rotating
- revoked
- expired

Firmware Status:

- unknown
- installed
- update_available
- update_pending
- updating
- update_failed
- verified
- rollback_required

OTA Status:

- not_supported
- not_configured
- configured
- reachable
- unreachable
- update_in_progress
- failed
- disabled

## Authorization

Authorization darf ausschliesslich Account referenzieren.

Struktur:

Role

Plan -> SystemCapability -> PlanSystemCapability -> AccountSystemCapabilityOverride

Regeln:

- Role beschreibt administrative Aufgaben eines Accounts.
- Rollen steuern keine Produktfunktionen.
- Rollen ersetzen keine Plaene und keine SystemCapabilities.
- Plan definiert Standardrechte.
- PlanSystemCapability ordnet SystemCapabilities einem Plan zu.
- Overrides definieren Ausnahmen.
- AccountSystemCapabilityOverride ueberschreibt Planrechte.
- Effektive Berechtigungen werden in der Prioritaet Account Override, Plan, System Default berechnet.
- Bei mehreren gueltigen Overrides gewinnt DENY vor ALLOW.
- Zielgruppen und Personas werden bei der Berechtigungsberechnung nicht verwendet.
- Rollen werden bei der Berechtigungsberechnung fuer Produktfunktionen nicht verwendet.

## Account

Account darf Learning, Device Management und Authorization referenzieren.

Ein Account besitzt:

- Role
- Subscriptions
- SkillLevel
- CompetencyProgress
- CompetencyEvidence
- AccountProjectProgress
- HardwareInventory

Regeln:

- Der Account speichert keine Projektdetails direkt.
- Der komplette Projektfortschritt wird in `AccountProjectProgress` verwaltet.

AccountProjectProgress speichert:

- LearningPath
- LearningProject
- ProjectVariant
- aktueller ProjectFlowItem
- Status
- startedAt
- lastSeenAt
- completedAt

AccountCompetencyProgress speichert:

- accountId
- competencyId
- status
- achievedAt
- lastUpdated

AccountCompetencyEvidence speichert:

- id
- accountCompetencyProgressId
- learningProjectId
- projectVariantId (optional)
- achievedAt
