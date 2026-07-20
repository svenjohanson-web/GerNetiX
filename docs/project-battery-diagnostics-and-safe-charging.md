# Lernprojekt: Akkudiagnose und sicheres Laden mit ESP32

## Ziel und Sicherheitsrahmen

Dieses Lernprojekt baut schrittweise ein Akku-Pruefgeraet zu einem lokalen Akku-Arbeitsplatz aus. Der erste Ladeaufbau verwendet bewusst **eine einzelne NiMH-Zelle** und einen passenden NiMH-Ladecontroller auf Trägerplatine, Evaluation-Board oder einem kleinen Shield. Arduino Nano und ESP32 sind gleichwertige Projektvarianten: Beide lesen Status, Messwerte und Fehler des Ladecontrollers; der ESP32 ergaenzt spaeter die lokale WLAN-, Web- und PWA-Schicht. Die kritischen Grenzen bleiben in der Ladehardware: feste Strombegrenzung, Sicherung, Sicherheitszeit und temperaturabhaengige Abschaltung.

NiMH braucht kein Lithium-BMS. Eine Tiefentladung ist bei einer einzelnen Zelle in der Regel kein lithiumtypischer Brandfall; sie kann aber Kapazitaet und Lebensdauer schaedigen. In seriellen Packs kann eine schwache Zelle durch die anderen Zellen umgepolt werden. Auch NiMH kann bei Ueberladung, Kurzschluss oder Verpolung heiss werden, auslaufen oder ueber sein Sicherheitsventil Druck ablassen. Daher nur unbeschaedigte Einzelzellen, ein strombegrenztes Niedervolt-Netzteil, Sicherung, temperaturfeste Unterlage und beaufsichtigte Versuche verwenden. Mehrzellige Lithium-Packs bleiben ein separates, spaeteres Projekt mit passendem BMS.

## Was gelernt wird

- Akkuchemien unterscheiden: NiMH, Li-Ion/LiPo, LiFePO4 und Blei; Nennspannung, Zellzahl, Kapazitaet und C-Rate verstehen.
- Verstehen, dass Spannung nur eine grobe Ladezustands-Schaetzung ist; unter Last, Temperatur und Alter beeinflussen sie.
- Spannung, Strom, Leistung, Temperatur und Zeit messen, plausibilisieren und kalibrieren.
- Einen definierten Lasttest sicher ausfuehren und daraus eine einfache Kapazitaetsabschaetzung ableiten.
- Einen ESP32-Webserver zuerst lokal im Handy-Browser, danach als installierbare PWA nutzen.
- Akkudaten und Messhistorie in SQLite speichern und einzelne Akkus per QR-Code oder RFID eindeutig zuordnen.

## Didaktische Etappen

| Etappe | Ergebnis | Kerninhalt | Sicherheitsgrenze |
| --- | --- | --- | --- |
| 0. Grundlagen | Akku-Steckbrief und Arbeitsregeln | Chemie, Zellzahl, Spannung, Kapazitaet, Strom, Ladeverfahren | Noch kein Ladeaufbau |
| 1. Spannungs-Pruefgeraet | ESP32 zeigt Batteriespannung und Ampelstatus | Spannungsteiler, ADC, Kalibrierung, Medianfilter | Anzeige ist kein Freigabenachweis |
| 2. Pruefen unter Last | definierter, zeitlich begrenzter Lasttest | MOSFET, Leistungswiderstand, Strom-/Temperaturmessung, Abschaltgrenzen | Last nur mit Sicherung, Begrenzung und Temperaturabbruch |
| 3. NiMH-Ladeshield aufbauen | Batteriehalter, Ladecontroller, Temperaturfuehler und Mikrocontroller sicher verbinden | Datenblatt lesen, Anschlussplan, Status- und Fehlerpins, Ladeindikator | Der Ladecontroller-IC behaelt Strom-, Zeit- und Temperaturgrenzen auch ohne Mikrocontroller |
| 4. Mikrocontroller-Kommunikation | Nano/ESP32 liest den Ladecontroller und dokumentiert den Ablauf | digitale Statuspins; spaeter optional I2C/SMBus, Statusregister und begrenzte Konfiguration | Kommunikationsfehler beendet oder sperrt den Ladevorgang; Schutzgrenzen sind nicht per App erhoehbar |
| 5. Handy-Weboberflaeche | Live-Dashboard im lokalen WLAN | ESP32-Webserver, REST/JSON, Diagramm und Warnungen | Nur lokales, angemessen geschuetztes WLAN |
| 6. PWA | installierbare Bedienoberflaeche mit Offline-Ansicht | Service Worker, Caching, Web-App-Manifest | Offline-Daten sind nur Anzeige-/Warteschlange, keine fachliche Wahrheit |
| 7. Akku-Datenbank | Akku-Steckbriefe und Messreihen in SQLite | Datenmodell, Migrationen, lokale API, Export | Parameter immer vor Ladefreigabe pruefen |
| 8. Kennzeichnung | Akku per QR oder RFID identifizieren | Identifier-Zuordnung, Scan-Workflow, Verwechslungsschutz | Kennung ist keine automatische Chemieerkennung |

