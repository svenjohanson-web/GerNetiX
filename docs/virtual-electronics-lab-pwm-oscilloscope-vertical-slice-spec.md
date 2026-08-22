# ELAB-DS-003: PWM am gemeinsamen Oszilloskop messen

Stand: 2026-08-16  
Status: Implementiert und getestet (2026-08-16)  
Voraussetzung: ELAB-DS-001 und ELAB-DS-002 wurden vollständig umgesetzt und
abgenommen

Diese Spezifikation ist der nächste sequenzielle Arbeitsauftrag für **Spark**.
Sie darf erst umgesetzt werden, wenn der statische GPIO-LED-Durchstich und der
codegesteuerte PWM-Durchstich mit ihren vollständigen Regressionstests
erfolgreich sind.

ELAB-DS-003 ergänzt die gemeinsame Workbench um das erste Instrument, das
ausschließlich den gemeinsamen Measurement Trace beobachtet. Das Instrument
erzeugt kein eigenes Testsignal und berechnet keine zweite
Schaltungswahrheit.

## 1. Ziel

Der Nutzer führt in derselben Laborfläche eine realitätsnahe Messhandlung aus:

```text
PWM-Quellcode
-> Virtual MCU Runtime
-> GPIO 5
-> LED-Schaltung
-> gemeinsamer Measurement Trace
-> angeschlossener Oszilloskop-Kanal CH1
-> dargestellte und abgeleitete Messwerte
```

Der Nutzer muss:

1. die Tastkopfspitze von CH1 mit dem vorbereiteten Messpunkt `GPIO 5`
   verbinden,
2. die Masseklemme des Tastkopfs mit `GND` verbinden,
3. die bestehende Simulation starten,
4. Signalform, Spannung, Frequenz und Tastgrad am Instrument ablesen.

Damit wird erstmals nachgewiesen, dass ein Instrument denselben Aufbau
beobachtet, den Quellcode, Mikrocontroller und Solver verwenden.

## 2. Sichtbares Nutzerergebnis

Im PWM-Beispiel erscheint ein Instrumenten-Dock mit einem kompakten
Oszilloskop. Vor dem Anschluss zeigt das Display:

```text
CH1 nicht verbunden
Tastkopfspitze an GPIO 5 und Masseklemme an GND anschließen.
```

Nach korrektem Anschluss und Simulationsstart zeigt das Display für den
unveränderten DS-002-Startcode:

- Rechtecksignal zwischen `0,00 V` und `3,30 V`,
- steigende und fallende Flanken aus dem Measurement Trace,
- Frequenz `1,00 kHz`,
- Periodendauer `1,00 ms`,
- Tastgrad `25,0 %`,
- Minimum `0,00 V`,
- Maximum `3,30 V`,
- Spitze-Spitze-Spannung `3,30 V`.

Die vorhandene kompakte Zeitverlaufsanzeige aus ELAB-DS-002 wird im
PWM-Beispiel durch die Anzeige dieses Instruments aufgenommen. Es dürfen nicht
zwei voneinander unabhängige Signalansichten mit möglicherweise
unterschiedlichen Werten bestehen.

## 3. Abgrenzung zum bestehenden Oszilloskop-Lernlabor

Das bestehende getrennte Oszilloskop-Lernlabor bleibt unverändert verfügbar
und wird in diesem Paket nicht migriert.

ELAB-DS-003 implementiert kein weiteres auswählbares Oszilloskop-Lab. Es
erstellt einen kleinen Instrumentenadapter innerhalb der gemeinsamen
Elektroniklabor-Workbench.

Insbesondere wird die bestehende Datei
`modules/virtual-electronics-lab/labs/oscilloscope.js` nicht verändert. Eine
spätere Migration oder gemeinsame Nutzung umfangreicher Bedienelemente erhält
ein eigenes Arbeitspaket.

## 4. Instrumentenmodell

Der `LabProject`-Vorläufer wird additiv um eine Instrumenteninstanz erweitert:

```text
instruments
`- instances
   `- scope-1
      |- kind: oscilloscope
      |- modelVersion
      `- channels
         `- ch1
            |- coupling: dc
            |- probeFactor: 1
            |- voltsPerDivision: 1 V
            |- secondsPerDivision: 500 µs
            |- triggerSlope: rising
            |- triggerLevel: 1,65 V
            |- tipConnection
            `- referenceConnection
