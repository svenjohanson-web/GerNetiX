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
- `graph_database` / `.runtime/gernetix-ai-context.sqlite`: AI-Context-SQLite-Metadaten.

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

## SQLite Summary

```text
GET /api/ai-context/sqlite/summary
```

Liefert eine sichere Betriebsuebersicht der eigenen AI-Context-SQLite:

- Datenbankpfad, Service-Key und Schema-Version
- AI-Context-Tabellen mit Zeilenanzahl und Spaltenliste
- begrenzte Vorschauzeilen fuer Policy, Grants und Audit-Events
- Service-Document-Collections mit Zeilenanzahl

Die Summary ist kein Rohdump. `raw_json` und unkontrollierte Inhalte werden nicht ausgegeben.
