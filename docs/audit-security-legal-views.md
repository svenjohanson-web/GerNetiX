# Audit-, Security- und Legal-Views

## Zweck und Geltung

Diese Lesesicht buendelt die fuer ein Audit relevanten Aussagen zu personenbezogenen Daten, Mandantentrennung, Angriffsoberflaechen und Sicherheitsprozessen. Sie ist ein technisches Kontroll- und Nachweisregister, keine Rechtsberatung und kein Verzeichnis von Verarbeitungstaetigkeiten nach DSGVO. Rechtsgrundlagen, Verantwortliche, Auftragsverarbeiter, Loeschfristen und Betroffenenprozesse muessen vor einem produktiven Audit separat verbindlich freigegeben werden.

**Stand:** 2026-07-16. Aussagen mit dem Status **Teilweise**, **Empfohlen** oder **Zu pruefen** sind keine abgeschlossenen Kontrollen. Der technische Detailstatus und dessen Nachweise stehen im [Sicherheitslage und Massnahmenregister](security-posture.md).

## View 1: Was weiss GerNetiX ueber einen Kunden?

Die fachliche Kundenkennung ist die interne, stabile `user_id`. Sie ist der Tenant-Schluessel fuer accountgebundene Daten. Benutzernamen oder E-Mail-Adressen sind keine fachlichen Fremdschluessel fuer Berechtigungsentscheidungen.

| Datenbereich | Beispiele | Fuehrende Speicherung | Schutz- und Transparenzgrenze |
| --- | --- | --- | --- |
| Identitaet und Kontakt | `user_id`, Benutzername, E-Mail, E-Mail-Verifikationsstatus | Identity-SQLite, Volume `identity_state` | Passwort-Hash, Reset- und Sitzungstoken werden nie in Transparenz- oder Admin-Sichten ausgegeben. |
| Authentifizierung | scrypt-Passwort-Hash, Token-Hashes, Sitzungs- und Widerrufszeitpunkte | Identity-SQLite | Geheimnisse bleiben serverseitig; Admin-Zugang nutzt getrennte Konten, Rollen und serverseitige Sitzungen. |
| Projekte und Lernstand | Projekttitel, Beschreibung, Quellen, Hardware-Konfiguration, Build-Historie, Feedback | getrennte Projekt-SQLite, Volume `project_state`, Project Server | `user_id` und `project_id` binden Inhalt an den Tenant. Projektzugriff muss serverseitig gegen die Session geprueft werden. |
| Telemetrie und Ereignisse | Messwerte, Ereignisse, technische Metadaten und Aufbewahrungsregeln | getrennte Telemetrie-SQLite, Volume `telemetry_state`, Telemetry Server | `account_id` und `project_id` trennen die Daten. Rohdaten werden nicht automatisch an KI, Logs oder Kundenansichten weitergegeben. |
| Geraete und Support | Device-ID, Anzeigename, Seriennummer, Board-/Instanz-Konfiguration, Ownership, Pairing, Connectivity- und OTA-Status, Supportanspruch | gemeinsame Service-SQLite, Device Management | Private Device-Schluessel werden nicht gespeichert. Support-/Admin-Einsicht erfordert Consent, Rechtsgrundlage oder Sicherheitsfall und wird auditiert. |
| Kauf- und Leistungsbezug | Purchase Context, Bestell-ID, Angebot, Plan, Support-Level | gemeinsame Service-SQLite, Hardware Shop / Device Management | Nur der kundenbezogene Kontext, keine Zahlungsdaten als fuehrende GerNetiX-Persistenz dokumentiert. Zahlungsdienst-/Auftragsverarbeiter-Status ist vor Produktivbetrieb zu klaeren. |
| KI-Nutzung | Credits, Usage Events, angefragter Zweck, freigegebene Quellen, Modell-/Provider-Metadaten | gemeinsame Service-SQLite sowie AI-Context-PostgreSQL | Provider-Kosten werden aus der Kunden-Transparenz redigiert. Jeder Kontextzugriff wird policy- und grant-basiert entschieden und auditiert. |
| KI-Kontext | Grants, Policy, Prompt-Grundlagen, accountisolierte Intent-Beispiele, KI-Audit | AI-Context-PostgreSQL + pgvector, Volume `ai_context_postgres_data` | Account- und optional Projekt-Scope, Ablauf und Widerruf eines Grants; externe Provider fuer Kundendaten sind policy-gesteuert. |
| Einwilligung und Audit | Consent-ID, Zweck, Zugriff, Actor, Zeitpunkt, Entscheidung | gemeinsame Service-SQLite und AI-Context-PostgreSQL | Jede Support-/Admin-Einsicht soll nachvollziehbar sein; Details nur nach Berechtigung und Zweckbindung. |
| Kommunikationsdaten | Web-Push-Subscription, Accountbezug; SMTP-Konfiguration fuer Verifikation/Reset | gemeinsame Service-SQLite bzw. Identity-SQLite | Push wird accountgebunden zugestellt. SMTP-Passwort ist AES-256-GCM-verschluesselt und wird nicht erneut ausgegeben oder geloggt. |

