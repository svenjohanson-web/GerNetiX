# Persistenz- und Asset-Speicherkonzept

Dieses Dokument inventarisiert die dauerhaften GerNetiX-Speicher und ordnet Downloads, Firmware, Build-Artefakte, Account-Dateien und Community-Inhalte ihren Schutzbereichen zu. Der SQLite-Graph bleibt die kanonische Quelle fuer Entscheidungen und Beziehungen; dieses Dokument ist die lesbare Betriebs- und Implementierungssicht.

## Verbindliche Regeln

- Fachliche Daten und dauerhaft benoetigte Binaerartefakte liegen ausschliesslich in SQL: SQLite oder PostgreSQL. Lose Dateien, JSON, Browser-State und Prozessspeicher sind keine Quelle der Wahrheit.
- Zugriff wird serverseitig aus Route, Sitzung, Besitz, Projektzuordnung und Freigabeklasse abgeleitet. Ein Client darf keine fremde `account_id` als Berechtigung setzen.
- Oeffentliche, angemeldete, berechtigte, kontoeigene, projektgebundene und interne Daten sind getrennte Schutzklassen.
- Veroeffentlichte Releases sind unveraenderlich. Eine neue Fassung erhaelt eine neue Version; Widerruf ersetzt kein Artefakt stillschweigend.
- Docker-Volumes schaffen Dauerhaftigkeit, sind aber kein Backup. Backup und Restore muessen SQLite samt WAL konsistent beziehungsweise PostgreSQL logisch sichern.
- Eine SQLite-Datei wird niemals zwischen Entwicklungsrechnern geteilt oder aus der Ferne geoeffnet. Gemeinsamer Zugriff erfolgt ueber den jeweiligen Dienst. Der lokale Identity-Entwicklungsprozess nutzt die zentrale PostgreSQL-Datenbank ueber einen SSH-Tunnel; alle anderen Domaenen werden ueber ihre kanonischen APIs angesprochen.

## Schutz- und Speicherklassen

| Klasse | Beispiele | Lesen | Schreiben |
|---|---|---|---|
| `public_release` | accountneutrales Flashbox-Initialimage, veroeffentlichte Demo-Firmware | ohne Anmeldung | nur Release-Publishing |
| `authenticated_release` | MaxSerial/GerNetiX Serial Service, allgemeine Downloads | angemeldeter Account | nur Release-Publishing |
| `entitled_release` | spaetere Kauf-, Kurs- oder Lizenzdownloads | Sitzung plus serverseitiges Entitlement | nur Release-Publishing |
| `account_asset` | persoenlicher QR-Code, eigenes Bild, Bildstil, Export | ausschliesslich Eigentuemer | Eigentuemer ueber Account-API |
| `project_asset` | Projektquellen, Diagramme, Build-Konfiguration | Account plus Projektbesitz | Account plus Projektbesitz |
| `build_artifact` | `firmware.bin`, `firmware.hex`, ELF, Map, Build-Log | Account plus Build-/Projektzuordnung | Build-&-Deploy-Server |
| `community_content` | oeffentliche Frage oder private Projektbegleitung | explizite Community-Sichtbarkeit | angemeldeter Autor/Operator |
| `factory_internal` | Provisioning-Artefakt, Recovery- und Factory-State | interner Servicevertrag | Provisioning/Operator |
| `telemetry` | Messwerte, Ereignisse, Retention | Account plus Projekt-/Device-Besitz | authentifizierter Ingress |
| `identity_secret` | Credentials, Passkeys, Sessions, SMTP-Konfiguration | nur Identity/autorisiertes Admin-API | Identity |
| `technical_cache` | PlatformIO-Toolchains, inkrementelle Workspaces, Nginx-Cache | nur jeweiliger Prozess | jederzeit neu erzeugbar |

`visibility` eines Plattform-Releases ist `public`, `authenticated`, `entitled` oder `internal`. Ein kontoeigenes Asset hat dagegen fest `owner_only` und darf nicht durch Umdeklarieren veroeffentlicht werden.

## Zentrale fuehrende Laufzeitdatenbank auf dem VPS

Der laufende VPS verwendet genau einen PostgreSQL-17-Prozess mit pgvector, eine
Datenbank `gernetix_runtime` und ein persistentes Volume
`runtime_postgres_data`. Die Services bleiben fachlich getrennte Schreiber; ihre
Tabellen tragen stabile Domaenenpraefixe. Die frueher getrennten PostgreSQL-
Container und produktiven SQLite-Dateien sind damit keine Laufzeitkomponenten
mehr.

