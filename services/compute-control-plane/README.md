# Compute Control Plane

Der Dienst koordiniert providerneutral rechenintensive und kundendefinierte Hintergrundarbeit. Er speichert ausschließlich Steuerdaten in PostgreSQL: Compute-Verträge, Worker-Fähigkeiten, Leases, Status, Kapazitätsrichtlinien und payload-freie Nutzungsdimensionen. Eingaben und Ergebnisse werden über unveränderliche Revisionen referenziert.

## Sicherheitsgrenzen

- Worker erhalten keine SQL-Zugangsdaten und greifen ausschließlich über das Worker Gateway zu.
- Worker-Tokens sind kurzlebig, HMAC-signiert und an `worker_id` plus `instance_id` gebunden.
- Ein Fencing-Token verhindert, dass verspätete Worker-Ergebnisse eine neu vergebene Lease überschreiben.
- Projektregeln laufen als begrenzter JSON-AST ohne `eval`, Shell, Dateisystem, Netzwerk oder Modulzugriff.
- Cloud- und Kubernetes-Provider erzeugen zunächst nur deklarative Pläne; dieser Dienst führt keine externe Provisionierung aus.

Die interne API stellt Jobannahme, Status, Policy, Operations-Aggregate,
Capacity-Plaene und kurzlebige Project-Runtime-Grants bereit. Das getrennt
authentifizierte Worker Gateway stellt Registrierung, Heartbeat, Drain,
Pull-Lease, Renew, Complete, Fail und die grant-gebundene Patchannahme bereit.
Der fachliche Patch wird nur ueber einen injizierten atomaren Project-Writer
angewendet; ohne diesen Writer antwortet die API sicher mit `503`.

Der bestehende Build-&-Deploy-Dienst kann reine Builds optional ueber den
`ComputeBuildPoolBridge` ausfuehren. OTA, Deploy, USB und FlashBox bleiben
ausserhalb dieses Pfads und werden auch in zurueckgegebenen Worker-Ergebnissen
erneut validiert.

## Lokaler Test

```sh
npm test --prefix services/compute-control-plane
```

Der Entwicklungsmodus verwendet standardmäßig den flüchtigen In-Memory-Speicher. Für PostgreSQL wird `COMPUTE_PERSISTENCE_BACKEND=postgres` gesetzt.

Die Tests enthalten außerdem ein deterministisches Profil fuer eine Million
Jobs pro Tag bei 100 ms, 1 s und 10 s Laufzeit, Vierfach-Peaks, parallele
Lease-Anfragen, Hot-Tenants, Retry-Sturm/Dead-Letter, Worker-Ausfall und
Cloud-Kosten-Backpressure. Dies ersetzt keinen spaeteren verteilten Dauerlasttest.
