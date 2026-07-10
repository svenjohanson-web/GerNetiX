# Codex-Erinnerungsverfahren

## Ziel

Neue Codex-Chats sollen nicht wieder bei null beginnen. Das Projektwissen soll in wenigen stabilen Projektartefakten liegen, damit Codex wichtige Entscheidungen, Architekturregeln und Dokumentationspflichten schnell wieder aufnehmen kann.

## Startcheck fuer neue Chats

Codex soll zu Beginn groesserer Arbeiten kurz diese Quellen pruefen:

1. `AGENTS.md` fuer die Projekt-Erinnerung.
2. `tools/yaml-graph-sqlite/out/model-graph.sqlite` als zentrale Liste der bestaetigten Architekturentscheidungen und Requirements.
3. `docs/documentation-strategy.md` fuer die Reihenfolge von Fachlichkeit, Graph, Datenmodell, Implementierung und Nachweis.
4. `docs/system-process-application-uml.md` fuer Serverprozesse, Applikationen und Abhaengigkeiten.
5. `docs/system-process-application-uml.svg` als Bildartefakt der aktuellen Architekturansicht.
6. `data/` und `model/` nur als Legacy-Import-, Bootstrap- oder Exportquellen pruefen, nicht als parallele fachliche Wahrheit.
7. Den Context Manager fuer bestaetigte Projektkontexte und offene Vorschlaege.

## Immer aktuell halten

- Der SQLite-Graph ist die fachliche Quelle der Wahrheit.
- YAML-Dateien duerfen nicht parallel fachlich weitergepflegt werden, wenn der SQLite-Graph dieselbe Struktur validiert abbildet.
- Architektur-Aenderungen muessen in der Markdown-Sicht und im SVG-Bildartefakt sichtbar sein.
- Neue oder geaenderte Serverprozesse muessen in der Architekturansicht auftauchen.
- Neue oder geaenderte Applikationen/HMIs muessen in der Architekturansicht auftauchen.
- Neue Abhaengigkeiten zwischen Servern, Tools, Persistenz und UIs muessen dokumentiert werden.
- Wichtige Projektentscheidungen muessen zentral dokumentiert werden, nicht nur im Code.
- Bestaetigte Architekturentscheidungen werden im SQLite-Graphen gepflegt und bei neuen Kontexten frueh gelesen.

## Kleine Abschlusspruefung nach Umsetzung

Nach einer Umsetzung soll Codex kurz pruefen:

- Wurde Code geaendert?
- Aendert sich dadurch eine Anforderung, Architektur, Abhaengigkeit oder Persistenz?
- Muss der SQLite-Graph, eine Lesesicht, die UML-Markdown-Datei oder das SVG aktualisiert werden?
- Muessen Context-Manager-Vorschlaege oder bestaetigte Context-Eintraege aktualisiert werden?
- Gibt es einen Test oder zumindest einen nachvollziehbaren manuellen Nachweis?

## Lokale Dev-Prozesse ohne Timing-Schleifen

Codex soll lokale Serverprozesse sparsam behandeln:

- Kein vorsorgliches Neustarten von Identity Server, Admin Tool oder anderen Devservern.
- Erst klaeren, ob Browser-Reload, Config-Reload oder ein API-/Healthcheck genuegt.
- Config-Dateien und Runtime-State muessen nach Moeglichkeit live nachgeladen oder ueber gezielte Endpoints geprueft werden.
- Bei notwendigen Neustarts direkt ueber den Port arbeiten: `netstat -ano | findstr :PORT`, genau den Listener stoppen, genau den betroffenen Service einmal starten.
- Keine langen Trial-and-Error-Ketten mit `Start-Process`, `Start-Job`, `cmd start` oder Log-Redirects. Wenn der erste Start nicht sauber klappt, Ursache pruefen und dem Nutzer knapp melden.
- Prozessneustarts sind Eingriffe in den laufenden Arbeitskontext und sollen vorher angekuendigt werden.

## Performance-Regel fuer Codex

- Vor Aenderungen zuerst bestimmen, ob Code, UI, SQLite-Graph, Doku oder Runtime betroffen ist.
- Services nur gezielt neu starten, wenn geaenderter Runtime-Code live verifiziert werden muss.
- Keine vorsorglichen Neustarts.
- Neue fachliche Regeln, Entscheidungen und Requirements direkt im SQLite-Graphen pflegen.
- Graph-Import nur fuer Legacy-/Bootstrap-YAML oder nach bewusstem YAML-Export ausfuehren.
- Live-LLM-Aufrufe vermeiden, wenn ein Unit-Test oder API-Contract-Test denselben Nachweis liefert.
- Project Server ist die SQLite-Wahrheit fuer accountgebundene Projekte.
- AI Context Server ist die SQLite-Wahrheit fuer KI-Kontextquellen, Grants, Policy und Audit.
- Dauerhaftes Persistieren ist nur in SQL/SQLite erlaubt. JSON-Dateien, Prozessspeicher, localStorage, Browser-State, Temp-Dateien und Caches sind nur Logic/Control/View- oder Test-/Runtime-Hilfen und duerfen nie fachliche Quelle der Wahrheit sein.
- Abschlussnachweis kurz halten: geaenderte Bereiche, Tests, Graph-Status, offene Punkte.

## Kein grosses Prozesswerk

Dieses Verfahren ist bewusst klein. Es soll Codex erinnern, nicht den Entwickler mit Formularen beschaeftigen. Wenn unklar ist, ob eine Aenderung dokumentationsrelevant ist, gilt:

> Lieber einen kurzen zentralen Eintrag aktualisieren als Projektwissen nur im Chat verlieren.
