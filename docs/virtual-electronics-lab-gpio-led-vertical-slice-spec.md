# ELAB-DS-001: Durchstich Quellcode bis LED-Strom

Stand: 2026-08-16  
Status: Implementiert und getestet (2026-08-16)

Diese Spezifikation ist der erste ausführbare Arbeitsauftrag für **Spark**.
Sie konkretisiert ausschließlich einen sehr kleinen vertikalen Durchstich der
geplanten gemeinsamen Elektroniklabor-Architektur.

Der Nutzer kontrolliert und bestätigt diese Spezifikation, bevor Spark
Programmcode verändert. Bis dahin entstehen weder Runtime-, Graph- noch
Prozessänderungen.

## 1. Ziel

Der Nutzer kann in einem Quellcode-Editor den Wert `HIGH` oder `LOW` eines
virtuellen GPIO-Ausgangs festlegen, die Simulation starten und die vollständige
Ursache-Wirkungs-Kette sehen:

```text
Quellcode
-> kontrollierte Program Runtime
-> virtueller Mikrocontroller
-> GPIO 5
-> 330-Ohm-Vorwiderstand
-> rote LED
-> berechneter Strom und sichtbarer LED-Zustand
```

Der Durchstich beweist die Kopplung der neuen Architekturgrenzen. Er soll noch
kein allgemein verwendbares Elektroniklabor liefern.

## 2. Sichtbares Nutzerergebnis

Unter dem bestehenden öffentlichen Elektroniklabor erscheint eine klar als
`Durchstich` gekennzeichnete gemeinsame Laborfläche.

Der vorbereitete Aufbau enthält:

- einen generischen virtuellen 3,3-V-Mikrocontroller,
- GPIO 5,
- einen Vorwiderstand mit 330 Ohm,
- eine rote LED mit vereinfachter Durchlassspannung von 2,0 V,
- Masse,
- einen Quellcode-Editor,
- die Schaltflächen `Simulation starten` und `Zurücksetzen`,
- eine Ergebnisanzeige für GPIO-Pegel, Spannung, Strom, LED-Zustand und
  Warnungen.

Der Startcode lautet:

```cpp
void setup() {
  pinMode(5, OUTPUT);
  digitalWrite(5, HIGH);
}

void loop() {
}
```

Nach `Simulation starten` zeigt die Oberfläche:

- GPIO 5: `HIGH`,
- GPIO-Spannung: `3,30 V`,
- LED-Strom: `3,94 mA`,
- LED: `leuchtet`,
- keine Überstromwarnung.

Ändert der Nutzer `HIGH` zu `LOW` und startet erneut, zeigt die Oberfläche:

- GPIO 5: `LOW`,
- GPIO-Spannung: `0,00 V`,
- LED-Strom: `0,00 mA`,
- LED: `aus`.

## 3. Fachliches Modell

Der Durchstich verwendet einen kleinen versionierten Vorläufer des
`LabProject`-Vertrags. Das Modell enthält mindestens:

```text
LabProject
|- schemaVersion
|- metadata
|- circuit
|  |- virtualMcu
|  |- gpioPin
|  |- resistor
|  |- led
|  `- nets
|- controller
|  `- sourceFile
`- simulation
   `- modelVersions
```

Mindestwerte:

| Größe | Wert |
| --- | ---: |
| MCU-Ausgangsspannung bei HIGH | 3,3 V |
| GPIO | 5 |
| Vorwiderstand | 330 Ohm |
| LED-Durchlassspannung | 2,0 V |
| empfohlener maximaler GPIO-Quellstrom des Lernmodells | 12 mA |
| maximaler LED-Strom des Lernmodells | 20 mA |

Das Projektmodell ist während dieses öffentlichen Durchstichs flüchtig. Es
wird nicht in `localStorage`, einer losen JSON-Datei, PostgreSQL oder Forgejo
gespeichert.

## 4. Berechnungsregeln

Für `HIGH` gilt im gültigen Bereich des Lernmodells:

```text
I_LED = max(0, (U_GPIO - U_F_LED) / R)
```

Mit den vorbereiteten Werten:

```text
I_LED = (3,3 V - 2,0 V) / 330 Ohm
I_LED = 0,003939... A
I_LED = 3,94 mA
```

Für `LOW` gilt:

```text
U_GPIO = 0 V
I_LED = 0 A
```

Ist der berechnete Strom größer als 12 mA, wird die stabile Warnung
`GPIO_SOURCE_CURRENT_EXCEEDED` erzeugt. Ist er größer als 20 mA, wird
zusätzlich `LED_CURRENT_EXCEEDED` erzeugt.

