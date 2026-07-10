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

## Service Monitoring

```text
GET /api/admin/monitoring
```

Liefert den Betriebsstatus der konfigurierten lokalen Dienste fuer das Admin Tool:

- erreichbare und nicht erreichbare Services
- Basis-URL, Health-URL, Antwortzeit und Statusmeldung je Service
- zusammengefasste Online-/Offline-Zaehler

Der Endpunkt ist rein lesend und persistiert keine Monitoring-Daten.

## Auffaelligkeiten / System Events

```text
GET  /api/admin/system-events
POST /api/admin/system-events
```

Zentrales leichtgewichtiges Betriebslog fuer auffaellige Runtime-Ereignisse, ohne Kibana/ELK-Stack.

`POST /api/admin/system-events` nimmt Ereignisse von Diensten entgegen, zum Beispiel:

- `source_service`: meldender Dienst, z. B. `identity_server`
- `target_service`: betroffene Abhaengigkeit, z. B. `device_management`
- `severity`: `info`, `warning`, `error` oder `critical`
- `event_type`: maschinenlesbarer Ereignistyp
- `message`: lesbarer Hinweis
- `impact`: betroffener Workflow
- `details`: technische Zusatzdaten ohne Secrets

Die Ereignisse werden im Admin Tool persistiert. Bei SQLite-Persistenz liegen sie in `admin_tool_system_events`.

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
- registrierte KI-Kontextquellen aus der AI-Context-Source-Registry
- aktive, abgelaufene und widerrufene Grants
- Datenquellen nach Typ, Provider-Scope und Redaktionsstufe
- letzte Kontext-Preflight-Entscheidungen mit erlaubten und abgelehnten Zugriffen
- AI-Context-SQLite-Tabellen mit Zeilenanzahl, Spalten und sicherer Vorschau
- fachliche Inhaltsvorschau aus dem Hardware Catalog, zum Beispiel ESP32-Boards und Capabilities
- feste Prompt-Grundlagen aus der AI-Context-SQLite fuer KI-Chat und Architektur-Discovery

Die Antwort enthaelt Metadaten zu Quellen und Grants, fachliche Vorschauen wie Hardware-Catalog-Auszug und die festen Prompt-Grundlagen aus dem AI Context Server. Secrets werden nicht ausgegeben. Ist der AI Context Server nicht erreichbar, liefert der Endpunkt einen sicheren Offline-Status mit leeren Listen.

## LLM-Konfiguration

```text
GET  /api/admin/llm-config
PUT  /api/admin/llm-config
GET  /api/admin/llm-models
POST /api/admin/llm-config/test
```

Konfiguriert den Provider fuer Kunden-KI-Chat und Entwicklungsplattform: lokales Ollama, eine OpenAI-kompatible API oder Claude/Anthropic.

`PUT /api/admin/llm-config` akzeptiert neben `provider`, Endpoint, Modell und API-Key auch `apiProvider`:

- `openai-responses`: ruft `/responses` am OpenAI-Endpoint auf.
- `openai-compatible`: ruft `/chat/completions` auf.
- `anthropic`: ruft `/messages` am Anthropic-Endpoint auf.

Zusaetzlich kann `routes` gesetzt werden. Unterstuetzte Task-Routen:

- `general_chat`
- `architecture_discovery`
- `artifact_generation`
- `code_generation`

Jede Route akzeptiert `provider` mit `default`, `ollama` oder `api`. Artefakt- und Codegenerierung sind standardmaessig auf `ollama`, damit PlantUML-, Pseudocode- und Codeableitungen lokal und ohne externe Providerkosten laufen koennen.

Modell-IDs werden bewusst frei gespeichert, damit neue Provider-Modelle ohne Codeaenderung eingetragen werden koennen.
