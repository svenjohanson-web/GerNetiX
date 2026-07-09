function createDevelopmentAssistant({ aiContextJson, hardwareCatalogJson, llmConfigStore, projectServerUserId, readJsonBody, requireProjectAccess, sendJson }) {
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
      const activeConfig = routeConfig("architecture_discovery");
      const context = await architectureContext(session, activeConfig, projectId);
      const messages = [
        { role: "system", content: systemPrompt(session) },
        ...context.messages,
        ...userMessages,
      ];
      const response = await callChatProvider(messages, activeConfig);
      const assistantContent = response.message?.content || fallbackAnswer(userMessages, activeConfig);
      sendJson(res, 200, {
        config: config({ contextSources: context.sources }),
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
        usage: usageFromProvider(response),
        usedFallback: false,
      });
    } catch (error) {
      const assistantContent = fallbackAnswer(userMessages, routeConfig("architecture_discovery"));
      sendJson(res, 200, {
        config: config({ lastError: error.message || String(error) }),
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

  function systemPrompt(session) {
    return [
      "Du bist der GerNetiX Architektur-Discovery-Assistent in der Kunden-IDE.",
      "Dein Ziel ist nicht sofort Technologie zu empfehlen, sondern zuerst die Zielarchitektur des Nutzerprojekts herzuleiten.",
      "Fuehre den Nutzer mit kurzen, konkreten Fragen. Frage immer nur wenige Punkte auf einmal.",
      "Wenn der Nutzer bewusst einen Minimalumfang vorgibt, z. B. nur eine Struktur, nur ein ESP32, nur ein Port oder ohne Backend/Persistenz, akzeptiere das als ausreichende Vorgabe und liefere direkt eine minimale Struktur statt weitere Klaerungsfragen zu stellen.",
      "Klaere insbesondere: Projektziel, Nutzer, lokale Messung, lokale Regelstrecke, mehrere Geraete, Datenspeicherung, Bedienoberflaeche, lokaler oder weltweiter Zugriff, Computer, Handy, Browser, Backend, Datenschutz, Offline-Verhalten und Betriebsmodell.",
      "Stelle Rueckfragen nur, wenn eine Entscheidung fuer die naechste Struktur zwingend fehlt oder wenn der Nutzer explizit Rueckfragen wuenscht.",
      "Leite erst danach Technologien wie ESP32, WLAN, MQTT, REST, WebSocket, lokale Datenbank, Backend, Webseite, Mobile App oder Desktop App ab.",
      "Markiere Annahmen und offene Fragen sichtbar. Bestaetigte Architekturentscheidungen muessen vom Nutzer bestaetigt werden.",
      "Wenn genug Kontext vorhanden ist, gib eine kurze Struktur mit Zielarchitektur, offenen Fragen, Technologie-Kandidaten und naechstem sinnvollen GerNetiX-Schritt aus.",
      `Aktueller Nutzer: ${projectServerUserId(session)}.`,
    ].join("\n");
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
        "- Nutzer: moechte eine einfache ESP32-Struktur sehen.",
        "- ESP32-Port: ein einzelner lokaler Anschluss oder logischer Einstiegspunkt.",
        "- Keine Annahme fuer Backend, Cloud, Datenbank oder mehrere Geraete.",
        "- Naechster GerNetiX-Schritt: PlantUML-Skizze erzeugen und erst danach erweitern, falls du mehr willst.",
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
  const signals = architectureSignals(fullText, assistantText);
  const title = diagramTitle(fullText);
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
    "actor \"Nutzer\" as user",
    "rectangle \"Projektidee / Anforderungen\" as requirements",
  ];

  if (signals.device) lines.push("node \"IoT Device / ESP32\" as device");
  if (signals.localUi) lines.push("rectangle \"Lokale Bedienung\" as local_ui");
  if (signals.browser) lines.push("rectangle \"Browser App\" as browser");
  if (signals.mobile) lines.push("rectangle \"Mobile App\" as mobile");
  if (signals.desktop) lines.push("rectangle \"Desktop App\" as desktop");
  if (signals.backend) lines.push("rectangle \"Backend / API\" as backend");
  if (signals.database) lines.push("database \"Persistenz\" as database");
  if (signals.cloud) lines.push("cloud \"Cloud / Internet\" as cloud");
  if (signals.homeServer) lines.push("node \"HomeServer / lokaler Server\" as homeserver");
  if (signals.hardwareCatalog) lines.push("rectangle \"Hardware Catalog\" as hardware_catalog");

  lines.push("");
  lines.push("user --> requirements : beschreibt Ziel und Rahmen");
  if (signals.device) lines.push("requirements --> device : Messung / Steuerung");
  if (signals.localUi && signals.device) lines.push("user --> local_ui : lokale Bedienung");
  if (signals.localUi && signals.device) lines.push("local_ui --> device : Setup / Status");
  if (signals.browser) lines.push("user --> browser : Bedienung im Browser");
  if (signals.mobile) lines.push("user --> mobile : Bedienung am Handy");
  if (signals.desktop) lines.push("user --> desktop : Bedienung am Computer");
  if (signals.backend) {
    if (signals.browser) lines.push("browser --> backend : REST / WebSocket");
    if (signals.mobile) lines.push("mobile --> backend : API");
    if (signals.desktop) lines.push("desktop --> backend : API");
    if (signals.device) lines.push("device --> backend : Telemetrie / Befehle");
  }
  if (signals.database && signals.backend) lines.push("backend --> database : speichern / lesen");
  if (signals.database && !signals.backend) lines.push("requirements --> database : Daten speichern");
  if (signals.cloud && signals.backend) lines.push("backend --> cloud : externer Zugriff / Hosting");
  if (signals.homeServer && signals.backend) lines.push("backend --> homeserver : lokaler Betrieb");
  if (signals.hardwareCatalog && signals.device) lines.push("hardware_catalog ..> device : Board- und Capability-Kontext");

  const note = diagramNotes(assistantText, signals, options);
  if (note.length) {
    lines.push("");
    lines.push("note right of requirements");
    for (const item of note) lines.push(`  ${plantUmlText(item)}`);
    lines.push("end note");
  }

  lines.push("@enduml");
  return {
    type: "plantuml",
    title,
    summary: "Aus der letzten Architektur-KI-Antwort abgeleitete PlantUML-Skizze.",
    source: lines.join("\n"),
    derived_from: "architecture_discovery_ai_response",
    generated_at: new Date().toISOString(),
    confidence: signals.confidence,
    detected_blocks: signals.detectedBlocks,
  };
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

function architectureSignals(fullText, assistantText) {
  const text = `${assistantText}\n${fullText}`.toLowerCase();
  const has = (patterns) => patterns.some((pattern) => pattern.test(text));
  const signals = {
    minimalScope: isMinimalEsp32StructureRequest(text),
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

function cleanProjectId(value) {
  return String(value || "").trim().slice(0, 160);
}

module.exports = { createDevelopmentAssistant, buildArchitectureDiagram };
