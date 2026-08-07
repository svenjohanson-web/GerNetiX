# GerNetiX Operations

## Zweck

Diese Datei ist der verbindliche Einstieg fuer den Betriebszustand von
GerNetiX. Sie zeigt nicht nur das Zielbild, sondern fuer jeden Ops-Baustein den
tatsaechlichen Umsetzungs- und Nachweisstand.

Zustaende:

- **Umgesetzt:** Code und automatisierter Nachweis sind vorhanden.
- **Teilweise:** Ein nutzbarer Durchstich ist vorhanden, Abdeckung oder
  Betriebsnachweis ist noch unvollstaendig.
- **In Umsetzung:** Die aktuelle Aenderung ist begonnen, aber noch nicht
  abgenommen.
- **Geplant:** Beschrieben, aber noch nicht implementiert.

Ein Eintrag darf erst nach einem konkreten Test- oder Betriebsnachweis auf
**Umgesetzt** wechseln. Neue Operations-Funktionen muessen diese Matrix in
derselben Aenderung aktualisieren.

## Aktueller Stand

| Bereich | Status | Bereits vorhanden | Noch offen | Nachweis |
|---|---|---|---|---|
| Zentrale Systemereignisse | Umgesetzt | Token-geschuetzter Ingest, Operations-PostgreSQL, Admin-Sicht | Produktiver Alarm-End-to-End-Nachweis fuer alle Kategorien | Admin-Service- und Repository-Tests |
| Schnittstellenstatistik | Teilweise | Serviceaufrufe, Status und Dauer; Prozessmonitor-Aggregat | Vollstaendige Abdeckung aller internen Clients | Prozessmonitor-Tests |
| Link Integrity | Teilweise | Inventar, Pruefhistorie, Admin- und Desktop-Sicht | Produktiver periodischer Lauf | Link-Integrity-Contract-Tests |
| Nutzeraktions-Vertrag | Umgesetzt | Gemeinsamer Browser-Collector, serverseitige Allowlist, `action_type`, durchgaengige `action_id`, Spans und Datenschutzgrenze fuer die vier initialen Kernaktionen | Weitere betriebsrelevante Aktionen inventarisieren und schrittweise anbinden | Collector-, Ingest-, Wirkketten- und Negativtests; [Nutzeraktions-Konzept](user-action-operations-observability.md) |
| Nutzeraktions-Persistenz | Umgesetzt | Token-geschuetzter Ingest und Tabelle `operations_user_action_events` in PostgreSQL; SQLite nur fuer isolierte Tests | Staging-Migration und Retention-Policy betrieblich abnehmen | Admin-Service-, PostgreSQL- und HTTP-Contract-Tests |
| Nexi USB-Flash-Wirkkette | Umgesetzt | Klick, Release-ID, Helper-Status, Ports, Board-Probe, Manifest, Download, Flash und Verifikation tragen eine Action-ID; der lokale Helper fuehrt sie im Job mit | Kontrollierter Browser-/Board- und Staging-Nachweis | Browser-, Serial-Client-, Helper-Build- und Source-Contract-Tests |
| Passkey-Login-Wirkkette | Umgesetzt | Klick, Optionsanforderung, Browser-WebAuthn, Verifikation und Sitzungsaufbau tragen eine Action-ID; serverseitige Loginfehler verwenden dieselbe Korrelation | Kontrollierter Browser- und Staging-Nachweis | Passkey-, Action- und Source-Contract-Tests |
| Projekt-Einstellungen-Wirkkette | Umgesetzt | Deklarative `update_setting`-Controls, Validierung, revisionsgeschuetztes Speichern, UI-Refresh und Project-Server-Aufruf tragen eine Action-ID | Kontrollierter Browser- und Staging-Nachweis | Renderer-, Project-App-, Action- und Source-Contract-Tests |
| Projekt-Build-Wirkkette | Umgesetzt | Klick, Quellspeicherung, Auftragsanlage, Build-Dienst, Statusabfragen und fachliche Ergebniskontrolle tragen eine Action-ID | Kontrollierter Build- und Staging-Nachweis | Build-, Action- und Source-Contract-Tests |
| Nutzeraktions-Adminsicht | Umgesetzt | Geschuetzte Kennzahlen, letzte Versuche, exakte UUID-Suche und chronologische Action-/Span-Timeline mit Release, Route und Reason-Code ohne lokale Details | Zeitfenster-Aggregate, Runbook-/Incidentstatus und Browser-End-to-End-Nachweis ueber Admin Access | Admin-Service-, PostgreSQL-, HTTP- und UI-Contract-Tests |
| Nutzeraktions-Prozessmonitor | Umgesetzt | Read-only Auffaelligkeiten fuer `failed`, `timed_out` und `unhandled` aus Operations-PostgreSQL ueber den fest begrenzten Diagnosebefehl `user-action-alerts`; lokale Testdaten werden weiterhin getrennt gelesen | Diagnosewrapper auf Staging installieren, neues Desktop-Paket und kontrollierter WireGuard-Lauf | Prozessmonitor-, Shell-Syntax- und Datenschutz-Contract-Test |
| Nutzeraktions-Alarmierung | Geplant | Systemereignis- und Operator-Alarmweg vorhanden | Vierwoechige Baseline, Deduplizierung und Schwellwertabnahme | Noch offen |
| Synthetische Kernablaeufe | Geplant | Link- und Health-Pruefungen vorhanden | Browserbasierte Login-, Build-, Speicher- und Flash-Vorpruefungen | Noch offen |

## Nutzeraktions-Observability

Der verbindliche fachliche und technische Vertrag steht im
[Operations-Konzept fuer fehlgeschlagene Nutzeraktionen](user-action-operations-observability.md).

Die erste Einfuehrungsreihenfolge ist:

1. `nexi.flash.usb.start`
2. `identity.login.passkey`
3. `project.settings.save`
4. `project.build.start`

Alle vier initialen Wirkketten sind lokal implementiert und automatisiert
nachgewiesen. Noch nicht behauptet werden damit eine vollstaendige Abdeckung
aller Schaltflaechen, ein kontrollierter Staging-Durchstich oder die geplante
Schwellwertalarmierung.

Lokale Ports, USB-IDs, Device-Pfade, lokale IP-Adressen, Hostnamen,
Eingabewerte, freie Fehlermeldungen, Rohlogs und Medieninhalte bleiben von der
automatischen Operations-Erfassung ausgeschlossen.

## Pflege je Aenderung

Jede Operations-Aenderung beantwortet im Abschlussnachweis:

1. Welcher Matrixeintrag wurde veraendert?
2. Welcher Teil ist wirklich umgesetzt?
3. Welcher automatisierte oder betriebliche Nachweis liegt vor?
4. Welche Datenschutz- oder Sicherheitsgrenze wurde getestet?
5. Was bleibt ausdruecklich offen?

Architektur- oder Persistenzaenderungen werden zusaetzlich im SQLite-Graphen,
in der zentralen Architekturdokumentation und gegebenenfalls in der
Systemlandschaft nachgezogen.
