# Nexi Basic - Waveshare Voice Lab

Nexi Basic ist die lokale, noch cloudfreie erste Produktstufe des geplanten
GerNetiX-Sprachassistenten. Das technische Waveshare Voice Lab bleibt sein
Hardware-Vorlaeufer: Dieses Referenzprojekt startet mit der vollstaendigen, unveraenderten
GerNetiX-ESP32-Basissoftware und bindet die Hardware-Erprobung ausschliesslich
ueber `onProjectInit()` und `onProjectTick()` ein.

## Softwaregrenze

Die GerNetiX-Basissoftware ist auch ohne Nexi vollstaendig start-,
provisionier-, diagnose- und updatefaehig. Ihre schwachen Standard-Hooks bilden
den leeren Projektfall ab. Nexi implementiert ausschliesslich den versionierten
Projekt-Hook-Vertrag und darf WLAN-Setup, Identitaet, OTA, Recovery oder das
Basissoftware-Webinterface weder ersetzen noch veraendern.

Die Referenzfirmware ist inzwischen in eigenstaendig testbare Schichten
aufgeteilt:

```text
include/nexi/
  runtime.h                    kurzer Lifecycle hinter dem Projekt-Hook
  intent.h                     typisierte, eingabeunabhaengige Befehle
  input_provider.h             Vertrag fuer Sprache, Touch und Serviceeingaben
  application*.h              App-Lifecycle und genau eine aktive Anwendung
  capability_policy.h          lokale und freigegebene Cloud-Faehigkeiten
  privacy_gate.h               Aufnahme- und Uebertragungsfreigabe
  hardware_platform.h          Waveshare-Boardadapter
  audio_engine.h               alleiniger Besitzer des Audiopfads
  audio_frame_source.h         feste fluechtige PCM-Frames fuer Spracherkennung
  wake_word_*.h/wake_session.h hardwarefreier Wake-Vertrag und Befehlsfenster
  service_button_input.h       optionale Referenz-/Servicebedienung
  local_story_*.h              begrenzte versionierte Offline-Geschichten
  companion_*.h                kleiner versionierter Begleiterzustand
  local_timer_*.h              lokaler Countdown hinter abstrakter Uhr
  voice_studio_application.h   erste vollstaendige Offline-Anwendung
  voice_types.h/voice_effects.h gemeinsame hardwarefreie Sprachtypen und DSP
src/
  *.cpp                        Implementierungen dieser Module
  project_entry.cpp            einziger Adapter zur Basissoftware
assets/stories/audio/
  *.pcm8                       eingebettete binaere Offline-Geschichten
  manifest.json                Format, Samplezahl und SHA-256 je Asset
voice_lab.cpp                  Composition Root ohne Treiberimplementierungen
```

Damit sind Boardtreiber, Audio Engine, Eingabequelle, Anwendungsmanager,
Stimmenstudio und die lokale Datenschutz-/Faehigkeitsgrenze getrennt. Fuer das
Wake Word ist der hardwarefreie Pfad von einer gestreamten WAV-Quelle ueber
einen austauschbaren Detector bis zum einmaligen `WakeDetected`-Intent und
einem begrenzten Befehlsfenster implementiert und hostseitig getestet. Der
Waveshare-Build bindet zusaetzlich den ES7210 als fluechtige 16-kHz-PCM-Quelle
und sprecherabhaengige Detektoren fuer acht vollstaendige lokale Saetze ein:
Stimmenstudio, Reaktionsspiel, Klangquiz oder lokale Geschichten starten,
stoppen, lauter, leiser und naechster Effekt. Beim ersten
Start werden je Satz zwei persoenliche Referenzen ueber KEY2 aufgenommen. Die Firmware
verwirft das PCM direkt nach der Merkmalsextraktion und speichert nur ein
versioniertes, quantisiertes Merkmalsprofil in der eigenen 256-KiB-NVS-Partition
`nexivoice2`. Profile aus der frueheren 60-KiB-Partition `nexivoice` werden
nach erfolgreichem Kopieren automatisch entfernt. Das normale NVS fuer
Basissoftware und Provisioning bleibt davon
unberuehrt. Bei spaeteren Starts
wird dieses Profil geladen. Die zuvor getrennt eingelernten Wortprofile werden
erst nach erfolgreicher Speicherung aller neuen Satzprofile geloescht. Lokale Sprachbefehle
und weitere Offline-Anwendungen werden auf denselben Vertraegen ergaenzt. Die
verbindlichen Abhaengigkeitsregeln und der aktuelle Umsetzungsstand stehen
unter `docs/nexi-firmware-architecture.md`.

