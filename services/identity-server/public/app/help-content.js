// Plattformhilfe: Bedienung, Konto und konkrete GerNetiX-Abläufe.
const HelpContent = (() => {
  const topics = [
    {
      id: "start-and-access",
      title: "Start und Zugang",
      description: "Konto, Anmeldung, Wiederherstellung und die ersten Schritte verstehen.",
      access: "public",
      children: [
        {
          id: "registration-login-recovery",
          title: "Einloggen und Konto anlegen",
          articleId: "registration-login-recovery",
        },
        {
          id: "create-account",
          title: "Konto anlegen",
          articleId: "create-account",
        },
        {
          id: "quick-start",
          title: "So startest du",
          articleId: "quick-start",
        },
        {
          id: "account-types",
          title: "Kontotypen und Zugangsstufen",
          articleId: "account-types",
        },
        {
          id: "entitlements-and-tokens",
          title: "Premium, Entitlements und Token",
          articleId: "entitlements-and-tokens",
        },
        {
          id: "webshop-activation-codes",
          title: "Webshop, E-Mail und Aktivierungscodes",
          articleId: "webshop-activation-codes",
        },
        {
          id: "plan-comparison",
          title: "Basis, Basis Plus und Premium vergleichen",
          articleId: "plan-comparison",
        },
      ],
    },
    {
      id: "devices-and-projects",
      title: "Geräte und Projekte",
      description: "Boards einrichten und Projektfunktionen konfigurieren.",
      access: "account",
      children: [
        {
          id: "provision-new-board",
          title: "Neues Board in Betrieb nehmen",
          articleId: "provision-new-board",
        },
        {
          id: "board-definition",
          title: "Warum eine Board Definition?",
          articleId: "board-definition",
        },
        {
          id: "register-device",
          title: "Board registrieren",
          articleId: "register-device",
        },
        {
          id: "pair-device",
          title: "Board verbinden",
          articleId: "pair-device",
        },
        {
          id: "flash-device",
          title: "Geräte flashen",
          articleId: "flash-device",
        },
        {
          id: "usb-wifi-setup",
          title: "WLAN per USB einrichten",
          articleId: "usb-wifi-setup",
        },
        {
          id: "supported-devices",
          title: "Unterstützte Boards",
          articleId: "supported-devices",
        },
        {
          id: "device-not-detected",
          title: "Board wird nicht erkannt",
          articleId: "device-not-detected",
        },
        {
          id: "event-worker-rules",
          title: "Ereignis-Worker und Regelsprache",
          articleId: "event-worker-rules",
        },
        {
          id: "event-dispatcher",
          title: "Ereignis-Dispatcher",
          articleId: "event-dispatcher",
        },
      ],
    },
    {
      id: "premium-information",
      title: "Premium-Abo",
      description: "Geführte Projekte, vertiefende Anleitungen und Projektwissen.",
      access: "premium",
      children: [
        {
          id: "ai-premium",
          title: "KI-Unterstuetzung und Premium",
          articleId: "ai-premium",
        },
        {
          id: "first-project",
          title: "Erstes Projekt umsetzen",
          articleId: "first-project",
        },
        {
          id: "update-profiles",
          title: "Update- und Speicherprofile",
          articleId: "update-profiles",
        },
      ],
    },
  ];
  const articles = {
    "quick-start": {
      title: "So startest du",
      summary: "Starte mit einem Lernprojekt oder entwickle aus deiner eigenen Idee ein GerNetiX-Projekt.",
      sections: [
        {
          heading: "Dein erstes Projekt",
          list: [
            "Wähle für ein geführtes Projekt die Lernplattform oder für deine eigene Idee die Entwicklungsplattform.",
            "Erstelle ein Projekt aus einer Vorlage oder beginne mit einem leeren Projekt und beschreibe sein Ziel.",
            "Klär zuerst die Architektur, wähle passende Hardware und arbeite dann in der IDE weiter.",
            "Registriere und verbinde ein neues Board in der Geräteverwaltung, bevor du es baust und flashst.",
          ],
        },
        {
          heading: "Wie geht es weiter?",
          paragraphs: [
            "Lernlektionen führen dich Schritt für Schritt durch ein Projekt. Hilfeartikel bleiben kurz und durchsuchbar, wenn du etwas nachschlagen möchtest.",
          ],
        },
      ],
      actions: [
        {
          label: "Entwicklungsprojekt starten",
          route: "/app/development-platform/",
        },
        {
          label: "Lernprojekt starten",
          route: "/app/learn/",
        },
      ],
      relatedTopics: [
        "register-device",
        "pair-device",
      ],
    },
    "create-account": {
      title: "Konto anlegen",
      summary: "Lege ein GerNetiX-Konto an, um Projekte, Lernfortschritt und deine Geräte gemeinsam zu nutzen.",
      sections: [
        {
          heading: "Registrierung",
          paragraphs: [
            "Nutze das Formular zur Kontoerstellung und bestätige die erforderlichen Bedingungen. Nach dem Einloggen verbindet GerNetiX Projekte, Lernfortschritt und registrierte Geräte mit deinem Konto.",
          ],
        },
      ],
      relatedTopics: [
        "quick-start",
        "register-device",
      ],
    },
    "plan-comparison": {
      title: "Basis, Basis Plus und Premium im Vergleich",
      summary: "Diese Übersicht trennt Funktionen, die heute technisch freigeschaltet sind, von geplanten Angeboten.",
      sections: [
        {
          heading: "Was heute gilt",
          table: {
            headers: [
              "Funktion",
              "Basis (kostenlos)",
              "Basis Plus",
              "Premium",
            ],
            rows: [
              [
                "Eigene Projekte in der IDE bearbeiten",
                "Ja",
                "Geplant",
                "Ja",
              ],
              [
                "Per USB bauen und flashen",
                "Ja",
                "Geplant",
                "Ja",
              ],
              [
                "Geführte Lernprojekte",
                "Nein",
                "Geplant",
                "Ja",
              ],
              [
                "KI-Hilfe in Entwicklung, Code Explorer und Hilfe",
                "Nein",
                "Geplant",
                "Ja, innerhalb der verfügbaren Credits und Limits",
              ],
              [
                "Web Push für Projektbenachrichtigungen",
                "Nein",
                "Geplant",
                "Ja",
              ],
              [
                "Premium-Lerninhalte und verbundene Projekterweiterungen",
                "Nein",
                "Geplant",
                "Ja, sofern das jeweilige Projekt diese Freischaltung nutzt",
              ],
            ],
          },
        },
        {
          heading: "Basis Plus ist noch nicht buchbar",
          paragraphs: [
            "Basis Plus ist derzeit kein technisch aktiver Plan. Es gibt noch kein eigenes serverseitiges Entitlement, keine separate Abrechnung und keine Funktion, die ausschließlich Basis Plus verlangt.",
            "Für Basis Plus sind zusätzliche, klar begrenzte Projektressourcen vorgesehen, zum Beispiel Background Worker, Dispatcher-Zugriff und höhere Ausführungsfrequenzen. Welche davon tatsächlich enthalten sind, wird erst mit der Einführung verbindlich angezeigt.",
          ],
        },
        {
          heading: "Was Premium heute konkret freischaltet",
          list: [
            "Geführte Lernprojekte.",
            "KI-Assistenten in der Entwicklungsplattform, im Code Explorer und im Hilfe-Bereich. KI-Aufrufe bleiben durch Credits, Größenlimits und serverseitige Prüfungen begrenzt.",
            "Web Push für Projekte, wenn ein Projekt diese Funktion verwendet und du die Browser-Erlaubnis erteilst.",
            "Premium-Inhalte und Erweiterungen, sobald das jeweilige Lernprojekt oder Angebot sie verlangt.",
          ],
        },
        {
          heading: "Wichtig",
          paragraphs: [
            "Ein ESP32-Recovery-Token erweitert die Wiederherstellung deines Kontos, ist aber kein Premium-Abo. Ebenso ist ein Kampagnen- oder Hardware-Bundle-Token nur dann Premium, wenn er ausdrücklich ein Premium-Entitlement aktiviert.",
          ],
        },
      ],
      relatedTopics: [
        "ai-premium",
        "entitlements-and-tokens",
        "account-types",
      ],
    },
    "account-types": {
      title: "Kontotypen und Zugangsstufen",
      summary: "GerNetiX trennt einen kurzlebigen Einstieg von einem dauerhaften Konto. Erweiterungen sind keine eigenen Konten, sondern klar benannte Berechtigungen.",
      sections: [
        {
          heading: "Das geplante Zielbild",
          paragraphs: [
            "Diese Regeln werden derzeit vorbereitet. Bis sie in der Plattform verfuegbar sind, zeigt GerNetiX bei einer Funktion immer die aktuell wirksame Freischaltung an.",
          ],
        },
        {
          heading: "Die Zugangsstufen",
          table: {
            headers: [
              "Begriff",
              "Zweck",
              "Regeln",
            ],
            rows: [
              [
                "Gastzugang",
                "Unverbindlich ausprobieren",
                "1 MB; endet nach 24 Stunden; keine Wiederherstellung.",
              ],
              [
                "Passkey-Konto",
                "Dauerhaft lernen und eigene Projekte speichern",
                "Passkey ist Pflicht; persoenliches Offline-Recovery-Set, Social Recovery und ESP32-Recovery-Token sind freiwillige Zusatzwege. Derzeit als Zielwert 5 MB; Loeschung erst nach konfigurierbarer Inaktivitaet.",
              ],
              [
                "Konto mit ESP32-Recovery-Token",
                "Zusaetzliche Wiederherstellung und hoehere Ressourcen",
                "Der erste angemeldete ESP32 wird automatisch zum Recovery-Board; bis zu drei aktive Boards. Zielwert 10 MB und laengere Inaktivitaetsfrist.",
              ],
              [
                "Premium-Entitlement",
                "Zusaetzliche Inhalte und Dienste",
                "Kein eigener Kontotyp. Es erweitert ein bestehendes Konto fuer eine Laufzeit oder als bezahlte Leistung.",
              ],
            ],
          },
        },
        {
          heading: "Wichtig",
          paragraphs: [
            "Der erste ESP32, den du deinem Konto hinzufuegst, wird zwingend als ESP32-Recovery-Token gefuehrt. Er erweitert damit das Basiskonto zum ESP32-Konto. Ein Kampagnen-Premium-Token ist dagegen ein einmal einloesbarer Gutschein. Beide Begriffe beschreiben unterschiedliche Dinge.",
          ],
        },
      ],
      relatedTopics: [
        "registration-login-recovery",
        "entitlements-and-tokens",
        "webshop-activation-codes",
      ],
    },
    "registration-login-recovery": {
      title: "Registrierung, Anmeldung und Wiederherstellung",
      summary: "So wird aus einem Gastzugang ein dauerhaftes Konto – ohne verpflichtende E-Mail-Adresse.",
      sections: [
        {
          heading: "Konto anlegen",
          list: [
            "Lege einen Spitznamen fest.",
            "Richte einen Passkey auf deinem Smartphone, Computer oder Sicherheitsschluessel ein. Er ist der verpflichtende Login für das dauerhafte Konto.",
            "Danach ist das Konto sofort nutzbar; weitere Absicherungen sind nicht Teil des Einstiegs.",
          ],
        },
        {
          heading: "Konto einrichten abschließen",
          paragraphs: [
            "Auf dem Dashboard findest du anschließend die Kachel Konto einrichten abschließen. Dort kannst du in Ruhe erklären lassen und freiwillig ein persönliches Offline-Recovery-Set, ESP32-Recovery-Token oder später Social Recovery ergänzen.",
          ],
        },
        {
          heading: "Anmelden",
          paragraphs: [
            "Wähle beim Anmelden einfach deinen gespeicherten Passkey. GerNetiX ordnet das ausgewählte Credential deinem Konto zu; dein Spitzname ist dafür nicht erforderlich. Der Spitzname bleibt nur als freiwilliger Kompatibilitätsweg verfügbar. Ein Passkey bestätigt lokal auf deinem Gerät, zum Beispiel mit PIN, Fingerabdruck oder Gesicht. Diese lokalen Daten werden nicht an GerNetiX übertragen.",
          ],
        },
        {
          heading: "Passwort vergessen",
          paragraphs: [
            "Ein neues Passwort kann jeweils allein durch einen eingerichteten Passkey, dein persoenliches Offline-Recovery-Set, Social Recovery mit zwei von drei Anteilen oder ein aktives ESP32-Recovery-Token gesetzt werden. Nach einer Wiederherstellung enden bestehende Sitzungen.",
          ],
        },
        {
          heading: "Wenn ein Recovery-Weg verloren geht",
          paragraphs: [
            "Melde dich ueber einen anderen vorhandenen Weg an und widerrufe oder ersetze den verlorenen Passkey beziehungsweise das Board. Nach einer endgueltigen Kontoloeschung kann kein Recovery-Weg das alte Konto wiederherstellen.",
          ],
        },
      ],
      relatedTopics: [
        "account-types",
        "entitlements-and-tokens",
        "register-device",
      ],
    },
    "entitlements-and-tokens": {
      title: "Premium, Entitlements und Token",
      summary: "Entitlements steuern Zusatzfunktionen. Sie sind von Kontotypen und Recovery-Wege getrennt.",
      sections: [
        {
          heading: "Heute in der Plattform",
          table: {
            headers: [
              "Plan",
              "Derzeit freigeschaltet",
            ],
            rows: [
              [
                "Kostenlos",
                "Code in der IDE bearbeiten und per USB bauen beziehungsweise flashen.",
              ],
              [
                "Premium",
                "Zusaetzlich gefuehrte Lernprojekte, KI-Assistent und Web Push.",
              ],
            ],
          },
        },
        {
          heading: "Geplante Angebote",
          paragraphs: [
            "Basis Plus, Kampagnen und Hardware-Bundles werden als zeitlich begrenzte oder dauerhafte Entitlements eingefuehrt. Geplant sind zum Beispiel zusaetzliche Background Worker, Dispatcher-Zugriff und hoehere, aber nie unbegrenzte Ausfuehrungsfrequenzen.",
          ],
        },
        {
          heading: "Die Token unterscheiden",
          table: {
            headers: [
              "Begriff",
              "Wirkung",
            ],
            rows: [
              [
                "ESP32-Recovery-Token",
                "Ein aktives, provisioniertes Board kann ein Passwort zuruecksetzen.",
              ],
              [
                "Kampagnen-Premium-Token",
                "Ein einmaliger Gutschein aus Workshop, Partneraktion oder Hardware-Bundle. Er aktiviert ein festgelegtes Premium-Entitlement und wird danach ungueltig.",
              ],
            ],
          },
        },
        {
          heading: "Paywall in Lernprojekten",
          paragraphs: [
            "Ein Lernprojekt kann bis zu einem Schritt offen sein, der zum Beispiel Dispatcher oder Background Worker braucht. Dort erklaert GerNetiX, welche Faehigkeit fehlt und welches Angebot sie freischaltet. Die Sperre wird auch serverseitig geprueft.",
          ],
        },
      ],
      relatedTopics: [
        "account-types",
        "registration-login-recovery",
        "webshop-activation-codes",
        "ai-premium",
        "event-worker-rules",
        "event-dispatcher",
      ],
    },
    "webshop-activation-codes": {
      title: "Webshop, E-Mail und Aktivierungscodes",
      summary: "Der Webshop verkauft Produkte. GerNetiX verwaltet die technische Nutzung. Aktivierungscodes verbinden beides bewusst.",
      sections: [
        {
          heading: "Warum getrennt?",
          paragraphs: [
            "Der GerNetiX-Webshop und dein GerNetiX-Account sind fachlich getrennt. Im Webshop kaufst du Hardware, Bundles, Software-Lizenzen oder Abos. In GerNetiX nutzt du Projekte, Geraete, Lizenzen und Entitlements.",
            "Ein Kauf erzeugt nicht automatisch ein GerNetiX-Konto und verknuepft die Shop-E-Mail nicht automatisch mit deinem GerNetiX-Account. Das schuetzt deine Zahlungs-, Rechnungs- und Versanddaten vor unnoetiger Vermischung mit der technischen Plattform.",
          ],
        },
        {
          heading: "Wofuer braucht der Webshop eine E-Mail?",
          list: [
            "Bestellbestaetigung und Rechnung senden.",
            "Versandstatus und Rueckfragen zur Lieferung klaeren.",
            "Support, Reklamation oder Gewaehrleistung einer Bestellung zuordnen.",
            "Aktivierungscode oder Bestellreferenz zusenden, wenn ein Produkt ein Nutzungsrecht enthaelt.",
          ],
        },
        {
          heading: "Was ist ein Aktivierungscode?",
          paragraphs: [
            "Ein Aktivierungscode ist die Bruecke zwischen Kauf und GerNetiX-Account. Du kaufst zum Beispiel Premium jaehrlich, eine Home-Server-Lizenz oder ein Hardware-Bundle im Webshop. Danach loest du den Code in GerNetiX ein und ordnest das Nutzungsrecht bewusst deinem Account zu.",
          ],
        },
        {
          heading: "Typischer Ablauf",
          list: [
            "Du kaufst im Webshop und gibst dort eine E-Mail fuer Bestellung, Rechnung und Kontakt an.",
            "Der Webshop sendet dir Rechnung, Bestellreferenz und gegebenenfalls einen Aktivierungscode.",
            "Du meldest dich in GerNetiX mit deinem Passkey an oder legst ein Konto an.",
            "Du gibst den Aktivierungscode in GerNetiX ein.",
            "GerNetiX prueft den Code und aktiviert das passende Entitlement fuer deinen Account.",
          ],
        },
        {
          heading: "Beispiele",
          table: {
            headers: [
              "Angebot",
              "Webshop",
              "GerNetiX",
            ],
            rows: [
              [
                "Hardware ohne Lizenz",
                "E-Mail fuer Rechnung, Versand und Support.",
                "Kein Konto noetig, solange keine technische Aktivierung gebraucht wird.",
              ],
              [
                "Hardware-Bundle mit Lizenz",
                "E-Mail und Bestellreferenz; Code per E-Mail oder im Paket.",
                "Code aktiviert das enthaltene Nutzungsrecht.",
              ],
              [
                "GerNetiX Home Server Software-Lizenz",
                "Verkauft das Nutzungsrecht.",
                "Account aktiviert und verwaltet die Home-Server-Lizenz.",
              ],
              [
                "Premium jaehrlich inkl. Home Server",
                "Kann als Abo oder Code verkauft werden.",
                "Aktivierungscode schaltet Premium und Home-Server-Nutzung frei.",
              ],
            ],
          },
        },
        {
          heading: "Wichtig",
          paragraphs: [
            "Die Webshop-E-Mail ist keine Passwort-Anmeldung fuer GerNetiX. GerNetiX bleibt passkey- und accountbasiert. Der Aktivierungscode ist die ausdrueckliche Entscheidung, einen Kauf mit einem GerNetiX-Account zu verbinden.",
          ],
        },
      ],
      relatedTopics: [
        "entitlements-and-tokens",
        "account-types",
        "plan-comparison",
        "ai-premium",
      ],
    },
    "ai-premium": {
      title: "KI-Unterstuetzung und Premium",
      summary: "Die KI-Chats sind derzeit ein Bestandteil des Premium-Abos.",
      sections: [
        {
          heading: "Warum ist die KI kostenpflichtig?",
          paragraphs: [
            "GerNetiX nutzt fuer einzelne KI-Aufgaben externe KI-Anbieter. Dadurch entstehen je nach Anfrage laufende Kosten. Damit diese Kosten planbar bleiben und der Dienst nicht missbraucht wird, sind die KI-Chats aktuell nur mit Premium verfuegbar.",
          ],
        },
        {
          heading: "Unser Ausblick",
          paragraphs: [
            "Wir pruefen fortlaufend kostenguenstigere und lokale Loesungen. Unser Ziel ist, moeglichst viele KI-Funktionen spaeter auch Nutzerinnen und Nutzern mit kostenlosem Abo anbieten zu koennen.",
          ],
        },
      ],
    },
    "first-project": {
      title: "Start your first project",
      summary: "Choose a template when you want a starting point, or begin with a blank development project.",
      sections: [
        {
          heading: "Choose a path",
          paragraphs: [
            "Templates give you a structure to adapt. A blank project is useful when you already know what you want to build.",
          ],
          code: "// Your project source is managed in the GerNetiX IDE.\nvoid setup() {\n}\n\nvoid loop() {\n}",
        },
      ],
      relatedTopics: [
        "quick-start",
        "supported-devices",
      ],
    },
    "board-definition": {
      title: "Warum eine Board Definition?",
      summary: "Der erkannte ESP32-Chip reicht nicht aus, um eine sichere und passende Basissoftware auszuwählen.",
      sections: [
        {
          heading: "Chip ist nicht gleich Board",
          paragraphs: [
            "Die USB-Erkennung sieht den ESP32 und oft dessen Flash-Größe. Sie kann aber nicht zuverlässig erkennen, welches konkrete Board, Display, welche Pins oder welche externe Speicherbestückung verbaut sind.",
          ],
        },
        {
          heading: "Wofür wir die Definition brauchen",
          list: [
            "Sie wählt das passende Firmware- und Partitionsprofil für die bestätigte Flash-Größe.",
            "Sie übernimmt bei bekannten Boards geprüfte Hardwareeigenschaften.",
            "Sie verhindert, dass eine unpassende Firmware oder Speicheraufteilung auf das Board geschrieben wird.",
            "Bei einem unbekannten Board kannst du die Ausstattung anhand des Datenblatts selbst festlegen.",
          ],
        },
      ],
      relatedTopics: [
        "supported-devices",
        "update-profiles",
      ],
    },
    "register-device": {
      title: "Register a device",
      summary: "Register a board after GerNetiX has detected and flashed it, then give it a clear name in your inventory.",
      sections: [
        {
          heading: "USB or Wi-Fi",
          paragraphs: [
            "Wi-Fi takes over a board that has already been provisioned and is reachable in your local network. USB is the right choice for a new board or one that cannot be reached.",
          ],
          list: [
            "Open Device Management > Provisioning.",
            "Choose USB or Wi-Fi and let GerNetiX detect the board.",
            "Flash a new board when prompted, then register it with a meaningful board name.",
          ],
        },
        {
          heading: "Why register first?",
          paragraphs: [
            "Registration establishes the device identity and makes the board available in your account inventory. Pairing then connects that registered board to your account.",
          ],
        },
      ],
      actions: [
        {
          label: "Open provisioning",
          route: "/app/device-management/provisioning/",
        },
      ],
      relatedTopics: [
        "pair-device",
        "flash-device",
        "device-not-detected",
      ],
    },
    "pair-device": {
      title: "Pair a device",
      summary: "Pairing links a registered board to your GerNetiX account so it can be used in projects.",
      sections: [
        {
          heading: "Pairing sequence",
          list: [
            "Detect the board by USB or Wi-Fi.",
            "Complete flashing for a new or unreachable board.",
            "Register the board and confirm the account pairing.",
          ],
        },
        {
          heading: "USB and virtual COM ports",
          paragraphs: [
            "A USB-connected board provides a virtual serial port. On Windows this appears as a COM port. A newly connected board needs one browser permission, even when Windows already shows the port in Device Manager.",
          ],
          links: [
            {
              topicId: "device-not-detected",
              label: "Device is not detected",
            },
          ],
        },
      ],
      actions: [
        {
          label: "Open Device Management",
          route: "/app/device-management/",
        },
      ],
      relatedTopics: [
        "register-device",
        "flash-device",
        "device-not-detected",
      ],
    },
    "flash-device": {
      title: "Geräte flashen: USB, OTA oder FlashBox?",
      summary: "Beim Flashen wird die Basissoftware oder ein Projekt-Build auf ein Gerät geschrieben. GerNetiX bietet dafür drei Wege.",
      sections: [
        {
          heading: "Den passenden Weg wählen",
          list: [
            "Das Gerät ist neu, hat noch kein WLAN oder liegt direkt am Rechner: USB verwenden.",
            "Das Gerät ist bereits eingerichtet, im WLAN und online: OTA verwenden.",
            "Du arbeitest mit iPad, Android oder ohne USB-Serial-Anschluss am Arbeitsgerät: FlashBox verwenden.",
          ],
        },
        {
          heading: "1. Direkt per USB",
          paragraphs: [
            "Verbinde das Zielgerät mit einem USB-Datenkabel mit deinem Computer. GerNetiX benötigt einmalig die Freigabe für den seriellen Anschluss und schreibt die Firmware direkt auf das Board. Das ist der einfachste Weg für neue Geräte und für die erste Basissoftware.",
          ],
          list: [
            "Ein Ladekabel ohne Datenleitungen funktioniert nicht.",
            "Das Board während des Flashens nicht abziehen.",
          ],
        },
        {
          heading: "2. OTA über WLAN",
          paragraphs: [
            "OTA bedeutet Over-the-Air. Es funktioniert nur, wenn die GerNetiX-Basissoftware bereits auf dem Gerät läuft, das Gerät im WLAN erreichbar ist und OTA aktiviert wurde. Der Projekt-Build wird dann ohne Kabel über das Netzwerk übertragen.",
          ],
          list: [
            "Ideal für Updates bereits eingerichteter Geräte.",
            "Für ein neues oder nicht erreichbares Gerät zuerst USB oder FlashBox nutzen.",
          ],
        },
        {
          heading: "3. Über die FlashBox",
          paragraphs: [
            "Die FlashBox ist eine WLAN-zu-USB-/Serial-Brücke. Sie steht bei dem Zielgerät und verbindet dessen USB-Anschluss mit GerNetiX über WLAN. So kannst du ein Gerät auch vom iPad, Android oder einem Rechner ohne passenden USB-Serial-Anschluss flashen.",
          ],
          list: [
            "Die FlashBox zuerst einrichten und bei Bedarf deinem Inventar hinzufügen.",
            "Das Zielgerät per Target-USB an die FlashBox anschließen.",
            "In einem Projekt bei Flashen die FlashBox auswählen; sie übernimmt die USB-Verbindung zum Zielgerät.",
          ],
        },
        {
          heading: "Was wird geschrieben?",
          paragraphs: [
            "Bei einem neuen Gerät schreibt GerNetiX zunächst die Basissoftware. Sie richtet die sichere Geräteidentität, WLAN und spätere OTA-Updates ein. Danach können Projekt-Builds per USB, OTA oder FlashBox aufgespielt werden.",
          ],
        },
      ],
      actions: [
        {
          label: "Provisionierung öffnen",
          route: "/app/device-management/provisioning/",
        },
        {
          label: "FlashBox einrichten",
          route: "/flashbox-einrichten/",
        },
      ],
      relatedTopics: [
        "provision-new-board",
        "usb-wifi-setup",
        "register-device",
        "device-not-detected",
      ],
    },
    "provision-new-board": {
      title: "Neues Board in Betrieb nehmen",
      summary: "Dieser geführte Ablauf verbindet ein neues Board sicher mit deinem WLAN und deinem GerNetiX-Account.",
      sections: [
        {
          heading: "1. Verbindungsweg wählen",
          paragraphs: [
            "Wähle USB, wenn das Board neu ist, über WLAN nicht gefunden wird oder bisher nur minimal eingerichtet wurde. WLAN wählst du nur für ein bereits vollständig eingerichtetes und im gleichen Netzwerk erreichbares Board.",
          ],
        },
        {
          heading: "2. Board erkennen und auswählen",
          list: [
            "Starte die automatische USB-Suche und wähle die angefragte serielle Schnittstelle im Browser aus.",
            "Wähle ein bekanntes Board aus der Liste. Ist dein Modell nicht dabei, wähle Manuell konfigurieren und übernimm die Angaben aus dem Datenblatt.",
            "Wähle danach das passende Update- und Speicherprofil. Die Beispiele und die Erklärung findest du über das Fragezeichen.",
          ],
        },
        {
          heading: "3. Basissoftware flashen",
          paragraphs: [
            "Klicke auf Basissoftware flashen und lasse das USB-Kabel verbunden, bis GerNetiX den Erfolg meldet.",
          ],
        },
        {
          heading: "4. WLAN lokal einrichten",
          list: [
            "Klicke auf WLANs suchen. Dein Board sucht die verfügbaren Netzwerke selbst.",
            "Wähle dein WLAN aus oder gib ein verborgenes WLAN manuell ein.",
            "Gib das WLAN-Passwort ein und verbinde das Board.",
          ],
        },
        {
          heading: "Deine Daten bleiben lokal",
          paragraphs: [
            "SSID und Passwort werden nicht an GerNetiX übertragen und nicht im Browser gespeichert. Sie werden ausschließlich per USB an dein Board übertragen und dort lokal abgelegt.",
          ],
        },
        {
          heading: "5. Fertigstellen",
          paragraphs: [
            "Sobald das Board mit dem WLAN verbunden ist, beendet GerNetiX die Registrierung und verbindet das Board mit deinem Account. Anschließend findest du es in deinem Geräte-Inventar und kannst es in Projekten auswählen.",
          ],
        },
        {
          heading: "Alternative",
          paragraphs: [
            "Wenn du das WLAN-Passwort nicht über USB eingeben möchtest, nutze nach dem Flashen das Captive Portal des Boards. Verbinde dich dafür mit dem vom Board bereitgestellten WLAN und öffne die lokale Einrichtungsseite.",
          ],
        },
      ],
      actions: [
        {
          label: "Provisionierung öffnen",
          route: "/app/device-management/provisioning/",
        },
      ],
      relatedTopics: [
        "usb-wifi-setup",
        "update-profiles",
        "device-not-detected",
      ],
    },
    "usb-wifi-setup": {
      title: "WLAN per USB einrichten",
      summary: "Nach dem Flashen kann das Board sein WLAN direkt und lokal ueber die USB-Verbindung erhalten.",
      sections: [
        {
          heading: "So funktioniert es",
          list: [
            "Wähle in der Provisionierung WLANs suchen. Das Board sucht die sichtbaren Netzwerke selbst.",
            "Wähle dein WLAN aus oder gib ein verborgenes Netzwerk manuell ein.",
            "Gib das Passwort ein und bestätige. Das Board speichert die Daten lokal und verbindet sich.",
          ],
        },
        {
          heading: "Deine Zugangsdaten",
          paragraphs: [
            "SSID und Passwort werden weder an GerNetiX übertragen noch im Browser gespeichert. Sie werden nur über die USB-Verbindung an dein Board übergeben und dort lokal abgelegt.",
          ],
        },
        {
          heading: "Alternative: Captive Portal",
          paragraphs: [
            "Wenn du die USB-Übergabe nicht verwenden möchtest, kannst du nach dem Flashen das Captive Portal des Boards nutzen. Verbinde dich dafür mit dem vom Board bereitgestellten WLAN und öffne die lokale Einrichtungsseite. Auch dabei bleiben die Zugangsdaten auf dem Board.",
          ],
        },
      ],
      actions: [
        {
          label: "Provisionierung öffnen",
          route: "/app/device-management/provisioning/",
        },
      ],
      relatedTopics: [
        "flash-device",
        "register-device",
        "device-not-detected",
      ],
    },
    "update-profiles": {
      title: "Update- und Speicherprofile",
      summary: "FULL, MEDIUM und LOW bestimmen, wie viel Flash für sichere Updates oder für deine Anwendung reserviert wird.",
      sections: [
        {
          heading: "Die drei Profile",
          list: [
            "FULL – maximale Ausfallsicherheit: Zwei Firmwarebereiche erhalten die letzte funktionierende Software, auch wenn ein Update fehlschlägt.",
            "MEDIUM – speicheroptimiert: Ein kleiner Wiederherstellungsbereich lässt mehr Platz für Display, Sound und Anwendung. Ein fehlgeschlagenes Update wird erneut ausgeführt.",
            "LOW – Minimalkonfiguration: Der größtmögliche Speicherbereich steht der Anwendung zur Verfügung. Updates und Wiederherstellung erfolgen ausschließlich über USB.",
          ],
        },
        {
          heading: "Wann wählt man was?",
          table: {
            headers: [
              "Interner Flash",
              "FULL",
              "MEDIUM",
              "LOW",
            ],
            rows: [
              [
                "4 MB",
                "Kleine Regelungen, Sensoren, Relais und LEDs",
                "Kleines OLED, einfache Menüs, wenige Fonts",
                "Vollgrafik, viele Ansichten, größere Bilder oder Sound",
              ],
              [
                "8 MB",
                "Regelungen mit OLED, einfache TFT- und Touch-Oberflächen",
                "Umfangreiche Touch-Oberflächen, mehrere Ansichten und lokale Daten",
                "Sehr große Medienanwendungen oder konsequent offline betriebene Spezialprojekte",
              ],
              [
                "16 MB",
                "Übliche Touchdisplays, Sound, mehrere Ansichten und sichere Updates",
                "Sehr große Font-, Bild-, Audio- oder Datenbestände",
                "Außergewöhnlich große Offline-Anwendungen; normalerweise nicht erforderlich",
              ],
            ],
          },
        },
        {
          heading: "Später ändern",
          paragraphs: [
            "Du kannst das Profil jederzeit wechseln. Ändert sich dabei die Speicheraufteilung oder war OTA bisher nicht vorhanden, muss das Board einmal per USB verbunden und neu geflasht werden.",
          ],
        },
        {
          heading: "SD-Karte und PSRAM",
          paragraphs: [
            "Bilder, Fonts, Audio und Webseiten können auf einer externen SD-Karte liegen. Firmwarecode und OTA-Partitionen müssen trotzdem in den internen Flash passen. Externe PSRAM vergrößert nur den Arbeitsspeicher, nicht den Firmware-Flash.",
          ],
        },
      ],
      actions: [
        {
          label: "Provisionierung öffnen",
          route: "/app/device-management/provisioning/",
        },
      ],
      relatedTopics: [
        "flash-device",
        "supported-devices",
      ],
    },
    "supported-devices": {
      title: "Unterstützte Boards",
      summary: "Eine Sammlung aller aktiven Boards aus dem GerNetiX Hardware Catalog – mit Fähigkeiten, Prüfstatus und Beschaffungsinformationen.",
      hardwareCatalog: true,
      sections: [
        {
          heading: "Die Sammlung",
          paragraphs: [
            "Jede Karte steht für eine konkrete unterstützte Boardvariante. Die Liste ist keine Sammlung eigener Hilfethemen: Eigenschaften, Schnittstellen und Hinweise stehen direkt bei dem Board.",
          ],
        },
        {
          heading: "Was bedeutet unterstützt?",
          paragraphs: [
            "Ein Katalogeintrag beschreibt die bekannte Boardfamilie, ihre Schnittstellen und den vorgesehenen GerNetiX-Provisionierungsweg. Erst nach USB-Flash, Registrierung und Pairing wird ein konkretes gekauftes Board als GerNetiX-verified geführt. Prüfe vor dem Kauf immer die vollständige Modulbezeichnung, Flash-Größe, USB-Datenanschluss und bei Sonderboards das Datenblatt.",
          ],
        },
        {
          heading: "Ersteinrichtung",
          list: [
            "Ein neues Board wird über ein USB-Datenkabel geflasht und provisioniert; ein reines Ladekabel reicht nicht.",
            "Auf dem Mac installiert GerNetiX einmalig den Serial Service. Danach erfolgen Erkennung, Flash und Einrichtung vollständig in der GerNetiX-Plattform.",
            "iPhone und iPad eignen sich für die PWA, Push und Bedienung, aber nicht für die kabelgebundene Ersteinrichtung.",
          ],
        },
        {
          heading: "Kauf und Herstellerinformationen",
          paragraphs: [
            "Datenblatt- und Beschaffungslinks stehen direkt bei dem jeweiligen Board. Entscheidend ist immer die genaue Boardvariante, nicht nur die allgemeine ESP32-Familie.",
          ],
        },
      ],
      relatedTopics: [
        "provision-new-board",
        "device-not-detected",
        "update-profiles",
      ],
    },
    "event-worker-rules": {
      title: "Ereignis-Worker und Regelsprache",
      summary: "Lege fest, wann ein Ereignis verarbeitet wird – ohne allgemeine Skripte oder unkontrollierte Zugriffe.",
      sections: [
        {
          heading: "Aufgabe des Workers",
          paragraphs: [
            "Ein IoT-Gerät meldet ein Ereignis. Der Worker bewertet es anhand einer Regel und kann ein Folgeereignis freigeben. Der Dispatcher stellt dieses Folgeereignis anschließend an ein Ziel zu. Push ist nur eine mögliche Zustellart und nicht Aufgabe des Workers.",
          ],
        },
        {
          heading: "Gültige Werte",
          table: {
            headers: [
              "Wert",
              "Bedeutung",
            ],
            rows: [
              [
                "event.type",
                "Name des eingegangenen Ereignisses",
              ],
              [
                "event.value",
                "Mitgelieferter Text- oder Zahlenwert",
              ],
              [
                "state.<name>",
                "Nur eine im Projektmodell ausdrücklich deklarierte Zustandsvariable",
              ],
            ],
          },
        },
        {
          heading: "Was bedeutet true oder false?",
          paragraphs: [
            "Ein Regelausdruck beantwortet immer genau eine Frage mit true (wahr) oder false (falsch). true bedeutet: Die Regel trifft zu und der Worker darf ein Folgeereignis freigeben. false bedeutet: Die Regel trifft nicht zu; dieser Durchlauf endet ohne Folgeereignis.",
          ],
        },
        {
          heading: "Vergleichsoperatoren",
          table: {
            headers: [
              "Operator",
              "Bedeutung",
              "Beispiel",
            ],
            rows: [
              [
                "==",
                "ist gleich",
                "event.type == taste_gedrueckt",
              ],
              [
                "!=",
                "ist nicht gleich",
                "state.life_state != warnung",
              ],
              [
                "<",
                "kleiner als",
                "state.hunger < 10",
              ],
              [
                "<=",
                "kleiner oder gleich",
                "state.hunger <= 10",
              ],
              [
                ">",
                "größer als",
                "state.hunger > 20",
              ],
              [
                ">=",
                "größer oder gleich",
                "state.hunger >= 80",
              ],
            ],
          },
        },
        {
          heading: "Verknüpfungen",
          table: {
            headers: [
              "Operator",
              "Bedeutung",
              "Beispiel",
            ],
            rows: [
              [
                "&&",
                "und – beide Seiten müssen wahr sein",
                "event.type == timer_tick && state.hunger >= 80",
              ],
              [
                "||",
                "oder – mindestens eine Seite muss wahr sein",
                "event.type == fuettern || event.type == schlafenszeit",
              ],
              [
                "!",
                "nicht – kehrt wahr und falsch um",
                "!(state.life_state == warnung)",
              ],
            ],
          },
        },
        {
          heading: "So wird ein Ausdruck gelesen",
          paragraphs: [
            "event.type == timer_tick && state.hunger >= 80 bedeutet: Der Worker reagiert nur, wenn ein Zeitereignis eingegangen ist und gleichzeitig der deklarierte Hungerwert mindestens 80 beträgt. Bei einer und-Verknüpfung reicht eine falsche Seite aus, damit das Gesamtergebnis false ist.",
          ],
        },
        {
          heading: "Beispiel: Tamagotchi-Zustandsmaschine",
          paragraphs: [
            "Ein Tamagotchi verändert seinen Zustand durch Ereignisse. Der Worker bewertet nur die Übergänge; der Dispatcher kann danach optional eine Smartphone-Benachrichtigung zustellen.",
          ],
          stateChart: {
            title: "Tamagotchi – vereinfachte Zustände",
            states: [
              {
                title: "Satt",
                initial: true,
              },
              {
                title: "Hungrig",
              },
              {
                title: "Warnung",
              },
            ],
            transitions: [
              {
                from: "Satt",
                to: "Hungrig",
                when: "timer_tick und state.hunger >= 50",
              },
              {
                from: "Hungrig",
                to: "Warnung",
                when: "timer_tick und state.hunger >= 80",
              },
              {
                from: "Hungrig",
                to: "Satt",
                when: "event.type == fuettern",
              },
              {
                from: "Warnung",
                to: "Satt",
                when: "event.type == fuettern",
              },
            ],
          },
        },
        {
          heading: "UML-Statechart lesen",
          paragraphs: [
            "Der ausgefüllte Punkt ist der Start. Ab dort beginnt das Tamagotchi im Zustand satt. Abgerundete Rechtecke sind Zustände; genau einer davon ist als state.life_state gespeichert. Ein Pfeil ist ein erlaubter Übergang. Der Text am Pfeil wird als Ereignis [Bedingung] gelesen: timer_tick [hunger ≥ 50] bedeutet, dass das Ereignis timer_tick eingegangen sein muss und der deklarierte Wert state.hunger mindestens 50 beträgt. Bei Erreichen eines Zielzustands aktualisiert die Plattform state.life_state, zum Beispiel von satt auf hungrig. Der Worker darf keine anderen Zustände oder Variablen verwenden als die, die dieses Modell erklärt.",
          ],
          umlStateChart: true,
        },
        {
          heading: "So wird das Diagramm als Variablenmodell abgebildet",
          paragraphs: [
            "Die Zustandsnamen aus dem Diagramm werden nicht frei im Ausdruck geschrieben. Das Projektmodell erklärt zunächst, welche Variablen es gibt. Nur diese Namen stehen dem Worker zur Verfügung.",
          ],
          table: {
            headers: [
              "Diagramm",
              "Deklarierte Zustandsvariable",
              "Erlaubte Werte",
            ],
            rows: [
              [
                "Satt, Hungrig, Warnung",
                "state.life_state",
                "satt, hungrig, warnung",
              ],
              [
                "Hunger als Übergangsbedingung",
                "state.hunger",
                "0 bis 100",
              ],
              [
                "Auslösendes Ereignis",
                "event.type",
                "timer_tick, fuettern",
              ],
            ],
          },
        },
        {
          heading: "Daraus abgeleitete Worker-Regel",
          paragraphs: [
            "Für den Übergang zur Warnung genügt ein einzelner, prüfbarer Regelausdruck. Ergibt er true, gibt die Plattform das Folgeereignis hunger_warnung frei. Der Nutzer schreibt dafür kein allgemeines JavaScript.",
          ],
          code: "event.type == \"timer_tick\" && state.hunger >= 80\n\n// Plattformwirkung bei true:\nfolgeereignis = \"hunger_warnung\"\n// Dispatcher kann dieses Ereignis optional per Push zustellen.",
        },
        {
          heading: "Beispiele",
          code: "event.type == \"taste_gedrueckt\"\n\nevent.type == \"timer_tick\" && state.life_state == \"hungrig\"\n\nevent.type == \"fuettern\" || state.life_state == \"warnung\"",
        },
        {
          heading: "Klare Grenzen",
          list: [
            "Keine Schleifen und keine eigenen Funktionen",
            "Keine Netzwerk- oder Dateizugriffe",
            "Keine beliebigen Datenbankabfragen oder Speicherzugriffe",
            "Zeitplan, Zugriffsdauer und erlaubte Aktion werden außerhalb der Regel konfiguriert",
          ],
        },
      ],
      relatedTopics: [
        "event-dispatcher",
        "first-project",
      ],
    },
    "event-dispatcher": {
      title: "Ereignis-Dispatcher",
      summary: "Stelle ein vom Worker freigegebenes Folgeereignis an das konfigurierte Ziel zu.",
      sections: [
        {
          heading: "Aufgabe des Dispatchers",
          paragraphs: [
            "Der Dispatcher verarbeitet keine Rohdaten vom IoT-Gerät und führt keine Projektregel aus. Er prüft, ob ein freigegebenes Folgeereignis zu seiner Bedingung passt, und stellt es dann zu.",
          ],
        },
        {
          heading: "Was wird konfiguriert?",
          table: {
            headers: [
              "Konfiguration",
              "Bedeutung",
            ],
            rows: [
              [
                "Bedingung",
                "Zum Beispiel: Folgeereignis liegt vor oder ein Ereigniswert entspricht einem erwarteten Wert.",
              ],
              [
                "Zielgerät",
                "Ein IoT-Zielgerät aus demselben Projekt.",
              ],
              [
                "PWA-Push",
                "Optional: Benachrichtigt registrierte Smartphone-PWAs für genau dieses Projekt.",
              ],
            ],
          },
        },
        {
          heading: "Dispatcher ist nicht Push",
          paragraphs: [
            "Push ist nur ein möglicher Zustellweg. Derselbe Dispatcher kann auch ein IoT-Zielgerät erreichen. Wird Push nicht aktiviert oder ist keine PWA registriert, bleibt die Ereignisverarbeitung davon unabhängig.",
          ],
        },
        {
          heading: "Beispiel",
          code: "Worker gibt frei: benachrichtigung_anfordern\nDispatcher-Bedingung: Folgeereignis liegt vor\nZiel: Smartphone-PWA dieses Projekts\nOptionaler Weg: Push-Benachrichtigung",
        },
      ],
      relatedTopics: [
        "event-worker-rules",
      ],
    },
    "compatible-hardware": {
      title: "Kompatible Hardware",
      summary: "Alle bekannten ProcessorBoards aus dem GerNetiX Hardware Catalog mit Fähigkeiten, Prüfstatus und Beschaffungsinformationen.",
      hardwareCatalog: true,
      sections: [
        {
          heading: "Was bedeutet kompatibel?",
          paragraphs: [
            "Ein Katalogeintrag beschreibt die bekannte Boardfamilie, ihre Schnittstellen und den vorgesehenen GerNetiX-Provisionierungsweg. Erst nach USB-Flash, Registrierung und Pairing wird ein konkretes gekauftes Board als GerNetiX-verified geführt. Prüfe vor dem Kauf immer die vollständige Modulbezeichnung, Flash-Größe, USB-Datenanschluss und bei Sonderboards das Datenblatt.",
          ],
        },
        {
          heading: "Provisionierung braucht einen USB-Host",
          list: [
            "Ein neues Board wird über ein USB-Datenkabel geflasht und provisioniert; ein reines Ladekabel reicht nicht.",
            "Auf dem Mac verbindet der lokal installierte GerNetiX Serial Service die Plattform mit dem Board. Alle Schritte bleiben in der GerNetiX-Oberfläche.",
            "iPhone, iPad und Android eignen sich für mobile Bedienung, aber nicht als verlässlicher USB-Host für die kabelgebundene Ersteinrichtung. Plane dafür einen PC oder Mac ein.",
          ],
        },
        {
          heading: "Kauf- und Herstellerlinks",
          paragraphs: [
            "Links werden pro Hardwareeintrag im Hardware Catalog gepflegt. GerNetiX bevorzugt neutrale Hersteller- oder Datenblattlinks statt wechselnder Händlerangebote. Ein Kauf bei Amazon oder einem anderen Händler ist möglich, solange die genaue Boardvariante zum Katalogeintrag passt; die Provisionierung bleibt dabei deine eigene Aufgabe.",
          ],
        },
        {
          heading: "GerNetiX-Webshop",
          paragraphs: [
            "Für diese Fälle entsteht ein GerNetiX-Webshop: Dort werden passende Boards und Hardware-Bundles zu einem Projekt angeboten. Ziel ist, die Hardware bereits mit der geeigneten Basissoftware und dem passenden Provisionierungsprofil bereitzustellen. Damit entfällt bei einem solchen Angebot der erste manuelle USB-Flash; die projektbezogene Einrichtung und das Pairing werden anschließend im geführten Ablauf abgeschlossen.",
          ],
        },
      ],
      relatedTopics: [
        "provision-new-board",
        "device-not-detected",
        "update-profiles",
      ],
    },
    "esp32-overview": {
      title: "ESP32 overview",
      summary: "ESP32 boards combine a microcontroller with wireless connectivity for many GerNetiX projects.",
      sections: [
        {
          heading: "A practical default",
          paragraphs: [
            "An ESP32 is a good choice for Wi-Fi projects with sensors, actuators and web-connected features. Select a concrete board in GerNetiX so available interfaces are known.",
          ],
        },
      ],
      relatedTopics: [
        "esp32-s3",
        "esp32-c6",
        "supported-devices",
      ],
    },
    "esp32-s3": {
      title: "ESP32-S3",
      summary: "The ESP32-S3 is particularly suitable for USB, displays and AI-adjacent applications.",
      sections: [
        {
          heading: "When to choose it",
          paragraphs: [
            "Choose an ESP32-S3 when native USB or display-oriented projects matter. Check the selected board's exact memory and pin capabilities before building.",
          ],
        },
      ],
      relatedTopics: [
        "esp32-c6",
        "supported-devices",
      ],
    },
    "esp32-c6": {
      title: "ESP32-C6",
      summary: "The ESP32-C6 is an ESP32 variant for modern wireless-focused projects.",
      sections: [
        {
          heading: "When to choose it",
          paragraphs: [
            "Choose an ESP32-C6 when its supported connectivity and board capabilities match your project. GerNetiX shows the compatible functions for the selected board.",
          ],
        },
      ],
      relatedTopics: [
        "esp32-s3",
        "supported-devices",
      ],
    },
    "device-not-detected": {
      title: "Device is not detected",
      summary: "Check the cable, the GerNetiX Serial Service and the selected connection method.",
      sections: [
        {
          heading: "Quick checks",
          list: [
            "Use a USB data cable, not a charging-only cable.",
            "Reconnect the board and refresh the USB devices in GerNetiX.",
            "Use USB for a new board; Wi-Fi works only for a previously provisioned and reachable board.",
            "On macOS, install or repair the GerNetiX Serial Service from Downloads. It runs invisibly; continue in this GerNetiX window.",
          ],
        },
      ],
      actions: [
        {
          label: "Open downloads",
          route: "/app/downloads/",
        },
      ],
      relatedTopics: [
        "register-device",
        "pair-device",
        "flash-device",
      ],
    },
  };

  const articleAccess = {
    "first-project": "premium",
    "update-profiles": "premium",
    "provision-new-board": "account",
    "board-definition": "account",
    "register-device": "account",
    "pair-device": "account",
    "flash-device": "account",
    "usb-wifi-setup": "account",
    "supported-devices": "account",
    "event-worker-rules": "account",
    "event-dispatcher": "account",
    "compatible-hardware": "account",
    "device-not-detected": "account",
  };
  Object.entries(articleAccess).forEach(([articleId, access]) => {
    if (articles[articleId]) articles[articleId].access = access;
  });

  function findTopic(topicId) {
    for (const topic of topics) {
      if (topic.id === topicId) return topic;
      const child = topic.children?.find((item) => item.id === topicId);
      if (child) return child;
    }
    return null;
  }

  function findParentTopic(topicId) {
    return topics.find((topic) => topic.children?.some((item) => item.id === topicId)) || null;
  }

  return { topics, articles, findTopic, findParentTopic };
})();
