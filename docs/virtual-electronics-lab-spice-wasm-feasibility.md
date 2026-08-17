# Elektroniklabor: SPICE-/WASM-Machbarkeitsnachweis

Stand: 2026-08-17
Entscheidung: technisch machbar, derzeit nicht als Runtime-Abhängigkeit übernommen

## Ergebnis

Ngspice lässt sich grundsätzlich durch eine steuernde Anwendung betreiben. Die
offizielle Shared-Library-Schnittstelle nimmt Netlisten an, startet Analysen,
liefert Simulationsdaten über Callbacks und kann Berechnungen abbrechen. Der
überwiegende Quellcode steht laut Projekt unter modifizierter BSD-Lizenz; die
konkrete Build-Zusammenstellung benötigt trotzdem eine eigene Lizenz- und
Attributionsprüfung.

Emscripten kann C/C++ nach WebAssembly übersetzen. Für GerNetiX wäre zunächst
ein einzelner, dedizierter Web Worker ohne Shared Memory sinnvoll. Der Worker
kann bei Zeitüberschreitung vollständig beendet werden und benötigt weder
Pthreads noch COOP-/COEP-Header.

Eine gefundene inoffizielle ngspice-WASM-Verpackung reicht nicht für eine
Übernahme aus. Ihr Repository weist nur einen initialen Commit aus und
beschreibt `EXPORT_ALL`, einen Raw-Command-Zugang, wachsenden Speicher, 256 MB
Initialspeicher und Single-Thread-Ausführung. Diese Eigenschaften widersprechen
dem GerNetiX-Providervertrag.

## Verbindliche Providergrenzen

- eigener reproduzierbarer Build einer fest gepinnten ngspice-Version,
- dedizierter beendbarer Worker, maximal 2 Sekunden Laufzeit,
- fester Speicher von höchstens 64 MiB ohne Memory Growth,
- kein Netzwerk und kein persistentes Dateisystem,
- höchstens 32 Komponenten, 64 Knoten, 16 KiB generierte Netliste und 64.000 Ergebniswerte,
- ausschließlich Übersetzung eines validierten `CircuitDocument`,
- keine Nutzernetliste, keine Raw-SPICE-Direktiven und keine Command-Konsole,
- Browser-, Ressourcen-, Lizenz- und Reproduzierbarkeitstests vor Aktivierung.

Der ausführbare Vertrag liegt in
`modules/virtual-electronics-lab/free-simulation/spice-provider-feasibility.mjs`.
Bis alle Gates erfüllt sind, bleibt der Providerstatus
`feasible-with-gate-not-adopted`.

## Quellen

- [Offizielle ngspice Shared-Library-Schnittstelle](https://ngspice.sourceforge.io/shared.html)
- [Offizielle ngspice Entwickler- und Lizenzhinweise](https://ngspice.sourceforge.io/devel.html)
- [Offizielle Emscripten-Dokumentation zu Wasm Workers und klassischen Workers](https://emscripten.org/docs/api_reference/wasm_workers.html)
- [Offizielle Emscripten-Hinweise zur WebAssembly-Auslieferung](https://emscripten.org/docs/compiling/Deploying-Pages.html)
- [Geprüfter inoffizieller ngspice-WASM-Prototyp](https://github.com/z-wasm/ngspice-wasm)

