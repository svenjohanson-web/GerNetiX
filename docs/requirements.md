# Requirements Engineering

## Zweck

Requirements Engineering dient dazu, Anforderungen fachlich zu verstehen, bevor Work Packages oder Umsetzung entstehen.

## Quellen fuer Anforderungen

- Ideen
- Business Goals
- Kundenwuensche
- gesetzliche Anforderungen
- technische Erkenntnisse
- Bugs
- Verbesserungen
- Marktbeobachtung

Wichtig:

Eine Idee ist nur eine Quelle fuer Anforderungen.
Nicht jede Anforderung beginnt mit einer Idee.

## Struktur einer Anforderung

Eine Anforderung soll mindestens klaeren:

- Ursprung
- Business Goal
- Kundennutzen
- betroffene Domaenen
- betroffene Artefakte
- Auswirkungen
- Alternativen
- Passung in das Metamodell
- Risiken
- Nachweis

## Dekomposition

Anforderungen werden nur so weit zerlegt, wie es fuer fachliche Nachvollziehbarkeit notwendig ist.
Die Dekomposition endet auf der Ebene der `Work Packages`.

Reihenfolge:

Vision -> Business Goal -> Customer Journey -> Requirement -> Work Package -> Implementierung -> Tests

Es werden keine zusaetzlichen Requirement-Ebenen eingefuehrt fuer:

- Datenbanktabellen
- APIs
- Views
- Services
- Controller
- Migrationen
- Tests

Diese technischen Details entstehen erst innerhalb der Umsetzung eines Work Packages.

## Requirement

Ein Requirement beschreibt ausschliesslich den fachlichen Nutzen.

Es beantwortet:

- Welches Problem wird geloest?
- Welchen Nutzen erhaelt der Benutzer?
- Welche Customer Journey wird verbessert?
- Welche Business Goals werden unterstuetzt?

Regeln:

- Ein Requirement besitzt keine technischen Implementierungsdetails.
- Eine API, Datenstruktur oder technische Komponente wird nur dann als eigenes Requirement modelliert, wenn sie selbst direkten fachlichen Nutzen besitzt.

Beispiel:

`Oeffentliche REST API fuer externe Kunden bereitstellen.`

In diesem Fall besitzt die API direkten Kundennutzen und darf selbst ein Requirement sein.

## Work Package

Ein Work Package beschreibt eine umsetzbare fachliche Aenderung.
Ein Work Package darf mehrere technische Umsetzungsschritte umfassen.

Beispiel:

Requirement:

`Administrator kann TechnicalCapabilities verwalten.`

Work Package:

`Capability-Verwaltung implementieren.`

Technische Umsetzung innerhalb des Work Packages:

- Datenmodell erweitern
- Backend erweitern
- API ergaenzen
- Admin View erstellen
- Tests schreiben
- Dokumentation aktualisieren

Diese Punkte werden nicht als eigene Requirements modelliert.

## Arbeitsregel

Eine Anforderung wird nicht direkt umgesetzt.

Zuerst wird sie fachlich strukturiert, dann im Metamodell verankert, danach in Work Packages ueberfuehrt.

Leitsatz:

- Requirements beschreiben das Warum.
- Work Packages beschreiben das Was.
- Die Implementierung beschreibt das Wie.

Diese drei Ebenen duerfen nicht vermischt werden.
