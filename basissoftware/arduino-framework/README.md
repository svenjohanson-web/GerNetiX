# Arduino-Framework Basissoftware

Diese Basissoftware ist fuer Arduino-kompatible Boards gedacht, wenn Lernprojekte bewusst mit dem Arduino-Framework arbeiten sollen.

## Ziel

- schneller Einstieg fuer Lernprojekte
- bekannte `setup()`-/`loop()`-Semantik kapseln
- GerNetiX-User-Code in getrennten Dateien halten
- spaeter als BuildPackage per PlatformIO baubar bleiben

## Geschuetzte Basis

- `src/main.cpp`
- `platformio.ini`

## User-Artefakte

- `include/user/user_app.h`
- `src/user/user_app.cpp`

Nutzer sollen Anwendungslogik in `src/user/` bearbeiten. Die Basis ruft diese Funktionen auf und bleibt updatefaehig.
