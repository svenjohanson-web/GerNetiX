# ESP32 OTA-Basissoftware

Quelle: `data/learning/projects/esp32-ota-bootstrap-firmware.yaml`

Ziel: Ein ESP32 wird mit der GerNetiX-Basissoftware initial per USB geflasht und danach OTA-faehig gemacht. Das ist ein fruehes Embedded-Erfolgserlebnis und technische Grundlage fuer spaetere Lernprojekte.

## Implementierter OTA-Pfad

Die ESP-IDF-Basissoftware besitzt einen lokalen `POST /ota`-Endpunkt. Ein Deploy-Auftrag bindet Schema, Signing-Key-ID, Deploy-ID, Sequenz, Device-ID, HTTPS-Artefakt-URL, Image-SHA-256 und Ablaufzeit durch eine ECDSA-P-256-Signatur. Das Device akzeptiert Artefakte nur vom provisionierten Build-&-Deploy-Origin, schreibt in den inaktiven A/B-Slot und bestaetigt das neue Image erst nach erfolgreicher Runtime-Diagnose. Als Transport abonniert die Basissoftware per mTLS und QoS 1 das geraetespezifische MQTT-Topic.

## Speicherprofile

Die Basissoftware wird nicht mehr als eine einzige Flashaufteilung behandelt. Der persistierte Device-Vertrag unterscheidet `full`, `medium` und `low`; der Build waehlt dazu ein geprueftes Layout fuer 4, 8 oder 16 MB internen Flash.

- `full`: zwei OTA-Slots und Bootloader-Rollback; ein fehlgeschlagenes Image verdraengt die letzte gueltige Software nicht.
- `medium`: grosser Factory-Anwendungsslot plus kleiner Wiederherstellungs-Bootstrap im `ota_0`-Slot; das Layout und die Hauptfirmwarevariante sind vorbereitet. Fuer ein Update wechselt die Hauptanwendung gezielt in den Bootstrap, der den Factory-Slot neu schreibt und bei einem Abbruch erneut versucht. Der eigenstaendige Bootstrap-Downloader muss vor Freigabe dieses Profils gebaut und auf echter Hardware gegen Stromausfall getestet werden.
- `low`: ein grosser Factory-App-Slot ohne `otadata`; MQTT-/HTTPS-OTA wird in der Firmwarevariante nicht gestartet, Updates erfolgen per USB.

Ein Wechsel zwischen diesen Klassen aendert die Partitionstabelle und benoetigt deshalb einmalig USB. Danach kann die neue Klasse wieder gemaess ihren eigenen Updatefaehigkeiten verwendet werden.

## Verbindliche Anforderungen an MEDIUM

MEDIUM ist eine einzelne grosse Hauptfirmware mit einem getrennten, kleinen und ueber USB installierten Recovery-Bootstrap. Der Bootstrap ist kein zweiter vollstaendiger Anwendungsstand. Er muss auch dann startfaehig bleiben, wenn der Download oder das Schreiben der Hauptfirmware abbricht.

### Start- und Recovery-Verhalten

1. Nach einem normalen Reset wird zuerst der MEDIUM-Bootstrap ausgefuehrt. Ein bereits waehrend Reset gedrueckter `BOOT`-Taster darf weiterhin den ESP-ROM-Downloadmodus fuer USB-Recovery ausloesen.
2. Sobald der Bootstrap laeuft, signalisiert eine schnell blinkende Status-LED fuer mindestens fuenf Sekunden das Recovery-Fenster. Boards ohne nutzbare LED benoetigen ein im Hardwareprofil festgelegtes alternatives Signal oder eine dokumentierte Ausnahme.
3. Wird `BOOT` erst waehrend dieses sichtbaren Fensters gedrueckt, bleibt das Board im Bootstrap-/Recovery-Modus. Der Tastendruck wird entprellt und fuer den laufenden Startvorgang verriegelt.
4. Ohne Tastendruck versucht der Bootstrap parallel, WLAN und den konfigurierten Update-Server zu erreichen und ein signiertes, zum Device und Hardwareprofil passendes Firmwaremanifest abzufragen.
5. Existiert eine gueltige Hauptfirmware, darf ein nicht erreichbarer Server, ein fehlendes Update oder ein abgelaufenes Zeitbudget ihren Start nicht verhindern. Nach dem Recovery-Fenster wird die vorhandene Hauptfirmware gestartet.
6. Existiert keine formal gueltige Hauptfirmware, darf der Bootstrap nicht in einen leeren oder unvollstaendigen Slot wechseln. Er bleibt automatisch im Recovery-Modus, auch ohne Tastendruck.

