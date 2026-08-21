# Inventar der HTTP-Schnittstellen und Zugriffsklassen

Stand: 2026-08-14 (Quellcode-Audit, kein VPS-Laufzeitnachweis)
Geltung: alle derzeit unter `services/` registrierten HTTP-Server. MQTT, lokale
Serial-Schnittstellen und reine statische Dateien sind bewusst nicht Teil dieses
HTTP-Inventars.

## Zweck und Lesart

Dieses Inventar ist der verbindliche Ausgangspunkt fuer die Umstellung auf
**Default deny**. Eine Zeile mit `heute: keine` beschreibt den gegenwaertigen
Codezustand und ist keine Freigabe. `Zielklasse` und `Zielscope` sind die
Migrationsvorgabe. Eine Route darf erst als umgesetzt gelten, wenn der
entsprechende Middleware- und Contract-Test existiert.

Klassen:

| Klasse | Mindestpruefung |
| --- | --- |
| `health` | Nur minimale, netzseitig begrenzte Antwort; keine Fachdaten. |
| `public` | Explizite Allowlist, keine privaten Daten; Rate-Limit. |
| `user` | Identity-Session, CSRF bei Mutation, Ressourcenbesitz/Freigabe und ggf. Entitlement. |
| `internal-service` | Kurzlebiger, signierter Dienst-Token mit `aud`, Ablauf und Scope. |
| `delegated-user-action` | Dienst-Token **und** signierte, eng begrenzte Nutzer-/Konto-/Projektdelegation. |
| `worker` | Kurzlebige Worker-Identitaet, Instanz- und Lease-/Job-Bindung. |
| `device` | Registrierte Geraeteidentitaet bzw. mTLS/Challenge und Geraete-/Projektbindung. |
| `admin` | Admin-Session, Rolle/Capability sowie serverseitig vertrauenswuerdiger Admin-Kontext. |

`{id}`, `{accountId}`, `{projectId}` und `{path}` stehen fuer URL-Parameter;
eine Zeile mit mehreren Methoden benennt jede konkret implementierte Methode.
Alle `/health`-Routen haben die Klasse `health`; sie sind weiter unten nur
einmal als gemeinsame Ausnahme aufgefuehrt.

## Umsetzungsstand 2026-08-14

Lokal umgesetzt und mit Negativtests belegt sind der gemeinsame Token- und
Delegationsvertrag, Project, AI Usage, AI Context, Community AI, Recovery,
Build Deploy, Compute, Device Management, Community Platform, Hardware Catalog,
Hardware Shop, Persistence, Public Demo, Telemetry und Context Manager sowie die
zugehoerigen Identity-, Admin-, Voice-, Provisioning- und Hardware-Lab-Aufrufer. Die
Telemetrie-Ownership-Aufloesung verwendet dedizierte, datenminimierte
Service-Scopes gegen Project und Device Management. Die Spalte `Heute` bleibt
als Audit-Ausgangsstand erhalten; der aktuelle Nachweis steht in
`docs/security-posture.md` und den Contract-Tests.

Build Deploy prueft seine Fachrouten mit Audience und Minimal-Scope, bindet
Konto-/Projektaktionen an eine Delegation, Worker-Uploads an Worker/Job/Datei
und Firmwaredownloads an eine kurzlebige Job-/Datei-/Geraetefreigabe.
Compute trennt weiterhin Bootstrap und kurzlebige Workeridentitaet; seine
internen Control-Plane-Routen pruefen nun je Aktion einen eigenen Service-Scope.
Alle in diesem Rollout priorisierten internen Fachrouten sind lokal auf den
gemeinsamen Vertrag migriert.
Eine Route gilt erst nach Zielpruefung und migriertem Aufrufer als abgeschlossen.

Produktive Diensttokens werden mit dienstweisen Ed25519-Private-Keys
ausgestellt. Empfaenger erhalten ausschliesslich den oeffentlichen,
issuergebundenen Trust Ring. Der CI-Routenguard prueft alle 20 erkannten
HTTP-Services gegen dieses Inventar; neue Services werden nicht automatisch
freigegeben.

## Gemeinsame Ausnahmen

