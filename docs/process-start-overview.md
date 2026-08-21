# GerNetiX Prozess-Startuebersicht

Diese Uebersicht beschreibt, welche lokalen Prozesse fuer welche Entwicklungsziele zu starten sind. Sie ergaenzt die Architektur- und Port-Sicht in [system-process-application-uml.md](system-process-application-uml.md).

Grundregel: Prozesse nur starten oder neu starten, wenn sie fuer die aktuelle Pruefung benoetigt werden. Ports beim Start explizit setzen und vorhandene laufende Prozesse vorher gezielt ueber den Port pruefen.

## Vor dem Start pruefen

Fuer die minimale Plattform kann der Check und Start plattformuebergreifend vom Repo-Root ausgefuehrt werden:

```text
node tools/check-and-wake-processes.js
node tools/check-and-wake-processes.js check
node tools/check-and-wake-processes.js wake
```

Ohne Parameter wird `wake` ausgefuehrt und startet den vollstaendigen isolierten Lokal-Stack. Fuer die normale Remote-Dev-Arbeit ist das nicht erforderlich. `check` veraendert nichts. Laufende Prozesse werden weder beendet noch neu gestartet. Einzelne Dienste lassen sich gezielt auswaehlen:

```text
node tools/check-and-wake-processes.js wake --service=identity-server,admin-tool
```

Hintergrundprozess-Logs liegen unter `.runtime/process-logs/`.

Auf macOS kann alternativ `tools/GerNetiX-Check-und-Start.command` per Doppelklick gestartet werden. Eine Desktop-Verknuepfung kann auf diese Datei zeigen; dadurch bleibt nur eine gepflegte Skriptquelle im Repository.

## Grafischer Prozess-Monitor

Die eigenstaendige Desktop-App bildet den normalen Remote-Dev-Betrieb ab. Sie startet und stoppt den lokalen Identity-Prozess auf Port `4300`; dieser Prozess muss im kontrollierten Remote-Dev-Modus laufen und verwendet ausschliesslich PostgreSQL auf dem VPS. Zusaetzlich kann sie den separat konfigurierten, build-only Docker-Worker auf dem Entwicklungsrechner starten und stoppen. Dieser Worker besitzt nur einen lokalen technischen Build-Cache; Buildjobs, Locks und Artefakte bleiben in PostgreSQL. Die uebrigen Backend- und Infrastrukturprozesse erscheinen read-only aus dem Docker-Compose-Status des VPS. Der Monitor erkennt eine Identity mit falschem Persistenzmodus und behandelt sie nicht als gesund.

- macOS-App: `tools/process-monitor/GerNetiX Prozess-Monitor.app`
- macOS-Entwicklung: `tools/process-monitor/GerNetiX-Prozess-Monitor.command`
- Windows: `tools/process-monitor/GerNetiX-Prozess-Monitor.cmd`
- Entwicklung: im Ordner `tools/process-monitor` mit `pnpm start`

Der Desktop-Prozessmonitor besitzt neben der Prozesssicht eine persistierte `Schnittstellen-Statistik`. Der Identity Server protokolliert seine ausgehenden GerNetiX-Serviceaufrufe sowie OpenAI-/Claude-/Ollama-Aufrufe in `gernetix_external_interface_calls` innerhalb der gemeinsamen Runtime-SQLite. Der Build-&-Deploy-Server erfasst dort zusaetzlich MQTT `PUBLISH`, `SUBSCRIBE` und empfangene Nachrichten; Device-Kennungen werden im Topic vor dem Speichern durch `{device}` ersetzt. Die Ansicht aggregiert fuer die letzten 24 Stunden Aufrufe, Fehler, mittlere/maximale Dauer und den letzten Aufruf je Quelle-Ziel-Verbindung. Monitor-Healthchecks werden nicht mitgezaehlt. Das Schema ist dienstuebergreifend, sodass weitere Services dieselbe Telemetrie spaeter ebenfalls schreiben koennen.

