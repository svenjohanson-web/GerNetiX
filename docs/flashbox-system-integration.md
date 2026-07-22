# GerNetiX Flashbox - Systemzusammenspiel

## Ziel

Dieses Dokument definiert, wie Flashbox, Identity, Hardware Catalog, Webshop, Provisioning Tool, Device Management, Build-/Firmware-Artefakte und Recovery zusammenspielen.

Die Flashbox ist dabei kein normales Zielboard. Sie ist ein inventarisierbares und widerrufbares GerNetiX-Werkzeuggeraet, das andere Zielgeraete flashen darf. Sie kann gekauft **oder nach einem gefuehrten Selbstbau-Zertifizierungsweg** hergestellt werden. Deshalb darf kein einzelner UI-Schritt sie "einfach anlegen": Herkunft, Hardwareprofil, kryptographische Identitaet, Besitz, Firmwarestand und Trust-State muessen zusammenpassen.

Der Selbstbau senkt die Einstiegshuerde fuer Neukunden, erweitert aber nicht die Hardwarekompatibilitaet auf beliebige ESP32-Boards. Zugelassen ist ausschliesslich das aktive Flashbox-Referenzprofil: ESP32-S3, mindestens 16 MB interner Flash, 8 MB PSRAM, getrennte datenfaehige Control- und Target-USB-Ports, USB-OTG-Host sowie nachgewiesene 5-V-VBUS-Schaltung mit Power-Switch und Strombegrenzung. Ein aehnliches Board, ein einzelner USB-Port oder ein ESP32 ohne diese Eigenschaften kann nicht zertifiziert werden.

Die abgeleiteten Umsetzungspakete stehen in [GerNetiX Flashbox - Arbeitspakete](flashbox-work-packages.md).

## Verantwortlichkeiten

| Bereich | Fuehrende Verantwortung | Darf nicht tun |
| --- | --- | --- |
| Hardware Catalog | Produktklassen, Hardwareprofile, Capabilities, Zielgeraete-Unterstuetzung, retired/active Status | keine Account-Besitze oder Bestellungen fuehren |
| Webshop | Angebot, Bestellung, Kontakt-E-Mail, Zahlung/Versand, kaufmaennischer Purchase Context | keine GerNetiX-Account-Identitaet erzwingen, keine Device-Credentials verwalten |
| Provisioning Tool | Factory-/Support-Inbetriebnahme sowie gefuehrte Selbstbau-Zertifizierung, Device-Identitaet und Register-/Pairing-Vorbereitung | keine beliebige oder nur aehnliche Selbstbau-Hardware als Flashbox akzeptieren |
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
| `origin_type` | `purchased`, `self_manufactured_certified` oder `support_rebound`; steuert Herkunft, Supportgrenze und Aktivierungsweg |
| `claim_code` | Fallback-Aktivierungsweg, mit dem eine gekaufte Einheit in Identity einem Account zugeordnet wird, wenn WLAN-Discovery/Challenge nicht nutzbar ist |
| `trust_state` | `trusted`, `update_required`, `recovery_required`, `revoked`, `lost`, `retired` |

## Soll-Ablauf: Flashbox entsteht

1. **Hardware Catalog**
   - Katalogeintrag `hardware_class = flashbox` wird gepflegt.
   - Capabilities werden gesetzt, mindestens `flashbox.self_update`, `flashbox.usb_otg_host`, `flashbox.target_flash`, `flashbox.signed_manifest_download`.
   - Unterstuetzte Zielgeraete-Familien und Mindest-Flashbox-Firmware werden gepflegt.

2. **Oeffentlicher Flash-Assistent und Selbstbau-Zertifizierung**
   - Der oeffentliche Bereich bietet den Flash-Assistenten ohne Anmeldung an, damit Nutzer keine Zugangsdaten auf einem fremden Rechner eingeben muessen. Er verwendet ausschliesslich ein versioniertes, signiertes und accountneutrales Flashbox-Initialimage.
   - Der oeffentliche Assistent akzeptiert ausschliesslich das aktive Flashbox-Referenzprofil und erzeugt keine Account-, Besitz-, Entitlement- oder Inventardaten. Sein Ergebnis ist nur der technisch nachweisbare Zustand `flashbox_initial_firmware_ready`.
   - Der interne Bereich verwendet dieselbe Assistenten-Komponente in einem Dialog. Die Komponente erhaelt dabei keine Accountdaten; nach erfolgreichem Flash gibt sie nur die lokale technische Nachweisreferenz an den angemeldeten Controller zurueck.
   - Der interne Weg beginnt mit der Frage: **„Ist diese Flashbox bereits geflasht?“**
     - **Ja:** lokale Discovery, Challenge-Signatur und Account-Uebernahme der vorhandenen Flashbox starten.
     - **Nein, neue Flashbox erstellen:** derselbe oeffentliche Flash-Assistent wird im Dialog gestartet. Nach dem Flash setzt der interne Controller automatisch mit Discovery, Challenge-Signatur und Uebernahme in den aktuell angemeldeten Account fort.
   - Dadurch bleibt ein oeffentlich geflashtes Geraet bewusst noch keinem Account zugeordnet. Eine im internen Dialog geflashte Flashbox wird ausschliesslich dem bereits angemeldeten Account zugeordnet – auch wenn dieselbe Person mehrere Accounts besitzt.

