# Device Management API

Initialer MVP-Implementierungskontrakt.

## Prefix

```text
/api/device-management
```

## Device Registry

```text
POST /devices/register
POST /devices/{deviceId}/heartbeat
GET  /devices/{deviceId}/status
```

Zweck:

- Device meldet sich beim Server
- Lifecycle und letzter Kontakt werden aktualisiert
- Firmware, OTA, Connectivity und Pairing-Status koennen gemeldet werden

`POST /devices/register` akzeptiert GerNetiX-provisionierte und Community-Devices. Secret-Material darf fuer den MVP als `one_time_device_secret` uebergeben werden, wird aber in keiner Antwort angezeigt.

## Authenticity

```text
POST /devices/{deviceId}/auth/challenge
POST /devices/{deviceId}/auth/verify
```

Zweck:

- Server erzeugt Challenge
- Device beantwortet Challenge mit HMAC oder spaeter Signatur
- Server bewertet `gernetix_verified` oder `community_unverified`

## Pairing

```text
POST /pairing/sessions
GET  /pairing/sessions/{pairingSessionId}
POST /pairing/sessions/{pairingSessionId}/complete
POST /pairing/sessions/{pairingSessionId}/cancel
```

Zweck:

- Pairing-Code oder Pairing-Session erzeugen
- Account und Device zusammenfuehren
- Pairing-Kanal protokollieren: `device_webserver`, `recovery_tool`, `provisioning_tool`, `ide_pairing_code`

## Account Device Inventory

```text
GET  /accounts/{accountId}/devices
POST /accounts/{accountId}/devices
PATCH /accounts/{accountId}/devices/{accountDeviceId}
DELETE /accounts/{accountId}/devices/{accountDeviceId}
```

Zweck:

- GerNetiX- und Community-Hardware im Profil verwalten
- Anzeigename, Hardwareprofil, Capabilities, OTA-Status und letzter Kontakt sichtbar machen

## Purchase Contexts

```text
GET  /accounts/{accountId}/purchase-contexts
POST /accounts/{accountId}/purchase-contexts
```

Zweck:

- Kaufkontext aus dem Hardware Shop pro Account speichern
- gekaufte Offers, HardwareItems, Capabilities und Provisioning-Profile nachvollziehbar machen
- konkrete AccountDevices beim Pairing oder manuellen Hinzufuegen mit passendem Kaufkontext verknuepfen
- Supportgrundlage pruefbar machen, ohne Community-Hardware automatisch supportberechtigt zu machen

## OTA Target Discovery

```text
GET /accounts/{accountId}/ota-targets?projectId={projectId}
GET /accounts/{accountId}/ota-targets?requiredCapabilities=wifi,ota
```

Zweck:

- kompatible Devices fuer Setup-Rezept oder Lernprojekt finden
- ungeeignete Devices sichtbar, aber nicht auswaehlbar machen

## Connectivity Setup

Connectivity Setup laeuft primaer auf dem Device-Webserver. Der zentrale Server speichert keine WLAN-Passwoerter.

```text
POST /devices/{deviceId}/connectivity/status
```

Zweck:

- Device meldet AP/Node-Modus, IP, OTA-Hostname und Erreichbarkeit
- SSID-Auswahl und Passwort bleiben lokal auf dem Device
- WLAN-Scan wird vom Device-Webserver angeboten

## Support Entitlement

```text
GET /devices/{deviceId}/support-entitlement
GET /accounts/{accountId}/devices/{accountDeviceId}/support-entitlement
```

Zweck:

- Support prueft, ob das konkrete Device GerNetiX-verified ist
- Community-Hardware bleibt nutzbar, erzeugt aber keinen GerNetiX-Hardware-Supportanspruch
## Admin Device Management

```text
GET /admin/devices
GET /admin/devices/{deviceId}
GET /admin/devices/{deviceId}/status
GET /admin/devices/{deviceId}/pairing
GET /admin/devices/{deviceId}/credentials
GET /admin/devices/{deviceId}/support-entitlement
GET /admin/devices?authenticityStatus=gernetix_verified
GET /admin/devices?authenticityStatus=community_unverified
```

Zweck:

- konkrete Devices suchen und Status pruefen
- GerNetiX-verified Hardware von Community-Hardware unterscheiden
- Pairing-, Connectivity-, OTA- und Lifecycle-Status einsehen
- Credential- und Provisionierungshistorie nachvollziehen
- Support- oder Reklamationsgrundlage pruefen
## Customer Data Consent

```text
POST /customer-data-access/consents
GET  /customer-data-access/consents/{consentId}
POST /customer-data-access/consents/{consentId}/revoke
GET  /customer-data-access/audit-events?accountId={accountId}
```

Zweck:

- Consent fuer Admin-/Support-Einsicht erfassen
- Zweck, Scope und Gueltigkeit pruefen
- Consent widerrufen
- Einsicht in kundenrelevante Daten auditieren

Admin-/Support-Endpunkte muessen vor Anzeige von Kundendetails Consent oder eine dokumentierte Rechtsgrundlage pruefen. Ohne erlaubten Zugriff werden Daten maskiert oder abgelehnt.

## MVP-Hinweise

- Secrets werden nur intern fuer HMAC-Pruefung gehalten und nie ausgegeben.
- Admin-Detailansichten erzeugen Audit-Events.
- Ohne Consent, Rechtsgrundlage oder Sicherheitsgrund werden kundenrelevante Details maskiert.
- OTA-Ziele enthalten `selectable` und `rejection_reasons`.
- Die Datenhaltung ist im MVP In-Memory und wird spaeter durch Repository-/Datenbankadapter ersetzt.
