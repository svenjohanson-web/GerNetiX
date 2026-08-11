#!/usr/bin/env sh
set -u

cd "$(dirname "$0")" || exit 1

if command -v platformio >/dev/null 2>&1; then
  PIO_COMMAND="platformio"
elif [ -n "${HOME:-}" ] && [ -x "${HOME}/.platformio/penv/bin/platformio" ]; then
  PIO_COMMAND="${HOME}/.platformio/penv/bin/platformio"
else
  echo "PlatformIO wurde nicht gefunden."
  echo "Installiere PlatformIO und starte dieses Skript danach erneut."
  BUILD_EXIT=127
  if [ "${GERNETIX_NO_PAUSE:-0}" != "1" ] && [ -t 0 ]; then
    printf '\nZum Schließen Eingabetaste drücken ... '
    read -r _gernetix_answer
  fi
  exit "$BUILD_EXIT"
fi

BUILD_TARGET="${1:-}"
if [ -z "$BUILD_TARGET" ]; then
  echo "GerNetiX Radar-Raumpraesenz bauen"
  echo
  echo "  1 - ESP32 DevKit"
  echo "  2 - Arduino Nano, alter Bootloader"
  echo "  3 - Arduino Nano, neuer Bootloader"
  echo "  4 - Alle Varianten"
  echo
  printf "Auswahl [1-4]: "
  read -r BUILD_TARGET
fi

case "$BUILD_TARGET" in
  1|esp32|esp32dev) BUILD_ENVS="esp32dev" ;;
  2|nano-old|nanoatmega328) BUILD_ENVS="nanoatmega328" ;;
  3|nano-new|nanoatmega328new) BUILD_ENVS="nanoatmega328new" ;;
  4|all) BUILD_ENVS="esp32dev nanoatmega328 nanoatmega328new" ;;
  *)
    echo "Unbekannte Auswahl: $BUILD_TARGET"
    echo "Erlaubt sind 1-4, esp32dev, nanoatmega328, nanoatmega328new oder all."
    BUILD_EXIT=2
    if [ "${GERNETIX_NO_PAUSE:-0}" != "1" ] && [ -t 0 ]; then
      printf '\nZum Schließen Eingabetaste drücken ... '
      read -r _gernetix_answer
    fi
    exit "$BUILD_EXIT"
    ;;
esac

set --
for BUILD_ENV in $BUILD_ENVS; do
  set -- "$@" -e "$BUILD_ENV"
done

"$PIO_COMMAND" run "$@"
BUILD_EXIT=$?

echo
if [ "$BUILD_EXIT" -eq 0 ]; then
  echo "Build erfolgreich."
else
  echo "Build fehlgeschlagen. Fehlercode: $BUILD_EXIT"
fi

if [ "${GERNETIX_NO_PAUSE:-0}" != "1" ] && [ -t 0 ]; then
  printf '\nZum Schließen Eingabetaste drücken ... '
  read -r _gernetix_answer
fi

exit "$BUILD_EXIT"
