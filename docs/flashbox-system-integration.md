# GerNetiX Flashbox - Systemzusammenspiel

## Ziel

Dieses Dokument definiert, wie Flashbox, Identity, Hardware Catalog, Webshop, Provisioning Tool, Device Management, Build-/Firmware-Artefakte und Recovery zusammenspielen.

Die Flashbox ist dabei kein normales Zielboard. Sie ist ein kaufbares, inventarisierbares und widerrufbares GerNetiX-Werkzeuggeraet, das andere Zielgeraete flashen darf. Genau deshalb darf kein einzelner UI-Schritt sie "einfach anlegen"; Herkunft, Seriennummer, Hardwareprofil, Besitz, Firmwarestand und Trust-State muessen zusammenpassen.

Die abgeleiteten Umsetzungspakete stehen in [GerNetiX Flashbox - Arbeitspakete](flashbox-work-packages.md).

## Verantwortlichkeiten

| Bereich | Fuehrende Verantwortung | Darf nicht tun |
| --- | --- | --- |
| Hardware Catalog | Produktklassen, Hardwareprofile, Capabilities, Zielgeraete-Unterstuetzung, retired/active Status | keine Account-Besitze oder Bestellungen fuehren |
| Webshop | Angebot, Bestellung, Kontakt-E-Mail, Zahlung/Versand, kaufmaennischer Purchase Context | keine GerNetiX-Account-Identitaet erzwingen, keine Device-Credentials verwalten |
| Provisioning Tool | interne Factory-/Support-Inbetriebnahme, Seriennummer, initiale Device-Identitaet, Register-/Pairing-Vorbereitung | keine selbst gebaute Flashbox als GerNetiX-Flashbox akzeptieren |
| Identity | Account, Login, Aktivierungscode/Claim, Account-Inventar-UI, Auswahl einer konkreten Flashbox im Nutzerfluss | keine Zahlungsdaten fuehrend speichern, keine Hardwareprofile erfinden |
| Device Management | Device-ID, mTLS-/Credential-Status, Ownership, Pairing, Connectivity, OTA-/Firmwarestatus, Trust-State | keine Shoppreise oder Rechnungslogik fuehren |
| Build & Deploy / Firmware-Artefakte | signierte Manifeste, signierte Images, Hashes, Zielprofile, Versionen, Sperr-/Rollback-Regeln | keine Account- oder Kaufentscheidung ersetzen |
| Recovery Tool / Recovery-Vertrag | definierte Rettungswege fuer Flashbox und Zielgeraete | keine Identitaet oder Ownership unkontrolliert ersetzen |

Kurzform:

```text
Hardware Catalog beschreibt, was eine Flashbox ist.
Webshop verkauft eine konkrete Einheit.
Provisioning Tool macht daraus ein GerNetiX-vertrauenswuerdiges Werkzeuggeraet.
Identity ordnet die Einheit einem Account zu.
Device Management entscheidet, ob diese konkrete Einheit aktuell vertrauenswuerdig ist.
Build & Deploy liefert nur passende, signierte Artefakte.
Recovery erhaelt Identitaet und Pairing, statt heimlich neu zu erzeugen.
```

## Zentrale IDs und Begriffe

| Begriff | Bedeutung |
| --- | --- |
| `hardware_item_id` | Produkt-/Katalogeintrag, z. B. `hardware.flashbox.esp32_s3_usb_helper` |
| `hardware_class` | `flashbox` fuer GerNetiX-Flashboxen, `processor_board` fuer Zielboards |
| `hardware_profile_id` | technisches Profil mit MCU, Flash, RAM, Control-USB, Target-USB, USB-Host und Stromversorgung |
| `unit_id` | konkret produzierte oder verkaufte Einheit |
| `serial_number` | aufgedruckte oder factory-seitig vergebene Seriennummer |
| `device_id` | kryptographisch registrierte Geraeteidentitaet fuer Device Management/mTLS |
| `purchase_context_id` | kaufmaennischer Kontext aus Webshop/Bestellung/Provisionierung |
| `claim_code` | Fallback-Aktivierungsweg, mit dem eine gekaufte Einheit in Identity einem Account zugeordnet wird, wenn WLAN-Discovery/Challenge nicht nutzbar ist |
| `trust_state` | `trusted`, `update_required`, `recovery_required`, `revoked`, `lost`, `retired` |

## Soll-Ablauf: Flashbox entsteht

