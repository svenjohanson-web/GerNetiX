# Inkrementelle Build-Strategie

## Ziel

Typische Aenderungen an Lernprojekten oder KI-generierten Modulen sollen nur die betroffenen Dateien neu kompilieren. Die Basissoftware bleibt eine stabile, gecachte Build-Basis.

Ein reiner Build aus der Entwicklungsplattform benoetigt kein Inventar-Device. Eine Device-Zuordnung wird erst fuer USB- oder OTA-Flash vorausgesetzt.

## Build-Bereiche

- `basissoftware/esp32/`: stabile Basis-Firmware, gemeinsam fuer alle Projekte.
- `projects/`: projektspezifische Konfiguration und freigegebene Hooks.
- `generated/`: KI-generierte oder nutzerbezogene Module.

## Cache-Regeln

- Der Build-Server haelt die kompilierte Core-Komponente dauerhaft vor.
- Jeder von der Entwicklungsplattform ausgeloeste Build verwendet den technischen `.pio`-Cache desselben Projekts und Zielgeraets. Der Build-Button fordert keinen Clean- oder Vollbuild an.
- Der Build-Server verwendet pro Projekt und Zielgeraet einen stabilen technischen Build-Workspace. Dadurch bleiben absolute Buildpfade und Zeitstempel unveraenderter Basissoftwaredateien stabil.
- Bei einem neuen BuildPackage werden nur inhaltlich geaenderte Dateien neu geschrieben und nicht mehr enthaltene Dateien entfernt. `.pio` bleibt als jederzeit neu erzeugbarer technischer Cache bestehen.
- Der Workspace-Abgleich verfolgt die vom BuildPackage gelieferten Pfade in einem technischen Manifest. Von PlatformIO oder ESP-IDF erzeugte Dateien wie `managed_components`, `dependencies.lock` und `sdkconfig` werden nicht als veraltete Projektquellen geloescht.
- Verweist ein vorhandener `.pio`-Zustand auf fehlende oder unvollstaendige ESP-IDF-`managed_components`, verwirft der Build-Server ausschließlich diesen inkonsistenten technischen Cache einschließlich der Komponentenauflösung und erzeugt ihn beim naechsten Build neu.
- Der persistente Build-Workspace ist keine fachliche Quelle der Wahrheit. Sein Inhalt wird bei jedem Auftrag mit dem vollstaendigen BuildPackage abgeglichen und darf jederzeit geloescht werden.
- Der Compiler-Cache bleibt zwischen Builds erhalten.
- PlatformIO-, ESP-IDF-, CMake- und Ninja-Caches werden nicht nach jedem Build geloescht.
- Basissoftware-Artefakte werden ueber Basissoftware-Version, Toolchain-Version, Board und Build-Konfiguration adressiert.
- Projekt- und Generated-Artefakte werden separat pro Projekt, Nutzer oder Build-ID erzeugt.
- Der ESP-IDF-Komponenten-Downloadcache liegt getrennt pro Projekt, Software-Einheit und Zielgeraet. Unterschiedliche Build-Ziele duerfen diesen mutierbaren Cache nie gemeinsam verwenden.
- Auftraege fuer dasselbe Projekt, dieselbe Software-Einheit und dasselbe Zielgeraet werden serverseitig exklusiv und geordnet ausgefuehrt. Auftraege fuer unterschiedliche Ziele bleiben parallel.
- Jeder Auftrag erhaelt ueber seine eindeutige BuildJob-ID einen eigenen beschreibbaren PlatformIO-Buildordner. Firmware, ELF, Map, Build-Log und weitere Ausgaben zweier Jobs duerfen niemals denselben Ausgabepfad verwenden.
- Wiederverwendbare Objekt- und Abhaengigkeitscaches werden ueber den stabilen Build-Zielschluessel adressiert; schreibbare Ergebnisordner werden ueber die BuildJob-ID adressiert. Build-Ziel-ID und BuildJob-ID duerfen nicht vermischt werden.
- Erkennt der Runner einen beschaedigten ESP-IDF-Komponentencache, verwirft er ausschliesslich den technischen Cache dieses Ziels und wiederholt den Build genau einmal. Ein erneuter Fehler wird mit dem vollstaendigen Build-Log gemeldet.
- Im Serverbetrieb registriert PostgreSQL jede BuildJob-ID genau einmal und speichert Worker-ID, Zielschluessel, Status, Fortschritt und Ergebnisreferenzen. Statusabfragen funktionieren dadurch unabhaengig davon, welcher Build-Rechner antwortet.
- Ein Nutzerabbruch wird als zentraler Zustandswechsel `cancelling` in PostgreSQL gespeichert. Der ausfuehrende Worker erkennt ihn auch dann, wenn der Abbruch an einem anderen Server eingegangen ist, beendet den gesamten Compiler-Prozessbaum und schliesst den Auftrag als `cancelled` ab.
- Wartende Auftraege koennen vor dem Compilerstart entfernt werden. Abgebrochene Auftraege erzeugen weder erfolgreiche Build-Artefakte noch eine Flash-/RAM-Erfolgszusammenfassung; ihr temporaerer Job-Workspace wird aufgeraeumt, der technische Zielcache bleibt wiederverwendbar.
- Mehrere Build-Rechner verwenden fuer denselben Zielschluessel einen PostgreSQL-Advisory-Lock. Der Lock ist an die Datenbankverbindung des Workers gebunden und wird bei einem Prozess- oder Verbindungsabbruch automatisch freigegeben.
- Jeder Worker aktualisiert einen PostgreSQL-Heartbeat. Jobs eines nachweislich veralteten Workers wechseln von `accepted`, `queued` oder `running` auf `failed/worker_lost`, statt dauerhaft haengenzubleiben.
- Ein projektweiter Clean erhoeht eine zentrale Cache-Generation. Jeder Build-Rechner adressiert danach einen neuen lokalen Zielcache; alte lokale Caches koennen nicht mehr fachlich wirksam werden und spaeter asynchron entfernt werden.

## Abhaengigkeitsregeln

- `basissoftware/esp32/` darf keine Includes aus `projects/` oder `generated/` verwenden.
- `projects/` und `generated/` duerfen nur oeffentliche Basissoftware-Header verwenden.
- Keine projektbezogenen Konstanten in Basissoftware-Headern.
- Keine globalen Sammelheader fuer Projekt- oder Generated-Code.
- Kleine Funktionen bleiben in eigenen Dateien, damit Aenderungen wenige Objektdateien invalidieren.

## Link-Strategie

Der Build erzeugt oder verwendet:

- gecachte Core-Objektdateien
- neu erzeugte Projekt-Objektdateien
- neu erzeugte Generated-Objektdateien

Danach werden alle Objektdateien gelinkt, signiert und als OTA-Image bereitgestellt.

## Skalierung

Mehrere gleichzeitige Nutzer und mehrere Build-Rechner verwenden je Rechner eine lokale gecachte Core-Basis. Ihre mutierbaren Projekt- und ESP-IDF-Komponentencaches bleiben pro Build-Ziel und Cache-Generation getrennt. PostgreSQL koordiniert eindeutige Jobs, Status, Abbruchanforderungen, Ziel-Locks und globale Cache-Invalidierung. Gleichzeitige Auftraege desselben Ziels werden rechneruebergreifend geordnet, unterschiedliche Ziele parallel gebaut.
