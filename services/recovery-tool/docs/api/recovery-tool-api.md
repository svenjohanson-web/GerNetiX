# Recovery Tool API

MVP fuer Wiederherstellung, Community-Board-Erkennung und erneute Device-Management-Anbindung.

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
