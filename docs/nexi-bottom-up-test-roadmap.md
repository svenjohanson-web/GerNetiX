# Nexi Bottom-up-Test-Roadmap

## Zweck

Diese Datei ist die fortschreibbare Arbeitsgrundlage fuer die schrittweise
Nexi-Entwicklung. Das Produktziel bleibt sichtbar, umgesetzt wird aber immer
nur der kleinste vollstaendige und pruefbare Funktionsdurchstich.

Neue Arbeiten an Nexi beginnen mit dieser Datei und mit den zugehoerigen
Artefakten im kanonischen SQLite-Graphen. Nach jedem Durchstich werden Status,
Nachweis und der genau eine naechste Durchstich hier aktualisiert.

Der wiederaufnehmbare manuelle Gesamtcheck steht im
[Nexi Board-Regressions-Testplan](nexi-board-regression-test-plan.md).

## Arbeitsregel

Jede Funktion folgt derselben Kette:

```text
fachliches Verhalten
-> hardwarefreie Vertraege und Tests
-> reproduzierbare Eingaben
-> Integration auf dem ESP32-S3
-> sicht- oder hoerbares Ergebnis
-> echter Hardware-Nachweis
```

Eine Funktion gilt nicht als umgesetzt, nur weil ein Enum, Manifest, UI-Feld
oder Architekturvertrag existiert. Sie gilt erst als fertig, wenn Code, Tests,
Dokumentation und der benoetigte Hardware-Nachweis zusammenpassen.

## Zielbild nach Zugangsgrenze

### Ohne Konto

Nexi bleibt ein vollstaendiges lokales Spiel-, Lern- und Audiogeraet:

- Stimmenstudio mit Aufnahme, Wiedergabe, Effekten und Lautstaerke,
- lokale Aktivierungsphrase und begrenzte lokale Sprachbefehle,
- lokale Geraeusch-, Reaktions-, Rhythmus- und Merkspiele,
- lokale Geschichten, Reime, Quizze und Lerninhalte,
- lokales Sprach-Tamagotchi mit kleinem versioniertem Geraetezustand,
- Timer, Ruhemodus und RTC-gestuetzte lokale Zeitfunktionen,
- lokale Einstellungen, Diagnose, Recovery und klare Datenschutzanzeige.

Keine dieser Grundfunktionen darf ein Konto, KI-Credits, Premium oder einen
externen Provider voraussetzen.

### Mit kostenlosem Konto

Das Konto ergaenzt Besitz und Komfort:

- Nexi-Instanz und kompatible Geraetezuordnung,
- Geraete-, Verbindungs- und Firmwarestatus,
- Familien- und Kinderprofil,
- Stimme, Lautstaerkegrenzen, Modi, Zeiten und Ruhezeiten,
- Sicherung und Synchronisation freigegebener Einstellungen,
- kostenlose Inhaltsaktualisierungen und klar begrenzte Online-Basisdienste.

### Mit KI-Credits

Credits bezahlen ausschliesslich verbrauchsabhaengige externe KI:

- freies Fragen und Antworten,
- dynamische Geschichten, Sprachspiele und Lernerklaerungen,
- explizit erlaubte Werkzeuge wie aktuelle Wetter- oder Webauskunft,
- STT-, Modell- und TTS-Nutzung mit Preflight, Audit und Kostenkontrolle.

### Mit Premium

Premium erweitert Funktionszugriff und Komfort, nicht die lokale
Grundnutzbarkeit:

- hoeherwertige freigegebene Modelle,
- enthaltenes hoeheres KI-Kontingent,
- zusaetzliche kuratierte Lern-, Geschichten- und Erweiterungspakete,
- weitergehende Integrationen und kontrollierter Kontext,
- erweiterter Cloud-, OTA- und Aufbewahrungskomfort.

Konkrete Nexi-Premiumfunktionen werden erst versprochen, wenn Entitlement,
Datenschutz, Provider, Retention und Verbrauch verbindlich entschieden und
getestet sind.

## Statusbegriffe

| Status | Bedeutung |
| --- | --- |
| `umgesetzt` | Code und automatisierte Tests sind vorhanden. |
| `hardware-validiert` | Zusaetzlich auf dem echten Zielboard nachgewiesen. |
| `in-umsetzung` | Ein abgegrenzter, dokumentierter Teilnachweis ist vorhanden. |
| `naechster-durchstich` | Genau dieser Arbeitsblock wird als Naechstes umgesetzt. |
| `geplant` | Ziel und Reihenfolge sind festgehalten, Umsetzung noch nicht begonnen. |
| `blockiert` | Ein konkreter externer Nachweis oder eine Entscheidung fehlt. |

## Nachgewiesener Ausgangsstand

