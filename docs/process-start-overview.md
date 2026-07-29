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

Die eigenstaendige Desktop-App zeigt alle zehn Plattformdienste mit Port, HTTP-Status, PID und Lebensstatus. Jeder Dienst kann einzeln gestartet oder gestoppt werden. Die Ansicht aktualisiert sich alle fuenf Sekunden und benoetigt weder Admin Tool noch Monitor-Webserver.

- macOS-App: `tools/process-monitor/GerNetiX Prozess-Monitor.app`
- macOS-Entwicklung: `tools/process-monitor/GerNetiX-Prozess-Monitor.command`
- Windows: `tools/process-monitor/GerNetiX-Prozess-Monitor.cmd`
- Entwicklung: im Ordner `tools/process-monitor` mit `pnpm start`

Der Desktop-Prozessmonitor besitzt neben der Prozesssicht eine persistierte `Schnittstellen-Statistik`. Der Identity Server protokolliert seine ausgehenden GerNetiX-Serviceaufrufe sowie OpenAI-/Claude-/Ollama-Aufrufe in `gernetix_external_interface_calls` innerhalb der gemeinsamen Runtime-SQLite. Der Build-&-Deploy-Server erfasst dort zusaetzlich MQTT `PUBLISH`, `SUBSCRIBE` und empfangene Nachrichten; Device-Kennungen werden im Topic vor dem Speichern durch `{device}` ersetzt. Die Ansicht aggregiert fuer die letzten 24 Stunden Aufrufe, Fehler, mittlere/maximale Dauer und den letzten Aufruf je Quelle-Ziel-Verbindung. Monitor-Healthchecks werden nicht mitgezaehlt. Das Schema ist dienstuebergreifend, sodass weitere Services dieselbe Telemetrie spaeter ebenfalls schreiben koennen.

Für die Community Platform zeigt die lokale Prozesskarte zusätzlich den read-only Zustand von `.runtime/gernetix-community.sqlite`: relativer Pfad, Dateigröße sowie aggregierte Zahlen für öffentliche, private und offene Fragen, Antworten und Wissensdokumente. Inhalte und Account-/Projektkennungen werden nicht gelesen oder dargestellt. Das Web-Admin-Tool bezieht dieselben fachlichen Zähler über den internen token-geschützten Community-Betriebsendpunkt.
- macOS-Build: `pnpm run dist:mac`
- Windows-Build auf Windows: `pnpm run dist:win`

Auf macOS steuert der Monitor ausschliesslich den vorhandenen WireGuard-Netzwerkdienst `gernetix-vps-mac`. Nach erfolgreicher VPN-Verbindung kann derselbe Monitor den festen SSH-Diagnosetunnel fuer Admin (`127.0.0.1:14600`), Plattform (`127.0.0.1:14300`), Identity-PostgreSQL und die fest definierten Domaenendienste starten. Der Identity-Start verwendet ausschliesslich den Remote-Dev-Modus mit PostgreSQL; ohne vollständigen Tunnel wird er abgewiesen und der Monitor zeigt die letzten Startlogzeilen an. Der Renderer kann dabei weder SSH-Ziele noch beliebige Portweiterleitungen eingeben.

Die App oeffnet keinen eigenen HTTP-Port. Stop-Aktionen ermitteln ausschliesslich den Listener auf dem fest definierten Port des ausgewaehlten GerNetiX-Dienstes.

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
| 11 | Identity Server / Plattform UI | 4300 | `services/identity-server` | `$env:PORT="4300"; npm run dev` |

Plattform-URL nach dem Start:

```text
http://127.0.0.1:4300/app/dashboard/
```

## Gemeinsamen privaten VPS-Datenstand verwenden

Wer auf mehreren Rechnern oder dem iPad mit demselben fachlichen Datenstand
arbeitet, startet nicht vorsorglich den kompletten lokalen Plattform-Stack.
Nach aktiviertem WireGuard ist die kanonische Adresse:

```text
https://pwa.gernetix.com/app/dashboard/
```

Fuer die haeufige lokale Arbeit an Port `4300` werden nur zwei Prozesse
benoetigt:

```text
node tools/connect-staging.js
node tools/start-identity-remote-dev.js
```

Der lokale Identity Server verwendet die zentrale PostgreSQL-Datenbank
`gernetix_runtime` ueber den SSH-Tunnel. Projekte, Telemetrie, Community,
Device Management, AI Usage, Hardware Catalog und Hardware Shop verwenden
dieselbe Datenbank auf dem VPS, werden lokal aber ausschliesslich ueber ihre
getunnelten Dienst-APIs angesprochen. Ein lokaler PostgreSQL-, AI-Context- oder
sonstiger SQL-Prozess ist dafuer nicht erforderlich.

Der bisherige vollstaendige lokale Start bleibt fuer isolierte Tests verfuegbar.
Aktiv-aktive Schreibzugriffe auf eine entfernte SQLite-Datei sind weiterhin
nicht zulaessig.

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
| Lokaler Ollama LLM | `http://127.0.0.1:11434/` | Nur wenn LLM-Routen lokal auf Ollama zeigen |
| Externe LLM API | OpenAI-kompatibel oder Claude/Anthropic | Nur wenn Admin Tool / Entwicklungsplattform externe Provider testen soll |

## Hinweise

- Die Identity-Server-UI ist der Einstieg fuer Login, Dashboard, Lernplattform, Entwicklungsplattform und User IDE.
- Der Identity Server erwartet die Default-URLs der Domaenenservices. Wenn ein Port geaendert wird, muessen die passenden `*_BASE_URL`-Umgebungsvariablen gesetzt werden.
- Isolierte lokale Tests duerfen SQLite-Dateien unter `.runtime/` verwenden. Im VPS-Betrieb ist `gernetix-services.sqlite` nur noch read-only Altquelle; zentrale Domaenen liegen in PostgreSQL. JSON, Browser-State und Caches sind keine fachliche Quelle der Wahrheit.
- Der MQTT Broker wird ueber Docker Compose gestartet und gestoppt. Die Node-Services laufen jeweils als eigene Dev-Prozesse.
