# Metamodell - Learning Platform

Dieses Dokument beschreibt den aktuellen fachlichen Metamodell-Stand fuer die Learning Platform.
Es ist Teil der gemeinsamen Wissensbasis und dient als Quelle fuer Requirements, Work Packages, Umsetzung, Tests und Dokumentation.

## 1. Business- und Kompetenzebene

### Course

Beschreibt ein kaufbares Lernangebot.

Beziehungen:

- enthaelt mehrere `LearningGoal`

### LearningGoal

Beschreibt das Ziel einer Ausbildung.

Beispiele:

- Embedded Grundlagen
- Embedded Fortgeschrittene
- IoT Grundlagen
- Robotik

Beziehungen:

- gehoert zu genau einem `Course`
- requires mehrere `Competency`

Regel:

- Ein `LearningGoal` definiert die Kompetenzen, die nach Abschluss vorhanden sein sollen.
- Es gibt aktuell keine separaten Klassen wie `TargetCompetency` oder `RequiredCompetency`.

### Competency

Beschreibt die Faehigkeiten, die nach Abschluss vorhanden sein sollen.

Beispiele:

- GPIO verwenden
- Compiler verstehen
- Flashen
- OTA konfigurieren
- Zustandsautomaten entwickeln

Regeln:

- `Competency` existiert genau einmal im Metamodell.
- Es werden aktuell keine zusaetzlichen Klassen wie `TargetCompetency`, `RequiredCompetency` oder `ProjectCompetency` eingefuehrt.
- Es werden aktuell keine zusaetzlichen Level wie `RequiredLevel`, `TargetLevel` oder `DevelopedLevel` modelliert.
- Kompetenzlevel koennen spaeter ueber Beziehungsklassen ergaenzt werden, wenn ein konkreter fachlicher Bedarf besteht.

## 2. Lernpfade

### LearningPath

Beschreibt eine didaktische Route.

Beispiele:

- Spielerischer Pfad
- Automatisierungspfad
- IoT-Pfad

Beziehungen:

- verfolgt genau ein `LearningGoal`
- besteht aus mehreren `LearningPathStep`

### LearningPathStep

Beschreibt die Reihenfolge innerhalb eines Lernpfades.

Attribute:

- Reihenfolge
- Pflicht/Optional
- Unlock Condition

Beziehungen:

- verweist auf genau ein `LearningProject`

## 3. Projekte

### LearningProject

Beschreibt das eigentliche Lernprojekt.

Beispiele:

- Snake
- RFID Safe
- Pflanzenbewaesserung

Eigenschaften:

- Titel
- Kurzbeschreibung
- Motivation
- Lernziel
- erwartetes Ergebnis
- geschaetzte Dauer
- develops eine oder mehrere `Competency`
- besitzt mehrere `ProjectVariant`
- besitzt genau eine `ProjectIntroduction`
- besitzt mehrere `ProjectFlowItem`

Kardinalitaet zu `Competency`:

- `LearningProject` develops `Competency`: n:m
- Ein `LearningProject` muss mindestens eine `Competency` entwickeln.
- Eine `Competency` kann durch beliebig viele `LearningProject` entwickelt werden.

Regel:

- `LearningProject` ist die zentrale fachliche Lerneinheit der Learning Platform.
- `LearningProject` beschreibt, wie Kompetenzen aufgebaut werden.
- Die Kompetenzen entstehen durch das vollstaendige Durchlaufen des Projektes.
- `Lesson` und `ProjectStep` sind didaktische Mittel innerhalb des Projektes.
- `LearningProject` bleibt unabhaengig von Hardware, Account, Device Management und Authorization.
- `LearningProject` kennt keine konkreten Boards, Sensoren oder Aktoren.
- Hardware wird ausschliesslich ueber `ProjectVariant`, `TechnicalConstraint`, `TechnicalCapability` und `HardwareItem` beschrieben.
- `LearningProject` kennt keinen Account, keinen Fortschritt und keine Skill Levels.
- `LearningProject` kennt keine Plaene, Rollen oder Subscriptions.
- `LearningProject` kennt keine Firmware, kein OTA, kein Pairing und keine Device Credentials.
- `LearningProject` entscheidet nicht, welche Hardware geeignet ist.

