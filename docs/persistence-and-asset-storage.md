# Persistenz- und Asset-Speicherkonzept

Dieses Dokument inventarisiert die dauerhaften GerNetiX-Speicher und ordnet Downloads, Firmware, Build-Artefakte, Account-Dateien und Community-Inhalte ihren Schutzbereichen zu. Der SQLite-Graph bleibt die kanonische Quelle fuer Entscheidungen und Beziehungen; dieses Dokument ist die lesbare Betriebs- und Implementierungssicht.

## Verbindliche Regeln

- Fachliche Laufzeitdaten liegen in SQL. Nutzerbearbeitete Projektdateien und
  ihre Historie liegen nach dem Forgejo-Cutover in privaten Git-Repositories;
  dauerhaft benoetigte Binaerartefakte liegen im Artifact Store. Lose Dateien
  ausserhalb eines verwalteten Repository- oder Artifact-Store-Vertrags,
  Browser-State und Prozessspeicher sind keine Quelle der Wahrheit.
- Zugriff wird serverseitig aus Route, Sitzung, Besitz, Projektzuordnung und Freigabeklasse abgeleitet. Ein Client darf keine fremde `account_id` als Berechtigung setzen.
- Oeffentliche, angemeldete, berechtigte, kontoeigene, projektgebundene und interne Daten sind getrennte Schutzklassen.
- Veroeffentlichte Releases sind unveraenderlich. Eine neue Fassung erhaelt eine neue Version; Widerruf ersetzt kein Artefakt stillschweigend.
- PostgreSQL speichert niemals Binary-Payloads: kein `BYTEA`, keine Large Objects und keine als Base64/JSON getarnten Binaries. Es speichert nur fachliche Metadaten, Hashes und Artifact-Store-Referenzen.
- Jedes Binary im Artifact Store besitzt verpflichtend einen Quellpfad und eine unveraenderliche Quellversion (vollstaendiger Git-Commit oder reproduzierbarer Quell-/Package-Hash). Ohne diese Referenz darf es nicht publiziert werden.
- Dem Account zurechenbare Forgejo-Repositories einschliesslich Historie und
  Git-LFS sowie dauerhafte Projekt-Releases werden gegen die effektive,
  versionierte Speicherpolicy des Accounts gerechnet. Technische Build-Caches
  und kurzlebige Artefakte werden davon getrennt ausgewiesen.
- Konkrete Kontingente und Fristen sind keine unveraenderlichen Codekonstanten.
  Admin- und Kundenansicht lesen dieselbe effektive Policy und denselben
  serverseitig ermittelten Verbrauch. Details stehen in der
  [Account-Speicher- und Lifecycle-Policy](account-storage-and-lifecycle-policy.md).
- Docker-Volumes schaffen Dauerhaftigkeit, sind aber kein Backup. Backup und Restore muessen SQLite samt WAL konsistent beziehungsweise PostgreSQL logisch sichern.
- Eine SQLite-Datei wird niemals zwischen Entwicklungsrechnern geteilt oder aus der Ferne geoeffnet. Gemeinsamer Zugriff erfolgt ueber den jeweiligen Dienst. Der lokale Identity-Entwicklungsprozess nutzt die zentrale PostgreSQL-Datenbank ueber einen SSH-Tunnel; alle anderen Domaenen werden ueber ihre kanonischen APIs angesprochen.

## Schutz- und Speicherklassen