Die read-only Sicht `Links` zeigt zusätzlich das zentrale Operations-Inventar und den letzten Link-Prüfnachweis. Der Monitor greift nicht direkt auf PostgreSQL zu. Sein Main-Prozess führt über den festen SSH-/WireGuard-Diagnoseweg ein versioniertes Leseskript im Admin-Tool-Container aus; dieses ruft die autorisierte Admin-Tool-API auf. Das Admin-Token bleibt im Container und der isolierte Renderer erhält ausschließlich die benötigten Statusfelder.

Die Community Platform wird im normalen Remote-Dev-Betrieb ausschliesslich als VPS-Dienst dargestellt. Der Desktop-Monitor liest deshalb keine lokale Community-SQLite als aktuellen Betriebszustand. Isolierte lokale Community-Tests und ihre SQLite-Hilfsdaten bleiben ausserhalb dieser Standarduebersicht moeglich.
- macOS-Build: `pnpm run dist:mac`
- Windows-Build auf Windows: `pnpm run dist:win`

Auf macOS steuert der Monitor ausschliesslich den vorhandenen WireGuard-Netzwerkdienst `gernetix-vps-mac`. Nach erfolgreicher VPN-Verbindung kann derselbe Monitor den festen SSH-Diagnosetunnel fuer Admin (`127.0.0.1:14600`), Plattformdiagnose (`127.0.0.1:14300`), Identity-PostgreSQL und die fest definierten Domaenendienste starten. Dieser Tunnel startet keine Identity; er stellt nur Diagnosezugriffe auf den laufenden VPS bereit. Der Renderer kann dabei weder SSH-Ziele noch beliebige Portweiterleitungen eingeben.

Die VPS-Prozesskarten stammen aus einer getrennten, kurzlebigen read-only SSH-Diagnoseabfrage. Schlaegt diese Abfrage fehl, zeigt der Monitor zuletzt bekannte oder erwartete Dienste ausschliesslich mit `Status unbekannt`, nennt den Fehler sowie Pruefzeitpunkt und gegebenenfalls den letzten erfolgreichen Nachweis. Ein alter gruener Containerstatus darf nicht als aktueller Zustand stehen bleiben. Die dauerhafte Portweiterleitung wird separat angezeigt und entscheidet ueber die Erreichbarkeit lokaler Tunnel-URLs wie `127.0.0.1:14600`.

Die App selbst oeffnet keinen HTTP-Port. In der lokalen Prozesssicht erscheint der kontrollierte Prozess eindeutig als `Identity Dev-Server` mit Status, PID und Port `4300`. Ist er gestoppt, kann er dort direkt ueber `Dev-Server starten` gestartet werden. Die Start-/Stop-Aktionen steuern ausschliesslich diesen lokalen Identity-Listener und getrennt davon den build-only Docker-Worker auf seiner privaten WireGuard-Adresse. PostgreSQL und die Domaenendienste bleiben auf dem VPS. Das Schliessen des letzten Monitorfensters beendet auch den Desktop-Monitor; separat gestartete lokale Prozesse und die VPS-Prozesse bleiben davon unberuehrt.

```powershell
netstat -ano | findstr :4300
netstat -ano | findstr :4800
netstat -ano | findstr :4400
```

Wenn ein Port bereits belegt ist, zuerst klaeren, ob der laufende Prozess wiederverwendet werden kann. Nur den betroffenen Portbesitzer stoppen, wenn ein Neustart wirklich erforderlich ist.

## Minimaler Plattform-Start

Diese Gruppe reicht fuer Login, Dashboard, Entwicklungsplattform, User IDE, Projekte, Build-Dialoge, Hardwareauswahl, AI-Preflight und Admin-nahe Konfiguration.

