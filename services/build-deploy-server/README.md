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
- `BUILD_ARTIFACT_SQLITE_PATH`: fuehrende SQLite fuer Firmware-, ELF-, HEX-, Map- und Log-BLOBs; auf dem VPS `/var/lib/gernetix/build/gernetix-build-artifacts.sqlite`
- `MQTT_BROKER_URL`: MQTT-Broker-URL fuer OTA-Deploy-Commands und Status, lokal z. B. `mqtt://127.0.0.1:1883`
- `BUILD_CANCELLATION_POLL_MS`: Intervall, in dem ein Worker zentrale Abbruchanforderungen prueft; Standard `500`

Der `mock` Runner erzeugt reproduzierbare Test-Artefakte ohne Toolchain. Fuer echte Firmware-Builds wird `BUILD_RUNNER=platformio` verwendet; dann kompiliert der Worker im uebergebenen BuildPackage per `platformio run`. Je nach Target kann das primaere Firmware-Artefakt `firmware.bin` (z. B. ESP32) oder `firmware.hex` (z. B. AVR/Arduino Uno) sein.

Der Build-Workspace und seine Ausgabedateien sind temporaer. Nach dem Build uebernimmt der Artifact Store die Ergebnisse transaktional als SQL-BLOBs samt MIME-Type, Groesse und SHA-256. Downloads lesen aus dieser SQLite; ein loses Artefaktverzeichnis ist keine dauerhafte Quelle der Wahrheit.

Fuer den lokalen USB-MVP unterstuetzt der Server den Modus `build_and_usb_flash`. Dann fuehrt der PlatformIO-Runner nach erfolgreichem Build `platformio run -t upload` aus. Ein optionaler Upload-Port wird ueber `usb_flash.upload_port` uebergeben, zum Beispiel `COM7`.

## Headless Flashbox-Buildkette

Der headless Client `tools/submit-flashbox-build-job.js` prueft die vollstaendige serverseitige Kette ohne UI: Er legt das versionierte Flashbox-Projekt im Project Server an, uebergibt den daraus erzeugten BuildPackage-Snapshot an den Build-&-Deploy-Server und schreibt Status sowie Artefakte zurueck in die Projekt-Build-Historie.

Im VPS-Checkout wird er innerhalb des privaten Compose-Netzes gestartet:

```text
docker compose --env-file .env.vps -f compose.vps.yaml exec project-server node /app/tools/submit-flashbox-build-job.js
```

Der Aufruf nutzt den im Buildserver-Container konfigurierten echten Runner (`/opt/platformio/bin/platformio`); eine lokale PlatformIO-Installation des aufrufenden Rechners wird nicht verwendet. Der Test legt den technischen Projekt-Datensatz `system-flashbox-build-verification` und einen neuen BuildJob in der Projekt-SQLite an.

Fuer einen lokalen, isolierten Docker-Test ohne VPS-Secrets steht `compose.flashbox-build-test.yaml` bereit. Aus dem Projektstamm zuerst die beiden Testcontainer bauen und starten:

```text
docker compose -f compose.flashbox-build-test.yaml up -d --build
```

Danach denselben Headless-Job im Project-Server-Container starten:

```text
docker compose -f compose.flashbox-build-test.yaml exec project-server node /app/tools/submit-flashbox-build-job.js
```

Der lokale Test legt nur die Docker-Volumes `flashbox_project_state` und `flashbox_build_state` an. Beide sind technische Testdaten und enthalten keine fachliche Quelle der Wahrheit.

Die Testcontainer verwenden bewusst eigene, kleine Dockerfiles. Der Buildkontext enthaelt nur Project Server, Buildserver, Flashbox-Quellen und den gemeinsamen Runtime-Kern; die Basissoftware, Demos und sonstigen Dienste werden nicht uebertragen.

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
gernetix/devices/{device_id}/ota
gernetix/devices/{device_id}/status/deployment
gernetix/devices/{device_id}/status/heartbeat
```

Die lokale Broker-Infrastruktur liegt unter:

```text
infra/dev/docker-compose.yml
```

Start lokal:

```text
docker compose -f infra/dev/docker-compose.yml up -d mqtt-broker
```

Der lokale Dev-Broker nutzt Mosquitto auf `127.0.0.1:1883` und MQTT over WebSocket auf `127.0.0.1:9001`. Der VPS-Broker verlangt fuer ESP32-Devices auf `mqtts://mqtt.gernetix.com:8883` ein Device-Client-Zertifikat und geraetespezifische ACLs. Der Build-&-Deploy-Server publiziert im VPS-Docker-Netz ueber den internen Listener, signiert jeden kanonischen OTA-Auftrag mit dem separaten P-256-OTA-Private-Key und verfolgt Board-Statusmeldungen unter `gernetix/devices/{device_id}/status/deployment`. Vor einem OTA-Build prueft `/api/ota/preflight` gemeinsam die oeffentliche HTTPS-Artefaktadresse, MQTT-Publisher, ECDSA-Signer und Device-Bestaetigung.

