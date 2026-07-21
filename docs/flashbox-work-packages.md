# GerNetiX Flashbox - testbar geschnittene Arbeitspakete

## Ziel

Dieses Dokument schneidet die Flashbox-Umsetzung so, dass jedes Paket moeglichst frueh und moeglichst automatisiert testbar ist. Grundlage sind:

- [GerNetiX Flashbox - Systemzusammenspiel](flashbox-system-integration.md)
- [GerNetiX Flashbox - Inventar- und Katalog-Datenmodell](flashbox-inventory-data-model.md)
- [GerNetiX Flashbox Firmware - Anforderungen](flashbox-firmware-requirements.md)

## Schnittprinzip

Die Pakete werden nicht primaer nach Komponenten geschnitten, sondern nach testbaren Ergebnis-Scheiben.

Regeln:

- Jedes Paket hat einen sichtbaren, automatisierbaren Nachweis.
- Kritische Regeln werden zuerst serverseitig oder in Contract-Tests abgesichert.
- Hardware-nahe Arbeit beginnt erst, wenn Manifest-, Trust-, Inventory- und UI-Vertraege in Host-Tests stabil sind.
- Firmware-Logik wird, wo moeglich, zuerst als State-Machine oder Manifest-Validator ohne echte Hardware getestet.
- Echte Flashbox-/USB-OTG-Hardwaretests sind spaete Abnahmetests, nicht der erste Nachweis.

## Testpyramide fuer Flashbox

| Ebene | Zweck | Beispiele |
| --- | --- | --- |
| Unit-/Schema-Tests | Regeln schnell und deterministisch pruefen | Manifest-Schema, Trust-State-Entscheidung, Claim-Code-Status |
| Repository-/Migrationstests | Persistenz als Wahrheit pruefen | Inventory, PurchasedHardwareUnit, RuntimeState |
| API-Contract-Tests | Servicegrenzen pruefen | Hardware Catalog, Identity, Device Management, Build & Deploy |
| UI-Contract-/DOM-Tests | Nutzerfuehrung pruefen | gefuehrter Selbstbau nur mit Referenzprofil, iOS-Hinweis, konkrete Flashbox-Auswahl |
| Simulator-/Host-Tests | Firmwarelogik ohne Board pruefen | Update-State-Machine, Flash-State-Machine, Recovery-Entscheidung |
| Hardware-in-the-loop | physische Restrisiken pruefen | USB-Host, Target-VBUS, Power-Loss, Recovery-Tasten |
| End-to-End | Geschaeftsfluss beweisen | Kauf -> Claim -> Inventar -> Manifest -> Flash -> Recovery |

## Paketuebersicht

| ID | Testbare Scheibe | Hauptnachweis | Hardware noetig? |
| --- | --- | --- | --- |
| FB-TS-01 | Flashbox erscheint getrennt im Hardware Catalog | API-/Repository-Test | nein |
| FB-TS-02 | Provisioning Tool zertifiziert nur das Selbstbau-Referenzprofil | Service-/UI-Test | nein |
| FB-TS-03 | Flashbox-Inventory kann persistent entstehen | Repository-/Migrationstest | nein |
| FB-TS-04 | Webshop-Mock erzeugt claimbare Einheit | API-Contract-Test | nein |
| FB-TS-05 | Identity claimt Flashbox in Account-Inventar | API-/UI-Test | nein |
| FB-TS-06 | Identity zeigt Inventar-Karte mit Trust-State | UI-/Service-Test | nein |
| FB-TS-07 | Transportauswahl filtert Flashbox korrekt | UI-Contract-Test | nein |
| FB-TS-08 | Device Management entscheidet Flashbox-Trust | Unit-/API-Test | nein |
| FB-TS-08a | Flashbox beweist Echtheit per Device-Key | Firmware-/Provisioning-Contract-Test | nein |
| FB-TS-09 | Build & Deploy stellt nur gueltige Manifeste aus | Schema-/Signaturtest | nein |
| FB-TS-10 | Flashbox-Manifest-Validator akzeptiert/verbietet korrekt | Host-/Unit-Test | nein |
| FB-TS-11 | Flashbox-Selbstupdate-State-Machine ist eigensicher | Simulator-/Host-Test | nein |
| FB-TS-12 | Zielgeraete-Flash-State-Machine ist abbrechbar und verifizierend | Simulator-/Host-Test | nein |
| FB-TS-13 | Recovery-Regeln trennen Flashbox und Zielgeraet | Contract-/Simulator-Test | nein |
| FB-TS-14 | Revocation/Lost blockiert neue Flashauftraege | API-/E2E-ohne-Hardware | nein |
| FB-TS-15 | Admin-/Support-Sicht kann Status pruefen | UI-/API-Test | nein |
| FB-TS-16 | Hardware-in-the-loop: echte Flashbox | Hardware-Abnahmetest | ja |
| FB-TS-17 | End-to-End vom Kauf bis Zielgeraete-Flash | E2E-Test | teilweise |
| FB-TS-18 | Oeffentlicher Flash-Assistent und interne Account-Uebernahme | UI-/API-Contract-Test | nein |

