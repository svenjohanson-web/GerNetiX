@echo off
setlocal
set "SCRIPT_DIR=%~dp0"
if not exist "%SCRIPT_DIR%node_modules\.bin\electron.cmd" (
  echo Die Desktop-Runtime fehlt. Bitte im process-monitor-Ordner pnpm install ausfuehren.
  pause
  exit /b 1
)
start "GerNetiX Prozess-Monitor" "%SCRIPT_DIR%node_modules\.bin\electron.cmd" "%SCRIPT_DIR%"
exit /b 0
