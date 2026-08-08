(function attachRequirementsEngine(root, factory) {
  const engine = factory();
  if (typeof module === "object" && module.exports) module.exports = engine;
  root.RequirementsEngine = engine;
})(typeof globalThis !== "undefined" ? globalThis : this, function createRequirementsEngine() {
  const CATEGORY_LABELS = {
    functional: "Funktional",
    nfr: "Nicht-funktional",
    constraint: "Randbedingung",
    rule: "Fachliche Regel",
    open: "Offene Frage"
  };

  const CLASSIFICATION_CARDS = [
    {
      id: "identify-card",
      text: "Die Maschine muss einen Mitarbeiter anhand seines Firmenausweises erkennen.",
      expected: "functional",
      explanation: "Das ist eine konkrete, beobachtbare Fähigkeit des Systems."
    },
    {
      id: "response-time",
      text: "Die Erkennung muss innerhalb von 500 Millisekunden abgeschlossen sein.",
      expected: "nfr",
      explanation: "Die Funktion bleibt dieselbe; hier wird ihre messbare Leistung festgelegt."
    },
    {
      id: "pin-lock",
      text: "Nach drei ungültigen PIN-Eingaben muss der Zugang fünf Minuten gesperrt werden.",
      expected: "functional",
      explanation: "Sicherheit ist das Ziel, der Satz beschreibt aber konkretes Systemverhalten."
    },
    {
      id: "offline",
      text: "Die Anmeldung muss bei einem Netzwerkausfall mindestens acht Stunden funktionieren.",
      expected: "nfr",
      explanation: "Das ist eine messbare Verfügbarkeits- und Betriebsbedingung."
    },
    {
      id: "existing-rfid",
      text: "Die bereits ausgegebenen RFID-Firmenausweise müssen verwendet werden können.",
      expected: "constraint",
      explanation: "Eine vorhandene technische und organisatorische Vorgabe begrenzt die Lösung."
    },
    {
      id: "maintenance-role",
      text: "Nur Mitarbeiter mit der Rolle Wartung dürfen den Servicemodus öffnen.",
      expected: "rule",
      explanation: "Die Aussage legt eine fachliche Berechtigungsregel fest."
    }
  ];

  const KNOWLEDGE_METHODS = [
    {
      id: "rfid",
      title: "RFID- oder Chipkarte",
      factor: "Besitz",
      summary: "Eine Person weist sich mit einem physischen Medium aus.",
      questions: ["Was passiert bei Verlust oder Weitergabe?", "Kann die Maschine die Karte offline prüfen?"]
    },
    {
      id: "passkey",
      title: "Passkey",
      factor: "Gerät / Besitz",
      summary: "Ein Gerät oder Sicherheitsschlüssel bestätigt den Zugang kryptografisch.",
      questions: ["Wie werden Geräte registriert und ersetzt?", "Ist die Nutzung an der Maschine praktikabel?"]
    },
    {
      id: "pki",
      title: "PKI und Zertifikat",
      factor: "Kryptografischer Nachweis",
      summary: "Zertifikate weisen Personen, Geräte oder Software gegenüber einer Vertrauenskette nach.",
      questions: ["Wer stellt Zertifikate aus?", "Wie funktionieren Ablauf und Widerruf?"]
    },
    {
      id: "token",
      title: "Token",
      factor: "Mehrdeutiger Begriff",
      summary: "Kann ein physisches Gerät, Einmalcode oder digitaler Sitzungsnachweis sein.",
      questions: ["Welche Art Token ist gemeint?", "Wer stellt ihn aus und wie lange gilt er?"]
    },
    {
      id: "pin",
      title: "PIN oder Passwort",
      factor: "Wissen",
      summary: "Die Person kennt ein Geheimnis, das geprüft wird.",
      questions: ["Kann es beobachtet oder geteilt werden?", "Wie wird es zurückgesetzt?"]
    },
    {
      id: "multi",
      title: "Mehrere Faktoren",
      factor: "Kombination",
      summary: "Unabhängige Nachweise werden für höheren Schutz kombiniert.",
      questions: ["Für welche Aktionen ist der Mehraufwand nötig?", "Welche Ersatzwege gibt es?"]
    }
  ];

  const TRAPS = [
    {
      id: "fast",
      quote: "Die Anmeldung soll schnell funktionieren.",
      question: "Was muss zuerst geklärt werden?",
      options: [
        { id: "fast-metric", label: "Ob Zeit, Bedienaufwand oder beides gemeint ist", correct: true },
        { id: "fast-tech", label: "Welcher schnellere Kartenleser gekauft wird", correct: false },
        { id: "fast-ignore", label: "Nichts – schnell ist eindeutig", correct: false }
      ],
      lesson: "Subjektive Qualitätswörter müssen in beobachtbare Kriterien übersetzt werden."
    },
    {
      id: "secure",
      quote: "Die Maschine muss PKI verwenden.",
      question: "Welche Rückfrage bringt die Anforderung weiter?",
      options: [
        { id: "secure-goal", label: "Welches Schutzziel soll PKI hier erfüllen?", correct: true },
        { id: "secure-lib", label: "Welche Programmbibliothek soll installiert werden?", correct: false },
        { id: "secure-ok", label: "Keine – PKI beschreibt das Ziel vollständig", correct: false }
      ],
      lesson: "Ein Fachbegriff oder eine Technologie ersetzt weder Ziel noch Einsatzkontext."
    },
    {
      id: "rfid-loss",
      quote: "Mitarbeiter melden sich mit ihrer RFID-Karte an.",
      question: "Welcher Fall fehlt besonders offensichtlich?",
      options: [
        { id: "loss-case", label: "Verlust, Sperrung und mögliche Weitergabe der Karte", correct: true },
        { id: "loss-color", label: "Die Farbe des Firmenausweises", correct: false },
        { id: "loss-none", label: "Keiner – das Verfahren ist festgelegt", correct: false }
      ],
      lesson: "Die Wahl eines Verfahrens öffnet neue Lebenszyklus- und Fehleranforderungen."
    }
  ];

  const containsAny = (text, terms) => terms.some((term) => text.includes(term));

  function analyseProposal(proposal) {
    const original = String(proposal || "").trim();
    const text = original.toLocaleLowerCase("de-DE");
    const understood = [];
    const assumptions = [];
    const unclear = [];

    if (containsAny(text, ["mitarbeiter", "mitarbeitende", "person", "techniker"])) {
      understood.push("Eine Person oder ein Mitarbeiter ist der handelnde Akteur.");
    } else {
      unclear.push("Wer genau nutzt oder startet die Funktion?");
    }
    if (containsAny(text, ["maschine", "anlage", "gerät", "terminal"])) {
      understood.push("Die Interaktion findet an einem technischen System statt.");
    } else {
      unclear.push("An welchem System und in welcher Umgebung findet der Vorgang statt?");
    }
    if (containsAny(text, ["anmeld", "authent", "identifiz", "zugang", "einloggen"])) {
      understood.push("Das System soll eine Identität oder einen Zugang prüfen.");
    } else if (original) {
      understood.push("Es wurde ein gewünschtes Systemverhalten beschrieben.");
    }

    const methodTerms = ["rfid", "karte", "passkey", "zertifikat", "pki", "token", "pin", "passwort", "biometr"];
    if (containsAny(text, methodTerms)) {
      understood.push("Mindestens ein mögliches Nachweisverfahren wurde genannt.");
    } else {
      assumptions.push({
        id: "auth-method",
        title: "Nachweisverfahren",
        text: "Die KI müsste selbst entscheiden, ob Karte, Passkey, Zertifikat, Token, PIN oder eine Kombination gemeint ist.",
        defaultDecision: "open"
      });
    }

    if (!containsAny(text, ["berechtig", "rolle", "darf", "freig", "wartung", "service"])) {
      assumptions.push({
        id: "authorization",
        title: "Berechtigung",
        text: "Nach erfolgreicher Erkennung werden vermutlich bestimmte Maschinenfunktionen freigegeben.",
        defaultDecision: "open"
      });
    }
    if (!containsAny(text, ["fehler", "falsch", "ungültig", "verlust", "gesperrt", "ausfall"])) {
      assumptions.push({
        id: "failure",
        title: "Fehlerfall",
        text: "Bei einem ungültigen, verlorenen oder gesperrten Nachweis wird der Zugang vermutlich verweigert.",
        defaultDecision: "open"
      });
    }
    if (!containsAny(text, ["sekund", "millisekund", "schnell", "sofort"])) {
      unclear.push("Wie schnell muss die Prüfung im Arbeitsalltag sein?");
    }
    if (!containsAny(text, ["offline", "netzwerk", "internet", "verbindung"])) {
      unclear.push("Muss die Prüfung ohne Netzwerkverbindung funktionieren?");
    }
    if (!containsAny(text, ["abmeld", "sitzung", "timeout", "verlassen"])) {
      unclear.push("Wann endet der gewährte Zugang wieder?");
    }

    const vagueTerms = ["schnell", "sicher", "einfach", "benutzerfreundlich", "zuverlässig"]
      .filter((term) => text.includes(term));
    const measurable = /\b\d+\s*(ms|millisekunden?|sekunden?|minuten?|stunden?|%)\b/.test(text);
    const score = Math.max(18, Math.min(92,
      28 + understood.length * 12 + (methodTerms.some((term) => text.includes(term)) ? 9 : 0) +
      (measurable ? 12 : 0) - vagueTerms.length * 4 - assumptions.length * 2
    ));

    return {
      original,
      understood,
      assumptions,
      unclear,
      vagueTerms,
      measurable,
      score
    };
  }

  function buildSpecification(state) {
    const method = KNOWLEDGE_METHODS.find((item) => item.id === state.selectedMethod);
    const context = state.context || {};
    const riskLabels = Array.isArray(context.risks) ? context.risks : [];
    const authSentence = method
      ? `Die Maschine muss Mitarbeiter mit ${method.title} identifizieren.`
      : "Die Maschine muss Mitarbeiter identifizieren; das Nachweisverfahren ist noch festzulegen.";
    const critical = context.critical === "yes"
      ? "Für sicherheitskritische Wartungsfunktionen muss ein zusätzlicher, unabhängiger Nachweis verlangt werden."
      : "Welche Funktionen einen zusätzlichen Nachweis benötigen, ist noch festzulegen.";
    const offline = context.offline === "yes"
      ? "Die Berechtigungsprüfung muss bei einem Netzwerkausfall mindestens acht Stunden weiter funktionieren."
      : "Die erforderliche Offline-Dauer ist noch nicht entschieden.";

    return {
      goal: "Ein Mitarbeiter soll sich an einer Maschine eindeutig ausweisen können, damit nur berechtigte Funktionen freigegeben werden.",
      functional: [
        authSentence,
        "Das System muss die zum Nachweis gehörende Berechtigung prüfen und den Zugang gewähren oder verweigern.",
        "Administratoren müssen verlorene oder kompromittierte Nachweise sperren können.",
        critical
      ],
      nfr: [
        "Die Prüfung muss innerhalb von 500 Millisekunden abgeschlossen sein.",
        offline,
        "Eine Sperrung muss an allen verbundenen Maschinen innerhalb von 30 Sekunden wirksam sein."
      ],
      constraints: method ? [`Als primäres Verfahren wurde ${method.title} ausgewählt.`] : ["Das Nachweisverfahren bleibt offen."],
      rules: [
        "Nur aktive Mitarbeiter mit passender Rolle dürfen geschützte Maschinenfunktionen verwenden.",
        "Ein erkannter Nachweis allein begründet noch keine Berechtigung."
      ],
      acceptance: [
        "Ein aktiver, berechtigter Nachweis gibt die erlaubte Funktion frei.",
        "Ein unbekannter oder gesperrter Nachweis gibt keine geschützte Funktion frei.",
        "Ein Netzwerkausfall wird entsprechend der festgelegten Offline-Regel behandelt.",
        "Eine Sperrung wird innerhalb der festgelegten Wirksamkeitszeit berücksichtigt."
      ],
      open: [
        "Wie werden neue Nachweise ausgegeben, registriert, ersetzt und widerrufen?",
        "Wann endet eine Sitzung automatisch oder durch Abmeldung?",
        ...(riskLabels.length ? [] : ["Welche konkreten Bedrohungen und Fehlanwendungen müssen berücksichtigt werden?"])
      ]
    };
  }

  function calculateResult(state) {
    const classificationAnswers = state.classificationAnswers || {};
    const trapAnswers = state.trapAnswers || {};
    const classificationCorrect = CLASSIFICATION_CARDS.filter(
      (card) => classificationAnswers[card.id] === card.expected
    ).length;
    const trapsCorrect = TRAPS.filter((trap) => {
      const option = trap.options.find((item) => item.id === trapAnswers[trap.id]);
      return option && option.correct;
    }).length;
    const assumptionDecisions = Object.keys(state.assumptionDecisions || {}).length;
    const points = Math.min(100,
      30 + classificationCorrect * 6 + trapsCorrect * 8 +
      (state.selectedMethod ? 8 : 0) + Math.min(8, assumptionDecisions * 4)
    );
    return { points, classificationCorrect, trapsCorrect };
  }

  return {
    CATEGORY_LABELS,
    CLASSIFICATION_CARDS,
    KNOWLEDGE_METHODS,
    TRAPS,
    analyseProposal,
    buildSpecification,
    calculateResult
  };
});
