# Virtuelles Elektroniklabor

## Ziel

Das virtuelle Elektroniklabor ist ein frei erreichbarer GerNetiX-Bereich zum
Ausprobieren, Beobachten und Verstehen. Es ist kein Nachbauprojekt: Es benötigt
keine Hardware, keine Anmeldung und keine Installation. Sein Zweck ist, den
praktischen Lernansatz der Plattform vor einem Kauf oder Login erlebbar zu
machen und in passende Wissenskapitel sowie Lernprojekte zu führen.

Der erste Baustein heißt **Durchstich** als gemeinsamer Einstieg in die neue
Quellcode-orientierte Architektur. Anschließend folgen bestehende
Messwerkzeuge wie Oszilloskop und Signalgenerator in derselben Laborumgebung.

## Produktgrenze

| Gehört dazu | Gehört nicht dazu |
| --- | --- |
| deterministische Simulation elektrischer Signale und idealisierter Schaltungen | Nachbauanleitung, Teileliste oder Firmware-Download |
| Interaktive Mess- und Einstellübungen | Anschluss an reale Geräte, USB, WebSerial oder Flashen |
| Öffentliche, anonyme Labornutzung ohne Speicherung; optionale KI-Hilfe nach Anmeldung und Creditprüfung | Projektpersistenz, Telemetrie oder KI-Zwang |
| Verweise in Wissensportal und Lernbereich | Ersatz für Sicherheitsunterweisung oder reale Messpraxis |

Das Labor ist eine statische öffentliche Browseranwendung, ausgeliefert durch
den Identity Server unter einem eigenen Pfad, zum Beispiel
`/technik-labs/`. Simulation, Fehlersuche, Auswahl und Einstellungen benötigen
keinen eigenen Serverprozess, keine Datenbank und keinen API-Aufruf; sie bleiben
im flüchtigen Browserzustand. Nur die optionale KI-Hilfe ruft nach Anmeldung den
Identity-Endpunkt `POST /api/platform/electronics-lab/assistant` auf und wird
über AI Usage an verfügbare Credits gebunden.

Die Umsetzung liegt als eigenständiges Modul unter
`modules/virtual-electronics-lab/`. Identity bindet dieses Modul ausschließlich
als statische öffentliche Route ein. Die Labor-Shell und jedes Messgerät sind
eigene ES-Module; dadurch bleibt die Weiterentwicklung eines Instruments von
Identity, Konten und den anderen Labs getrennt.

## Laborübersicht

| Lab | Lernziel | Erste Ausbaustufe |
| --- | --- | --- |
| Durchstich: Programm → GPIO 5 → LED → Oszilloskop | Gemeinsamer Einstieg: Quellcode wird über typisierten Befehlspfad in MCU, GPIO, Schaltung und Messgerät übertragen | `pinMode`/`digitalWrite`, codegesteuerte PWM, LED-Puls-/Mittelstrom und angeschlossenes CH1-Oszilloskop |
| Freie Elektronik-Simulation | Bauteile, Netze, Parameter und Messwerte kreativ in derselben Laborumgebung verändern | versioniertes CircuitDocument, typisierte Commands und linearer DC-Arbeitspunkt für GND, ideale Spannungsquellen und Widerstände |
| Oszilloskop, Signalgenerator und Frequenzzähler | Signale sichtbar machen und Messgeräte bewusst einstellen | zwei Generatorausgänge, Zweikanal-Oszilloskop, Frequenzzähler, XY-Modus und FFT-Ansicht |
| Filterlabor | analoge Filter auslegen und mit Wechselspannung vermessen | Sinusquelle, Zweikanal-Zeitbild, Frequenz-Sweep und Bode-Diagramm für RC- und RLC-Filter |
| Radiolabor | AM- und FM-Empfang vom modulierten Signal bis zum Ton verstehen | AM-Hüllkurvendemodulator, FM-Superhet mit 10,7-MHz-ZF und freischaltbare Stationsansage |
| Multimeter und einfache Schaltungen | Spannung, Strom, Widerstand und Massebezug richtig messen | idealisierte Kleinspannungsquellen, Widerstände, LED, Taster |
| Labornetzteil | Konstantspannung, Strombegrenzung und Last verstehen | Sollspannung, Stromgrenze, Widerstandslast, CV-/CC-Umschaltung |
| LCR-Meter | Widerstand, Kapazität, Induktivität und Frequenzabhängigkeit verstehen | Impedanzbetrag, Phase und Serienverlust |
| Logikanalysator | digitale Protokolle und Timing lesen | UART, I²C und SPI mit vereinfachtem Decoder |
| Spektrumanalysator | Oberwellen, Filter und Rauschen im Frequenzbereich verstehen | vereinfachtes Lernmodell für Grundschwingung, Harmonische, RBW und Rauschboden |
| VNA · Netzwerkanalysator | Anpassung, Reflexionen, Filter und Antennen verstehen | Lernmodell mit S11, S21 und Smith-Diagramm |