1. **Hardware Catalog**
   - Katalogeintrag `hardware_class = flashbox` wird gepflegt.
   - Capabilities werden gesetzt, mindestens `flashbox.self_update`, `flashbox.usb_otg_host`, `flashbox.target_flash`, `flashbox.signed_manifest_download`.
   - Unterstuetzte Zielgeraete-Familien und Mindest-Flashbox-Firmware werden gepflegt.

2. **Factory / Provisioning Tool**
   - Interner Nutzer waehlt im privaten Provisioning Tool den Typ `GerNetiX Flashbox`.
   - Das Tool akzeptiert nur Flashbox-Katalogeintraege, keine manuelle Selbstbau-Flashbox.
   - Seriennummer, Charge, Hardwareprofil und initialer Firmwarestand werden erfasst.
   - Die Flashbox erhaelt eine eigene Device-Identitaet. Der private Schluessel entsteht auf der Flashbox oder in einem gleichwertig geschuetzten Factory-Schritt und verlaesst die Einheit nicht.
   - Device Management erhaelt Public Key, Zertifikatsmetadaten, Seriennummer, Hardwareprofil und Trust-State.

3. **Webshop / Verkauf**
   - Eine verkaufte Einheit erzeugt oder referenziert `PurchasedHardwareUnit`.
   - Der Webshop kennt Bestellkontakt und Versanddaten, aber nicht zwingend den spaeteren GerNetiX-Account.
   - Der Kunde erhaelt eine Aktivierungs-/Claim-Moeglichkeit, nicht automatisch Device-Credentials.

4. **Identity / Claim**
   - Der Nutzer meldet sich mit GerNetiX-Account an.
   - Normalfall: Identity findet eine per WLAN sichtbare Flashbox, fordert ueber Device Management eine Challenge an und akzeptiert die Einheit erst nach gueltiger Signatur mit dem registrierten Device Public Key.
   - Fallback: Der Nutzer loest Claim-Code oder Seriennummer-plus-Berechtigungsnachweis ein, wenn Discovery oder Challenge nicht moeglich ist.
   - Identity verknuepft die konkrete `unit_id` mit dem Account-Inventar.
   - Device Management bestaetigt, ob die Seriennummer, Device-ID und Trust-State zur Einheit passen.

5. **Nutzung**
   - In Identity/IDE/Provisioning-UI wird beim Transportweg `flashbox` eine konkrete inventarisierte Flashbox ausgewaehlt.
   - Die UI zeigt Name, Seriennummer, Firmwareversion, Trust-State, letzte Verbindung, unterstuetzte Zielprofile und Updatehinweise.
   - Ohne inventarisierte Flashbox gibt es nur "Flashbox kaufen" oder "gekaufte Flashbox aktivieren", keinen Selbstbau-Pfad.

## Flash-Auftrag mit Flashbox

Ein Flashbox-Flash ist kein Browser-WebSerial-Flash. Die Flashbox selbst fuehrt den USB-OTG-Flash am Zielgeraet aus.

Sollfluss:

```text
Nutzer waehlt in Identity/IDE Zielprojekt und Zielgeraet
-> UI bietet Transportwege: direkter USB-Flash, OTA-Flash, FlashBox-Flash
-> Nutzer waehlt konkrete Account-Flashbox
-> Identity prueft Account-Ownership und zeigt Zustand
-> Device Management prueft Trust-State der Flashbox
-> Hardware Catalog prueft, ob Flashbox das Zielprofil unterstuetzt
-> Build & Deploy erzeugt oder referenziert signiertes Ziel-Firmware-Artefakt
-> Flashbox ruft signiertes Manifest per HTTPS/mTLS ab
-> Flashbox prueft Manifest, Hardwareprofil, Release-Key-ID und Signatur
-> Flashbox laedt Firmwarebytes erst nach gueltigem Manifest und prueft danach streamend den Artefakt-Hash
-> Flashbox waehlt danach den Schreibweg: Flashbox-Selbstupdate-Dual-Slot oder Zielgeraete-USB-OTG
-> Flashbox erkennt per USB-OTG ein angeschlossenes Zielgeraet und zeigt VID/PID sowie Bootloader-Kandidatenstatus lokal und per Webserver
-> Flashbox flasht Zielgeraet per USB-OTG
-> Flashbox meldet Ergebnis an Device Management
-> Identity/IDE zeigt Abschluss oder Recovery-Hinweis
```

