# ELAB-FS-006: KI-Vertrag für geführte Fehlersuche

Stand: 2026-08-17  
Status: umgesetzt und getestet (2026-08-17)

## Ziel

Ein reiner, providerunabhängiger Vertrag minimiert einen Runtime-Snapshot und
validiert feste KI-Vorschläge. Das Labor bleibt ohne KI vollständig nutzbar.

## Umfang

- Kontext enthält nur Laborfall, Quellcode und ausgewählte Messwerte,
- erlaubte Vorschläge: Beobachtung erklären, nächste Messung vorschlagen oder
  bestätigungspflichtigen Command-Diff anbieten,
- Reparatur-Commands sind auf `SetContactReference` und `UpdateSourceFile`
  begrenzt,
- kein Command wird ausgeführt,
- kein Netzwerk, Provider, Schlüssel, Konto, Tarif oder Credit-Verbrauch.

## Abnahme

- feste Fehlercodes und Fixtures,
- tiefe Unveränderlichkeit,
- Ablehnung unbekannter Aktionen, Commands und unbestätigter Reparaturen,
- keine Übernahme zusätzlicher Snapshot-Felder.