3. **Factory oder Selbstbau-Zertifizierung / Provisioning Tool**
   - Der interne Factory-Weg waehlt den Typ `GerNetiX Flashbox`; der Kundenweg waehlt `Flashbox selbst herstellen`.
   - Der Kundenweg akzeptiert ausschliesslich das aktive Flashbox-Referenzprofil. Er prueft MCU-Familie, mindestens 16 MB Flash, mindestens 8 MB PSRAM, beide USB-Rollen sowie den dokumentierten Nachweis fuer VBUS-Power-Switch und Strombegrenzung.
   - Nicht bestandene oder unvollstaendige Hardwarepruefungen bleiben Community-Hardware und erhalten weder Flashbox-Trust noch Flashbox-Capabilities.
   - Im Factory-Weg werden Seriennummer und Charge erfasst. Im Selbstbau-Weg erzeugt das Tool eine GerNetiX-Registriernummer und speichert `origin_type = self_manufactured_certified`; sie ist keine Verkaufs- oder Garantie-Seriennummer.
   - Die Flashbox erhaelt eine eigene Device-Identitaet. Der private Schluessel entsteht auf der Flashbox und verlaesst die Einheit nicht.
   - Device Management erhaelt Public Key, Zertifikatsmetadaten, Seriennummer, Hardwareprofil und Trust-State.

4. **Webshop / Verkauf**
   - Eine verkaufte Einheit erzeugt oder referenziert `PurchasedHardwareUnit`.
   - Der Webshop kennt Bestellkontakt und Versanddaten, aber nicht zwingend den spaeteren GerNetiX-Account.
   - Der Kunde erhaelt eine Aktivierungs-/Claim-Moeglichkeit, nicht automatisch Device-Credentials.

5. **Identity / Claim**
   - Der Nutzer meldet sich mit GerNetiX-Account an.
   - Normalfall: Identity findet eine per WLAN sichtbare Flashbox, fordert ueber Device Management eine Challenge an und akzeptiert die Einheit erst nach gueltiger Signatur mit dem registrierten Device Public Key.
   - Fallback: Der Nutzer loest Claim-Code oder Seriennummer-plus-Berechtigungsnachweis ein, wenn Discovery oder Challenge nicht moeglich ist.
   - Identity verknuepft die konkrete `unit_id` mit dem Account-Inventar.
   - Device Management bestaetigt, ob die Seriennummer, Device-ID und Trust-State zur Einheit passen.

6. **Nutzung**
   - In Identity/IDE/Provisioning-UI wird beim Transportweg `flashbox` eine konkrete inventarisierte Flashbox ausgewaehlt.
   - Die UI zeigt Name, Seriennummer, Firmwareversion, Trust-State, letzte Verbindung, unterstuetzte Zielprofile und Updatehinweise.
   - Ohne inventarisierte Flashbox gibt es "Flashbox kaufen", "gekaufte Flashbox aktivieren" oder "Flashbox selbst herstellen". Der Selbstbau-Pfad startet immer mit der Referenzprofil-Pruefung und nicht mit einer Freitextanlage.

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

### Zertifikatsgebundener FlashBox-Auftrag

Ein Projekt- oder Basissoftware-Build wird nach Auswahl einer konkreten
FlashBox aus dem Account-Inventar als `flashbox_certificate_authenticated_mqtt_job`
an genau diese Helper-ID gebunden. Build & Deploy persistiert dabei nur die
FlashBox-ID, ihr Hardwareprofil sowie die Firmware-Referenz mit Hash. Der
signierte Auftrag wird mit QoS 1 auf dem retained Topic
`gernetix/devices/<flashbox_device_id>/flashbox/jobs` veroeffentlicht. Dieses
Topic ist aufgrund der mTLS-Zertifikats-CN und Broker-ACL ausschliesslich fuer
genau diese inventarisierte FlashBox lesbar. Ablaufzeit und Sequenznummer
verhindern eine spaetere Wiederholung eines alten Auftrags.

Der Zustand `published_waiting_flashbox` bedeutet ausdruecklich: Das Artefakt
ist gebaut und an den zertifikatsgeschuetzten Helper-Kanal uebergeben, aber
noch nicht als USB-Flash auf dem Zielgeraet bestaetigt. Browser,
Account-Sitzungen und frei uebergebene Device-IDs berechtigen weder zum Lesen
dieses Topics noch zum Flashen.

Die FlashBox meldet die Zustandsfolge (zum Beispiel `job_received`,
`target_detected`, `target_flash_succeeded` oder `target_flash_failed`) nur
unter `gernetix/devices/<flashbox_device_id>/status/flashbox` zurueck. Build &
Deploy ordnet die Rueckmeldung ueber `flashbox_job_id` zu und zeigt sie als
aktuellen Jobzustand an.

### Lokale Zertifikats-Provisionierung nach dem Flash

