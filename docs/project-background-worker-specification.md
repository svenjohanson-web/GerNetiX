# Projekt-Background-Worker-Spezifikation

## Status und Zweck

**Status: vorgeschlagen.** Der Background Worker ist ein verwalteter GerNetiX-Ausfuehrungsdienst fuer projektgebundene, kurz laufende Zustandsaktualisierungen. Er dient beispielsweise Tamagotchi-Zustaenden, Lernfortschrittsberechnung oder anderen regelbasierten Projektautomationen. Er ist keine allgemeine Code-Hosting- oder Datenbank-Schnittstelle.

Ein Worker-Job arbeitet ausschliesslich im Scope eines Accounts und eines Projekts. Er erhaelt einen begrenzten Daten-Snapshot, fuehrt ein Benutzer-Regelskript aus und schreibt ausschliesslich einen validierten Patch in die zuvor erlaubten Datenbereiche zurueck.

```text
Scheduler oder Ereignis
  -> Job mit zeitbegrenztem Daten-Grant
  -> geheimes PreScript: Snapshot laden
  -> User-Regelskript: Werte berechnen
  -> geheimes PostScript: Patch pruefen und atomar speichern
  -> Job beendet, Audit ohne Nutzdaten
```

## Komponenten und Verantwortlichkeiten

| Komponente | Verantwortung |
|---|---|
| Worker Coordinator | Plant Jobs, vergibt Leases und verteilt sie an mehrere Worker-Instanzen. |
| Worker Instance | Fuehrt genau einen geleasten Job aus; zustandslos und horizontal skalierbar. |
| Project Runtime Data API | Liefert und speichert ausschliesslich account-/projektgebundene Datenbereiche. Sie ist die einzige Speicher-Schnittstelle des Workers. |
| PreScript | GerNetiX-gepflegte, nicht einsehbare Plattformlogik; loest den Grant ein und befuellt die erlaubten Variablen mit einem Snapshot. |
| User-Regelskript | Projektartefakt in einer begrenzten, validierten Regelsprache; berechnet nur Werte innerhalb der bereitgestellten Variablen. |
| PostScript | GerNetiX-gepflegte, nicht einsehbare Plattformlogik; validiert Output, Invarianten und Version, schreibt den Patch atomar und erzeugt Audit-Metadaten. |

PreScript und PostScript sind keine konfigurierbaren Projektquellen. Sie enthalten weder Nutzeridentitaeten noch Klartext-Credentials in der Skriptumgebung und werden nicht in Projekt- oder KI-Kontexten ausgegeben.

## Job-Vertrag

```json
{
  "job_id": "job_opaque_id",
  "job_type": "tamagotchi_state_tick",
  "account_id": "opaque_account_id",
  "project_id": "project_id",
  "script_revision": "sha256:...",
  "trigger": { "kind": "schedule", "due_at": "2026-07-16T12:00:00Z" },
  "grant": {
    "expires_at": "2026-07-16T12:01:00Z",
    "read_paths": ["runtime.tamagotchi", "telemetry.activity_summary"],
    "write_paths": ["runtime.tamagotchi"],
    "max_snapshot_bytes": 16384
  },
  "limits": { "max_ast_nodes": 250, "max_expression_depth": 20, "max_runtime_ms": 50 }
}
```

Zeitplan, Trigger, Datenpfade, Skriptrevision und Limits werden ausserhalb des User-Regelskripts definiert. Der Grant ist einmalig, kurzlebig und nur fuer diesen Job, Account und dieses Projekt gueltig.

## Regelsprache

Die Regelsprache arbeitet nur auf den durch das PreScript bereitgestellten Variablen und liefert geaenderte Werte als Patch zurueck. Sie besitzt keine Datenbank-, Datei-, Netzwerk-, Import-, Prozess-, Zeitplan- oder Identitaetsfunktion.

Die Sprache definiert ausschliesslich erlaubte Konstrukte:

- Literale: Zahl, Text, Boolean und strukturierte Werte innerhalb des freigegebenen Schemas
- Feldzugriff auf bereitgestellten Variablen
- Zuweisung an freigegebene Ausgabefelder
- Bedingungen und Vergleiche
- Rechen- und Boolesche Operationen
- Plattformfunktionen mit fester Semantik, etwa `min`, `max`, `clamp` und `round`