Die Labs teilen keine versteckte Simulationslogik. Ein gemeinsamer,
deterministischer Signalkern erzeugt aus eindeutig sichtbaren Parametern
Abtastwerte. Jedes Werkzeug interpretiert diese Werte entsprechend seiner
Messgrenze.

## Erstes Lab: Durchstich und Oszilloskop-Übergang

Der implementierte Durchstich startet bewusst mit einer statischen GPIO-Ausgabe.
Ein vorbereitetes PWM-Beispiel erweitert denselben Aufbau, ohne ein frei
parametriertes PWM-Bauteil einzuführen. Frequenz und Tastgrad entstehen aus dem
Quellcode des virtuellen Mikrocontrollers. Das kompakte CH1-Oszilloskop misst
den gemeinsamen Trace erst, nachdem Tastkopfspitze und Masseklemme an die
sichtbaren Messpunkte angeschlossen wurden. Reset stellt stets den Startcode
des aktuell geladenen Beispiels wieder her.

Das zugrunde liegende `LabProject` enthält versionierte Metadaten, Schaltung,
Controller-Quellcode, Modellversionen, Instrumente und Messpunkte. Änderungen
an Instrumentenanschlüssen laufen ausschließlich über Commands; ausgegebene
Snapshots sind defensive Kopien. Damit bleibt der Schritt zu einer späteren
Projektpersistenz vorbereitet, ohne im öffentlichen Labor bereits Daten zu
speichern.

### Getestete Modellbausteine für die nächsten Durchstiche

Unter den sichtbaren GPIO-/PWM- und PT1000-Durchstichen arbeiten folgende
getestete Rechenkerne:

- PT1000-Kennlinie von `-200 °C` bis `850 °C`,
- linearer DC-Arbeitspunkt-Solver für Widerstände sowie ideale Gleichspannungs-
  und Gleichstromquellen,
- idealisierter ADC-Quantisierer mit Referenzspannung und 1 bis 24 Bit,
- idealisiertes Tastermodell mit Pull-up, Pull-down und unabhängig wählbarer
  Kontaktreferenz nach GND oder VCC; eine Betätigung ohne Pegeländerung wird
  deterministisch als Warnung ausgewiesen,
- integrierte PT1000-Messkette aus Sensor, Spannungsteiler, DC-Solver und ADC,
- kontrollierte Virtual-MCU-ADC-Programmlaufzeit für `pinMode(A0, INPUT)` und
  `adcValue = analogRead(A0)` ohne native Ausführung von Nutzerquellcode,
- kontrollierte Virtual-MCU-Digitaleingangs-Programmlaufzeit für Pin `4` mit
  `INPUT_PULLUP`, `INPUT_PULLDOWN`, `INPUT` und `digitalRead(4)`,
- deterministisches Floating-Eingangsmodell mit einer ausdrücklich
  idealisierten Samplefolge für fehlende Pull-Widerstände,
- deterministisches Tasterprellmodell mit expliziter virtueller Mikrosekunden-
  Zeit und einer begrenzten, versionierten digitalen Messspur,
- deterministischer Entprellkern und kontrollierte Virtual-MCU-Runtime, bei der
  `debounceUs` im realitätsnahen Mikrocontroller-Startcode geändert wird,
- Taster-Programmdurchstich-Runtime, die den Quellcode-Pull-Modus über das
  idealisierte Tastermodell bis zu `buttonState` führt und über einen
  typisierten Command automatische, GND- oder VCC-Kontaktverdrahtung sowie
  command-basiert fortgeschaltete Floating-Samples abbildet,
- PT1000-Programmdurchstich, der Umgebungstemperatur, Messkette und
  Virtual-MCU-Quellcode über eine kontrollierte Command-Runtime verbindet,
