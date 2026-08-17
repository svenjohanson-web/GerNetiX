# Elektroniklabor: freie Simulation

Stand: 2026-08-17
Status: FREE-001 bis FREE-009 lokal umgesetzt und getestet; FREE-001 bis FREE-008 zusätzlich im Browser geprüft

## Ziel

Die freie Simulation verwendet dieselbe Labor-Shell wie die geführten
Anwendungsfälle. Der Nutzer platziert funktionale Bauteile, verbindet deren
Anschlüsse, ändert Werte und startet eine ausdrücklich begrenzte Analyse.

Der erste Durchstich ist noch kein vollständiger SPICE-Ersatz. Er schafft den
gemeinsamen, versionierten Daten- und Command-Pfad, an den später ein
isolierter SPICE-Adapter angeschlossen werden kann.

## FREE-001: CircuitDocument-Vertrag

**Status:** durch Spark umgesetzt, durch GPT-5.6 gehärtet und abgenommen

Der Vertrag beschreibt GND, ideale DC-Spannungsquelle, Widerstand,
Kondensator, Spule, LED und Taster mit IDs, Ports, Knoten, Parametern, Einheiten
und festen Modellgrenzen. Normalisierte Ergebnisse sind deterministisch und
tief unveränderlich.

## FREE-002: Command-Pfad

**Status:** durch GPT-5.6 umgesetzt und getestet

Alle Änderungen laufen über typisierte Commands:

- `AddComponent` und `RemoveComponent`,
- `ConnectPins`, `DisconnectPin` und `DisconnectNet`,
- `SetComponentParameter`,
- `ResetCircuit`.

Ungültige IDs, Ports, Parameter, unbekannte Felder und Modellgrenzen verändern
den Zustand nicht und liefern stabile Fehlercodes.

## FREE-003: DC-Lernsolver-Adapter

**Status:** durch GPT-5.6 umgesetzt und getestet

Der Adapter übersetzt das validierte CircuitDocument in den vorhandenen
linearen DC-Arbeitspunkt-Solver. Unterstützt werden zunächst ausschließlich
GND, ideale DC-Spannungsquellen und Widerstände. C, L, LED und Taster werden
nicht stillschweigend angenähert, sondern als noch nicht unterstützte
Komponenten gemeldet.

## FREE-004: Sichtbarer Spannungsteiler

**Status:** durch GPT-5.6 umgesetzt, getestet und im Browser abgenommen

Das Template **Freie DC-Simulation · Spannungsteiler** startet mit 5 V und zwei
Widerständen zu je 1 kΩ. Sichtbar sind Bauteilpalette, Ports, Netznamen,
Parameter, Verdrahtungsaktionen, Knotenspannungen, Zweigströme und Leistungen.

Browsernachweis:

- 5 V Versorgung ergeben 2,5 V an der Teilermitte,
- 10 V Versorgung ergeben nach Command-Änderung 5 V,
- Reset stellt den 5-V-Startzustand wieder her,
- zusätzliche Bauteile und Verbindungen werden sichtbar übernommen,
- eine LED erzeugt die klare Grenze des aktuellen DC-Providers.

## FREE-005: Messpunkte und virtuelle Tastköpfe

**Status:** durch GPT-5.6 umgesetzt, getestet und im Browser abgenommen

Messpunkte werden frei auf vorhandene Schaltungsknoten gesetzt und können
anschließend verschoben oder entfernt werden. Ein virtueller Spannungstastkopf
verbindet eine Plusspitze mit einer Referenzspitze und zeigt die
Differenzspannung einschließlich Vorzeichen. Messaufbau und Schaltung bleiben
getrennte Verträge und besitzen getrennte Command-Pfade.

Der aktuelle Tastkopf ist ausdrücklich ideal hochohmig. Eingangsimpedanz,
Tastkopfkapazität und die dadurch verursachte Belastung der realen Schaltung
werden noch nicht modelliert. Verschwinden Knoten durch eine Änderung der
Schaltung, werden daran hängende Messpunkte und Tastköpfe nachvollziehbar
entfernt.

Browsernachweis:

- der vorbereitete Tastkopf misst die Teilermitte gegen GND mit 2,5 V,
- vertauschte Spitzen liefern −2,5 V,
- ein zusätzlicher Messpunkt lässt sich auf dem 5-V-Knoten setzen,
- Reset stellt den vorbereiteten Messaufbau wieder her,
- wiederholtes Neurendern erzeugt keine doppelten Tastkopfzeilen.

## FREE-006: Rückgängig und Wiederholen

**Status:** durch GPT-5.6 umgesetzt, getestet und im Browser abgenommen