| Routen | Heute | Zielklasse / Scope |
| --- | --- | --- |
| `GET /health` in jedem HTTP-Service | Keine HTTP-Authentifizierung; Inhalt ist minimal, ausser bei Identity. | `health`; nur private Container-/Monitoring-Netze, keine Detaildiagnose. |
| `GET /health` bei Identity | Zusaetzlich `identity_db` und `dependencies` mit Erreichbarkeit, Fehlercode und Fehlermeldung je Abhaengigkeit. | `health`; die Detaildiagnose ist nur zulaessig, weil der Identity-Port ausschliesslich an `127.0.0.1` gebunden ist (`compose.vps.yaml`, privater Plattform-Tunnel). Wird die Route je oeffentlich erreichbar, muss der Detailteil entfallen. |
| Dokument-/UI- und Static-GET-Routen der Operator-Tools | Teilweise ueber Admin-Access-Session geschuetzt, teilweise lokaler Dev-Server. | Kein Ersatz fuer API-Schutz; nur explizite `public`-Assets oder `admin`-Session. |

## Identitaets- und Admin-Kante

| Service | Route(n) | Heute | Zielklasse / Scope |
| --- | --- | --- | --- |
| Identity | `POST /api/login`, `/api/register`, `/api/login/external`, `/api/password-reset/request`, `/api/password-reset/complete`, `/api/passkeys/authentication/*`, `/api/recovery/offline/*` | Oeffentliche Login-/Recovery-Eingaben; kein interner Token. | `public`; Rate-Limit, Anti-Automation, keine Kontodetails preisgeben. |
| Identity | `POST /api/logout`, `/api/session/takeover*`, `/api/session/secure`, `GET /api/session` | Session-Handler. | `user`; `session.manage`. |
| Identity | `POST /api/passkeys/registration/*`, `/api/passkeys/client-error` | Session-/Passkey-Handler. | `user`; `passkey.manage`. |
| Identity | `GET /api/dev/local-action-diagnostics` | Ausschliesslich im kontrollierten lokalen Remote-Dev-Modus; feste Loopback-Abfrage durch das Desktop-Prozess-Tool. | `health`; nur minimierte allowlist-validierte Fehlerereignisse ohne Konto-, Eingabe-, Host- oder Rohdaten, im Servermodus `404`. |
| Identity | `/api/account/*` (guest, access-profile, preferences, assets, upgrade-guest, offline-recovery-set, transparency, transparency/refresh) | Identity leitet Session ab. | `user`; `account.read` bzw. `account.write`, nur eigenes Konto. |
| Admin Access | `POST /api/admin-access/login`, `GET /api/admin-access/session`, `POST /api/admin-access/logout` | Eigenes HttpOnly/Strict-Session-Cookie. | `admin`; `admin.session.*`. |
| Admin Access | `GET,POST /api/admin-access/admins` | Session wird an Service gereicht. | `admin`; `admin.accounts.read/write`. |
| Admin Access | `/api/admin/*` Proxy sowie `/admin/*` | Admin-Session und Capability-Check; leitet festen Admin-Backend-Token und Actor weiter. | `admin` am Gateway, danach `internal-service` `admin.gateway.proxy`; Actor als signierte Delegation statt frei kodiertem Header. |
| Identity | `/api/internal/email-config[/test]`, `/link-integrity/inventory`, `/security-alert`, `/operator-alert`, `/push/device-event`, `/runtime/device-event` | Gemeinsamer statischer Identity-Admin-Header. | Umgesetzt: Audience `identity-server` und getrennte Scopes `identity.email.*`, `identity.link_integrity.read`, `identity.alert.*`, `identity.push.device`, `identity.runtime.device`. |
| Admin Tool | Alle `GET,POST,PUT /api/admin/*` (Overview, Repositories, Monitoring, Events, Community, AI, Ressourcen, Mail, LLM) | Optionaler Header-Token `x-gernetix-admin-access-token` plus Base64-Actor; ohne konfigurierte Token-Option kann der direkte Dienstzugriff ungeschuetzt sein. | Umgesetzt: Admin Access prueft Session und Capability, danach `admin.gateway.proxy` mit Audience `admin-tool` plus signierte Admin-Delegation fuer Akteur, Rolle und Capabilities. |
| Admin Tool | `POST /api/internal/security-events` | Separater Security-Monitor-Header-Token. | Umgesetzt: `operations.security_events.write`, Audience `admin-tool`. |
| Admin Tool | `POST /api/internal/system-events`, `/user-action-events`, `/synthetic-checks/run`, `/interface-calls` | Gemeinsamer System-Event-Header-Token. | Umgesetzt: getrennte Scopes `operations.system_events.write`, `operations.user_actions.write`, `operations.synthetic_checks.run`, `operations.interface_calls.write`, Audience `admin-tool`. |
| Admin Tool | `POST /api/internal/link-integrity/inventory`, `/checks` | Separater Link-Integrity-Header-Token. | Umgesetzt: `operations.link_integrity.write`, Audience `admin-tool`. |

