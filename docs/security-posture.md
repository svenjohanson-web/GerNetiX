# Sicherheitslage und Massnahmenregister

## Zweck

Diese Datei ist die zentrale, fortlaufend gepflegte Uebersicht der empfohlenen und tatsaechlich umgesetzten Sicherheitsmassnahmen fuer GerNetiX. Sie ersetzt keine technische Pruefung: Eine Massnahme gilt erst als umgesetzt, wenn ihr aktueller Zustand am Zielsystem oder durch einen automatisierten Nachweis bestaetigt wurde.

Die Uebersicht enthaelt keine IP-Adressen, Schluessel, Fingerprints, Passwoerter, Tokens oder sonstige Geheimnisse.

## Statusmodell

- **Umgesetzt:** technisch aktiv und mit Datum nachgewiesen.
- **Teilweise:** ein relevanter Teil ist aktiv, aber Schutz oder Nachweis ist unvollstaendig.
- **Empfohlen:** beschlossen oder fachlich sinnvoll, aber noch nicht umgesetzt.
- **Zu pruefen:** der aktuelle Zustand ist nicht belastbar bekannt.

## Aktuell umgesetzte Massnahmen

Stand der letzten VPS-Pruefung: **2026-07-15**

| Bereich | Massnahme | Status | Letzter Nachweis |
| --- | --- | --- | --- |
| Host-Firewall | nftables-Host-Firewall mit eingehender Default-Drop-Policy | Umgesetzt | 2026-07-15: Aktiver und aktivierter `gernetix-firewall.service`; oeffentlich nur HTTP, HTTPS, MQTT-TLS und WireGuard zugelassen; SSH ausschliesslich ueber `wg0`; seit dem letzten Firewall-Reload keine oeffentlichen SSH-Preauth-Vorgaenge protokolliert |
| Administrativer Zugang | WireGuard-VPN als einzige Netzwerkroute fuer SSH und administrative Tunnel | Umgesetzt | Server- und Windows-Tunnel aktiv; Handshake, VPN-Ping und SSH ueber die private VPN-Adresse erfolgreich; direkter oeffentlicher SSH-Zugriff blockiert |
| VPN-Bedienung | GerNetiX-WireGuard-Tunnel im nativen Prozess-Monitor anzeigen, verbinden und trennen | Umgesetzt | Der Monitor liest ausschliesslich den fest definierten Windows-Tunneldienst und steuert ihn ueber isolierte Electron-IPC; Aktionen mit erhoehten Rechten verwenden den Windows-Sicherheitsdialog |
| Schutzregel-Monitoring | VPS-Schutzregeln mit Ort, Grenzwert, Nachweisstatus und empfohlener Massnahme im Desktop-Monitor anzeigen | Teilweise | Read-only Implementierung und Unit-Tests vorhanden; feste SSH-Pruefungen sind vom Renderer isoliert und werden 60 Sekunden gecacht; erneutes Desktop-Paket und Live-Nachweis in der installierten App stehen aus |
| SSH | Passwort-Anmeldung deaktiviert, Public-Key-Anmeldung aktiv, maximal drei Authentifizierungsversuche; Netzwerkzugriff nur ueber WireGuard | Umgesetzt | Effektive `sshd -T`-Konfiguration und Firewall-Regel `iifname "wg0" tcp dport 22 accept` geprueft |
| SSH Angriffsschutz | Fail2ban-SSH-Jail mit systemd-Backend und nftables-Aktion | Umgesetzt | Dienst aktiv und enabled; 5 Versuche in 10 Minuten, Sperrdauer 1 Stunde; Filter gegen Journalbestand getestet |
| Web Edge | Oeffentliche Webzugriffe ueber Nginx und HTTPS | Umgesetzt | 2026-07-15: Listener und laufende TLS-/Certbot-Container geprueft; alle vorgesehenen oeffentlichen Webadressen mit erfolgreicher TLS-Pruefung und HTTP 200 erreicht |
| Admin Tool | Admin-Port nur an VPS-Loopback gebunden und per SSH-Tunnel innerhalb des VPN erreichbar | Umgesetzt | Listener nur auf `127.0.0.1` und Healthcheck ueber eine VPN-SSH-Sitzung geprueft |
| Service-Isolation | Identity und Domaenendienste nicht direkt oeffentlich exponiert | Umgesetzt | Docker-Listener und Compose-Container geprueft |
| MQTT Device-Authentifizierung | Oeffentlicher Device-Port nur ueber mTLS; Zertifikats-CN und geraetespezifische Topic-ACLs | Teilweise | 2026-07-15: Oeffentlicher TLS-Listener aktiv; Verbindung ohne gueltiges Geraetezertifikat beziehungsweise ohne MQTT-Protokoll wurde abgewiesen. End-to-End-Nachweis mit einem ausgestellten Geraetezertifikat und dessen Topic-ACL steht aus |
| Device-Identitaet | P-256-Privatschluessel entsteht auf dem ESP32; Server speichern nur Public Key und Zertifikatsmetadaten | Lokal umgesetzt | 2026-07-14: Provisioning-, Device-Management-, Recovery- und Firmware-Tests; kein Shared Device Secret im neuen Vertrag |
| OTA-Autorisierung | Zeitlich begrenzte ECDSA-P-256-signierte Auftraege mit Key-ID, Device-Bindung und Replay-Sequenz | Lokal umgesetzt | 2026-07-14: Build-&-Deploy- und ESP32-Contract-Tests sowie erfolgreicher PlatformIO-Build; Schluesselinstallation auf dem VPS steht aus |
| SSH Konten | SSH-Zugang auf `root` und `sven` begrenzt | Teilweise | `AllowUsers` geprueft; direkter Root-Zugang per Schluessel ist noch erlaubt |
| Betriebszustand | Container-Healthchecks und lokales Prozessmonitoring | Teilweise | 2026-07-15: Alle 13 Compose-Container aktiv, alle definierten Container-Healthchecks gesund und keine fehlgeschlagenen systemd-Units; zentrale Sicherheitsalarmierung fehlt |
| Kundendaten | Persistente Docker-Volumes | Teilweise | Volumes vorhanden; sie sind gemaess Backup-Konzept kein externes Backup |

