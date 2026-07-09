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
