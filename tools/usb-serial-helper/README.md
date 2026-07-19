# GerNetiX Serial Service

Der GerNetiX Serial Service ist die lokale USB-Systemintegration der
GerNetiX-Plattform. Er besitzt keine eigene Benutzeroberflaeche. Board-Erkennung,
USB-Flash, lokale serielle Provisionierung und Fortschritt bleiben vollständig
in der GerNetiX-Weboberfläche.

## Laufzeit

- macOS auf Apple Silicon: benutzerbezogener `launchd`-Agent
- lokaler Endpunkt: `https://localhost:43123` auf der Bind-Adresse `127.0.0.1`
- nativer, UI-loser Swift-Dienst auf Basis der macOS-Systemframeworks
- serieller Zugriff direkt über die macOS-POSIX-Schnittstelle
- Board-Erkennung und ESP32-Flash über das mitgelieferte native `espflash`
- keine Electron-, Chromium-, Node.js- oder Browser-Laufzeit im Kundenpaket
- keine dauerhafte Ablage von Firmware, WLAN-Zugangsdaten oder Projektdaten

Die API bindet ausschließlich an Loopback. Das macOS-Paket erzeugt pro
Installation ein nur fuer `localhost` und `127.0.0.1` gueltiges TLS-Zertifikat
mit eigenem privaten Schluessel und traegt genau dieses Zertifikat in den
System-Trust-Store ein. Damit kann auch Safari die lokale Verbindung aus der
oeffentlichen HTTPS-Plattform aufbauen. Die API akzeptiert nur explizit
freigegebene GerNetiX-Origins, prüft den Host-Header und verlangt nach einem
Origin-gebundenen Handshake für alle USB-Aktionen. Kurzlebige Firmwaredateien
bleiben im Arbeitsspeicher des Dienstes.

Die feste Origin-Liste deckt die produktiven GerNetiX-Domains, die lokale
Entwicklung auf Port `4300` und den dokumentierten VPS-Staging-Tunnel auf Port
`14300` ab. Weitere Entwicklungs-Origins koennen beim manuellen Start ueber
`GERNETIX_PLATFORM_ORIGINS` gesetzt werden; das Kundenpaket erweitert seine
Allowlist nicht dynamisch aus Webseiteninhalten.

## Entwicklung

Voraussetzungen sind die Apple Command Line Tools, Node.js für die Buildskripte
und ein lokales `espflash`:

```bash
brew install espflash
pnpm install
pnpm test
pnpm start
```

`pnpm start` kompiliert den Swift-Dienst, bettet `espflash` samt MIT- und
Apache-2.0-Lizenzdateien ein und startet nur den Hintergrunddienst. Es wird kein
Fenster geöffnet. Alternativ kann ein geprüftes Binary mit
`GERNETIX_ESPFLASH_BINARY` und sein Lizenzordner mit
`GERNETIX_ESPFLASH_LICENSE_DIR` vorgegeben werden.

## macOS-Paket

```bash
pnpm dist:mac
```

Der Build erzeugt
`dist/GerNetiX-Serial-Service-mac-arm64.pkg`. Das Paket installiert die
unsichtbare Anwendung unter `/Applications` und den LaunchAgent unter
`/Library/LaunchAgents`. Der Postinstall-Schritt startet den Dienst für den
aktuell angemeldeten Benutzer unmittelbar. Das native Testpaket ist etwa
`7,5 MiB` groß; seine Größe hängt geringfügig von der eingebetteten
`espflash`-Version ab.

Ein Release-Build wird mit `GERNETIX_RELEASE_BUILD=1` ausgeführt. Die
`Developer ID Application`-Identitaet fuer die Anwendung muss im macOS-Keychain
verfuegbar und ueber `CSC_NAME` benannt sein;
`GERNETIX_MAC_INSTALLER_IDENTITY` benennt zusaetzlich die
`Developer ID Installer`-Identitaet fuer das Paket. Das resultierende Paket muss
mit einem gesetzten `GERNETIX_NOTARY_PROFILE` anschließend durch Apples Notary
Service geprüft und das Ticket angeheftet werden.
Ein nicht signiertes oder nicht notarisiertes lokales Paket ist kein
freigegebenes Kundenartefakt.

## Veröffentlichung im GerNetiX-Downloadbereich

Das fertige Kundenpaket wird nicht auf einer fremden Downloadplattform
abgelegt. Es wird mit `tools/publish-platform-download.js` als
unveraenderlicher Release in der getrennten Plattform-Download-SQLite des bestehenden VPS
veroeffentlicht. Version, Plattform, Architektur, Dateigroesse und SHA-256
bleiben dort zusammen mit dem Paket erhalten. Der angemeldete Downloadbereich
und die IDE-Hinweise verwenden diesen Release direkt.

Lokale Veröffentlichung zum Prüfen:

```bash
node tools/publish-platform-download.js \
  --file tools/usb-serial-helper/dist/GerNetiX-Serial-Service-mac-arm64.pkg \
  --id serial-service \
  --version 0.3.3 \
  --platform macos \
  --architecture arm64 \
  --label "Für macOS" \
  --detail "Installationspaket · Apple Silicon" \
  --content-type application/vnd.apple.installer+xml
```

Für den VPS wird dasselbe Werkzeug im Identity-Container ausgeführt. Der
Paketinhalt kann über die Standardeingabe direkt in SQLite geschrieben werden;
eine lose Datei auf dem Server ist nicht die dauerhafte Quelle der Wahrheit.
Nur signierte, notarisierte und bereits angeheftete Pakete dürfen auf diese
Weise veröffentlicht werden.