## Aktuelle Beobachtungen

- Der oeffentliche VPS wird kontinuierlich automatisiert gescannt. Bei der Pruefung am 2026-07-14 wurden zahlreiche fehlgeschlagene SSH-Vorgaenge sowie Scans auf typische Web- und MQTT-Schwachstellen festgestellt.
- Es gab keinen belastbaren Hinweis auf einen erfolgreichen Fremdzugriff. Erfolgreiche Anmeldungen passten zu den eingerichteten Schluesseln und zum zeitlichen Ablauf der Erstinstallation.
- Zwei Root-Passwort-Anmeldungen aus der Erstinstallationsphase muessen organisatorisch dem Betreiber zugeordnet bleiben. Passwort-Anmeldung ist inzwischen deaktiviert.
- Web-Exploit-Scans erhielten Fehlerantworten oder die normale Loginseite; es wurde kein erfolgreicher Zugriff auf Konfigurationsdateien festgestellt.
- Die aggregierte 24-Stunden-Auswertung am 2026-07-14 zaehlte 747 typische Web-Scannerpfade ohne Serverfehler, 12 abgewiesene MQTT-Anmeldungen und 143 MQTT-TLS-/Protokoll-/Socketfehler. Der weit ueberwiegende Teil der MQTT-Verbindungen stammte vom lokalen Broker-Healthcheck.
- Die erneute Pruefung am 2026-07-15 bestaetigte die erwartete oeffentliche Erreichbarkeit von HTTP, HTTPS und MQTT-TLS sowie die Bindung des Admin Tools an Loopback. Die aktuellen Firewall-Regeln erlauben SSH nur ueber WireGuard. Die zuvor protokollierten automatisierten SSH-Angriffe lagen vor dem letzten Firewall-Reload; danach wurden keine weiteren oeffentlichen SSH-Preauth-Vorgaenge festgestellt.
- Die VPS-Ressourcen waren unkritisch: rund 7 Prozent Datentraegerbelegung, ausreichend freier Arbeitsspeicher und keine ausstehenden Paketaktualisierungen. Es wurden keine fehlgeschlagenen systemd-Units festgestellt.

## Empfohlene Massnahmen

