# Vorhabensbeschreibung Build-&-Deploy-Server

## Ausgangspunkt

GerNetiX soll Firmware fuer Lernprojekte und Embedded-Projekte reproduzierbar bauen und auf Devices ausrollen koennen. Damit Projektdaten nicht auf einem Build-Worker verstreut werden, erzeugt der Projektserver vollstaendige Build-Pakete. Der Build-&-Deploy-Server fuehrt diese Pakete nur aus.

## Erkannte Entscheidungen

- Der Build-&-Deploy-Server besitzt keine dauerhaften Projektdaten.
- Er kompiliert ausschliesslich aus vollstaendigen BuildPackages des Projektservers.
- Der Projektserver uebertraegt BuildPackages per HTTP.
- Firmware, Build-Log, Deploy-Log und Status werden an den Projektserver zurueckgegeben.
- BuildResults enthalten mindestens `firmware.bin`, `firmware.elf`, `firmware.map`, `build.log`, Build-Status, SHA-256 und Dateigroesse.
- Temporaere Projektdaten werden nach Abschluss geloescht.
- Technische Caches duerfen erhalten bleiben.
- Der Cache ist niemals Quelle der Wahrheit.
- Bei Cacheverlust funktioniert der Build weiterhin, nur langsamer.
- Beim Anlegen eines Lernprojekts darf ein Prebuild der Projekthuelle gestartet werden.
- OTA wird nur durch einen Nutzerauftrag `Build & Flash` gestartet.
- MQTT dient nur fuer Deploy-Auftraege, Statusmeldungen, Heartbeats und Telemetrie.
- HTTPS dient fuer Firmware-Download und Artefaktuebertragung.
- Der Build-&-Deploy-Server stellt Firmware per HTTPS bereit und steuert den Deploy per MQTT.
- Pro Device ist maximal ein aktiver Build-/Deploy-Job erlaubt.
- Optional darf genau ein weiterer Job warten; neue wartende Jobs ersetzen aeltere wartende Jobs.

## Zielbild

```text
Projektserver
  -> vollstaendiges Build-Paket
Build-&-Deploy-Server
  -> Build
  -> optional Deploy-Auftrag
  -> Firmware, Log, Status
Projektserver
  -> speichert Ergebnis und Historie
```

## Erste technische Meilensteine

1. Build-Paket-Format definieren.
2. Build-Job-Lifecycle beschreiben.
3. Cache-Verzeichnisse und Cache-Invalidierung festlegen.
4. Prebuild-Verhalten fuer Lernprojekt-Huellen beschreiben.
5. Device-Job-Lock und Warteschlangenregel spezifizieren.
6. OTA-Deploy-Ablauf ueber Device-Verbindung beschreiben.
7. MQTT-Topics und HTTPS-Artefakt-URLs spezifizieren.

## Offene Punkte

- Welche Queue-Technologie wird im MVP genutzt?
- Wie wird MQTT angebunden oder abstrahiert?
- Wie werden Build-Worker skaliert?
- Wie werden Build-Artefakte signiert?
- Welche Logs duerfen dauerhaft gespeichert werden?
