# Provisioning Tool

MVP fuer das GerNetiX Provisioning Tool.

Das Tool unterstuetzt die interne Erstinbetriebnahme von ProcessorBoards und die Register-/Pairing-Vorbereitung kaufbarer GerNetiX-Flashboxen. Es erzeugt einen nachvollziehbaren Provisioning-Datensatz, bereitet Device-Credentials vor, waehlt das Ziel aus dem Hardware-Katalog, leitet fuer ProcessorBoards das serverseitig gespeicherte Basissoftware-Firmware-Artefakt ab und beschreibt den Flash-Schritt als sicheren Plan. Es ist nicht die fachliche Quelle der Wahrheit fuer Device Management, sondern bereitet den Hersteller-Register-Auftrag vor.

## Zweck

- konkrete GerNetiX-Boards fuer das Hersteller-Register vorbereiten
- ProcessorBoard aus dem Hardware-Katalog auswaehlen
- GerNetiX-Flashbox als eigene kaufbare Hardwareklasse auswaehlen
- Basissoftware-/Factory-Firmware-Artefakt aus dem ProcessorBoard ableiten
- Seriennummer, Hardwareprofil, Charge und Firmwarestand erfassen
- Device-ID und Credential-Referenz erzeugen
- genau ein aktives Credential pro Device erzwingen
- Secret-Material nur einmalig fuer den Provisioning-Vorgang ausgeben
- aktives Credential fuer abgebrochene oder fehlerhafte Factory-Provisioning-Vorgaenge kontrolliert zuruecksetzen
- USB-Flash-Paket mit Factory-Provisioning-Header fuer ein serverseitiges Basissoftware-Artefakt erzeugen
- Flash-Plan mit Recovery-Hinweisen erzeugen
- erfolgreich provisionierte Devices im Device Management registrieren
- Flashboxen als kaufbare, claimbare Inventar-Geraete vorbereiten, ohne einen Selbstbau-Pfad anzubieten
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

Das Provisioning Tool ist ein eigenstaendiges Factory-/Support-Werkzeug. Es bereitet Manifest und USB-Flash vor, laesst den ESP32 sein P-256-Schluesselpaar lokal erzeugen, stellt fuer dessen Public Key ein mTLS-Client-Zertifikat aus und prueft den Schluesselbesitz per signierter Challenge. Beim Abschluss registriert es nur Public Key und Zertifikatsmetadaten im Device Management Server.

Das Provisioning Tool flasht die Basissoftware fuer die physische Erstinbetriebnahme ausschliesslich ueber USB. Die Board-spezifische Kennung wird danach ueber den lokalen Device-Endpunkt `/provisioning` in den NVS-Speicher der Basissoftware geschrieben. Dadurch kann ein generisches, serverseitiges Firmware-Artefakt fuer mehrere Boards verwendet werden, ohne fuer jede Seriennummer neu zu bauen. Die Basissoftware darf im Serverbetrieb nicht aus der lokalen Projektumgebung gelesen werden. Stattdessen referenziert das Tool ein versioniertes Firmware-Artefakt aus SQLite/Artifact Store, z. B.:

```text
sqlite://provisioning_firmware_artifacts/firmware_artifact.esp32_basissoftware_factory.latest
```

Der optionale Factory-Provisioning-Header enthaelt nur nicht geheime Identitaets- und Trust-Metadaten und wird in ein temporaeres Staging-Verzeichnis geschrieben, defaultmaessig:

```text
services/provisioning-tool/.runtime/factory-payload/generated_provisioning_payload.h
```

Die staged Basissoftware kann diesen Payload beim ersten Boot importieren. Im normalen Factory-HMI-Ablauf wird die generische Firmware geflasht und die konkrete Session-Kennung anschliessend ueber `POST /provisioning` gespeichert; der private Device-Schluessel entsteht erst auf dem Board.

Die Factory-HMI darf keine Firmware-Dateien vom Bedienrechner hochladen. Sie zeigt nur die vom ProcessorBoard referenzierte Firmware an und flasht diese, wenn sie serverseitig im SQLite-/Artifact-Store materialisierbar ist. Firmware-Artefakte werden durch Build-/Admin-Prozesse oder beim Serverstart ueber einen konfigurierten Serverpfad bereitgestellt.

Der physische USB-Flash laeuft direkt im Browser per Web Serial und `esptool-js`. Der Server startet dafuer keinen lokalen Flash-Prozess. Er liefert nur das Firmware-Binary aus dem Artifact Store und speichert danach das Ergebnis, das die HMI meldet. Die Oberflaeche zeigt Progress Bar, aktuelle Phase und Logzeilen des Browser-Flashs.

Nach dem Flash startet das Board den lokalen Device-Webserver. Die HMI sendet Identitaet und Trust-Anker, empfaengt den Board-Public-Key, laesst ihn durch die konfigurierte Device-CA zertifizieren, schreibt das Client-Zertifikat zurueck und fordert anschließend eine signierte Besitz-Challenge an.

## Flashbox-Register/Pairing im Tool