## Parallelvarianten: Arduino Nano und ESP32

| Baustein | Arduino-Nano-Variante | ESP32-Variante |
| --- | --- | --- |
| Messung und Ladezustand | ADC, Timer, Temperaturmessung, serielle Diagnose | gleiche Kernlogik; serielle Diagnose plus WLAN-Logging |
| NiMH-Ladeshield | Batteriehalter, Ladecontroller-Carrier, NTC und Status-LED | derselbe Shield oder Adapter-Carrier |
| Ladecontroller-IC | digitale Statusleitungen oder die angebotene Busschnittstelle | gleiche IC-Anbindung; bei Bus-Schnittstelle dieselben Nachrichten und Fehlercodes |
| Bedienung | LEDs, Taster und Serieller Monitor | LEDs, Taster, Serieller Monitor und lokales Handy-Dashboard |
| Datenbank/PWA | Messdaten an einen spaeteren Begleitserver uebergeben | lokale Web-API, PWA und Serveranbindung selbst erarbeiten |

Die fachliche Kernlogik bleibt in beiden Varianten identisch: `Messen -> Plausibilisieren -> Laden freigeben -> Laden ueberwachen -> sicher beenden -> Ergebnis protokollieren`. Nur Hardware-Abstraktion, Pinbelegung und Benutzeroberflaeche unterscheiden sich. Der Spannungsteiler, die Sensorversorgung und alle Signale muessen je Variante zum zulaessigen Eingangsbereich des Boards passen; eine Schaltung darf nicht blind zwischen 5-V- und 3,3-V-Logik uebernommen werden.

## Lernaufbau und Hardware

Der Einstieg bleibt bewusst klein: Arduino Nano **oder** ESP32-Entwicklungsboard, Batteriehalter, ein passender NiMH-Ladecontroller auf Carrier/Shield, NTC, Sicherung und Steckverbinder. Fuer Etappe 2 kommen ein Spannungssensor oder Spannungsteiler, Stromsensor und ein Temperatursensor hinzu. Das Shield soll nur wenige klar beschriftete Anschluesse besitzen: Versorgung, Akku, NTC sowie Status/Enable beziehungsweise Bus. Die Hardware begrenzt den maximalen Ladestrom unabhaengig; der Mikrocontroller darf den Ladevorgang nur freigeben, sperren, auslesen und dokumentieren.

Empfohlene Messgroessen:

- Leerlaufspannung `V_oc`
- Lastspannung `V_load`
- Last-/Ladestrom `I`
- Leistung `P = V * I`
- Temperatur an Zelle und Lastwiderstand
- Testdauer sowie Abbruchgrund

Eine Kapazitaetsabschaetzung entsteht erst aus der Zeitintegration des gemessenen Stroms (`mAh = Integral I dt`). Ein einzelner Spannungswert darf nie als exakte Restkapazitaet ausgegeben werden.

## Fachmodell ab Etappe 6

