const HelpChatService = (() => {
  async function answer(question, history = []) {
    const text = String(question || "").trim();
    if (!text) throw new Error("Ask a question about GerNetiX, a device or a technical concept.");
    const response = await ApiClient.postJson("/api/platform/help-assistant/chat", {
      messages: [...history, { role: "user", content: text }].slice(-10),
    });
    return {
      ...response,
      relatedTopics: (response.relatedTopics || []).map((topic) => ({ ...topic, title: HelpContent.findTopic(topic.topicId)?.title || topic.title || topic.topicId })),
    };
  }

  return { answer };
})();
