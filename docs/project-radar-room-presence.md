# Nachbauprojekt: Raumpräsenz mit Radar und ESP32

## Ziel

Das öffentliche Nachbauprojekt führt von einem konkret benannten
HLK-LD2410C-24-GHz-Radarmodul und einem ESP32 zu einer lokal ausgewerteten,
kamerafreien Raumpräsenz. Es ergänzt das allgemeinere Lernprojekt
`build-your-own-proximity-sensor`: Der Nachbau liefert einen konkreten Aufbau,
das Lernprojekt vermittelt Modulidentifikation, Radarvergleich und Messmethode.

## Lieferstatus

Die Seite liefert Material, Verdrahtung, PlatformIO-Konfiguration, eine erste
Firmware für den digitalen OUT-Pin und einen Abnahmeplan. Sie ist als
`Quellprojekt · Hardware-Abnahme offen` gekennzeichnet. Ein unveränderlicher,
direkt flashbarer Public Release darf erst nach realem Boardtest, dokumentierter
Fehlalarmprüfung und Freigabe des exakten Hardwareprofils erscheinen.

## Technische Grenze

- LD2410C-Versorgung: 5 V mit mindestens 200 mA verfügbarer Kapazität.
- OUT- und UART-Logik: 3,3 V laut Herstellerunterlagen.
- erste Firmwarestufe: OUT an GPIO27, 150 ms Einschaltbestätigung und 5 s
  Ausschaltverzögerung;
- spätere Stufe: UART2 an GPIO16/GPIO17 mit 256000 Baud und Auswertung des
  versionierten Herstellerprotokolls;
- keine Cloud, Kamera, Identifikation oder automatische sicherheitskritische
  Aktion.

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