| Baustein | Status | Nachweis |
| --- | --- | --- |
| Projekt-Hook und modulare Nexi-Runtime | umgesetzt | Contract-Tests und bestehender Firmware-Buildpfad |
| Waveshare-Hardwareadapter und Audio Engine | umgesetzt | Codec-/Board-Vertraege und Firmwarecode |
| Application Manager und typisierte Intents | umgesetzt | hostseitige Lifecycle- und Routingtests |
| Service-Tasten als InputProvider | umgesetzt | Tasten erzeugen dieselben typisierten Intents wie spaetere Eingaben |
| Lokales Stimmenstudio | umgesetzt | Aufnahme, Wiedergabe, fuenf Effekte, Lautstaerke und Mute |
| Privacy Gate und lokale Capability Policy | umgesetzt | ohne Provider existiert kein freigegebener Uploadpfad |
| Aktivierungsphrase und lokale Sprachbefehle | in-umsetzung | Persoenliches `Hey Nexi` auf dem Board bestaetigt; der aktive Pfad lernt nun wenige vollstaendige Saetze und verarbeitet Aktivierungsphrase plus Befehl ohne kuenstliche Pause. Hosttests und Firmware-Build sind erfolgreich, der Satz-Boardnachweis fehlt. |
| Lokales Reaktionsspiel | in-umsetzung | Zweite echte Anwendung mit Zustandsautomat, drei Tasten-Zielen, LED-/Tonausgabe, Fehlstart, Treffer und Abbruch; Hosttests und Firmware-Build erfolgreich, Boardtest offen. |
| Lokale Inhaltspakete | in-umsetzung | Drei Klangquizpakete sowie zwei Storypakete mit drei gesprochenen Kurzgeschichten besitzen feste Versions-, Anzahl- und Dauergrenzen. Hosttests und Firmware-Build sind erfolgreich; der Boardtest ist offen. |
| Lokaler Begleiter | in-umsetzung | Energie, Freude, Vertrauen und Interaktionen laufen in einem hardwarefreien App-Kern. Ein 16-Byte-Zustand mit Version, Pruefsumme, v1-v2-Migration, Schreibzusammenfassung und modularem Reset ist hostgetestet; Firmware-Build erfolgreich, Boardtest offen. |
| Lokaler Timer | in-umsetzung | Der Countdown verwendet monotone Laufzeit sowie einen PCF85063-Port fuer eine lokale, ueber Reset erhaltene Deadline. Ein 28-Byte-v1-NVS-Zustand erlaubt Wiederanlauf; langes KEY3 aktiviert nach erfolgreichem Speichern Deep Sleep mit ESP32-Timer-Wake. Hosttests und Firmware-Build sind erfolgreich; der Boardtest ist offen. |
| Weitere lokale Nexi-Anwendungen | geplant | Hellseher und Lernbegleiter besitzen bisher nur Typen und Architekturvertraege. |

Ein bereits vorhandener Typ, etwa `Oracle` oder `LearningCompanion`, ist noch keine implementierte
Produktfunktion.

## Reihenfolge der Funktionsdurchstiche

| ID | Funktionsdurchstich | Status | Fertig, wenn |
| --- | --- | --- | --- |
| NEXI-01 | Aktivierungsphrase lokal erkennen | in-umsetzung | WAV- und Boardeingaben erzeugen denselben typisierten Wake-Intent ohne PCM-Persistenz oder Upload. |
| NEXI-02 | `Stimmenstudio` lokal per Sprache starten | in-umsetzung | Aktivierungsphrase plus lokaler Befehl aktiviert dieselbe Anwendung wie der Service-Input. |
| NEXI-03 | Globale lokale Befehle | in-umsetzung | `Stopp`, `Lauter`, `Leiser` und `Naechster Effekt` besitzen reproduzierbare Intent- und Boardtests. |
| NEXI-04 | Erstes lokales Reaktions-/Rhythmusspiel | in-umsetzung | Eine zweite echte Anwendung besitzt Lifecycle, Audio-/LED-Ausgabe und Abbruchtest. |
| NEXI-05 | Lokale Geschichten und Quizpakete | in-umsetzung | Gebuendelte Inhalte laufen ohne Provider und besitzen Versions- und Ressourcengrenzen. |
| NEXI-06 | Lokales Sprach-Tamagotchi | in-umsetzung | Zustand, Neustart, Reset und NVS-Migration sind begrenzt und getestet. |
| NEXI-07 | Timer, RTC und Ruhemodus | in-umsetzung | Countdown, PCF85063-Zeitbasis, gepruefte Wiederanlaufpersistenz und Deep-Sleep-Timer-Wake sind gebaut; Batterie-, Neustart-, Stromverlust- und Wake-Nachweis auf dem Board fehlen. |
| NEXI-08 | Kostenlose Kontoeinrichtung | geplant | Geraetebindung und freigegebene Einstellungen funktionieren, lokale Apps bleiben offline nutzbar. |
| NEXI-09 | Optionale Voice-KI mit Credits | geplant | Ein explizit freigegebener kurzlebiger Auftrag besteht Auth-, Privacy-, Credit- und Providerausfalltests. |
| NEXI-10 | Premium-Erweiterungen | geplant | Jede Premiumfunktion besitzt eigenes Entitlement, Nutzen, Fallback und Kostenlimit. |

Die Reihenfolge wird nur geaendert, wenn ein dokumentierter Nachweis zeigt,
dass ein spaeterer Baustein eine notwendige Voraussetzung ist. Es werden nicht
mehrere noch unbewiesene Produktfunktionen gleichzeitig begonnen.

## NEXI-01 Aktivierungsphrase