Verantwortungsfragen:

- Was wird gebaut?
- Warum wird es gebaut?
- Welche Kompetenzen werden aufgebaut?
- Wie laeuft das Projekt didaktisch ab?

### ProjectVariant

Beschreibt die technische Variante eines Projektes.

Beispiele:

- ESP32
- Arduino Nano
- STM32

Eigenschaften:

- besitzt `TechnicalConstraint`

### ProjectIntroduction

Beschreibt die Projektbeschreibung.
`ProjectIntroduction` ist kein referenzierbarer Inhaltstyp und kein `ProjectFlowItem`.
Sie ist Bestandteil genau eines `LearningProject`.

Inhalte:

- Motivation
- Voraussetzungen
- Ziel
- Ergebnis
- geschaetzte Dauer
- entwickelte Kompetenzen

Kardinalitaet:

- `LearningProject` 1 composition 1 `ProjectIntroduction`

Regeln:

- Jedes `LearningProject` besitzt genau eine `ProjectIntroduction`.
- Eine `ProjectIntroduction` existiert niemals ohne ihr `LearningProject`.
- `ProjectIntroduction` beschreibt ausschliesslich das jeweilige Projekt.
- `ProjectIntroduction` wird nicht zwischen Projekten wiederverwendet.
- Die eigentliche Projektreihenfolge beginnt nach der Einleitung mit dem ersten `ProjectFlowItem`.

### ProjectFlowItem

Beschreibt einen Schritt innerhalb des didaktischen Projektablaufs.

`ProjectFlowItem` speichert keine eigene Fachlogik, sondern referenziert genau einen Inhalt.
Die Reihenfolge innerhalb eines Projektes wird ausschliesslich ueber `ProjectFlowItem.orderIndex` bestimmt.

Attribute:

- id
- orderIndex
- itemType
- referenceId
- mandatory
- unlockCondition (optional)

Typen:

- Lesson
- Step
- Summary
- Quiz (zukuenftig)

Beziehungen:

- gehoert zu genau einem `LearningProject`
- referenziert genau ein Inhaltsobjekt, z. B. `Lesson`, `ProjectStep`, `Summary` oder spaeter `Quiz`

Regeln:

- `ProjectIntroduction` ist kein `ProjectFlowItem`.
- Der Projektablauf beginnt nach der `ProjectIntroduction`.
- Die Reihenfolge gehoert nicht zu `Lesson`.
- Die Reihenfolge gehoert nicht zu `ProjectStep`.
- Die Reihenfolge gehoert ausschliesslich zum Projektablauf.
- `Lesson` und `ProjectStep` bleiben dadurch wiederverwendbar.
- `ProjectFlowItem` folgt demselben Muster wie `LearningPathStep`.

### Lesson

Beschreibt einen wiederverwendbaren Wissensbaustein.

Eigenschaften:

- Titel
- Beschreibung

Beziehungen:

- requires `Condition`
- ensures `Condition`

Regel:

- kann in mehreren Projekten verwendet werden
- besitzt keine eigenen PreConditions oder PostConditions als Freitext

### ProjectStep

Beschreibt eine konkrete Taetigkeit.

Eigenschaften:

- Titel
- Beschreibung
- Expected Result

Beziehungen:

- requires `Condition`
- ensures `Condition`

Regel:

- besitzt keine eigenen PreConditions oder PostConditions als Freitext

### Condition

Beschreibt einen gewuenschten oder erforderlichen Systemzustand.
Conditions sind eigenstaendige Engineering-Artefakte.

Aufgabe:

- beschreibt einen erwarteten Zustand
- beschreibt, wie dieser Zustand hergestellt wird
- beschreibt, wie dieser Zustand ueberprueft werden kann

Attribute:

- id
- title
- description
- targetState
- setupGuide
- validationMethod
- category

Beziehungen:

- `Lesson` requires `Condition`
- `Lesson` ensures `Condition`
- `ProjectStep` requires `Condition`
- `ProjectStep` ensures `Condition`

Beispiele:

- ESP32 ist OTA empfangsbereit
- Firmware wurde erfolgreich geflasht
- Board ist gepairt
- WLAN ist konfiguriert
- Kompetenz "Compiler verstehen" wurde erreicht

Regeln:

- Conditions beschreiben Zustaende, nicht Ablaeufe.
- Lessons und ProjectSteps beschreiben Ablaeufe.
- Conditions beschreiben Voraussetzungen und Ergebnisse dieser Ablaeufe.
- Dieselbe `Condition` kann in beliebig vielen Projekten verwendet werden.
- Wiederkehrende Zustaende duerfen niemals als Freitext mehrfach beschrieben werden.
- Wiederkehrende Zustaende werden als `Condition` modelliert und von Lessons und ProjectSteps referenziert.
- Conditions dienen als Wissensbaustein, Engineering-Dokumentation, Validierungsgrundlage und Wiedereinstiegshilfe.

## 4. Hardware-Katalog

### HardwareCatalog

Verwaltet alle Hardware.

Beziehungen:

- enthaelt `HardwareItem`

### HardwareItem

Beschreibt abstrakte Hardware.

Spezialisierungen:

- ProcessorBoard
- Sensor
- Actuator
- Display
- CommunicationModule
- MeasurementDevice
- Tool
- Cable
- PowerSupply

Beziehungen:

- realisiert mehrere `TechnicalCapability`

### TechnicalCapability

Beschreibt technische Faehigkeiten.

Beispiele:

- WiFi
- Bluetooth
- GPIO
- ADC
- DAC
- SPI
- I2C
- USB
- OTA
- Display integriert

Beziehungen:

- gehoert genau einer `CapabilityCategory`

### CapabilityCategory

Gruppiert technische Faehigkeiten.

Beispiele:

- Versorgung
- Kommunikation
- Flash und Debug
- Analoge Eingaenge
- Digitale IO
- Display
- Sensorik

### TechnicalConstraint

Beschreibt eine technische Anforderung einer Projektvariante.
Ein `TechnicalConstraint` verlangt eine oder mehrere `TechnicalCapability`.

Beispiele:

- benoetigt WiFi
- benoetigt ADC
- benoetigt I2C
- benoetigt 5V

Attribute:

- constraintType

Beziehungen:

- wird durch eine oder mehrere `TechnicalCapability` erfuellt

constraintType Werte:

- mandatory
- optional

Bedeutung:

- `mandatory`: Diese `TechnicalCapability` muss vorhanden sein. Ist mindestens eine Pflichtanforderung nicht erfuellt, ist die Projektvariante technisch nicht durchfuehrbar.
- `optional`: Diese `TechnicalCapability` verbessert die Durchfuehrung des Projektes, ist aber nicht zwingend erforderlich. Fehlende optionale Constraints verhindern niemals den Projektstart.

Matching-Regeln:

- Das Matching erfolgt ausschliesslich ueber `TechnicalConstraint` und `TechnicalCapability`.
- Das Matching erfolgt nicht ueber konkrete Hardware.
- `HardwareItem` stellt `TechnicalCapability` bereit.
- `TechnicalConstraint` verlangt `TechnicalCapability`.
- Die Plattform bewertet niemals Hardware direkt.
- Sie bewertet nur, ob die von einer `ProjectVariant` benoetigten `TechnicalConstraint` durch vorhandene `TechnicalCapability` der inventarisierten Hardware erfuellt werden.
- Dadurch bleiben Hardware, Projektvarianten und Matching voneinander entkoppelt.

