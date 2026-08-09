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

### Struktur des Dev-Servers

`src/dev-server.js` ist der Composition Root: Dort werden Konfiguration, Adapter und fachliche Services zusammengesetzt und die HTTP-Routen registriert. Die eigentlichen Ablaufe liegen nach Verantwortungsbereich unter `src/dev/`:

- `auth/`: lokale Anmeldung, Registrierung, externe Anmeldung, Passkeys und Offline-Recovery
- `account/`: Abo-Auflösung, Berechtigungsprüfung, Workspace-Zustand und Account-Ressourcenplan
- `session/`: Aufloesen, Zwischenspeichern und Aktualisieren angemeldeter Sitzungen
- `platform/`: Bootstrap, Plattform-Zusammenfassung, Konto-/Geräte-Laufzeitdaten, Wissen und Community-Zusammenfassung
- `learning/`: Lernprojekt-Katalog, Projektstart/-synchronisierung und Lernfortschritt
- `projects/`: Projektzugriff und -cache, Katalog-Synchronisierung, Projektdateien, Entwicklungsprojekt-Konfiguration, Demo-Quellen, Architektur-/Hardwaremodell sowie die reine Abbildung von Project-Server-Daten in Plattformobjekte
- `devices/`: Inventar, Claiming, Provisioning, Firmwareprofile und Recovery-Prüfungen
- `builds/`: Build-Auftrag, Build-Ergebnis, Build-Vertragsaufbereitung und geschuetzte Artefakte
- `downloads/`: Serial-Service-Pakete, öffentliche Flashbox-Firmware und Dev-Migrationen
- `server/`: schlanke HTTP-Routenregistrierung ohne fachliche Implementierung

Ein Lernprojekt ist kein eigenes JavaScript-/npm-Projekt. Die versionierten Kursdefinitionen und ihre Modelladapter liegen einzeln unter `src/dev/project-models/`; `src/dev/learning/learning-project-models.js` setzt sie zum gemeinsamen Katalog zusammen. Dadurch bleiben die Kurse getrennt pflegbar, ohne fuer jeden Kurs einen eigenen Serverprozess oder ein eigenes Paket zu benoetigen.

Bestehende Entwicklungsprojekte werden beim Laden oder Öffnen nicht automatisch an neuere Entwicklungsprojekt-Templates angepasst. Kandidaten für spätere Template-Migrationen bleiben ohne Runtime-Anbindung erhalten und dürfen erst über einen versionierten Plan-/Apply-Ablauf mit projektspezifischer Kundenzustimmung ausgeführt werden. Der verbindliche Ablauf steht in [`docs/customer-approved-project-template-migrations.md`](../../docs/customer-approved-project-template-migrations.md).

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
Die Identity verwendet in jeder Runtime ausschliesslich die zentrale PostgreSQL-Datenbank `gernetix_runtime`. Auf dem VPS setzt Compose `IDENTITY_RUNTIME_LOCATION=server`. Fuer schnelle UI-Entwicklung darf derselbe Identity-Code kontrolliert lokal auf `127.0.0.1:4300` laufen; `tools/start-identity-remote-dev.js` setzt dafuer `IDENTITY_RUNTIME_LOCATION=local-development`, `IDENTITY_REMOTE_DEV=1` und verbindet PostgreSQL ueber den SSH-/WireGuard-Tunnel. Direkte unkontrollierte Starts und `IDENTITY_PERSISTENCE_BACKEND=sqlite` werden abgewiesen. SQLite bleibt nur innerhalb isolierter Repository-Tests und fuer bewusst ausgefuehrte Legacy-Migrationswerkzeuge zulaessig; eine lokale SQLite darf niemals wieder als Account- oder Session-Wahrheit gestartet werden.

## USB-Provisioning

