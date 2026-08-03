# GerNetiX VPS Deployment mit Docker Compose

Diese Struktur startet den vorhandenen GerNetiX-Kern auf einem Linux-VPS.
Aktuell stellt genau ein Container `runtime-postgres` PostgreSQL 17 mit
pgvector bereit. Darin bleiben die GerNetiX-Domaenendatenbank
`gernetix_runtime` und die vom eigenen Login gefuehrte Forgejo-Datenbank
`forgejo` strikt getrennt. Der gepinnte Forgejo-LTS-Dienst ist nur im internen
Backend-Netz vorbereitet. Das ist noch kein Cutover: Die heutige
Implementierung speichert Projektquellen und dauerhafte BLOB-Artefakte weiter
in `gernetix_runtime`. Erst nach dem kontrollierten Cutover liegen
menschenbearbeitete Projektdateien und ihre Historie fuehrend in privaten
Forgejo-Repositories; PostgreSQL enthaelt dann nur die fachlichen
Projektmetadaten und Repository-Referenzen.
SQLite-Dateien und fruehere PostgreSQL-Volumes sind nur noch read-only Quellen
der einmaligen Migration und werden von keinem laufenden Fachservice
gemountet. Der Zielbetrieb ist in
[Forgejo-Projektrepositories und lesbare Projektdateien](forgejo-project-repository-work-packages.md)
beschrieben.

Der einmalige Container `runtime-postgres-migration` uebernimmt Admin-Zugang,
Plattform-Downloads, Account-Assets, Build-/OTA-Artefakte, oeffentliche Demo-
Releases, Push-/SMTP-State und die verschluesselte LLM-Konfiguration.

Die fortlaufend gepflegte Uebersicht ueber umgesetzte und empfohlene Schutzmassnahmen steht in [Sicherheitslage und Massnahmenregister](security-posture.md).

## Sicherheitsgrenze der privaten VPS-Instanz

- Die GerNetiX-Plattform, Build-Auslieferung, Admin-Oberflaeche und MQTT-TLS
  binden ausschliesslich an die WireGuard-Adresse `10.77.0.1`.
- Oeffentlich erreichbar bleibt neben WireGuard nur TCP-Port 80 fuer
  Let's-Encrypt-HTTP-01-Challenges. Alle anderen HTTP-Pfade antworten mit 404
  und leiten weder Plattform noch Login weiter.
- SSH ist durch die Host-Firewall ausschliesslich ueber das WireGuard-Interface erreichbar. Es gibt keinen oeffentlichen administrativen Netzwerkzugang.
- Identity und alle Domaenenservices bleiben im internen Docker-Netz.
- Forgejo laeuft rootless ausschliesslich im internen Docker-Netz. Es besitzt
  weder Host-Port noch Nginx-Route; nur interne Services koennen Port 3000
  erreichen. SSH, Registrierung, Push-to-create, Actions, Packages und
  Webhooks sind deaktiviert.
- Runtime-PostgreSQL und die Remote-Dev-Domaenenports sind auf dem VPS nur an `127.0.0.1` gebunden. Ein Entwicklungsrechner erreicht sie ausschliesslich per SSH-Tunnel innerhalb WireGuard.
- Das Admin Tool bindet nur an `127.0.0.1` des VPS und ist per SSH-Tunnel innerhalb des WireGuard-VPN erreichbar.
- Mosquitto behaelt die anonymen internen Listener `1883` und `9001` ausschliesslich im privaten Docker-Netz. Der WireGuard-gebundene Device-Listener `8883` verlangt zusaetzlich mTLS mit einem registrierten Device-Zertifikat und geraetespezifische Topic-ACLs.
- Nginx bedient auf dem oeffentlichen HTTP-Listener ausschliesslich ACME-Challenges. Der TLS-Listener ist nur am WireGuard-Interface gebunden; Nginx wiederholt die `10.77.0.0/24`-Allowlist als zweite Schutzschicht.
- Nginx begrenzt allgemeine Webaufrufe pro Quell-IP auf 10 Anfragen pro Sekunde und Login-/Registrierungsversuche auf 5 pro Minute; begrenzte Aufrufe erhalten HTTP `429`. Firmware-Downloads besitzen wegen gemeinsam genutzter NAT-Ausgaenge eine grosszuegigere Grenze von 30 Anfragen pro Sekunde.
- Der externe MQTT-TLS-Listener ist auf 2048 gleichzeitige Verbindungen und kleine, fuer OTA/Telemetrie ausreichende Pakete begrenzt. Die versionierte Host-Firewall verwirft zusaetzlich neue MQTT-TLS-Verbindungsbursts pro IPv4-/IPv6-Quelle oberhalb von 60 pro Minute mit einem Burst von 30. Interne Listener und Broker-Healthchecks durchlaufen diese DNAT-Regel nicht.

