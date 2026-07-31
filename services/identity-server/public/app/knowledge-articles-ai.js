// Wissensspeicher: Künstliche Intelligenz.
const KnowledgeArticlesAi = {
    "ai-basics": {
      title: "Die Künstliche Intelligenz: GPT, Alexa und LLMs",
      summary: "KI ist kein einzelnes Produkt. Entscheidend ist, welche Aufgabe sie lösen soll, wo sie laufen darf und welche Kosten sowie Datenwege dazu passen.",
      access: "premium",
      sections: [
        {
          id: "ai-gpt-and-alexa",
          heading: "GPT und Alexa sind nicht dasselbe",
          paragraphs: [
            "GPT bezeichnet eine Familie großer Sprachmodelle. Solche Modelle können Sprache verstehen und erzeugen, Texte zusammenfassen, Ideen ausarbeiten, Code erklären oder bei Entscheidungen unterstützen. GPT ist dabei das Modell – nicht automatisch eine fertige Anwendung mit Mikrofon, Lautsprecher und Haussteuerung.",
            "Alexa ist dagegen vor allem ein Sprachassistent und ein Produkt: Du sprichst mit einem Gerät oder einer App, die Sprache wird erkannt, eine Anfrage wird verarbeitet und eine Antwort oder Aktion ausgelöst. Klassische Sprachassistenten arbeiten häufig mit fest definierten Befehlen und Diensten, etwa für Timer, Musik oder Smart Home. Sie können LLMs nutzen, sind aber nicht selbst gleichbedeutend mit einem LLM.",
            "Für dein Projekt ist diese Trennung wichtig: Ein Assistent beschreibt die sichtbare Bedienung. Ein LLM ist eine mögliche Denk- und Sprachkomponente dahinter. Dazwischen liegen weiterhin klare Regeln, Berechtigungen, Schnittstellen und die Entscheidung, welche Aktion ein System tatsächlich ausführen darf.",
          ],
        },
        {
          id: "ai-llm",
          heading: "LLM: ein großes Sprachmodell",
          paragraphs: [
            "LLM steht für Large Language Model, also großes Sprachmodell. Vereinfacht gesagt verarbeitet es Text in kleinen Einheiten und berechnet, welche nächste Einheit zu einer Eingabe wahrscheinlich sinnvoll passt. Dadurch kann es Gespräche führen, Inhalte umformulieren und Muster aus vielen Beispielen anwenden.",
            "Ein LLM hat dabei kein eigenes Ziel, keine Wünsche und kein verlässliches Weltverständnis wie ein Mensch. Es erzeugt plausible Antworten auf Grundlage seiner Eingabe und seines Trainings. Deshalb braucht es eine gute Aufgabenbeschreibung, überprüfbare Regeln und bei wichtigen Entscheidungen immer eine menschliche oder technisch klar definierte Kontrolle.",
            "Ein LLM kann als Gesprächspartner dienen, ein Regelmodell für dein Tamagotchi entwerfen oder Texte in strukturierte Daten überführen. Es sollte aber nicht ohne zusätzliche Schutzmechanismen selbstständig Türen öffnen, Geld ausgeben oder sicherheitsrelevante Geräte steuern.",
          ],
        },
        {
          id: "ai-vectors-and-embeddings",
          heading: "Vektoren und Embeddings: Bedeutung als Zahlenraum",
          embeddingVisual: true,
          paragraphs: [
            "Die obere Grafik beginnt links mit einem Inhalt, hier dem Satz: „Das Tamagotchi ist hungrig.“ Ein Vektor ist eine geordnete Liste von Zahlen. In der KI wird dieser Inhalt in sehr viele solche Zahlen übersetzt. Mit Vektorgrafiken hat das nur den Namen gemeinsam: Hier geht es nicht um gezeichnete Linien, sondern um eine technische Zahlenbeschreibung.",
            "In der Mitte entsteht daraus ein Embedding, also ein Zahlenvektor wie [0.12, −0.64, 0.81, …]. Rechts zeigt der Bedeutungsraum, was damit möglich wird: Ähnliche Inhalte liegen als Punkte näher beieinander, deutlich andere Inhalte weiter entfernt. So kann eine Anfrage zu Mikrocontrollern und Netzwerk auch Dokumente finden, die andere, aber fachlich ähnliche Wörter verwenden.",
            "Die untere Grafik zeigt den nächsten Schritt. Eigene Dokumente werden einmal als Dokument-Embeddings gespeichert. Wenn ein Nutzer später eine Anfrage stellt, wird auch diese Anfrage in ein Anfrage-Embedding übersetzt. Das System vergleicht beide Zahlenbeschreibungen und findet die Dokumente, deren Bedeutung am besten zur Frage passt.",
            "Erst danach folgen die eigentliche Systemlogik: passende Quellen auswählen, Regeln und Berechtigungen prüfen und dann eine Antwort oder eine ausdrücklich freigegebene Aktion auslösen. Das wird zum Beispiel für semantische Suche und Retrieval Augmented Generation, kurz RAG, verwendet. Ein Vektor zeigt nur Ähnlichkeit – er ist kein Wahrheitsbeweis und trifft keine Entscheidung selbst.",
          ],
        },
        {
          id: "ai-local-or-online",
          heading: "Lokal oder über das Internet?",
          paragraphs: [
            "Ein internetbasiertes LLM läuft bei einem Anbieter. Dein Gerät sendet die Anfrage über das Internet an dessen Dienst und erhält eine Antwort zurück. Das kann leistungsfähige Modelle ohne eigene starke Hardware ermöglichen. Dafür brauchst du eine Verbindung, musst den Datenweg bewusst bewerten und bist von Verfügbarkeit, Regeln und Preisen des Dienstes abhängig.",
            "Ein lokales LLM läuft auf eigener Hardware: zum Beispiel auf einem PC, einem Server zu Hause oder – bei kleineren Modellen – auf geeigneter Edge-Hardware. Das kann auch ohne Internet funktionieren und gibt dir mehr Kontrolle über Daten und Verfügbarkeit. Im Gegenzug musst du Rechenleistung, Speicher, Energiebedarf, Updates und Betrieb selbst einplanen.",
            "Es gibt keine grundsätzlich bessere Variante. Für eine seltene, anspruchsvolle Frage kann ein Online-Modell sinnvoll sein. Für private Daten, häufige kleine Anfragen oder einen offlinefähigen Assistenten kann ein lokales Modell die bessere Wahl sein. Manchmal ist ein Mischmodell passend: Die eigentliche Steuerung bleibt lokal, nur freiwillige Wissens- oder Kreativaufgaben gehen an einen Online-Dienst.",
          ],
        },
        {
          id: "ai-payment-models",
          heading: "Kosten und Zahlungsmodelle",
          paragraphs: [
            "Bei Online-KI gibt es häufig zwei unterschiedliche Zahlungsarten. Ein Abo bezahlt meist den Zugang zu einer fertigen Anwendung mit bestimmten Funktionen und Grenzen. Es ist nicht automatisch dasselbe wie ein technischer Zugang für deine eigene App oder dein IoT-Projekt.",
            "Für die direkte Einbindung in eigene Software wird oft nutzungsbasiert abgerechnet. Dabei zählen Eingabe und Antwort, meist in Textmengen oder Tokens. Eine einzelne Anfrage kann sehr günstig sein, viele regelmäßige Aufrufe können sich aber summieren. Deshalb gehört zur Architektur immer eine Kostenfrage: Wie oft ist eine KI-Antwort wirklich nötig, und welche günstigere Logik kann dieselbe Aufgabe lokal erledigen?",
            "Ein lokales Modell hat normalerweise keine Abrechnung pro Anfrage durch einen Anbieter. Die Kosten verschwinden dadurch nicht: Hardware, Strom, Speicher, Wartung und gegebenenfalls ein leistungsfähiger PC oder Server gehören zur Rechnung. Ingenieursmäßig gedacht vergleichst du also nicht nur den Preis pro KI-Aufruf, sondern auch Datenschutz, Verfügbarkeit, Antwortzeit, Energiebedarf und den Aufwand für den Betrieb.",
          ],
        },
      ],
      relatedTopics: [
        "from-problem-to-system",
        "server-systems",
        "microcontroller-basics",
      ],
    },
};
