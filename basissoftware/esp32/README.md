# ESP32 Basissoftware

GerNetiX Basissoftware fuer ESP32-Projekte auf Basis von ESP-IDF.

## Identität der Basissoftware

Jede Basissoftware muss zwei voneinander getrennte, nicht leere Identitätsangaben besitzen:

- `basissoftwareVersion`: technische, veröffentlichte Version der konkreten Basissoftware
- `basissoftwareVariant`: Funktionsprofil, aktuell `comfort`; weitere vorgesehene Profile sind beispielsweise `min-connect` oder `min-ota`

Beide Angaben sind Compile-Time-Metadaten der Firmware und werden über `/status` ausgegeben. Die frei provisionierbare `firmwareVersion` bezeichnet dagegen die ausgelieferte Anwendungsfirmware und darf die Identität der Basissoftware nicht ersetzen.

Dieses Verzeichnis ist das aktive ESP32-Firmwareprojekt:

```text
basissoftware/esp32/
```

Die Basissoftware ist von Projektanpassungen und generiertem Code getrennt. Sie enthaelt nur die stabile Runtime, Initialisierung, freigegebene Hooks und gemeinsame Hardwareabstraktion.

## Einstieg

Der ESP-IDF-Einstieg liegt in:

```text
src/main.cpp
```

`app_main()` fuehrt nur die Initialisierung aus und startet anschliessend die Runtime-Tasks:

```cpp
extern "C" void app_main() {
  initSerial();
  initPins();
  initWifi();
  applyFactoryProvisioningIfAvailable();
  runDiagnostics();
  onProjectInit();
  confirmRunningOtaImage();
  startMqttOtaSubscriber();
  startRuntimeTasks();
}
```

Es gibt keine Arduino-`setup()`/`loop()`-Struktur und keine Arduino-Quellen.

## Struktur

```text
basissoftware/esp32/
  CMakeLists.txt
  platformio.ini
  include/
    basissoftware/
      config.h
      project_hooks.h
      functions/
  src/
    CMakeLists.txt
    main.cpp
    functions/
    hooks/
```

Jede Basissoftware-Funktion liegt in einer eigenen Datei. Projektlogik wird nicht direkt in die Basissoftware geschrieben, sondern spaeter ueber `projects/` oder `generated/` eingebunden.

## Build

```powershell
platformio run
```

### 4-MB-OTA-Partitionslayout

Das Standardprofil `esp32dev` verwendet `partitions_ota_4mb.csv` fuer Boards mit 4 MB Flash:

- `nvs`: 24 KiB fuer Runtime- und Provisioning-Konfiguration; Offset und Groesse bleiben kompatibel zum bisherigen Single-App-Layout
- `otadata`: 8 KiB fuer ausfallsichere OTA-Auswahlmetadaten
- `ota_0`: 1,4375 MiB fuer das aktive Firmware-Image
- `ota_1`: 1,4375 MiB fuer das alternative Firmware-Image
- `storage`: 960 KiB SPIFFS-Datenbereich
- `coredump`: 64 KiB fuer Diagnoseabbilder

Die Tabelle endet exakt an der 4-MB-Grenze `0x400000`. App-Slots beginnen auf 64-KiB-Grenzen; Datenpartitionen auf 4-KiB-Grenzen. `ota_0` beginnt bewusst erst bei `0x20000`: Dadurch bleiben die sechs bisherigen NVS-Sektoren von `0x9000` bis `0xEFFF` bei einer USB-Migration vom alten Single-App-Layout unangetastet. Fuer erkannte 2-MB-Boards darf dieses Profil nicht verwendet werden. Sie benoetigen ein eigenes Board-/Partitionsprofil.

Die Basissoftware nutzt dieses A/B-Layout fuer authentifizierte HTTPS-Updates. Bootloader-Rollback ist aktiv: Ein neu gestartetes Image wird erst nach abgeschlossener Runtime-Initialisierung und den Diagnosen bestaetigt. Bricht der Start vorher ab, kann der Bootloader auf das vorherige Image zurueckfallen.

## WLAN-Setup-AP

Beim Start initialisiert die Basissoftware WiFi im SoftAP-Modus. Nach dem Flashen sollte im WLAN-Scan ein offenes Netzwerk sichtbar sein:

```text
GerNetiX-Setup
```

Nach einem Abbruch der Station-Verbindung verbindet sich die Basissoftware dauerhaft erneut. Die Pausen steigen von 1, 2, 5, 10 und 30 Sekunden bis maximal 60 Sekunden; nach erfolgreicher IP-Zuweisung beginnt ein spaeterer Reconnect wieder bei 1 Sekunde. Ein kurzzeitiger Router-, Funk- oder DHCP-Ausfall erfordert dadurch keinen Board-Reset.

