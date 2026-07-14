# AI Context API

## Healthcheck

```text
GET /health
```

## Policy

```text
GET /api/ai-context/policy
PUT /api/ai-context/policy
```

Die Policy steuert globale Schutzregeln wie `deny_without_grant`, explizite Source-Scopes, externe Provider bei Kundendaten und Default-Kontextgroessen.

## Grants

```text
GET  /api/ai-context/grants
POST /api/ai-context/grants
POST /api/ai-context/grants/{grant_id}/revoke
```

Ein Grant erlaubt eine konkrete Kontextquelle fuer Account, optional Projekt, Scope und Zweck.

Wichtige Felder:

- `account_id`
- `project_id`
- `source_type`: z. B. `project_files`, `graph_database`, `device_data`, `customer_data`
- `source_scope`
- `purpose`: z. B. `architecture_assistance`, `debugging`, `support_case`
- `allowed_provider_scope`: `local_only`, `external_allowed`, `external_redacted_only`
- `redaction_level`: `none`, `metadata_only`, `summary_only`, `masked`
- `valid_until`

## Sources

```text
GET  /api/ai-context/sources
POST /api/ai-context/sources
```

Die Source Registry beschreibt, welche fachlichen Datenquellen fuer KI-Kontext existieren. Sie ersetzt keinen Grant.

Startquellen:

- `hardware_catalog` / `processor_boards/esp32`: ESP32-ProcessorBoards, Basissoftwareprofile, Provisioningprofile und TechnicalCapabilities aus dem Hardware Catalog.
- `ai_prompt` / `prompt_foundations`: zentrale Prompt-Grundlagen fuer KI-Routen.
- `architecture_context` / `start_architecture/components`: zentrale Architektur-Bausteine, Eigenschaften, Schnittstellen und Entscheidungshinweise.
- `graph_database` / `.runtime/gernetix-ai-context.sqlite`: AI-Context-SQLite-Metadaten.

## Architecture Components

```text
GET  /api/ai-context/architecture-components
GET  /api/ai-context/architecture-components/search?q={query}&limit={1..20}
POST /api/ai-context/architecture-components
```

Liefert die fuehrenden Architektur-Bausteine aus der AI-Context-Datenbank. Der Suchpfad verwendet unter PostgreSQL Embeddings und pgvector-Cosine-Similarity. Ist der Embedding-Dienst nicht erreichbar, antwortet er mit `strategy: lexical_fallback`.

Wichtige Felder:

- `component_id`
- `name`
- `aliases`
- `summary`
- `properties`
- `provided_interfaces`
- `required_interfaces`
- `decision_hints`
- `source_scope`
- `status`: `active`, `draft` oder `archived`

## Prompt Foundations

```text
GET  /api/ai-context/prompt-foundations
POST /api/ai-context/prompt-foundations
```

Liefert die fuehrenden Prompt-Grundlagen aus der AI-Context-SQLite, zum Beispiel Systemprompts fuer `general_chat` und `architecture_discovery`.
`POST` legt eine Prompt-Foundation an oder aktualisiert sie. Nutzende Dienste wie Identity lesen diese Regeln nur und duerfen keine fachlichen Ersatz-Prompts im Code halten.

Filter:

- `route_task`
- `content_kind`
- `status`

Wichtige Felder fuer `POST`:

- `foundation_id`
- `title`
- `route_task`
- `source_scope`
- `content_kind`: aktuell `system_prompt`
- `allowed_sources`
- `blocked_sources`
- `content`
- `status`: `active`, `draft` oder `archived`

## KI-Klaerfaelle und Intent-Beispiele

```text
GET  /api/ai-context/clarification-cases?status=open&priority=urgent
POST /api/ai-context/clarification-cases
POST /api/ai-context/clarification-cases/{case_id}/actions
GET  /api/ai-context/intent-examples?status=active
GET  /api/ai-context/intent-examples/search?q={query}&account_id={account_id}
```

Unsichere Architektur-Erweiterungen werden anhand ihrer normalisierten Formulierung zusammengefuehrt. Prioritaet entsteht aus geringer semantischer Konfidenz, Wiederholungen, Konflikten und Korrekturen. Unterstuetzte Admin-Aktionen sind `confirm`, `correct`, `defer`, `ignore`, `reopen` und `prioritize`.

`confirm` und `correct` koennen den Fall als aktives Intent-Beispiel uebernehmen. Globale Beispiele stehen allen Accounts zur Verfuegung; accountbezogene Beispiele werden bei der semantischen Suche strikt auf den angegebenen Account begrenzt.

## Preflight

```text
POST /api/ai-context/preflight
```

Prueft, ob Kontextdaten fuer einen KI-Aufruf genutzt werden duerfen. Ohne aktiven passenden Grant antwortet die API mit `403` und schreibt trotzdem ein Audit-Event.

## Audit

```text
GET /api/ai-context/audit-events
```

Liefert erlaubte und abgelehnte Kontextzugriffsentscheidungen.

## Storage Summary

```text
GET /api/ai-context/storage/summary
GET /api/ai-context/sqlite/summary
```

Liefert eine sichere Betriebsuebersicht des aktiven Backends. Der alte SQLite-Pfad bleibt aus Kompatibilitaetsgruenden bestehen. Bei PostgreSQL werden Backend, Embedding-Modell und Zeilenanzahlen der AI-Context-Tabellen ausgegeben; bei SQLite bleibt die bisherige begrenzte Vorschau erhalten.
