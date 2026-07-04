# Device Management Server

Vorhaben fuer den GerNetiX Device-Management-Bereich.

Der Server verwaltet Registrierung, Pairing, Echtheitsnachweis, Account-Device-Inventar, OTA-Zielauswahl und Supportberechtigung fuer konkrete Devices. Fachlich ist das eine eigene Domaene. Im MVP soll sie als Modul im gemeinsamen Backend laufen; die API wird aber so geschnitten, dass ESP-Firmware, User IDE, Recovery Tool und Provisioning Tool sie direkt ansprechen koennen.

## Zweck

- GerNetiX-provisionierte Boards als echt erkennen
- Community-Hardware weiterhin nutzbar machen
- Devices Accounts zuordnen
- OTA-faehige Zielgeraete aus dem Account-Profil finden
- Support- und Garantiegrenzen nachvollziehbar pruefen
- Connectivity Setup, Pairing und Echtheit fachlich trennen

## MVP-Deployment

```text
Ein Backend-Prozess
- Account
- Learning / Wissensspeicher
- Authorization
- Device Management Server Module
```

## Spaetere Auslagerung

Die externe API bleibt unter einem klaren Device-Management-Prefix erreichbar. Dadurch kann das Modul spaeter als separater Service betrieben werden, z. B. `devices.gernetix.com`, ohne die fachlichen Schnittstellen neu zu denken.

## Externe Ansprecher

- ESP32 Firmware: Register, Heartbeat, Pairing-Status, OTA-Status, Challenge Response
- User IDE: Pairing starten, Devices anzeigen, OTA-Ziel auswaehlen
- Recovery Tool: Device erkennen, Pairing/Connectivity zuruecksetzen, Credentials erneuern
- Provisioning Tool: Hersteller-Register, Initial-Credential, Supportgrundlage
- Admin/Support: Support- und Reklamationsberechtigung pruefen

## Module

- `device-registry`: konkrete Devices und Lifecycle
- `pairing`: Pairing-Sessions und Account-Zuordnung
- `authenticity`: Challenge Response / HMAC-Pruefung
- `account-device-inventory`: Devices im Nutzerprofil
- `ota-target-discovery`: kompatible OTA-Zielgeraete finden
- `connectivity-setup`: WLAN-Scan, SSID-Auswahl, Node/AP-Status als fachlicher Setup-Kontext
- `support-entitlement`: Support-, Garantie- und Reklamationspruefung
- `admin-device-management`: Admin-/Support-Sichten fuer Device-Status, GerNetiX-Verified, Community-Hardware, Pairing, OTA und Entitlement

## Nicht-Ziele fuer diesen Stand

- keine Serverimplementierung
- keine Datenbankmigration
- keine echte HMAC-Implementierung
- keine Firmware-Webserver-UI
- keine Produktiv-Auth