# HTTP-Routenklassifizierungs-Guard

Der Guard verhindert, dass neue oder geaenderte produktive HTTP-Routen unter
`services/*/src` unbemerkt an der Zugriffsklassifizierung vorbeigehen.

Er erkennt die im Projekt verwendeten Routerformen (`http-app.js`, Identity-
Registry, Express-artige Router und inline Node-HTTP-Server). Das gepflegte
Manifest ordnet jeden erkannten Service einem Abschnitt aus
`docs/internal-api-access-inventory.md` und mindestens einer gueltigen
Zugriffsklasse zu. Dateiliste und normalisierter SHA-256-Fingerabdruck sorgen
dafuer, dass sowohl neue Routendateien als auch neue Routen in vorhandenen
Dateien die CI-Pruefung stoppen.

```shell
npm run routes:check
npm test
```

Nach einer bewusst geprueften Routenaenderung:

1. Route im Inventar einordnen und Authentifizierungs-/Negativtest ergaenzen.
2. Klassen und Inventarabschnitt in `route-classification.json` kontrollieren.
3. `npm run routes:accept` ausfuehren.
4. Manifest-Diff zusammen mit Code und Tests reviewen.

`routes:accept` nimmt absichtlich keine ganz neuen Services auf. Diese muessen
zuerst manuell mit Abschnitt und Zugriffsklassen in das Manifest eingetragen
werden. Der Fingerabdruck ist kein Sicherheitsnachweis; er erzwingt den
Review-Punkt, an dem Inventar, Schutz und Tests gemeinsam beurteilt werden.
