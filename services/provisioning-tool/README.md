# Provisioning Tool

MVP fuer das GerNetiX Provisioning Tool.

Das Tool unterstuetzt die interne Erstinbetriebnahme von ProcessorBoards. Es erzeugt einen nachvollziehbaren Provisioning-Datensatz, bereitet Device-Credentials vor, waehlt ein ProcessorBoard aus dem Hardware-Katalog, leitet daraus das serverseitig gespeicherte Basissoftware-Firmware-Artefakt ab und beschreibt den Flash-Schritt als sicheren Plan. Es ist nicht die fachliche Quelle der Wahrheit fuer Device Management, sondern bereitet den Hersteller-Register-Auftrag vor.

## Zweck

- konkrete GerNetiX-Boards fuer das Hersteller-Register vorbereiten
- ProcessorBoard aus dem Hardware-Katalog auswaehlen
- Basissoftware-/Factory-Firmware-Artefakt aus dem ProcessorBoard ableiten
- Seriennummer, Hardwareprofil, Charge und Firmwarestand erfassen
- Device-ID und Credential-Referenz erzeugen
- genau ein aktives Credential pro Device erzwingen
- Secret-Material nur einmalig fuer den Provisioning-Vorgang ausgeben
- aktives Credential fuer abgebrochene oder fehlerhafte Factory-Provisioning-Vorgaenge kontrolliert zuruecksetzen
- USB-Flash-Paket mit Factory-Provisioning-Header fuer ein serverseitiges Basissoftware-Artefakt erzeugen
- Flash-Plan mit Recovery-Hinweisen erzeugen
- erfolgreich provisionierte Devices im Device Management registrieren
- Support- und Reklamationsnachvollziehbarkeit vorbereiten

## MVP-Implementierung

Start:

```text
npm run dev
```

Standardadresse:

```text
http://127.0.0.1:4500
```

Eigenstaendige Oberflaeche:

```text
http://127.0.0.1:4500/
```

Das Provisioning Tool ist ein eigenstaendiges Factory-/Support-Werkzeug. Es ist nicht Teil der User IDE und wird nicht ueber die GerNetiX Plattform bedient. Der Nutzer kann in dieser separaten HMI eine Provisioning-Session vorbereiten, das einmalige Device-Secret fuer den laufenden Vorgang halten, Manifest, USB-Flash-Paket und Flash-Plan pruefen, die Firmware per USB flashen und die Provisionierung abschliessen. Beim Abschluss registriert das Tool das Device im Device Management Server.

Das Provisioning Tool arbeitet fuer die physische Erstinbetriebnahme ausschliesslich ueber USB. Es schreibt keine Provisioning-Daten ueber den Setup-AP oder das lokale Device-Webinterface. Die Basissoftware darf im Serverbetrieb nicht aus der lokalen Projektumgebung gelesen werden. Stattdessen referenziert das Tool ein versioniertes Firmware-Artefakt aus SQLite/Artifact Store, z. B.:

```text
sqlite://provisioning_firmware_artifacts/firmware_artifact.esp32_basissoftware_factory.latest
```

Der Factory-Provisioning-Header mit dem einmaligen Secret wird nur in ein temporaeres Staging-Verzeichnis geschrieben, defaultmaessig:

```text
services/provisioning-tool/.runtime/factory-payload/generated_provisioning_payload.h
```

Die staged Basissoftware importiert diesen Payload beim ersten Boot aus dem per USB geflashten Image in NVS. Direkter Zugriff auf `basissoftware/esp32` ist kein Provisioning-Betriebsweg.

Die Factory-HMI darf keine Firmware-Dateien vom Bedienrechner hochladen. Sie zeigt nur die vom ProcessorBoard referenzierte Firmware an und flasht diese, wenn sie serverseitig im SQLite-/Artifact-Store materialisierbar ist. Firmware-Artefakte werden durch Build-/Admin-Prozesse oder beim Serverstart ueber einen konfigurierten Serverpfad bereitgestellt.

