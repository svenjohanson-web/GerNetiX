# GerNetiX Linux Build-Worker

## Ziel

Ein zusaetzlicher Linux-Rechner kann reine Firmware-Builds und Prebuilds fuer GerNetiX uebernehmen. BuildJob-Status, Abbruchanforderungen, Artefakte, Ziel-Locks und Cache-Generationen liegen zentral in PostgreSQL. Der Rechner besitzt nur einen lokalen, jederzeit loeschbaren Build-Cache.

OTA-, FlashBox- und USB-Auftraege werden bewusst nicht auf externe Worker verteilt. Sie bleiben auf dem zentralen Build-&-Deploy-Server, damit MQTT-Zugang und OTA-Signierschluessel nicht auf weitere Rechner kopiert werden muessen.

## Voraussetzungen

- 64-Bit-Linux
- Git
- Node.js 18 oder neuer fuer das lokale Bedienwerkzeug
- Docker Engine mit Docker Compose v2
- ein aktiver WireGuard-Peer im privaten GerNetiX-Netz
- ausreichend lokaler SSD-Speicher fuer PlatformIO-Toolchains und Build-Caches

PostgreSQL und der Worker-Port duerfen niemals oeffentlich freigegeben werden. Beide Verbindungen laufen ausschliesslich ueber WireGuard.

## Worker vorbereiten

Im GerNetiX-Checkout:

```text
cp .env.build-worker.example .env.build-worker.local
```

Danach in `.env.build-worker.local` setzen:

- `BUILD_WORKER_ID`: stabile, pro Rechner eindeutige Kennung
- `BUILD_WORKER_BIND_ADDRESS`: private WireGuard-Adresse des Workers
- `BUILD_POSTGRES_HOST`: private WireGuard-Adresse des VPS
- `BUILD_POSTGRES_PASSWORD`: separates Passwort des eingeschraenkten Datenbankkontos `gernetix_build_worker`
- `BUILD_CANCELLATION_POLL_MS`: optionales Reaktionsintervall fuer zentrale Abbruchanforderungen; Standard `500` Millisekunden

Konfiguration, Docker und PostgreSQL-Erreichbarkeit pruefen:

```text
node tools/build-worker.js doctor
```

Worker bauen und starten:

```text
node tools/build-worker.js start
```

Weitere Befehle:

```text
node tools/build-worker.js status
node tools/build-worker.js logs
node tools/build-worker.js stop
```

Das Startkommando baut das schlanke Worker-Image mit PlatformIO 6.1.18 und startet genau einen `build_only`-Container. Die lokale Volume `build_worker_state` enthaelt nur temporaere Workspaces und technische Caches.

## VPS einmalig fuer Worker freigeben

In `.env.vps`:

```text
RUNTIME_POSTGRES_BIND_ADDRESS=10.77.0.1
BUILD_WORKER_UPSTREAMS=10.77.0.20:4400
BUILD_WORKER_POSTGRES_PASSWORD=<langes eigenes Worker-Passwort>
```

Mehrere Worker werden kommasepariert eingetragen. Die Host-Firewall erlaubt PostgreSQL-Port `25432` nur ueber `wg0`; der PostgreSQL-Container bleibt ohne diese explizite Einstellung auf Loopback gebunden.

Der VPS legt beziehungsweise aktualisiert daraus automatisch den Login `gernetix_build_worker`. Dieser besitzt ausschliesslich Lese-/Schreibrechte auf Build-Artefakte, Jobregister, Worker-Heartbeats und Cache-Generationen. Schemaaenderungen sowie Identity-, Projekt-, Telemetrie- und weitere Domaenentabellen bleiben gesperrt. Dasselbe Passwort wird auf dem Linux-Rechner als `BUILD_POSTGRES_PASSWORD` eingetragen; das allgemeine Runtime-PostgreSQL-Passwort verlaesst den VPS nicht.

Nach einer Aenderung dieser VPS-Konfiguration wird der normale, kontrollierte Staging-/Server-Deploymentweg verwendet. Der interne Build-Router verteilt reine Builds mit `least_conn` auf den VPS-Worker und alle eingetragenen Linux-Worker. Fehlerhafte oder nicht erreichbare Worker werden temporaer aus der Auswahl genommen.

## Sicherheitsgrenzen

- Der Worker bindet seinen HTTP-Port nur an seine private IPv4-Adresse. `0.0.0.0` und oeffentliche Adressen weist das Bedienwerkzeug ab.
- Der Worker besitzt keinen MQTT-Zugang und keinen OTA-Signierschluessel.
- Der Worker verwendet einen eigenen PostgreSQL-Login ohne Schema- oder Domaenenzugriff.
- `BUILD_WORKER_ROLE=build_only` weist OTA-, FlashBox- und USB-Auftraege serverseitig ab.
- Der zentrale Build-Endpunkt bleibt fuer Deploy-Auftraege direkt mit dem zentralen Build-&-Deploy-Server verbunden.
- Die `.env.build-worker.local` wird nicht versioniert.
- Dauerhafte Artefakte liegen als BLOBs in PostgreSQL, nicht im lokalen Worker-Volume.

## Einen weiteren Rechner hinzufuegen

1. Neuen WireGuard-Peer anlegen.
2. Repository auf dem Rechner auschecken.
3. `.env.build-worker.local` ausfuellen und `doctor` ausfuehren.
4. Worker starten.
5. dessen private Adresse in `BUILD_WORKER_UPSTREAMS` auf dem VPS ergaenzen.
6. kontrollierten VPS-Rollout und einen Testbuild ausfuehren.

Der Identity-/Dev-Server behaelt einen zentralen Endpunkt. Eine manuelle Rechnerauswahl in der IDE ist nicht erforderlich.
