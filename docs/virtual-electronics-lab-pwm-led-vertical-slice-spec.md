# ELAB-DS-002: Codegesteuertes PWM bis zur LED

Stand: 2026-08-16  
Status: Implementiert und getestet (2026-08-16)
Voraussetzung: ELAB-DS-001 wurde vollständig umgesetzt und abgenommen

Diese Spezifikation ist der zweite ausführbare Arbeitsauftrag für **Spark**.
Sie darf erst umgesetzt werden, wenn der erste
[GPIO-LED-Durchstich](virtual-electronics-lab-gpio-led-vertical-slice-spec.md)
mit seinen Tests erfolgreich abgeschlossen ist.

ELAB-DS-002 erweitert dieselbe gemeinsame Laborfläche um genau eine neue
Fähigkeit: PWM entsteht durch Quellcode in der Peripherie des virtuellen
Mikrocontrollers und wirkt über dessen Pin auf dieselbe LED-Schaltung.

## 1. Ziel

Der Nutzer kann Frequenz und Tastgrad ausschließlich im Quellcode festlegen,
die Simulation starten und die vollständige Ursache-Wirkungs-Kette sehen:

```text
Quellcode
-> kontrollierte Program Runtime
-> PWM-Peripherie des virtuellen Mikrocontrollers
-> virtuelle Zeit und GPIO-5-Flanken
-> 330-Ohm-Vorwiderstand
-> rote LED
-> zeitbezogener Strom, Mittelwert und sichtbarer LED-Zustand
```

Der Durchstich weist nach, dass Mikrocontroller-Peripherie, virtuelle Zeit,
Schaltung und Measurement-Ergebnis deterministisch gekoppelt sind.

## 2. Sichtbares Nutzerergebnis

In derselben gemeinsamen Laborfläche kann der Nutzer den vorbereiteten
PWM-Versuch öffnen. Es entsteht kein weiteres Messgeräte-Lab und keine zweite
Schaltungswahrheit.

Der PWM-Startcode lautet:

```cpp
void setup() {
  pinMode(5, OUTPUT);
  pwmConfigure(5, 1000, 25);
  pwmStart(5);
}

void loop() {
}
```

Die Oberfläche zeigt nach `Simulation starten`:

- GPIO 5: `PWM`,
- Frequenz: `1,00 kHz`,
- Periodendauer: `1,00 ms`,
- Tastgrad: `25,0 %`,
- HIGH-Dauer je Periode: `250 µs`,
- LOW-Dauer je Periode: `750 µs`,
- LED-Strom während HIGH: `3,94 mA`,
- mittlerer LED-Strom des Lernmodells: `0,98 mA`,
- LED-Zustand: `pulst mit 1,00 kHz · mittlerer Tastgrad 25 %`.

Eine kompakte Zeitverlaufsanzeige stellt mindestens vier vollständige Perioden
dar. Sie ist eine Darstellung des gemeinsamen Measurement Trace und noch kein
Oszilloskop.

## 3. Zugang zum PWM-Beispiel

ELAB-DS-001 bleibt der unveränderte Standardzustand der gemeinsamen
Laborfläche. ELAB-DS-002 ergänzt dort einen klaren Einstieg
`PWM-Beispiel öffnen`.

Der Einstieg lädt einen vorbereiteten flüchtigen `LabProject`-Zustand in
dieselbe Workbench. Er darf technisch über einen begrenzten Beispielparameter
der vorhandenen Route abgebildet werden. Es entsteht:

- keine zweite Laboranwendung,
- kein allgemeines Template-Verwaltungssystem,
- keine dauerhafte Speicherung,
- kein versteckter zweiter Solver.

Beim Wechsel wird ausdrücklich angezeigt, dass nicht gespeicherter
Editorinhalt verworfen wird. Da der öffentliche Durchstich keine Persistenz
besitzt, genügt eine einfache Bestätigung vor dem Wechsel.

## 4. PWM-Programmierschnittstelle

Die kontrollierte Runtime aus ELAB-DS-001 wird ausschließlich um folgende
Aufrufe erweitert:

```cpp
pwmConfigure(pin, frequencyHz, dutyPercent);
pwmStart(pin);
pwmStop(pin);
```

Für diesen Durchstich gilt:

- nur GPIO 5,
- Frequenzbereich 1 Hz bis einschließlich 100.000 Hz,
- Tastgrad 0 bis einschließlich 100 Prozent,
- Frequenz und Tastgrad sind endliche numerische Literale,
- `pinMode(5, OUTPUT)` muss vor der PWM-Konfiguration ausgeführt worden sein,
- `pwmConfigure` muss vor `pwmStart` ausgeführt worden sein,
- erneutes `pwmConfigure` ersetzt die Konfiguration deterministisch,
- `pwmStop(5)` beendet PWM und setzt GPIO 5 auf `LOW`,
- ein nachfolgendes gültiges `digitalWrite` beendet eine aktive PWM-Ausgabe
  und setzt den gewünschten statischen Pegel,
- ein nachfolgendes `pwmStart` aktiviert die zuletzt gültig konfigurierte PWM
  erneut.

Diese kleine generische Lern-API wird nicht als Arduino-, ESP32- oder
Hersteller-API bezeichnet. Sie legt noch keine spätere öffentliche
Programmierschnittstelle fest.

Andere neue Sprachkonstrukte sind nicht Teil dieses Pakets. Insbesondere
werden keine Variablen, Bedingungen, Schleifen, Zeitfunktionen, Register oder
Interrupt-Handler ergänzt.

## 5. Virtual-MCU- und PWM-Zustand

Der vorhandene virtuelle Mikrocontroller wird minimal erweitert:

```text
VirtualMcu
`- gpio[5]
   |- mode
   |- staticLevel
   `- pwm
      |- configured
      |- running
      |- frequencyHz
      |- dutyPercent
      `- phaseOrigin
```

`phaseOrigin` liegt in virtueller Zeit. Startet PWM, beginnt die erste Periode
deterministisch bei `t = 0` beziehungsweise beim dokumentierten aktuellen
virtuellen Startzeitpunkt mit der HIGH-Phase.

Sonderfälle:

- 0 Prozent Tastgrad: Ausgang bleibt LOW; es entstehen keine künstlichen
  Flanken.
- 100 Prozent Tastgrad: Ausgang bleibt HIGH; es entstehen keine künstlichen
  Flanken.
- `pwmStop`: Ausgang wird zum selben virtuellen Zeitpunkt LOW.

## 6. Virtuelle Zeit

ELAB-DS-002 führt den kleinsten notwendigen deterministischen Zeitvertrag ein.

Für den vorbereiteten Versuch gilt:

- Simulationsbeginn: `0 µs`,
- Simulationsdauer: vier vollständige PWM-Perioden,
- fachliche Zeitbasis: ganzzahlige Mikrosekunden,
- die Ereigniswarteschlange enthält nur notwendige HIGH-/LOW-Flanken und das
  Simulationsende,
- die Browser-Renderfrequenz verändert keine fachliche Zeit und keine Flanke,
- `requestAnimationFrame`, `setTimeout`, `Date.now` oder reale Uhrzeit dürfen
  die Simulation nicht steuern.

Bei Frequenzen, deren Periodendauer nicht als ganze Mikrosekunde darstellbar
ist, muss die Runtime eine dokumentierte rationale oder ganzzahlige
Submikrosekunden-Zeitbasis verwenden. Stilles, von Lauf zu Lauf
unterschiedliches Runden ist nicht zulässig.

Die konkrete interne Zeitauflösung wird durch den Implementierungsvertrag
explizit benannt und getestet. Sie bleibt eine Runtime-Eigenschaft und wird
nicht als neue Benutzereinstellung angeboten.

## 7. Elektrische Berechnung

Der vorhandene LED-Lern-Solver aus ELAB-DS-001 bleibt die einzige elektrische
Wahrheit.

Während HIGH gilt weiterhin:

```text
I_HIGH = (3,3 V - 2,0 V) / 330 Ohm
I_HIGH = 3,939... mA
```

Während LOW gilt:

```text
I_LOW = 0 mA
```

Der arithmetische Mittelwert über vollständige Perioden lautet:

```text
I_MEAN = I_HIGH * dutyPercent / 100
I_MEAN = 3,939... mA * 0,25
I_MEAN = 0,9848... mA
```

Die Oberfläche zeigt gerundet `0,98 mA`.

Die sichtbare LED-Helligkeit darf für dieses Lernmodell proportional zum
Tastgrad dargestellt werden. Die Oberfläche muss kenntlich machen, dass
wahrgenommene Helligkeit, LED-Kennlinie, Temperatur und sehr niedrige
Frequenzen dadurch nicht realitätsgetreu modelliert werden.

Die Überstromwarnungen aus ELAB-DS-001 werden gegen `I_HIGH` bewertet, nicht
gegen den Mittelwert. PWM macht einen zu hohen Pulsstrom nicht automatisch
sicher.

## 8. Measurement Trace

Das Measurement-Ergebnis aus ELAB-DS-001 wird additiv um einen zeitbezogenen
Trace erweitert. Mindestens enthalten sind:

```text
virtualTimeBase
simulationDuration
pwm.pin
pwm.frequencyHz
pwm.period
pwm.dutyPercent
pwm.highDuration
pwm.lowDuration
trace[]
  |- time
  |- logicLevel
  |- gpioVoltageV
  `- ledCurrentA
led.highCurrentA
led.meanCurrentA
warnings[]
modelVersions
```