| Klasse | Beispiele | Lesen | Schreiben |
|---|---|---|---|
| `public_release` | accountneutrales Flashbox-Initialimage, veroeffentlichte Demo-Firmware | ohne Anmeldung | nur Release-Publishing |
| `authenticated_release` | MaxSerial/GerNetiX Serial Service, allgemeine Downloads | angemeldeter Account | nur Release-Publishing |
| `entitled_release` | spaetere Kauf-, Kurs- oder Lizenzdownloads | Sitzung plus serverseitiges Entitlement | nur Release-Publishing |
| `account_asset` | persoenlicher QR-Code, eigenes Bild, Bildstil, Export | ausschliesslich Eigentuemer | Eigentuemer ueber Account-API |
| `project_asset` | Projektquellen, Diagramme, Build-Konfiguration im privaten Forgejo-Repository | Account plus Projektbesitz ueber Project Server | Account plus Projektbesitz ueber Project Server |
| `build_artifact` | `firmware.bin`, `firmware.hex`, ELF, Map, Build-Log | Account plus Build-/Projektzuordnung | Build-&-Deploy-Server |
| `community_content` | oeffentliche Frage oder private Projektbegleitung | explizite Community-Sichtbarkeit | angemeldeter Autor/Operator |
| `factory_internal` | Provisioning-Artefakt, Recovery- und Factory-State | interner Servicevertrag | Provisioning/Operator |
| `telemetry` | Messwerte, Ereignisse, Retention | Account plus Projekt-/Device-Besitz | authentifizierter Ingress |
| `identity_secret` | Credentials, Passkeys, Sessions, SMTP-Konfiguration | nur Identity/autorisiertes Admin-API | Identity |
| `technical_cache` | PlatformIO-Toolchains, inkrementelle Workspaces, Nginx-Cache | nur jeweiliger Prozess | jederzeit neu erzeugbar |

`visibility` eines Plattform-Releases ist `public`, `authenticated`, `entitled` oder `internal`. Ein kontoeigenes Asset hat dagegen fest `owner_only` und darf nicht durch Umdeklarieren veroeffentlicht werden.

## Zentrale fuehrende Laufzeitdatenbank auf dem VPS

Der laufende VPS verwendet genau einen PostgreSQL-17-Prozess mit pgvector. Die
GerNetiX-Domaenen verwenden die Datenbank `gernetix_runtime` und das persistente
Volume `runtime_postgres_data`; ihre Tabellen tragen stabile
Domaenenpraefixe. Forgejo verwendet im selben PostgreSQL-Prozess die technisch
getrennte Datenbank `forgejo` mit eigenem Login und ohne Zugriff auf
`gernetix_runtime`. Die Trennung verhindert, dass fremdverwaltete
Forgejo-Tabellen mit dem GerNetiX-Domaenenmodell vermischt werden.

