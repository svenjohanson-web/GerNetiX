# ELAB-SPICE-001: Einheitlicher Simulations- und Netlist-Vertrag

Status: lokal umgesetzt und getestet

## Ziel

Die freie Elektroniksimulation erhält einen kleinen, providerneutralen
Simulationsauftrag. Derselbe validierte Auftrag kann mit den vorhandenen
Lernsolver-Adaptern ausgeführt oder als deterministische SPICE-Netlist
exportiert werden.

## Umfang

- versionierter Vertrag für DC-Arbeitspunkt und Transientenanalyse,
- eingebettetes, normalisiertes `CircuitDocument`,
- ein gemeinsamer Dispatcher für die vorhandenen DC- und Transientensolver,
- deterministischer SPICE-Netlist-Export für GND, ideale DC-Quelle, R, C und L,
- stabile Zuordnung fachlicher Komponenten- und Knoten-IDs zu SPICE-Namen,
- harte Ablehnung nicht unterstützter Komponenten und ungültiger Aufträge,
- keine stillschweigende elektrische Näherung.

## Bewusste Grenzen

- kein ngspice-Prozess und kein WASM-Provider,
- keine allgemeine Raw-SPICE-Eingabe,
- noch keine AC-Analyse,
- LED und Taster werden nicht exportiert,
- keine Hersteller- oder Halbleitermodelle,
- keine UI-, Persistenz-, Tarif- oder KI-Änderung.

## Abnahme

1. DC und Transient verwenden denselben versionierten Auftragsvertrag.
2. Der Dispatcher reicht ausschließlich normalisierte Daten an bestehende
   Solver weiter.
3. Identische Eingaben erzeugen bytegleiche Netlists.
4. GND wird als SPICE-Knoten `0` exportiert.
5. Die Eingabereihenfolge beeinflusst die Netlist nicht; ursprüngliche IDs
   bleiben über deterministische Mapping-Kommentare nachvollziehbar.
6. Nicht unterstützte Bauteile und mehrere Masseknoten liefern stabile Fehler.
7. Eingaben bleiben unverändert; Ergebnisse sind tief unveränderlich.

## Nicht autorisiert

Dieses Paket autorisiert weder Push noch Deployment, Providerdownloads,
Live-Simulationen oder reale Hardwareansteuerung.