Beispiel:

- Pflicht: ProcessorBoard mit WiFi, RFID Reader, Servo.
- Optional: Multimeter, Logikanalysator, Oszilloskop.
- Fehlt nur der Logikanalysator, bleibt das Projekt durchfuehrbar und der Logikanalysator wird als optionale Empfehlung angezeigt.

Zukuenftige Erweiterungen:

- recommended
- alternative
- preferred
- deprecated

Diese Erweiterungen werden erst eingefuehrt, wenn ein konkreter fachlicher Bedarf entsteht.

## 5. Benutzerkonto

### Account

Eigenschaften:

- Profil
- Role
- SkillLevel
- Subscriptions
- mehrere `AccountCompetencyProgress`
- mehrere `AccountProjectProgress`

Regel:

- `Account` speichert keine Projektdetails direkt.
- Der Projektfortschritt wird ausschliesslich in `AccountProjectProgress` verwaltet.

### AccountSkillLevel

Beschreibt eine domaenenbezogene Erfahrungsstufe.

### AccountCompetencyProgress

Beschreibt den aktuellen Kompetenzstand eines Benutzers.
Der Status wird nicht manuell gepflegt, sondern automatisch aus dem Lernfortschritt berechnet.

Attribute:

- accountId
- competencyId
- status
- achievedAt
- lastUpdated

Statuswerte:

- not_started
- in_progress
- achieved

Statusregeln:

- `not_started`: Es wurde noch kein `LearningProject` begonnen, das diese `Competency` entwickelt.
- `in_progress`: Mindestens ein `LearningProject`, das diese `Competency` entwickelt, wurde begonnen, aber noch nicht ausreichend abgeschlossen.
- `achieved`: Mindestens ein relevantes `LearningProject`, das diese `Competency` entwickelt, wurde erfolgreich abgeschlossen.

Regeln:

- `AccountCompetencyProgress` wird automatisch aus abgeschlossenen `LearningProject` berechnet.
- Wenn ein `LearningProject` abgeschlossen wird, werden die von ihm entwickelten `Competency` ausgewertet.
- Daraus werden Evidence-Eintraege erzeugt.
- Danach wird `AccountCompetencyProgress` aktualisiert.
- Der Benutzer soll nachvollziehen koennen, durch welche Projekte eine Kompetenz aufgebaut wurde.
- Der Status beantwortet nur, wo der Nutzer aktuell bei dieser Kompetenz steht.
- Skill-Level, Evidence, Historie und Nachweise sind separate Strukturen.
- `validated` und `expired` werden aktuell nicht umgesetzt.

### AccountCompetencyEvidence

Beschreibt den Nachweis, durch welches Projekt eine Kompetenz aufgebaut wurde.

Attribute:

- id
- accountCompetencyProgressId
- learningProjectId
- projectVariantId (optional)
- achievedAt

Regeln:

- `AccountCompetencyEvidence` erklaert, warum eine `Competency` den Status `achieved` besitzt.
- Eine erreichte Kompetenz kann durch mehrere `LearningProject` belegt sein.
- Evidence dient Transparenz, Nachvollziehbarkeit, Motivation und Traceability.

### AccountProjectProgress

Beschreibt den Bearbeitungszustand eines konkreten Projektes fuer einen bestimmten Benutzer.
Es bildet den aktuellen Arbeitskontext des Nutzers ab.

Beziehungen:

- gehoert zu genau einem `Account`
- referenziert genau ein `LearningProject`
- gehoert zu genau einem `LearningPath`
- referenziert eine `ProjectVariant`
- referenziert den aktuellen `ProjectFlowItem`

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

Statuswerte:

- not_started
- active
- paused
- completed
- abandoned

Regeln:

- Ein `Account` kann mehrere `AccountProjectProgress`-Objekte besitzen.
- Ein Benutzer kann mehrere Projekte gleichzeitig bearbeiten.
- Ein Benutzer kann Projekte pausieren.
- Ein Benutzer kann dasselbe `LearningProject` ueber unterschiedliche `LearningPath` starten.
- Der gestartete `LearningPath` bleibt nachvollziehbar.
- Der aktuelle Projektstand wird ueber `currentProjectFlowItemId` gespeichert.
- Beim Wiedereinstieg kann anhand referenzierter `Condition` geprueft werden, ob der Benutzer fortsetzen kann oder ob technischer Projektzustand wiederhergestellt werden muss.

## 6. Berechtigungen

### Zielgruppen und Personas

Zielgruppen beschreiben, fuer wen das Produkt entwickelt und vermarktet wird.
Sie gehoeren zu Vision, Business Goals, Customer Journeys und Marketing.

Beispiele:

- Maker
- Hobbyentwickler
- Schueler
- Studierende
- Lehrer
- Embedded-Entwickler
- Unternehmen
- Schulen

Regeln:

- Zielgruppen sind kein Bestandteil des eigentlichen Metamodells.
- Zielgruppen besitzen keine fachliche Logik innerhalb der Software.
- Zielgruppen steuern keine Berechtigungen.
- Zielgruppen steuern keine Produktfunktionen.

### Role

Beschreibt administrative Aufgaben, die ein Benutzer innerhalb des Systems uebernehmen darf.

Beispiele:

- Administrator
- Learner
- Teacher
- Support
- Content Editor

Regeln:

- Rollen dienen ausschliesslich administrativen Aufgaben.
- Rollen steuern keine Produktfunktionen.
- Rollen ersetzen keine Plaene.
- Rollen ersetzen keine SystemCapabilities.

### Plan

Beschreibt, welche Produkte oder Inhalte ein Benutzer erworben hat.

Beispiele:

- Free
- Entry
- Medium
- Premium
- School
- Teacher

Regeln:

- Plaene vergeben ausschliesslich `SystemCapability`.
- Plaene beschreiben Produktzugang, nicht administrative Verantwortung.
- Plaene werden nicht aus Zielgruppen abgeleitet.
- Plaene werden nicht aus Rollen abgeleitet.

### SystemCapability

Beschreibt Systemfunktionen.

Beispiele:

- ide.flash.usb
- ide.flash.ota
- learning.embedded.basic
- learning.iot
- admin.users
- admin.hardware
- admin.learning
- admin.authorization

### PlanSystemCapability

Ordnet `SystemCapability` einem `Plan` zu.
Der Plan vergibt Standardrechte.

### AccountSystemCapabilityOverride

Beschreibt Ausnahmen pro Benutzer.
Ein Override ueberschreibt den Plan.

Moegliche Auspraegungen:

- ALLOW
- DENY
- zeitlich begrenzt

Optionale Attribute:

- validFrom
- validUntil
- reason

### Effective Permission

Beschreibt die berechnete effektive Berechtigung eines Accounts.
Sie wird nicht als eigene fachliche Quelle gepflegt, sondern aus drei Ebenen abgeleitet.

Ebenen:

1. System Default
2. Plan
3. Account Override

System Default:

- Standardzustand ist normalerweise `DENY`.

Berechnungsprioritaet:

1. `AccountSystemCapabilityOverride`
2. `PlanSystemCapability`
3. System Default

Konfliktregel:

- Existieren mehrere gueltige Overrides, hat `DENY` Vorrang vor `ALLOW`.
- Dadurch kann eine Berechtigung immer entzogen werden.

Regeln:

- Ein `Plan` kann `SystemCapability` standardmaessig erlauben.
- Ein `AccountSystemCapabilityOverride` kann Planrechte erweitern oder entziehen.
- Nach Ablauf eines zeitlich begrenzten Overrides gilt wieder die Planentscheidung.
- Wenn kein Planrecht und kein gueltiger Override existiert, gilt der System Default.
- Produktfunktionen werden nicht ueber Rollen freigeschaltet.
- Produktfunktionen werden nicht ueber Zielgruppen freigeschaltet.

