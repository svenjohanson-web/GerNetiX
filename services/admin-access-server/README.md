# Admin Access Server

Der Admin Access Server ist der getrennte Zugang fuer die private GerNetiX-Administration. Lokal kann er eine eigene SQLite-Persistenz nutzen; im VPS-Betrieb liegen Admin-Konten, Passwort-Hashes, Sitzungen und Audit-Ereignisse in der zentralen PostgreSQL-Datenbank. Kundenkonten und Abos im Identity Server werden nicht verwendet.

## Startkonfiguration

Vor dem ersten Start muessen ausschliesslich im geschuetzten VPS-Environment gesetzt werden:

- `INTERNAL_API_TRUSTED_PUBLIC_KEYS_JSON`: oeffentlicher Trust Ring fuer interne Tokens.
- `INTERNAL_API_SIGNING_KEY_ID` und `INTERNAL_API_SIGNING_PRIVATE_KEY_B64`: eigener Ed25519-Key fuer kurzlebige Admin-Tool-Proxy-Tokens und signierte Admin-Delegationen.
- `CONTEXT_MANAGER_BASE_URL`: internes Ziel des Context-Manager-BFF, lokal standardmaessig `http://127.0.0.1:5050`.
- `ADMIN_BOOTSTRAP_USERNAME`: Name des ersten Admin-Kontos.
- `ADMIN_BOOTSTRAP_PASSWORD`: mindestens 16 Zeichen, wird nur beim ersten leeren Datenbankstart gelesen.

Nach dem ersten Start kann das Bootstrap-Passwort aus dem VPS-Environment entfernt werden. Es wird nie in die SQLite-Datenbank oder in Logs geschrieben; gespeichert ist nur ein scrypt-Passwort-Hash.

Weitere Admin-Konten legt ein bereits angemeldeter Administrator unter `/admin/access/` an. Es gibt keine Selbstregistrierung.

Die private Console liegt hinter WireGuard unter `https://pwa.gernetix.com/admin/`. Der Browser spricht nur mit diesem Service. Das bestehende Admin Tool akzeptiert im VPS-Betrieb nur noch den internen, token-geschuetzten Proxy dieses Servers.

Administratoren mit `context_manager.read`, `context_manager.write` und
`context_manager.analyze` koennen die Context-Manager-HMI unter
`/context-manager/` bedienen. Admin Access prueft die HttpOnly-Sitzung,
Capability und bei Mutationen das Double-Submit-CSRF-Token. Es leitet nur eine
feste Methoden-/Routen-Allowlist weiter und stellt je Request einen
kurzlebigen, actor-gebundenen Diensttoken aus. Cookies, Browser-Authorization
und interne Tokens werden nicht aneinander weitergereicht. Request und
Ergebnis werden inhaltsfrei im Admin-Access-Audit protokolliert.
