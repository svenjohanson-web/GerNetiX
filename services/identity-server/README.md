# Identity Server

Initiales Identity-Modul fuer GerNetiX.

Das Modul erzeugt unabhaengig vom Registrierungsweg immer genau einen internen `UserAccount` mit eindeutiger `user_id`. Andere Module duerfen nie direkt mit Google-, Apple-, Microsoft- oder GitHub-IDs arbeiten, sondern ausschliesslich mit der internen `user_id`.

## Funktionen

- klassische Registrierung mit Benutzername, E-Mail, Passwort und Zustimmung zu Datenschutz/AGB
- E-Mail-Verifizierung ueber Token
- Login mit Benutzername oder E-Mail und Passwort
- Passwort-Reset fuer lokale Credentials
- externe Registrierung und Social Login ueber gekapselte OAuth2/OIDC-Provider
- Mock-Provider fuer Google, Apple, Microsoft und GitHub
- MockEmailService fuer Verifizierungs- und Reset-Links
- Session/AuthToken-Erzeugung und Logout

## Architekturregeln

- Identity kennt keine Produkte.
- Identity kennt keine Learnings.
- Identity kennt keine Abos.
- Identity kennt keine Kaeufe.
- Identity kennt keine Entitlements.
- E-Mail ist intern und wird nicht in Public-Account-Antworten ausgegeben.
- Oeffentliche Identitaet ist spaeter nur der Benutzername.
- Provider-IDs bleiben innerhalb des Identity-Moduls.

## Entwicklungsstand

Die erste Implementierung verwendet ein In-Memory-Repository und Mock-Integrationen. Die Service-Grenzen sind so geschnitten, dass spaeter echte Persistenz, echter E-Mail-Versand und echte OAuth2/OIDC-Provider ergaenzt werden koennen.

## Tests

```text
npm test
```

## Login-Oberflaeche

```text
npm run dev
```

Oeffnet die Login-Ansicht unter `http://localhost:4300/app/auth/`. Die Ansicht nutzt den lokalen Dev-Login und setzt fuer die Demo ein HttpOnly-Session-Cookie.
Der eingebaute Dev-Account `demo` nutzt lokal stabil die interne Account-ID `acct-demo`, damit Identity Server, Project Server, AI Usage und Admin Tool im MVP dieselbe Demo-Account-Referenz sehen.

Nach dem Login landet der Nutzer auf der gemeinsamen Plattform unter:

```text
http://localhost:4300/app/dashboard/
```

Dabei gilt fuer die lokale MVP-Plattform:

- ein Login
- ein Account
- ein gemeinsames Projektmodell
- zwei Arbeitsmodi: gefuehrtes Lernen und freie IDE
- Lernfortschritt wird separat gespeichert und verweist auf dasselbe Projekt
- der letzte Einstieg wird als Workspace-State gespeichert

Die App-Struktur ist:

```text
services/identity-server/public/app
  /auth
  /dashboard
  /learn
  /ide
  /projects
  /devices
  /builds
  /billing
```

Ein Lernprojekt kann aus dem Lernmodus direkt in der IDE geoeffnet werden. Beide Modi greifen auf dieselben Project-Server-Projektdateien zu; Codeaenderungen aus der IDE bleiben dadurch am Projekt erhalten.

Unter `/app/devices/` besitzt der Nutzer eine accountgebundene Hardware-Inventar-Seite. Fuer WLAN-faehige Boards ist die Netzwerksuche der Standardweg: Die IDE sucht erreichbare GerNetiX-Runtime-Boards im lokalen Netzwerk und uebernimmt sie erst nach Nutzerbestaetigung in das Account-Device-Inventar des Device Management Servers. Die manuelle Erfassung bleibt nur ein Fallback fuer nicht automatisch auffindbare Community-Hardware. Die UI setzt keine fremde Account-ID und macht Community-Erfassung nicht automatisch zu GerNetiX-verifizierter Hardware.

Der Architektur-Discovery-Assistent unter `/app/development-platform/` nutzt standardmaessig nur aktuellen Chat und die zentrale Prompt-Foundation aus der AI-Context-SQLite. Identity haelt keine fachlichen Prompt-Regeln im Code, sondern ergaenzt nur dynamischen Laufzeitkontext wie die aktuelle Nutzerreferenz. Fachliche Hardware-Catalog-Inhalte wie ESP32-Boards und Capabilities werden nur als kompakter Prompt-Kontext beigefuegt, wenn der AI Context Server einen passenden Grant fuer `hardware_catalog/processor_boards/esp32` und Zweck `architecture_assistance` erlaubt. Jede solche Nutzung erzeugt ein AI-Context-Audit-Event.

LLM-Aufrufe werden ueber die gemeinsame LLM-Routing-Konfiguration geroutet. Dieser fachliche Runtime-State muss gemaess SQL-only-Persistenz in SQLite liegen; alte `.runtime/identity-llm-config.json`-Dev-Konfigurationen sind nur Migrationsaltlasten. `general_chat` und `architecture_discovery` koennen die Standardroute nutzen, waehrend `artifact_generation` und `code_generation` standardmaessig lokal ueber Ollama laufen. Dadurch kann der Chat z. B. OpenAI oder Claude verwenden, waehrend PlantUML-, Pseudocode- und Codeableitungen zur Kostenkontrolle lokal erzeugt werden.

