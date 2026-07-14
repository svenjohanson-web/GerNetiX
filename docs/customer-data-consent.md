# Customer Data Consent

## Grundsatz

Kundenrelevante Daten duerfen durch Admin, Support oder interne Rollen nur eingesehen werden, wenn ein gueltiger Consent, eine dokumentierte rechtliche Grundlage oder ein zwingender Sicherheits-/Missbrauchsfall vorliegt.

Ohne Consent duerfen Admin- und Support-Sichten nur maskierte oder technische Minimaldaten zeigen, z. B. aggregierten Status ohne personenbezogene Detailzuordnung.

## Kundenrelevante Daten

Als kundenrelevant gelten insbesondere:

- Account-Bezug und Account-ID
- Account-Device-Inventar
- Device-Ownership und Pairing-Zuordnung
- Device-Status, OTA-Status, Connectivity-Status, IP/Hostname, letzter Kontakt
- Support-Entitlement und Reklamationsgrundlage
- Kompetenzprofil, Lernfortschritt und Lernempfehlungen
- KI-Nutzung, Credits, Usage Events und Kostenbezug
- Support- und Admin-Auditdaten

## Consent-Regeln

- Consent muss zweckgebunden sein.
- Consent muss zeitlich begrenzt sein.
- Consent muss widerrufbar sein.
- Jede Einsicht muss auditierbar sein.
- Secret Material und private Schluessel duerfen nie angezeigt werden; Credentials nur als nicht geheime Metadaten und Fingerprints.

## Admin-/Support-Sichten

Admin und Support duerfen Device-Management-Daten nur einsehen, wenn der Zugriff erlaubt ist.

```text
Anfrage Admin/Support
-> Zweck pruefen
-> Rolle/SystemCapability pruefen
-> Consent oder Rechtsgrundlage pruefen
-> Daten ggf. maskieren
-> Zugriff auditieren
```

## Traceability

Requirement:

- `requirement.customer_data_consent_for_admin_access`

Business Rule:

- `BR-CUSTOMER-DATA-CONSENT`

Datenmodelle:

- `data_model.customer_data_access_consent`
- `data_model.customer_data_access_audit_event`
