# Struktur fuer Projektanpassungen

## Ziel

Die Basissoftware bleibt ein geschuetzter, wiederverwendbarer Firmware-Kern. Projektanpassungen und KI-generierte Dateien werden getrennt davon abgelegt und duerfen nur ueber definierte Erweiterungspunkte eingebunden werden.

Damit entsteht eine klare Trennung:

- `basissoftware/esp32/`: stabile Basis-Firmware, Schutzmechanismen, Update-Logik, Runtime und gemeinsame Hardwareabstraktion.
- `basissoftware/arduino-framework/`: Basissoftware fuer Arduino-kompatible AVR-Boards mit Arduino-Framework.
- `basissoftware/arduino-atmel/`: Basissoftware fuer Arduino-kompatible AVR-Boards ohne Arduino-Framework, direkt mit AVR-/Atmel-nahen APIs.
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
  basissoftware/arduino-framework/
    platformio.ini
    include/
      user/
        user_app.h
    src/
      main.cpp
      user/
        user_app.cpp
  basissoftware/arduino-atmel/
    platformio.ini
    include/
      user/
        user_app.h
    src/
      main.c
      user/
        user_app.c
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

## ESP32-Basisfunktionen

Der aktuelle ESP32-Basisstand stellt lokale Setup- und Diagnosefunktionen bereit, ohne Backend, Account oder Pairing vorauszusetzen:

- Setup-AP `GerNetiX-Setup`
- Device-Webinterface unter `http://192.168.4.1/`
- `/status` fuer Runtime-, WLAN- und Uptime-Status
- `/logs` fuer lokalen Feedback-Ringpuffer
- Serial/UART-Ausgabe fuer dieselben Feedback-Ereignisse

Diese Funktionen gehoeren zur geschuetzten Basissoftware. Projekt- und User-Code duerfen sie nutzen, aber nicht ersetzen. WLAN-Scan, Ziel-WLAN-Speicherung, Node-Modus, OTA-Partitionierung, OTA-Authentifizierung und Service-Endpunkt-Konfiguration sind bewusst als offene Entscheidungen im Graphen dokumentiert.

## Inkrementelle Build-Strategie

Die Firmware ist auf kleine, getrennt cachebare Build-Einheiten ausgelegt.

## Schneller Firmware-Feedbackweg

Fuer die normale Arbeit an Embedded-Firmware ist ein vollstaendiger PlatformIO-/ESP-IDF-Build nicht der Standardnachweis. Diese Builds koennen auf einem Laptop lange laufen, viele Compilerprozesse starten und die Maschine spuerbar belasten. Deshalb gilt:

1. Kleine Aenderungen zuerst mit schnellen Checks pruefen.
2. Vollbuild nur starten, wenn ein echtes Firmware-Artefakt oder ein echter Flash benoetigt wird.
3. Vollbuilds nur ueber den Build-&-Deploy-Server oder bewusst auf einem vorbereiteten Build-Host mit Cache ausfuehren.
4. Jeder Vollbuild braucht ein hartes Timeout und muss beim Abbruch alle PlatformIO-, Python-, Compiler- und Flash-Prozesse beenden.
5. USB-Flash und OTA-Flash sind Integrationsschritte, keine Standardpruefung fuer jede Codeaenderung.

Der schnelle Standardnachweis besteht aus:

- Contract-Check zwischen Provisioning-Manifest und Firmware-Konfigurationsschnittstelle
- Syntax-/Header-Check fuer die geaenderten Firmware-Dateien
- Host-Test fuer parsebare Logik, soweit sie ohne ESP-IDF lauffaehig ist
- API-Test fuer Provisioning Tool, Device Management und Build-&-Deploy-Adapter
- optionaler BuildPackage-Check ohne PlatformIO-Ausfuehrung

Ein ESP32-Vollbuild wird erst danach gestartet, wenn die schnellen Checks erfolgreich waren und ein physisches Board oder ein OTA-Artefakt wirklich gebraucht wird.

- `basissoftware/esp32/` ist die stabile Basis-Firmware und wird als eigene ESP-IDF-Komponente gebaut.
- `basissoftware/arduino-framework/` ist die Arduino-Framework-Basis fuer Arduino-kompatible AVR-Boards.
- `basissoftware/arduino-atmel/` ist die direkte AVR-/Atmel-nahe Basis fuer dieselben Boardklassen ohne Arduino-Framework.
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

## Arduino-Board-Varianten

Arduino-Board bedeutet in GerNetiX nicht automatisch Arduino-Framework. Fuer Arduino-kompatible AVR-Boards gibt es zwei fachlich getrennte Basissoftware-Varianten:

- Arduino-Framework: `basissoftware/arduino-framework/`
- Atmel/AVR ohne Arduino-Framework: `basissoftware/arduino-atmel/`

Die Variante wird explizit im Projektmodell oder BuildPackage gewaehlt. Sie darf nicht nur aus dem Boardnamen abgeleitet werden, weil dasselbe Board sowohl mit Arduino-Framework als auch direkt AVR-/Atmel-nah programmiert werden kann.

## Build-Regel

Ein Build darf immer nur fuer ein Projektprofil laufen. Der Build-Prozess kopiert oder generiert daraus die freigegebenen Konfigurationsdateien in den temporaeren Build-Kontext.

Fuer accountgebundene ESP32-Entwicklungsprojekte gilt im ersten IDE-Durchstich:

- Der Project Server speichert als sichtbare und editierbare Projektquelle nur `src/user_main.cpp`.
- Diese User-Main gehoert fachlich zum Account-Projekt und wird nicht in `basissoftware/esp32` persistiert.
- Beim Erzeugen des vollstaendigen BuildPackage legt der Project Server die User-Main auf `src/user/user_app.cpp` der versionierten ESP32-Basissoftware.
- `src/main.cpp`, Runtime, Connectivity, Schutzmechanismen und spaetere OTA-Implementierung kommen ausschliesslich aus der Basissoftware-Version des BuildPackage.
- Die IDE zeigt die Basissoftware nicht als editierbaren Projektinhalt an.
- Der aktuelle Basisstand enthaelt den authentifizierten HTTPS-/MQTT-OTA-Pfad und ein aktiviertes A/B-Partitionslayout. Bei der USB-Migration vom bisherigen Single-App-Layout bleibt dessen NVS-Bereich `0x9000` bis `0xEFFF` vollstaendig erhalten; die OTA-App-Slots beginnen deshalb bei `0x20000`.

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
- `basissoftware/arduino-framework/`
- `basissoftware/arduino-atmel/`
- `projects/`
- `generated/`
- Build-Skripte
- Debug-Symbole
- private Schluessel


