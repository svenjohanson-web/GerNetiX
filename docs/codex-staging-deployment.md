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
Runtime PostgreSQL:  127.0.0.1:25432
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

Der erste Prozess stellt innerhalb von WireGuard die SSH-Weiterleitungen bereit. Der zweite startet nur Identity auf `127.0.0.1:4300`, verwendet `gernetix_runtime` und ruft Project, Build, Device, Shop, Usage, AI Context, Community und Telemetrie ueber deren getunnelte VPS-Dienste auf. Auf macOS wird AI Usage lokal auf `5001` weitergereicht, weil Port `5000` durch das System belegt sein kann.

Alle lokalen Tunnelenden sind ausdrücklich an IPv4-Loopback `127.0.0.1`
gebunden. Ist einer der Remote-Dev-Ports bereits durch einen lokalen Dienst
belegt, muss der Tunnel vollständig und sichtbar abbrechen. Ein gemischter
Betrieb, bei dem Identity einzelne Domaenen versehentlich lokal und andere auf
Staging anspricht, ist unzulässig; insbesondere dürfen Projekte dadurch nicht
unbemerkt in einer lokalen SQLite statt im zentralen Project-PostgreSQL landen.

Im Remote-Dev-Modus legt Identity keine lokalen SQLite-Dateien an. Releases,
Account-Assets, Push-, SMTP- und LLM-State verwenden ihre zentralen Tabellen in
`gernetix_runtime`. Schreibende Tests wirken deshalb auf den gemeinsamen
Entwicklungsstand und duerfen niemals gegen Produktion laufen.

Lokale Codeaenderungen an `4300` benoetigen dadurch weder Commit noch Staging-Deployment. Der gemeinsame Datenstand ist aber real: Tests und manuelle Aenderungen koennen andere Entwicklungsrechner beeinflussen. Diese Betriebsart darf deshalb nur eine getrennte Entwicklungs-/Staging-Datenbank verwenden, niemals die Produktionsdatenbank.

## Remote-first statt geteilter SQLite-Datei

Der VPS bleibt der Speicherort fuer die eine zentrale PostgreSQL-Datenbank
`gernetix_runtime`. Sie enthaelt alle Domaenen-, Release-, Asset- und
Artefaktdaten in getrennten Tabellen. Lokale
Rechner oeffnen SQLite-Dateien nie direkt und mounten die Docker-Volumes nicht
ueber SMB, NFS oder SSHFS.

- Fuer Arbeit mit dem gemeinsamen Datenstand wird die private PWA verwendet.
- Ein lokal gestarteter kompletter Service-Stack ist eine isolierte
  Testumgebung mit eigener Testpersistenz; AI Usage, Hardware Catalog und
  Hardware Shop werden dabei explizit fluechtig im In-Memory-Modus gestartet.
- Ein lokaler Identity Server darf im beschriebenen Remote-Dev-Modus direkt
  die zentralen Identity-Tabellen in `gernetix_runtime` verwenden. Er schreibt niemals in
  eine entfernte SQLite-Datei.
- Die Domaenentunnel transportieren HTTP-Anfragen. Nur der dedizierte
  Runtime-PostgreSQL-Port wird als Datenbankverbindung weitergereicht.
- Das bisherige Identity-SQLite wird beim VPS-Upgrade einmalig und idempotent
  nach PostgreSQL importiert und danach nicht parallel weitergeschrieben.
- Die bisherigen Project-SQLite-Bestaende werden beim VPS-Upgrade einmalig
  und idempotent nach Project-PostgreSQL importiert; Entwicklungsrechner
  greifen weiterhin ausschliesslich ueber das Project-Server-API darauf zu.

Beim ersten Rollout der zentralen Datenbank muessen die bisherigen
`*_POSTGRES_PASSWORD`-Eintraege noch in `.env.vps` erhalten bleiben. Der
Deployment-Ablauf erkennt laufende alte Domaenencontainer, bricht bei einem
fehlenden Legacy-Secret ab, konsolidiert deren Daten idempotent nach
`gernetix_runtime` und entfernt die alten Container erst danach. Die alten
Volumes werden nicht geloescht und bleiben bis zu einem nachgewiesenen Backup-
und Restore-Test als Rueckfallstand erhalten.
- Die bisherigen getrennten PostgreSQL- und SQLite-Bestaende werden
  einmalig in `gernetix_runtime` zusammengefuehrt. Alte Volumes sind dabei nur
  fuer den Migrationscontainer read-only sichtbar.
- Der bisherige AI-Usage-Bestand aus der gemeinsamen Runtime-SQLite wird
  einmalig transaktional nach AI-Usage-PostgreSQL importiert; danach erfolgt
  jeder Zugriff ausschliesslich ueber das AI-Usage-API.
- Der bisherige Hardware-Catalog-Bestand aus der gemeinsamen Runtime-SQLite
  wird einmalig transaktional nach Hardware-Catalog-PostgreSQL importiert.
  Entwicklungsrechner greifen weiterhin nur ueber das private Katalog-API zu.
