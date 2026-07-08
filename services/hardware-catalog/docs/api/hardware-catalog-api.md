# Hardware Catalog API

SQLite-persistente Quelle fuer bekannte HardwareItems, ProcessorBoards und
TechnicalCapabilities.

Der Hardware Catalog ist die fachliche Wahrheit fuer Boards wie ESP-WROOM-32,
ESP-WROOM-32 mit Display oder Arduino Nano ATmega328P. Der Hardware Shop liest
diese Daten als Client und fuehrt nur Angebote, Warenkoerbe und Bestellungen.

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