| Fachbereich | Fuehrender Speicherpfad | Compose-Volume | Inhalt |
|---|---|---|---|
| Identity | PostgreSQL `gernetix_runtime`, Tabellen `identity_*` | `runtime_postgres_data` | Accounts einschliesslich bevorzugter Oberflaechensprache, Credentials, Passkeys, Recovery-Transaktionen, Sessions, Push-/SMTP-State, Plattform-Releases, Account-Assets und Wissenskapitel-Lesestaende |
| Identity-Altbestand | `/var/lib/gernetix/identity/gernetix-identity.sqlite` | `identity_state` | einmalige, idempotente Altuebernahme; nach erfolgreicher Migration nicht mehr fuehrend |
| Projekte | PostgreSQL `gernetix_runtime`, Tabellen `project_*`, insbesondere Repository-Bindung, `project_learning_progress`, `project_learning_feedback` und `project_template_feedback` | `runtime_postgres_data` | Projektidentitaet, Owner, Rechte, Forgejo-Repository- und Commitreferenzen, Build-Jobs, aktuelle Lesson und aktueller Step, abgeschlossene Steps je Lesson, Projekt-/Template-Feedback und Ressourcenprofile; nach Cutover keine Projektdateiinhalte |
| Projektdateien und Historie | Forgejo, private Git-Repositories | `forgejo_data` | Quellcode, Header, Tests, Projektmanifest, Architekturdateien, Software-Einheiten, Buildkonfiguration und aufgeloeste projektbezogene Board-/Pin-Konfiguration als echte Dateien und Commits |
| Forgejo-Verwaltungsdaten | PostgreSQL-Datenbank `forgejo`, eigener Login | `runtime_postgres_data` | Forgejo-eigene Repository-, Organisations-, Token- und Betriebsmetadaten; kein GerNetiX-Domaenenmodell |
| Projekt-Altbestand | `/var/lib/gernetix/projects/gernetix-projects.sqlite` beziehungsweise fruehere `gernetix-services.sqlite` | `project_state` / `service_state` | einmalige, read-only Altuebernahme; nach erfolgreicher Migration nicht mehr fuehrend |
| Build und OTA | PostgreSQL `gernetix_runtime`, Tabellen `build_*`; Binaries im Artifact Store | `runtime_postgres_data` / `build_state` | Job-, Hash-, Quell- und Objektreferenzen sowie OTA-Bestaetigungen; Firmware, ELF, HEX, Map und Log ausschliesslich als content-addressed Objekte |
| Telemetrie | PostgreSQL `gernetix_runtime`, Tabellen `telemetry_*` | `runtime_postgres_data` | partitionierte Messwerte, Ereignisse und Retention |
| Telemetrie-Altbestand | `/var/lib/gernetix/telemetry/gernetix-telemetry.sqlite` beziehungsweise fruehere `gernetix-services.sqlite` | `telemetry_state` / `service_state` | einmalige, read-only Altuebernahme; danach nicht mehr fuehrend |
| Community | PostgreSQL `gernetix_runtime`, Tabellen `community_*`, insbesondere `community_marketplace_listings`, `community_project_ideas`, `community_project_idea_comments` und `community_project_showcases` | `runtime_postgres_data` | Fragen, Antworten, private Begleitung, Projektideen mit Diskussion, Showcase-Projekte mit begrenzter Projektkopie, Kleinanzeigen fuer gebrauchte Elektronik und Knowledge-Dokumente |
| Community-Altbestand | `/var/lib/gernetix/community/gernetix-community.sqlite` | `community_state` | einmalige, read-only Altuebernahme; danach nicht mehr fuehrend |
| Device Management | PostgreSQL `gernetix_runtime`, Tabellen `device_management_*` | `runtime_postgres_data` | Devices, Credentials, Pairing, Account-Inventar, Purchase Contexts, Consents und Audit |
| Device-Management-Altbestand | fruehere `/var/lib/gernetix/services/gernetix-services.sqlite` | `service_state` | einmalige, read-only Altuebernahme; danach nicht mehr fuehrend |
| AI Usage | PostgreSQL `gernetix_runtime`, Tabellen `ai_usage_*` | `runtime_postgres_data` | Credit-Konten, Ledger, Usage Events, Cost-Control-Policy und Admin-Audit |
| AI-Usage-Altbestand | fruehere `/var/lib/gernetix/services/gernetix-services.sqlite` | `service_state` | einmalige, transaktionale read-only Altuebernahme; danach nicht mehr fuehrend |
| Hardware Catalog | PostgreSQL `gernetix_runtime`, Tabellen `hardware_catalog_*` | `runtime_postgres_data` | TechnicalCapabilities, ProcessorBoards, Sensoren, Board-Optionen und Flashbox-Klassen |
| Hardware-Catalog-Altbestand | fruehere `/var/lib/gernetix/services/gernetix-services.sqlite` | `service_state` | einmalige, transaktionale read-only Altuebernahme; danach nicht mehr fuehrend |
| Hardware Shop | PostgreSQL `gernetix_runtime`, Tabellen `hardware_shop_*` | `runtime_postgres_data` | Angebote, Warenkoerbe, Bestellungen und Purchase Contexts |
| Hardware-Shop-Altbestand | fruehere `/var/lib/gernetix/services/gernetix-services.sqlite` | `service_state` | einmalige, transaktionale read-only Altuebernahme; danach nicht mehr fuehrend |
| Operations und Admin-Zugang | PostgreSQL `gernetix_runtime`, Tabellen `operations_*` und `admin_access_*` | `runtime_postgres_data` | Admin-Consents, Audit, Systemereignisse, Action-korrelierte Schnittstellenstatistik, minimierte Nutzeraktionsereignisse, Operations-Incidents, deduplizierte Alarmkandidaten, synthetische read-only Prüfläufe, Linkziele, Linkfundstellen, Linkprüfhistorie, Admin-Konten und Sessions |
| Operations-Altbestand | fruehere `/var/lib/gernetix/services/gernetix-services.sqlite` | `service_state` | einmalige, transaktionale read-only Altuebernahme; danach nur Rueckfallkopie |
| Oeffentliche Demos | PostgreSQL `gernetix_runtime`, Tabellen `public_demo_*`; Binaries im Artifact Store | `runtime_postgres_data` / `build_state` | redaktionell freigegebene Metadaten, Offsets, Hashes, Quell- und Objektreferenzen; Flash-Images ausschliesslich im Artifact Store |
| AI Context | PostgreSQL `gernetix_runtime`, Tabellen `ai_context_*` plus pgvector | `runtime_postgres_data` | Kontext, Grants, Policy, Audit und Vektoren |
| Verschluesselte Runtime-Konfiguration und Zustell-Outbox | PostgreSQL `gernetix_runtime`, Tabelle `runtime_state_documents` | `runtime_postgres_data` | LLM-Routing, kleine Konfigurationsdokumente und die minimierte Identity-Nutzeraktions-Outbox; Secret-haltige Inhalte AES-256-GCM-verschluesselt |
| Legacy-SQLite-Dateien | bisherige Volumes `identity_state`, `service_state`, `build_state`, `public_demo_state`, `admin_access_state` | nur am einmaligen Migrationscontainer read-only | Altuebernahme, keine laufende Nutzung durch Fachservices |