| Fachbereich | Fuehrender Speicherpfad | Compose-Volume | Inhalt |
|---|---|---|---|
| Identity | PostgreSQL `gernetix_runtime`, Tabellen `identity_*` | `runtime_postgres_data` | Accounts, Credentials, Passkeys, Recovery-Transaktionen, Sessions, Push-/SMTP-State, Plattform-Releases, Account-Assets und Wissenskapitel-Lesestaende |
| Identity-Altbestand | `/var/lib/gernetix/identity/gernetix-identity.sqlite` | `identity_state` | einmalige, idempotente Altuebernahme; nach erfolgreicher Migration nicht mehr fuehrend |
| Projekte | PostgreSQL `gernetix_runtime`, Tabellen `project_*` | `runtime_postgres_data` | Projekte, Quellen, Build-Jobs, Lernstand, Feedback und Ressourcenprofile |
| Projekt-Altbestand | `/var/lib/gernetix/projects/gernetix-projects.sqlite` beziehungsweise fruehere `gernetix-services.sqlite` | `project_state` / `service_state` | einmalige, read-only Altuebernahme; nach erfolgreicher Migration nicht mehr fuehrend |
| Build und OTA | PostgreSQL `gernetix_runtime`, Tabellen `build_*` | `runtime_postgres_data` | Firmware-, ELF-, HEX-, Map- und Log-BLOBs sowie OTA-Bestaetigungen |
| Telemetrie | PostgreSQL `gernetix_runtime`, Tabellen `telemetry_*` | `runtime_postgres_data` | partitionierte Messwerte, Ereignisse und Retention |
| Telemetrie-Altbestand | `/var/lib/gernetix/telemetry/gernetix-telemetry.sqlite` beziehungsweise fruehere `gernetix-services.sqlite` | `telemetry_state` / `service_state` | einmalige, read-only Altuebernahme; danach nicht mehr fuehrend |
| Community | PostgreSQL `gernetix_runtime`, Tabellen `community_*` | `runtime_postgres_data` | Fragen, Antworten, private Begleitung und Knowledge-Dokumente |
| Community-Altbestand | `/var/lib/gernetix/community/gernetix-community.sqlite` | `community_state` | einmalige, read-only Altuebernahme; danach nicht mehr fuehrend |
| Device Management | PostgreSQL `gernetix_runtime`, Tabellen `device_management_*` | `runtime_postgres_data` | Devices, Credentials, Pairing, Account-Inventar, Purchase Contexts, Consents und Audit |
| Device-Management-Altbestand | fruehere `/var/lib/gernetix/services/gernetix-services.sqlite` | `service_state` | einmalige, read-only Altuebernahme; danach nicht mehr fuehrend |
| AI Usage | PostgreSQL `gernetix_runtime`, Tabellen `ai_usage_*` | `runtime_postgres_data` | Credit-Konten, Ledger, Usage Events, Cost-Control-Policy und Admin-Audit |
| AI-Usage-Altbestand | fruehere `/var/lib/gernetix/services/gernetix-services.sqlite` | `service_state` | einmalige, transaktionale read-only Altuebernahme; danach nicht mehr fuehrend |
| Hardware Catalog | PostgreSQL `gernetix_runtime`, Tabellen `hardware_catalog_*` | `runtime_postgres_data` | TechnicalCapabilities, ProcessorBoards, Sensoren, Board-Optionen und Flashbox-Klassen |
| Hardware-Catalog-Altbestand | fruehere `/var/lib/gernetix/services/gernetix-services.sqlite` | `service_state` | einmalige, transaktionale read-only Altuebernahme; danach nicht mehr fuehrend |
| Hardware Shop | PostgreSQL `gernetix_runtime`, Tabellen `hardware_shop_*` | `runtime_postgres_data` | Angebote, Warenkoerbe, Bestellungen und Purchase Contexts |
| Hardware-Shop-Altbestand | fruehere `/var/lib/gernetix/services/gernetix-services.sqlite` | `service_state` | einmalige, transaktionale read-only Altuebernahme; danach nicht mehr fuehrend |
| Operations und Admin-Zugang | PostgreSQL `gernetix_runtime`, Tabellen `operations_*` und `admin_access_*` | `runtime_postgres_data` | Admin-Consents, Audit, Systemereignisse, Schnittstellenstatistik, Admin-Konten und Sessions |
| Operations-Altbestand | fruehere `/var/lib/gernetix/services/gernetix-services.sqlite` | `service_state` | einmalige, transaktionale read-only Altuebernahme; danach nur Rueckfallkopie |
| Oeffentliche Demos | PostgreSQL `gernetix_runtime`, Tabellen `public_demo_*` | `runtime_postgres_data` | redaktionell freigegebene Demos und Firmware-BLOBs |
| AI Context | PostgreSQL `gernetix_runtime`, Tabellen `ai_context_*` plus pgvector | `runtime_postgres_data` | Kontext, Grants, Policy, Audit und Vektoren |
| Verschluesselte Runtime-Konfiguration | PostgreSQL `gernetix_runtime`, Tabelle `runtime_state_documents` | `runtime_postgres_data` | LLM-Routing und weitere kleine Konfigurationsdokumente; Secret-haltige Inhalte AES-256-GCM-verschluesselt |
| Legacy-SQLite-Dateien | bisherige Volumes `identity_state`, `service_state`, `build_state`, `public_demo_state`, `admin_access_state` | nur am einmaligen Migrationscontainer read-only | Altuebernahme, keine laufende Nutzung durch Fachservices |

