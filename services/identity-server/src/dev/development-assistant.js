function createDevelopmentAssistant({ llmConfigStore, projectServerUserId, readJsonBody, sendJson }) {
  async function handleChat(req, res, session) {
    const body = await readJsonBody(req);
    const userMessages = normalizeMessages(body.messages);
    if (!userMessages.length) {
      sendJson(res, 400, { error: "missing_messages", message: "Mindestens eine Nachricht wird benoetigt." });
      return;
    }
    const messages = [
      { role: "system", content: systemPrompt(session) },
      ...userMessages,
    ];
    try {
      const activeConfig = llmConfigStore.getConfig();
      const response = await callChatProvider(messages, activeConfig);
      sendJson(res, 200, {
        config: config(),
        message: {
          role: "assistant",
          content: response.message?.content || fallbackAnswer(userMessages),
        },
        usage: usageFromProvider(response),
        usedFallback: false,
      });
    } catch (error) {
      sendJson(res, 200, {
        config: config({ lastError: error.message || String(error) }),
        message: {
          role: "assistant",
          content: fallbackAnswer(userMessages),
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
      allowedSources: ["current_chat", "architecture_prompt"],
      blockedSources: ["project_files", "customer_data", "graph_database", "external_web"],
      ...extra,
    };
  }

  function normalizeMessages(messages) {
    return (Array.isArray(messages) ? messages : [])
      .map((message) => ({
        role: message.role === "assistant" ? "assistant" : "user",
        content: String(message.content || "").trim().slice(0, 4000),
      }))
      .filter((message) => message.content)
      .slice(-12);
  }

  function systemPrompt(session) {
    return [
      "Du bist der GerNetiX Architektur-Discovery-Assistent in der Kunden-IDE.",
      "Dein Ziel ist nicht sofort Technologie zu empfehlen, sondern zuerst die Zielarchitektur des Nutzerprojekts herzuleiten.",
      "Fuehre den Nutzer mit kurzen, konkreten Fragen. Frage immer nur wenige Punkte auf einmal.",
      "Klaere insbesondere: Projektziel, Nutzer, lokale Messung, lokale Regelstrecke, mehrere Geraete, Datenspeicherung, Bedienoberflaeche, lokaler oder weltweiter Zugriff, Computer, Handy, Browser, Backend, Datenschutz, Offline-Verhalten und Betriebsmodell.",
      "Leite erst danach Technologien wie ESP32, WLAN, MQTT, REST, WebSocket, lokale Datenbank, Backend, Webseite, Mobile App oder Desktop App ab.",
      "Markiere Annahmen und offene Fragen sichtbar. Bestaetigte Architekturentscheidungen muessen vom Nutzer bestaetigt werden.",
      "Wenn genug Kontext vorhanden ist, gib eine kurze Struktur mit Zielarchitektur, offenen Fragen, Technologie-Kandidaten und naechstem sinnvollen GerNetiX-Schritt aus.",
      `Aktueller Nutzer: ${projectServerUserId(session)}.`,
    ].join("\n");
  }

  async function callChatProvider(messages, activeConfig) {
    if (activeConfig.provider === "api") return callOpenAiCompatibleChat(messages, activeConfig);
    return callOllamaChat(messages, activeConfig);
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
            temperature: 0.2,
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
          temperature: 0.2,
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
        total_duration: null,
        prompt_eval_duration: null,
        eval_duration: null,
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  function usageFromProvider(response) {
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

  function numberOrNull(value) {
    return Number.isFinite(value) ? value : null;
  }

  function nanosToMs(value) {
    return Number.isFinite(value) ? Math.round(value / 1000000) : null;
  }

  function fallbackAnswer(messages) {
    const lastUserMessage = [...messages].reverse().find((message) => message.role === "user")?.content || "dein Projekt";
    return [
      "Ich kann den lokalen Ollama-Dienst gerade nicht erreichen, aber wir koennen den Architektur-Dialog strukturiert fortsetzen.",
      "",
      `Ausgangspunkt: ${lastUserMessage}`,
      "",
      "Bitte beantworte als Naechstes kurz:",
      "1. Soll das System nur lokal messen, lokal regeln oder auch aus der Ferne bedient werden?",
      "2. Gibt es ein oder mehrere Geraete?",
      "3. Muessen Messwerte oder Ereignisse gespeichert werden?",
      "4. Soll die Bedienung am Computer, am Handy, im Browser oder direkt am Geraet stattfinden?",
      "5. Muss der Zugriff nur im lokalen Netzwerk oder weltweit funktionieren?",
      "",
      "Danach leite ich daraus Zielarchitektur, offene Fragen und Technologie-Kandidaten ab.",
    ].join("\n");
  }

  return {
    config,
    handleChat,
  };
}

module.exports = { createDevelopmentAssistant };
