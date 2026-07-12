# Aufgabenbezogener Projektkontext fuer Entwicklungs-KI

## Entscheidung

Die Entwicklungs-KI erhaelt nicht pauschal eine feste Anzahl vollstaendiger Projektdateien. GerNetiX folgt stattdessen einem agentischen KI-Ansatz: Zuerst ist die Aufgabe bekannt, danach werden die dafuer relevanten Projektquellen gesucht und nur die Treffer in den Modellkontext aufgenommen.

Diese Entscheidung orientiert sich am Arbeitsprinzip moderner Coding Agents wie Codex: Eine grosse Codebasis wird ueber Werkzeuge durchsucht, relevante Dateien werden gezielt geoeffnet und Aenderungen bleiben auf die ermittelten Projektpfade begrenzt. Fuer OpenAI Responses verwendet GerNetiX dazu einen mehrstufigen serverseitigen Function-Tool-Loop.

## Aktueller Ablauf

1. Der Nutzer formuliert seine konkrete Aufgabe im projektgebundenen KI-Chat.
2. Die IDE uebergibt nur Aufgabe und Pfad der aktuell geoeffneten Datei an die accountgeschuetzte Plattform-API.
3. Der Development Assistant bietet dem Modell `find_and_read_project_sources` als kombiniertes Function Tool an.
4. Das Modell entscheidet anhand der Aufgabe, welche Suche erforderlich ist; das Werkzeug liefert hoechstens drei relevante Treffer direkt mit Inhalt und vermeidet eine zweite Modellrunde nur zum Lesen.
5. Folgefragen setzen die bestehende OpenAI-Responses-Konversation ueber `previous_response_id` fort. Die IDE sendet nicht erneut den vollstaendigen Chatverlauf.
6. Der Agent darf nur zuvor gelesene Projektpfade als Aenderung vorschlagen; serverseitige Validierung verwirft andere Pfade.
7. Der Nutzer bestaetigt eine vorgeschlagene Dateiänderung, bevor sie im Project Server gespeichert wird.

## Abgrenzung

- Es werden nicht die ersten 40 Dateien, nicht das gesamte Projekt und keine zufaellige Dateiauswahl an das LLM gesendet.
- Es gibt keinen Fallback auf eine alte, pauschale oder alternative Kontextbeladung. Ist ein Werkzeug nicht verfuegbar, wird der KI-Aufruf mit einem eindeutigen Infrastrukturfehler beendet.
- Auch bei fehlender Prompt-Foundation, abgelehntem AI-Usage-Preflight, leerer Providerantwort oder nicht erreichbarem LLM wird keine inhaltliche Ersatzantwort erzeugt. Der Chat-Endpunkt liefert einen eindeutigen HTTP-Fehler und die UI kennzeichnet ihn als Systemfehler.
- Die normale Architektur-Discovery erhaelt weiterhin keine Projektdateien. Der Zugriff gilt nur fuer den projektgebundenen Code-Explorer und dessen explizite Aufgabe.
- Die Project-Server-Suche ist lexikalisch. Der Agent kann Suchbegriffe variieren und mehrere Such-/Leseschritte ausfuehren.
- Der Tool-Loop ist auf drei Schritte begrenzt. Account- und Projektgrenze werden serverseitig erzwungen; Schreibzugriffe bleiben bestaetigungspflichtig.

## Schnittstellen

- Development Assistant: OpenAI Responses Function Tool `find_and_read_project_sources`
- Project Server: `GET /api/projects/{projectId}/sources/search?q={task}&current_path={path}&limit=3`

Die Project-Server-Suche liefert dem Agenten nur Treffer-Metadaten. Inhalte werden einzeln ueber das Lesewerkzeug geladen. Die allgemeine Quellenliste bleibt inhaltsmaskiert.

## Zielbild

`Aufgabe verstehen -> Projekt durchsuchen -> relevante Quellen lesen -> Aenderung vorschlagen -> Nutzer bestaetigt -> Project Server speichert`

Dadurch sinken Tokenverbrauch und Datenoffenlegung, waehrend die KI auch in grossen Projekten gezielt arbeitsfaehig bleibt.

## Referenz

- OpenAI Codex Use Cases, insbesondere „Understand large codebases“: <https://developers.openai.com/codex/use-cases>
- OpenAI API Models: Function Calling und File Search als unterstuetzte Werkzeuge der Responses API: <https://developers.openai.com/api/docs/models>