Nicht als Kundenpersistenz vorgesehen sind Browser-State, `localStorage`, Caches, Temp-Dateien, YAML/JSON-Modelldateien und generierte Dokumentationssichten. WLAN-SSID und -Passwort werden beim USB-Provisioning ausschliesslich zwischen Browser und Board uebertragen; serverseitig bleibt nur ein gehashter, zehn Minuten gueltiger Einmalvorgang.

Der angemeldete Kunde kann die vorhandene `Account Transparency` nutzen. Sie zeigt die eigenen Kontakt-, Projekt-, Device-, Kauf-, Lern-, Credit-, Nutzungs- und Auditdaten in bereinigter Form; Passwort-Hashes, Token, private Schluessel und interne Providerkosten werden nicht offen gelegt.

## View 2: Kunden-Tenants und Datenisolation

GerNetiX verwendet derzeit kein separates Datenbankschema oder eine Datenbank pro Kunde. Es ist ein logisches Multi-Tenant-Modell: die `user_id` ist Tenant-Schluessel; `project_id` und `device_id` sind untergeordnete Objektgrenzen. Die Isolation ist daher eine serverseitig durchzusetzende Autorisierungsregel, nicht eine Netzwerktrennung zwischen Kunden.

| Bereich | Tenant-Grenze | Durchsetzung / Auditpunkt |
| --- | --- | --- |
| Identity | `identity_user_accounts.id` / Session `user_id` | Session- und Rollenpruefung im Identity Server; keine Annahme einer vom Client gelieferten Account-ID. |
| Projekte | `project_server_projects.user_id`, darunter `project_id` | Project Server ist die Quelle der Wahrheit. Jede Listen-, Lese- und Schreiboperation muss Account und Projektzuordnung pruefen. |
| Devices | AccountDevice, DeviceOwnership, Pairing | Device Management loest Ownership serverseitig auf. OTA- und Push-Prozesse adressieren nur den Device-Owner. |
| KI-Kontext | `ai_context_grants.account_id`, optional `project_id`; Intent-Beispiele mit `scope` und `account_id` | AI Context Server verlangt Quelle, Zweck und aktiven Grant; accountisolierte Beispiele duerfen nur fuer denselben Account suchbar sein. |
| Admin und Support | Rolle + SystemCapability + Consent/Rechtsgrundlage | Ohne erlaubten Zugriff nur maskierte technische Minimaldaten; Einsicht und Entscheidung auditieren. |
| MQTT Device-Tenant | Zertifikats-CN / `device_id` | mTLS und Topic-ACL begrenzen ein Device auf sein eigenes OTA- und Status-Topic. |

Wichtige Auditfrage: Die Tenant-Grenze ist nur dann belastbar, wenn API-Contract-Tests auch gezielte Cross-Tenant-Aufrufe (fremde `user_id`, `project_id`, `device_id`, Grant-ID und MQTT-Topic) mit erwarteter Ablehnung abdecken. Diese Negativtests sind als wiederkehrender Auditnachweis zu fuehren.

## View 3: Datenfluesse und externe Empfaenger

```text
Kunde / Plattform
  -> Identity (Login, Session, Accountbezug)
  -> Project / Device / AI Usage (interne Docker-Services, Service-SQLite)
  -> AI Context (Grant- und Policy-Pruefung, PostgreSQL)
  -> freigegebener Modellroute oder lokaler Ollama

ESP32 (mTLS)
  -> MQTT Broker (geraetespezifische ACL)
  -> Build & Deploy / Device Management (interne Dienste)

Admin (WireGuard + separates Admin-Login)
  -> Admin Access Server
  -> loopback-gebundenes Admin Tool
```

