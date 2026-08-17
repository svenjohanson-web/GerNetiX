# Lastenheft-Entwurf: GerNetiX Elektroniklabor

Stand: 2026-08-16  
Status: Arbeitsentwurf, noch nicht fachlich beschlossen

Dieser Entwurf fasst das aktuelle Produkt-Brainstorming zusammen. Er beschreibt
noch keine verbindliche Architekturentscheidung und ist keine parallele
fachliche Quelle zum SQLite-Graphen. Vor der Umsetzung werden bestätigte
Anforderungen, Produktgrenzen und Beziehungen in den Graphen übernommen.

Weiterführende Arbeitsdokumente:

- [Zielarchitektur-Entwurf](virtual-electronics-lab-target-architecture-draft.md)
- [Codex-Arbeitsanweisung für die schrittweise Umsetzung](codex-virtual-electronics-lab-implementation-procedure.md)
- [Spezifikation des ersten GPIO-LED-Durchstichs](virtual-electronics-lab-gpio-led-vertical-slice-spec.md)

## 1. Produktziel

GerNetiX soll ein virtuelles Elektroniklabor anbieten, in dem Nutzer
Elektronik verstehen, Messmittel bedienen, Mikrocontroller programmieren,
Fehler suchen und eigene Embedded-Anwendungen entwickeln können.

Der Übergang vom virtuellen zum echten Labor soll möglichst klein sein. Der
Nutzer soll virtuell dieselben fachlichen Arbeitsschritte ausführen, die später
auch an realer Hardware notwendig sind.

Leitgedanke:

> GerNetiX simuliert nicht nur Ergebnisse, sondern den praktischen Weg vom
> Aufbau über die Programmierung bis zur Messung und Fehlersuche.

## 2. Abgrenzung zu Lernprojekten

Lernprojekte besitzen einen festgelegten Lernweg, Lernziele, Erklärungen,
Aufgaben und einen Abschluss. Vereinfachte Bedienelemente dürfen dort gezielt
eingesetzt werden, wenn sie dem jeweiligen Lernziel dienen.

Das Elektroniklabor ist dagegen ein offener Experimentierraum. Es bietet
vorbereitete oder frei erstellte Schaltungen, realistische Bedien- und
Messabläufe, Mikrocontrollercode, freie Veränderungen und systematische
Fehlersuche.

Lernprojekte dürfen vorbereitete Versuche im Elektroniklabor öffnen. Nach einer
geführten Aufgabe soll der Nutzer die Schaltung frei weiterbearbeiten können.

## 3. Vorgesehene Einstiege

Die folgenden vier Bereiche bilden das aktuelle Ordnungsmodell. Sie sind
Einstiege nach Nutzerabsicht und keine getrennten technischen Systeme. Die
Architektur darf die Anzahl und Anordnung dieser Einstiege nicht fest
verdrahten.

### 3.1 Umgang mit Messmitteln

Der Nutzer lernt die Bedienung virtueller Messgeräte:

- Multimeter
- Oszilloskop
- Frequenzzähler
- Logikanalysator
- Labornetzteil
- LCR-Meter
- Spektrumanalysator
- VNA

Die Schaltung oder Signalquelle wird vorgegeben. Das jeweilige Messgerät, sein
korrekter Anschluss und die Interpretation der Messung stehen im Mittelpunkt.

### 3.2 Grundschaltungen

Der Nutzer untersucht vorbereitete, frei veränderbare Versuchsaufbauten, zum
Beispiel:

- LED mit Vorwiderstand
- Spannungsteiler
- RC- und RLC-Schaltungen
- Taster, Pull-up und Kontaktprellen
- Transistor und MOSFET als Schalter
- PWM-gesteuerte LED
- ADC- und DAC-Anwendungen
- PT1000-Messschaltung
- Strommessung über Shunt
- einfache Stromregelung
- Logikgatter und digitale Steuerbausteine
- UART-, SPI- und I²C-Verbindungen

Schaltung und passende Messgeräte werden vorbereitet, bleiben aber frei
veränderbar.

### 3.3 Fehlersuche und Hardware-Inbetriebnahme

Der Nutzer erhält eine fehlerhafte Schaltung und zunächst nur ein beobachtbares
Symptom. Er soll Hypothesen bilden, Messgeräte auswählen, Messpunkte setzen,
Ergebnisse interpretieren, den Fehler korrigieren und die Reparatur prüfen.