## Erster Start auf dem VPS

```bash
git clone https://github.com/svenjohanson-web/GerNetiX.git
cd GerNetiX
cp .env.vps.example .env.vps
```

Fuer die private Instanz in `.env.vps` setzen:

```dotenv
PRIVATE_VPS_BIND_ADDRESS=10.77.0.1
PRIVATE_PLATFORM_TUNNEL_PORT=8080
ACME_HTTP_BIND_ADDRESS=0.0.0.0
ACME_HTTP_PORT=80
HTTPS_PORT=443
LETSENCRYPT_DIR=/etc/letsencrypt
MQTT_TLS_PORT=8883
MQTT_LETSENCRYPT_DIR=/etc/letsencrypt
DEVICE_CA_CERTIFICATE_PATH=/etc/gernetix/pki/device-ca.pem
DEVICE_CA_PRIVATE_KEY_PATH=/etc/gernetix/pki/device-ca-key.pem
OTA_SIGNING_PRIVATE_KEY_PATH=/etc/gernetix/pki/ota-signing-key.pem
OTA_SIGNING_PUBLIC_KEY_PATH=/etc/gernetix/pki/ota-signing-public.pem
OTA_SIGNING_KEY_ID=ota-p256-2026-01
IDENTITY_APP_BASE_URL=https://pwa.gernetix.com
RUNTIME_POSTGRES_PASSWORD=<langer-zufaelliger-eigener-wert>
FORGEJO_POSTGRES_PASSWORD=<getrennter-langer-zufaelliger-wert>
FORGEJO_SECRET_KEY=<getrennter-dauerhaft-gesicherter-zufaelliger-wert>
FORGEJO_INTERNAL_TOKEN=<getrennter-langer-zufaelliger-wert>
IDENTITY_POSTGRES_PASSWORD=<langer-zufaelliger-eigener-wert>
PROJECT_POSTGRES_PASSWORD=<anderer-langer-zufaelliger-eigener-wert>
TELEMETRY_POSTGRES_PASSWORD=<weiterer-langer-zufaelliger-eigener-wert>
COMMUNITY_POSTGRES_PASSWORD=<weiterer-getrennter-langer-zufaelliger-wert>
DEVICE_MANAGEMENT_POSTGRES_PASSWORD=<weiterer-getrennter-langer-zufaelliger-wert>
AI_USAGE_POSTGRES_PASSWORD=<weiterer-getrennter-langer-zufaelliger-wert>
HARDWARE_CATALOG_POSTGRES_PASSWORD=<weiterer-getrennter-langer-zufaelliger-wert>
HARDWARE_SHOP_POSTGRES_PASSWORD=<weiterer-getrennter-langer-zufaelliger-wert>
OPERATIONS_POSTGRES_PASSWORD=<weiterer-getrennter-langer-zufaelliger-wert>
```

