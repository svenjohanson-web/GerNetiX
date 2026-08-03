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

| Lauf | Job-ID | PlatformIO-Lauf | Gesamtbeobachtung | Ergebnis |
| --- | --- | ---: | ---: | --- |
| kalter Cache | `mac-arm64-smoke-20260802-01` | 191,14 s | Bootstrap inklusive Toolchain- und Framework-Downloads; kein CPU-Benchmark | erfolgreich |
| warmer Cache | `mac-arm64-smoke-20260802-02` | 0,55 s | ca. 15,14 s | erfolgreich |

Beide Laeufe erzeugten dieselbe reproduzierbare Build-ID
`af8e3aa2c60668d09d0f038b0dc35d80de87647b0d94499a99bbe1e9a043f224`
und sechs zentral persistierte Artefakte. Deren Gesamtgroesse lag bei rund
14,7 MB. Beim warmen Lauf entfielen damit rund 14 Sekunden auf die zentrale
Artefakt-Persistierung ueber WireGuard. Fuer warme Builds ist im aktuellen
Pfad folglich der Artefakttransport und nicht die CPU der erste gemessene
Engpass. Dieser Messwert begruendet einen spaeteren gestreamten ArtifactStore;
er ersetzt noch keinen Zwei-Rechner- oder Dauerlastnachweis.

### Basissoftware-Benchmark

Anschliessend wurde die reale GerNetiX-FULL-Basissoftware fuer `esp32dev` mit
ESP-IDF gebaut. Globale Toolchains blieben vorhanden; vor dem Vollbuild wurde
nur der projektbezogene Zwischenbuild-Cache geleert. Das BuildPackage wurde
mit dem produktionsnahen `composeEsp32BasissoftwarePackage` erzeugt und
enthielt einen minimalen Projekt-Hook. Alle erfolgreichen Laeufe erzeugten die
identische ELF-Build-ID
`caacd3a37eede73eb41f59815501f9230c6f7a2af8223e52baf6b1428441720d`.

| Lauf | Job-ID | PlatformIO | zentrale Artefaktphase | Gesamtjob |
| --- | --- | ---: | ---: | ---: |
| sauberer Vollbuild | `mac-basissoftware-esp32dev-clean-20260802-03` | 33,95 s | 13,43 s | 48,28 s |
| warm 1 | `mac-basissoftware-esp32dev-warm-20260802-01` | 7,29 s | 22,50 s | 30,76 s |
| warm 2 | `mac-basissoftware-esp32dev-warm-20260802-02` | 6,67 s | 17,88 s | 25,54 s |
| warm 3 | `mac-basissoftware-esp32dev-warm-20260802-03` | 6,57 s | 13,42 s | 20,59 s |

Der Warm-Median liegt bei 6,67 Sekunden fuer PlatformIO, 17,88 Sekunden fuer
die zentrale Artefaktphase und 25,54 Sekunden fuer den Gesamtjob. Pro Warmjob
wurden 11.736.440 Bytes in fuenf Artefakten persistiert; der saubere Lauf
erzeugte wegen des groesseren Build-Logs 11.816.877 Bytes. Die Messung trennt
die Artefaktphase zeitlich, aber noch nicht Dateilesen, Hashing,
WireGuard-Transport und sequentielle PostgreSQL-Inserts voneinander.

Der erste Benchmarkversuch deckte ausserdem eine reale BuildPackage-Luecke
auf: Projekte ohne zusaetzliche oeffentliche Header erzeugten kein
`include/user_project`, obwohl CMake dieses Include-Verzeichnis verlangt. Der
Paketierer legt in diesem Fall nun eine neutrale `.gernetix-keep`-Datei an; der
zugehoerige Contract-Test ist bestanden. Zwei vor der Reparatur fehlgeschlagene
technische Benchmarkjobs bleiben als Fehlernachweis erhalten.

### ArtifactStore-Optimierungsbenchmark vom 3. August 2026

Nach der Umstellung auf einmaliges Lesen und Hashing sowie einen gemeinsamen
PostgreSQL-Insert wurde derselbe produktionsnahe Benchmark erneut auf
`mac-worker-01` ausgefuehrt. Ein Aufwaermlauf und drei Messlaeufe verwendeten
dasselbe Projekt- und Softwareziel, aber eindeutige Job-IDs. Alle vier Builds
erzeugten dieselbe ELF-Build-ID
`06682da27fd6a7a742a7ab6895c5fad689b5d1d01ba495bb61de1c19687d35f1`.

| Lauf | PlatformIO und Paketphase | zentrale Artefaktphase | Gesamtjob | Artefakte |
| --- | ---: | ---: | ---: | ---: |
| warm 1 | 6,708 s | 11,074 s | 18,357 s | 11.737.248 Bytes |
| warm 2 | 6,694 s | 11,848 s | 19,134 s | 11.737.248 Bytes |
| warm 3 | 6,388 s | 12,041 s | 18,902 s | 11.737.248 Bytes |