### Update-Sicherheit

- Der Bootstrap akzeptiert nur HTTPS-Artefakte und ECDSA-signierte, zeitlich begrenzte Deploy-Manifeste mit passender Device-ID, Hardware-/Partitionsprofil, monotoner Sequenz und SHA-256 des Images.
- Er schreibt ausschliesslich den einzelnen Hauptfirmware-Slot und niemals seine eigene Partition, die Partitionstabelle, Device-Identitaet oder Trust-Anker.
- Erst ein vollstaendig geschriebenes und kryptografisch verifiziertes Image darf als Hauptfirmware gestartet werden.
- Nach Stromausfall, Reset, WLAN-Abbruch oder unvollstaendigem Download muss erneut der intakte Bootstrap starten und den Vorgang wiederholen koennen.
- Registration und Pairing muessen denselben Public-Key-/Zertifikatsvertrag wie FULL und LOW verwenden. Ein Recovery darf Device-ID, privaten Device-Schluessel, Zertifikat, Account-Pairing und bestaetigte Boardkonfiguration nicht stillschweigend ersetzen oder loeschen.
- Der Handoff zwischen Bootstrap und Hauptfirmware darf keine unbegrenzten persistenten Schreibvorgaenge bei jedem normalen Start verursachen. Vor Freigabe sind Flash-Verschleiss und eine hohe Zahl wiederholter Bootzyklen nachzuweisen.

### Abnahme

MEDIUM gilt erst als freigegeben, wenn mindestens folgende Faelle auf echter Hardware bestanden sind: Server nicht erreichbar, kein Update vorhanden, gueltiges Update, falsche Signatur, falscher Hash, Stromausfall waehrend Download und Schreiben, leere Hauptfirmware, defekte Hauptfirmware, `BOOT` im sichtbaren Recovery-Fenster sowie `BOOT` bereits waehrend Reset als USB-ROM-Fallback. Die normale Hauptfirmware muss bei vorhandenem gueltigem Image trotz fehlendem Server innerhalb eines definierten und in der UI genannten Zeitbudgets starten.

## TODO: MEDIUM-Boardrettung in Identity erklaeren

Der vorhandene Identity-Reiter `Device Management > Recovery` muss fuer MEDIUM einen gefuehrten Rettungsablauf erhalten. Die Anleitung muss mindestens erklaeren:

1. Das bekannte Device im Inventar auswaehlen; Device-ID und Pairing bleiben erhalten.
2. Board normal zuruecksetzen und warten, bis die Status-LED schnell blinkt.
3. `BOOT` erst waehrend des Blinkens druecken, um im MEDIUM-Recovery-Modus zu bleiben.
4. Recovery-Verbindung und Bootstrapstatus erkennen, Firmware pruefen und den signierten Download erneut ausloesen.
5. Als letzten Rettungsanker `BOOT` bereits waehrend Reset halten und anschliessend per USB neu flashen.

Das TODO umfasst profil- und boardspezifische Texte, abweichende LED-/Tasterbelegung aus dem Hardware Catalog, eindeutige Zustandsanzeigen, barrierearme Anweisungen und Contract-/UI-Tests. Bis dieser Ablauf implementiert und auf echter Hardware abgenommen ist, darf MEDIUM nicht als vollstaendig freigegeben dargestellt werden.

