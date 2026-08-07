# Nexi Board-Regressions-Testplan

## Zweck

Dieser Plan nimmt einen laenger nicht getesteten Nexi-Stand kontrolliert wieder
auf. Er prueft zuerst die gemeinsame Hardware und die bereits gespeicherten
Sprachprofile, danach jede lokale Anwendung und zuletzt die riskanteren
Persistenz-, RTC- und Deep-Sleep-Pfade.

Der Plan ist wiederverwendbar. Nach einem fehlgeschlagenen Test muss nicht von
vorn begonnen werden: Fehler notieren, den betroffenen Block abbrechen und beim
naechsten Lauf ab dessen Voraussetzung fortsetzen.

## Testprotokoll

Vor Beginn ausfuellen:

| Feld | Eintrag |
| --- | --- |
| Datum und Uhrzeit | |
| Git-Commit (`git rev-parse --short HEAD`) | |
| Board | Waveshare ESP32-S3-AUDIO-Board |
| Stromversorgung | USB / Akku / beides |
| RTC-Pufferbatterie angeschlossen | ja / nein / unbekannt |
| Lautsprecher angeschlossen | ja / nein |
| Ungefaehrer Sprechabstand | |
| NVS vor dem Test geloescht | nein / ja, Grund: |
| Tester | |

Ergebniskennzeichen:

- `[ ]` noch nicht getestet
- `[x]` bestanden
- `[!]` Abweichung; Log und Beobachtung notieren
- `[-]` bewusst uebersprungen; Grund notieren

## Vorbereitung

Am Mac aus `basissoftware/esp32`:

```sh
cd /Users/sven/Documents/Codex/2026-07-11/kan/GerNetiX/basissoftware/esp32
/Users/sven/.platformio/penv/bin/platformio run -e waveshare-esp32-s3-audio-voice-lab -t upload
/Users/sven/.platformio/penv/bin/platformio device monitor -b 115200
```

Der Upload soll die vorhandenen NVS-Daten nicht loeschen. Keine Erase-,
Partition-Reset- oder KEY3-Profilreset-Aktion ausfuehren, bevor die
Persistenzpruefung abgeschlossen ist. Beim ersten Audiotest Abstand zum
Lautsprecher halten.

Sofort abbrechen bei:

- wiederholtem Watchdog-Neustart oder Bootschleife,
- dauerhaft eingeschaltetem Lautsprecherverstaerker mit Stoergeraeusch,
- auffaelliger Erwaermung oder instabiler Versorgung,
- wiederholtem I2C-Ausfall mehrerer Komponenten.

Bei nur fehlendem PCF85063 duerfen Audio-, Sprach- und App-Tests fortgesetzt
werden; RTC-, Wiederanlauf- und Deep-Sleep-Tests werden dann als blockiert
markiert.

## Sitzung 1: Boot, Audio und Sprache

Zielzeit: etwa 30 bis 45 Minuten.

### B01 – Firmwarestart und Hardwareprobe

- [ ] Firmware flashen und seriellen Monitor oeffnen.
- [ ] Genau einen normalen Nexi-Runtime-Start beobachten.
- [ ] Im Log erscheinen ES8311 bei `0x18`, TCA9555 bei `0x20`, ES7210 bei
  `0x40` und PCF85063 bei `0x51` als erkannt.
- [ ] `Hardware probe complete: 4/4 expected devices detected` erscheint.
- [ ] Lautsprecherverstaerker wird nach der Initialisierung deaktiviert.
- [ ] RTC meldet entweder `PCF85063 retained clock ready` oder beim allerersten
  Lauf genau einmal die Initialisierung der lokalen Epoche.

Bestanden, wenn keine Bootschleife auftritt, alle vier I2C-Komponenten erkannt
werden und die Runtime bedienbar bleibt.

Beobachtung/Log:

```text

```

### B02 – Vorhandene Sprachprofile

- [ ] Beim normalen Neustart werden gespeicherte Satzprofile geladen.
- [ ] Nexi fordert nicht erneut alle acht Saetze an.
- [ ] Die cyanfarbene Satzbereitschaft erscheint.
- [ ] KEY1 beendet den Sprachtest und oeffnet die Modusauswahl.

Falls Nexi neu einlernen moechte, nicht sofort resetten. Im Log notieren,
welches Profil fehlt oder als ungueltig erkannt wurde, dann die angeforderten
Referenzen gemaess B03 aufnehmen.

### B03 – Einlernen nur bei Bedarf

Dieser Test ist nur erforderlich, wenn keine gueltigen Profile vorhanden sind.

