# Codex Projekterinnerung

Diese Datei ist die kurze Start-Erinnerung fuer neue Codex-Chats im GerNetiX-Projekt.

## Vor jeder groesseren Aenderung

- Lies zuerst `docs/codex-reminder-procedure.md`.
- Lies den SQLite-Graphen `tools/yaml-graph-sqlite/out/model-graph.sqlite` als zentrale fachliche Quelle, insbesondere die aktiven Architekturentscheidungen, bevor Persistenz, Identity, Accounts, KI-Kontext, Projektmodell, Services oder Admin Tool geaendert werden.
- Behandle YAML-Dateien unter `data/` und `model/` nur als Legacy-Import, Bootstrap oder Export. Neue fachliche Regeln, Entscheidungen und Requirements werden direkt im SQLite-Graphen gepflegt, nicht parallel in YAML.
- Pruefe bei Architektur- oder Prozess-Aenderungen `docs/system-process-application-uml.md` und `docs/system-process-application-uml.svg`.
- Pruefe bei neuen Anforderungen, Artefakten, Entscheidungen oder Runtime-Komponenten, ob Context-Manager-Vorschlaege oder Context-Eintraege aktualisiert werden muessen.

## Umgang mit lokalen Dev-Prozessen

- Starte oder restarte lokale Devserver nicht vorsorglich.
- Pruefe zuerst, ob eine Aenderung ohne Prozessneustart greift, z. B. durch Config-Reload, statische Dateien, API-Endpoint oder Browser-Reload.
- Wenn nur Konfiguration oder Runtime-Daten geaendert wurden, erst den passenden Health-/Status-Endpoint pruefen und keinen Server neu starten.
- Wenn ein Neustart wirklich noetig ist, ermittle den Portbesitzer direkt mit `netstat -ano | findstr :PORT`, stoppe nur diesen Prozess und starte genau den betroffenen Service einmal neu.
- Vermeide wiederholte Startversuche mit verschiedenen Windows-Hintergrundmechanismen. Wenn ein Start fehlschlaegt, erst Fehlerursache/Log klaeren statt weitere Varianten zu probieren.
- Halte den Nutzer kurz informiert, bevor ein laufender Prozess beendet oder neu gestartet wird.

## Performance-Regel fuer Codex

- Vor Aenderungen zuerst bestimmen, ob Code, UI, SQLite-Graph, Doku oder Runtime betroffen ist.
- Services nur gezielt neu starten, wenn geaenderter Runtime-Code live verifiziert werden muss.
- Keine vorsorglichen Neustarts.
- Graph-Import nur fuer Legacy-/Bootstrap-YAML oder nach bewusstem YAML-Export nutzen. Neue Graph-Regeln per `tools/yaml-graph-sqlite/import-yaml-graph.js upsert-artifact` und `upsert-relationship` schreiben.
- Bei Querschnittsaenderungen erst alle Code-/UI-Tests ausfuehren, danach genau einmal Graph-Validierung oder Legacy-Import, falls noetig.
- Live-LLM-Aufrufe vermeiden, wenn ein Unit-Test oder API-Contract-Test denselben Nachweis liefert.
- Project Server ist die SQLite-Wahrheit fuer accountgebundene Projekte.
- AI Context Server ist die SQLite-Wahrheit fuer KI-Kontextquellen, Grants, Policy und Audit.
- Dauerhaftes Persistieren ist nur in SQL/SQLite erlaubt. JSON-Dateien, Prozessspeicher, localStorage, Browser-State, Temp-Dateien und Caches sind nur Logic/Control/View- oder Test-/Runtime-Hilfen und duerfen nie fachliche Quelle der Wahrheit sein.
- Abschlussnachweis kurz halten: geaenderte Bereiche, Tests, Graph-Status, offene Punkte.

## Abschlussregel

Eine Umsetzung gilt erst als fertig, wenn Code, Tests und relevante Dokumentation zusammenpassen. Wenn sich Architektur, Abhaengigkeiten, Persistenz, Login-/App-Struktur oder Projektmodell aendern, muss die entsprechende Graph-/Diagramm-Sicht mitgezogen werden.
