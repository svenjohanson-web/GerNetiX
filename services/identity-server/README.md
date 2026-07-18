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
- vorbereitete, pseudonyme Kontostufen Gast → Basiskonto → ESP32-Konto ohne E-Mail-Pflicht (noch kein produktiver WebAuthn-/Board-Nachweis)

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

## Projektgebundene Web-Push-Meldungen

Die installierbare Plattform-PWA kann pro iPhone eine Web-Push-Subscription an ein ausgewaehltes Projekt des angemeldeten Accounts binden. `POST /api/push/projects/{project}/test` sendet eine `Hallo Welt`-Testnachricht ausschliesslich an aktive Subscriptions dieses Kontos und Projekts.

Board-Ereignisse werden nicht direkt vom Board an einen Web-Push-Provider gesendet. Ein mTLS-/MQTT-authentifizierter Serveradapter ruft intern `POST /api/internal/push/device-event` mit `X-GerNetiX-Admin-Token`, serverseitig abgeleiteten `account_id`, `project_id`, `device_id`, Titel und Meldung auf. Identity stellt nur an Subscriptions derselben Konto-/Projektpartition zu. Die interne Route akzeptiert nur relative `/app/`-Deep-Links.

VPS-Sicherheitsalarme verwenden dieselbe Technik, aber eine getrennte, explizite Empfaengergruppe aus `WEB_PUSH_SECURITY_ALERT_ACCOUNT_IDS`. Ohne diese Konfiguration gibt es bewusst keinen Broadcast an normale Nutzer-Subscriptions.
Der Dev-Server speichert Identity-Accounts standardmaessig in `.runtime/gernetix-identity.sqlite`. Damit bleiben lokal angelegte Accounts und Identity-Sessions ueber Identity-Neustarts erhalten; der Prozessspeicher ist nur noch ein schneller Session-Cache.

## USB-Provisioning

Das gefuehrte Provisioning unter `/app/device-management/provisioning/` flasht neue ESP32-Boards per Browser Web Serial, bevor Registrierung und Pairing freigeschaltet werden. Der authentifizierte Firmware-Endpunkt verwendet `PROVISIONING_FIRMWARE_FILE_PATH` oder standardmaessig `.runtime/server-firmware/esp32-basissoftware/latest/merged-firmware.bin`. Der private Device-Schluessel ist nicht Bestandteil dieses Factory-Images; er entsteht spaeter auf dem Board.
Ueber `Konto erstellen` kann lokal ein neuer Account mit Benutzername, E-Mail, Passwort und Zustimmung angelegt werden. Im Dev-Modus wird die Mock-E-Mail-Verifizierung direkt abgeschlossen und der Nutzer wird angemeldet.
Die Provider-Buttons fuer Google, Apple, Microsoft und GitHub nutzen lokal Mock-Provider. Damit kann ein Dev-Account mit Apple-Providerreferenz angelegt werden, ohne echte Apple-OAuth-Schluessel oder einen produktiven Apple-ID-Redirect vorzutaeuschen.

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
  /help