Beim Einschalten fragt die aktuelle Hardware-Referenz den Betriebsmodus ab.
KEY1 wechselt zwischen dem gruen dargestellten Stimmenstudio, dem
orange dargestellten Reaktionsspiel, dem blau dargestellten Klangquiz, den
violett dargestellten lokalen Geschichten, dem lokalen Begleiter, dem orange
dargestellten lokalen Timer und dem separaten KI-Geschichtenmodus; KEY2
bestaetigt. Der KI-Modus ist bis zur
Anbindung des GerNetiX-Sprachdienstes als nicht verfuegbar markiert und sendet
keine Audiodaten. Im Stimmenstudio fuehrt ein langer Druck von etwa einer
Sekunde auf KEY1 zurueck zur Modusauswahl. Diese Tastensteuerung ist
ein optionaler Service-Input fuer Aufbau, Diagnose und Entwicklung. Die
spaetere normale Produktbedienung wechselt Anwendungen ueber einen lokalen
Sprach-InputProvider und benoetigt dafuer keine Modustaste.

## Erster Meilenstein

Beim Start prueft das Projekt den gemeinsamen I2C-Bus auf GPIO10/GPIO11. Im
seriellen GerNetiX-Feedback muessen folgende Komponenten erscheinen:

| Adresse | Komponente | Aufgabe |
| --- | --- | --- |
| `0x18` | ES8311 | Lautsprecher-Codec |
| `0x20` | TCA9555 | I/O-Expander |
| `0x40` | ES7210 | Dual-Mikrofon-Codec |
| `0x51` | PCF85063 | RTC |

Fehlende Komponenten werden als Warnung protokolliert. Sind alle Komponenten
vorhanden, zeigt eine einzelne gruene LED die Bereitschaft. Solange
KEY2 (TCA9555 EXIO10) gedrueckt wird, zeichnet das Voice
Lab ueber den ES7210 in einem fluechtigen PSRAM-Puffer auf. Beim Loslassen wird
die Aufnahme ueber den ES8311 wiedergegeben. Die maximale Aufnahmedauer ist auf
15 Sekunden begrenzt. Der auf dem Board
vorhandene Lautsprecherverstaerker wird dafuer gezielt ueber TCA9555 EXIO8
aktiviert und nach der Wiedergabe wieder abgeschaltet. Danach wird der gesamte
Puffer explizit ueberschrieben und freigegeben. Beide Mikrofonspuren werden
getrennt vermessen. Fuer die Mono-Wiedergabe wird die staerkere Spur gewaehlt,
um Phasenausloeschung zu vermeiden, und mit begrenzter digitaler Verstaerkung
samt Clipping-Schutz auf einen brauchbaren Pegel gebracht. Der serielle Monitor
zeigt beide Spitzenpegel, die gewaehlte Spur und den Verstaerkungsfaktor.

Die sieben WS2812-Status-LEDs auf GPIO38 zeigen den Ablauf ohne seriellen
Monitor: Eine gruene LED bedeutet bereit, waehrend des Gedrueckthaltens leuchten
alle LEDs rot, waehrend der Wiedergabe blau und nach erfolgreichem Abschluss
kurz alle gruen. Danach kehrt die Anzeige zur Bereitschaft zurueck.

Die aeusserste Funktionstaste KEY1 (TCA9555 EXIO9) schaltet zyklisch immer zum
naechsten Effekt: Normal, Roboter, Monster, Helium und Echo. Die
Bereitschaftsanzeige kodiert Auswahl und Position mit Farbe und ein bis fuenf
LEDs. Roboter kombiniert Bitreduktion mit Ringmodulation, Monster spielt tiefer
und langsamer, Helium hoeher und schneller und Echo mischt das Signal mit einer
um 250 Millisekunden verzoegerten Kopie. Die Verarbeitung erfolgt blockweise
ohne zweite vollstaendige Aufnahme im PSRAM. Die letzte Aufnahme bleibt im
fluechtigen PSRAM erhalten. Jeder Wechsel zum naechsten Effekt spielt sie sofort
mit der neuen Auswahl ab. Erst der Beginn einer neuen Aufnahme ueberschreibt den
alten Puffer.

Die mittlere der fuenf sichtbaren Tasten, KEY3 (TCA9555 EXIO11), regelt die Wiedergabe in fuenf
Stufen von 20 bis 100 Prozent. Ein kurzer Druck wechselt zyklisch zur naechsten
Stufe und hebt eine Stummschaltung auf. Ein Druck von etwa einer Sekunde
schaltet stumm beziehungsweise stellt die zuvor gewaehlte Stufe wieder her.
Zur Rueckmeldung zeigen die LEDs kurz gelb die gewaehlte Stufe; bei
Stummschaltung leuchten alle LEDs kurz orange. Die Lautstaerkeeinstellung ist
rein lokal und wird nach einem Neustart nicht wiederhergestellt.

