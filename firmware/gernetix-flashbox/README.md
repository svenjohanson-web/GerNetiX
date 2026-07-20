# GerNetiX Flashbox Firmware

Dieses Paket ist das Firmware-Skeleton fuer die kaufbare GerNetiX FlashBox auf Basis eines displaylosen ESP32-S3 USB-Helpers.

Status: Contract-Skeleton, noch kein produktiver Hardware-Build.

Codex legt hier Quellcode, Contracts und Host-Tests an. Firmware-Builds, USB-Flashes und OTA-Flashes fuehrt ausschliesslich Sven auf echter Hardware aus.

## Manueller Hardware-Testbuild

Die Firmware ist jetzt so vorbereitet, dass Sven sie sinnvoll lokal kompilieren und auf die Flashbox flashen kann.

```powershell
cd C:\Users\sven_\Desktop\GerNetiX\firmware\gernetix-flashbox
C:\Users\sven_\.platformio\penv\Scripts\platformio.exe run -e esp32_s3_usb_helper_flashbox
```

Upload, wenn die Flashbox am PC im Bootloader/USB-Serial-Modus haengt:

```powershell
C:\Users\sven_\.platformio\penv\Scripts\platformio.exe run -e esp32_s3_usb_helper_flashbox -t upload --upload-port COMx
```

Serielle Diagnose:

```powershell
C:\Users\sven_\.platformio\penv\Scripts\platformio.exe device monitor -b 115200 --port COMx
```

Das PlatformIO-Ziel ist auf 16 MB Flash, PSRAM und eine 16-MB-Partitionstabelle mit zwei OTA-App-Slots vorbereitet. Die Firmware definiert `ARDUINO_USB_MODE` und `ARDUINO_USB_CDC_ON_BOOT` nicht mehr selbst, weil dein Board-/Arduino-Core diese Makros bereits setzt und sonst Doppeldefinitionen im Build entstehen.

Display und Touch sind aus dem FlashBox-Profil entfernt. Die Firmware nutzt eine displaylose Status-Fassade: Ereignisse gehen auf Serial und die lokalen HTTP-Endpunkte. Das bisherige ES3C28P-Displayboard bleibt im Hardware-Katalog ein normales Touch-Processor-Board, ist aber nicht mehr das FlashBox-Produkt.

## Rolle der Flashbox

Die Flashbox ist kein normales Zielgeraet. Sie ist ein inventarisierbares GerNetiX-Werkzeuggeraet, das spaeter andere ESP32-Zielgeraete per USB-OTG flashen darf.

Sie muss deshalb drei Dinge beweisen:

1. Sie ist eine echte GerNetiX Flashbox mit bekannter Seriennummer.
2. Sie besitzt den zu ihr registrierten Device Private Key.
3. Sie akzeptiert nur oeffentliche, signierte GerNetiX Firmware-Manifeste.

## Sicherheitsvertrag

- Der Device Private Key verlaesst die Flashbox nie.
- In dieser Firmware liegen keine privaten GerNetiX-Schluessel.
- Der eingebettete GerNetiX Release Public Key dient nur zum Pruefen signierter Manifeste.
- WLAN-Sichtbarkeit allein ist kein Besitz- oder Echtheitsnachweis.
- Identity darf eine per WLAN sichtbare Flashbox erst inventarisieren, nachdem Device Management eine Challenge-Signatur mit dem registrierten Public Key verifiziert hat.
- Ein Kauf-/Claim-Code bleibt nur Fallback, zum Beispiel wenn Discovery oder Challenge temporär nicht moeglich ist.

## Stack-Sicherheitsregel fuer den lokalen Webserver

Die Flashbox-Webserver-Handler duerfen keine grossen JSON-Puffer auf dem Request-Stack anlegen. Fruehere Abstuerze durch zu grosse Stack-Frames werden deshalb im Firmware-Vertrag explizit vermieden.

Aktueller Vertrag:

