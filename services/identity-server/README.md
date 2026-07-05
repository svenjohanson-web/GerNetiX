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

Oeffnet eine einfache Login-Ansicht unter `http://localhost:4300`. Die Ansicht nutzt den lokalen Dev-Login und setzt fuer die Demo ein HttpOnly-Session-Cookie.

### Lokale Tamagotchi-Demo

Der Dev-Server stellt zusaetzlich eine geschuetzte Tamagotchi-Demo bereit:

```text
http://localhost:4300/demo/tamagotchi/
```

Ohne Session wird auf den Login umgeleitet. Fuer die lokale Demo wird beim Start automatisch ein Demo-Account erzeugt:

```text
Benutzer: demo
Passwort: demo-passwort

Lokaler Login-Alias: test / test
```

Fuer eine VPN-Demo kann der Server explizit an eine VPN-/LAN-Adresse gebunden werden:

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
