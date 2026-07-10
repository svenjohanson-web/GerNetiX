# Admin Tool

MVP fuer das GerNetiX Admin Tool als eigenstaendiger Admin-Backend/API-Service.

Das Admin Tool bietet erste berechtigte Sichten auf Device-Status, Support-Entitlement, Learning-Feedback, Customer-Data-Consent, Audit-Events, KI-Usage-Monitoring und LLM-Datenfreigaben. Es besitzt im MVP keine fuehrenden Domaenendaten, sondern nutzt Seed-/In-Memory-Daten als Adapter-Stellvertreter fuer die spaeteren Domaenen-APIs.

## Zweck

- Admin-/Support-Uebersicht bereitstellen
- Statistikseite fuer operative Admin-Kennzahlen bereitstellen
- Device-Management-Status pruefbar machen
- Support-Entitlement und GerNetiX-vs-Community einsehen
- kundenrelevante Details nur mit Consent, Rechtsgrundlage oder Sicherheitsgrund anzeigen
- Zugriffe auf kundenrelevante Daten auditieren
- Learning-Feedback maskiert oder berechtigt anzeigen
- KI-Usage-Kennzahlen fuer Kostenkontrolle zusammenfassen
- lokale und oeffentliche LLM-Nutzung getrennt anzeigen
- bei oeffentlichen LLMs geschaetzte Providerkosten anzeigen
- AI-Usage-Cost-Control-Regeln anzeigen: Kill-Switch, Account-Sperre, Modellfreigaben, Premium-Capability, Prompt-/Antwortlimits, Credit-Budget, Quellenlimits sowie Tages- und Monatslimits
- blockierte KI-Aufrufe mit Ablehnungsgrund, Schutzaktion, Account, Feature, Modell und Tokenumfang sichtbar machen
- administrative KI-Kostensteuerung auditierbar vorbereiten
- LLM-Provider fuer Kunden-KI-Chat und Entwicklungsplattform konfigurieren, inklusive lokalem Ollama, OpenAI-kompatiblen APIs und Claude/Anthropic
- LLM-Task-Routen konfigurieren, damit Chat/Architektur und Artefakt-/Codegenerierung unterschiedliche Provider nutzen koennen
- sichtbar machen, welche Datenquellen dem LLM per AI-Context-Grant bereitgestellt werden

## MVP-Implementierung

Start:

```text
npm run dev
```

Standardadresse:

```text
http://127.0.0.1:4600
```

Admin-HMI:

```text
http://127.0.0.1:4600/admin/
```

Konfiguration:

- `HOST`: Bind-Adresse, Standard `127.0.0.1`
- `PORT`: HTTP-Port, Standard `4600`
- `ADMIN_TOOL_RUNTIME_DIR`: Runtime-Verzeichnis fuer spaetere temporaere Artefakte
- `LLM_CONFIG_PATH`: Legacy-Pfad zur alten lokalen LLM-JSON-Konfiguration; fachliche LLM-Routing-Persistenz muss gemaess Architekturentscheidung in SQLite liegen.
- `AI_CONTEXT_BASE_URL`: AI-Context-Server fuer LLM-Datenfreigaben, Standard `http://127.0.0.1:5500`
- `HARDWARE_CATALOG_BASE_URL`: Hardware Catalog fuer fachliche KI-Kontextinhalte wie Boards und Capabilities, Standard `http://127.0.0.1:4910`
- `OLLAMA_BASE_URL`: lokaler Ollama-Endpoint, Standard `http://127.0.0.1:11434`
- `OLLAMA_MODEL`: lokales Default-Modell, Standard `llama3.2:3b`

LLM-Routing:

- Lokales Ollama nutzt `/api/chat` am konfigurierten Ollama-Endpoint.
- OpenAI Responses API nutzt `/responses` am OpenAI-Endpoint und ist der empfohlene Weg fuer aktuelle OpenAI-Modelle.
- OpenAI-kompatible APIs nutzen `/chat/completions` am konfigurierten API-Endpoint.
- Claude/Anthropic nutzt `/v1/messages` mit Anthropic API-Key.
- Modell-IDs koennen frei eingetragen werden; Preset-Buttons sind nur Schnellwahlhilfen.
- Task-Routen koennen fuer `general_chat`, `architecture_discovery`, `artifact_generation` und `code_generation` separat auf Standard, lokal oder API gesetzt werden.
- Artefakt- und Codegenerierung sind standardmaessig lokal geroutet, damit PlantUML-/Pseudocode-/Codeableitungen keine externen Providerkosten erzeugen, solange der Admin dies nicht bewusst aendert.

LLM-Datenfreigaben:

- Die Admin-Unterseite `LLM-Daten` liest Policy, Grants und Audit-Events vom AI Context Server.
- Registrierte KI-Kontextquellen aus der AI-Context-Source-Registry werden mit Scope, Backend, Inhaltstypen und Defaults angezeigt.
- Angezeigt werden aktive, abgelaufene und widerrufene Grants, Datenquellen, Provider-Scope, Redaktionsstufe und letzte Kontext-Preflight-Entscheidungen.
- Die AI-Context-SQLite wird als sichere Tabellenuebersicht mit Counts und Vorschau-Metadaten angezeigt.
- Fachliche Inhalte wie ESP32-Boards und Capabilities werden aus dem Hardware Catalog als Inhaltsvorschau angezeigt.
- Feste Prompt-Grundlagen fuer KI-Chat und Architektur-Discovery werden aus der AI-Context-SQLite gelesen und mit Quelle, Route, erlaubten und blockierten Kontextquellen angezeigt.
- Ist der AI Context Server nicht erreichbar, bleibt die Sicht verfuegbar und markiert den Kontext-Service als offline.

KI Usage:

- Die Admin-Unterseite `KI Usage` liest Summary, Policy, Account-Rating, Quellenlimits, Modellpreise, Suspicious-Usage-Hinweise und Ablehnungsgruende vom AI Usage Server.
- Aktive Cost-Control-Regeln werden als Pruefkette angezeigt, inklusive aktueller Schwellenwerte und der Anzahl ausgeloester Blockaden je Regel.
- Blockierte Aufrufe bleiben als Audit-Sicht sichtbar, damit Ursachen wie `insufficient_credits`, `model_not_allowed` oder `source_token_limit_exceeded` nicht nur im Chat erscheinen.

## Sicherheitsregeln

- Secret-Material, Credential-Secrets und HMAC-Schluessel werden nie angezeigt.
- Ohne Consent oder dokumentierte Rechtsgrundlage werden kundenrelevante Details maskiert.
- Jede Admin-/Support-Einsicht in kundenrelevante Daten erzeugt ein Audit-Event.
- Support-Rollen brauchen `support_registered_board_check` oder `admin_device_management`.
- Admin-Rollen brauchen die passende Admin-Capability fuer die jeweilige Sicht.
- LLM-Datenfreigaben werden als Metadaten gezeigt; freigegebene fachliche Vorschauen und Prompt-Grundlagen aus dem AI Context Server sind sichtbar, Secrets werden nicht im Admin Tool ausgegeben.

## Nicht-Ziele fuer diesen Stand

- keine produktive Authentifizierung
- keine produktive Admin-Authentifizierung
- keine Datenbankmigration
- keine direkte produktive Schreibverwaltung von Device Management, Learning oder AI Usage Services
- keine produktive Rollen-/Grant-Verwaltung