- [ ] Fuer jeden angeforderten Satz KEY2 halten, Satz fluessig sprechen und
  KEY2 loslassen.
- [ ] Jede angenommene Referenz wird gruen bestaetigt.
- [ ] Eine rote Ablehnung wird wiederholt und als Abweichung mit Satznummer
  notiert.
- [ ] Alle acht Saetze werden jeweils zweimal angenommen:

1. `Hey Nexi, starte das Stimmenstudio`
2. `Hey Nexi, stopp`
3. `Hey Nexi, lauter`
4. `Hey Nexi, leiser`
5. `Hey Nexi, naechster Effekt`
6. `Hey Nexi, starte das Reaktionsspiel`
7. `Hey Nexi, starte das Klangquiz`
8. `Hey Nexi, starte die Geschichten`

- [ ] Nach einem normalen Reset werden die Profile ohne neue Aufnahme geladen.

### B04 – Sprachbefehle und Negativtest

Jeden Satz normal und einmal etwas schneller aus etwa einem Meter Entfernung
sprechen. Im seriellen Log Distanz, Schwellwert, Laenge und Entscheidung
notieren, wenn eine Variante scheitert.

| Test | Aktion | Soll | Ergebnis |
| --- | --- | --- | --- |
| V01 | `Hey Nexi, starte das Stimmenstudio` | Stimmenstudio wird aktiv | [ ] |
| V02 | `Hey Nexi, lauter` | Lautstaerke steigt | [ ] |
| V03 | `Hey Nexi, leiser` | Lautstaerke sinkt | [ ] |
| V04 | `Hey Nexi, naechster Effekt` | Effekt wechselt | [ ] |
| V05 | `Hey Nexi, stopp` | aktive Anwendung endet | [ ] |
| V06 | `Hey Nexi, starte das Reaktionsspiel` | Reaktionsspiel startet | [ ] |
| V07 | `Hey Nexi, starte das Klangquiz` | Klangquiz startet | [ ] |
| V08 | `Hey Nexi, starte die Geschichten` | Storyauswahl startet | [ ] |
| V09 | `starte das Stimmenstudio` ohne `Hey Nexi` | keine Aktivierung | [ ] |
| V10 | mindestens zwei Minuten normale Sprache | keine Fehlaktivierung | [ ] |

Wenn eine Anwendung fuer den naechsten Sprachtest verlassen werden muss,
`Hey Nexi, stopp` oder KEY1 lang verwenden. Waehrend einer laufenden
Storywiedergabe werden Eingaben erst nach deren Ende verarbeitet.

### B05 – Stimmenstudio-Grundfunktion

- [ ] Stimmenstudio ueber die Moduswahl starten.
- [ ] KEY2 halten, einen kurzen Satz aufnehmen und loslassen.
- [ ] LEDs: Aufnahme rot, Wiedergabe blau, Abschluss gruen.
- [ ] Wiedergabe ist verstaendlich und frei von dauerhaftem Knacken.
- [ ] KEY1 kurz prueft nacheinander Normal, Roboter, Monster, Helium und Echo.
- [ ] Die letzte Aufnahme wird bei jedem Effektwechsel erneut wiedergegeben.
- [ ] KEY3 kurz durchlaeuft fuenf Lautstaerkestufen.
- [ ] KEY3 lang schaltet stumm und wieder hoerbar.
- [ ] KEY1 lang beendet das Stimmenstudio.

## Sitzung 2: Lokale Anwendungen

Zielzeit: etwa 45 bis 60 Minuten.

In der Modusauswahl wechselt KEY1 durch Stimmenstudio, Reaktionsspiel,
Klangquiz, Geschichten, Begleiter, Timer und KI-Geschichtenvorschau. KEY2
bestaetigt. Die serielle Modusbezeichnung ist fuer die Auswahl massgeblich.

### A01 – Modusauswahl und KI-Vorschau

- [ ] Alle sieben Modi lassen sich ohne Haenger durchschalten.
- [ ] Jeder Modus besitzt eine unterscheidbare LED-Anzeige.
- [ ] KI-Geschichten meldet kontrolliert `nicht verfuegbar`.
- [ ] Die KI-Vorschau nimmt nichts auf und startet keinen Audio-Upload.
- [ ] Danach ist die Modusauswahl weiter bedienbar.

### A02 – Reaktionsspiel

