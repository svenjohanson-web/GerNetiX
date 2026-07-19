# Hardware Catalog API

SQLite-persistente Quelle fuer bekannte HardwareItems, ProcessorBoards und
TechnicalCapabilities.

Der Hardware Catalog ist die fachliche Wahrheit fuer technische ProcessorBoards
und ihre Faehigkeiten. Die Hauptordnung ist technisch: ProcessorFamily/MCU,
Modul/Realisierung und danach das konkrete Board. Arduino ist dabei Marke,
Formfaktor oder Framework-Kompatibilitaet, aber keine technische Hauptkategorie.

Beispiele sind Arduino Nano R3 / ATmega328P, Wemos D1 mini / ESP-12F,
generische Boards mit ESP-WROOM-32 Modul, Arduino Nano ESP32, Espressif
ESP32-S3-DevKitC-1, das lokal getestete ESP32-S3 ES3C28P Touch-Board und
Espressif ESP32-C6-DevKitC-1.

Spezialhardware wie Display, Sound, Online-LEDs, Sensoren oder abweichende Pins
ist keine automatisch erkannte Board-Wahrheit. Der Katalog liefert bekannte
Hardwaretypen, Treiber, Anschlussarten, Werte und Datenblatt-Hinweise. Die vom
Nutzer bestaetigte Ausstattung und konkrete Verdrahtung wird als
`instance_configuration` am inventarisierten Account-Device in SQLite
gespeichert. Der Hardware Shop liest diese Daten als Client und fuehrt nur
Angebote, Warenkoerbe und Bestellungen.

ProcessorBoard-Eintraege koennen unter anderem enthalten:

- `processor_family`, z. B. `avr_8bit`, `esp8266`, `esp32`
- `mcu_variant`, z. B. `ATmega328P`, `ESP8266EX`, `ESP32-S3`, `ESP32-C6`
- `module_name`, z. B. `ESP-WROOM-32`, `ESP32-S3-WROOM-1`
- `module_memory_variant`, z. B. `N16R8`: 16 MB Flash und 8 MB PSRAM innerhalb der Modulvariante
- `firmware_build_target_id`, z. B. `firmware_build_target.esp32_s3_opi_n16r8`
- `capability_ids`, z. B. WLAN, OTA, USB-Identifikation, Basissoftware
- `min_basissoftware_version`
- `default_instance_configuration`
- `verification_status` und `evidence`

Bekannte konkrete Boards koennen eine gepruefte
`default_instance_configuration` mit Display-, Touch-, Audio-, Funk- und
Pinbelegung sowie bekannten Speicherwerten liefern. Beim ES3C28P ist das Modul
`ESP32-S3-WROOM-1-N16R8` hinterlegt: 512 KB interner SRAM, 8 MB PSRAM und
16 MB Flash. Provisioning verwendet diese Werte als Vorbelegung; erst
die Nutzerbestaetigung speichert sie am konkreten Account-Device.

Die Referenz `firmware_build_target_id` ist keine Compiler-Konfiguration im
Hardware-Katalog. Sie verweist auf die bei der Basissoftware gepflegte,
architektur- und speicherexakte Build-Definition. Details und der Release-Ablauf
sind in `docs/firmware-build-targets-and-releases.md` beschrieben.

## Basis

- `GET /health`
- Prefix: `/api/hardware-catalog`

## Katalog

- `GET /api/hardware-catalog/capabilities`
- `GET /api/hardware-catalog/capabilities/{capabilityId}`
- `GET /api/hardware-catalog/hardware-items`
- `GET /api/hardware-catalog/hardware-items/{hardwareItemId}`
- `GET /api/hardware-catalog/processor-boards`
- `GET /api/hardware-catalog/sensors`
- `GET /api/hardware-catalog/board-feature-options`

`board-feature-options` liefert die nach einer Bootloader-Erkennung zu
bestaetigenden Merkmale Display, Touch, Speaker, Mikrofon, Bluetooth, WLAN,
RAM und Flash. Ein Eintrag kann `hardware_options`, `driver_options`,
`connection_options`, `value_options` und `datasheet_hint` enthalten.

## Admin

- `POST /api/hardware-catalog/admin/capabilities`
- `POST /api/hardware-catalog/admin/hardware-items`
