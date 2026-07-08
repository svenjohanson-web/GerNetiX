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
  "processor_board_id": "hardware.processor_board.generic_esp_wroom32",
  "hardware_profile_id": "hardware.processor_board.generic_esp_wroom32",
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
    "write_factory_header": true
  }
}
```

Die Erstellungsantwort enthaelt einmalig `one_time_device_secret` und `usb_flash_package`. Dieses Secret wird nicht gespeichert und ist spaeter nicht erneut abrufbar. Das `processor_board_id` bestimmt den Hardware-Katalogeintrag; daraus werden Hardwareprofil, Basissoftware-Profil und Factory-Firmware-Artefakt abgeleitet.

Das `usb_flash_package` enthaelt fuer die physische Erstinbetriebnahme eine generierte Header-Datei. Die Basissoftware selbst wird im Serverbetrieb als versioniertes Firmware-Artefakt aus SQLite/Artifact Store referenziert, nicht direkt aus dem Projektordner:

```text
sqlite://provisioning_firmware_artifacts/firmware_artifact.esp32_basissoftware_factory.latest
```

Der Secret-Header wird nur in ein temporaeres Staging-Verzeichnis geschrieben und kann in ein Factory-Image eingebettet werden. Im normalen HMI-Ablauf bleibt das Firmware-Artefakt generisch; die konkrete Board-Kennung wird nach dem USB-Flash ueber den lokalen Device-Endpunkt `/provisioning` dauerhaft in NVS gespeichert.

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

Die Factory-HMI selbst laedt keine Firmware-Dateien vom Bedienrechner hoch. Sie zeigt nur das fuer das ProcessorBoard bekannte Artefakt und dessen Bereitstellungsstatus an. Fuer ESP32 wird zunaechst ein zusammengefuehrtes Flash-Image erwartet, das im Browser per `esptool-js` und Web Serial ab Offset `0x0` geschrieben werden kann.

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

## Browser-Flash-Bereitschaft Anzeigen

```text
GET /api/provisioning-flash-mode
```

Liefert den Bereitstellungsstatus des Firmware-Artefakts fuer den Browser-Web-Serial-Flash. Dieser Endpoint startet keinen Flash-Vorgang und beschreibt keinen alternativen Flash-Modus.

## Firmware-Artefakt Laden

```text
GET /api/provisioning-firmware-artifacts/{artifact_id}/content
```

Liefert das vorbereitete Firmware-Binary als `application/octet-stream` fuer den Browser-Web-Serial-Flash. Die HMI laedt dieses Artefakt, uebergibt die Bytes an `esptool-js` und schreibt die Firmware direkt ueber das vom Nutzer im Browser ausgewaehlte USB-Serial-Geraet.

## Device-Provisioning-Ziele Suchen

```text
GET /api/provisioning-device-targets
```

Sucht lokale GerNetiX-Basissoftware-Instanzen ueber bekannte Hostnamen wie `gernetix-esp32`, `gernetix-esp32.local`, die Setup-IP `192.168.4.1` und private lokale IPv4-Subnetze. Geprueft wird jeweils `/status`; Treffer liefern den passenden `/provisioning`-Endpunkt fuer den Board-Speicher-Schritt. Wenn der Bedienrechner mit einer Setup-AP-SSID verbunden ist, die mit `gernetix-` beginnt, gilt direkt `http://192.168.4.1/provisioning`; der SSID-Suffix ist kein DNS-Name.

Optional koennen Kandidaten explizit mitgegeben werden:

```text
GET /api/provisioning-device-targets?candidate=http://gernetix-esp32/status
```

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

## Browser USB Flash Ergebnis

```text
POST /api/provisioning-sessions/{session_id}/browser-usb-flash-result
```

Speichert das Ergebnis eines Browser-Web-Serial-Flashs an der Provisioning Session. Der physische Flash wurde vorher in der HMI ausgefuehrt; dieser Endpoint startet keinen lokalen Toolchain-Prozess.

Beispiel erfolgreich:

```json
{
  "status": "flashed",
  "actor": "factory@sven.local",
  "port": "WebSerial 1A86:7523",
  "chip_name": "ESP32",
  "stdout": "Browser flash ok"
}
```

Beispiel fehlgeschlagen:

```json
{
  "status": "failed",
  "actor": "factory@sven.local",
  "port": "WebSerial 1A86:7523",
  "error": "Failed to connect"
}
```

## Device-Provisioning Im Board Speichern

```text
POST /api/provisioning-sessions/{session_id}/device-provisioning
```

Sendet den kompletten Session-Payload an den lokalen Device-Webserver der geflashten Basissoftware. Das Board speichert `device_id`, `serial_number`, Hardwareprofil, Credential-Referenz, Service-Endpunkte und `one_time_device_secret` dauerhaft im NVS-Namespace `prov`. Der Endpoint ist fuer den HMI-Schritt nach dem USB-Flash gedacht; er startet keinen Flash und baut kein Firmware-Binary.

Beispiel:

```json
{
  "device_url": "http://192.168.4.1/provisioning",
  "actor": "factory-user",
  "one_time_device_secret": "nur-aus-aktueller-browser-session"
}
```

Das `one_time_device_secret` wird nicht aus dem Session-Status zurueckgegeben und muss aus der aktuellen Browser-Session stammen. Ist es nicht mehr vorhanden, muss die Provisioning-Session neu vorbereitet werden.

## Complete

```text
POST /api/provisioning-sessions/{session_id}/complete
```

Markiert eine erfolgreich physisch abgeschlossene Provisionierung. Die HMI nutzt ausschliesslich diesen Abschluss-Endpunkt; `POST /api/provisioning-sessions/{session_id}` ist kein Abschlussalias.
