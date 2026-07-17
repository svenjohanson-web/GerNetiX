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
