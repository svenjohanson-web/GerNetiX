# Repository-Lesevertrag v1

Dieser Vertrag verbindet FG-16 und die UI-Anteile von FG-08 mit den echten
Repository-Endpunkten des Project Servers. Die Identity-Routen bleiben als
session- und projektgebundene Browsergrenze erhalten. Der Browser spricht
weder Forgejo direkt an noch erhaelt er Clone-URLs oder Zugangsdaten.

Bei einer aktiven Forgejo-Bindung liest der Adapter ausschliesslich:

- `GET /api/projects/{projectId}` mit der oeffentlichen
  `repository_binding`,
- `GET /api/projects/{projectId}/repository/tree`,
- `GET /api/projects/{projectId}/repository/history`,
- `GET /api/projects/{projectId}/repository/commits/{sha}/diff`,
- `GET /api/projects/{projectId}/sources/{relativePath}?commit_sha={sha}`.

Solange ein Bestandsprojekt noch keine aktive Forgejo-Bindung besitzt, bleibt
der vorhandene SQL-/Git-Light-Lesevertrag als klar gekennzeichneter
Uebergangs-Fallback aktiv. Er liest dann zusaetzlich `sources` und `versions`.
Dieser Fallback ist keine neue fachliche Wahrheit und schreibt keine Daten.

Der Adapter gibt fuer den Baum exakt den Project-Server-Vertrag
`{ commit_sha, paths }` aus.

## Identity-Routen

Alle Routen erfordern zuerst eine gueltige Sitzung und danach
`requireSessionProject`. Ein fremdes Projekt wird vor der Aufloesung von
Repository-, Commit- oder Dateikennungen abgewiesen.

### Status

`GET /api/platform/projects/{projectId}/repository`

```json
{
  "contract_version": "project-repository-read-v1",
  "contract_stub": false,
  "project_id": "project-id",
  "repository": {
    "state": "active",
    "provider": "forgejo",
    "default_branch": "main",
    "head_sha": "40-stellige-hex-sha",
    "read_only": true
  }
}
```

### Baum

`GET /api/platform/projects/{projectId}/repository/tree?commit_sha={fullSha}`

```json
{ "commit_sha": "40-stellige-hex-sha", "paths": ["README.md"] }
```

### Datei

`GET /api/platform/projects/{projectId}/repository/files/{relativePath}?commit_sha={fullSha}`

```json
{
  "commit_sha": "40-stellige-hex-sha",
  "path": "README.md",
  "content_type": "text/markdown",
  "size_bytes": 42,
  "binary": false,
  "truncated": false,
  "content": "# Projekt"
}
```

Binärdateien und Textdateien ueber 256 KiB liefern keinen Inhalt. Absolute
Pfade, leere Segmente, `..` und `.git` werden abgewiesen.

### Historie

`GET /api/platform/projects/{projectId}/repository/history`

```json
{
  "contract_version": "project-repository-read-v1",
  "items": [{
    "commit_sha": "40-stellige-hex-sha",
    "parent_commit_sha": "",
    "message": "Aktueller Arbeitsstand",
    "kind": "working_head",
    "named_version_id": "",
    "created_at": ""
  }]
}
```

Echte Forgejo-Staende werden als `git_commit` ausgegeben. Nur beim
Uebergangs-Fallback bezeichnet `working_head` den aktuellen technischen
Arbeitsstand; dort werden Git-Light-Snapshots als benannte GerNetiX-Versionen
gekennzeichnet und nicht als echte Forgejo-Commits ausgegeben.

### Diff

`GET /api/platform/projects/{projectId}/repository/commits/{fullSha}/diff`

```json
{
  "contract_version": "project-repository-read-v1",
  "commit_sha": "40-stellige-hex-sha",
  "parent_commit_sha": "40-stellige-hex-sha-oder-leer",
  "files": [{
    "path": "README.md",
    "previous_path": "README.old.md",
    "status": "renamed",
    "binary": false,
    "truncated": true,
    "patch": ""
  }]
}
```

Erlaubte Dateizustaende sind `added`, `modified`, `deleted` und `renamed`.
Der echte Project-Server-Endpunkt liefert derzeit sichere Pfadmetadaten statt
eines Text-Patches; die UI kennzeichnet das mit `truncated: true`. Der
Uebergangs-Fallback erzeugt weiterhin einen auf 800 Zeilen begrenzten
Textvergleich.

## Sicherheitsgrenze

Browserantworten enthalten bewusst keine Organisation, Repositorykennung,
Clone-URL, Forgejo-Basis- oder Admin-URL und keine Provisionierungs-, Runtime-
oder Nutzertokens. Ein 409-Konflikt wird als `repository_head_conflict`
angezeigt und fuehrt niemals zu einem stillen Ueberschreiben.
