# KI-Community-Assistent

Diese Datei ist eine generierte Lesesicht.
Der validierte SQLite-Graph ist die kanonische Struktur.

## Einordnung

Der KI-Community-Assistent ist eine Premium-Funktion der Business-Domain `business_domain.community`.

Traceability-Regel:

```text
learning_path.community_knowledge_usage
-> business_domain.community
-> BC-040
-> Requirements
-> Architektur / Datenmodell / API / UI / Events / Tests
```

Es werden keine direkten neuen Beziehungen zu Vision, Business Goals oder Customer Journeys angelegt.

## Capability

`BC-040` KI-Community-Assistent bereitstellen

Premium-Nutzer koennen den Community-Wissensbestand per KI durchsuchen, verstehen, zusammenfassen und mit Quellenreferenzen nutzen.

## Kostenlos

- Beitraege lesen
- Beitraege schreiben
- Kommentare erstellen
- Projekte veroeffentlichen
- Projekte bewerten
- Projekte durchsuchen
- Dateien hochladen
- Diskussionen fuehren

## Premium

- natuerlichsprachliche Fragen
- Community-Beitraege durchsuchen
- lange Diskussionen zusammenfassen
- aehnliche Beitraege finden
- aehnliche Projekte finden
- Verweise auf Tutorials, Lernpfade, Kurse und Dokumentation
- Quellenangaben zu allen Antworten
- Themenbereiche zusammenfassen
- persoenliche Empfehlungen
- internationale Beitraege uebersetzen

## Architektur

`architecture_artifact.community_ai_assistant`

Verwendet:

- RAG
- Vektordatenbank
- Embeddings
- LLM
- Prompt Templates
- Quellenreferenzen
- Conversation Memory
- Moderationsregeln
- Premium-Zugriff
- KI Cost Protection
- KI Usage Observability

Zu indexierende Inhalte:

- Community-Beitraege
- Kommentare
- Projekte
- Dokumentationen
- Tutorials
- FAQ
- Lernpfade
- Kurse

## Artefakte

Requirements:

- `requirement.community_ai_assistant_query`
- `requirement.community_ai_assistant_sources`
- `requirement.community_ai_assistant_indexing`
- `requirement.community_ai_assistant_premium_access`
- `requirement.community_ai_assistant_admin_configuration`
- `requirement.community_ai_assistant_monitoring`
- `requirement.community_ai_assistant_moderation`

Datenmodelle:

- `data_model.community_ai_assistant_query`
- `data_model.community_ai_assistant_answer`
- `data_model.community_ai_source_reference`
- `data_model.community_ai_index_document`
- `data_model.community_ai_embedding`
- `data_model.community_ai_assistant_configuration`
- `data_model.community_ai_access_policy`
- `data_model.community_ai_usage_metric`
- `data_model.ai_usage_event`

APIs:

- `api_artifact.community_ai_assistant_query`
- `api_artifact.community_ai_assistant_admin`
- `api_artifact.ai_usage_preflight`
- `api_artifact.ai_usage_events`
- `api_artifact.ai_admin_usage_dashboard`

Berechtigungen:

- `system_capability.community_free_participation`
- `system_capability.community_ai_assistant`
- `system_capability.admin_community_ai_assistant`
- `role.community_member`
- `role.community_moderator`
- `role.community_ai_admin`
- `plan.free`
- `plan.premium`

Events:

- `event.community_ai_assistant_query_requested`
- `event.community_ai_assistant_answer_generated`
- `event.community_ai_assistant_request_blocked`
- `event.community_ai_index_updated`

## Admin

Konfiguration:

- Aktivierung
- Modell
- Tageslimit
- Monatslimit
- maximale Tokens
- maximale Antwortgroesse
- Budgetwarnungen
- Budgetobergrenzen
- Modell-Fallback
- Temperatur
- Kontextgroesse
- erlaubte Datenquellen
- Moderationsregeln
- Quellenpflicht
- RAG-Konfiguration

Monitoring:

- Anzahl KI-Anfragen
- aktive Premium-Nutzer
- durchschnittliche Antwortzeit
- Token-Verbrauch
- Kosten pro Tag, Monat, Benutzer und Community
- verwendete Modelle
- Cache-Trefferquote
- RAG-Trefferquote
- haeufigste Fragen
- Fehlerquote
- Budgetwarnungen
