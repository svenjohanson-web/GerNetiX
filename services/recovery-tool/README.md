# GerNetiX Hardware-Labor und Recovery Tool

Das Tool verbindet das KI-gefuehrte Hardware-Labor fuer neue ProcessorBoards mit der Wiederherstellung bestehender Boards. Es gehoert nicht zum Factory-Provisioning und ist nicht die User IDE.

## Zweck

- Herstellerseiten und Datenblaetter als Quellen fuer einen Board-Kandidaten erfassen
- Quellen serverseitig begrenzt und SSRF-geschuetzt laden und ueber die konfigurierte OpenAI-Responses-Route als strukturiertes Boardprofil analysieren
- jeden externen KI-Aufruf vorab durch AI Usage freigeben und danach mit den tatsaechlichen Tokens verbuchen
- fuer jedes neue Board verpflichtend eine Discovery-Firmware anfordern
- Build- und realen Hardware-Pruefbericht getrennt und nachvollziehbar erfassen
- die Freigabe sperren, solange die reale Hardware-Untersuchung nicht bestanden ist
- nach Abschluss ein selbst gekauftes Community-Board freiwillig zur GerNetiX-Gegenpruefung melden
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

Fuer den vollstaendigen lokalen Durchstich werden `AI_USAGE_BASE_URL`, `BUILD_DEPLOY_BASE_URL` und die zentrale LLM-Konfiguration benoetigt. Ein echter Smoke-Test gegen eine Herstellerseite und PlatformIO steht als `npm run smoke:hardware-lab` bereit; die Testidentitaet wird ueber `HARDWARE_LAB_ACCOUNT_ID` gesetzt.

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

- Quellen werden nur ueber HTTP(S), mit Redirect-, Groessen-, Zeit- und Medientypgrenzen geladen; lokale, private und reservierte Zielnetze sind auch nach Redirects gesperrt.
- OpenAI erhaelt nur die geladenen Quellen und Boardhinweise, verwendet `store: false` und ein pseudonymisiertes Safety-Identifier. Structured Outputs begrenzen das Ergebnis auf das Boardprofil-Schema.
- AI Usage muss den Aufruf fuer die angemeldete `identity.user_id` vorab freigeben. Tatsaechliche Input-/Output-Tokens werden anschliessend gebucht; Demo- und Fallback-Identitaeten sind unzulaessig.
- Die KI erzeugt keine ausfuehrbare Firmware. Der passive Discovery-Quellcode wird deterministisch von GerNetiX erzeugt; alle aktiven Pintests bleiben deaktiviert.
- Eine erfolgreiche Discovery-Firmware benoetigt Build-ID und SHA-256; eine manuelle Bestaetigung ersetzt den Hardware-Pruefbericht nicht.
- Aktive Pintests duerfen nur innerhalb eines aus den Quellen abgeleiteten sicheren Pinprofils stattfinden.
- Das Hardware-Labor nimmt nur selbst gekaufte oder fremde Community-Boards auf. Von GerNetiX vertriebene Boards sind bereits vollstaendig im Hardware Catalog angelegt und geprueft.
- Die GerNetiX-Gegenpruefung benoetigt eine ausdrueckliche Einwilligung; sie erzeugt keinen Kauf- oder Versandauftrag und erhebt keine Versanddaten.
- One-Time Secrets werden nur in der Antwort des Erzeugungsschritts ausgegeben.
- Gespeicherte Sessions enthalten nur redigierte Credential-Referenzen.
- Recovery erzeugt keinen automatischen GerNetiX-Hardware-Supportanspruch fuer unbekannte Community-Boards.
- WLAN-Passwoerter werden nicht zentral gespeichert.