## Projekt, Build und Artefakte

| Service | Route(n) | Heute | Zielklasse / Scope |
| --- | --- | --- | --- |
| Project | `GET,POST /api/projects`; `GET,PATCH,DELETE /api/projects/{projectId}` | Keine Authentifizierung im Project Server. | `delegated-user-action`; `project.list/create/read/write/delete`, Projekt- oder Kontobindung. |
| Project | `GET,POST,DELETE /api/projects/{projectId}/debug-session`; `POST .../activity` | Keine. | `delegated-user-action`; `project.debug.read/write`. |
| Project | `GET,PUT /api/projects/{projectId}/project-app`; `PUT .../project-app/devices` | Keine. | `delegated-user-action`; `project.app.read/write`, konkrete Projektdelegation. |
| Project | `GET,PUT /api/projects/{projectId}/sources`; `GET,DELETE /api/projects/{projectId}/sources/{path}`; `GET .../sources/search`; `POST .../sources/rename` | Keine. | `delegated-user-action`; `project.source.read/write`. |
| Project | `POST /api/projects/{projectId}/repository/commits`; `GET .../tree`, `/history`, `/diff`; `POST .../restore` | Keine. | `delegated-user-action`; `project.repository.read/write/restore`. |
| Project | `GET,POST /api/projects/{projectId}/versions`; `POST .../versions/{id}/restore` | Keine. | `delegated-user-action`; `project.version.read/write/restore`. |
| Project | `GET,PUT /api/projects/{projectId}/learning-progress` | Keine. | `delegated-user-action`; `project.learning.read/write`; Nutzer- und Projektbindung. |
| Project | `GET,POST /api/projects/{projectId}/build-jobs`; `GET /api/build-jobs`; `GET /api/build-jobs/{id}`, `/build-package`, `/reuse-status`; `POST .../submitted`, `/result` | Keine. | Nutzeraktionen: `delegated-user-action` `project.build.read/request`; Worker-Rueckmeldungen: `worker` `build.job.submit/result`, feste Job-/Lease-Bindung. |
| Project | `GET /api/firmware-artifacts`; `GET /api/learning-feedback`; `POST /api/learning-feedback`, `/template-feedback`, `/learning-feedback/anonymize-expired`, `/learning-feedback/{id}/consent` | Keine. | Nutzer: `delegated-user-action` mit `project.artifact.read` bzw. `feedback.*`; automatische Anonymisierung: `internal-service` `feedback.retention.run`. |
| Project | `GET /api/resource-policies`; `GET,PUT /api/internal/accounts/{accountId}/resource-plan`; `PUT /api/resource-policies/{id}` | Keine (nur der Repository-Adminweg ist token-geschuetzt). | `internal-service`; `resource_policy.read/write`; bei Kontoressource zusaetzlich signierte Kontodelegation. |
| Project | `GET /api/internal/repositories/summary`; `POST /api/internal/repositories/migrations` | Header `x-gernetix-project-admin-token`. | `internal-service`; `project.repository.admin.read/migrate`, Zielgruppe `project-server`. |
| Build Deploy | `GET /api/ota/preflight`, `/api/policy`; `POST /api/build-jobs`, `/api/build-cache/clean`; `GET /api/build-jobs/{id}`; `POST .../cancel`, `/symbolize` | Keine HTTP-Authentifizierung. | Aufrufe von Identity/Project: `internal-service` bzw. `delegated-user-action`; `build.ota.preflight`, `build.policy.read`, `build.job.request/read/cancel/symbolize`, je Projekt. |
| Build Deploy | `PUT /api/internal/build-artifacts/{jobId}/{name}`; `POST .../{jobId}/finalize` | Bearer Upload-Token, kein Job-gebundener Worker-Kontext. | `worker`; `artifact.upload/finalize`, signierter Job-/Lease-Grant. |
| Build Deploy | `GET /artifacts/{id}/{name}` | Keine. | `delegated-user-action` `artifact.download` oder kurzlebige, einmalige Download-Freigabe; niemals oeffentlich fuer Kundenartefakte. |
| Compute | `POST /api/compute/workers/register` | Bootstrap-Header-Token. | `worker`; bootstrap nur fuer Erstregistrierung, danach bindende Instanzidentitaet. |
| Compute | `POST /api/compute/workers/heartbeat`, `/drain`, `/leases/next`, `/project-runtime/patch`, `/leases/{id}/complete|fail` | Bearer-Worker-Token, Lease-Pruefung in Service. | `worker`; `worker.heartbeat/drain/lease/complete`, kurzlebig, Instance+Lease+Fencing. |
| Compute | `POST,GET /api/compute/internal/jobs`; `GET,DELETE /api/compute/internal/jobs/{id}`; `GET,PUT /internal/policy`; `GET /internal/operations-summary`; `POST /internal/project-runtime/grants`; `GET /internal/capacity/providers`; `POST /internal/capacity/providers/{id}/plan` | Gemeinsamer Compute-Header-Token. | `internal-service`; separate Scopes `compute.job.*`, `compute.policy.*`, `compute.operations.read`, `compute.runtime_grant.issue`, `compute.capacity.*`. |

