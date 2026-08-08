# Kontrollierte Chaos-Steuerung

Dieses Modul steuert ausschliesslich die drei fest benannten Toxiproxy-Proxys
der isolierten GerNetiX-Systemtestumgebung. Es startet oder beendet keine
Container und loescht weder Volumes noch Daten.

Erlaubt sind nur `forgejo_latency`, `forgejo_unavailable`,
`postgres_connection_cut` und `mqtt_connection_cut`. Die Control-API ist fest
auf unverschluesseltes HTTP ueber eine numerische Loopback-Adresse begrenzt;
entfernte Hosts, Zugangsdaten und URL-Pfade werden abgewiesen. Eine Stoerung
darf zwischen 100 ms und 60 s dauern. Der jeweilige Toxic wird im
`finally`-Pfad entfernt beziehungsweise der Proxy wieder aktiviert.

Der Default `http://127.0.0.1:58474` entspricht dem expliziten
Loopback-Portbinding in `infra/system-test/compose.yaml`. Eine abweichende
Control-URL muss ebenfalls eine numerische Loopback-Origin ohne Pfad sein.

Das Modul stellt bewusst kein direkt ausfuehrbares CLI bereit. Der spaetere
Systemtest-Orchestrator muss Szenarien einzeln aufrufen und darf erst nach dem
erfolgreichen Recovery-Ergebnis fortfahren.

Die reinen Unit-Tests sprechen keine Control-API an:

```sh
node --test tools/system-tests/chaos/test/*.test.js
```
