# Interne API-Zugriffssteuerung

## Verbindlicher Vertrag

Jede produktive HTTP-Route ist genau einer Zugriffsklasse zugeordnet:
`public`, `user`, `internal-service`, `delegated-user-action`, `worker`,
`device` oder `health`. Nicht klassifizierte Routen werden nicht eingefuehrt;
interne Fachrouten gelten standardmaessig als gesperrt.

`internal-service` verlangt einen kurzlebigen, signierten Token mit Aussteller,
aufrufendem Dienst, Zielservice, Scope, Token-ID und Ablaufzeit. Der
Zielservice prueft die Audience und jeden erforderlichen Scope selbst.
`delegated-user-action` verlangt zusaetzlich einen signierten Kontext mit
Account, erlaubten Projekten, Capabilities und Entitlements. Ein Token mit
Lesescope erlaubt nie eine Schreibaktion und eine Projektdelegation gilt nie
fuer ein anderes Projekt.

## Browser- und Premiumgrenze

Der Browser besitzt ausschliesslich eine sichere, nicht durch JavaScript
lesbare Identity-Sitzung. Identity leitet Account, Rolle, Besitz und
Entitlements serverseitig ab und stellt bei Bedarf eine begrenzte Delegation
an den zuständigen Fachservice aus. Interne Tokens, Signaturschluessel und
Delegationen duerfen weder in Browser-Bundles, URLs, localStorage noch Logs
auftauchen. Die einzige URL-basierte Ausnahme sind kurzlebige, exakt an Job,
Artefakt und Geraet gebundene Firmware-Downloadfreigaben; sie sind keine
allgemeinen Dienst- oder Nutzertokens. Anwendung und vorgeschaltete
Nginx-Konfiguration protokollieren weder Querywerte noch Referrer. Der
Laufzeitnachweis auf Staging bleibt vor einem Rollout erforderlich.

## Akzeptanzkriterien

- Fehlender, abgelaufener, manipulierter oder fuer einen anderen Service
  ausgestellter Token wird vor jeder Fachaktion abgewiesen.
- Ein fehlender Scope, fremdes Konto, fremdes Projekt oder fehlendes
  Entitlement gibt keine Fach- oder Metadaten preis.
- Jeder Service arbeitet fail-closed, falls sein Verifikations-Keyring fehlt
  oder unvollstaendig ist.
- Worker- und Device-Credentials sind vom Dienst-Token-Vertrag getrennt und
  auf ihren Job, Lease oder ihr registriertes Geraet begrenzt.
- Tests pruefen den erfolgreichen Minimalzugriff sowie alle genannten
  Ablehnungsfaelle; CI verhindert neue nicht klassifizierte Routen.
- Interne Services sind zusaetzlich nicht direkt oeffentlich geroutet;
  Health-Antworten enthalten keine Kunden- oder Konfigurationsdaten.

## Rollout

Die gemeinsame Implementierung liegt unter
`services/shared/internal-api-auth.js`. Produktive Dienstidentitaeten werden
mit Ed25519 signiert. Jeder Aussteller besitzt einen eigenen privaten
Schluessel; Zielservices erhalten nur einen versionierten oeffentlichen
Verifikations-Keyring. `kid`, Algorithmus und Aussteller sind kryptografisch
gebunden. Mehrere gleichzeitig vertraute `kid` ermoeglichen eine kontrollierte
Rotationsueberlappung; unbekannte, entfernte oder falsch zugeordnete Keys
werden fail-closed abgewiesen. Der fruehere HMAC-Aufruf bleibt ausschliesslich
als expliziter Test-/Migrationspfad bestehen und wird nicht mehr aus der
Produktionskonfiguration gelesen. Die Pruefung umfasst Version, Signatur,
Ablauf, Audience und Scope sowie delegierte Account-, Projekt- und
Entitlementbindung. Project Server, AI Usage Server, AI Context
Server, Community AI, Recovery, Build Deploy, Compute, Device Management,
Community Platform, Hardware Catalog, Hardware Shop, Persistence und Public
Demo sowie Telemetry und die zugehoerigen Identity-, Admin-, Voice-, Provisioning- und
Hardware-Lab-Aufrufer sind auf diesen Vertrag migriert. Build Deploy
bindet zusaetzlich Worker-Uploads an Worker, Job und Artefakt und stellt fuer
OTA/FlashBox nur kurzlebige, exakt gebundene Firmwarefreigaben aus. Telemetrie
verwendet fuer die Ownership-Aufloesung getrennte Minimal-Scopes gegen Project
und Device Management. Device Management behaelt nur Challenge und Proof als
eigene kryptografische Geraeteklasse ohne Diensttoken. Community laesst anonym
nur explizite redigierte Leseprojektionen zu. Die Operations-Eingaenge des
Admin Tools trennen Security-, System-, Nutzeraktions-, Schnittstellen-,
Synthetic- und Linkdaten durch eigene Scopes. Admin Access bindet jeden
Admin-Tool-Aufruf an `admin.gateway.proxy` und eine signierte Rollen- und
Capabilitydelegation. Auch Identity-interne E-Mail-, Link-, Alarm-, Push- und
Runtime-Routen pruefen jetzt eigene Scopes; der fruehere gemeinsame
Identity-Admin-Header ist entfallen. Damit sind alle im Inventar fuer
diesen Rollout priorisierten internen Fachrouten lokal migriert.