## FB-TS-01 - Flashbox getrennt im Hardware Catalog

Ziel:

- Der Hardware Catalog liefert Flashboxen als eigene Klasse `flashbox`, getrennt von ProcessorBoards.

Testbare Regeln:

- `GET /flashboxes` oder gleichwertiger Katalogzugriff liefert nur Flashboxen.
- `GET /processor-boards` liefert keine Flashbox.
- Flashbox hat `hardware_class = flashbox`, ein aktives Selbstbau-Referenzprofil, Capabilities und Zielgeraete-Matrix.

Mocks:

- kein Webshop, keine Identity, keine echte Hardware.

Abnahme:

- Repository-/API-Test fuer mindestens eine Flashbox-SKU.
- Negativtest: Flashbox darf nicht in ProcessorBoard-Auswahl erscheinen.

Umgesetzt in diesem Slice:

- `hardware.flashbox.esp32_s3_usb_helper` ist im Hardware Catalog als `item_type = flashbox` und `hardware_class = flashbox` angelegt.
- `GET /api/hardware-catalog/flashboxes` liefert Flashboxen getrennt von ProcessorBoards.
- Automatischer Nachweis: `services/hardware-catalog/test/hardware-catalog-service.test.js`.

## FB-TS-02 - Provisioning Tool zertifiziert nur das Selbstbau-Referenzprofil

Ziel:

- Das Provisioning Tool kann eine gekaufte Flashbox in Betrieb nehmen und eine selbst hergestellte Flashbox nur nach bestandener Referenzprofil-Pruefung zertifizieren.

Aktueller Stand:

- UI und Service unterscheiden `processor_board` und `flashbox`.
- normaler Zielboard-WebSerial-Flash ist im Flashbox-Modus deaktiviert.

Naechster testbarer Ausbau:

- Service lehnt `hardware_class = flashbox` ohne aktiven Katalog-/Referenzprofiltreffer ab.
- Service prueft ESP32-S3, mindestens 16 MB Flash, 8 MB PSRAM, getrennte Daten-USB-Ports, USB-OTG-Host sowie VBUS-Power-Switch mit Strombegrenzung.
- UI zeigt nur den gefuehrten Selbstbau-Assistenten, keinen Freitextpfad.

Abnahme:

- Service-Test fuer gueltige Flashbox.
- Service-Test fuer unbekannte oder unvollstaendige Selbstbau-Hardware.
- UI-Contract-Test fuer Referenzprofil-Gate und getrennte Zieltyp-Auswahl.

## FB-TS-03 - Flashbox-Inventory persistent

Ziel:

- Die Datenbank kann konkrete Flashbox-Einheiten, Besitz und Trust-State dauerhaft abbilden.

Testbare Regeln:

- `PurchasedHardwareUnit.serial_number` eindeutig.
- `AccountHardwareInventory` referenziert konkrete `unit_id`, nicht nur SKU.
- Flashbox-Einheit braucht `purchase_context_id`, Factory-/Admin-Kontext oder einen erfolgreichen Selbstbau-Zertifizierungsnachweis.
- Freitextanlage fuer `hardware_class = flashbox` ist serverseitig verboten; Selbstbau braucht den Referenzprofil-Gate.

Mocks:

- Webshop und Device Management koennen als Testdatengeber simuliert werden.

Abnahme:

