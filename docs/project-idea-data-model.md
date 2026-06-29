# Datenmodell fuer Projektideen

Dieses Dokument beschreibt ein strukturiertes Datenmodell fuer Projektideen der Embedded-Lernplattform.
Markdown bleibt ein lesbares Ausgabeformat, ist aber nicht die fuehrende Datenquelle.

## Grundsatz

Die fuehrende Quelle fuer Projektideen sind strukturierte Daten.
Bevorzugtes Format fuer die Pflege ist YAML, weil es fuer Menschen gut lesbar bleibt und spaeter in JSON, Datenbanktabellen oder generierte Markdown-Dokumentation ueberfuehrt werden kann.

Markdown-Dokumentation wird aus diesen Daten generiert oder halbautomatisch abgeleitet.

## Ziele

Das Modell soll:

- Projektideen strukturiert erfassbar machen
- spaeter in eine Datenbank ueberfuehrbar sein
- Markdown-Dokumentation generierbar machen
- viele Projekte wiederverwendbar abbilden
- einfache und komplexe Projekte unterstuetzen
- Lernziele, Kundennutzen und technische Ausbaustufen verknuepfen
- KI-gestuetzte Pflege erleichtern

## Vorschlag fuer YAML-Struktur

```yaml
schemaVersion: 1
id: project.example
slug: example-project
title: Beispielprojekt
status: draft
type: learning_project_idea
language: de

traceability:
  businessGoals:
    - BG-001
  customerJourneys:
    - CJ-003
  source: idea

summary:
  short: Kurze Zusammenfassung.
  problem: Welches Problem wird geloest?
  solution: Welche Loesungsidee verfolgt das Projekt?
  didacticCore: Welcher fachliche Kern wird vermittelt?

audience:
  primary:
    - Maker
  secondary:
    - Schulen
  notes: Zielgruppen steuern keine Berechtigungen.

customerValue:
  - Sichtbares Ergebnis
  - Praxisnaher Nutzen

learning:
  learningGoals:
    - Embedded Grundlagen
  competencies:
    core:
      - digitale Ausgaenge verwenden
    optional:
      - WLAN-Grundlagen verstehen

project:
  vision: Projektvision als lesbarer Text.
  motivation: Warum ist das Projekt fuer Nutzer motivierend?
  practicalContext:
    - Praxisbezug 1
    - Praxisbezug 2

concepts:
  foundations:
    - title: Fachbegriff
      description: Kurze fachliche Beschreibung.
  comparisons:
    - title: Vergleichsthema
      left:
        name: Variante A
        description: Beschreibung.
      right:
        name: Variante B
        description: Beschreibung.

architecture:
  hardware:
    variants:
      - id: variant.a
        title: Variante A
        focus:
          - Embedded-Grundlagen
        pros:
          - guenstig
        cons:
          - keine WLAN-Anbindung
        useCases:
          - Einsteigerprojekt
    components:
      mandatory:
        - Mikrocontroller
      optional:
        - Display
    sensors:
      - name: Sensorname
        notes: Bewertung oder Hinweis.
    actuators:
      - name: Aktorname
        notes: Bewertung oder Hinweis.
  software:
    modules:
      - id: module.core
        title: Core Module
        responsibility: Fachliche Aufgabe.
    offline:
      - Offline-Funktion
    online:
      - Online-Funktion

technicalConstraints:
  - id: constraint.processor
    type: mandatory
    capability: processor.board
    description: Benoetigtes ProcessorBoard.
  - id: constraint.wifi
    type: optional
    capability: communication.wifi
    description: Fuer Online-Funktionen.

stages:
  - id: stage.1
    title: Erste Ausbaustufe
    goal: Ziel der Stufe.
    features:
      - Feature
    learningFocus:
      - Kompetenz

extensions:
  functional:
    - Funktionale Erweiterung
  hardware:
    - Hardware-Erweiterung
  platform:
    - Plattform-Erweiterung

risks:
  functional:
    - Fachliches Risiko
  technical:
    - Technisches Risiko
  typicalMistakes:
    - Typischer Fehler

openDecisions:
  - id: decision.1
    question: Offene Entscheidung?
    options:
      - Option A
      - Option B
    impact: Warum ist die Entscheidung relevant?

roadmap:
  - phase: 1
    title: Projektdefinition
    goal: Ziel der Phase.
    outcomes:
      - Ergebnis

generatedDocuments:
  markdown:
    target: docs/project-example.md
    sections:
      - Projektvision
      - Kundennutzen
      - Lernziele
```

## Wichtigste Felder

`schemaVersion` beschreibt die Version der Datenstruktur.
Dadurch koennen spaetere Aenderungen kontrolliert migriert werden.

`id` ist eine stabile fachliche ID.
Sie sollte sich nicht aendern, auch wenn der Titel spaeter angepasst wird.

`slug` ist fuer Dateinamen, URLs und lesbare Pfade geeignet.

`status` beschreibt den Bearbeitungsstand, z. B. `draft`, `review`, `approved`, `deprecated`.