- [ ] Reaktionsspiel starten; zufaellige Wartephase beginnt.
- [ ] Ein zu frueher Tastendruck wird als Fehlstart behandelt.
- [ ] LED-/Tonziel fuer KEY1 korrekt treffen.
- [ ] LED-/Tonziel fuer KEY2 korrekt treffen.
- [ ] LED-/Tonziel fuer KEY3 korrekt treffen.
- [ ] Ein absichtlich falscher Tastendruck wird anders als ein Treffer gewertet.
- [ ] Eine Runde ohne Eingabe endet kontrolliert im Timeout.
- [ ] KEY1 lang beendet das Spiel und kehrt zur Modusauswahl zurueck.

### A03 – Klangquiz

- [ ] Klangquiz starten und Paketwahl sehen.
- [ ] KEY1 und KEY3 wechseln vor und zurueck durch drei Pakete.
- [ ] KEY2 startet das gewaehlte Paket.
- [ ] Ein Ton wird mit KEY1, zwei Toene mit KEY2 und drei Toene mit KEY3
  beantwortet.
- [ ] Mindestens je eine Aufgabe aus allen drei Paketen ist hoerbar.
- [ ] Das Beginner-Paket einmal vollstaendig bis zur Abschlusswertung spielen.
- [ ] Eine falsche Antwort und ein Timeout werden kontrolliert ausgewertet.
- [ ] KEY1 lang beendet das Quiz.

### A04 – Lokale Geschichten

- [ ] Storyauswahl starten.
- [ ] KEY1 und KEY3 wechseln durch alle drei Geschichten.
- [ ] KEY2 startet die gewaehlte Geschichte.
- [ ] Alle drei Geschichten einmal vollstaendig abspielen.
- [ ] Sprache ist verstaendlich; kein dauerhaftes Knacken oder Haengen.
- [ ] Nach jeder Geschichte wird die Auswahl wieder bedienbar.
- [ ] Bestaetigen, dass Eingaben waehrend der blockierenden Wiedergabe erst
  danach verarbeitet werden.
- [ ] KEY1 lang beendet die Anwendung.

### A05 – Lokaler Begleiter

- [ ] Begleiter starten und Startstimmung im Log notieren.
- [ ] KEY1 kurz: spielen; Freude und Vertrauen steigen, Energie sinkt.
- [ ] KEY2: fuettern; Energie, Freude und Vertrauen steigen.
- [ ] KEY3 kurz: ruhen; Energie und Vertrauen steigen.
- [ ] LEDs und Toene unterscheiden mindestens zwei Stimmungen sichtbar oder
  hoerbar.
- [ ] Log enthaelt begrenzte Werte fuer Energie, Freude, Vertrauen und
  Interaktionen.
- [ ] Nach etwa einer Sekunde erscheint `Companion state stored locally`.
- [ ] KEY1 lang beendet die Anwendung.

Den langen KEY3-Reset erst in Sitzung 3 ausfuehren.

### A06 – Timer-Grundfunktion

- [ ] Timer starten; KEY1/KEY3 wechseln zwischen 1, 3 und 5 Minuten.
- [ ] Ein-Minuten-Preset mit KEY2 starten.
- [ ] Nach etwa zehn Sekunden KEY2 pausieren.
- [ ] Zehn Sekunden warten; die Restzeit darf im Pausenzustand nicht sinken.
- [ ] KEY2 setzt fort.
- [ ] KEY3 kurz addiert eine Minute; Log zeigt die neue Restzeit.
- [ ] KEY1 kurz bricht den Timer ab und kehrt zur Presetauswahl zurueck.
- [ ] Einen neuen Ein-Minuten-Timer vollstaendig ablaufen lassen.
- [ ] Nach Ablauf blinken alle LEDs rot und der Doppelton wiederholt sich etwa
  alle drei Sekunden.
- [ ] Eine beliebige Taste bestaetigt den Alarm und beendet die Wiederholung.
- [ ] KEY1 lang beendet die Timer-Anwendung.

## Sitzung 3: Persistenz, RTC und Deep Sleep

Zielzeit: etwa 20 bis 35 Minuten. Erst beginnen, wenn Sitzungen 1 und 2 keine
Bootschleife oder grundlegenden Hardwarefehler gezeigt haben.

### P01 – Sprachprofil-Persistenz

- [ ] Board normal resetten, ohne KEY3 zu halten.
- [ ] Alle acht Sprachprofile werden ohne Neuaufnahme geladen.
- [ ] Einen Start- und den Stopp-Satz erfolgreich pruefen.

### P02 – Begleiter-Persistenz und isolierter Reset

- [ ] Begleiter starten, zwei unterschiedliche Aktionen ausfuehren und die
  geloggten Werte notieren.
