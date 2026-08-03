# Vorlaeufiger Repository-Lesevertrag v1

Dieser Vertrag ist der feste Strang-C-Stub fuer FG-16 und die UI-Anteile von
FG-08. Er wird entfernt, sobald der Project Server die vollstaendigen
Leseendpunkte fuer Datei, Historie und Diff liefert. Die Identity-Routen
bleiben dabei als session- und projektgebundene Browsergrenze erhalten.

Der Stub liest ausschliesslich dokumentierte Project-Server-Antworten:

- `GET /api/projects/{projectId}` mit der oeffentlichen
  `repository_binding`,
- `GET /api/projects/{projectId}/sources`,
- `GET /api/projects/{projectId}/sources/{relativePath}`,
- `GET /api/projects/{projectId}/versions`.

Der Stub gibt fuer den Baum exakt den bereits dokumentierten Project-Server-
Vertrag `{ commit_sha, paths }` aus.

Die SQL-Quellen und Git-Light-Versionen dienen nur als vorlaeufige Lesebasis.
Der Stub schreibt keine Daten und greift nicht direkt auf Forgejo zu.

## Identity-Routen

Alle Routen erfordern zuerst eine gueltige Sitzung und danach
`requireSessionProject`. Ein fremdes Projekt wird vor der Aufloesung von
Repository-, Commit- oder Dateikennungen abgewiesen.

### Status

`GET /api/platform/projects/{projectId}/repository`

```json
{
  "contract_version": "project-repository-read-v1",
  "contract_stub": true,
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

`working_head` bezeichnet den aktuellen technischen Arbeitsstand.
Git-Light-Snapshots werden als benannte GerNetiX-Versionen gekennzeichnet und
nicht als echte Forgejo-Commits ausgegeben.

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
    "truncated": false,
    "patch": "--- vorher\n+++ nachher"
  }]
}
```

Erlaubte Dateizustaende sind `added`, `modified`, `deleted` und `renamed`.
Der vorlaeufige Textdiff ist auf 800 Zeilen begrenzt.

## Sicherheitsgrenze

Browserantworten enthalten bewusst keine Organisation, Repositorykennung,
Clone-URL, Forgejo-Basis- oder Admin-URL und keine Provisionierungs-, Runtime-
oder Nutzertokens. Ein 409-Konflikt wird als `repository_head_conflict`
angezeigt und fuehrt niemals zu einem stillen Ueberschreiben.