Der Context Manager laeuft im VPS-Modell als interner Singleton mit zentraler
PostgreSQL-Persistenz und ist ausschliesslich ueber das Admin-Access-BFF
bedienbar. Operations-Ingest und interne Identity-Adminpfade verwenden einen
prozesslokalen JTI-Replay-Schutz. Mehrere parallele Instanzen dieser Prozesse
sind nicht freigegeben; vor horizontaler Skalierung ist ein gemeinsamer,
atomarer Consume-Store mit Ablaufbereinigung und Parallelitaetstest zwingend.

`tools/internal-api-key-provisioner` erzeugt die dienstweisen privaten Keys
ausserhalb des Repositories und den gemeinsamen oeffentlichen Trust Ring. Bei
einer Rotation uebernimmt es einen validierten bisherigen Public Ring in die
neue Ueberlappungsgeneration, ohne private Keys zusammenzufuehren.
Das Staging-Deployskript provisioniert einen vollstaendigen Satz nur bei
vollstaendig fehlender Konfiguration und bricht bei Teilkonfiguration ab.
Der CI-Routenguard klassifiziert alle erkannten HTTP-Routendateien; der
Netzgrenzen- und Leak-Guard prueft Compose-Bindings, das interne Backend-Netz,
Browserartefakte, Authdaten in URLs/Logs und die Nginx-Logformate.

Fuer besonders kritische Operations-Ingest- und Identity-Adminpfade wird die
`jti` pro Prozess bis zum Ablauf nur einmal akzeptiert. Das verhindert Replay
in einer einzelnen Instanz. Ein gemeinsamer atomarer Replay-Store fuer einen
spaeteren Mehrinstanzbetrieb ist weiterhin erforderlich.

Der Context Manager schuetzt alle Fachrouten mit Audience `context-manager`
und getrennten `context_manager.read`, `.write` und `.analyze`-Scopes. Seine
statische HMI erhaelt bewusst keinen Diensttoken. Das Admin-Access-BFF prueft
HttpOnly-Operator-Sitzung, Capability, feste Methoden-/Routen-Allowlist und
Double-Submit-CSRF, bindet den Operator serverseitig und stellt erst dann den
minimalen kurzlebigen Diensttoken aus. Request und Ergebnis werden ohne Query
oder Fachinhalt auditiert.

## Lokaler Nachweisstand 2026-08-14

- Project Server: 120 Tests; Identity Server: 756 Tests
- AI Usage: 21 Tests; AI Context: 26 Tests
- Community AI: 7 Tests; Device Voice: 14 Tests
- Recovery Tool: 29 Tests; Device Management: 30 Tests
- Build Deploy: 82 Tests; Admin Tool: 74 Tests
- Admin Access: 7 Tests
- Compute Control Plane: 21 Tests
- Community Platform: 37 Tests
- Hardware Catalog: 11 Tests; Hardware Shop: 10 Tests
- Persistence Server: 4 Tests; Public Demo Server: 9 Tests
- Telemetry: 13 Tests
- Context Manager: 20 Tests; Admin Access einschliesslich Context-BFF: 8 Tests
- Shared-Service-Suite einschliesslich Authentifizierungsvertrag: 36 Tests
- Routenklassifizierung: 6 Tests; Key-Provisionierung und Rotation: 10 Tests
- Netzgrenzen- und Leak-Guard: 8 Tests

Dies ist ein lokaler Code-, Contract- und Konfigurationsnachweis. Ein echter
Staging-Rollout, ein dortiger Rotationsdrill, externe Negativtests und ein
Mehrinstanz-Replay-Nachweis stehen weiterhin aus.
