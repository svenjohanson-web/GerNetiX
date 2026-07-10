function createAiChatAssistant({ aiContextJson, aiUsageJson, llmConfigStore, projectServerUserId, readJsonBody, sendJson }) {
  async function handleChat(req, res, session) {
    const body = await readJsonBody(req);
    const userMessages = normalizeMessages(body.messages);
    if (!userMessages.length) {
      sendJson(res, 400, { error: "missing_messages", message: "Mindestens eine Nachricht wird benoetigt." });
      return;
    }

    try {
      const messages = [
        { role: "system", content: await systemPrompt(session) },
        ...userMessages,
      ];
      const activeConfig = routeConfig("general_chat");
      const usagePreflight = await preflightUsage(session, activeConfig, "", messages, "general_chat");
      if (usagePreflight && !usagePreflight.allowed) {
        sendJson(res, 402, {
          error: "ai_usage_rejected",
          message: "Der KI-Aufruf wurde durch AI Usage Cost Control blockiert.",
          usagePreflight,
        });
        return;
      }
      let response;
      try {
        response = await callChatProvider(messages, activeConfig);
      } catch (error) {
        await failUsage(usagePreflight, error);
        throw error;
      }
      const usage = usageFromOllama(response);
      const usageEvent = await completeUsage(usagePreflight, usage);
      sendJson(res, 200, {
        config: config(),
        message: {
          role: "assistant",
          content: response.message?.content || fallbackAnswer(userMessages, activeConfig),
        },
        usage,
        usageEvent,
        usedFallback: false,
      });
    } catch (error) {
      sendJson(res, 200, {
        config: config({ lastError: error.message || String(error) }),
        message: {
          role: "assistant",
          content: fallbackAnswer(userMessages, routeConfig("general_chat")),
        },
        usage: null,
        usedFallback: true,
        error: error.message || String(error),
      });
    }
  }

  function config(extra = {}) {
    return {
      ...llmConfigStore.publicConfig(),
      allowedSources: ["current_chat"],
      blockedSources: ["project_files", "customer_data", "graph_database", "external_web"],
      ...extra,
    };
  }

  function routeConfig(task) {
    return typeof llmConfigStore.resolveRoute === "function"
      ? llmConfigStore.resolveRoute(task)
      : llmConfigStore.getConfig();
  }

  function normalizeMessages(messages) {
    return (Array.isArray(messages) ? messages : [])
      .map((message) => ({
        role: message.role === "assistant" ? "assistant" : "user",
        content: String(message.content || "").trim().slice(0, 4000),
      }))
      .filter((message) => message.content)
      .slice(-16);
  }

  async function systemPrompt(session) {
    // Prompt-Regeln gehoeren in die AI-Context-SQLite, nicht in Identity-Code.
    // Identity fuegt hier nur dynamischen Laufzeitkontext an.
    return [
      await promptFoundation("general_chat"),
      `Aktueller Nutzer: ${projectServerUserId(session)}.`,
    ].join("\n");
  }

  async function promptFoundation(routeTask) {
    if (!aiContextJson) throw new Error(missingPromptFoundation(routeTask));
    try {
      const response = await aiContextJson(`/api/ai-context/prompt-foundations?route_task=${encodeURIComponent(routeTask)}&status=active`);
      const prompt = (response.items || []).find((item) => item.route_task === routeTask && item.content_kind === "system_prompt");
      if (!prompt?.content) throw new Error(missingPromptFoundation(routeTask));
      return prompt.content;
    } catch (error) {
      throw new Error(error.message || missingPromptFoundation(routeTask));
    }
  }

  async function callChatProvider(messages, activeConfig) {
    if (activeConfig.provider === "api") return callApiChat(messages, activeConfig);
    return callOllamaChat(messages, activeConfig);
  }

  async function callApiChat(messages, activeConfig) {
    if (activeConfig.apiProvider === "anthropic") return callAnthropicChat(messages, activeConfig);
    if (activeConfig.apiProvider === "openai-responses") return callOpenAiResponsesChat(messages, activeConfig);
    return callOpenAiCompatibleChat(messages, activeConfig);
  }

  async function callOpenAiResponsesChat(messages, activeConfig) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000);
    try {
      const response = await fetch(`${activeConfig.apiBaseUrl.replace(/\/$/, "")}/responses`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(activeConfig.apiKey ? { Authorization: `Bearer ${activeConfig.apiKey}` } : {}),
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: activeConfig.apiModel,
          input: responseInput(messages),
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error?.message || payload.error || `OpenAI Responses API antwortet mit HTTP ${response.status}.`);
      }
      return {
        message: {
          content: responseOutputText(payload),
        },
        prompt_eval_count: payload.usage?.input_tokens,
        eval_count: payload.usage?.output_tokens,
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  async function callOllamaChat(messages, activeConfig) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000);
    try {
      const response = await fetch(`${activeConfig.ollamaBaseUrl.replace(/\/$/, "")}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          model: activeConfig.ollamaModel,
          stream: false,
          messages,
          options: {
            temperature: 0.3,
          },
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || `Ollama antwortet mit HTTP ${response.status}.`);
      }
      return payload;
    } finally {
      clearTimeout(timeout);
    }
  }

  async function callOpenAiCompatibleChat(messages, activeConfig) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000);
    try {
      const response = await fetch(`${activeConfig.apiBaseUrl.replace(/\/$/, "")}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(activeConfig.apiKey ? { Authorization: `Bearer ${activeConfig.apiKey}` } : {}),
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: activeConfig.apiModel,
          messages,
          temperature: 0.3,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error?.message || payload.error || `API antwortet mit HTTP ${response.status}.`);
      }
      return {
        message: {
          content: payload.choices?.[0]?.message?.content || "",
        },
        prompt_eval_count: payload.usage?.prompt_tokens,
        eval_count: payload.usage?.completion_tokens,
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  async function callAnthropicChat(messages, activeConfig) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000);
    const system = messages.find((message) => message.role === "system")?.content || "";
    const conversation = messages
      .filter((message) => message.role !== "system")
      .map((message) => ({
        role: message.role === "assistant" ? "assistant" : "user",
        content: message.content,
      }));
    try {
      const response = await fetch(`${activeConfig.apiBaseUrl.replace(/\/$/, "")}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "anthropic-version": "2023-06-01",
          ...(activeConfig.apiKey ? { "x-api-key": activeConfig.apiKey } : {}),
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: activeConfig.apiModel,
          max_tokens: 1024,
          messages: conversation,
          system,
          temperature: 0.3,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error?.message || payload.error || `Anthropic antwortet mit HTTP ${response.status}.`);
      }
      return {
        message: {
          content: (payload.content || []).map((part) => part.text || "").join("").trim(),
        },
        prompt_eval_count: payload.usage?.input_tokens,
        eval_count: payload.usage?.output_tokens,
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  function usageFromOllama(response) {
    const promptTokens = numberOrNull(response.prompt_eval_count);
    const completionTokens = numberOrNull(response.eval_count);
    const totalTokens = promptTokens !== null || completionTokens !== null
      ? (promptTokens || 0) + (completionTokens || 0)
      : null;
    return {
      promptTokens,
      completionTokens,
      totalTokens,
      totalDurationMs: nanosToMs(response.total_duration),
      promptDurationMs: nanosToMs(response.prompt_eval_duration),
      completionDurationMs: nanosToMs(response.eval_duration),
    };
  }

  async function preflightUsage(session, activeConfig, projectId, messages, feature) {
    if (!aiUsageJson) return null;
    const accountId = projectServerUserId(session);
    const model = activeConfig.provider === "api" ? activeConfig.apiModel : activeConfig.ollamaModel;
    const estimate = estimateMessageTokens(messages);
    return aiUsageJson("/api/ai-usage/preflight", {
      method: "POST",
      allowPaymentRequired: true,
      body: {
        account_id: accountId,
        user_id: accountId,
        project_id: projectId || "",
        feature,
        model,
        source_id: activeConfig.provider === "api" ? "openai_gpt" : "local_llm",
        estimated_input_tokens: estimate.inputTokens,
        estimated_output_tokens: Number(activeConfig.maxOutputTokens || 800),
        system_capabilities: activeConfig.provider === "api" ? ["system_capability.ai_premium_models"] : [],
      },
    });
  }

  async function completeUsage(preflight, usage) {
    if (!aiUsageJson || !preflight?.event_id) return null;
    try {
      return await aiUsageJson(`/api/ai-usage/events/${encodeURIComponent(preflight.event_id)}/complete`, {
        method: "POST",
        body: {
          input_tokens: usage.promptTokens ?? 0,
          output_tokens: usage.completionTokens ?? 0,
        },
      });
    } catch (error) {
      return { event_id: preflight.event_id, status: "tracking_failed", error: error.message || String(error) };
    }
  }

  async function failUsage(preflight, error) {
    if (!aiUsageJson || !preflight?.event_id) return null;
    try {
      return await aiUsageJson(`/api/ai-usage/events/${encodeURIComponent(preflight.event_id)}/fail`, {
        method: "POST",
        body: {
          error_code: "provider_error",
          error_message: error.message || String(error),
        },
      });
    } catch {
      return null;
    }
  }

  function responseInput(messages) {
    return messages.map((message) => ({
      role: message.role === "assistant" ? "assistant" : message.role === "system" ? "developer" : "user",
      content: [{ type: "input_text", text: message.content }],
    }));
  }

  function responseOutputText(payload) {
    if (payload.output_text) return payload.output_text;
    return (payload.output || [])
      .flatMap((item) => item.content || [])
      .map((part) => part.text || "")
      .join("")
      .trim();
  }

  function numberOrNull(value) {
    return Number.isFinite(value) ? value : null;
  }

  function estimateMessageTokens(messages) {
    const chars = (Array.isArray(messages) ? messages : [])
      .map((message) => String(message.content || ""))
      .join("\n")
      .length;
    return {
      inputTokens: Math.max(1, Math.ceil(chars / 4)),
    };
  }

  function nanosToMs(value) {
    return Number.isFinite(value) ? Math.round(value / 1000000) : null;
  }

  function fallbackAnswer(messages, activeConfig = llmConfigStore.publicConfig()) {
    const lastUserMessage = [...messages].reverse().find((message) => message.role === "user")?.content || "deine Frage";
    const providerName = activeConfig.provider === "api" && activeConfig.apiProvider === "anthropic"
      ? "Claude-/Anthropic-Provider"
      : activeConfig.provider === "api" && activeConfig.apiProvider === "openai-responses" ? "OpenAI-Responses-Provider"
        : activeConfig.provider === "api" ? "OpenAI-kompatiblen LLM-Provider" : "lokalen Ollama-Dienst";
    return [
      `Ich kann den konfigurierten ${providerName} gerade nicht erreichen.`,
      "",
      `Deine letzte Nachricht war: ${lastUserMessage}`,
      "",
      "Pruefe bitte im Admin Tool:",
      "1. Ist der richtige Provider aktiv?",
      "2. Stimmen Endpoint, Modell und Zugangsdaten?",
      "3. Ist der ausgewaehlte Dienst erreichbar?",
      "",
      "Sobald der Provider erreichbar ist, kann ich hier direkt antworten.",
    ].join("\n");
  }

  return {
    config,
    handleChat,
  };
}

function missingPromptFoundation(routeTask) {
  return `AI Context Prompt-Grundlage fuer ${routeTask} ist nicht verfuegbar.`;
}

module.exports = { createAiChatAssistant };