- grosser JSON-Response-Puffer liegt statisch in `gernetix_flashbox_json_response`
- Buffer-Groesse: `GERNETIX_FLASHBOX_JSON_RESPONSE_BUFFER_BYTES = 3072`
- Status-Endpunkte nutzen `flashboxJsonResponseWriter()`
- Zahlen werden ueber `flashboxJsonAppendInt()` und `flashboxJsonAppendUnsigned()` formatiert
- Contract-Test blockiert Rueckfaelle wie `char body[1024]`, `char body[1792]` oder `char numeric[32]` in Request-/Statusfunktionen

Der Buffer ist bewusst ein einzelner globaler Response-Arbeitspuffer, weil der Arduino-`WebServer` in diesem Skeleton synchron arbeitet. Wenn spaeter ein asynchroner Server oder parallele Tasks hinzukommen, muss diese Stelle auf pro-Request- oder mutex-geschuetzte Pufferung erweitert werden.

## Lokale Contract-Endpunkte

Das Skeleton stellt fuer die naechste Integrationsscheibe lokale HTTP-Endpunkte bereit:

| Methode | Pfad | Zweck |
| --- | --- | --- |
| `GET` | `/` | Liefert eine kleine JSON-Diagnose statt `not_found`, wenn der Browser die Flashbox ohne Pfad oeffnet. |
| `GET` | `/status` | Liefert Rolle, Hardwareprofil, Firmwarestand und Claim-Modus. |
| `GET` | `/wifi/status` | Liefert Setup-AP, verbundenen WLAN-Status, IP-Adresse, letzte sichtbare SSID-Liste und Scan-Zustand. |
| `GET` | `/power/status` | Liefert Battery-ADC, Power-Switching-Policy und ob Software-VBUS-Umschaltung im aktuellen Hardwareprofil verfuegbar ist. |
| `POST` | `/claim/challenge` | Nimmt eine Server-Challenge entgegen und liefert spaeter die Device-Signatur. |
| `GET` | `/firmware/manifest-public-key` | Liefert den eingebetteten GerNetiX Release Public Key fuer Diagnose/Vertragstests. |
| `GET` | `/firmware/download/status` | Liefert den aktuellen Manifest-/Downloadstatus. |
| `POST` | `/firmware/manifest/check` | Laedt ein HTTPS-Manifest und prueft den Mindestvertrag, schreibt aber noch kein Artefakt. |
| `POST` | `/firmware/artifact/verify` | Laedt nach gueltigem Manifest das Artefakt streamend, prueft SHA-256 und blockiert danach bewusst vor jedem Schreiben. |
| `GET` | `/targets/status` | Liefert den aktuellen USB-OTG-Zielgeraetestatus mit VID/PID, Bootloader-Kandidat, VBUS-/Power-Status und Preflight-Sperrgrund. |

## Displayloser Status-Vertrag

Die FlashBox wird wie der Serial Helper behandelt: kein lokales Display, kein Touch. Der Firmware-Vertrag bleibt trotzdem explizit statusfaehig. Die Status-Fassade meldet per Serial und HTTP:

- GerNetiX Flashbox Bootstatus
- Seriennummer und Firmwareversion
- Setup-WLAN-SSID
- bei WLAN nicht verbunden: gefundene SSIDs aus dem periodischen Scan
- bei WLAN verbunden: verbundene SSID und IP-Adresse
- Claim-/Challenge-Zustand
- USB-OTG-Zielgeraetestatus
- Fehler wie zu grosse Challenge

Der WLAN-Scan ist bewusst ruhig ausgelegt: kein zyklischer 5-Sekunden-Refresh, sondern initialer asynchroner Scan und danach hoechstens periodische Aktualisierung bei geaenderter stabiler SSID-Liste. Wenn ein USB-OTG-Zielgeraet erkannt ist, darf dessen Status Vorrang vor der WLAN-SSID-Liste behalten.

Die internen Funktionsnamen `flashboxDisplayShow...` bleiben vorerst als Kompatibilitaetsfassade bestehen. Sie treiben kein Display mehr an, sondern schreiben `flashbox-status`-Zeilen auf Serial. Das verhindert Umbau-Laerm im Rest der Firmware und macht den spaeteren Wechsel auf eine andere HMI optional.

