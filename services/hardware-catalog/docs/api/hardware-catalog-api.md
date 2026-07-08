# Hardware Catalog API

SQLite-persistente Quelle fuer bekannte HardwareItems, ProcessorBoards und
TechnicalCapabilities.

Der Hardware Catalog ist die fachliche Wahrheit fuer technische ProcessorBoards
und ihre Faehigkeiten. Die Hauptordnung ist technisch: ProcessorFamily/MCU,
Modul/Realisierung und danach das konkrete Board. Arduino ist dabei Marke,
Formfaktor oder Framework-Kompatibilitaet, aber keine technische Hauptkategorie.

Beispiele sind Arduino Nano R3 / ATmega328P, Wemos D1 mini / ESP-12F,
generische Boards mit ESP-WROOM-32 Modul, Arduino Nano ESP32, Espressif
ESP32-S3-DevKitC-1 und Espressif ESP32-C6-DevKitC-1.

Spezialhardware wie Display, Sound, Online-LEDs, Sensoren oder abweichende Pins
ist keine eigene Board-Wahrheit im Katalog. Der Katalog kann Defaults und
Faehigkeiten liefern; die konkrete Verdrahtung wird als Instanz-Konfiguration
am inventarisierten Account-Device gespeichert. Der Hardware Shop liest diese
Daten als Client und fuehrt nur Angebote, Warenkoerbe und Bestellungen.

ProcessorBoard-Eintraege koennen unter anderem enthalten:

- `processor_family`, z. B. `avr_8bit`, `esp8266`, `esp32`
- `mcu_variant`, z. B. `ATmega328P`, `ESP8266EX`, `ESP32-S3`, `ESP32-C6`
- `module_name`, z. B. `ESP-WROOM-32`, `ESP32-S3-WROOM-1`
- `capability_ids`, z. B. WLAN, OTA, USB-Identifikation, Basissoftware
- `min_basissoftware_version`
- `default_instance_configuration`

## Basis

- `GET /health`
- Prefix: `/api/hardware-catalog`

## Katalog

- `GET /api/hardware-catalog/capabilities`
- `GET /api/hardware-catalog/capabilities/{capabilityId}`
- `GET /api/hardware-catalog/hardware-items`
- `GET /api/hardware-catalog/hardware-items/{hardwareItemId}`
- `GET /api/hardware-catalog/processor-boards`

## Admin

- `POST /api/hardware-catalog/admin/capabilities`
- `POST /api/hardware-catalog/admin/hardware-items`
