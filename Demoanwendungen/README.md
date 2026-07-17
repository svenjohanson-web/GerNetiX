# Demoanwendungen

Dieser Bereich enthaelt vorgefertigte, gepruefte Demo-Firmware fuer den oeffentlichen GerNetiX-Demo-Bereich.

Er steht bewusst neben `basissoftware/`:

- `basissoftware/` enthaelt die geschuetzte Laufzeit- und Wiederherstellungssoftware.
- `Demoanwendungen/` enthaelt sichtbare Beispielprogramme, die Besucher per USB ausprobieren koennen.

Eine Demo ist kein Entwicklungsprojekt und kein OTA-Update. Sie darf keine Konto-, Projekt- oder Kundendaten voraussetzen oder verwenden.

## Struktur

`Boards/` bildet die unterstuetzten Boardvarianten und ihre buildbaren Quelldateien ab. Ein geprüftes Release wird anschließend in den separaten öffentlichen SQL-Katalog übernommen; der Repository-Ordner ist nicht dessen Laufzeit-Speicher.

```text
Demoanwendungen/
  Boards/
    <hardware-catalog-id>/
      <demo-id>/
        README.md
        manifest.json
        firmware/             # buildbare Quellen der Demo
```

## Regeln fuer eine veroeffentlichte Demo

1. Sie ist genau an die im Hardware Catalog gefuehrte Boardvariante und ihr Flash-Layout gebunden.
2. Sie wird vor der Veroeffentlichung gebaut, geprueft und signiert.
3. Die oeffentliche Oberflaeche bietet ausschliesslich USB-Flash an – kein OTA und keine Fernsteuerung.
4. Das Manifest beschreibt Zweck, erforderliche Zusatzhardware, Version, Hash und Signatur.
5. Eine Demo darf nur die Daten verarbeiten, die sie fuer ihre sichtbare Funktion benoetigt.

Der öffentliche Webbereich liest nur freigegebene Releases aus der eigenen `gernetix-public-demos.sqlite`. Er kann keine neue Firmware erzeugen; Releases werden ausschließlich über einen geschützten Veröffentlichungsauftrag angelegt.
