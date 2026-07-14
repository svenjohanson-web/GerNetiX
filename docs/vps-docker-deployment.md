# GerNetiX VPS Deployment mit Docker Compose

Diese Struktur startet den vorhandenen GerNetiX-Kern auf einem Linux-VPS. Der AI Context Server verwendet eine interne PostgreSQL-17-Datenbank mit pgvector; die uebrigen bestehenden Node.js-Services behalten ihre jeweiligen SQLite-Persistenzen.

Die fortlaufend gepflegte Uebersicht ueber umgesetzte und empfohlene Schutzmassnahmen steht in [Sicherheitslage und Massnahmenregister](security-posture.md).

## Sicherheitsgrenze dieses ersten Stands

- Oeffentlich sind nur HTTP/HTTPS, MQTT-TLS fuer Devices und der WireGuard-Endpunkt vorgesehen.
- SSH ist durch die Host-Firewall ausschliesslich ueber das WireGuard-Interface erreichbar. Es gibt keinen oeffentlichen administrativen Netzwerkzugang.
- Identity und alle Domaenenservices bleiben im internen Docker-Netz.
- Das Admin Tool bindet nur an `127.0.0.1` des VPS und ist per SSH-Tunnel innerhalb des WireGuard-VPN erreichbar.
- Mosquitto behaelt die internen Listener `1883` und `9001`. Der externe Device-Listener `8883` verlangt TLS, registrierte Credentials und gerätespezifische Topic-ACLs.
- Nginx bedient HTTP fuer ACME-Challenges und leitet die oeffentlichen Domains auf HTTPS um. Ein separater TLS-Listener liefert die niederlaendische `.nl`-, deutsche `.de`- und englische `.com`-Startseite aus.
- Nginx begrenzt allgemeine Webaufrufe pro Quell-IP auf 10 Anfragen pro Sekunde und Login-/Registrierungsversuche auf 5 pro Minute; begrenzte Aufrufe erhalten HTTP `429`. Firmware-Downloads besitzen wegen gemeinsam genutzter NAT-Ausgaenge eine grosszuegigere Grenze von 30 Anfragen pro Sekunde.
- Der externe MQTT-TLS-Listener ist auf 2048 gleichzeitige Verbindungen und kleine, fuer OTA/Telemetrie ausreichende Pakete begrenzt. Die versionierte Host-Firewall verwirft zusaetzlich neue MQTT-TLS-Verbindungsbursts pro IPv4-/IPv6-Quelle oberhalb von 60 pro Minute mit einem Burst von 30. Interne Listener und Broker-Healthchecks durchlaufen diese DNAT-Regel nicht.

## Erster Start auf dem VPS

```bash
git clone https://github.com/svenjohanson-web/GerNetiX.git
cd GerNetiX
cp .env.vps.example .env.vps
```

Fuer den ersten internen Test in `.env.vps` setzen:

```dotenv
HTTP_BIND_ADDRESS=127.0.0.1
HTTP_PORT=8080
HTTPS_BIND_ADDRESS=0.0.0.0
HTTPS_PORT=443
LETSENCRYPT_DIR=/etc/letsencrypt
MQTT_TLS_BIND_ADDRESS=0.0.0.0
MQTT_TLS_PORT=8883
MQTT_LETSENCRYPT_DIR=/etc/letsencrypt
```

Vor dem Start muessen `build.gernetix.com` und `mqtt.gernetix.com` per DNS auf den VPS zeigen. Das Deployment fordert dafuer das gemeinsame Zertifikat `/etc/letsencrypt/live/gernetix-services.com/` an. Mosquitto bindet das gesamte Let's-Encrypt-Verzeichnis read-only ein, damit Zertifikatserneuerungen sichtbar bleiben. Nach einer Erneuerung wird nur der Broker neu geladen:

```bash
docker compose --env-file .env.vps -f compose.vps.yaml kill -s HUP mqtt-broker
```

Ein Device-Zugang wird aus dem einmaligen Device-Secret abgeleitet und direkt in das persistente Mosquitto-Passwortfile geschrieben. Das Secret wird ueber stdin uebergeben und nicht als Argument in der Shell-Historie gespeichert:

```bash
printf '%s' "$ONE_TIME_DEVICE_SECRET" | node tools/mqtt-device-credential.js install --device-id device_123 --secret-stdin --compose-file compose.vps.yaml --env-file .env.vps
```

Die ACL erlaubt diesem Benutzer nur `gernetix/devices/device_123/ota` zu lesen und unter `gernetix/devices/device_123/status/#` zu schreiben.

Danach:

```bash
docker compose --env-file .env.vps -f compose.vps.yaml config
docker compose --env-file .env.vps -f compose.vps.yaml build
docker compose --env-file .env.vps -f compose.vps.yaml up -d
docker compose --env-file .env.vps -f compose.vps.yaml ps
```

Der normale Staging-Deploy validiert zuerst die versionierte nftables-Host-Firewall. Erst nach erfolgreicher Compose-Pruefung und erfolgreichem Image-Build wird sie installiert und neu geladen. Danach fordert der Ablauf per HTTP-01 automatisch ein gemeinsames Let's-Encrypt-Zertifikat fuer `gernetix.nl`, `www.gernetix.nl`, `gernetix.de`, `www.gernetix.de`, `gernetix.com` und `www.gernetix.com` an. Der Certbot-Container prueft die Erneuerung zweimal taeglich; der TLS-Nginx laedt erneuerte Zertifikate regelmaessig neu. Port 80 und 443 muessen am VPS erreichbar sein und alle sechs DNS-Namen auf den VPS zeigen.

Healthcheck auf dem VPS:

```bash
curl http://127.0.0.1:8080/health
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

- `identity_state`: Identity-Accounts und Credentials
- `service_state`: aktueller gemeinsamer SQLite-Service-State
- `ai_context_postgres_data`: fuehrende AI-Context-PostgreSQL-/pgvector-Datenbank
- `ai_context_state`: bisherige AI-Context-SQLite, nur fuer die einmalige automatische Uebernahme und als Rueckfallkopie
- `build_state`: Build-Caches und Artefakte
- `mqtt_data` und `mqtt_log`: Mosquitto

`docker compose down` behaelt diese Volumes. `docker compose down -v` loescht sie und darf fuer einen produktiven Stand nicht verwendet werden.

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

## Vor dem oeffentlichen Betrieb

1. Domain-DNS auf den VPS richten.
2. HTTPS-Zertifikat und automatische Erneuerung konfigurieren.
3. `HTTP_BIND_ADDRESS=0.0.0.0` erst mit aktivem HTTPS verwenden.
4. Firewall oeffentlich auf HTTP, HTTPS, MQTT-TLS und WireGuard begrenzen; SSH nur am WireGuard-Interface zulassen.
5. Admin Tool nicht oeffentlich weiterleiten.
6. SQLite-Volumes und `ai_context_postgres_data` nach dem verbindlichen [Sicherungs- und Wiederherstellungskonzept](customer-data-backup-and-recovery.md) konsistent, verschluesselt und ausserhalb des VPS sichern; Wiederherstellungen regelmaessig pruefen.
7. Firewall-Port `8883/tcp` erst freigeben, wenn `mqtt.gernetix.com`, Let's Encrypt und mindestens ein Device-Credential eingerichtet sind.

Deployment-Topologie: [vps-docker-topology.svg](vps-docker-topology.svg)
