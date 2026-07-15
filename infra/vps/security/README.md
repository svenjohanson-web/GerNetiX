# VPS-Sicherheitsalarmierung

`security-alert-scan.sh` bewertet Fail2ban-Sperren, fehlgeschlagene Systemdienste und ungesunde GerNetiX-Container. Es uebermittelt nur einen aggregierten Befund an das lokale Admin Tool; dieses persistiert das Ereignis und versendet bei Fehler/Kritisch hoechstens eine Mail je Befund innerhalb von 30 Minuten.

VPS-Einrichtung nach Deployment:

1. Einen zufaelligen Wert als `SECURITY_MONITOR_TOKEN` in `.env.vps` und in `/etc/gernetix/security-alert-monitor.env` setzen. Die Environment-Datei bekommt Modus `0600`.
2. Service- und Timer-Datei nach `/etc/systemd/system/` kopieren, `systemctl daemon-reload` ausfuehren und den Timer aktivieren.
3. Mit `systemctl start gernetix-security-alert-monitor.service` einen kontrollierten Lauf ausfuehren.

Der Admin-Port bleibt Loopback-only. Die iPhone-Verwaltung erfolgt spaeter ueber WireGuard und die responsive Admin-Oberflaeche; ein oeffentlicher Admin-Port oder Log-Export wird dadurch nicht eingefuehrt.