Der produktive naechste Schritt ist die echte Signaturfunktion auf dem ESP32-S3 und die Ablage des Device Private Keys in geschuetztem NVS/Secure-Element- oder gleichwertigem Factory-Prozess.

## Firmware-Downloadpfad

Der Manifest-Downloadpfad ist im Skeleton jetzt technisch angelegt:

- Default-Manifest: `https://vps.gernetix.example/firmware/flashbox/latest/manifest.json`
- HTTPS-only per `WiFiClientSecure`
- TLS-Trust-Anker-Platzhalter `GERNETIX_FLASHBOX_HTTPS_ROOT_CA_PEM`
- maximale Manifestgroesse: 8192 Byte
- akzeptierte Manifesttypen: `flashbox_self_update`, `initial_bootstrap_flash`, `known_device_recovery_flash`, `basissoftware_reflash`, `project_firmware_flash`
- Pflichtfelder im Manifest: Typ, Hardwareprofil, Artefakt-URL, SHA-256, Signing-Key-ID und Manifest-Signatur

Die Manifestpruefung ist als eigenes Firmware-Modul `gernetix_flashbox_manifest_validator` aus dem HTTP-Downloader herausgezogen. Sie prueft zuerst Schema, Manifesttyp, Identity-Policy, HTTPS-Artefakt-URL, SHA-256-Format und Signing-Key-ID. Danach wird die Signatur mit `GERNETIX_RELEASE_PUBLIC_KEY_PEM` ueber mbedTLS gegen den signierten Payload verifiziert.

Die State-Machine trennt sichtbar:

- `schema_pending`
- `schema_checked`
- `signature_checking`
- `artifact_hash_pending`
- `ready_for_artifact_download`

`artifact_download_allowed` darf erst nach gueltiger Manifestsignatur auf `true` gehen. Danach kann `/firmware/artifact/verify` die Firmwarebytes per HTTPS laden, ohne sie in RAM komplett vorzuhalten. Der Downloader liest den Stream in 1024-Byte-Bloecken, berechnet SHA-256 und vergleicht den Hash mit dem Manifest.

Nach erfolgreicher Hashpruefung wird `hash_verified = true`, aber `artifact_write_allowed` bleibt `false`. Das Schreiben laeuft ueber eine eigene State-Machine:

| Manifesttyp | geplanter Schreibweg | aktueller Zustand |
| --- | --- | --- |
| `flashbox_self_update` | `flashbox_self_update_dual_slot` | `self_update_dual_slot_preflight_blocked` |
| Zielgeraete-Manifeste | `target_device_usb_otg_flash` | `target_usb_otg_flash_preflight_blocked` |

Wichtig: Der Release-Public-Key ist im Skeleton weiterhin ein Entwicklungs-Platzhalter. Auf echter Hardware wird deshalb `release_public_key_not_configured` liefern, bis der produktive GerNetiX Release Public Key eingesetzt ist. Das ist absichtlich sicher. Artefakt-Schreiben, OTA-Slot-Wechsel und USB-OTG-Zielgeraete-Flash sind weiterhin nicht implementiert.

## Flashbox-Use-Cases

Die Flashbox trennt zwei Produktfaelle strikt:

| Use Case | Manifesttyp | Identitaetsregel |
| --- | --- | --- |
| Initiale Firmware-Provisionierung fuer leere/neue Boards | `initial_bootstrap_flash` | `identity_policy = create_new_device_identity` |
| Offline-/No-USB-/Recovery-Flash fuer bekannte Devices | `known_device_recovery_flash`, `basissoftware_reflash`, `project_firmware_flash` | `identity_policy = preserve_existing_device_identity` und `target_device_id` ist Pflicht |

Damit darf ein erster Bootstrap eine neue Device-Identitaet vorbereiten. Ein Flash fuer ein bekanntes oder offline betriebenes Device darf dagegen Device-ID, Pairing und Credentials nicht heimlich ersetzen.

## USB-OTG-Zielgeraete-Erkennung

Die Flashbox besitzt jetzt ein eigenes Target-Detection-Modul `gernetix_flashbox_target_detection`.

