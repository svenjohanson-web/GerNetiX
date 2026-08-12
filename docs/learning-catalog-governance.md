# Katalogvertrag fuer Lernangebote

Stand: 2026-08-11 · Status: verbindlicher Modellierungsstandard

## Ziel

Der Katalog trennt fachlichen Lerninhalt, didaktische Navigation und Verkauf. Dadurch kann ein Lernprojekt wiederverwendet werden, ohne es fuer jeden Course, Pfad oder Bundle zu kopieren.

| Ebene | Verantwortet | Darf enthalten | Darf nicht enthalten |
| --- | --- | --- | --- |
| `LearningProject` | ein konkretes, eigenstaendig startbares Lern- oder Bauvorhaben | Lessons, Varianten, Voraussetzungen, Kompetenzen und Abschluss | Preis, Kaufrecht oder eine feste globale Reihenfolge |
| `Course` | einen fachlich abgeschlossenen Lernabschnitt | geordnete Projekt- und Lesson-Zuordnungen, Lernziel und Abschlussnachweis | eigene Kopien der Projekte oder Bundle-Preislogik |
| `LearningPath` | eine empfohlene didaktische Route zu einem Ziel | geordnete Course- und/oder Projekt-Zuordnungen, Pflichtstatus und Freischaltung | Kaufumfang oder Preislogik |
| `ProductOffering` mit `offeringType: bundle` | ein kaufbares Paket | versionierte Course-Zugaenge, Preis- und Upgrade-Regeln | Projekt-, Lesson- oder Pfadlogik |

Ein Hardware-Bundle bleibt ein eigenes `ProductOffering` mit `offeringType: hardware_bundle`. Es kann auf Lernpfade oder Lernprojekte verweisen, gewaehrt aber keinen stillschweigenden Course-Zugang.

## Verbindliche Zuordnungsregeln

1. Ein `LearningProject` darf in null bis vielen Courses und Learning Paths verwendet werden. Reihenfolge, Pflichtstatus, Freischaltung und Erzaehlkontext liegen ausschliesslich an der jeweiligen Zuordnung.
2. Jeder `Course` ist die kleinste kauf- und abschliessbare Lerneinheit. Ein kostenloser Course ist zulaessig und bleibt ein Course.
3. Ein `LearningPath` ist ein Empfehlungen- und Fortschrittskontext, kein Verkaufsartikel. Derselbe Course darf in mehreren Pfaden vorkommen.
4. Ein Lern-Bundle enthaelt nur Courses. Der Kaufumfang wird bei Veroeffentlichung als Version festgeschrieben; spaeter hinzukommende Courses sind nur enthalten, wenn dies ausdruecklich zugesagt wird.
5. Einzelkauf und Bundle-Kauf vergeben Entitlements auf Course-Ebene. Bereits erworbene enthaltene Courses werden bei einem Bundle-Upgrade angerechnet. Cloud-, Build- und KI-Leistungen bleiben getrennte laufende Angebote.
6. Projekte, Courses, Pfade und Angebote verwenden durchgaengig `idea`, `draft`, `active`/`implemented`, `archived`. Nur freigegebene Inhalte duerfen im regulaeren Katalog und in kaufbaren Angeboten erscheinen.

## Bestandsordnung

Die bestehenden Artefakte werden nicht umbenannt oder dupliziert. Sie werden bei weiterer Ausarbeitung anhand dieser Einordnung zugeordnet:

| Katalogfamilie | Courses | bevorzugte Lernprojekte |
| --- | --- | --- |
| Programmieren und Software Engineering | Grundlagen der Programmierung; UML-Grundlagen; Grundlagen Datenbanken; Anforderungswerkstatt | `project.programming_fundamentals`, `project.uml_fundamentals`, `project.database_foundations`, `project.ai_requirements_workshop` |
| Embedded-Grundlagen | Grundlagen der Mikrocontrollertechnik; erste Firmware; Ein-/Ausgaenge; Kommunikation; Embedded-Abschlussprojekt | `project.microcontroller_fundamentals`, `project.avr_framework_resource_budget`, `project.embedded_c_hardware_control`, `project.motor_control_basics`, `project.embedded_device_communication_foundations`, `project.embedded_runtime_and_interrupts` |
| Messtechnik und Fehlersuche | Umgang mit Messmitteln; Sensor-, Versorgungs-, Schnittstellen- und Oszilloskopdiagnose | `project.measurement_tools_basics`, `project.home_automation_sensors`, `project.build_your_own_proximity_sensor`, `project.battery_diagnostics_and_safe_charging`, `project.embedded_device_communication_foundations` |
| Hausautomation und IoT | Hausautomatisierung verstehen; vernetzte Anwendungen; Infrastruktur oder App-Entwicklung | `project.smart_plant_watering`, `project.home_automation_sensors`, `project.home_automation_network`, `project.networked_application_communication_foundations`, `project.smart_assistant_ai_automation` |
| Plattformuebergreifende Entwicklung | Cross-Platform Development | die sieben `project.cross_platform_tamagotchi.*`-Projekte |
| Maker- und Geraeteprojekte | Access Control, Sprachassistent, Persistenz und Hardware-Vertiefungen | `project.rfid_safe`, `project.book_vault`, `project.nexi_voice_assistant`, `project.storage_learning_story` |

Die letzte Spalte ist eine kuratierte Ausgangszuordnung, keine implizite Veroeffentlichungsfreigabe. Nicht jedes genannte Projekt muss Bestandteil jedes Course werden.

## Pflegeablauf

Bei einem neuen Lernangebot wird zuerst entschieden: Ist es ein neues `LearningProject`, eine Erweiterung eines bestehenden Projects, ein `Course`, ein `LearningPath` oder ein `ProductOffering`? Erst danach werden Zuordnungen angelegt. YAML-Dateien bleiben Legacy-Importquellen; verbindliche neue Regeln und Zuordnungen werden im SQLite-Graphen gepflegt.
