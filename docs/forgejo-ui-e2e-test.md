# Forgejo-Repository-Karte: isolierter UI-End-to-End-Nachweis

## Zweck

Der Nachweis verbindet die produktive Repository-Karte mit den echten
sessiongeschuetzten Identity-Routen, dem Project-Server-HTTP-Vertrag und einem
kurzlebigen echten Forgejo-Repository. Er verwendet ausschliesslich
synthetische Konten, Projekte, Commits, Container und Volumes.

## Nachweisumfang

- anonyme Repository-Anfrage wird mit `401` abgewiesen,
- ein fremdes Projekt bleibt mit `404` verborgen,
- die Karte zeigt aktiven Status, Branch und Head,
- echter Dateibaum, Dateiinhalt und mindestens zwei Commits werden dargestellt,
- die Auswahl eines Commits zeigt dessen geaenderte Pfade als Commit-Diff,
- die mobile Kartenansicht wechselt auf eine Spalte,
- weder Forgejo-Token noch interne Forgejo-URL gelangen in HTML oder JSON,
- Chromium greift niemals direkt auf Forgejo zu.

Der Browser laeuft im selben internen Compose-Netz wie der Testdienst. Es gibt
keine Hostports und keinen Zugriff auf bestehende GerNetiX-Daten oder Volumes.
Das Playwright-Paket und das offizielle Browserimage sind versionsgleich auf
`1.62.0` gepinnt.

## Lokaler Lauf

Voraussetzung ist Docker mit Compose-Plugin. Vom Repository-Stamm:

```bash
tools/forgejo-ui-e2e/run.sh
```

Das Skript erzeugt Sitzung und Forgejo-Zugriffstoken nur fuer den Lauf, räumt
Container, Images, Netzwerke und Volumes über einen Fehler-Trap auf und führt
weder Deployment noch Migration oder Cutover aus.
