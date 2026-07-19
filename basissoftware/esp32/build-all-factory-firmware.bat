@echo off
setlocal EnableExtensions

rem Builds every explicitly supported Factory target and writes one merged image per release.
set "PIO=%USERPROFILE%\.platformio\penv\Scripts\platformio.exe"
set "PYTHON=%USERPROFILE%\.platformio\penv\Scripts\python.exe"
set "ESPTOOL=%USERPROFILE%\.platformio\packages\tool-esptoolpy\esptool.py"

if not exist "%PIO%" (
  echo PlatformIO wurde nicht gefunden: %PIO%
  exit /b 1
)
if not exist "%PYTHON%" (
  echo PlatformIO-Python wurde nicht gefunden: %PYTHON%
  exit /b 1
)
if not exist "%ESPTOOL%" (
  echo esptool.py wurde nicht gefunden: %ESPTOOL%
  exit /b 1
)

node "%~dp0build-factory-firmware-releases.js" "%PIO%" "%PYTHON%" "%ESPTOOL%"
exit /b %ERRORLEVEL%
