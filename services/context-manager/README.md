# Context Manager

Der Context Manager buendelt Requirements, Architektur, Implementierungsartefakte und Runtime-Zustand zu einem nutzbaren Codex-Kontext.

## Ziel

Der Context Manager soll Projektwissen moeglichst automatisch sammeln und dem Entwickler als Vorschlaege anzeigen. Der Entwickler soll nicht alles manuell dokumentieren muessen, sondern Vorschlaege pruefen, bearbeiten, uebernehmen oder verwerfen.

Der erste Ausbaustand bleibt bewusst einfach: Button, Analyse, Vorschlagsliste, Uebernehmen, Bearbeiten und Verwerfen. Die Analyse erzeugt keine echten Context-Eintraege ohne Bestaetigung.

Er modelliert bewusst Requirement Slices: Ein Arbeitspaket setzt haeufig mehrere Anforderungen teilweise oder gemeinsam um. Der Service speichert diese Schnitte, verknuepft sie mit Artefakten und Runtime-Referenzen und erzeugt daraus redigierte Context Packs fuer User IDE, KI-Assistent, Admin-Tool oder Debugging.

Der primaere Bedienfluss ist ein Review-Workflow: Der lokale Analyzer erkennt Projektkontexte aus Requirements, READMEs, Projektdateien, Services, Tools und Git-Historie. Benutzer uebernehmen, bearbeiten oder verwerfen die erzeugten Vorschlaege.

## API

- `GET /context-manager/` statische Operator-HMI fuer Scope, Requirement Slices, Entscheidungen, Runtime-Referenzen, Events und Context Packs; direkt nur auf Loopback, remote ausschliesslich ueber das sitzungsgeschuetzte Admin-Access-BFF
- `GET /health` ist die einzige offene Route und liefert nur minimalen Dienststatus
- `GET /api/context/current?account_id=...&project_id=...`
- `PUT /api/context/current`
- `POST /api/context/analyze`
- `GET /api/context/suggestions?scope_id=...&status=pending`
- `PATCH /api/context/suggestions/{suggestion_id}`
- `POST /api/context/suggestions/{suggestion_id}/accept`
- `POST /api/context/suggestions/{suggestion_id}/reject`
- `POST /api/context/requirement-slices`
- `POST /api/context/artifact-references`
- `POST /api/context/runtime-references`
- `POST /api/context/decisions`
- `POST /api/context/events`
- `POST /api/context/packs`
- `GET /api/context/packs/{pack_id}`
- `POST /api/context/redact`

Alle aufgefuehrten `/api/context`-Fachrouten arbeiten fail-closed. Sie verlangen
einen kurzlebigen Bearer-Token mit Audience `context-manager` und genau dem
benoetigten Minimal-Scope:

- `context_manager.read` fuer `current`, Vorschlagslisten und einzelne Context Packs,
- `context_manager.write` fuer Scope-, Referenz-, Entscheidungs-, Ereignis- und Vorschlagsmutationen,
- `context_manager.analyze` fuer Projektanalyse, Redaktion und Context-Pack-Erzeugung.

Der lokale Start liest die vertrauenswuerdigen Ed25519-Pruefschluessel aus
`INTERNAL_API_TRUSTED_PUBLIC_KEYS_JSON`. Fehlt die Konfiguration, wird keine
Fachroute ausgefuehrt (`503 internal_auth_not_configured`). Private
Signaturschluessel und interne Tokens duerfen nicht an die Browser-HMI
ausgegeben werden.

Die HMI ist selbst keine Authentifizierungsgrenze. Fuer interaktive
Operator-Nutzung liefert der Admin Access Server `/context-manager/` nach
seiner HttpOnly-Admin-Sitzungs- und Capabilitypruefung aus. Seine BFF-Routen
unter `/api/context/*` verwenden eine exakte Methoden-/Pfad-Allowlist,
Double-Submit-CSRF bei Mutationen und je Aufruf nur `context_manager.read`,
`.write` oder `.analyze`. Der Operator wird serverseitig als Token-Subject und
bei Context Events als `actor_id` gebunden; Request und Ergebnis werden ohne
Query oder Inhalt im Admin-Access-Audit erfasst. Browser erhalten weder Token
noch privaten Key. Der Context Manager darf nicht direkt durch einen externen
Reverse Proxy veroeffentlicht werden.

## Persistenz

Im VPS-Betrieb verwendet `CONTEXT_MANAGER_PERSISTENCE_BACKEND=postgres` die
zentrale Datenbank `gernetix_runtime`. Der Zustand wird unter dem isolierten
Namespace `context-manager` in `runtime_state_documents` gespeichert; eine
API-Antwort auf eine Mutation erfolgt erst nach erfolgreichem Commit. Der
Context Manager ist nur im internen Backend-Netz erreichbar.

Mit `CONTEXT_MANAGER_PERSISTENCE_BACKEND=sqlite` nutzt der Service den gemeinsamen SQLite State Store und schreibt zusaetzlich normalisierte Tabellen:

- `context_scopes`
- `context_requirement_slices`
- `context_artifact_references`
- `context_runtime_references`
- `context_decisions`
- `context_events`
- `context_packs`
- `context_redaction_policies`
- `context_suggestions`

Die Dokumentansicht wird parallel in `service_documents` gehalten, damit die Tools weiterhin generisch exportieren und inspizieren koennen.