- Migrationstest oder SQLite-Repository-Test.
- Negativtests fuer doppelte Registriernummer, fehlenden Kauf-/Factory-/Selbstbau-Kontext und unvollstaendiges Referenzprofil.

Umgesetzt in diesem Slice:

- Device Management speichert claimbare Flashbox-Einheiten im Purchase-Context und persistiert den Claim-Status.
- Ein erfolgreicher Claim erzeugt ein Account-Device mit `hardware_class = flashbox`, Seriennummer, Kaufkontext und Audit-Event.
- Der Claim-Code wird im Device Management nur gehasht gespeichert.
- Automatischer Nachweis: `services/device-management-server/test/device-management-service.test.js`.

## FB-TS-04 - Webshop-Mock erzeugt claimbare Einheit

Ziel:

- Ein Webshop-Dummy kann eine kaufbare Flashbox-Einheit erzeugen, ohne echte Zahlungslogik.

Testbare Regeln:

- Kauf erzeugt `purchase_context_id`.
- Kauf erzeugt `PurchasedHardwareUnit` oder claimbaren Claim-Datensatz.
- Kontakt-E-Mail bleibt Webshop-Kontext.
- Identity-Account ist fuer Kauf nicht zwingend.

Mocks:

- Zahlungsdienst bleibt Mock.
- Versand bleibt Mock.

Abnahme:

- API-Contract-Test: Dummy-Kauf -> Claim-Code/Claim-Token vorhanden.
- Negativtest: Claim-Code enthaelt keine Zahlungsdaten und kein Device-Secret.

Umgesetzt in diesem Slice:

- Hardware Shop enthaelt das Mock-Angebot `offer.gernetix_flashbox_s3_usb_helper`.
- Ein bezahlter Mock-Order erzeugt `purchase_context_id` und `claimable_hardware_units` mit Seriennummer, Unit-ID, Claim-Code und Hash.
- SQLite-Shop-Repository merged neue Default-Angebote in bestehende Runtime-Daten, ohne vorhandene Angebote zu verlieren.
- Automatischer Nachweis: `services/hardware-shop/test/hardware-shop-service.test.js`.

## FB-TS-05 - Identity claimt Flashbox

Ziel:

- Ein angemeldeter Nutzer kann eine gekaufte Flashbox aktivieren.

Testbare Regeln:

- gueltiger Claim verbindet Account mit konkreter `unit_id`.
- abgelaufener, falscher oder bereits verwendeter Claim wird abgelehnt.
- Claim erzeugt Audit ohne Claim-Code im Klartext.

Mocks:

- Webshop-Claim-Quelle als Stub.
- Device Management kann Trust-State zunaechst als Stub bestaetigen.

Abnahme:

- API-Test fuer erfolgreichen Claim.
- API-Test fuer doppelte Verwendung.
- UI-Test fuer Fehlermeldungen.

Umgesetzt in diesem Slice:

- Identity bietet `POST /api/platform/flashbox/claim` als Account-geschuetzten Claim-Pfad.
- Die Inventar-UI enthaelt eine Claim-Code-Eingabe und uebernimmt die geclaimte Flashbox in die aktuelle Geraeteliste.
- Automatischer Nachweis: `services/identity-server/test/shop-page.test.js` und Device-Management-Claim-Test.

## FB-TS-06 - Identity Inventar-Karte

Ziel:

- Die Flashbox ist im Account-Inventar als konkrete Einheit sichtbar.

Testbare Regeln:

- Karte zeigt Name, Seriennummer, Firmwareversion, Trust-State, letzter Kontakt.
- `revoked`, `lost`, `recovery_required` werden sichtbar unterschieden.
- Es gibt einen gefuehrten Button "Flashbox selbst herstellen", aber keinen Freitext- oder Umgehungsweg.

Mocks:

- Device Management Runtime-State als Fixture.

Abnahme:

- UI-/DOM-Test mit `trusted`, `update_required`, `lost`.

Umgesetzt in diesem Slice:

- Flashbox-Account-Devices werden in Identity mit eigenem Build-/Inventarlabel `GerNetiX FlashBox / USB-Helper-Flash` angezeigt.
- Die Inventaransicht spricht jetzt von Boards und Flashboxen und bietet einen gefuehrten Selbstbau-Pfad mit Referenzprofil-Pruefung.
- Automatischer Nachweis: `services/identity-server/test/hardware-utils.test.js` und `services/identity-server/test/shop-page.test.js`.
- Snapshot oder Contract-Test fuer sichtbare Actions.

