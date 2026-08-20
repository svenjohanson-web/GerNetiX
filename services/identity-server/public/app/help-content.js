// Geschützter Hilfekatalog: Diese Datei enthält nur den API-Loader, keine Artikeltexte.
const HelpContent = (() => {
  const content = {
    topics: [{ id: "loading", title: "Hilfe", children: [{ id: "quick-start", title: "Hilfe wird geladen", articleId: "loading" }] }],
    articles: { loading: { title: "Hilfe wird geladen", summary: "Die geschützten Inhalte werden geladen.", sections: [] } },
    loading: true,
    findTopic(topicId) {
      for (const topic of this.topics) {
        if (topic.id === topicId) return topic;
        const child = topic.children?.find((entry) => entry.id === topicId);
        if (child) return child;
      }
      return null;
    },
    findParentTopic(topicId) {
      return this.topics.find((topic) => topic.children?.some((entry) => entry.id === topicId)) || null;
    },
  };

  content.ready = fetch("/api/platform/help/content", { credentials: "same-origin", headers: { Accept: "application/json" } })
    .then(async (response) => {
      if (!response.ok) throw new Error("Hilfekatalog nicht verfügbar");
      const payload = await response.json();
      content.topics = payload.topics || [];
      content.articles = payload.articles || {};
      content.loading = false;
      window.dispatchEvent(new CustomEvent("gernetix-help-content-ready"));
      return content;
    })
    .catch((error) => {
      content.loading = false;
      content.error = error.message;
      return content;
    });

  return content;
})();

export {
  HelpContent,
};