Die frueheren Plattform-Release-, Account-Asset- und Build-Artefakt-SQLite-Dateien werden ausschliesslich read-only migriert. Danach liegen Metadaten und BLOBs in ihren praefixierten Tabellen der zentralen Datenbank.

## Lokaler Port 4300 mit zentralem Datenstand

Der Identity Server darf auf einem Entwicklungsrechner lokal auf Port `4300` laufen, damit UI- und Servercode ohne Staging-Schritt geaendert werden koennen. Dabei gilt:

1. `tools/connect-staging.js` stellt innerhalb von WireGuard einen SSH-Tunnel zur zentralen PostgreSQL-Datenbank und zu den loopback-gebundenen Domaenendiensten auf dem VPS her.
2. `tools/start-identity-remote-dev.js` startet ausschliesslich den lokalen Identity Server auf `127.0.0.1:4300`, erzwingt `IDENTITY_PERSISTENCE_BACKEND=postgres` und verwendet die getunnelten Dienst-URLs.
3. Das Passwort liegt nur in `.env.remote-dev.local`; die Datei ist nicht versioniert.
4. Diese Betriebsart ist fuer einen gemeinsamen Entwicklungs-/Staging-Datenstand vorgesehen, nicht fuer die Produktionsdatenbank. Schemaaenderungen muessen rueckwaertskompatibel und vor dem gemeinsamen Einsatz getestet sein.
5. Alle Domaenendaten liegen in `gernetix_runtime`; der lokale Identity-Prozess greift ausser auf seine eigenen Identity-Tabellen auf alle Domaenen nur ueber deren HTTP-Dienste zu.
6. Der Remote-Dev-Starter setzt `IDENTITY_REMOTE_DEV=1`. Dadurch werden lokal keine Laufzeit-SQLite-Dateien angelegt. Releases, Account-Assets, Push-, SMTP- und LLM-Konfiguration verwenden die zentrale Runtime-Persistenz; schreibende Tests veraendern daher den gemeinsamen Entwicklungsstand.

Damit laufen auf dem MacBook fuer die normale Plattformarbeit nur der SSH-Tunnel und der lokale Prozess `4300`. PostgreSQL, AI Context und die anderen SQL-Dienste laufen auf dem VPS.

## Dateien ohne fachliche Persistenzrolle

| Bereich | Beispiel | Rolle |
|---|---|---|
| versionierte Website-Assets | `services/identity-server/public/` | Git-/Deployment-Inhalt, keine Nutzerablage |
| lokaler Paket-Fallback | `tools/usb-serial-helper/dist/` | Entwicklungsfallback; auf dem VPS ist SQL fuehrend |
| Build-Workspace und Cache | `/var/lib/gernetix/build/tmp`, Cache-/Toolchain-Verzeichnisse | loesch- und wiederherstellbarer technischer Cache |
| fuer Flashwerkzeuge materialisierte Firmware | Provisioning-Runtimepfad | temporaere Ableitung eines SQL-BLOBs |
| generierte Architektursicht | `tools/architecture-docs/dist/` | reproduzierbare Leseansicht |
| Browser-/PWA-State | IndexedDB, Cache Storage, Local Storage | UI-/Offline-Hilfe, niemals Besitz- oder Berechtigungsquelle |