`traceability` verknuepft die Projektidee mit Business Goals, Customer Journeys und Quelle.
Damit bleibt nachvollziehbar, warum die Idee existiert.

`summary` enthaelt kurze, gut maschinenlesbare Zusammenfassungen.
Diese Felder eignen sich fuer Listen, Suchfunktionen und Uebersichten.

`audience` beschreibt Zielgruppen.
Zielgruppen steuern keine Berechtigungen und sind keine Metamodell-Artefakte.

`customerValue` beschreibt den Kundennutzen.
Dieser Bereich ist wichtig fuer Priorisierung und Produktentscheidung.

`learning` verbindet die Projektidee mit Learning Goals und Competencies.

`project` enthaelt laengere fachliche Texte wie Vision, Motivation und Praxisbezug.
Diese Inhalte sind fuer generierte Markdown-Dokumentation gut geeignet.

`concepts` beschreibt fachliche Grundlagen, Begriffe und Vergleiche.
Das ist besonders wichtig fuer didaktische Projekte.

`architecture` beschreibt moegliche Hardware- und Softwarebausteine auf fachlicher Ebene.
Es enthaelt keine Implementierung.

`technicalConstraints` verbindet Projektvarianten mit benoetigten TechnicalCapabilities.
Das passt spaeter zum Metamodell: `ProjectVariant -> TechnicalConstraint -> TechnicalCapability`.

`stages` beschreibt Ausbaustufen.
Dadurch koennen einfache Einsteigerprojekte und komplexe Folgeprojekte im selben Modell abgebildet werden.

`extensions` sammelt spaetere Erweiterungsoptionen.

`risks` dokumentiert Risiken und typische Fehlerquellen.

`openDecisions` haelt bewusst offene Entscheidungen strukturiert fest.

`roadmap` beschreibt die schrittweise fachliche Entwicklung.

`generatedDocuments` beschreibt, welche Dokumente aus den Daten erzeugt werden koennen.

## Beispiel

Ein erstes Beispiel liegt als strukturierte YAML-Datei vor:

[smart-plant-watering.yaml](../data/project-ideas/smart-plant-watering.yaml)

Die bestehende lesbare Projektdokumentation kann daraus spaeter generiert oder abgeglichen werden:

[project-smart-plant-watering.md](project-smart-plant-watering.md)

## Geeignet fuer Datenbanktabellen

Folgende Bereiche lassen sich spaeter gut normalisieren:

- `ProjectIdea`: id, slug, title, status, type, language
- `ProjectIdeaTraceability`: projectIdeaId, businessGoalId, customerJourneyId, source
- `ProjectIdeaAudience`: projectIdeaId, audienceName, audienceType
- `ProjectIdeaCustomerValue`: projectIdeaId, valueText, orderIndex
- `ProjectIdeaLearningGoal`: projectIdeaId, learningGoalId oder learningGoalName
- `ProjectIdeaCompetency`: projectIdeaId, competencyId oder competencyName, competencyType
- `ProjectIdeaHardwareVariant`: id, projectIdeaId, title, focus, notes
- `ProjectIdeaComponent`: projectIdeaId, componentName, requirementType
- `ProjectIdeaSensor`: projectIdeaId, sensorName, notes
- `ProjectIdeaActuator`: projectIdeaId, actuatorName, notes
- `ProjectIdeaSoftwareModule`: projectIdeaId, moduleId, title, responsibility
- `ProjectIdeaTechnicalConstraint`: projectIdeaId, variantId, constraintType, capabilityId, description
- `ProjectIdeaStage`: id, projectIdeaId, title, goal, orderIndex
- `ProjectIdeaStageFeature`: stageId, featureText, orderIndex
- `ProjectIdeaRisk`: projectIdeaId, riskType, riskText
- `ProjectIdeaOpenDecision`: projectIdeaId, question, impact, status
- `ProjectIdeaRoadmapPhase`: projectIdeaId, phaseNumber, title, goal

Diese Tabellen waeren spaeter gut fuer Web-App-Pflege, Suche, Filterung, Validierung und Reporting geeignet.

## Besser als generierte Markdown-Dokumentation

Folgende Inhalte duerfen strukturiert gespeichert werden, sind aber als Markdown besonders gut lesbar:

- Projektvision
- Kundennutzen als Fliesstext
- Praxisbezug
- didaktische Erklaerung von Steuerung und Regelung
- Begriffsdefinitionen mit Beispielen
- Vergleich von Varianten in lesbarer Form
- Risikoerklaerungen
- Roadmap-Erlaeuterungen
- Review- oder Entscheidungstexte

Markdown eignet sich also als Leseschicht.
YAML oder JSON bleibt die fuehrende Datenquelle.

## Designentscheidung

Projektideen werden langfristig nicht primaer als lose Markdown-Dateien gepflegt.

Fuehrend ist:

```text
YAML/JSON -> Datenbank -> generierte Dokumentation
```

Nicht fuehrend ist:

```text
Markdown -> manuell rekonstruierte Daten
```

Damit bleibt das Engineering-Wissen strukturiert, validierbar und spaeter automatisiert weiterverarbeitbar.