Die Aktivierungsphrase wird lokal erkannt und erzeugt nur einen typisierten
Wake-Intent. Sie startet weder eine Cloudverbindung noch einen KI-Aufruf.

Die Kandidaten `Nexi` und `Hallo Nexi` werden gemessen. Die Produktphrase wird
nicht nach Gefuehl festgelegt. Eine laengere Phrase kann weniger
Fehlaktivierungen erzeugen; die Entscheidung folgt aus demselben Testkorpus.

### NEXI-01A: Testbare Audioquelle

Zuerst entsteht ein kleiner PCM-Vertrag mit austauschbaren Quellen:

```text
AudioFrameSource
`- RecordedWavFrameSource fuer automatisierte Hosttests
```

Abnahme:

- dokumentiertes PCM-Format, zunaechst mono PCM16 mit 16 kHz,
- deterministische WAV-Eingaben,
- begrenzter fluechtiger Ringpuffer,
- genau ein Besitzer von I2S und Audiocodecs,
- keine PCM-Daten in Logs, Flash, SD oder Netzwerk.

### NEXI-01B: Wake-Vertrag und ScriptedWakeWordDetector

Ein hardwarefreier `WakeWordDetector` verarbeitet Audioframes. Ein
deterministischer `ScriptedWakeWordDetector` erzeugt den vollstaendigen Ablauf.
Er ist ausdrücklich ein Testdouble mit einem vorgegebenen Framebereich und
behauptet nicht, Sprache zu erkennen:

```text
Audioframe
-> WakeWordDetector
-> WakeDetected
-> lokales Befehlsfenster
-> sichtbare LED-Rueckmeldung
-> Timeout oder Abbruch
-> Bereitschaft
```

Damit werden Runtime, Timeout, Abbruch und Feedback getestet, bevor ein reales
Modell integriert wird.

Hostseitiger Nachweis vom 2026-08-06:

- mono PCM16 mit 16 kHz und festen 10-ms-Frames ist als Vertrag umgesetzt,
- die WAV-Testquelle streamt mit festem Puffer statt die Aufnahme vollstaendig
  in den Speicher zu laden,
- `WakeWordInputProvider` erzeugt einen typisierten `WakeDetected`-Intent und
  entprellt eine ueber mehrere Frames anliegende Erkennung,
- `WakeWordPipeline` oeffnet genau ein lokales Befehlsfenster und schliesst es
  deterministisch durch Timeout oder `Cancel`,
- LED- oder Tonadapter koennen dieselben getesteten Feedback-Callbacks nutzen,
- Kernvertraege enthalten weder Dateizugriff noch Persistenz, Netzwerk oder
  dynamische Allokation.

Damit sind NEXI-01A fuer den Host und NEXI-01B umgesetzt. Der persoenliche
`Hey Nexi`-Boardadapter und die LED-Zuordnung sind implementiert, gebaut und in
einem ersten Nutzertest bestaetigt; die laengere Treffer-/Fehlaktivierungsmessung
bleibt offen.

### NEXI-01C: Reproduzierbares Evaluationskorpus

Das Korpus enthaelt positive und negative Beispiele:

- mehrere freiwillige Sprecher,
- unterschiedliche Lautstaerken und Abstaende,
- ruhiger Raum und typische Haushaltsgeraeusche,
- `Nexi`, `Hallo Nexi` und aehnlich klingende Woerter,
- laengere negative Gespraechsabschnitte ohne Aktivierungsphrase.

Das Korpus ist zunaechst ein Testbestand und kein automatisch freigegebener
Trainingsdatensatz. Personenbezug, Einwilligung, Ablage und Loeschung werden
vor der Aufnahme festgelegt.

Als erster manuell bedienbarer Zwischenstand steht auf der lokalen
Nexi-Nachbauseite ein sprecherabhaengiges Wake-Word-Lab bereit. Es nimmt nach
einem bewussten Klick drei jeweils rund zwei Sekunden lange Referenzen auf und
vergleicht weitere Aufnahmen ueber lokale Audio-Merkmale mit zeitlicher
Ausrichtung. Audio und Referenzen bleiben ausschliesslich im Arbeitsspeicher
des Tabs; es gibt weder Upload, Browserpersistenz noch Speech-to-Text. Dieser
Prototyp dient zum unmittelbaren Positiv-/Negativtest und zur Gewinnung erster
Messwerte. Er ist kein allgemeines Produktmodell und kein Ersatz fuer den
spaeteren Boardnachweis.

Erste Messziele, die nach der Baseline bewusst angepasst werden duerfen:

- mindestens 90 Prozent Treffer im ruhigen Raum,
- mindestens 75 Prozent bei realistischer Hintergrundlautstaerke,
- hoechstens eine Fehlaktivierung pro Stunde negativer Testdaten,
- Reaktion innerhalb von 500 Millisekunden nach Ende der Phrase,
- kein wachsender Heap und kein dauerhaft gespeichertes Audio.

### NEXI-01D: ESP32-S3-Integration

Erst nach dem Hostnachweis wird ein reales lokales Modell angebunden. Der
`WaveshareAudioFrameSource` adaptiert dabei den bereits exklusiv besessenen
ES7210/I2S-Pfad; er initialisiert Codec oder I2S nicht ein zweites Mal. Der
Boardnachweis erfasst mindestens CPU, internen RAM, PSRAM, Latenz,
Fehlaktivierung durch den eigenen Lautsprecher, mehrstuendigen Betrieb und
Fehlererholung.

Die erste Produktstufe verwendet bewusst kein allgemeines WakeNet-Modell,
sondern ein persoenliches `Hey Nexi`-Profil. Drei vom Nutzer per KEY2
eingesprochene Referenzen werden in kompakte lokale Merkmalsfolgen umgewandelt
und mit zeitlich ausgerichteten Sprachkandidaten verglichen. Das ist
sprecherabhaengig und damit noch kein allgemeines Serienmodell, liefert aber
bereits die echte Produktphrase statt eines technischen Fremdworts.

Codex darf nach ausdruecklicher Freigabe auf macOS einen lokalen
`platformio run` ausfuehren. USB-/OTA-Flash und seriellen Hardwaretest fuehrt
weiterhin der Nutzer aus.

Implementierungsstand vom 2026-08-06:

- `WaveshareAudioFrameSource` liest den exklusiv besessenen ES7210-Pfad in
  festen 10-ms-Frames und wandelt den stabilen ersten 32-Bit-Mikrofonkanal
  fluechtig nach mono PCM16/16 kHz,
- `PersonalWakeWordDetector` nimmt drei per KEY2 begrenzte `Hey Nexi`-
  Referenzen an, extrahiert RMS-, Nulldurchgangs- und Frequenzmerkmale und
  vergleicht automatisch segmentierte Kandidaten per Dynamic Time Warping,
- PCM und Vergleichspuffer liegen nur fluechtig im PSRAM; die quantisierten
  Referenzmerkmale werden nach bewusster Kalibrierung versioniert im lokalen
  NVS gespeichert und niemals uebertragen,
- eine cyanfarbene LED zeigt Bereitschaft, alle sieben LEDs bestaetigen ein
  drei Sekunden langes lokales Befehlsfenster; violette, rote und gruene LEDs
  fuehren durch die Kalibrierung, KEY1 beendet den Testmodus,
- hostseitiger Positiv-/Negativtest sowie Firmware-Build sind erfolgreich; der
  echte Treffer-/Fehlaktivierungsnachweis auf dem Board bleibt offen.

### NEXI-01E: Erster lokaler Sprachdurchstich

Nach bestandener Aktivierungsphrase folgt genau ein lokaler Befehl:

```text
Aktivierungsphrase
-> `Stimmenstudio`
-> SelectApplication(VoiceStudio)
-> lokale Bereitschaftsanzeige
```

Dieser Teil ist der Uebergang zu NEXI-02.

## Aktueller naechster Durchstich: fluessige lokale Beispielsaetze

`LocalVoiceEntry` verarbeitet acht vollstaendige persoenliche Beispielsaetze
ueber denselben fluechtigen Audioframe:

```text
Hey Nexi, starte das Stimmenstudio -> SelectApplication(VoiceStudio)
Hey Nexi, stopp                    -> StopApplication
Hey Nexi, lauter                   -> AdjustVolume(+1)
Hey Nexi, leiser                   -> AdjustVolume(-1)
Hey Nexi, naechster Effekt         -> NextEffect
Hey Nexi, starte das Reaktionsspiel -> SelectApplication(ReactionGame)
Hey Nexi, starte das Klangquiz      -> SelectApplication(LocalQuiz)
Hey Nexi, starte die Geschichten    -> SelectApplication(LocalStories)
```

Aktivierungsphrase und Befehl werden in einem natuerlichen Zug gesprochen.
Es gibt weder eine erzwungene Pause noch ein separat einzulernendes Befehlswort.
Je Satz werden zwei Referenzen versioniert in der eigenen 256-KiB-NVS-Partition
`nexivoice2` gespeichert. Profile der frueheren 60-KiB-Partition `nexivoice`
werden sicher uebernommen; das normale NVS der Basissoftware bleibt unveraendert.
Sobald alle neuen Satzprofile dauerhaft vorliegen, loescht die Migration die alten
getrennten `Hey Nexi`-, `Stimmenstudio`- und `Stopp`-Profile. Bei einem
Speicherfehler bleiben die alten Daten erhalten.

Hosttest und Firmware-Build sind erfolgreich. Offen ist der Boardtest:
`Hey Nexi, starte das Stimmenstudio` startet die Anwendung; im untaetigen Zustand muss
`Hey Nexi, stopp` sie beenden, die fluechtige Aufnahme loeschen und zur
Modusauswahl zurueckkehren. Im laufenden Stimmenstudio muessen `lauter`,
`leiser` und `naechster Effekt` dieselben typisierten Intents wie die
Service-Tasten ausloesen. Aufnahme und Wiedergabe sind in dieser ersten
Stufe blockierend; waehrenddessen wird `Stopp` noch nicht ausgewertet.

## NEXI-04: lokales Reaktionsspiel

Die zweite echte Offline-Anwendung ist als hardwareunabhaengiger,
tick-gesteuerter Zustandsautomat umgesetzt:

```text
Start -> zufaellige Wartezeit -> LED-/Tonziel fuer KEY1, KEY2 oder KEY3
      -> Treffer, falsche Taste oder Zeitablauf -> Ergebnis -> neue Runde
