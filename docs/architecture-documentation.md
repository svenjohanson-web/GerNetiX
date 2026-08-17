# Zentrale GerNetiX-Architekturdokumentation

Die GerNetiX-Architekturdokumentation wird als eigenstaendige Offline-Lesesicht gebuendelt. Sie gehoert nicht zum Identity Server und benoetigt keinen laufenden Serverprozess.

## Ziel

Die bisher entstandenen Architekturtexte, Diagramme, generierten Sichten und frueheren Aufbereitungsversuche sollen nicht weiter als voneinander getrennte Einstiege behandelt werden. Die Offline-Dokumentation rekonstruiert und indexiert diesen Bestand zentral.

## Quellenhierarchie

1. Der SQLite-Graph unter `tools/yaml-graph-sqlite/out/model-graph.sqlite` ist die kanonische fachliche Quelle fuer strukturierte Entscheidungen, Requirements, Artefakte und Beziehungen.
2. Gepflegte Markdown-Dokumente unter `docs/` liefern lesbare Begruendungen, Ablaeufe und technische Details.
3. Dateien unter `docs/generated/` sind generierte Lesesichten und werden nicht als parallele Wahrheit gepflegt.
4. Weitere und abgeloeste Dokumentationsansaetze bleiben im Rekonstruktionsarchiv sichtbar und werden eindeutig gekennzeichnet.

## Offline-Anwendung

Der Generator unter `tools/architecture-docs/` liest die vorhandenen Dokumente, zentrale SVG-Diagramme und die Architekturentscheidungen aus dem SQLite-Graphen. Er erzeugt eine statische Browser-Anwendung unter `tools/architecture-docs/dist/`.

Die Ausgabe bietet:

- eine thematische Navigation,
- Volltextsuche im gebuendelten Bestand,
- sichtbare Quellen- und Statuskennzeichnung,
- direkt eingebettete Architekturdiagramme,
- eine aus dem SQLite-Graphen erzeugte Entscheidungssicht,
- ein Rekonstruktionsarchiv fuer weitere und fruehere Versuche.

## Pflege

Fachliche Entscheidungen werden weiterhin im SQLite-Graphen gepflegt. Lesbare Konzepte werden in ihrem bestehenden Dokument aktualisiert. Nach Aenderungen wird die Offline-Sicht mit `npm run build` im Verzeichnis `tools/architecture-docs` neu erzeugt.

Die Zuordnung von SQL-Datenbanken, Docker-Volumes, Downloadklassen, Firmware-BLOBs, Account-Assets, Community-Inhalten und technischen Caches steht im [Persistenz- und Asset-Speicherkonzept](persistence-and-asset-storage.md).

Die serviceuebergreifende Trennung von festen technischen Schutzregeln und
variablen, versionierten Tarif-, Speicher-, Artefakt- und Lifecycle-Werten
steht in der
[Account-Speicher- und Lifecycle-Policy](account-storage-and-lifecycle-policy.md).

Die persoenliche Ein-Sitzungs-Regel, der ausdrueckliche Geraetewechsel, die
Kontosicherung bei unbekannter Anmeldung und die testbaren Arbeitspakete
stehen in [Eine aktive Kontositzung pro Einzelkonto](single-active-account-session.md).

Die beschlossene Ablösung der PostgreSQL-Projektquellen durch private
Forgejo-Repositories, die Speichergrenze zu PostgreSQL und Artifact Store sowie
die testbaren Migrationsschritte stehen in
[Forgejo-Projektrepositories und lesbare Projektdateien](forgejo-project-repository-work-packages.md).

Die providerneutrale Trennung von dauerhafter Control Plane, System- und
Kunden-Workern, Grundlast-/Burst-Messung, privaten Rechnern, Cloud-Burst und
Kubernetes steht in der
[elastischen Worker- und Kapazitaetsarchitektur](elastic-worker-capacity-architecture.md).

Das verbindliche, domaenenuebergreifende Bedien- und Markup-Modell fuer
Architektur-, Code-, Help- und Hardware-KI steht im
[Standard-KI-Chat-Pattern](standard-ai-chat-pattern.md).

Das integrierte Katalog-Lernprojekt KI-Anforderungswerkstatt und seine
deterministische Entwicklungsreferenz fuer eindeutige, pruefbare und
KI-verstaendliche Anforderungen sind im
[Lernprojekt fuer KI-verstaendliche Anforderungen](requirements-engineering-learning-project.md)
beschrieben.

Die ersten dauerhaft kaufbaren thematischen Lernpakete, ihre enthaltenen
kostenlosen und kostenpflichtigen Courses sowie faire Kauf- und Upgrade-Regeln
sind unter [Lernkurs-Pakete](learning-course-bundles.md) beschrieben.

Der Zugang zu den einzelnen Buechern im Wissensportal – kostenlos, im Abo,
per Einzelkauf und mit kostenloser Leseprobe – ist im
[Zugriffsmodell der Wissensbibliothek](knowledge-library-access-model.md)
festgelegt.

