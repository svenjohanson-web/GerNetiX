# Review - Metamodell Learning Platform

Dieses Dokument sammelt den Abgleich zum initialen erweiterten Metamodell-Vorschlag.
Der Vorschlag ist eine Arbeitsgrundlage, aber noch nicht die finale Single Source of Truth.

## Grundsatz fuer den Review

- Das Metamodell bleibt die fachliche Quelle der Wahrheit.
- Die Grafik ist ein Vorschlag und muss gegen Begriffe, Beziehungen, Kardinalitaeten und Regeln geprueft werden.
- Unklare oder widerspruechliche Stellen werden nicht still uebernommen, sondern als Modellfrage dokumentiert.

## Gute und tragfaehige Anteile

- Die Trennung in Ebenen ist sinnvoll:
  Business und Kompetenz, Lernpfad, Projektinhalt, Hardware-Katalog, Account und Lernzustand, Berechtigungen, Device Management.
- `TechnicalConstraint` und `TechnicalCapability` sind fachlich richtig getrennt.
- `HardwareItem` als abstraktes Konzept mit Spezialisierungen ist sinnvoll.
- `RegisteredProcessorBoard` ist korrekt als konkretes gekoppeltes Board getrennt vom Produkttyp `ProcessorBoard`.
- `Plan`, `PlanSystemCapability` und `AccountSystemCapabilityOverride` bilden eine gute Grundlage fuer effektive Berechtigungen.
- Lernfortschritt wird nicht nur am Projekt, sondern auch an Kompetenzen sichtbar.

## Wahrscheinliche Modellfehler oder Unschärfen

### 1. Capability ist doppeldeutig

Es gibt mindestens zwei verschiedene Capability-Begriffe:

- `TechnicalCapability`: technische Faehigkeit von Hardware, z. B. WiFi, ADC, I2C.
- `SystemCapability`: System- oder Produktberechtigung, z. B. `ide.flash.ota`.

Diese Begriffe duerfen nicht vermischt werden.

Vorschlag:

- `TechnicalCapability` bleibt in der Hardware-Domaene.
- `SystemCapability` wird fuer Berechtigungen genutzt.
- `Capability` alleine sollte vermieden werden, wenn dadurch Mehrdeutigkeit entsteht.

Namensentscheidung in Pruefung:

- `GrandCapability` sollte nicht verwendet werden, weil "grand" im Englischen nicht "gewaehren" bedeutet.
- `GrantCapability` waere sprachlich naeher an "Berechtigung gewaehren", beschreibt aber eher den Vorgang oder die Zuordnung als die eigentliche Systemfaehigkeit.
- `SystemCapability` ist der festgelegte Begriff fuer eine pruefbare Systemberechtigung.
- Die Vergabe einer Systemberechtigung an einen Plan sollte separat modelliert werden, z. B. als `PlanSystemCapability`.
- Eine Ausnahme auf Account-Ebene sollte separat modelliert werden, z. B. als `AccountSystemCapabilityOverride`.

### 2. Vereinfachtes Competency-Modell

Geklaerte Modellregel:

- Es gibt aktuell nur die Klasse `Competency`.
- Es werden keine zusaetzlichen Klassen wie `TargetCompetency`, `RequiredCompetency` oder `ProjectCompetency` eingefuehrt.
- Es werden keine zusaetzlichen Level wie `RequiredLevel`, `TargetLevel` oder `DevelopedLevel` modelliert.
- Komplexitaet wird erst eingefuehrt, wenn sie einen konkreten fachlichen Mehrwert liefert.

Beziehungen:

- `LearningGoal` requires `Competency`.
- Ein `LearningGoal` definiert die Kompetenzen, die nach Abschluss vorhanden sein sollen.
- `LearningProject` develops `Competency`.
- Ein `LearningProject` entwickelt eine oder mehrere Competencies.
- Die Kompetenzen entstehen durch das vollstaendige Durchlaufen des Projektes.

Nicht im aktuellen Modell:

- `TargetCompetency`
- `RequiredCompetency`
- `ProjectCompetency`
- `RequiredLevel`
- `TargetLevel`
- `DevelopedLevel`

Zukunftsoption:

- `LearningGoalCompetency` mit `requiredLevel`
- `ProjectCompetency` mit `developedLevel`

Geklaerte Beispiele fuer `LearningGoal`:

- Embedded Grundlagen
- Embedded Fortgeschrittene
- IoT
- Robotik

### 3. Richtung zwischen LearningGoal und LearningPath

Die Richtung sollte fachlich eindeutig sein.

Vorschlag:

- Ein `LearningPath` verfolgt genau ein `LearningGoal`.
- Ein `LearningGoal` kann mehrere `LearningPath` haben.

Damit bleibt der Lernpfad eine didaktische Route zu einem Ziel.

### 4. ProjectFlowItem als Ablaufobjekt

Geklaerte Umbenennung:

`ProjectContentItem` wird zu `ProjectFlowItem`.

Begruendung:

- Die Klasse speichert keine Inhalte.
- Sie beschreibt den didaktischen Ablauf eines Projektes.
- Sie definiert die Reihenfolge einzelner Projektbestandteile.
- `Lesson` und `ProjectStep` bleiben dadurch vollstaendig wiederverwendbar.

Modellregel:

- Ein `ProjectFlowItem` verweist auf genau ein konkretes Inhaltsobjekt.
- Der `itemType` muss zum referenzierten Objekt passen.
- Die Reihenfolge wird ausschliesslich durch `ProjectFlowItem.orderIndex` bestimmt.
- `ProjectFlowItem` besitzt keine eigene Fachlogik.
- Dasselbe Muster existiert bereits mit `LearningPathStep`.
- `ProjectIntroduction` ist kein `ProjectFlowItem`.
- Die eigentliche Projektreihenfolge beginnt nach der Einleitung mit dem ersten `ProjectFlowItem`.

Geklaerte Regel zu `ProjectIntroduction`:

- `ProjectIntroduction` ist kein referenzierbarer Inhaltstyp.
- `ProjectIntroduction` ist Bestandteil eines `LearningProject`.
- `LearningProject` 1 composition 1 `ProjectIntroduction`.
- Eine `ProjectIntroduction` existiert niemals ohne ihr `LearningProject`.
- `ProjectIntroduction` wird nicht zwischen Projekten wiederverwendet.

### 5. Lesson und ProjectStep Abhaengigkeiten

Geklaerte Modellregel:

- PreConditions und PostConditions werden nicht als Freitext an `Lesson` oder `ProjectStep` modelliert.
- Stattdessen wird die eigenstaendige Entitaet `Condition` eingefuehrt.
- `Condition` beschreibt einen gewuenschten oder erforderlichen Systemzustand.
- `Lesson` requires `Condition`.
- `Lesson` ensures `Condition`.
- `ProjectStep` requires `Condition`.
- `ProjectStep` ensures `Condition`.

Attribute:

- id
- title
- description
- targetState
- setupGuide
- validationMethod
- category

Regeln:

- Conditions beschreiben Zustaende, nicht Ablaeufe.
- Lessons und ProjectSteps beschreiben Ablaeufe.
- Wiederkehrende Zustaende duerfen niemals mehrfach als Freitext beschrieben werden.
- Conditions dienen als Wissensbaustein, Engineering-Dokumentation, Validierungsgrundlage und Wiedereinstiegshilfe.

### 6. ProjectVariant und TechnicalConstraint

Geklaerte Modellregel:

- `ProjectVariant` besitzt `TechnicalConstraint`.
- `TechnicalConstraint` wird durch `TechnicalCapability` erfuellt.
- `TechnicalConstraint` erhaelt das Attribut `constraintType`.
- `constraintType` hat in Version 1 die Werte `mandatory` und `optional`.
- Fehlende mandatory Constraints machen eine Projektvariante technisch nicht durchfuehrbar.
- Fehlende optional Constraints verhindern niemals den Projektstart.

Matching:

- Das Matching erfolgt ausschliesslich ueber `TechnicalConstraint` und `TechnicalCapability`.
- Das Matching erfolgt nicht ueber konkrete Hardware.
- `HardwareItem` stellt `TechnicalCapability` bereit.
- `TechnicalConstraint` verlangt `TechnicalCapability`.
- Die Plattform bewertet niemals Hardware direkt.
- Sie bewertet nur, ob die Constraints einer `ProjectVariant` durch vorhandene Capabilities erfuellt werden.

