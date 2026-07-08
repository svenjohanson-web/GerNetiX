# Build-&-Deploy-Server

Vorhaben fuer den GerNetiX Build-&-Deploy-Server.

Der Build-&-Deploy-Server fuehrt Build- und Deploy-Jobs aus. Er besitzt keine dauerhaften Projektdaten, sondern arbeitet mit vollstaendigen BuildPackages des Projektservers. Technische Caches sind erlaubt, aber niemals Quelle der Wahrheit.

## Zweck

- Firmware aus vollstaendigen Build-Paketen kompilieren
- Firmware fuer lokale MVP-Flows per USB auf ein angeschlossenes Board flashen
- Build-Logs und Status erzeugen
- Firmware-Artefakte, BuildResult und Deploy-Ergebnisse an den Projektserver zurueckgeben
- OTA-Deployments aus Nutzeraktion ausloesen
- Deploy-Auftraege per MQTT veroeffentlichen
- Firmware per HTTPS bereitstellen
- Statusmeldungen per MQTT empfangen
- technische Caches fuer schnellere Builds nutzen
- Nebenlaeufigkeit pro Device begrenzen

## BuildResult

Der Buildserver liefert mindestens zurueck:

- `firmware.bin`
- `firmware.elf`
- `firmware.hex` fuer AVR-/Atmel-Targets, wenn PlatformIO kein `firmware.bin` erzeugt
- `firmware.map`
- `build.log`
- Build-Status
- SHA-256
- Dateigroesse

## MVP-Implementierung

Der aktuelle MVP ist ein eigenstaendiger Node.js-Prozess ohne externe Runtime-Abhaengigkeiten.

Start:

```text
npm run dev
```

Standardadresse:

```text
http://127.0.0.1:4400
```

Konfiguration erfolgt ueber Umgebungsvariablen:

- `HOST`: Bind-Adresse, Standard `127.0.0.1`
- `PORT`: HTTP-Port, Standard `4400`
- `PUBLIC_BASE_URL`: externe Basis-URL fuer Artefakt-Downloads
- `BUILD_RUNNER`: `mock` oder `platformio`, Standard `mock`
- `PLATFORMIO_COMMAND`: PlatformIO-Kommando, Standard `platformio`
- `BUILD_DEPLOY_RUNTIME_DIR`: Runtime-Verzeichnis fuer temporaere Workspaces, Cache und Artefakte
- `BUILD_CACHE_DIR`: optionales Cache-Verzeichnis; `platformio-default` nutzt den PlatformIO-Standardcache
- `BUILD_ARTIFACT_DIR`: optionales temporaeres Artefakt-Verzeichnis

Der `mock` Runner erzeugt reproduzierbare Test-Artefakte ohne Toolchain. Fuer echte Firmware-Builds wird `BUILD_RUNNER=platformio` verwendet; dann kompiliert der Worker im uebergebenen BuildPackage per `platformio run`. Je nach Target kann das primaere Firmware-Artefakt `firmware.bin` (z. B. ESP32) oder `firmware.hex` (z. B. AVR/Arduino Uno) sein.

Fuer den lokalen USB-MVP unterstuetzt der Server den Modus `build_and_usb_flash`. Dann fuehrt der PlatformIO-Runner nach erfolgreichem Build `platformio run -t upload` aus. Ein optionaler Upload-Port wird ueber `usb_flash.upload_port` uebergeben, zum Beispiel `COM7`.

## Cache-Regel

Der Cache darf PlatformIO, Toolchains, Libraries, Objektdateien und vergleichbare technische Artefakte enthalten. Geht der Cache verloren, muss der Build aus dem Build-Paket weiterhin moeglich sein und dauert nur laenger.

## OTA-Regel

OTA wird ausschliesslich durch einen vom Nutzer ausgeloesten Build-&-Flash-Auftrag gestartet. Nach erfolgreichem Build uebernimmt der Build-&-Deploy-Server den Deploy.

Der Build-&-Deploy-Server:

- veroeffentlicht einen Deploy-Auftrag per MQTT
- stellt die Firmware per HTTPS bereit
- empfaengt Statusmeldungen per MQTT
- meldet den Abschluss an den Projektserver

Deploy-Auftraege werden nur fuer konkrete, bekannte und berechtigte `device_id`s erzeugt. Der Firmware-Download startet erst, wenn das Device einen autorisierten Deploy-Auftrag erhalten hat. Firmware-Dateien werden per HTTPS bereitgestellt und muessen vom Device anhand von Groesse und SHA-256 geprueft werden.

Der Build-&-Deploy-Server ist kein fachlicher Serverstandort im Sinne einer festen Instanzbindung. Ob er zuerst auf einem Linux-Homeserver und spaeter in einer Cloud-Umgebung laeuft, muss ueber konfigurierbare URLs, DNS und Deployment-Konfiguration geloest werden, nicht durch hart codierte Firmware-Adressen.

## MQTT

MQTT dient ausschliesslich fuer:

- Deploy-Auftraege
- Statusmeldungen
- Heartbeats
- Telemetrie

Beispiel-Topics:

```text
devices/{device_id}/deploy
devices/{device_id}/status
devices/{device_id}/heartbeat
```

## HTTPS

HTTPS dient fuer:

- Firmware-Download
- Artefaktuebertragung
- sichere Dateiuebertragung zwischen Build-&-Deploy-Server und Projektserver

## Nebenlaeufigkeit

- pro Device maximal ein aktiver Build-/Deploy-Job
- optional genau ein wartender Job pro Device
- neue wartende Jobs ersetzen aeltere wartende Jobs

## Module

- `firmware-build-job-runner`: Build-Ausfuehrung
- `build-cache`: technischer Cache
- `prebuild-scheduler`: Prebuild der Projekthuelle
- `deploy-job-orchestrator`: OTA-/Deploy-Auftraege
- `device-job-lock`: Nebenlaeufigkeit pro Device

## Nicht-Ziele fuer diesen Stand

- keine MQTT-Implementierung
- kein produktiver MQTT-Publisher
- keine produktive Authentifizierung
- keine Signierung von Firmware-Artefakten
- keine dauerhafte Projektdatenhaltung

## Deployment-Leitplanken

- Der Build-&-Deploy-Server bleibt als eigenstaendiger Worker-Prozess schneidbar.
- Build-Caches und temporaere Artefakte duerfen geloescht werden, ohne fachliche Daten zu verlieren.
- Toolchains, Cache-Verzeichnisse, MQTT-Broker, HTTPS-Basis-URL und Ports muessen konfigurierbar sein.
- Der erste Zielbetrieb darf ein Linux-Homeserver sein; spaeteres Cloud- oder Container-Deployment darf den BuildPackage-/BuildResult-Vertrag nicht brechen.
