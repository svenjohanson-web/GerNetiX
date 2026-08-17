# ELAB-FS-012: Serverseitige KI-Anbindung mit Credits

Stand: 2026-08-17  
Status: lokal umgesetzt und contract-getestet (2026-08-17); kein Live-Provider-Nachweis

## Ziel

Die öffentliche Elektroniklabor-Route kann den Assistenten optional über den
Identity Server und die bestehende AI-Usage-Infrastruktur aufrufen. Das Labor
und die manuelle Fehlersuche funktionieren ohne Anmeldung oder Credits
weiterhin vollständig.

## Architekturgrenze

- Endpoint: `POST /api/platform/electronics-lab/assistant`
- Anmeldung wird ausschließlich aus der serverseitigen Sitzung abgeleitet.
- Konto-, Rollen-, Credit- oder Routingangaben aus dem Browser werden
  ignoriert.
- Der Server erzeugt den minimierten FS-006-Kontext und validiert auch die
  strukturierte Provider-Antwort erneut gegen FS-006.
- Provider-Schlüssel bleiben ausschließlich serverseitig.
- OpenAI Responses API: strukturierte JSON-Schema-Ausgabe, `store: false`,
  pseudonymer Safety-Identifier und begrenzte Ausgabe.
- AI Usage führt Preflight, Reservierung/Abschluss beziehungsweise Fehleraudit
  im bestehenden Muster aus. Ohne ausreichende Credits erfolgt kein
  Provider-Aufruf.
- Reparatur-Commands werden nur an den Browser zurückgegeben; die sichtbare
  Bestätigung aus FS-011 bleibt zwingend.

## Clientverhalten

- Auf `/technik-labs/` wird der sessiongebundene Serverclient verwendet.
- Standalone-Entwicklung kann das lokale FS-011-Fixture verwenden.
- 401, Creditmangel, Routing- und Providerfehler werden verständlich gezeigt;
  die manuelle Laborbedienung bleibt aktiv.
- Kein automatischer Fallback, der eine Live-KI vortäuscht.

## Abnahme

- Unit-/Contract-Tests ohne echten Provideraufruf,
- gefälschte Konto-ID wird ignoriert,
- Credit-Preflight-Fehler erzeugt null Provideraufrufe,
- invalide strukturierte Ausgabe wird verworfen,
- Schlüssel und vollständige Sitzung gelangen nicht zum Browser,
- Sicherheits-, Architektur-, Prozess- und Graphdokumentation stimmen überein.

Kein Live-KI-Aufruf, Commit, Push oder Deployment.