| Objekt | Wesentliche Felder |
| --- | --- |
| `Battery` | ID, Anzeigename, Chemie, Zellzahl, Nennspannung, Kapazitaet, max. Lade-/Entladestrom, Temperaturbereich, Sicherheitsstatus |
| `BatteryIdentifier` | Battery-ID, Typ `qr` oder `rfid`, Kennwert, vergeben am |
| `MeasurementSession` | Battery-ID, Start/Ende, Modus `voltage_check`, `load_test` oder `charge_observation`, Ergebnis, Abbruchgrund |
| `Measurement` | Session-ID, Zeitstempel, Spannung, Strom, Leistung, Zell- und Lasttemperatur |
| `ChargeProfile` | Chemie/Zellzahl, erlaubte Grenzen, Referenz auf die getestete Ladestrategie oder den Ladecontroller-IC |
| `ChargeController` | IC-Typ, Schnittstelle, Firmware-/Konfigurationsversion, auslesbare Status- und Fehlercodes, nicht veraenderbare Hardwaregrenzen |

Die Datenbank ist die fachliche Quelle der Wahrheit. Browser- und PWA-Speicher duerfen nur aktuellen UI-Zustand, Offline-Warteschlange oder Cache halten. Eine QR-/RFID-Kennung oeffnet immer zuerst den gespeicherten Akku-Steckbrief; sie darf keine Ladeparameter selbst festlegen.

## Erstes Inkrement: spannungsbasiertes Akku-Pruefgeraet

1. Einen Akku-Steckbrief fuer eine bekannte, einzelne Zelle anlegen.
2. Messbereich und Spannungsteiler berechnen, gegen ein Multimeter kalibrieren und die Abweichung dokumentieren.
3. Mehrere ADC-Werte filtern, Spannung anzeigen und Rohwert, kalibrierten Wert sowie Messzeit seriell protokollieren.
4. Einen rein informativen Status aus dem zum Akku-Steckbrief passenden Spannungsbereich ableiten; bei unbekannter Chemie immer `unbekannt` zeigen.
5. Mit einem Netzteil oder einer bekannten Referenzspannung testen, bevor ein Akku angeschlossen wird.

**Abnahmekriterium:** Gegen das Referenzmessgeraet liegt der Messfehler im vorher festgelegten Toleranzbereich; ausserhalb des Messbereichs oder bei unbekanntem Profil erscheint kein irrefuehrender Ladezustand.

## Weiterer Weg

Etappe 2 erweitert nur das Pruefgeraet. Etappe 3 verwendet keine selbst entwickelte Leistungselektronik: Der Ladecontroller wird nach seinem Datenblatt als ein kleines, steckbares Shield oder Carrier eingesetzt. Die Lernaufgabe ist sein sicherer Anschluss, nicht das Nachbauen einer bereits gut geloesten Stromregelung. Sicherheitszeit und Temperaturgrenze bleiben im Ladecontroller wirksam.

Etappe 4 verbindet Arduino Nano oder ESP32 mit diesem Shield. Ein einfacher Anfang liest nur `charging`, `done` und `fault` ueber digitale Statuspins. Ein spaeteres Shield mit I2C/SMBus ergaenzt Statusregister und vom IC begrenzte Konfiguration. Der Mikrocontroller darf weder eine Schutzgrenze heraufsetzen noch bei Kommunikationsausfall den Lader weiterlaufen lassen. Der diskrete Konstantstrom-Lader bleibt als optionale Vertiefung fuer Fortgeschrittene erhalten. Erst danach folgen beim ESP32 lokale Webansicht, PWA und persistente Akkuverwaltung. RFID ist bei wiederverwendbaren Arbeitsakkus praktisch; QR ist der guenstigere und sichtbarere Einstieg. Beide nutzen dieselbe `BatteryIdentifier`-Schnittstelle.

## Offene Entscheidungen vor der Umsetzung

1. Welche erste Akkuchemie und Zellzahl wird als allein unterstuetztes Praxisprofil verwendet?
2. Welcher NiMH-Ladecontroller ist als gut verfuegbares Carrier, Evaluation-Board oder eigenes, kleines Shield geeignet?
3. Welche Anschluesse soll das Shield mindestens anbieten: Statuspins, Enable, NTC und/oder I2C/SMBus?
4. Welche maximale Lastleistung und welche mechanische Schutzumgebung sind vorhanden?
5. Soll die SQLite-Datenbank zuerst auf einem lokalen Begleitserver oder erst nach der PWA auf einem Server im GerNetiX-Projekt laufen?
