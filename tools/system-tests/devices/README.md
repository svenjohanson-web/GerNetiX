# MQTT-Gerätesimulator

Der Simulator erzeugt viele virtuelle GerNetiX-Geräte ohne zusätzliche npm-Abhängigkeiten. Er nutzt die produktiven Topic-Verträge:

- Publish: `gernetix/devices/<device_id>/telemetry`
- Publish: `gernetix/devices/<device_id>/status/heartbeat`
- MQTT-Benutzername und Topic-Identität sind identisch.

Der Telemetry Server leitet die vertrauenswürdige `device_id` aus dem ACL-geschützten Topic ab. Der Simulator blockiert deshalb jeden Publish außerhalb der Identitätsgrenze des jeweiligen virtuellen Geräts bereits clientseitig.

## Sicherer Start

Standardmäßig wird ausschließlich der dedizierte lokale Systemtest-Broker
`mqtt://127.0.0.1:51883` verwendet:

```sh
npm test
npm start -- --device-map ../fixtures/manifest.v1.json --device-count 4 --duration-ms 60000
```

Der Simulator erzeugt keine freien Identitaeten. `--device-map` verweist auf den versionierten, validierten Fixture-Manifestvertrag; fuer jedes ausgewaehlte Geraet werden `device_id` und das zugehoerige `project_id` daraus uebernommen. `--device-count` darf die Zahl der vorhandenen Fixture-Geraete nicht ueberschreiten.

Ein entfernter Broker benötigt `mqtts://` und die ausdrückliche Option `--allow-remote`. Zugangsdaten dürfen nicht in der Broker-URL stehen. CA, Testzertifikat und Testschlüssel können über `--ca-file`, `--cert-file` und `--key-file` geladen werden. Zertifikate und Schlüssel werden weder in Meldungen noch in der aggregierten JSON-Ausgabe ausgegeben.

Für den produktionsnahen mTLS-/ACL-Test benötigt jedes Gerät grundsätzlich ein eigenes, auf seine `device_id` ausgestelltes Zertifikat. Die gemeinsame `--cert-file`-Option eignet sich nur für einen eigens dafür konfigurierten isolierten Test-Broker; sie ersetzt keinen echten gerätegebundenen ACL-Nachweis.

## Last- und Fehleroptionen

- `--connection-ramp-ms`: verteilt neue Verbindungen und verhindert einen unbeabsichtigten Verbindungssturm.
- `--max-reconnect-attempts`: begrenzt Wiederverbindungen je Ausfall.
- `--duplicate-rate`: sendet denselben Messwert mit stabiler `measurement_id` erneut.
- `--delayed-rate` und `--delayed-by-ms`: senden ausgewählte Messwerte verspätet.
- `--heartbeat-every`: sendet nach jeweils N Telemetriezyklen einen Heartbeat; `0` deaktiviert ihn.

Die Abschlusszeile ist ein JSON-Objekt mit ausschließlich aggregierten Zählern. Der Simulator startet keinen Broker und verändert keine persistierten Daten außerhalb der explizit adressierten Testumgebung.
