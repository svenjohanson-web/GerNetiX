# GerNetiX Build-Worker auf Linux, macOS und Windows

## Ziel

Ein zusaetzlicher Linux-Rechner, Mac oder Windows-Rechner mit Docker Desktop und Linux-Containern kann reine Firmware-Builds und Prebuilds fuer GerNetiX uebernehmen. BuildJob-Status, Abbruchanforderungen, Artefakte, Ziel-Locks und Cache-Generationen liegen zentral in PostgreSQL. Der Rechner besitzt nur einen lokalen, jederzeit loeschbaren Build-Cache.

OTA-, FlashBox- und USB-Auftraege werden bewusst nicht auf externe Worker verteilt. Sie bleiben auf dem zentralen Build-&-Deploy-Server, damit MQTT-Zugang und OTA-Signierschluessel nicht auf weitere Rechner kopiert werden muessen.

Der Dispatcher kann schnelle Worker als Primaerziel fuehren. Solange ein solcher Worker gesund erreichbar ist, gehen Build-Auftraege dorthin. Der zentrale VPS-Builder und optionale weitere Worker bilden den automatischen Rueckfallpool. Fuer den aktuellen Mac wird auf dem VPS `BUILD_WORKER_PRIMARY_UPSTREAMS=10.77.0.5:4400` gesetzt.

Dieser Vertrag ist der erste produktnahe Compute-Pool von GerNetiX. In der
[elastischen Worker- und Kapazitaetsarchitektur](elastic-worker-capacity-architecture.md)
wird er als Bestandsadapter der Ausfuehrungsklasse `trusted_system` gefuehrt.
Private Worker duerfen den heutigen eingeschraenkten PostgreSQL-Zugang waehrend
der Migration behalten. Neue kurzlebige Cloud-, Kubernetes- und
Projekt-Worker verwenden dagegen ausschliesslich Pull-Leases ueber das Worker
Gateway und erhalten keinen direkten PostgreSQL-Zugang.

Der neue Referenzclient `ComputeGatewayClient` und der `ComputeWorkerAgent` in
`services/compute-control-plane/src/worker-agent.js` bilden diesen Zielpfad
bereits lokal ab: Bootstrap-Registrierung, kurzlebiges Worker-Credential,
Heartbeat, Slotmeldung, Pull-Lease, Lease-Erneuerung, Handler-Allowlist,
Ergebnis/Fehler und Drain. Der Buildvertrag kann reine `build`-/`prebuild`-Jobs
in einen providerneutralen ComputeJob uebersetzen; Deploy, OTA, USB und FlashBox
werden dabei explizit abgewiesen. Die bestehende Build-Worker-CLI nutzt diesen
neuen Pfad noch nicht und bleibt bis zur produktiven Remote-Migration
unveraendert. Der vorhandene Build-&-Deploy-Dienst besitzt inzwischen jedoch
einen optionalen Compute-Pool-Patchpunkt. Dessen lokaler End-to-End-Test laeuft
vom BuildJob ueber einen `trusted_system`-ComputeJob und eine ARM-Worker-Lease
bis zum gefencten Build-Ergebnis; ein Compute-Worker kann dabei weder Deploy,
OTA, USB noch FlashBox einschmuggeln.

## Voraussetzungen

- 64-Bit-Linux, Apple-Silicon-/Intel-Mac oder Windows 11 mit Docker Desktop und Linux-Containern
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

Das Startkommando baut das schlanke Linux-Worker-Image mit PlatformIO 6.1.18 und startet genau einen `build_only`-Container. Auf macOS und Windows läuft derselbe Container in Docker Desktop; der fachliche Worker-Vertrag bleibt dadurch plattformidentisch. Die lokale Volume `build_worker_state` enthaelt nur temporaere Workspaces und technische Caches.

Unter Windows werden dieselben Befehle in PowerShell im Repository ausgefuehrt.
Docker Desktop muss auf Linux-Container gestellt sein; der Befehl
`node tools/build-worker.js doctor --env .env.build-worker.windows.local`
prueft dies, bevor ein Container
gestartet wird. Die Worker-Adresse muss die eigene WireGuard-IPv4 des
Windows-Rechners sein, beispielsweise `10.77.0.20`, und darf weder
`0.0.0.0` noch eine LAN- oder oeffentliche Adresse sein.

Parallele Softwareziele teilen sich heruntergeladene PlatformIO-Toolchains, verwenden aber je Ziel getrennte ESP-IDF-Python-Umgebungen, Component-Caches und Objekt-Caches. Dadurch kann ein kalter Worker mehrere Firmwareziele aufbauen, ohne dass gleichzeitige ESP-IDF-Initialisierungen dieselbe virtuelle Umgebung beschädigen.

