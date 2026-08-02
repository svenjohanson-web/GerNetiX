# Ein-Tasten-Spielesammlung fuer das diymore HW-364A

Dieses Nachbauprojekt erweitert die GerNetiX-ESP8266-Basissoftware um zwei Spiele fuer das integrierte 0,96-Zoll-OLED:

- **Cat Jump:** Die Katze laeuft automatisch. Ein kurzer Tastendruck laesst sie ueber den Hund springen.
- **Cave Bat:** Solange der Taster gedrueckt ist, steigt die Fledermaus. Beim Loslassen sinkt sie.

## Bedienung

Verwendet wird der Taster `FLASH` an `GPIO0` (aktiv LOW). Der danebenliegende Taster `RESET` bleibt der Reset-Taster.

- Menue: kurz druecken = Spiel wechseln
- Menue: etwa 0,7 Sekunden halten = Spiel starten
- Im Spiel: entsprechend der Spielregel druecken beziehungsweise halten
- Nach einer Kollision: kurz druecken = erneut spielen, lange druecken = zurueck zum Menue

Wichtig: Wird `FLASH` waehrend eines Resets gehalten, startet der ESP8266 technisch bedingt im Bootloader. Zum normalen Spielen den Taster beim Einschalten und Reset loslassen.

## Bauen

```text
cd Demoanwendungen/Boards/hardware.processor_board.diymore_hw_364a_esp8266_oled/ein-tasten-spielesammlung/firmware
platformio run -e diymore_hw_364a_games
```

Das Projekt kompiliert die bestehende Basissoftware mit einer getrennten User-Application. Provisioning, WLAN-Setup, Statusendpunkte und Device-Identity bleiben dadurch erhalten. Ein USB-Upload wird von Codex nicht ausgefuehrt.
