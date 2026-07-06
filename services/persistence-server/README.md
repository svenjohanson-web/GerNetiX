# Persistence Server

SQLite-basierter MVP-Persistenzserver fuer GerNetiX-Services.

Der Server speichert servicebezogene Snapshots in einer SQLite-Datei. Die Services koennen denselben SQLite-Pfad direkt mit `PERSISTENCE_BACKEND=sqlite` verwenden. Der HTTP-Server bietet zusaetzlich eine zentrale API fuer Werkzeuge, Migrationen und spaetere Service-Auslagerung.

Direkte SQLite-Snapshot-Persistenz ist vorbereitet fuer:

- Identity Server
- Build-&-Deploy Server
- Provisioning Tool
- Admin Tool
- Device Management Server
- Project Server
- Hardware Shop
- AI Usage Server
- Recovery Tool
- Community Platform
- Community AI Assistant

## Start

```text
npm run dev
```

Standardadresse:

```text
http://127.0.0.1:5400
```

## API

```text
GET /health
GET /api/persistence/snapshots/{serviceKey}
PUT /api/persistence/snapshots/{serviceKey}
```

`PUT` erwartet:

```json
{
  "state": {}
}
```

## Konfiguration

- `HOST`: Bind-Adresse, Standard `127.0.0.1`
- `PORT`: HTTP-Port, Standard `5400`
- `PERSISTENCE_RUNTIME_DIR`: Runtime-Verzeichnis
- `PERSISTENCE_SQLITE_PATH`: SQLite-Datei, Standard im Runtime-Verzeichnis

Services aktivieren SQLite direkt ueber:

```text
PERSISTENCE_BACKEND=sqlite
PERSISTENCE_SQLITE_PATH=.runtime/gernetix-services.sqlite
```

Alternativ kann jeder Service einen eigenen Prefix verwenden, z. B. `PROJECT_SERVER_PERSISTENCE_BACKEND=sqlite` oder `AI_USAGE_PERSISTENCE_BACKEND=sqlite`.