Das Lernmodell begrenzt oder modelliert die Spannung in diesem Fall nicht
physikalisch genauer. Es kennzeichnet das Ergebnis als außerhalb seines
gültigen Bereichs. Die Oberfläche darf keine höhere Modellgenauigkeit
vortäuschen.

## 5. Begrenzte Program Runtime

Die Runtime ist nur ein Sicherheits- und Architekturnachweis. Sie legt noch
keine allgemeine Sprache des späteren Elektroniklabors fest.

Für diesen Durchstich werden ausschließlich folgende Konstrukte akzeptiert:

- genau eine Funktion `void setup()`,
- genau eine Funktion `void loop()`,
- `pinMode(5, OUTPUT);`,
- `digitalWrite(5, HIGH);`,
- `digitalWrite(5, LOW);`,
- Leerraum und Kommentare.

Weitere Pins, Variablen, Schleifen, Bedingungen, Includes, Makros,
Funktionsdefinitionen oder C++-Konstrukte werden mit einer verständlichen
Diagnose abgewiesen.

Technische Grenzen:

- maximal 4.096 Zeichen Quelltext,
- maximal 32 Anweisungen,
- `setup()` wird genau einmal ausgeführt,
- `loop()` wird für diesen statischen Durchstich genau einmal ausgeführt,
- keine Wall-Clock-Abhängigkeit,
- keine dynamisch geladenen Module,
- kein Netzwerk-, Datei-, Browser- oder Datenbankzugriff,
- kein `eval`, `new Function`, WebAssembly-Nutzerprogramm oder nativer Prozess.

Parserfehler enthalten einen stabilen Fehlercode sowie Zeile und Spalte. Ein
Fehler lässt den zuletzt erfolgreich berechneten Zustand nicht als neues
Ergebnis erscheinen.

## 6. Virtual-MCU-Regeln

Der virtuelle Mikrocontroller ist generisch und wird nicht als ESP32 oder als
anderer realer Mikrocontroller bezeichnet.

Für GPIO 5 gelten:

- Startzustand: Modus nicht gesetzt, Pegel `LOW`,
- `pinMode(5, OUTPUT)` setzt den Ausgangsmodus,
- `digitalWrite(5, HIGH)` setzt 3,3 V,
- `digitalWrite(5, LOW)` setzt 0 V,
- `digitalWrite` vor `pinMode(..., OUTPUT)` erzeugt
  `GPIO_NOT_CONFIGURED_AS_OUTPUT`,
- andere Pin-Nummern erzeugen `GPIO_PIN_NOT_AVAILABLE`.

Die Runtime mutiert nicht direkt die Schaltung. Sie liefert den GPIO-Zustand
an den Simulationskoordinator, der ihn dem Lern-Solver übergibt.

## 7. Command-Pfad

Auch dieser kleine Durchstich verwendet typisierte Befehle. Mindestens
erforderlich sind:

- `UpdateSourceFile`
- `StartSimulation`
- `ResetSimulation`

Die Oberfläche ruft keine internen MCU- oder Solver-Funktionen direkt auf.
Alle drei Nutzeraktionen laufen über denselben validierten Command-Pfad.

`ResetSimulation` stellt Startcode, MCU-Startzustand und leere Messergebnisse
wieder her. Das öffentliche Farbschema gehört nicht zum `LabProject` und wird
durch den Reset nicht verändert.

## 8. Measurement-Ergebnis

Der Solver veröffentlicht sein Ergebnis über einen minimalen Vorläufer des
Measurement Bus. Das Ergebnis enthält mindestens:

```text
simulationRunId
virtualTime
gpio.pin
gpio.logicLevel
gpio.voltageV
branch.ledCurrentA
led.state
warnings[]
modelVersions
```

Gleicher Quelltext und gleicher Startzustand müssen bytegleich
serialisierbare Fachwerte liefern. Eine zufällige ID oder reale Uhrzeit darf
nicht Teil des deterministisch verglichenen Ergebnisses sein.

## 9. Oberfläche

Der Durchstich wird als erste gemeinsame Laborfläche umgesetzt, nicht als
neues Messgerät. Die vorhandenen Messgeräte bleiben unverändert verfügbar.

Die Laborfläche zeigt auf Desktop beziehungsweise iPad-Breite:

- links oder oben den festen Schaltungsaufbau,
- daneben den Quellcode-Editor,
- darunter oder rechts die Messergebnisse und Diagnosen.

Auf schmalen Bildschirmen stehen diese Bereiche untereinander. Es darf kein
horizontales Seiten-Scrolling entstehen.

Die Schaltung soll wie ein modernes Elektroniklabor wirken. Sichtbar sein
müssen Mikrocontroller-Pin, Leitung, Widerstand, LED und Masse. Eine
DOS-artige reine Text- oder Tabellenansicht erfüllt die Anforderung nicht.

