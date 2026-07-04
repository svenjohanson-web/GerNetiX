# Vorhabensbeschreibung Device Management Server

## Ausgangspunkt

GerNetiX braucht einen zentral ansprechbaren Bereich fuer Devices. ESP-Firmware, User IDE, Recovery Tool und Provisioning Tool sollen denselben fachlichen Device-Zustand verwenden, ohne dass Pairing, WLAN-Setup, Echtheit und Supportanspruch vermischt werden.

## Erkannte Entscheidungen

- Device Management ist eine eigene Domaene.
- Im MVP laeuft es als Modul im gemeinsamen Backend.
- Die API ist trotzdem extern und eindeutig adressierbar.
- Hersteller-Register und Kunden-Register sind zwei verschiedene Flows.
- GerNetiX-verified Hardware und Community-Hardware werden beide unterstuetzt.
- SSID/Passwort gehoeren zum Connectivity Setup, nicht zum Pairing.
- Der Device-Webserver scannt WLANs; Nutzer waehlt SSID aus Liste und gibt nur Passwort ein.
- WLAN-Passwort bleibt lokal auf dem Device, nicht im zentralen Server.
- Pairing-Kanaele koennen Webserver, Recovery Tool, Provisioning Tool oder IDE Pairing Code sein.
- Alle Pairing-Kanaele erzeugen dasselbe fachliche Ergebnis: AccountDevice und DeviceOwnership.
- OTA-Zielauswahl passiert aus dem Account-Device-Inventar anhand Capabilities und OTA-Status.
- Supportanspruch folgt nicht aus Besitz, sondern aus GerNetiX-Provisionierung, Echtheitsnachweis und Entitlement.
- Admin Tool bekommt eigene Device-Management-Sichten fuer Statuspruefung, GerNetiX-vs-Community, Pairing, OTA, Credentials und Support-Entitlement.
- Kundenrelevante Device-Daten duerfen durch Admin/Support nur mit Consent, dokumentierter Rechtsgrundlage oder zwingendem Sicherheits-/Missbrauchsgrund eingesehen werden.

## Zielbild

```text
ESP32 Firmware
  -> Device Management API
User IDE
  -> Device Management API
Recovery Tool
  -> Device Management API
Provisioning Tool
  -> Device Management API
Admin/Support
  -> Device Management API
```

## Erste fachliche Meilensteine

1. API-Kontrakt und Datenmodelle finalisieren.
2. Hersteller-Register mit Provisioning Tool verbinden.
3. Device-Webserver fuer Connectivity Setup beschreiben und spaeter implementieren.
4. Kunden-Pairing ueber Pairing Session modellieren.
5. Account-Device-Inventar in der IDE anzeigen.
6. OTA-Zielauswahl aus dem Profil ableiten.
7. Support-Entitlement pruefbar machen.

## Offene Punkte

- Wo liegt die erste echte Backend-Codebasis im Repo?
- Welche Authentifizierung nutzt die IDE gegen das Backend im MVP?
- Wird HMAC fuer erste GerNetiX-Boards ausreichend sein oder spaeter durch asymmetrische Signaturen ersetzt?
- Wie wird der Pairing-Code fuer Boards ohne Display nutzerfreundlich angezeigt?
- Welche Device-Daten duerfen lokal in der IDE gecacht werden?