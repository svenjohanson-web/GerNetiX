# Community AI Assistant API

MVP fuer Premium-Anfragen an die Community-Wissensbasis mit Quellenbindung, Moderation und AI-Cost-Protection.

## Prefix

```text
/api/community-ai
```

## Nutzerfunktionen

```text
POST /query
POST /similar-content
POST /summaries
```

`/query` fuehrt vor der Antwort einen AI-Usage-Preflight aus, nutzt verifizierte Knowledge Documents aus der Community Platform und schliesst das Usage Event danach ab.

## Admin

```text
GET  /admin/metrics
POST /admin/config
```

Admin-Konfiguration steuert Quellenarten, Pflicht fuer verifizierte Quellen, maximale Quellenanzahl, Moderationsblockliste und Aktivierung des Assistenten.