```

Unter `/app/help/` liegt die eigenstaendige Anwenderhilfe. Ihre Themen- und Artikelstruktur liegt zentral in `public/app/help-content.js`; Navigation, Artikeldarstellung und Help-Chat-UI liegen getrennt in `help-view.js`, während `help-chat-service.js` derzeit einen klar abgegrenzten lokalen Platzhalteradapter mit Artikelreferenzen bereitstellt. Damit kann spaeter eine eigene Help-API oder ein eigener Assistant-Kontext angebunden werden, ohne den allgemeinen Projekt- oder Programmierchat zu vermischen.

Der Help-Chat nutzt `/api/platform/help-assistant/chat` und die eigene LLM-Route `help_chat`. Diese Route ist technisch verbindlich auf Ollama begrenzt: Auch wenn die globale Chat-Route im Admin Tool auf OpenAI oder Claude steht, kann GerNetiX Help weder auf einen API-Provider umgestellt noch an ihn weitergeleitet werden. Im Admin Tool sind fuer Help deshalb nur das lokale Ollama-Modell und dessen lokaler Endpoint relevant.

Ein Lernprojekt kann aus dem Lernmodus direkt in der IDE geoeffnet werden. Beide Modi greifen auf dieselben Project-Server-Projektdateien zu; Codeaenderungen aus der IDE bleiben dadurch am Projekt erhalten.

Der projektgebundene Code-Explorer folgt dem aufgabenbezogenen KI-Ansatz aus [`docs/ai-project-source-retrieval.md`](../../docs/ai-project-source-retrieval.md). Er uebergibt nicht pauschal die ersten 40 oder alle Projektdateien. Sobald die Nutzeraufgabe bekannt ist, sucht die Plattform ueber den Project Server nach relevanten Pfad- und Inhaltstreffern, priorisiert die aktuell geoeffnete Datei und gibt hoechstens sechs Quellen an den Development Assistant weiter. Schreibvorschlaege bleiben auf diese vorhandenen Pfade begrenzt und werden erst nach Nutzerbestaetigung gespeichert.

Die Entwicklungs-KI-Endpunkte erzeugen keine inhaltlichen Fallback-Antworten. Prompt-, Quellensuch-, AI-Usage- oder Providerfehler werden mit einem passenden HTTP-Fehlerstatus und `development_assistant_unavailable` beantwortet. Eine erfolgreiche Antwort stammt immer aus der ausgewiesenen lokalen Systemoperation oder der konfigurierten KI-Route.

Unter `/app/devices/` besitzt der Nutzer eine accountgebundene Hardware-Inventar-Seite. Fuer WLAN-faehige Boards ist die Netzwerksuche der Standardweg: Die IDE sucht erreichbare GerNetiX-Runtime-Boards im lokalen Netzwerk und uebernimmt sie erst nach Nutzerbestaetigung in das Account-Device-Inventar des Device Management Servers. Die manuelle Erfassung bleibt nur ein Fallback fuer nicht automatisch auffindbare Community-Hardware. Die UI setzt keine fremde Account-ID und macht Community-Erfassung nicht automatisch zu GerNetiX-verifizierter Hardware.

Der Architektur-Discovery-Assistent unter `/app/development-platform/` nutzt standardmaessig nur aktuellen Chat und die zentrale Prompt-Foundation aus der AI-Context-SQLite. Identity haelt keine fachlichen Prompt-Regeln im Code, sondern ergaenzt nur dynamischen Laufzeitkontext wie die aktuelle Nutzerreferenz. Fachliche Hardware-Catalog-Inhalte wie ESP32-Boards und Capabilities werden nur als kompakter Prompt-Kontext beigefuegt, wenn der AI Context Server einen passenden Grant fuer `hardware_catalog/processor_boards/esp32` und Zweck `architecture_assistance` erlaubt. Jede solche Nutzung erzeugt ein AI-Context-Audit-Event.

LLM-Aufrufe werden ueber die gemeinsame LLM-Routing-Konfiguration geroutet. Dieser fachliche Runtime-State muss gemaess SQL-only-Persistenz in SQLite liegen; alte `.runtime/identity-llm-config.json`-Dev-Konfigurationen sind nur Migrationsaltlasten. `general_chat` und `architecture_discovery` koennen die Standardroute nutzen, waehrend `artifact_generation` und `code_generation` standardmaessig lokal ueber Ollama laufen. Dadurch kann der Chat z. B. OpenAI oder Claude verwenden, waehrend PlantUML-, Pseudocode- und Codeableitungen zur Kostenkontrolle lokal erzeugt werden.

Vor echten Chat-Provider-Aufrufen fragt Identity den AI Usage Server per Preflight an. Genehmigte Aufrufe werden nach Provider-Antwort mit den tatsaechlichen Tokenwerten abgeschlossen; Providerfehler werden als fehlgeschlagene Usage Events markiert. Wird der Preflight abgelehnt, ruft Identity den LLM-Provider nicht auf. Dadurch sind OpenAI-, Claude- und lokale Ollama-Aufrufe im Admin Tool ueber dasselbe Usage-Journal nachvollziehbar.

Der Nutzer muss vor dem Architektur-Chat ein eigenes Entwicklungsprojekt laden oder neu anlegen. Diese Projekte werden ueber den Project Server in SQLite persistiert und mit der internen `user_id` des Accounts verknuepft. Der Chat sendet die Projekt-ID bei jedem Architektur-Aufruf mit; ohne gueltiges, accountgebundenes Entwicklungsprojekt wird der Aufruf abgelehnt.

Die Architektur-Discovery startet nicht mit einer maximalen oder leeren technischen Architektur-Auswahl. Der erste Dialogschritt laedt den Nutzer ein, frei zu beschreiben, was passieren soll: `Lass uns ein paar Fragen durchgehen, damit wir den technischen Loesungsraum definieren koennen.` Die KI fragt alltagsnah nach Messdaten, Verlauf, Handy-/Browser-Steuerung, lokaler Regelung ohne WLAN/Backend, Benachrichtigung bei Ereignissen und synchronisierten Zustaenden. Daraus leitet sie im Hintergrund Funktionsklassen ab: lokale Regel-/Steuerstrecke, Datenlogger, Remote-Steuerung, Observer/Benachrichtigung, synchronisiertes Zustandsmodell oder eine Kombination davon. Erfahrene Nutzer koennen diese Funktionsklassen direkt als Shortcut nennen oder am Projekteinstieg per Chat-Schnellfrage einsetzen, z. B. `Ich moechte einen Observer`, `Ich moechte einen Datenlogger` oder `Nenne mir deine Pattern`; dann antwortet die KI direkt beziehungsweise fragt nur noch lokal/weltweit, Device-Anzahl, Device-Rollen und die mindestens beteiligten Sensoren, Ereignisse oder Aktionen ab. Eine lokale Regelstrecke wie Pflanzenbewaesserung kann ohne Backend auskommen; Backend, MQTT, Push oder App sind dann optionale Erweiterungen. Danach wird geklaert, ob der Zugriff nur lokal oder weltweit erfolgen soll. Weitere Randbedingungen sind Bedienung, Browser oder App, Speicherung, Internet-Erreichbarkeit, Serverbetrieb, Offline-Verhalten und Risiken. Diese Einstiegslogik und ihre Bedeutung werden in der AI-Context-Prompt-Foundation gepflegt; die Antworten laufen ueber die konfigurierte `architecture_discovery`-Route, damit das Routing reproduzierbar im Admin Tool nachvollziehbar bleibt.

Wenn der Nutzer Internet-Erreichbarkeit wuenscht, ist die sichere Standardlinie ein aus dem Internet erreichbarer Server mit passender Absicherung. Direkte Erreichbarkeit eines Nutzer-Heimnetzes wird fuer normale Nutzer nicht vorgeschlagen, weil Betriebs- und Sicherheitsrisiken zu gross sind. Heimnetz-Ausnahmen sind ein Expertenpfad und werden nur auf ausdrueckliche Nachfrage markiert.

Kurze Erklaerfragen zu Bausteinen der Startarchitektur, z. B. `wozu dient MQTT` oder `wozu brauche ich eine Mobile App`, werden als `System / Kontextantwort` ohne LLM und ohne AI-Usage-Preflight beantwortet. Identity haelt dafuer keine fachlichen Antworttexte, sondern sucht generisch in den Architektur-Bausteinen aus dem AI Context Server. Diese Antworten veraendern die vorhandene PlantUML-Skizze nicht und dienen nur dazu, sichtbare Strukturelemente zu verstehen.

Nach einer erfolgreichen Architektur-KI-Antwort leitet der Identity Server zusaetzlich eine PlantUML-Architekturskizze aus Dialog und KI-Ergebnis ab. Die Entwicklungsplattform rendert diese Skizze direkt unter dem Chat und zeigt die PlantUML-Quelle an. Die Skizze ist bewusst als KI-abgeleitet markiert und ersetzt keine vom Nutzer bestaetigte Architekturentscheidung.

Architektur-Discovery nutzt immer die konfigurierte `architecture_discovery`-Route; Identity entscheidet nicht mehr anhand von Wortzahl, Komplexitaet oder `ESP32 only`, ob lokal oder extern geroutet wird. Antwortdisziplin und fachliche Prompt-Regeln kommen aus der AI-Context-SQLite. Die PlantUML-Skizze fuer `ESP32 only` bleibt rein technisch minimal und enthaelt genau `ESP32`, keine Nutzer-/Anforderungsknoten und keine Uebergabepunkte.

Die aktuell sichtbare Architekturskizze kann jederzeit gespeichert werden. Dabei schreibt die Plattform `docs/architecture.puml`, `Architektur/statische-architektur/`, `Architektur/informationsfluss/`, `Architektur/systemverhalten/` und Komponentenordner unter `Komponenten/` in das accountgebundene Project-Server-Projekt. Jede Komponente besitzt `Schnittstellen/provided.md`, `Schnittstellen/required.md`, `Verhalten/Modell`, `Verhalten/Code`, `Konfiguration/Software`, `Daten/` und `Beziehungen/`. Device-Komponenten erhalten zusaetzlich `Konfiguration/Hardware/Board`, `Konfiguration/Hardware/Sensoren/in.md` und `Konfiguration/Hardware/Aktoren/out.md`. Damit sind Software- und Hardwarekonfiguration eindeutig getrennt; einen parallelen Ordner `Eigenschaften` gibt es nicht mehr.

Ein lokaler Speicher oder eine Messwerthistorie auf einem reinen ESP32 wird als Device-Speicher modelliert, beispielsweise NVS oder LittleFS. SQL/SQLite ist keine eigenstaendige Architekturkomponente, sondern eine Softwareeigenschaft eines Servers. Bei einer Anforderung wie zentraler, weltweit abrufbarer Speicherung schlaegt die Architektur-Discovery deshalb einen Server vor und ordnet ihm SQL/SQLite unter `Konfiguration/Software` zu.

Systemverhalten ist eine Architektursicht auf Projektebene. Es beschreibt komponentenuebergreifende Ablaeufe, Zustaende, Regeln, Ereignisse, Fehlerfaelle und Reaktionen. Die KI kann bestaetigtes Systemverhalten spaeter in komponentenspezifisches Verhalten, Schnittstellenanforderungen, Datenfluesse, Code und Konfiguration dekomponieren.

Wenn der Nutzer mit der Architektur zufrieden ist, kann er `Uebernehmen und weiter` waehlen. Die Plattform speichert dieselben Project-Server-Quellen und oeffnet danach `/app/ide/` fuer das Projekt. Die IDE zeigt links einen Projektbrowser ab Projektname mit Architektur- und Komponentenordnern und in der Mitte Modell-, Code- und Image-Ansichten fuer Anzeige und Bearbeitung.

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

## IONOS E-Mail-Versand

Der Identity Server kann Verifizierungs- und Passwort-Reset-E-Mails ueber ein vorhandenes IONOS-Postfach versenden. Es wird kein eigener E-Mail-Server betrieben und es werden keine eingehenden Mailports benoetigt.

1. Auf dem VPS `IDENTITY_APP_BASE_URL`, denselben langen `IDENTITY_ADMIN_TOKEN` fuer Identity und Admin Tool sowie einen eigenen Base64-kodierten 32-Byte-Wert in `EMAIL_CONFIG_ENCRYPTION_KEY` setzen.
2. Im Admin Tool unter **KI → E-Mail** IONOS SMTP eintragen und testen. Standard: `smtp.ionos.de`, Port `465`, SSL/TLS.
3. Das SMTP-Passwort wird AES-256-GCM-verschluesselt in der Identity-SQLite gespeichert, nie erneut ausgegeben und nicht geloggt.

Solange keine SMTP-Konfiguration vorliegt, bleibt der lokale Mock-Mailversand fuer die Entwicklung aktiv. Nach dem Speichern der SMTP-Konfiguration erhalten neu registrierte Nutzer einen echten Bestaetigungslink.
