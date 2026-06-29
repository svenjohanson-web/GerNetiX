# Zielgruppen, Rollen, Berechtigungen und Initialdaten

Dieses Dokument trennt Zielgruppen, Rollen und Berechtigungen fachlich voneinander.
Die Begriffe duerfen nicht vermischt werden.

## Grundregel

Zielgruppen, Rollen und Plaene/SystemCapabilities sind drei unterschiedliche Konzepte:

- Zielgruppen beschreiben, fuer wen das Produkt entwickelt und vermarktet wird.
- Rollen beschreiben administrative Aufgaben eines Accounts.
- Plaene und SystemCapabilities beschreiben, welche Produktfunktionen ein Account verwenden darf.

## Zielgruppen

Zielgruppen beschreiben ausschliesslich, fuer wen das Produkt gedacht ist.

Beispiele:

- Maker
- Hobbyentwickler
- Schueler
- Studierende
- Lehrer
- Embedded-Entwickler
- Unternehmen
- Schulen

Zielgruppen gehoeren zu:

- Vision
- Business Goals
- Customer Journeys
- Marketing

Regeln:

- Zielgruppen gehoeren nicht in das eigentliche Metamodell.
- Zielgruppen besitzen keine fachliche Logik innerhalb der Software.
- Zielgruppen steuern keine Berechtigungen.
- Zielgruppen steuern keine Produktfunktionen.

## Rollen

Rollen beschreiben, welche administrativen Aufgaben ein Benutzer innerhalb des Systems uebernehmen darf.

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

## Plaene

Plaene beschreiben, welche Produkte oder Inhalte ein Benutzer erworben hat.

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

## SystemCapabilities

`SystemCapability` beschreibt, welche Systemfunktion ein Account verwenden darf.

Beispiele:

- learning.embedded.basic
- learning.iot
- ide.flash.usb
- ide.flash.ota
- admin.users
- admin.hardware
- admin.learning
- admin.authorization

Die effektiven Berechtigungen werden ausschliesslich berechnet aus:

- `PlanSystemCapability`
- `AccountSystemCapabilityOverride`
- System Default

Nicht verwendet werden:

- Zielgruppen
- Rollen

## Architekturregel

Die fachliche Trennung lautet:

```text
Personas
-> Business
-> Customer Journey
-> Marketing
```

```text
Rollen
-> Administration
```

```text
Plan
-> SystemCapabilities
-> Produktfunktionen
```

Diese drei Bereiche duerfen niemals vermischt werden.

## Initialdaten

Das System soll direkt nach der Installation fachlich lauffaehig sein.
Dafuer werden Initialdaten definiert.

### Standardrollen

- Administrator
- Learner
- Teacher
- Support
- Content Editor

### Standardplaene

- Free
- Entry
- Medium
- Premium

Weitere Plaene wie `School` oder `Teacher` koennen fuer Schul-, Test- oder Produktvarianten ergaenzt werden.

### Initiale SystemCapabilities

- learning.embedded.basic
- ide.flash.usb
- ide.flash.ota
- admin.users
- admin.hardware
- admin.learning
- admin.authorization

### Erster Administrator

Beim ersten Start muss mindestens ein Administrator existieren.

Eigenschaften:

- Rolle `Administrator`
- Plan `Premium`
- alle administrativen `SystemCapability`

Regel:

- Der erste Administrator dient ausschliesslich der Erstkonfiguration.

### Testaccounts

Testaccounts dienen Entwicklung, automatisierten Tests, Demonstration und manueller Qualitaetssicherung.

Vorgesehene Testaccounts:

- Free User: Rolle `Learner`, Plan `Free`
- Entry User: Rolle `Learner`, Plan `Entry`
- Premium User: Rolle `Learner`, Plan `Premium`
- Teacher: Rolle `Teacher`, Plan `Teacher`
- Administrator: Rolle `Administrator`, Plan `Premium`

## Designprinzip

Zielgruppen sind kein Bestandteil des Metamodells.
Das Metamodell beschreibt ausschliesslich fachliche Artefakte und Systemlogik.

Marketing- und Business-Begriffe werden bewusst ausserhalb des Metamodells gefuehrt.
Dadurch bleibt das Engineering-Modell klar, stabil und unabhaengig von zukuenftigen Vertriebs- oder Marketingstrategien.