Der Trace enthält Zustandswechsel und den notwendigen Anfangs- und Endzustand,
aber keine von der Bildschirmbreite abhängigen Samples. Die UI leitet ihre
Darstellung aus diesem Trace ab und erzeugt keine eigenen Signalwerte.

Für 1 kHz und 25 Prozent Tastgrad beginnt die Folge mit:

| virtuelle Zeit | Pegel | Spannung | LED-Strom |
| ---: | --- | ---: | ---: |
| 0 µs | HIGH | 3,3 V | 3,939... mA |
| 250 µs | LOW | 0 V | 0 mA |
| 1.000 µs | HIGH | 3,3 V | 3,939... mA |
| 1.250 µs | LOW | 0 V | 0 mA |

Die Folge wird bis zum dokumentierten Ende der vierten Periode fortgesetzt.

## 9. Command-Pfad

Die vorhandenen Commands `UpdateSourceFile`, `StartSimulation` und
`ResetSimulation` werden wiederverwendet.

Für den Beispielwechsel darf genau ein zusätzlicher typisierter Command
eingeführt werden:

- `LoadLabExample`

Er akzeptiert ausschließlich bekannte, intern definierte Beispiel-IDs. Freie
Dateipfade, URLs oder ungeprüfte JSON-Projekte sind unzulässig.

Der Nutzer verändert Frequenz und Tastgrad nicht über einen Command oder
UI-Regler, sondern über `UpdateSourceFile` und den anschließend interpretierten
Quellcode.

## 10. Oberfläche

Die gemeinsame Laborfläche aus ELAB-DS-001 wird weiterverwendet. Im
PWM-Beispiel zeigt sie zusätzlich:

- Frequenz, Periode, Tastgrad, HIGH- und LOW-Dauer,
- HIGH-Strom und arithmetischen Mittelstrom,
- eine kompakte, aus `MeasurementTrace` gerenderte Zeitverlaufsanzeige,
- die Modellgrenze zur wahrgenommenen LED-Helligkeit,
- die Realitätsbrücke: Auf echter Hardware erzeugt ein Timer beziehungsweise
  eine PWM-Peripherie die Flanken; Frequenz und Tastgrad werden durch Firmware
  konfiguriert und am Pin gemessen.

Es gibt ausdrücklich:

- keinen Frequenzregler,
- keinen Tastgradregler,
- keinen direkten PWM-Schalter außerhalb des Quellcodes,
- kein Oszilloskop-Bedienfeld,
- keine zweite Schaltungsdarstellung.

Der Nutzer kann im Editor beispielsweise `25` zu `50` ändern und nach einem
neuen Simulationsstart den veränderten Trace und Mittelstrom sehen.

## 11. Enthalten

- Erweiterung der kontrollierten Runtime um drei PWM-Aufrufe,
- minimaler PWM-Zustand in der vorhandenen Virtual MCU Runtime,
- deterministische virtuelle Zeit und PWM-Flanken für einen Pin,
- Wiederverwendung des bestehenden LED-Lern-Solvers je Pegelzustand,
- zeitbezogener Measurement Trace,
- arithmetischer Mittelstrom über vollständige Perioden,
- kompakte Trace-Darstellung in derselben Workbench,
- ein begrenzter Einstieg in das vorbereitete PWM-Beispiel,
- Regressionstests für den statischen GPIO-Durchstich.

