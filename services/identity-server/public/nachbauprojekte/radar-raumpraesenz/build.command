#!/bin/sh
cd "$(dirname "$0")" || exit 1

GERNETIX_NO_PAUSE=1 sh ./build.sh "$@"
BUILD_EXIT=$?

printf '\nZum Schließen Eingabetaste drücken ... '
read -r _gernetix_answer
exit "$BUILD_EXIT"
