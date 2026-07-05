# Inkrementelle Build-Strategie

## Ziel

Typische Aenderungen an Lernprojekten oder KI-generierten Modulen sollen nur die betroffenen Dateien neu kompilieren. Die Basissoftware bleibt eine stabile, gecachte Build-Basis.

## Build-Bereiche

- `basissoftware/esp32/`: stabile Basis-Firmware, gemeinsam fuer alle Projekte.
- `projects/`: projektspezifische Konfiguration und freigegebene Hooks.
- `generated/`: KI-generierte oder nutzerbezogene Module.

## Cache-Regeln

- Der Build-Server haelt die kompilierte Core-Komponente dauerhaft vor.
- Der Compiler-Cache bleibt zwischen Builds erhalten.
- PlatformIO-, ESP-IDF-, CMake- und Ninja-Caches werden nicht nach jedem Build geloescht.
- Basissoftware-Artefakte werden ueber Basissoftware-Version, Toolchain-Version, Board und Build-Konfiguration adressiert.
- Projekt- und Generated-Artefakte werden separat pro Projekt, Nutzer oder Build-ID erzeugt.

## Abhaengigkeitsregeln

- `basissoftware/esp32/` darf keine Includes aus `projects/` oder `generated/` verwenden.
- `projects/` und `generated/` duerfen nur oeffentliche Basissoftware-Header verwenden.
- Keine projektbezogenen Konstanten in Basissoftware-Headern.
- Keine globalen Sammelheader fuer Projekt- oder Generated-Code.
- Kleine Funktionen bleiben in eigenen Dateien, damit Aenderungen wenige Objektdateien invalidieren.

## Link-Strategie

Der Build erzeugt oder verwendet:

- gecachte Core-Objektdateien
- neu erzeugte Projekt-Objektdateien
- neu erzeugte Generated-Objektdateien

Danach werden alle Objektdateien gelinkt, signiert und als OTA-Image bereitgestellt.

## Skalierung

Mehrere gleichzeitige Nutzer verwenden dieselbe gecachte Core-Basis. Nur ihre jeweiligen Projekt- und Generated-Komponenten werden neu gebaut. Dadurch sinken CPU-Last, Speicherbedarf und Buildzeit pro Nutzer.


