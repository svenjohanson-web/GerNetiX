# ESP32 Basissoftware

GerNetiX Basissoftware fuer ESP32-Projekte auf Basis von ESP-IDF.

Dieses Verzeichnis ist das aktive ESP32-Firmwareprojekt:

```text
basissoftware/esp32/
```

Die Basissoftware ist von Projektanpassungen und generiertem Code getrennt. Sie enthaelt nur die stabile Runtime, Initialisierung, freigegebene Hooks und gemeinsame Hardwareabstraktion.

## Einstieg

Der ESP-IDF-Einstieg liegt in:

```text
src/main.cpp
```

`app_main()` fuehrt nur die Initialisierung aus und startet anschliessend die Runtime-Tasks:

```cpp
extern "C" void app_main() {
  initSerial();
  initPins();
  initWifi();
  runDiagnostics();
  onProjectInit();
  startRuntimeTasks();
}
```

Es gibt keine Arduino-`setup()`/`loop()`-Struktur und keine Arduino-Quellen.

## Struktur

```text
basissoftware/esp32/
  CMakeLists.txt
  platformio.ini
  include/
    basissoftware/
      config.h
      project_hooks.h
      functions/
  src/
    CMakeLists.txt
    main.cpp
    functions/
    hooks/
```

Jede Basissoftware-Funktion liegt in einer eigenen Datei. Projektlogik wird nicht direkt in die Basissoftware geschrieben, sondern spaeter ueber `projects/` oder `generated/` eingebunden.

## Build

```powershell
platformio run
```
