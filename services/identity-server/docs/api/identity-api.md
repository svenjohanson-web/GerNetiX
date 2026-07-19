# Identity API

Service-Kontrakt fuer Identity und Passkey-Authentifizierung.

## Passkey HTTP API

- `POST /api/passkeys/registration/options`
- `POST /api/passkeys/registration/verify`
- `POST /api/passkeys/authentication/options`
- `POST /api/passkeys/authentication/verify`
- `POST /api/passkeys/client-error`

Der Client-Fehlerendpunkt nimmt ausschliesslich den Ablauf (`authentication` oder `registration`) und einen serverseitig allowlist-validierten DOMException-Namen entgegen. Fehlermeldung, Credential-ID, Challenge, Public Key, Signatur und Credential-Payload werden nicht uebermittelt. Lokale Browseraufrufe unter `127.0.0.1` werden fuer WebAuthn auf `localhost` kanonisiert, weil eine IP-Adresse keine gueltige WebAuthn-RP-ID ist.

## GerNetiX Serial Service

- `GET /api/platform/downloads` liefert nur in einer angemeldeten Sitzung die verfuegbaren Systemintegrationen.
- `GET /downloads/usb-serial-helper/GerNetiX-Serial-Service-mac-arm64.pkg` streamt das macOS-Paket ebenfalls nur mit gueltiger Sitzung.

Auf dem VPS wird das macOS-Paket nicht im Linux-Container gebaut. Ein signiertes und notarisiertes Paket wird als unveraenderlicher Release mit Version, Plattform, Architektur, Groesse und SHA-256 in der getrennten, persistenten Plattform-Download-SQLite veroeffentlicht. Identity liefert diesen Release im bereits vorhandenen angemeldeten Downloadbereich aus; es gibt keine externe Release-URL. `PLATFORM_DOWNLOAD_SQLITE_PATH` zeigt im VPS auf `/var/lib/gernetix/identity/gernetix-platform-downloads.sqlite`. In der lokalen Entwicklung hat ein vorhandenes Paket unter `tools/usb-serial-helper/dist` Vorrang.

Nach der Installation spricht das vom VPS gelieferte Plattform-Frontend den Dienst per TLS auf `https://localhost:43123` an. Der VPS liefert Firmware und Flash-Manifeste an den Browser, erhaelt aber keinen Zugriff auf den lokalen USB-Port. WLAN-Zugangsdaten laufen ausschliesslich zwischen Browser, lokalem Serial Service und Board.

## Hardware-Katalog im Provisioning

- `GET /api/platform/hardware/processor-boards` liefert die aktuellen ProcessorBoards ausschliesslich aus dem Hardware Catalog.
- Ist der Hardware Catalog nicht erreichbar, antwortet Identity mit `502`, `error: hardware_catalog_unreachable` und `message: Hardware-Katalog nicht erreichbar.`

Identity besitzt fuer diesen Ablauf weder einen eingebetteten Katalog-Seed noch einen Browser-Fallback. Vor jeder automatischen USB-Suche werden sowohl die ProcessorBoards als auch die fuer die Konfiguration erforderlichen Boardausstattungsoptionen frisch abgefragt. Fehlt einer dieser Teile oder ist der Katalog nur teilweise beziehungsweise in einer veralteten Version erreichbar, entstehen keine Boardkandidaten und der Provisionierungsvorgang stoppt mit der Fehlermeldung.

## AuthService

- `register_local(username, email, password, accepted_terms, password_repeat)`
- `verify_email(token)`
- `login_local(identifier, password)`
- `login_external(provider, provider_token_or_mock_payload)`
- `logout(session_id_or_token)`
- `request_password_reset(email)`
- `reset_password(token, new_password)`

## Provider

Provider implementieren:

- `authenticate(provider_token_or_mock_payload)`

Mock-Provider:

- `MockGoogleProvider`
- `MockAppleProvider`
- `MockMicrosoftProvider`
- `MockGitHubProvider`

## EmailService

- `send_verification_email(email, verification_link)`
- `send_password_reset_email(email, reset_link)`

`MockEmailService` versendet keine echte E-Mail und schreibt Links in Logs/Testausgabe.