Vor dem Start muessen `build.gernetix.com`, `mqtt.gernetix.com` und
`pwa.gernetix.com` fuer ACME auf den VPS zeigen. WireGuard-Clients muessen diese
Namen beim eigentlichen Zugriff auf `10.77.0.1` aufloesen. Das Deployment
fordert dafuer das gemeinsame Zertifikat
`/etc/letsencrypt/live/gernetix-services.com/` an. Mosquitto bindet das gesamte
Let's-Encrypt-Verzeichnis read-only ein, damit Zertifikatserneuerungen sichtbar
bleiben. Nach einer Erneuerung wird nur der Broker neu geladen:

Fuer persistente Identity-Systemereignisse muss in `.env.vps` ein eigener langer Zufallswert als `SYSTEM_EVENT_INGEST_TOKEN` gesetzt sein. Compose uebergibt denselben Wert ausschliesslich an Identity Server und Admin Tool. Das Linkinventar und die Prüfergebnisse verwenden davon getrennt `LINK_INTEGRITY_INGEST_TOKEN`; auch dieser Wert wird ausschließlich an Identity Server und Admin Tool übergeben.

```bash
docker compose --env-file .env.vps -f compose.vps.yaml kill -s HUP mqtt-broker
```

Vor dem ersten nichtproduktiven Start werden eine P-256 Device-Issuing-CA und ein separates P-256 OTA-Signaturschluesselpaar ausserhalb des Repositories erzeugt:

```bash
sudo install -d -m 0700 /etc/gernetix/pki
sudo node tools/generate-device-pki.js --out /etc/gernetix/pki
```

Das Projektwerkzeug benoetigt Node.js und OpenSSL auf dem Host. Ist auf einem minimalen VPS bewusst kein Host-Node.js installiert, koennen dieselben vier P-256-Dateien mit dem vorhandenen OpenSSL erzeugt werden:

```bash
sudo install -d -m 0700 /etc/gernetix/pki
sudo openssl ecparam -name prime256v1 -genkey -noout -out /etc/gernetix/pki/device-ca-key.pem
sudo openssl req -x509 -new -sha256 -key /etc/gernetix/pki/device-ca-key.pem -out /etc/gernetix/pki/device-ca.pem -days 3650 -subj /CN=GerNetiX-Device-Issuing-CA -addext basicConstraints=critical,CA:TRUE,pathlen:0 -addext keyUsage=critical,keyCertSign,cRLSign
sudo openssl ecparam -name prime256v1 -genkey -noout -out /etc/gernetix/pki/ota-signing-key.pem
sudo openssl pkey -in /etc/gernetix/pki/ota-signing-key.pem -pubout -out /etc/gernetix/pki/ota-signing-public.pem
sudo chmod 0600 /etc/gernetix/pki/device-ca-key.pem /etc/gernetix/pki/ota-signing-key.pem
```

Das Device erzeugt seinen privaten P-256-Schluessel selbst und gibt ihn nie an Plattform oder Broker weiter. Das Provisioning Tool signiert nur den oeffentlichen Schluessel als Client-Zertifikat. Mosquitto verwendet dessen CN als MQTT-Benutzername; die ACL erlaubt dadurch nur `gernetix/devices/<device_id>/ota` zu lesen und unter `gernetix/devices/<device_id>/status/#` zu schreiben. Der OTA-Private-Key ist ausschliesslich im Build-&-Deploy-Service eingebunden, der OTA-Public-Key wird beim Provisioning auf das Device geschrieben. Fuer Produktion soll die Device-CA als getrennte Issuing-CA betrieben und ihre Rotation/Widerrufsliste organisatorisch festgelegt werden.

Danach:

```bash
docker compose --env-file .env.vps -f compose.vps.yaml config
docker compose --env-file .env.vps -f compose.vps.yaml build
docker compose --env-file .env.vps -f compose.vps.yaml up -d
docker compose --env-file .env.vps -f compose.vps.yaml ps
```