## Abgrenzung Community und Account

Community-Inhalte gehoeren nicht in die Account-Asset-Ablage. Eine oeffentliche Community-Frage ist durch eine ausdrueckliche Freigabe lesbar; eine private Anfrage bleibt auf Autor und konfigurierte Operatoren begrenzt. QR-Codes, persoenliche Bilder und Bildstile bleiben immer `owner_only` und werden weder in Community-Suche, Wissensbasis noch KI-Kontext uebernommen. Eine spaetere Publikation erzeugt ein separates Community- oder Katalogobjekt mit Freigabeprozess; das private Original wird nicht umklassifiziert.

## Download- und Firmwarefluss

1. Ein Publisher schreibt Inhalt, Version, Plattform, Architektur, MIME-Type, Groesse, SHA-256 und Sichtbarkeit als unveraenderlichen SQL-Release.
2. Das oeffentliche Flashbox-API fragt ausschliesslich `flashbox-initial-image` mit `visibility=public` ab. Es enthaelt keine Account- oder Besitzdaten.
3. Der Serial-Service-/MaxSerial-Download fragt ausschliesslich `visibility=authenticated` ab und benoetigt eine Sitzung.
4. Build-&-Deploy liest Ausgaben nur aus dem temporaeren Build-Workspace und uebernimmt sie transaktional als BLOBs in `build_artifacts`.
5. Identity liefert ein Build-Artefakt erst nach serverseitiger Zuordnung des Build-Jobs zum angemeldeten Projektbesitzer. Die Flashbox erhaelt nur einen signierten, ablaufenden Auftrag fuer den konkreten Helper und das konkrete Ziel.

Damit kann dasselbe Release auf mehreren Rechnern verwendet werden, ohne lokal erneut ein Firmware-Image zu bauen. Das Flashen eines Arduino Nano oder anderen Targets bleibt ein Hardwarevorgang des lokalen Serial Service beziehungsweise der inventarisierten Flashbox; der VPS verwaltet Release, Build-Artefakt, Berechtigung und Auftrag.

## Bekannte Abweichungen und naechste Migrationen

- Alle dauerhaften VPS-Laufzeitdaten sind auf die zentrale PostgreSQL-Datenbank `gernetix_runtime` umgestellt.
- `gernetix-services.sqlite` bleibt nur als read-only Altquelle der idempotenten Migrationen erhalten. Kein produktiver Compose-Dienst schreibt weiter hinein.
- Provisioning, Recovery, Context Manager und Community AI halten kurzlebigen Workflow-State im Prozessspeicher. Dauerhafte Ergebnisse werden ueber Device Management, Community, AI Context oder `build_artifacts` uebernommen.
- Die lokale JSON-Datei der LLM-Routing-Konfiguration ist nur noch Altimport; produktiv liegt die Konfiguration verschluesselt in PostgreSQL.
- Provisioning besitzt weiterhin explizite Entwicklungsfallbacks fuer lokale Firmwarepfade. Im VPS-Betrieb muss das SQL-Artefakt fuehrend bleiben.
- Account-Assets verwenden derzeit JSON/Base64 bis 16 MiB. Fuer groessere Bilder ist spaeter ein streamingfaehiger Uploadvertrag sinnvoll; Eigentumspruefung und SQL-Wahrheit bleiben unveraendert.
- Backup-, Restore- und Retention-Zeiten muessen pro Volume beziehungsweise Datenbank operational getestet und protokolliert werden.

## Inventarisierung und Betrieb

Eine Speicherinventur erfasst mindestens Datenbank/Volume, Schutzklasse, fachlichen Owner, Tabellen, Groesse, Anzahl aktiver/verworfener Objekte, aeltestes/neuestes Objekt, Backup-Zeitpunkt und letzten Restore-Test. Inhalte, Passkeys, Tokens und private Metadaten werden dabei nicht in Logs oder Monitoring kopiert. Hash, Groesse, Status und technische ID reichen fuer Artefaktinventare aus.

Für die Community setzt das Admin Tool diese Grenze über `GET /api/community/operations-summary` um. Der interne, token-geschützte Aufruf liefert nur aggregierte Zahlen und liest weder Titel und Texte noch Account- oder Projektkennungen aus.