Der echte USB-Flash laeuft in der HMI als serverseitiger Flash-Job. Die Oberflaeche zeigt eine Progress Bar, aktuelle Phase und die letzten `esptool`-Logzeilen, damit der Bediener waehrend `Connecting`, `Writing`, `Verifying` und Reset Rueckmeldung bekommt.

## Einheitlicher Runtime-Vertrag

Das Provisioning Tool unterscheidet nicht zwischen Entwicklungs- und Deploybetrieb. Fuer echten USB-Flash muessen auf jedem Zielsystem dieselben Runtime-Voraussetzungen erfuellt sein:

- Firmware-Artefakt liegt serverseitig im SQLite-/Artifact-Store oder wird beim Start aus einem Serverpfad registriert.
- USB-Flash-Toolchain ist als Runtime-Artefakt im Manifest `.runtime/toolchains/provisioning/toolchain.json` beschrieben.
- Die HMI bietet echten Flash nur an, wenn `ALLOW_REAL_USB_FLASH=true`, das Firmware-Artefakt materialisierbar und die Toolchain-Dateien vorhanden sind.

Das Toolchain-Manifest wird nicht vom Server erraten. Es wird beim Einrichten der Installation erzeugt:

```powershell
$env:ESPTOOL_EXE="C:\pfad\zur\tool-esptoolpy\esptool.py"
$env:ESPTOOL_PYTHON_EXE="C:\pfad\zur\python.exe"
$env:PLATFORMIO_EXE="C:\pfad\zur\platformio.exe"
npm run prepare:toolchain
```

Wenn das Manifest fehlt oder auf nicht vorhandene Dateien zeigt, bleibt echter USB-Flash gesperrt und die API liefert den konkreten Readiness-Fehler.

## Firmware-Artefakt in SQLite bereitstellen

Nach einem neuen ESP32-Basissoftware-Build muss das Factory-Image serverseitig in den SQLite-/Artifact-Store uebernommen werden. Fuer den lokalen MVP wird das vorbereitete merged image aus

```text
.runtime/server-firmware/esp32-basissoftware/latest/merged-firmware.bin
```

mit folgendem Befehl in die gemeinsame SQLite-Datei geschrieben:

```powershell
npm run seed:esp32-firmware
```

Der Seed schreibt das Artefakt als `content_base64` in `provisioning_firmware_artifacts`, nicht als Bediener-Dateiupload. Das Provisioning Tool findet es danach unter:

```text
firmware_artifact.esp32_basissoftware_factory.latest
sqlite://provisioning_firmware_artifacts/firmware_artifact.esp32_basissoftware_factory.latest
```

Der Server muss fuer echten USB-Flash mit SQLite-Persistenz und Real-Flash-Freigabe laufen, zum Beispiel:

```powershell
$env:PERSISTENCE_BACKEND="sqlite"
$env:PROVISIONING_SQLITE_PATH="C:\Users\sven_\Desktop\GerNetiX\.runtime\gernetix-services.sqlite"
$env:ALLOW_REAL_USB_FLASH="true"
npm run dev
```

Konfiguration erfolgt ueber Umgebungsvariablen:

- `HOST`: Bind-Adresse, Standard `127.0.0.1`
- `PORT`: HTTP-Port, Standard `4500`
- `PROVISIONING_RUNTIME_DIR`: Runtime-Verzeichnis fuer temporaere Artefakte
- `DEVICE_MANAGEMENT_BASE_URL`: Zielbasis fuer den spaeteren Device-Management-Register-Auftrag
- `FLASH_RUNNER`: `mock`, `esptool` oder `platformio`, Standard `mock`
- `ALLOW_REAL_USB_FLASH`: echter USB-Flash per UI/API ist nur mit `true` erlaubt, Standard deaktiviert
- `HARDWARE_CATALOG_BASE_URL` oder `HARDWARE_SHOP_BASE_URL`: Hardware-Katalog-API, Standard `http://127.0.0.1:4900/api/hardware-shop`
- `PROVISIONING_FIRMWARE_ARTIFACT_ID`: Fallback-Artefakt-ID der Basissoftware, Standard `firmware_artifact.esp32_basissoftware_factory.latest`
- `PROVISIONING_FIRMWARE_ARTIFACT_SOURCE`: Artefaktquelle, Standard `sqlite`
- `PROVISIONING_FIRMWARE_ARTIFACT_URI`: URI des serverseitigen Artefakts, Standard `sqlite://provisioning_firmware_artifacts/{artifact_id}`
- `PROVISIONING_FIRMWARE_FILE_PATH`: optionaler Serverpfad zu einem vorbereiteten Firmware-Binary; wird beim Start als Artefakt in SQLite referenziert
- `PROVISIONING_FIRMWARE_STAGING_PATH`: temporaerer Staging-Pfad fuer PlatformIO-USB-Flash
- `PROVISIONING_FIRMWARE_ROOT`: temporaerer Firmware-Staging-Root fuer PlatformIO-USB-Flash
- `PROVISIONING_TOOLCHAIN_ROOT`: Runtime-Verzeichnis fuer den USB-Flash-Toolchain-Vertrag, Standard `.runtime/toolchains/provisioning`
- `PROVISIONING_TOOLCHAIN_MANIFEST`: Pfad zum Toolchain-Manifest, Standard `{PROVISIONING_TOOLCHAIN_ROOT}/toolchain.json`
- `PLATFORMIO_EXE`: PlatformIO-Executable fuer das Toolchain-Manifest oder explizite Betriebsueberschreibung
- `ESPTOOL_EXE`: esptool-Executable fuer das Toolchain-Manifest oder explizite Betriebsueberschreibung
- `ESPTOOL_PYTHON_EXE`: Python-Executable, wenn `ESPTOOL_EXE` auf eine `.py`-Datei zeigt
- `PROVISIONING_FLASH_TIMEOUT_MS`: hartes Timeout fuer PlatformIO-USB-Flash, Standard `180000`
- `PROVISIONING_GENERATED_HEADER_PATH`: Zielpfad fuer den generierten Factory-Provisioning-Header

## Sicherheitsregeln

- Secret-Material wird nicht dauerhaft gespeichert.
- Die Factory-HMI bietet keinen Firmware-Dateiupload und keinen manuellen Artefakt-Registrierbutton.
- Status- und Manifest-Endpunkte geben nur `credential_id`, `key_reference` und Hash-Metadaten aus.
- Das einmalige Device-Secret erscheint nur direkt in der Antwort auf `POST /api/provisioning-sessions` und im dort enthaltenen USB-Flash-Paket.
- Die Secret-Header-Datei wird nur geschrieben, wenn `flash.write_factory_header` ausdruecklich gesetzt ist, und standardmaessig nur unter `.runtime`.
- Ein Device kann im MVP nicht mehrfach mit aktivem Credential provisioniert werden.
- Ein aktives Credential kann in der Factory-HMI explizit zurueckgesetzt werden; der alte Vorgang bleibt mit Audit-Event nachvollziehbar.
- Flash-Ausfuehrung ist standardmaessig ein sicherer Mock. Echter USB-Flash wird nur mit `ALLOW_REAL_USB_FLASH=true`, einem registrierten serverseitigen Firmware-Artefakt und einem gueltigen Toolchain-Manifest gestartet.
- Die UI zeigt beide Flash-Modi. "Echter USB-Flash" ist nur auswaehlbar, wenn Freigabe, Firmware-Artefakt und Toolchain-Readiness zusammenpassen.
- Kein Hersteller-Provisioning ueber WLAN, Setup-AP oder lokales Device-Webinterface.

## Nicht-Ziele fuer diesen Stand

- keine echte USB-Erkennung
- keine automatische USB-Erkennung vor dem Flash; der Port muss angegeben werden
- keine produktive Authentifizierung
- keine produktive Rollen-/Rechteverwaltung fuer das Factory Tool