Die Datei `.env.vps` muss ausserhalb des Repositories bleiben und nur fuer den
Betreiber lesbar sein (`chmod 0600 .env.vps`). Die drei Forgejo-Werte duerfen
weder untereinander noch mit `RUNTIME_POSTGRES_PASSWORD` oder Service-Tokens
geteilt werden. `FORGEJO_SECRET_KEY` ist dauerhaft zusammen mit dem Backup zu
sichern; sein Verlust macht damit verschluesselte Forgejo-Daten unlesbar.

Vor jedem Forgejo-Start legt `forgejo-postgres-provisioning` Datenbank und
Login idempotent an, rotiert das getrennte Datenbankpasswort und entzieht dem
Login Datenbank-, Schema-, Tabellen-, Sequenz- und Funktionsrechte auf
`gernetix_runtime`. Der Forgejo-Container startet erst nach erfolgreichem
Abschluss dieser Schranke.

Der normale Staging-Deploy validiert zuerst die versionierte
nftables-Host-Firewall. Erst nach erfolgreicher Compose-Pruefung und
erfolgreichem Image-Build wird sie installiert und neu geladen. Danach fordert
der Ablauf per HTTP-01 die benoetigten Zertifikate an. Der Certbot-Container
prueft die Erneuerung zweimal taeglich; der TLS-Nginx laedt erneuerte
Zertifikate regelmaessig neu. Port 80 muss fuer ACME erreichbar sein. Port 443
und MQTT-TLS 8883 sind ausschliesslich ueber `wg0` erreichbar.

Healthcheck auf dem VPS:

```bash
curl http://127.0.0.1:8080/health
curl --resolve pwa.gernetix.com:443:10.77.0.1 https://pwa.gernetix.com/health
docker compose --env-file .env.vps -f compose.vps.yaml ps forgejo
```

## Admin Tool sicher erreichen

Vorher muss der eingerichtete WireGuard-Tunnel `gernetix-vps` aktiv sein. Der SSH-Alias `gernetix-vps` zeigt auf die private VPN-Adresse; eine oeffentliche SSH-Ausweichroute ist nicht vorgesehen.

Bevorzugt auf dem Entwicklungsrechner:

```text
node tools/connect-staging.js
```

Alternativ als direkter SSH-Tunnel:

```bash
ssh -L 4600:127.0.0.1:4600 root@gernetix-vps
```

Danach lokal oeffnen:

```text
http://127.0.0.1:4600/admin/
```

## Persistenz

Compose legt benannte Volumes an:

- `runtime_postgres_data`: fuehrende GerNetiX-Domaenendatenbank
  `gernetix_runtime` fuer alle praefixierten Domaenentabellen,
  Runtime-Konfigurationen und in der heutigen Implementierung auch dauerhafte
  BLOB-Artefakte; derselbe PostgreSQL-Prozess enthaelt zusaetzlich die strikt
  getrennte Forgejo-Datenbank `forgejo`
- `forgejo_data`: Repository- und Forgejo-Anwendungsdaten; das Volume wird nur
  in den rootless Forgejo-Dienst beziehungsweise in den kontrollierten
  Backup-Lauf eingebunden
- `identity_state`, `project_state`, `telemetry_state`, `community_state`, `service_state`, `admin_access_state` und `public_demo_state`: read-only Altbestaende fuer die einmaligen SQLite-Migrationen; keine laufenden Fachschreiber
- `build_state`: temporaere Build-Arbeitsbereiche, materialisierte Ausgaben und Caches; dauerhafte Build-Artefakte liegen in PostgreSQL
- `mqtt_data` und `mqtt_log`: Mosquitto

`docker compose down` behaelt diese Volumes. `docker compose down -v` loescht sie und darf fuer einen produktiven Stand nicht verwendet werden.

### Einmalige Konsolidierung nach PostgreSQL