- [ ] Mindestens eine Sekunde auf die Speichermeldung warten.
- [ ] Board resetten und Begleiter erneut starten.
- [ ] Werte und Interaktionszaehler entsprechen dem gespeicherten Stand.
- [ ] KEY3 etwa eine Sekunde halten und loslassen.
- [ ] `Companion reset completed` erscheint und Startwerte werden angezeigt.
- [ ] Nach erneutem Boardreset bleiben Sprachprofile weiterhin geladen.

### P03 – Timer-Wiederanlauf nach normalem Reset

- [ ] Drei-Minuten-Timer starten und etwa 20 Sekunden laufen lassen.
- [ ] Board ueber RESET neu starten.
- [ ] Log zeigt `Saved local timer found` und eine Wiederherstellung vor der
  normalen Spracheinrichtung.
- [ ] Restzeit ist plausibel kleiner als vor dem Reset.
- [ ] Timer mit KEY1 kurz abbrechen; danach darf er beim naechsten Reset nicht
  erneut erscheinen.

### P04 – Deep Sleep und automatisches Aufwachen

- [ ] Ein-Minuten-Timer starten.
- [ ] Nach etwa zehn Sekunden KEY3 ungefaehr eine Sekunde halten und loslassen.
- [ ] Log meldet den gespeicherten Timer und Deep Sleep.
- [ ] LEDs gehen aus; die serielle Verbindung darf erwartungsgemaess abbrechen.
- [ ] Board nicht manuell resetten oder neu flashen.
- [ ] Zur Deadline startet das Board selbst neu.
- [ ] Log zeigt den gespeicherten Timer; unmittelbar danach beginnt der Alarm.
- [ ] Alarm mit einer Taste bestaetigen.
- [ ] Nach einem weiteren Reset erscheint kein alter Timer mehr.

### P05 – Stromunterbrechung mit RTC-Pufferbatterie

Nur ausfuehren, wenn eine geeignete RTC-Pufferbatterie angeschlossen ist.

- [ ] Drei-Minuten-Timer starten und etwa 20 Sekunden laufen lassen.
- [ ] Hauptversorgung fuer etwa 30 Sekunden vollstaendig trennen.
- [ ] Hauptversorgung wieder einschalten.
- [ ] PCF85063 wird als gueltig erkannt; keine neue lokale Epoche wird gesetzt.
- [ ] Timer wird mit um ungefaehr 30 Sekunden verringerter Restzeit fortgesetzt.
- [ ] Strom bis nach der Deadline trennen und danach einschalten.
- [ ] Nexi erkennt die verpasste Deadline und alarmiert direkt.
- [ ] Alarm bestaetigen; gespeicherter Timer ist danach geloescht.

Ohne RTC-Pufferbatterie ist ein Verwerfen des Timers bei erkanntem
Oszillatorverlust das sichere und erwartete Verhalten.

### P06 – Optionaler Sprachprofil-Reset

Dieser Test loescht bewusst alle persoenlichen Satzprofile und verursacht den
vollstaendigen Einlernaufwand. Nur ganz am Ende und nur bei Bedarf ausfuehren.

- [ ] KEY3 bereits beim Start gedrueckt halten und dann loslassen.
- [ ] Firmware meldet das Loeschen der aktuellen und alten Sprachprofile.
- [ ] Alle acht Saetze werden erneut angefordert.
- [ ] Nach vollstaendigem Einlernen und normalem Reset werden sie wieder geladen.
- [ ] Begleiter- und Basissoftwaredaten wurden durch den Sprachprofilreset nicht
  geloescht.

## Abschluss und Rueckmeldung

Eine Sitzung gilt als bestanden, wenn alle Pflichtpunkte entweder `[x]` oder
begruendet `[-]` sind, keine unerwartete Bootschleife auftrat und kein Zustand
eines anderen Moduls unbeabsichtigt geloescht wurde.

Zusammenfassung:

| Bereich | Ergebnis | Wichtigste Beobachtung oder Logzeile |
| --- | --- | --- |
| Boot und I2C | |
| Sprachprofile | |
| Sprachbefehle | |
| Stimmenstudio | |
| Reaktionsspiel | |
| Klangquiz | |
| Geschichten | |
| Begleiter | |
| Timer-Grundfunktion | |
| Neustartpersistenz | |
| Deep Sleep | |
| RTC-Stromunterbrechung | |

Fuer eine gezielte Fehleranalyse reichen zunaechst:

1. Test-ID, zum Beispiel `P04`.
2. Erwartetes und beobachtetes Verhalten.
3. Etwa 20 serielle Logzeilen vor und nach dem Fehler.
4. Ob ein normaler Reset, Deep Sleep oder eine Stromunterbrechung vorausging.
5. Ob RTC-Pufferbatterie und Lautsprecher angeschlossen waren.
