# Struktur fuer Projektanpassungen

## Ziel

Die Basissoftware bleibt ein geschuetzter, wiederverwendbarer Firmware-Kern. Projektanpassungen und KI-generierte Dateien werden getrennt davon abgelegt und duerfen nur ueber definierte Erweiterungspunkte eingebunden werden.

Damit entsteht eine klare Trennung:

- `basissoftware/esp32/`: stabile Basis-Firmware, Schutzmechanismen, Update-Logik, Runtime und gemeinsame Hardwareabstraktion.
- `projects/`: projektspezifische Parameter, Pinbelegung, erlaubte Features, Branding, Sensor-/Aktor-Profile und optionale Hooks.
- `model/`: runtime-neutrale fachliche Modelle, zum Beispiel das Tamagotchi-Modell.
- `runtimes/`: technische Zielplattformen und Referenzanwendungen.
- `generated/`: KI-generierte oder lernprojektbezogene Dateien.
- Build-Ausgabe: signiertes Firmware-Binary fuer genau ein Projekt.

## Verzeichnisstruktur

```text
GerNetiX/
  basissoftware/esp32/
    CMakeLists.txt
    include/
      basissoftware/esp32/
        config.h
        project_hooks.h
        functions/
          ...
    src/
      main.cpp
      functions/
        ...
      hooks/
        ...
  projects/
    _template/
      project.yaml
      README.md
      CMakeLists.txt.example
      config/
        project_config.h.example
      hooks/
        on_project_init.cpp.example
        on_project_tick.cpp.example
      assets/
        README.md
  model/
    tamagotchi/
      model.yaml
      runtimes.yaml
  runtimes/
    browser/
    pc/
    esp32/
  generated/
    _template/
      README.md
      CMakeLists.txt.example
      generated_module.cpp.example
  docs/
    copy-protection-requirement.md
    firmware-project-structure.md
    incremental-build-strategy.md
```

## Regel

Projektanpassungen liegen immer unter `projects/<projekt-id>/`. Fachliche Modelle liegen unter `model/<modell-id>/`. KI-generierte oder lernprojektbezogene Dateien liegen unter `generated/<runtime>/<projekt-id>/`.

Die Basissoftware importiert niemals beliebige Projekt- oder Generated-Dateien direkt. Stattdessen wird beim Build genau ein Projektprofil ausgewaehlt und als zusaetzliche Komponente gelinkt.

Beispiel:

```text
projects/greenhouse-controller/
projects/workshop-sensor-node/
projects/customer-a-energy-meter/
generated/user-123-workshop-sensor/
generated/embedded/tamagotchi/
```

## Projektprofil

Jedes Projekt bekommt ein `project.yaml`. Dort stehen nur deklarative Werte, keine geheime Logik.

Typische Inhalte:

- Projekt-ID
- Zielboard
- Firmware-Variante
- aktivierte Features
- Pinbelegung
- Sensoren und Aktoren
- erlaubte OTA-Kanaele
- Produkt-/Kundenkennung

## Projektspezifische Hooks

Wenn ein Projekt eigenes Verhalten braucht, wird es ueber definierte Hooks angebunden. Jeder Hook bleibt klein und hat eine klare Aufgabe.

Erlaubte Hook-Arten:

- `onProjectInit`: einmalige Initialisierung nach der Basisinitialisierung
- `onProjectTick`: regelmaessiger Projektzyklus
- `onProjectEvent`: Reaktion auf freigegebene Events

Die Basissoftware entscheidet, wann diese Hooks aufgerufen werden. Projektcode darf keine internen Basissoftware-Dateien einbinden.

## Inkrementelle Build-Strategie

Die Firmware ist auf kleine, getrennt cachebare Build-Einheiten ausgelegt.

- `basissoftware/esp32/` ist die stabile Basis-Firmware und wird als eigene ESP-IDF-Komponente gebaut.
- `projects/<projekt-id>/` enthaelt nur projektspezifische Konfiguration und freigegebene Hooks.
- `generated/<projekt-id>/` enthaelt KI-generierte oder lernprojektbezogene Dateien.
- Basissoftware-Code darf keine Header aus `projects/` oder `generated/` inkludieren.
- Projekt- und Generated-Code duerfen nur freigegebene oeffentliche Basissoftware-Header verwenden.
- Globale Includes und breite Sammelheader sind zu vermeiden, weil sie viele Objektdateien invalidieren.
- Source-Dateien werden in `CMakeLists.txt` moeglichst explizit gelistet, damit kleine Aenderungen wenige Build-Ziele betreffen.

Der Build-Server soll dauerhaft vorhalten:

- PlatformIO- und ESP-IDF-Paketcache
- CMake-/Ninja-Build-Verzeichnisse
- Compiler-Cache, zum Beispiel `ccache` oder ein gleichwertiger Remote-Cache
- vorkompilierte Core-Objektdateien fuer stabile Basissoftware-Versionen

Typischer Ablauf:

1. Basissoftware-Version bestimmen.
2. Passende Basissoftware-Artefakte aus dem Cache laden.
3. Projektkomponente und Generated-Komponente fuer den aktuellen Nutzer bauen.
4. Neue Objektdateien mit der gecachten Basissoftware linken.
5. Firmware-Image signieren.
6. OTA-Artefakt bereitstellen.

Ziel: Eine typische Aenderung in einem Lernprojekt kompiliert nur wenige Dateien aus `projects/` oder `generated/` neu. `basissoftware/esp32/` bleibt unveraendert und wird nicht neu uebersetzt.

## Build-Regel

Ein Build darf immer nur fuer ein Projektprofil laufen. Der Build-Prozess kopiert oder generiert daraus die freigegebenen Konfigurationsdateien in den temporaeren Build-Kontext.

Die Root-`CMakeLists.txt` bindet standardmaessig nur `basissoftware/esp32/` ein. Projekt- und Generated-Komponenten werden ueber Build-Umgebungsvariablen ausgewaehlt:

```text
GERNETIX_PROJECT_COMPONENT=projects/<projekt-id>
GERNETIX_GENERATED_COMPONENT=generated/<projekt-id>
```

Nicht erlaubt:

- Projektdateien direkt in `basissoftware/esp32/src/functions/` ablegen
- private Basissoftware fuer ein Projekt duplizieren
- geheime Schluessel in `projects/` oder `generated/` speichern
- Debug- oder Test-Hooks in Produktions-Firmware aktiv lassen

## Auslieferung

Ausgeliefert wird nur:

- signiertes Firmware-Binary
- oeffentliche Release-Informationen
- optional projektspezifische Bedien- oder Integrationsdokumentation

Nicht ausgeliefert werden:

- `basissoftware/esp32/`
- `projects/`
- `generated/`
- Build-Skripte
- Debug-Symbole
- private Schluessel




