# Elektroniklabor: nächste parallele SPICE-Arbeitspakete

Status: beide Wellen bis ELAB-SPICE-008 und ELAB-AC-004 lokal umgesetzt und verifiziert; Graphabgleich der zweiten Welle ausstehend

## Ziel

Nach ELAB-SPICE-003 werden unabhängige Verträge, Tests und AC-Auswertungen
parallel vorbereitet. Gekoppelte Solver-, Worker- und UI-Integration bleibt
bei Root/GPT-5.6.

Kapazitätsregel: höchstens zwei Spark-Aufträge gleichzeitig. Zusätzlich darf
ein normaler Parallelagent arbeiten. Weitere Pakete werden nur gequeued.

## Erste parallele Welle

### ELAB-SPICE-004: Component-Capability-Vertrag

**Status:** umgesetzt

**Bearbeitung:** Spark 1  
**Abhängigkeit:** SPICE-001 bis SPICE-003  
**Dateigrenze:** ausschließlich neue Contract- und Testdatei

Neue Dateien:

- `free-simulation/component-capability-contract.mjs`
- `test/free-simulation/component-capability-contract.test.mjs`

Umfang:

- Fähigkeiten je Bauteil für DC, Transient, AC und Netlist,
- aktueller GND-/Quellen-/RLC-Umfang,
- LED und Taster bleiben mit expliziten Grenzen sichtbar,
- deterministische, tief unveränderliche Ausgabe.

Nicht enthalten: Solver, UI, Providerwahl oder Netlist-Erzeugung.

Abnahme:

- alle funktionalen Typen sind beschrieben,
- keine nicht implementierte Fähigkeit wird behauptet,
- unbekannte Typen werden stabil abgelehnt,
- keine Bestandsdatei wird geändert.

### ELAB-SPICE-005: Providerport und Solver-Ergebnisvertrag

**Status:** umgesetzt

**Bearbeitung:** normaler Parallelagent  
**Abhängigkeit:** SPICE-001 bis SPICE-003  
**Dateigrenze:** ausschließlich neue Contract-, Fake-Provider- und Testdateien

Neue Dateien:

- `free-simulation/solver-result-contract.mjs`
- `free-simulation/simulation-provider-port.mjs`
- zugehörige Tests

Umfang:

- einheitliche DC-, Transienten- und AC-Ergebnisse,
- stabile Knoten-/Zweig-IDs, Achsen, Diagnosen und Modellversionen,
- monotone Zeit- und Frequenzachsen,
- harte Ergebnis- und Textgrenzen,
- Fake-Provider erhält nur normalisierte `SimulationRequest`-Objekte.

Nicht enthalten: Worker, WASM, ngspice, UI oder Raw-Netlist-API.

Abnahme:

- Raw-Text und unbekannte Felder werden abgelehnt,
- DC, Transient und AC lassen sich validieren,
- Fake-Provider beweist Austauschbarkeit,
- bestehender Lernsolver bleibt unverändert und Standard.

### ELAB-AC-001: AC-Kennwertauswertung

**Status:** umgesetzt

**Bearbeitung:** Spark 2  
**Abhängigkeit:** SPICE-003  
**Dateigrenze:** ausschließlich neue Auswerte- und Testdatei

Neue Dateien:

- `free-simulation/ac-result-evaluator.mjs`
- `test/free-simulation/ac-result-evaluator.test.mjs`

Umfang:

- Start-/Stoppverstärkung,
- maximale Verstärkung,
- erste −3-dB-Eckfrequenz mit klarer Interpolationsregel,
- Phase an der Eckfrequenz,
- Warnung bei unzureichendem Sweep.

Nicht enthalten: Solver, DOM, Netlist, Template oder Provider.

Abnahme:

- RC-Tiefpass liefert erwartete Eckfrequenz,
- kein −3-dB-Durchgang ergibt eine Warnung statt eines erfundenen Werts,
- leere/ungültige Traces werden fail-closed behandelt,
- Ausgabe ist deterministisch und tief unveränderlich.

## Danach unabhängig queuebar

### ELAB-SPICE-006: Kanonischer Fixture-/Orakelkorpus

**Status:** umgesetzt

**Bearbeitung:** Spark oder Parallelagent  
**Abhängigkeit:** SPICE-001 bis SPICE-003

Versionierte Fixtures für Spannungsteiler, RC-Transient, RC-AC, RL-AC,
Quellenphase, Vorzeichen, singuläre Schaltung und Grenzfälle. Erwartungswerte
verwenden explizite Toleranzen. Keine Providerdatei und keine neue Runtime.

