# ESP32 OTA Bootstrap Firmware

Minimal-Firmware fuer das erste GerNetiX OTA-Erfolgserlebnis.

Die Firmware unterstuetzt zwei WLAN-Betriebsarten:

- `node`: verbindet sich mit einem vorhandenen WLAN und ist danach per OTA erreichbar.
- `access_point`: erstellt ein eigenes Setup-WLAN, damit ein neues Board ohne bekannte Infrastruktur erreichbar ist.

Im Node-Modus gibt es einen Fallback: Wenn das konfigurierte WLAN innerhalb des Timeouts nicht erreichbar ist, startet die Firmware automatisch den Setup-Access-Point.

## Ablauf

1. WLAN-Daten in `include/wifi_config.h` anlegen.
2. Betriebsart setzen: `GERNETIX_WIFI_MODE_NODE` oder `GERNETIX_WIFI_MODE_ACCESS_POINT`.
3. Per USB initial flashen.
4. Firmware startet WLAN und ArduinoOTA.
5. Danach kann eine neue Version OTA eingespielt werden.

## Konfiguration

```powershell
Copy-Item include\wifi_config.example.h include\wifi_config.h
```

Dann SSID, Passwort und Modus setzen.

Node-Modus mit AP-Fallback:

```cpp
#define GERNETIX_WIFI_MODE GERNETIX_WIFI_MODE_NODE
#define GERNETIX_WIFI_CONNECT_TIMEOUT_MS 15000
```

Access-Point-Modus:

```cpp
#define GERNETIX_WIFI_MODE GERNETIX_WIFI_MODE_ACCESS_POINT
```

## Build

```powershell
platformio run
```