## VPS einmalig fuer Worker freigeben

Fuer den aktuellen Mac fuehrt das wiederholbare Einrichtungswerkzeug die folgenden Schritte aus, ohne das erzeugte Worker-Passwort auszugeben:

```text
node tools/register-build-worker.js
```

Danach kann der Worker mit `node tools/build-worker.js start` oder im Desktop-Prozessmonitor gestartet werden.

In `.env.vps`:

```text
RUNTIME_POSTGRES_BIND_ADDRESS=10.77.0.1
BUILD_WORKER_PRIMARY_UPSTREAMS=10.77.0.5:4400
BUILD_WORKER_POSTGRES_PASSWORD=<langes eigenes Worker-Passwort>
```

Mehrere Worker werden kommasepariert eingetragen. Die Host-Firewall erlaubt PostgreSQL-Port `25432` nur ueber `wg0`; der PostgreSQL-Container bleibt ohne diese explizite Einstellung auf Loopback gebunden.

Der VPS legt beziehungsweise aktualisiert daraus automatisch den Login `gernetix_build_worker`. Dieser besitzt ausschliesslich Lese-/Schreibrechte auf Build-Artefakte, Jobregister, Worker-Heartbeats und Cache-Generationen. Schemaaenderungen sowie Identity-, Projekt-, Telemetrie- und weitere Domaenentabellen bleiben gesperrt. Dasselbe Passwort wird auf dem Linux-Rechner als `BUILD_POSTGRES_PASSWORD` eingetragen; das allgemeine Runtime-PostgreSQL-Passwort verlaesst den VPS nicht.

Der interne Build-Router sendet reine Builds zuerst an konfigurierte Primaer-Worker. Mehrere Primaer-Worker werden mit `least_conn` verteilt. Der VPS-Worker und weitere normale Worker dienen als Rueckfall, wenn kein Primaer-Worker erreichbar ist.

Ein zweiter Rechner wird vom Registrierungswerkzeug zum vorhandenen Pool
hinzugefuegt; bestehende Mac-Upstreams werden nicht ersetzt. Fuer die
Uebergangsphase mit direkter PostgreSQL-Koordination kann der Windows-Worker
den bereits eingeschraenkten technischen Login aus der lokalen Mac-Datei
uebernehmen, ohne dass das Kennwort als Kommandozeilenargument erscheint:

```text
node tools/register-build-worker.js --worker-id windows-worker-01 --worker-address 10.77.0.20 --pool primary --local-file .env.build-worker.windows.local --reuse-credentials-from .env.build-worker.local
```

Die erzeugte Datei wird anschliessend ueber einen geschuetzten Kanal auf den
Windows-Rechner uebertragen und dort nicht eingecheckt. Dieser Befehl ist ein
bewusster Staging-/VPS-Eingriff: Er prueft die Compose-Konfiguration,
provisioniert den eingeschraenkten Login und startet nur PostgreSQL und den
Build-Router kontrolliert neu. Er darf daher nicht als normale lokale
Codeaenderung ausgefuehrt werden. Das Worker Gateway ersetzt diesen
gemeinsamen Uebergangslogin spaeter durch kurzlebige, instanzgebundene
Credentials.

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

## Realer ARM-Nachweis vom 2. August 2026

Der bestehende Apple-Silicon-Mac wurde ohne Neustart als laufender,
WireGuard-gebundener Worker `mac-worker-01` geprueft. Zwei identische reine
ESP32-Arduino-Builds liefen erfolgreich; Deploy, OTA, USB und FlashBox waren
jeweils nicht angefordert:

| Lauf | Job-ID | PlatformIO-Kompilierung | Gesamtbeobachtung | Ergebnis |
| --- | --- | ---: | ---: | --- |
| kalter Cache | `mac-arm64-smoke-20260802-01` | 191,14 s | kalter Toolchain-/Cache-Aufbau | erfolgreich |
| warmer Cache | `mac-arm64-smoke-20260802-02` | 0,55 s | ca. 15,14 s | erfolgreich |

Beide Laeufe erzeugten dieselbe reproduzierbare Build-ID
`af8e3aa2c60668d09d0f038b0dc35d80de87647b0d94499a99bbe1e9a043f224`
und sechs zentral persistierte Artefakte. Deren Gesamtgroesse lag bei rund
14,7 MB. Beim warmen Lauf entfielen damit rund 14 Sekunden auf die zentrale
Artefakt-Persistierung ueber WireGuard. Fuer warme Builds ist im aktuellen
Pfad folglich der Artefakttransport und nicht die CPU der erste gemessene
Engpass. Dieser Messwert begruendet einen spaeteren gestreamten ArtifactStore;
er ersetzt noch keinen Zwei-Rechner- oder Dauerlastnachweis.