| Reihenfolge | Prozess | Port | Ordner | Start |
| ---: | --- | ---: | --- | --- |
| 1 | Project Server | 4800 | `services/project-server` | `$env:PORT="4800"; npm run dev` |
| 2 | Build & Deploy Server | 4400 | `services/build-deploy-server` | `$env:PORT="4400"; npm run dev` |
| 3 | Device Management Server | 4700 | `services/device-management-server` | `$env:PORT="4700"; npm run dev` |
| 4 | Hardware Catalog (isolierter Test ohne dauerhafte Daten) | 4910 | `services/hardware-catalog` | `$env:PORT="4910"; $env:PERSISTENCE_BACKEND="memory"; npm run dev` |
| 5 | Hardware Shop (isolierter Test ohne dauerhafte Daten) | 4900 | `services/hardware-shop` | `$env:PORT="4900"; $env:PERSISTENCE_BACKEND="memory"; npm run dev` |
| 6 | AI Usage Server (isolierter Test ohne dauerhafte Daten) | 5000 | `services/ai-usage-server` | `$env:PORT="5000"; $env:PERSISTENCE_BACKEND="memory"; npm run dev` |
| 7 | AI Context PostgreSQL + pgvector | 5432 | Repo-Root | `docker compose -f infra/dev/docker-compose.yml up -d ai-context-postgres` |
| 8 | AI Context Server | 5500 | `services/ai-context-server` | `$env:PORT="5500"; $env:AI_CONTEXT_PERSISTENCE_BACKEND="postgres"; npm run dev` |
| 9 | Admin Tool API | 4600 | `services/admin-tool` | `$env:PORT="4600"; npm run dev` |
| 10 | Community Platform | 5200 | `services/community-platform` | `$env:PORT="5200"; $env:COMMUNITY_PERSISTENCE_BACKEND="sqlite"; npm run dev` |
| 11 | Identity Server / Plattform UI | lokal 4300 | `services/identity-server` | `node tools/start-identity-remote-dev.js` nach Aufbau des SSH-/WireGuard-Tunnels |

Plattform-URL nach dem Start:

```text
http://127.0.0.1:4300/app/dashboard/
```

## Kanonische private VPS-Plattform verwenden

Wer auf mehreren Rechnern oder dem iPad mit demselben fachlichen Datenstand
arbeitet, startet nicht vorsorglich den kompletten lokalen Plattform-Stack.
Nach aktiviertem WireGuard ist die kanonische Adresse:

```text
https://pwa.gernetix.com/app/dashboard/
```

Identity darf fuer Entwicklung lokal auf Port `4300` gestartet werden, verwendet dabei aber dieselben PostgreSQL-Daten in `gernetix_runtime` wie die Server-Runtime. Das Desktop-Werkzeug startet sie nur bei aktivem vollständigem Tunnel und nur mit `Remote-Dev + PostgreSQL`. Lokale SQLite-Repositories duerfen nur in isolierten Tests oder expliziten Legacy-Migrationen verwendet werden und sind keine startbare Identity-Persistenz.

## Device-, OTA- und Factory-Flows

Diese Prozesse werden nur benoetigt, wenn echte Device-, Provisioning-, Recovery- oder OTA-Flows geprueft werden.

| Prozess | Port | Start | Zweck |
| --- | ---: | --- | --- |
| MQTT Broker | 1883 / 9001 | `docker compose -f infra/dev/docker-compose.yml up -d mqtt-broker` | Lokaler MQTT-Kanal fuer Deploy-Commands, Status und Heartbeats |
| Provisioning Tool Server | 4500 | In `services/provisioning-tool`: `$env:PORT="4500"; npm run dev` | Factory-/Support-Provisioning per USB |
| Recovery Tool Server | 5100 | In `services/recovery-tool`: `$env:PORT="5100"; npm run dev` | Board-Recovery und Credential-Erneuerung |

Provisioning-Vorbereitung bei Bedarf:

```powershell
cd services\provisioning-tool
npm run prepare:toolchain
npm run seed:esp32-firmware
```

## Community- und Assistenz-Flows

Diese Gruppe ist fuer Community-Fragen und KI-gestuetzte Community-Antworten relevant.