- idealisierte LED-Stromrücklesung aus vorhandenem PWM-Stromtrace,
  10-Ω-Shunt und gemeinsamem 12-Bit-ADC-Quantisierer,
- kontrollierte LED-Regelprogramm-Runtime mit Quellcode-Sollwert,
  proportionalem Regelschritt, begrenztem PWM-Tastgrad und ausschließlich
  virtueller Zeit.

Bei `0 °C`, `3,3 V`, einem Festwiderstand von `1000 Ω` und 12 Bit liefert die
integrierte Messkette `1000 Ω`, `1,65 V` und ADC-Code `2048`. Der sichtbare
Bedienablauf erlaubt Umgebungstemperatur und Controller-Quellcode zu ändern,
zeigt Schaltung und Messwerte und verweist auf den Übergang zum echten Labor.

Der sichtbare Taster-Durchstich verbindet Quellcodeeditor, internen Pull-up
oder Pull-down, GPIO `4` und den Tasterzustand. Drücken oder Lösen führt die
kontrollierte Simulation erneut aus. Das Schaltbild hebt den aktiven
Pull-Zweig und bei gedrücktem Taster den passenden Gegenpol hervor; Pegel und
`buttonState` stammen ausschließlich aus der gemeinsamen Runtime.
Die Runtime kann den Kontakt zusätzlich bewusst an denselben Pegel wie den
Pull-Widerstand legen. Beim Drücken bleibt der Eingang dann unverändert und
liefert die stabile Warnung `BUTTON_CONTACT_NO_LEVEL_CHANGE`; dies ist der
maschinengeprüfte Kern der sichtbaren Fehlersuchaufgabe. Im vorhandenen
Tasterlabor kann der Nutzer zwischen freiem Prüfen und Fehlersuche wechseln,
die falsche Verbindung nach `3,3 V` beobachten, den Kontakt nach `GND`
umverdrahten und die Reparatur durch `LOW` beziehungsweise `buttonState = 0`
bestätigen. Reset stellt den ursprünglichen Fehlerfall wieder her.

Ein zweiter Fehlerfall startet mit `INPUT` ohne Pull-Widerstand. Wiederholte
Messungen zeigen die feste Floating-Folge; erfolgreich ist die Aufgabe erst,
wenn `INPUT_PULLUP` im Quellcode ergänzt und sowohl der offene HIGH- als auch
der gedrückte LOW-Zustand gemessen wurde. Der dritte Fehlerfall zeigt
Tasterprellen als gemeinsame digitale Messspur. Cursor, Rohflankenzahl,
entprellte Programmflanken und der stabile Wert ab `1.800 µs` lesen dieselbe
virtuelle Zeitbasis; die Ansicht verweist auf Massebezug und aufbauabhängige
Prellzeiten im echten Labor.

Die Prellansicht zeigt Rohkontakt und entprellten Programmwert auf gemeinsamer
Zeitachse. Zwei Fehlerfälle starten mit `300 µs` beziehungsweise `2.000 µs`;
der Nutzer repariert ausschließlich den Quellcode und bestätigt den Erfolg an
Flankenanzahl und Verzögerung. Die Zahlen gelten nur für das Lehrprofil.

Der KI-Vertrag minimiert den Labor-Snapshot und akzeptiert nur Erklärungen,
Messvorschläge oder ausdrücklich bestätigungspflichtige Reparatur-Diffs aus
einer kleinen Command-Allowlist. Standalone-Entwicklung verwendet sichtbare,
netzwerkfreie Fixtures. Unter `/technik-labs/` nutzt die optionale Live-Hilfe
einen sessiongebundenen Identity-Endpunkt mit Credit-Preflight, Structured
Output, `store: false` und erneuter serverseitiger Vertragsvalidierung. Kein
Vorschlag wird automatisch angewandt; die Fehlersuche bleibt ohne KI vollständig
nutzbar.

Das Template **LED-Strom per PWM regeln** bleibt in derselben GPIO-Laborfläche.
Es zeigt PWM-Spannung, Tastgrad, LED-Strom, Shunt-Spannung, ADC-Code,
Programm-Sollwert und die gemeinsame Strommessspur. Zwei vorbereitete
Fehlerfälle laden einen unerreichbaren Sollwert oder eine ungeeignete
Reglerverstärkung in den Editor; repariert wird ausschließlich im Quellcode.
Das Lernmodell weist ausdrücklich darauf hin, dass reale Leistungs-LEDs einen
geeigneten Treiber und eine thermische Auslegung benötigen.

