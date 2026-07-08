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

Das Provisioning Tool ist ein eigenstaendiges Factory-/Support-Werkzeug. Es ist nicht Teil der User IDE und wird nicht ueber die GerNetiX Plattform bedient. Der Nutzer kann in dieser separaten HMI eine Provisioning-Session vorbereiten, das einmalige Device-Secret fuer den laufenden Vorgang halten, Manifest, USB-Flash-Paket und Flash-Plan pruefen, die Firmware per USB flashen, die Provisioning-Kennung im Board speichern und die Provisionierung abschliessen. Beim Abschluss registriert das Tool das Device im Device Management Server.

Das Provisioning Tool flasht die Basissoftware fuer die physische Erstinbetriebnahme ausschliesslich ueber USB. Die Board-spezifische Kennung wird danach ueber den lokalen Device-Endpunkt `/provisioning` in den NVS-Speicher der Basissoftware geschrieben. Dadurch kann ein generisches, serverseitiges Firmware-Artefakt fuer mehrere Boards verwendet werden, ohne fuer jede Seriennummer neu zu bauen. Die Basissoftware darf im Serverbetrieb nicht aus der lokalen Projektumgebung gelesen werden. Stattdessen referenziert das Tool ein versioniertes Firmware-Artefakt aus SQLite/Artifact Store, z. B.:

```text
sqlite://provisioning_firmware_artifacts/firmware_artifact.esp32_basissoftware_factory.latest
```

Der Factory-Provisioning-Header mit dem einmaligen Secret wird nur in ein temporaeres Staging-Verzeichnis geschrieben, defaultmaessig:

```text
services/provisioning-tool/.runtime/factory-payload/generated_provisioning_payload.h
```

Die staged Basissoftware kann diesen Payload beim ersten Boot aus dem per USB geflashten Image in NVS importieren. Im normalen Factory-HMI-Ablauf wird die generische Firmware geflasht und die konkrete Session-Kennung anschliessend ueber `POST /provisioning` dauerhaft im Board gespeichert. Direkter Zugriff auf `basissoftware/esp32` ist kein Provisioning-Betriebsweg.

Die Factory-HMI darf keine Firmware-Dateien vom Bedienrechner hochladen. Sie zeigt nur die vom ProcessorBoard referenzierte Firmware an und flasht diese, wenn sie serverseitig im SQLite-/Artifact-Store materialisierbar ist. Firmware-Artefakte werden durch Build-/Admin-Prozesse oder beim Serverstart ueber einen konfigurierten Serverpfad bereitgestellt.

Der physische USB-Flash laeuft direkt im Browser per Web Serial und `esptool-js`. Der Server startet dafuer keinen lokalen Flash-Prozess. Er liefert nur das Firmware-Binary aus dem Artifact Store und speichert danach das Ergebnis, das die HMI meldet. Die Oberflaeche zeigt Progress Bar, aktuelle Phase und Logzeilen des Browser-Flashs.

Nach dem Flash startet das Board die Basissoftware und stellt den lokalen Device-Webserver bereit. Wenn der Bedienrechner mit einer Setup-AP-SSID verbunden ist, die mit `gernetix-` beginnt, ist der Endpunkt `http://192.168.4.1/provisioning`; der beliebige SSID-Suffix ist kein Hostname. Im normalen WLAN kann das Board z. B. ueber einen Hostnamen oder eine lokale IP erreichbar sein. Die HMI kann nach dem Board suchen oder per "Setup-AP verwenden" direkt die Setup-IP setzen. Danach sendet sie den Session-Payload inklusive `device_id`, `serial_number`, Credential-Referenz und einmaligem Device-Secret. Die Basissoftware speichert diese Daten im NVS-Namespace `prov`; `/status` zeigt danach `provisioningState=provisioned` und `serialNumber`.

## Einheitlicher Runtime-Vertrag

Das Provisioning Tool unterscheidet nicht zwischen Entwicklungs- und Deploybetrieb. Fuer den produktiven USB-Flash gelten auf jedem Zielsystem dieselben Voraussetzungen:

- Firmware-Artefakt liegt serverseitig im SQLite-/Artifact-Store oder wird beim Start aus einem Serverpfad registriert.
- Die HMI wird in einem Browser mit Web-Serial-Unterstuetzung geoeffnet.
- Der Bediener waehlt das angeschlossene USB-Serial-Geraet direkt im Browser aus.
- Der Browser schreibt die Firmware per `esptool-js` ueber USB auf das Board.
- Der Bediener laesst das Board booten, sucht oder setzt den lokalen Device-Endpunkt und schreibt die konkrete Provisioning-Kennung dauerhaft in NVS.

Es gibt keinen produktiven Umschalter zwischen Mock, serverseitigem Flash, Python, PlatformIO oder lokaler Projektumgebung.

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

Der Server muss fuer den Browser-USB-Flash mit SQLite-Persistenz und serverseitigem Firmware-Artefakt laufen, zum Beispiel:

```powershell
$env:PERSISTENCE_BACKEND="sqlite"
$env:PROVISIONING_SQLITE_PATH="C:\Users\sven_\Desktop\GerNetiX\.runtime\gernetix-services.sqlite"
npm run dev
```

Konfiguration erfolgt ueber Umgebungsvariablen:

- `HOST`: Bind-Adresse, Standard `127.0.0.1`
- `PORT`: HTTP-Port, Standard `4500`
- `PROVISIONING_RUNTIME_DIR`: Runtime-Verzeichnis fuer temporaere Artefakte
- `DEVICE_MANAGEMENT_BASE_URL`: Zielbasis fuer den spaeteren Device-Management-Register-Auftrag
- `HARDWARE_CATALOG_BASE_URL` oder `HARDWARE_SHOP_BASE_URL`: Hardware-Katalog-API, Standard `http://127.0.0.1:4900/api/hardware-shop`
- `PROVISIONING_FIRMWARE_ARTIFACT_ID`: Fallback-Artefakt-ID der Basissoftware, Standard `firmware_artifact.esp32_basissoftware_factory.latest`
- `PROVISIONING_FIRMWARE_ARTIFACT_SOURCE`: Artefaktquelle, Standard `sqlite`
- `PROVISIONING_FIRMWARE_ARTIFACT_URI`: URI des serverseitigen Artefakts, Standard `sqlite://provisioning_firmware_artifacts/{artifact_id}`
- `PROVISIONING_FIRMWARE_FILE_PATH`: optionaler Serverpfad zu einem vorbereiteten Firmware-Binary; wird beim Start als Artefakt in SQLite referenziert
- `PROVISIONING_GENERATED_HEADER_PATH`: Zielpfad fuer den generierten Factory-Provisioning-Header

## Sicherheitsregeln

- Secret-Material wird nicht dauerhaft gespeichert.
- Die Factory-HMI bietet keinen Firmware-Dateiupload und keinen manuellen Artefakt-Registrierbutton.
- Status- und Manifest-Endpunkte geben nur `credential_id`, `key_reference` und Hash-Metadaten aus.
- Das einmalige Device-Secret erscheint nur direkt in der Antwort auf `POST /api/provisioning-sessions` und im dort enthaltenen USB-Flash-Paket.
- Die Secret-Header-Datei wird nur geschrieben, wenn `flash.write_factory_header` ausdruecklich gesetzt ist, und standardmaessig nur unter `.runtime`.
- Ein Device kann im MVP nicht mehrfach mit aktivem Credential provisioniert werden.
- Ein aktives Credential kann in der Factory-HMI explizit zurueckgesetzt werden; der alte Vorgang bleibt mit Audit-Event nachvollziehbar.
- Flash-Ausfuehrung in der Factory-HMI laeuft ausschliesslich per Browser Web Serial. Der Server fuehrt keinen USB-Flash-Prozess aus.
- Die UI zeigt keinen Mock- oder Server-Flash-Modus.
- Der lokale Device-Webserver nimmt den Factory-Provisioning-Payload nur als expliziten HMI-Schritt an; das einmalige Device-Secret bleibt danach nur im Board-NVS und wird nicht ueber Status- oder Log-Endpunkte ausgegeben.

## Nicht-Ziele fuer diesen Stand

- keine produktive Authentifizierung
- keine produktive Rollen-/Rechteverwaltung fuer das Factory Tool
