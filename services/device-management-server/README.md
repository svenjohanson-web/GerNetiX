# Device Management Server

Vorhaben fuer den GerNetiX Device-Management-Bereich.

Der Server verwaltet Registrierung, Pairing, Echtheitsnachweis, Account-Device-Inventar, OTA-Zielauswahl und Supportberechtigung fuer konkrete Devices. Fachlich ist das eine eigene Domaene. Im MVP soll sie als Modul im gemeinsamen Backend laufen; die API wird aber so geschnitten, dass ESP-Firmware, User IDE, Recovery Tool und Provisioning Tool sie direkt ansprechen koennen.

## Zweck

- GerNetiX-provisionierte Boards als echt erkennen
- Community-Hardware weiterhin nutzbar machen
- Devices Accounts zuordnen
- OTA-faehige Zielgeraete aus dem Account-Profil finden
- Device-Berechtigung fuer Build-&-Flash und OTA pruefen
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

## Firmware-Update-Strategie

Device Management ist der fachliche Ansprechpartner fuer die Frage, ob ein Device bekannt, gepairt, einem Account zugeordnet und fuer OTA berechtigt ist. Der Build-&-Deploy-Server fuehrt danach den Build und den Deploy aus.

Die ESP32-Basissoftware kennt keine feste Homeserver-IP, keine AWS-Adresse und kein separates Instanz-Konzept. Sie verwendet konfigurierbare Service-Endpunkte. Dadurch kann ein erster Betrieb auf einem Linux-Homeserver spaeter zu einer Cloud-Umgebung umziehen, ohne dass Boards nur wegen des Serverumzugs per USB neu geflasht werden muessen.

Minimale Device-Daten fuer diesen Ablauf:

- `device_id`
- Runtime-Version
- App-Version
- konfigurierte Service-Endpunkte
- Credential-Referenz oder Device-Key
- letzter Update-Status

Hardware-Plattform, Capability-Profil, Release-Channel oder Mindest-Runtime werden erst modelliert, wenn Kompatibilitaet, Support oder Rollout-Steuerung sie fachlich benoetigen.

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

## Deployment-Leitplanken

- Device Management bleibt als eigenstaendiger Prozess oder klar getrenntes Backend-Modul schneidbar.
- ESP-Firmware, User IDE, Recovery Tool und Provisioning Tool sprechen nur ueber explizite API-Vertraege mit Device Management.
- Ports, Datenbankverbindungen, MQTT-Broker und externe Basis-URLs muessen spaeter konfigurierbar sein.
- Der erste Zielbetrieb darf ein Linux-Homeserver sein; spaetere Cloud-Auslagerung darf die fachlichen Schnittstellen nicht brechen.