Mögliche Fehlerfälle sind:

- fehlende Masse oder Leitungsunterbrechung
- Kurzschluss oder falscher Bauteilwert
- verpolte LED oder Diode
- überlasteter GPIO
- fehlender Pull-up oder Pull-down
- falsche Busadresse, Baudrate oder Taktfrequenz
- vertauschte Kommunikationsleitungen
- ungeeignete Versorgung oder Versorgungseinbruch
- Tasterprellen und Sensorrauschen
- instabiler ADC-Wert
- thermische Überlastung

### 3.4 Freie Elektroniksimulation

Der Nutzer kann auf drei Wegen beginnen:

1. mit einer leeren Laborfläche,
2. mit einer frei veränderbaren Vorlage,
3. mit einer Beschreibung seines Vorhabens an die KI.

Vorlagen sind keine festen Lektionen. Sie dürfen verändert, kombiniert und als
Ausgangspunkt eigener Laborprojekte gespeichert werden.

Ein Versuchsaufbau kann für mehrere Einstiege verwendet werden. Eine
PWM-LED-Schaltung kann beispielsweise Grundschaltung, Oszilloskopübung,
Fehlersuchfall und Vorlage für die freie Simulation sein.

## 4. Gemeinsame Laboroberfläche

Alle Bereiche sollen möglichst dieselbe Grundoberfläche verwenden:

- zentrale Schaltungsfläche
- Bauteil- und Vorlagenbibliothek
- virtuelle Spannungsversorgung und Laborgeräte
- virtueller Mikrocontroller
- Quellcode-Editor
- serielle Konsole
- Umgebungssteuerung
- Mess-, Warnungs- und Ergebnisansicht
- kontextbezogene KI-Seitenleiste

Schaltung, Code, Messgeräte, Umweltparameter und Messpunkte sollen beim Wechsel
eines kompatiblen Modus erhalten bleiben.

Die Gestaltung soll modern und als Elektroniklabor erkennbar sein. Netlists,
Solveroptionen und andere SPICE-Details gehören in eine optionale
Expertenansicht und bestimmen nicht die primäre Bedienung.

## 5. Realistische Ursache-Wirkungs-Kette

Das Labor darf keine technisch unrealistischen Abkürzungen verwenden.

PWM wird im freien Labor nicht als frei einstellbarer Signalblock eingefügt.
Der fachlich sichtbare Signalweg lautet:

```text
Quellcode
-> Timer-/PWM-Peripherie des Mikrocontrollers
-> Mikrocontroller-Pin
-> elektrische Schaltung
-> Messgerät oder Verbraucher
```

Frequenz und Tastgrad werden verändert durch:

- Änderung des Quellcodes,
- ein vom Programm verarbeitetes serielles Kommando,
- einen angeschlossenen Taster, Drehgeber oder ein Potentiometer.

Die Kommandozeile darf keine magische Hintertür in die Simulation sein. Ein
Kommando wirkt nur, wenn der ausgeführte Mikrocontrollercode es verarbeitet.

Direkte Drehknöpfe gehören zu Geräten und Komponenten, die sie auch real
besitzen, zum Beispiel Labornetzteil, Signalgenerator, Oszilloskop,
Potentiometer oder simulierte Umweltgröße.

## 6. Virtueller Mikrocontroller

GerNetiX benötigt einen generischen virtuellen Mikrocontroller, zunächst aber
keine vollständige Emulation einer realen ESP32-CPU oder ihrer Binärfirmware.

Das Funktionsmodell soll unterstützen:

- GPIO einschließlich Pull-up und Pull-down
- ADC und DAC
- PWM und Timer
- Interrupt-Ereignisse
- UART, SPI und I²C
- Variablen und Grundrechenarten
- Bedingungen und Zustandsautomaten
- einfache Regelalgorithmen
- Watchdog- und Reset-Ereignisse

Reale Mikrocontrollerprofile können später Eigenschaften wie Betriebsspannung,
Pinanzahl, ADC-Auflösung, Stromgrenzen und vorhandene Peripherie vorgeben.
Intern bleibt die Ausführung ein kontrolliertes GerNetiX-Funktionsmodell.

