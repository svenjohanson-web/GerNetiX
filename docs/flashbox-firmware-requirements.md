# GerNetiX Flashbox Firmware - Anforderungen

## Zielbild

Die GerNetiX FlashBox ist ein eigenstaendiges, displayloses ESP32-S3-Helper-Geraet mit 16 MB Flash, 8 MB RAM/PSRAM und USB-Host-Faehigkeit. Sie soll als dritter Flash-Weg neben direktem USB-Flash und OTA-Flash andere ESP32-Zielgeraete initial oder im Recovery-Fall flashen koennen.

Die Flashbox ist kein normales Kunden-Board mit GerNetiX-Basissoftware. Sie ist ein eigenes Werkzeugprodukt mit eigener Firmware, eigener Update-Strategie, eigener Bedienoberflaeche und eigenem Sicherheitsmodell.

Das systemweite Zusammenspiel mit Identity, Hardware Catalog, Webshop, Provisioning Tool, Device Management und Recovery ist in [GerNetiX Flashbox - Systemzusammenspiel](flashbox-system-integration.md) verbindlich beschrieben.

## Bekannte Hardware-Annahme

- ESP32-S3-Helper-Board
- 16 MB interner Flash
- 8 MB RAM/PSRAM
- displayloser Statusbetrieb ueber Serial und lokale HTTP-Endpunkte
- ein Control-/Upstream-USB-Port fuer Stromversorgung, Service und Factory-/Admin-Flash
- ein Target-/Downstream-USB-Port fuer das zu flashende Zielboard
- WLAN fuer Verbindung zu GerNetiX/VPS

Die genaue neue Zwei-USB-S3-Boardvariante, Pinbelegung, VBUS-Schaltung und Stromversorgung muessen vor produktiver Freigabe im Hardware Catalog oder in einem FlashBox-Hardwareprofil festgelegt werden. Display und Touch gehoeren nicht mehr zum FlashBox-MVP.

## Inventarisierung und Produktgrenze

Die Flashbox ist ein inventarisierbares GerNetiX-Werkzeuggeraet. Sie wird im Hardware Catalog als eigene Hardwareklasse `flashbox` gefuehrt und gehoert als konkrete Einheit mit Seriennummer in das Account-Inventar.

Verbindliche Produktregel:

- Flashboxen koennen nicht vom Nutzer selbst als GerNetiX-Flashbox angelegt werden.
- Eine technisch aehnliche Selbstbau-Hardware bleibt normale Community- oder Zielhardware, aber keine vertrauenswuerdige GerNetiX-Flashbox.
- Der Weg ins Account-Inventar fuehrt ueber Webshop-Kauf, Produktion/Provisionierung oder eine explizite Admin-/Support-Korrektur.
- Jeder Flashbox-basierte Flash- oder Provisioning-Ablauf muss eine konkrete inventarisierte Flashbox auswaehlen, nicht nur "Flashbox" als abstrakte Option.

Das logische Datenmodell ist in [GerNetiX Flashbox - Inventar- und Katalog-Datenmodell](flashbox-inventory-data-model.md) festgelegt.

## Kernaufgaben

1. Die Flashbox aktualisiert sich selbst extrem ausfallsicher.
2. Die Flashbox verbindet sich mit GerNetiX und laedt passende Firmware-Artefakte fuer Zielgeraete.
3. Die Flashbox erkennt Zielgeraete ueber USB-OTG.
4. Die Flashbox flasht Zielgeraete kontrolliert, nachvollziehbar und mit Verifikation.
5. Die Flashbox meldet jeden kritischen Zustand eindeutig ueber Serial und lokale HTTP-Statusendpunkte.

## Nicht-Ziele fuer den ersten Wurf

- kein Checkout, keine Shop-Logik und keine Zahlungsabwicklung in der Flashbox
- keine allgemeine Entwicklungs-IDE auf der Flashbox
- kein beliebiges Hochladen lokaler Firmwaredateien
- kein Zugriff auf GerNetiX-Quellcode oder interne Build-Artefakte
- kein Flashen unsignierter oder unversionierter Images
- keine automatische Veraenderung von Account-, Device- oder Lizenzdaten ohne expliziten GerNetiX-Serververtrag

