# Dokumentationsstrategie

## Grundprinzip

Die Dokumentation beginnt nicht beim Code.
Sie beginnt nicht beim Metamodell.
Sie beginnt bei der Nachvollziehbarkeit.

Leitsatz:

> Wissen ist teurer als Code.

Code kann mit modernen Werkzeugen und KI haeufig neu erstellt oder weiterentwickelt werden.
Verlorenes Engineering-Wissen kann dagegen nur sehr eingeschraenkt rekonstruiert werden.

Deshalb besitzt die Erhaltung des Wissens hoechste Prioritaet.

## Dokumentationsreihenfolge

Die Dokumentation erfolgt top-down:

1. Vision
2. Business Goals
3. Customer Journeys
4. Requirements Engineering
5. Metamodell
6. Datenmodell
7. Implementierung
8. Nachweis

Vision, Business Goals und Customer Journeys werden innerhalb dieser Reihenfolge nach Wertschoepfung priorisiert.
Der aktuelle Prioritaetsstand ist in [vision-business-goals-customer-journeys.md](vision-business-goals-customer-journeys.md) dokumentiert.

## 1. Vision

Die Vision beantwortet:

- Welches Problem loesen wir?
- Fuer wen loesen wir dieses Problem?
- Welche Produkte entstehen daraus?

Produkte:

- Learning Platform
- Simple IDE

## 2. Business Goals

Business Goals beschreiben, welche Ziele das Unternehmen verfolgt.

Priorisierte Business Goals:

- BG-001: Bestehende Kunden kontinuierlich mit passenden neuen Lernangeboten begleiten.
- BG-002: Den Einstieg in Embedded-Entwicklung moeglichst einfach machen.
- BG-003: Die Einstiegshuerde durch eine einfache IDE reduzieren.
- BG-004: Vorhandene Hardware optimal nutzen und passende Projekte empfehlen.
- BG-005: Engineering-Wissen dauerhaft erhalten.

## 3. Customer Journeys

Customer Journeys beschreiben, wie der Benutzer das Produkt erlebt.
Sie beschreiben den erwarteten Nutzen, noch keine technischen Details.

Priorisierte Customer Journeys:

- CJ-001: Neuer Benutzer entdeckt die Plattform.
- CJ-002: Benutzer inventarisiert vorhandene Hardware.
- CJ-003: Benutzer beginnt ein Projekt.
- CJ-004: Benutzer kehrt spaeter zurueck.
- CJ-005: Benutzer besitzt Hardware, aber noch nicht alle Lernziele.
- CJ-006: Benutzer besitzt ein neues ProcessorBoard.
- CJ-007: Administrator erweitert die Plattform.

## 4. Requirements Engineering

Customer Journeys werden in Anforderungen ueberfuehrt.

Leitfragen:

- Welche fachlichen Objekte werden benoetigt?
- Welche Beziehungen entstehen?
- Welche Regeln gelten?
- Welche Artefakte muessen eingefuehrt werden?

## 5. Metamodell

Erst danach wird das Metamodell erweitert.

Regeln:

- Neue Klassen duerfen nur entstehen, wenn sie fuer eine Customer Journey oder ein Requirement notwendig sind.
- Das Metamodell bildet Engineering-Wissen ab, nicht Code.
- Jede Klasse im Metamodell muss mindestens einer Customer Journey dienen.
- Kann keine Customer Journey genannt werden, die diese Klasse benoetigt, ist zu pruefen, ob die Klasse notwendig ist.
- Das Metamodell beschreibt die fachliche Wahrheit, nicht den aktuellen Implementierungsstand.
- Neue Artefakte werden modelliert, sobald sie fachlich eigenstaendig sind, nicht erst, wenn sie implementiert werden.

## 6. Datenmodell

Aus dem Metamodell wird das Datenmodell abgeleitet.
Nicht umgekehrt.

## 7. Implementierung

Erst danach entstehen:

- Backend
- Frontend
- Datenbank
- APIs
- Tests

## 8. Nachweis

Nach jeder Implementierung wird geprueft:

- Requirement erfuellt?
- Tests vorhanden?
- Traceability vollstaendig?
- Metamodell aktuell?

Erst danach gilt die Umsetzung als abgeschlossen.

## Rolle des Metamodells

Das Metamodell befindet sich bewusst in der Mitte.
Es verbindet Business, Customer Journey und Requirements mit Datenmodell, Implementierung und Tests.

Grundsatz:

- Business bestimmt das Metamodell.
- Das Metamodell bestimmt das Datenmodell.
- Das Datenmodell bestimmt die Implementierung.
- Nicht umgekehrt.

## Verbotene Richtung

Die Reihenfolge darf niemals umgedreht werden.

Nicht:

Code -> Metamodell -> Business

Sondern immer:

Vision -> Business Goals -> Customer Journey -> Requirements -> Metamodell -> Datenmodell -> Implementierung -> Nachweis

## Nachvollziehbarkeit je Artefakt

Fuer jedes Artefakt muessen mindestens folgende Fragen beantwortet werden koennen:

- Warum existiert dieses Artefakt?
- Wem gehoert dieses Artefakt fachlich?
- Welchen Nutzen erfuellt es?
- Wovon haengt es ab?
- Wer oder was nutzt es?
- Wofuer wird es verwendet?

Validierungsregel:

- Kein nicht-root Artefakt ohne nachvollziehbare Upstream-Beziehung.

## Zweck der Dokumentation

Die Dokumentation dient nicht dazu, Code zu erklaeren.
Sie dient dazu, Engineering-Wissen dauerhaft nachvollziehbar zu erhalten.

Erst wenn die fachliche Motivation nachvollziehbar beschrieben wurde, darf daraus das Metamodell, das Datenmodell und anschliessend die Implementierung entstehen.
