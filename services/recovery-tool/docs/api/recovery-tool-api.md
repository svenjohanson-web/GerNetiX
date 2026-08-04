# Hardware-Labor und Recovery Tool API

MVP fuer Wiederherstellung, Community-Board-Erkennung und erneute Device-Management-Anbindung.

## KI-gefuehrtes Hardware-Labor

```text
POST /hardware-lab/sessions
POST /hardware-lab/sessions/{sessionId}/analyze-sources
POST /hardware-lab/sessions/{sessionId}/discovery-firmware-build
POST /hardware-lab/sessions/{sessionId}/discovery-firmware-build-status
POST /hardware-lab/sessions/{sessionId}/discovery-firmware-build-result
POST /hardware-lab/sessions/{sessionId}/examination-report
POST /hardware-lab/sessions/{sessionId}/gernetix-verification-request
```

Eine Hardware-Labor-Session beginnt mit der angemeldeten `identity.user_id`, einem selbst gekauften oder fremden Community-Board, seinem Boardnamen und mindestens einer HTTP-/HTTPS-Quelle. Demo-/Fallback-Identitaeten sind gesperrt. Von GerNetiX vertriebene Boards durchlaufen diesen Ablauf nicht, weil ihre ProcessorBoard-Profile vor dem Vertrieb bereits vollstaendig im Hardware Catalog angelegt und geprueft sind.

`analyze-sources` laedt maximal begrenzte HTML-, Text- oder PDF-Quellen ueber den SSRF-geschuetzten Quellenadapter. Nach dem verpflichtenden AI-Usage-Preflight ruft der Service die zentral konfigurierte OpenAI Responses API mit `store: false`, pseudonymisiertem Safety-Identifier und strengem JSON-Schema auf. Das Ergebnis enthaelt belegte Eigenschaften, Evidenz, offene Fragen und ein Sicherheitsprofil; aktive Pintests werden serverseitig immer auf `false` gesetzt. Abschluss oder Fehler werden im AI-Usage-Event verbucht.

`discovery-firmware-build` erzeugt aus diesem Profil ein deterministisches passives ESP32-Discovery-Paket und sendet es an Build & Deploy. Fehlt in den Quellen eine konkrete PlatformIO-Board-ID, wird nur fuer die Kompilierung ein als generisch markiertes, zur erkannten Chipfamilie passendes DevKit-Ziel verwendet. Dieser Fallback ist kein bestaetigtes physisches Boardprofil. `discovery-firmware-build-status` synchronisiert Fortschritt und uebernimmt nach erfolgreichem echtem PlatformIO-Build Firmwaredatei, Build-ID und SHA-256.

Die reale Untersuchung ist verpflichtend. Ein Boardprofil erreicht `hardware_examined` nur, wenn ein erfolgreicher Discovery-Firmware-Build mit Build-ID und SHA-256 vorliegt und der Firmware-Pruefbericht alle Pflichtphasen als sicher und bestanden meldet. Ein Nutzer kann diesen Zustand nicht durch eine Checkbox ersetzen.

Erst danach akzeptiert die API eine freiwillige Meldung zur GerNetiX-Gegenpruefung. Dafuer ist eine ausdrueckliche Einwilligung erforderlich. Der Kunde waehlt keinen Beschaffungs- oder Versandweg; die interne Prueforganisation wird erst in der Nachbearbeitung geklaert. Die Meldung uebermittelt Boardprofil, Quellen und Pruefbericht, erzeugt weder Kauf- noch Versandauftrag und erfasst keine Versandadresse.

## Prefix

```text
/api/recovery
```

## Sessions

```text
POST /sessions
GET  /sessions
GET  /sessions/{recoverySessionId}
```

`POST /sessions` nimmt USB-/Board-Erkennungsdaten an und erzeugt eine Recovery Session mit Hardwareprofil, Capabilities und Guided Questions.

## Guided Capabilities

```text
POST /sessions/{recoverySessionId}/capabilities
```

Speichert beantwortete Capability-Fragen und manuell erkannte Capabilities fuer Community- oder unbekannte Boards.

## Device Management

```text
POST /sessions/{recoverySessionId}/register-community-device
```

Registriert ein wiederhergestelltes Device beim Device Management Server. Standard ist `community_unverified`; GerNetiX-Provisionierung bleibt dem Provisioning Tool vorbehalten.

## Credentials und Connectivity

```text
POST /sessions/{recoverySessionId}/renew-credentials
POST /sessions/{recoverySessionId}/connectivity-reset
```

Credentials werden als One-Time Secret ausgegeben und danach nur redigiert gespeichert. WLAN-Passwoerter werden nicht zentral gespeichert; Connectivity-Recovery verweist auf den Device-Webserver.
