#!/bin/bash

set -u

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
WORKSPACE_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BUNDLED_NODE="/Users/sven/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node"

if [ -n "${GERNETIX_NODE:-}" ] && [ -x "$GERNETIX_NODE" ]; then
  NODE_BIN="$GERNETIX_NODE"
elif command -v node >/dev/null 2>&1; then
  NODE_BIN="$(command -v node)"
elif [ -x "$BUNDLED_NODE" ]; then
  NODE_BIN="$BUNDLED_NODE"
else
  echo "FEHLER: Node.js wurde nicht gefunden."
  echo "Installiere Node.js oder setze GERNETIX_NODE auf den vollstaendigen Pfad."
  echo
  read -r -n 1 -p "Taste druecken zum Schliessen ..."
  exit 1
fi

clear
echo "GerNetiX - Prozesse pruefen und starten"
echo "========================================"
echo

cd "$WORKSPACE_ROOT" || exit 1
"$NODE_BIN" tools/check-and-wake-processes.js
EXIT_CODE=$?

echo
if [ "$EXIT_CODE" -eq 0 ]; then
  echo "Alle GerNetiX-Dienste sind bereit."
else
  echo "Mindestens ein Dienst konnte nicht gestartet werden."
  echo "Logs: $WORKSPACE_ROOT/.runtime/process-logs/"
fi

echo
read -r -n 1 -p "Taste druecken zum Schliessen ..."
echo
exit "$EXIT_CODE"
