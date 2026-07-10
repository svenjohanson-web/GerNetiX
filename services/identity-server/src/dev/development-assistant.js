function createDevelopmentAssistant({ aiContextJson, aiUsageJson, hardwareCatalogJson, llmConfigStore, projectServerUserId, readJsonBody, requireProjectAccess, sendJson }) {
  async function handleChat(req, res, session) {
    const body = await readJsonBody(req);
    const userMessages = normalizeMessages(body.messages);
    const projectId = cleanProjectId(body.projectId || body.project_id);
    if (!userMessages.length) {
      sendJson(res, 400, { error: "missing_messages", message: "Mindestens eine Nachricht wird benoetigt." });
      return;
    }
    if (!projectId) {
      sendJson(res, 400, { error: "missing_project", message: "Bitte zuerst ein Entwicklungsprojekt auswaehlen oder anlegen." });
      return;
    }
    try {
      const project = requireProjectAccess ? await requireProjectAccess(session, projectId) : null;
      if (project && !["development_project", "custom_project"].includes(project.area || project.type)) {
        sendJson(res, 400, { error: "not_development_project", message: "Bitte ein eigenes Entwicklungsprojekt fuer den Architektur-Chat auswaehlen." });
        return;
      }
      const requestProfile = architectureRequestProfile(userMessages);
      const configuredRoute = routeConfig("architecture_discovery");
      const activeConfig = configuredRoute;
      const localEdit = architectureLocalEdit(userMessages, body.architectureDiagram);
      if (localEdit) {
        sendJson(res, 200, {
          config: config({ requestProfile, localOperation: localEdit.operation }),
          routing: modelOperationRouting(localEdit),
          message: {
            role: "assistant",
            content: localEdit.content,
          },
          architectureDiagram: localEdit.diagram,
          usage: zeroUsage(),
          usageEvent: null,
          usedFallback: false,
          usedLocalRoute: false,
          usedDialogControl: false,
          usedModelOperation: true,
        });
        return;
      }
      if (requestProfile.workModeChoice) {
        const assistantContent = workModeChoiceAnswer(requestProfile.workModeChoice);
        const architectureDiagram = workModeChoiceDiagram(requestProfile.workModeChoice);
        sendJson(res, 200, {
          config: config({ requestProfile }),
          routing: dialogControlRouting(requestProfile),
          message: {
            role: "assistant",
            content: assistantContent,
          },
          architectureDiagram,
          usage: zeroUsage(),
          usageEvent: null,
          usedFallback: false,
          usedLocalRoute: false,
          usedDialogControl: true,
        });
        return;
      }
      const contextAnswer = await architectureContextLookup(userMessages, aiContextJson);
      if (contextAnswer) {
        sendJson(res, 200, {
          config: config({ requestProfile, contextSources: [contextAnswer.source] }),
          routing: contextLookupRouting(contextAnswer),
          message: {
            role: "assistant",
            content: contextAnswer.content,
          },
          usage: zeroUsage(),
          usageEvent: null,
          usedFallback: false,
          usedLocalRoute: false,
          usedDialogControl: false,
          usedContextAnswer: true,
        });
        return;
      }
      const context = await architectureContext(session, activeConfig, projectId);
      const messages = [
        { role: "system", content: await systemPrompt(session, requestProfile) },
        ...context.messages,
        ...userMessages,
      ];
      const usagePreflight = await preflightUsage(session, activeConfig, projectId, messages, "architecture_discovery");
      if (usagePreflight && !usagePreflight.allowed) {
        sendJson(res, 402, {
          error: "ai_usage_rejected",
          message: "Der KI-Aufruf wurde durch AI Usage Cost Control blockiert.",
          usagePreflight,
          routing: routingSummary(activeConfig, requestProfile),
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
      const usage = usageFromProvider(response);
      const usageEvent = await completeUsage(usagePreflight, usage);
      const assistantContent = response.message?.content || fallbackAnswer(userMessages, activeConfig);
      sendJson(res, 200, {
        config: config({ contextSources: context.sources, requestProfile }),
        routing: routingSummary(activeConfig, requestProfile),
        message: {
          role: "assistant",
          content: assistantContent,
        },
        architectureDiagram: buildArchitectureDiagram([...userMessages, { role: "assistant", content: assistantContent }], {
          contextSources: context.sources,
          model: activeConfig.provider === "api" ? activeConfig.apiModel : activeConfig.ollamaModel,
          provider: activeConfig.provider,
          routeTask: activeConfig.routeTask,
        }),
        usage,
        usageEvent,
        usedFallback: false,
        usedLocalRoute: false,
      });
    } catch (error) {
      const assistantContent = fallbackAnswer(userMessages, routeConfig("architecture_discovery"));
      sendJson(res, 200, {
        config: config({ lastError: error.message || String(error) }),
        routing: routingSummary(routeConfig("architecture_discovery"), { complexity: "unknown" }),
        message: {
          role: "assistant",
          content: assistantContent,
        },
        architectureDiagram: null,
        usage: null,
        usedFallback: true,
        error: error.message || String(error),
      });
    }
  }

  function config(extra = {}) {
    return {
      ...llmConfigStore.publicConfig(),
      allowedSources: ["current_chat", "architecture_prompt", "hardware_catalog_if_granted"],
      blockedSources: ["project_files", "customer_data", "graph_database", "external_web"],
      ...extra,
    };
  }

  function routingSummary(activeConfig, requestProfile = {}) {
    const isApi = activeConfig.provider === "api";
    const provider = isApi ? (activeConfig.apiProvider || "openai-compatible") : "ollama";
    return {
      local: !isApi,
      provider,
      label: isApi ? apiProviderLabel(provider) : "Lokal / Ollama",
      model: isApi ? activeConfig.apiModel : activeConfig.ollamaModel,
      routeTask: activeConfig.routeTask || "architecture_discovery",
      routeReason: activeConfig.routeReason || requestProfile.reason || "",
      costPolicy: activeConfig.costPolicy || (isApi ? "external_costs" : "prefer_local"),
      requestComplexity: requestProfile.complexity || "unknown",
    };
  }

  function dialogControlRouting(requestProfile = {}) {
    return {
      local: true,
      provider: "dialog_control",
      label: "System / Dialogsteuerung",
      model: "kein LLM",
      routeTask: "architecture_discovery",
      routeReason: "Exakte Arbeitsweisen-Auswahl wird ohne LLM beantwortet.",
      costPolicy: "no_llm_call",
      requestComplexity: requestProfile.complexity || "dialog_control",
    };
  }

  function contextLookupRouting(contextAnswer = {}) {
    return {
      local: true,
      provider: "context_lookup",
      label: "System / Kontextantwort",
      model: "kein LLM",
      routeTask: "architecture_discovery",
      routeReason: contextAnswer.reason || "Erklaerfrage zu einem bekannten Architekturbaustein wird ohne LLM beantwortet.",
      costPolicy: "no_llm_call",
      requestComplexity: "context_lookup",
    };
  }

  function modelOperationRouting(operation = {}) {
    return {
      local: true,
      provider: "model_operation",
      label: "System / Modelloperation",
      model: "kein LLM",
      routeTask: "architecture_discovery",
      routeReason: operation.reason || "Eindeutige Architektur-Modelloperation wird lokal ausgefuehrt.",
      costPolicy: "no_llm_call",
      requestComplexity: "model_operation",
    };
  }

  function zeroUsage() {
    return {
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      totalDurationMs: 0,
      promptDurationMs: 0,
      completionDurationMs: 0,
    };
  }

  function workModeChoiceAnswer(choice) {
    if (choice === "max") {
      return "Okay. Ich habe eine maximale Startarchitektur angelegt. Entferne danach alles, was du nicht benoetigst.";
    }
    return "Okay. Ich habe eine leere Startarchitektur angelegt. Wir fuegen nur hinzu, was du nennst oder bestaetigst.";
  }

  function workModeChoiceDiagram(choice) {
    return choice === "max" ? maximalStartArchitectureDiagram() : emptyStartArchitectureDiagram();
  }

  function apiProviderLabel(provider) {
    if (provider === "anthropic") return "Claude / Anthropic";
    if (provider === "openai-responses") return "OpenAI";
    return "OpenAI / API";
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
      .slice(-12);
  }

  async function systemPrompt(session, requestProfile = {}) {
    // Prompt-Regeln gehoeren in die AI-Context-SQLite, nicht in Identity-Code.
    // Identity fuegt hier nur dynamischen Laufzeitkontext an.
    return [
      await promptFoundation("architecture_discovery"),
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

  async function architectureContext(session, activeConfig, projectId) {
    const empty = { messages: [], sources: [] };
    if (!aiContextJson || !hardwareCatalogJson) return empty;
    const accountId = projectServerUserId(session);
    const provider = activeConfig.provider === "api" ? "api" : "ollama";
    const model = activeConfig.provider === "api" ? activeConfig.apiModel : activeConfig.ollamaModel;
    try {
      const preflight = await aiContextJson("/api/ai-context/preflight", {
        method: "POST",
        body: {
          account_id: accountId,
          project_id: projectId,
          actor_id: accountId,
          actor_role: "account_owner",
          source_type: "hardware_catalog",
          source_scope: "processor_boards/esp32",
          purpose: "architecture_assistance",
          provider,
          model,
        },
      });
      if (!preflight.allowed) return empty;
      const [capabilities, boards] = await Promise.all([
        hardwareCatalogJson("/api/hardware-catalog/capabilities"),
        hardwareCatalogJson("/api/hardware-catalog/processor-boards"),
      ]);
      const contextText = hardwareCatalogPromptContext(capabilities.items || [], boards.items || []);
      if (!contextText) return empty;
      return {
        messages: [{ role: "system", content: contextText }],
        sources: [{
          source_type: "hardware_catalog",
          source_scope: "processor_boards/esp32",
          redaction_level: preflight.redaction_level,
          audit_event_id: preflight.audit_event_id,
        }],
      };
    } catch {
      return empty;
    }
  }

  function hardwareCatalogPromptContext(capabilities, boards) {
    const capabilityById = new Map(capabilities.map((capability) => [capability.capability_id, capability]));
    const esp32Boards = boards.filter((board) => board.processor_family === "esp32").slice(0, 8);
    if (!esp32Boards.length) return "";
    const boardLines = esp32Boards.map((board) => {
      const caps = (board.capability_ids || [])
        .map((capabilityId) => capabilityById.get(capabilityId)?.title || capabilityId)
        .slice(0, 8)
        .join(", ");
      return `- ${board.title} (${board.mcu_variant || "MCU unbekannt"}, ${board.module_name || "Modul unbekannt"}): ${caps}. Basissoftware: ${board.basissoftware_profile_id || "-"} ${board.min_basissoftware_version ? `ab ${board.min_basissoftware_version}` : ""}`;
    });
    return [
      "Freigegebener Hardware-Catalog-Kontext fuer Architektur-Discovery.",
      "Nutze diese Informationen nur als Orientierung fuer passende ESP32-/IoT-Fragen und Technologie-Kandidaten. Frage weiter nach Zielarchitektur, bevor du konkrete Hardware empfiehlst.",
      "ESP32-ProcessorBoards und Capabilities:",
      ...boardLines,
    ].join("\n");
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
        total_duration: null,
        prompt_eval_duration: null,
        eval_duration: null,
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
            temperature: 0.2,
            ...(Number.isFinite(activeConfig.maxOutputTokens) ? { num_predict: activeConfig.maxOutputTokens } : {}),
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
          max_tokens: 1400,
          messages: conversation,
          system,
          temperature: 0.2,
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
      content: [{ type: message.role === "assistant" ? "output_text" : "input_text", text: message.content }],
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
    const lastUserMessage = [...messages].reverse().find((message) => message.role === "user")?.content || "dein Projekt";
    const providerName = activeConfig.provider === "api" && activeConfig.apiProvider === "anthropic"
      ? "Claude-/Anthropic-Provider"
      : activeConfig.provider === "api" && activeConfig.apiProvider === "openai-responses" ? "OpenAI-Responses-Provider" : activeConfig.provider === "api" ? "OpenAI-kompatiblen LLM-Provider" : "lokalen Ollama-Dienst";
    if (isMinimalEsp32StructureRequest(lastUserMessage)) {
      return [
        `Ich kann den konfigurierten ${providerName} gerade nicht erreichen, aber der Minimalauftrag ist ausreichend konkret.`,
        "",
        `Ausgangspunkt: ${lastUserMessage}`,
        "",
        "Minimale Struktur:",
        "- ESP32",
      ].join("\n");
    }
    return [
      `Ich kann den konfigurierten ${providerName} gerade nicht erreichen, aber wir koennen den Architektur-Dialog strukturiert fortsetzen.`,
      "",
      `Ausgangspunkt: ${lastUserMessage}`,
      "",
      "Pruefe bitte im Admin Tool Provider, Endpoint, Modell und Zugangsdaten.",
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

function buildArchitectureDiagram(messages, options = {}) {
  const normalized = normalizeDiagramMessages(messages);
  const assistantText = normalized.filter((message) => message.role === "assistant").map((message) => message.content).join("\n");
  const fullText = normalized.map((message) => message.content).join("\n");
  const latestUserText = [...normalized].reverse().find((message) => message.role !== "assistant")?.content || fullText;
  const signals = architectureSignals(fullText, assistantText, latestUserText);
  const title = diagramTitle(fullText);
  if (signals.minimalScope) {
    return minimalEsp32ArchitectureDiagram(title, signals);
  }
  const actorInterface = actorInterfaceSignals(fullText);
  const showBrowser = signals.browser || (actorInterface.actor && actorInterface.webserver);
  const lines = [
    "@startuml",
    `title ${plantUmlText(title)}`,
    "",
    "skinparam shadowing false",
    "skinparam componentStyle rectangle",
    "skinparam rectangle {",
    "  BackgroundColor #fbfdff",
    "  BorderColor #8aa0bd",
    "}",
    "skinparam database {",
    "  BackgroundColor #f7fbff",
    "  BorderColor #8aa0bd",
    "}",
    "",
  ];

  if (signals.device) lines.push("node \"IoT Device / ESP32\" as device");
  if (actorInterface.webserver) lines.push("rectangle \"Webserver\" as webserver");
  if (signals.localUi) lines.push("rectangle \"Lokale Bedienung\" as local_ui");
  if (showBrowser) lines.push("rectangle \"Browser\" as browser");
  if (signals.mobile) lines.push("rectangle \"Mobile App\" as mobile");
  if (signals.desktop) lines.push("rectangle \"Desktop App\" as desktop");
  if (signals.backend) lines.push("rectangle \"Backend / API\" as backend");
  if (signals.database) lines.push("database \"Persistenz\" as database");
  if (signals.cloud) lines.push("cloud \"Cloud / Internet\" as cloud");
  if (signals.homeServer) lines.push("node \"HomeServer / lokaler Server\" as homeserver");
  if (signals.hardwareCatalog) lines.push("rectangle \"Hardware Catalog\" as hardware_catalog");
  if (actorInterface.actor) lines.push(`actor "${plantUmlText(actorInterface.label)}" as actor`);

  lines.push("");
  if (actorInterface.actor && actorInterface.webserver) lines.push("actor --> webserver : Zugriff");
  if (actorInterface.actor && actorInterface.webserver && showBrowser) {
    lines[lines.length - 1] = "actor --> browser : nutzt";
    lines.push("browser --> webserver : HTTP");
  }
  if (actorInterface.actor && signals.localUi) lines.push("actor --> local_ui : Bedienung");
  if (actorInterface.actor && signals.browser && !actorInterface.webserver) lines.push("actor --> browser : Bedienung");
  if (actorInterface.actor && signals.mobile) lines.push("actor --> mobile : Bedienung");
  if (actorInterface.actor && signals.desktop) lines.push("actor --> desktop : Bedienung");
  if (actorInterface.webserver && signals.device) lines.push("webserver --> device : lokales Interface");
  if (signals.localUi && signals.device) lines.push("local_ui --> device : Setup / Status");
  if (signals.backend) {
    if (signals.browser) lines.push("browser --> backend : REST / WebSocket");
    if (signals.mobile) lines.push("mobile --> backend : API");
    if (signals.desktop) lines.push("desktop --> backend : API");
    if (signals.device) lines.push("device --> backend : Telemetrie / Befehle");
  }
  if (signals.database && signals.backend) lines.push("backend --> database : speichern / lesen");
  if (signals.database && !signals.backend && signals.device) lines.push("device --> database : Daten speichern");
  if (signals.cloud && signals.backend) lines.push("backend --> cloud : externer Zugriff / Hosting");
  if (signals.homeServer && signals.backend) lines.push("backend --> homeserver : lokaler Betrieb");
  if (signals.hardwareCatalog && signals.device) lines.push("hardware_catalog ..> device : Board- und Capability-Kontext");

  lines.push("@enduml");
  return {
    type: "plantuml",
    title,
    summary: "Technische Struktur aus der letzten Architektur-KI-Antwort.",
    source: lines.join("\n"),
    derived_from: "architecture_discovery_ai_response",
    generated_at: new Date().toISOString(),
    confidence: signals.confidence,
    detected_blocks: signals.detectedBlocks,
  };
}

function architectureRequestProfile(messages) {
  const normalizedMessages = Array.isArray(messages) ? messages : [];
  const text = normalizedMessages
    .map((message) => String(message.content || ""))
    .join("\n")
    .trim();
  const latestUserText = [...normalizedMessages].reverse().find((message) => message.role !== "assistant")?.content || text;
  const explicitMinimal = isMinimalEsp32StructureRequest(latestUserText);
  const workModeChoice = architectureWorkModeChoice(latestUserText);
  return {
    explicitMinimal,
    workModeChoice,
    complexity: workModeChoice ? "dialog_control" : "configured_route",
    reason: "Architektur-Discovery nutzt immer die konfigurierte Architektur-Route.",
  };
}

function architectureWorkModeChoice(value) {
  const text = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[.!?]+$/g, "");
  if (text === "max" || text === "maximal" || text === "maximale architektur") return "max";
  if (text === "leer" || text === "leere architektur" || text === "empty") return "leer";
  return "";
}

function architectureLocalEdit(messages, currentDiagram) {
  const latestUserText = [...(Array.isArray(messages) ? messages : [])].reverse().find((message) => message.role !== "assistant")?.content || "";
  const edit = architectureEditIntent(latestUserText);
  if (!edit) return null;
  if (!currentDiagram?.source) {
    return {
      operation: edit.operation,
      reason: "Eindeutiger Modellbefehl ohne aktuelle Skizze.",
      content: `Ich habe verstanden: ${edit.label}. Es gibt aber noch keine aktuelle Architektur-Skizze, die ich lokal aendern kann.`,
      diagram: null,
    };
  }
  const diagram = applyArchitectureEdit(currentDiagram, edit);
  return {
    operation: edit.operation,
    reason: `Eindeutiger Modellbefehl: ${edit.label}.`,
    content: architectureEditContent(edit, diagram),
    diagram,
  };
}

function architectureEditIntent(value) {
  const text = normalizeLookupText(value);
  const wantsRemove = /\b(entferne|entfernen|entfern|loesche|losche|loesch|losch|nimm|weg|raus|streiche|entfaellt|entfallt)\b/.test(text);
  if (!wantsRemove) return null;
  if (/\b(alles|alle|rest|uebrige|ubrige)\b/.test(text)
    && /\b(bis auf|ausser|außer|except|nur)\b/.test(text)
    && /\besp32\b/.test(text)) {
    return {
      operation: "keep_only_component",
      component: "esp32",
      label: "nur ESP32 behalten",
      detectedBlock: "device",
    };
  }
  const component = removableArchitectureComponents().find((item) => item.match.test(text));
  if (component) {
    return {
      operation: "remove_component",
      ...component,
    };
  }
  return null;
}

function removableArchitectureComponents() {
  return [
    {
      component: "local_ui",
      aliases: ["local_ui"],
      label: "Lokale Bedienung",
      detectedBlock: "localUi",
      match: /\blokale bedienung\b|\blokal bedienen\b|\blocal ui\b|\blocal_ui\b/,
    },
    {
      component: "browser",
      aliases: ["browser"],
      label: "Browser",
      detectedBlock: "browser",
      match: /\bbrowser\b|\bbrowser ui\b|\bweb ui\b|\bwebseite\b|\bweb app\b|\bwebapp\b/,
    },
    {
      component: "mobile",
      aliases: ["mobile"],
      label: "Mobile App",
      detectedBlock: "mobile",
      match: /\bmobile\b|\bmobile app\b|\bhandy app\b|\bsmartphone app\b/,
    },
    {
      component: "desktop",
      aliases: ["desktop"],
      label: "Desktop App",
      detectedBlock: "desktop",
      match: /\bdesktop\b|\bdesktop app\b|\bpc app\b/,
    },
    {
      component: "backend",
      aliases: ["backend"],
      label: "Backend / API",
      detectedBlock: "backend",
      match: /\bbackend\b|\bapi\b|\bserver\b/,
    },
    {
      component: "mqtt",
      aliases: ["mqtt"],
      label: "MQTT Broker",
      detectedBlock: "mqtt",
      match: /\bmqtt\b|\bmqtt broker\b|\bbroker\b/,
    },
    {
      component: "database",
      aliases: ["database"],
      label: "Persistenz",
      detectedBlock: "database",
      match: /\bdatabase\b|\bdatenbank\b|\bsqlite\b|\bpersistenz\b|\bspeicher\b/,
    },
    {
      component: "cloud",
      aliases: ["cloud"],
      label: "Cloud / Internet",
      detectedBlock: "cloud",
      match: /\bcloud\b|\binternet\b|\bextern\b|\bremote\b/,
    },
    {
      component: "homeserver",
      aliases: ["homeserver"],
      label: "HomeServer / lokaler Server",
      detectedBlock: "homeServer",
      match: /\bhomeserver\b|\bhome server\b|\blokaler server\b/,
    },
  ];
}

function applyArchitectureEdit(currentDiagram, edit) {
  if (edit.operation === "keep_only_component" && edit.component === "esp32") {
    return {
      ...minimalEsp32ArchitectureDiagram("Architektur-Skizze: ESP32", { confidence: 1, detectedBlocks: ["device"] }),
      derived_from: "local_architecture_model_operation",
      summary: "Lokal aktualisiert: nur ESP32 behalten.",
      changed: true,
    };
  }
  if (edit.operation !== "remove_component") return { ...currentDiagram, changed: false };
  const source = String(currentDiagram.source || "");
  const aliasPattern = new RegExp(`\\b(${edit.aliases.map(escapeRegExp).join("|")})\\b`, "i");
  const nextLines = source
    .split(/\r?\n/)
    .filter((line) => !aliasPattern.test(line));
  const nextSource = nextLines.join("\n");
  const changed = nextSource !== source;
  return {
    ...currentDiagram,
    source: nextSource,
    summary: changed
      ? `Lokal aktualisiert: ${edit.label} entfernt.`
      : currentDiagram.summary,
    derived_from: "local_architecture_model_operation",
    generated_at: new Date().toISOString(),
    detected_blocks: (currentDiagram.detected_blocks || currentDiagram.detectedBlocks || [])
      .filter((block) => block !== edit.detectedBlock),
    changed,
  };
}

function architectureEditContent(edit, diagram) {
  if (edit.operation === "keep_only_component") {
    return diagram.changed
      ? "Ich habe die aktuelle Architektur-Skizze auf ESP32 reduziert."
      : "Die aktuelle Architektur-Skizze war bereits auf ESP32 reduziert.";
  }
  return diagram.changed
    ? `${edit.label} wurde aus der aktuellen Architektur-Skizze entfernt.`
    : `${edit.label} war in der aktuellen Architektur-Skizze nicht enthalten.`;
}

async function architectureContextLookup(messages, aiContextJson) {
  const latestUserText = [...(Array.isArray(messages) ? messages : [])].reverse().find((message) => message.role !== "assistant")?.content || "";
  if (!isArchitectureComponentQuestion(latestUserText)) return null;
  const components = await loadArchitectureComponents(aiContextJson);
  const match = bestArchitectureComponentMatch(latestUserText, components);
  if (!match || match.score < 2) return null;
  const item = match.component;
  return {
    content: architectureComponentAnswer(item),
    reason: `Erklaerfrage zu ${item.name}.`,
    source: {
      source_type: "architecture_context",
      source_scope: item.source_scope,
      redaction_level: "none",
    },
  };
}

function isArchitectureComponentQuestion(value) {
  const text = normalizeLookupText(value);
  return /\b(wozu|was ist|was macht|warum|erklaer|erklaere|erklar|bedeutung|dient|aufgabe|rolle|brauch|brauche|benoetig|benotig)\b/.test(text);
}

function normalizeLookupText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9/ -]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function loadArchitectureComponents(aiContextJson) {
  if (!aiContextJson) return [];
  try {
    const response = await aiContextJson("/api/ai-context/architecture-components?status=active");
    return Array.isArray(response.items) ? response.items : [];
  } catch {
    return [];
  }
}

function bestArchitectureComponentMatch(question, components) {
  const query = normalizeLookupText(question);
  const queryTokens = lookupTokens(query);
  if (!queryTokens.length) return null;
  return components
    .map((component) => ({ component, score: architectureComponentScore(query, queryTokens, component) }))
    .filter((match) => match.score > 0)
    .sort((left, right) => right.score - left.score)[0] || null;
}

function architectureComponentScore(query, queryTokens, component) {
  const names = [component.name, ...(component.aliases || [])].map(normalizeLookupText).filter(Boolean);
  const corpus = normalizeLookupText([
    component.name,
    ...(component.aliases || []),
    component.summary,
    ...(component.properties || []),
    ...(component.provided_interfaces || []),
    ...(component.required_interfaces || []),
    ...(component.decision_hints || []),
  ].join(" "));
  let score = 0;
  for (const name of names) {
    if (name && query.includes(name)) score += 8;
  }
  const corpusTokens = new Set(lookupTokens(corpus));
  for (const token of queryTokens) {
    if (corpusTokens.has(token)) score += token.length > 3 ? 2 : 1;
  }
  return score;
}

function lookupTokens(value) {
  const stopwords = new Set(["ich", "du", "der", "die", "das", "den", "dem", "ein", "eine", "einen", "einem", "und", "oder", "mit", "ohne", "fuer", "fur", "zu", "wozu", "was", "ist", "macht", "warum", "dient", "brauche", "brauch", "benoetige", "benotige"]);
  return normalizeLookupText(value)
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length >= 2 && !stopwords.has(token));
}

function architectureComponentAnswer(component) {
  const sections = [
    `${component.name}: ${component.summary}`,
  ];
  if ((component.properties || []).length) {
    sections.push(`Eigenschaften: ${component.properties.slice(0, 3).join(", ")}.`);
  }
  if ((component.decision_hints || []).length) {
    sections.push(`Wann sinnvoll: ${component.decision_hints.slice(0, 2).join(" ")}`);
  }
  if ((component.provided_interfaces || []).length || (component.required_interfaces || []).length) {
    const provided = (component.provided_interfaces || []).slice(0, 2).join(", ");
    const required = (component.required_interfaces || []).slice(0, 2).join(", ");
    sections.push([
      provided ? `Stellt bereit: ${provided}.` : "",
      required ? `Braucht: ${required}.` : "",
    ].filter(Boolean).join(" "));
  }
  return sections.join("\n\n");
}

function maximalStartArchitectureDiagram() {
  const lines = [
    "@startuml",
    "title Maximale Startarchitektur",
    "",
    "skinparam shadowing false",
    "skinparam componentStyle rectangle",
    "skinparam rectangle {",
    "  BackgroundColor #fbfdff",
    "  BorderColor #8aa0bd",
    "}",
    "skinparam database {",
    "  BackgroundColor #f7fbff",
    "  BorderColor #8aa0bd",
    "}",
    "",
    "node \"ESP32 / IoT Device\" as esp32",
    "rectangle \"Lokale Bedienung\" as local_ui",
    "rectangle \"Browser UI\" as browser",
    "rectangle \"Mobile App\" as mobile",
    "rectangle \"Desktop App\" as desktop",
    "rectangle \"Backend / API\" as backend",
    "queue \"MQTT Broker\" as mqtt",
    "database \"Persistenz\" as database",
    "cloud \"Cloud / Internet\" as cloud",
    "node \"HomeServer / lokaler Server\" as homeserver",
    "",
    "local_ui --> esp32 : Setup / Status",
    "browser --> backend : HTTP / WebSocket",
    "mobile --> backend : API",
    "desktop --> backend : API",
    "esp32 --> mqtt : Telemetrie / Befehle",
    "mqtt --> backend : Events",
    "esp32 --> backend : REST / direkte API optional",
    "backend --> database : speichern / lesen",
    "backend --> cloud : externer Zugriff",
    "backend --> homeserver : lokaler Betrieb",
    "@enduml",
  ];
  return {
    type: "plantuml",
    title: "Maximale Startarchitektur",
    summary: "Technischer maximaler Startpunkt zum Reduzieren.",
    source: lines.join("\n"),
    derived_from: "dialog_control_work_mode_max",
    generated_at: new Date().toISOString(),
    confidence: 1,
    detected_blocks: ["device", "localUi", "browser", "mobile", "desktop", "backend", "mqtt", "database", "cloud", "homeServer"],
  };
}

function emptyStartArchitectureDiagram() {
  const lines = [
    "@startuml",
    "title Leere Startarchitektur",
    "",
    "skinparam shadowing false",
    "skinparam componentStyle rectangle",
    "skinparam rectangle {",
    "  BackgroundColor #fbfdff",
    "  BorderColor #8aa0bd",
    "}",
    "",
    "rectangle \"Projektstruktur\" as project",
    "note right of project",
    "  Noch keine Komponenten.",
    "  Elemente werden erst hinzugefuegt,",
    "  wenn du sie nennst oder bestaetigst.",
    "end note",
    "@enduml",
  ];
  return {
    type: "plantuml",
    title: "Leere Startarchitektur",
    summary: "Leerer Startpunkt zum gezielten Hinzufuegen.",
    source: lines.join("\n"),
    derived_from: "dialog_control_work_mode_empty",
    generated_at: new Date().toISOString(),
    confidence: 1,
    detected_blocks: [],
  };
}

function minimalEsp32ArchitectureDiagram(title, signals) {
  const lines = [
    "@startuml",
    `title ${plantUmlText(title)}`,
    "",
    "skinparam shadowing false",
    "skinparam componentStyle rectangle",
    "skinparam node {",
    "  BackgroundColor #fbfdff",
    "  BorderColor #8aa0bd",
    "}",
    "",
    "node \"ESP32\" as esp32",
    "@enduml",
  ];
  return {
    type: "plantuml",
    title,
    summary: "Technische Minimalarchitektur fuer ESP32-only.",
    source: lines.join("\n"),
    derived_from: "architecture_discovery_ai_response",
    generated_at: new Date().toISOString(),
    confidence: signals.confidence,
    detected_blocks: signals.detectedBlocks,
  };
}

function missingPromptFoundation(routeTask) {
  return `AI Context Prompt-Grundlage fuer ${routeTask} ist nicht verfuegbar.`;
}

function normalizeDiagramMessages(messages) {
  return (Array.isArray(messages) ? messages : [])
    .map((message) => ({
      role: message.role === "assistant" ? "assistant" : "user",
      content: String(message.content || "").trim(),
    }))
    .filter((message) => message.content)
    .slice(-12);
}

function architectureSignals(fullText, assistantText, latestUserText = fullText) {
  const text = `${assistantText}\n${fullText}`.toLowerCase();
  const latest = String(latestUserText || "").toLowerCase();
  const has = (patterns) => patterns.some((pattern) => pattern.test(text));
  const latestMinimalRequest = isMinimalEsp32StructureRequest(latest);
  const latestStructureExpansion = /\b(webserver|web server|browser|webseite|web app|webapp|mobile app|backend|api|datenbank|sqlite|cloud|mqtt|rest|websocket|messdaten|bereitstellen|bereit\s+stellen|zugriff|greift)\b/.test(latest);
  if (latestMinimalRequest && !latestStructureExpansion) {
    const signals = {
      minimalScope: true,
      device: /esp32/.test(text),
      localUi: false,
      browser: false,
      mobile: false,
      desktop: false,
      backend: false,
      database: false,
      cloud: false,
      homeServer: false,
      hardwareCatalog: false,
    };
    const detectedBlocks = Object.entries(signals).filter(([, value]) => value).map(([key]) => key);
    return {
      ...signals,
      detectedBlocks,
      confidence: Math.min(0.95, Math.max(0.35, detectedBlocks.length / 10)),
    };
  }
  const signals = {
    minimalScope: latestMinimalRequest && !latestStructureExpansion,
    device: has([/esp32/, /iot/, /sensor/, /aktor/, /geraet/, /gerät/, /device/, /board/, /mess/]),
    localUi: has([/lokal/, /setup/, /access point/, /captive/, /statusseite/, /device-webinterface/]),
    browser: has([/browser/, /webseite/, /web app/, /webapp/, /dashboard/, /hmi/]),
    mobile: has([/handy/, /mobile/, /app/, /smartphone/]),
    desktop: has([/desktop/, /pc/, /computer/]),
    backend: has([/backend/, /server/, /api/, /rest/, /websocket/, /mqtt/, /account/]),
    database: has([/datenbank/, /sqlite/, /persistenz/, /speicher/, /messwerte speichern/, /history/, /historie/]),
    cloud: has([/cloud/, /internet/, /weltweit/, /remote/, /extern/]),
    homeServer: has([/homeserver/, /home server/, /raspberry/, /lokaler server/, /lan/]),
    hardwareCatalog: has([/hardware catalog/, /hardware-catalog/, /capabilit/, /processorboard/, /board/]),
  };
  const detectedBlocks = Object.entries(signals).filter(([, value]) => value).map(([key]) => key);
  return {
    ...signals,
    detectedBlocks,
    confidence: Math.min(0.95, Math.max(0.35, detectedBlocks.length / 10)),
  };
}

function actorInterfaceSignals(textValue) {
  const text = String(textValue || "").toLowerCase();
  const hasActor = /\b(nutzer|kunde|user|anwender|bediener|operator)\b/.test(text);
  const hasInterface = /\b(interface|schnittstelle|webserver|web server|browser|webseite|web app|webapp|mobile app|app|bedienung|greift|zugriff)\b/.test(text);
  return {
    actor: hasActor && hasInterface,
    label: /\bkunde\b/.test(text) ? "Kunde" : "Nutzer",
    webserver: /\b(webserver|web server)\b/.test(text),
  };
}

function diagramTitle(text) {
  const firstUserLine = String(text || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line && !/^[-*#\d.]/.test(line));
  const concise = (firstUserLine || "Projektarchitektur")
    .replace(/\s+/g, " ")
    .slice(0, 80);
  return `Architektur-Skizze: ${concise}`;
}

function diagramNotes(assistantText, signals, options) {
  const notes = ["KI-abgeleitete Skizze, keine bestaetigte Architekturentscheidung."];
  const openQuestionLine = String(assistantText || "")
    .split(/\r?\n/)
    .find((line) => /offene frage|offen|unklar|klaeren|klären|\?/.test(line.toLowerCase()));
  if (openQuestionLine) notes.push(`Offen: ${openQuestionLine.replace(/^[-*\d.\s]+/, "").slice(0, 120)}`);
  if (options.contextSources?.length) notes.push("Kontext: freigegebener Hardware-Catalog wurde beruecksichtigt.");
  if (!signals.backend && !signals.database && signals.device && !signals.minimalScope) notes.push("Noch klaeren: nur lokales Device oder Backend/Persistenz?");
  return notes.slice(0, 4);
}

function isMinimalEsp32StructureRequest(value) {
  const text = String(value || "").toLowerCase();
  if (!/esp32/.test(text)) return false;
  if (/\b(entferne|entfernen|entfern|loesche|losche|loesch|losch|nimm|weg|raus|streiche)\b/.test(text)
    && /\b(alles|alle|rest|uebrige|ubrige)\b/.test(text)
    && /\b(bis auf|ausser|außer|except|nur)\b/.test(text)) {
    return true;
  }
  const explicitEsp32Only = /esp32\s*[- ]?\s*only|\bonly\s+(mit\s+)?esp32\b|\barchitektur\s+only\s+(mit\s+)?esp32\b|\b(ausschliesslich|ausschließlich)\s+(mit\s+)?esp32\b|\bnur\s+(ein(en|em)?\s+)?esp32\b|esp32\s+(allein|solo)\b/.test(text);
  if (explicitEsp32Only) return true;
  if (/(struktur|architektur|diagramm|skizze|plantuml)/.test(text)
    && /esp32\s*[- ]?\s*only|\bonly\s+esp32\b|\b(ausschliesslich|ausschließlich)\s+(mit\s+)?esp32\b|\bnur\s+(ein(en|em)?\s+)?esp32\b|esp32\s+(allein|solo)\b/.test(text)) {
    return true;
  }
  const wantsStructure = /struktur|architektur|diagramm|skizze|plantuml/.test(text);
  const minimal = /\bnur\b|minimal|einfach|klein|ohne backend|ohne cloud|ohne datenbank/.test(text);
  const onePort = /\b(ein|einen|einem|1)\s+(esp32[-\s]*)?port\b|\b(esp32[-\s]*)?port\b/.test(text);
  const oneDevice = /\b(ein|einen|einem|1)\s+(esp32|geraet|gerät|device|board)\b/.test(text);
  return wantsStructure && minimal && (onePort || oneDevice);
}

function plantUmlText(value) {
  return String(value || "")
    .replace(/[\r\n]+/g, " ")
    .replace(/"/g, "'")
    .replace(/@enduml/gi, "")
    .replace(/@startuml/gi, "")
    .trim();
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function cleanProjectId(value) {
  return String(value || "").trim().slice(0, 160);
}

module.exports = { createDevelopmentAssistant, buildArchitectureDiagram };
