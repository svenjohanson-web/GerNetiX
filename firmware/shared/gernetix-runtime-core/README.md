# GerNetiX Runtime Core

Kleiner gemeinsamer Firmware-Kern fuer GerNetiX ESP32-Runtimes.

Ziel ist nicht, Basissoftware und Flashbox zu einem Paket zu verschmelzen. Der Core enthaelt nur die stabilen Bausteine, die beide Runtimes gleich behandeln sollen:

- sichere JSON-Ausgabe ohne Secrets
- einheitliche Device-/Hostname-Regeln
- gemeinsamer Runtime-Status-Vertrag
- Arduino-kompatible Komfortfunktionen fuer die Flashbox
- C/C++-Buffer-Funktionen, die spaeter in der ESP-IDF-Basissoftware nutzbar sind

Die Flashbox bleibt ein eigenes Firmwarepaket mit Display, USB-OTG und Werkzeug-Sicherheitsgrenze. Die Basissoftware bleibt die Runtime fuer Zielgeraete.