Der Flashauftrag referenziert:

- konkrete Flashbox-`unit_id` oder `device_id`
- Account- bzw. Ownership-Kontext
- Zielgeraet oder Zielprofil
- Firmware-Artefaktklasse: Bootstrap, Basissoftware, Projektfirmware oder Recovery
- signiertes Manifest mit Ablaufzeit, Hash und Hardwareprofil

## Flashbox-Use-Cases und Manifesttypen

Die Flashbox deckt zwei getrennte Nutzerfaelle ab:

| Use Case | Zweck | Manifesttyp | Identitaetsregel |
| --- | --- | --- | --- |
| Initiale Firmware-Provisionierung | leeres/neues ESP32-Zielgeraet erstmalig bootstrappen, wenn iOS/WebSerial/PC nicht verfuegbar ist | `initial_bootstrap_flash` | neue Device-Identitaet darf erzeugt werden |
| Offline-/No-USB-/Recovery-Flash | bekanntes Device ohne OTA oder Browser-USB neu flashen/retten | `known_device_recovery_flash`, `basissoftware_reflash`, `project_firmware_flash` | bestehende Device-ID, Pairing und Credentials muessen erhalten bleiben |

Verbindliche Regeln:

- `initial_bootstrap_flash` braucht `identity_policy = create_new_device_identity`.
- `known_device_recovery_flash`, `basissoftware_reflash` und `project_firmware_flash` brauchen `identity_policy = preserve_existing_device_identity`.
- Fuer bekannte Devices ist `target_device_id` Pflicht.
- Ein Recovery-/Offline-Flash darf nie stillschweigend ein neues Device erzeugen.
- Ein unbekanntes/leeres Zielgeraet wird nicht als bekanntes Device uebernommen, sondern startet einen neuen Provisioning-/Pairing-Ablauf.

## Recovery-Faelle

### 1. Flashbox-Selbstupdate-Recovery

Ziel: Die Flashbox selbst bleibt wiederherstellbar, ohne ihre Identitaet unkontrolliert zu verlieren.

Regeln:

- Normales Flashbox-Update nutzt A/B- oder gleichwertiges Dual-Slot-Verfahren.
- Ein fehlerhaftes Update rollt automatisch auf den letzten gueltigen Slot zurueck.
- Recovery darf Bootloader, Trust-Anker, Seriennummer und Device-ID nicht durch einen normalen Online-Vorgang ersetzen.
- Wenn ein geschuetzter Recovery-Modus existiert, akzeptiert er nur signierte GerNetiX-Images fuer exakt dieses Flashbox-Hardwareprofil.
- Device Management markiert die Flashbox bei wiederholtem Updatefehler als `recovery_required`.
- Identity zeigt dem Besitzer "Flashbox muss wiederhergestellt werden" und bietet Support-/Recovery-Anleitung, aber keinen neuen Claim als Ersatz.
- Wenn die Device-Identitaet verloren ist, braucht es einen Factory-/Support-Rebind mit Audit, nicht nur einen Account-Klick.

### 2. Zielgeraet-Recovery ueber Flashbox

Ziel: Die Flashbox kann ein bekanntes oder neues Zielgeraet retten.

Regeln:

- Bei bekanntem Zielgeraet muss Recovery Device-ID, Credentials und Pairing erhalten, sofern diese noch auslesbar oder serverseitig zuordenbar sind.
- Recovery-Artefakte sind eine eigene Artefaktklasse und duerfen nicht wie beliebige Projektfirmware behandelt werden.
- Die Flashbox darf nur signierte Recovery-Manifeste schreiben.
- Bei fremdem oder leerem Zielgeraet startet kein "stilles Uebernehmen", sondern ein neuer Provisioning-/Pairing-Ablauf.
- Ein Recovery-Ergebnis wird an Device Management gemeldet und in Identity beim betroffenen Device sichtbar.

### 3. Account-Recovery ist getrennt

Account-Recovery, Passkey-Recovery und Offline-Recovery-Sets gehoeren zu Identity. Eine Flashbox ersetzt keinen Account-Recovery-Weg. Umgekehrt darf ein Account-Recovery-Code keine Flashbox-Trust-Entscheidung ersetzen.

### 4. Verlust, Diebstahl, Verkauf

