# Firmware-Build-Targets und Factory-Releases

## Zweck

Ein gemeinsamer Quellcode erzeugt nicht automatisch eine gemeinsame Firmware.
ESP32 Classic, ESP32-S3 und ESP32-C6 sind nicht binaerkompatibel. Ein falsches
Binary darf daher niemals nur wegen einer passenden Flashgroesse angeboten
werden.

GerNetiX trennt dazu drei Dinge:

1. **Hardware-Katalog:** beschreibt ein konkretes Board und referenziert genau
   ein freigegebenes `firmware_build_target_id`.
2. **Firmware-Build-Target:** beschreibt die technische Binaerkompatibilitaet:
   ESP-IDF-Target, CPU-Familie, PlatformIO-Environment, Flash-/PSRAM-Anbindung,
   Speichergrenze und Partitionstabelle.
3. **Factory-Release:** ist ein unveraenderliches, gebautes `merged-firmware.bin`
   fuer ein Build-Target und ein Basissoftwareprofil. Es besitzt Artefakt-ID,
   Version, Pruefsumme und Speicherort im Provisioning-Artefaktspeicher.

## Aktuelle Build-Targets

| Target | PlatformIO | Architektur | Speicher | Status |
| --- | --- | --- | --- | --- |
| `firmware_build_target.esp32_classic_qspi_4mb` | `esp32dev` | ESP32 / Xtensa LX6 | QSPI, 4 MB | FULL-Release vorgesehen |
| `firmware_build_target.esp32_s3_opi_n16r8` | `esp32-s3-16mb-full` | ESP32-S3 / Xtensa LX7 | 16 MB Flash, 8 MB OPI-PSRAM | FULL-Release vorgesehen |
| `firmware_build_target.esp32_c6_qspi_4mb` | `esp32-c6-4mb-full` | ESP32-C6 / RISC-V | QSPI, 4 MB | Build-Target angelegt, Release folgt nach erfolgreichem Build |

Die technische Definition liegt versioniert neben der Basissoftware unter
`basissoftware/esp32/firmware-build-targets.js`; die konkreten PlatformIO-
Environments liegen in `basissoftware/esp32/platformio.ini`.

## Aufloesung beim Provisioning

```text
Ausgewaehltes Inventarboard
  -> Hardware-Katalog: firmware_build_target_id
  -> Build-Target: Architektur + Speicherlayout pruefen
  -> Factory-Release fuer das gewaehlte FULL/MEDIUM/LOW-Profil suchen
  -> Vorhandenes, geprueftes Artefakt aus dem Provisioning-Speicher laden
  -> erst dann Browser-USB-Flash erlauben
```

Fehlt die Boardreferenz, das Build-Target, das passende Profil oder das
bereitgestellte Release, antwortet das Provisioning mit einem Fehler. Es faellt
nicht auf ein Classic-ESP32-Binary zurueck.

## Ablage von Releases

Die Release-Metadaten gehoeren in die SQL-Tabelle
`provisioning_firmware_artifacts` des Provisioning Artifact Store. Sie enthalten
mindestens Artefakt-ID, Version, Dateiname, SHA-256, Flashstrategie und Offset.
Die Binärdatei liegt ausserhalb der Datenbank im geschuetzten Server-
Firmwareordner beziehungsweise im Artefaktspeicher. Die lokale Entwicklungs-
Konvention ist:

```text
.runtime/server-firmware/esp32-basissoftware/
  esp32-classic-qspi-4mb/full/merged-firmware.bin
  esp32-s3-opi-n16r8/full/merged-firmware.bin
```

Eine Datei wird erst nach erfolgreichem Build, Pruefsumme und expliziter
Release-Freigabe registriert. Nicht gebaute Targets werden bewusst nicht
angeboten.

## Lokaler Komplettbuild

Unter Windows baut `basissoftware/esp32/build-all-factory-firmware.bat` alle
explizit unterstützten Factory-Varianten. Das Skript liest nach jedem Build die
vom ESP-IDF erzeugte `flasher_args.json`; dadurch werden Bootloader,
Partitionstabelle, OTA-Daten und Anwendung mit den tatsächlich erzeugten
Offsets und Flash-Parametern zusammengefügt. Es errät keine Offsets.

## Verantwortlichkeiten

- Hardware-Katalog: Board-zu-Target-Kompatibilitaet.
- Basissoftware: wiederverwendbarer Quellcode und Compiler-/Linker-Konfiguration.
- Build-Prozess: erzeugt getrennte Binaries pro Build-Target.
- Provisioning Artifact Store: persistiert freigegebene Release-Metadaten und
  liefert deren Inhalte.
- Provisioning: loest die Kette auf; es entscheidet nicht selbst anhand von
  Boardnamen oder pauschalen Flashgroessen.
