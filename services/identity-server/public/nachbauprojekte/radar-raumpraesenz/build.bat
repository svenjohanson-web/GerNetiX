@echo off
setlocal
cd /d "%~dp0"

set "PIO_COMMAND=platformio"
if exist "%USERPROFILE%\.platformio\penv\Scripts\platformio.exe" set "PIO_COMMAND=%USERPROFILE%\.platformio\penv\Scripts\platformio.exe"

set "BUILD_TARGET=%~1"
if not defined BUILD_TARGET (
  echo GerNetiX Radar-Raumpraesenz bauen
  echo.
  echo   1 - ESP32 DevKit
  echo   2 - Arduino Nano, alter Bootloader
  echo   3 - Arduino Nano, neuer Bootloader
  echo   4 - Alle Varianten
  echo.
  set /p "BUILD_TARGET=Auswahl [1-4]: "
)

if /i "%BUILD_TARGET%"=="1" set "BUILD_TARGET=esp32dev"
if /i "%BUILD_TARGET%"=="esp32" set "BUILD_TARGET=esp32dev"
if /i "%BUILD_TARGET%"=="2" set "BUILD_TARGET=nanoatmega328"
if /i "%BUILD_TARGET%"=="nano-old" set "BUILD_TARGET=nanoatmega328"
if /i "%BUILD_TARGET%"=="3" set "BUILD_TARGET=nanoatmega328new"
if /i "%BUILD_TARGET%"=="nano-new" set "BUILD_TARGET=nanoatmega328new"
if /i "%BUILD_TARGET%"=="4" set "BUILD_TARGET=all"

if /i "%BUILD_TARGET%"=="all" (
  "%PIO_COMMAND%" run -e esp32dev -e nanoatmega328 -e nanoatmega328new
) else if /i "%BUILD_TARGET%"=="esp32dev" (
  "%PIO_COMMAND%" run -e esp32dev
) else if /i "%BUILD_TARGET%"=="nanoatmega328" (
  "%PIO_COMMAND%" run -e nanoatmega328
) else if /i "%BUILD_TARGET%"=="nanoatmega328new" (
  "%PIO_COMMAND%" run -e nanoatmega328new
) else (
  echo Unbekannte Auswahl: %BUILD_TARGET%
  echo Erlaubt sind 1-4, esp32dev, nanoatmega328, nanoatmega328new oder all.
  set "BUILD_EXIT=2"
  goto finish
)

set "BUILD_EXIT=%ERRORLEVEL%"

:finish
echo.
if "%BUILD_EXIT%"=="0" (
  echo Build erfolgreich.
) else (
  echo Build fehlgeschlagen. Fehlercode: %BUILD_EXIT%
)
echo.
pause
exit /b %BUILD_EXIT%