## Ablauf

1. Board per USB erkennen.
2. ESP32-Basissoftware bauen.
3. Build-Ergebnis per USB flashen.
4. WLAN konfigurieren.
5. OTA aktivieren.
6. Zweite Firmware-Version per OTA einspielen.
7. Feedback pruefen, z. B. Versionsnummer oder LED-Muster.

## Aktueller Implementierungsstand

Die ESP32-Basissoftware unter `basissoftware/esp32` setzt den ersten lokalen Connectivity- und Feedback-Schnitt um:

- sichtbarer Setup-AP `GerNetiX-Setup`
- lokales Device-Webinterface unter `http://192.168.4.1/`
- `/status` fuer Runtime-, WLAN- und Uptime-Status
- `/logs` fuer lokale Feedback-Ereignisse aus einem RAM-Ringpuffer
- USB-Factory-Provisioning ueber `generated_provisioning_payload.h`
- lokaler `POST /provisioning` nur fuer Recovery-/Entwicklungsfaelle, nicht als normaler Provisioning-Tool-Kanal
- lokale NVS-Speicherung von Device-ID, Seriennummer, Hardwareprofil, Firmware-Version, Credential-Referenz, Secret-Hash, Service-Endpunkten, Provisioning-Batch und Capabilities
- lokale Erzeugung und NVS-Speicherung des P-256-Privatschluessels beim physischen Provisionieren
- `POST /auth/challenge` fuer den Device-seitigen ECDSA-P-256-Echtheitsnachweis
- Serial/UART-Ausgabe bleibt parallel aktiv

Nachweis:

```powershell
node tools\firmware-contract-check\check-provisioning-contract.js
npm test --prefix services\provisioning-tool
```

Der volle ESP-IDF-/PlatformIO-Build bleibt ein bewusster Integrationsnachweis, nicht der Standardnachweis fuer jede kleine Firmware-Aenderung.

Das initiale Hersteller-Provisioning laeuft ueber USB: Provisioning Tool erzeugt ein USB-Flash-Paket, Basissoftware wird mit diesem Payload gebaut und per USB geflasht, die Firmware importiert den Payload beim ersten Boot in NVS.

Das Provisioning Tool stellt dafuer `POST /api/provisioning-sessions/{session_id}/usb-flash` bereit. Im sicheren Default ist dieser Schritt ein Mock; mit `FLASH_RUNNER=platformio` fuehrt das Tool den PlatformIO-USB-Upload aus.

## Offene Entscheidungen

- `decision.esp32_ota_bootstrap_firmware.framework`: Arduino OTA, ESP-IDF OTA oder PlatformIO/Arduino?
- `architecture.esp32_authenticated_https_ota_path`: ECDSA-P-256-signierter, ablaufender Auftrag, Replay-Sequenz und Image-SHA-256 sind umgesetzt; Secure Boot und Anti-Rollback-Fuses bleiben Produktionshaertung.
- `decision.esp32_ota_bootstrap_firmware.wifi_setup`: Wie werden WLAN-Scan, SSID-Auswahl, Passwort-Eingabe und lokale Speicherung umgesetzt?
- `decision.esp32_ota_bootstrap_firmware.node_mode_policy`: Wird nach WLAN-Verbindung AP abgeschaltet, AP+STA betrieben oder ein zeitlich begrenzter Fallback-AP genutzt?
- `decision.esp32_ota_bootstrap_firmware.flash_layout`: Wird das aktuell erkannte 2-MB-Flash-Board OTA-faehig unterstuetzt oder wird fuer OTA ein 4-MB-Boardprofil vorausgesetzt?
- `decision.esp32_ota_bootstrap_firmware.service_endpoints`: Wie werden Device-Management-, Build-&-Deploy-, MQTT- und HTTPS-Endpunkte ohne harte lokale IP konfiguriert?