### ELAB-AC-002: Weitere AC-Templates

**Status:** lokal umgesetzt und getestet

**Bearbeitung:** Spark  
**Abhängigkeit:** SPICE-003

Zwei zusätzliche Presets im bestehenden Katalog:

- RC-Hochpass,
- serieller RLC-Resonanzkreis.

Keine neue Laboransicht und keine Solveränderung. Template, Messpunkte,
AC-Quelle und Reset müssen vollständig getestet sein.

## Zweite Welle nach Review

### ELAB-AC-003: AC-Ergebnis-View-Model

**Status:** lokal umgesetzt und getestet

**Bearbeitung:** Spark  
**Abhängigkeit:** AC-001

Reiner DOM-freier Adapter für Plotpunkte, Kennwertkarten, Tabelle sowie
Success-, Empty-, Error- und Invalidated-Zustände.

### ELAB-SPICE-007: Isolierter Worker mit Fake-Engine

**Status:** lokal umgesetzt und getestet

**Bearbeitung:** Spark, anschließend Root-Review  
**Abhängigkeit:** SPICE-005 und SPICE-006

Dedizierter beendbarer Worker, typisiertes Message-Protokoll, ein Auftrag pro
Lebenszyklus und Timeouttest mit Fake-Engine. Noch kein WASM oder ngspice.

### ELAB-SPICE-008: Ressourcen- und Missbrauchsgates

**Status:** lokal umgesetzt und getestet

**Bearbeitung:** Spark, anschließend Root-Review  
**Abhängigkeit:** SPICE-007

Durchsetzung der beschlossenen Grenzen: 32 Komponenten, 64 Knoten, 16 KiB
Netlist, 64.000 Ergebniswerte, zwei Sekunden und 64 MiB. Keine Teilergebnisse
oder Zustandsübernahme nach Timeout/Crash.

### ELAB-AC-004: Kennwerte und Zustände sichtbar integrieren

**Status:** lokal umgesetzt, getestet und im Browser geprüft

**Bearbeitung:** Root/GPT-5.6  
**Abhängigkeit:** AC-001 und AC-003

Integration in die bestehende Laborfläche, responsive Prüfung und
Browserabnahme. Keine zweite AC-Oberfläche.

## Noch nicht freigegeben

Ein echter ngspice-Build folgt erst nach eigenem Paket für gepinnte Version,
Quellhash, Emscripten-Toolchain, reproduzierbare Builds, SBOM, Lizenz und
Attribution. Download, Fremdbinärdatei, Aktivierung, Push und Deployment sind
durch diese Planung nicht autorisiert.

Ein serverseitiger SPICE-Dienst ist kein stiller Ersatz für den beschlossenen
Browser-Worker. Er würde vor Implementierung eine neue Architektur-, Security-,
Betriebs- und Kostenentscheidung benötigen.

## Umsetzungsnachweis der ersten Welle

- SPICE-004 beschreibt die vorhandenen Bauteilfaehigkeiten ohne vorgezogene
  Solverversprechen.
- SPICE-005 normalisiert Providerauftraege und Ergebnisse fail-closed; Raw-SPICE
  bleibt ausserhalb der Schnittstelle.
- AC-001 berechnet Start, Stopp, Maximum und den ersten abfallenden
  Drei-dB-Durchgang deterministisch.
- SPICE-006 verifiziert Lernsolver und Netlistexport mit versionierten
  Referenzfaellen und expliziten Toleranzen.

Die zweite Welle ergaenzt den Katalog um RC-Hochpass und seriellen
RLC-Resonanzkreis. Das DOM-freie AC-View-Model bildet Plotpunkte, Kennwerte,
Tabellen und Ergebniszustaende ab. Der Worker-Host verwendet ein geschlossenes
Protokoll, genau einen Auftrag je Worker und beendet Erfolg, Fehler, Abbruch
oder Timeout spaetestens nach zwei Sekunden. Vor und nach dem Worker gelten
die Grenzen von 32 Komponenten, 64 Knoten, 16 KiB normalisierter Engineeingabe
und 64.000 Ergebniswerten; der Fake-WASM-Vertrag fixiert 64 MiB Linearspeicher
ohne Wachstum. Die bestehende Laborflaeche zeigt AC-Kennwerte, logarithmische
Plots, Tabelle und Ergebniszustaende responsiv an. Eine echte Engine ist
weiterhin nicht angebunden.