## KI, Kontext und Telemetrie

| Service | Route(n) | Heute | Zielklasse / Scope |
| --- | --- | --- | --- |
| AI Usage | `GET /api/ai-usage/credit-packages`; `GET /accounts/{accountId}/credits`, `/rating`; `POST .../credits/grant`, `/holds`; `POST /preflight`; `POST /events/{id}/complete|fail`; `GET /events` | Keine HTTP-Authentifizierung. | Interne Verbraucher: `internal-service` plus bei Kontooperationen `delegated-user-action`; `ai_usage.package.read`, `credits.read/grant`, `ai_usage.preflight`, `ai_usage.event.complete/fail/read`. |
| AI Usage | `GET /api/ai-usage/admin/dashboard`, `/admin/audit-events`; `POST /admin/cost-controls` | Keine. | `admin`; `ai_usage.admin.read`, `ai_usage.cost_control.write` via Admin-Gatewaydelegation. |
| AI Context | `GET,PUT /api/ai-context/policy`; `GET /grants`, `/sources`, `/prompt-foundations`, `/architecture-components`, `/architecture-components/search`, `/help-articles`, `/help-articles/search`, `/clarification-cases`, `/intent-examples`, `/intent-examples/search`, `/audit-events`, `/storage/summary`, `/sqlite/summary` | Keine HTTP-Authentifizierung. | `internal-service`; minimale Lese-Scopes (`ai_context.policy.read`, `context.search`, `help.search`, `ai_context.audit.read`). Policy/Storage/Audit nur `admin`-delegiert. |
| AI Context | `POST /clarification-cases`, `.../{id}/actions`, `/prompt-foundations`, `/architecture-components`, `/help-articles`, `/sources`, `/grants`, `/grants/{id}/revoke`, `/preflight` | Keine. | `internal-service` + wenn Nutzerbezug besteht `delegated-user-action`; `ai_context.*.write`, `ai_context.grant.revoke`, `ai_context.preflight`. |
| Community AI | `POST /api/community-ai/query`, `/similar-content`, `/summaries`; `GET /admin/metrics`; `POST /admin/config` | Keine. | Nutzeranfragen: `delegated-user-action` `community_ai.query`; Admin: `admin` `community_ai.metrics.read/config.write`. |
| Telemetry | `POST /api/telemetry/internal/ingest`, `/internal/retention/run`; `GET /internal/accounts/{accountId}/projects/{projectId}/measurements|events|retention`; `PUT .../retention`; `DELETE .../data` | Ein statischer Header `x-gernetix-telemetry-token` fuer **alle** Nicht-Health-Routen. | Umgesetzt: Diensttoken mit getrennten Scopes `telemetry.ingest`, `telemetry.retention.run`, `telemetry.read`, `telemetry.retention.write`, `telemetry.data.delete`; Konto-/Projektdelegation fuer Lese-/Mutation. |

