# GerNetiX ESP8266-Basissoftware

Erstes Factory-/Provisioning-Profil fuer das diymore HW-364A mit ESP-12F und integriertem SSD1306-OLED.

## Hardwareprofil

- PlatformIO-Ziel: `nodemcuv2`
- CPU: ESP8266EX / Xtensa LX106, 80 MHz
- Flash: 4 MB
- USB-Seriell: CH340
- OLED: SSD1306, 128 x 64, I2C-Adresse `0x3C`
- OLED SDA: GPIO14
- OLED SCL: GPIO12

## Build

```text
platformio run -e diymore_hw_364a
```

Der Build erzeugt `.pio/build/diymore_hw_364a/firmware.bin`. Das Image wird ab Offset `0x0` geflasht. USB-/OTA-Uploads fuehrt Codex nicht aus.

## Provisioning-Vertrag

Die Firmware stellt den Setup-AP, das lokale WLAN-Portal, den seriellen WLAN-Vertrag sowie die HTTP-Endpunkte `/health`, `/status`, `/wifi/scan`, `/wifi`, `/provisioning` und `/auth/challenge` bereit. Provisioning-Daten, der lokal erzeugte P-256-Private-Key und das ausgestellte Client-Zertifikat bleiben im Flash des Boards.
