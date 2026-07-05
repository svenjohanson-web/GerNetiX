# Tamagotchi Demo-Frontend mit abgesichertem Homeserver

## Ziel

Ein Kollege soll das Tamagotchi-Lernprojekt ueber ein eigenes Webfrontend ausprobieren koennen.
Das Frontend nutzt den GerNetiX-Login und greift danach auf einen lokalen Server im Heimnetz zu.
Der Zugriff darf nicht als offene Portfreigabe auf den Homeserver umgesetzt werden.

## Empfohlene Demo-Architektur

```text
Browser des Kollegen
  -> HTTPS
GerNetiX Demo-Frontend
  -> Login / Session
GerNetiX Backend-Gateway
  -> abgesicherter Tunnel oder VPN
Homeserver bei Sven
  -> lokaler Tamagotchi Demo-Service
```

Das Demo-Frontend spricht nicht direkt mit einer privaten IP im Heimnetz. Stattdessen geht jeder Zugriff ueber ein Gateway, das Login, Berechtigung und Protokollgrenzen kontrolliert.

## Sicherheitsregeln

- Keine direkte Router-Portfreigabe auf den Homeserver.
- Zugriff nur per HTTPS.
- Zugriff nur nach erfolgreichem Login.
- Zugriff nur fuer explizit freigegebene Accounts oder Demo-Teilnehmer.
- Homeserver-Service nur an `localhost` oder an ein privates VPN-/Tunnel-Interface binden.
- API-Endpunkte serverseitig gegen Session und Berechtigung pruefen, nicht nur im Frontend verstecken.
- Schreibende Aktionen wie Fuettern, Traenken oder Reset brauchen CSRF-/Origin-Schutz oder tokenbasierte API-Aufrufe.
- Logs duerfen keine Passwoerter, Session-Tokens oder privaten Netzwerkdetails enthalten.

## MVP-Schnitt

1. Identity-Login funktionsfaehig machen.
2. Demo-Frontend als eigene App/Sektion bauen: `Tamagotchi Demo`.
3. Nach Login eine Demo-Session erzeugen.
4. Gateway-Endpunkte bereitstellen:
   - `GET /api/tamagotchi/state`
   - `POST /api/tamagotchi/feed`
   - `POST /api/tamagotchi/drink`
   - `POST /api/tamagotchi/reset`
5. Gateway verbindet sich zum Homeserver ueber Tunnel/VPN.
6. Homeserver fuehrt nur die lokale Tama-Simulation oder spaeter den ESP32-/Runtime-Zugriff aus.

## Geeignete Verbindungsarten

Fuer die erste sichere Demo ist ein privater Tunnel oder VPN am einfachsten:

- Tailscale oder WireGuard fuer privaten Zugriff zwischen Gateway und Homeserver.
- Alternativ ein Zero-Trust-Tunnel mit Access-Regeln.
- Fuer spaeter: eigener Reverse Proxy mit mTLS zwischen Gateway und Homeserver.

## Nicht fuer die Demo verwenden

- Port 80/443 direkt vom Router auf den Homeserver forwarden.
- Homeserver-API direkt aus dem Browser mit privater IP oder DynDNS ansprechen.
- Login nur im Frontend simulieren und API ungeschuetzt lassen.
- Dauerhafte Admin-Tokens im Browser speichern.

## Offene TODOs

- Login-API aus dem Identity-Server an das Frontend anbinden.
- Demo-Berechtigung definieren: Wer darf die Tama-Demo sehen?
- Bezahlplan definieren: Welche Fortsetzung ist frei, welche ist kostenpflichtig?
- Entscheiden, ob der Homeserver per Tailscale/WireGuard oder Tunnel angebunden wird.
- Tamagotchi Demo-Service auf dem Homeserver definieren.