## 12. Nicht enthalten

- allgemeine Template-Verwaltung,
- freie Wahl oder Verdrahtung weiterer Pins,
- mehrere PWM-Kanäle,
- Timerregister, Prescaler oder Auflösungsregister,
- Interrupts oder Interrupt-Handler,
- Phasenverschiebung oder komplementäre PWM,
- Dead Time oder Gate Driver,
- PWM-Eingang oder Capture,
- Motoren, Leistungselektronik oder Stromregelung,
- LED-Strommessung mit ADC,
- geschlossene Leistungs- oder Stromregelung,
- Taster, Potentiometer, Drehgeber oder serielle Kommandos,
- Oszilloskop, Logikanalysator oder Multimeter,
- SPICE,
- KI, Credits oder Accounts,
- Persistenz,
- allgemeine Arduino-, ESP32- oder C++-Kompatibilität,
- neue Serverprozesse oder APIs,
- Änderung der bestehenden separaten Messgeräte-Labs.

## 13. Stabile Fehlercodes

ELAB-DS-001-Fehlercodes bleiben erhalten. Neu hinzukommen mindestens:

| Code | Art | Bedeutung |
| --- | --- | --- |
| `PWM_PIN_NOT_AVAILABLE` | Fehler | PWM wurde für einen anderen Pin angefordert |
| `PWM_PIN_NOT_CONFIGURED_AS_OUTPUT` | Fehler | PWM-Konfiguration ohne Ausgangsmodus |
| `PWM_FREQUENCY_OUT_OF_RANGE` | Fehler | Frequenz liegt außerhalb 1 bis 100.000 Hz |
| `PWM_DUTY_CYCLE_OUT_OF_RANGE` | Fehler | Tastgrad liegt außerhalb 0 bis 100 Prozent |
| `PWM_CONFIGURATION_REQUIRED` | Fehler | `pwmStart` wurde vor `pwmConfigure` aufgerufen |
| `PWM_NUMERIC_ARGUMENT_REQUIRED` | Fehler | Frequenz oder Tastgrad ist kein endliches numerisches Literal |

Fehlercodes sind von deutschen UI-Texten getrennt. Parserdiagnosen nennen
weiterhin Zeile und Spalte.

## 14. Abnahmekriterien

ELAB-DS-002 ist nur abgeschlossen, wenn alle folgenden Punkte nachgewiesen
sind:

1. Das PWM-Beispiel erzeugt bei 1 kHz und 25 Prozent genau vier
   deterministische Perioden.
2. Die Flanken liegen bei 0, 250, 1.000, 1.250 Mikrosekunden und entsprechend
   in den weiteren Perioden.
3. HIGH-Strom ist `3,94 mA`, Mittelstrom ist `0,98 mA`.
4. Eine Änderung auf 50 Prozent erzeugt 500 µs HIGH, 500 µs LOW und gerundet
   `1,97 mA` Mittelstrom.
5. Frequenz und Tastgrad können im normalen Bedienweg nur über Quellcode
   verändert werden.
6. 0 und 100 Prozent erzeugen stabile Pegel ohne künstliche Flanken.
7. Überstromwarnungen verwenden den HIGH-Strom.
8. Zwei identische Läufe liefern denselben Trace und dieselben Fachwerte.
9. Die Zeitverlaufsanzeige verwendet ausschließlich den Measurement Trace.
10. `digitalWrite` beendet PWM deterministisch; `pwmStop` setzt den Pin LOW.
11. Alle ELAB-DS-001-Abnahmetests bleiben erfolgreich.
12. Bestehende Messgeräte-Labs bleiben unverändert nutzbar.
13. Desktop-, iPad- und 360-Pixel-Layout besitzen kein horizontales
    Seiten-Scrolling.
14. Es erfolgen keine API-, KI-, Konto-, Speicher- oder Hardwarezugriffe.

## 15. Verpflichtende Tests

Spark muss mindestens folgende Nachweise erstellen und ausführen:

- Parsertests für alle drei neuen Aufrufe und ungültige Argumente,
- Virtual-MCU-Tests für Konfiguration, Start, Stop, erneute Konfiguration und
  Übergang zu `digitalWrite`,
