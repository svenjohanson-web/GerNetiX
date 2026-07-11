# GerNetiX VPS Deployment mit Docker Compose

Diese Struktur startet den vorhandenen GerNetiX-Kern auf einem Linux-VPS. Sie fuehrt keine PostgreSQL- oder FastAPI-Komponenten ein, weil der aktuelle GerNetiX-Stand Node.js und SQLite verwendet.

## Sicherheitsgrenze dieses ersten Stands

- Oeffentlich wird nur Nginx vorgesehen.
- Identity und alle Domaenenservices bleiben im internen Docker-Netz.
- Das Admin Tool bindet nur an `127.0.0.1` des VPS und ist per SSH-Tunnel erreichbar.
- Mosquitto bleibt intern. Externer Device-Zugriff darf erst nach TLS-, Credential- und ACL-Konfiguration freigeschaltet werden.
- Die mitgelieferte Nginx-Konfiguration ist ein HTTP-Bootstrap. Vor einer oeffentlichen Anmeldung muessen Domain und HTTPS eingerichtet werden.

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
```

Danach:

```bash
docker compose --env-file .env.vps -f compose.vps.yaml config
docker compose --env-file .env.vps -f compose.vps.yaml build
docker compose --env-file .env.vps -f compose.vps.yaml up -d
docker compose --env-file .env.vps -f compose.vps.yaml ps
```

Healthcheck auf dem VPS:

```bash
curl http://127.0.0.1:8080/health
```

## Admin Tool sicher erreichen

Auf dem Entwicklungsrechner:

```bash
ssh -L 4600:127.0.0.1:4600 root@VPS_HOST
```

Danach lokal oeffnen:

```text
http://127.0.0.1:4600/admin/
```

## Persistenz

Compose legt benannte Volumes an:

- `identity_state`: Identity-Accounts und Credentials
- `service_state`: aktueller gemeinsamer SQLite-Service-State
- `ai_context_state`: AI-Context-SQLite
- `build_state`: Build-Caches und Artefakte
- `mqtt_data` und `mqtt_log`: Mosquitto

`docker compose down` behaelt diese Volumes. `docker compose down -v` loescht sie und darf fuer einen produktiven Stand nicht verwendet werden.

## Update

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
4. Firewall auf SSH, HTTP und HTTPS begrenzen.
5. Admin Tool nicht oeffentlich weiterleiten.
6. SQLite-Volumes regelmaessig und konsistent sichern.
7. Mosquitto erst mit TLS, Credentials und Topic-ACLs extern veroeffentlichen.

Deployment-Topologie: [vps-docker-topology.svg](vps-docker-topology.svg)

