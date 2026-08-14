const HELP_TIMEOUT_MS = 45000;

function createHelpAssistant({ aiContextJson, aiUsageJson, llmConfigStore, projectServerUserId, accountSubscription, readJsonBody, sendJson, fetchImpl = fetch }) {
  async function handleChat(req, res, session) {
    const body = await readJsonBody(req);
    const messages = normalizeMessages(body.messages);
    if (!messages.length) {
      sendJson(res, 400, { error: "missing_help_question", message: "Bitte stelle eine Frage fuer GerNetiX Help." });
      return;
    }
    const config = llmConfigStore.resolveRoute("help_chat");
    if (config.provider !== "api" || config.apiProvider !== "openai-responses") {
      sendJson(res, 503, { error: "help_chat_provider_not_supported", message: "GerNetiX Help benoetigt die OpenAI Responses API." });
      return;
    }
    let usagePreflight = null;
    try {
      const knowledge = await searchHelpKnowledge(messages.at(-1).content);
      if (!knowledge.items.length) {
        sendJson(res, 200, unavailableKnowledgeResponse(config));
        return;
      }
      usagePreflight = await preflightUsage(session, config, messages, knowledge.items);
      if (usagePreflight && !usagePreflight.allowed) {
        sendJson(res, 402, { error: "ai_usage_rejected", message: "Das KI-Limit fuer GerNetiX Help ist erreicht.", usagePreflight });
        return;
      }
      const response = await callOpenAiResponses(messages, config, knowledge.items);
      const usageEvent = await completeUsage(usagePreflight, response.usage, session);
      const recommendations = recommendedTopics(messages.at(-1).content);
      sendJson(res, 200, { answer: response.answer, relatedTopics: recommendations.relatedTopics, openTopicId: recommendations.openTopicId, retrieval: { strategy: knowledge.strategy, article_ids: knowledge.items.map((item) => item.article_id) }, routing: { provider: "openai-responses", routeTask: "help_chat", costPolicy: "external_costs_with_preflight", model: config.apiModel }, usage: response.usage, usageEvent });
    } catch (error) {
      await failUsage(usagePreflight, error, session);
      sendJson(res, 503, { error: "help_assistant_unavailable", message: error?.message || "Das OpenAI Help-Modell ist nicht erreichbar." });
    }
  }

  async function searchHelpKnowledge(question) {
    if (typeof aiContextJson !== "function") return { strategy: "unavailable", items: [] };
    const result = await aiContextJson(`/api/ai-context/help-articles/search?q=${encodeURIComponent(question)}&limit=3`);
    return { strategy: result.strategy || "unknown", items: Array.isArray(result.items) ? result.items : [] };
  }

  async function callOpenAiResponses(messages, config, articles) {
    if (!config.apiKey) throw new Error("Der OpenAI API-Key fuer GerNetiX Help fehlt.");
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), HELP_TIMEOUT_MS);
    try {
      const response = await fetchImpl(`${config.apiBaseUrl.replace(/\/$/, "")}/responses`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.apiKey}` },
        signal: controller.signal,
        body: JSON.stringify({
          model: config.apiModel,
          store: false,
          max_output_tokens: 400,
          input: [{ role: "developer", content: [{ type: "input_text", text: helpSystemPrompt(articles) }] }, ...messages.map(responseInput)],
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error?.message || payload.error || `OpenAI antwortet mit HTTP ${response.status}.`);
      const answer = openAiOutputText(payload);
      if (!answer) throw new Error("Das OpenAI Help-Modell hat keine Antwort geliefert.");
      return {
        answer,
        usage: {
          promptTokens: Number(payload.usage?.input_tokens || 0),
          completionTokens: Number(payload.usage?.output_tokens || 0),
          totalTokens: Number(payload.usage?.total_tokens || 0),
        },
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  function helpSystemPrompt(articles) {
    const context = articles.map((article) => `## ${article.title}\n${article.summary}\n${article.content}`).join("\n\n");
    return "Du bist GerNetiX Help. Antworte kurz und ausschliesslich anhand der folgenden GerNetiX-Hilfeartikel. Wenn sie keine Antwort enthalten, sage das klar. Nutze kein allgemeines Wissen, keine externen Quellen, keine Projekt- oder Accountdaten.\n\n" + context;
  }

  function unavailableKnowledgeResponse(config) {
    return { answer: "Dazu habe ich in der GerNetiX-Hilfe noch keine passende Information. Bitte öffne einen passenden Hilfeartikel oder frage den Support.", relatedTopics: [], openTopicId: undefined, retrieval: { strategy: "no_matching_help_article", article_ids: [] }, routing: { provider: "openai-responses", routeTask: "help_chat", costPolicy: "no_llm_call", model: config.apiModel } };
  }

  async function preflightUsage(session, config, messages, articles) {
    if (!aiUsageJson) return null;
    const accountId = typeof projectServerUserId === "function" ? projectServerUserId(session) : session?.user_id || "";
    const estimatedInputTokens = Math.ceil((helpSystemPrompt(articles).length + messages.reduce((sum, message) => sum + message.content.length, 0)) / 4);
    return aiUsageJson("/api/ai-usage/preflight", { method: "POST", allowPaymentRequired: true, internalAuth: { scopes: ["ai.usage.consume"], delegation: userDelegation(session) }, body: { account_id: accountId, user_id: accountId, project_id: "", feature: "help_assistance", model: config.apiModel, source_id: "openai_gpt", estimated_input_tokens: estimatedInputTokens, estimated_output_tokens: 400, system_capabilities: [] } });
  }

  async function completeUsage(preflight, usage, session) {
    if (!aiUsageJson || !preflight?.event_id) return null;
    return aiUsageJson(`/api/ai-usage/events/${encodeURIComponent(preflight.event_id)}/complete`, { method: "POST", internalAuth: { scopes: ["ai.usage.consume"], delegation: userDelegation(session) }, body: { input_tokens: usage.promptTokens, output_tokens: usage.completionTokens } }).catch((error) => ({ event_id: preflight.event_id, status: "tracking_failed", error: error.message || String(error) }));
  }

  async function failUsage(preflight, error, session) {
    if (!aiUsageJson || !preflight?.event_id) return null;
    return aiUsageJson(`/api/ai-usage/events/${encodeURIComponent(preflight.event_id)}/fail`, { method: "POST", internalAuth: { scopes: ["ai.usage.consume"], delegation: userDelegation(session) }, body: { error_code: "provider_error", error_message: error.message || String(error) } }).catch(() => null);
  }

  function userDelegation(session) {
    const accountId = typeof projectServerUserId === "function" ? projectServerUserId(session) : session?.user_id || "";
    return { account_id: accountId, project_ids: [], entitlements: accountSubscription?.(session)?.entitlements || [] };
  }

  function responseInput(message) {
    return { role: message.role === "assistant" ? "assistant" : "user", content: [{ type: message.role === "assistant" ? "output_text" : "input_text", text: message.content }] };
  }

  function openAiOutputText(payload) {
    if (String(payload.output_text || "").trim()) return String(payload.output_text).trim();
    return (payload.output || []).flatMap((item) => item.content || []).filter((part) => part.type === "output_text" || part.type === "text").map((part) => part.text || "").join("\n").trim();
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