Die frueheren Plattform-Release-, Account-Asset- und Build-Artefakt-SQLite-Dateien werden ausschliesslich read-only behandelt. Legacy-Binaries duerfen nicht nach PostgreSQL importiert werden; sie werden mit Quellreferenz und Hash-Pruefung in den Artifact Store uebernommen.

## Lokale Identity-Runtime ohne lokale Identity-Persistenz

Accounts, Credentials und Sessions liegen ausschliesslich in `gernetix_runtime` auf PostgreSQL. Der Compose-Vertrag setzt auf dem VPS `IDENTITY_RUNTIME_LOCATION=server`; der kontrollierte lokale Entwicklungsstart setzt `IDENTITY_RUNTIME_LOCATION=local-development`, `IDENTITY_REMOTE_DEV=1` und bindet Port `4300` nur an Loopback. Beide Laufarten verwenden PostgreSQL. Temporaere SQLite-Dateien bleiben auf isolierte Repository-Tests beschraenkt; Legacy-SQLite wird nur ueber die expliziten read-only Migrationswerkzeuge verarbeitet.

## Dateien ohne fachliche Persistenzrolle

| Bereich | Beispiel | Rolle |
|---|---|---|
| versionierte Website-Assets | `services/identity-server/public/` | GerNetiX-Repository-/Deployment-Inhalt, keine Nutzerablage |
| lokaler Paket-Fallback | `tools/usb-serial-helper/dist/` | Entwicklungsfallback; auf dem VPS ist SQL fuehrend |
| Build-Workspace und Cache | `/var/lib/gernetix/build/tmp`, Cache-/Toolchain-Verzeichnisse | loesch- und wiederherstellbarer technischer Cache |
| fuer Flashwerkzeuge materialisierte Firmware | Provisioning-Runtimepfad | temporaere Ableitung eines Artifact-Store-Objekts |
| generierte Architektursicht | `tools/architecture-docs/dist/` | reproduzierbare Leseansicht |
| Browser-/PWA-State | IndexedDB, Cache Storage, Local Storage | UI-/Offline-Hilfe, niemals Besitz- oder Berechtigungsquelle |

## Speichergrenze der elastischen Worker-Plattform

Die [elastische Worker- und Kapazitaetsarchitektur](elastic-worker-capacity-architecture.md)
fuehrt keine zweite fachliche Persistenz ein. Jobdefinitionen, Leases,
Worker-Registrierungen, Quoten, Usage-Metadaten, Audit und dauerhafte Ergebnisse
liegen im jeweils verantwortlichen Tabellenbereich von `gernetix_runtime`.

Neue Worker verwenden folgende Grenze:

- Ein Worker besitzt keinen fachlichen lokalen Zustand. Workspace, Toolchain-,
  Objekt- und Modellcache sind jederzeit loeschbar.
- Ein Build-Worker erhaelt ein vom Project Server aus einem festen Git-Commit
  materialisiertes BuildPackage. Er erhaelt weder Forgejo-Administrationsrechte
  noch allgemeinen Repositoryzugriff.
- Kurzlebige Cloud-, Kubernetes- und Kunden-Worker greifen nicht direkt auf
  PostgreSQL zu. Sie beziehen Lease und Input ueber das Worker Gateway und geben
  Ergebnisse dort zurueck.