Die Oberfläche zeigt außerdem knapp:

- `Generisches Lernmodell – keine ESP32-Emulation`,
- die verwendeten Modellwerte,
- die Formel des aktuellen Ergebnisses,
- die Realitätsbrücke: Im echten Labor würden Quellcode geflasht, Masse
  verbunden und Strom beziehungsweise Spannung mit einem Messgerät geprüft.

Es gibt keinen freien PWM-Regler und keinen direkten GPIO-Schalter in der UI.
Der normale Bedienweg bleibt Quellcode -> MCU -> Pin -> Schaltung.

## 10. Technischer Einbaupunkt

Für den Durchstich gilt vorläufig:

- bestehende öffentliche Route `/technik-labs/`,
- Auswahl über einen neuen, klar gekennzeichneten Eintrag
  `Elektroniklabor · Durchstich`,
- gemeinsame neue Workbench-Module neben der bisherigen `labs/`-Bestandslogik,
- der alte Mount-Vertrag darf nur als Übergangsadapter zur bestehenden Shell
  dienen,
- neue Domain-, Runtime- und Solverlogik darf nicht in einem bestehenden
  Messgeräte-Modul landen,
- alle ausgelieferten Workbench-Assets müssen weiterhin durch die enge
  statische Identity-Allowlist begrenzt werden.

Dies entscheidet nicht über die endgültige Route oder spätere
Bundle-Aufteilung des Elektroniklabors.

## 11. Enthalten

- minimaler versionierter `LabProject`-Vorläufer,
- typisierter Command-Pfad,
- streng begrenzter Parser und Interpreter,
- minimaler virtueller MCU mit GPIO 5,
- deterministischer LED-Gleichstrom-Solver,
- minimale Measurement-Ausgabe,
- sichtbare gemeinsame Laborfläche,
- Start, Fehleranzeige und Reset,
- Unit-, Contract-, Integrations- und Browsernachweis,
- unmittelbar notwendige Dokumentationsaktualisierung nach Umsetzung.

## 12. Nicht enthalten

- PWM, Timer oder Interrupts,
- ADC oder DAC,
- UART, SPI oder I²C,
- Taster oder Sensoren,
- Oszilloskop, Multimeter oder Logikanalysator,
- freie Verdrahtung oder Komponentenbibliothek,
- veränderbarer Widerstand in der Oberfläche,
- SPICE oder eine externe Solver-Bibliothek,
- KI oder Credits,
- Accounts, Capabilities oder Tarife,
- Projektpersistenz oder Forgejo,
- Fehlersuchaufgaben,
- Undo oder Redo,
- Emulation eines realen Mikrocontrollers,
- allgemeine Arduino- oder C++-Kompatibilität,
- Änderung oder Migration bestehender Messgeräte-Labs.

## 13. Stabile Fehlercodes

Mindestens folgende Fehler beziehungsweise Warnungen sind abzudecken:

| Code | Art | Bedeutung |
| --- | --- | --- |
| `SOURCE_TOO_LARGE` | Fehler | mehr als 4.096 Zeichen |
| `PROGRAM_SYNTAX_ERROR` | Fehler | Syntax außerhalb der erlaubten Grammatik |
| `PROGRAM_STATEMENT_LIMIT_EXCEEDED` | Fehler | mehr als 32 Anweisungen |
| `GPIO_PIN_NOT_AVAILABLE` | Fehler | anderer Pin als GPIO 5 |
| `GPIO_NOT_CONFIGURED_AS_OUTPUT` | Fehler | Schreiben ohne Ausgangskonfiguration |
| `GPIO_SOURCE_CURRENT_EXCEEDED` | Warnung | berechneter Strom größer als 12 mA |
| `LED_CURRENT_EXCEEDED` | Warnung | berechneter Strom größer als 20 mA |

Fehlercodes bleiben fachlich stabil. Die deutsche Anzeige wird getrennt davon
formuliert.

## 14. Abnahmekriterien

Der Durchstich ist nur abgeschlossen, wenn alle folgenden Punkte nachweisbar
sind:

1. Der Startcode erzeugt reproduzierbar `HIGH`, `3,30 V` und `3,94 mA`.
2. Die Änderung von `HIGH` zu `LOW` erzeugt reproduzierbar `0,00 V` und
   `0,00 mA`.
3. Entfernt der Nutzer `pinMode`, wird
   `GPIO_NOT_CONFIGURED_AS_OUTPUT` verständlich angezeigt.
4. Nicht erlaubter Quelltext wird ohne `eval` oder native Ausführung
   abgewiesen.