Der direkte Aufruf der freien Simulationsfläche startet weiterhin mit einem
Spannungsteiler. Über die Vorlagenauswahl kann der Nutzer alternativ mit einer
leeren Laborfläche ohne Bauteile, Knoten oder Messpunkte beginnen. Der Nutzer
kann GND, DC-Quellen, Widerstände, Kondensatoren, Spulen, LEDs und Taster in ein
gemeinsames CircuitDocument aufnehmen, Ports verbinden und Parameter ändern.
Der aktuelle DC-Provider berechnet bewusst nur ideale Spannungsquellen und
Widerstände; andere Typen bleiben im Dokument sichtbar und liefern eine klare
Providerdiagnose. Ergebnisse stammen aus dem vorhandenen linearen
Arbeitspunkt-Solver und zeigen Knotenspannungen, Zweigströme und Leistungen.
Frei platzierbare Messpunkte bilden Prüfösen nach. Virtuelle Tastköpfe messen
die Differenz zwischen Plus- und Referenzspitze mit korrektem Vorzeichen. Sie
sind im ersten Modell ideal hochohmig; reale Eingangsimpedanz und
Tastkopfkapazität werden ausdrücklich noch nicht simuliert.
Schaltung, Messaufbau und Analysekonfiguration werden für die Auswertung als
versionierter `LabProject`-Slice validiert. DC- und Transientenprovider
veröffentlichen ihre Knotenspannungen in demselben typisierten
`MeasurementTrace`; die Tastkopfauswertung liest ausschließlich diese
gemeinsame Messspur und nicht unmittelbar eine eigene Solverwahrheit.
Ein gemeinsamer, auf 50 Änderungen begrenzter In-Memory-Verlauf stellt
Schaltungs- und Messaufbauzustand zusammen wieder her. Ungültige Commands
werden nicht historisiert; ein neuer Bearbeitungszweig verwirft den alten
Redo-Pfad.
Die begrenzte Transientenanalyse verwendet denselben linearen MNA-Kern mit
Backward-Euler-Integration. Sie unterstützt ideale DC-Quellen, R, C, L und
statische Tasterzustände bei höchstens 1.000 Zeitschritten. Das RC-Template
zeigt die differentielle Tastkopfmessung als Kurve; nichtlineare LEDs bleiben
außerhalb dieses Lernmodells. Eine mögliche ngspice-WASM-Erweiterung ist
technisch geprüft, wird aber erst nach reproduzierbarem Eigenbau, Lizenzprüfung
und Worker-/Ressourcenisolation übernommen.

Der providerneutrale Simulationsauftrag vereinheitlicht inzwischen
DC-Arbeitspunkt und Transientenanalyse. Derselbe normalisierte Auftrag kann
über die vorhandenen Lernsolver ausgeführt oder als deterministische
SPICE-Netlist für GND, ideale DC-Quellen, R, C und L exportiert werden.
Fachliche Knoten- und Komponenten-IDs bleiben im Export nachvollziehbar. LED,
Taster, AC-Analyse und Raw-SPICE sind weiterhin ausdrücklich nicht Bestandteil
dieses ersten Netlist-Vertrags.

Die darauf aufbauende lineare AC-Kleinsignalanalyse unterstützt logarithmische
Sweeps von 1 Hz bis 1 MHz für ideale Spannungsquellen, R, C und L. Der Auftrag
wählt eine vorhandene Spannungsquelle als AC-Anregung mit Amplitude und Phase.
Der komplexe MNA-Lernsolver liefert Knoten- und Zweigwerte als Realteil,
Imaginärteil, Betrag und Phase; derselbe Auftrag erzeugt im Export `AC` und
`.ac dec`. Höchstens 201 Frequenzpunkte sowie die Schaltungsgrenzen begrenzen
den Rechenaufwand. Das Modell bleibt linear und verwendet keine realen
Herstellerbauteile.

### Aufbau

Der Durchstich ist die neue gemeinsame Einstiegfläche und führt über ein vereinfachtes Laufzeitmodell
zu sichtbar berechnetem LED-Verhalten. Der Signalgenerator bleibt Teil des Oszilloskop-Labs
und ist kein eigenständiges Programm.
Er besitzt zwei Ausgänge, die direkt auf Kanal 1 und Kanal 2 gelegt werden.

