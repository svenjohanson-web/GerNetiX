# Codex-Erinnerungsverfahren

## Ziel

Neue Codex-Chats sollen nicht wieder bei null beginnen. Das Projektwissen soll in wenigen stabilen Projektartefakten liegen, damit Codex wichtige Entscheidungen, Architekturregeln und Dokumentationspflichten schnell wieder aufnehmen kann.

## Startcheck fuer neue Chats

Codex soll zu Beginn groesserer Arbeiten kurz diese Quellen pruefen:

1. `AGENTS.md` fuer die Projekt-Erinnerung.
2. `docs/documentation-strategy.md` fuer die Reihenfolge von Fachlichkeit, Graph, Datenmodell, Implementierung und Nachweis.
3. `docs/system-process-application-uml.md` fuer Serverprozesse, Applikationen und Abhaengigkeiten.
4. `docs/system-process-application-uml.svg` als Bildartefakt der aktuellen Architekturansicht.
5. `data/` fuer die kanonischen Graph-/YAML-Quellen.
6. Den Context Manager fuer bestaetigte Projektkontexte und offene Vorschlaege.

## Immer aktuell halten

- Graphen und kanonische YAML-Dateien sind die fachliche Quelle der Wahrheit.
- Architektur-Aenderungen muessen in der Markdown-Sicht und im SVG-Bildartefakt sichtbar sein.
- Neue oder geaenderte Serverprozesse muessen in der Architekturansicht auftauchen.
- Neue oder geaenderte Applikationen/HMIs muessen in der Architekturansicht auftauchen.
- Neue Abhaengigkeiten zwischen Servern, Tools, Persistenz und UIs muessen dokumentiert werden.
- Wichtige Projektentscheidungen muessen zentral dokumentiert werden, nicht nur im Code.

## Kleine Abschlusspruefung nach Umsetzung

Nach einer Umsetzung soll Codex kurz pruefen:

- Wurde Code geaendert?
- Aendert sich dadurch eine Anforderung, Architektur, Abhaengigkeit oder Persistenz?
- Muss ein Graph, eine YAML-Quelle, die UML-Markdown-Datei oder das SVG aktualisiert werden?
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

## Kein grosses Prozesswerk

Dieses Verfahren ist bewusst klein. Es soll Codex erinnern, nicht den Entwickler mit Formularen beschaeftigen. Wenn unklar ist, ob eine Aenderung dokumentationsrelevant ist, gilt:

> Lieber einen kurzen zentralen Eintrag aktualisieren als Projektwissen nur im Chat verlieren.