```

Diese Einstellungen sind im ersten Messdurchstich sichtbar, aber fest. Der
Nutzer kann sie noch nicht verändern.

Das Raster besitzt:

- acht horizontale Divisionen,
- acht vertikale Divisionen,
- insgesamt 4 ms sichtbare Zeit,
- einen vertikalen Messbereich, in dem 0 V und 3,3 V vollständig sichtbar
  sind.

Die Nulllinie und der Triggerpegel sind gekennzeichnet.

## 5. Messpunkte und Tastkopfanschluss

Der vorbereitete Aufbau stellt genau folgende Messpunkte bereit:

```text
gpio-5  -> analoger/digitaler Knoten am MCU-Ausgang
gnd     -> Bezugsknoten der Schaltung
```

CH1 besitzt zwei Verbindungen:

- `tipConnection`
- `referenceConnection`

Ein Kanal ist nur messbereit, wenn beide Verbindungen gültig sind. Für den
Sollfall gilt:

```text
scope-1.ch1.tipConnection       = gpio-5
scope-1.ch1.referenceConnection = gnd
```

Der Nutzer schließt den Tastkopf über sichtbare Anschlusspunkte der
Schaltungsfläche an. Für diesen kleinen Durchstich genügt ein klarer
zweistufiger Bedienweg:

1. Tastkopfspitze auswählen und anschließend `GPIO 5` anklicken.
2. Masseklemme auswählen und anschließend `GND` anklicken.

Freies Drag-and-drop, beliebige Netze oder automatische Verbindungen sind
nicht erforderlich.

Das Oszilloskop darf ohne Referenzverbindung keine gültige Spannung anzeigen.
Ein Tastkopfanschluss verändert die elektrische Schaltung in diesem Lernmodell
noch nicht durch Eingangsimpedanz oder Kapazität. Diese Modellgrenze wird
sichtbar genannt.

## 6. Command-Pfad

Alle Anschlussänderungen laufen über den gemeinsamen validierten
Command-Pfad. Neu erforderlich sind:

- `AttachProbe`
- `DetachProbe`

Konzeptioneller `AttachProbe`-Inhalt:

```text
instrumentId
channelId
lead: tip | reference
measurementPointId
```

Der Command akzeptiert ausschließlich vorhandene Instrumente, Kanäle,
Leitungen und freigegebene Messpunkte. UI-Code darf Verbindungen nicht direkt
in den Projektzustand schreiben.

`DetachProbe` entfernt genau die angegebene Leitung. Nach dem Trennen von
Tastkopfspitze oder Masseklemme werden Signal und abgeleitete Messwerte sofort
als nicht verfügbar gekennzeichnet.

## 7. Measurement-Bus-Vertrag

Der Oszilloskopadapter liest ausschließlich den von ELAB-DS-002 erzeugten
Measurement Trace für den verbundenen Messpunkt relativ zum verbundenen
Bezugspunkt.

Er darf insbesondere nicht direkt lesen aus:

- Quellcode,
- PWM-Konfiguration,
- Virtual-MCU-Zustand,
- LED-Solver,
- DOM-Darstellung der Schaltung.

Der Measurement Bus liefert dem Instrument mindestens:

```text
measurementPointId
referencePointId
quantity: voltage
unit: V
virtualTimeBase
simulationDuration
trace[]
  |- time
  `- value
modelVersions
```

Der Instrumentenadapter erhält keine versteckten Sollwerte für Frequenz oder
Tastgrad. Er leitet seine Messwerte aus den Signalübergängen des Traces ab.

## 8. Signaldarstellung

Die Darstellung rekonstruiert aus den Zustandswechseln eine stückweise
konstante Kurve. Zwischen zwei Ereignissen bleibt der zuletzt gemeldete Wert
erhalten.

Unzulässig sind:

- sinusförmige oder lineare Interpolation der PWM-Flanken,
- zufälliges Rauschen,
- Bildschirmbreite als fachliche Abtastrate,
- eigene Signalgeneratorwerte,
- Messwerte aus Pixelpositionen.

Die Renderauflösung darf sich an die Displaygröße anpassen. Fachliche Werte
und Flankenzeitpunkte bleiben davon unverändert.