Vor echten Chat-Provider-Aufrufen fragt Identity den AI Usage Server per Preflight an. Genehmigte Aufrufe werden nach Provider-Antwort mit den tatsaechlichen Tokenwerten abgeschlossen; Providerfehler werden als fehlgeschlagene Usage Events markiert. Wird der Preflight abgelehnt, ruft Identity den LLM-Provider nicht auf. Dadurch sind OpenAI-, Claude- und lokale Ollama-Aufrufe im Admin Tool ueber dasselbe Usage-Journal nachvollziehbar.

Der Nutzer muss vor dem Architektur-Chat ein eigenes Entwicklungsprojekt laden oder neu anlegen. Diese Projekte werden ueber den Project Server in SQLite persistiert und mit der internen `user_id` des Accounts verknuepft. Der Chat sendet die Projekt-ID bei jedem Architektur-Aufruf mit; ohne gueltiges, accountgebundenes Entwicklungsprojekt wird der Aufruf abgelehnt.

Die Architektur-Discovery fragt im Dialog, ob der Nutzer mit einer maximalen Architektur starten und Unbenoetigtes entfernen moechte oder mit einer leeren Architektur beginnt. Der Nutzer antwortet einfach mit `max` oder `leer`. Diese Einstiegsfrage und ihre Bedeutung werden in der AI-Context-Prompt-Foundation gepflegt; die Antwort laeuft ueber die konfigurierte `architecture_discovery`-Route, damit das Routing reproduzierbar im Admin Tool nachvollziehbar bleibt.

Nach einer erfolgreichen Architektur-KI-Antwort leitet der Identity Server zusaetzlich eine PlantUML-Architekturskizze aus Dialog und KI-Ergebnis ab. Die Entwicklungsplattform rendert diese Skizze direkt unter dem Chat und zeigt die PlantUML-Quelle an. Die Skizze ist bewusst als KI-abgeleitet markiert und ersetzt keine vom Nutzer bestaetigte Architekturentscheidung.

Architektur-Discovery nutzt immer die konfigurierte `architecture_discovery`-Route; Identity entscheidet nicht mehr anhand von Wortzahl, Komplexitaet oder `ESP32 only`, ob lokal oder extern geroutet wird. Antwortdisziplin und fachliche Prompt-Regeln kommen aus der AI-Context-SQLite. Die PlantUML-Skizze fuer `ESP32 only` bleibt rein technisch minimal und enthaelt genau `ESP32`, keine Nutzer-/Anforderungsknoten und keine Uebergabepunkte.

Die aktuell sichtbare Architekturskizze kann jederzeit gespeichert werden. Dabei schreibt die Plattform `docs/architecture.puml`, `Architektur/statische-architektur/`, `Architektur/informationsfluss/`, `Architektur/systemverhalten/` und Komponentenordner unter `Komponenten/` in das accountgebundene Project-Server-Projekt. Jede Komponente besitzt `Eigenschaften/`, `Schnittstellen/provided.md`, `Schnittstellen/required.md`, `Behavior/Modell`, `Behavior/Code`, `Behavior/Config`, `Daten/` und `Beziehungen/`, damit Eigenschaften, benoetigte Schnittstellen, Verhalten, Daten und Beziehungen ausdruecklich sichtbar sind.

Systemverhalten ist eine Architektursicht auf Projektebene. Es beschreibt komponentenuebergreifende Ablaeufe, Zustaende, Regeln, Ereignisse, Fehlerfaelle und Reaktionen. Die KI kann bestaetigtes Systemverhalten spaeter in komponentenspezifisches Verhalten, Schnittstellenanforderungen, Datenfluesse, Code und Konfiguration dekomponieren.

Wenn der Nutzer mit der Architektur zufrieden ist, kann er `Uebernehmen und weiter` waehlen. Die Plattform speichert dieselben Project-Server-Quellen und oeffnet danach `/app/ide/` fuer das Projekt. Die IDE zeigt links einen Projektbrowser ab Projektname mit Architektur- und Komponentenordnern, in der Mitte Modell-, Code- und Image-Ansichten fuer Anzeige und Bearbeitung und unten einen KI-Chat fuer Rueckfragen zum aktuellen Projekt.

Wichtig: Die Plattform-UI liegt auch im Projekt als ein gemeinsames Artefakt unter `services/identity-server/public/app`. Alte Einstiege wie `/login.html`, `/projects/` und `/dev/projects/` werden nur noch auf die gemeinsame Plattform umgeleitet.

Die fruehere Tamagotchi-Webdemo unter `/demo/tamagotchi/` wurde entfernt. Fuer das Lernprojekt bleibt nur die unabhaengige, komplexe Quellcodedatei `tools/guided-code-lesson/assets/tamagotchi-complete-example.c` als Analyse- und Diskussionsobjekt erhalten.

Fuer lokale Tests kann der Server explizit an eine VPN-/LAN-Adresse gebunden werden:

```powershell
$env:HOST="127.0.0.1"
$env:PORT="4300"
$env:DEMO_USER="demo"
$env:DEMO_PASSWORD="demo-passwort"
npm run dev
```

Der Service sollte fuer Kollegen nur ueber VPN oder Tunnel erreichbar sein, nicht ueber eine offene Router-Portfreigabe.

## Deployment-Leitplanken

- Der Service muss als eigenstaendiger Prozess startbar bleiben.
- Ports und externe Basis-URLs werden konfigurierbar gehalten.
- `/health` liefert einen einfachen Healthcheck.
- Persistenz, E-Mail-Versand und OAuth-Provider sind ueber Adapter gekapselt, damit spaeter Linux-Homeserver, Container oder Cloud-Betrieb moeglich bleiben.
