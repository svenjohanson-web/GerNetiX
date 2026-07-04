# ESP32 OTA-Basisfirmware

Quelle: `data/learning/projects/esp32-ota-bootstrap-firmware.yaml`

Ziel: Ein ESP32 wird initial per USB geflasht und danach OTA-faehig gemacht. Das ist ein fruehes Embedded-Erfolgserlebnis und technische Grundlage fuer spaetere Lernprojekte.

## Ablauf

1. Board per USB erkennen.
2. Minimale Firmware bauen.
3. Firmware per USB flashen.
4. WLAN konfigurieren.
5. OTA aktivieren.
6. Zweite Firmware-Version per OTA einspielen.
7. Feedback pruefen, z. B. Versionsnummer oder LED-Muster.

## Offene Entscheidungen

- Arduino OTA, ESP-IDF OTA oder PlatformIO/Arduino?
- OTA sofort mit Authentifizierung oder erst im naechsten Schritt?
- Wie wird WLAN ohne Account komfortabel konfiguriert?
