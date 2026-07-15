const HELP_TIMEOUT_MS = 45000;

function createHelpAssistant({ aiContextJson, llmConfigStore, readJsonBody, sendJson, fetchImpl = fetch }) {
  async function handleChat(req, res) {
    const body = await readJsonBody(req);
    const messages = normalizeMessages(body.messages);
    if (!messages.length) {
      sendJson(res, 400, { error: "missing_help_question", message: "Bitte stelle eine Frage fuer GerNetiX Help." });
      return;
    }
    const config = llmConfigStore.resolveRoute("help_chat");
    if (config.provider !== "ollama") {
      sendJson(res, 503, { error: "help_chat_not_local", message: "GerNetiX Help ist ausschliesslich fuer das lokale Ollama-Modell konfiguriert." });
      return;
    }
    try {
      const knowledge = await searchHelpKnowledge(messages.at(-1).content);
      if (!knowledge.items.length) {
        sendJson(res, 200, unavailableKnowledgeResponse());
        return;
      }
      const answer = await callOllama(messages, config, knowledge.items);
      const recommendations = recommendedTopics(messages.at(-1).content);
      sendJson(res, 200, { answer, relatedTopics: recommendations.relatedTopics, openTopicId: recommendations.openTopicId, retrieval: { strategy: knowledge.strategy, article_ids: knowledge.items.map((item) => item.article_id) }, routing: { provider: "ollama", routeTask: "help_chat", costPolicy: "local_only", model: config.ollamaModel } });
    } catch (error) {
      sendJson(res, 503, { error: "help_assistant_unavailable", message: error?.message || "Das lokale Help-Modell ist nicht erreichbar." });
    }
  }

  async function searchHelpKnowledge(question) {
    if (typeof aiContextJson !== "function") return { strategy: "unavailable", items: [] };
    const result = await aiContextJson(`/api/ai-context/help-articles/search?q=${encodeURIComponent(question)}&limit=3`);
    return { strategy: result.strategy || "unknown", items: Array.isArray(result.items) ? result.items : [] };
  }

  async function callOllama(messages, config, articles) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), HELP_TIMEOUT_MS);
    try {
      const response = await fetchImpl(`${config.ollamaBaseUrl.replace(/\/$/, "")}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({ model: config.ollamaModel, stream: false, messages: [{ role: "system", content: helpSystemPrompt(articles) }, ...messages], options: { temperature: 0.2 } }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || `Das lokale Ollama-Modell antwortet mit HTTP ${response.status}.`);
      const answer = String(payload.message?.content || "").trim();
      if (!answer) throw new Error("Das lokale Help-Modell hat keine Antwort geliefert.");
      return answer;
    } finally {
      clearTimeout(timeout);
    }
  }

  function helpSystemPrompt(articles) {
    const context = articles.map((article) => `## ${article.title}\n${article.summary}\n${article.content}`).join("\n\n");
    return "Du bist GerNetiX Help. Antworte kurz und ausschliesslich anhand der folgenden GerNetiX-Hilfeartikel. Wenn sie keine Antwort enthalten, sage das klar. Nutze kein allgemeines Wissen, keine externen Quellen, keine Projekt- oder Accountdaten.\n\n" + context;
  }

  function unavailableKnowledgeResponse() {
    return { answer: "Dazu habe ich in der GerNetiX-Hilfe noch keine passende Information. Bitte öffne einen passenden Hilfeartikel oder frage den Support.", relatedTopics: [], openTopicId: undefined, retrieval: { strategy: "no_matching_help_article", article_ids: [] }, routing: { provider: "ollama", routeTask: "help_chat", costPolicy: "local_only" } };
  }

  function normalizeMessages(items) {
    return (Array.isArray(items) ? items : []).map((item) => ({ role: item.role === "assistant" ? "assistant" : "user", content: String(item.content || "").trim().slice(0, 4000) })).filter((item) => item.content).slice(-10);
  }

  function recommendedTopics(question) {
    const text = String(question || "").toLowerCase();
    if (/pair|pairing|koppel/.test(text)) return response("pair-device", "register-device", "device-not-detected");
    if (/not detected|nicht erkannt|not found|nicht gefunden/.test(text)) return response("device-not-detected", "register-device");
    if (/s3|c6|which esp32|welche.*esp32/.test(text)) return response("esp32-s3", "esp32-c6", "supported-devices");
    if (/flash/.test(text)) return response("flash-device", "register-device");
    return response("quick-start", "register-device", "pair-device", false);
  }

  function response(openTopicId, ...topicIds) {
    const open = topicIds.at(-1) === false ? undefined : openTopicId;
    if (topicIds.at(-1) === false) topicIds.pop();
    return { openTopicId: open, relatedTopics: topicIds.concat(openTopicId).filter((value, index, values) => value && values.indexOf(value) === index).map((topicId) => ({ topicId, title: topicId })) };
  }

  return { handleChat };
}

module.exports = { createHelpAssistant };
