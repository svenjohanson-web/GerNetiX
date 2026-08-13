# Schutzgrenze für Browserinhalte

Stand: 2026-08-14 · Status: lokal umgesetzt

## Grundsatz

Alles, was ein Browser für Darstellung und Interaktion ausführen muss, kann ein angemeldeter Nutzer technisch untersuchen. Minifizierung erschwert das Lesen, ist aber kein Kopierschutz. Der belastbare Schutz besteht deshalb darin, Volltexte, Lösungen, Entscheidungslogik, Berechtigungsentscheidungen und interne Artefakte gar nicht vorab an den Browser zu senden.

GerNetiX behandelt alle nicht ausdrücklich öffentlichen Inhalte technisch gleich: Standard ist eine serverseitige Sitzungsschranke. Produktmodi wie kostenlos, Abo oder Einzelkauf bestimmen nur die zusätzliche Berechtigung, nicht die technische Schutzklasse.

## Auslieferungsvertrag

| Kategorie | Browser erhält | Serverseitige Grenze |
| --- | --- | --- |
| Öffentliche Website, Login, Katalog und Leseprobe | ausdrücklich freigegebene Darstellung und Metadaten | feste öffentliche Allowlist |
| Plattformoberfläche | notwendige UI-Module nach Anmeldung | alle nicht freigegebenen App-Dateien standardmäßig sitzungsgeschützt |
| Wissenskapitel | nur das geöffnete Kapitel; anonym höchstens erster Abschnitt | Sitzung und Buch-Entitlement werden aus der Server-Session abgeleitet |
| GerNetiX-Hilfe | API-Loader ohne Artikeltexte | vollständiger Hilfekatalog nur nach Anmeldung |
| Quiz | Frage und Antwortoptionen ohne Lösung | Lösung, Bewertung und Erklärung erst nach serverseitiger Antwortprüfung |
| Lernprojekte, Vorlagen, Projektdateien und Downloads | nur der angeforderte, freigegebene Ausschnitt | bestehende Account-, Projekt-, Besitz- und Artefaktprüfungen der jeweiligen API |
| Build-, Konfigurations- und Berechtigungsentscheidungen | Ergebnis beziehungsweise erlaubte Aktion | Entscheidung verbleibt im zuständigen Server; Browserwerte sind nicht vertrauenswürdig |

## Produktionsnachweis

Der Identity-Produktionsbuild minifiziert JavaScript ohne Source Maps. Ein verpflichtender Offenlegungsscan prüft Quell- und Produktionsverzeichnis auf authored Wissensdateien, generierte Volltextdateien, vorab eingebettete Quizlösungen, Source-Map-Dateien und Source-Map-Verweise. Ein Treffer bricht den Build ab.

Nicht als Geheimnis behandelt werden notwendiges Markup, CSS, UI-Zustandsführung und rein darstellende Browserlogik. Geheimnisse, Entitlements und sicherheits- oder geschäftskritische Entscheidungen dürfen dort dennoch nie liegen.

## Abschlusskriterien

- Anonyme Direktabrufe geschützter Inhalte schlagen fehl oder liefern ausschließlich die definierte Vorschau.
- Ein angemeldeter Browser erhält nur Inhalte, die für die konkrete Sitzung freigegeben sind.
- Quizlösungen und Erklärungen fehlen im Katalog und werden erst für die abgegebene Antwort geliefert.
- Authored Volltexte liegen nicht in einem statisch auslieferbaren Verzeichnis.
- Der Produktionsbuild erzeugt keine Source Maps und besteht den Offenlegungsscan.
- Änderungen an Schutzgrenzen werden durch Negativtests, Sicherheitsdokumentation und SQLite-Graph nachgezogen.