## HTTPS

HTTPS dient fuer:

- Firmware-Download
- Artefaktuebertragung
- sichere Dateiuebertragung zwischen Build-&-Deploy-Server und Projektserver

## Nebenlaeufigkeit

- pro Projekt, Software-Einheit und Zielgeraet maximal ein aktiver Build; weitere Auftraege desselben Build-Ziels warten geordnet
- unterschiedliche Build-Ziele bleiben parallel ausfuehrbar
- jeder BuildJob schreibt Firmware- und Linker-Ausgaben in einen ausschließlich über seine eindeutige BuildJob-ID adressierten Ordner
- pro Device maximal ein aktiver Build-/Deploy-Job
- optional genau ein wartender Job pro Device
- neue wartende Jobs ersetzen aeltere wartende Jobs
- `POST /api/build-jobs/{job_id}/cancel` setzt einen aktiven Auftrag zentral auf `cancelling`; der zustaendige Worker beendet den Compiler-Prozessbaum und persistiert danach `cancelled`
- der Endpunkt ist idempotent fuer bereits abgeschlossene Auftraege und funktioniert ueber die gemeinsame PostgreSQL-Koordination auch workeruebergreifend

## Module

- `firmware-build-job-runner`: Build-Ausfuehrung
- `build-cache`: technischer Cache
- `prebuild-scheduler`: Prebuild der Projekthuelle
- `deploy-job-orchestrator`: OTA-/Deploy-Auftraege
- `device-job-lock`: Nebenlaeufigkeit pro Device
- `build-target-lock`: exklusiver Zugriff auf den inkrementellen Workspace und ESP-IDF-Komponentencache eines Build-Ziels
- `postgres-build-coordination`: rechneruebergreifende Job-Eindeutigkeit, Statussicht, Abbruchanforderungen, Advisory Locks, Worker-Identitaet und Cache-Generationen

Im VPS- und Mehrrechnerbetrieb ist `BUILD_COORDINATION_BACKEND=postgres` verbindlich. `BUILD_WORKER_ID` kann fuer einen Rechner stabil gesetzt werden; ohne Vorgabe wird der Hostname verwendet. Der Memory-Modus ist ausschliesslich fuer Tests und eine einzelne lokale Entwicklungsinstanz vorgesehen.

Worker senden standardmaessig alle 15 Sekunden einen Heartbeat. Nach zwei Minuten ohne Heartbeat gelten noch aktive Jobs dieses Workers als `failed/worker_lost`. Beide Intervalle sind ueber `BUILD_WORKER_HEARTBEAT_MS` und `BUILD_WORKER_STALE_MS` konfigurierbar.

Ein installationsfaehiger, bewusst auf reine Builds begrenzter Linux-Worker liegt in `compose.build-worker.yaml`. Einrichtung, WireGuard-Grenzen und Bedienbefehle beschreibt [Linux Build-Worker](../../docs/linux-build-worker.md). Der interne VPS-Build-Router verteilt nur `build` und `prebuild`; OTA, FlashBox und USB bleiben direkt auf dem zentralen Worker.

## Nicht-Ziele fuer diesen Stand

- kein produktiv angebundener MQTT-Publisher im Build-&-Deploy-Server
- keine produktive Authentifizierung
- keine Signierung von Firmware-Artefakten
- keine dauerhafte Projektdatenhaltung

## Deployment-Leitplanken

- Der Build-&-Deploy-Server bleibt als eigenstaendiger Worker-Prozess schneidbar.
- Build-Caches und temporaere Artefakte duerfen geloescht werden, ohne fachliche Daten zu verlieren.
- Toolchains, Cache-Verzeichnisse, MQTT-Broker, HTTPS-Basis-URL und Ports muessen konfigurierbar sein.
- Der erste Zielbetrieb darf ein Linux-Homeserver sein; spaeteres Cloud- oder Container-Deployment darf den BuildPackage-/BuildResult-Vertrag nicht brechen.
