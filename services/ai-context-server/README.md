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
- zentrale Architektur-Bausteine mit Eigenschaften, provided/required Schnittstellen und Entscheidungshinweisen fuer erklaerbare Startarchitekturen
- Pflege von Prompt-Regeln ueber die AI-Context-SQLite, damit nutzende Dienste ohne Codeaenderung und ohne Neustart neue Prompt-Regeln verwenden koennen
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
- Architektur-Bausteinwissen liegt fuehrend in der AI-Context-SQLite; nutzende Dienste duerfen daraus generisch suchen, aber keine fachlichen Bausteinantworten im Code pflegen.
- Nutzende Dienste duerfen Prompt-Regeln nur laden und dynamischen Laufzeitkontext ergaenzen; fachliche Prompt-Regeln gehoeren nicht in Identity-, IDE- oder Admin-Code.
- Externe Provider duerfen Kundendaten standardmaessig nicht erhalten.
- Redaktionsstufen sind `none`, `metadata_only`, `summary_only` und `masked`.
