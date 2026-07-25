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

## Private Plattform und internen Staging-Admin verwenden

Die normale Nutzung erfolgt nach aktiviertem WireGuard direkt ueber:

```text
https://pwa.gernetix.com/app/dashboard/
```

Damit bleiben Origin, Secure Cookie und Passkey-Bindung auf allen Rechnern und
dem iPad identisch. Der folgende SSH-Tunnel ist ein Diagnose- und
Administrationsweg; er ist nicht die kanonische App-Adresse:

Auf macOS, Windows und Linux identisch:

```text
node tools/connect-staging.js
```

Danach sind lokal zusaetzlich erreichbar:

```text
Plattform-Diagnose: http://127.0.0.1:14300/app/dashboard/
Admin-Diagnose:     http://127.0.0.1:14600/admin/
Identity PostgreSQL: 127.0.0.1:15432
Hardware Catalog:   http://10.77.0.1:4910/api/hardware-catalog/
```

Das Terminal bleibt fuer die Dauer des SSH-Tunnels geoeffnet. `Strg+C` beendet die Verbindung. Der SSH-Tunnel laeuft innerhalb des WireGuard-VPN; der VPS benoetigt keinen Browser, und weder SSH noch der Admin-Port werden oeffentlich freigegeben.
Der Hardware Catalog bleibt ebenfalls privat: Identity auf dem Entwicklungsrechner nutzt ihn direkt ueber die feste WireGuard-Adresse `10.77.0.1:4910`; ein lokaler Hardware-Catalog-Prozess und ein SSH-Tunnel dafuer sind nicht erforderlich.

## Lokalen Port 4300 ohne Staging verwenden

Fuer haeufige Arbeiten am Identity Server und an der Plattform-UI kann Port `4300` lokal laufen, waehrend der gemeinsame Entwicklungsdatenstand auf dem VPS bleibt.

Einmalig:

```bash
cp .env.remote-dev.example .env.remote-dev.local
```

In `.env.remote-dev.local` muss mindestens `IDENTITY_POSTGRES_PASSWORD` fuer die gemeinsame Entwicklungsdatenbank gesetzt werden. Danach in zwei Terminals:

```text
node tools/connect-staging.js
node tools/start-identity-remote-dev.js
```

Der erste Prozess stellt innerhalb von WireGuard die SSH-Weiterleitungen bereit. Der zweite startet nur Identity auf `127.0.0.1:4300`, verwendet die zentrale Identity-PostgreSQL-Datenbank und ruft Project, Build, Device, Shop, Usage, AI Context, Community und Telemetrie ueber deren getunnelte VPS-Dienste auf. Auf macOS wird AI Usage lokal auf `5001` weitergereicht, weil Port `5000` durch das System belegt sein kann.

Im Remote-Dev-Modus legt Identity keine lokalen SQLite-Dateien an. VPS-seitige Release-/Account-Assets bleiben am kanonischen VPS-Identity-Endpunkt; lokale Schreibwege fuer diese Nebenspeicher sind deaktiviert. Push- und SMTP-Hilfsspeicher sind im lokalen Prozess nur fluechtig.

Lokale Codeaenderungen an `4300` benoetigen dadurch weder Commit noch Staging-Deployment. Der gemeinsame Datenstand ist aber real: Tests und manuelle Aenderungen koennen andere Entwicklungsrechner beeinflussen. Diese Betriebsart darf deshalb nur eine getrennte Entwicklungs-/Staging-Datenbank verwenden, niemals die Produktionsdatenbank.

## Remote-first statt geteilter SQLite-Datei

Der VPS bleibt der Speicherort fuer Project-, Telemetry-, Community-, Device-
Management-, AI-Usage-, Hardware-Catalog-, Hardware-Shop- und Operations-PostgreSQL sowie getrennte Release-/Artefakt-SQLite-Speicher. Lokale
Rechner oeffnen SQLite-Dateien nie direkt und mounten die Docker-Volumes nicht
ueber SMB, NFS oder SSHFS.

- Fuer Arbeit mit dem gemeinsamen Datenstand wird die private PWA verwendet.
- Ein lokal gestarteter kompletter Service-Stack ist eine isolierte
  Testumgebung mit eigener Testpersistenz; AI Usage, Hardware Catalog und
  Hardware Shop werden dabei explizit fluechtig im In-Memory-Modus gestartet.
- Ein lokaler Identity Server darf im beschriebenen Remote-Dev-Modus direkt
  die zentrale Identity-PostgreSQL-Datenbank verwenden. Er schreibt niemals in
  eine entfernte SQLite-Datei.
- Die Domaenentunnel transportieren HTTP-Anfragen. Nur der dedizierte
  Identity-PostgreSQL-Port wird als Datenbankverbindung weitergereicht.
- Das bisherige Identity-SQLite wird beim VPS-Upgrade einmalig und idempotent
  nach PostgreSQL importiert und danach nicht parallel weitergeschrieben.
- Die bisherigen Project-SQLite-Bestaende werden beim VPS-Upgrade einmalig
  und idempotent nach Project-PostgreSQL importiert; Entwicklungsrechner
  greifen weiterhin ausschliesslich ueber das Project-Server-API darauf zu.

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
