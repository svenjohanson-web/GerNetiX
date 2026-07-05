# Generated-Komponente

Dieser Ordner beschreibt die Struktur fuer KI-generierte oder lernprojektbezogene Firmware-Dateien.

Generated-Code wird nicht direkt in `basissoftware/esp32/` abgelegt. Fuer jeden Nutzer, jedes Lernprojekt oder jede Build-ID kann eine eigene Komponente erzeugt werden, zum Beispiel:

```text
generated/user-123-workshop-sensor/
```

Diese Komponente wird beim Build separat eingebunden und geloescht oder archiviert, ohne die Core-Firmware zu veraendern.

