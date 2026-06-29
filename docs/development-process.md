# Entwicklungsprozess

Die Entwicklung folgt einer Top-down-Reihenfolge.
Ziel ist nicht, moeglichst schnell zu entwickeln, sondern nachhaltig weiterzuentwickeln.
Nachvollziehbarkeit hat Vorrang vor Implementierung.

## Reihenfolge

Vision -> Business Goals -> Customer Journey -> Requirements -> Metamodell -> Datenmodell -> Implementierung -> Nachweis

Die Reihenfolge darf nicht umgedreht werden.

Fuer die fachliche Dekomposition von Arbeit gilt ergaenzend:

Vision -> Business Goal -> Customer Journey -> Requirement -> Work Package -> Implementierung -> Tests

## 1. Vision

Ziel:

Klaeren, warum das Produkt existiert, welches Problem geloest wird und welche Produkte daraus entstehen.

Beispiele:

- Learning Platform
- Simple IDE

## 2. Business Goals

Ziel:

Die Unternehmensziele definieren.

Beispiele fuer Business Goals:

- Bestehenden Kunden passende neue Lernangebote anbieten.
- Einstieg in Embedded moeglichst einfach machen.
- Kunden langfristig beim Kompetenzaufbau begleiten.

## 3. Customer Journeys

Ziel:

Beschreiben, wie der Benutzer das Produkt erlebt und welchen Nutzen er erwartet.

Beispiele:

- Embedded lernen
- Hardware inventarisieren
- Projekt starten
- neues Lernziel kaufen
- IDE verwenden

Noch keine technischen Details.

## 4. Requirements Engineering

Customer Journeys werden in Anforderungen ueberfuehrt.

Leitfragen:

- Welche fachlichen Objekte werden benoetigt?
- Welche Beziehungen entstehen?
- Welche Regeln gelten?
- Welche Artefakte muessen eingefuehrt werden?

Ergebnis:

Strukturierte fachliche Anforderungen.

Dekompositionsregel:

- Requirements beschreiben fachlichen Nutzen.
- Requirements enthalten keine technischen Implementierungsdetails.
- Die Dekomposition endet bei Work Packages.
- Datenbanktabellen, APIs, Views, Services, Controller, Migrationen und Tests werden nicht als eigene Requirements modelliert.

## 5. Metamodell

Erst jetzt wird das Metamodell erweitert.

Regeln:

- Neue Klassen duerfen nur entstehen, wenn sie fuer eine Customer Journey oder ein Requirement notwendig sind.
- Jede Klasse im Metamodell muss mindestens einer Customer Journey dienen.
- Das Metamodell bildet Engineering-Wissen ab, nicht Code.
- Das Metamodell beschreibt die fachliche Wahrheit, nicht den aktuellen Implementierungsstand.
- Das Metamodell enthaelt Artefakte, Beziehungen, Kardinalitaeten, Verantwortlichkeiten, Lifecycle und Regeln.

## 6. Datenmodell

Aus dem Metamodell wird zuerst das Datenmodell abgeleitet.
Nicht umgekehrt.

## 7. Implementierung

Jetzt entstehen:

- Backend
- Frontend
- APIs
- Datenbank
- Tests

Die Implementierung folgt dem Metamodell, nicht umgekehrt.

## 8. Nachweis

Nach jeder Implementierung wird geprueft:

- Requirement erfuellt?
- Tests vorhanden?
- Traceability vollstaendig?
- Metamodell aktuell?

Erst danach gilt die Umsetzung als abgeschlossen.

## Rolle des Metamodells

Das Metamodell befindet sich bewusst in der Mitte.

Es verbindet:

Business -> Customer Journey -> Requirements

mit:

Datenmodell -> Implementierung -> Tests

Das Metamodell ist die Bruecke zwischen fachlicher Beschreibung und technischer Umsetzung.

Grundsatz:

- Business bestimmt das Metamodell.
- Das Metamodell bestimmt das Datenmodell.
- Das Datenmodell bestimmt die Implementierung.
- Nicht umgekehrt.

## Anforderungen entstehen aus verschiedenen Quellen

Quellen:

- Idee
- Business Goal
- Kundenwunsch
- gesetzliche Anforderung
- technische Erkenntnis
- Bug
- Verbesserung
- Marktbeobachtung

Wichtig:

Eine Idee ist nur eine Quelle fuer Anforderungen.
Nicht jede Anforderung beginnt mit einer Idee.

## Entwicklungsplanung

Aus der Anforderung entstehen konkrete Arbeitspakete.

Beispiele:

- neues Learning Goal
- neues Learning Project
- neue Hardware
- neue IDE-Funktion
- neue SystemCapability oder TechnicalCapability
- neue Projektvariante

Hier entsteht auch die Traceability.

Traceability-Kette:

Vision -> Business Goal -> Customer Journey -> Requirement -> Work Package -> Implementierung -> Tests

Regeln:

- Ein Work Package beschreibt eine umsetzbare fachliche Aenderung.
- Ein Work Package darf mehrere technische Umsetzungsschritte umfassen.
- Technische Tasks gehoeren zur Umsetzung eines Work Packages.
- Eine technische Komponente wird nur dann selbst als Requirement modelliert, wenn sie direkten fachlichen Nutzen besitzt.

## Umsetzung von Arbeitspaketen

Die Arbeitspakete werden umgesetzt.

Beispiele:

- Code
- Inhalte
- Projekte
- Hardware-Katalog
- Dokumentation
- Tests

## Abschlussnachweis

Nach der Umsetzung wird geprueft:

- Requirement erfuellt?
- Tests vorhanden?
- Traceability vorhanden?
- Metamodell aktualisiert?
- Customer Journey weiterhin nachvollziehbar?

Erst dann gilt das Arbeitspaket als abgeschlossen.
