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
- ein aktiver WireGuard-Tunnel zum Staging-VPS
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
Das SSH-Ziel muss auf die private WireGuard-Adresse oder einen entsprechenden lokalen SSH-Alias zeigen. Oeffentliche SSH-Ziele sind fuer Staging-Administration nicht zulaessig.

## Mit dem internen Staging-Admin verbinden

Auf macOS, Windows und Linux identisch:

```text
node tools/connect-staging.js
```

Danach im lokalen Browser oeffnen:

```text
Plattform: http://127.0.0.1:14300/app/dashboard/
Admin:     http://127.0.0.1:14600/admin/
Hardware:  http://10.77.0.1:4910/api/hardware-catalog/
```

Das Terminal bleibt fuer die Dauer des SSH-Tunnels geoeffnet. `Strg+C` beendet die Verbindung. Der SSH-Tunnel laeuft innerhalb des WireGuard-VPN; der VPS benoetigt keinen Browser, und weder SSH noch der Admin-Port werden oeffentlich freigegeben.
Der Hardware Catalog bleibt ebenfalls privat: Identity auf dem Entwicklungsrechner nutzt ihn direkt ueber die feste WireGuard-Adresse `10.77.0.1:4910`; ein lokaler Hardware-Catalog-Prozess und ein SSH-Tunnel dafuer sind nicht erforderlich.

Nur die Konfiguration pruefen, ohne eine Verbindung aufzubauen:

```text
node tools/connect-staging.js --dry-run
```

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
3. die versionierte nftables-Host-Firewall syntaktisch validieren, installieren und gezielt neu laden,
4. Compose-Konfiguration validieren,
5. Images bauen,
6. Container aktualisieren,
7. auf Healthchecks warten,
8. Nginx/Identity, Admin Access Server und den internen Admin Tool Service pruefen,
9. Containerstatus ausgeben.

Persistente Docker-Volumes und `.env.vps` werden nicht geloescht oder ueberschrieben.

## Regeln fuer Codex

- Nur deployen, wenn der Nutzer Staging, Server-Test oder VPS-Deployment ausdruecklich verlangt.
- Vorher relevante lokale Tests ausfuehren und den Nutzer ueber den bevorstehenden Staging-Eingriff informieren.
- Ausschliesslich `node tools/staging-deploy.js` verwenden; keine parallelen manuellen `git pull`-/Compose-Varianten erfinden.
- Fuer einen angeforderten Admin-Zugriff ausschliesslich `node tools/connect-staging.js` verwenden.
- Vor Staging-Deployment oder Admin-Zugriff den WireGuard-Tunnel pruefen; keinen oeffentlichen SSH-Fallback einrichten.
- Niemals `docker compose down -v`, Volume-Loeschungen oder SQLite-Kopien ausfuehren.
- Ein fehlgeschlagenes Deployment anhand der ersten konkreten Fehlerausgabe diagnostizieren; keine wiederholten Startvarianten ausprobieren.
- Production ist nicht Staging. Dieses Tool darf nicht fuer Production-Ziele verwendet werden.
