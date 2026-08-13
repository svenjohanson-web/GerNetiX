// Wissensspeicher: Ingenieursmäßiges Denken und Arbeitsmethodiken.
const KnowledgeArticlesEngineering = { // Server-side authored content.
    "from-problem-to-system": {
      title: "Ingenieursmäßig denken: vom Problem zur Lösung",
      summary: "Ingenieursmäßiges Denken ist heute wichtiger denn je. Ein Studium kann wichtige Grundlagen vermitteln, doch entscheidend ist nicht der Abschluss allein: Ebenso wichtig sind praktische Erfahrung, Aufgeschlossenheit gegenüber neuen Technologien wie KI und die Fähigkeit, Anforderungen zu verstehen und Ergebnisse zu überprüfen.",
      sections: [
        {
          id: "engineering-thinking-problem",
          heading: "Nicht Technologie, sondern Problem",
          paragraphs: [
            "Gerade im Umgang mit KI wird diese Haltung besonders wirksam. Wer Anforderungen präzisiert, Zwischenergebnisse versteht, Annahmen prüft und passende Tests ableitet, kann mit einer KI sehr effektiv arbeiten. Dazu gehört auch zu lernen, wie eine KI eine Anforderung bestmöglich begreift – und zugleich zu wissen, wo die physikalischen, sicherheitstechnischen, normativen und systemischen Grenzen liegen, die eine plausibel klingende Antwort nicht außer Kraft setzen kann.",
            "Ein Ingenieur beginnt selten mit der Frage: Welche Technologie möchte ich einsetzen? Am Anfang steht eine Aufgabe. Ein Unternehmen will Kosten senken, ein Team will einen Fehler vermeiden, ein Mensch will ein Gerät einfacher bedienen oder ein eigenes Projekt umsetzen.",
            "Technik ist dabei ein Mittel, nicht das Ziel. Auch bei KI gilt das: Ein Versprechen wie 'mehr Effizienz durch KI' ist noch keine Lösung. Erst wenn klar ist, welcher Ablauf heute zu langsam, fehlerhaft oder teuer ist, kann man beurteilen, ob KI, eine Automatisierung oder vielleicht nur eine bessere Struktur wirklich hilft.",
            "Ingenieursmäßig denken bedeutet deshalb: Ziel, Rahmenbedingungen, Risiken und Erfolgskriterien zuerst sichtbar machen. Danach wird die kleinste Lösung gesucht, die das Problem zuverlässig löst.",
          ],
        },
        {
          id: "engineering-thinking-knowledge",
          heading: "Wissen, Analyse und KI",
          paragraphs: [
            "Ein technisches Studium ist nicht für jeden der passende Weg. Es verlangt Ausdauer für Mathematik, Modelle, unvollständige Informationen, Fehleranalyse und Verantwortung. Das bedeutet nicht, dass Menschen ohne Studium kein technisches Verständnis haben oder keine anspruchsvollen Projekte bauen können.",
            "Lange war tiefes technisches Wissen vor allem dort gut erreichbar, wo Zeit, Ausbildung oder ein erfahrener Mentor vorhanden waren. Ich möchte dieses Wissen weitergeben, ohne so zu tun, als könne eine einzelne Person jede Frage für alle beantworten.",
            "KI verändert den Zugang: Sie kann Begriffe erklären, Beispiele erzeugen, Code lesen und beim Nachdenken helfen. Sie hat aber keine eigenen Wünsche, kein eigenes Ziel und keine Verantwortung für die Folgen. Die Problemstellung, die Bewertung von Risiken und die Entscheidung, wann ein Ergebnis gut genug ist, bleiben beim Menschen. Genau deshalb passt KI gut zum ingenieursmäßigen Arbeiten: als Werkzeug für einen Menschen, der bewusst entscheidet.",
          ],
        },
        {
          id: "engineering-thinking-learning",
          heading: "Viele Wege ins Lernen",
          paragraphs: [
            "Meine Problemstellung für GerNetiX lautet: Wie kann ich Wissen und Fähigkeiten zu verteilten Systemen so vermitteln, dass Menschen wirklich eigene Projekte umsetzen können? Schon hier gibt es keine Einheitslösung. Manche lesen gern, andere verstehen durch Ausprobieren, wieder andere brauchen Rückfragen oder einen Mentor.",
            "Darum ist GerNetiX kein einzelnes Mammutprojekt und kein Kurs, den alle gleich durchlaufen müssen. Der Lernprojektkatalog bietet kleine Projekte mit unterschiedlichen Schwerpunkten. Du kannst lesen, experimentieren, eine Vorlage verändern oder dir gezielt Unterstützung holen.",
            "Ein gutes Lernprojekt soll Spaß machen, klein beginnen dürfen und keine große Anfangsinvestition verlangen. Gleichzeitig darf es wachsen, wenn du mehr lernen willst.",
          ],
        },
        {
          id: "engineering-thinking-tamagotchi",
          heading: "Die Tamagotchi-Lernreise: ein Projekt wächst mit dir",
          tamagotchiIllustration: true,
          aiIllustrationAfterParagraph: 4,
          paragraphs: [
            "Ein Tamagotchi ist ein gutes Beispiel, weil es klein anfangen kann und jede Erweiterung eine neue, nachvollziehbare Frage aufwirft. Zuerst lebt es als kleine Browser-App. Ein Zustandsautomat entscheidet etwa: satt, hungrig oder Warnung. Das ist bereits ein vollwertiges erstes Projekt.",
            "Soll das Tamagotchi seinen Zustand behalten, wenn die App geschlossen wird? Dann brauchst du dauerhaften Speicher und lernst, warum Daten modelliert und gespeichert werden. Soll es weiterleben, obwohl keine App geöffnet ist? Dann kommt ein Hintergrundprozess dazu. Soll es in deine Tasche? Dann brauchst du ein IoT-Gerät mit Anzeige, Eingaben, eventuell Ton und einer passenden Stromversorgung.",
            "Möchtest du dasselbe Tamagotchi auf Handy, Computer und Gerät sehen, entsteht die nächste Frage: Wie werden Zustände synchronisiert? Ein kleiner Server kann zuerst auf einem ESP-Board laufen. Soll er von mehreren Orten erreichbar sein, wird daraus ein Internet-Server. Wenn zwei Geräte gleichzeitig füttern, musst du Konflikte behandeln. Wenn Fremde es nicht füttern dürfen, brauchst du Identität und Berechtigungen.",
            "Bis hierhin ist dein Tamagotchi ein absolut vorhersehbares Modell. Es reagiert auf dieselben Ereignisse immer auf dieselbe Weise. Das nennt man deterministisch. Im Zeitalter der KI können wir den nächsten Schritt gehen: Das Tamagotchi darf überraschendere Bedürfnisse und Interaktionen entwickeln – und es kann zugleich zu einem kleinen persönlichen Assistenten werden.",
            "Dafür verbinden wir es mit KI. Hier trifft eine früher kaum umsetzbare Anforderung auf verfügbare Technik. Aber auch KI hat Grenzen: Sie beantwortet Fragen nicht von allein, sie braucht einen Auslöser. Außerdem kostet ein Online-Aufruf Geld und benötigt eine Internetverbindung. Die Ingenieursfrage lautet deshalb nicht nur: Können wir KI einsetzen? Sondern: Welches Modell erfüllt unsere Aufgabe mit vertretbarem Aufwand?",
            "Wir könnten die Online-KI jede Stunde fragen, ob das Tamagotchi mit uns interagieren möchte. Das wäre möglich, aber teuer und unnötig abhängig vom Internet. Wir könnten auch ein lokales KI-Modell einsetzen. Je nach Komplexität reicht dafür ein normaler PC, oder es wird spezielle Embedded-Hardware benötigt, etwa ein aktueller Raspberry Pi. Eine dritte Möglichkeit ist, die KI einmalig ein Verhaltensmodell entwickeln zu lassen. Dieses Modell läuft danach lokal und deterministisch. Wenn wir seine Regeln nicht im Detail analysieren, bleibt sein Verhalten für uns trotzdem überraschend.",
            "Für dieses Lernprojekt entscheide ich mich aus Kosten- und Verfügbarkeitsgründen für diese dritte Variante: Wir lassen eine KI einmalig ein Verhaltensmodell erstellen und beobachten anschließend, was daraus entsteht. So wird deutlich: KI ist nicht gleich KI. Je nachdem, was wir erreichen wollen, wählen wir Online-KI, lokale KI oder ein von KI erzeugtes Regelmodell – bewusst statt nur, weil die Technik gerade möglich ist.",
            "So lernst du nicht abstrakt 'alles über IT'. Du hast bei jedem Schritt einen Grund für Zustandsautomaten, Apps, Embedded-Hardware, Kommunikation, Datenspeicherung, Server, Synchronisierung, Sicherheit und nun auch für eine begründete KI-Architekturentscheidung.",
          ],
        },
        {
          id: "engineering-thinking-craft",
          heading: "Planung, Ausführung und Nachweis",
          paragraphs: [
            "Ingenieurmäßiges Denken endet nicht bei der Frage, ob eine Lösung grundsätzlich funktioniert. Es prüft, ob sie für die konkrete Aufgabe geeignet, sicher, wirtschaftlich und mit den geltenden Regeln und Normen vereinbar ist. Ebenso wichtig ist der nachvollziehbare Nachweis, dass die geplante Lösung korrekt umgesetzt wurde.",
            "Daraus entstehen gelegentlich Missverständnisse zwischen Ingenieuren und Handwerkern: Das Handwerk konzentriert sich häufig auf die fachgerechte praktische Ausführung, während die ingenieurmäßige Aufgabe Anforderungen klärt, Lösungswege bewertet, Risiken beherrscht und Ergebnisse überprüfbar macht. Das ist jedoch keine starre Trennung. Ingenieure bauen Prototypen, messen, testen und arbeiten praktisch; Handwerker lösen technische Probleme, beurteilen Randbedingungen und bringen wertvolles Erfahrungswissen in die Planung ein. Beides gehört zusammen.",
            "Ein Studium vermittelt dafür wichtige Grundlagen, Modelle und mathematische Werkzeuge. Viele Übungsaufgaben sind bewusst klar abgegrenzt: Die benötigten Größen sind bekannt, eine passende Formel kann angewendet werden und mit dem Ergebnis ist die Aufgabe abgeschlossen. Im Berufsleben ist die Problemstellung dagegen oft noch unvollständig. Materialien verhalten sich nicht ideal, Anforderungen widersprechen sich, Bauteile haben Toleranzen und eine rechnerisch richtige Lösung muss sich erst in der Praxis bewähren.",
            "Dieses praktische Wissen entsteht nicht allein am Schreibtisch. Basteln bedeutet in diesem Zusammenhang nicht, planlos irgendetwas zusammenzubauen. Es bedeutet, eine Idee greifbar zu machen, Bauteile und Software wirklich zu verstehen, einen eigenen Entwurf auszuprobieren, Fehler zu beobachten und die Lösung zu verbessern. So wird aus theoretischem Wissen belastbare Erfahrung: verstehen, entwickeln, erschaffen.",
          ],
        },
        {
          id: "engineering-thinking-industry",
          heading: "Was das mit Industrie zu tun hat",
          paragraphs: [
            "Auch in der Industrie wird meist nicht die Welt neu erfunden. Vorhandene Technologien werden so kombiniert, dass ein Ziel mit vertretbarem Risiko, nachvollziehbaren Kosten und passendem Aufwand erreicht wird. Forschung ist wichtig, aber sie ist nicht jede Aufgabe.",
            "Die beste technische Lösung ist nicht die größte oder modernste. Warum sollte jedes Auto einen KI-Supercomputer erhalten, wenn ein kleiner Mikrocontroller die Aufgabe sicherer, sparsamer und zuverlässiger erledigt? Die richtige Frage lautet: Welche Fähigkeit wird wirklich gebraucht, und welche Technik erfüllt sie mit möglichst wenig unnötiger Komplexität?",
            "Genau diese Denkweise übst du in GerNetiX. Du lernst Technologien nicht als Sammlung von Schlagwörtern kennen, sondern weil dein Projekt sie an einer bestimmten Stelle wirklich braucht.",
          ],
        },
        {
          id: "engineering-thinking-foundations",
          heading: "Welche Grundlagen verteilte Systeme brauchen",
          paragraphs: [
            "Ingenieursmäßiges Denken sagt noch nicht, wie ein Sensor misst, ein Widerstand eine Spannung begrenzt oder ein Mikrocontroller ein Programm ausführt. Um ein verteiltes System wirklich zu begreifen, brauchen wir deshalb Grundlagen aus zwei Welten: Elektrotechnik und Informatik.",
            "Die Elektrotechnik erklärt, was Hardware physikalisch kann und welche Grenzen sie hat. Ein Widerstand, Kondensator, Transistor oder fest verdrahtetes Logikgatter folgt Material, Schaltung und elektrischen Gesetzen. Diese Bauteile werden nicht durch Software neu beschrieben.",
            "Die Informatik erklärt, wie Software Regeln, Daten und Abläufe beschreibt. Ein Mikrocontroller ist Hardware mit einem Prozessor; auf ihm läuft Firmware – also Software, die die vorhandene Hardware innerhalb ihrer physikalischen Grenzen steuert. Sie entscheidet zum Beispiel, wann ein Sensor gelesen, ein Signal ausgewertet oder ein Ausgang geschaltet wird.",
            "Erst danach kommt das Zusammenspiel: Wenn Geräte, ihre Firmware, Netzwerke, Server und Anwendungen Informationen austauschen, entsteht ein verteiltes System. Die folgenden Kapitel bauen genau in dieser Reihenfolge auf: zuerst Elektrotechnik, dann Mikrocontroller und Embedded, danach Informatik und Software – und schließlich verteilte Systeme.",
            "Du musst dafür nicht von Anfang an alles können. Je nach Problemstellung braucht ein Projekt mehr Elektrotechnik, mehr Informatik oder nur ein grundlegendes Verständnis von einem Bereich. Manche Menschen starten lieber mit Schaltungen und Messungen, andere mit Programmierung, Daten oder Bedienoberflächen. Konzentriere dich zunächst auf deine Stärken und die nächste sinnvolle Aufgabe. Wenn dich der Ehrgeiz packt, kannst du dich Schritt für Schritt in das andere Fachgebiet einarbeiten – genau dafür ist dieses Wissensportal da.",
          ],
        },
      ],
      relatedTopics: [
        "development-processes-overview",
        "software-basics",
        "microcontroller-basics",
        "server-systems",
      ],
      access: "public",
    },
    "development-processes-overview": {
      title: "Entwicklungsprozesse: vom Plan zur Rückkopplung",
      summary: "Entwicklungsprozesse verbinden Anforderungen, Entwurf, Umsetzung, Prüfung und Betrieb. Ingenieurmäßiges Denken wählt das Vorgehen nach Klarheit, Risiko, Änderungsdynamik und notwendigem Nachweis.",
      sections: [
        {
          id: "development-processes-dimensions",
          heading: "Die Prozessdimensionen einer Entwicklungsaufgabe",
          paragraphs: [
            "Ein Entwicklungsprozess ist kein Selbstzweck und keine starre Schablone. Er macht ingenieurmäßiges Denken wiederholbar: Das Problem wird geklärt, Entscheidungen werden begründet, Risiken werden früh sichtbar und Ergebnisse werden gegen die Anforderungen geprüft.",
            "Für die Auswahl des Vorgehens sind mehrere Dimensionen wichtig: Wie klar und stabil sind die Anforderungen? Wie hoch sind Sicherheits-, Qualitäts- und Kostenrisiken? Wie schnell und günstig kann Rückmeldung eingeholt werden? Wie teuer sind späte Änderungen? Wie viel Nachvollziehbarkeit oder formaler Nachweis ist erforderlich? Und wie viele Menschen, Fachgebiete und Systemteile müssen koordiniert werden?",
            "Diese Dimensionen führen selten alle zum gleichen Modell. Ein Projekt kann beispielsweise eine agile Bedienoberfläche mit kurzen Nutzerzyklen entwickeln, während die sicherheitsrelevante Gerätesteuerung nach einem stärker dokumentierten V-Modell abgesichert wird. Ein bewusst begründetes hybrides Vorgehen ist deshalb oft sinnvoller als ein Methodenetikett für das gesamte Projekt.",
          ],
        },
        {
          id: "engineering-thinking-models",
          heading: "Vorgehensmodelle: Struktur für unterschiedliche Aufgaben",
          paragraphs: [
            "Wasserfallmodell, V-Modell und agiles Arbeiten sind keine konkurrierenden Glaubensrichtungen. Sie unterstützen je nach Umfang, Risiko und Problemstellung unterschiedlich: Wie klar ist die Aufgabe schon? Wie teuer wäre ein Fehler? Wie schnell kann sich das Ziel noch verändern?",
          ],
          developmentPhases: true,
          phaseDescriptions: [
            {
              title: "Anforderungen klären:",
              description: "Das Problem, die Ziele, Rahmenbedingungen und Erfolgskriterien werden verständlich beschrieben. Es wird festgelegt, was die Lösung leisten muss – und was ausdrücklich nicht dazugehört.",
            },
            {
              title: "Entwurf erstellen:",
              description: "Es wird entschieden, wie die Lösung grundsätzlich aufgebaut sein soll: Komponenten, Daten, Schnittstellen, Bedienung und technische Risiken werden geplant.",
            },
            {
              title: "Umsetzung realisieren:",
              description: "Der Entwurf wird in funktionierende Hardware, Software, Konfiguration oder Dokumentation überführt. Dabei entsteht etwas, das tatsächlich ausprobiert werden kann.",
            },
            {
              title: "Testen und bewerten:",
              description: "Es wird gezielt geprüft, ob die Lösung die Anforderungen erfüllt. Fehler, Abweichungen und offene Risiken werden sichtbar gemacht und nachvollziehbar bearbeitet.",
            },
            {
              title: "Betrieb und Weiterentwicklung:",
              description: "Die Lösung wird genutzt, überwacht, gewartet und bei Bedarf verbessert. Rückmeldungen aus der Praxis können neue oder veränderte Anforderungen erzeugen.",
            },
          ],
          followUpParagraphs: [
            "Die Phasen werden je nach Vorgehensmodell unterschiedlich verbunden. Man springt nicht beliebig mittendrin zu einem anderen Abschnitt. Wenn neue Erkenntnisse eine Änderung verlangen, wird bewusst zu der Phase zurückgegangen, deren Ergebnis überarbeitet werden muss – mit klarer Begründung und erneutem Durchlaufen der betroffenen Schritte.",
            "Das Wasserfallmodell passt, wenn das Problem sehr genau bekannt ist und sich Anforderungen kaum ändern. Eine große Idee wird schrittweise konkret beschrieben, realisiert und am Ende getestet. Sein Schwerpunkt liegt auf Planbarkeit: Man weiß früh, was wann entstehen soll. Genau das ist aber auch sein Nachteil. Stellt ein später Test fest, dass die Umsetzung oder schon der Entwurf falsch war, muss das starre Modell durch Rücksprünge und Ausnahmeregeln ergänzt werden. Deshalb wird es heute vor allem noch in klar abgegrenzten Bereichen eingesetzt.",
            "Das V-Modell eignet sich besonders für sicherheitsrelevante oder sehr qualitätskritische Systeme. Zu jeder Entwicklungsstufe auf der linken Seite gehört eine passende Prüfstufe auf der rechten Seite: Der Software-Entwurf wird mit Unit-Tests geprüft, der System-Entwurf mit Integrationstests und die Systemanforderung mit Systemtest und Abnahme. Findet ein Test einen Fehler, führt die Rückmeldung gezielt zu der zugehörigen Anforderung oder Entwurfsstufe zurück. So bleibt nachvollziehbar, was geprüft wurde, warum etwas geändert wird und welche Tests danach erneut nötig sind.",
            "Agiles Arbeiten ist sinnvoll, wenn das Ziel noch nicht vollständig klar ist oder sich durch Rückmeldung verändern kann. Statt einen sehr großen Plan einmal komplett umzusetzen, wird in kurzen Zyklen gearbeitet: ein kleines Ziel klären, entwerfen, bauen, prüfen, mit Nutzern bewerten und aus den Erkenntnissen den nächsten Schritt ableiten. Auch hier werden die Entwicklungsphasen nicht ausgelassen; sie werden nur in kleinen, wiederholbaren Abschnitten durchlaufen. Das schafft frühes Feedback und senkt das Risiko, lange an einer Lösung zu arbeiten, die am Ende niemand braucht.",
            "Kein Modell ersetzt Denken. Für ein kleines Lernprojekt kann ein kurzer agiler Zyklus reichen. Für ein fest definiertes Gerät hilft eine wasserfallartige Planung. Für Systeme, bei denen Fehler Menschen gefährden oder hohe Schäden verursachen können, braucht es die nachweisbare Absicherung des V-Modells. Gute Ingenieursarbeit wählt den Prozess, der das Risiko der jeweiligen Aufgabe sinnvoll beherrscht.",
          ],
          waterfallModelAfterFollowUp: 0,
          vModelAfterFollowUp: 1,
          agileModelAfterFollowUp: 2,
          engineeringModels: true,
        },
        {
          id: "development-processes-next-steps",
          heading: "Mit Beispielen weiterlernen",
          paragraphs: [
            "Du hast noch nicht alles verstanden? Kein Problem. Vorgehensmodelle, Tests und Rückkopplungen lernt man nicht durch einen kurzen Text. Sie werden greifbar, wenn du sie in einem konkreten Projekt anwendest, Entscheidungen triffst und die Folgen davon siehst.",
            "Deshalb wird es für jedes Modell ein Lernprojekt mit einer nachvollziehbaren Problemstellung geben. Die folgenden Einträge sind zunächst Platzhalter für diese Beispiele.",
          ],
          learningProjects: [
            {
              model: "Wasserfallmodell",
              title: "Wetterstation mit festem Auftrag",
              description: "Eine klar beschriebene Aufgabe von der Anforderung bis zum Test planen.",
              href: "/app/learn/?project=waterfall-wetterstation",
            },
            {
              model: "V-Modell",
              title: "Zutrittsanzeige mit Prüfnachweisen",
              description: "Anforderungen, Entwurf und passende Tests gezielt miteinander verbinden.",
              href: "/app/learn/?project=v-modell-zutrittsanzeige",
            },
            {
              model: "Agil",
              title: "Tamagotchi in kleinen Zyklen",
              description: "Eine Idee schrittweise bauen, erproben und aus Rückmeldungen weiterentwickeln.",
              href: "/app/learn/?project=agil-tamagotchi",
            },
          ],
        },
      ],
      relatedTopics: [
        "from-problem-to-system",
        "software-basics",
        "embedded-safety",
      ],
      access: "public",
    },
    "version-control-and-variants": {
      title: "Versionierung und Variantenmanagement: von Ordnerkopien zu Git",
      summary: "Versionierung bewahrt nachvollziehbare Zustände. Variantenmanagement ordnet parallele Ausprägungen eines Produkts. Das Kapitel zeigt den Weg von manuellen Dateikopien über CVS und Subversion zu Git, erklärt Speicherprinzipien und vergleicht geeignete Backup-Strategien.",
      sections: [
        {
          id: "versioning-file-copies",
          heading: "Die Festplatte als einfachstes Versionssystem",
          paragraphs: [
            "Am Anfang steht oft kein Werkzeug, sondern ein Ordner: projekt, projekt_neu, projekt_final und projekt_final_wirklich. Jede Kopie ist ein vollständiger Stand. Das ist leicht zu verstehen, funktioniert ohne Server und lässt sich mit jedem Dateimanager öffnen. Für eine einzelne Person und wenige Stände kann das vollkommen ausreichend sein.",
            "Der große Vorteil liegt in der Unabhängigkeit: Alle Dateien liegen direkt auf der eigenen Platte, es gibt kein Konto, keinen Netzwerkdienst und kein besonderes Wiederherstellungsprogramm. Ein kompletter Ordner kann auf eine zweite Festplatte kopiert und dort sofort gelesen werden. Für große Binärdateien oder abgeschlossene Meilensteine ist ein bewusst benannter Vollstand weiterhin nützlich.",
            "Die Grenzen entstehen mit der Zeit. Dateinamen erklären nicht zuverlässig, wer was warum geändert hat. Zwei Personen überschreiben einander, gleiche Dateien werden mehrfach gespeichert und es ist schwer festzustellen, welche Kopie wirklich freigegeben ist. Eine defekte oder verlorene Festplatte zerstört außerdem Original und Historie zugleich, wenn keine unabhängige Sicherung existiert.",
          ],
          illustration: {
            src: "/assets/versioning-file-copies.svg",
            alt: "Mehrere vollständig kopierte Projektordner auf einer einzelnen Festplatte",
            caption: "Ordnerkopien sind anschaulich und unabhängig, aber Benennung, Speicherverbrauch und Zusammenarbeit werden schnell unübersichtlich.",
          },
        },
        {
          id: "versioning-history",
          heading: "Der historische Weg: CVS, Subversion und Git",
          paragraphs: [
            "Professionelle Versionssysteme ergänzen den Inhalt um Identität, Zeitpunkt, Begründung und Beziehungen zwischen Ständen. Die folgende Bildserie zeigt, wie sich dabei nicht nur die Bedienung, sondern auch das zugrunde liegende Modell verändert hat.",
          ],
          illustrationSeries: [
            {
              src: "/assets/versioning-stage-1-local.svg",
              alt: "Lokale Projektstände als einzeln benannte Ordner",
              caption: "Lokale Kopien: Jeder Stand ist ein eigener Ordner. Einfach, aber ohne gemeinsame Historie.",
            },
            {
              src: "/assets/versioning-stage-2-cvs.svg",
              alt: "CVS mit zentralem Repository und dateibezogenen Revisionen",
              caption: "CVS: Ein zentrales Repository verwaltet Revisionen einzelner Dateien und überträgt Änderungen zwischen Clients und Server.",
            },
            {
              src: "/assets/versioning-stage-3-svn.svg",
              alt: "Subversion mit atomaren Commits und repositoryweiten Revisionen",
              caption: "Subversion: Zusammengehörige Dateiänderungen werden atomar als eine Repository-Revision gespeichert; Branches und Tags sind günstige Kopien.",
            },
            {
              src: "/assets/versioning-stage-4-git.svg",
              alt: "Git mit verteilten vollständigen Repositories und verbundenen Commits",
              caption: "Git: Jeder Clone besitzt Historie und Objektbestand. Commits verweisen auf vollständige logische Snapshots und ihre Eltern.",
            },
          ],
          illustrationSeriesWide: true,
          table: {
            headers: ["Ansatz", "Stärken", "Grenzen"],
            rows: [
              ["Ordnerkopien", "Ohne Werkzeug lesbar, offline, sehr einfach", "Keine verlässliche Historie, hoher Speicherbedarf, kaum Zusammenarbeit"],
              ["CVS", "Zentrale gemeinsame Historie, bewährtes Delta-Modell", "Revisionen pro Datei, keine atomaren Mehrdatei-Commits, schwache Umbenennungen"],
              ["Subversion", "Atomare Commits, zentrale Revisionen, gute Rechteverwaltung", "Zentraler Server ist für viele Aktionen notwendig, Branch-Merges historisch schwerer"],
              ["Git", "Verteilt, offline arbeitsfähig, schnelle Branches und Merges", "Lernkurve, große Binärdateien und Geheimnisse erfordern besondere Regeln"],
            ],
          },
        },
        {
          id: "versioning-storage-models",
          heading: "Wie die Systeme Änderungen tatsächlich speichern",
          paragraphs: [
            "CVS basiert historisch auf RCS-Dateien. Die Historie wird im zentralen Repository dateiweise geführt; Revisionen und Deltas rekonstruieren ältere Inhalte. Weil jede Datei ihre eigene Revisionsfolge besitzt, ist ein fachlich zusammengehöriger Stand über mehrere Dateien nicht so eindeutig wie bei späteren Systemen.",
            "Subversion vergibt eine fortlaufende Revisionsnummer für das gesamte Repository. Ein Commit ist atomar: Entweder werden alle zugehörigen Änderungen übernommen oder keine. Implementierungen wie FSFS speichern Repräsentationen und Deltas; Branches und Tags entstehen als günstige Kopien innerhalb des Repository-Namensraums statt als sofortige vollständige Dateiduplikate.",
            "Git speichert inhaltadressierte Objekte. Ein Blob enthält Dateiinhalt, ein Tree beschreibt Verzeichnisse, und ein Commit verweist auf einen Tree, seine Eltern und Metadaten. Fachlich wirkt jeder Commit wie ein vollständiger Snapshot. Physisch werden gleiche Inhalte nur einmal gespeichert; Packfiles können Objekte zusätzlich komprimieren und als Deltas ablegen. Ein Branch ist im Kern nur ein beweglicher Verweis auf einen Commit.",
            "Inkrementell bedeutet deshalb nicht immer dasselbe. Ein Backup kann nur die seit der letzten Sicherung geänderten Blöcke übertragen. Ein Versionssystem kann Deltas speichern oder identische Inhalte deduplizieren. Für den Nutzer bleibt trotzdem ein vollständiger, benannter Zustand rekonstruierbar.",
          ],
          expertKnowledge: "Git erkennt Dateien nicht dauerhaft anhand eines eingebauten Dateinamens. Umbenennungen werden bei Vergleichen aus der Ähnlichkeit von Inhalten abgeleitet. Der Commit speichert den neuen Tree-Zustand, nicht einen besonderen Umbenennungsbefehl.",
          illustration: {
            src: "/assets/versioning-git-objects.svg",
            alt: "Git-Objektmodell aus Commit, Tree und wiederverwendeten Blobs",
            caption: "Git präsentiert Snapshots, vermeidet aber unnötige Duplikate durch inhaltadressierte Objekte und spätere Packfile-Kompression.",
          },
        },
        {
          id: "versioning-variants",
          heading: "Variantenmanagement ist mehr als ein Branch",
          paragraphs: [
            "Eine Version beantwortet die Frage: Welcher Zustand galt zu einem bestimmten Zeitpunkt? Eine Variante beantwortet: Welche gültige Ausprägung wird für ein Produkt, eine Hardware, einen Kunden oder eine Region benötigt? Beides hängt zusammen, ist aber nicht identisch.",
            "Branches eignen sich für zeitlich begrenzte parallele Arbeit, Releases und notwendige Wartungslinien. Dauerhaft jede Produktoption in einem eigenen Branch zu pflegen führt dagegen zu vielen schwer zusammenführbaren Kopien. Gemeinsame Bestandteile sollten möglichst in einer Hauptlinie bleiben; Unterschiede werden über klar versionierte Konfigurationen, Features, Hardwareprofile oder Module beschrieben.",
            "Zu einer reproduzierbaren Variante gehören deshalb nicht nur Quelltexte. Auch Abhängigkeiten, Werkzeugversionen, Build-Konfiguration, Hardwarestand, Feature-Auswahl, Datenbankschema und Freigabestatus müssen zu einer Baseline gehören. Ein Tag kann eine solche Baseline benennen, ersetzt aber nicht die dokumentierte Variantenlogik.",
          ],
          illustration: {
            src: "/assets/versioning-variants.svg",
            alt: "Gemeinsame Hauptlinie mit kurzlebigen Feature-Branches und konfigurierten Produktvarianten",
            caption: "Kurzlebige Branches organisieren Änderungen. Produktvarianten entstehen bevorzugt aus einer gemeinsamen Basis plus versionierter Konfiguration.",
          },
          list: [
            "Hauptlinie möglichst jederzeit integrierbar und testbar halten.",
            "Feature-Branches kurz halten und häufig mit der Hauptlinie abgleichen.",
            "Freigegebene Stände mit unveränderlichen Tags und nachvollziehbaren Build-Artefakten verbinden.",
            "Kunden- und Hardwarevarianten über Daten und Konfiguration modellieren, sofern sie keine wirklich getrennte Produktlinie sind.",
            "Für jede unterstützte Variante automatisiert bauen und die relevanten Tests ausführen.",
          ],
        },
        {
          id: "versioning-backup",
          heading: "Versionsverwaltung ersetzt kein Backup",
          paragraphs: [
            "Ein Versionssystem schützt vor vielen Bedienfehlern, ist aber allein noch keine Datensicherung. Ein versehentliches Löschen kann synchronisiert werden, Zugangsdaten können kompromittiert sein, ein Server kann beschädigt werden und nicht eingecheckte Dateien oder externe Build-Artefakte fehlen möglicherweise vollständig.",
            "Bei CVS und Subversion muss das zentrale Repository konsistent gesichert werden. Geeignet sind die vorgesehenen Hotcopy-, Dump- oder Snapshot-Verfahren des Systems; eine beliebige Dateikopie während laufender Schreibzugriffe kann unvollständig sein. Zusätzlich müssen Konfiguration, Benutzer- und Rechteinformationen dokumentiert oder gesichert werden.",
            "Bei Git besitzt zwar jeder vollständige Clone viele Repository-Daten, aber nicht zwingend alle Serverinformationen, Pull Requests, Tickets, geschützten Einstellungen, LFS-Objekte oder gelöschten Remote-Refs. Ein unabhängiger Bare-Clone oder Mirror plus Sicherung ergänzender Plattformdaten ist deshalb sinnvoll. Entscheidend ist, eine Wiederherstellung regelmäßig zu testen.",
            "Eine robuste Orientierung ist die 3-2-1-Regel: mindestens drei Kopien, auf zwei unterschiedlichen Medientypen, davon eine Kopie räumlich oder logisch getrennt. Eine unveränderliche oder offline gehaltene Sicherung schützt zusätzlich vor Ransomware und versehentlicher Synchronisation von Löschungen.",
          ],
          illustration: {
            src: "/assets/versioning-backup.svg",
            alt: "Drei Sicherungsebenen aus Arbeitskopie, Versionsserver und getrennter unveränderlicher Sicherung",
            caption: "Arbeitskopie, Versionssystem und unabhängiges Backup erfüllen unterschiedliche Aufgaben. Erst der geprüfte Restore belegt die Sicherung.",
          },
        },
        {
          id: "versioning-practical-choice",
          heading: "Welcher Ansatz passt zu welcher Aufgabe?",
          paragraphs: [
            "Für eine einzelne, kleine Aufgabe kann ein sauber benannter Vollstand auf einer zweiten Platte genügen. Sobald Änderungen verglichen, mehrere Dateien gemeinsam freigegeben, Varianten gepflegt oder Menschen koordiniert werden müssen, ist ein echtes Versionssystem die verlässlichere Grundlage.",
            "Subversion bleibt sinnvoll, wenn eine streng zentrale Arbeitsweise, pfadbasierte Rechte und große zusammenhängende Bestände wichtiger sind als verteiltes Arbeiten. Git ist heute für Quellcode und viele textbasierte Engineering-Artefakte meist die flexibelste Wahl. Große Binärdateien benötigen ergänzende Lösungen wie Git LFS, Artefaktspeicher oder bewusst versionierte Release-Pakete.",
            "Die beste Lösung ist nicht die mit den meisten Funktionen, sondern diejenige, deren Historie, Varianten und Sicherungen das Team tatsächlich versteht und regelmäßig wiederherstellen kann.",
          ],
          quizzes: [
            {
              id: "versioning-backup-case",
              title: "Repository und Backup unterscheiden",
              situation: "Ein Team nutzt GitHub. Alle Arbeitsplätze klonen das Repository, aber Build-Artefakte, Tickets und LFS-Dateien werden nirgends zusätzlich gesichert.",
              question: "Ist damit bereits alles ausreichend gebackupt?",
              options: [
                { id: "yes", label: "Ja, jeder Clone ist automatisch eine vollständige Sicherung der gesamten Plattform." },
                { id: "no", label: "Nein, Repository-Clones decken nicht zwangsläufig Plattformdaten, LFS und externe Artefakte ab." },
              ],
              answer: "no",
              correctText: "Richtig. Git-Historie und Plattformbetrieb müssen getrennt betrachtet werden.",
              wrongText: "Nicht ganz. Ein Clone enthält viel Git-Historie, aber nicht automatisch alle ergänzenden Daten und Objekte.",
              explanation: "Ein Wiederanlaufplan benennt jede fachlich benötigte Datenquelle, ihre Sicherungsmethode, Aufbewahrung und einen getesteten Restore-Weg.",
            },
          ],
        },
      ],
      relatedTopics: [
        "development-processes-overview",
        "software-basics",
        "yaml-basics",
      ],
      access: "public",
    },
};
