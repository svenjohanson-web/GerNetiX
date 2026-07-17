# Touch-Spielesammlung

Erste GerNetiX-Demoanwendung fuer das lokal getestete **ESP32-S3 ES3C28P Touch-Board** mit 2,8-Zoll-Display und kapazitivem Touch.

## Was der Besucher sieht

Nach dem USB-Flash startet eine einfache Spieleauswahl. Die Anwendung beginnt mit zwei Spielen:

- **Nibbles:** Eine wachsende Spielfigur wird per Touch durch ein Raster gefuehrt.
- **Frogger:** Ein Frosch ueberquert Fahrspuren und erreicht sichere Zielzonen.

## Aufbau

`main` ist ausschliesslich der Anwendungscontroller:

```text
Startbildschirm → Spiel auswaehlen → aktives Spiel aktualisieren und zeichnen
```

Die Spiellogik liegt getrennt in den Spielmodulen. Nibbles kennt keine Menue- oder Flashlogik; Frogger ebenfalls nicht. Die konkrete Display- und Touch-Anbindung bleibt im Boardadapter.

## Veroeffentlichungsstatus

Das eigenstaendige ESP-IDF-Projekt liegt unter `firmware/`. Erst nach einem reproduzierbaren Hardware-Build, Touch-Pruefung und Signatur wird sein Firmware-Image als unveränderlicher Release in `gernetix-public-demos.sqlite` veröffentlicht und im öffentlichen Bereich per USB flashbar angeboten.

OTA, Konto-, Projekt- und Telemetriezugriff sind fuer diese Demo nicht vorgesehen.
