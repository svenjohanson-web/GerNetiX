# Schneller Embedded-Firmware-Feedbackweg

## Ziel

Embedded-Firmware soll schnell pruefbar sein, ohne den Entwickler-Laptop mit langen ESP-IDF-/PlatformIO-Vollbuilds zu blockieren.

## Standardweg

1. Contract pruefen: Passt das Provisioning-Manifest zur Firmware-Konfigurationsschnittstelle?
2. Kleine Host-/Syntaxchecks ausfuehren: geaenderte Dateien und Hilfslogik pruefen.
3. Service-API pruefen: Provisioning Tool, Device Management, Project Server und Build-&-Deploy-Adapter.
4. BuildPackage pruefen: Quellen, `platformio.ini`, Boardprofil und Zielartefakt bestimmen, ohne PlatformIO zu starten.
5. Erst danach bewusst Vollbuild oder Flash starten.

## Nicht mehr Standard

- Kein ESP-IDF-/PlatformIO-Vollbuild nach jeder kleinen Aenderung.
- Kein automatischer USB-Flash fuer reine Codepruefung.
- Kein lokales Weiterlaufen von PlatformIO-, Python-, Compiler-, `avrdude`- oder `esptool`-Prozessen nach Abbruch.

## Vollbuild-Regel

Ein Vollbuild ist ein Integrationsschritt. Er laeuft nur, wenn ein echtes `firmware.bin`/`firmware.hex` oder ein echter Flash benoetigt wird. Er braucht:

- vorbereiteten Build-Cache
- klares Timeout
- Prozess-Aufraeumen bei Abbruch
- BuildResult mit Artefakt, Log, Status, SHA-256 und Dateigroesse

## Aktueller Stand

Provisioning Tool und Device Management koennen Provisioning-Sessions vorbereiten, Manifest/Credential erzeugen und Devices registrieren.

Die ESP32-Basissoftware hat begonnen, Provisioning-Daten lokal in NVS anzunehmen und im Status auszugeben. Der schnelle Nachweis dafuer soll zuerst ueber Contract-/Syntaxchecks erfolgen. Der ESP32-Vollbuild bleibt ein bewusster Integrationsschritt.