Die unveraenderliche Basisfirmware enthaelt weder eine Device-ID noch ein
Client-Zertifikat oder einen privaten Schluessel. Beim ersten lokalen Aufruf
von `POST /provisioning` erzeugt die FlashBox selbst ein P-256-Schluesselpaar
und gibt ausschliesslich den Public Key zurueck. Der Provisioning Service
signiert diesen Key und sendet im zweiten lokalen Aufruf nur das
Client-Zertifikat, die Device-ID und die MQTT-Broker-Adresse. Der private Key
wird niemals ueber HTTP ausgegeben; NVS-/Flash-Verschluesselung ist vor dem
Produktiveinsatz verbindlich.

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
- Der Device Private Key ist der Echtheitsnachweis der konkreten zertifizierten Flashbox und wird niemals exportiert. Bei Selbstbau weist er nicht auf einen Kauf hin und begruendet weder Garantie noch Hardware-Support.
- Device Management speichert nur Public Key, Zertifikatsmetadaten, Fingerprint und Trust-State.
- WLAN-Sichtbarkeit, Seriennummer oder Kaufcode ersetzen nie den kryptographischen Challenge-Nachweis, wenn die Flashbox erreichbar ist.
- Der oeffentliche Flash-Assistent darf weder eine Account-ID, Sitzung, Besitzbindung noch Account-spezifische Manifeste annehmen oder speichern. Er darf ausschliesslich das freigegebene Initialimage und die lokale Referenzprofil-Pruefung nutzen.
- Der im internen Bereich geoeffnete Assistent ist dieselbe UI-Komponente, aber keine zweite Accountgrenze: Die Account-Uebernahme erfolgt erst nach Rueckkehr im angemeldeten Controller und ausschliesslich gegen dessen serverseitige Sitzung.
- Kauf-/Claim-Code ist ein Fallback fuer Verkauf, Support oder nicht erreichbare Discovery. Selbstbau verwendet stattdessen die erfolgreiche Referenzprofil-Pruefung plus Challenge-Signatur und Account-Bestaetigung.
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
- ob das Referenzprofil fuer eine selbst hergestellte Flashbox erfuellt ist,
- welche konkreten Flashboxen im Account inventarisiert sind,
- ob eine Flashbox online, veraltet, gesperrt oder im Recovery-Zustand ist,
- welche Zielgeraete/Familien sie unterstuetzt,
- ob der gewaehlte Flashauftrag mit dieser Flashbox erlaubt ist.

Sie darf nicht anbieten:

- eine Flashbox ohne Referenzprofil-Pruefung selbst erstellen,
- Flashbox per Freitext anlegen,
- Trust-State lokal ueberschreiben,
- eine nicht beanspruchte Shop-Bestellung ohne Claim als Account-Inventar ausgeben,
- eine gesperrte Flashbox fuer neue Flashauftraege verwenden.

## Oeffentlicher Initial-Setup-Assistent

Der oeffentliche Assistent ist unter `/flashbox-einrichten/` erreichbar und
bleibt bewusst getrennt von Login, Claim und Account-Inventar. Er fuehrt keine
Build-Jobs aus. Stattdessen laedt er ausschliesslich den aktuell freigegebenen,
unveraenderlichen Release `flashbox-initial-image` fuer `esp32/esp32-s3` aus
dem SQLite-Release-Speicher.

Der Ablauf ist verbindlich:

1. Der Nutzer verbindet die Flashbox ueber Control-USB und startet die
   automatische Suche. Bereits im Browser freigegebene serielle ESP-Geraete
   werden zuerst geprueft.
2. Wird kein passendes Geraet gefunden, bietet die UI die manuelle Auswahl an.
   Der Browser zeigt dabei seinen eigenen sicheren COM-Port-Dialog; eine
   Webseite darf keine Portliste ohne Nutzerfreigabe auslesen.
3. Der ROM-Bootloader muss `ESP32-S3` melden. Flash, interner RAM und PSRAM
   werden angezeigt und vom Nutzer bestaetigt. Verbindliche Mindestgroessen
   werden erst nach dem fertigen USB-OTG-Schreibpfad und Hardwaremessungen
   festgelegt.
4. Der Nutzer bestaetigt die angezeigten Werte. Erst danach wird das Image
   geladen, seine SHA-256-Pruefsumme lokal geprueft und ueber Web Serial
   geschrieben.

Ein Release wird ausschliesslich durch einen Betreiber mit dem Offline-Tool
veroeffentlicht. Beispiel auf dem VPS (nach einem erfolgreich verifizierten
Build):

```text
node tools/publish-flashbox-initial-release.js --file /pfad/firmware.bin --version 1.0.0
```

Die Veroeffentlichung ist append-only; dieselbe Version kann nicht
ueberschrieben werden. Die kryptographische Freigabe des Images vor dem
Veroeffentlichen bleibt Teil des Release-Prozesses; der Assistent prueft beim
Download zusaetzlich den gespeicherten SHA-256-Wert.

## Offene Umsetzungspakete

Die detaillierte Zerlegung mit IDs, Abhaengigkeiten und Abnahmekriterien steht in [GerNetiX Flashbox - Arbeitspakete](flashbox-work-packages.md).