- Nutzer kann eine Flashbox in Identity als verloren melden.
- Device Management setzt `trust_state = lost` oder `revoked`.
- Build & Deploy gibt keine neuen Flash-Manifeste mehr fuer diese konkrete Flashbox aus.
- Ein spaeterer Besitzer braucht einen geregelten Ownership-Transfer oder Support-Rebind.

## Trust- und Sicherheitsgrenzen

Verbindlich:

- Flashboxen authentifizieren sich gegen GerNetiX mit eigener Device-Identitaet, idealerweise mTLS.
- Der Device Private Key ist der Kopierschutz- und Echtheitsnachweis der konkreten Flashbox. Er entsteht auf der Flashbox oder in einem gleichwertig geschuetzten Factory-Schritt und wird niemals exportiert.
- Device Management speichert nur Public Key, Zertifikatsmetadaten, Fingerprint und Trust-State.
- WLAN-Sichtbarkeit, Seriennummer oder Kaufcode ersetzen nie den kryptographischen Challenge-Nachweis, wenn die Flashbox erreichbar ist.
- Kauf-/Claim-Code ist ein Fallback fuer Verkauf, Support oder nicht erreichbare Discovery, nicht der Primaerbeweis fuer echte Hardware.
- GerNetiX Release Private Keys bleiben server-/factoryseitig; die Flashbox enthaelt nur den passenden Release Public Key zur Manifestpruefung.
- Der Flashbox-Manifest-Validator setzt `artifact_download_allowed` erst nach gueltiger mbedTLS-Signaturpruefung. Der Artefakt-Hash ist eine eigene Pflichtpruefung vor jedem spaeteren Schreiben.
- Die Write-State-Machine bleibt gesperrt, bis Selbstupdate-Writer und USB-OTG-Zielgeraete-Writer jeweils eigene Power-Loss-/Verify-Tests besitzen.
- USB-OTG-Sichtbarkeit eines Zielgeraets ist nur ein technisches Signal. Flashfreigabe entsteht erst nach Bootloader-Handschlag, Chip-/Boardprofil-Pruefung, passendem Manifest und Hash-/Signaturpruefung.
- USB-Serial-Adapter wie CH340, CP210x, FTDI oder Prolific beweisen nur, dass ein serielles Ziel erreichbar sein koennte. Ob dahinter Arduino Nano, ESP8266 oder ESP32 im passenden Bootloader haengt, muss der naechste Protokollschritt pruefen.
- Die lokalen Flashbox-Statusendpunkte muessen stack-sicher bleiben: grosse JSON-Response-Puffer liegen statisch im Firmware-Modul, nicht auf dem Webserver-Request-Stack.
- Flashbox-Firmware-Update-Schluessel sind getrennt von Zielgeraete-OTA-Schluesseln.
- Ziel-Firmware-Manifeste sind getrennt von Flashbox-Selbstupdate-Manifesten.
- Die Flashbox speichert keine GerNetiX-Account-Passwoerter, Passkeys, Shop-Zahlungsdaten oder WLAN-Passwoerter anderer Nutzer.
- Offline-Cache ist nur fuer bereits verifizierte Artefakte erlaubt und darf Revocation nicht umgehen.
- Bei `revoked`, `lost`, `retired` oder unpassendem Hardwareprofil wird kein neuer Flashauftrag ausgestellt.

## UI-Regeln fuer Identity/IDE

Identity beziehungsweise die Plattform-UI muss anzeigen:

- ob der Nutzer keine Flashbox besitzt,
- ob eine gekaufte Flashbox aktiviert werden kann,
- welche konkreten Flashboxen im Account inventarisiert sind,
- ob eine Flashbox online, veraltet, gesperrt oder im Recovery-Zustand ist,
- welche Zielgeraete/Familien sie unterstuetzt,
- ob der gewaehlte Flashauftrag mit dieser Flashbox erlaubt ist.

Sie darf nicht anbieten:

- Flashbox selbst erstellen,
- Flashbox per Freitext anlegen,
- Trust-State lokal ueberschreiben,
- eine nicht beanspruchte Shop-Bestellung ohne Claim als Account-Inventar ausgeben,
- eine gesperrte Flashbox fuer neue Flashauftraege verwenden.

## Offene Umsetzungspakete

Die detaillierte Zerlegung mit IDs, Abhaengigkeiten und Abnahmekriterien steht in [GerNetiX Flashbox - Arbeitspakete](flashbox-work-packages.md).
