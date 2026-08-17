# ELAB-FS-011: KI-Bedienablauf ohne Live-Provider

Stand: 2026-08-17  
Status: umgesetzt, getestet und im Browser geprüft (2026-08-17)

## Ziel

Die Fehlersuche erhält einen sichtbaren Assistenten, dessen vollständiger
Bedien- und Sicherheitsablauf zunächst mit deterministischen lokalen Fixtures
geprüft wird. Er erklärt Beobachtungen, schlägt Messungen vor oder zeigt einen
Reparatur-Diff. Änderungen werden nie automatisch angewandt.

## Vertrag

- Eingaben werden mit dem FS-006-Vertrag minimiert.
- Erlaubte Aktionen: Beobachtung erklären, nächste Messung vorschlagen,
  bestätigungspflichtigen Command-Diff anbieten.
- Ein lokales Fixture erzeugt ausschließlich FS-006-konforme Vorschläge.
- Ein Reparaturvorschlag wird zuerst als Zusammenfassung/Diff angezeigt.
- Erst „Vorschlag übernehmen“ übergibt die erlaubten Commands an die
  vorhandene Laborruntime beziehungsweise den Quellcodeeditor.
- Erklärungen und Messvorschläge verändern niemals Laborzustand oder Code.

## Sichtbare Abgrenzung

Der lokale Modus wird als „Vertragsvorschau – keine Live-KI/Credits“
gekennzeichnet. Er enthält weder `fetch` noch Provider-Schlüssel, Credits,
Browser-Speicher oder versteckte automatische Reparaturen.

## Abnahme

- alle drei Aktionen sind sichtbar und tastaturbedienbar,
- Vorschläge werden nochmals mit FS-006 validiert,
- Reparatur bleibt vor Bestätigung wirkungslos,
- Ablehnen/Wechseln verwirft einen offenen Diff,
- Bestätigung führt nur erlaubte Commands aus,
- Tests beweisen den netzwerkfreien Fixture-Pfad.

Kein Commit, Push, Deployment oder Live-KI-Aufruf.
