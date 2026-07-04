# Business View

Diese Datei ist eine generierte Lesesicht auf Business-, Produkt- und Nutzenlogik.
Der validierte SQLite-Graph ist die kanonische Struktur.

## Vision

`vision.gernetix`

GerNetiX wird als Engineering Knowledge Platform verstanden.
Nicht Code ist das eigentliche Kapital, sondern Engineering-Wissen.

## Leitprinzip

`principle.knowledge_more_expensive_than_code`

Wissen ist teurer als Code.

## Produkte

### Learning Platform

`product.learning_platform`

Ziel:

Menschen systematisch zu Embedded- und Softwareentwicklern ausbilden.

Unterstuetzte Business Goals:

- `BG-001`
- `BG-002`
- `BG-004`
- `BG-005`
- `BG-006`

### Simple IDE

`product.simple_ide`

Ziel:

Embedded-Projekte moeglichst einfach entwickeln.

Unterstuetztes Business Goal:

- `BG-003`
- `BG-006`

## Business Goal Hardwarevertrieb und Support

`BG-006`

Ziel:

Gewinnbringenden Hardwarevertrieb ermoeglichen, gesetzliche Supportpflichten erfuellen und unberechtigte Support- oder Reklamationsansprueche vermeiden.

Realisierung:

- Register and Pairing weist nach, ob ein konkretes Board bekannt und einem Account zugeordnet ist.
- Provisioning Tool bereitet Registrierung, Credentials und Pairing vor.
- Recovery Tool unterstuetzt Wiederherstellung und Supportpruefung.
- User IDE identifiziert den Kunden und stellt nur berechtigte Services bereit.
- Admin Tool verwaltet Grants, Hardwarekatalog und neue Hardwaretypen.
- Hardware Shop wird in der IDE sichtbar und bietet passende Hardware fuer den komfortablen Einstieg an.
- Verkaufte ProcessorBoards koennen mit Initial-Firmware ausgeliefert werden.
- Bei WiFi-/OTA-faehigen Boards kann spaeter Cloud-/OTA-Flash genutzt werden, wenn Registrierung, Pairing und Berechtigung vorhanden sind.

## Business Goal Robustheit und Kundenakzeptanz

`BG-007`

Ziel:

Kritische Plattformfunktionen muessen robust sein, damit Nutzer Vertrauen in Hardware, IDE, Flash-Prozesse und Support gewinnen.

Zentrales NFR:

- `nfr.firmware_flash_must_not_brick_board`: Firmware-Flash ueber USB, OTA oder Cloud/OTA darf Boards nicht dauerhaft unbrauchbar machen.

Business-Nutzen:

- weniger Frust beim Einstieg
- weniger Reklamationen
- geringerer Supportaufwand
- hoehere Kundenakzeptanz

## Business Capabilities

Business Capabilities sind fachliche Faehigkeiten, die durch Measures bereitgestellt werden.
Sie sind der Einstiegspunkt ins Requirements Engineering.

Eine eigene Business-Traceability-Sicht liegt in:

- `docs/generated/business-traceability-view.md`

### Value-based Bundling und Upselling

`BC-001`

Ziel:

Kunden koennen wertvollere Kombinationsangebote erhalten. Sie geben mehr Geld aus, bekommen aber durch gebuendelte Courses, besseren Lernzusammenhang und Preisvorteile mehr Nutzen als bei isolierten Einzelkaeufen.

Wirtschaftliche Begriffe:

- Bundling
- Upselling
- Value-based Offer
- Warenkorbwert erhoehen

Realisierung:

- `product_offering.embedded_basics_bundle`

Regel:

- Das Angebot muss fuer den Kunden nachvollziehbar mehr Nutzen liefern.
- Die enthaltenen Courses bleiben die fuehrenden Learning-Verkaufseinheiten.
- Das Bundle dupliziert keine fachliche Lernlogik.

### Nachhaltig Profitabel Wirtschaften

`BG-008`

Ziel:

Das Unternehmen soll nachhaltig Geld verdienen, ohne die langfristige Wissens- und Kundennutzenorientierung zu verlieren.

Traceability:

```text
Vision
-> Business Goal
-> Business Capability
-> Strategy
-> Measure
-> Requirement
-> Architecture/Data/API
-> Implementation
-> Test
-> Validation
```

Beispiel:

```text
BG-008
-> BC-041
-> business_strategy.optimize_costs
-> measure.ai_usage_monitoring
-> system_capability.admin_ai_usage_monitoring
```

Bestandskundenbindung:

```text
BG-008
-> BC-040
-> business_strategy.increase_revenue
-> strategy.retain_existing_customers
-> measure.community_knowledge_platform
-> BC-015
-> requirement.community_question_triage_time
```

Regel:

- Community ist eine Measure, keine Business Capability.
- Oeffentlichkeitsarbeit ist eine uebergeordnete Measure zur Neukundengewinnung.
- Measures duerfen rekursiv weitere Measures enthalten.
- Status wird getrennt als `businessStatus` und `implementationStatus` gepflegt.

### KI-Kostenkontrolle

`BR-006` Schutz vor unkontrollierten KI-Kosten

Ziel:

Kostenpflichtige KI-Nutzung muss technisch und wirtschaftlich begrenzt, nachvollziehbar und serverseitig kontrolliert werden.

Verknuepfte Business Capability:

- `BC-041`: Kostenkontrolle

Massnahmen und SystemCapabilities:

- `measure.ai_credit_management` -> `system_capability.ai_credit_management`
- `measure.ai_budget_limits` -> `system_capability.ai_budget_limits`
- `measure.ai_usage_monitoring` -> `system_capability.admin_ai_usage_monitoring`
- `measure.ai_admin_cost_controls` -> `system_capability.admin_ai_cost_controls`
- `measure.ai_suspicious_usage_detection` -> `system_capability.ai_suspicious_usage_detection`

Lesesicht:

- `docs/generated/ai-cost-protection-view.md`

### KI-Zusatzkontingent

`product_offering.ai_credit_addon`

Ziel:

Nutzer koennen gegen Bezahlung mehr KI-Credits erhalten, um eine bessere oder laengere KI-Erfahrung zu nutzen.

Traceability:

```text
product_offering.ai_credit_addon
-> BC-039
-> requirement.ai_credit_addon_purchase
-> data_model.ai_credit_ledger_entry
```

### KI-Community-Assistent Premium

`product_offering.community_ai_assistant_premium`

Einordnung:

```text
learning_path.community_knowledge_usage
-> business_domain.community
-> BC-040
```

Regel:

- Die normale Community bleibt kostenlos.
- Der KI-Community-Assistent ist Premium.
- Es entstehen keine direkten neuen Links zu Vision, Business Goals oder Customer Journeys.
- Die Monetarisierung laeuft ueber Premium-Zugriff, Credits, Limits und Usage Events.

Lesesicht:

- `docs/generated/community-ai-assistant-view.md`

## Zielgruppen

- `audience.maker`
- `audience.hobby_developer`
- `audience.student`
- `audience.teacher`
- `audience.school`
- `audience.embedded_beginner`
- `audience.company`

Regel:

Zielgruppen steuern keine Berechtigungen und sind keine Metamodell-Artefakte.

## Kundennutzen / Value Propositions

- `value.visible_result`: Sichtbares Ergebnis.
- `value.practical_embedded_project`: Praxisnahes Embedded-Projekt.
- `value.hardware_reuse`: Hardware wiederverwenden.
- `value.control_vs_regulation`: Steuerung vs Regelung verstehen.
- `value.playful_embedded_learning`: Spielerisches Embedded-Lernen.
- `value.optional_ai_extension`: Optionale KI-Erweiterung.
- `value.hardware_inventory`: Hardware inventarisieren.
- `value.project_recommendations_from_inventory`: Projektvorschlaege aus Bestand.
- `value.custom_home_automation`: Individuelle Hausautomatisierung.
- `value.incremental_extension`: Immer weiter erweitern.
- `value.home_automation_topology_choice`: Passende Hausautomatisierungs-Topologie waehlen.

## Kaufbare Learning-Angebote

Modell:

- `Course` ist die normale kaufbare Learning-Einheit.
- Nutzer kaufen in der Regel eine fachliche Submenge, z. B. einen Course zu Hausautomatisierung oder Embedded-Spielen.
- `ProductOffering` mit `offeringType: bundle` buendelt mehrere Courses kaufmaennisch.
- Learning Goals wie `learning_goal.embedded_basics` ordnen Courses und Bundles fachlich ein.

### Embedded Grundlagen Gesamtpaket

`product_offering.embedded_basics_bundle`

Ziel:

Mehrere Courses zum Thema Embedded Grundlagen als Kombinationsangebot kaufen und dabei einen Preisvorteil erhalten.

Enthaelt:

- `course.home_automation_understand_and_extend`
- `course.embedded_games_programming`

Regel:

- Das Bundle dupliziert keine fachliche Lernlogik.
- Die Inhalte bleiben in den enthaltenen Courses und deren Learning-Artefakten.
- Einzelkurse bleiben separat kaufbar.

### Hausautomatisierung verstehen und erweitern

`course.home_automation_understand_and_extend`

Ziel:

Nutzer, die Standardloesungen nicht verwenden wollen oder spezielle Hausautomatisierungswuensche haben, sollen lernen, eigene Erweiterungen selbst umzusetzen.

Realisierung:

- `learning_unit.home_automation_understand_and_extend`

Metamodell:

- Das kaufbare Angebot ist ein `Course`.
- Die fachliche Umsetzung erfolgt durch eine `LearningUnit`.
- `data/business/offers.yaml` ist nur noch eine veraltete Uebergangsnotiz.

Modellregel:

- Neue Verkaufseinheiten im Learning-Kontext nutzen zuerst bestehende Metamodell-Strukturen.
- Fuer kaufbare Learning-Einheiten ist `Course` das fuehrende Artefakt.
- Neue Artefakttypen entstehen nur, wenn kein bestehender Typ fachlich passt.

Positionierung:

- Standardloesungen sind nicht flexibel genug.
- Spezielle Wuensche lassen sich oft am besten selbst umsetzen.
- Hausautomatisierung wird als schrittweise erweiterbares System verstanden.
- Nutzer sollen entscheiden koennen, ob eine Loesung embedded-only, mit PC-Software, mit Mobile-App, mit kleinem HomeServer, als verteiltes IoT-System oder mit intelligenteren Edge-Devices sinnvoller ist.

Topologie-Nutzen:

- Embedded only: geringer Einstieg, robust ohne Server/App, aber begrenzte Visualisierung.
- Embedded und PC-Software: grosse Oberflaeche, Logging und Analyse, aber Abhaengigkeit vom PC.
- Embedded und Mobile-App: alltagsnahe Statussicht und Bedienung, aber App- und Online-/Offline-Komplexitaet.
- Kleiner HomeServer: zentrale Datenhaltung, Automationen und Dashboards, aber mehr Betriebsverantwortung.
- Verteilte IoT-Systeme: skalierbar und raumuebergreifend, aber komplexer bei Debugging, Updates und Ausfallszenarien.
- Intelligentere Edge-Devices: weniger zentrale Abhaengigkeit, aber hoehere Geraetekosten und komplexere Firmware.

### Embedded Spiele programmieren

`course.embedded_games_programming`

Ziel:

Embedded-Grundlagen ueber spielerische Projekte, sichtbare Ergebnisse und direkte Interaktion lernen.

Positionierung:

- Einzeln kaufbare Submenge zum Thema Embedded Grundlagen.
- Kann mit anderen Courses in einem Embedded-Grundlagen-Bundle kombiniert werden.

## Geschaeftslogik

Die Plattform verkauft fachlich nicht nur einzelne Kurse.
Sie begleitet den Nutzer zum naechsten sinnvollen Entwicklungsschritt.

Empfehlungen basieren auf:

- vorhandener Hardware
- vorhandenen Kompetenzen
- Lernfortschritt
- gekauften Lernzielen

## Business-Gaps

- Fokuszielgruppe fuer `CJ-001` ist noch offen.
- Finale Produktnamen von GerNetiX, Learning Platform und Simple IDE sind noch offen.
- Konkretes Geschaeftsmodell ist noch nicht ausgearbeitet.
