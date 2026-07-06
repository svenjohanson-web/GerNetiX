# Context Manager

Der Context Manager buendelt Requirements, Architektur, Implementierungsartefakte und Runtime-Zustand zu einem nutzbaren Codex-Kontext.

## Ziel

Der Context Manager soll Projektwissen moeglichst automatisch sammeln und dem Entwickler als Vorschlaege anzeigen. Der Entwickler soll nicht alles manuell dokumentieren muessen, sondern Vorschlaege pruefen, bearbeiten, uebernehmen oder verwerfen.

Der erste Ausbaustand bleibt bewusst einfach: Button, Analyse, Vorschlagsliste, Uebernehmen, Bearbeiten und Verwerfen. Die Analyse erzeugt keine echten Context-Eintraege ohne Bestaetigung.

Er modelliert bewusst Requirement Slices: Ein Arbeitspaket setzt haeufig mehrere Anforderungen teilweise oder gemeinsam um. Der Service speichert diese Schnitte, verknuepft sie mit Artefakten und Runtime-Referenzen und erzeugt daraus redigierte Context Packs fuer User IDE, KI-Assistent, Admin-Tool oder Debugging.

Der primaere Bedienfluss ist ein Review-Workflow: Der lokale Analyzer erkennt Projektkontexte aus Requirements, READMEs, Projektdateien, Services, Tools und Git-Historie. Benutzer uebernehmen, bearbeiten oder verwerfen die erzeugten Vorschlaege.

## API

- `GET /context-manager/` HMI fuer Scope, Requirement Slices, Entscheidungen, Runtime-Referenzen, Events und Context Packs
- `GET /health`
- `GET /api/context/current?account_id=...&project_id=...`
- `PUT /api/context/current`
- `POST /api/context/analyze`
- `GET /api/context/suggestions?scope_id=...&status=pending`
- `PATCH /api/context/suggestions/{suggestion_id}`
- `POST /api/context/suggestions/{suggestion_id}/accept`
- `POST /api/context/suggestions/{suggestion_id}/reject`
- `POST /api/context/requirement-slices`
- `POST /api/context/artifact-references`
- `POST /api/context/runtime-references`
- `POST /api/context/decisions`
- `POST /api/context/events`
- `POST /api/context/packs`
- `GET /api/context/packs/{pack_id}`
- `POST /api/context/redact`

## Persistenz

Mit `CONTEXT_MANAGER_PERSISTENCE_BACKEND=sqlite` nutzt der Service den gemeinsamen SQLite State Store und schreibt zusaetzlich normalisierte Tabellen:

- `context_scopes`
- `context_requirement_slices`
- `context_artifact_references`
- `context_runtime_references`
- `context_decisions`
- `context_events`
- `context_packs`
- `context_redaction_policies`
- `context_suggestions`

Die Dokumentansicht wird parallel in `service_documents` gehalten, damit die Tools weiterhin generisch exportieren und inspizieren koennen.