Beim Start ist der ES8311-Ausgang fuer den aktuellen Hardwaretest auf 100
Prozent gesetzt. Der digitale Audiopfad behaelt seinen Clipping-Schutz; beim
ersten Test ist trotzdem ausreichend Abstand zum Lautsprecher einzuhalten.

## Bedienung

Bei lesbarem Board-Aufdruck und USB-C-Anschluss oben liegen die fuenf Tasten
rechts neben dem Anschluss. Vom USB-Anschluss nach aussen lautet die feste
Reihenfolge `RESET`, `BOOT`, `KEY3`, `KEY2`, `KEY1`. RESET und BOOT sind
Systemtasten; nur KEY1 bis KEY3 steuern Nexi. Damit ist KEY3 die mittlere aller
fuenf sichtbaren Tasten. KEY2 liegt zwischen KEY3 und der aeussersten KEY1.

| Taste | Kurz druecken | Gedrueckt halten |
| --- | --- | --- |
| KEY1 / aeusserste Taste | naechster Effekt oder Modus | im Stimmenstudio zurueck zur Modusauswahl |
| KEY2 / zweite Taste von aussen | Auswahl bestaetigen | Aufnahme nur fuer die Dauer des Tastendrucks |
| KEY3 / Mitte aller fuenf Tasten | naechste Lautstaerkestufe | stumm beziehungsweise wieder hoerbar |

Gruen steht fuer lokale Bereitschaft, Rot fuer Aufnahme und Blau fuer
Wiedergabe. Der violette KI-Geschichtenmodus ist nur als Vorschau auf die
spaetere, allgemeine GerNetiX-Assistenteninfrastruktur enthalten. Er nimmt
nichts auf und loest weder Netzwerkzugriffe noch Audio-Uploads aus.

## Lokaler Build

Vom Verzeichnis `basissoftware/esp32` aus:

```sh
platformio run -e waveshare-esp32-s3-audio-voice-lab
```

Der Nutzerschritt zum Flashen aus diesem Verzeichnis lautet:

```sh
platformio run -e waveshare-esp32-s3-audio-voice-lab -t upload
```

Wenn noch keine gueltigen Satzprofile vorhanden sind, fordert die Firmware
nacheinander je zwei Referenzen fuer diese Saetze an:

1. `Hey Nexi, starte das Stimmenstudio`
2. `Hey Nexi, stopp`
3. `Hey Nexi, lauter`
4. `Hey Nexi, leiser`
5. `Hey Nexi, naechster Effekt`
6. `Hey Nexi, starte das Reaktionsspiel`
7. `Hey Nexi, starte das Klangquiz`
8. `Hey Nexi, starte die Geschichten`

Fuer jede Referenz KEY2 halten, den vollstaendigen Satz
ohne kuenstliche Pause natuerlich sprechen und KEY2 loslassen. Gruene LEDs
bestaetigen eine angenommene Referenz; rote LEDs bedeuten, dass sie wiederholt
werden muss. Danach zeigt eine cyanfarbene LED die Satzbereitschaft.