Schleifen, Rekursion, dynamische Auswertung und selbst definierte Funktionen sind nicht Teil der Grammatik. Das ist keine nachtraegliche Verbotsliste: Diese Konstrukte werden vom Parser nicht erzeugt und gelangen nicht in den ausfuehrbaren AST.

Beispiel fuer einen Tamagotchi-Tick:

```text
wenn tamagotchi.hunger < 100:
  tamagotchi.hunger = min(100, tamagotchi.hunger + regeln.hunger_pro_tick)

wenn tamagotchi.hunger > 80:
  tamagotchi.mood = "hungrig"
```

## Ausfuehrungsablauf

1. Der Coordinator erzeugt aus Zeitplan oder Ereignis einen Job und signiert einen kurzlebigen Grant.
2. Eine freie Worker-Instanz reserviert den Job mit einer Lease. Eine zweite Instanz kann denselben Job nicht parallel abschliessen.
3. Das PreScript loest den Grant an der Project Runtime Data API ein und erhaelt nur den erlaubten, versionsmarkierten Snapshot.
4. Der Worker parst und validiert das User-Regelskript gegen Grammatik, Datenpfade und Limits; dann wertet er den AST ohne I/O aus.
5. Das PostScript prueft den resultierenden Patch gegen Schema, Wertbereiche, Zustandsinvarianten und die erlaubten Schreibpfade.
6. Die Runtime Data API speichert den Patch per Compare-and-Swap gegen die Snapshot-Version atomar.
7. Der Coordinator markiert den Job als erfolgreich, wiederholbar oder fehlgeschlagen und speichert nur Audit-Metadaten.

Bei Versionskonflikt wird nichts teilweise gespeichert. Der Job wird – falls sein Auftrag idempotent ist – mit einem neuen Snapshot erneut geplant.

## Parallelitaet und Zuverlaessigkeit

- Worker-Instanzen sind zustandslos; beliebig viele Prozesse koennen parallel laufen.
- Ein Job besitzt Lease-ID und Ablaufzeit. Nach Lease-Ablauf darf eine andere Instanz ihn erneut ausfuehren.
- Die Semantik ist **at-least-once**; PostScript und Datenmodell muessen deshalb idempotente oder Compare-and-Swap-gesicherte Zustandsuebergaenge verwenden.
- Ein Job darf erst nach erfolgreichem atomaren Speichern als abgeschlossen gelten.
- Wiederholungen, Laufzeit, Konflikte und Fehler werden je `job_type` gezählt, nicht mit Snapshot- oder Nutzdaten geloggt.

## Sicherheitsgrenzen

- Worker und Skript sehen keine Identity-Daten, keine anderen Projekte und keinen Datenbankzugang.
- Der Grant beschraenkt Lesen, Schreiben, Groesse und Laufzeit; PreScript und PostScript erzwingen diese Grenze serverseitig.
- Der Worker besitzt keinen ausgehenden Netzwerkzugriff und keine direkte Zugriffsmöglichkeit auf Projektquellen.
- Der User kann innerhalb der erlaubten eigenen Daten falsche Fachwerte erzeugen; das PostScript begrenzt dies durch Schema, Wertebereiche und projektspezifische Invarianten.
- Kundenansichten und Push-Nachrichten lesen nur explizit freigegebene, abgeleitete Daten. Der Worker veroeffentlicht keine Rohdaten automatisch.

## Standard-Jobtypen

| Jobtyp | Trigger | Lesen | Schreiben |
|---|---|---|---|
| `tamagotchi_state_tick` | periodisch | Tamagotchi-Zustand, Aktivitaetszusammenfassung | Tamagotchi-Zustand |
| `learning_progress_refresh` | Abschluss einer Lerneinheit oder periodisch | Lernfortschritt, Projektstatus | Lernfortschritt, naechste Lernempfehlung |
| `project_rule_evaluation` | projektspezifisches Ereignis | explizit konfigurierte Projektdaten | explizit konfigurierte Projektdaten |

Neue Jobtypen, PreScripts und PostScripts werden von GerNetiX implementiert, versioniert und getestet. Ein Projekt kann sie nur mit den jeweils angebotenen Datenpfaden und Parametern beauftragen.
