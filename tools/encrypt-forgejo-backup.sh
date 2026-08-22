#!/bin/sh
set -eu

if [ "$#" -ne 2 ]; then
  echo "Verwendung: FORGEJO_BACKUP_AGE_RECIPIENT=age1... $0 <backup-verzeichnis> <neue-ausgabedatei.age>" >&2
  exit 64
fi

backup_dir=$1
output=$2
recipient=${FORGEJO_BACKUP_AGE_RECIPIENT:-}
case "$recipient" in age1[0-9a-z]*) ;; *) echo "Ein festes age-X25519-Empfaengerziel fehlt" >&2; exit 65 ;; esac
[ -d "$backup_dir" ] || { echo "Backup-Verzeichnis fehlt" >&2; exit 66; }
[ ! -e "$output" ] && [ ! -e "$output.sha256" ] || { echo "Verschluesseltes Ziel existiert bereits" >&2; exit 65; }
command -v age >/dev/null 2>&1 || { echo "age ist nicht installiert" >&2; exit 69; }

for file in forgejo-database.dump forgejo-data.tar.gz forgejo-version.txt SHA256SUMS; do
  [ -f "$backup_dir/$file" ] && [ ! -L "$backup_dir/$file" ] || { echo "Unvollstaendiger Sicherungssatz: $file" >&2; exit 66; }
done
(
  cd "$backup_dir"
  sha256sum -c SHA256SUMS >/dev/null
) || { echo "Pruefsummenfehler; Verschluesselung abgebrochen" >&2; exit 67; }

archive=$(mktemp "${TMPDIR:-/tmp}/gernetix-forgejo-backup.XXXXXX.tar")
encrypted_tmp="${output}.tmp.$$"
cleanup() { rm -f "$archive" "$encrypted_tmp"; }
trap cleanup EXIT HUP INT TERM
tar -C "$backup_dir" -cf "$archive" forgejo-database.dump forgejo-data.tar.gz forgejo-version.txt SHA256SUMS
age --encrypt --recipient "$recipient" --output "$encrypted_tmp" "$archive"
chmod 0600 "$encrypted_tmp"
mv "$encrypted_tmp" "$output"
(
  output_dir=$(dirname "$output")
  output_name=$(basename "$output")
  cd "$output_dir"
  sha256sum "$output_name" >"$output_name.sha256"
  chmod 0600 "$output_name.sha256"
)
trap - EXIT HUP INT TERM
rm -f "$archive"
printf 'Forgejo-Sicherungssatz verschluesselt: %s\n' "$output"