```text
Generator Ausgang 1 ──────> Oszilloskop Kanal 1
Generator Ausgang 2 ──────> Oszilloskop Kanal 2

XY-Modus: Kanal 1 = X-Achse, Kanal 2 = Y-Achse
```

### Signalgenerator

Pro Ausgang stehen mindestens diese bewussten Einstellungen bereit:

- Signalform: Sinus, Rechteck, Dreieck, Gleichspannung und Rauschen.
- Frequenz, Amplitude und Gleichspannungs-Offset.
- Tastgrad für Rechtecksignale.
- Phasenverschiebung gegenüber dem anderen Ausgang.
- Zuschaltbares, begrenztes Rauschen für spätere Diagnoseübungen.

Generator und Oszilloskop zeigen Werte mit Einheiten. Das Lab erzeugt keine
irreführende reale Präzisions- oder Kalibrierbehauptung; es verwendet sichtbar
idealisierte Signalparameter.

### Frequenzzähler

Der Frequenzzähler gehört als drittes Messgerät direkt in dieses Lab. Er misst
wahlweise den Ausgang 1 oder Ausgang 2 des integrierten Signalgenerators und
zeigt Frequenz sowie, wo sinnvoll, Periodendauer an. Damit entsteht eine
wertvolle Vergleichsübung: Die Frequenz wird zunächst mit Zeit/div und Cursor
am Oszilloskop abgeschätzt und anschließend am Frequenzzähler überprüft.

Die Anzeige macht ihren Messbereich verständlich. Bei Gleichspannung, einem zu
kleinen Pegel, starkem Rauschen oder einem Signal außerhalb des vorgegebenen
Bereichs erscheint kein erfundener Zahlenwert, sondern eine konkrete Erklärung
wie „kein periodisches Signal erkannt“. Eine Auflösung in geeigneten Einheiten
(Hz, kHz, MHz) vermittelt, dass auch ein Frequenzzähler nicht beliebig genau
und unter allen Bedingungen messen kann.

### Zweikanal-Oszilloskop

Die erste Version enthält bewusst **keine Auto-Setup- oder Auto-Scale-Taste**.
Lernende müssen ein schlecht lesbares Signal selbst sinnvoll einstellen.

| Bereich | Bedienelemente |
| --- | --- |
| Kanal 1 und 2 | Ein/Aus, V/div-Drehknopf, vertikale Position, AC/DC-Kopplung, 1×/10×-Tastkopf |
| Horizontale Achse | Zeit/div-Drehknopf und horizontale Position |
| Trigger | Quelle Kanal 1/Kanal 2, steigende/fallende Flanke, Triggerpegel und Modustaste mit Leuchtanzeige für Auto/Normal/Single |
| Cursor | CURSOR-Taste für Zeit- und Spannungscursor; zwei direkt im Display verschiebbare Messlinien mit A, B, Δt, 1/Δt und ΔV |
| Darstellung | Zeitbereich mit beiden Kanälen oder XY-Modus |

Das Oszilloskop stellt nur den durch Zeitbasis, Vertikalskala und Trigger
definierten Ausschnitt dar. Ein Bild gilt didaktisch als lesbar, wenn das
Signal innerhalb der sichtbaren Messfläche liegt, mehrere Perioden oder die
relevante Flanke sichtbar sind und der Trigger die Darstellung stabilisiert.
Die Prüfung erklärt, was noch fehlt, statt nur richtig oder falsch zu melden.
Solange kein gültiges Triggerereignis gefunden wird, läuft die Signalspur
kontinuierlich über das Display. Erst mit passender Triggerquelle, Flanke und
passendem Pegel steht die Kurve stabil.
Display und kompaktes Frontpanel bleiben nebeneinander sichtbar, damit die
Auswirkung eines verstellten Drehknopfs unmittelbar beobachtet werden kann.
Nach dem Stabilisieren des Signals werden Periodendauer und Spitze-Spitze-
Spannung mit verschiebbaren Cursorn bestimmt. Die Cursor liefern die Differenz,
setzen sich aber nicht automatisch auf die richtigen Signalpunkte.

### XY-Modus und Lissajous-Figuren

Im XY-Modus wird Kanal 1 nicht über Zeit, sondern horizontal gegen Kanal 2
aufgetragen. Damit kann das Lab Lissajous-Figuren aus zwei Sinussignalen zeigen.
Die Lernenden verändern Frequenzverhältnis und Phase und beobachten direkt:

- gleiche Frequenz und gleiche Phase: Diagonale,
- gleiche Frequenz und 90 Grad Phasenversatz: Kreis oder Ellipse,
- kleine ganzzahlige Frequenzverhältnisse: geschlossene Mehrschleifenform,
- nicht passendes Verhältnis oder Drift: wandernde, nicht geschlossene Spur.

Die Beschriftung nennt stets Kanalzuordnung, Frequenzverhältnis und Phase.
Sie behauptet nicht, dass reale Oszilloskope jede Form ohne Trigger-,
Bandbreiten- oder Rauschgrenzen genauso darstellen.

## Didaktischer Ablauf

1. **Entdecken:** Ein vorbereiteter Messfall startet mit unlesbarer Darstellung.
2. **Einstellen:** Zeitbasis, V/div, Position und Trigger werden manuell
   gewählt.
3. **Erklären:** Nach einer lesbaren Messung erklärt das Lab genau die
   sichtbare Wirkung der jeweiligen Einstellung.
4. **Variieren:** Generatorparameter werden verändert und die Auswirkung wird
   vorhergesagt und geprüft.
5. **Vertiefen:** Ein Link führt zum konkreten Abschnitt im Wissensportal oder
   zu einem späteren praktischen Lernprojekt.

Erste Szenarien sind PWM mit variablem Tastgrad, zwei phasenverschobene
Sinussignale, Tasterprellen, ein verrauschtes ADC-Signal und ein kurzer
Versorgungseinbruch beim Schalten einer Last. Die letzten drei bleiben klar als
Simulation gekennzeichnet und ersetzen keine Sicherheits- oder Messübung an
einer realen Schaltung.

## Zweites Lab: Multimeter und einfache Schaltungen

Das Multimeter-Lab nutzt ausschließlich sichere, idealisierte
Kleinspannungsmodelle. Es zeigt eine sehr kleine Schaltung und lässt die
Messleitungen bewusst auswählen und anschließen.

Der interaktive Schaltplan zeigt Spannungsquelle, Leitungen, Vorwiderstand, LED
und das Multimeter mit roter und schwarzer Messleitung. Die Leitungen werden bis
zu den ausgewählten Knoten verfolgt. Für die Strommessung wird eine sichtbare
I+/I−-Messlücke geöffnet, die das Multimeter korrekt in Reihe schließen muss.

Die Schaltungssammlung enthält LED-Reihenschaltung, Spannungsteiler,
NPN-Transistorschalter, Emitterschaltung mit Arbeitspunkt, Wheatstone-
Messbrücke, Diodenschaltung und eine Leitungsunterbrechung. Die
Wheatstone-Brücke berechnet beide Mittelpunktspannungen aus R1 bis R4; eine
abgeglichene Brücke ergibt zwischen den Brückenmitten 0 V.

| Messart | Vermittelte Regel | Beispiel |
| --- | --- | --- |
| Spannung | parallel zwischen Messpunkt und Bezug messen | Spannung über Widerstand oder LED |
| Strom | Messgerät in Reihe einfügen | Strom durch LED mit Vorwiderstand |
| Widerstand/Durchgang | nur spannungsfrei messen | Widerstand prüfen, Leitungsunterbrechung finden |

Fehlerfälle sind didaktisch wichtig: vertauschte Messbuchse, Strommessung
parallel zur Quelle, fehlender Massebezug oder Widerstandsmessung an einer
aktiven Quelle. Das Lab sperrt keine Erklärung weg, sondern beschreibt die
Folge sachlich: In der Realität kann ein Sicherungseinsatz auslösen, ein
Messgerät beschädigt werden oder eine gefährliche Situation entstehen. Das
öffentliche Lab arbeitet nie mit Netzspannung, Hochstrom, Akku-Kurzschluss oder
einer Anleitung zum Umgehen von Schutzmaßnahmen.

## Filterlabor: Auslegung und Messtechnik

Filter werden nicht mit der Gleichspannungsquelle und dem Multimeter des
Multimeter-Labs vermessen. Das eigene Filterlabor verwendet eine einstellbare
Sinusspannungsquelle und zeigt Eingang und Ausgang gleichzeitig als virtuelle
Zweikanal-Messung. Ein logarithmischer Frequenz-Sweep erzeugt zusätzlich den
Amplitudengang im Bode-Diagramm.