Die einheitliche technische Default-Deny-Grenze für Browserinhalte, Hilfe,
Quiz, Wissenskapitel und den Produktionsbuild beschreibt der
[Schutzvertrag für Browserinhalte](browser-content-protection.md).

Die verbindliche Trennung zwischen wiederverwendbaren Lernprojekten, Courses,
Learning Paths und kaufbaren Bundles sowie die Bestandsordnung stehen im
[Katalogvertrag fuer Lernangebote](learning-catalog-governance.md).

Das öffentliche Nachbauprojekt der ferngesteuerten Hühnerstalltür, seine
lokale Sicherheitsgrenze, die alternativen WLAN-/LoRa-Wege und das zugehörige
Smartphone-App-Lernprojekt sind unter
[Ferngesteuerte Hühnerstalltür und Smartphone-App-Lernprojekt](project-remote-chicken-coop-door.md)
beschrieben.

Die verbindliche Trennung des Plattform-Startpfads in kritischen Bootstrap,
routenbezogene Summary-Abschnitte, eigene Domaenenendpunkte und lazy geladene
Browsermodule steht im
[routenbezogenen Laden der Plattform](platform-route-loading.md).

Die akzeptierte Portabilitaetsgrenze fuer eine spaetere eigenstaendige
School-Deployment-Zelle sowie die Regel fuer standardmaessig deaktivierte
externe KI und ausschliesslich lokal verwaltetes BYOK steht in
[School-Deploymentgrenze und KI-Provider](school-deployment-architecture.md).

Die eigenstaendige GerNetiX-Basissoftware, ihr versionierter Projektvertrag und
die Modulgrenzen von Nexi sind in der
[Nexi-Firmwarearchitektur](nexi-firmware-architecture.md) festgelegt.
Die wiederholbare, jeweils auf einen vollstaendigen Funktionsdurchstich
begrenzte Umsetzung wird in der
[Nexi Bottom-up-Test-Roadmap](nexi-bottom-up-test-roadmap.md) fortgeschrieben.

Das öffentliche [Virtuelle Elektroniklabor](virtual-electronics-lab.md)
grenzt anonyme, hardwarefreie Messsimulationen bewusst von Nachbauprojekten,
der angemeldeten Plattform und realer Hardwareansteuerung ab.

Das gemeinsame Elektroniklabor wird weiterhin in kontrollierten Durchstichen
ausgebaut. Sein
[Lastenheft-Entwurf](virtual-electronics-lab-requirements-draft.md), der
[Zielarchitektur-Entwurf](virtual-electronics-lab-target-architecture-draft.md)
und die
[Codex-Arbeitsanweisung](codex-virtual-electronics-lab-implementation-procedure.md)
halten den aktuellen Planungsstand fest. Kontrollierte Arbeitspakete grenzen
den [GPIO-LED-Durchstich](virtual-electronics-lab-gpio-led-vertical-slice-spec.md),
den [PWM-LED-Durchstich](virtual-electronics-lab-pwm-led-vertical-slice-spec.md),
die
[Oszilloskop-Anbindung](virtual-electronics-lab-pwm-oscilloscope-vertical-slice-spec.md),
das
[PT1000-Umweltmodell](virtual-electronics-lab-pt1000-environment-model-work-package.md)
und den
[linearen DC-Arbeitspunkt-Solver](virtual-electronics-lab-dc-operating-point-solver-work-package.md)
voneinander ab. Der jeweilige Dokumentstatus und der SQLite-Graph bestimmen,
ob ein Paket nur geplant oder bereits implementiert ist.
Die umgesetzte Fehlersuchkette von falscher Tasterverdrahtung über fehlenden
Pull-Widerstand und Tasterprellen bis zur quellcodegesteuerten Entprellung und
der optionalen, creditgebundenen KI-Hilfe ist in
der [Fehlersuch-Roadmap](virtual-electronics-lab-fault-search-roadmap.md)
zusammengefasst.
Die serverseitige Grenze der KI-Hilfe ist im
[FS-012-Arbeitspaket](virtual-electronics-lab-live-ai-work-package.md)
festgelegt: Simulation und manuelle Fehlersuche bleiben statisch, während nur
der bestätigungspflichtige Assistent den Identity Server, AI Usage und OpenAI
Responses verwendet.

Die betriebliche Sicht auf fehlgeschlagene oder haengende Schaltflaechen und
Nutzerablaeufe, einschliesslich lokaler Datenschutzgrenze, Ereignismodell,
Dashboard und Alarmierung, beschreibt das
[Operations-Konzept fuer fehlgeschlagene Nutzeraktionen](user-action-operations-observability.md).
Der jeweils tatsaechlich umgesetzte und nachgewiesene Stand aller
Betriebsbausteine steht in der zentralen
[GerNetiX-Operations-Dokumentation](operations.md).
