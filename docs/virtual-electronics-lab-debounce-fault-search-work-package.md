# ELAB-FS-010: Fehlerhafte Entprellung diagnostizieren

Stand: 2026-08-17  
Status: umgesetzt, getestet und im Browser geprüft (2026-08-17)

## Ziel

Zwei auswählbare Fehlersuchfälle verwenden dieselbe Laborfläche aus FS-009.
Der Nutzer erkennt den Fehler an den Messspuren, korrigiert den Quellcode und
bestätigt die Reparatur durch einen erneuten Simulationslauf.

## Erlaubte Dateien

- `modules/virtual-electronics-lab/labs/button-digital-input-throughput.js`
- `modules/virtual-electronics-lab/styles.css`
- `modules/virtual-electronics-lab/test/labs/button-digital-input-throughput-ui.test.mjs`
- diese Arbeitsanweisung und bestehende Elektroniklabor-Dokumentation

## Fehlerfälle

### Zeitfenster zu kurz

- Startwert: `debounceUs = 300`
- Symptom: Die entprellte Spur enthält mehrere Flanken.
- Reparaturnachweis: genau eine entprellte Flanke.

### Zeitfenster zu lang

- Startwert: `debounceUs = 2000`
- Symptom: Der Pegelwechsel wird störend spät übernommen.
- Reparaturnachweis: genau eine entprellte Flanke und höchstens `1.200 µs`
  Verzögerung gegenüber dem stabilen Rohsignal des Lehrprofils.

Der vorhandene Referenzcode mit `700 µs` erfüllt beide Nachweise. Die Werte
gelten nur für das feste Lehrprofil; reale Taster müssen gemessen werden.

## Bedienvertrag

- Symptombeschreibung zuerst, Lösung nicht vorwegnehmen.
- Keine Reparatur über einen UI-Regler.
- Quellcode editieren, Simulation erneut starten, Spuren vergleichen.
- Erfolg wird erst nach einem messbaren Reparaturnachweis angezeigt.
- Reset stellt den fehlerhaften Startwert des gewählten Falls wieder her.

## Abnahme

- beide Fälle sind getrennt auswählbar,
- `300 µs` scheitert an der Flankenanzahl,
- `2.000 µs` scheitert an der Verzögerung,
- `700 µs` erfüllt den jeweiligen Nachweis,
- die Oberfläche behauptet keine universell richtige reale Entprellzeit,
- bestehende Tasterfälle bleiben unverändert nutzbar.

Kein Commit, Push oder Deployment.
