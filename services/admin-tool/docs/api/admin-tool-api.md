# Admin Tool API

Initialer MVP-Implementierungskontrakt.

## Healthcheck

```text
GET /health
```

## Overview

```text
GET /api/admin/overview
```

Liefert aggregierte Admin-Kennzahlen zu Devices, Feedback, Consents, Audit Events und KI-Usage fuer die Statistikseite.

## Device Management

```text
GET /api/admin/devices
GET /api/admin/devices/{device_id}?actor_id=admin-1&role=administrator&purpose=support_case
```

Detaildaten werden je nach Consent/Rechtsgrundlage maskiert oder vollstaendig angezeigt.

## Customer Data Consent

```text
POST /api/admin/customer-data-access/consents
POST /api/admin/customer-data-access/consents/{consent_id}/revoke
GET  /api/admin/customer-data-access/audit-events
```

Consents sind zweckgebunden, zeitlich begrenzt und widerrufbar.

## Learning Feedback

```text
GET /api/admin/learning-feedback?actor_id=admin-1&role=administrator&purpose=feedback_review
```

Identifizierende Daten werden nur bei erlaubtem Zugriff sichtbar.

## AI Usage Monitoring

```text
GET  /api/admin/ai-usage/summary
POST /api/admin/ai-cost-controls/actions
```

`GET /api/admin/ai-usage/summary` liefert Metriken fuer lokale und oeffentliche LLM-Nutzung:

- Gesamtanfragen, erfolgreiche und abgelehnte Anfragen
- Tokens, Credits und geschaetzte Providerkosten
- Gruppierung nach lokaler LLM-Quelle und externer API
- Modellaufschluesselung mit Latenz, Dauer und lokalen Tokens pro Sekunde, soweit vorhanden

Bei oeffentlichen LLMs werden geschaetzte Providerkosten ausgewiesen. Lokale LLMs fuehren keine externen Providerkosten.

Kostensteuerungsaktionen werden als Admin-Audit-Event protokolliert.

## LLM-Datenfreigaben

```text
GET /api/admin/ai-context/summary
```

Liefert eine Admin-Zusammenfassung, welche Daten dem LLM als Kontext bereitgestellt werden duerfen:

- globale AI-Context-Policy
- aktive, abgelaufene und widerrufene Grants
- Datenquellen nach Typ, Provider-Scope und Redaktionsstufe
- letzte Kontext-Preflight-Entscheidungen mit erlaubten und abgelehnten Zugriffen

Die Antwort enthaelt Metadaten zu Quellen und Grants, aber keine eigentlichen Kontextinhalte und keine Secrets. Ist der AI Context Server nicht erreichbar, liefert der Endpunkt einen sicheren Offline-Status mit leeren Listen.

## LLM-Konfiguration

```text
GET  /api/admin/llm-config
PUT  /api/admin/llm-config
GET  /api/admin/llm-models
POST /api/admin/llm-config/test
```

Konfiguriert den Provider fuer Kunden-KI-Chat und Entwicklungsplattform: lokales Ollama, eine OpenAI-kompatible API oder Claude/Anthropic.

`PUT /api/admin/llm-config` akzeptiert neben `provider`, Endpoint, Modell und API-Key auch `apiProvider`:

- `openai-compatible`: ruft `/chat/completions` auf.
- `anthropic`: ruft `/messages` am Anthropic-Endpoint auf.

Modell-IDs werden bewusst frei gespeichert, damit neue Provider-Modelle ohne Codeaenderung eingetragen werden koennen.
