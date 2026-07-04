# ESP32 OTA Bootstrap Firmware

Minimal-Firmware fuer das erste GerNetiX OTA-Erfolgserlebnis.

Ablauf:

1. WLAN-Daten in `include/wifi_config.h` anlegen.
2. Per USB initial flashen.
3. Firmware laeuft mit ArduinoOTA.
4. Danach kann eine neue Version OTA eingespielt werden.

## Konfiguration

```powershell
Copy-Item include\wifi_config.example.h include\wifi_config.h
```

Dann SSID und Passwort setzen.

## Build

```powershell
platformio run
```