## FB-TS-18 - Oeffentlicher Flash-Assistent und interne Account-Uebernahme

Ziel:

- Das Flashen einer neuen Selbstbau-Flashbox ist ohne Login im oeffentlichen Bereich moeglich; die Besitzbindung bleibt ausschliesslich im internen Bereich.

Testbare Regeln:

- Der oeffentliche Assistent verwendet nur das signierte, accountneutrale Initialimage und akzeptiert oder speichert keine Account-ID, Sitzung, Besitzbindung oder account-spezifische Manifeste.
- Der interne Einstieg fragt zuerst `bereits geflasht` oder `neue Flashbox erstellen`.
- Bei `bereits geflasht` startet Discovery, Challenge-Signatur und Uebernahme der vorhandenen Einheit.
- Bei `neue Flashbox erstellen` wird exakt dieselbe oeffentliche Assistenten-Komponente als Dialog geoeffnet; nach Erfolg erhaelt der angemeldete Controller nur die technische Nachweisreferenz und fuehrt Discovery, Challenge-Signatur sowie Uebernahme fort.
- Die Uebernahme verwendet immer die aktuell serverseitig angemeldete Sitzung. Ein oeffentlich geflashtes Geraet ist bis zu diesem Schritt keinem Account zugeordnet.

Abnahme:

- UI-Contract-Test: oeffentlicher Assistent ist ohne Login erreichbar und zeigt keine Accountdaten.
- UI-Contract-Test: der interne Dialog nutzt dieselbe Komponente und kehrt in die aktive Inventar-Sitzung zurueck.
- API-Negativtest: der oeffentliche Endpoint lehnt Account- oder Ownership-Felder ab.
- API-/Service-Test: Challenge und Inventaruebernahme erfolgen nur mit gueltiger interner Sitzung und ordnen genau diesem Account zu.

## FB-TS-07 - Transportauswahl filtert Flashbox korrekt

Ziel:

- Identity/IDE waehlt zwischen `native_mobile`, `wlan` und `flashbox` und erzwingt bei Flashbox eine konkrete Einheit.

Testbare Regeln:

- iOS/iPad zeigt USB/WebSerial-Einschraenkung.
- Keine Flashbox im Inventar -> kaufen, aktivieren oder Referenzprofil-zertifiziert selbst herstellen.
- Flashbox im Inventar -> Auswahl nach Trust-State und Zielprofil.
- `revoked` oder inkompatible Flashbox ist nicht waehlbar.

Mocks:

- Plattform-Erkennung und Inventarliste als Test-Fixtures.

Abnahme:

- UI-Test fuer iOS.
- UI-Test fuer keine Flashbox.
- UI-Test fuer mehrere Flashboxen mit unterschiedlichem Status.

## FB-TS-08 - Device Management Trust-Entscheidung

Ziel:

- Device Management liefert eine klare Entscheidung, ob eine Flashbox einen Auftrag ausfuehren darf.

Testbare Regeln:

- `trusted` + kompatibles Profil -> erlaubt.
- `update_required` -> erlaubt oder blockiert je nach Mindestversion.
- `lost`, `revoked`, `retired`, falsches Profil -> blockiert.
- Entscheidung enthaelt Grundcode fuer UI.

Mocks:

- Build & Deploy wird noch nicht gebraucht.

Abnahme:

- reine Unit-Tests fuer Entscheidungsmatrix.
- API-Contract-Test fuer `can_flash_with_flashbox`.

## FB-TS-08a - Flashbox-Echtheitsnachweis und Kopierschutz per Device-Key

Ziel:

- Eine per WLAN sichtbare Flashbox darf nicht allein durch Sichtbarkeit oder Seriennummer ins Konto uebernommen werden.
- Die konkrete Einheit muss beweisen, dass sie den zu ihr registrierten Device Private Key besitzt.

Testbare Regeln:

- Der Device Private Key verlaesst die Flashbox nie.
- Device Management oder das Provisioning Tool registriert nur Public Key, Zertifikat/Fingerprint und Seriennummer.
- Identity startet den normalen Claim ueber die per WLAN sichtbare Flashbox, aber Device Management akzeptiert ihn erst nach Challenge-Signatur.
- Kauf-/Claim-Code bleibt Fallback, wenn Discovery oder Challenge nicht moeglich ist.
- Factory-Firmware und spaetere Updates referenzieren einen GerNetiX Release Public Key, aber enthalten niemals private GerNetiX-Schluessel.

Abnahme:

- Firmware-Contract-Test findet `/status`, `/claim/challenge`, Hardwareprofil und Release-Public-Key-Vertrag.
- Provisioning-Service-Test findet `wlan_visible_challenge`, `device_private_key_non_exportable` und `challenge_signature` im Flashbox-Manifest.
- Negativtest: Manifest, Factory-Header und Firmware-Skeleton enthalten keinen Private-Key-Block.

Umgesetzt in diesem Slice:

- `firmware/gernetix-flashbox` enthaelt ein ESP32-S3-Contract-Skeleton mit lokalen Status-/Claim-Endpunkten.
- Das Provisioning Tool weist Flashboxen ein public-signed Factory-Firmware-Artefakt und den Copy-Protection-Vertrag zu.
- Automatischer Nachweis: `firmware/gernetix-flashbox/test/flashbox-contract.test.js` und `services/provisioning-tool/test/provisioning-service.test.js`.

## FB-TS-09 - Build-&-Deploy Manifesttypen

Ziel:

- Build & Deploy stellt getrennte, signierte Manifesttypen aus.

Manifesttypen:

- `flashbox_self_update`
- `initial_bootstrap_flash`
- `known_device_recovery_flash`
- `basissoftware_reflash`
- `project_firmware_flash`

Testbare Regeln:

- Manifest braucht Typ, Hardwareprofil, Version, Ablaufzeit, Hash, Signatur, Key-ID.
- falscher Typ darf nicht in anderem Flow akzeptiert werden.
- abgelaufenes Manifest wird abgelehnt.

Mocks:

- Signatur kann im Test mit Test-Key erfolgen.

Abnahme:

- Schema-Test.
- Signatur-Positivtest.
- Negativtests fuer falschen Typ, falschen Hash, abgelaufenes Manifest.

## FB-TS-10 - Flashbox-Manifest-Validator

Ziel:

- Flashbox-Firmwarelogik kann Manifeste pruefen, bevor Firmware geschrieben wird.

Testbare Regeln:

- akzeptiert nur passendes Hardwareprofil.
- akzeptiert nur passenden Manifesttyp fuer den aktuellen Vorgang.
- prueft Signatur, Hash, Ablaufzeit, Anti-Rollback.
- beruecksichtigt Revocation-/Sperrentscheidung.

Mocks:

- Host-Test ohne ESP32.
- C/C++- oder JS-Referenzvalidator moeglich, solange Vertrag identisch ist.

Abnahme:

- Validator-Testmatrix mit Positivfall und allen Negativfaellen.

Umgesetzt in diesem Slice:

- Die Flashbox-Firmware besitzt einen HTTPS-Manifest-Downloadpfad fuer `https://vps.gernetix.example/firmware/flashbox/latest/manifest.json`.
- Lokale Endpunkte `/firmware/download/status` und `/firmware/manifest/check` machen den Downloadvertrag testbar.
- Der Skeleton validiert Mindestfelder wie Manifesttyp, HTTPS-Artefakt-URL, SHA-256 und Signing-Key-ID.
- Der Manifestvertrag trennt `initial_bootstrap_flash` mit `create_new_device_identity` von bekannten Offline-/Recovery-Devices mit `preserve_existing_device_identity` und verpflichtender `target_device_id`.
- Die Manifestpruefung ist als eigenes Firmware-Modul `gernetix_flashbox_manifest_validator` implementiert.
- Das Modul prueft Schema, Manifesttyp, Hardwareprofil, HTTPS-Artefakt-URL, SHA-256-Format, Signing-Key-ID, Manifest-Signatur per mbedTLS und fuehrt eine State-Machine bis `ready_for_artifact_download`.
- `flashboxVerifyArtifactSha256Hex()` stellt die Byte-Hashpruefung fuer den spaeteren Artefaktdownload bereit.
- `/firmware/artifact/verify` laedt Artefaktbytes streamend per HTTPS und prueft SHA-256 ohne vollstaendige RAM-Pufferung.
- Mit dem aktuellen Entwicklungs-Platzhalter fuer `GERNETIX_RELEASE_PUBLIC_KEY_PEM` bleibt die produktive Manifestfreigabe sicher blockiert, bis der echte Release Public Key eingesetzt wird.
- Artefakt-Schreiben bleibt absichtlich getrennt vom Validator und ist noch nicht implementiert.

