# ESP32 Provisioning Tool

Internes GerNetiX-Tool fuer ESP32-Provisionierung.

Ziele:

- Board-Identitaet erfassen
- Provisionierungsmanifest erzeugen
- spaeter Credentials schreiben
- spaeter Firmware/OTA-Basiszustand flashen
- Support- und Registrierungsgrundlage schaffen

## Start

```powershell
node src/provision.js --board esp32-devkit-v1 --serial DEMO-001
```

Der aktuelle Stand ist bewusst ein lokaler Skeleton ohne echte Credential-Schreiblogik.
