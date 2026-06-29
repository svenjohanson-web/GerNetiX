# Nachweis und Traceability

## Ziel

Jede Umsetzung muss auf einen fachlichen Nutzen zurueckgefuehrt werden koennen.
Nachvollziehbarkeit hat Vorrang vor Implementierung.

## Definition of Done fuer Arbeitspakete

Ein Arbeitspaket gilt erst als abgeschlossen, wenn folgende Fragen beantwortet sind:

- Requirement erfuellt?
- Tests vorhanden?
- Traceability vollstaendig?
- Metamodell aktualisiert?
- Customer Journey und Business Goal nachvollziehbar?

## Traceability-Kette

Die Traceability beginnt bei der Vision und laeuft top-down bis zur Umsetzung.

Validierungsregel:

- Kein nicht-root Artefakt ohne nachvollziehbare Upstream-Beziehung.
- Jedes Artefakt muss erklaeren, warum es existiert, wem es fachlich gehoert und wofuer es verwendet wird.

Kernkette fuer fachliche Dekomposition:

Vision -> Business Goal -> Customer Journey -> Requirement -> Work Package -> Implementierung -> Tests

Kernkette fuer strukturiertes Engineering-Wissen:

Vision -> Business Goal -> Customer Journey -> Requirement -> Metamodell -> Datenmodell -> Implementierung -> Tests

Erweiterte Nachweiskette:

Vision -> Business Goal -> Customer Journey -> Requirement -> Metamodell-Artefakt -> Datenmodell -> Work Package -> Implementierung -> Test -> Nachweis

## Dekompositionsgrenze

Die fachliche Dekomposition endet beim `Work Package`.
Technische Details werden nicht als eigenstaendige Requirements modelliert.

Keine eigenen Requirement-Ebenen sind:

- Datenbanktabellen
- APIs
- Views
- Services
- Controller
- Migrationen
- Tests

Diese Elemente gehoeren zur Umsetzung eines Work Packages.

Ausnahme:

- Eine technische Schnittstelle oder Datenstruktur wird nur dann selbst als Requirement modelliert, wenn sie direkten fachlichen Nutzen besitzt.

Leitsatz:

- Requirement beschreibt das Warum.
- Work Package beschreibt das Was.
- Implementierung beschreibt das Wie.

## Nachweisfragen

- Welches Business Goal wird unterstuetzt?
- Welche Customer Journey wird unterstuetzt?
- Welcher Kundennutzen entsteht?
- Welche Artefakte sind betroffen?
- Welche Auswirkungen entstehen?
- Wie passt die Aenderung in das Metamodell?
- Welche Upstream-Beziehung begruendet das Artefakt?
- Wem gehoert das Artefakt fachlich?
- Welche Tests sichern die Aenderung ab?
- Welche Dokumentation wurde aktualisiert?