Das gefuehrte Provisioning unter `/app/device-management/provisioning/` bleibt die einzige Bedienoberflaeche. Identity und Firmware duerfen dabei auf dem VPS laufen: Der Browser laedt Firmware und Flash-Manifest ueber seine angemeldete HTTPS-Sitzung vom VPS und uebergibt die Bytes an den UI-losen GerNetiX Serial Service auf demselben Mac. Nur dieser lokale Dienst greift auf USB zu; der VPS besitzt keinen Zugriff auf den Port. Board-Erkennung, Flash sowie serielle WLAN-Provisionierung bleiben in der Plattform, ohne Helper-Fenster oder Browserwechsel. Falls der Browser selbst Web Serial anbietet, kann die Plattform diesen Weg kompatibel als Rueckfall verwenden.

ProcessorBoards stammen im Provisioning ausschliesslich aus dem laufenden Hardware Catalog. Identity verwendet weder einen eingebetteten Seed noch fest codierte Ersatz-Boards. Die automatische USB-Suche prueft bei jedem Versuch sowohl die Boardliste als auch die erforderlichen Boardausstattungsoptionen erneut. Ist der Katalog nicht oder nur teilweise erreichbar, werden keine Boardkandidaten erzeugt und der Ablauf meldet `Hardware-Katalog nicht erreichbar.`

Das signierte und notarisierte macOS-Paket wird ausserhalb des Linux-VPS-Images gebaut und danach als unveraenderlicher, checksum-gesicherter Release in einer getrennten Plattform-Download-SQLite im persistenten Identity-Volume des bestehenden VPS veroeffentlicht. Account- und Passkey-Daten bleiben damit von den grossen Paket-BLOBs getrennt. Der bereits vorhandene angemeldete Downloadbereich und die IDE-Hinweise verwenden diesen Release direkt; eine externe Downloadplattform oder zweite Oberflaeche ist nicht erforderlich. Lokal kann weiterhin ein Paket aus `tools/usb-serial-helper/dist` verwendet werden. Der authentifizierte Firmware-Endpunkt verwendet `PROVISIONING_FIRMWARE_FILE_PATH` oder standardmaessig `.runtime/server-firmware/esp32-basissoftware/latest/merged-firmware.bin`. Der private Device-Schluessel ist nicht Bestandteil dieses Factory-Images; er entsteht spaeter auf dem Board.

Persoenliche QR-Codes, Bilder, Bildstile und Exporte werden getrennt von Credentials und Releases in `gernetix-account-assets.sqlite` gespeichert. Die Account-API leitet den Eigentuemer immer aus der Sitzung ab; diese Assets sind fest `owner_only` und werden nicht als Community-Inhalt behandelt.

Ist der lokale Dienst beim ersten USB-Schritt nicht erreichbar und besitzt der Browser kein Web Serial, zeigt GerNetiX einen eigenen Auswahldialog: dieselbe Plattformseite in Chrome oder Edge mit Web Serial verwenden oder den GerNetiX WebHelper installieren. Erst die bewusste Wahl `WebHelper jetzt installieren` startet den passenden Plattformdownload, ohne vorher in den Downloadbereich zu wechseln. Das anschliessende Öffnen und Bestätigen des geladenen macOS-Pakets bleibt eine bewusste Benutzeraktion des Betriebssystems.

Ein fertig signiertes und notarisiertes Paket wird mit `tools/publish-platform-download.js` veroeffentlicht. Lokal kann das Werkzeug direkt auf die Plattform-Download-SQLite-Datei zeigen. Auf dem VPS wird dasselbe Werkzeug im Identity-Container gegen `/var/lib/gernetix/identity/gernetix-platform-downloads.sqlite` ausgefuehrt; der Paketinhalt kann ueber die Standardeingabe uebergeben werden, sodass keine lose Release-Datei zur dauerhaften Quelle der Wahrheit wird. Bereits veroeffentlichte Kombinationen aus Download-ID, Version, Plattform und Architektur sind unveraenderlich.
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

