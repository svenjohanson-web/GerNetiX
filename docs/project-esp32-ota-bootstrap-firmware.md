# ESP32 OTA-Basissoftware

Quelle: `data/learning/projects/esp32-ota-bootstrap-firmware.yaml`

Ziel: Ein ESP32 wird mit der GerNetiX-Basissoftware initial per USB geflasht und danach OTA-faehig gemacht. Das ist ein fruehes Embedded-Erfolgserlebnis und technische Grundlage fuer spaetere Lernprojekte.

## Implementierter OTA-Pfad

Die ESP-IDF-Basissoftware besitzt einen lokalen `POST /ota`-Endpunkt. Ein Deploy-Auftrag bindet Schema, Signing-Key-ID, Deploy-ID, Sequenz, Device-ID, HTTPS-Artefakt-URL, Image-SHA-256 und Ablaufzeit durch eine ECDSA-P-256-Signatur. Das Device akzeptiert Artefakte nur vom provisionierten Build-&-Deploy-Origin, schreibt in den inaktiven A/B-Slot und bestaetigt das neue Image erst nach erfolgreicher Runtime-Diagnose. Als Transport abonniert die Basissoftware per mTLS und QoS 1 das geraetespezifische MQTT-Topic.

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
