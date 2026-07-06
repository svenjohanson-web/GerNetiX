# Provisioning Tool

MVP fuer das GerNetiX Provisioning Tool.

Das Tool unterstuetzt die interne Erstinbetriebnahme von ProcessorBoards. Es erzeugt einen nachvollziehbaren Provisioning-Datensatz, bereitet Device-Credentials vor, erzeugt ein Device-Manifest fuer Initial-Firmware und beschreibt den Flash-Schritt als sicheren Plan. Es ist nicht die fachliche Quelle der Wahrheit fuer Device Management, sondern bereitet den Hersteller-Register-Auftrag vor.

## Zweck

- konkrete GerNetiX-Boards fuer das Hersteller-Register vorbereiten
- Seriennummer, Hardwareprofil, Charge und Firmwarestand erfassen
- Device-ID und Credential-Referenz erzeugen
- genau ein aktives Credential pro Device erzwingen
- Secret-Material nur einmalig fuer den Provisioning-Vorgang ausgeben
- Provisioning-Manifest fuer Initial-Firmware erzeugen
- Flash-Plan mit Recovery-Hinweisen erzeugen
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

Konfiguration erfolgt ueber Umgebungsvariablen:

- `HOST`: Bind-Adresse, Standard `127.0.0.1`
- `PORT`: HTTP-Port, Standard `4500`
- `PROVISIONING_RUNTIME_DIR`: Runtime-Verzeichnis fuer temporaere Artefakte
- `DEVICE_MANAGEMENT_BASE_URL`: Zielbasis fuer den spaeteren Device-Management-Register-Auftrag
- `FLASH_RUNNER`: `mock` oder spaeter produktiver USB-Runner, Standard `mock`

## Sicherheitsregeln

- Secret-Material wird nicht dauerhaft gespeichert.
- Status- und Manifest-Endpunkte geben nur `credential_id`, `key_reference` und Hash-Metadaten aus.
- Das einmalige Device-Secret erscheint nur direkt in der Antwort auf `POST /api/provisioning-sessions`.
- Ein Device kann im MVP nicht mehrfach mit aktivem Credential provisioniert werden.
- Flash-Ausfuehrung ist im MVP ein sicherer Plan/Stub und kein echter USB-Flash.

## Nicht-Ziele fuer diesen Stand

- keine echte USB-Erkennung
- keine echte PlatformIO-/esptool-Flash-Ausfuehrung
- keine produktive Authentifizierung
- keine direkte Device-Management-Schreibintegration
- keine dauerhafte Datenbank