| Empfaenger / Grenze | Uebertragene Daten | Kontrollpunkt |
| --- | --- | --- |
| IONOS SMTP | E-Mail-Adresse und Nachrichteninhalt fuer Verifikation oder Passwort-Reset | TLS, verschluesselte SMTP-Konfiguration, kein Credential-Logging; Auftragsverarbeiter- und Transferpruefung offen. |
| Lokaler Ollama | nur die fuer die jeweilige lokale Route benoetigten Prompts bzw. kuratierten Help-Artikel | GerNetiX Help nutzt ausschliesslich lokale `help_chat`-Route; ohne passenden Help-Treffer kein Modellaufruf. |
| Optionaler externer LLM-Provider | nur per AI-Context-Policy und Grant freigegebener Kontext sowie Provider-/Modellmetadaten | Providervertrag, Region/Transfer, Datenminimierung und Freigabe muessen je aktivierter Route nachgewiesen werden. |
| Web-Push-Provider | konto- und projektgebundene Push-Subscription und technische Nachricht | Kein globaler Broadcast; Projektmeldungen nur innerhalb derselben Konto-/Projektpartition, Sicherheitsalarme nur an explizite Empfaengergruppe. |
| VPS/Hosting | alle produktiven Laufzeitdaten in verschluesselungsbeduerftigen Volumes | Externe, verschluesselte Backups und Restore-Test sind noch offen. |

## View 4: Angriffsoberflaeche und Abwehr

| Angriffsvektor | Bestehende Kontrolle | Status / Restrisiko |
| --- | --- | --- |
| Oeffentliche Web-, Login- und Build-Endpunkte | HTTPS via Nginx, Rate-Limits, interne Domainservices | Web Edge umgesetzt; regelmaessige Schwachstellen- und Dependency-Scans noch empfohlen. |
| SSH und Admin-Zugang | Host-Firewall Default-Drop, SSH nur ueber WireGuard, Fail2ban, Admin Tool nur Loopback | Weitgehend umgesetzt; direkter Root-SSH-Login ist noch ein Least-Privilege-Risiko. |
| Kontouebernahme | scrypt-Hashes, serverseitige Sitzungen, Verifikations- und Reset-Token nur gehasht | Admin- und Identity-E2E-Nachweis auf VPS steht teilweise aus. |
| Cross-Tenant-Zugriff | `user_id`-gebundene Serverautorisierung, Ownership, Grants und Consent-Audit | Logische statt physische Tenant-Trennung; negative Autorisierungstests als Pflichtnachweis. |
| Unberechtigte Admin-/Support-Einsicht | getrennte Admin-Konten, Rollen, SystemCapabilities, Consent-/Rechtsgrundlagenpruefung, Audit | Umsetzungs- und End-to-End-Nachweis fuer Admin-Zugang teilweise offen. |
| Device-Imitation und MQTT-Missbrauch | P-256-Schluessel auf dem ESP32, mTLS, CN-/Topic-ACL, Ressourcenlimits | Realer Device-mTLS- und ACL-End-to-End-Nachweis steht noch aus. |
| OTA-Manipulation oder Replay | signierte, zeitlich begrenzte P-256-Auftraege, Device-Bindung, Sequenz, SHA-256 und Rollback | Hardware- und Rotations-/Recovery-Nachweise offen. |
| Datenverlust oder Ransomware | persistente Volumes, dokumentierte RPO/RTO-Ziele | Kein Ersatz fuer Backup: externer, verschluesselter Backup- und Restore-Nachweis ist P1-offen. |
| Log-/Monitoring-Ausfall | Container-Healthchecks, Prozessmonitor, vorbereitete Sicherheitsalarmierung | Retention, Live-Timer, SMTP und sichtbarer Alarm noch teilweise offen. |
| Missbrauch lokaler KI | kuratiertes Help-Wissen, Grant/Policy, AI-Usage-Preflight | Rate-Limit je Account/Sitzung und Betriebsmetriken noch empfohlen. |
| Geheimnisabfluss | keine privaten Device-Schluessel im Server; SMTP-Passwort verschluesselt; keine Secrets in diesem Register | PKI-Rotation, Widerruf und getrennte Schluesselsicherung fehlen als Betriebsnachweis. |

## View 5: Sicherheits- und Datenschutzprozesse