Die analoge beziehungsweise Mixed-Signal-Simulation und die
Mikrocontrollerlogik müssen zeitlich gekoppelt werden: Ausgänge verändern die
Schaltung, der Solver berechnet Spannungen und Ströme, Eingänge und ADC tasten
diese Ergebnisse ab und der Programmablauf aktualisiert anschließend die
Ausgänge.

## 7. Quellcode-Editor und Konsole

Das Labor benötigt einen kompakten Editor für einen kontrollierten,
Arduino-ähnlichen Sprachumfang.

Vorgesehene Funktionen sind:

- Syntaxhervorhebung und Zeilennummern
- einfache Autovervollständigung
- verständliche Syntax- und Typfehler
- Start, Pause und Reset
- später Einzelschritt und Haltepunkte
- Variablen- und Peripherieanzeige
- Ereignis- und Interruptanzeige
- virtuelle serielle Konsole
- Bezug zwischen ausgeführtem Code und Messsignalen

Der Code läuft in einem sicheren, deterministischen Rechenwerk und nicht als
beliebiger nativer C++-Code.

## 8. Komponentenmodell

GerNetiX bildet funktionale Komponenten und keine vollständige Bibliothek
realer Herstellerbauteile ab.

### 8.1 Analoge Grundbauteile

- Widerstand, Kondensator und Spule
- Potentiometer
- Diode und LED
- Taster und Schalter
- Transistor und MOSFET
- einfacher Operationsverstärker
- Spannungs- und Stromquelle
- Last- und Shunt-Widerstand
- vereinfachte Regler- und Treibermodelle

### 8.2 Logik und digitale Steuerung

- Inverter und Schmitt-Trigger
- AND, OR, NAND, NOR und XOR
- Buffer, Tri-State und Open-Drain
- Flipflop und Latch
- Zähler und Schieberegister
- Multiplexer und Demultiplexer
- Pegelübersetzer
- Watchdog
- Reset-, Brownout- und Spannungsüberwachung

Gate Driver Units gehören nicht zu den Logikgattern, sondern in den Bereich
Treiber und Leistungselektronik. Dazu zählen Low-Side-, High-Side-, Halbbrücken-
und H-Brücken-Treiber sowie später Bootstrap- und Totzeitmodelle.

### 8.3 Displays und virtuelle Geräte

Vereinfachte Funktionsmodelle können vorgesehen werden für:

- LED und RGB-LED
- Siebensegmentanzeige
- Zeichenanzeige
- einfaches SPI- oder I²C-Display

Diese Geräte reagieren auf Versorgung, Anschlüsse und Kommunikation. Ihre
interne Elektronik muss nicht vollständig analog simuliert werden.

## 9. Sensoren und Umweltgrößen

Sensoren sollen über physikalische Umweltgrößen bedient werden und nicht nur
über direkt eingegebene elektrische Ersatzwerte.

Mögliche Umweltgrößen sind:

- Temperatur
- Helligkeit
- Druck und Feuchtigkeit
- Entfernung
- Magnetfeld
- Position
- Laststrom

Beim PT1000 stellt der Nutzer die Temperatur ein. GerNetiX berechnet daraus den
Sensorwiderstand und die gesamte nachfolgende Messkette:

```text
Temperatur
-> Sensorwiderstand
-> Messspannung
-> ADC-Wert
-> berechnete Temperatur
```

Umweltgrößen sollen statisch und als zeitlicher Verlauf vorgegeben werden
können.

## 10. Simulation und SPICE

SPICE soll bereits im Basic-Umfang verfügbar sein. Der Umfang verwendet
generische, geprüfte Funktions- und Lernmodelle, nicht eine umfassende
Herstellerbibliothek.

Der geplante Grundumfang umfasst:

- passive Grundbauteile und Quellen
- vereinfachte Dioden-, Transistor- und MOSFET-Modelle
- DC-Arbeitspunkt
- Transientenanalyse
- einfache AC-Analyse
- Netlist-Anzeige und Export

GerNetiX konkurriert nicht mit KiCad oder LTspice bei realer Bauteilauswahl,
Footprints, PCB-Entwicklung oder herstellerspezifischen Modellen. GerNetiX
simuliert Funktionen, Zusammenhänge und Inbetriebnahme. KiCad übernimmt den
konkreten Schaltungs- und PCB-Entwurf mit realen Bauteilen.

