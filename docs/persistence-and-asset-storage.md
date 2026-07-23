# Persistenz- und Asset-Speicherkonzept

Dieses Dokument inventarisiert die dauerhaften GerNetiX-Speicher und ordnet Downloads, Firmware, Build-Artefakte, Account-Dateien und Community-Inhalte ihren Schutzbereichen zu. Der SQLite-Graph bleibt die kanonische Quelle fuer Entscheidungen und Beziehungen; dieses Dokument ist die lesbare Betriebs- und Implementierungssicht.

## Verbindliche Regeln

- Fachliche Daten und dauerhaft benoetigte Binaerartefakte liegen ausschliesslich in SQL: SQLite oder PostgreSQL. Lose Dateien, JSON, Browser-State und Prozessspeicher sind keine Quelle der Wahrheit.
- Zugriff wird serverseitig aus Route, Sitzung, Besitz, Projektzuordnung und Freigabeklasse abgeleitet. Ein Client darf keine fremde `account_id` als Berechtigung setzen.
- Oeffentliche, angemeldete, berechtigte, kontoeigene, projektgebundene und interne Daten sind getrennte Schutzklassen.
- Veroeffentlichte Releases sind unveraenderlich. Eine neue Fassung erhaelt eine neue Version; Widerruf ersetzt kein Artefakt stillschweigend.
- Docker-Volumes schaffen Dauerhaftigkeit, sind aber kein Backup. Backup und Restore muessen SQLite samt WAL konsistent beziehungsweise PostgreSQL logisch sichern.

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

## Aktuelle fuehrende Speicher auf dem VPS

| Fachbereich | Fuehrender Speicherpfad | Compose-Volume | Inhalt |
|---|---|---|---|
| Identity | `/var/lib/gernetix/identity/gernetix-identity.sqlite` | `identity_state` | Accounts, Credentials, Sessions, Push |
| Plattform-Releases | `/var/lib/gernetix/identity/gernetix-platform-downloads.sqlite` | `identity_state` | Flashbox-Initialimage und Serial-Service als versionierte BLOBs |
| Account-Assets | `/var/lib/gernetix/identity/gernetix-account-assets.sqlite` | `identity_state` | owner-only QR-Codes, Bilder, Bildstile und Exporte |
| Projekte | `/var/lib/gernetix/projects/gernetix-projects.sqlite` | `project_state` | Projekte, Quellen, Build-Jobs, Lernstand |
| Build-Artefakte | `/var/lib/gernetix/build/gernetix-build-artifacts.sqlite` | `build_state` | Firmware-, ELF-, HEX-, Map- und Log-BLOBs |
| Telemetrie | `/var/lib/gernetix/telemetry/gernetix-telemetry.sqlite` | `telemetry_state` | partitionierte Messwerte und Ereignisse |
| Community | `/var/lib/gernetix/community/gernetix-community.sqlite` | `community_state` | Fragen, Antworten, private Begleitung, Knowledge-Dokumente |
| Oeffentliche Demos | `/var/lib/gernetix/public-demos/gernetix-public-demos.sqlite` | `public_demo_state` | redaktionell freigegebene Demos und Firmware |
| AI Context | PostgreSQL-Datenbank `gernetix_ai_context` | `ai_context_postgres_data` | Kontext, Grants, Policy, Audit und Vektoren |
| AI-Context-Migration | `/var/lib/gernetix/ai-context/gernetix-ai-context.sqlite` | `ai_context_state` | einmalige Altuebernahme/Fallback, nicht parallel fuehrend |
| Admin-Zugang | `/var/lib/gernetix/admin-access/gernetix-admin-access.sqlite` | `admin_access_state` | private Admin-Anmeldung und Sessions |
| verbleibende Services | `/var/lib/gernetix/services/gernetix-services.sqlite` | `service_state` | Device Management, Provisioning, Shop, Usage, Admin-Ereignisse und Schnittstellenstatistik |

Die Plattform-Release- und Account-Asset-SQLite liegen im gesicherten Identity-Volume, aber nicht in der Credential-Datenbank. Grosse BLOBs bleiben damit getrennt inventarisierbar und spaeter verschiebbar.

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
4. Build-&-Deploy liest Ausgaben nur aus dem temporaeren Build-Workspace und uebernimmt sie transaktional als BLOBs in die Build-Artefakt-SQLite.
5. Identity liefert ein Build-Artefakt erst nach serverseitiger Zuordnung des Build-Jobs zum angemeldeten Projektbesitzer. Die Flashbox erhaelt nur einen signierten, ablaufenden Auftrag fuer den konkreten Helper und das konkrete Ziel.

Damit kann dasselbe Release auf mehreren Rechnern verwendet werden, ohne lokal erneut ein Firmware-Image zu bauen. Das Flashen eines Arduino Nano oder anderen Targets bleibt ein Hardwarevorgang des lokalen Serial Service beziehungsweise der inventarisierten Flashbox; der VPS verwaltet Release, Build-Artefakt, Berechtigung und Auftrag.

## Bekannte Abweichungen und naechste Migrationen

- Mehrere technische Domaenen teilen noch `gernetix-services.sqlite`. Sie sind tabellarisch getrennt, aber noch keine getrennten Backup-/Restore-Einheiten.
- Die LLM-Routing-Konfiguration besitzt noch die Dev-Altlast `.runtime/identity-llm-config.json`; sie muss verschluesselt nach SQLite migriert werden.
- Provisioning besitzt weiterhin explizite Entwicklungsfallbacks fuer lokale Firmwarepfade. Im VPS-Betrieb muss das SQL-Artefakt fuehrend bleiben.
- Account-Assets verwenden derzeit JSON/Base64 bis 16 MiB. Fuer groessere Bilder ist spaeter ein streamingfaehiger Uploadvertrag sinnvoll; Eigentumspruefung und SQL-Wahrheit bleiben unveraendert.
- Backup-, Restore- und Retention-Zeiten muessen pro Volume beziehungsweise Datenbank operational getestet und protokolliert werden.

## Inventarisierung und Betrieb

Eine Speicherinventur erfasst mindestens Datenbank/Volume, Schutzklasse, fachlichen Owner, Tabellen, Groesse, Anzahl aktiver/verworfener Objekte, aeltestes/neuestes Objekt, Backup-Zeitpunkt und letzten Restore-Test. Inhalte, Passkeys, Tokens und private Metadaten werden dabei nicht in Logs oder Monitoring kopiert. Hash, Groesse, Status und technische ID reichen fuer Artefaktinventare aus.

Für die Community setzt das Admin Tool diese Grenze über `GET /api/community/operations-summary` um. Der interne, token-geschützte Aufruf liefert nur aggregierte Zahlen; auf dem lokalen Rechner zeigt die Desktop-App zusätzlich Existenz, relativen Pfad und Dateigröße von `.runtime/gernetix-community.sqlite`. Beide Ansichten lesen weder Titel und Texte noch Account- oder Projektkennungen aus.
