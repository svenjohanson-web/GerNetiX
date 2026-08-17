# Codex-Arbeitsanweisung: Staging-Deployment

## Ziel

Der gleiche, kurze Deployment-Ablauf funktioniert aus einem GerNetiX-Checkout auf macOS, Windows und Linux. Die lokale Development-Umgebung bleibt davon unberuehrt.

Standardbefehl:

```text
node tools/staging-deploy.js
```

Das Tool deployt exakt den aktuellen, bereits gepushten Git-Commit auf den Staging-VPS. Es uebertraegt keine lokalen Dateien per SCP und kopiert keine lokale SQLite-Datei auf den Server.

## Verbindliche Begriffe

- **Lokal testen** bedeutet: Code und UI auf dem Entwicklungsrechner pruefen. Das aendert weder GitHub noch den VPS.
- **Git stagen** bedeutet ausschliesslich `git add`: Dateien fuer einen Commit vormerken. Das ist kein Server-Deployment.
- **Committen und pushen** veroeffentlicht einen Quellstand im Git-Repository. Der VPS bleibt unveraendert.
- **Deployment-Plan** liest den aktuellen VPS-Commit und zeigt den kleinsten sicheren Zielablauf. Er aendert keine Container oder Laufzeitdaten.
- **Auf Staging deployen** aktualisiert den privaten Staging-VPS auf einen bereits gepushten Commit.
- **Production deployen** ist ein eigener, hier nicht autorisierter Prozess.

## Verbindlicher Entscheidungsablauf

| Aenderung oder Ziel | Zuerst | VPS-Deployment |
| --- | --- | --- |
| Identity-UI, Route, Browserlogik oder Hardware-Assistent entwickeln | gezielte Tests; bei interaktiver Pruefung lokaler Identity-Remote-Dev-Modus | nicht automatisch; nur bei ausdruecklichem Staging-Auftrag oder notwendigem VPS-Nachweis |
| Servicecode ohne VPS-spezifische Abhaengigkeit | Unit-/Contract-Tests des betroffenen Dienstes | nur fuer Integration, gemeinsamen Datenstand oder ausdrueckliche Abnahme |
| Zusammenspiel mit zentraler PostgreSQL, Passkeys, privatem DNS, TLS oder mehreren VPS-Diensten | lokale Tests, danach Deployment-Plan | Staging ist fuer den Endnachweis erforderlich |
| Nginx- oder Edge-Assets | lokale Konfigurations-/Contract-Tests | gezieltes Edge-Reload, kein pauschaler Full-Deploy |
| Host-Firewall | lokaler Syntax-/Contract-Test | gezielte validierte Firewall-Aktualisierung |
| Compose, Docker-Basis, Persistenz, Migration oder unbekannte Runtime-Datei | passende lokale Tests und bewusste Risikoabnahme | vollstaendiger Sicherheitslauf |
| Nur Doku, Modelle, Graph oder Tests | lokale Pruefung | kein Container-Neustart |

Damit gilt fuer den am haeufigsten bearbeiteten Identity Server verbindlich:

> Lokal zuerst. Commit und Push erst nach bestandenem lokalen Nachweis. Auf den VPS nur auf ausdruecklichen Wunsch oder wenn die geaenderte Funktion technisch nur dort belastbar geprueft werden kann.

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
Das SSH-Ziel muss auf die private WireGuard-Adresse oder einen entsprechenden lokalen SSH-Alias zeigen. Oeffentliche SSH-Ziele sind fuer Staging-Administration nicht zulaessig. Der Desktop-Prozessmonitor verwendet dafuer den dedizierten Benutzer `gernetix-monitor`, nicht `root`.

Der dauerhafte Diagnose-/Datenbanktunnel verwendet weiterhin `GERNETIX_STAGING_SSH`.
Die kurzen Prozessmonitor-Abfragen verwenden dagegen das getrennte
`GERNETIX_STAGING_MONITOR_SSH` und dürfen keine Portweiterleitungen aufbauen.
Der Benutzer `gernetix-monitor` besitzt keine interaktive Shell, kein Passwort und
keinen Docker-Gruppenzugriff. Der Monitor darf ausschliesslich das root-eigene,
read-only Diagnoseprogramm `/usr/local/sbin/gernetix-monitor-diagnostic` ueber
eng begrenzte `sudoers`-Eintraege ausfuehren. Das Programm akzeptiert nur die
Kommandos `security`, `compose-ps`, `link-integrity` und
`user-action-alerts`. Die Installation muss
vor der Umstellung mit `visudo` validiert werden; ein Root-Login fuer den Monitor
ist danach nicht mehr erforderlich.