SPICE-Ergebnisse müssen klar zwischen idealisiertem Lernmodell, berechnetem
Wert, Schätzung und nicht geprüfter Eigenschaft unterscheiden.

## 11. Energie- und Wärmebetrachtung

Das Labor soll Strom- und Leistungsbudgets nachvollziehbar berechnen können.
Zu betrachten sind mindestens:

- Eingangs- und Ausgangsspannungen
- typischer und maximaler Strom
- Verlustleistung und Wirkungsgrad
- Strom- und Spannungsreserven
- geschätzte Temperaturerhöhung

Für einen linearen Regler gilt beispielsweise:

```text
PVerlust = (Vin - Vout) * I
```

Bei ungeeigneter Verlustleistung darf die KI begründet eine funktionale Buck-,
Boost-, Buck-Boost- oder SEPIC-Lösung vorschlagen. Thermische Aussagen sind als
Schätzung zu kennzeichnen, solange Gehäuse, Kühlung und PCB-Aufbau nicht
ausreichend bekannt sind.

## 12. KI-Unterstützung

Die KI soll in allen Laborbereichen erreichbar sein. Ihre Rolle hängt vom
Kontext ab:

- Mess-Coach bei der Bedienung von Instrumenten
- Elektronik-Tutor bei Grundschaltungen
- Fehlersuch-Coach bei Inbetriebnahmefällen
- Entwicklungsassistent in der freien Simulation

Die KI erhält einen strukturierten Kontext aus Schaltung, Code,
Mikrocontrollerzustand, Messgeräten, Messwerten, Umweltbedingungen und
Warnungen. Sie soll keine Messergebnisse erfinden und Annahmen nicht als
Simulationsergebnisse darstellen.

Vorgesehene Unterstützungsstufen sind:

- Hinweis
- erklären
- nächste Messung oder Änderung vorschlagen
- Lösung vormachen
- bestätigte Änderung ausführen

Im Lern- und Fehlersuchkontext darf die KI die Lösung nicht ungefragt
vorwegnehmen. Schaltungs- und Codeänderungen werden zunächst als Vorschau
gezeigt und erst nach Bestätigung angewendet.

## 13. Zugang, Tarife und KI-Credits

Laborzugriff und KI-Verbrauch werden getrennt gesteuert.

- Frei: öffentliche Messübungen und ausgewählte Versuche
- Basic: grundlegende echte SPICE-Simulation, erweiterte Vorlagen und
  gegebenenfalls gespeicherte Laborstände
- Premium: umfangreichere Vorlagen, Fehlersuchfälle, freie Projekte und
  Projektintegration
- KI: echte Provideraufrufe benötigen unabhängig vom Tarif verfügbare Credits

Deterministische Berechnungen und normale SPICE-Simulationen verbrauchen keine
KI-Credits.

Die technische Freigabe erfolgt über konkrete SystemCapabilities und
Vorlagenmetadaten, nicht über fest codierte Tarifnamen. Dadurch kann die
Produktzuordnung später geändert werden, ohne die Laborlogik umzubauen.

Premium soll nicht mit professionellen Hersteller-SPICE-Modellen oder einem
Ersatz für LTspice begründet werden. Der Mehrwert liegt in Anwendungsfällen,
Fehlersuche, Projektkomfort, freier Kombination und Integration.

## 14. Übergang zum realen Labor

Entscheidend ist Arbeitsrealismus, nicht Fotorealismus. Der Nutzer soll auch
virtuell:

- Versorgung und Stromgrenze einstellen,
- Masse bewusst verbinden,
- Messleitungen an Schaltungsknoten setzen,
- für eine Strommessung den Strompfad öffnen,
- Tastkopf, V/div, Zeit/div und Trigger einstellen,
- Mikrocontrollercode schreiben und starten,
- serielle Kommandos implementieren und senden,
- Taster, Potentiometer und Drehgeber bedienen,
- Fehler durch Messungen eingrenzen.

Jede geeignete Laborvorlage soll eine Realitätsbrücke besitzen mit:

- Anschluss- und Messplan
- erwarteten Größenordnungen und Toleranzen
- sicherer Einschaltreihenfolge und Strombegrenzung
- kritischen Masse- und Messanschlüssen
- übertragbarem Quellcode
- sichtbaren Unterschieden zwischen Simulation und Wirklichkeit

