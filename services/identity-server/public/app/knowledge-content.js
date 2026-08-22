// Wissensspeicher: übergreifendes Fachwissen unabhängig von der Plattformhilfe.
import { KnowledgeChapterIndex } from "@app/knowledge-chapter-index.js";

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
      id: "working-methods",
      title: "Arbeitsmethodiken",
      description: "Entwicklungsprozesse, Versionierung und Varianten so organisieren, dass Entscheidungen und Änderungen nachvollziehbar bleiben.",
      access: "public",
      children: [
        {
          id: "development-processes-overview",
          title: "Entwicklungsprozesse und Vorgehensmodelle",
          articleId: "development-processes-overview",
          access: "public",
        },
        {
          id: "version-control-and-variants",
          title: "Versionierung und Variantenmanagement",
          articleId: "version-control-and-variants",
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
          id: "esp32-gotchas",
          title: "ESP32-Besonderheiten und Stolperfallen",
          articleId: "esp32-gotchas",
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
          id: "browser-pwa-mobile-app",
          title: "Browser-App, PWA oder Mobile App?",
          articleId: "browser-pwa-mobile-app",
          access: "public",
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
  const books = [
    {
      id: "development-processes",
      title: "Entwicklungsprozesse",
      description: "Von der Problemstellung über Modelle und Versionierung bis zu nachvollziehbaren technischen Entscheidungen.",
      topicIds: ["engineering-thinking", "working-methods"],
      access: { type: "free" },
    },
    {
      id: "electrical-engineering",
      title: "Elektrotechnik und Schaltungen",
      description: "Elektrische Grundlagen, Schutz- und Anpassungsschaltungen sowie Sensoren und Aktoren verstehen.",
      topicIds: ["electrical-engineering", "sensors-and-actuators"],
      access: { type: "purchase", requiredEntitlements: ["knowledge_book_electrical_engineering"] },
    },
    {
      id: "microcontrollers-embedded",
      title: "Mikrocontroller und Embedded",
      description: "Chips, Boards, Firmware, Bussysteme und systematische Fehlersuche für eingebettete Geräte.",
      topicIds: ["microcontrollers-and-embedded"],
      access: { type: "subscription", requiredEntitlements: ["knowledge_library"] },
    },
    {
      id: "software-systems",
      title: "Software und Systeme",
      description: "Software, Daten, Kommunikation und verteilte Systeme als zusammenhängende technische Grundlage.",
      topicIds: ["software-basics", "distributed-systems"],
      access: { type: "purchase", requiredEntitlements: ["knowledge_book_software_systems"] },
    },
    {
      id: "networks-ai-security",
      title: "Vernetzung, KI und Sicherheit",
      description: "Funktechnologien, Künstliche Intelligenz, Datenschutz und Security für vernetzte Projekte.",
      topicIds: ["radio-technologies", "artificial-intelligence", "cross-cutting-topics"],
      access: { type: "subscription", requiredEntitlements: ["knowledge_library"] },
    },
    {
      id: "glossary",
      title: "Technisches Lexikon",
      description: "Fachbegriffe kurz, verständlich und mit praktischen Beispielen nachschlagen.",
      topicIds: ["glossary"],
      access: { type: "free" },
    },
  ];
  const assetVersion = "20260812-knowledge-library-3";
  const articleLoadPromises = new Map();
  const registryRoot = typeof window === "undefined" ? globalThis : window;
  const authoredArticles = Object.assign(
    {},
    typeof KnowledgeArticlesEngineering === "undefined" ? {} : KnowledgeArticlesEngineering,
    typeof KnowledgeArticlesElectricalEngineering === "undefined" ? {} : KnowledgeArticlesElectricalEngineering,
    typeof KnowledgeArticlesSensorsActuators === "undefined" ? {} : KnowledgeArticlesSensorsActuators,
    typeof KnowledgeArticlesEmbedded === "undefined" ? {} : KnowledgeArticlesEmbedded,
    typeof KnowledgeArticlesRadio === "undefined" ? {} : KnowledgeArticlesRadio,
    typeof KnowledgeArticlesSoftware === "undefined" ? {} : KnowledgeArticlesSoftware,
    typeof KnowledgeArticlesDistributedSystems === "undefined" ? {} : KnowledgeArticlesDistributedSystems,
    typeof KnowledgeArticlesAi === "undefined" ? {} : KnowledgeArticlesAi,
    typeof KnowledgeArticlesCrossCutting === "undefined" ? {} : KnowledgeArticlesCrossCutting,
    typeof KnowledgeArticlesGlossary === "undefined" ? {} : KnowledgeArticlesGlossary,
  );
  const chapterIndex = typeof KnowledgeChapterIndex === "undefined"
    ? Object.fromEntries(Object.entries(authoredArticles).map(([articleId, article]) => [articleId, {
      asset: `/app/knowledge-chapters/${articleId}.js`,
      title: article.title,
      summary: article.summary,
      sections: (article.sections || []).filter((section) => section.id).map((section) => ({ id: section.id, heading: section.heading })),
    }]))
    : KnowledgeChapterIndex;
  registryRoot.KnowledgeArticleRegistry = Object.assign(registryRoot.KnowledgeArticleRegistry || {}, authoredArticles);
  const articles = Object.fromEntries(Object.entries(chapterIndex).map(([articleId, metadata]) => [articleId,
    authoredArticles[articleId] || {
      title: metadata.title,
      summary: metadata.summary,
      sections: metadata.sections.map((section) => ({ id: section.id, heading: section.heading })),
    },
  ]));

  topics
    .flatMap((topic) => topic.children || [])
    .forEach((chapter) => {
      const article = articles[chapter.articleId];
      if (!article) return;
      article.access = chapter.access || "premium";
      chapter.subchapters = article.sections
        .filter((section) => section.id)
        .map((section) => ({ id: section.id, title: section.heading }));
    });

  function loadedArticle(articleId) {
    const article = registryRoot.KnowledgeArticleRegistry[articleId] || null;
    if (article) article.access = articles[articleId]?.access || "premium";
    return article;
  }

  function loadArticle(articleId) {
    const loaded = loadedArticle(articleId);
    if (loaded) return Promise.resolve(loaded);
    if (!chapterIndex[articleId]) return Promise.reject(new Error(`Unknown knowledge article: ${articleId}`));
    if (articleLoadPromises.has(articleId)) return articleLoadPromises.get(articleId);
    const promise = fetch(`/api/platform/knowledge/chapters/${encodeURIComponent(articleId)}`, {
      cache: "no-store",
      credentials: "same-origin",
    }).then(async (response) => {
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.article) throw new Error(payload.message || `Knowledge article could not be loaded: ${articleId}`);
      payload.article.delivery_access = payload.access;
      registryRoot.KnowledgeArticleRegistry[articleId] = payload.article;
      return loadedArticle(articleId);
    }).catch((error) => {
      articleLoadPromises.delete(articleId);
      throw error;
    });
    articleLoadPromises.set(articleId, promise);
    return promise;
  }

  function prefetchArticle(articleId) {
    // Full chapter content is deliberately fetched only for the active view.
    // Prefetching protected neighbors would place unnecessary content in the browser.
    return Boolean(articleId);
  }

  function findChapterForAnchor(anchorId) {
    for (const topic of topics) {
      const chapter = topic.children?.find((item) => item.id === anchorId || item.subchapters?.some((section) => section.id === anchorId));
      if (chapter) return chapter;
    }
    return null;
  }

  function adjacentArticleIds(chapterId) {
    const chapters = topics.flatMap((topic) => topic.children || []);
    const index = chapters.findIndex((chapter) => chapter.id === chapterId);
    return [chapters[index - 1]?.articleId, chapters[index + 1]?.articleId].filter(Boolean);
  }

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

  function findBook(bookId) {
    return books.find((book) => book.id === bookId) || null;
  }

  function findBookForTopic(topicId) {
    return books.find((book) => book.topicIds.includes(findParentTopic(topicId)?.id)) || null;
  }

  return {
    topics,
    books,
    articles,
    findTopic,
    findParentTopic,
    findBook,
    findBookForTopic,
    findChapterForAnchor,
    loadedArticle,
    loadArticle,
    prefetchArticle,
    adjacentArticleIds,
  };
})();

export {
  KnowledgeContent,
};

/* ---- Uebergangsbruecke ---- */
/*
 * Noch klassisch und liest diese Namen global: help-chat-service.js, information-view.js.
 * Verschwindet mit dem letzten davon.
 */
Object.assign(globalThis, {
  KnowledgeContent,
});
/* ---- /Uebergangsbruecke ---- */