`Hey Nexi, starte das Stimmenstudio` wird in einem Zug gesprochen und startet
dieselbe lokale Anwendung wie die bisherige Tastenwahl. Im untaetigen
Stimmenstudio beendet der ebenfalls fluessig gesprochene Satz
`Hey Nexi, stopp` die Anwendung ueber denselben typisierten
`StopApplication`-Intent wie ein langer Druck auf KEY1 und loescht die
fluechtige Aufnahme. Die drei weiteren Saetze veraendern im laufenden
Stimmenstudio die Lautstaerke beziehungsweise waehlen den naechsten Effekt.
`Hey Nexi, starte das Reaktionsspiel` wechselt in eine zweite lokale Anwendung.
Nach einer zufaelligen Wartezeit fordert sie KEY1, KEY2 oder KEY3 mit einem
farbigen LED-Muster und einem kurzen Ton an. Zu fruehe, falsche und richtige
Eingaben werden getrennt gewertet; ein langer Druck auf KEY1 oder der
Stopp-Satz beendet das Spiel. Ohne kompatible aktive Anwendung werden
Laufzeitbefehle sicher ignoriert. Waehrend einer
blockierenden Aufnahme oder Wiedergabe ist
die Spracherkennung in diesem ersten Durchstich noch pausiert. Der serielle
Monitor protokolliert fuer jeden vollstaendigen Sprachkandidaten Abstand,
persoenlichen Schwellwert, Kandidatenlaenge, erwartete Laenge und Entscheidung.
Der Schwellwert wird robust aus dem engsten Referenzpaar gebildet;
deutlich kuerzere oder laengere Kandidaten werden vor dem
Merkmalsvergleich abgelehnt. Mehrere Wiederholungen aus etwa
0,5, 1 und 2 Metern sowie mindestens zehn Minuten Sprache ohne Testwort sind zu
protokollieren. Das lokale Klangquiz spielt pro Aufgabe ein bis drei Toene ab:
KEY1 steht fuer einen Ton, KEY2 fuer zwei und KEY3 fuer drei. Drei eingebaute
Pakete bieten einen langsamen Einstieg, schnellere hohe Toene und tiefere
Toene. KEY1/KEY3 wechseln in der Paketauswahl, KEY2 startet. Jedes Paket ist
versioniert und darf hoechstens zwoelf Aufgaben enthalten; der Katalog ist auf
vier Pakete und 48 Aufgaben begrenzt. Aktuell sind enthalten:

- `nexi.sound-memory.beginner.de` Version 1 mit 6 Aufgaben,
- `nexi.sound-memory.fast.de` Version 1 mit 9 Aufgaben,
- `nexi.sound-memory.deep.de` Version 1 mit 9 Aufgaben.

Punktestand und Antworten bleiben fluechtig. Die Auswahl startet ueber die
Moduswahl oder mit `Hey Nexi, starte das Klangquiz`.

Die lokalen Geschichten enthalten drei eigens fuer Nexi geschriebene
Kurztexte in zwei versionierten Paketen. Die gesprochenen Audiodaten liegen
als echte `.pcm8`-Binaerassets mit 8 kHz, 8 Bit und einem Monokanal im
Firmware-Flash. ESP-IDF bettet sie beim Build ein; C++ enthaelt nur Katalog,
Metadaten und die Linker-Symbolbindung. Die Samples werden blockweise ueber den
bestehenden 16-kHz-Stereo-Codec ausgegeben. Es werden weder Texte noch
Nutzerdaten geladen oder uebertragen. In der Storyauswahl wechseln KEY1 und
KEY3 zur vorherigen beziehungsweise naechsten Geschichte; KEY2 spielt die
Auswahl. Der Katalog ist auf vier Pakete, vier Geschichten je Paket, zwoelf
Geschichten und 120 Sekunden insgesamt begrenzt. Enthalten sind:

- `nexi.stories.wonder.de` Version 1 mit zwei Geschichten,
- `nexi.stories.calm.de` Version 1 mit einer Geschichte.

Die Auswahl startet ueber die Moduswahl oder mit
`Hey Nexi, starte die Geschichten`. Die Audioausgabe ist in diesem
Durchstich noch blockierend; Sprache und Tasten werden waehrend einer maximal
45 Sekunden langen Geschichte erst danach wieder ausgewertet.

Die Binaerassets und ihr Hash-/Laengenmanifest unter
`assets/stories/audio/` werden auf macOS aus `stories.de.json` mit
`node tools/generate-local-story-audio.js` neu erzeugt. Die
generierten Audiodateien werden nicht manuell bearbeitet.

Der lokale Begleiter ist der erste NEXI-06-Durchstich. Er fuehrt die vier
begrenzten Werte Energie, Freude, Vertrauen und Anzahl der Interaktionen.
KEY1 spielt mit ihm, KEY2 fuettert ihn und KEY3 laesst ihn ruhen. Die LEDs und
kurze Toene unterscheiden muede, einsame, neugierige und froehliche Stimmung.
Langes KEY3 setzt nur diesen Begleiter auf seine Startwerte zurueck; langes
KEY1 beendet die Anwendung.

Der Zustand liegt als 16-Byte-Datensatz mit Schemaversion und Pruefsumme unter
dem eigenen NVS-Namespace `nexi_friend`. Mehrere schnelle Aktionen werden zu
hoechstens einem Speichervorgang pro Sekunde zusammengefasst. Version 1 wird
auf Version 2 migriert; unbekannte oder beschaedigte Daten verwenden sichere
Startwerte. Weder das Basissoftware-NVS noch die Sprachprofile werden beim
Reset geloescht. Der Begleiter wird vorerst nur ueber die Moduswahl gestartet,
weil alle acht vorgesehenen persoenlichen Sprachsatzplaetze bereits belegt
sind. Er benoetigt kein Konto, Netzwerk oder KI-Credits.

