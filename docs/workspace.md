# Workspace und Arbeitsweise

## Ziel

Der Workspace soll zuerst eine klare Dokumentationsgrundlage fuer GerNetiX schaffen.
Software, Quellcode und technische Umsetzung werden erst spaeter begonnen.
Alle fachlichen Aenderungen beginnen mit nachvollziehbarer fachlicher Motivation.

## Vorgeschlagene Struktur

- `README.md`: Einstieg und Orientierung
- `docs/`: Dokumentation, Konzepte, Entscheidungen und offene Fragen
- `docs/documentation-topics.md`: Themenuebersicht und Priorisierung
- `docs/workspace.md`: Regeln und Struktur des Workspace
- `docs/principles.md`: Leitprinzipien
- `docs/documentation-strategy.md`: Top-down-Dokumentationsstrategie
- `docs/products.md`: Produktuebersicht
- `docs/metamodel.md`: Metamodell als Single Source of Truth
- `docs/domains.md`: fachliche Domaenen
- `docs/development-process.md`: Entwicklungsprozess
- `docs/traceability.md`: Nachweis und Traceability

## Dokumentationsregeln

- Dokumente werden kurz, eindeutig und versionierbar gehalten.
- Offene Fragen werden sichtbar notiert statt still angenommen.
- Entscheidungen werden mit Begruendung dokumentiert.
- Neue Themen werden zuerst in der Themenuebersicht erfasst.
- Anforderungen werden nicht direkt in Umsetzung uebersetzt.
- Neue Metamodell-Klassen duerfen nur entstehen, wenn sie fuer eine Customer Journey oder ein Requirement notwendig sind.
- Work Packages werden aus Requirements und Metamodell abgeleitet.
- Das Datenmodell wird aus dem Metamodell abgeleitet, nicht umgekehrt.

## Naechste Schritte

1. Vision und Business Goals beschreiben.
2. Customer Journeys formulieren.
3. Requirements aus Customer Journeys ableiten.
4. Metamodell anhand der Requirements stabilisieren.
5. Nachweis- und Traceability-Regeln definieren.