5. Reset stellt den dokumentierten Ausgangszustand wieder her.
6. Zwei identische Läufe liefern dieselben deterministischen Fachwerte.
7. Die Oberfläche besitzt keinen direkten PWM- oder GPIO-Regler.
8. Bestehende Messgeräte-Labs bleiben unverändert nutzbar.
9. Die Laborfläche funktioniert auf Desktop-, iPad- und 360-Pixel-Breite ohne
   horizontales Seiten-Scrolling.
10. Es erfolgen keine API-, Konto-, KI-, Speicher- oder Hardwarezugriffe.

## 15. Verpflichtende Tests

Spark muss mindestens folgende Nachweise erstellen und ausführen:

- Schema- und Command-Unit-Tests,
- Parser-Tests für gültigen Startcode, `HIGH`, `LOW`, Syntaxfehler,
  Quelltextgrenze und Anweisungsgrenze,
- Virtual-MCU-Tests für Modus, Pegel, falschen Pin und Schreiben vor
  `pinMode`,
- Solver-Golden-Tests für 3,94 mA und 0 mA,
- Warnungstests mit internen Testprojekten für mehr als 12 mA und mehr als
  20 mA; diese Widerstandswerte werden nicht als neue UI-Funktion angeboten,
- Integrations- und Replaytest für
  Quellcode -> MCU -> GPIO -> Widerstand -> LED -> Measurement,
- bestehender Identity-Contract-Test für das öffentliche Elektroniklabor,
- statischer Routen-Negativtest für nicht freigegebene Dateien,
- Browsernachweis für Start, LOW, Fehler und Reset,
- Layoutnachweis auf Desktop-, iPad- und 360-Pixel-Breite,
- Prüfung auf `eval`, `new Function` und unzulässige Netzwerkaufrufe.

Live-LLM-Aufrufe, SPICE, Prozessneustarts oder persistierte Dev-Daten sind für
diesen Nachweis nicht erforderlich.

## 16. Voraussichtlich betroffene Bereiche

Spark bestimmt die endgültigen Dateinamen nach Prüfung des Bestands. Der Scope
bleibt auf folgende Bereiche begrenzt:

- neue Workbench-Dateien unter `modules/virtual-electronics-lab/`,
- Übergangsadapter und Navigation des öffentlichen Elektroniklabors,
- Styles des öffentlichen Elektroniklabors,
- enge statische Identity-Route für ausdrücklich benötigte Workbench-Assets,
- gezielte Tests des Elektroniklabors und der Identity-Route,
- diese Spezifikation, die Elektroniklabor-Dokumentation und gegebenenfalls
  der nach Implementierung bestätigte Graphnachweis.

Andere Plattform-, Identity-, Projekt-, KI- oder Persistenzfunktionen werden
nicht verändert.

## 17. Dokumentation und Graph nach der Umsetzung

Vor der Implementierung bleibt diese Datei eine kontrollierbare
Spezifikation. Sie allein ändert die kanonische Graphwahrheit nicht.

Nach erfolgreicher Implementierung muss Spark prüfen und dokumentieren:

- welcher Teil des Durchstichs tatsächlich umgesetzt wurde,
- ob der Zielarchitektur-Entwurf weiterhin stimmt,
- welchen lokalen Sicherheitsnachweis die kontrollierte Runtime besitzt,
- welche Requirement-, Implementation- und Test-Artefakte in den
  SQLite-Graphen aufgenommen werden müssen,
- ob die zentrale Prozess-UML unverändert bleiben kann, weil kein neuer
  Prozess entstanden ist,
- ob die Offline-Architekturdokumentation neu erzeugt werden muss.

Ein Graphstatus `implemented` darf erst nach grünem Nachweis gesetzt werden.

## 18. Arbeitsauftrag für Spark

Der spätere Spark-Auftrag lautet:

> Implementiere ausschließlich `ELAB-DS-001` aus
> `docs/virtual-electronics-lab-gpio-led-vertical-slice-spec.md`.
> Bewahre alle nicht genannten Bestandsfunktionen. Triff keine offene
> Architekturentscheidung still im Code. Implementiere keine der unter
> `Nicht enthalten` genannten Funktionen. Verwende keine freie oder
> `eval`-basierte Codeausführung. Führe alle in der Spezifikation benannten
> Tests aus. Prüfe am Ende Graph-, Sicherheits- und
> Dokumentationsauswirkungen. Starte oder restarte keine Dienste ohne
> nachgewiesene Notwendigkeit. Deploye, stage, committe und pushe nicht.

Spark beendet den Auftrag mit einer offenen Frage, wenn die Spezifikation an
einer notwendigen Stelle keine eindeutige Entscheidung enthält. Spark darf
den Scope nicht selbst erweitern.