## Selbstupdate der Flashbox

Die Flashbox muss eigensicherer sein als ein normales Zielgeraet. Ein fehlgeschlagenes Selbstupdate darf die Flashbox nicht unbrauchbar machen.

Verbindliche Anforderungen:

- A/B-Update oder funktional gleichwertiges Dual-Slot-Verfahren fuer die Flashbox-Hauptfirmware.
- Ein neues Image wird erst nach vollstaendigem Download, SHA-256-Pruefung, Signaturpruefung und erfolgreichem Boot-/Diagnoseabschluss als gueltig bestaetigt.
- Ein nicht bestaetigtes Image wird automatisch verworfen oder der vorherige Slot bleibt startfaehig.
- Update-Manifeste sind signiert, zeitlich begrenzt und enthalten mindestens Version, Zielhardwareprofil, Partitionsprofil, Artefakt-URL, SHA-256, Groesse und Signatur-Key-ID.
- Anti-Rollback-Regeln verhindern Downgrades auf bekannte unsichere Versionen.
- Die Flashbox darf niemals ihren Bootloader, ihre Partitionstabelle, ihre Trust-Anker oder ihre Geraeteidentitaet durch ein normales Online-Update ueberschreiben.
- Stromausfall, Reset, WLAN-Abbruch oder Serverfehler waehrend Download oder Schreiben fuehren immer zur letzten gueltigen Flashbox-Firmware zurueck.
- Der Updatevorgang ist idempotent: Wird derselbe Updateauftrag mehrfach ausgefuehrt, entsteht kein anderer Endzustand.
- Lieber wird ein Pruefschritt wiederholt, als ein unsicherer Zustand akzeptiert.
- Brownout-Erkennung, Watchdog und klarer Bootstatus sind Pflicht.
- Serial-/HTTP-Status zeigt mindestens: aktuelle Version, Update verfuegbar, Download, Schreiben, Pruefen, Neustart, Erfolg, Rollback, Fehlerursache.

Akzeptanzkriterien:

- Power-Loss-Test bei Manifestdownload, Artefaktdownload, Schreiben, Verify und erstem Boot des neuen Images.
- Falsche Signatur wird abgelehnt.
- Falscher Hash wird abgelehnt.
- Unpassendes Hardwareprofil wird abgelehnt.
- Server nicht erreichbar darf vorhandene Funktion nicht blockieren.
- Wiederholtes Ausfuehren desselben Updates bleibt sicher.
- Mindestens ein physischer Rettungsweg bleibt dokumentiert.

## USB-Rettungsweg der Flashbox

Ein USB-Rettungsweg soll nicht der normale Betriebsweg sein, aber als letzter Anker existieren.

Offene Entwurfsoptionen:

1. ESP-ROM-Downloadmodus per BOOT/RESET bleibt erreichbar.
2. Ein eigener, kleiner Recovery-Modus bleibt in einer geschuetzten Partition.
3. Produktionsgeraete nutzen Secure Boot und Flash Encryption; Recovery akzeptiert nur signierte GerNetiX-Images.

Noch zu klaeren:

- Welche Tastenkombination oder welches Eingabeelement aktiviert Recovery?
- Wird Recovery lokal sichtbar bestaetigt, z. B. ueber HTTP-Status, Serial-Log oder spaetere optionale LED?
- Darf Recovery die Geraeteidentitaet behalten, oder gibt es einen separaten Factory-Rebind-Prozess?
- Wie wird verhindert, dass Recovery als einfacher Kopier- oder Manipulationsweg missbraucht wird?

## Verbindung zum VPS / REST-Vertrag

Die Flashbox muss Firmware-Artefakte fuer Zielgeraete von GerNetiX laden koennen.

Verbindliche Anforderungen:

- REST/HTTPS-Verbindung zu einem GerNetiX-Endpunkt fuer Flashbox-Manifeste.
- TLS-Pruefung mit vertrauenswuerdigem Root oder gepinntem GerNetiX-Trust-Anker.
- Manifest zuerst, Firmwarebytes danach.
- Manifest enthaelt Zielgeraet, Zielchip, Boardprofil, Flashgroesse, Partitionslayout, Image-Art, Version, SHA-256 und Signatur.
- Firmwarebytes werden nur geschrieben, wenn Manifest, Signatur, Zielprofil und Hash zusammenpassen.
- Downloads muessen abbrechbar und wiederholbar sein.
- Optionaler Cache ist erlaubt, aber nur mit verifiziertem Manifest und Hash.
- Ein Cache darf nie eine neuere Sperr-/Widerrufsentscheidung des Servers umgehen.

Zu klaeren:

- Braucht jede Flashbox eine eigene Geraeteidentitaet und mTLS?
- Wird der Zugriff auf Flashbox-Firmware und Zielgeraete-Firmware account-, produkt- oder seriennummerngebunden?
- Wie werden Firmware-Artefakte fuer Minimalsoftware, Bootstrap und Basissoftware im Server unterschieden?

## USB-OTG-Host und Zielgeraete

Die Flashbox muss als USB-Host Zielgeraete ansprechen.

Verbindliche Anforderungen:

- USB-OTG-Hostmodus fuer ESP32-Zielgeraete im ROM-Downloadmodus.
- Die Flashbox muss fuer ungepowerte Zielboards eine verifizierte 5V-VBUS-Versorgung mit Strombegrenzung bereitstellen oder diese Zielboards klar als extern zu versorgen kennzeichnen.
- Solange kein VBUS-Power-Switch und keine Stromgrenze im Hardwareprofil nachgewiesen sind, duerfen ungepowerte Zielboards nicht als unterstuetzter Normalfall gelten.
- Ein Akkuanschluss am Flashbox-Board reicht nicht als Nachweis fuer USB-Host-VBUS. Die Firmware muss Batterie-Messung und Software-VBUS-Umschaltbarkeit getrennt ausweisen.
- Eine Software-Umschaltung fuer Zielgeraete-VBUS darf erst aktiviert werden, wenn Boost-Enable, VBUS-Source-Select und Current-Limit-Enable im Schaltplan eindeutig einem GPIO zugeordnet und hardwaregetestet sind.
- Der alte ES3C28P-Schaltplan bleibt nur ein Nachweis fuer das separate Touch-Processor-Board. Er ist kein FlashBox-Hardwareprofil mehr. Fuer die neue FlashBox gilt: Target-USB-VBUS darf erst als verfuegbar gelten, wenn das Zwei-USB-S3-Board 5V-VBUS, Power-Switch, Strombegrenzung und Role-Verhalten im Hardwaretest bestaetigt hat.
- Erkennen, ob ein Zielgeraet verbunden ist.
- Erkennen, ob das Zielgeraet im Bootloader/Downloadmodus ist.
- Zielchip, Flashgroesse und relevante Bootloaderdaten muessen gelesen oder sicher abgeleitet werden.
- Falscher Zielchip oder unpassendes Boardprofil blockiert den Flashvorgang.
- Zielgeraet darf waehrend des Schreibens nicht beliebig gewechselt werden koennen, ohne den Vorgang abzubrechen.
- Schreiben erfolgt in klaren Phasen: Preflight, Erase, Write, Verify, optional Provisioning, Abschluss.
- Nach dem Schreiben wird mindestens der geschriebene Hash oder eine gleichwertige Integritaetspruefung verifiziert.
- Fehler werden lokal angezeigt und in einem Ringpuffer protokolliert.

Zu klaeren:

- Wie wird das Zielgeraet mit Strom versorgt, wenn es selbst keine Spannung hat?
- Hat die konkrete Flashbox-Hardware eine 5V-VBUS-Schaltung, einen Power-Switch, Strombegrenzung und optional Strommessung?
- Gibt es bestaetigte GPIOs fuer Boost-Enable, VBUS-Source-Select und Current-Limit-Enable, oder arbeitet die Stromversorgung nur automatisch ueber Lade-/Entlade-Management?
- Gibt es Zielboards, die extern versorgt werden muessen?
- Welche ESP32-Familien werden zuerst unterstuetzt: ESP32, ESP32-S3, ESP32-C3, ESP32-C6?
- Muss die Flashbox Reset/BOOT-Leitungen des Zielgeraets aktiv steuern oder fuehrt der Nutzer diese Schritte manuell aus?

## Firmwarearten fuer Zielgeraete

Die Flashbox muss mindestens drei Artefaktklassen unterscheiden:

| Artefakt | Zweck | Besonderheit |
| --- | --- | --- |
| Minimal-/Bootstrap-Firmware | Zielgeraet so weit starten, dass WLAN/BLE oder weiterer Setup moeglich wird | klein, initial, nicht die spaetere Basissoftware |
| GerNetiX-Basissoftware | normale Runtime fuer Kunden- und Lernprojekte | versioniert, signiert, mit Profil full/medium/low |
| Recovery-/Rettungsimage | bekanntes Geraet wiederherstellen | darf Identitaet/Pairing nicht unkontrolliert ersetzen |

Die Flashbox darf nicht nur "eine firmware.bin" kennen. Sie muss verstehen, welche Klasse geschrieben wird und welche Folgen dies fuer Zielgeraet, Provisioning und spaetere Updates hat.

## Displaylose Bedien- und Statusoberflaeche

Die FlashBox besitzt im MVP kein Display und keinen Touch. Status, Diagnose und sichere Bedienfuehrung laufen ueber Serial, lokale HTTP-Endpunkte und spaeter optional ueber einfache LEDs oder App-/Identity-UI.

Der alte ILI9341/Touch-Testtreiber gehoert nicht mehr zum FlashBox-MVP. Falls spaeter eine FlashBox-Variante mit lokaler HMI entsteht, muss sie als eigenes Hardwareprofil und eigenes UI-Paket dokumentiert werden.

Mindestanzeigen:

- Flashbox-Status: online/offline, Firmwareversion, Updatezustand
- WLAN nicht verbunden: gefundene SSIDs anzeigen, damit der Nutzer sieht, welche Netze erreichbar sind
- WLAN verbunden: verbundene SSID und IP-Adresse anzeigen
- WLAN-/Status-Aktualisierung darf nicht als enger zyklischer Refresh laufen; der Status soll nur bei echtem Zustandswechsel oder geaenderter stabiler Scanliste neu ausgegeben werden
- Lokale HTTP-Diagnose muss `/`, `/status`, `/wifi/status` und `/targets/status` bereitstellen, damit ein Browseraufruf nicht faelschlich wie ein Webserverfehler wirkt
- Zielgeraet erkannt / nicht erkannt
- Zielchip und Boardprofil
- ausgewaehltes Firmware-Artefakt
- Warnung vor Erase/Flash
- Fortschritt je Phase
- eindeutiger Erfolg
- eindeutiger Fehler mit naechstem Schritt
- Hinweis, wenn der Nutzer BOOT/RESET am Zielgeraet betaetigen muss

Fehlertexte muessen handlungsorientiert sein: "USB-Kabel pruefen", "Zielgeraet in Bootloader-Modus bringen", "Firmware passt nicht zu diesem Board", "Download wiederholen", "GerNetiX-Server nicht erreichbar".

## Sicherheitsanforderungen