- virtuelle-Zeit-Golden-Tests für 1 kHz bei 25 und 50 Prozent,
- Grenztests für 1 Hz, 100 kHz, 0 Prozent und 100 Prozent,
- Negativtests für Frequenz und Tastgrad außerhalb des gültigen Bereichs,
- Solvertests für HIGH-Strom, Mittelstrom und Überstrombewertung,
- Measurement-Trace-Contract-Test,
- deterministischer Replaytest ohne reale Uhrzeit,
- UI-Test, dass kein Frequenz-, Tastgrad- oder direkter PWM-Regler existiert,
- Browsernachweis für PWM-Beispiel, Quellcodeänderung, Fehler und Reset,
- Layoutnachweis auf Desktop-, iPad- und 360-Pixel-Breite,
- vollständige Regression der ELAB-DS-001-Tests,
- relevante bestehende Contract-Tests des öffentlichen Elektroniklabors,
- Sicherheitsprüfung auf `eval`, `new Function`, freie Module, Netzwerkzugriff
  und Wall-Clock-Steuerung der fachlichen Simulation.

Live-LLM-Aufrufe, SPICE, Serverneustarts oder persistierte Dev-Daten sind für
diesen Nachweis nicht erforderlich.

## 16. Voraussichtlich betroffene Bereiche

Spark bestimmt die konkreten Dateinamen erst nach Prüfung der dann von
ELAB-DS-001 hinterlassenen Implementierung. Der Scope bleibt begrenzt auf:

- vorhandene Workbench-Domain und das `LabProject`-Schema,
- vorhandene kontrollierte Program Runtime,
- vorhandene Virtual MCU Runtime,
- vorhandenen Simulationskoordinator und LED-Lern-Solver,
- vorhandenen Measurement-Vertrag,
- dieselbe Workbench-Oberfläche und deren Styles,
- gezielte Tests dieser Grenzen,
- unmittelbar notwendige Dokumentations- und Graphnachweise nach erfolgreicher
  Umsetzung.

Bestehende Messgeräte-Module, andere Plattformbereiche, Project Server,
Identity-Fachlogik, KI und Persistenz werden nicht erweitert.

## 17. Dokumentation und Graph nach der Umsetzung

Diese Datei ist vor der Implementierung nur eine kontrollierbare
Spezifikation. Sie ändert die kanonische Graphwahrheit nicht.

Nach erfolgreicher Umsetzung prüft Spark:

- Requirement-, Implementation- und Test-Artefakte für PWM und virtuelle Zeit,
- Status und Modellgrenze der kontrollierten Program Runtime,
- lokalen Sicherheitsnachweis ohne freie Codeausführung,
- Dokumentation des gemeinsamen Elektroniklabors,
- weiterhin unveränderte Prozess-UML, sofern kein neuer Prozess entstand,
- erneuten Build der Offline-Architekturdokumentation.

Ein Status `implemented` wird im SQLite-Graphen erst nach vollständigem grünem
Nachweis gesetzt.

## 18. Arbeitsauftrag für Spark

Der spätere Spark-Auftrag lautet:

> Prüfe zuerst, ob ELAB-DS-001 vollständig umgesetzt ist und alle zugehörigen
> Tests erfolgreich sind. Implementiere anschließend ausschließlich
> `ELAB-DS-002` aus
> `docs/virtual-electronics-lab-pwm-led-vertical-slice-spec.md`.
> Bewahre den vollständigen GPIO-LED-Durchstich und alle nicht genannten
> Bestandsfunktionen. Triff keine offene Architekturentscheidung still im
> Code. Implementiere keine der unter `Nicht enthalten` genannten Funktionen.
> Frequenz und Tastgrad dürfen im normalen Bedienweg ausschließlich aus dem
> kontrolliert interpretierten Quellcode stammen. Führe alle benannten Tests
> einschließlich ELAB-DS-001-Regression aus. Prüfe am Ende Graph-,
> Sicherheits- und Dokumentationsauswirkungen. Starte oder restarte keine
> Dienste ohne nachgewiesene Notwendigkeit. Deploye, stage, committe und pushe
> nicht.

Wenn ELAB-DS-001 unvollständig ist oder eine notwendige Entscheidung in dieser
Spezifikation fehlt, stoppt Spark und benennt genau den Blocker. Spark darf den
Scope nicht selbst erweitern.