Beim ersten Rollout bleiben bestehende PostgreSQL-Domaenencontainer zunaechst als Compose-Orphans erreichbar. Nach dem Start und der Schemaanlage in `gernetix_runtime` kopiert `postgres-consolidation-migration` ihre Tabellen idempotent und mit Domaenenmarkern in die zentrale Datenbank. Nur nach erfolgreichem Abschluss entfernt der Deployment-Ablauf die alten Container mit `--remove-orphans`; deren Volumes werden nicht geloescht.

Die nachfolgenden SQLite-Migrationen lesen die Altvolumes weiterhin ausschliesslich read-only:

### Einmalige Identity-Migration aus SQLite

Vor dem Start des Identity Servers wartet Compose auf `identity-postgres-migration`. Der einmalige Container liest `gernetix-identity.sqlite` read-only, importiert Accounts, Credentials, externe Identitaeten, Tokens, Recovery-Transaktionen und Sessions in einer Transaktion und setzt den Marker `identity-sqlite-v1`. Bei einem bereits belegten PostgreSQL-Ziel ohne Marker bricht er ab, statt Daten zusammenzufuehren. Bei weiteren Starts endet er mit `already_applied`.

Die Alt-SQLite bleibt als Rueckfallkopie erhalten, ist danach aber nicht mehr fuehrend. Ein ausgefuehrter Rollout setzt deshalb vorab ein konsistentes Backup von `identity_state`, den bisherigen PostgreSQL-Volumes und `runtime_postgres_data` sowie einen dokumentierten Restore-Test voraus.

### Einmalige Project-Migration nach PostgreSQL

Vor dem Start des Project Servers wartet Compose auf `project-postgres-migration`. Der einmalige Container liest zuerst `project_state/gernetix-projects.sqlite` read-only. Ist diese getrennte Datei noch leer, liest er als Upgrade-Fallback die bisherigen `project-server`-Tabellen aus `service_state/gernetix-services.sqlite`. Projekte, Quellen, Build-Jobs, Artefaktmetadaten, Lernfeedback, Einwilligungen und Ressourcenprofile werden in einer Transaktion importiert; danach wird der Marker `project-sqlite-v1` gesetzt.

Diese Konsolidierung beschreibt den vorhandenen SQL-Altpfad und bleibt fuer
den Bestand erforderlich. Sie ist nicht der spaetere SQL-zu-Git-Cutover: Der
erfolgt projektweise ueber FG-09 und FG-10 und entfernt erst nach
Restore-Nachweis die fuehrenden Quellinhalte aus SQL.

Ein bereits belegtes PostgreSQL-Ziel ohne Marker fuehrt zum Abbruch statt zu einer unkontrollierten Zusammenfuehrung. Bei weiteren Starts endet die Migration mit `already_applied`. Beide SQLite-Volumes bleiben erhalten, sind fuer den Migrationscontainer aber nur read-only und nach erfolgreicher Uebernahme nicht mehr fuehrend. Vor dem Rollout sind `project_state`, `service_state`, das bisherige `project_postgres_data` und das neue `runtime_postgres_data` konsistent zu sichern; der Restore der neuen Datenbank ist gesondert nachzuweisen.

### Einmalige Telemetry-Migration nach PostgreSQL

Vor dem Start des Telemetry Servers wartet Compose auf `telemetry-postgres-migration`. Der Container liest bevorzugt die getrennte `gernetix-telemetry.sqlite` und faellt bei leerem Bestand auf die drei bisherigen Telemetrietabellen in `gernetix-services.sqlite` zurueck. Messwerte, Ereignisse und Retention werden in einer Transaktion importiert; der Marker `telemetry-sqlite-v1` verhindert Wiederholungen. Ein belegtes PostgreSQL-Ziel ohne Marker fuehrt zum Abbruch. Beide SQLite-Quellen bleiben read-only erhalten und sind danach nicht mehr fuehrend.

### Einmalige Community-Migration nach PostgreSQL

