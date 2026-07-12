#!/bin/bash

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ELECTRON="$SCRIPT_DIR/node_modules/electron/dist/Electron.app/Contents/MacOS/Electron"
if [ ! -x "$ELECTRON" ]; then
  osascript -e 'display alert "GerNetiX Prozess-Monitor" message "Die Desktop-Runtime fehlt. Bitte im process-monitor-Ordner pnpm install ausführen." as critical'
  exit 1
fi
"$ELECTRON" "$SCRIPT_DIR" >/dev/null 2>&1 &
disown
