# Arduino-Board Atmel/AVR Basissoftware

Diese Basissoftware ist fuer Arduino-kompatible AVR-Boards gedacht, wenn ein Projekt ohne Arduino-Framework direkt gegen AVR/Atmel-nahe APIs gebaut werden soll.

## Ziel

- Arduino-Board als Hardware nutzen
- keine Arduino-Laufzeit und keine `setup()`-/`loop()`-Abhaengigkeit
- direkter Einstieg in Register, `avr/io.h` und `avr-libc`
- klare Trennung zwischen geschuetzter Basis und User-Artefakten

## Geschuetzte Basis

- `src/main.c`
- `platformio.ini`

## User-Artefakte

- `include/user/user_app.h`
- `src/user/user_app.c`

Nutzer sollen Anwendungslogik in `src/user/` bearbeiten. Die Basis initialisiert den Controller und ruft den User-Code kontrolliert auf.

## VS Code / PlatformIO

Wenn VS Code im Repository-Root `GerNetiX` geoeffnet ist, erkennt PlatformIO dieses Unterprojekt nicht immer automatisch, weil die `platformio.ini` nicht im Root liegt.

Optionen:

- `GerNetiX.code-workspace` oeffnen. Dann erscheint `Arduino Atmel AVR` als eigener Workspace-Ordner und PlatformIO zeigt die normalen Build-/Upload-Buttons.
- Alternativ direkt den Ordner `basissoftware/arduino-atmel` in VS Code oeffnen.
- Im Repo-Root gibt es zusaetzlich VS-Code-Tasks: `Arduino Atmel/AVR: Build`, `Arduino Atmel/AVR: Flash` und `Arduino Atmel/AVR: Clean`.