- Der bisherige Hardware-Shop-Bestand aus der gemeinsamen Runtime-SQLite wird
  einmalig transaktional nach Hardware-Shop-PostgreSQL importiert. Angebote,
  Warenkoerbe, Bestellungen und Purchase Contexts werden danach nur ueber das
  Shop-API verwendet.
- Admin-Consents, Audit-, Systemereignisse und Schnittstellenstatistik werden
  einmalig nach Operations-PostgreSQL importiert. Danach besitzt die
  Runtime-SQLite keinen produktiven Schreiber mehr.

## Neue Wissenskapitel auf Staging pruefen

Neue Wissenskapitel, die einen Nutzerhinweis ausloesen sollen, werden mit stabiler
Kapitel-ID, Inhaltsversion, Veroeffentlichungszeitpunkt und erforderlichen
Entitlements im versionierten Release-Manifest des Identity Servers eingetragen.
Das Deployment uebertraegt damit nur Code und Manifest aus dem bereits gepushten
Commit. Es kopiert keine lokalen Lesestaende auf den VPS.

Identity vergleicht das Manifest bei einer angemeldeten Plattformabfrage mit den
accountgebundenen Lesestaenden in Identity-PostgreSQL:

- Nur Konten mit allen fuer das Kapitel erforderlichen Entitlements sehen den Hinweis.
- Das Dashboard fasst alle ungelesenen Veroeffentlichungen in einer Benachrichtigung zusammen; es wird dadurch keine E-Mail und kein Web-Push versendet.
- Ein Klick auf die Benachrichtigung oeffnet die entitlement-gefilterte Historie des Wissensspeichers mit Veroeffentlichungsdatum, Version und Lesestatus. Das reine Oeffnen der Historie markiert nichts als gelesen.
- Erst beim ausdruecklichen Oeffnen eines Kapitels aus Historie oder Inhaltsverzeichnis speichert Identity dessen aktuelle Version als gesehen.
- Eine spaetere neue Inhaltsversion wird im Manifest ergaenzt statt der frueheren Version ersetzt. So bleibt sie in der Historie erhalten und kann denselben Account erneut informieren.
- Staging- und Produktionsdatenbanken besitzen getrennte Lesestaende. Ein Staging-Test nimmt daher keinen Produktionshinweis vorweg.
- Der lokale Remote-Dev-Modus schreibt absichtlich in die gemeinsame Staging-Datenbank. Fuer wiederholbare Tests ist ein dafuer bestimmtes Staging-Konto oder eine isolierte lokale SQLite zu verwenden.

Ein neues Kapitel gilt erst als veroeffentlicht, wenn Inhalt und Release-Manifest
im selben sauberen, gepushten Commit liegen. Ein Staging-Test erfolgt danach ueber
den normalen Deployment-Befehl; direkte SQL-Seeds oder kopierte SQLite-Dateien
sind dafuer nicht zulaessig.

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

Nach erfolgreicher Vorpruefung vergleicht der Server den bisher deployten Commit
mit dem neuen Ziel-Commit und waehlt den kleinsten sicheren Ablauf:

- Reine Doku-, Modell-, Graph- oder Testaenderungen erfordern keinen
  Container-Neustart.
- Aenderungen innerhalb eines oder mehrerer Domaenendienste bauen das gemeinsame
  Node-Image genau einmal, erstellen nur die betroffenen Container neu und
  pruefen nur deren direkten Healthcheck. Bei Identity-Aenderungen werden
  zusaetzlich Nginx neu gebunden und der private PWA-Endpunkt geprueft.
- Infrastruktur-, Compose-, Dockerfile-, Migrations- oder nicht eindeutig
  zuordenbare Aenderungen verwenden immer den vollstaendigen Sicherheitslauf.
- Fehlt der vorherige Commit oder ist die Commit-Historie nicht linear, gilt
  ebenfalls der vollstaendige Lauf als sicherer Rueckfall.

Der vollstaendige Ablauf fuehrt weiterhin automatisch aus:

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
Die paketabhaengigen Docker-Layer liegen vor den Quellcode-Layern. Ein normaler
Codewechsel fuehrt deshalb nicht erneut alle `npm ci`-Installationen aus.

## Regeln fuer Codex

- Nur deployen, wenn der Nutzer Staging, Server-Test oder VPS-Deployment ausdruecklich verlangt.
- Vorher relevante lokale Tests ausfuehren und den Nutzer ueber den bevorstehenden Staging-Eingriff informieren.
- Ausschliesslich `node tools/staging-deploy.js` verwenden; keine parallelen manuellen `git pull`-/Compose-Varianten erfinden.
- Fuer einen angeforderten Admin-Zugriff ausschliesslich `node tools/connect-staging.js` verwenden.
- Vor Staging-Deployment oder Admin-Zugriff den WireGuard-Tunnel pruefen; keinen oeffentlichen SSH-Fallback einrichten.
- Niemals `docker compose down -v`, Volume-Loeschungen oder SQLite-Kopien ausfuehren.
- Ein fehlgeschlagenes Deployment anhand der ersten konkreten Fehlerausgabe diagnostizieren; keine wiederholten Startvarianten ausprobieren.
- Production ist nicht Staging. Dieses Tool darf nicht fuer Production-Ziele verwendet werden.