Es startet einen ESP-IDF-USB-Host-Client, verarbeitet `USB_HOST_CLIENT_EVENT_NEW_DEV`, liest den USB-Device-Descriptor und stellt den erkannten Kandidaten ueber Webserver und Display dar.

Wichtig fuer ungepowerte Zielboards: USB-OTG-Daten allein reichen nicht. Ein Zielgeraet enumeriert nur, wenn es versorgt wird. Das neue FlashBox-Produkt wird deshalb als Zwei-USB-S3-Helper modelliert:

- Control-/Upstream-Port: Stromversorgung, Service, Factory-/Admin-Flash der FlashBox selbst
- Target-/Downstream-Port: USB-Host-Port fuer das zu flashende Zielboard

Ob der Target-Port ungepowerte Zielboards selbst mit 5V-VBUS versorgen kann, ist noch eine Hardware-Verifikation des neuen Boards. Bis dieser Test bestaetigt ist, melden `/power/status` und `/targets/status` `two_usb_s3_helper_target_vbus_pending_verification`; ungepowerte Zielboards muessen extern versorgt werden oder bis zum verifizierten FlashBox-Board warten.

Statusfelder unter `/targets/status`:

- `state`
- `connection_state`
- `bootloader_state`
- `chip_family`
- `usb_vid`
- `usb_pid`
- `usb_address`
- `vbus_power_mode`
- `target_power_policy`
- `vbus_control_available`
- `detected_device_count`
- `esp_rom_bootloader_likely`
- `target_flash_preflight_allowed`
- `error`

Die Erkennung klassifiziert aktuell:

| USB VID/PID | Anzeige | Typische Boards |
| --- | --- | --- |
| `303A:*` | `ESP32 native USB` | ESP32-S2/S3/C3/C6 native USB / ROM-Kandidat |
| `1A86:7523`, `1A86:5523` | `Arduino Nano / ESP via CH340` | Arduino Nano Clone, ESP8266/ESP32 Devboards |
| `1A86:55D4` | `Arduino Nano / ESP via CH340` / CH9102 | neuere WCH USB-Serial-Boards |
| `10C4:EA60`, `10C4:EA70` | `ESP32 / ESP8266 via CP210x` | viele ESP32/ESP8266 Devboards |
| `0403:6001`, `0403:6015` | `Arduino / ESP via FTDI` | FTDI-basierte Arduino-/ESP-Adapter |
| `2341:*`, `2A03:*` | `Arduino USB device` | originale Arduino-Boards |
| `067B:2303` | `Arduino / ESP via Prolific` | PL2303 USB-Serial-Adapter |

Espressif-Geraete mit VID `303A` werden als `rom_bootloader_candidate` behandelt. USB-Serial-Bridges wie CH340, CP210x oder FTDI werden als `serial_bridge_detected` behandelt, weil VID/PID allein noch nicht beweist, ob dahinter ein Nano, ESP32 oder ESP8266 im Bootloader haengt. Das ist noch kein Flash-Freigabesignal, sondern die erste Erkennungsstufe. Danach fehlen bewusst noch serieller Bootloader-Handschlag, Chip-Profil-Lesen, Zielwechsel-Sperre und Flash-Preflight. Deshalb bleibt `target_flash_preflight_allowed = false`.

## Wiederverwendung aus der Basissoftware-DNA

Die Flashbox nutzt den gemeinsamen Firmware-Kern `firmware/shared/gernetix-runtime-core`.

Dadurch sind diese Regeln nicht mehr Flashbox-spezifisch dupliziert:

- JSON-Ausgabe und Escaping
- Runtime-Identity-Felder wie `role`, `serial_number`, `hardware_profile_id`, `firmware_version`, `firmware_basis`
- GerNetiX-Device-Name- und Hostname-Regeln aus der Basissoftware-DNA
- Serialnummer-Formatierung aus ESP32-MAC

Die Basissoftware kann denselben Core schrittweise fuer ihre `provisioning_config`-Statusausgabe uebernehmen. Die Flashbox bleibt trotzdem ein eigenes Firmwarepaket, weil Display, USB-OTG-Host, Zielgeraete-Flash und Werkzeug-Trustgrenze nicht zur normalen Zielgeraete-Basissoftware gehoeren.
