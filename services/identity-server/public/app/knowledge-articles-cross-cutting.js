// Wissensspeicher: Datenschutz und Security.
const KnowledgeArticlesCrossCutting = {
    "privacy-basics": {
      title: "Datenschutz in vernetzten Projekten",
      summary: "Vernetzte Geräte können schnell personenbezogene Daten erzeugen. Gute Projekte erfassen nur, was sie wirklich brauchen, erklären den Zweck und schützen Daten über ihren gesamten Lebenszyklus.",
      access: "premium",
      sections: [
        {
          heading: "Was personenbezogene Daten sein können",
          paragraphs: [
            "Personenbezogene Daten sind Informationen, die eine Person direkt oder indirekt erkennbar machen können. Dazu gehören nicht nur Name und E-Mail-Adresse, sondern je nach Zusammenhang auch Standort, Gerätekennung, Sprachaufnahme, Kamerabild, Bewegungsprofil, Zeitstempel oder Nutzungsverhalten.",
            "Ein einzelner Temperaturwert ist meist unkritisch. Wird er aber einer Wohnung, einem Konto und festen Zeitpunkten zugeordnet, kann er Rückschlüsse auf Anwesenheit oder Gewohnheiten erlauben. Der Kontext entscheidet.",
          ],
        },
        {
          heading: "Datenschutz durch Gestaltung",
          list: [
            "Zweck festlegen: Vor dem Erfassen klar benennen, wofür ein Datum gebraucht wird. Ohne Zweck keine Sammlung.",
            "Daten minimieren: Nur die benötigten Werte, Genauigkeiten und Zeiträume erfassen. Ein Ereignis kann oft besser sein als ein dauerhafter Rohdatenstrom.",
            "Lokal verarbeiten, wenn möglich: Edge Computing kann vermeiden, dass Rohbilder, Audiodaten oder detaillierte Sensordaten den Ort verlassen.",
            "Transparenz schaffen: Nutzerinnen und Nutzer verständlich informieren, welche Daten wohin fließen, wie lange sie gespeichert bleiben und wer Zugriff hat.",
            "Schützen und löschen: Zugriffe begrenzen, Übertragung absichern, Daten getrennt speichern und Lösch- beziehungsweise Aufbewahrungsregeln umsetzen.",
          ],
        },
        {
          heading: "Beispiele",
          table: {
            headers: [
              "Projekt",
              "Datensparsame Lösung",
              "Warum",
            ],
            rows: [
              [
                "Bewegungsmelder für Licht",
                "Nur Bewegung erkannt / nicht erkannt lokal verarbeiten; keine dauerhafte Personenhistorie speichern.",
                "Die Lichtfunktion benötigt keine Identität und kein Bewegungsprofil.",
              ],
              [
                "Kamera zur Qualitätsprüfung",
                "Bild direkt am Edge-Gerät auswerten; nur Qualitätskennzahl oder Fehlerbild bei Bedarf übertragen.",
                "Rohbilder können Personen oder Betriebsgeheimnisse enthalten.",
              ],
              [
                "Smartes Raumklima",
                "Messwerte pro Raum mit begrenzter Aufbewahrung; Kontodaten und Telemetrie getrennt behandeln.",
                "Lange Zeitreihen können Rückschlüsse auf Anwesenheit ermöglichen.",
              ],
              [
                "iPhone-App",
                "Nur notwendige Berechtigungen anfragen und klar erklären; Standort, Kamera oder Kontakte nicht vorsorglich sammeln.",
                "Mobile Berechtigungen geben tiefen Zugriff auf persönliche Informationen.",
              ],
            ],
          },
        },
        {
          heading: "Datenschutz und Sicherheit gehören zusammen",
          paragraphs: [
            "Datenschutz beantwortet zuerst: Dürfen und müssen wir diese Daten verarbeiten? Sicherheit beantwortet: Wie verhindern wir, dass Unbefugte darauf zugreifen oder sie verändern? Gute Technik braucht beides. Bei echten Produkten kommen außerdem Rechtsgrundlage, Verantwortlichkeiten, Verträge und gegebenenfalls eine Datenschutz-Folgenabschätzung hinzu.",
          ],
        },
      ],
      relatedTopics: [
        "server-systems",
        "embedded-safety",
        "ai-premium",
      ],
    },
    "security-basics": {
      title: "Security in vernetzten Projekten",
      summary: "Security schützt Identitäten, Geräte, Dienste und Daten vor unbefugtem Zugriff und vor ungewollter Veränderung. Sie ist ein Querschnittsthema von der lokalen Hardware bis zum Cloud-Dienst.",
      sections: [
        {
          id: "security-goals",
          heading: "Risikoanalyse: Was müssen wir schützen?",
          securityDoorIllustrations: [
            {
              afterParagraph: 0,
              src: "/assets/security-smart-door-lock.png",
              alt: "Vergleich eines vernetzten Türschlosses im verriegelten und offenen Zustand; nur die berechtigte Person erhält die Statusinformation",
              title: "1. Türstatus ist eine sensible Information",
              caption: "An der realen Tür kann jemand den Zustand nur an diesem Ort und zu diesem Zeitpunkt sehen. Der Fernstatus lässt sich dagegen leise, wiederholt und von weit weg abfragen – deshalb ist er eine schützenswerte Information.",
            },
            {
              afterParagraph: 1,
              src: "/assets/security-smart-door-status-privacy.png",
              alt: "Offene vernetzte Tür; ihr Status wird nur an ein berechtigtes Smartphone gesendet und für andere Personen verborgen",
              title: "2. Eine offene Tür ist keine öffentliche Information",
              caption: "Die cyanfarbene Verbindung zeigt: Nur das berechtigte Smartphone erfährt den Status. Die durchgestrichenen Augen stehen für Personen, die diese Information nicht erhalten sollen.",
            },
            {
              afterParagraph: 2,
              src: "/assets/security-smart-door-remote-attack.png",
              alt: "Ein Krimineller sendet über das Internet einen unberechtigten Öffnungsbefehl an ein vernetztes Türschloss; die Tür steht offen, ohne dass eine Brechstange verwendet wird",
              title: "3. Ein unberechtigter Fernbefehl wäre gefährlich",
              caption: "Der rote Weg führt vom Angreifer über das Internet zum Schloss. Die offene Tür zeigt die Folge. Die durchgestrichene Brechstange steht für den entscheidenden Unterschied: Ein digitaler Angriff kann ohne sichtbare Gewalt und nahezu lautlos erfolgen.",
            },
            {
              afterParagraph: 3,
              src: "/assets/security-smart-door-access-rights.png",
              alt: "Eine Administration fügt einer Person ein zeitlich begrenztes Öffnungsrecht für ein vernetztes Türschloss hinzu",
              title: "3. Eine Administration vergibt ein begrenztes Öffnungsrecht",
              caption: "Links die Administration, in der Mitte die kontrollierte Einladung, rechts die neue Person. Die Uhr bedeutet: Das Öffnungsrecht kann zeitlich begrenzt sein.",
            },
          ],
          paragraphs: [
            "Security beantwortet eine sehr praktische Frage: Wer oder was darf welche Funktion benutzen – und wie prüft das System, ob diese Person oder dieses Gerät dafür berechtigt ist? Ein vernetztes Türschloss zeigt das gut. In der realen Welt kann grundsätzlich jede Person, die direkt vor der Tür steht, sehen oder vorsichtig prüfen, ob sie verriegelt ist. Das kostet aber Zeit, setzt die Person selbst der Beobachtung aus und liefert nur einen einzelnen Moment. Ein Fernstatus ist technisch etwas anderes: Er kann unbemerkt, von überall und beliebig oft abgefragt werden. Aus einer Beobachtung vor Ort wird damit ein dauerhaft erreichbarer Informationsdienst.",
            "Das ist keine theoretische Vorsicht. Wer wiederholt sieht, wann eine Tür geschlossen bleibt, wann sie geöffnet wird oder wie lange niemand kommt und geht, kann Abwesenheiten und Gewohnheiten ableiten. Menschen mit krimineller Absicht könnten solche Informationen nutzen, um Einbrüche zu planen. Aber auch ein Unternehmen oder Verkäufer sollte daraus nicht erkennen können, wann jemand wahrscheinlich zu Hause ist, um diese Person gezielt für ein Verkaufsgespräch anzusprechen. Der Türstatus ist kein Werbedatum, sondern private Sicherheitsinformation.",
            "Noch kritischer als ein ausgespähter Türstatus wäre ein unberechtigter Öffnungsbefehl. Gelingt es jemandem, eine Schwachstelle, ein gestohlenes Konto oder einen zu weitreichenden Fernzugang auszunutzen, kann die Person das Schloss aus der Ferne über das Internet ansprechen. Das kann viel leiser und unauffälliger geschehen als ein Einbruch mit einer Brechstange: Keine Person muss am Haus stehen, keine Tür wird aufgebrochen und Nachbarn sehen oder hören möglicherweise nichts.",
            "Der legitime Anwendungsfall folgt danach: Eine andere Person darf die Tür vielleicht nur zu bestimmten Zeiten öffnen. Das Schloss darf dafür nur signierte, berechtigte Öffnungsbefehle annehmen. Die Eigentümerin kann weitere Personen einladen oder deren Öffnungsrecht wieder entfernen. Rechte werden also gezielt für eine Identität und die konkrete Aktion ‚Tür öffnen‘ vergeben.",
            "Ein Gast erhält zum Beispiel ein zeitlich begrenztes Recht zum Öffnen, die Reinigungskraft nur montags zwischen 9 und 12 Uhr, ein Familienmitglied dauerhaft und die Verwaltung zusätzlich das Recht, andere Zugänge zu vergeben. Läuft eine Berechtigung ab oder geht ein Smartphone verloren, kann das Recht serverseitig widerrufen werden. Die Tür muss dabei auch ohne Internet sicher funktionieren: Ein Netzausfall darf sie nicht unkontrolliert öffnen.",
            "Dabei geht es um vier Ziele. Vertraulichkeit bedeutet: Fremde können nicht sehen, ob jemand zu Hause ist oder wann die Tür geöffnet wurde. Integrität bedeutet: Niemand kann einen Öffnungsbefehl, eine Berechtigung oder das Türprotokoll unbemerkt verfälschen. Verfügbarkeit bedeutet: Berechtigte Personen können die Tür im vorgesehenen Rahmen nutzen und das Schloss bleibt bei Störungen in einem sicheren Zustand. Nachvollziehbarkeit bedeutet: Wichtige Öffnungen, Einladungen, Rechteänderungen und Fehler können später geprüft werden.",
            "Security ist keine Anhäufung einzelner Maßnahmen, sondern ein zusammenhängendes Konzept. Es beginnt mit vier Fragen: Welche Funktionen und Daten möchten wir schützen? Was passiert, wenn sie kompromittiert werden? Wo können potenzielle Angreifer überhaupt ansetzen? Und wie halten wir sie davon ab? Die folgenden Abschnitte beantworten vor allem diese letzte Frage: Identifikation, Authentifizierung und Autorisierung begrenzen, wer etwas darf; Sitzungen und Tokens sind zeitlich begrenzte Zugangsnachweise; TLS, Zertifikate und Certificate Authorities schützen die Verbindung; Firewall, VPN und Reverse Proxy begrenzen den erreichbaren Weg. Jedes Werkzeug schützt einen anderen Teil des Systems.",
          ],
        },
        {
          id: "security-prevent-attacks",
          heading: "Wie halten wir Angreifer ab?",
          paragraphs: [
            "Angreifer halten wir nicht mit einem einzelnen Produkt ab, sondern mit mehreren Hürden. Das System prüft Identitäten, gibt nur die nötigen Rechte, schützt Verbindungen und macht unnötige Dienste gar nicht erst erreichbar. So wird ein gestohlenes Konto, ein erratener Zugang oder eine öffentlich erreichbare Schwachstelle nicht sofort zum vollständigen Zugriff.",
            "Die folgenden Kapitel erklären diese Hürden: Identifikation, Authentifizierung und Autorisierung entscheiden über Rechte; Sessions und Tokens tragen einen begrenzten Zugangsnachweis; TLS und Zertifikate schützen die Verbindung; Firewall, VPN, Reverse Proxy und geschlossene Ports begrenzen die Angriffsfläche. Updates, sichere Konfiguration, Eingabeprüfung und Rate Limits ergänzen diese Schutzschichten.",
          ],
        },
        {
          id: "security-detect-attacks",
          heading: "Wie erkennen wir Angreifer?",
          paragraphs: [
            "Nicht jeder Angriff lässt sich sicher verhindern. Deshalb brauchen wir Hinweise darauf, dass etwas Ungewöhnliches geschieht: viele fehlgeschlagene Anmeldungen, Zugriffe aus unerwarteten Netzen, ein neues Gerät, ungewöhnlich viele Befehle oder Änderungen an Berechtigungen.",
            "Protokolle machen solche Ereignisse nachvollziehbar. Monitoring fasst sie zusammen, und Alarmierung informiert bei wichtigen oder wiederholten Auffälligkeiten. Protokolle dürfen dabei keine Passwörter, Tokens oder privaten Inhalte enthalten – sie sollen bei der Untersuchung helfen, nicht selbst ein neues Risiko schaffen.",
          ],
        },
        {
          id: "security-limit-damage",
          heading: "Wie begrenzen wir den Schaden?",
          paragraphs: [
            "Wenn ein Konto, Gerät oder Dienst kompromittiert ist, darf es nicht automatisch das ganze Zuhause oder alle Daten betreffen. Kleine Rechte, getrennte Rollen, getrennte Netze oder VLANs und klar begrenzte Dienste verringern den möglichen Schaden. Ein Sensor darf etwa Messwerte senden, aber keine Tür öffnen oder neue Nutzer einladen.",
            "Zugangsnachweise müssen widerrufbar sein. Bei Verlust werden Sitzungen, Tokens, Schlüssel oder Gerätezugänge gesperrt und ersetzt. Getestete Backups und ein geübter Wiederherstellungsweg helfen nach Fehlern oder Angriffen. Das Ziel ist nicht nur, einen Angriff zu überleben, sondern sicher und nachvollziehbar in einen kontrollierten Zustand zurückzukehren.",
          ],
        },
        {
          id: "security-identity-authentication-authorization",
          heading: "Identifikation, Authentifizierung und Autorisierung",
          table: {
            headers: [
              "Begriff",
              "Frage",
              "Beispiel",
            ],
            rows: [
              [
                "Identifikation",
                "Welche Identität behauptet jemand oder etwas zu haben?",
                "Ein Nutzer nennt seinen Kontonamen; ein ESP32 meldet seine Geräte-ID.",
              ],
              [
                "Authentifizierung",
                "Kann diese Identität den Nachweis erbringen?",
                "Der Nutzer bestätigt einen Passkey; das Gerät weist einen privaten Schlüssel nach.",
              ],
              [
                "Autorisierung",
                "Welche Aktion darf die bestätigte Identität ausführen?",
                "Das Konto darf nur eigene Projekte sehen; das Gerät darf nur in sein eigenes MQTT-Thema schreiben.",
              ],
            ],
          },
          paragraphs: [
            "Diese drei Schritte gehören zusammen. Ein Name oder eine Geräte-ID allein ist keine Sicherheit, denn beides kann kopiert oder geraten werden. Erst ein belastbarer Nachweis authentifiziert eine Identität. Erst danach entscheidet die Autorisierung für jede Funktion, ob Lesen, Ändern, Löschen oder Administrieren erlaubt ist.",
            "Rechte sollten so klein wie möglich sein: Eine Messstation braucht keinen Administratorzugang, ein normaler Nutzer braucht keine Daten anderer Konten und eine öffentliche Website braucht keinen direkten Datenbankzugriff. Dieses Prinzip heißt Least Privilege – minimale, klar begrenzte Rechte.",
          ],
        },
        {
          id: "security-sessions-tokens",
          heading: "Sessions, Tokens und Rechte",
          paragraphs: [
            "Nach einer erfolgreichen Anmeldung muss ein Dienst nicht bei jedem Klick erneut nach dem Passkey fragen. Er erstellt deshalb eine kurzlebige Sitzung. Im Browser liegt dafür meist ein geschütztes Session-Cookie; bei Programmschnittstellen ist häufig ein Token üblich. Beides ist ein Nachweis für eine bereits geprüfte Anmeldung – kein Passwort und keine dauerhafte Identität.",
            "Ein Token kann zum Beispiel festhalten, für welches Konto es gilt, wann es abläuft und welche Zielgruppe es verwenden darf. Der Server muss trotzdem bei jeder Anfrage prüfen, ob Signatur, Ablaufzeit, Aussteller und beabsichtigter Dienst stimmen. Ein Token darf nicht einfach als vertrauenswürdiger Text behandelt werden.",
            "Tokens und Sessions sind wie Zugangskarten: Wer sie besitzt, kann im erlaubten Umfang handeln. Sie gehören daher nie in Quelltext, öffentliche Repositories, Screenshots oder frei lesbare Browser-Speicher. Begrenzte Laufzeiten, Widerruf nach Sicherheitsereignissen, getrennte Tokens je Dienst und sichere Übertragung über HTTPS verringern den Schaden bei Verlust.",
          ],
        },
        {
          id: "security-cryptography-certificates",
          heading: "Verschlüsselung, Zertifikate und Certificate Authorities",
          paragraphs: [
            "Verschlüsselung schützt den Weg zwischen zwei Endpunkten. Bei HTTPS oder TLS verschlüsselt der Browser die Verbindung zur Website; Dritte im Netzwerk sollen Inhalte, Passwörter oder Tokens nicht mitlesen oder unbemerkt verändern können. TLS allein entscheidet jedoch nicht, wer nach der Verbindung welche Rechte hat – dafür bleiben Authentifizierung und Autorisierung nötig.",
            "Ein Zertifikat ist eine signierte Aussage: Dieser öffentliche Schlüssel gehört zu dieser Internetadresse oder diesem Dienst. Der Server besitzt dazu den passenden privaten Schlüssel und beweist damit beim Verbindungsaufbau seine Identität. Der private Schlüssel bleibt geheim; das Zertifikat darf verteilt werden.",
            "Eine Certificate Authority (CA) ist eine vertrauenswürdige Stelle, deren Signaturen Browser und Betriebssysteme prüfen können. Sie bestätigt nach einem definierten Verfahren, dass ein Zertifikat zu einer Domain gehört. Bei Geräten oder internen Diensten kann eine eigene, private CA sinnvoll sein: Sie stellt Zertifikate nur für bekannte Geräte und Dienste aus. Dann müssen deren Zertifikate, Schlüssel, Laufzeiten und Widerruf genauso sorgfältig verwaltet werden wie Benutzerkonten.",
          ],
        },
        {
          id: "security-attack-scenarios",
          heading: "Typische Angriffsszenarien verstehen",
          table: {
            headers: [
              "Szenario",
              "Was dabei passiert",
              "Wichtige Gegenmaßnahmen",
            ],
            rows: [
              [
                "Man in the Middle",
                "Jemand versucht, sich zwischen Client und Dienst zu schieben – etwa in einem fremden WLAN – um Daten mitzulesen oder Antworten zu verändern.",
                "HTTPS/TLS verwenden, Zertifikatswarnungen ernst nehmen und die Domain prüfen. Ein gültiges Zertifikat bindet den Dienst an seinen Schlüssel und erschwert das unbemerkte Einschleusen eines falschen Servers.",
              ],
              [
                "Gestohlene Sitzung oder gestohlenes Token",
                "Ein Angreifer erhält eine noch gültige Zugangskarte und nutzt sie innerhalb ihrer Rechte.",
                "Tokens kurz halten, nur verschlüsselt übertragen, nicht in Logs oder Browser-Speicher preisgeben, Sitzungen bei Verlust widerrufen und Rechte klein halten.",
              ],
              [
                "Phishing",
                "Eine täuschend echte Seite oder Nachricht bringt Menschen dazu, Zugangsdaten oder Freigaben preiszugeben.",
                "Adresse und Ursprung prüfen, keine geheimen Codes weitergeben, Passkeys und Mehrfaktor-Authentisierung nutzen. Passkeys helfen, weil sie an die echte Website gebunden sind.",
              ],
              [
                "Offener oder ungepatchter Dienst",
                "Ein unnötig erreichbarer oder veralteter Dienst bietet eine zusätzliche Angriffsfläche.",
                "Nicht benötigte Ports schließen, Adminzugänge privat halten, Updates einspielen, Protokolle überwachen und Backups testen.",
              ],
              [
                "Zu weitreichende Berechtigung",
                "Ein echtes Konto oder Gerät darf mehr als seine Aufgabe verlangt; ein Fehler oder Verlust hat dadurch größere Folgen.",
                "Least Privilege, getrennte Rollen und regelmäßige Prüfung von Konten, Schlüssel und Berechtigungen.",
              ],
            ],
          },
          paragraphs: [
            "Die Szenarien zeigen, warum Security aus mehreren Schichten besteht. TLS schützt den Transportweg, aber nicht gegen eine freiwillig auf einer Phishing-Seite eingegebene Freigabe. Ein korrektes Konto schützt nicht, wenn es unnötig Administratorrechte besitzt. Jede Maßnahme begrenzt einen Teil des Risikos; zusammen entstehen robuste Systeme.",
          ],
        },
        {
          id: "security-network-technologies",
          heading: "Netzwerktechnologien: IP, DNS, URLs und Ports",
          paragraphs: [
            "Ein Netzwerk braucht Adressen und Regeln für den Weg dorthin. Eine IP-Adresse benennt eine Netzwerkschnittstelle, ähnlich wie eine Zustelladresse. Im Heimnetz sind häufig private Bereiche wie 192.168.x.x oder 10.x.x.x im Einsatz; sie sind im öffentlichen Internet nicht direkt routbar. Eine öffentliche IP-Adresse kann dagegen aus dem Internet erreichbar sein, wenn Router und Firewall dies erlauben.",
            "Menschen verwenden Namen statt Zahlfolgen. DNS übersetzt einen Namen wie beispiel.de in die passende IP-Adresse. Eine URL beschreibt anschließend genauer, was angesprochen wird: https://beispiel.de:443/app enthält das Protokoll https, den Hostnamen beispiel.de, den optional sichtbaren Port 443 und den Pfad /app. Der Pfad ist nur eine Regel der Web-Anwendung; er öffnet keinen eigenen Netzwerkzugang.",
            "Ein Port unterscheidet Dienste auf derselben IP-Adresse. Vereinfacht hört ein Webserver auf Port 443 für HTTPS, während ein anderer Dienst auf einem anderen Port wartet. Die Zuordnung IP-Adresse plus Port heißt Socket-Endpunkt. Ein Dienst wird erst erreichbar, wenn er dort lauscht und Netzgrenzen wie Firewall, Router oder Cloud-Regeln den Weg erlauben. Nicht benötigte Ports bleiben geschlossen.",
          ],
        },
        {
          id: "security-mqtt",
          heading: "MQTT sicher einsetzen",
          paragraphs: [
            "MQTT verbindet Geräte und Dienste über einen Broker. Ein Gerät veröffentlicht Nachrichten zu einem Topic, andere Systeme abonnieren es. Sicherheit bedeutet hier nicht nur, den Broker mit einem Passwort zu versehen: Der Broker muss erkennen, welches konkrete Gerät oder welcher Dienst verbunden ist und exakt festlegen, welche Topics diese Identität lesen oder beschreiben darf.",
            "TLS verschlüsselt die Verbindung zum Broker. Bei gegenseitigem TLS (mTLS) weist nicht nur der Broker sein Zertifikat vor; auch jedes Gerät besitzt ein eigenes Zertifikat und einen privaten Schlüssel. Der Broker kann dadurch ein Gerät eindeutig prüfen. Alternativ können kurzlebige, gerätespezifische Zugangsdaten verwendet werden. Gemeinsame Zugangsdaten für alle Geräte sind riskant, weil bei Verlust nicht nur ein einzelnes Gerät betroffen ist.",
            "Eine MQTT-ACL ist eine Liste erlaubter Aktionen pro Identität. Ein Temperatursensor darf zum Beispiel nur unter seinem eigenen Mess-Topic veröffentlichen; er darf weder Befehle für andere Geräte schreiben noch fremde Messwerte abonnieren. Die Geräte-ID sollte der Server aus der geprüften Identität ableiten und nicht allein aus einem frei wählbaren Topic-Text übernehmen.",
          ],
          list: [
            "Broker nur auf den tatsächlich benötigten Netzwerkwegen erreichbar machen; Administration und Diagnoseports privat halten.",
            "TLS-Zertifikate, Gerätezugänge und ACLs eindeutig je Gerät oder Dienst verwalten und bei Verlust sperren beziehungsweise rotieren.",
            "Keine Zugangsdaten, Tokens oder privaten Schlüssel in Firmware-Quelltext, Logs oder öffentliche Repositories legen.",
            "Nachrichtenformate, Größenlimits, Raten und erlaubte Topics begrenzen; auffällige fehlgeschlagene Anmeldungen und ACL-Verstöße überwachen.",
            "Wichtige Steuerfunktionen lokal sicher gestalten: Der Ausfall oder Missbrauch einer MQTT-Verbindung darf keinen gefährlichen Zustand verursachen.",
          ],
        },
        {
          id: "security-network-boundaries",
          heading: "Netzgrenzen: Firewall, NAT und Reverse Proxy",
          paragraphs: [
            "Eine Firewall entscheidet anhand von Regeln, welche Verbindungen passieren dürfen. Gute Regeln erlauben nur erwartete Wege: etwa HTTPS für eine öffentliche Website und einen getrennten, privaten Zugang für Administration. Sie ersetzt keine sicheren Anwendungen, reduziert aber die Angriffsfläche erheblich.",
            "NAT (Network Address Translation) übersetzt private Adressen eines Heimnetzes auf eine öffentliche Adresse. Von innen nach außen funktioniert das meist automatisch. Eine Portfreigabe oder Weiterleitung hebt diese Grenze für einen ausgewählten Dienst teilweise auf: Anfragen an den öffentlichen Router-Port werden an einen lokalen Server weitergegeben. Das macht genau diesen Dienst zu einem Internetdienst und muss bewusst entschieden werden.",
            "Ein Reverse Proxy ist ein vorgeschalteter Webserver. Er nimmt HTTPS-Anfragen entgegen, prüft beziehungsweise beendet die TLS-Verbindung und leitet nur erlaubte Pfade an interne Anwendungen weiter. Er kann öffentliche Web-Funktionen von Administration und Datenbanken trennen – aber nur, wenn die internen Dienste nicht zusätzlich frei erreichbar sind. Ein VPN schafft dagegen einen privaten Netzwerkweg für bekannte Geräte und ist für persönliche Administration oft besser geeignet als eine öffentliche Portfreigabe.",
          ],
        },
        {
          id: "security-home-server-strategy",
          heading: "Strategie für einen sicher erreichbaren Home-Server",
          table: {
            headers: [
              "Bedarf",
              "Bevorzugter Weg",
              "Was öffentlich erreichbar ist",
            ],
            rows: [
              [
                "Nur du oder wenige bekannte Personen administrieren den Server",
                "Keine Portfreigabe für die Anwendung; privater Zugang über VPN oder eine gleichwertig starke, identitätsgebundene Zugriffslösung.",
                "Idealerweise nur der VPN-Einstieg. Administration, Home-Server-Oberfläche, SSH und Datenbanken bleiben privat.",
              ],
              [
                "Eine klar abgegrenzte Web-Funktion soll für andere Personen erreichbar sein",
                "Einen vorgeschalteten, gepflegten Reverse Proxy oder einen vertrauenswürdigen Tunnel nutzen. Dahinter nur genau die öffentliche Anwendung freigeben.",
                "Der öffentliche Einstieg der Web-Anwendung, typischerweise HTTPS. Keine Adminoberfläche, Datenbank oder Fernwartung.",
              ],
              [
                "Eine direkte Portfreigabe ist unvermeidbar",
                "Nur einen einzelnen, dokumentierten Dienst über HTTPS veröffentlichen und ihn wie einen kleinen Produktivdienst betreiben.",
                "Genau der weitergeleitete Port zu genau einer internen Adresse und Anwendung – nicht der ganze Rechner und nicht das gesamte Heimnetz.",
              ],
            ],
          },
          paragraphs: [
            "Eine Portfreigabe ist eine gezielte Übersetzung am Router: Sie leitet beispielsweise Anfragen an dessen öffentlichen HTTPS-Port zu einem bestimmten Rechner und Port im Heimnetz weiter. Dadurch erhält nicht automatisch jede Person Zugriff auf deinen Rechner. Sie kann aber genau den Dienst erreichen, der dort lauscht. Hat dieser Dienst eine Sicherheitslücke oder wird sein Konto übernommen, kann ein Angreifer unter Umständen auf die Daten und Netzwerkrechte zugreifen, die dieser Dienst besitzt. Wie weit ein Schaden reicht, hängt von der Anwendung, ihren Berechtigungen und der Netztrennung ab.",
            "Für einen persönlichen Home-Server ist die sichere Standardstrategie deshalb: erst lokal betreiben, Fernadministration über VPN, automatische Portfreigaben durch UPnP deaktivieren oder genau kontrollieren und Router sowie Server aktuell halten. Ein Tunnel oder Reverse Proxy ersetzt diese Regeln nicht; er verschiebt und begrenzt die öffentliche Kante. Für eine wirklich öffentliche Anwendung gehören TLS, starke Anmeldung, getrennte Adminzugänge, minimale Rechte, Updates, Logs, Alarmierung und getestete Backups fest zum Betrieb.",
          ],
          list: [
            "Nie Datenbank-, SSH-, MQTT-Admin- oder Router-Verwaltung direkt für das Internet freigeben.",
            "Auf dem Router nur die exakte Weiterleitung prüfen: öffentlicher Port, internes Ziel, Protokoll und Zweck. Alle anderen eingehenden Wege bleiben gesperrt.",
            "Den Home-Server nach Möglichkeit in ein separates Netz oder VLAN legen. So kann eine kompromittierte Anwendung nicht automatisch auf PCs, Drucker oder andere Geräte zugreifen.",
            "Vor dem Freigeben testen: Ist nur der erwartete Dienst von außen sichtbar? Funktioniert die Anmeldung? Gibt es aktuelle Backups und einen Plan zum Sperren von Zugängen?",
          ],
        },
        {
          id: "security-operation",
          heading: "Sicherer Betrieb",
          list: [
            "Eine einfache Architektur wählen und jede zusätzliche Schnittstelle begründen. Weniger öffentliche Dienste und Rechte bedeuten weniger Angriffsfläche.",
            "Updates für Betriebssystem, Firmware, Bibliotheken und Anwendungen regelmäßig einspielen; nicht mehr benötigte Dienste, Konten und Schlüssel entfernen.",
            "Starke, individuelle Identitäten nutzen: Passkeys oder Schlüssel für Administration, Mehrfaktor-Authentisierung wo möglich, keine gemeinsam genutzten Standardzugänge.",
            "Geheimnisse getrennt vom Quelltext verwalten. Dazu gehören Passwörter, API-Schlüssel, Tokens, private Schlüssel und Wiederherstellungscodes.",
            "Protokolle, fehlgeschlagene Anmeldungen, Konfigurationsänderungen und Dienstzustand überwachen. Ein Alarm ist nur hilfreich, wenn klar ist, wer ihn prüft und was dann geschieht.",
            "Backups getrennt speichern und Wiederherstellungen üben. Ein Backup, das nie erfolgreich zurückgespielt wurde, ist kein belastbarer Schutz.",
            "Vorab festlegen, wie bei Verlust eines Geräts, eines Tokens oder eines Schlüssels reagiert wird: Zugang sperren, Schlüssel rotieren, Sitzungen beenden, Ursache prüfen und betroffene Daten bewerten.",
          ],
        },
      ],
      relatedTopics: [
        "privacy-basics",
        "communication-basics",
        "home-server-internet-security",
        "internet-vps",
        "embedded-safety",
      ],
      access: "premium",
    },
};