Algorithmus:

1. benoetigte `SystemCapability` bestimmen.
2. gueltige `AccountSystemCapabilityOverride` pruefen.
3. wenn gueltige Overrides existieren, gewinnt `DENY` vor `ALLOW`.
4. wenn kein gueltiger Override existiert, `PlanSystemCapability` pruefen.
5. wenn keine Planentscheidung existiert, System Default verwenden.

Beispiele:

- Premium erlaubt `ide.flash.ota`, kein Override: Ergebnis `ALLOW`.
- Premium erlaubt `ide.flash.ota`, gueltiger Override `DENY`: Ergebnis `DENY`.
- Entry erlaubt `ide.flash.ota` nicht, gueltiger Override `ALLOW`: Ergebnis `ALLOW`.
- Zeitlich begrenzter Override ist abgelaufen: Plan gilt wieder.

### Initialdaten

Das System soll direkt nach der Installation fachlich lauffaehig sein.

Standardrollen:

- Administrator
- Learner
- Teacher
- Support
- Content Editor

Standardplaene:

- Free
- Entry
- Medium
- Premium

Initiale SystemCapabilities:

- learning.embedded.basic
- ide.flash.usb
- ide.flash.ota
- admin.users
- admin.hardware
- admin.learning
- admin.authorization

Erster Administrator:

- besitzt Rolle `Administrator`
- besitzt Plan `Premium`
- besitzt alle administrativen `SystemCapability`
- dient ausschliesslich der Erstkonfiguration

Testaccounts:

- Free User: Rolle `Learner`, Plan `Free`
- Entry User: Rolle `Learner`, Plan `Entry`
- Premium User: Rolle `Learner`, Plan `Premium`
- Teacher: Rolle `Teacher`, Plan `Teacher`
- Administrator: Rolle `Administrator`, Plan `Premium`

## 7. Registered Processor Board

Der Hardware-Katalog beschreibt Produkttypen.
Das Device Management verwaltet konkrete physische Boards.

Architektur:

HardwareCatalog -> ProcessorBoard -> RegisteredProcessorBoard -> Account

Regeln:

- `ProcessorBoard` beschreibt den Produkttyp.
- `RegisteredProcessorBoard` beschreibt das konkrete physische Board.
- Pairing darf ausschliesslich den Besitzer eines `RegisteredProcessorBoard` aendern, niemals den `ProcessorBoard`-Typ.

### RegisteredProcessorBoard

Beschreibt ein konkretes physisches Board, nicht den Produkttyp.
Es speichert den Lebenszyklus eines konkreten Boards.

Attribute:

- id
- processorBoardId
- ownerAccountId
- pairingState
- provisioningState
- firmwareVersion
- otaEnabled
- boardCredentialId
- firstSeen
- lastSeen

Statuswerte:

- created
- provisioning
- paired
- active
- inactive
- lost
- revoked
- retired

Regeln:

- Ein `RegisteredProcessorBoard` gehoert maximal einem `Account`.
- Ein `Account` kann beliebig viele `RegisteredProcessorBoard` besitzen.
- Verlorene oder widerrufene Boards duerfen keine OTA-Auftraege mehr erhalten.
- OTA darf nur fuer gepairte Boards mit aktivem Credential verwendet werden.

### BoardCredential

Beschreibt die Authentisierung eines Boards.
Jedes `RegisteredProcessorBoard` besitzt genau ein aktives Credential.

Authentisierung:

- ECDSA P-256 mit mTLS-Client-Zertifikat

Attribute:

- id
- registeredProcessorBoardId
- credentialType = ECDSA_P256_X509
- keyReference
- publicKeyFingerprint
- certificateFingerprint
- createdAt
- rotatedAt
- revokedAt

