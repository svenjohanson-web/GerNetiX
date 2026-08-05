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
  service_button_input.h       optionale Referenz-/Servicebedienung
  voice_studio_application.h   erste vollstaendige Offline-Anwendung
  voice_types.h/voice_effects.h gemeinsame hardwarefreie Sprachtypen und DSP
src/
  *.cpp                        Implementierungen dieser Module
  project_entry.cpp            einziger Adapter zur Basissoftware
voice_lab.cpp                  Composition Root ohne Treiberimplementierungen
```

Damit sind Boardtreiber, Audio Engine, Eingabequelle, Anwendungsmanager,
Stimmenstudio und die lokale Datenschutz-/Faehigkeitsgrenze getrennt. Wake
Word, lokale Sprachbefehle und die weiteren Offline-Anwendungen werden auf
denselben Vertraegen ergaenzt. Die verbindlichen Abhaengigkeitsregeln und der
aktuelle Umsetzungsstand stehen unter `docs/nexi-firmware-architecture.md`.

Beim Einschalten fragt die aktuelle Hardware-Referenz den Betriebsmodus ab. Die linke Taste wechselt
zwischen dem gruen dargestellten Stimmenstudio und dem violett dargestellten
KI-Geschichtenmodus, die mittlere Taste bestaetigt. Der KI-Modus ist bis zur
Anbindung des GerNetiX-Sprachdienstes als nicht verfuegbar markiert und sendet
keine Audiodaten. Im Stimmenstudio fuehrt ein langer Druck von etwa einer
Sekunde auf die linke Taste zurueck zur Modusauswahl. Diese Tastensteuerung ist
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
vorhanden, zeigt eine einzelne gruene LED die Bereitschaft. Solange die
mittlere Funktionstaste KEY2 (TCA9555 EXIO10) gedrueckt wird, zeichnet das Voice
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

Die linke Funktionstaste KEY1 (TCA9555 EXIO9) schaltet zyklisch immer zum
naechsten Effekt: Normal, Roboter, Monster, Helium und Echo. Die
Bereitschaftsanzeige kodiert Auswahl und Position mit Farbe und ein bis fuenf
LEDs. Roboter kombiniert Bitreduktion mit Ringmodulation, Monster spielt tiefer
und langsamer, Helium hoeher und schneller und Echo mischt das Signal mit einer
um 250 Millisekunden verzoegerten Kopie. Die Verarbeitung erfolgt blockweise
ohne zweite vollstaendige Aufnahme im PSRAM. Die letzte Aufnahme bleibt im
fluechtigen PSRAM erhalten. Jeder Wechsel zum naechsten Effekt spielt sie sofort
mit der neuen Auswahl ab. Erst der Beginn einer neuen Aufnahme ueberschreibt den
alten Puffer.

Die dritte Funktionstaste KEY3 (TCA9555 EXIO11) regelt die Wiedergabe in fuenf
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

| Taste | Kurz druecken | Gedrueckt halten |
| --- | --- | --- |
| KEY1 / links | naechster Effekt oder Modus | im Stimmenstudio zurueck zur Modusauswahl |
| KEY2 / Mitte | Auswahl bestaetigen | Aufnahme nur fuer die Dauer des Tastendrucks |
| KEY3 / rechts | naechste Lautstaerkestufe | stumm beziehungsweise wieder hoerbar |

Gruen steht fuer lokale Bereitschaft, Rot fuer Aufnahme und Blau fuer
Wiedergabe. Der violette KI-Geschichtenmodus ist nur als Vorschau auf die
spaetere, allgemeine GerNetiX-Assistenteninfrastruktur enthalten. Er nimmt
nichts auf und loest weder Netzwerkzugriffe noch Audio-Uploads aus.

## Lokaler Build

Vom Verzeichnis `basissoftware/esp32` aus:

```sh
platformio run -e waveshare-esp32-s3-audio-voice-lab
```

Flashen und serielles Monitoring bleiben bewusste lokale Nutzerschritte. Fuer
die Wiedergabe muss ein geeigneter Lautsprecher angeschlossen sein. Nach dem
erfolgreichen Loopback-Test folgen die ersten Effekte.

## Datenschutz

Das Projekt uebertraegt und persistiert keine Aufnahme. Die jeweils letzte
Aufnahme liegt nur fluechtig im PSRAM, damit Effektwechsel ohne erneutes
Einsprechen vorgehoert werden koennen. Sie wird beim Start einer neuen Aufnahme,
bei einem Fehler oder beim Ausschalten verworfen und nicht in Flash, SD-Karte
oder Netzwerk geschrieben.
