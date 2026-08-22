# ELAB-SPICE-002: Lineare AC-Kleinsignalanalyse

Status: lokal umgesetzt und getestet

## Ziel

Der gemeinsame Simulationsauftrag unterstützt eine begrenzte logarithmische
AC-Kleinsignalanalyse. Eine vorhandene ideale Spannungsquelle wird im Auftrag
als AC-Anregung ausgewählt. Derselbe Auftrag kann mit dem lokalen linearen
Lernsolver ausgeführt und als SPICE-`.ac`-Netlist exportiert werden.

## Umfang

- Analyseart `ac-sweep` im Simulationsvertrag,
- Start-/Stoppfrequenz und Punkte pro Dekade mit festen Grenzen,
- AC-Amplitude und Phase für genau eine vorhandene Spannungsquelle,
- komplexe lineare MNA für ideale Quellen, R, C und L,
- komplexe Knoten- und Zweigwerte mit Betrag und Phase,
- deterministische logarithmische Frequenzachse,
- `.ac dec` und `AC Amplitude Phase` im vorhandenen Netlist-Export.

## Modellgrenzen

- Frequenzbereich: 1 Hz bis 1 MHz,
- 1 bis 50 Punkte pro Dekade,
- höchstens 201 Frequenzpunkte,
- AC-Amplitude größer 0 V und höchstens Schaltungsgrenze,
- Phase von -180 bis +180 Grad,
- keine LED, Taster, Halbleiter, parasitären Modelle oder Herstellerdaten,
- keine externe SPICE-Runtime und keine UI-Änderung.

## Abnahme

1. Der Vertrag prüft Quelle, Sweep und Ressourcenlimits vor dem Solver.
2. Ein RC-Tiefpass liegt bei der Grenzfrequenz nahe -3,01 dB und -45 Grad.
3. Ein RL-Netzwerk wird über denselben komplexen MNA-Kern gelöst.
4. Identische Aufträge liefern identische, tief unveränderliche Ergebnisse.
5. Nicht unterstützte Bauteile und singuläre Schaltungen liefern stabile
   Diagnosen.
6. Der Netlist-Export enthält eine AC-Quellenangabe und `.ac dec`.

## Nicht autorisiert

Dieses Paket autorisiert weder Push noch Deployment, Providerdownloads,
Live-SPICE-Aufrufe oder reale Hardwareansteuerung.
