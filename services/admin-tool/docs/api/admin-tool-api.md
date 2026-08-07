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
GET /api/admin/llm-models?provider=ollama
GET /api/admin/llm-models?provider=api&api_provider=openai-responses&base_url=https%3A%2F%2Fapi.openai.com%2Fv1
```

Liefert den Betriebsstatus der konfigurierten lokalen Dienste fuer das Admin Tool:

- erreichbare und nicht erreichbare Services
- Basis-URL, Health-URL, Antwortzeit und Statusmeldung je Service
- zusammengefasste Online-/Offline-Zaehler

Der Endpunkt ist rein lesend und persistiert keine Monitoring-Daten.

## Link-Integrität

```text
GET  /api/admin/link-integrity
POST /api/admin/link-integrity/sync
POST /api/internal/link-integrity/inventory
POST /api/internal/link-integrity/checks
```

`GET /api/admin/link-integrity` liefert aktive Ziele, Fundstellenanzahl und den letzten technischen Prüflauf. Der Zugriff benötigt `admin_link_integrity`.

`POST /api/admin/link-integrity/sync` liest das token-geschützte Identity-Inventar und ersetzt ausschließlich den aktuellen Identity-Inventarstand. Historische Prüfläufe bleiben erhalten.

Die internen Ingest-Endpunkte verlangen `X-GerNetiX-Link-Integrity-Token`. Sie speichern keine Testkonto-Credentials, Cookies oder gelesenen Seiteninhalte. Das Inventar umfasst Referenz-ID, Ziel, Linktyp, Owner, Zugriffsklasse und Fundstellen; ein Prüfergebnis umfasst Status, HTTP-Status, Endziel, Dauer und technischen Fehlercode.

## Auffaelligkeiten / System Events

```text
GET  /api/admin/system-events
POST /api/admin/system-events
POST /api/internal/system-events
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

`POST /api/internal/system-events` ist der Dienstweg fuer Runtime- und Authentifizierungsereignisse. Er verlangt den Header `X-GerNetiX-System-Event-Token` mit dem nur fuer diesen Ingest vorgesehenen `SYSTEM_EVENT_INGEST_TOKEN`. Passkey-Loginfehler werden mit Phase, Fehlercode, Account-ID soweit bereits serverseitig bekannt und Korrelations-ID erfasst. Credential-ID, Public Key, Challenge, Signatur und Browser-Credential-Payload werden nicht protokolliert.

## Nutzeraktions-Wirkketten

```text
GET  /api/admin/user-action-events?action_id={uuid}&action_type={type}&phase={phase}&limit={n}
POST /api/internal/user-action-events
```

Der interne Endpunkt verlangt `X-GerNetiX-System-Event-Token` und akzeptiert
nur den serverseitig validierten Vertrag aus Action-Typ, Action-ID, Span,
Phase, stabilem Reason-Code, Route, Release und grober Dauerklasse. Freie
Fehlermeldungen, lokale Ports und Device-Pfade, USB-Kennungen, IP-Adressen,
Hostnamen, Eingaben, Rohlogs und Medien sind kein Bestandteil dieses Vertrags.

Der geschuetzte Admin-Endpunkt aggregiert Versuche, Erfolge, offene und
fehlgeschlagene Aktionen nach `action_type` und liefert die letzten Versuche.
Mit einer vollstaendigen validierten `action_id` liefert er ausschliesslich die
Ereignisse dieser Wirkkette fuer die chronologische Action-/Span-Timeline; ein
ungueltiger UUID-Filter wird abgewiesen. Die Action-ID dient ausschliesslich der technischen
Wirkkettenkorrelation und niemals der Autorisierung oder Besitzpruefung. Die
vier initial implementierten Aktionstypen sind `nexi.flash.usb.start`,
`identity.login.passkey`, `project.settings.save` und `project.build.start`;
die Admin-Oberflaeche zeigt diesen Instrumentierungsstand unabhaengig davon,
ob bereits Ereignisse fuer alle vier Typen vorliegen.

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

## Bewertungen und Verbesserungsvorschlaege

```text
GET /api/admin/learning-feedback?actor_id=admin-1&role=administrator&purpose=feedback_review
```

Identifizierende Daten werden nur bei erlaubtem Zugriff sichtbar.

Die Operator Console gruppiert abgeschlossene Bewertungen ueber die stabile
Lernprojekt-ID und zeigt je Lernprojekt Anzahl, Mittelwerte von
Verstaendlichkeit, Spass, Schwierigkeit und Vollstaendigkeit sowie die
1-bis-5-Verteilung aller vier Skalen. Zusaetzlich bietet sie einen
Projekt-/Templatefilter sowie einzelne Bewertungen,
optionale Kommentare und getrennte Verbesserungsvorschlaege. Die Werte stammen
live aus dem Project Server; das Admin Tool ist keine zweite fachliche
Persistenz. Auch in der maskierten Sicht bleiben nicht-identifizierende
Bewertungswerte und Vorschlagstexte auswertbar.

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

## KI-Klaerfaelle

```text
GET  /api/admin/ai-clarification-cases?status=open&priority=urgent
POST /api/admin/ai-clarification-cases/{case_id}/actions
```

Liefert die priorisierte Klärfall-Warteschlange aus dem AI Context Server. Entscheidungen werden mit Admin-Kennung weitergereicht. `confirm` und `correct` koennen die Formulierung als globales oder accountbezogenes Intent-Beispiel aktivieren; `prioritize` setzt die fachliche Prioritaet ohne ein separates Ticket anzulegen.

## LLM-Konfiguration

```text
GET  /api/admin/llm-config
PUT  /api/admin/llm-config
GET  /api/admin/llm-models
POST /api/admin/llm-config/test
```

Konfiguriert den Provider fuer Kunden-KI-Chat und Entwicklungsplattform. Standard ist OpenAI Responses mit `gpt-5-nano`; lokales Ollama, eine andere OpenAI-kompatible API oder Claude/Anthropic bleiben optionale Admin-Konfigurationen.

`PUT /api/admin/llm-config` akzeptiert neben `provider`, Endpoint, Modell und API-Key auch `apiProvider`:

- `openai-responses`: ruft `/responses` am OpenAI-Endpoint auf.
- `openai-compatible`: ruft `/chat/completions` auf.
- `anthropic`: ruft `/messages` am Anthropic-Endpoint auf.

Zusaetzlich kann `routes` gesetzt werden. Unterstuetzte Task-Routen:

- `general_chat`
- `architecture_discovery`
- `artifact_generation`
- `code_generation`
- `help_chat`

Jede Route akzeptiert `provider` mit `default`, `ollama` oder `api`. Artefakt- und Codegenerierung sind standardmaessig auf `ollama`, damit PlantUML-, Pseudocode- und Codeableitungen lokal und ohne externe Providerkosten laufen koennen.

Modell-IDs werden bewusst frei gespeichert, damit neue Provider-Modelle ohne Codeaenderung eingetragen werden koennen.
