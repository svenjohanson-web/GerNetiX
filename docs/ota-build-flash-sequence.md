# OTA Build & Flash – vollständige Wirkkette

Dieses Sequence-Diagramm beschreibt den Weg vom Klick auf `OTA Flash` in der IDE bis zur bestätigten neuen Firmware auf dem ESP32. Es umfasst Preflight, inkrementellen Build, Signierung, Offline-Zustellung, Download, Integritätsprüfung, A/B-Aktivierung, Rückmeldung und Rollback.

In der lokalen Entwicklungsumgebung bleiben normale Builds und Web-Serial beim lokalen Build-&-Deploy-Service. `build_and_flash` wird über den separaten `OTA_BUILD_DEPLOY_BASE_URL` an die vollständig konfigurierte VPS-Instanz geroutet. Im VPS-Compose zeigen normaler Build- und OTA-Adapter beide auf den internen Build-&-Deploy-Container.

```mermaid
sequenceDiagram
    autonumber
    actor User as Nutzer
    participant IDE as GerNetiX IDE<br/>Identity Server
    participant DM as Device Management
    participant PS as Project Server
    participant BD as Build & Deploy Server
    participant DB as Runtime SQLite
    participant PIO as PlatformIO<br/>inkrementeller Cache
    participant ART as HTTPS Artifact Store<br/>build.gernetix.com
    participant MQ as MQTT Broker<br/>mqtt.gernetix.com
    participant ESP as ESP32 Basissoftware
    participant BOOT as ESP32 Bootloader<br/>A/B + Rollback

    User->>IDE: OTA Flash anklicken
    IDE->>IDE: Geänderte Datei speichern
    IDE->>DM: Account-, Pairing-, OTA- und Connectivity-Status lesen
    DM-->>IDE: Device-ID, online, ota_status=ready
    IDE->>BD: GET /api/ota/preflight
    BD->>DB: OTA-Signer und Ack-Store prüfen
    BD->>MQ: Publisher-Verbindung prüfen
    BD-->>IDE: HTTPS, MQTT, ECDSA-Signer und Acks bereit

    alt Preflight nicht vollständig
        IDE-->>User: Alle Blocker gemeinsam anzeigen
    else Preflight erfolgreich
        IDE->>PS: BuildJob mit Projekt, Device und Build-Konfiguration anlegen
        PS->>PS: Basissoftware + User-Code zu BuildPackage verbinden
        PS-->>IDE: Vollständiges BuildPackage
        IDE->>BD: build_and_flash + autorisiertes Device
        BD->>PIO: BuildPackage materialisieren
        PIO->>PIO: Persistenten Projekt-/Device-Cache wiederverwenden
        PIO->>PIO: Nur geänderte Quellen neu kompilieren

        alt PlatformIO-Build fehlgeschlagen
            PIO-->>BD: Fehler + Build-Log
            BD-->>IDE: Build fehlgeschlagen
            IDE-->>User: Kompakte Ursache und relevante Logzeilen
        else Build erfolgreich
            PIO-->>BD: firmware.bin + Bootloader + Partitionen + Build-Log
            BD->>ART: Artefakte dauerhaft ablegen
            BD->>BD: Datei-SHA-256 und ESP-Image-SHA-256 berechnen
            BD->>BD: Kanonischen Auftrag mit OTA-P-256-Key signieren
            Note over BD,ESP: schema + key_id + deploy_id + sequence + device_id + URL + sha256 + expiry
            BD->>DB: Status publishing persistieren
            BD->>MQ: OTA-Auftrag QoS 1 + retained publizieren
            MQ-->>BD: PUBACK
            BD->>DB: Status published persistieren
            BD-->>IDE: Build erfolgreich, Gerätebestätigung ausstehend

            alt Board während oder nach dem Build offline
                MQ->>MQ: Neuesten Auftrag retained speichern
                ESP->>MQ: Später erneut per TLS verbinden und Topic abonnieren
                MQ-->>ESP: Retained OTA-Auftrag zustellen
            else Board online
                MQ-->>ESP: OTA-Auftrag sofort zustellen
            end

            ESP->>ESP: Device-ID, URL-Origin und Payload validieren
            ESP->>ESP: ECDSA-Signatur, Key-ID und Ablaufzeit prüfen
            ESP->>ESP: Sequenz gegen NVS-Replay-Schutz prüfen

            alt Signatur, Ziel oder Sequenz ungültig
                ESP-->>MQ: Auftrag ablehnen / keine Installation
            else Auftrag autorisiert
                ESP->>MQ: status=queued
                MQ->>BD: Device-Acknowledgement
                BD->>DB: queued persistieren
                ESP->>MQ: status=downloading
                ESP->>ART: firmware.bin über HTTPS laden
                ART-->>ESP: Firmware-Bytes
                ESP->>ESP: In inaktiven OTA-Slot schreiben
                ESP->>ESP: Vollständigen Datei-Hash prüfen
                ESP->>ESP: ESP-Image-Digest als Legacy-Brücke prüfen

                alt Download unvollständig oder Hash falsch
                    ESP->>ESP: Inaktiven Slot verwerfen
                    ESP->>MQ: status=failed + konkrete Ursache
                    MQ->>BD: Fehler-Acknowledgement
                    BD->>DB: failed persistieren
                    BD-->>IDE: OTA fehlgeschlagen
                    IDE-->>User: Ursache im Terminal anzeigen
                else Firmware verifiziert
                    ESP->>MQ: status=verified
                    ESP->>ESP: Sequenz dauerhaft in NVS speichern
                    ESP->>MQ: status=rebooting
                    MQ->>BD: verified/rebooting
                    BD->>DB: Acknowledgement persistieren
                    ESP->>BOOT: Neustart in neuen OTA-Slot
                    BOOT->>ESP: Neue Firmware starten (pending verify)
                    ESP->>ESP: Runtime, WLAN und Grunddiagnosen starten

                    alt Runtime-Diagnose erfolgreich
                        ESP->>BOOT: Image gültig bestätigen
                        ESP->>MQ: Neu verbinden und Status liefern
                        MQ->>BD: Abschluss-/Online-Rückmeldung
                        BD->>DB: Abschlussstatus persistieren
                        BD-->>IDE: OTA erfolgreich bestätigt
                        IDE-->>User: Firmware aktiv und Board online
                    else Runtime-Diagnose fehlgeschlagen
                        ESP->>BOOT: Image ungültig markieren
                        BOOT->>BOOT: Auf vorherigen Slot zurückrollen
                        BOOT->>ESP: Vorherige Firmware starten
                        IDE-->>User: Rollback bzw. Recovery erforderlich anzeigen
                    end
                end
            end
        end
    end
```

## Zuständigkeiten und Sicherheitsgrenzen

| Bereich | Verantwortlich | Persistenter Zustand |
| --- | --- | --- |
| Projekt und BuildPackage | Project Server | Runtime SQLite |
| Device-Zuordnung, Pairing und OTA-Bereitschaft | Device Management | Runtime SQLite |
| Build, Artefakte, ECDSA-Auftrag und Acknowledgements | Build & Deploy Server | Runtime SQLite, Build-/Artifact-Volume, OTA-Private-Key und inkrementeller Cache |
| Transport | Mosquitto | QoS-1-/Retain-Zustand im MQTT-Volume |
| OTA-Public-Key, Replay-Schutz und aktive Firmware | ESP32 | NVS und A/B-Partitionen |
| Erfolg für den Nutzer | IDE | Aus persistierten Server- und Device-Status abgeleitete Anzeige |

Der MQTT-Broker transportiert den Auftrag, entscheidet aber nicht über dessen Berechtigung. Das ESP32 akzeptiert ausschließlich einen zum eigenen Device passenden, nicht abgelaufenen ECDSA-P-256-signierten Auftrag mit neuer Sequenznummer und einem HTTPS-Artefakt vom provisionierten Build-Origin.