Nach dem Verbinden mit diesem Netzwerk ist das lokale Device-Webinterface unter der Standard-AP-Adresse erreichbar:

```text
http://192.168.4.1/
```

Zusaetzlich startet die Basissoftware einen Captive-DNS-Dienst auf UDP-Port 53. DNS-Anfragen im Setup-WLAN werden auf `192.168.4.1` beantwortet, und unbekannte HTTP-GET-Pfade zeigen die lokale Setup-Seite. Dadurch oeffnen Handy, Tablet oder Laptop nach dem Verbinden mit `GerNetiX-Setup` typischerweise automatisch den Captive-Portal-Dialog, ohne dass der Nutzer die IP-Adresse raten muss.

Aktuelle lokale Endpunkte:

- `/` zeigt die einfache Device-Startseite.
- `/status` liefert Runtime-, WLAN- und Uptime-Status als JSON.
- `/logs` liefert den lokalen Feedback-Ringpuffer als Text.
- Unbekannte GET-Pfade wie `/generate_204`, `/hotspot-detect.html` oder `/connecttest.txt` werden als Captive-Portal-Einstieg auf die lokale Setup-Seite beantwortet.
- `POST /provisioning` speichert einen Factory-Provisioning-Payload dauerhaft in NVS. Das Provisioning Tool nutzt diesen Endpunkt nach dem USB-Flash, damit Seriennummer und Device-ID ohne Board-spezifischen Firmware-Neubuild auf dem Board landen.
- `POST /auth/challenge` nimmt eine Device-Management-Challenge an und erzeugt einen lokalen `HMAC_SHA256`-Nachweis mit dem provisionierten Device-Secret.
- `POST /ota` nimmt einen authentifizierten OTA-Auftrag an und startet den Download in einem separaten Runtime-Task.

Ein OTA-Auftrag enthaelt `deploy_id`, eine strikt steigende `sequence`, `firmware_url`, den erwarteten Image-`sha256` und `authorization`. Die Autorisierung ist `HMAC_SHA256` mit dem provisionierten Device-Secret ueber `deploy_id`, `sequence`, `device_id`, `firmware_url` und `sha256`, jeweils durch einen Zeilenumbruch getrennt und ohne abschliessenden Zeilenumbruch.

Das Device akzeptiert nur HTTPS-URLs vom Origin des provisionierten `buildDeployUrl` und nur einen laufenden Auftrag. Nach dem Download wird der SHA-256 des geschriebenen App-Images geprueft. Erst danach wird der neue Slot aktiviert und die Sequenznummer in NVS gespeichert. `/status` liefert den aktuellen Zustand unter `ota`.

## MQTT-Benachrichtigung fuer neue Firmware

Beim Provisioning kann als MQTT-Ziel entweder der VPS oder ein Broker im lokalen Netzwerk gewaehlt werden. Der VPS wird per `mqtts://` angesprochen (Standard: `mqtts://mqtt.gernetix.com:8883`). Fuer Entwicklung und Inbetriebnahme im LAN ist `mqtt://<private-ip>:<port>` erlaubt; Klartext-MQTT zu Hostnamen oder oeffentlichen IP-Adressen wird von Basissoftware und Provisioning Tool abgewiesen.

Das Device verbindet sich mit seiner Device-ID als Client-ID und Benutzername. Das Broker-Passwort wird lokal per HMAC mit dem festen Kontext `gernetix:mqtt-broker-auth:v1` aus dem Device-Secret abgeleitet; das eigentliche Device-Secret wird nicht an den Broker uebertragen. Auch der lokale Broker muss dieses Credential kennen. Die serverseitige Broker-Registrierung muss beim Factory-Provisioning dieselbe Ableitung verwenden. Das Device abonniert mit QoS 1:

```text
gernetix/devices/<device_id>/ota
```

Der MQTT-Payload entspricht exakt dem JSON-Vertrag von `POST /ota`. MQTT ist nur der Pub/Sub-Transport: HMAC, Sequenznummer, HTTPS-Origin und Image-SHA-256 werden unveraendert im OTA-Modul geprueft. Der ESP-MQTT-Client verbindet sich nach Abbruechen automatisch neu. `/status` zeigt unter `mqtt` Verbindungszustand und Topic; Credentials werden dort nicht ausgegeben.

Nach erfolgreichem Provisioning enthaelt `/status` zusaetzlich:

- `displayName`
- `hostname`
- `provisioningState`
- `deviceId`
- `serialNumber`
- `hardwareProfileId`
- `firmwareVersion`
- `firmwareBasis`
- `credentialId`
- `credentialType`
- `keyReference`
- `deviceManagementUrl`
- `buildDeployUrl`
- `mqttBrokerUrl`
- `provisioningBatchId`
- `provisionedBy`
- `capabilities`
- `hasDeviceSecret`
- `authenticityProof`

