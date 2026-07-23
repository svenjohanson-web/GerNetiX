# GerNetiX VPS Deployment mit Docker Compose

Diese Struktur startet den vorhandenen GerNetiX-Kern auf einem Linux-VPS. Der AI Context Server verwendet eine interne PostgreSQL-17-Datenbank mit pgvector; die uebrigen bestehenden Node.js-Services behalten ihre jeweiligen SQLite-Persistenzen.

Die fortlaufend gepflegte Uebersicht ueber umgesetzte und empfohlene Schutzmassnahmen steht in [Sicherheitslage und Massnahmenregister](security-posture.md).

## Sicherheitsgrenze der privaten VPS-Instanz

- Die GerNetiX-Plattform, Build-Auslieferung, Admin-Oberflaeche und MQTT-TLS
  binden ausschliesslich an die WireGuard-Adresse `10.77.0.1`.
- Oeffentlich erreichbar bleibt neben WireGuard nur TCP-Port 80 fuer
  Let's-Encrypt-HTTP-01-Challenges. Alle anderen HTTP-Pfade antworten mit 404
  und leiten weder Plattform noch Login weiter.
- SSH ist durch die Host-Firewall ausschliesslich ueber das WireGuard-Interface erreichbar. Es gibt keinen oeffentlichen administrativen Netzwerkzugang.
- Identity und alle Domaenenservices bleiben im internen Docker-Netz.
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
```

Vor dem Start muessen `build.gernetix.com`, `mqtt.gernetix.com` und
`pwa.gernetix.com` fuer ACME auf den VPS zeigen. WireGuard-Clients muessen diese
Namen beim eigentlichen Zugriff auf `10.77.0.1` aufloesen. Das Deployment
fordert dafuer das gemeinsame Zertifikat
`/etc/letsencrypt/live/gernetix-services.com/` an. Mosquitto bindet das gesamte
Let's-Encrypt-Verzeichnis read-only ein, damit Zertifikatserneuerungen sichtbar
bleiben. Nach einer Erneuerung wird nur der Broker neu geladen:

Fuer persistente Identity-Systemereignisse muss in `.env.vps` ein eigener langer Zufallswert als `SYSTEM_EVENT_INGEST_TOKEN` gesetzt sein. Compose uebergibt denselben Wert ausschliesslich an Identity Server und Admin Tool.

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

- `identity_state`: getrennte SQLite-Dateien fuer Identity-Accounts/Credentials/Sessions, unveraenderliche Plattform-Download-Releases und owner-only Account-Assets
- `project_state`: Projekte, Projektquellen, Build-Metadaten und Ressourcenprofile des Project Server
- `build_state`: temporaere Build-Arbeitsbereiche/Caches sowie die fuehrende Build-Artefakt-SQLite
- `telemetry_state`: konto- und projektpartitionierte Messwerte, Ereignisse und Retention des Telemetry Server
- `community_state`: oeffentliche Community-Inhalte und autorisierte private Projektbegleitung in eigener SQLite
- `service_state`: gemeinsamer SQLite-State der verbleibenden technischen Dienste; keine Projekt- oder Telemetrie-Daten nach der Migration
- `ai_context_postgres_data`: fuehrende AI-Context-PostgreSQL-/pgvector-Datenbank
- `ai_context_state`: bisherige AI-Context-SQLite, nur fuer die einmalige automatische Uebernahme und als Rueckfallkopie
- `build_state`: Build-Caches und Artefakte
- `public_demo_state`: ausschliesslich veröffentlichte Demo-Metadaten und immutable USB-Firmware-Releases; keine Konto-, Projekt- oder Telemetriedaten
- `mqtt_data` und `mqtt_log`: Mosquitto

`docker compose down` behaelt diese Volumes. `docker compose down -v` loescht sie und darf fuer einen produktiven Stand nicht verwendet werden.

### Einmalige Trennung bestehender Service-Daten

Bei einem Upgrade von der bisherigen gemeinsamen `service_state`-SQLite muessen Project Server und Telemetry Server vor ihrem ersten produktiven Start angehalten sein. Der einmalige, idempotente Migrations-Container kopiert nur die Tabellen mit dem Praefix `project_server_` beziehungsweise die drei `telemetry_*`-Tabellen in die neuen Volumes. Er kopiert keine Identity- oder sonstigen Service-Tabellen und beendet sich bei einem bereits belegten Zielvolume ohne Migrationsmarker.

```bash
docker compose --env-file .env.vps -f compose.vps.yaml stop project-server telemetry-server
docker compose --env-file .env.vps -f compose.vps.yaml --profile storage-migration run --rm runtime-storage-migration
docker compose --env-file .env.vps -f compose.vps.yaml up -d project-server telemetry-server
```

Die Ausgabe nennt jede kopierte Tabelle und Zeilenanzahl. Erst danach darf das bisherige `service_state`-Volume aus dem Backup-/Restore-Plan als gemeinsamer Runtime-State ohne Projekt- und Telemetrie-Inhalte behandelt werden.

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

## Spaetere Produktionsinstanz

Eine oeffentliche Produktion wird nicht durch das Oeffnen dieser privaten
Instanz hergestellt. Sie erhaelt einen neuen VPS, eigene Domains, Secrets,
Zertifikate, Datenbanken und eine eigene Production-Edge-Konfiguration. Die
privaten Docker-Volumes werden nicht als Ganzes nach Produktion kopiert.

Vor der dauerhaften Nutzung der privaten Instanz muessen die SQLite-Volumes und
`ai_context_postgres_data` nach dem verbindlichen
[Sicherungs- und Wiederherstellungskonzept](customer-data-backup-and-recovery.md)
konsistent, verschluesselt und ausserhalb des VPS gesichert sowie
Wiederherstellungen geprueft werden.

Deployment-Topologie: [vps-docker-topology.svg](vps-docker-topology.svg)