Der Trigger sucht im Trace die erste gültige steigende Überquerung des festen
Pegels von 1,65 V. Im Standardtrace liegt die erste vollständig beobachtbare
steigende Flanke nach dem Start bei `1.000 µs`.

Wird keine passende Flanke gefunden, bleibt das Signal darstellbar, aber das
Instrument zeigt die Warnung `Trigger nicht gefunden`. Es erzeugt keinen
künstlichen Triggerzeitpunkt.

## 9. Abgeleitete Messwerte

Alle Messwerte werden numerisch aus dem Trace berechnet, nicht aus der
gezeichneten Kurve.

Definitionen:

```text
minimumVoltage = kleinster beobachteter Spannungswert
maximumVoltage = größter beobachteter Spannungswert
peakToPeak     = maximumVoltage - minimumVoltage
period         = Abstand zweier aufeinanderfolgender steigender Flanken
frequency      = 1 / period
dutyCycle      = HIGH-Dauer / period * 100
```

HIGH und LOW werden für dieses 0-/3,3-V-Lernsignal relativ zum festen
Triggerpegel 1,65 V unterschieden.

Bei statischen 0 oder 100 Prozent Tastgrad zeigt das Instrument:

- den korrekten Gleichspannungspegel,
- Frequenz `—`,
- Periodendauer `—`,
- Tastgrad `—`,
- Hinweis `Keine periodischen Flanken messbar`.

Das Instrument darf hierfür nicht auf versteckte PWM-Konfiguration
zurückgreifen.

## 10. Stabile Fehler- und Warncodes

Mindestens folgende Codes werden ergänzt:

| Code | Art | Bedeutung |
| --- | --- | --- |
| `INSTRUMENT_NOT_FOUND` | Fehler | Instrumenten-ID ist unbekannt |
| `INSTRUMENT_CHANNEL_NOT_FOUND` | Fehler | Kanal-ID ist unbekannt |
| `PROBE_LEAD_NOT_SUPPORTED` | Fehler | Leitung ist weder Spitze noch Referenz |
| `MEASUREMENT_POINT_NOT_FOUND` | Fehler | Messpunkt ist unbekannt |
| `PROBE_TIP_NOT_CONNECTED` | Status | Tastkopfspitze fehlt |
| `PROBE_REFERENCE_NOT_CONNECTED` | Status | Masse-/Referenzverbindung fehlt |
| `MEASUREMENT_TRACE_NOT_AVAILABLE` | Status | Simulation lieferte noch keinen Trace |
| `OSCILLOSCOPE_TRIGGER_NOT_FOUND` | Warnung | keine passende steigende Flanke im Trace |
| `OSCILLOSCOPE_PERIOD_NOT_MEASURABLE` | Status | weniger als zwei steigende Flanken |

Codes bleiben von den deutschen UI-Texten getrennt.

## 11. Oberfläche

Das Instrument erscheint als Dock derselben Workbench. Es soll wie ein
kompaktes modernes Laboroszilloskop wirken und mindestens enthalten:

- Instrumentenbezeichnung,
- CH1-Anschlussstatus,
- sichtbare feste Einstellungen,
- Raster und Kurve,
- Triggerpegelmarkierung,
- Messwertleiste,
- verständlichen Leer- beziehungsweise Fehlerzustand.

Die zwei virtuellen Tastkopf-Leitungen werden zwischen Instrument und
Schaltungsfläche sichtbar dargestellt. Auf schmalen Bildschirmen darf eine
vereinfachte beschriftete Anschlussdarstellung verwendet werden, solange
Spitze und Masse eindeutig bleiben.

Es gibt in diesem Paket keine Regler für:

- Zeit pro Division,
- Volt pro Division,
- Triggerpegel oder Triggerflanke,
- AC/DC-Kopplung,
- Tastkopffaktor,
- Kanalposition.

Diese Werte werden nur angezeigt. Ihre Bedienung folgt in einem späteren
Arbeitspaket.

## 12. Realitätsbrücke

Die Oberfläche erklärt knapp:

- Ein echtes Oszilloskop misst Spannung zwischen Tastkopfspitze und
  Masseklemme.
- Eine fehlende oder falsch angeschlossene Masse verhindert eine verlässliche
  Messung und kann in realen Aufbauten gefährlich sein.
- Die virtuelle Messung modelliert noch keine Tastkopfbelastung,
  Bandbreitenbegrenzung, Flankensteilheit, Überschwingen oder Rauschen.