Der lokale Stations-Hostname wird nach dem Provisioning dynamisch aus der Seriennummer gebildet. Aus `GNX-ESP32-0001` wird zum Beispiel `gernetix-gnx-esp32-0001`. Ohne gespeicherte Seriennummer bleibt der Fallback `gernetix-esp32`. Der IDE-Device-Manager nutzt `/status`, um diese Namen beim WiFi-Scan im Nutzerinventar sichtbar zu machen.

## USB-Factory-Provisioning

Das initiale Hersteller-Provisioning laeuft ausschliesslich ueber USB. Das Provisioning Tool erzeugt fuer genau einen physischen Flash-Vorgang eine generierte Header-Datei:

```text
include/basissoftware/generated_provisioning_payload.h
```

Wenn diese Datei beim Build vorhanden ist, importiert die Basissoftware den enthaltenen Factory-Payload beim ersten Boot in NVS. Ist das Device bereits provisioniert, wird der Factory-Payload ignoriert. Das Provisioning Tool schreibt diese Datei nur bei einem expliziten USB-Flash-Paket, zum Beispiel mit `flash.write_factory_header`.

Im normalen HMI-Ablauf kann ein generisches Factory-Firmware-Artefakt geflasht werden. Nach dem Boot sendet das Provisioning Tool den konkreten Session-Payload an `POST /provisioning`; die Basissoftware speichert daraus `device_id`, `serial_number`, Hardwareprofil, Firmwarestand, Credential-Referenz, Service-Endpunkte, Provisioning-Charge und das einmalige Device-Secret dauerhaft im NVS-Namespace `prov`.

Das Provisioning Tool liefert im abrufbaren Manifest nur Credential-Referenz und Secret-Hash. Das einmalig erzeugte `one_time_device_secret` darf nur im USB-Flash-Paket enthalten sein. Dieses Secret wird lokal im Device-NVS gespeichert, aber niemals ueber `/status`, `/logs` oder den Challenge-Endpunkt ausgegeben.

Minimaler Echtheitsnachweis gegen Device Management:

```http
POST /auth/challenge
Content-Type: application/json

{
  "challenge_id": "challenge_123",
  "challenge": "random-server-challenge"
}
```

Antwort:

```json
{
  "device_id": "device_...",
  "serial_number": "GNX-ESP32-...",
  "credential_id": "cred_...",
  "challenge_id": "challenge_123",
  "algorithm": "HMAC_SHA256",
  "hmac": "..."
}
```

## Schneller Contract-Nachweis

Fuer die schnelle Pruefung ohne ESP-IDF-/PlatformIO-Vollbuild gibt es einen Contract-Check:

```powershell
node tools\firmware-contract-check\check-provisioning-contract.js
```

Der Check erzeugt ein reales Provisioning-Manifest aus `services/provisioning-tool` und prueft, ob die ESP32-Basissoftware die erwarteten Manifestfelder kennt. Der schwere Firmware-Build bleibt ein expliziter Integrationsschritt.

Dieser AP ist der erste Schritt fuer das im Register-und-Pairing-Konzept beschriebene Connectivity Setup. WLAN-Scan, Speichern der Ziel-WLAN-Daten und der authentifizierte OTA-Firmwarepfad sind vorhanden. Die serverseitige Zustellung eines Deploy-Auftrags an ein entferntes Device bleibt eine getrennte Integrationsaufgabe.

## Offene Entscheidungen

Die folgenden Punkte sind im fachlichen Graphen als offene Entscheidungen dokumentiert:

- `decision.esp32_ota_bootstrap_firmware.wifi_setup`: WLAN-Scan, SSID-Auswahl, Passwort-Eingabe und lokale NVS-Speicherung.
- `decision.esp32_ota_bootstrap_firmware.node_mode_policy`: Verhalten nach erfolgreicher WLAN-Verbindung, z. B. STA-only, AP+STA oder Fallback-AP.
- `decision.esp32_ota_bootstrap_firmware.flash_layout`: 2-MB-Flash-Unterstuetzung vs. 4-MB-OTA-Zielprofil und Partitionierung.
- `decision.esp32_ota_bootstrap_firmware.ota_authentication`: Der Device-Auftrag ist jetzt per HMAC authentifiziert und das Image per SHA-256 gebunden; eine zusaetzliche asymmetrische Artefaktsignatur und Secure-Boot-Policy bleiben als Produktionsentscheidung offen.
- `decision.esp32_ota_bootstrap_firmware.service_endpoints`: konfigurierbare Device-Management-, Build-&-Deploy-, MQTT- und HTTPS-Endpunkte.