- Nur signierte GerNetiX-Manifeste und signierte/verifizierte Firmwareartefakte.
- Die Flashbox besitzt einen eigenen Device Private Key als Echtheitsnachweis; dieser Schluessel verlaesst die Einheit nie.
- Der lokale Claim ueber WLAN braucht eine Server-Challenge und eine Device-Signatur. Sichtbarkeit im WLAN oder Seriennummer allein reichen nicht.
- Ein Kauf-/Claim-Code bleibt nur ein Fallback-Weg fuer Verkauf/Support, nicht der normale kryptographische Besitznachweis.
- Die Flashbox enthaelt nur GerNetiX Release Public Keys zur Manifestpruefung, niemals GerNetiX Release Private Keys.
- Keine privaten Schluessel, Secrets oder internen Buildinformationen in Logs oder Statusausgaben.
- Produktions-Flashboxen sollen Secure Boot und Flash Encryption nutzen.
- Debug-Schnittstellen sind in Produktion gesperrt oder streng kontrolliert.
- OTA-/Self-Update-Schluessel der Flashbox sind getrennt von Zielgeraete-OTA-Schluesseln.
- Zielgeraete-Firmware wird als Binary ausgeliefert, nie als Quellcode oder internes Buildpaket.
- Die Flashbox darf keine fremden oder vom Nutzer hochgeladenen Images als vertrauenswuerdig behandeln.
- Lokale Webserver-Handler duerfen keine grossen JSON-Response-Puffer auf dem Request-Stack anlegen. JSON-Statusantworten muessen den zentralen statischen Flashbox-Response-Buffer verwenden.

## Protokollierung und Diagnose

Die Flashbox braucht einen lokalen Diagnosepuffer:

- letzte Selbstupdate-Ereignisse
- letzte Zielgeraete-Flashvorgaenge
- Manifest-ID, Version, Zielprofil, Hash, Fehlercode
- keine WLAN-Passwoerter, privaten Schluessel, Aktivierungscodes oder personenbezogenen Daten

Optional spaeter:

- Upload eines Supportberichts nach ausdruecklicher Nutzerbestaetigung
- Anzeige einer kurzen Support-ID

## Erste Arbeitspakete

1. Flashbox-Hardwareprofil festlegen: Zwei-USB-S3-Board, Control-Port, Target-Port, USB-Host, VBUS, Flash- und RAM-Groesse.
2. Hardware-Catalog-Klasse `flashbox` mit kaufbarem SKU, technischem Hardwareprofil und Capability-Profil definieren.
3. Inventar-/Claim-Datenmodell fuer konkrete Flashbox-Einheiten mit Seriennummer, Besitz, Firmwarestatus und Trust-State definieren.
4. Provisioning-/Flash-Wegauswahl definieren: `native_mobile`, `wlan`, `flashbox`; bei `flashbox` konkrete Account-Flashbox erzwingen.
5. Partitions- und Selbstupdate-Konzept fuer 16 MB definieren.
6. Flashbox-Manifestvertrag fuer Selbstupdate definieren.
7. Zielgeraete-Firmwaremanifest fuer REST/VPS definieren.
8. USB-OTG-Host-Prototyp fuer ESP32-ROM-Bootloader definieren.
9. Zielgeraete-Flash-State-Machine definieren: Detect, Preflight, Download, Erase, Write, Verify, Finish.
10. Displaylose Status-State-Machine definieren.
11. Security- und Trust-Anker-Modell festlegen.
12. Power-Loss- und Negativtestmatrix definieren.
13. Minimalen Firmware-Prototyp erst danach erstellen.

## Aktueller Firmware-Skeleton-Stand

Der erste Contract-Skeleton liegt unter `firmware/gernetix-flashbox`.

Er definiert:

- ESP32-S3 PlatformIO-Ziel `esp32_s3_usb_helper_flashbox`
- Hardwareprofil `hardware.flashbox.esp32_s3_usb_helper`
- lokalen Status-Endpunkt `/status`
- lokalen Challenge-Endpunkt `/claim/challenge`
- Diagnose-Endpunkt `/firmware/manifest-public-key`
- eingebetteten Release-Public-Key-Platzhalter `GERNETIX_RELEASE_PUBLIC_KEY_PEM`
- Displaylose Status-Fassade mit Serial-Ausgabe und HTTP-Status
- Start-/Setup-/Claim-/Fehlerstatus ueber Serial/HTTP
- Wiederverwendung des gemeinsamen Firmware-Kerns `firmware/shared/gernetix-runtime-core` fuer JSON, Runtime-Identity-Felder, GerNetiX-Hostname-/Device-Name-Regeln und Serialnummer-Formatierung
- HTTPS-Manifest-Downloadpfad mit `/firmware/download/status` und `/firmware/manifest/check`
- Manifest-Validator-Modul mit Schema-/Use-Case-Pruefung, Release-Key-ID-Pruefung, mbedTLS-Signaturpruefung, SHA-256-Artefaktpruefer und State-Machine bis `ready_for_artifact_download`
- Artefakt-Verify-Endpunkt `/firmware/artifact/verify`, der Firmwarebytes streamend per HTTPS laedt und den SHA-256-Hash gegen das Manifest prueft
- blockierte Write-State-Machine, die `flashbox_self_update` in den Dual-Slot-Preflight und Zielgeraete-Manifeste in den USB-OTG-Flash-Preflight routet
- USB-OTG-Target-Detection-Modul mit `/targets/status`, Serial-/HTTP-Status, USB-Host-Eventverarbeitung, VID/PID-Descriptor-Lesen und Espressif-ROM-Bootloader-Kandidatenstatus
- USB-OTG-Klassifikation fuer typische Arduino-/ESP-USB-Serial-Bridges: CH340/CH9102, CP210x, FTDI, Prolific, Arduino-VIDs und Espressif native USB
- Stack-sichere JSON-Response-Erzeugung ueber `gernetix_flashbox_json_response` mit statischem 3072-Byte-Buffer statt grosser lokaler `char body[...]`-Arrays in Webserver-Handlern
- PlatformIO-Testziel fuer manuelles Kompilieren/Flashen mit 16 MB Flash, PSRAM-Flag und 16-MB-Partitionstabelle mit OTA-Slots
- Kein Display-/Touch-Treiber im FlashBox-MVP, damit der Helper wie der Serial Helper klein und robust bleibt
- Manifesttypen trennen initiale Provisionierung (`initial_bootstrap_flash`) von bekannten Offline-/Recovery-Devices (`known_device_recovery_flash`, `basissoftware_reflash`, `project_firmware_flash`)

Der Skeleton enthaelt noch keinen produktiven Release Public Key, kein Artefakt-Schreiben und keinen USB-OTG-Flash. Mit dem Platzhalter-Key bleibt die Manifestpruefung deshalb sicher blockiert. Wenn spaeter ein echtes Manifest gueltig ist, bleibt nach dem Hash-Verify weiterhin die Write-State-Machine gesperrt. Die USB-OTG-Erkennung zeigt angeschlossene Kandidaten wie Arduino Nano, ESP32 und ESP8266 ueber deren USB-Serial-Adapter oder native Espressif-USB-VID an, erlaubt aber noch keinen Flash-Preflight, bis Chip-Profil-Lesen und Bootloader-Handschlag implementiert sind. Er fixiert zunaechst den Vertrag zwischen Firmware, Provisioning Tool, Identity, Device Management und Build-&-Deploy.

## Offene Fragen

- Soll die Flashbox selbst accountgebunden, seriennummerngebunden oder frei nutzbar sein?
- Soll die Flashbox Ziel-Firmware offline cachen duerfen?
- Welche erste Zielgeraete-Familie wird MVP: nur ESP32-S3 oder mehrere ESP32-Varianten?
- Wie kommt die Flashbox initial ins WLAN: lokaler AP, BLE oder einmalige USB-Konfiguration?
- Soll die Flashbox spaeter Aktivierungscodes oder Lizenzen pruefen, oder bleibt sie reines Hardwarewerkzeug?
- Welche physische Recovery-Bedienung ist auf dem konkreten Zwei-USB-S3-Helper verfuegbar?
- Welcher Claim-Weg verbindet Webshop-Bestellung, Aktivierungscode und konkrete Flashbox-Seriennummer im Account?
- Welche Zielgeraete-Familien und Zielprofile werden im Auswahlfilter der inventarisierten Flashbox angezeigt?
