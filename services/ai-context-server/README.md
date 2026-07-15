# AI Context Server

Eigenstaendiger Service fuer abgesicherten KI-Kontextzugriff.

Der Service entscheidet vor einem KI-Aufruf, ob eine Datenquelle als Kontext genutzt werden darf. Auf dem VPS speichert er Grants, globale Policy, Prompt-Grundlagen, Architektur-Bausteine, lokales Help-Wissen und Audit-Events in einer eigenen PostgreSQL-Datenbank mit pgvector. Die lokale SQLite-Datei bleibt als Entwicklungs-Fallback und einmalige Migrationsquelle erhalten.

## Zweck

- deny-by-default fuer KI-Kontextdaten
- explizite Grants fuer Quelle, Scope, Zweck, Provider-Scope und Redaktionsstufe
- globale Policy fuer externe Provider und Kundendaten
- Audit fuer erlaubte und abgelehnte Kontextentscheidungen
- Source Registry fuer fachliche KI-Kontextquellen wie Hardware Catalog, Prompt-Grundlagen oder AI-Context-SQLite
- zentrale Prompt-Grundlagen fuer KI-Chat, Architektur-Discovery und weitere KI-Routen
- zentrale Architektur-Bausteine mit Eigenschaften, provided/required Schnittstellen, Entscheidungshinweisen und adaptiver Vektorsuche
- kuratierbares Help-Wissen mit lokaler pgvector-Suche; nur Treffer werden an den lokalen Help-Agenten uebergeben
- priorisierte KI-Klaerfaelle fuer unsichere Architektur-Interpretationen
- kontrollierter Feedbackkreis aus bestaetigten oder korrigierten Intent-Beispielen, wahlweise global oder accountbezogen
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
- `AI_CONTEXT_PERSISTENCE_BACKEND`: `postgres`, `sqlite` oder `memory`, lokal standardmaessig `sqlite`; VPS `postgres`
- `AI_CONTEXT_SQLITE_PATH`: eigene SQLite-Datei, Standard `.runtime/gernetix-ai-context.sqlite`
- `AI_CONTEXT_POSTGRES_HOST`, `AI_CONTEXT_POSTGRES_PORT`, `AI_CONTEXT_POSTGRES_DATABASE`, `AI_CONTEXT_POSTGRES_USER`, `AI_CONTEXT_POSTGRES_PASSWORD`: PostgreSQL-Verbindung
- `AI_CONTEXT_POSTGRES_URL`: optionale vollstaendige Connection-URL statt der Einzelwerte
- `AI_CONTEXT_EMBEDDING_BASE_URL`: Ollama-API, Standard `http://127.0.0.1:11434`
- `AI_CONTEXT_EMBEDDING_MODEL`: Embedding-Modell, Standard `embeddinggemma`
- `AI_CONTEXT_EMBEDDING_DIMENSIONS`: Vektordimension, Standard `768`

Lokale PostgreSQL-/pgvector-Entwicklung:

```powershell
docker compose -f infra/dev/docker-compose.yml up -d ai-context-postgres
ollama pull embeddinggemma
$env:AI_CONTEXT_PERSISTENCE_BACKEND="postgres"
npm run dev
```

Beim ersten PostgreSQL-Start werden vorhandene Daten aus `AI_CONTEXT_SQLITE_PATH` einmalig uebernommen. Die Migration wird in `ai_context_migrations` markiert und bei folgenden Starts nicht wiederholt.

## Sicherheitsregeln

- Ohne aktiven passenden Grant wird Kontextzugriff abgelehnt.
- Jede Preflight-Entscheidung erzeugt ein Audit-Event.
- Grants muessen Quelle, Scope, Zweck, Provider-Scope, Redaktionsstufe und Ablaufzeit enthalten.
- Registrierte Sources beschreiben Datenquellen; erst ein Grant erlaubt ihre Nutzung.
- Systemprompts und andere KI-Grundlagen liegen fuehrend in der AI-Context-Datenbank, nicht in den nutzenden Apps.
- Architektur-Bausteinwissen liegt fuehrend in PostgreSQL/pgvector; nutzende Dienste suchen semantisch und fallen bei nicht erreichbarem Embedding-Dienst kontrolliert auf lexikalische Suche zurueck.
- Help-Wissen hat den eigenen Source-Typ `help_knowledge` und darf ausschliesslich mit `ollama` genutzt werden. Bei keinem Treffer antwortet Help ohne Modellaufruf, statt allgemeines oder externes Wissen zu verwenden.
- Nicht bestaetigte Nutzerformulierungen werden nicht automatisch zu Lernbeispielen. Erst eine Admin-Bestaetigung oder -Korrektur aktiviert das Intent-Beispiel.
- Accountbezogene Intent-Beispiele werden nur fuer denselben Account gesucht; globale Beispiele enthalten keine Accountbindung.
- Nutzende Dienste duerfen Prompt-Regeln nur laden und dynamischen Laufzeitkontext ergaenzen; fachliche Prompt-Regeln gehoeren nicht in Identity-, IDE- oder Admin-Code.
- Externe Provider duerfen Kundendaten standardmaessig nicht erhalten.
- Redaktionsstufen sind `none`, `metadata_only`, `summary_only` und `masked`.
