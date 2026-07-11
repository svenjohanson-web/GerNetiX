# GerNetiX Dev-Infrastruktur

Diese Infrastruktur bildet lokal dieselbe OTA-Kommunikationskette ab, die spaeter auf einem VPS laufen soll:

```text
Build-&-Deploy-Server -> MQTT Broker -> Device/Basissoftware
Build-&-Deploy-Server -> HTTPS Artifact URL -> Device/Basissoftware
Device/Basissoftware -> MQTT Broker -> Build-&-Deploy-Server
```

Der lokale Broker ersetzt nicht die Architektur. Er ist dieselbe Broker-Rolle wie spaeter auf dem VPS, nur mit Dev-Konfiguration.

## MQTT Broker starten

```powershell
docker compose -f infra/dev/docker-compose.yml up -d mqtt-broker
```

Broker-Adressen lokal:

```text
mqtt://127.0.0.1:1883
ws://127.0.0.1:9001
```

## MQTT Broker stoppen

```powershell
docker compose -f infra/dev/docker-compose.yml down
```

## Smoke-Test

PowerShell-Fenster 1:

```powershell
docker exec -it gernetix-mqtt-broker mosquitto_sub -h 127.0.0.1 -p 1883 -t "gernetix/devices/+/ota" -v
```

PowerShell-Fenster 2:

```powershell
docker exec -it gernetix-mqtt-broker mosquitto_pub -h 127.0.0.1 -p 1883 -t "gernetix/devices/demo-device-1/ota" -m "{""deploy_id"":""dep-local-1"",""sequence"":1,""firmware_url"":""https://build.example/firmware.bin"",""sha256"":""<sha256>"",""authorization"":""<hmac>""}"
```

## Dev-Konfiguration

Die lokale Mosquitto-Konfiguration ist absichtlich nur fuer Entwicklungsmaschinen gedacht:

- Ports sind auf `127.0.0.1` gebunden.
- TLS ist aus.
- Anonyme Clients sind erlaubt.
- MQTT laeuft auf `1883`.
- MQTT over WebSocket laeuft auf `9001`.

Produktiv auf dem VPS muessen TLS, Credentials oder Client-Zertifikate und Topic-ACLs aktiviert werden.

## Topic-Konvention

Deployment-Command:

```text
gernetix/devices/{deviceId}/ota
```

Deployment-Status:

```text
gernetix/devices/{deviceId}/status/deployment
```

Heartbeat:

```text
gernetix/devices/{deviceId}/status/heartbeat
```

MQTT uebertraegt nur Commands, Status, Heartbeats und Telemetrie. Firmware-Binaries werden per HTTP/HTTPS geladen.