- Der heutige Build-Worker-PostgreSQL-Vertrag bleibt fuer Jobkoordination als
  eingeschraenkter Bestandsadapter ueber WireGuard zulaessig, bis Build-Jobs
  auf das Gateway migriert sind. Artefakt-BLOBs schreibt ein externer Worker
  nicht mehr direkt in PostgreSQL.
- Ein interner `ArtifactStore`-Vertrag kapselt Objekt, Hash,
  Schutzklasse, Retention, Kompression und Streaming. Externe Build-Worker
  streamen die Artefakte mit einem getrennten Bearer-Secret ueber den privaten
  HTTPS-Endpunkt zum zentralen Build-Service. Dort werden sie erst nach
  Groessen- und SHA-256-Pruefung als content-addressed Objekte im persistenten
  Artifact-Store-Volume veroeffentlicht. PostgreSQL erhaelt nur Objektschluessel,
  Hash, Groesse, Quellpfad und Quellversion. Unvollstaendige Uploads
  liegen nur im zeitlich begrenzten technischen Staging und sind nicht lesbar.
- Die Klassen `deployable`, `symbols` und `diagnostic` besitzen im heutigen
  Rueckfallvertrag 90, 30 beziehungsweise 14 Tage Retention. Der Zielvertrag
  leitet die Frist aus der serverseitig aktiven, versionierten Policy ab. ELF,
  HEX, Map und Log werden als Gzip gespeichert. Flashbare Firmware-Dateien
  werden fuer autorisierte Downloads dekodiert; ELF und Map werden nur
  serverintern fuer die exakte Symbolisierung dekodiert, Diagnose-Logs nur fuer
  interne Betriebszwecke. Firmware-Binaries bleiben unveraendert.
- S3-kompatibler Primaerspeicher ist vorbereitet, aber nicht freigegeben. Seine
  Einfuehrung verlangt eine eigene Architekturentscheidung, transaktionale
  Referenzregeln, Migration, Backup-Erweiterung und Restore-Nachweis.

Operations-Metriken speichern nur technische Dimensionen wie Jobtyp,
Ausfuehrungsklasse, Tarif, Provider, Laufzeit, Ressourcenklasse, Bytes und
Status. Projektpayloads, Snapshots, Patches und Kundenskripte werden nicht in
die Kapazitaetsmessung kopiert.

## Abgrenzung Community und Account

Community-Inhalte gehoeren nicht in die Account-Asset-Ablage. Eine oeffentliche Community-Frage ist durch eine ausdrueckliche Freigabe lesbar; eine private Anfrage bleibt auf Autor und konfigurierte Operatoren begrenzt. QR-Codes, persoenliche Bilder und Bildstile bleiben immer `owner_only` und werden weder in Community-Suche, Wissensbasis noch KI-Kontext uebernommen. Eine spaetere Publikation erzeugt ein separates Community- oder Katalogobjekt mit Freigabeprozess; das private Original wird nicht umklassifiziert.

## Download- und Firmwarefluss

1. Ein Publisher schreibt den Inhalt in den Artifact Store und Version, Plattform, Architektur, MIME-Type, Groesse, SHA-256, Sichtbarkeit, Quellpfad, Quellversion und Objektreferenz als unveraenderlichen SQL-Release.
2. Das oeffentliche Flashbox-API fragt ausschliesslich `flashbox-initial-image` mit `visibility=public` ab. Es enthaelt keine Account- oder Besitzdaten.
3. Der Serial-Service-/MaxSerial-Download fragt ausschliesslich `visibility=authenticated` ab und benoetigt eine Sitzung.
4. Build-&-Deploy liest Ausgaben nur aus dem temporaeren Build-Workspace. Ein externer Worker hasht und komprimiert sie lokal, streamt sie authentifiziert zum zentralen Dienst und veroeffentlicht den geprueften Satz content-addressed im Artifact Store; `build_artifacts` enthaelt ausschliesslich Metadaten und Referenzen.
5. Identity liefert nach serverseitiger Zuordnung des Build-Jobs zum angemeldeten Projektbesitzer ausschliesslich flashbare Build-Artefakte (`bootloader.bin`, `partitions.bin`, `boot_app0.bin`, `firmware.bin`, `firmware.hex`). ELF, Map und Build-Log bleiben auch bei bekanntem Dateinamen intern. Die Flashbox erhaelt nur einen signierten, ablaufenden Auftrag fuer den konkreten Helper und das konkrete Ziel.
6. Die serverseitige Crash-Symbolisierung verwendet die interne ELF nur bei exakter Build-ID. Identity gibt Symbolnamen und Quellorte ausschliesslich fuer die beim Build gespeicherten Kundenquellpfade aus und redigiert Basissoftware-Frames.

