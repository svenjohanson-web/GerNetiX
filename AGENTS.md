# Codex Projekterinnerung

Diese Datei ist die kurze Start-Erinnerung fuer neue Codex-Chats im GerNetiX-Projekt.

## Vor jeder groesseren Aenderung

- Lies zuerst `docs/codex-reminder-procedure.md`.
- Behandle die Graphen und kanonischen YAML-Daten unter `data/` als fachliche Quelle.
- Pruefe bei Architektur- oder Prozess-Aenderungen `docs/system-process-application-uml.md` und `docs/system-process-application-uml.svg`.
- Pruefe bei neuen Anforderungen, Artefakten, Entscheidungen oder Runtime-Komponenten, ob Context-Manager-Vorschlaege oder Context-Eintraege aktualisiert werden muessen.

## Umgang mit lokalen Dev-Prozessen

- Starte oder restarte lokale Devserver nicht vorsorglich.
- Pruefe zuerst, ob eine Aenderung ohne Prozessneustart greift, z. B. durch Config-Reload, statische Dateien, API-Endpoint oder Browser-Reload.
- Wenn nur Konfiguration oder Runtime-Daten geaendert wurden, erst den passenden Health-/Status-Endpoint pruefen und keinen Server neu starten.
- Wenn ein Neustart wirklich noetig ist, ermittle den Portbesitzer direkt mit `netstat -ano | findstr :PORT`, stoppe nur diesen Prozess und starte genau den betroffenen Service einmal neu.
- Vermeide wiederholte Startversuche mit verschiedenen Windows-Hintergrundmechanismen. Wenn ein Start fehlschlaegt, erst Fehlerursache/Log klaeren statt weitere Varianten zu probieren.
- Halte den Nutzer kurz informiert, bevor ein laufender Prozess beendet oder neu gestartet wird.

## Abschlussregel

Eine Umsetzung gilt erst als fertig, wenn Code, Tests und relevante Dokumentation zusammenpassen. Wenn sich Architektur, Abhaengigkeiten, Persistenz, Login-/App-Struktur oder Projektmodell aendern, muss die entsprechende Graph-/Diagramm-Sicht mitgezogen werden.
