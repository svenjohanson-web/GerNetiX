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

Ohne Parameter wird `wake` ausgefuehrt: Alle neun Dienste der minimalen Plattform werden geprueft und fehlende Dienste automatisch in der definierten Reihenfolge gestartet. `check` veraendert nichts. Laufende Prozesse werden weder beendet noch neu gestartet. Einzelne Dienste lassen sich gezielt auswaehlen:

```text
node tools/check-and-wake-processes.js wake --service=identity-server,admin-tool
```

Hintergrundprozess-Logs liegen unter `.runtime/process-logs/`.

Auf macOS kann alternativ `tools/GerNetiX-Check-und-Start.command` per Doppelklick gestartet werden. Eine Desktop-Verknuepfung kann auf diese Datei zeigen; dadurch bleibt nur eine gepflegte Skriptquelle im Repository.

## Grafischer Prozess-Monitor

Die eigenstaendige Desktop-App zeigt alle neun Plattformdienste mit Port, HTTP-Status, PID und Lebensstatus. Jeder Dienst kann einzeln gestartet oder gestoppt werden. Die Ansicht aktualisiert sich alle fuenf Sekunden und benoetigt weder Admin Tool noch Monitor-Webserver.

- macOS: `tools/process-monitor/GerNetiX-Prozess-Monitor.command`
- Windows: `tools/process-monitor/GerNetiX-Prozess-Monitor.cmd`
- Entwicklung: im Ordner `tools/process-monitor` mit `pnpm start`
- macOS-Build: `pnpm run dist:mac`
- Windows-Build auf Windows: `pnpm run dist:win`

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
| 4 | Hardware Catalog | 4910 | `services/hardware-catalog` | `$env:PORT="4910"; npm run dev` |
| 5 | Hardware Shop | 4900 | `services/hardware-shop` | `$env:PORT="4900"; npm run dev` |
| 6 | AI Usage Server | 5000 | `services/ai-usage-server` | `$env:PORT="5000"; npm run dev` |
| 7 | AI Context Server | 5500 | `services/ai-context-server` | `$env:PORT="5500"; npm run dev` |
| 8 | Admin Tool API | 4600 | `services/admin-tool` | `$env:PORT="4600"; npm run dev` |
| 9 | Identity Server / Plattform UI | 4300 | `services/identity-server` | `$env:PORT="4300"; npm run dev` |

Plattform-URL nach dem Start:

```text
http://127.0.0.1:4300/app/dashboard/
```

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
| 1 | Community Platform | 5200 | `services/community-platform` | `$env:PORT="5200"; npm run dev` |
| 2 | AI Usage Server | 5000 | `services/ai-usage-server` | `$env:PORT="5000"; npm run dev` |
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
```

## Optional externe Provider

| Prozess / Provider | Port / Zugriff | Wann starten oder konfigurieren |
| --- | --- | --- |
| Lokaler Ollama LLM | `http://127.0.0.1:11434/` | Nur wenn LLM-Routen lokal auf Ollama zeigen |
| Externe LLM API | OpenAI-kompatibel oder Claude/Anthropic | Nur wenn Admin Tool / Entwicklungsplattform externe Provider testen soll |

## Hinweise

- Die Identity-Server-UI ist der Einstieg fuer Login, Dashboard, Lernplattform, Entwicklungsplattform und User IDE.
- Der Identity Server erwartet die Default-URLs der Domaenenservices. Wenn ein Port geaendert wird, muessen die passenden `*_BASE_URL`-Umgebungsvariablen gesetzt werden.
- Runtime-State liegt lokal in SQLite-Dateien unter `.runtime/`; JSON, Browser-State und Caches sind keine fachliche Quelle der Wahrheit.
- Der MQTT Broker wird ueber Docker Compose gestartet und gestoppt. Die Node-Services laufen jeweils als eigene Dev-Prozesse.