Damit kann dasselbe Release auf mehreren Rechnern verwendet werden, ohne lokal erneut ein Firmware-Image zu bauen. Das Flashen eines Arduino Nano oder anderen Targets bleibt ein Hardwarevorgang des lokalen Serial Service beziehungsweise der inventarisierten Flashbox; der VPS verwaltet Release, Build-Artefakt, Berechtigung und Auftrag.

## Bekannte Abweichungen und naechste Migrationen

- Alle heutigen fachlichen VPS-Laufzeitdaten sind auf die zentrale
  PostgreSQL-Datenbank `gernetix_runtime` umgestellt. Die beschlossene
  Forgejo-Zielarchitektur fuegt fuer Projektdateien die getrennte
  Forgejo-Datenbank und das Repository-Volume hinzu.
- Projektquellen und SQL-Git-Light-Versionen liegen heute noch in
  `project_sources`, `project_versions.raw_json` und BuildJob-Snapshots. Die
  beschlossene Forgejo-Migration ist in
  [Forgejo-Projektrepositories und lesbare Projektdateien](forgejo-project-repository-work-packages.md)
  in projektweise abnehmbaren Arbeitspaketen beschrieben. Bis zum Cutover
  bleibt SQL fuehrend; danach bleiben diese Bestaende nur read-only fuer
  Migration und kontrollierten Rollback erhalten.
- `gernetix-services.sqlite` bleibt nur als read-only Altquelle der idempotenten Migrationen erhalten. Kein produktiver Compose-Dienst schreibt weiter hinein.
- Provisioning, Recovery, Context Manager und Community AI halten kurzlebigen Workflow-State im Prozessspeicher. Dauerhafte Ergebnisse werden ueber Device Management, Community, AI Context oder `build_artifacts` uebernommen.
- Die lokale JSON-Datei der LLM-Routing-Konfiguration ist nur noch Altimport; produktiv liegt die Konfiguration verschluesselt in PostgreSQL.
- Provisioning besitzt weiterhin explizite Entwicklungsfallbacks fuer lokale Firmwarepfade. Im VPS-Betrieb muss die SQL-Metadatenreferenz auf das Artifact-Store-Objekt fuehrend bleiben.
- Account-Assets verwenden derzeit JSON/Base64 bis 16 MiB. Fuer groessere Bilder ist spaeter ein streamingfaehiger Uploadvertrag sinnvoll; Eigentumspruefung und SQL-Wahrheit bleiben unveraendert.
- Backup-, Restore- und Retention-Zeiten muessen pro Volume beziehungsweise Datenbank operational getestet und protokolliert werden. Forgejo-Datenbank und `forgejo_data` benoetigen dabei einen gemeinsamen konsistenten Sicherungspunkt.

## Inventarisierung und Betrieb

Eine Speicherinventur erfasst mindestens Datenbank/Volume, Schutzklasse,
fachlichen Owner, Tabellen beziehungsweise Repositoryanzahl, Groesse, Anzahl
aktiver/verworfener Objekte, aeltestes/neuestes Objekt, Backup-Zeitpunkt und
letzten Restore-Test. Inhalte, Commitnachrichten, Passkeys, Tokens und private
Metadaten werden dabei nicht in Logs oder Monitoring kopiert. Hash, Groesse,
Status und technische ID reichen fuer Artefaktinventare aus.

Für die Community setzt das Admin Tool diese Grenze über `GET /api/community/operations-summary` um. Der interne, token-geschützte Aufruf liefert nur aggregierte Zahlen und liest weder Titel und Texte noch Account- oder Projektkennungen aus.
