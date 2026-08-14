# Öffentlicher Demo-Katalog

Dieser Service verwendet ausschließlich die zentrale PostgreSQL-Laufzeitdatenbank
auf dem VPS. Sie enthält ausschließlich redaktionell freigegebene
Demo-Metadaten und unveränderliche Firmware-Releases.
Sie enthält keine Konten, Projekte, Inventar-, Telemetrie- oder Kundendaten.

Öffentlich lesbar sind nur veröffentlichte Einträge:

- `GET /api/public/demos`
- `GET /api/public/demos/:demo_id`
- `GET /api/public/demos/:demo_id/releases/:version/firmware`

Ein Release ist ausschließlich über einen internen Veröffentlichungszugang mit
einen kurzlebigen Bearer-Diensttoken mit Audience `public-demo-server` und
Scope `public_demo.publish` anlegbar. Jeder Release enthält nur
den ESP32-Flash-Bestandteilen `bootloader.bin`, `partitions.bin`, optional
`ota_data_initial.bin` und `firmware.bin`, wird einmalig gespeichert und mit
SHA-256 ausgeliefert. Die Binärdateien liegen checksum-gesichert im zentralen
Artifact Store auf dem VPS; es gibt keinen lokalen SQLite- oder Runtime-Fallback.
OTA ist durch das Datenmodell ausgeschlossen; die Katalogseite darf nur den
USB-Flash per WebSerial anbieten.