| Prioritaet | Bereich | Empfehlung | Status / Abnahmekriterium |
| --- | --- | --- | --- |
| P0 | Zugangspruefung | Beide hinterlegten SSH-Schluessel und die Verbindungen der Erstinstallation organisatorisch bestaetigen | Empfohlen; unbekannte Zuordnung loest Incident-Response und Schluesselrotation aus |
| P1 | VPN-Wiederherstellung | Einen zweiten, getrennt verwahrten WireGuard-Peer oder einen getesteten Zugriff ueber die VPS-Provider-Konsole als Notfallweg vorhalten | Empfohlen; Verlust des Entwicklungsrechners sperrt den Betreiber nicht dauerhaft aus |
| P1 | SSH Least Privilege | Direkten Root-Login deaktivieren und Administration ausschliesslich ueber `sven` plus `sudo` erlauben | Empfohlen; neuer SSH-Login und `sudo` muessen vor dem Schliessen der Root-Sitzung erfolgreich getestet sein |
| P1 | Backup und Restore | Externe, verschluesselte und gegen den Deployment-Zugang geschuetzte Backups umsetzen | Empfohlen; Details und RPO/RTO in `customer-data-backup-and-recovery.md` |
| P1 | Restore-Nachweis | Automatisierten isolierten Restore-Test fuer alle fuehrenden SQL-Datenbanken etablieren | Empfohlen; erfolgreicher Restore mit Integritaets- und Contract-Checks |
| P1 | Sicherheitsalarmierung | Fail2ban-Bans, ungewoehnliche erfolgreiche Logins, Containerfehler und Backupfehler zentral melden | Empfohlen; sichtbarer Alarm im Admin Tool oder zentralen Betriebsmonitor |
| P1 | Log-Aufbewahrung | SSH-, Nginx-, MQTT-, Audit- und Containerlogs mit definierter Retention sichern | Empfohlen; ein Sicherheitsvorfall bleibt auch nach Container-Neustart nachvollziehbar |
| P1 | PKI-Betrieb | Device-Issuing-CA und OTA-Signierschluessel getrennt sichern, Zugriffsrechte minimieren sowie Rotation und Zertifikatswiderruf festlegen | Lokal vorbereitet; Produktions-Key-Ceremony, CRL-/Sperrprozess und Restore-Test stehen aus |
| P1 | MEDIUM-Recovery-Bootstrap | Bootstrap gegen Selbstueberschreiben schuetzen, nur signierte Device-/Hardware-gebundene Manifeste akzeptieren und Device-Identitaet sowie Pairing bei Recovery erhalten | Empfohlen; Freigabe erst nach Hardwaretests fuer falsche Signatur/Hash, leeres oder defektes Hauptimage, Stromausfall, Serverausfall, LED-/BOOT-Recovery und USB-ROM-Fallback |
| P2 | Patchmanagement | Automatische Sicherheitsupdates oder einen verbindlichen Patchzyklus mit Neustartkontrolle einrichten | Zu pruefen; Updatezustand und ausstehende Neustarts werden ueberwacht |
| P2 | Schwachstellenpruefung | Abhaengigkeiten und Containerimages regelmaessig auf bekannte Schwachstellen pruefen | Empfohlen; CI- oder Deployment-Nachweis mit priorisierten Findings |
| P2 | Deployment-Rechte | Docker-Gruppenmitgliedschaft und Root-nahe Deployment-Rechte auf das notwendige Minimum reduzieren | Empfohlen; dokumentiertes Rollen- und Berechtigungskonzept |
| P2 | Web-/MQTT-Abwehr | Nginx-Rate-Limits, MQTT-Broker-Ressourcengrenzen und eine nftables-Verbindungsrate fuer den oeffentlichen MQTT-TLS-Port einsetzen | Lokal umgesetzt; Nginx-Konfiguration und nftables-Regel gegen die VPS-Versionen validiert, Aktivierung und Lastnachweis auf dem VPS stehen noch aus |
| P3 | Incident Response | Kurzen Ablauf fuer Schluesselverlust, Accountuebernahme, Datenabfluss und Wiederanlauf dokumentieren und testen | Empfohlen; Verantwortliche, Beweissicherung, Rotation, Kommunikation und Recovery sind geklaert |

## Pflege- und Nachweisregel

1. Vor Aenderungen an VPS, Authentifizierung, Autorisierung, oeffentlichen Endpunkten, Secrets, Persistenz, Backup, Logging oder Security-Monitoring diese Datei lesen.
2. Nach jeder solchen Aenderung den betroffenen Eintrag aktualisieren. Ein Statuswechsel auf **Umgesetzt** benoetigt einen konkreten technischen Nachweis und ein Datum.
3. Neue Empfehlungen werden mit Prioritaet, Zielzustand und Abnahmekriterium aufgenommen; erledigte Empfehlungen werden nicht geloescht, sondern in die umgesetzten Massnahmen ueberfuehrt.
4. Nach Sicherheitspruefungen werden nur aggregierte Beobachtungen dokumentiert. IP-Adressen, Schluesselmaterial und andere sensible Indikatoren bleiben ausserhalb des Repositories.
5. Mindestens monatlich sowie nach einem Sicherheitsvorfall wird die gesamte Uebersicht erneut validiert.