## Gemeinsamer Firmware-Core

Die Flashbox uebernimmt nicht die komplette Basissoftware, sondern nutzt eine gemeinsame Runtime-Core-Schicht fuer stabile Querschnittsregeln.

Enthalten:

- JSON-Ausgabe und Escaping
- Runtime-Identity-Felder
- GerNetiX-Device-Name- und Hostname-Regeln
- Serialnummer-Formatierung aus ESP32-MAC

Nicht enthalten:

- Projekt-Runtime
- MQTT/Home-Assistant-Funktionen
- Zielgeraete-spezifische Basissoftware-Profile
- Flashbox-spezifischer USB-OTG-Host
- displaylose Status-State-Machine
- Zielgeraete-Flash-State-Machine

Abnahme:

- Flashbox-Contract-Test prueft, dass `gernetix-runtime-core` eingebunden ist.
- Runtime-Core-Contract-Test prueft, dass Basissoftware-kompatible Hostname-/JSON-Vertraege zentral vorhanden sind.

## FB-TS-11 - Flashbox-Selbstupdate-State-Machine

Ziel:

- Selbstupdate ist ohne Hardware als State-Machine testbar.

Aktueller Stand:

- Die Manifest-Validierungs-State-Machine ist im Firmware-Skeleton vorhanden und trennt Schema, Signatur und ausstehenden Artefakt-Hash.
- Der Artefakt-Hash kann nach Manifestfreigabe streamend gegen echte Firmwarebytes geprueft werden.
- `flashbox_self_update` wird nach erfolgreichem Hash in `self_update_dual_slot_preflight_blocked` geroutet.
- Sie erlaubt noch keinen OTA-Slot-Wechsel und schreibt keinen Flash.

Testbare Zustaende:

- Idle
- Manifest geladen
- Artefakt geladen
- Hash geprueft
- Signatur geprueft
- inaktiver Slot geschrieben
- Boot pending
- Boot bestaetigt
- Rollback
- Fehler

Abnahme:

- Simulator-Test fuer Stromausfall an jeder Phase.
- wiederholtes Ausfuehren desselben Updateauftrags bleibt idempotent.
- falsches Manifest fuehrt nie zu geschriebenem gueltigen Slot.

## FB-TS-12 - Zielgeraete-Flash-State-Machine

Ziel:

- Zielgeraete-Flash ueber USB-OTG ist als Ablauf testbar, bevor echte USB-OTG-Hardware stabil ist.

Aktueller Stand:

- Die Manifesttypen fuer initiale Provisionierung und Offline-/Recovery-Flash sind getrennt.
- Bekannte Zielgeraete brauchen `identity_policy = preserve_existing_device_identity` und `target_device_id`.
- Zielgeraete-Manifeste werden nach erfolgreichem Hash in `target_usb_otg_flash_preflight_blocked` geroutet.
- USB-OTG-Target-Detection ist als eigenes Firmwaremodul implementiert.
- `/targets/status` zeigt erkannte USB-OTG-Geraete mit VID/PID, Adresse, Bootloader-Kandidatenstatus und Sperrgrund.
- Serial-/HTTP-Status zeigt "Kein Zielgeraet" oder "Ziel erkannt" mit USB-VID/PID und Bootloaderstatus.
- Espressif VID `303A` wird als ROM-Bootloader-Kandidat behandelt, aber noch nicht als Flashfreigabe.
- Arduino Nano, ESP32 und ESP8266 werden ueber typische USB-Serial-Bridges klassifiziert: CH340/CH9102, CP210x, FTDI, Prolific sowie originale Arduino-VIDs.
- Serial-/HTTP-Status und `/targets/status` zeigen `target_display_name`, `target_kind`, `serial_bridge` und `recommended_action`.
- `target_flash_preflight_allowed` bleibt `false`, bis Chip-Profil-Lesen, Bootloader-Handschlag und Zielwechsel-Sperre implementiert sind.
- Der eigentliche USB-OTG-Zielgeraete-Flash ist noch nicht implementiert.