Zur Auswahl stehen RC-Tiefpass, RC-Hochpass und ein Serien-RLC-Bandpass. R, C
und L sind einstellbar. Aus einer vorgegebenen Grenz- oder Resonanzfrequenz kann
das Labor den fehlenden Bauteilwert auslegen. Angezeigt werden Uein, Uaus,
Übertragung in dB, Phasenverschiebung sowie Grenz- oder Resonanzfrequenz. Damit
werden Auslegung und anschließende messtechnische Kontrolle in einem eigenen,
fachlich passenden Ablauf verbunden.

## Radiolabor: AM- und FM-Demodulation

Das Radiolabor beginnt mit den Spektren zweier gleichzeitig aktiver Sender.
Einer überträgt „Hallo GerNetiX“, der andere „Guten Tag GerNetiX“. Welche
Ansage zu welchem Spektrum gehört, wird erst beim Abstimmen und Anhören deutlich.
Die Spektrumsansicht zeigt Frequenz und Pegel beider Signale, während
der Demodulator-Ausgang im Zeitbereich bleibt und bei falscher Einstellung
weiterhin ein unbrauchbares Signal zeigt.

Die AM-Übung zeigt zwei Träger mit verschieden breiten Seitenbandspektren. Für
den gewählten Sender müssen Trägerabstimmung, HF-Bandbreite,
Dioden-Hüllkurvendemodulator und RC-Zeitkonstante zusammenpassen. Die FM-Übung
zeigt ebenfalls zwei Sender mit unterschiedlicher Mittenfrequenz, belegter
Bandbreite und Frequenzhub. Beide werden mit Hochseiten-Lokaloszillator,
Mischer, 10,7-MHz-Zwischenfrequenz, ZF-Filter, Begrenzer und
Frequenzdiskriminator empfangen.

Für den AM-Hüllkurvendemodulator zeigt das Labor eine RC-Einstellhilfe. Es gilt
`τ = R · C`: Die Zeitkonstante muss deutlich größer als die Trägerperiode, aber
deutlich kleiner als die kürzeste Periodendauer des Nutzsignals sein. Ein
angezeigtes Bauteilbeispiel ist `10 kΩ · 4,7 nF = 47 µs`. Ist `τ` zu klein,
bleibt Trägerwelligkeit übrig; ist `τ` zu groß, kann die Ausgangsspannung der
Sprachhüllkurve nicht schnell genug folgen.
Das Labor berechnet daraus für den gewählten Sender einen konkreten
Praxisbereich und bewertet den aktuellen Wert unmittelbar als „zu klein“,
„passend“ oder „zu groß“.

Die Aufgaben nennen Träger- beziehungsweise Mittenfrequenz und belegte
Bandbreite nicht vorab. Bei AM werden sie aus der Trägerlinie und den
symmetrischen Seitenbändern abgelesen. Bei FM werden Mittenfrequenz und belegte
Bandbreite aus dem Linienspektrum bestimmt. Aus der bekannten
10-kHz-Nutzbandbreite und der abgelesenen HF-Bandbreite wird der Frequenzhub mit
der Carson-Regel `B ≈ 2 · (Δf + fmax)` hergeleitet.

Nach erfolgreicher Demodulation erzeugt die Browser-Sprachausgabe die zum
gewählten Sender gehörende Stationsansage. Das Labor greift weder auf Mikrofon noch Antenne oder einen
realen Rundfunksender zu und überträgt keine Sprachdaten an die GerNetiX-
Anwendung.

Der Empfang kann in jeder Einstellung angehört werden. Bei großer
Abstimmabweichung ist nur bandbegrenztes Rauschen zu hören. In der Nähe der
richtigen Einstellung liegt die Stationsansage verzerrt unter dem Rauschen; mit
zunehmender Empfangsqualität wird sie deutlicher. AM erzeugt bei
Trägerabweichung zusätzlich einen abstimmungsabhängigen Pfeifton. Bei FM bildet
ein überproportional fallender Rauschanteil den typischen Quieting-Effekt beim
Einrasten des Senders nach.

## Sicherheit und Datenschutz

- Keine reale Hardwareansteuerung, keine USB-/Seriell-Schnittstelle und keine
  Übernahme von Browserdaten aus Geräten.