Der neue Median liegt bei 6,694 Sekunden fuer PlatformIO und Paketphase,
11,848 Sekunden fuer die zentrale Artefaktphase und 18,902 Sekunden fuer den
Gesamtjob. Gegenueber dem vorherigen Median sinkt die Artefaktphase damit um
33,7 Prozent und der Gesamtjob um 26,0 Prozent. Die Kompilierzeit bleibt
praktisch unveraendert.

Die neue Phasenmessung lokalisiert den verbleibenden Engpass eindeutig: Lesen
und SHA-256-Berechnung benoetigten im Warm-Median zusammen rund 9 Millisekunden,
der gebuendelte PostgreSQL-Insert dagegen 11,705 Sekunden. Das Batching ist
damit wirksam, beseitigt aber nicht die dominante Uebertragung des rund
10,61-MiB-ELF ueber WireGuard. Der vorgeschlagene komprimierte beziehungsweise
streamende ArtifactStore bleibt fachlich priorisiert.

### Streaming-ArtifactStore ab 3. August 2026

Der private Worker schreibt Artefakt-BLOBs standardmaessig nicht mehr direkt
ueber den entfernten PostgreSQL-Port. `BUILD_ARTIFACT_PERSISTENCE_BACKEND=http`
aktiviert den neuen Pfad: Der Worker berechnet SHA-256 und Originalgroesse beim
einmaligen Lesen, komprimiert ELF, HEX, Map und Build-Log lokal mit Gzip und
streamt jede Datei mit einem separaten Bearer-Secret ueber
`BUILD_ARTIFACT_UPLOAD_BASE_URL` zum zentralen Build-Service. Binaries fuer
Bootloader, Partitionen und Firmware bleiben unkomprimiert.

Der Worker-Container ordnet den TLS-Namen `build.gernetix.com` ueber
`BUILD_ARTIFACT_UPLOAD_HOST_ADDRESS` der privaten WireGuard-Adresse des
zentralen Ingress zu. Der HTTPS-Name bleibt dadurch unveraendert und die
Zertifikatspruefung aktiv; die absichtlich gesperrte oeffentliche VPS-Adresse
wird nicht verwendet.

Der zentrale Dienst nimmt Uploads nur fuer erlaubte Artefaktnamen an, begrenzt
komprimierte und dekomprimierte Groesse, verifiziert Hash und Groesse und haelt
Teiluploads im technischen Staging unsichtbar. Erst der abschliessende
Finalize-Aufruf ersetzt den Artefaktsatz eines Jobs in einer gemeinsamen
PostgreSQL-Transaktion. Staging-Reste werden nach einer Stunde entfernt.
Downloads, OTA und ELF-Symbolisierung erhalten weiterhin die unveraenderten
Bytes. `deployable`, `symbols` und `diagnostic` werden 90, 30 beziehungsweise
14 Tage aufbewahrt.

Der Betriebs-Rollback besteht ausschliesslich darin, auf dem betroffenen Worker
`BUILD_ARTIFACT_PERSISTENCE_BACKEND=postgres` zu setzen; Koordination und
oeffentliche Download-URLs aendern sich nicht. Der neue Pfad ist lokal durch
Streaming-, Kompressions-, Integritaets-, Authentifizierungs-, atomare
Finalize- und Rollback-Tests abgenommen. Ein erneuter realer ARM-/VPS-Benchmark
erfordert den separaten Staging-Rollout und steht noch aus.

Die sichere Rollout-Reihenfolge ist zentral vor extern: Zuerst wird der zentrale
Build-Service mit der rueckwaertskompatiblen PostgreSQL-Schemaerweiterung, dem
Upload-Secret und dem Ingress deployt. Danach wird der Worker erneut mit
`node tools/register-build-worker.js` registriert; das Werkzeug uebernimmt das
bereits auf dem VPS erzeugte Secret in die lokale, auf Modus `0600` begrenzte
Worker-Env, ohne es in Kommandozeile oder Ausgabe zu schreiben. Erst danach wird
der Worker mit Backend `http` neu erstellt. Alte Worker koennen waehrenddessen
weiter den PostgreSQL-Pfad verwenden.

Als lokaler Vorab-Benchmark diente das reale 10.661.536-Byte-ESP32-ELF aus
dem inkrementellen Build-Cache. Nach einem Aufwaermlauf benoetigten fuenf
Hash-/Gzip-Laeufe 79,441/78,253/77,641/77,384/78,231 Millisekunden; der Median
lag bei 78,231 Millisekunden. Die gespeicherte und zu uebertragende Groesse
sank reproduzierbar auf 4.207.847 Bytes, also um 60,53 Prozent. Das ist noch
kein Netz- oder PostgreSQL-End-to-End-Nachweis, zeigt aber, dass die lokale
Kompressionsarbeit gegenueber dem zuvor gemessenen 11,705-Sekunden-Remote-
Insert klein ist und fuer das dominante ELF deutlich weniger Nutzlast erzeugt.
