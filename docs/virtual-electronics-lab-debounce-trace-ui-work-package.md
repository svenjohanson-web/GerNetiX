# ELAB-FS-009: Rohsignal und Programmwert vergleichen

Stand: 2026-08-17  
Status: umgesetzt, getestet und im Browser geprüft (2026-08-17)

## Ziel

Die vorhandene Fehlersuche „Tasterprellen messen“ zeigt gleichzeitig den
idealisierten Rohkontakt und den vom kontrollierten Mikrocontrollerprogramm
entprellten Wert. Beide Spuren verwenden dieselbe virtuelle Zeit und denselben
Messcursor.

## Erlaubte Dateien

- `modules/virtual-electronics-lab/labs/button-digital-input-throughput.js`
- `modules/virtual-electronics-lab/styles.css`
- `modules/virtual-electronics-lab/test/labs/button-digital-input-throughput-ui.test.mjs`
- diese Arbeitsanweisung und bestehende Elektroniklabor-Dokumentation

## Bedienvertrag

- Beim Wechsel in den Prellfall steht der FS-008-Startcode mit
  `debounceUs = 700` im vorhandenen Quellcodeeditor.
- „Simulation starten“ erzeugt eine FS-004-Messspur über `5.000 µs` und führt
  damit die FS-008-Runtime aus.
- Der Nutzer verändert die Entprellzeit ausschließlich im Quellcode.
- Die Oberfläche zeigt Rohsignal und entprellten Programmwert getrennt,
  beschriftet und auf derselben Zeitachse.
- Der gemeinsame Cursor zeigt Zeit, Rohpegel und entprellten Pegel.
- Ausgegeben werden Rohflanken, entprellte Flanken und Erkennungszeitpunkt.
- Drücken und Lösen können weiterhin getrennt aufgenommen werden.

## Grenzen

- kein zusätzlicher Zeitregler,
- keine native C++-Ausführung,
- keine Netzwerk- oder KI-Anbindung,
- keine ESP32-Emulation,
- unveränderte freie Tasterübung und bestehende Fehlersuchfälle.

## Abnahme

- Standardcode erzeugt aus der Druckspur genau eine entprellte Flanke,
- beide Spuren und beide Pegel sind über den Cursor prüfbar,
- Quellcodefehler werden kontrolliert angezeigt,
- Reset stellt den passenden Startcode wieder her,
- bestehende UI- und Kernregression bleiben grün.

Kein Commit, Push oder Deployment.
