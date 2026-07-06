# Provisioning Tool API

Initialer MVP-Implementierungskontrakt.

## Healthcheck

```text
GET /health
```

## Provisioning Session Erstellen

```text
POST /api/provisioning-sessions
```

Beispiel:

```json
{
  "serial_number": "GNX-ESP32-0001",
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
    "port": "COM3"
  }
}
```

Die Erstellungsantwort enthaelt einmalig `one_time_device_secret`. Dieses Secret wird nicht gespeichert und ist spaeter nicht erneut abrufbar.

## Session Status

```text
GET /api/provisioning-sessions/{session_id}
```

Liefert Session-Status, Device, Credential-Referenz, Manufacturer-Registration-Payload, Flash-Plan und Audit-Events ohne Klartext-Secret.

## Manifest

```text
GET /api/provisioning-sessions/{session_id}/manifest
```

Liefert die Device-Konfiguration fuer Initial-Firmware ohne Klartext-Secret.

## Complete

```text
POST /api/provisioning-sessions/{session_id}/complete
```

Markiert eine erfolgreich physisch abgeschlossene Provisionierung. Im MVP wird dadurch kein externer Device-Management-Server beschrieben.
