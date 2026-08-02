# Boards

Hier entsteht je unterstuetzter Boardvariante ein Ordner. Der Ordnername ist die stabile `hardware-catalog-id`, nicht ein frei formulierter Boardname.

Beispiel:

```text
Boards/
  esp32-s3-devkit/
    led-und-taster/
    oled-uhr/
    tamagotchi/
```

Eine Demo wird erst nach erfolgreichem Build, Kompatibilitaetspruefung und Signatur in ihren Boardordner aufgenommen. Bis dahin gibt es keine oeffentlich flashbare Datei.

## Build-verifizierte Nachbauprojekte

- `hardware.processor_board.diymore_hw_364a_esp8266_oled/ein-tasten-spielesammlung`: Cat Jump und Cave Bat auf dem integrierten SSD1306-OLED, bedient mit dem FLASH-Taster. Das Projekt erweitert die ESP8266-Basissoftware und besitzt noch kein signiertes oeffentliches Release.