- Frequenz und Tastgrad stammen aus der gemessenen Kurve, nicht aus dem
  Quellcodeetikett.

Es wird nicht behauptet, dass dieser Durchstich ein kalibriertes reales
Oszilloskop ersetzt.

## 13. Enthalten

- eine Oszilloskop-Instanz im gemeinsamen `LabProject`-Vorläufer,
- zwei vorbereitete Messpunkte,
- `AttachProbe` und `DetachProbe`,
- CH1-Tastkopfspitze und Masseklemme,
- Measurement-Bus-Adapter für Spannung relativ zu GND,
- ein fest eingestellter Oszilloskopkanal,
- stückweise konstante Darstellung des PWM-Traces,
- Triggererkennung auf steigende Flanke bei 1,65 V,
- abgeleitete Spannungs-, Frequenz- und Tastgradwerte,
- verständliche unverbundene und nicht messbare Zustände,
- Regression von ELAB-DS-001 und ELAB-DS-002.

## 14. Nicht enthalten

- Änderung des bestehenden getrennten Oszilloskop-Lernlabors,
- verstellbare Oszilloskopbedienelemente,
- zweiter Kanal,
- Cursor,
- Auto-Set,
- AC-Kopplung,
- 10-fach-Tastkopf,
- Eingangsimpedanz oder Tastkopfkapazität,
- Bandbreite, Rauschen, Überschwingen oder Flankensteilheit,
- FFT, XY, Frequenzzähler als getrennte Funktion oder Protokolldecoder,
- Signalgenerator,
- freies Verdrahten beliebiger Messpunkte,
- Multimeter oder Logikanalysator,
- Änderungen an PWM, Quellcodesprache oder Virtual MCU,
- ADC oder Stromrücklesung,
- SPICE,
- KI oder Credits,
- Persistenz, Accounts oder Capabilities,
- neue API oder neuer Serverprozess.

## 15. Abnahmekriterien

ELAB-DS-003 ist nur abgeschlossen, wenn:

1. Ohne Tastkopfspitze kein Signal und keine Messwerte angezeigt werden.
2. Ohne Masseklemme kein gültiges Spannungssignal angezeigt wird.
3. Nach Anschluss an GPIO 5 und GND ausschließlich der gemeinsame
   Measurement Trace verwendet wird.
4. Der Standardtrace `0,00 V`, `3,30 V`, `3,30 Vpp` beziehungsweise
   `3,30 V Spitze-Spitze`, `1,00 kHz`, `1,00 ms` und `25,0 %` ergibt.
5. Der Trigger reproduzierbar die steigende Flanke bei `1.000 µs` findet.
6. Eine Quellcodeänderung auf 2 kHz und 50 Prozent ohne Instrumenten-Sonderweg
   zu `2,00 kHz`, `500 µs` und `50,0 %` führt.
7. 0 und 100 Prozent als Gleichpegel ohne erfundene Frequenz dargestellt
   werden.
8. Das Trennen einer Tastkopfleitung die Messung sofort ungültig macht.
9. Zwei identische Traces identische Messwerte und Kurvenpunkte erzeugen.
10. Die Kurve nicht aus PWM-Metadaten, Pixeln oder eigener Signalformel
    erzeugt wird.
11. Die separate DS-002-Tracevorschau nicht als zweite Signalwahrheit parallel
    bestehen bleibt.
12. Das bestehende Oszilloskop-Lernlabor unverändert bleibt.
13. Alle ELAB-DS-001- und ELAB-DS-002-Tests erfolgreich bleiben.
14. Desktop-, iPad- und 360-Pixel-Layout kein horizontales Seiten-Scrolling
    besitzen.
15. Keine API-, KI-, Konto-, Speicher- oder Hardwarezugriffe entstehen.

## 16. Verpflichtende Tests

Spark erstellt und führt mindestens aus:

- Command-Tests für gültiges und ungültiges `AttachProbe` und `DetachProbe`,
- Instrumentenmodell- und Schema-Tests,
- Measurement-Bus-Adaptertest ohne direkten MCU-, Solver- oder
  Quellcodezugriff,
