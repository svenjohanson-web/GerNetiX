# ESP32 Basissoftware

GerNetiX Basissoftware fuer ESP32-Projekte.

Dieses Verzeichnis ist ein normales Quellcode-Projekt. Quellcode, Konfiguration, User-Dateien und lokale Build-Ausgaben gehoeren zusammen in diese Projektstruktur. Kompilierte Ergebnisse entstehen im Build-Verzeichnis der Toolchain, zum Beispiel `.pio/build`.

Die Basissoftware unterstuetzt zwei WLAN-Betriebsarten:

- `node`: verbindet sich mit einem vorhandenen WLAN und ist danach per OTA erreichbar.
- `access_point`: erstellt ein eigenes Setup-WLAN, damit ein neues Board ohne bekannte Infrastruktur erreichbar ist.

Im Node-Modus gibt es einen Fallback: Wenn das konfigurierte WLAN innerhalb des Timeouts nicht erreichbar ist, startet die Firmware automatisch den Setup-Access-Point.

## Ablauf

1. WLAN-Daten in `include/wifi_config.h` anlegen.
2. Betriebsart setzen: `GERNETIX_WIFI_MODE_NODE` oder `GERNETIX_WIFI_MODE_ACCESS_POINT`.
3. Per USB initial flashen.
4. Basissoftware startet WLAN und ArduinoOTA.
5. Danach kann eine neue Version OTA eingespielt werden.

## Runtime und User-Code

Die Plattformfunktionen bleiben in der Runtime:

- WLAN/AP-Fallback
- OTA-Handler
- Versionsausgabe
- konfigurierbare Service-Endpunkte fuer Device Management und Build-&-Deploy
- spaeter Statusmeldung, Pairing und Recovery

Nutzerlogik liegt getrennt in:

```text
src/user/user_app.cpp
src/user/user_app.h
```

Der Lerncode implementiert `setupUserApp()` und `loopUserApp()`. `main.cpp` ruft diese Funktionen auf, behaelt aber Kontrolle ueber OTA und Runtime-Funktionen.

User-veraenderliche Dateien liegen unter:

```text
src/user/
```

Jede Hardware-Konfiguration bekommt eine eigene Datei:

```text
src/user/wifi_config.example.h
src/user/hw_pwm_config.example.h
```

Lokale Konfigurationen ohne `.example` werden nicht versioniert, zum Beispiel:

```text
src/user/wifi_config.h
src/user/hw_pwm_config.h
```

## Update-Strategie

Die Basissoftware kennt keinen fest verdrahteten Serverstandort. Es gibt also keine feste Homeserver-IP, keine AWS-spezifische Adresse und kein separates Instanz-Konzept.

Stattdessen verwendet sie konfigurierbare Endpunkte:

- Device Management fuer Registrierung, Pairing, Device-Status und OTA-Berechtigung
- Build-&-Deploy-Server fuer Deploy-Auftrag, Firmware-Download und Deploy-Status
- optional MQTT-Broker und HTTPS-Basis-URL

Ein Update laeuft nur nach einem Nutzer-ausgeloesten Build-&-Flash-Auftrag. Das Device fragt beziehungsweise empfaengt fuer seine `device_id`, ob ein autorisierter Deploy-Auftrag vorliegt. Erst dann laedt es die Firmware per HTTPS, prueft Groesse und SHA-256, flasht und meldet den Status zurueck.

Der Umzug von einem Linux-Homeserver zu einer Cloud-Umgebung soll ueber DNS, Konfiguration oder ein kontrolliertes Konfigurationsupdate moeglich sein. Ein USB-Reflash nur wegen eines Serverumzugs ist kein Ziel.

## Konfiguration

```powershell
Copy-Item src\user\wifi_config.example.h src\user\wifi_config.h
Copy-Item src\user\hw_pwm_config.example.h src\user\hw_pwm_config.h
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