## Private Plattform und internen Staging-Admin verwenden

Die normale Nutzung erfolgt nach aktiviertem WireGuard direkt ueber:

```text
https://pwa.gernetix.com/app/dashboard/
```

Das WireGuard-Clientprofil muss dabei `10.77.0.1` als DNS-Server verwenden.
Der private Resolver liefert `pwa.gernetix.com`, `build.gernetix.com` und
`mqtt.gernetix.com` als `10.77.0.1` aus und leitet andere DNS-Anfragen weiter.
Ohne diese Einstellung liefert der oeffentliche DNS absichtlich die
oeffentliche ACME-Adresse, auf der kein privater HTTPS-Listener erreichbar ist.
WireGuard uebertraegt diese Einstellung nicht serverseitig; sie muss in jedem
Clientprofil gesetzt beziehungsweise beim Import enthalten sein:

```ini
[Interface]
DNS = 10.77.0.1
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
Build-Worker-Pool:   http://127.0.0.1:14400/health
Forgejo Git:         http://127.0.0.1:13300/
Hardware Catalog:   http://10.77.0.1:4910/api/hardware-catalog/
```

Das Terminal bleibt fuer die Dauer des SSH-Tunnels geoeffnet. `Strg+C` beendet die Verbindung. Der SSH-Tunnel laeuft innerhalb des WireGuard-VPN; der VPS benoetigt keinen Browser, und weder SSH noch der Admin-Port werden oeffentlich freigegeben.
Forgejo bindet auf dem VPS ausschliesslich an `127.0.0.1:3300`; der lokale Port
`127.0.0.1:13300` ist nur durch diesen privaten Tunnel erreichbar. Direkte
Clone- und Push-URLs verwenden deshalb den lokalen Tunnel und niemals einen
oeffentlichen Forgejo-Host.
Der lokale PostgreSQL-Port wird durch den SSH-Tunnel auf die WireGuard-gebundene VPS-Adresse `10.77.0.1:25432` weitergeleitet. Reine IDE-Builds verwenden getrennt davon `127.0.0.1:14400` und erreichen damit den VPS-internen Build-Worker-Pool; `127.0.0.1:4400` bleibt der zentrale Build-&-Deploy-Worker fuer OTA-, FlashBox- und USB-Auftraege. Der Hardware Catalog bleibt ebenfalls privat und ist ueber die feste WireGuard-Adresse `10.77.0.1:4910` erreichbar; ein lokaler Hardware-Catalog-Prozess und ein SSH-Tunnel fuer den Katalog sind nicht erforderlich.

## Lokale Identity-Runtime ohne lokale Persistenz

Die kanonischen Identity-Daten liegen ausschliesslich in `gernetix_runtime` auf PostgreSQL. Fuer schnelle Entwicklungszyklen darf Identity lokal auf `127.0.0.1:4300` laufen. `tools/start-identity-remote-dev.js` erzwingt dabei PostgreSQL und verbindet die Datenbank sowie die Domaenendienste ueber den beschriebenen SSH-/WireGuard-Tunnel. Eine lokale Identity-SQLite oder lokale Account-/Session-Persistenz ist nicht zulaessig.

Verbindlicher lokaler Identity-Ablauf:

1. Gezielte Identity-Tests ausfuehren, ohne einen Server vorsorglich neu zu starten:

   ```text
   cd services/identity-server
   npm test
   ```

2. Nur fuer eine interaktive Browserpruefung den vorhandenen privaten Tunnel in einem Terminal oeffnen:

   ```text
   node tools/connect-staging.js
   ```

3. In einem zweiten Terminal genau den kontrollierten Starter verwenden:

   ```text
   node tools/start-identity-remote-dev.js
   ```

4. Unter `http://127.0.0.1:4300/app/dashboard/` pruefen. Ein bereits korrekt laufender Prozess wird nicht vorsorglich neu gestartet.

Dieser Modus fuehrt lokalen Identity-Code aus, verwendet aber ausschliesslich die zentrale PostgreSQL-Wahrheit und die kontrolliert angebundenen Domaenendienste. Direkte Starts mit freier Runtime-Konfiguration oder lokaler Identity-SQLite sind unzulaessig.

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
- Nur der kontrollierte lokale Identity-Remote-Dev-Prozess ist zulaessig. Er verwendet denselben PostgreSQL-Vertrag wie die Server-Identity; lokale SQLite-, Parallel- oder frei konfigurierte Identity-Prozesse sind nicht zulaessig.
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
- Servernahe Tests verwenden die private Staging-PWA. Isolierte Repository-Tests duerfen temporaere SQLite-Dateien verwenden, starten daraus aber niemals die Identity-Runtime.