| Prozess | Ausloeser | Ablauf | Nachweis |
| --- | --- | --- | --- |
| Kunden-/Support-Einsicht | Admin- oder Supportanfrage | Zweck -> Rolle/Capability -> Consent oder Rechtsgrundlage -> ggf. Maskierung -> Audit | Consent-ID, Audit-Event, zugreifende Rolle, Zeit, Zweck und Entscheidung. |
| KI-Kontextzugriff | KI-Anfrage | Quelle und Zweck bestimmen -> Grant/Policy pruefen -> Redaction/Provider-Scope anwenden -> Entscheidung auditieren | AI-Context-Audit, Grant, Provider-/Modellmetadaten, Ablehnungsgrund. |
| Incident Response | Schluesselverlust, Kontouebernahme, Datenabfluss oder Ausfall | Vorfall abgrenzen, Beweise sichern, Zugriffe/Schluessel rotieren, Betroffene informieren, Wiederanlauf pruefen | Der Prozess ist als P3-Empfehlung noch zu dokumentieren und zu testen. |
| Backup und Restore | regelmaessig, vor risikoreichen Migrationen, nach Vorfall | konsistent sichern -> verschluesselt extern ablegen -> isoliert restoren -> Integritaet und Tenant-Beziehungen pruefen | RPO <= 1 h, RTO <= 4 h, Manifest/Checksumme und vierteljaehrlicher Restore-Test; technisch noch offen. |
| Sicherheitsmonitoring | alle fuenf Minuten / Befund | Fail2ban-, Systemd- und Containerbefunde aggregieren -> token-geschuetzt einliefern -> persistieren -> kritische Meldung mit Cooldown versenden | Timer-, Ingestion-, Alarm- und Retention-Nachweis; Live-Betriebsnachweis teilweise offen. |
| Vulnerability/Patch-Management | regelmaessig und vor Release | Abhaengigkeiten, Containerimages und Host-Patches bewerten -> priorisiert beheben -> Neustartkontrolle | Verbindlicher Zyklus und automatisierte Scans sind noch empfohlen. |
| Betroffenenrechte und Loeschung | Auskunft, Berichtigung, Loeschung, Widerruf | Accountdaten ermitteln -> fachlich loeschen/berichtigen -> Backup-Retention beruecksichtigen -> Abschluss dokumentieren | Prozess, Fristen, Verantwortliche und Backup-Tombstone/Restore-Schutz vor Produktivbetrieb festlegen. |

## Audit-Paket: Mindestnachweise

Fuer eine konkrete Auditperiode sind nicht nur diese Architekturtexte vorzulegen, sondern zeitlich zuordenbare Belege:

1. Version dieses Dokuments, [Sicherheitslage](security-posture.md), [Consent-Konzept](customer-data-consent.md) und [Backup-/Restore-Konzept](customer-data-backup-and-recovery.md).
2. Aktueller Graph-Status ohne Validierungsfehler sowie die relevanten Requirements und Datenmodelle, insbesondere `requirement.customer_data_consent_for_admin_access`, `data_model.customer_data_access_consent` und `data_model.customer_data_access_audit_event`.
3. Konfigurations- und Laufzeitnachweise fuer Firewall, WireGuard, SSH, Nginx, Mosquitto-mTLS, Admin-Loopback und Container-Healthchecks; niemals Secrets, private Schluessel oder personenbezogene Rohlogs in das Auditpaket aufnehmen.
4. Contract-/Negativtests fuer Authentifizierung, Cross-Tenant-Autorisierung, Consent/Maskierung, KI-Grant/Policy, MQTT-ACL und OTA-Replay-Schutz.
5. Stichprobe der Audit-Trails mit redigierten Account-IDs sowie Nachweise zu Alarmen, Patchständen, Backupalter und Restore-Proben.
6. Verbindliche Legal-Freigaben: Rollen Verantwortlicher/Auftragsverarbeiter, Verzeichnis von Verarbeitungstaetigkeiten, Rechtsgrundlagen, Datenschutzinformation, Auftragsverarbeitungsvertraege, internationale Transfers, Loesch- und Betroffenenrechte.

## Verwandte Quellen

- [Sicherheitslage und Massnahmenregister](security-posture.md): aktueller Kontrollstatus und technische Nachweise.
- [Customer Data Consent](customer-data-consent.md): fachliche Zugriffsvoraussetzung fuer Admin und Support.
- [Sicherung und Wiederherstellung von Kundendaten](customer-data-backup-and-recovery.md): RPO/RTO, Retention und offene Umsetzung.
- [System-, Prozess- und Applikationslandschaft](system-process-application-uml.md): Services, Persistenz und Netzgrenzen.
- [VPS Deployment mit Docker Compose](vps-docker-deployment.md): Oeffentliche Endpunkte, Docker-Netze und Volumes.