| Reihenfolge | Prozess | Port | Ordner | Start |
| ---: | --- | ---: | --- | --- |
| 1 | Community Platform | 5200 | `services/community-platform` | `$env:PORT="5200"; $env:COMMUNITY_PERSISTENCE_BACKEND="sqlite"; npm run dev` |
| 2 | AI Usage Server (isolierter Test ohne dauerhafte Daten) | 5000 | `services/ai-usage-server` | `$env:PORT="5000"; $env:PERSISTENCE_BACKEND="memory"; npm run dev` |
| 3 | Community AI Assistant | 5300 | `services/community-ai-assistant` | `$env:PORT="5300"; npm run dev` |

## Device Voice AI

Der Device Voice Orchestrator ist auf Port `5800` vorbereitet, bleibt aber ohne bewusst freigegebenen Provider im sicheren Zustand `available=false`. Fuer Vertrags- und UI-Tests kann er zusammen mit Device Management und AI Usage gestartet werden:

```powershell
cd services\device-voice-orchestrator
$env:PORT="5800"
$env:DEVICE_VOICE_PROVIDER="disabled"
npm run dev
```

Ein oeffentlicher Device-Endpunkt oder echter Audio-Provider wird dadurch nicht freigeschaltet.

## Wissens- und Diagnose-Tools

Diese Prozesse sind lokal hilfreich, aber nicht fuer jeden Plattformlauf erforderlich.

| Prozess | Port | Start | Zweck |
| --- | ---: | --- | --- |
| SQLite Graph Explorer | 4318 | In `tools/sqlite-graph-explorer`: `$env:PORT="4318"; npm start` | Read-only Sicht auf den kanonischen SQLite-Graphen |
| Context Manager | 5050 | Vom Repo-Root: `$env:PORT="5050"; .\services\context-manager\start-dev-server.ps1` | Projektkontext, Vorschlaege und Context Packs |
| Persistence Server | 5400 | In `services/persistence-server`: `$env:PORT="5400"; npm run dev` | HTTP-Zugriff auf generische SQLite-State-Dokumente |

## Healthchecks

Alle HTTP-Services sollten nach dem Start mindestens auf `/health` antworten.

```powershell
Invoke-WebRequest http://127.0.0.1:4300/health
Invoke-WebRequest http://127.0.0.1:4800/health
Invoke-WebRequest http://127.0.0.1:4400/health
Invoke-WebRequest http://127.0.0.1:4700/health
Invoke-WebRequest http://127.0.0.1:4910/health
Invoke-WebRequest http://127.0.0.1:4900/health
Invoke-WebRequest http://127.0.0.1:5000/health
Invoke-WebRequest http://127.0.0.1:5500/health
Invoke-WebRequest http://127.0.0.1:4600/health
Invoke-WebRequest http://127.0.0.1:5200/health
```

## Optional externe Provider

| Prozess / Provider | Port / Zugriff | Wann starten oder konfigurieren |
| --- | --- | --- |
| Optionaler Ollama LLM | `http://127.0.0.1:11434/` | Kein geplanter Standardprozess; nur bei bewusst aktivierter lokaler Admin-Route |
| Externe LLM API | OpenAI-kompatibel oder Claude/Anthropic | Nur wenn Admin Tool / Entwicklungsplattform externe Provider testen soll |

## Hinweise

- Die Identity-Server-UI ist der Einstieg fuer Login, Dashboard, Lernplattform, Entwicklungsplattform und User IDE.
- Der Identity Server erwartet die Default-URLs der Domaenenservices. Wenn ein Port geaendert wird, muessen die passenden `*_BASE_URL`-Umgebungsvariablen gesetzt werden.
- Isolierte lokale Tests duerfen SQLite-Dateien unter `.runtime/` verwenden. Im VPS-Betrieb ist `gernetix-services.sqlite` nur noch read-only Altquelle; zentrale Domaenen liegen in PostgreSQL. JSON, Browser-State und Caches sind keine fachliche Quelle der Wahrheit.
- Der MQTT Broker wird ueber Docker Compose gestartet und gestoppt. Die Node-Services laufen jeweils als eigene Dev-Prozesse.