Der erste NEXI-07-Durchstich ist ein vollstaendig lokaler Countdown. In der
Auswahl wechseln KEY1 und KEY3 zwischen einer, drei und fuenf Minuten; KEY2
startet. Waehrend der Timer laeuft, pausiert beziehungsweise setzt KEY2 ihn
fort, KEY3 addiert eine Minute und KEY1 bricht ihn ab. Nach Ablauf blinken alle
LEDs rot und ein Doppelton wiederholt sich alle drei Sekunden, bis eine der drei
Tasten den Alarm bestaetigt. Langes KEY1 beendet die Timer-Anwendung wie die
anderen lokalen Anwendungen.

Im laufenden Betrieb zaehlt der Countdown mit der monotonen ESP-Laufzeituhr.
Parallel liefert der PCF85063 eine lokale, stromunabhaengig fortlaufende
Sekundenbasis fuer die gespeicherte Deadline. Sie ist bewusst keine eingestellte
Orts- oder Cloudzeit. Ein 28-Byte-Datensatz mit Version und Pruefsumme liegt im
eigenen NVS-Namespace `nexi_timer`; gespeichert werden nur Phase, Preset,
Deadline beziehungsweise Restzeit und Gesamtdauer. Nach einem Neustart wird ein
offener Timer vor der normalen Einrichtung automatisch fortgesetzt. Ist seine
Deadline bereits vorbei, beginnt direkt der Alarm.

Langes KEY3 waehrend eines laufenden Timers speichert die Deadline und versetzt
den ESP32 in Deep Sleep. Der interne ESP32-RTC-Timer weckt das Board zur
Deadline; danach prueft die Firmware den PCF85063 und den gespeicherten Zustand.
Bei echtem Stromverlust bleibt die Deadline nur mit angeschlossener
RTC-Pufferbatterie zeitlich korrekt. Ohne gueltigen Oszillatorstand wird eine
neutrale lokale Epoche initialisiert und ein veralteter Timer sicher verworfen.
Ein eigener Sprachsatz fuer den Timer ist noch nicht belegt, weil die acht
persoenlichen Satzprofile bereits vollstaendig genutzt werden.

KEY1 ueberspringt die Einrichtung beziehungsweise beendet den
Voice-Entry-Test und oeffnet die bisherige Moduswahl. Nach erfolgreicher
Einrichtung werden alle acht Satzprofile lokal gespeichert und beim naechsten
Start ohne neue Aufnahme geladen. KEY3 beim Start gedrueckt halten und dann
loslassen, um alle Profile zu loeschen und bewusst neu einzulernen.

Flashen und serielles Monitoring bleiben bewusste lokale Nutzerschritte. Fuer
die Wiedergabe muss ein geeigneter Lautsprecher angeschlossen sein. Nach dem
erfolgreichen Loopback-Test folgen die ersten Effekte.

Fuer einen vollstaendigen Wiederaufnahmetest nach mehreren Firmwarepaketen gilt
der [Nexi Board-Regressions-Testplan](../../docs/nexi-board-regression-test-plan.md).

## Datenschutz

Das Projekt uebertraegt weder Satzreferenzen noch Aufnahmen. Roh-Audio
wird nicht persistiert. Die persoenlichen Satzprofile bestehen aus
versionierten, quantisierten Merkmalen und liegen ausschliesslich in der
lokalen NVS-Partition `nexivoice2` des ESP32. Format-, Phrasen- oder
Pruefsummenfehler fuehren zur sicheren
Neueinrichtung; KEY3 beim Start loescht alle Profile. Die jeweils letzte Stimmenstudio-
Aufnahme liegt nur fluechtig im PSRAM, damit Effektwechsel ohne erneutes
Einsprechen vorgehoert werden koennen. Sie wird beim Start einer neuen Aufnahme,
bei einem Fehler oder beim Ausschalten verworfen und nicht in Flash, SD-Karte
oder Netzwerk geschrieben.
Der Begleiter persistiert ausschliesslich vier kleine Zahlenwerte mit Version
und Pruefsumme; er speichert keine Sprache, Namen, Kontodaten oder Zeitprofile.
Der lokale Timer persistiert einen 28-Byte-Steuerdatensatz ohne Sprache, Namen,
Kontodaten oder Ortszeit. Er greift nicht auf Netzwerk-, Konto- oder
Clouduhrzeit zu; Abbruch und Alarmbestaetigung loeschen nur `nexi_timer/state`.
