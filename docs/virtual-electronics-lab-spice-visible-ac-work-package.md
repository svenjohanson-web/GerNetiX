# ELAB-SPICE-003: Sichtbare AC-/Bode-Analyse

Status: lokal umgesetzt und getestet; automatisierte Browserprüfung durch lokale Browserrichtlinie blockiert

## Ziel

Die lineare AC-Analyse wird in der bestehenden freien Laborfläche sichtbar.
Der Nutzer lädt einen RC-Tiefpass, wählt AC-Quelle und Frequenzbereich und
erhält Betrag, Phase sowie die erzeugte SPICE-Netlist.

## Umfang

- Vorlage `Freie AC-Simulation · RC-Tiefpass`,
- AC-Quelle aus vorhandenen idealen Spannungsquellen,
- Startfrequenz, Stoppfrequenz und Punkte pro Dekade,
- feste Anregung von 1 V bei 0 Grad im ersten sichtbaren Durchstich,
- differentielle Auswertung der vorhandenen virtuellen Tastköpfe,
- Bode-Kurven für Verstärkung in dB und Phase in Grad,
- kompakte Ergebnistabelle,
- sichtbare, nur lesbare SPICE-Netlist,
- bestehende Command-, Undo-/Redo- und Resetpfade bleiben unverändert.

## Modellgrenzen

- ausschließlich ideale Quelle, R, C und L,
- keine LED, Taster, Halbleiter oder Herstellerdaten,
- kein Raw-SPICE-Editor,
- keine externe SPICE-Runtime,
- keine Persistenz-, Tarif- oder KI-Änderung.

## Abnahme

1. Die neue Vorlage lädt im bestehenden freien Labor.
2. AC-Quelle und Frequenzparameter erzeugen einen validierten `ac-sweep`.
3. Betrag und Phase stammen aus der differentiellen Tastkopfauswertung.
4. Die Netlist stammt aus demselben Simulationsauftrag.
5. Schaltungsänderungen invalidieren AC-Kurven und Netlist.
6. Die Darstellung bleibt auf Tablet- und Mobilbreite nutzbar.

## Nicht autorisiert

Dieses Paket autorisiert weder Push noch Deployment, Providerdownloads,
Live-SPICE-Aufrufe oder reale Hardwareansteuerung.
