# Nachbauprojekt: Raumpräsenz mit Radar, ESP32 oder Arduino Nano

## Ziel

Das öffentliche Nachbauprojekt führt von einem konkret benannten
HLK-LD2410C-24-GHz-Radarmodul und wahlweise einem ESP32 oder klassischen
Arduino Nano mit ATmega328P zu einer lokal ausgewerteten, kamerafreien
Raumpräsenz. Es ergänzt das allgemeinere Lernprojekt
`build-your-own-proximity-sensor`: Der Nachbau liefert einen konkreten Aufbau,
das Lernprojekt vermittelt Modulidentifikation, Radarvergleich und Messmethode.

## Lieferstatus

Die Seite liefert Material, Verdrahtung, den Verweis auf das getrennte
Forgejo-Produktprojekt und einen Abnahmeplan. Sie ist als
`Quellprojekt · Hardware-Abnahme offen` gekennzeichnet. Ein unveränderlicher,
direkt flashbarer Public Release darf erst nach realem Boardtest, dokumentierter
Fehlalarmprüfung und Freigabe des exakten Hardwareprofils erscheinen.

## Technische Grenze

- LD2410C-Versorgung: 5 V mit mindestens 200 mA verfügbarer Kapazität.
- OUT- und UART-Logik: 3,3 V laut Herstellerunterlagen.
- erste Firmwarestufe ESP32: OUT an GPIO27;
- erste Firmwarestufe Arduino Nano: OUT an D2; UART bleibt wegen der
  5-V-/3,3-V-Pegelgrenze zunächst unverbunden;
- gemeinsame Filterung: 150 ms Einschaltbestätigung und 5 s
  Ausschaltverzögerung;
- spätere Stufe: UART2 an GPIO16/GPIO17 mit 256000 Baud und Auswertung des
  versionierten Herstellerprotokolls;
- keine Cloud, Kamera, Identifikation oder automatische sicherheitskritische
  Aktion.

Die einzige Firmware-Quellkopie liegt im eigenständigen lokalen Repository
`GerNetiX-Projekte/radar-raumpraesenz`. Das GerNetiX-Infrastruktur-Repository
enthält weder `src/main.cpp` noch `platformio.ini` oder Build-/Flash-Starter.

Die PlatformIO-Konfiguration im Produkt-Repository enthält `esp32dev`, `nanoatmega328` für den
älteren Nano-Bootloader und `nanoatmega328new` für den neuen Nano-Bootloader.
Die gemeinsame Firmware vermeidet ESP32-spezifisches `Serial.printf` und legt
konstante Texte auf AVR mit `F()` im Programmspeicher ab.
Die Starter `build.bat`, `build.sh` und `build.command` rufen den lokalen
Forgejo-Adapter auf. Das Manifest definiert drei direkte Worker-Ziele; jedes
Ziel erhält beim Materialisieren seine eigene PlatformIO-Umgebung. Ergänzend
stehen bewusste Flash-Einstiege für Windows, Linux und macOS bereit, die Port
und Ziel ausdrücklich verlangen.

Der lokale Repository-Commit ist vorbereitet. Provisionierung und Push des
neuen Forgejo-Remotes sowie ein öffentlicher Quellzugang stehen noch aus.

## Entwicklungs-Template

Der Entwicklungsbereich führt `iot_device_radar` als Spezialisierung des
technologieneutralen Basistemplates `esp32_device_only`, das in der Oberfläche
als `IoT-Device mit Sensor` erscheint. Die Spezialisierung übernimmt die
Radar-Architektur, das geschützte Forgejo-Produktprojekt und die drei
PlatformIO-Ziele `esp32dev`, `nanoatmega328` und `nanoatmega328new`.

Die öffentlichen PIR- und Radar-Seiten verlinken kontogebunden in den
Entwicklungsbereich und wählen das passende Template vor. Ohne Sitzung führt
der bestehende geschützte App-Einstieg zuerst über die Anmeldung und danach
zum angeforderten Template zurück.

Das Radar-Template kann erst auf Staging materialisiert werden, wenn das
Produkt-Repository in Forgejo provisioniert, der vorbereitete Commit gepusht
und dessen Commit-SHA serverseitig als geschützte Produktquelle freigegeben
ist. Bis dahin bleibt die Template-Definition lokal nachgewiesen, ohne eine
zweite Firmware-Quellkopie im Infrastruktur-Repository anzulegen.

## Abnahme

Der Testplan umfasst leeren Raum, Eintritt, ruhiges Sitzen, Tür, Vorhang,
Ventilator, Haustier beziehungsweise bewegte Gegenstände sowie Flur und
Nachbarraum. Parameter oder Montage werden immer nur einzeln verändert.
Falsch positive und falsch negative Ergebnisse werden protokolliert.

## Primärquellen

- Hi-Link Produktseite HLK-LD2410C-24G:
  https://www.hlktech.com/en/Goods-239.html
- Hi-Link HLK-LD2410C User Manual V1.09:
  https://h.hlktech.com/download/HLK-LD2410C-24G/1/HLK%20LD2410C%E7%94%9F%E5%91%BD%E5%AD%98%E5%9C%A8%E6%84%9F%E5%BA%94%E6%A8%A1%E7%BB%84%E8%AF%B4%E6%98%8E%E4%B9%A6%20V1.09.pdf
