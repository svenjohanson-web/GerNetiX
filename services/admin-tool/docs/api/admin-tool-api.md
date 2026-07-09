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

Liefert aggregierte Admin-Kennzahlen zu Devices, Feedback, Consents und KI-Usage.

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

Kostensteuerungsaktionen werden als Admin-Audit-Event protokolliert.

## LLM-Konfiguration

```text
GET  /api/admin/llm-config
PUT  /api/admin/llm-config
GET  /api/admin/llm-models
POST /api/admin/llm-config/test
```

Konfiguriert den Provider fuer Kunden-KI-Chat und Entwicklungsplattform: lokales Ollama oder eine OpenAI-kompatible API.