- Keine Eingabe persönlicher, Standort-, Netzwerk- oder Projektdaten.
- Keine API-Anfrage für Simulation oder manuelle Fehlersuche. Die optionale
  Live-KI sendet nur den minimierten Fehlersuchkontext nach Anmeldung und
  Creditprüfung; Provider-Schlüssel bleiben serverseitig und `store: false`
  verhindert Providerpersistenz durch diese Route.
- Der Bereich arbeitet ausschließlich mit Modellwerten und sichtbaren,
  reproduzierbaren Parametern.
- Sicherheitshinweise sind kurz, situationsbezogen und trennen
  ungefährliche Simulation von realer Elektronikpraxis.

## Inhaltliche Verknüpfung

| Laborfall | Wissensportal |
| --- | --- |
| V/div, Zeit/div und Trigger | Embedded-Systeme: Messtechnik und Debugging |
| PWM und Tastgrad | Grundlagen Mikrocontroller |
| Frequenz am Oszilloskop abschätzen und am Zähler prüfen | Embedded-Systeme: Messtechnik und Debugging |
| ADC-Rauschen und Messbereich | Grundlagen Mikrocontroller; elektrische Grundbegriffe und Bauteilschutz |
| Spannung, Strom und Widerstand | Elektrische Grundbegriffe und Bauteilschutz |
| I²C, SPI und UART | Bussysteme |
| Versorgungseinbruch | ESP32-Besonderheiten und Stolperfallen |

## Umsetzungsreihenfolge

1. **Umgesetzt:** öffentliche statische Labor-Shell, Identity-Einbindung,
   zufällig ausgewählte Messübungen mit unbekannten Signalen, getrenntes freies
   Generator-Experiment, Zeitansicht, manuelle Kanal-, Tastkopf-, Kopplungs-,
   Erfassungs- und Triggereinstellungen, XY-Modus, Frequenzzähler und FFT-Ansicht.
2. **Umgesetzt:** Multimeter mit mehreren einfachen Schaltungen,
   Messleitungswahl und erklärten Fehlanschlüssen.
3. **Umgesetzt:** Filterlabor mit Sinusquelle, Auslegung, Zweikanalmessung und
   Frequenzgang sowie Radiolabor mit AM-Hüllkurve und FM-Superhet.
4. **Umgesetzt:** Labornetzteil, LCR-Meter und Logikanalysator als getrennte
   Lab-Module.
5. **Umgesetzt als Lernmodell:** Spektrumanalysator und VNA mit klarer
   Abgrenzung zu kalibrierten realen Messgeräten.
6. Als nächste Vertiefung gezielte Wissensportal-Links und zusätzliche
   Schaltungsvarianten ergänzen. Konto- oder
   Lernfortschrittsfunktionen bleiben ein eigener späterer Schritt.

## Abnahmekriterien für die erste Veröffentlichung

- Öffentliche Nutzung ohne Konto, Netzwerkaufruf oder Persistenz.
- Kanal 1 und 2 sind unabhängig einstellbar und im Zeitbereich sichtbar.
- Ohne passende Zeitbasis, V/div und Trigger ist das vorbereitete Signal nicht
  zuverlässig lesbar; es gibt keine Auto-Setup-Funktion.
- XY-Modus bildet Lissajous-Figuren aus nachvollziehbaren Kanalparametern.
- Der Frequenzzähler misst die gewählte Generatorquelle nachvollziehbar und
  erklärt, weshalb eine Messung bei ungeeigneten Signalen nicht möglich ist.
- Alle Aufgaben sind per Tastatur bedienbar und erklären Fehlversuche.
- Mobile und Desktop zeigen die Messfläche ohne abgeschnittene Bedienelemente.
- Jeder Laborfall verweist auf einen stabilen Wissenskapitel- oder Abschnitts-ID.

## Offene Entscheidungen

- Exakter öffentlicher Pfad und Bezeichnung: `Technik-Labs`,
  `Interaktive Lernwerkzeuge` oder `Virtuelles Elektroniklabor`.
- Ob eine rein lokale Browser-Fortsetzung nach einem Reload angeboten wird;
  fachlicher Fortschritt bleibt dabei weiterhin ungespeichert.
- Ob das Labor eigene grafische Bauteilsymbole erhält oder zunächst mit
  schematischen, barrierearmen Darstellungen startet.
- Welche der vorbereiteten Fälle als erster öffentlich freigegeben wird.