## Community, Katalog und Shop

| Service | Route(n) | Heute | Zielklasse / Scope |
| --- | --- | --- | --- |
| Community | `GET /api/community/operations-summary` | Interner Community-Token verlangt. | `internal-service`; `community.operations.read`. |
| Community | `GET /dashboard-summary`, `/capabilities`, `/marketplace/listings`, `/marketplace/listings/{id}`, `/ideas`, `/ideas/{id}`, `/showcases`, `/showcases/{id}`, `/questions`, `/questions/{id}`, `/questions/{id}/answers`, `/search`, `/knowledge-documents` | Gemeinsamer Community-Header-Token plus frei gesetzter Actor-Header. | Oeffentliche Projection: `public` nur fuer explizite, redigierte Inhalte; sonst `delegated-user-action` `community.*.read`. Actor muss signiert sein. |
| Community | `POST /marketplace/listings`, `PATCH .../{id}`; `POST /ideas`, `.../comments`, `/showcases`, `/questions`, `.../triage`, `.../answers`, `/answers/{id}/verify` | Wie oben. | `delegated-user-action`; spezifizierte `community.marketplace/idea/showcase/question.*`, Autor-/Moderationsrecht. |
| Community | `GET /inbox`, `/message-threads`, `/message-threads/{id}`, `/message-blocks`, `/message-reports`; `POST /inbox/direct`, `/support-requests`, `/message-threads`, `.../messages`, `/message-blocks`, `/broadcasts`, `/project-invitations`; `DELETE/POST /message-blocks/{id}`, `.../read`, `.../archive`, `.../restore`, `.../messages/{messageId}`, `.../message-reports/{id}/resolve`, `/inbox/{id}/read` | Wie oben. | `delegated-user-action`; `community.inbox.*`, `community.message.*`, `community.support.create`, `community.moderation.*`; Teilnehmer-/Kontobindung. |
| Community | Alle `/api/admin/community/*` (overview, support threads/messages, questions/triage/answers/verify, message reports/resolve) | Community-Admin-Header-Token + Base64-Actor. | `admin`; Admin-Gateway-Diensttoken + signierte Capabilitydelegation `admin_community_support`/`admin_community_moderation`. |
| Hardware Catalog | `GET /api/hardware-catalog/capabilities[/{id}]`, `/hardware-items[/{id}]`, `/processor-boards`, `/flashboxes`, `/sensors`, `/board-feature-options` | Keine. | Katalogprojektion `public` oder `internal-service` `hardware_catalog.read` je Datenklassifikation; explizit festlegen. |
| Hardware Catalog | `POST /api/hardware-catalog/admin/capabilities`, `/admin/hardware-items` | Keine. | Umgesetzt: `internal-service`; `hardware_catalog.admin`, Audience `hardware-catalog`. |
| Hardware Shop | `GET /api/hardware-shop/offers`, `/offers/{id}`; `POST /match`, `/carts`, `/carts/{id}/items`, `/orders`; `GET /carts/{id}`, `/orders/{id}`, `/orders/{id}/purchase-context`; `POST /admin/offers` | Keine. | Umgesetzt: Angebote und Match `public`; Warenkorb/Bestellung/Kaufkontext mit `shop.cart.*`, `shop.order.*`, `shop.purchase_context.read` und Kontodelegation; Admin-Angebote `shop.offer.admin`. |

## Geraete, Provisionierung und Recovery

