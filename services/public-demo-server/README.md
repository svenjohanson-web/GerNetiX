# Öffentlicher Demo-Katalog

Dieser Service besitzt eine eigene SQLite-Datenbank. Sie enthält ausschließlich
redaktionell freigegebene Demo-Metadaten und unveränderliche Firmware-Releases.
Sie enthält keine Konten, Projekte, Inventar-, Telemetrie- oder Kundendaten.

Öffentlich lesbar sind nur veröffentlichte Einträge:

- `GET /api/public/demos`
- `GET /api/public/demos/:demo_id`
- `GET /api/public/demos/:demo_id/releases/:version/firmware`

Ein Release ist ausschließlich über einen internen Veröffentlichungszugang mit
`X-Public-Demo-Publisher-Token` anlegbar. Jeder Release enthält nur
den vier ESP32-Flash-Bestandteilen `bootloader.bin`, `partitions.bin`,
`boot_app0.bin` und `firmware.bin`, wird einmalig gespeichert und mit SHA-256 ausgeliefert.
OTA ist durch das Datenmodell ausgeschlossen; die Katalogseite darf nur den
USB-Flash per WebSerial anbieten.
