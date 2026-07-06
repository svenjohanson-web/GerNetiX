# Context Manager

Der Context Manager buendelt Requirements, Architektur, Implementierungsartefakte und Runtime-Zustand zu einem nutzbaren Codex-Kontext.

Er modelliert bewusst Requirement Slices: Ein Arbeitspaket setzt haeufig mehrere Anforderungen teilweise oder gemeinsam um. Der Service speichert diese Schnitte, verknuepft sie mit Artefakten und Runtime-Referenzen und erzeugt daraus redigierte Context Packs fuer User IDE, KI-Assistent, Admin-Tool oder Debugging.

## API

- `GET /health`
- `GET /api/context/current?account_id=...&project_id=...`
- `PUT /api/context/current`
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

Die Dokumentansicht wird parallel in `service_documents` gehalten, damit die Tools weiterhin generisch exportieren und inspizieren koennen.