Statuswerte:

- created
- active
- rotating
- revoked
- expired

Regeln:

- Der private Device-Schluessel wird auf dem Board erzeugt und verlaesst es nicht.
- Serverseitig werden Public Key, Zertifikat und Fingerprints gespeichert.
- Pro Board existiert genau ein aktives Credential.

### Firmware State

Beschreibt den Firmware-Zustand eines konkreten Boards.

Statuswerte:

- unknown
- installed
- update_available
- update_pending
- updating
- update_failed
- verified
- rollback_required

### OTA State

Beschreibt den OTA-Zustand eines konkreten Boards.

Statuswerte:

- not_supported
- not_configured
- configured
- reachable
- unreachable
- update_in_progress
- failed
- disabled

### Pairing

Beschreibt die Kopplung eines konkreten Boards mit einem Account.
Es existieren vier gleichwertige Pairing-Wege. Alle erzeugen dasselbe Ergebnis.

Moeglichkeiten:

- Webserver auf Board
- Recovery Tool
- Provisioning Tool
- IDE ueber Pairing Code

Ergebnis:

- `RegisteredProcessorBoard` wird einem `Account` zugeordnet

### Pairing-Wege

#### Board Webserver

Ablauf:

1. Board startet lokalen Webserver.
2. Benutzer meldet sich an.
3. Board registriert sich im Backend.
4. Pairing wird abgeschlossen.

#### Recovery Tool

Ablauf:

1. Board wird per USB erkannt.
2. Recovery Tool registriert das Board.
3. Board erhaelt Credentials.
4. Board wird gepairt.

#### Provisioning Tool

Ablauf:

1. Erstinstallation.
2. Board erhaelt Firmware.
3. Board erhaelt Credentials.
4. Board wird registriert.

#### IDE Pairing

Ablauf:

1. Board zeigt Pairing Code.
2. Benutzer gibt Pairing Code in der IDE ein.
3. Backend ordnet das Board dem Benutzerkonto zu.

### Public-Key-Sicherheitsmodell

Ein GerNetiX-Board authentisiert sich ueber ECDSA-P-256 und externes MQTT ueber mTLS.

Das Board sendet:

- boardId
- timestamp
- nonce
- payload
- signature

Das Backend prueft:

- Board bekannt?
- Credential aktiv?
- Timestamp gueltig?
- Nonce bereits verwendet?
- Signatur gegen registrierten Public Key korrekt?

Nur wenn alle Pruefungen erfolgreich sind, gilt das Board als authentisch.

## Kernregeln