Testbare Zustaende:

- Ziel nicht verbunden
- Ziel verbunden
- Bootloader erkannt
- Zielprofil gelesen
- Manifest geprueft
- Erase
- Write
- Verify
- Finish
- Abort

Abnahme:

- falscher Zielchip blockiert.
- Zielwechsel waehrend Write fuehrt zu Abort.
- Verify-Fehler fuehrt zu klarer Recovery-Empfehlung.

## FB-TS-12a - Stack-sichere Webserver-Statusantworten

Ziel:

- Status-, Manifest-, Artefakt- und Target-Endpunkte duerfen den Webserver-Stack nicht durch grosse lokale JSON-Puffer ueberlasten.

Testbare Regeln:

- keine lokalen `char body[...]`-Response-Puffer in Webserver-/Statusfunktionen.
- keine lokalen `char numeric[...]`-Hilfspuffer in Statusfunktionen.
- gemeinsamer statischer Response-Buffer `GERNETIX_FLASHBOX_JSON_RESPONSE_BUFFER_BYTES`.
- alle JSON-Statusfunktionen nutzen `flashboxJsonResponseWriter()`.

Umgesetzt in diesem Slice:

- `gernetix_flashbox_json_response` stellt einen statischen 3072-Byte-Response-Buffer bereit.
- `/status`, `/firmware/download/status` und `/targets/status` nutzen den zentralen Buffer.
- Contract-Test blockiert Rueckfaelle auf grosse lokale Stack-Puffer.

Abnahme:

- Automatischer Nachweis: `firmware/gernetix-flashbox/test/flashbox-contract.test.js`.

## FB-TS-12b - Manueller Flashbox-Hardware-Testbuild

Ziel:

- Sven kann die Flashbox-Firmware lokal sinnvoll kompilieren und auf echte Hardware flashen.

Aktueller Stand:

- PlatformIO-Environment `esp32_s3_usb_helper_flashbox` ist explizit.
- 16 MB Flash und PSRAM sind im Buildvertrag gesetzt.
- `partitions_16mb_flashbox.csv` enthaelt zwei 5-MB-OTA-App-Slots und Datenbereich.
- Die Firmware setzt `ARDUINO_USB_MODE` und `ARDUINO_USB_CDC_ON_BOOT` nicht selbst, damit es keine Doppeldefinition mit Board-/Arduino-Core-Makros gibt.
- Die Firmware nutzt keinen Display-/Touch-Treiber; Status laeuft ueber Serial und HTTP.

Abnahme:

- Manueller Build durch Sven: `platformio run -e esp32_s3_usb_helper_flashbox`.
- Manueller Upload durch Sven: `platformio run -e esp32_s3_usb_helper_flashbox -t upload --upload-port COMx`.
- Serial-/HTTP-Status zeigt Boot, Setup-WLAN und USB-Zielgeraetestatus.

## FB-TS-13 - Recovery-Regeln

Ziel:

- Recovery-Faelle sind als Entscheidungen testbar.

Testbare Regeln:

- Flashbox-Selbst-Recovery ersetzt keine Identitaet ohne Support-Rebind.
- bekanntes Zielgeraet-Recovery erhaelt Device-ID und Pairing, wenn moeglich.
- fremdes/leeres Zielgeraet startet neuen Provisioning-/Pairing-Ablauf.
- Account-Recovery bleibt getrennt von Flashbox-Recovery.

Abnahme:

- Contract-Test fuer bekannte, fremde, verlorene und widerrufene Devices.
- UI-Grundtext fuer Recovery-Empfehlung ist aus Reason-Code ableitbar.

## FB-TS-14 - Revocation/Lost blockiert Flash

Ziel:

- Verlust oder Widerruf sperrt neue Flashauftraege Ende-zu-Ende ohne Hardware.

Testbare Kette:

```text
Identity markiert Flashbox als verloren
-> Device Management setzt trust_state = lost
-> Build & Deploy lehnt neues Manifest ab
-> UI zeigt Sperrgrund
```

Abnahme:

- API-Test ueber mehrere Service-Stubs.
- Audit-Event vorhanden.
- kein neues Manifest fuer gesperrte Flashbox.

## FB-TS-15 - Admin-/Support-Sicht

Ziel:

- Support kann Flashbox-Status pruefen, ohne Secrets zu sehen.

Testbare Regeln:

- Suche nach Seriennummer, Device-ID, Account, Claim-Status.
- Anzeige von Trust-State, Firmwareversion, letzter Kontakt, Factory-Batch.
- Recovery-/Rebind-Aktion nur mit Rolle und Audit.
- keine privaten Schluessel, Claim-Codes oder Secrets in der Antwort.

Abnahme:

- API-Test fuer maskierte Daten.
- UI-Test fuer Support-Status.
- Negativtest fuer fehlende Rolle.

## FB-TS-16 - Hardware-in-the-loop Flashbox

Ziel:

- echte Hardware prueft nur noch die Risiken, die Host-Tests nicht abdecken.

Voraussetzungen:

- FB-TS-09 bis FB-TS-12 sind gruen.
- konkrete Zwei-USB-S3-Boardvariante, Pinning, Target-VBUS und Stromversorgung sind festgelegt.

Hardwaretests:

- Boot und Serial-/HTTP-Status.
- WLAN/HTTPS/mTLS-Verbindung.
- Selbstupdate mit Power-Loss.
- USB-OTG-Verbindung zu Ziel-ESP32.
- Zielgeraet schreiben und Verify.
- physischer Recovery-Weg.

Abnahme:

- Testprotokoll mit Boardrevision, Firmwareversion, Zielboard und Ergebnis.

## FB-TS-17 - End-to-End-Abnahme

Ziel:

- Der Produktfluss ist als Gesamtweg belegbar.

Testketten:

1. Katalog -> Webshop-Dummy -> Claim -> Identity-Inventar.
2. Factory-Provisioning -> Device Management `trusted` -> Identity sichtbar.
3. Identity/IDE Transport `flashbox` -> konkrete Flashbox -> signiertes Manifest.
4. Flashbox flasht Zielgeraet und meldet Ergebnis.
5. Zielgeraet-Recovery ueber Flashbox.
6. Verlustmeldung -> Revocation -> Build & Deploy blockiert.

Abnahme:

- jede kritische Entscheidung ist serverseitig validiert.
- UI kann keine Produktgrenze umgehen.
- Recovery erhaelt Identitaet und Pairing dort, wo es fachlich vorgesehen ist.

## Empfohlene Umsetzungsreihenfolge

1. FB-TS-01 und FB-TS-02: Katalog- und Provisioning-Grundschnitt absichern.
2. FB-TS-03 bis FB-TS-05: persistenter Kauf-/Claim-/Inventory-Kern.
3. FB-TS-06 bis FB-TS-08: Identity- und Trust-State sichtbar und entscheidbar machen.
4. FB-TS-09 und FB-TS-10: Manifestvertrag und Validator.
5. FB-TS-11 bis FB-TS-13: Firmware-/Recovery-Logik als Host-/Simulator-Tests.
6. FB-TS-14 und FB-TS-15: Revocation und Support.
7. FB-TS-16: echte Hardware.
8. FB-TS-17: End-to-End-Abnahme.

## Rueckbezug auf Komponenten

Die klassischen Komponentenpakete bleiben als Fachbereiche bestehen, sind aber nicht der primaere Umsetzungsplan:

- Hardware Catalog steckt vor allem in FB-TS-01 und FB-TS-02.
- Provisioning Tool steckt vor allem in FB-TS-02.
- Device Management steckt vor allem in FB-TS-03, FB-TS-08 und FB-TS-14.
- Webshop steckt vor allem in FB-TS-04.
- Identity steckt vor allem in FB-TS-05 bis FB-TS-07.
- Build & Deploy steckt vor allem in FB-TS-09.
- Flashbox-Firmware steckt vor allem in FB-TS-10 bis FB-TS-13 und FB-TS-16.
- Recovery steckt vor allem in FB-TS-13, FB-TS-15 und FB-TS-16.
