# Provisioning Tool API

Initialer MVP-Implementierungskontrakt.

## Healthcheck

```text
GET /health
```

## ProcessorBoards Anzeigen

```text
GET /api/provisioning-processor-boards
```

Liefert die provisionierbaren ProcessorBoards aus dem Hardware-Katalog. Jedes Board enthaelt die Basissoftware-/Factory-Firmware-Artefaktreferenz, die das Provisioning Tool fuer den USB-Flash verwendet.

## Provisioning Session Erstellen

```text
POST /api/provisioning-sessions
```

Beispiel:

```json
{
  "serial_number": "GNX-ESP32-0001",
  "processor_board_id": "hardware.processor_board.esp32_devkit",
  "hardware_profile_id": "hardware.processor_board.esp32_devkit",
  "provisioning_batch_id": "batch-2026-07",
  "firmware_version": "0.1.0",
  "provisioned_by": "support@sven.local",
  "service_endpoints": {
    "device_management": "https://devices.gernetix.example/api/device-management",
    "build_deploy": "https://build.gernetix.example"
  },
  "capabilities": ["wifi", "ota", "flash_firmware"],
  "flash": {
    "requested": true,
    "port": "COM3",
    "write_factory_header": true
  }
}
```

Die Erstellungsantwort enthaelt einmalig `one_time_device_secret` und `usb_flash_package`. Dieses Secret wird nicht gespeichert und ist spaeter nicht erneut abrufbar. Das `processor_board_id` bestimmt den Hardware-Katalogeintrag; daraus werden Hardwareprofil, Basissoftware-Profil und Factory-Firmware-Artefakt abgeleitet.

Das `usb_flash_package` enthaelt fuer die physische Erstinbetriebnahme eine generierte Header-Datei. Die Basissoftware selbst wird im Serverbetrieb als versioniertes Firmware-Artefakt aus SQLite/Artifact Store referenziert, nicht direkt aus dem Projektordner:

```text
sqlite://provisioning_firmware_artifacts/firmware_artifact.esp32_basissoftware_factory.latest
```

Der Secret-Header wird nur in ein temporaeres Staging-Verzeichnis geschrieben und ausschliesslich per USB geflasht. Das Provisioning Tool schreibt keine Provisioning-Daten ueber WLAN oder Setup-AP.

Wenn `flash.write_factory_header` gesetzt ist, schreibt das Tool die Datei direkt an den konfigurierten Pfad `PROVISIONING_GENERATED_HEADER_PATH` beziehungsweise standardmaessig nach:

```text
services/provisioning-tool/.runtime/factory-payload/generated_provisioning_payload.h
```

## Firmware-Artefakt Anzeigen

```text
GET /api/provisioning-firmware-artifact
```

Liefert die aktuell konfigurierte serverseitige Basissoftware-Artefaktreferenz.

## Firmware-Artefakte Registrieren

```text
POST /api/provisioning-firmware-artifacts
```

Registriert ein serverseitiges Firmware-Artefakt im Provisioning Artifact Store. Dieser Schreibpfad ist kein Bedienerflow der Factory-HMI und ist standardmaessig gesperrt. Er darf nur fuer einen explizit freigeschalteten Build-/Admin-Prozess mit `ALLOW_FIRMWARE_ARTIFACT_ADMIN_WRITE=true` genutzt werden. Alternativ kann der Server beim Start ueber `PROVISIONING_FIRMWARE_FILE_PATH` ein vorbereitetes Firmware-Binary aus einem Server-Firmwareordner referenzieren.

Die Factory-HMI selbst laedt keine Firmware-Dateien vom Bedienrechner hoch. Sie zeigt nur das fuer das ProcessorBoard bekannte Artefakt und dessen Bereitstellungsstatus an. Fuer ESP32 wird zunaechst ein zusammengefuehrtes Flash-Image erwartet, das mit `esptool write_flash 0x0` geschrieben werden kann.

Beispiel:

```json
{
  "artifact_id": "firmware_artifact.esp32_basissoftware_factory.latest",
  "file_name": "merged-firmware.bin",
  "content_base64": "...",
  "flash_strategy": "esp32_merged_bin",
  "flash_offset": "0x0"
}
```

## Flash-Modus Anzeigen

