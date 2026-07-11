# Codex-Arbeitsanweisung: Staging-Deployment

## Ziel

Der gleiche, kurze Deployment-Ablauf funktioniert aus einem GerNetiX-Checkout auf macOS, Windows und Linux. Die lokale Development-Umgebung bleibt davon unberuehrt.

Standardbefehl:

```text
node tools/staging-deploy.js
```

Das Tool deployt exakt den aktuellen, bereits gepushten Git-Commit auf den Staging-VPS. Es uebertraegt keine lokalen Dateien per SCP und kopiert keine lokale SQLite-Datei auf den Server.

## Einmalige Einrichtung je Entwicklungsrechner

Voraussetzungen:

- Git
- Node.js 18 oder neuer
- OpenSSH-Client
- ein fuer den Staging-VPS autorisierter SSH-Schluessel
- ein sauberer Checkout des GerNetiX-Repositories

macOS und Linux:

```bash
cp .env.staging.example .env.staging.local
```

Windows PowerShell:

```powershell
Copy-Item .env.staging.example .env.staging.local
```

`.env.staging.local` ist absichtlich nicht versioniert. Dort werden SSH-Ziel und VPS-Verzeichnis je Rechner konfiguriert.

## Normaler Ablauf

1. Lokal entwickeln und testen.
2. Aenderungen committen.
3. Den aktuellen Branch zu GitHub pushen.
4. Deployment starten:

```text
node tools/staging-deploy.js
```

Vorab pruefen, ohne SSH oder VPS-Aenderung:

```text
node tools/staging-deploy.js --dry-run
```

Das Tool bricht ab, wenn:

- der lokale Arbeitsbaum nicht sauber ist,
- der aktuelle Commit nicht dem Upstream-Commit entspricht,
- SSH-Ziel oder Branch ungueltige Zeichen enthalten,
- die VPS-Arbeitskopie lokale Aenderungen besitzt,
- Compose-Konfiguration, Build oder Healthchecks fehlschlagen.

## Serverseitiger Ablauf

Nach erfolgreicher Vorpruefung geschieht auf Staging automatisch:

1. aktuellen Branch von `origin` abrufen,
2. exakt auf die lokale Commit-ID wechseln,
3. Compose-Konfiguration validieren,
4. Images bauen,
5. Container aktualisieren,
6. auf Healthchecks warten,
7. Nginx/Identity und Admin Tool pruefen,
8. Containerstatus ausgeben.

Persistente Docker-Volumes und `.env.vps` werden nicht geloescht oder ueberschrieben.

## Regeln fuer Codex

- Nur deployen, wenn der Nutzer Staging, Server-Test oder VPS-Deployment ausdruecklich verlangt.
- Vorher relevante lokale Tests ausfuehren und den Nutzer ueber den bevorstehenden Staging-Eingriff informieren.
- Ausschliesslich `node tools/staging-deploy.js` verwenden; keine parallelen manuellen `git pull`-/Compose-Varianten erfinden.
- Niemals `docker compose down -v`, Volume-Loeschungen oder SQLite-Kopien ausfuehren.
- Ein fehlgeschlagenes Deployment anhand der ersten konkreten Fehlerausgabe diagnostizieren; keine wiederholten Startvarianten ausprobieren.
- Production ist nicht Staging. Dieses Tool darf nicht fuer Production-Ziele verwendet werden.

