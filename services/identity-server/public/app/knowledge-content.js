// Wissensspeicher: übergreifendes Fachwissen unabhängig von der Plattformhilfe.
const KnowledgeContent = (() => {
  const topics = [
    {
      id: "engineering-thinking",
      title: "Ingenieursmäßig denken",
      description: "Von einer echten Problemstellung zu einer nachvollziehbaren technischen Lösung.",
      access: "public",
      children: [
        {
          id: "from-problem-to-system",
          title: "Vom Problem zu technischen Grundlagen",
          articleId: "from-problem-to-system",
          access: "public",
        },
      ],
    },
    {
      id: "development-processes",
      title: "Entwicklungsprozesse",
      description: "Entwicklungsphasen und Vorgehensmodelle passend zu Klarheit, Risiko und Veränderung auswählen.",
      access: "public",
      children: [
        {
          id: "development-processes-overview",
          title: "Phasen und Vorgehensmodelle",
          articleId: "development-processes-overview",
          access: "public",
        },
      ],
    },
    {
      id: "electrical-engineering",
      title: "Elektrotechnik",
      description: "Physikalische Grundlagen, Messschaltungen sowie Ein- und Ausgangsbeschaltungen verstehen.",
      access: "public",
      children: [
        {
          id: "electrical-basics-and-component-protection",
          title: "Elektrische Grundbegriffe und Bauteilschutz",
          articleId: "electrical-basics-and-component-protection",
        },
        {
          id: "digital-signals-data-and-protocols",
          title: "Digitale Signale, Daten und Protokolle",
          articleId: "digital-signals-data-and-protocols",
        },
        {
          id: "physical-limits",
          title: "Grenzen der Physik",
          articleId: "physical-limits",
        },
        {
          id: "sampling-rate",
          title: "Abtastrate und Shannon-Theorem",
          articleId: "sampling-rate",
        },
        {
          id: "embedded-safety",
          title: "Elektrische und funktionale Sicherheit",
          articleId: "embedded-safety",
        },
      ],
    },
    {
      id: "sensors-and-actuators",
      title: "Sensorik und Aktorik",
      description: "Wie Systeme ihre Umgebung wahrnehmen, Entscheidungen treffen und darauf wirken – von Physik und Elektronik bis zur Firmware.",
      access: "premium",
      children: [
        {
          id: "sensors",
          title: "Sensoren",
          articleId: "sensors",
        },
        {
          id: "actuators",
          title: "Aktoren",
          articleId: "actuators",
        },
      ],
    },
    {
      id: "microcontrollers-and-embedded",
      title: "Mikrocontroller und Embedded",
      description: "Programmierbare Boards, Prozessoren, Firmware-nahe Schnittstellen und systematische Fehlersuche.",
      access: "public",
      children: [
        {
          id: "hardware-landscape",
          title: "Hardware-Landkarte: vom Akku bis Edge AI",
          articleId: "hardware-landscape",
        },
        {
          id: "processor-overview",
          title: "ESP32-Prozessorfamilien im Vergleich",
          articleId: "processor-overview",
        },
        {
          id: "microcontroller-basics",
          title: "Grundlagen Mikrocontroller",
          articleId: "microcontroller-basics",
        },
        {
          id: "bus-systems",
          title: "Bussysteme",
          articleId: "bus-systems",
        },
        {
          id: "embedded-measurement-debugging",
          title: "Embedded-Systeme: Messtechnik und Debugging",
          articleId: "embedded-measurement-debugging",
        },
      ],
    },
    {
      id: "radio-technologies",
      title: "Funktechnologien",
      description: "Drahtlose Übertragung verstehen und Bluetooth, WLAN, LoRa, Zigbee, NFC sowie RC-Funksysteme begründet auswählen.",
      access: "public",
      children: [
        {
          id: "radio-technologies-understand",
          title: "Funktechnologien verstehen",
          articleId: "radio-technologies-understand",
        },
      ],
    },
    {
      id: "software-basics",
      title: "Informatik und Software",
      description: "Wie Software Regeln und Abläufe beschreibt – auf Mikrocontrollern als Firmware, auf Computern als Anwendungen und Dienste.",
      access: "public",
      children: [
        {
          id: "software-basics-introduction",
          title: "Von der Idee zum ausführbaren Programm",
          articleId: "software-basics-introduction",
        },
        {
          id: "yaml-basics",
          title: "YAML: strukturierte Daten lesbar beschreiben",
          articleId: "yaml-basics",
        },
        {
          id: "databases-and-storage",
          title: "Datenbanken, Speicher und Dateiserver",
          articleId: "databases-and-storage",
        },
        {
          id: "workers-and-queues",
          title: "Worker, Queues und Hintergrundaufgaben",
          articleId: "workers-and-queues",
        },
      ],
    },
    {
      id: "distributed-systems",
      title: "Verteilte Systeme",
      description: "Wie Elektrotechnik, Firmware, Netzwerke, Server und Anwendungen zu einem gemeinsamen System werden.",
      serverLandscape: true,
      access: "public",
      children: [
        {
          id: "distributed-systems-introduction",
          title: "Wenn zwei Welten zusammenarbeiten",
          articleId: "distributed-systems-introduction",
        },
        {
          id: "software-basics",
          title: "Software in verteilten Systemen",
          articleId: "software-basics",
        },
        {
          id: "communication-basics",
          title: "Kommunikation und Schnittstellen",
          articleId: "communication-basics",
        },
        {
          id: "server-systems",
          title: "Systemlandschaften und Server",
          articleId: "server-systems",
        },
        {
          id: "local-servers",
          title: "Lokale Server und Gateways",
          articleId: "local-servers",
        },
        {
          id: "internet-vps",
          title: "Internet-Server und VPS",
          articleId: "internet-vps",
        },
        {
          id: "home-server-internet-security",
          title: "Home-Server sicher betreiben: Risiken der Internetfreigabe",
          articleId: "home-server-internet-security",
        },
        {
          id: "cloud-services",
          title: "Cloud-Dienste",
          articleId: "cloud-services",
        },
        {
          id: "choosing-servers",
          title: "Server passend auswählen",
          articleId: "choosing-servers",
        },
      ],
    },
    {
      id: "artificial-intelligence",
      title: "Die Künstliche Intelligenz",
      description: "KI als Werkzeug verstehen: von Sprachassistenten über GPT bis zu lokalen und internetbasierten Sprachmodellen.",
      access: "public",
      children: [
        {
          id: "ai-basics",
          title: "GPT, Alexa und LLMs",
          articleId: "ai-basics",
        },
      ],
    },
    {
      id: "cross-cutting-topics",
      title: "Querschnittsthemen",
      description: "Themen, die jede Systemebene und jedes Projekt betreffen.",
      access: "public",
      children: [
        {
          id: "privacy-basics",
          title: "Datenschutz in vernetzten Projekten",
          articleId: "privacy-basics",
        },
        {
          id: "security-basics",
          title: "Security in vernetzten Projekten",
          articleId: "security-basics",
        },
      ],
    },
    {
      id: "glossary",
      title: "Lexikon",
      description: "Fachbegriffe kurz, verständlich und mit einem praktischen Beispiel nachschlagen.",
      access: "public",
      children: [
        {
          id: "glossary-basics",
          title: "Fachbegriffe einfach erklärt",
          articleId: "glossary-basics",
        },
      ],
    },
  ];
  const articles = Object.assign(
    {},
    KnowledgeArticlesEngineering,
    KnowledgeArticlesElectricalEngineering,
    KnowledgeArticlesSensorsActuators,
    KnowledgeArticlesEmbedded,
    KnowledgeArticlesRadio,
    KnowledgeArticlesSoftware,
    KnowledgeArticlesDistributedSystems,
    KnowledgeArticlesAi,
    KnowledgeArticlesCrossCutting,
    KnowledgeArticlesGlossary,
  );

  topics
    .flatMap((topic) => topic.children || [])
    .forEach((chapter) => {
      const article = articles[chapter.articleId];
      if (!article) return;
      article.access = chapter.access || "premium";
      chapter.subchapters = (article.sections || [])
        .filter((section) => section.id)
        .map((section) => ({ id: section.id, title: section.heading }));
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
