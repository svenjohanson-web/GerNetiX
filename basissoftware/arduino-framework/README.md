# Arduino-Framework Basissoftware

Diese Basissoftware ist fuer Arduino-kompatible Boards gedacht, wenn Lernprojekte bewusst mit dem Arduino-Framework arbeiten sollen.

## Ziel

- schneller Einstieg fuer Lernprojekte
- bekannte `setup()`-/`loop()`-Semantik kapseln
- GerNetiX-User-Code in getrennten Dateien halten
- spaeter als BuildPackage per PlatformIO baubar bleiben
- gemeinsamer faehigkeitsbasierter AVR-Diagnosevertrag ohne vorgetaeuschtes RTOS

## Geschuetzte Basis

- `src/main.cpp`
- `platformio.ini`
- `../arduino-avr-shared/` als gemeinsam versionierter Diagnosekern

Die lokale Debug-Sicht kann ueber USB SRAM-Reserve, Minimum, Stack-/Heap-Abstand,
Resetursache, Uptime und Loop-Laufzeit lesen. FreeRTOS-Tasks, PSRAM und CPU-Prozentwerte
werden fuer AVR nicht angeboten.

## User-Artefakte

- `include/user/user_app.h`
- `src/user/user_app.cpp`

Nutzer sollen Anwendungslogik in `src/user/` bearbeiten. Die Basis ruft diese Funktionen auf und bleibt updatefaehig.