Ein neues Kapitel gilt erst als veroeffentlicht, wenn Inhalt und Release-Manifest
im selben sauberen, gepushten Commit liegen. Ein Staging-Test erfolgt danach ueber
den normalen Deployment-Befehl; direkte SQL-Seeds oder kopierte SQLite-Dateien
sind dafuer nicht zulaessig.

Nur die Konfiguration pruefen, ohne eine Verbindung aufzubauen:

```text
node tools/connect-staging.js --dry-run
```

## Normaler Ablauf

1. Lokal entwickeln und mit den kleinstmoeglichen gezielten Tests pruefen.
2. Identity bei Bedarf lokal im Remote-Dev-Modus interaktiv pruefen.
3. Vor Commit und Push die schnelle lokale Runtime-Vorpruefung ausfuehren:

```text
node tools/verify-staging-runtime.js
```

Sie prueft deklarierte npm-Laufzeitpakete, alle Docker-COPY-Quellen und die aus
dem Identity-Startpfad statisch erkannten Workspace-Abhaengigkeiten gegen den
tatsaechlichen Inhalt des schlanken Identity-Images. Eine fehlende Datei stoppt
damit lokal, bevor ein unvollstaendiger Commit auf dem VPS gebaut wird.

4. Erst nach bestandener Vorpruefung Aenderungen bewusst mit `git add` fuer den Commit vormerken, committen und den aktuellen Branch pushen.
5. Nur bei beabsichtigtem VPS-Test den lesenden Deployment-Plan abrufen:

```text
node tools/staging-deploy.js --plan
```

6. Nur wenn der Nutzer das Staging-Deployment ausdruecklich verlangt und der Plan plausibel ist, deployen:

```text
node tools/staging-deploy.js
```

Vorab pruefen, ohne SSH oder VPS-Aenderung:

```text
node tools/staging-deploy.js --dry-run
```

`--dry-run`, `--plan` und der echte Lauf starten immer mit derselben lokalen
Runtime-Vorpruefung. Erst danach validiert `--dry-run` den lokalen Git-Stand und
zeigt den SSH-Befehl. `--plan` liest zusaetzlich den aktuell deployten
VPS-Commit, berechnet die Commit-Differenz und nennt Modus, Dienste,
Edge-/Firewall-Aktionen und den Grund fuer einen Full-Deploy. Jeder echte
Deployment-Lauf zeigt diesen Plan automatisch vor der ersten VPS-Aenderung.

Wenn eine geschuetzte VPS-Konfiguration ohne Git-Runtime-Diff bewusst in alle
Container uebernommen werden muss, kann nach ausdruecklicher Freigabe zuerst
`node tools/staging-deploy.js --plan --force-full` und danach genau einmal
`node tools/staging-deploy.js --force-full` verwendet werden. Der Orchestrator
uebergibt dabei absichtlich eine nicht existierende vorherige Commit-ID, damit
auch der serverseitige Klassifizierer garantiert den vollstaendigen Ablauf
waehlt; lokale und entfernte Plananzeige duerfen sich nicht widersprechen.

Das Tool bricht ab, wenn:

- der lokale Arbeitsbaum nicht sauber ist,
- der aktuelle Commit nicht dem Upstream-Commit entspricht,
- bereits ein anderes Staging-Deployment laeuft,
- SSH-Ziel oder Branch ungueltige Zeichen enthalten,
- die VPS-Arbeitskopie lokale Aenderungen besitzt,
- Compose-Konfiguration, Build oder Healthchecks fehlschlagen.

## Serverseitiger Ablauf

Nach erfolgreicher Vorpruefung vergleicht der Server den bisher deployten Commit
mit dem neuen Ziel-Commit und waehlt den kleinsten sicheren Ablauf:

- Reine Doku-, Modell-, Graph- oder Testaenderungen erfordern keinen
  Container-Neustart.