Vor dem Start der Community Platform wartet Compose auf `community-postgres-migration`. Der einmalige Container importiert Fragen, Antworten und freigegebene Wissensdokumente transaktional aus `gernetix-community.sqlite` und setzt `community-sqlite-v1`. Ein unerwartet belegtes Ziel ohne Marker fuehrt zum Abbruch. Die SQLite bleibt read-only als Rueckfallkopie erhalten und ist danach nicht mehr fuehrend.

### Einmalige Device-Management-Migration nach PostgreSQL

Vor dem Start des Device Management Servers wartet Compose auf `device-management-postgres-migration`. Der einmalige Container liest die bisherigen typisierten Device-Management-Tabellen aus `gernetix-services.sqlite` read-only, entfernt vorsorglich alte Shared-Secret-Felder und importiert den Bestand transaktional. Der Marker `device-management-sqlite-v1` verhindert Wiederholungen; ein belegtes Ziel ohne Marker fuehrt zum Abbruch. Danach ist ausschliesslich PostgreSQL fuehrend.

### Einmalige AI-Usage-Migration nach PostgreSQL

Vor dem Start des AI Usage Servers wartet Compose auf `ai-usage-postgres-migration`. Der einmalige Container liest Credit-Konten, Ledger, Usage Events, Cost-Control-Policy und Admin-Audit aus `gernetix-services.sqlite` read-only und importiert sie transaktional. Der Marker `ai-usage-sqlite-v1` verhindert Wiederholungen; ein belegtes Ziel ohne Marker fuehrt zum Abbruch. Danach ist ausschliesslich PostgreSQL fuehrend.

### Einmalige Hardware-Catalog-Migration nach PostgreSQL

Vor dem Start des Hardware Catalog wartet Compose auf `hardware-catalog-postgres-migration`. Der einmalige Container liest Capabilities und Hardware-Items aus `gernetix-services.sqlite` read-only, ergänzt fehlende Einträge aus dem aktuellen Standardkatalog und importiert den Bestand transaktional. Vorhandene redaktionelle Katalogobjekte gewinnen dabei gegen gleichnamige Standardwerte. Der Marker `hardware-catalog-sqlite-v1` verhindert Wiederholungen; ein belegtes Ziel ohne Marker führt zum Abbruch. Danach ist ausschliesslich PostgreSQL führend.

### Einmalige Hardware-Shop-Migration nach PostgreSQL

Vor dem Start des Hardware Shop wartet Compose auf `hardware-shop-postgres-migration`. Der einmalige Container liest Angebote, Warenkoerbe und Bestellungen samt eingebettetem Purchase Context aus `gernetix-services.sqlite` read-only, ergaenzt fehlende aktuelle Standardangebote und importiert den Bestand transaktional. Vorhandene redaktionelle Angebote gewinnen gegen gleichnamige Standardwerte. Der Marker `hardware-shop-sqlite-v1` verhindert Wiederholungen; ein belegtes Ziel ohne Marker fuehrt zum Abbruch. Danach ist ausschliesslich PostgreSQL fuehrend.

### Einmalige Operations-Migration nach PostgreSQL

Vor dem Start des Admin Tool wartet Compose auf `operations-postgres-migration`. Der einmalige Container importiert Admin-Consents, Audit-, Aktions- und Systemereignisse sowie die bisherige Schnittstellenstatistik transaktional aus `gernetix-services.sqlite`. Der Marker `operations-sqlite-v1` verhindert Wiederholungen; ein belegtes Ziel ohne Marker fuehrt zum Abbruch. Identity und Build & Deploy senden neue Schnittstellenmessungen danach token-geschuetzt an das interne Admin-/Operations-API. Die Legacy-SQLite bleibt read-only erhalten.

## Forgejo-Backup, Restore und Upgrade

Der erste konsistente Sicherungsvertrag stoppt nur Forgejo kontrolliert. Die
gemeinsame PostgreSQL-Instanz und die GerNetiX-Domaenendienste laufen weiter.
Danach werden die Datenbank `forgejo` und `forgejo_data` in dasselbe neue,
zugriffsgeschuetzte Ziel geschrieben und gemeinsam mit Version und
SHA-256-Pruefsummen abgeschlossen:

