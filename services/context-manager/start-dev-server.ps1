$ErrorActionPreference = "Stop"

$env:CONTEXT_MANAGER_PERSISTENCE_BACKEND = "sqlite"
$env:CONTEXT_MANAGER_SQLITE_PATH = ".runtime\gernetix-services.sqlite"

New-Item -ItemType Directory -Force .runtime | Out-Null
node services\context-manager\src\dev-server.js *> .runtime\context-manager.log
