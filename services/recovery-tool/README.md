# Recovery Tool

Das Recovery Tool ist ein eigenstaendiges Nutzer- und Support-Werkzeug zum Retten von ProcessorBoards. Es gehoert nicht zum Factory-Provisioning und ist nicht die User IDE.

## Zweck

- Board per USB erkennen
- Recovery Session fuer den Nutzer oder Support anlegen
- Capabilities und offene Hardwarefragen gefuehrt pruefen
- Credentials erneuern, ohne Secrets dauerhaft zu speichern
- Connectivity-Recovery vorbereiten, ohne WLAN-Passwoerter zentral zu speichern
- unbekannte oder wiederhergestellte Boards als Community-/Recovery-Device im Device Management registrieren

## Start

```text
npm run dev
```

Standardadresse:

```text
http://127.0.0.1:5100/
```

API-Prefix:

```text
/api/recovery
```

## Abgrenzung

- Provisioning Tool: internes Factory-Tool fuer initiales USB-Provisioning verkaufter oder vorbereiteter Boards.
- Recovery Tool: Nutzer-/Support-Werkzeug fuer Rettung, Wiederherstellung, Credential-Erneuerung und Community-Board-Discovery.
- User IDE: Arbeitsumgebung fuer Lernen, Code, Builds und Flash-Aktionen an eigenen Projekten.

## Sicherheitsregeln

- One-Time Secrets werden nur in der Antwort des Erzeugungsschritts ausgegeben.
- Gespeicherte Sessions enthalten nur redigierte Credential-Referenzen.
- Recovery erzeugt keinen automatischen GerNetiX-Hardware-Supportanspruch fuer unbekannte Community-Boards.
- WLAN-Passwoerter werden nicht zentral gespeichert.