- Aenderungen innerhalb eines oder mehrerer Domaenendienste bauen nur die
  benoetigten Runtime-Images, erstellen nur die betroffenen Container neu und
  pruefen nur deren direkten Healthcheck. `recovery-tool`-Aenderungen werden
  wegen des direkten Imports dem Identity Server zugeordnet. Identity besitzt
  fuer den haeufigen UI-/API-Pfad ein eigenes schlankes Image ohne PlatformIO,
  die Abhaengigkeiten der anderen Domaenendienste oder Migrationswerkzeuge. Bei
  Identity-Aenderungen werden HTTP- und HTTPS-Nginx syntaktisch geprueft und
  ohne Containerwechsel neu geladen, damit die neue Identity-Adresse sicher
  aufgeloest wird; danach wird der private PWA-Endpunkt getestet.
- Aenderungen unter `infra/vps/nginx/` verwenden ein gezieltes validiertes
  Edge-Reload. Aenderungen unter `infra/vps/security/` verwenden eine gezielte
  validierte Firewall-Aktualisierung. Beide erzwingen allein keinen Full-Deploy.
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

Auch im vollstaendigen Ablauf werden laufende PostgreSQL-Container nicht mehr
vorsorglich neu erstellt. Die einmalige Legacy-Konsolidierung laeuft nur, wenn
tatsaechlich noch Legacy-PostgreSQL-Container vorhanden sind. Certbot stellt
Zertifikate nur bereit, wenn die erwarteten Zertifikatsdateien fehlen; die
laufende Certbot-Erneuerung bleibt davon unberuehrt. Der Ablauf ist durch eine
VPS-weite Sperre gegen parallele Deployments geschuetzt und gibt am Ende Status
und Gesamtdauer aus. Jede groessere Phase meldet zusaetzlich ihre eigene Dauer,
damit ein langsamer Build, Containerstart oder Healthcheck ohne Wiederholung
des Deployments erkennbar ist.

Persistente Docker-Volumes und vorhandene Werte in `.env.vps` werden nicht geloescht
oder ueberschrieben. Fehlende Compute-, Artifact-Upload- und Forgejo-Secrets erzeugt
der Staging-Ablauf einmalig direkt auf dem VPS, setzt die Env-Datei auf Modus `0600`
und gibt die Werte nicht aus.
Der Bootstrap stellt vor dem Anhaengen ein korrektes Zeilenende sicher und kann
einen bereits ohne Trennzeile angehaengten 64-stelligen Compute-Token reparieren.
Die paketabhaengigen Docker-Layer liegen vor den Quellcode-Layern. Ein normaler
Codewechsel fuehrt deshalb nicht erneut `npm ci` aus. Doku, Modelle und Tests
liegen nicht im Docker-Build-Kontext. Das gemeinsame Node-Image bleibt fuer
die uebrigen Domaenendienste bestehen und wird pro inkrementellem Lauf hoechstens
einmal gebaut.

## Regeln fuer Codex

- Nur deployen, wenn der Nutzer Staging, Server-Test oder VPS-Deployment ausdruecklich verlangt.
- Identity-Aenderungen standardmaessig lokal und mit gezielten Tests pruefen. Ein normaler lokaler UI-/Codeauftrag autorisiert weder Commit/Push noch VPS-Deployment.
- Vor jedem angeforderten Deployment zuerst `node tools/staging-deploy.js --plan` ausfuehren, den Modus und seinen Grund nennen und erst danach genau einmal den normalen Deployment-Befehl ausfuehren.
- Vorher relevante lokale Tests ausfuehren und den Nutzer ueber den bevorstehenden Staging-Eingriff informieren.
- Ausschliesslich `node tools/staging-deploy.js` verwenden; keine parallelen manuellen `git pull`-/Compose-Varianten erfinden.
- Fuer einen angeforderten Admin-Zugriff ausschliesslich `node tools/connect-staging.js` verwenden.
- Vor Staging-Deployment oder Admin-Zugriff den WireGuard-Tunnel pruefen; keinen oeffentlichen SSH-Fallback einrichten.
- Niemals `docker compose down -v`, Volume-Loeschungen oder SQLite-Kopien ausfuehren.
- Ein fehlgeschlagenes Deployment anhand der ersten konkreten Fehlerausgabe diagnostizieren; keine wiederholten Startvarianten ausprobieren.
- Nach einem Fehler nicht blind erneut deployen. Erst die benannte Phase und die bereits ausgegebenen Logs auswerten; derselbe unveraenderte Befehl wird erst nach behobener Ursache wiederholt.
- Production ist nicht Staging. Dieses Tool darf nicht fuer Production-Ziele verwendet werden.