```bash
tools/backup-forgejo.sh /gesicherter/pfad/forgejo-2026-08-03T120000Z
```

Das Werkzeug ueberschreibt kein vorhandenes Ziel, startet einen zuvor
laufenden Forgejo-Dienst auch bei einem Fehler wieder und verwendet weder
`down -v` noch eine Volume-Loeschung. Das Ziel muss danach verschluesselt und
getrennt vom VPS aufbewahrt werden. Zusaetzlich gehoeren die nicht im Dump
enthaltenen Runtime-Secrets, insbesondere `FORGEJO_SECRET_KEY`, in die
getrennte Secret-Sicherung.

Ein Restore erfolgt nie ueber den laufenden Stand. Er wird in einer isolierten
Compose-Umgebung mit leerer Datenbank und leerem `forgejo_data` durchgefuehrt:

1. `SHA256SUMS`, Forgejo-Version und gesicherte Secrets pruefen.
2. Exakt das gesicherte Patchimage starten, Forgejo dabei gestoppt lassen.
3. `forgejo-database.dump` mit `pg_restore` in die leere Datenbank `forgejo`
   und `forgejo-data.tar.gz` in das leere Volume einspielen.
4. Forgejo starten, Healthcheck abwarten und ein privates Testrepository samt
   Commit-Historie lesen und klonen.
5. RPO, RTO, Imageversion, Pruefsummen und Ergebnis dokumentieren; erst danach
   darf ein Wiederanlauf des Zielstands freigegeben werden.

Vor einem Upgrade wird dieser Sicherungslauf ausgefuehrt. Das Image bleibt auf
eine vollstaendige LTS-Patchversion gepinnt. Major-Upgrades erfolgen einzeln
nach den Forgejo-Upgradehinweisen; danach werden Healthcheck, Repositorylesen,
Clone/Push und `forgejo doctor check --all` in der isolierten Abnahme geprueft.

## Update

Bevorzugt von jedem eingerichteten Entwicklungsrechner:

```text
node tools/staging-deploy.js
```

Der plattformunabhaengige und fuer Codex vorgesehene Ablauf ist in [codex-staging-deployment.md](codex-staging-deployment.md) beschrieben.

Manueller Fallback direkt auf dem VPS:

```bash
git pull
docker compose --env-file .env.vps -f compose.vps.yaml build
docker compose --env-file .env.vps -f compose.vps.yaml up -d
docker compose --env-file .env.vps -f compose.vps.yaml ps
```

Dieser Fallback ist fuer den ersten Wechsel von getrennten PostgreSQL-
Containern auf `gernetix_runtime` nicht zulaessig. Dieser Wechsel muss ueber
`node tools/staging-deploy.js` erfolgen, weil nur der kontrollierte Ablauf die
Legacy-Secrets prueft, Domaenendaten konsolidiert und alte Container erst nach
erfolgreicher Uebernahme entfernt.

## Spaetere Produktionsinstanz

Eine oeffentliche Produktion wird nicht durch das Oeffnen dieser privaten
Instanz hergestellt. Sie erhaelt einen neuen VPS, eigene Domains, Secrets,
Zertifikate, Datenbanken und eine eigene Production-Edge-Konfiguration. Die
privaten Docker-Volumes werden nicht als Ganzes nach Produktion kopiert.

Vor der dauerhaften Nutzung der privaten Instanz muessen `runtime_postgres_data`
und die nur noch zur Rueckfallwiederherstellung aufbewahrten Legacy-Volumes nach dem verbindlichen
[Sicherungs- und Wiederherstellungskonzept](customer-data-backup-and-recovery.md)
konsistent, verschluesselt und ausserhalb des VPS gesichert sowie
Wiederherstellungen geprueft werden.

Deployment-Topologie: [vps-docker-topology.svg](vps-docker-topology.svg)