```text
GET /api/provisioning-flash-mode
```

Liefert die serverseitig erlaubten Flash-Modi fuer die UI. `mock` ist immer erlaubt. `esptool` ist erst ausfuehrbar, wenn der Server mit `ALLOW_REAL_USB_FLASH=true` gestartet wurde, das passende Firmware-Artefakt registriert ist und das Toolchain-Manifest `.runtime/toolchains/provisioning/toolchain.json` auf vorhandene Runtime-Dateien zeigt.

## Aktives Credential Zuruecksetzen

```text
POST /api/provisioning-credentials/reset
```

Setzt das aktive Factory-Credential fuer eine Seriennummer zurueck, damit ein abgebrochener oder fehlerhafter Provisioning-Vorgang wiederholt werden kann. Der bisherige Vorgang wird nicht geloescht, sondern mit Audit-Event und `revoked_by_factory_reset` markiert.

Beispiel:

```json
{
  "serial_number": "GNX-ESP32-0002",
  "actor": "factory-user",
  "reason": "factory_reprovisioning"
}
```

## Session Status

```text
GET /api/provisioning-sessions/{session_id}
```

Liefert Session-Status, Device, Credential-Referenz, Manufacturer-Registration-Payload, Flash-Plan und Audit-Events ohne Klartext-Secret.

## Manifest

```text
GET /api/provisioning-sessions/{session_id}/manifest
```

Liefert die Device-Konfiguration fuer Initial-Firmware ohne Klartext-Secret. Dieser Endpoint ist fuer Nachvollziehbarkeit und Pruefung gedacht, nicht fuer physisches Device-Provisioning.

## USB Flash

```text
POST /api/provisioning-sessions/{session_id}/usb-flash
```

Fuehrt den USB-Flash-Schritt fuer eine vorbereitete Session aus. Voraussetzung:

- Session wurde mit `flash.requested: true` angelegt.
- Factory-Header wurde mit `flash.write_factory_header: true` erzeugt.
- `FLASH_RUNNER` ist passend konfiguriert.

Beispiel:

```json
{
  "port": "COM9",
  "actor": "factory@sven.local",
  "flash_runner": "mock"
}
```

Bei `flash_runner=mock` wird der Ablauf ohne Board-Zugriff simuliert. Bei `flash_runner=esptool` startet das Tool nur dann echten USB-Flash, wenn `ALLOW_REAL_USB_FLASH=true` gesetzt ist, das serverseitige Firmware-Artefakt materialisiert werden kann und die USB-Flash-Toolchain im Runtime-Manifest bereitsteht. Dann wird ausgefuehrt:

```text
esptool.py --chip esp32 --port {port} write_flash 0x0 {materialized_file}
```

`platformio` ist ein alternativer serverseitiger USB-Flash-Runner fuer ein materialisiertes Staging-Projekt. Auch dafuer muss die PlatformIO-Toolchain im Runtime-Manifest bereitstehen. Ein direkter Zugriff auf `basissoftware/esp32` ist kein Provisioning-Betriebsweg.

## USB Flash Job

```text
POST /api/provisioning-sessions/{session_id}/usb-flash-jobs
GET /api/provisioning-flash-jobs/{job_id}
```

Startet denselben USB-Flash-Schritt als serverseitigen Job und liefert sofort eine `job_id` zurueck. Die HMI pollt anschliessend den Jobstatus und zeigt Phase, Prozentwert und die letzten Logzeilen an. Bei `esptool` werden Fortschrittszeilen wie `Writing at ... (42 %)` in eine Progress Bar uebersetzt.

Beispiel Start:

```json
{
  "port": "COM9",
  "actor": "factory@sven.local",
  "flash_runner": "esptool"
}
```

Beispiel Status:

```json
{
  "job_id": "flash_...",
  "status": "running",
  "runner": "esptool",
  "port": "COM9",
  "percent": 42,
  "phase": "writing",
  "message": "Writing at 0x000a0000... (42 %)",
  "logs": []
}
```

## Complete

```text
POST /api/provisioning-sessions/{session_id}/complete
```

Markiert eine erfolgreich physisch abgeschlossene Provisionierung. Im MVP wird dadurch kein externer Device-Management-Server beschrieben.
