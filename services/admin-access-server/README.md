# Admin Access Server

Der Admin Access Server ist der getrennte Zugang fuer die private GerNetiX-Administration. Er besitzt eine eigene SQLite-Persistenz fuer Admin-Konten, Passwort-Hashes, Sitzungen und Audit-Ereignisse. Kundenkonten und Abos im Identity Server werden nicht verwendet.

## Startkonfiguration

Vor dem ersten Start muessen ausschliesslich im geschuetzten VPS-Environment gesetzt werden:

- `ADMIN_TOOL_ACCESS_TOKEN`: langer zufaelliger Dienst-zu-Dienst-Token; derselbe Wert wird auch vom Admin Tool erwartet.
- `ADMIN_BOOTSTRAP_USERNAME`: Name des ersten Admin-Kontos.
- `ADMIN_BOOTSTRAP_PASSWORD`: mindestens 16 Zeichen, wird nur beim ersten leeren Datenbankstart gelesen.

Nach dem ersten Start kann das Bootstrap-Passwort aus dem VPS-Environment entfernt werden. Es wird nie in die SQLite-Datenbank oder in Logs geschrieben; gespeichert ist nur ein scrypt-Passwort-Hash.

Weitere Admin-Konten legt ein bereits angemeldeter Administrator unter `/admin/access/` an. Es gibt keine Selbstregistrierung.

Die private Console liegt hinter WireGuard unter `https://pwa.gernetix.com/admin/`. Der Browser spricht nur mit diesem Service. Das bestehende Admin Tool akzeptiert im VPS-Betrieb nur noch den internen, token-geschuetzten Proxy dieses Servers.