- `LearningGoal` requires `Competency`.
- `LearningPath` beschreibt die Reihenfolge von Projekten.
- `LearningPathStep` modelliert die Reihenfolge im Lernpfad.
- `LearningProject` develops `Competency`.
- `Competency` existiert genau einmal im Metamodell.
- Es gibt aktuell keine `TargetCompetency`, `RequiredCompetency` oder `ProjectCompetency`.
- Die Beziehung zwischen `LearningProject` und `Competency` ist n:m.
- Ein `LearningProject` muss mindestens eine `Competency` entwickeln.
- Eine `Competency` darf von beliebig vielen `LearningProject` entwickelt werden.
- Ein `LearningPath` gilt als vollstaendig, wenn die Vereinigung aller durch seine `LearningProject` entwickelten `Competency` alle vom zugehoerigen `LearningGoal` benoetigten `Competency` abdeckt.
- `ProjectIntroduction` ist Bestandteil eines `LearningProject` und kein referenzierbarer Inhaltstyp.
- `ProjectFlowItem` modelliert die Reihenfolge im Projektablauf.
- `LearningProject` ist unabhaengig von Hardware, Account, Device Management und Authorization.
- `LearningProject` beschreibt nur die fachliche Lerneinheit.
- Hardwarebezug entsteht ausschliesslich ueber `ProjectVariant -> TechnicalConstraint -> TechnicalCapability -> HardwareItem`.
- `Condition` beschreibt wiederverwendbare Systemzustaende.
- `Lesson` und `ProjectStep` referenzieren `Condition` ueber requires und ensures.
- `PreConditions` und `PostConditions` werden nicht als Freitext modelliert.
- `ProjectVariant` besitzt `TechnicalConstraint`.
- `TechnicalConstraint` wird durch `TechnicalCapability` erfuellt.
- `TechnicalConstraint.constraintType` ist in Version 1 entweder `mandatory` oder `optional`.
- Fehlende mandatory Constraints machen eine Projektvariante technisch nicht durchfuehrbar.
- Fehlende optional Constraints verhindern niemals den Projektstart.
- Matching erfolgt ausschliesslich ueber `TechnicalConstraint` und `TechnicalCapability`, nicht ueber konkrete Hardware.
- `HardwareItem` realisiert `TechnicalCapability`.
- `HardwareCatalog` enthaelt `HardwareItem`.
- `ProcessorBoard` beschreibt den Produkttyp.
- `RegisteredProcessorBoard` beschreibt das konkrete physische Board.
- `BoardCredential` authentisiert ein `RegisteredProcessorBoard` per ECDSA-P-256 und Client-Zertifikat.
- Der private Device-Schluessel verlaesst das Board nicht.
- Pairing kann ueber Board Webserver, Recovery Tool, Provisioning Tool oder IDE Pairing erfolgen.
- Alle Pairing-Wege erzeugen dieselbe Zuordnung: `RegisteredProcessorBoard` zu `Account`.
- `Account` speichert Lernzustand und Berechtigungen.
- `Account` speichert keine Projektdetails direkt.
- `AccountProjectProgress` speichert den vollstaendigen Arbeitskontext eines Benutzers innerhalb eines Projektes.
- `AccountCompetencyProgress` wird automatisch aus dem Lernfortschritt berechnet.
- `AccountCompetencyEvidence` erklaert, durch welche `LearningProject` eine `Competency` aufgebaut wurde.
- `Plan` vergibt `SystemCapability` ueber `PlanSystemCapability`.
- `AccountSystemCapabilityOverride` ueberschreibt Planberechtigungen.
- Effektive Berechtigungen werden aus Account Override, Plan und System Default berechnet.
- Bei mehreren gueltigen Overrides gewinnt `DENY` vor `ALLOW`.
- Zielgruppen und Personas sind keine Metamodell-Artefakte.
- Zielgruppen steuern keine Berechtigungen und keine Produktfunktionen.
- `Role` beschreibt administrative Aufgaben, aber keine Produktfunktionen.
- Produktfunktionen werden ausschliesslich ueber `SystemCapability` freigeschaltet.
- `Plan` vergibt `SystemCapability`; `AccountSystemCapabilityOverride` definiert Ausnahmen.
- Wissen wird im Metamodell gespeichert. Code ist lediglich dessen Implementierung.
- Die Reihenfolge wird immer ueber ein separates Flow-/Step-Objekt modelliert und niemals direkt am eigentlichen Fachobjekt gespeichert.

## Offene Modellfragen

- Ist `AccountSkillLevel` global, domaenenbezogen oder beides?
- Welche Pflichtattribute gelten fuer alle Artefakte gemeinsam?

## Zukuenftige Erweiterung

Falls zukuenftig unterschiedliche Kompetenzlevel oder Gewichtungen notwendig werden, kann die n:m-Beziehung ueber Beziehungsklassen erweitert werden.

Moegliche Erweiterungen:

- `LearningGoalCompetency` mit `learningGoalId`, `competencyId`, `requiredLevel`
- `ProjectCompetency` mit `learningProjectId`, `competencyId`, `developedLevel`

Diese Erweiterung erfolgt erst dann, wenn ein konkreter fachlicher Bedarf besteht.