```

Eine Eingabe waehrend der verdeckten Wartezeit gilt als Fehlstart. Treffer und
Fehler werden nur fuer die laufende Sitzung gezaehlt und nicht persistiert.
Der Waveshare-Adapter kapselt LED- und I2S-Tonausgabe; der Spielkern importiert
weder Treiber, Netzwerk noch Persistenz. Das Spiel kann ueber die lokale
Moduswahl oder mit `Hey Nexi, starte das Reaktionsspiel` gestartet und ueber
langen Druck auf KEY1 beziehungsweise `Hey Nexi, stopp` beendet werden.

Hosttests pruefen deterministische Runden, Fehlstart, Treffer, Capability-
Ablehnung und sauberen Lifecycle-Abbruch. Der Firmware-Build ist erfolgreich.
Offen sind LED-Farben, Tonlautstaerke, reale Tastenreaktion und Stopp auf dem
Board.

## NEXI-05: versionierte lokale Quiz- und Storypakete

Der erste gebuendelte Inhaltskatalog besteht aus drei Klang- und Merkquizpaketen:

```text
nexi.sound-memory.beginner.de, Version 1, 6 Aufgaben
nexi.sound-memory.fast.de, Version 1, 9 Aufgaben
nexi.sound-memory.deep.de, Version 1, 9 Aufgaben
maximal 4 Pakete, 12 Aufgaben je Paket und 48 insgesamt
1 Ton -> KEY1, 2 Toene -> KEY2, 3 Toene -> KEY3
```

`LocalQuizPackValidator` lehnt fehlende IDs, Version 0, doppelte Aufgaben,
ungueltige Tonparameter und mehr als zwoelf Aufgaben ab. Der zusaetzliche
`LocalQuizCatalogValidator` prueft eindeutige Paket-IDs sowie die Grenzen von
vier Paketen und 48 Gesamtaufgaben. Der App-Kern ist
tick-gesteuert, hat ein begrenztes Antwortfenster und speichert weder Paket,
Antworten noch Punktestand. Nur ServiceButton- und Testintents zaehlen als
Antwort; gesprochene globale Befehle werden nicht versehentlich gewertet.

In der Paketauswahl wechseln KEY1 und KEY3 vor beziehungsweise zurueck; KEY2
startet das angezeigte Paket. Ein gemeinsamer lokaler Tongenerator wird von
Reaktionsspiel und Quiz genutzt.
Der Boardadapter spielt die Aufgaben und Ergebnisfolgen ueber den bestehenden
I2S-Codec und zeigt Zustand beziehungsweise Ergebnis auf den LEDs. Start ist
ueber die lokale Moduswahl und `Hey Nexi, starte das Klangquiz` moeglich; der
globale Stopp-Pfad beendet das Quiz.

Die Sprachprofilpartition wurde parallel von 60 KiB auf 256 KiB erweitert,
ohne OTA-App-Adressen zu verschieben. Bereits in `nexivoice` gespeicherte
Profile werden einzeln nach `nexivoice2` kopiert und erst nach erfolgreichem
Schreiben geloescht. Damit ist die feste Routerkapazitaet von acht maximal
langen Satzprofilen einschliesslich NVS-Overhead abgedeckt.

Der zweite NEXI-05-Durchstich ergaenzt zwei lokale Storypakete:

```text
nexi.stories.wonder.de, Version 1, 2 Geschichten
nexi.stories.calm.de, Version 1, 1 Geschichte
maximal 4 Pakete, 4 Geschichten je Paket, 12 insgesamt, 120 Sekunden insgesamt
```

Die drei deutschen Kurztexte sind eigene Projektinhalte. Ein reproduzierbares
macOS-Werkzeug erzeugt mit der Stimme Anna kompakte signierte
8-kHz/8-Bit-Mono-Daten; die generierten Arrays liegen ausschliesslich im
Firmware-Flash. Der hardwareunabhaengige Katalog validiert IDs, Versionen,
Eindeutigkeit, Samplegrenzen und Dauer, ohne Treiber, Netzwerk oder Persistenz
zu importieren. KEY1 und KEY3 waehlen vor beziehungsweise zurueck, KEY2 spielt
die Geschichte ueber einen Boardadapter als 16-kHz-Stereoausgabe. Start ist
auch mit `Hey Nexi, starte die Geschichten` moeglich. Wiedergabe und Auswahl
erzeugen keine nutzerbezogenen dauerhaften Daten.

Hosttests und Firmware-Build sind erfolgreich. Der frische Build belegt
49.196 Byte RAM und 1.481.105 Byte des 6.291.456 Byte grossen App-Slots.
Offen bleiben Tonfolge,
Lautstaerke, alle drei Antworten, Timeout, Abschlussmelodie, Profilmigration
und Stopp des Quiz sowie Auswahl, Sprachqualitaet und Wiedergabe aller drei
Geschichten auf dem Board. Die Storywiedergabe ist noch blockierend; waehrend
maximal 45 Sekunden werden Eingaben erst nach Ende der Ausgabe ausgewertet.

## NEXI-06: erster lokaler Begleiterzustand

Der lokale Begleiter verwendet vier begrenzte Werte von 0 bis 100 sowie einen
gesaettigten Interaktionszaehler:

```text
KEY1 kurz -> spielen  -> Freude und Vertrauen steigen, Energie sinkt
KEY2       -> fuettern -> Energie, Freude und Vertrauen steigen
KEY3 kurz -> ruhen    -> Energie und Vertrauen steigen, Freude sinkt leicht
KEY3 lang -> nur den Begleiterzustand zuruecksetzen
KEY1 lang -> Anwendung beenden
```

Der reine App-Kern kennt weder NVS, Treiber noch Netzwerk. `CompanionStateCodec`
serialisiert genau 16 Byte mit stabiler Kennung, Schemaversion 2 und Pruefsumme.
Das alte 13-Byte-v1-Format wird eingelesen und danach einmalig als v2
geschrieben; falsche Kennung, Pruefsumme, Version oder Werte fuehren zu sicheren
Startwerten. Der ESP32-Adapter besitzt ausschliesslich Namespace
`nexi_friend` und Schluessel `state`; Reset verwendet `nvs_erase_key`, niemals
Partitions- oder Namespace-Loeschung. Aktionen werden eine Sekunde lang
zusammengefasst, um unnoetige Flashschreibvorgaenge zu vermeiden.

Der Modus ist vollstaendig konto-, provider- und creditfrei. Ein eigener
Sprachstart wird noch nicht angeboten, weil der absichtlich auf acht Profile
begrenzte Satzrouter belegt ist. Hosttests und Firmware-Build sind erfolgreich;
der Build belegt 49.196 Byte RAM und 1.484.429 Byte Flash. Offen sind
LED-/Tonwirkung, Neustartpersistenz, v1-Migration und Reset auf dem Board.

## NEXI-07: lokaler Timer, RTC und Ruhemodus

Der erste NEXI-07-Durchstich trennt die Timerlogik von ihrer Zeitquelle. Der
hardwarefreie App-Kern verwendet fuer den aktiven Countdown `MonotonicClock`;
auf dem ESP32 liefert ihn `esp_timer_get_time()`.

```text
Auswahl: KEY1 vorheriges Preset, KEY3 naechstes Preset, KEY2 Start
Laufend: KEY2 Pause, KEY3 plus eine Minute, KEY1 Abbruch
Pausiert: KEY2 Fortsetzen, KEY3 plus eine Minute, KEY1 Abbruch
Alarm: beliebige Taste bestaetigt
```

Die Presets betragen eine, drei und fuenf Minuten. Ein Timer ist auf 24 Stunden
begrenzt und verwendet weder Konto-, Netzwerk- noch Cloudzeit. LEDs zeigen
Auswahl und Restanteil; nach Ablauf wird ein lokaler Doppelton alle drei
Sekunden wiederholt.

### NEXI-07A: PCF85063-Zeitbasis

`RetainedClock` ist der hardwarefreie Port fuer eine ueber ESP-Neustarts
fortlaufende Sekundenzahl. `Pcf85063RetainedClock` liest die sieben
Kalenderregister ab `0x04` ueber den bereits exklusiv von `HardwarePlatform`
besessenen I2C-Bus. Ein eigener Codec validiert BCD, Kalendergrenzen,
Schaltjahre und das Oscillator-Stop-Bit. Ist die Uhr ungueltig, wird eine
neutrale lokale Epoche ab 2000 initialisiert; dies behauptet keine Ortszeit.

### NEXI-07B: Wiederanlauf und Deep Sleep

`TimerStateStore` persistiert genau 28 Byte mit Kennung, Schemaversion und
Pruefsumme unter `nexi_timer/state`. Enthalten sind nur Phase, Preset,
RTC-Deadline beziehungsweise pausierte Restzeit und Gesamtdauer. Nach Neustart
wird ein gueltiger Timer vor der normalen Spracheinrichtung automatisch
fortgesetzt oder bei abgelaufener Deadline direkt alarmiert. Abbruch,
Alarmbestaetigung und explizites Stoppen loeschen nur diesen Schluessel.

Langes KEY3 fordert nur bei einem laufenden, erfolgreich gespeicherten Timer
Deep Sleep an. Der interne ESP32-RTC-Timer weckt das Board zur Deadline; der
PCF85063 dient danach als unabhaengige Wahrheitsquelle. Fuer echte
Stromunterbrechung ist eine RTC-Pufferbatterie erforderlich. Ohne gueltigen
Oszillatorstand wird ein alter Timer sicher verworfen. Offen bleiben die
Boardnachweise fuer Batterie, Neustart, Stromunterbrechung, Sleep, Wake und
Alarm; bis dahin bleibt NEXI-07 `in-umsetzung`.

## Wiederholbarer Ablauf je Funktion

1. Fachliches Verhalten und Offline-/Konto-/Credit-/Premiumgrenze klaeren.
2. Requirement und Test Artifact im SQLite-Graphen pruefen oder ergaenzen.
3. Reine Vertraege und hostseitige Unit-/Contract-Tests implementieren.
4. Reproduzierbare Fixtures oder Fake-Adapter hinzufuegen.
5. Zielhardwareadapter integrieren, ohne Basissoftwaregrenzen zu verletzen.
6. Gezielte Tests und bei Firmwarecode den freigegebenen Build ausfuehren.
7. Der Nutzer fuehrt Flash und echten Hardwaretest aus.
8. Ergebnis, Messwerte und offene Abweichungen hier dokumentieren.
9. Genau einen naechsten Durchstich auf `naechster-durchstich` setzen.

## Fortschrittsprotokoll

| Datum | Durchstich | Ergebnis | Naechster Schritt |
| --- | --- | --- | --- |
| 2026-08-06 | Roadmap angelegt | Zielbild, Reihenfolge und NEXI-01 als erster Durchstich festgelegt | NEXI-01A AudioFrameSource und WAV-Testvertrag entwerfen |
| 2026-08-06 | NEXI-01A/B Hostdurchstich | WAV -> feste PCM-Frames -> ScriptedWakeWordDetector -> WakeDetected -> Wake-Session; Timeout, Abbruch, Entprellung, Formatfehler und lokale Ressourcengrenze automatisiert getestet | NEXI-01C: kleinstes freiwilliges Positiv-/Negativkorpus und messbare Kandidatenentscheidung vorbereiten |
| 2026-08-06 | NEXI-01C manueller Browser-Baseline-Test | Drei fluechtige Referenzaufnahmen und wiederholbare Positiv-/Negativtests auf `/nachbauprojekte/nexi-sprachassistent/#aktivierungswort-test`; kein Upload, keine Persistenz, keine Transkription | Mit mehreren Sprechweisen Treffer und Fehlaktivierungen protokollieren; danach Schwelle und Produktphrase festlegen |
| 2026-08-06 | NEXI-01D technischer Firmwarepfad | ES7210 -> PCM16 -> lokales WakeNet9s `Hi ESP` -> `WakeDetected` -> drei Sekunden LED-Fenster gebaut; Modellpartition und vollstaendiger Uploadpfad enthalten | Nutzer flasht das komplette Image und protokolliert Erkennung, Fehlaktivierung, Abstand und seriellen Startnachweis |
| 2026-08-06 | NEXI-01D persoenliches Produktwort | Drei fluechtige KEY2-Referenzen -> lokale Merkmale -> segmentiertes DTW-Matching fuer `Hey Nexi` -> `WakeDetected`; technisches `Hi ESP` aus normalem Build entfernt | Nutzer flasht die Firmware, lernt seine Stimme ein und protokolliert Treffer, Ablehnungen und Fehlaktivierungen |
| 2026-08-06 | NEXI-01D erste Boardkalibrierung | Der aus dem schlechtesten Referenzpaar abgeleitete Schwellwert `0,2195` akzeptierte fremde Aeusserungen mit Distanzen um `0,114` bis `0,121`. Die Firmware verwendet nun den mittleren Referenzabstand, begrenzt den Schwellwert auf maximal `0,135` und prueft die Kandidatenlaenge gegen den Median der drei Referenzen. | Neu flashen und Positiv-/Negativreihe mit den erweiterten Distanz-, Laengen- und Entscheidungslogs wiederholen |
| 2026-08-06 | NEXI-01D Sprechgeschwindigkeit | Ein schneller, von der Dauerpruefung akzeptierter Ausspruch lag mit Distanz `0,1191` ueber dem engen Schwellwert `0,0772`. Die Kalibrierung fordert nun normal, schneller, normal; jede Aufnahme ist ein eigener Prototyp. Der engste Referenzpaarabstand bestimmt einen auf `0,105` begrenzten Schwellwert, eine enge Uebereinstimmung mit einem Prototyp reicht. | Neu flashen; normale, schnelle und fremde Aeusserungen protokollieren und Fehlaktivierungsgrenze erneut bestaetigen |
| 2026-08-06 | NEXI-01 Board-Smoke-Test | Nutzer bestaetigt die korrigierte normale und schnelle `Hey Nexi`-Erkennung als passend | NEXI-02 `Stimmenstudio` als ersten lokalen Sprachbefehl durchstechen |
| 2026-08-06 | NEXI-02 Host und Firmware | Zwei fluechtige persoenliche `Stimmenstudio`-Referenzen; gemeinsamer Audioframe; Befehl nur im Wake-Fenster; typisierter Voice-Intent startet den Application Manager; 14 gezielte Tests und Firmware-Build erfolgreich | Nutzer flasht und prueft positiven Ablauf sowie denselben Befehl ausserhalb des Wake-Fensters |
| 2026-08-06 | NEXI-02 Profilpersistenz | Versionierte und quantisierte `Hey Nexi`-/`Stimmenstudio`-Merkmalsprofile im lokalen NVS; keine PCM-Persistenz; Phrasenbindung, Pruefsumme, sichere Neueinrichtung bei Fehlern und KEY3-Reset; Profiltests und Firmware-Build erfolgreich | Nutzer lernt einmal ein, startet neu und bestaetigt Laden ohne Aufnahme sowie KEY3-Neueinrichtung |
| 2026-08-06 | NEXI-02 Persistenz-Boardtest | Nutzer bestaetigt, dass die gespeicherten persoenlichen Profile nach dem Neustart ohne erneute Aufnahme funktionieren | NEXI-03A `Stopp` als ersten globalen lokalen Sprachbefehl durchstechen |
| 2026-08-06 | NEXI-03A Host und Firmware | `Hey Nexi` -> `Stopp` erzeugt nur im Wake-Fenster `StopApplication`; der Application Manager beendet die aktive Anwendung als Nutzerwunsch; zwei persistente persoenliche Referenzen, Hosttests und Firmware-Build erfolgreich | Nutzer lernt nur `Stopp` ein und prueft Start sowie Stopp des untaetigen Stimmenstudios auf dem Board |
| 2026-08-06 | Fluessige Satzsteuerung | Getrennte Wake-/Befehlsprofile im aktiven Pfad durch zwei vollstaendige Beispielsaetze ersetzt; direkte Intent-Zuordnung ohne Sprechpause, versionierte NVS-Profile und sichere Loeschung der Altprofile erst nach erfolgreicher Migration; Hosttests und Firmware-Build erfolgreich | Nutzer lernt beide Saetze je zweimal ein und prueft Start/Stopp ohne Pause auf dem Board |
| 2026-08-06 | NEXI-03 lokale Laufzeitsteuerung | Satz-Router auf fuenf feste Bindungen erweitert; `lauter`, `leiser` und `naechster Effekt` werden lokal auf vorhandene Intents abgebildet. Alle fuenf Profile liegen in einer eigenen NVS-Partition; Hosttests und Firmware-Build erfolgreich. | Nutzer lernt die fuenf Saetze je zweimal ein und prueft Start, Laufzeitsteuerung und Stopp auf dem Board. |
| 2026-08-06 | NEXI-04 Host und Firmware | Zweite lokale App mit zufaelliger Wartephase, drei Tasten-Zielen, Fehlstart-/Treffer-/Timeoutlogik, LED-/Tonsignalen, Service-Modus und fluessigem Sprachstart; Hosttests und Firmware-Build erfolgreich. | Nutzer prueft Spielstart, Farben, Toene, alle drei Tasten, Fehlstart, Timeout und Abbruch auf dem Board. |
| 2026-08-06 | NEXI-05 Klangquiz und Profilreserve | Versionierter Klangquizkatalog mit drei Paketen und 24 von maximal 48 Aufgaben, begrenztem App-Lifecycle, fluechtigem Punktestand und gemeinsamem Tongenerator. Sprachprofilbereich auf 256 KiB erweitert und einseitige Migration aus der alten Partition gebaut; Hosttests und Firmware-Build erfolgreich. | Nutzer prueft Profiluebernahme, siebten Sprachsatz, Paketauswahl, Quiztoene, Antworten, Timeout, Abschluss und Abbruch auf dem Board. |
| 2026-08-06 | NEXI-05 lokale Storypakete | Zwei versionierte Pakete mit drei eigens geschriebenen, lokal gesprochenen Kurzgeschichten; reproduzierbare PCM8-Assets, feste Paket-/Dauergrenzen, hardwarefreier App-Kern, KEY1/KEY3-Auswahl, KEY2-Wiedergabe und achter Sprachsatz. Hosttests und Firmware-Build erfolgreich. | Nutzer prueft Profiluebernahme des achten Satzes, Auswahl, Lautstaerke und vollstaendige Wiedergabe aller drei Geschichten auf dem Board. |
| 2026-08-06 | NEXI-06 lokaler Begleiter | Vier begrenzte Zustandswerte, drei Tastenaktionen, vier Stimmungen, 16-Byte-v2-Format mit Pruefsumme, v1-Migration, eigener NVS-Schluessel, koaleszierte Writes und isolierter Reset. Hosttests und Firmware-Build erfolgreich. | Nutzer prueft Aktionen, LEDs/Toene, Zustand nach Neustart und langen KEY3-Reset auf dem Board. |
| 2026-08-06 | NEXI-07 lokaler Timer | Hardwarefreier Countdown mit 1-/3-/5-Minuten-Presets, monotone ESP-Zeitquelle, Pause/Fortsetzen, Verlaengern bis 24 Stunden, Abbruch und wiederholtem lokalem Alarm. Hosttests und Firmware-Build erfolgreich. | PCF85063-Port und Hostdouble bauen; danach RTC-Zeit und Ruhemodus separat durchstechen. |
| 2026-08-06 | NEXI-07A PCF85063 | Getrennter RetainedClock-Port, BCD-/Kalendercodec, Oscillator-Stop-Behandlung und Adapter auf dem gemeinsam besessenen I2C-Bus. Schaltjahr- und Fehlerfaelle hostgetestet; Firmware-Build erfolgreich. | PCF85063 mit Pufferbatterie auf dem Board lesen, Neustart und Zeitfortschritt nachweisen. |
| 2026-08-06 | NEXI-07B Timer-Wiederanlauf und Deep Sleep | 28-Byte-v1-Zustand unter `nexi_timer/state`, gepruefte Deadline-Wiederaufnahme, direkter Alarm nach verpasster Deadline und Deep Sleep per langem KEY3 mit internem ESP32-Timer-Wake. Hosttests und Firmware-Build erfolgreich. | Timer starten, schlafen, automatisch aufwachen und alarmieren lassen; danach kontrollierte Stromunterbrechung mit RTC-Batterie pruefen. |
