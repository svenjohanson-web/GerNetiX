# Metamodell

## Rolle

Das Metamodell ist die Single Source of Truth.

Das Metamodell ist die Single Source of Truth fuer strukturiertes Engineering-Wissen.
Es wird aus Vision, Business Goals, Customer Journeys und Requirements begruendet.
Danach werden Datenmodell, UML, Backend, Frontend, Dokumentation und Tests abgeleitet.
Das Metamodell beschreibt die fachliche Wahrheit, nicht den aktuellen Implementierungsstand.
Es wird unabhaengig vom Implementierungsstand gepflegt.

Der aktuelle fachliche Ausschnitt fuer die Learning Platform ist in [metamodel-learning-platform.md](metamodel-learning-platform.md) dokumentiert.

## Zweck

Das Metamodell bewahrt Engineering-Wissen dauerhaft und beschreibt:

- Artefakte
- Beziehungen
- Kardinalitaeten
- Verantwortlichkeiten
- Lifecycle
- Regeln
- fachlichen Nutzen
- Abhaengigkeiten
- Nutzungskontexte
- Nachweise

Die gemeinsame Wissensbasis entsteht nicht durch eine zentrale Knowledge-Domaene.
Sie entsteht durch:

- eindeutige Artefakte
- definierte Beziehungen
- Traceability
- Referenzen zwischen Domaenen

Jedes Artefakt besitzt genau einen fachlichen Eigentuemer.
Andere Domaenen duerfen dieses Artefakt referenzieren, aber nicht kopieren oder fachlich erweitern.

## Grundregel

Wenn neue Anforderungen entstehen, wird zuerst ihre fachliche Motivation nachvollziehbar beschrieben.
Danach wird geprueft, ob das Metamodell aktualisiert werden muss.
Neue Metamodell-Klassen duerfen nur entstehen, wenn sie fuer eine Customer Journey oder ein Requirement notwendig sind.
Neue Artefakte werden modelliert, sobald sie fachlich eigenstaendig sind, nicht erst, wenn sie implementiert werden.

Oberste Artefaktregel:

Jedes Artefakt muss beantworten koennen:

- Warum existiere ich?
- Wem gehoere ich fachlich?
- Wofuer werde ich verwendet?

Validierungsregel:

- Kein nicht-root Artefakt ohne nachvollziehbare Upstream-Beziehung.

## Rolle in der Entwicklung

Das Metamodell befindet sich bewusst in der Mitte.

Es verbindet:

Business -> Customer Journey -> Requirements

mit:

Datenmodell -> Implementierung -> Tests

Grundsatz:

- Business bestimmt das Metamodell.
- Das Metamodell bestimmt das Datenmodell.
- Das Datenmodell bestimmt die Implementierung.
- Nicht umgekehrt.

## Ableitungen

Aus dem Metamodell werden spaeter abgeleitet:

- Datenmodell
- UML
- Backend
- Frontend
- Dokumentation
- Tests

## Aktuelle Metamodell-Ausschnitte

- [Learning Platform](metamodel-learning-platform.md)

## Mindestfragen fuer Artefakte

Jedes Artefakt muss langfristig beantworten koennen:

- Warum existiert es?
- Wem gehoert es fachlich?
- Welchen Nutzen erfuellt es?
- Wovon haengt es ab?
- Wer nutzt es?
- Wofuer wird es verwendet?