Bauteiltoleranzen, Kontaktfehler, Rauschen, parasitäre Effekte und Erwärmung
dürfen nicht verschwiegen werden.

## 15. Übernahme und Änderung des vorhandenen Labors

### 15.1 Übernehmbar

- öffentliche Laborroute und gemeinsame Gestaltung
- Hell-/Dunkelmodus und responsive Darstellung
- Oszilloskopdarstellung, Trigger, Cursor, XY, FFT und Frequenzzähler
- Multimeter, Messleitungen und Fehlanschlusserkennung
- Filterberechnungen und Bode-Darstellung
- CV-/CC-Modell des Labornetzteils
- LCR-, Logikanalysator-, Spektrum- und VNA-Lernmodelle
- Radiolabor als spezialisierter Anwendungsfall
- vorhandene Tastaturbedienung und Contract-Tests

### 15.2 Anzupassen

- Instrumente erhalten Eingangssignale aus einer gemeinsamen Schaltung.
- Das Oszilloskop erzeugt seine Messsignale nicht mehr ausschließlich selbst.
- Das Multimeter misst beliebige Knoten statt nur fest eingebauter Schaltungen.
- Das Netzteil speist einen gemeinsamen Versuchsaufbau.
- Der Logikanalysator erhält Signale des virtuellen Mikrocontrollers und
  angeschlossener Geräte.
- Fest eingebaute Schaltungen werden zu wiederverwendbaren Laborvorlagen.
- Mehrere Instrumente können gleichzeitig verwendet werden.

### 15.3 Neu erforderlich

- gemeinsames Schaltungs-, Pin- und Verbindungsmodell
- zentrale Simulationszeit und Ereignissystem
- frei kombinierbare Komponenten und Messpunkte
- virtueller Mikrocontroller und kontrolliertes Rechenwerk
- Quellcode-Editor und serielle Konsole
- Sensor- und Umweltmodelle
- Fehlerdefinitionen und verdeckte Fehlerzustände
- Vorlagen- und Anwendungsfallkatalog
- strukturierter KI-Kontext und bestätigungspflichtige KI-Aktionen
- optional gespeicherte Laborprojekte
- SPICE-Adapter als zusätzlicher Rechenkern

## 16. Empfohlene Umsetzung

1. Produktgrenzen, Zugriff und die aktuelle Einstiegsstruktur bestätigen.
2. Vorhandene Instrumente in wiederverwendbare Komponenten überführen.
3. Gemeinsames Schaltungs-, Mess- und Simulationsmodell definieren.
4. Einen vollständigen vertikalen Anwendungsfall „LED am Mikrocontroller mit
   PWM“ umsetzen.
5. Taster, RC-Glied, MOSFET, Shunt, PT1000, ADC und DAC ergänzen.
6. UART, SPI, I²C und vereinfachte virtuelle Geräte ergänzen.
7. Verdeckte Fehlerfälle und den Fehlersuchablauf aufbauen.
8. KI zunächst als kontextbezogenen Coach anbinden.
9. Freie KI-gestützte Entwicklung aus leerem Labor, Vorlage oder Beschreibung
   ergänzen.
10. SPICE als zusätzlichen Rechenkern anbinden und den Export vorsehen.

Der erste vertikale Nachweis lautet:

> Der Nutzer programmiert im virtuellen Mikrocontroller eine PWM, misst sie am
> Pin, steuert damit eine LED und diagnostiziert Code- oder Schaltungsfehler mit
> virtuellen Messmitteln.

## 17. Offene Entscheidungen

- endgültige Benennung und Anzahl der sichtbaren Einstiege
- Grenze zwischen öffentlichem Labor und angemeldetem Projektlabor
- konkreter Basic- und Premiumumfang
- Verfügbarkeit echter KI im anonymen Bereich
- Sprache und Umfang des kontrollierten Mikrocontroller-Rechenwerks
- Persistenz- und Versionsmodell für Laborprojekte
- Ausführungsort und Isolationsgrenze des SPICE-Solvers
- Umfang der KiCad- beziehungsweise Netlist-Übergabe
- erste verbindliche Auswahl von Laborvorlagen und Fehlersuchfällen

Diese Punkte werden vor ihrer Umsetzung als Entscheidungen und Requirements in
den SQLite-Graphen übernommen.