Unter `/wissen/` liegt das öffentliche Wissensportal mit fachlichen Grundlagen wie Embedded, Systemlandschaften, Sicherheit und Datenschutz. Seine Kapitel und Artikel liegen ausschließlich in `public/app/knowledge-content.js`. Unter `/hilfe/` liegt die GerNetiX-Anwenderhilfe mit Konto-, Geräte- und Projektabläufen; ihre Inhalte liegen ausschließlich in `public/app/help-content.js`. Beide Modelle behalten eigene Topic- und Artikelmengen und dürfen keine IDs gemeinsam besitzen. Die neutrale Darstellungsschicht `information-view.js` wählt abhängig von der aufgerufenen Oberfläche genau eines der beiden Modelle aus. Querverweise werden ausdrücklich über die beiden öffentlichen Suchfunktionen aufgelöst. `help-chat-service.js` bleibt der klar abgegrenzte lokale Adapter für den Hilfeassistenten.

Unter `/nachbauprojekte/` liegen frei zugängliche, statische Nachbauprojekte. Sie sind keine accountgebundenen Lernprojekte und speichern deshalb keinen Lesson-/Step-Fortschritt. Das Motorprojekt unter `/nachbauprojekte/einfache-elektromotoren/` führt über Grundlagenversuche zu mehreren Motoraufbauten. Seine Bauabschnitte verweisen über stabile Wissenskapitel-IDs in den Wissensspeicher; die zugehörigen Wissensabschnitte verweisen mit den Projektankern zurück zum konkreten Aufbau. Die Nachbauserie unter `/nachbauprojekte/druckmotoren/` führt in fünf Stufen von der sichtbaren Lorentzkraft über Reed- und Hall-Kommutierung zum dreiphasigen axialen Luftspulen-BLDC. Das zusätzliche Projekt unter `/nachbauprojekte/hw364a-spielesammlung/` beschreibt Cat Jump und Cave Bat auf dem diymore HW-364A samt Ein-Tasten-Bedienung und transparentem Release-Status. Serienweite und projektspezifische Kauf-, Druck-, Werkzeug- und Laborlisten sowie der ehrliche Download-Freigabestatus stehen jeweils vor Erklärung und Bauweg. Gedruckte Varianten verwenden wiederkehrende Schnittstellen und Normteile; Blechpakete, gebogene Polschuhe und ausgeschlachtete Fertigmotoren sind nicht Teil des Konzepts.

Der Help-Chat nutzt `/api/platform/help-assistant/chat` und die eigene LLM-Route `help_chat`. Die Route verwendet OpenAI Responses mit `store:false` und AI-Usage-Preflight. Nur passende, kuratierte Hilfeartikel werden als Kontext uebergeben; ohne Treffer findet weder ein Provider-Aufruf noch eine Credit-Reservierung statt.

Ein Lernprojekt kann aus dem Lernmodus direkt in der IDE geoeffnet werden. Beide Modi greifen auf dieselben Project-Server-Projektdateien zu; Codeaenderungen aus der IDE bleiben dadurch am Projekt erhalten.

Der projektgebundene Code-Explorer folgt dem aufgabenbezogenen KI-Ansatz aus [`docs/ai-project-source-retrieval.md`](../../docs/ai-project-source-retrieval.md). Er uebergibt nicht pauschal die ersten 40 oder alle Projektdateien. Sobald die Nutzeraufgabe bekannt ist, sucht die Plattform ueber den Project Server nach relevanten Pfad- und Inhaltstreffern, priorisiert die aktuell geoeffnete Datei und gibt hoechstens sechs Quellen an den Development Assistant weiter. Schreibvorschlaege bleiben auf diese vorhandenen Pfade begrenzt und werden erst nach Nutzerbestaetigung gespeichert.

Die Entwicklungs-KI-Endpunkte erzeugen keine inhaltlichen Fallback-Antworten. Prompt-, Quellensuch-, AI-Usage- oder Providerfehler werden mit einem passenden HTTP-Fehlerstatus und `development_assistant_unavailable` beantwortet. Eine erfolgreiche Antwort stammt immer aus der ausgewiesenen lokalen Systemoperation oder der konfigurierten KI-Route.