| Service | Route(n) | Heute | Zielklasse / Scope |
| --- | --- | --- | --- |
| Device Management | `POST /api/device-management/devices/register`; `POST /devices/{id}/heartbeat`, `/connectivity/status`; `GET /devices/{id}/status`, `/push-recipients`, `/support-entitlement`; `POST /devices/{id}/auth/challenge`, `/auth/verify`, `/voice-authorize` | Keine HTTP-Authentifizierung. | `device`; Geraetezertifikat/Challenge, eigene `device.register/heartbeat/status/voice`-Scopes und Geraetebindung. |
| Device Management | `POST /pairing/sessions`; `GET,POST /pairing/sessions/{id}`, `.../complete`, `.../cancel`; `POST /provisioning/tokens`, `/provisioning/tokens/consume` | Keine. | Nutzerinitiiert: `delegated-user-action` `device.pair/provision`; Konsum: `device` kurzlebiger einmaliger Grant. |
| Device Management | `/accounts/{accountId}/devices`, `/board-configurations`, `/purchase-contexts` (GET/POST); `GET/POST /board-configurations/{id}[/versions]`; `PUT,DELETE /devices/{id}`; `PUT .../voice-ai-policy`; `GET /ota-targets`, `/claimable-hardware-units`, `/devices/{id}/support-entitlement`; `POST /hardware-unit-claims` | Keine. | `delegated-user-action`; `device/account_board/purchase_context.*`, immer eigene Konto- und Geraetezuordnung. |
| Device Management | `/api/device-management/admin/devices[/{id}[/status|/credentials|/support-entitlement]]`; `/customer-data-access/consents`, `/{id}`, `/{id}/revoke`, `/audit-events` | Keine. | `admin`; `device.admin.read`, `customer_data_access.consent/audit.*`; konkrete Consent-/Rechtsgrundlagen pruefen. |
| Device Voice | `GET /api/device-voice/capabilities`; `POST /sessions`; `POST /sessions/{id}/audio` | Audio nur Bearer-Session-Token; Sessionanlage/Capabilities ohne Auth. | Anlage `delegated-user-action` `device_voice.session.create`; Audio `device`/`delegated-user-action` kurzlebig und an Sitzung+Geraet gebunden; Capabilities `internal-service` oder redigiert `public`. |
| Provisioning Tool | `GET /api/provisioning-firmware-artifact`, `/provisioning-flash-mode`, `/provisioning-device-targets`, `/provisioning-firmware-artifacts[/{id}/content]`, `/provisioning-processor-boards`, `/provisioning-flashboxes`; `POST /provisioning-firmware-artifacts`, `/provisioning-credentials/reset`, `/provisioning-sessions`; `GET/POST /provisioning-sessions/{id}[/{complete|manifest|browser-usb-flash-result|device-provisioning}]` | Keine. | Initialimage-Reads ggf. `public`; alle personengebundenen Sessions/Uploads/Reset: `delegated-user-action` bzw. `device`; `provisioning.*`, kurzlebige Sessionbindung. |
| Recovery Tool | `GET,POST /api/recovery/sessions`; `POST /hardware-lab/sessions`; `GET /sessions/{id}`; `POST /sessions/{id}/capabilities`, `/register-community-device`, `/renew-credentials`, `/connectivity-reset`; alle Hardware-Lab-Aktionen einschliesslich Build/Report/Verification | Keine. | `delegated-user-action`; `recovery.session.*`, `hardware_lab.*`, Konto-/Projekt- und Einwilligungsbindung; Credential-Renewal zusaetzlich `device`. |
| Public Demo | `GET /api/public/demos`, `/demos/{id}`, `/releases/{id}/firmware|flash-manifest|assets/{asset}` | Keine; bewusst oeffentliche Releases. | `public`; unveraenderliche, freigegebene Artefakte, Rate-Limit und kein Konto-/Projektbezug. |
| Public Demo | `POST /api/internal/public-demos` | Statischer Publisher-Header-Token. | Umgesetzt: `internal-service`; `public_demo.publish`, Audience `public-demo-server`. |

## Lokale Entwicklungs- und Persistenzdienste