- Golden Test für 1 kHz und 25 Prozent,
- Golden Test für 2 kHz und 50 Prozent,
- Tests für 0 und 100 Prozent sowie fehlende Perioden,
- Trigger-Test für die steigende Flanke bei 1.000 µs,
- Test für fehlende Spitze, fehlende Referenz und fehlenden Trace,
- deterministischer Renderdaten- und Replaytest,
- statischer Test, dass das Instrument keinen eigenen Signalgenerator und
  keine PWM-Sollwertformel enthält,
- UI-Test, dass noch keine verstellbaren Oszilloskopregler vorhanden sind,
- Browsernachweis für Anschluss, Simulation, Messwert, Trennen und Reset,
- Layoutnachweis auf Desktop-, iPad- und 360-Pixel-Breite,
- vollständige Regression von ELAB-DS-001 und ELAB-DS-002,
- relevanter bestehender Contract-Test des öffentlichen Elektroniklabors,
- Regression des bestehenden getrennten Oszilloskop-Lernlabors.

Ein Live-LLM-Aufruf, SPICE-Lauf, Serverneustart oder persistierter Dev-Zustand
ist für dieses Paket nicht erforderlich.

## 17. Voraussichtlich betroffene Bereiche

Spark bestimmt die konkreten Dateinamen nach Prüfung der abgeschlossenen
DS-001-/DS-002-Implementierung. Der Scope bleibt auf folgende Bereiche
begrenzt:

- vorhandener `LabProject`-Vorläufer,
- vorhandener Command Gateway,
- vorhandener Measurement-Vertrag,
- neue Workbench-Instrumenten- und Oszilloskopadapter,
- dieselbe gemeinsame Workbench und deren Styles,
- gezielte Tests dieser Grenzen,
- unmittelbar notwendige Dokumentations-, Sicherheits- und Graphnachweise
  nach erfolgreicher Umsetzung.

Nicht verändert werden `labs/oscilloscope.js`, andere bestehende
Messgeräte-Module, Virtual-MCU- und PWM-Fachlogik, Identity-Fachlogik,
Project Server, KI oder Persistenz.

## 18. Dokumentation und Graph nach der Umsetzung

Diese Datei ist vor der Implementierung nur eine kontrollierbare
Spezifikation. Sie verändert die kanonische Graphwahrheit nicht.

Nach erfolgreicher Umsetzung prüft Spark:

- Requirement-, Implementation- und Test-Artefakte für gemeinsamen
  Measurement Bus, Tastkopfanschluss und Oszilloskopadapter,
- Dokumentation der jetzt tatsächlich gemeinsamen Laborfläche,
- lokalen Sicherheitsnachweis ohne neue öffentliche API,
- weiterhin unveränderte Prozess-UML, sofern kein neuer Prozess entstand,
- erneuten Build der Offline-Architekturdokumentation.

Ein Graphstatus `implemented` darf erst nach vollständigem grünem Nachweis
gesetzt werden.

## 19. Arbeitsauftrag für Spark

> Prüfe zuerst, ob ELAB-DS-001 und ELAB-DS-002 vollständig umgesetzt sind und
> alle zugehörigen Tests erfolgreich laufen. Implementiere anschließend
> ausschließlich `ELAB-DS-003` aus
> `docs/virtual-electronics-lab-pwm-oscilloscope-vertical-slice-spec.md`.
> Das Oszilloskop muss als Instrument derselben Workbench ausschließlich den
> gemeinsamen Measurement Trace beobachten. Es darf weder eine eigene
> Signalquelle noch einen direkten Zugriff auf Quellcode, PWM-Konfiguration,
> Virtual MCU oder Solver besitzen. Bewahre alle nicht genannten
> Bestandsfunktionen und ändere insbesondere das bestehende getrennte
> Oszilloskop-Lernlabor nicht. Implementiere keine der unter `Nicht enthalten`
> genannten Funktionen. Führe alle benannten Tests einschließlich der
> vollständigen DS-001-/DS-002-Regression aus. Prüfe am Ende Graph-,
> Sicherheits- und Dokumentationsauswirkungen. Starte oder restarte keine
> Dienste ohne nachgewiesene Notwendigkeit. Deploye, stage, committe und pushe
> nicht.

Wenn eine Voraussetzung fehlt oder diese Spezifikation eine notwendige
Entscheidung offenlässt, stoppt Spark und benennt genau den Blocker. Spark darf
den Scope nicht selbst erweitern.