Unter `/app/devices/` besitzt der Nutzer eine accountgebundene Hardware-Inventar-Seite. Fuer WLAN-faehige Boards ist die Netzwerksuche der Standardweg: Die IDE sucht erreichbare GerNetiX-Runtime-Boards im lokalen Netzwerk und uebernimmt sie erst nach Nutzerbestaetigung in das Account-Device-Inventar des Device Management Servers. Die manuelle Erfassung bleibt nur ein Fallback fuer nicht automatisch auffindbare Community-Hardware. Die UI setzt keine fremde Account-ID und macht Community-Erfassung nicht automatisch zu GerNetiX-verifizierter Hardware.

Der Architektur-Discovery-Assistent unter `/app/development-platform/` nutzt standardmaessig nur aktuellen Chat und die zentrale Prompt-Foundation aus der AI-Context-SQLite. Identity haelt keine fachlichen Prompt-Regeln im Code, sondern ergaenzt nur dynamischen Laufzeitkontext wie die aktuelle Nutzerreferenz. Fachliche Hardware-Catalog-Inhalte wie ESP32-Boards und Capabilities werden nur als kompakter Prompt-Kontext beigefuegt, wenn der AI Context Server einen passenden Grant fuer `hardware_catalog/processor_boards/esp32` und Zweck `architecture_assistance` erlaubt. Jede solche Nutzung erzeugt ein AI-Context-Audit-Event.

LLM-Aufrufe werden ueber die gemeinsame LLM-Routing-Konfiguration geroutet. Dieser fachliche Runtime-State muss gemaess SQL-only-Persistenz in SQLite liegen; alte `.runtime/identity-llm-config.json`-Dev-Konfigurationen sind nur Migrationsaltlasten. Der Standardprovider ist OpenAI Responses mit `gpt-5-nano`. `general_chat`, `architecture_discovery`, `artifact_generation`, `code_generation` und `help_chat` nutzen diesen kostenoptimierten API-Pfad; Ollama bleibt nur als optionale, nicht vorausgesetzte Konfiguration erhalten.

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
- Lokale Browserseiten werden fuer WebAuthn von `127.0.0.1` auf die gueltige RP-ID `localhost` umgeleitet. Fehlgeschlagene Passkey-Vorgaenge werden sowohl im Browser vor der Serververifikation als auch in Vorbereitung und Verifikation ohne Credential-Daten protokolliert und ueber `SYSTEM_EVENT_INGEST_TOKEN` als persistentes Admin-Tool-Systemereignis gemeldet.
- Das maschinenlesbare Linkinventar und der authentifizierte Prüflauf verwenden den getrennten `LINK_INTEGRITY_INGEST_TOKEN`; Testkonto-Credentials werden nur als Runtime-Secrets an den Prüflauf übergeben und nicht persistiert.
- Nach der Passkey-Registrierung melden Browser und API den fachlichen Ausgang eindeutig: `Konto wurde angelegt.` erst nach erfolgreicher SQLite-Persistenz oder `Konto wurde nicht angelegt. Grund: ...` bei jedem vorherigen Abbruch.

## IONOS E-Mail-Versand

Der Identity Server kann Verifizierungs- und Passwort-Reset-E-Mails ueber ein vorhandenes IONOS-Postfach versenden. Es wird kein eigener E-Mail-Server betrieben und es werden keine eingehenden Mailports benoetigt.

1. Auf dem VPS `IDENTITY_APP_BASE_URL`, denselben langen `IDENTITY_ADMIN_TOKEN` fuer Identity und Admin Tool sowie einen eigenen Base64-kodierten 32-Byte-Wert in `EMAIL_CONFIG_ENCRYPTION_KEY` setzen.
2. Im Admin Tool unter **KI → E-Mail** IONOS SMTP eintragen und testen. Standard: `smtp.ionos.de`, Port `465`, SSL/TLS.
3. Das SMTP-Passwort wird AES-256-GCM-verschluesselt in der Identity-SQLite gespeichert, nie erneut ausgegeben und nicht geloggt.

Solange keine SMTP-Konfiguration vorliegt, bleibt der lokale Mock-Mailversand fuer die Entwicklung aktiv. Nach dem Speichern der SMTP-Konfiguration erhalten neu registrierte Nutzer einen echten Bestaetigungslink.