Die freie Simulation besitzt einen gemeinsamen Verlauf für Schaltung und
Messaufbau. Erfolgreiche Circuit- und Measurement-Commands werden mit ihrem
validierten Ergebniszustand erfasst. Rückgängig und Wiederholen stellen beide
Verträge gemeinsam wieder her, sodass beispielsweise ein entfernter Knoten
und seine Messpunkte nicht auseinanderlaufen.

Der Verlauf bleibt flüchtig im Browser, speichert keine Daten und ist auf 50
Änderungen begrenzt. Ungültige Commands und identische Zustände erzeugen
keinen Eintrag. Nach einem Undo verwirft eine neue Änderung ausschließlich den
nicht mehr passenden Redo-Zweig.

Browsernachweis:

- Spannungsänderung von 5 V auf 10 V und zusätzlicher Messpunkt ergeben zwei Schritte,
- das erste Undo entfernt nur den Messpunkt,
- das zweite Undo stellt 5 V wieder her,
- zweimal Redo stellt 10 V und den Messpunkt wieder her,
- eine neue Änderung nach Undo deaktiviert den vorherigen Redo-Zweig.

## FREE-007: SPICE-/WASM-Machbarkeitsnachweis

**Status:** geprüft, Providervertrag umgesetzt, externe Runtime bewusst nicht übernommen

Ngspice kann technisch über Emscripten in einem Web Worker betrieben werden.
Der aktuelle Marktcheck liefert jedoch keinen ausreichend belastbaren Wrapper
für eine direkte GerNetiX-Abhängigkeit. Ein späterer Provider muss aus einer
gepinnten Upstream-Version reproduzierbar selbst gebaut, lizenzgeprüft und
durch feste Speicher-, Zeit-, Netlist- und Ergebnisgrenzen isoliert werden.
Raw-SPICE und eine Command-Konsole bleiben ausgeschlossen. Details stehen im
[SPICE-/WASM-Machbarkeitsnachweis](virtual-electronics-lab-spice-wasm-feasibility.md).

## FREE-008: Begrenzte Transientenanalyse

**Status:** durch GPT-5.6 umgesetzt, getestet und im Browser abgenommen

Der gemeinsame lineare MNA-Kern berechnet nun eine zeitdiskrete
Backward-Euler-Analyse für ideale DC-Quellen, Widerstände, Kondensatoren,
Spulen und statisch offene oder geschlossene Taster. Kondensatorspannung und
Spulenstrom starten bei null; die DC-Quelle wird als Sprung bei t = 0+
behandelt. Zeitschritt, Dauer, 1.000 Schritte sowie Spannungs- und Stromgrenzen
werden vor beziehungsweise während der Berechnung erzwungen.

Das neue Template **Freie Transientensimulation · RC-Ladevorgang** zeigt die
differentielle Tastkopfmessung als Kurve und Tabelle. Im Browser liefert
1 kΩ/1 µF nach 10 ms etwa 4,9996 V; bei 10 µF sinkt der 10-ms-Wert auf etwa
3,1514 V. Eine Konfiguration mit zu vielen Schritten wird ohne Berechnung
abgelehnt. RL-Anstieg und Tasterzustände sind durch Unit-Tests abgedeckt. Die
nichtlineare LED bleibt eine klare Providergrenze.

## FREE-009: Leere Laborfläche

**Status:** lokal umgesetzt und getestet

Die Vorlagenauswahl bietet zusätzlich eine wirklich leere Laborfläche. Ihr
versionierter Startzustand besitzt null Bauteile, Knoten, Messpunkte und
Tastköpfe. Ein sichtbarer Leerhinweis führt zum ersten Bauteil; danach laufen
Hinzufügen, Verdrahten, Messen, Undo/Redo und Reset unverändert über die
bestehenden Commands und den gemeinsamen LabProject-Messpfad. Der direkte
Laboraufruf startet aus Kompatibilitätsgründen weiterhin mit dem
Spannungsteiler.

## Stand nach dem Durchstich

Die geplante Reihe FREE-001 bis FREE-009 ist abgeschlossen. Ein echter
ngspice-WASM-Provider ist ausdrücklich kein offenes Reststück dieser Reihe,
sondern eine spätere Integrationsentscheidung nach Erfüllung aller Gates.
Die anschließende SPICE-Reihe beginnt mit dem umgesetzten
[ELAB-SPICE-001 Simulations- und Netlist-Vertrag](virtual-electronics-lab-spice-simulation-contract-work-package.md).
Er vereinheitlicht DC- und Transientenaufträge und exportiert den linearen
Teilumfang deterministisch, ohne die Providerentscheidung vorwegzunehmen.
