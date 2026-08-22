# Elektroniklabor: Status der Arbeitspakete

Stand: 2026-08-17

Diese Sicht fasst den SQLite-Graphen und die gepflegten
Elektroniklabor-Arbeitsdokumente zusammen. Sie ist eine Lesesicht und keine
zweite fachliche Wahrheit.

## Kurzstand

- 53 Requirements sind im SQLite-Graphen als `implemented` markiert.
- AC-002 bis AC-004 sowie SPICE-007 und SPICE-008 sind zusaetzlich lokal umgesetzt und getestet;
  ihr Graphabgleich ist wegen paralleler Aenderungen an der Graphdatei noch
  ausstehend.
- Die bereits definierten AC-/SPICE-Arbeitspakete sind umgesetzt.
- 3 vorhandene Umsetzungen benötigen noch einen externen oder manuellen
  Nachweis.
- Eine echte ngspice-/WASM-Runtime ist bewusst noch nicht freigegeben.

## Abgeschlossene Paketgruppen

| Paketgruppe | Abgeschlossen | Inhalt |
| --- | ---: | --- |
| CORE | CORE-001 | Gemeinsamer LabProject- und MeasurementTrace-Pfad |
| DS | DS-001 bis DS-005 | GPIO-LED, PWM, Oszilloskop, PT1000 und Taster als sichtbare Durchstiche |
| PAR | PAR-001 bis PAR-008 | PT1000, DC-Solver, ADC, Taster und Virtual-MCU-Grundmodelle |
| SEQ | SEQ-004 bis SEQ-006 | PT1000-ADC- und Taster-Programmdurchstiche |
| FS | FS-001 bis FS-014 | Fehlersuche, Prellen, Entprellung sowie lokaler und sessiongebundener KI-Pfad |
| TPL | TPL-001 bis TPL-003 | Template-Vertrag, Anwendungsfallkatalog und Vorlagenauswahl |
| LED | LED-001 bis LED-003 | Stromruecklesung, Regelruntime und sichtbare LED-Stromregelung |
| FREE | FREE-001 bis FREE-009 | Freier Schaltungsaufbau, DC, Messpunkte, Undo/Redo, Transient und leere Arbeitsflaeche |
| SPICE | SPICE-001 bis SPICE-006 im Graph; SPICE-007 und SPICE-008 lokal | Simulationsauftrag, Netlistexport, AC-Lernsolver, Bode-Sicht, Providervertrag, Orakelkorpus, isolierter Fake-Worker und Ressourcengates |
| AC | AC-001 im Graph; AC-002 bis AC-004 lokal | AC-Kennwerte, weitere RLC-Templates, Ergebnis-View-Model und sichtbare responsive Integration |

Die fruehen Unterteilungen `ELAB-001` bis `ELAB-007` sind im heutigen
`ELAB-DS-001`-Durchstich aufgegangen und werden nicht zusaetzlich gezaehlt.

## Definierte offene Arbeitspakete

Keine. Die naechste Stufe mit echtem ngspice/WASM ist bewusst noch nicht
freigegeben und wird erst nach einer eigenen Supply-Chain- und
Qualifikationsplanung in Arbeitspakete zerlegt.

## Noch ausstehende Nachweise

| Bereich | Implementierungsstand | Offener Nachweis |
| --- | --- | --- |
| FREE-009 | lokal umgesetzt und getestet | Sichtpruefung der leeren Arbeitsflaeche im Browser |
| SPICE-003 | lokal umgesetzt und getestet | automatisierte Browserpruefung; bisher durch lokale Browserrichtlinie blockiert |
| FS-012 bis FS-014 | lokal und vertraglich getestet | echter Live-Provider-/Creditpfad und gegebenenfalls Staging-Nachweis |

Diese Punkte sind keine fehlenden Kernimplementierungen, duerfen aber nicht als
live oder browserseitig vollstaendig abgenommen bezeichnet werden.

## Bewusst noch nicht freigegeben

Der echte ngspice-/WASM-Pfad beginnt erst nach den Worker- und
Ressourcengates. Danach muessen noch eigene Arbeitspakete beschlossen werden
fuer:

1. gepinnte ngspice-Version, Quellhash, reproduzierbaren Build, SBOM, Lizenz
   und Attribution,
2. echten offline betriebenen Adapter hinter dem Providervertrag,
3. Browser-, Abbruch-, Ressourcen- und CSP-Qualifikation,
4. Aktivierung hinter Capability und Feature Flag mit sicherem Fallback auf
   den Lernsolver.

Download, Fremdbinaerdatei, Aktivierung, Push und Deployment sind dadurch noch
nicht autorisiert.

## Noch nicht in konkrete Arbeitspakete zerlegt

Die Zielarchitektur nennt weitere Lernfelder wie DAC, UART, SPI, I2C,
Watchdog, Logikbausteine und vereinfachte Busgeraete. GPIO, PWM und ADC besitzen
bereits Durchstiche; die uebrigen Felder sind derzeit Architektur-Backlog und
noch keine freigegebenen Implementierungsarbeitspakete.
