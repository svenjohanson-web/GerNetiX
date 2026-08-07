# VPS-Sicherheitsalarmierung

`security-alert-scan.sh` bewertet Fail2ban-Sperren, fehlgeschlagene Systemdienste und ungesunde GerNetiX-Container. Es uebermittelt nur einen aggregierten Befund an das lokale Admin Tool; dieses persistiert das Ereignis und versendet bei Fehler/Kritisch hoechstens eine Mail je Befund innerhalb von 30 Minuten.

VPS-Einrichtung nach Deployment:

1. Einen zufaelligen Wert als `SECURITY_MONITOR_TOKEN` in `.env.vps` und in `/etc/gernetix/security-alert-monitor.env` setzen. Die Environment-Datei bekommt Modus `0600`.
2. Service- und Timer-Datei nach `/etc/systemd/system/` kopieren, `systemctl daemon-reload` ausfuehren und den Timer aktivieren.
3. Mit `systemctl start gernetix-security-alert-monitor.service` einen kontrollierten Lauf ausfuehren.

## Dedizierter Prozessmonitor-Zugang

Der Desktop-Prozessmonitor verwendet den Maschinenbenutzer `gernetix-monitor`.
Der Benutzer bekommt weder ein Passwort noch eine interaktive Shell und wird
nicht in die Docker-Gruppe aufgenommen. Installiere das versionierte Wrapper-
Skript als `/usr/local/sbin/gernetix-monitor-diagnostic` (root:root, 0755), den
SSH-Einstieg als `/usr/local/sbin/gernetix-monitor-ssh` (root:root, 0755) und
die passende Datei `gernetix-monitor.sudoers` nach `/etc/sudoers.d/` (root:root,
0440). Vor dem Aktivieren immer `visudo -c` ausführen. Der SSH-Schlüssel sollte
zusätzlich mit `from="<WireGuard-Peer>"`, `no-pty`, `no-agent-forwarding`,
`no-port-forwarding` und `no-X11-forwarding` eingeschränkt werden.

Der Wrapper akzeptiert ausschließlich `security`, `compose-ps`,
`link-integrity` und `user-action-alerts`. Die Account-Shell zeigt auf den SSH-Einstieg, der alle anderen
Kommandos ablehnt. Erst nach Installation und einem erfolgreichen Test über den
WireGuard-Peer darf `GERNETIX_STAGING_MONITOR_SSH` in `.env.staging.local` auf
`gernetix-monitor@gernetix-vps` gesetzt werden. `GERNETIX_STAGING_SSH` bleibt für
den separaten Diagnose-/Datenbanktunnel erhalten. Die laufende VPS-Konfiguration
wird durch diese Dateien nicht automatisch verändert.

Der Admin-Port bleibt Loopback-only. Die iPhone-Verwaltung erfolgt spaeter ueber WireGuard und die responsive Admin-Oberflaeche; ein oeffentlicher Admin-Port oder Log-Export wird dadurch nicht eingefuehrt.