| Service | Route(n) | Heute | Zielklasse / Scope |
| --- | --- | --- | --- |
| Context Manager | `GET,PUT /api/context/current`; `POST /requirement-slices`, `/artifact-references`, `/runtime-references`, `/decisions`, `/events`, `/analyze`, `/suggestions/{id}/accept|reject`, `/packs`, `/redact`; `GET /suggestions`, `/packs/{id}` | Umgesetzt: `/health` offen und minimal, direkter HMI-/Architekturzugriff nur Loopback oder read-scopegebundenes BFF; Fachrouten fail-closed. | `internal-service`; Audience `context-manager`, Scopes `context_manager.read/write/analyze`. Admin Access stellt die HMI ueber HttpOnly-Operator-Sitzung, Capabilities, feste Methoden-/Pfad-Allowlist und CSRF bereit; der Browser erhaelt keinen Diensttoken. |
| Persistence | `GET,PUT /api/persistence/state/{serviceKey}`; `GET /export`; `POST /backup` | Keine. | Umgesetzt: `internal-service`; `persistence.state.read/write`, `persistence.export`, `persistence.backup.run`, Audience `persistence-server`. |

## Identity als Nutzer-Gateway: weitere API-Familien

Die Identity-Routen werden in `services/identity-server/src/dev/server/*-routes.js`
registriert. Sie sind keine internen Dienst-APIs: Browser duerfen sie nur mit
der Identity-Session benutzen. Identity ruft dahinterliegende Dienste
serverseitig mit Diensttoken plus Delegation auf.

| Routenfamilie | Zielklasse / Scope |
| --- | --- |
| `GET /api/public/community/questions[/{id}[/answers]]`, `GET /api/public/flashbox/initial-firmware[/content]` | `public`; ausschliesslich redigierte, explizit freigegebene Daten/Initialimage. |
| `/api/platform/*`, `/api/user-ide/*` fuer Summary, Bootstrap, Workspace, Projekte, Quellen, Builds, Geraete, Hardware, Downloads, Provisioning, Billing, Feedback, Learning, Community und Account-Board-Konfiguration | `user`; Identity-Session + CSRF bei Schreibzugriff; je Aktion `project.*`, `device.*`, `build.*`, `learning.*`, `community.*`, `billing.*`. |
| `/api/platform/development-assistant/*`, `/api/platform/help-assistant/chat`, `/api/platform/hardware-lab/*` | `user`; zugehoeriges Premium-Entitlement und konkrete Konto-/Projektdelegation (`ai_assistant`, `hardware_lab`). |
| `/api/community/*` Proxy ausser den oeffentlichen Projektionen | `user`; Identity ersetzt alle vom Browser kommenden Actor-/Accountfelder durch Sessionkontext und delegiert eng an Community. |

## Festgestellte Prioritaeten

1. **P0:** Jeder konten-/projektbezogene Zugriff erhaelt eine signierte
   Delegation. IDs in Pfad, Query oder Body sind Ressourcenreferenzen, nie
   Berechtigungsnachweise.
2. **P1:** Admin-Actor-Header werden kryptografisch gebunden; Base64 ist keine
   Signatur. Direkter Zugriff auf Admin Tool/Community Admin wird
   netzseitig gesperrt.
3. **P1:** `health`-Ausnahmen und oeffentliche Artefakte in Reverse Proxy und
   Tests auf eine explizite Allowlist begrenzen.

## Pflege- und Abnahmeregel

Bei jeder neuen oder geaenderten HTTP-Route muss diese Datei im selben Change
aktualisiert werden. Der CI-Routenguard prueft die vollstaendige
Routendateiliste, Zugriffsklasse und den freigegebenen Fingerprint. Die
zugehoerigen Contract-Tests pruefen mindestens: Route inventarisiert,
fehlender/falscher/abgelaufener Token, falsche Audience, fehlender Scope,
Manipulation der Delegation, fremdes Konto/Projekt und fehlendes Entitlement.
Ein Bestehen der Tests ist erst der lokale Nachweis; der Status in
`docs/security-posture.md` wird erst mit datiertem Staging-/Laufzeitnachweis
auf **Umgesetzt** gesetzt.
