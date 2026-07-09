# AI Context Server

Eigenstaendiger Service fuer abgesicherten KI-Kontextzugriff.

Der Service entscheidet vor einem KI-Aufruf, ob eine Datenquelle als Kontext genutzt werden darf. Er speichert Grants, globale Policy und Audit-Events bewusst in einer eigenen SQLite-Datei, getrennt vom allgemeinen Runtime-State.

## Zweck

- deny-by-default fuer KI-Kontextdaten
- explizite Grants fuer Quelle, Scope, Zweck, Provider-Scope und Redaktionsstufe
- globale Policy fuer externe Provider und Kundendaten
- Audit fuer erlaubte und abgelehnte Kontextentscheidungen
- Source Registry fuer fachliche KI-Kontextquellen wie Hardware Catalog, Prompt-Grundlagen oder AI-Context-SQLite
- zentrale Prompt-Grundlagen fuer KI-Chat, Architektur-Discovery und weitere KI-Routen
- Grundlage dafuer, dass KI spaeter gezielt mit Projekt-, Graph-, Device- oder Kundendaten antworten kann

## Start

```text
npm run dev
```

Standardadresse:

```text
http://127.0.0.1:5500
```

## Konfiguration

- `HOST` / `AI_CONTEXT_HOST`: Bind-Adresse, Standard `127.0.0.1`
- `PORT` / `AI_CONTEXT_PORT`: HTTP-Port, Standard `5500`
- `AI_CONTEXT_PERSISTENCE_BACKEND`: `sqlite` oder `memory`, Standard `sqlite`
- `AI_CONTEXT_SQLITE_PATH`: eigene SQLite-Datei, Standard `.runtime/gernetix-ai-context.sqlite`

## Sicherheitsregeln

- Ohne aktiven passenden Grant wird Kontextzugriff abgelehnt.
- Jede Preflight-Entscheidung erzeugt ein Audit-Event.
- Grants muessen Quelle, Scope, Zweck, Provider-Scope, Redaktionsstufe und Ablaufzeit enthalten.
- Registrierte Sources beschreiben Datenquellen; erst ein Grant erlaubt ihre Nutzung.
- Systemprompts und andere KI-Grundlagen liegen fuehrend in der AI-Context-SQLite, nicht in den nutzenden Apps.
- Externe Provider duerfen Kundendaten standardmaessig nicht erhalten.
- Redaktionsstufen sind `none`, `metadata_only`, `summary_only` und `masked`.