Zukunftsoptionen:

- recommended
- alternative
- preferred
- deprecated

### 7. AccountSkillLevel

Die Grafik deutet eine domaenenbezogene Erfahrungsstufe an.

Zu klaeren:

- Hat ein Account genau ein globales SkillLevel?
- Oder mehrere SkillLevels pro Domaene?
- Oder beides: globales Level plus domaenenspezifische Level?

Vorschlag:

- `AccountSkillLevel` ist domaenenbezogen.
- Ein `Account` kann mehrere `AccountSkillLevel` haben.

### 8. AccountProjectProgress und aktueller Ablaufpunkt

Geklaerte Modellregel:

- Der `Account` speichert keine Projektdetails direkt.
- `AccountProjectProgress` beschreibt den Bearbeitungszustand eines konkreten Projektes fuer einen bestimmten Benutzer.
- `AccountProjectProgress` bildet den aktuellen Arbeitskontext des Nutzers ab.

Attribute:

- id
- accountId
- learningPathId
- learningProjectId
- projectVariantId
- currentProjectFlowItemId
- status
- startedAt
- lastSeenAt
- completedAt

Regeln:

- Ein Benutzer kann mehrere Projekte gleichzeitig bearbeiten.
- Ein Benutzer kann ein Projekt pausieren.
- Ein Benutzer kann Projekte in unterschiedlichen Lernpfaden bearbeiten.
- Ein `LearningProject` kann Bestandteil mehrerer `LearningPath` sein.
- Deshalb muss gespeichert werden, ueber welchen `LearningPath` das Projekt gestartet wurde.
- Der aktuelle Fortschritt wird ueber `currentProjectFlowItemId` gespeichert.
- Dadurch koennen Lesson, ProjectStep, Summary und spaeter Quiz einheitlich verfolgt werden.

### 9. Berechtigungspruefung und Vorrangregeln

Geklaerte Modellregel:

Effektive Berechtigungen eines Accounts werden aus drei Ebenen berechnet:

1. System Default
2. Plan
3. Account Override

Berechnungsprioritaet:

1. Account Override
2. Plan
3. System Default

Regeln:

- System Default ist normalerweise `DENY`.
- Der Plan vergibt Standardrechte.
- Account Overrides ueberschreiben den Plan.
- Overrides koennen `ALLOW` oder `DENY` sein.
- Overrides koennen gueltig ab, gueltig bis und eine Begruendung besitzen.
- Existieren mehrere gueltige Overrides, hat `DENY` Vorrang vor `ALLOW`.
- Nach Ablauf eines zeitlich begrenzten Overrides gilt wieder der Plan.

Algorithmus:

1. benoetigte `SystemCapability` bestimmen.
2. gueltige `AccountSystemCapabilityOverride` pruefen.
3. wenn gueltige Overrides existieren, gewinnt `DENY` vor `ALLOW`.
4. wenn kein gueltiger Override existiert, `PlanSystemCapability` pruefen.
5. wenn keine Planentscheidung existiert, System Default verwenden.
6. Entscheidung als Nachweis protokollierbar machen.

### 10. RegisteredProcessorBoard Lifecycle

Geklaerte Modellregel:

- `ProcessorBoard` beschreibt den Produkttyp.
- `RegisteredProcessorBoard` beschreibt das konkrete physische Board.
- `BoardCredential` authentisiert ein konkretes Board per HMAC.
- Pairing ordnet ein `RegisteredProcessorBoard` einem `Account` zu.
- Pairing darf den Besitzer aendern, aber niemals den `ProcessorBoard`-Typ.

Statuswerte fuer `RegisteredProcessorBoard`:

- created
- provisioning
- paired
- active
- inactive
- lost
- revoked
- retired

Statuswerte fuer `BoardCredential`:

- created
- active
- rotating
- revoked
- expired

Statuswerte fuer Firmware:

- unknown
- installed
- update_available
- update_pending
- updating
- update_failed
- verified
- rollback_required

Statuswerte fuer OTA:

- not_supported
- not_configured
- configured
- reachable
- unreachable
- update_in_progress
- failed
- disabled

Pairing-Wege:

- Board Webserver
- Recovery Tool
- Provisioning Tool
- IDE Pairing

Sicherheitsregel:

- Ein Board authentisiert sich immer ueber HMAC.
- Der HMAC-Schluessel wird niemals im Klartext gespeichert.
- Das Backend prueft Board, Credential, Timestamp, Nonce und Signatur.

## Korrekturvorschlaege fuer das Metamodell

### Begriffskorrekturen

- `Capability` im Berechtigungskontext ist in `SystemCapability` umzubenennen.
- `AccountCapabilityOverride` ist in `AccountSystemCapabilityOverride` umzubenennen.
- `PlanCapability` ist in `PlanSystemCapability` umzubenennen.
- `TechnicalCapability` bleibt unveraendert.

### Beziehungsregeln

- `Course` enthaelt mehrere `LearningGoal`.
- `LearningGoal` requires mehrere `Competency`.
- `LearningPath` verfolgt genau ein `LearningGoal`.
- `LearningPathStep` verweist auf genau ein `LearningProject`.
- `LearningProject` develops `Competency` als n:m-Beziehung.
- Ein `LearningProject` muss mindestens eine `Competency` entwickeln.
- Eine `Competency` kann durch beliebig viele `LearningProject` entwickelt werden.
- `LearningProject` beschreibt nur die fachliche Lerneinheit.
- `LearningProject` bleibt unabhaengig von Hardware, Account, Device Management und Authorization.
- `LearningProject` besitzt genau eine `ProjectIntroduction` als Komposition.
- `LearningProject` besitzt mehrere `ProjectFlowItem`.
- `ProjectFlowItem` verweist auf genau ein konkretes Inhaltsobjekt.
- `ProjectFlowItem.orderIndex` bestimmt die Reihenfolge im Projekt.
- `Condition` beschreibt wiederverwendbare Systemzustaende.
- `Lesson` und `ProjectStep` referenzieren `Condition` ueber requires und ensures.
- `ProjectVariant` besitzt mehrere `TechnicalConstraint`.
- `TechnicalConstraint` wird durch eine oder mehrere `TechnicalCapability` erfuellt.
- `TechnicalConstraint.constraintType` ist `mandatory` oder `optional`.
- Matching erfolgt ueber `TechnicalConstraint` und `TechnicalCapability`, nicht ueber konkrete Hardware.
- `HardwareItem` realisiert mehrere `TechnicalCapability`.
- `AccountProjectProgress` verweist auf den aktuellen `ProjectFlowItem`.
- `AccountProjectProgress` gehoert zu einem `LearningPath`, damit der Ursprung des Projektstarts nachvollziehbar bleibt.
- Ein `LearningPath` gilt als vollstaendig, wenn die Vereinigung aller durch seine `LearningProject` entwickelten `Competency` alle vom zugehoerigen `LearningGoal` benoetigten `Competency` abdeckt.
- `AccountCompetencyProgress` beschreibt den automatisch berechneten Kompetenzstand eines Benutzers.
- `AccountCompetencyProgress.status` hat die Werte `not_started`, `in_progress`, `achieved`.
- `not_started`: Es wurde noch kein `LearningProject` begonnen, das diese `Competency` entwickelt.
- `in_progress`: Mindestens ein `LearningProject`, das diese `Competency` entwickelt, wurde begonnen, aber noch nicht ausreichend abgeschlossen.
- `achieved`: Mindestens ein relevantes `LearningProject`, das diese `Competency` entwickelt, wurde erfolgreich abgeschlossen.
- `AccountCompetencyEvidence` belegt, durch welche `LearningProject` eine Kompetenz aufgebaut wurde.
- `validated` und `expired` werden aktuell nicht umgesetzt.
- `RegisteredProcessorBoard` beschreibt ein konkretes physisches Board, nicht den Produkttyp.
- `BoardCredential` authentisiert ein `RegisteredProcessorBoard` per HMAC.
- OTA darf nur fuer gepairte Boards mit aktivem Credential verwendet werden.

## Offene Entscheidungen fuer den naechsten Abgleich