Die HMI unterscheidet im ersten Schritt zwischen `ESP32 / Zielboard` und `GerNetiX Flashbox`.

Bei `ESP32 / Zielboard` bleibt der bisherige Ablauf aktiv: ProcessorBoard waehlen, Firmware-Artefakt pruefen, per Browser-Web-Serial flashen, Kennung auf dem Board speichern und Session abschliessen.

Bei `GerNetiX Flashbox` wird eine konkrete Flashbox-Produktklasse aus dem Hardware Catalog gewaehlt. Die Session enthaelt `hardware_class = flashbox`, `flashbox_id`, Seriennummer, Purchase-/Inventory-Policy und Flashbox-Capabilities wie `flashbox.self_update`, `flashbox.usb_otg_host` und `flashbox.target_flash`. Die UI bietet keinen Weg an, eine selbst gebaute Flashbox als GerNetiX-Flashbox anzulegen. Ist der Flashbox-Modus gewaehlt, ist der Zielboard-Web-Serial-Flash deaktiviert; der Schritt dient zunaechst Register, Pairing und spaeterem Inventory-Claim.

Die Flashbox-Firmware selbst ist ein eigenes Firmwarepaket mit eigener Update- und Recovery-Strategie. Sie wird nicht still ueber den bestehenden Basissoftware-Flashpfad behandelt. Der Hardware Catalog muss fuer Flashboxen ein `factory_firmware_artifact` liefern; im lokalen Fallback ist das `firmware_artifact.flashbox_factory.latest` mit `source = public_signed_manifest`.

Der Kopierschutz-/Echtheitsvertrag ist asymmetrisch:

- der Device Private Key liegt auf der Flashbox und wird nicht exportiert,
- das Provisioning Tool und Device Management arbeiten nur mit Public Key, Zertifikat/Fingerprint und Seriennummer,
- eine per WLAN sichtbare Flashbox wird erst nach `wlan_visible_challenge` und `challenge_signature` als echt akzeptiert,
- ein Kauf-/Claim-Code bleibt Fallback und ersetzt nicht den kryptographischen Nachweis, wenn die Flashbox erreichbar ist,
- das Flashbox-Factory-Manifest referenziert den GerNetiX Release Public Key, aber enthaelt keine privaten GerNetiX-Schluessel.

## Admin-Tool-Abgrenzung

Das Provisioning Tool bleibt in diesem Stand ein eigenes privates Factory-/Support-Werkzeug. Das Admin Tool verlinkt es, integriert aber den Ablauf noch nicht nativ. Eine spaetere Integration ins Admin Tool ist sinnvoll, sobald Berechtigungen, Audit, Claim-Code-Verwaltung und Device-/Inventory-Sichten gemeinsam entschieden sind.

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
- `DEVICE_CA_CERTIFICATE_PATH`: PEM-Zertifikat der Device-Issuing-CA
- `DEVICE_CA_PRIVATE_KEY_PATH`: privater PEM-Schluessel der Device-Issuing-CA; nur fuer den Provisioning-Prozess lesbar
- `OPENSSL_COMMAND`: OpenSSL-Executable fuer die Zertifikatsausstellung; im Service-Container enthalten, unter Windows bei Bedarf als absoluter Pfad setzen
- `DEVICE_CERTIFICATE_VALIDITY_DAYS`: Gueltigkeit neu ausgestellter Client-Zertifikate, Standard 365 Tage
- `OTA_SIGNING_PUBLIC_KEY_PATH`: Public Key des OTA-Signers, der auf das Board geschrieben wird
- `OTA_SIGNING_KEY_ID`: stabile Kennung des aktiven OTA-Signierschluessels

## Sicherheitsregeln

- Private Device-Schluessel werden auf dem ESP32 erzeugt und verlassen das Board nicht.
- Die Factory-HMI bietet keinen Firmware-Dateiupload und keinen manuellen Artefakt-Registrierbutton.
- Status- und Manifest-Endpunkte geben nur Credential-, Public-Key-Fingerprint- und Zertifikatsmetadaten aus.
- USB-Flash-Paket und Factory-Header enthalten weder Shared Secret noch privaten Device- oder OTA-Schluessel.
- Ein Device kann im MVP nicht mehrfach mit aktivem Credential provisioniert werden.
- Ein aktives Credential kann in der Factory-HMI explizit zurueckgesetzt werden; der alte Vorgang bleibt mit Audit-Event nachvollziehbar.
- Flash-Ausfuehrung in der Factory-HMI laeuft ausschliesslich per Browser Web Serial. Der Server fuehrt keinen USB-Flash-Prozess aus.
- Die UI zeigt keinen Mock- oder Server-Flash-Modus.
- Der lokale Device-Webserver nimmt den Factory-Provisioning-Payload nur als expliziten HMI-Schritt an; private Schluessel werden nicht ueber Status- oder Log-Endpunkte ausgegeben.

## Nicht-Ziele fuer diesen Stand

- keine produktive Authentifizierung
- keine produktive Rollen-/Rechteverwaltung fuer das Factory Tool
