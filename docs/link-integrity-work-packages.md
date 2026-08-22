# Link-Integrität und zentrales Referenzregister

## Ziel

GerNetiX führt Links nicht in einer manuell gepflegten Zweitliste. Interne Routen bleiben versionierte Anwendungsdefinitionen; Identity erzeugt daraus zusammen mit den tatsächlich vorkommenden `href`-, `src`-, `action`- und CSS-Referenzen ein maschinenlesbares Inventar. Operations persistiert Ziele, Fundstellen und Prüfhistorie in PostgreSQL. Das Admin Tool zeigt ausschließlich den zentralen Betriebszustand.

Eine zentrale Sicht verändert den fachlichen Besitz nicht. Jede Referenz behält `owner_domain`; Operations besitzt nur Inventar und technischen Prüfnachweis.

## Datenfluss

```text
Identity Route Registry + Quellreferenzen
                  |
                  v
       internes Linkinventar-API
                  |
                  v
Operations PostgreSQL: Ziele, Fundstellen, Prüfläufe
                  |
                  v
          Admin Tool Link-Sicht

Technisches Testkonto -> authentifizierter HTTP-Prüflauf -> Prüfergebnisse
```

## Arbeitspakete

### WP-LINK-01 – Architektur- und Sicherheitsvertrag

Status: umgesetzt

- Linkdefinition, Fundstelle und Prüflauf fachlich trennen.
- Identity bleibt Eigentümer seiner Routen und Sitzungsprüfung.
- Operations wird PostgreSQL-Wahrheit für Linkinventar und Prüfhistorie.
- Testkonto-Credentials werden ausschließlich als Runtime-Secrets übergeben.
- Keine Session-Cookies, Passwörter oder privaten Seiteninhalte persistieren.

Abnahme: Architekturentscheidung, Requirement, Datenmodell und Testartefakt sind im SQLite-Graphen verbunden.

### WP-LINK-02 – Operations-PostgreSQL

Status: lokal umgesetzt

- `operations_link_targets` für deduplizierte Ziele.
- `operations_link_occurrences` für alle Fundstellen.
- `operations_link_checks` für unveränderliche Prüfergebnisse.
- Ein neuer Inventarlauf deaktiviert verschwundene Ziele, statt Historie zu löschen.
- PostgreSQL bleibt produktiv führend; SQLite unterstützt ausschließlich lokale Tests und Altbetrieb.

Abnahme: Repository-Tests weisen Schema, Ersetzung des Inventars und letzte Prüfergebnisse nach.

### WP-LINK-03 – Identity-Inventar

Status: lokal umgesetzt

- Stabile interne Hauptrouten besitzen Referenz-ID, Owner und Zugriffsklasse.
- Der Scanner extrahiert Referenzen automatisch aus ausgeliefertem HTML, JavaScript und CSS.
- Identische Ziele werden dedupliziert, Fundstellen bleiben vollständig erhalten.
- `GET /api/internal/link-integrity/inventory` ist ausschließlich mit internem Admin-Token erreichbar.

Abnahme: Scanner-Test weist öffentliche, externe und authentifizierte Ziele sowie stabile Referenz-IDs nach.

### WP-LINK-04 – Authentifizierter HTTP-Prüflauf

Status: lokal umgesetzt, Runtime-Ausführung ausstehend

- `npm run check:links` meldet sich mit einem technischen Identity-Testkonto an.
- Öffentliche Ziele werden ohne Cookie, interne geschützte Ziele mit kurzlebiger Sitzung geprüft.
- Eine Rückleitung einer geschützten Route auf `/app/auth/` gilt als Fehler.
- Der Lauf meldet Inventar und Ergebnisse token-geschützt an Operations.
- `--external` nimmt zusätzlich externe HTTP-Ziele auf.
- Kontakt- und lokale Device-Links werden nicht von der Serverprüfung aufgerufen.

Runtime-Secrets:

```text
INTERNAL_API_TRUSTED_PUBLIC_KEYS_JSON
INTERNAL_API_SIGNING_KEY_ID
INTERNAL_API_SIGNING_PRIVATE_KEY_B64
LINK_CHECK_IDENTIFIER
LINK_CHECK_PASSWORD
```

Abnahme: kontrollierter Lauf gegen lokale oder Staging-Dienste, anschließend sichtbarer Zeitstempel im Admin Tool. Der Lauf wird nicht mit Kunden-Credentials ausgeführt.

### WP-LINK-05 – Admin-Tool-Sicht

Status: lokal umgesetzt

- Eigene Capability `admin_link_integrity`.
- Kennzahlen für interne, externe, authentifizierte, defekte und ungeprüfte Ziele.
- Tabelle mit Ziel, Owner, Zugriffsklasse, Fundstellenanzahl und letztem Ergebnis.
- Manuelle Inventarsynchronisation ruft ausschließlich das interne Identity-Inventar ab.
- Ingest-Endpunkte besitzen ein getrenntes Link-Integrity-Token.

Abnahme: Service- und UI-Contract-Tests; Zugriff ohne Admin-Capability wird abgewiesen.

### WP-LINK-06 – Browser-DOM-Prüfung nach Rollen

Status: offen

- Browserlauf für Basis-, Premium- und administrative Testprofile.
- Nach JavaScript-Rendering sichtbare Links und Sprungmarken erfassen.
- Erwartete Ausblendung, `403`, Entitlement-Sperre und echte Fehlleitung unterscheiden.
- Projektabhängige Routen mit vorbereiteten Testprojekten prüfen.
- Ergebnisse über denselben Operations-Ingest speichern.

Dieses Paket ergänzt den HTTP-Prüfer. Es ist erforderlich für Links, die erst im DOM erzeugt werden; es ersetzt weder Route Registry noch HTTP-Prüfung.

### WP-LINK-07 – Zeitplanung und Fehlereskalation

Status: offen

- Interne Prüfung nach Build/Deployment.
- Externe Prüfung zeitgesteuert mit Cache und begrenzter Parallelität.
- Temporäre Timeouts und `429` erneut prüfen.
- Erst wiederholte externe Fehler als bestätigten Defekt markieren.
- Bestätigte Fehler als Systemereignis beziehungsweise spätere Arbeitsaufgabe melden.

Abnahme: geplanter Staging-Lauf, keine Secrets in Logs und nachvollziehbare Wiederholungsregel.

### WP-LINK-08 – Desktop-Prozessmonitor

Status: lokal umgesetzt

- Eigene read-only Ansicht `Links` mit Kennzahlen, Ziel, Owner, Zugriffsklasse, Fundstellen und letztem Prüfnachweis.
- Der Electron-Renderer besitzt weder Netzwerkzugriff auf das Admin Tool noch Admin- oder PostgreSQL-Credentials.
- Der Main-Prozess verwendet den bereits abgesicherten SSH-/WireGuard-Diagnoseweg.
- Ein fest definiertes Skript im Admin-Tool-Container liest die autorisierte Link-Integrity-API; das Admin-Token bleibt im Container.
- Nur die für die Darstellung benötigten Felder werden über IPC an den Renderer weitergegeben.

Abnahme: Process-Monitor-Test weist IPC-Isolation, festen Diagnosebefehl, Entfernung von Audit-/Rohdaten und die UI-Sicht nach.

## Ausführung

Der lokale oder Staging-Prüflauf wird im Identity-Paket gestartet:

```text
npm run check:links
npm run check:links -- --external
```

Ein Serverstart, Staging-Deployment oder produktiver Prüflauf erfolgt nicht automatisch durch eine normale Codeänderung.
