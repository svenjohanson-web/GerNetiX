# Build-&-Deploy-Server API

Initialer MVP-Implementierungskontrakt.

## Healthcheck

```text
GET /health
```

Antwort:

```json
{
  "status": "ok",
  "service": "build-deploy-server"
}
```

## Eingehende Auftraege

```text
POST /api/build-jobs
```

Der MVP akzeptiert ein BuildPackage als JSON-Dateiliste. Dateipfade muessen relativ sein und duerfen nicht aus dem BuildPackage ausbrechen.

Beispiel:

```json
{
  "job_id": "demo-job-1",
  "mode": "build_and_flash",
  "device_id": "device-1",
  "deploy": {
    "requested": true,
    "device_id": "device-1",
    "authorized": true
  },
  "build_package": {
    "files": {
      "build-job.json": "{\"id\":\"demo-job-1\"}",
      "platformio.ini": "[env:test]\nplatform = espressif32\n",
      "src/main.cpp": "void setup() {}\nvoid loop() {}\n"
    }
  }
}
```

Unterstuetzte Modi:

- `build`: Build ohne Deploy
- `build_and_flash`: Build mit anschliessendem validiertem Deploy-Auftrag
- `build_and_usb_flash`: Build mit lokalem USB-Flash ueber PlatformIO `upload`
- `prebuild`: Cache-Aufwaermung ohne Deploy

```text
GET /api/build-jobs/{job_id}
```

Liefert Status, Ergebnis, Fehler und Artefaktmetadaten.

```text
GET /artifacts/{job_id}/{file_name}
```

Erlaubte Dateinamen:

- `firmware.bin`
- `firmware.elf`
- `firmware.hex`
- `firmware.map`
- `build.log`

## Ausgehende Ergebnisse

- Build-Status
- Firmware-Artefakt
- Build-Log
- Deploy-Log
- Fehlerstatus
- Abschlussstatus
- SHA-256
- Dateigroesse

## Transport

- HTTP: BuildPackage-Uebertragung, BuildResult, Artefaktuebertragung
- HTTPS: Firmware-Download durch das Device
- MQTT: Deploy-Auftraege, Statusmeldungen, Heartbeats, Telemetrie; im MVP noch als Orchestrator-Abstraktion ohne produktiven Broker-Publish

## Nicht in dieser API

- dauerhafte Projektverwaltung
- Account-Device-Inventar
- Pairing
- Support-Entitlement
- fachliche Lernfortschrittsberechnung
