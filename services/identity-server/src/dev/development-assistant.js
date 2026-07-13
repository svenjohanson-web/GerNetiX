const PROVIDER_TIMEOUT_MS = 180000;
const CODE_EXPLORER_FILE_CONTEXT_CHARS = 24000;

function createDevelopmentAssistant({ aiContextJson, aiUsageJson, hardwareCatalogJson, interfaceTelemetry, llmConfigStore, projectServerJson, projectServerUserId, readJsonBody, requireProjectAccess, sendJson }) {
  const responseFileContext = new Map();
  async function handleChat(req, res, session) {
    const body = await readJsonBody(req);
    const userMessages = normalizeMessages(body.messages);
    const previousResponseId = cleanResponseId(body.previousResponseId || body.previous_response_id);
    const projectId = cleanProjectId(body.projectId || body.project_id);
    const assistantMode = cleanAssistantMode(body.assistantMode || body.assistant_mode);
    const functionMode = assistantMode === "function_clarification";
    const effectChainMode = assistantMode === "effect_chain_derivation";
    const codeExplorerMode = assistantMode === "code_explorer";
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
      if (!codeExplorerMode && project && !["development_project", "custom_project"].includes(project.area || project.type)) {
        sendJson(res, 400, { error: "not_development_project", message: "Bitte ein eigenes Entwicklungsprojekt fuer den Architektur-Chat auswaehlen." });
        return;
      }
      const requestProfile = architectureRequestProfile(userMessages, { assistantMode });
      const configuredRoute = routeConfig(codeExplorerMode ? "code_generation" : "architecture_discovery");
      const activeConfig = configuredRoute;
      if (codeExplorerMode && activeConfig.apiProvider !== "openai-responses") {
        throw new Error("Der agentische Projektchat benoetigt derzeit OpenAI Responses mit Function Calling. Es wird kein alter Kontext-Fallback verwendet.");
      }
      const patternShortcut = codeExplorerMode ? null : architecturePatternShortcut(userMessages, { assistantMode });
      if (patternShortcut) {
        sendJson(res, 200, {
          config: config({ requestProfile, dialogControl: patternShortcut.intent }),
          routing: dialogControlRouting(patternShortcut),
          message: {
            role: "assistant",
            content: patternShortcut.content,
          },
          usage: zeroUsage(),
          usageEvent: null,
          usedLocalRoute: false,
          usedDialogControl: true,
        });
        return;
      }
      const localEdit = codeExplorerMode ? null : architectureLocalEdit(userMessages, body.architectureDiagram);
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
          usedLocalRoute: false,
          usedDialogControl: false,
          usedModelOperation: true,
        });
        return;
      }
      const contextAnswer = codeExplorerMode ? null : await architectureContextLookup(userMessages, aiContextJson);
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
          usedLocalRoute: false,
          usedDialogControl: false,
          usedContextAnswer: true,
        });
        return;
      }
      const context = codeExplorerMode ? { messages: [], sources: [] } : await architectureContext(session, activeConfig, projectId);
      const codeContext = codeExplorerMode ? normalizeCodeContext(body.codeContext) : null;
      const messages = [
        ...(!previousResponseId || !codeExplorerMode ? [{ role: "system", content: codeExplorerMode ? await codeExplorerSystemPrompt(session, codeContext) : await systemPrompt(session, requestProfile) }] : []),
        ...(functionMode ? [{ role: "system", content: functionClarificationPrompt(body.architectureDiagram) }] : []),
        ...(effectChainMode ? [{ role: "system", content: effectChainPrompt(body.architectureDiagram) }] : []),
        ...context.messages,
        ...(previousResponseId && codeExplorerMode ? [userMessages.at(-1)] : userMessages),
      ];
      const usagePreflight = await preflightUsage(session, activeConfig, projectId, messages, codeExplorerMode ? "code_explorer_assistance" : effectChainMode ? "architecture_effect_chain_derivation" : functionMode ? "architecture_function_clarification" : "architecture_discovery");
      if (usagePreflight && !usagePreflight.allowed) {
        sendJson(res, 402, {
          error: "ai_usage_rejected",
          message: usageRejectionMessage(usagePreflight),
          usagePreflight,
          routing: routingSummary(activeConfig, requestProfile),
        });
        return;
      }
      let response;
      try {
        response = codeExplorerMode && activeConfig.apiProvider === "openai-responses"
          ? await callOpenAiCodeAgent(messages, activeConfig, project, { previousResponseId, latestUserMessage: userMessages.at(-1) })
          : await callChatProvider(messages, activeConfig);
      } catch (error) {
        await failUsage(usagePreflight, error);
        throw error;
      }
      const usage = usageFromProvider(response);
      const usageEvent = await completeUsage(usagePreflight, usage);
      const rawAssistantContent = String(response.message?.content || "").trim();
      if (!rawAssistantContent) throw new Error("Der konfigurierte KI-Provider hat keine Antwort geliefert.");
      const latestUserRequest = [...userMessages].reverse().find((message) => message.role === "user")?.content || "";
      const effectiveCodeContext = response.toolFiles?.length ? { ...codeContext, files: response.toolFiles } : codeContext;
      const codeResult = codeExplorerMode ? parseCodeExplorerResult(rawAssistantContent, effectiveCodeContext, latestUserRequest) : { content: rawAssistantContent, fileEdits: [] };
      const assistantContent = codeResult.content;
      sendJson(res, 200, {
        config: config({ contextSources: context.sources, requestProfile }),
        routing: routingSummary(activeConfig, requestProfile),
        message: {
          role: "assistant",
          content: assistantContent,
        },
        fileEdits: codeResult.fileEdits,
        architectureDiagram: codeExplorerMode ? undefined : buildArchitectureDiagram([...userMessages, { role: "assistant", content: assistantContent }], {
          contextSources: context.sources,
          model: activeConfig.provider === "api" ? activeConfig.apiModel : activeConfig.ollamaModel,
          provider: activeConfig.provider,
          routeTask: activeConfig.routeTask,
          includeFunctions: functionMode,
          includeEffectChains: effectChainMode,
          currentDiagram: body.architectureDiagram,
        }),
        usage,
        usageBreakdown: response.usage_breakdown || null,
        usageEvent,
        providerResponseId: response.provider_response_id || "",
        usedLocalRoute: false,
      });
    } catch (error) {
      const failedConfig = routeConfig(codeExplorerMode ? "code_generation" : "architecture_discovery");
      const errorMessage = developmentAssistantErrorMessage(error);
      sendJson(res, Number(error.status) >= 400 ? Number(error.status) : 503, {
        error: "development_assistant_unavailable",
        message: errorMessage,
        config: config({ lastError: errorMessage }),
        routing: routingSummary(failedConfig, { complexity: "unknown" }),
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

  function dialogControlRouting(dialogControl = {}) {
    return {
      local: true,
      provider: "dialog_control",
      label: "System / Dialogsteuerung",
      model: "kein LLM",
      routeTask: "architecture_discovery",
      routeReason: dialogControl.reason || "Eindeutige Einstiegsfrage wird ohne LLM beantwortet.",
      costPolicy: "no_llm_call",
      requestComplexity: "dialog_control",
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

  async function codeExplorerSystemPrompt(session, rawContext = {}) {
    const context = rawContext.files ? rawContext : normalizeCodeContext(rawContext);
    return [
      await promptFoundation("general_chat"),
      `Aktueller Nutzer: ${projectServerUserId(session)}.`,
      "Rolle: Projekt-Coding-Agent. Suche und lies nur Dateien, die fuer die konkrete Aufgabe erforderlich sind.",
      `Aktuell geoeffneter Pfad: ${context.path}`,
      context.editTargetPath ? `Verbindliches Aenderungsziel: ${context.editTargetPath}. Andere Dateien duerfen fuer diese Aufgabe nur gelesen, nicht bearbeitet werden.` : "",
      context.focusLines.length ? `Fokuszeilen: ${context.focusLines.join(", ")}` : "",
      context.questions.length ? `Leitfragen des Schritts: ${context.questions.join(" | ")}` : "",
      "Bei Aenderungen: nutze find_and_read_project_sources; bearbeite nur einen dadurch gelesenen Pfad.",
      "Waehle source_kind=architecture fuer Komponenten, Boards, Module, Beziehungen oder Diagramme; source_kind=code nur fuer ausdrueckliche Implementierungs-, Funktions-, Klassen- oder Quellcodeauftraege.",
      "Kurze Folgenachrichten verfeinern die offene Aufgabe. Fuer Architektur genuegen Typ, Name und bekannte Eigenschaften; fehlende GPIO-/Schaltungsdetails bleiben offen.",
      "Aenderungsantwort: ein kurzer Satz plus exakt <gernetix-file-edits>[{\"path\":\"pfad\",\"content\":\"vollstaendiger Inhalt\"}]</gernetix-file-edits>. Kein doppelter Markdown-Code. Ohne Aenderungswunsch kein Edit-Block.",
    ].filter(Boolean).join("\n");
  }

  function normalizeCodeContext(value = {}) {
    let remainingFileChars = CODE_EXPLORER_FILE_CONTEXT_CHARS;
    const files = (Array.isArray(value.files) ? value.files : []).slice(0, 8).map((file) => {
      const content = String(file.content || "").slice(0, remainingFileChars);
      remainingFileChars -= content.length;
      return { path: String(file.path || "").trim().slice(0, 240), content };
    }).filter((file) => file.path && remainingFileChars >= 0);
    return {
      path: String(value.path || "Projektquelle").trim().slice(0, 240),
      editTargetPath: String(value.editTargetPath || "").trim().slice(0, 240),
      content: String(value.content || "").slice(0, 24000),
      focusLines: (Array.isArray(value.focusLines) ? value.focusLines : []).map(Number).filter((line) => line > 0).slice(0, 80),
      questions: (Array.isArray(value.questions) ? value.questions : []).map((item) => String(item).trim().slice(0, 400)).filter(Boolean).slice(0, 12),
      files,
      artifacts: (Array.isArray(value.artifacts) ? value.artifacts : []).slice(0, 12).map((artifact) => ({
        id: String(artifact.id || "").slice(0, 160),
        type: String(artifact.type || "").slice(0, 80),
        title: String(artifact.title || "").slice(0, 240),
        summary: String(artifact.summary || "").slice(0, 1200),
        sourcePath: String(artifact.sourcePath || "").slice(0, 240),
      })),
    };
  }

  function parseCodeExplorerResult(content, context, latestUserRequest = "") {
    const marker = /<gernetix-file-edits>([\s\S]*?)<\/gernetix-file-edits>/i;
    const rawContent = String(content || "");
    const match = rawContent.match(marker);
    const allowedPaths = context.editTargetPath
      ? new Set([context.editTargetPath])
      : new Set((context.files || []).map((file) => file.path));
    if (!match) return recoverCodeExplorerEdit(rawContent, context, latestUserRequest, allowedPaths);
    let parsed = [];
    try {
      parsed = JSON.parse(match[1]);
    } catch {
      parsed = [];
    }
    const fileEdits = (Array.isArray(parsed) ? parsed : []).map((edit) => ({
      path: String(edit.path || "").trim(),
      content: String(edit.content || "").slice(0, 120000),
    })).filter((edit) => allowedPaths.has(edit.path) && edit.content)
      .map((edit) => describeCodeExplorerEdit(edit, context));
    const responseText = removeRepeatedEditCode(rawContent.replace(marker, "").trim(), fileEdits);
    if (isExplicitCodeEditRequest(latestUserRequest) && !fileEdits.length) {
      return { content: "Die vorgeschlagene Änderung hat die serverseitige Dateiprüfung nicht bestanden; es wurde nichts verändert.", fileEdits: [] };
    }
    return {
      content: responseText || (fileEdits.length ? `Aenderung fuer ${fileEdits[0].path} vorbereitet.` : "Es wurde keine gueltige Dateiänderung erzeugt."),
      fileEdits,
    };
  }

  function recoverCodeExplorerEdit(content, context, latestUserRequest, allowedPaths) {
    const editRequest = isExplicitCodeEditRequest(latestUserRequest);
    const currentPath = String(context.path || "").trim();
    const currentFile = resolveCodeExplorerFile(context, currentPath);
    if (!editRequest) return { content, fileEdits: [] };
    if (!currentFile || !allowedPaths.has(currentFile.path)) return { content: "Die KI hat keine serverseitig verifizierte Dateiänderung geliefert; es wurde nichts verändert.", fileEdits: [] };
    const blocks = [...content.matchAll(/```(?:[\w+-]+)?\s*\n([\s\S]*?)```/g)].map((match) => match[1].trim());
    const candidate = blocks.findLast((block) => /@startuml[\s\S]*@enduml/i.test(block)) || blocks.at(-1) || "";
    if (!candidate || candidate === String(currentFile?.content || "").trim()) {
      return { content: "Die KI hat keine übernehmbare Dateiänderung geliefert; es wurde nichts verändert.", fileEdits: [] };
    }
    return {
      content: `Aenderung fuer ${currentFile.path} vorbereitet.`,
      fileEdits: [describeCodeExplorerEdit({ path: currentFile.path, content: candidate.slice(0, 120000) }, context)],
    };
  }

  function isExplicitCodeEditRequest(value) {
    return /\b(f(?:ue|ü)ge|ein(?:fue|fü)ge|erg(?:ae|ä)nze|(?:ae|ä)ndere|entferne|l(?:oe|ö)sche|implementiere|erstelle|schreibe|ersetze|passe|übernehme)\b/i.test(String(value || ""));
  }

  function describeCodeExplorerEdit(edit, context) {
    const previous = (context.files || []).find((file) => file.path === edit.path)?.content || "";
    const before = String(previous).replace(/\r\n/g, "\n").split("\n");
    const after = String(edit.content).replace(/\r\n/g, "\n").split("\n");
    let prefix = 0;
    while (prefix < before.length && prefix < after.length && before[prefix] === after[prefix]) prefix += 1;
    let suffix = 0;
    while (suffix < before.length - prefix && suffix < after.length - prefix
      && before[before.length - 1 - suffix] === after[after.length - 1 - suffix]) suffix += 1;
    const removedLines = Math.max(0, before.length - prefix - suffix);
    const addedLines = Math.max(0, after.length - prefix - suffix);
    const lineStart = prefix + 1;
    const lineEnd = Math.max(lineStart, prefix + addedLines);
    return {
      ...edit,
      lineStart,
      lineEnd,
      addedLines,
      removedLines,
      changeSummary: `${addedLines} Zeile(n) hinzugefuegt, ${removedLines} Zeile(n) entfernt`,
    };
  }

  function resolveCodeExplorerFile(context, currentPath) {
    const files = context.files || [];
    const exact = files.find((file) => file.path === currentPath);
    if (exact) return exact;
    const visibleContent = String(context.content || "").trim();
    const contentMatches = files.filter((file) => visibleContent && String(file.content || "").trim() === visibleContent);
    if (contentMatches.length === 1) return contentMatches[0];
    const normalizedPath = currentPath.replaceAll("\\", "/");
    const suffixMatches = files.filter((file) => {
      const filePath = String(file.path || "").replaceAll("\\", "/");
      return filePath.endsWith(`/${normalizedPath}`) || normalizedPath.endsWith(`/${filePath}`);
    });
    return suffixMatches.length === 1 ? suffixMatches[0] : null;
  }

  function removeRepeatedEditCode(content, fileEdits) {
    if (!fileEdits.length) return content;
    const editContents = new Set(fileEdits.map((edit) => edit.content.trim()));
    return content.replace(/```(?:[\w+-]+)?\s*\n([\s\S]*?)```/g, (block, body) => editContents.has(body.trim()) ? "" : block).trim();
  }

  function functionClarificationPrompt(currentDiagram) {
    const knownBlocks = (currentDiagram?.detected_blocks || currentDiagram?.detectedBlocks || [])
      .filter(Boolean)
      .join(", ");
    return [
      "Aktuelle Phase: Funktion zwischen vorhandenen Strukturelementen klaeren.",
      "Fokus: fachliche Funktionen, Quellen, Senken, Nutzerinteraktionen und Systemgrenzen.",
      "Erklaere kurz, was fachlich passiert. Erzwinge keine Client/Server-, REST- oder UML-Dependency-Sprache.",
      "Pfeile in der PlantUML-Ableitung bedeuten funktionale Interaktion oder Informationsfluss, nicht technische Dependency.",
      knownBlocks ? `Bekannte Strukturkomponenten: ${knownBlocks}.` : "",
    ].filter(Boolean).join("\n");
  }

  function effectChainPrompt(currentDiagram) {
    const knownBlocks = (currentDiagram?.detected_blocks || currentDiagram?.detectedBlocks || [])
      .filter(Boolean)
      .join(", ");
    return [
      "Aktuelle Phase: Wirkketten aus Struktur und Funktion ableiten.",
      "Fokus: Ausloeser, fachlicher Ablauf, Verarbeitung, Speicherung, Anzeige und Ende der Wirkung.",
      "Leite keine technischen UML-Dependencies ab. Client/Server, REST, MQTT oder Pub/Sub sind spaetere Pattern-Ableitungen.",
      "Beschreibe Ketten knapp, z. B. Timer -> ESP32 misst Temperatur -> ESP32 speichert oder publisht -> Server speichert.",
      "Zweite typische Kette: Mensch -> Browser -> Webserver/API -> Daten werden angezeigt.",
      knownBlocks ? `Bekannte Strukturelemente: ${knownBlocks}.` : "",
    ].filter(Boolean).join("\n");
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
    const timeout = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS);
    try {
      const response = await trackedFetch("openai-api", `${activeConfig.apiBaseUrl.replace(/\/$/, "")}/responses`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(activeConfig.apiKey ? { Authorization: `Bearer ${activeConfig.apiKey}` } : {}),
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: activeConfig.apiModel,
          input: responseInput(messages),
          max_output_tokens: Number.isFinite(activeConfig.maxOutputTokens) ? activeConfig.maxOutputTokens : 1400,
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

  async function callOpenAiCodeAgent(messages, activeConfig, project, options = {}) {
    if (!projectServerJson || !project?.project_server_id) throw new Error("Die agentischen Projektwerkzeuge sind nicht konfiguriert.");
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS);
    const toolFiles = new Map(loadResponseFileContext(responseFileContext, options.previousResponseId).map((file) => [file.path, file]));
    let input = responseInput(options.previousResponseId && options.latestUserMessage ? [options.latestUserMessage] : messages);
    let previousResponseId = options.previousResponseId || "";
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    const usageSteps = [];
    try {
      for (let step = 0; step < 3; step += 1) {
        const response = await trackedFetch("openai-api", `${activeConfig.apiBaseUrl.replace(/\/$/, "")}/responses`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(activeConfig.apiKey ? { Authorization: `Bearer ${activeConfig.apiKey}` } : {}),
          },
          signal: controller.signal,
          body: JSON.stringify({
            model: activeConfig.apiModel,
            input,
            ...(previousResponseId ? { previous_response_id: previousResponseId } : {}),
            tools: projectSourceTools(),
            tool_choice: "auto",
            max_output_tokens: Number.isFinite(activeConfig.maxOutputTokens) ? Math.min(activeConfig.maxOutputTokens, 700) : 700,
          }),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error?.message || payload.error || `OpenAI Responses API antwortet mit HTTP ${response.status}.`);
        totalInputTokens += Number(payload.usage?.input_tokens || 0);
        totalOutputTokens += Number(payload.usage?.output_tokens || 0);
        usageSteps.push({
          step: step === 0 ? "request" : "tool_result",
          inputTokens: Number(payload.usage?.input_tokens || 0),
          outputTokens: Number(payload.usage?.output_tokens || 0),
          cachedTokens: Number(payload.usage?.input_tokens_details?.cached_tokens || 0),
        });
        const calls = (payload.output || []).filter((item) => item.type === "function_call");
        if (!calls.length) {
          rememberResponseFileContext(responseFileContext, payload.id, toolFiles);
          return {
            message: { content: responseOutputText(payload) },
            prompt_eval_count: totalInputTokens,
            eval_count: totalOutputTokens,
            toolFiles: [...toolFiles.values()],
            provider_response_id: payload.id || previousResponseId,
            usage_breakdown: { steps: usageSteps },
          };
        }
        previousResponseId = payload.id;
        input = [];
        for (const call of calls) {
          const output = await executeProjectSourceTool(call, project.project_server_id, toolFiles);
          input.push({ type: "function_call_output", call_id: call.call_id, output: JSON.stringify(output) });
        }
      }
      throw new Error("Der Coding Agent hat nach drei Werkzeugschritten noch kein Ergebnis geliefert.");
    } finally {
      clearTimeout(timeout);
    }
  }

  function projectSourceTools() {
    return [{
      type: "function",
      name: "find_and_read_project_sources",
      description: "Findet aufgabenrelevante Projektdateien und liefert bis zu drei Treffer direkt mit Inhalt.",
      strict: true,
      parameters: {
        type: "object",
        properties: {
          query: { type: "string" },
          current_path: { type: "string" },
          source_kind: { type: "string", enum: ["architecture", "code", "configuration", "documentation"] },
        },
        required: ["query", "current_path", "source_kind"],
        additionalProperties: false,
      },
    }];
  }

  function loadResponseFileContext(cache, responseId) {
    const entry = cache.get(responseId);
    if (!entry) return [];
    if (entry.expiresAt < Date.now()) {
      cache.delete(responseId);
      return [];
    }
    return entry.files;
  }

  function rememberResponseFileContext(cache, responseId, toolFiles) {
    if (!responseId || !toolFiles.size) return;
    cache.set(responseId, { files: [...toolFiles.values()], expiresAt: Date.now() + (30 * 60 * 1000) });
    while (cache.size > 100) cache.delete(cache.keys().next().value);
  }

  async function executeProjectSourceTool(call, projectServerId, toolFiles) {
    let args = {};
    try { args = JSON.parse(call.arguments || "{}"); } catch { args = {}; }
    if (call.name === "find_and_read_project_sources") {
      const sourceKind = normalizeProjectSourceKind(args.source_kind);
      const currentPath = String(args.current_path || "").slice(0, 300);
      const query = new URLSearchParams({
        q: sourceKind === "architecture" ? `${String(args.query || "")} Architektur PlantUML`.slice(0, 1000) : String(args.query || "").slice(0, 1000),
        current_path: projectSourceMatchesKind(currentPath, sourceKind) ? currentPath : "",
        source_kind: sourceKind,
        limit: "20",
      });
      const result = await projectServerJson(`/api/projects/${encodeURIComponent(projectServerId)}/sources/search?${query}`);
      const items = (result.items || []).filter((item) => projectSourceMatchesKind(item.path, sourceKind)).slice(0, 3)
        .map((item) => ({ path: item.path, score: item.score, content: String(item.content || "").slice(0, 24000) }));
      items.forEach((item) => toolFiles.set(item.path, { path: item.path, content: item.content }));
      return { source_kind: sourceKind, items };
    }
    return { error: "unknown_tool" };
  }

  function normalizeProjectSourceKind(value) {
    return ["architecture", "code", "configuration", "documentation"].includes(value) ? value : "documentation";
  }

  function projectSourceMatchesKind(pathValue, sourceKind) {
    const path = String(pathValue || "").replaceAll("\\", "/");
    if (sourceKind === "architecture") return /(^|\/)Architektur\/|\.(?:puml|plantuml)$/i.test(path);
    if (sourceKind === "code") return /\.(?:c|cc|cpp|cxx|h|hh|hpp|hxx|ino|py|js|ts|java|rs)$/i.test(path);
    if (sourceKind === "configuration") return /(^|\/)(?:Konfiguration|config)(?:\/|$)|\.(?:json|ya?ml|toml|ini)$/i.test(path);
    return /\.(?:md|txt|adoc)$/i.test(path);
  }

  async function callOllamaChat(messages, activeConfig) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS);
    try {
      const response = await trackedFetch("ollama", `${activeConfig.ollamaBaseUrl.replace(/\/$/, "")}/api/chat`, {
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
    const timeout = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS);
    try {
      const response = await trackedFetch("openai-compatible-api", `${activeConfig.apiBaseUrl.replace(/\/$/, "")}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(activeConfig.apiKey ? { Authorization: `Bearer ${activeConfig.apiKey}` } : {}),
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: activeConfig.apiModel,
          messages,
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
    const timeout = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS);
    const system = messages.find((message) => message.role === "system")?.content || "";
    const conversation = messages
      .filter((message) => message.role !== "system")
      .map((message) => ({
        role: message.role === "assistant" ? "assistant" : "user",
        content: message.content,
      }));
    try {
      const response = await trackedFetch("anthropic-api", `${activeConfig.apiBaseUrl.replace(/\/$/, "")}/messages`, {
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

  async function trackedFetch(targetService, url, options = {}) {
    const startedAt = Date.now();
    try {
      const response = await fetch(url, options);
      interfaceTelemetry?.record({ targetService, method: options.method || "GET", route: new URL(url).pathname, statusCode: response.status, durationMs: Date.now() - startedAt, succeeded: response.ok });
      return response;
    } catch (error) {
      interfaceTelemetry?.record({ targetService, method: options.method || "GET", route: new URL(url).pathname, statusCode: 0, durationMs: Date.now() - startedAt, succeeded: false });
      throw error;
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
        estimated_output_tokens: feature === "code_explorer_assistance" ? Math.min(Number(activeConfig.maxOutputTokens || 700), 700) : Number(activeConfig.maxOutputTokens || 800),
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

  function developmentAssistantErrorMessage(error) {
    if (error?.name === "AbortError" || /operation was aborted|aborted due to timeout/i.test(String(error?.message || ""))) {
      return "Der KI-Provider hat nicht innerhalb von 180 Sekunden geantwortet. Der Aufruf wurde beendet; es wurde keine Datei verändert.";
    }
    return error?.message || "Der konfigurierte KI-Dienst ist nicht erreichbar.";
  }

  function cleanResponseId(value) {
    const responseId = String(value || "").trim();
    return /^resp_[A-Za-z0-9_-]+$/.test(responseId) ? responseId : "";
  }

  function usageRejectionMessage(preflight = {}) {
    const reason = preflight.rejection_reason || "unknown";
    if (reason === "daily_limit_exceeded") return `KI-Tageslimit erreicht: ${preflight.daily_usage_tokens || 0} von ${preflight.daily_limit_tokens || 0} Tokens wurden heute verwendet.`;
    if (reason === "monthly_limit_exceeded") return `KI-Monatslimit erreicht: ${preflight.monthly_usage_tokens || 0} von ${preflight.monthly_limit_tokens || 0} Tokens wurden verwendet.`;
    if (reason === "source_token_limit_exceeded") return "Das Tokenlimit des gewählten KI-Anbieters ist für diesen Monat erreicht.";
    if (reason === "insufficient_credits") return "Für diese KI-Anfrage sind nicht genügend Credits verfügbar.";
    if (reason === "premium_model_not_allowed") return "Das gewählte Premium-Modell ist für diesen Account nicht freigegeben.";
    if (reason === "model_not_allowed") return "Das gewählte KI-Modell ist in der aktuellen Modellpolicy nicht freigegeben.";
    return `Der KI-Aufruf wurde durch die Kostenkontrolle blockiert (${reason}).`;
  }

  function nanosToMs(value) {
    return Number.isFinite(value) ? Math.round(value / 1000000) : null;
  }

  return {
    config,
    handleChat,
  };
}

function buildArchitectureDiagram(messages, options = {}) {
  const normalized = normalizeDiagramMessages(messages);
  const assistantText = normalized.filter((message) => message.role === "assistant").map((message) => message.content).join("\n");
  const currentSource = String(options.currentDiagram?.source || "").trim();
  const conversationText = normalized.map((message) => message.content).join("\n");
  const fullText = [currentSource, conversationText].filter(Boolean).join("\n");
  const latestUserText = [...normalized].reverse().find((message) => message.role !== "assistant")?.content || fullText;
  const signals = mergeCurrentDiagramSignals(
    architectureSignals(fullText, assistantText, latestUserText),
    options.currentDiagram,
  );
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
  if (signals.backend) lines.push(signals.database
    ? "rectangle \"Backend / API\\n--\\nSoftware: SQL/SQLite\" as backend"
    : "rectangle \"Backend / API\" as backend");
  if (signals.mqtt) lines.push("queue \"MQTT Broker\" as mqtt");
  if (signals.cloud) lines.push("cloud \"Cloud / Internet\" as cloud");
  if (signals.homeServer) lines.push("node \"HomeServer / lokaler Server\" as homeserver");
  if (signals.hardwareCatalog) lines.push("rectangle \"Hardware Catalog\" as hardware_catalog");
  if (signals.temperature) lines.push("rectangle \"Temperatur\" as temperature");
  if (signals.timer) lines.push("rectangle \"Timer\" as timer");
  if (actorInterface.actor) lines.push(`actor "${plantUmlText(actorInterface.label)}" as actor`);
  if (options.includeEffectChains) {
    const effectChains = architectureEffectChainLines({ fullText: conversationText, signals, actorInterface, showBrowser });
    if (effectChains.length) {
      lines.push("", ...effectChains);
    }
  } else if (options.includeFunctions) {
    const functionLines = architectureFunctionLines({ fullText: conversationText, signals, actorInterface, showBrowser });
    if (functionLines.length) {
      lines.push("", ...functionLines);
    }
  }

  lines.push("@enduml");
  const source = lines.join("\n");
  return {
    type: "plantuml",
    title,
    summary: options.includeEffectChains
      ? "Architektur-Wirkkettensicht als PlantUML: Ausloeser, Verarbeitung, Speicherung und Anzeige."
      : options.includeFunctions
      ? "Architektur-Funktionssicht als PlantUML: fachliche Funktionen und Interaktionen."
      : "Technische Struktur aus der letzten Architektur-KI-Antwort.",
    source,
    derived_from: options.includeEffectChains ? "architecture_effect_chain_derivation" : options.includeFunctions ? "architecture_function_clarification" : "architecture_discovery_ai_response",
    generated_at: new Date().toISOString(),
    confidence: signals.confidence,
    detected_blocks: signals.detectedBlocks,
    function_coverage: plantUmlFunctionCoverage(source),
    effect_chain_coverage: options.includeEffectChains ? plantUmlFunctionCoverage(source) : null,
  };
}

function architectureRequestProfile(messages, options = {}) {
  const normalizedMessages = Array.isArray(messages) ? messages : [];
  const text = normalizedMessages
    .map((message) => String(message.content || ""))
    .join("\n")
    .trim();
  const latestUserText = [...normalizedMessages].reverse().find((message) => message.role !== "assistant")?.content || text;
  const explicitMinimal = isMinimalEsp32StructureRequest(latestUserText);
  return {
    explicitMinimal,
    assistantMode: options.assistantMode || "architecture_structure",
    complexity: "configured_route",
    reason: options.assistantMode === "effect_chain_derivation"
      ? "Wirkkettenableitung nutzt die konfigurierte Architektur-Route."
      : options.assistantMode === "function_clarification"
      ? "Funktionsklaerung nutzt die konfigurierte Architektur-Route."
      : "Architektur-Discovery nutzt immer die konfigurierte Architektur-Route.",
    };
}

function architecturePatternShortcut(messages, options = {}) {
  if ((options.assistantMode || "architecture_structure") !== "architecture_structure") return null;
  const latestUserText = [...(Array.isArray(messages) ? messages : [])].reverse().find((message) => message.role !== "assistant")?.content || "";
  const text = normalizeLookupText(latestUserText);
  if (!text) return null;
  if (/\b(nenne|zeig|zeige|liste|welche)\b.*\b(pattern|patterns|muster)\b|\bpattern\b.*\b(nennen|zeigen|liste)\b/.test(text)) {
    return {
      intent: "list_patterns",
      reason: "Pattern-Uebersicht wurde als Chat-Schnellfrage angefordert.",
      content: [
        "Diese Pattern kann ich als Einstieg nutzen:",
        "",
        "- Lokale Regel-/Steuerstrecke: Ein Device misst lokal und schaltet lokal etwas.",
        "- Datenlogger: Messwerte werden erfasst, gespeichert und spaeter angezeigt.",
        "- Remote-Steuerung: Ein Nutzer steuert ein Device ueber Browser oder App.",
        "- Observer/Benachrichtigung: Ein Ereignis wird erkannt und jemand wird informiert.",
        "- Synchronisiertes Zustandsmodell: Ein zentraler Zustand wird berechnet und an mehrere Devices verteilt.",
        "",
        "Welches Pattern passt am ehesten? Antworte z. B. mit `Observer`, `Datenlogger` oder einer Kombination.",
      ].join("\n"),
    };
  }
  if (/\b(observer|benachrichtigung|benachrichtigen|ereignis)\b/.test(text) && /\b(moechte|mochte|will|brauche|pattern|observer)\b/.test(text)) {
    return {
      intent: "observer",
      reason: "Observer-Pattern wurde als Chat-Schnellfrage erkannt.",
      content: [
        "Observer passt: Ein Ereignis wird erkannt und ein Nutzer oder ein anderes System wird informiert.",
        "",
        "Bitte kurz klaeren:",
        "1. Welches Ereignis soll erkannt werden?",
        "2. Wer oder was soll benachrichtigt werden?",
        "3. Soll das nur lokal funktionieren oder weltweit erreichbar sein?",
        "4. Wie viele Devices gehoeren dazu?",
      ].join("\n"),
    };
  }
  if (/\b(datenlogger|data logger|logger|messdaten|messwerte)\b/.test(text) && /\b(moechte|mochte|will|brauche|pattern|datenlogger|logger)\b/.test(text)) {
    return {
      intent: "data_logger",
      reason: "Datenlogger-Pattern wurde als Chat-Schnellfrage erkannt.",
      content: [
        "Datenlogger passt: Messwerte werden erfasst, gespeichert und spaeter angezeigt oder ausgewertet.",
        "",
        "Bitte kurz klaeren:",
        "1. Welche Messwerte sollen erfasst werden?",
        "2. Wie oft oder wodurch wird gemessen?",
        "3. Sollen die Daten nur lokal oder weltweit abrufbar sein?",
        "4. Wie viele Logger-Devices gehoeren zum Projekt?",
      ].join("\n"),
    };
  }
  return null;
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
  const hasBackend = has([/backend/, /server/, /api/, /rest/, /websocket/, /account/]);
  const hasSqlPersistence = has([/datenbank/, /sqlite/, /\bsql\b/])
    || (hasBackend && has([/persistenz/, /speicher/, /messwerte speichern/, /history/, /historie/, /\bdatabase\b/]));
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
      mqtt: false,
      database: false,
      cloud: false,
      homeServer: false,
      hardwareCatalog: false,
      temperature: false,
      timer: false,
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
    backend: hasBackend || hasSqlPersistence,
    mqtt: has([/mqtt/, /broker/, /publish/, /subscribe/, /topic/]),
    database: hasSqlPersistence,
    cloud: has([/cloud/, /internet/, /weltweit/, /remote/, /extern/]),
    homeServer: has([/homeserver/, /home server/, /raspberry/, /lokaler server/, /lan/]),
    hardwareCatalog: has([/hardware catalog/, /hardware-catalog/, /capabilit/, /processorboard/, /board/]),
    temperature: has([/temperatur/, /temperature/, /waerme/, /wärme/]),
    timer: has([/timer/, /zeitgeber/, /intervall/, /zyklisch/, /periodisch/]),
  };
  const detectedBlocks = Object.entries(signals).filter(([, value]) => value).map(([key]) => key);
  return {
    ...signals,
    detectedBlocks,
    confidence: Math.min(0.95, Math.max(0.35, detectedBlocks.length / 10)),
  };
}

function mergeCurrentDiagramSignals(signals, currentDiagram) {
  const detected = new Set([
    ...(signals.detectedBlocks || []),
    ...((currentDiagram?.detected_blocks || currentDiagram?.detectedBlocks || []).filter(Boolean)),
  ]);
  const aliases = {
    device: "device",
    browser: "browser",
    mobile: "mobile",
    desktop: "desktop",
    backend: "backend",
    mqtt: "mqtt",
    database: "database",
    cloud: "cloud",
    homeServer: "homeServer",
    hardwareCatalog: "hardwareCatalog",
    temperature: "temperature",
    timer: "timer",
  };
  const merged = { ...signals };
  for (const [key, block] of Object.entries(aliases)) {
    if (detected.has(block)) merged[key] = true;
  }
  if (merged.database) merged.backend = true;
  merged.detectedBlocks = Object.entries(merged)
    .filter(([key, value]) => key !== "detectedBlocks" && key !== "confidence" && value === true)
    .map(([key]) => key);
  return merged;
}

function architectureFunctionLines({ fullText, signals, actorInterface, showBrowser }) {
  const text = String(fullText || "").toLowerCase();
  const lines = [];
  const add = (from, to, label) => {
    const line = `${from} --> ${to}${label ? ` : ${label}` : ""}`;
    if (!lines.includes(line)) lines.push(line);
  };
  const mentions = (left, right) => new RegExp(`\\b${left}\\b[\\s\\S]{0,120}\\b${right}\\b|\\b${right}\\b[\\s\\S]{0,120}\\b${left}\\b`, "i").test(text);
  if (signals.temperature && signals.device) add("temperature", "device", "wird gemessen");
  if (actorInterface.actor && showBrowser) add("actor", "browser", "bedient / sieht");
  if (showBrowser && actorInterface.webserver) add("browser", "webserver", "zeigt Messwerte an");
  if (showBrowser && signals.backend && (mentions("browser", "backend") || mentions("browser", "api"))) add("browser", "backend", "fragt Messwerte ab");
  if (showBrowser && signals.device && (mentions("browser", "esp32") || mentions("browser", "device") || /lokal.{0,80}browser|browser.{0,80}lokal/.test(text))) add("browser", "device", "zeigt / bedient lokal");
  if (actorInterface.webserver && signals.device) add("device", "webserver", "stellt Messdaten bereit");
  if (signals.mobile && signals.backend && (mentions("mobile", "backend") || mentions("app", "api"))) add("mobile", "backend", "zeigt / bedient");
  if (signals.mobile && signals.device && mentions("mobile", "esp32")) add("mobile", "device", "zeigt / bedient lokal");
  if (signals.desktop && signals.backend && (mentions("desktop", "backend") || mentions("desktop", "api"))) add("desktop", "backend", "zeigt / bedient");
  if (signals.device && signals.mqtt) add("device", "mqtt", "meldet Ereignisse");
  if (signals.backend && signals.mqtt && /backend|server|api/.test(text)) add("mqtt", "backend", "liefert Nachrichten");
  if (signals.backend && signals.cloud && /cloud|internet|weltweit|extern/.test(text)) add("cloud", "backend", "betreibt Funktion");
  if (signals.backend && signals.homeServer && /homeserver|lokaler server|lan/.test(text)) add("homeserver", "backend", "betreibt Funktion");
  return lines;
}

function architectureEffectChainLines({ fullText, signals, actorInterface, showBrowser }) {
  const text = String(fullText || "").toLowerCase();
  const lines = [];
  const add = (from, to, label) => {
    const line = `${from} --> ${to}${label ? ` : ${label}` : ""}`;
    if (!lines.includes(line)) lines.push(line);
  };
  const has = (patterns) => patterns.some((pattern) => pattern.test(text));
  const wantsMqtt = signals.mqtt || has([/mqtt/, /publish/, /publisht/, /pubbed/, /topic/, /broker/]);
  const wantsStorage = signals.database || has([/speicher/, /speichert/, /datenlogger/, /logger/, /historie/]);
  const wantsViewing = showBrowser || actorInterface.actor || has([/browser/, /anschaut/, /anschauen/, /sieht/, /anzeigen/, /messwert ansehen/]);

  if (signals.timer && signals.device) add("timer", "device", "startet Messung");
  if (signals.temperature && signals.device) add("temperature", "device", "wird gemessen");
  if (signals.device && wantsStorage && !signals.backend && !wantsMqtt) add("device", "device", "speichert Messwert lokal");
  if (signals.device && wantsMqtt) add("device", "mqtt", "publisht Messwert");
  if (signals.mqtt && signals.backend) add("mqtt", "backend", "liefert Messwert");
  if (signals.backend && wantsStorage) add("backend", "backend", signals.database ? "persistiert Messwert in SQL/SQLite" : "speichert Messwert");
  if (actorInterface.actor && showBrowser && wantsViewing) add("actor", "browser", "moechte Daten ansehen");
  if (showBrowser && actorInterface.webserver) add("browser", "webserver", "fragt Messdaten ab");
  if (showBrowser && signals.backend && /server|backend|api|webserver|messdaten|daten/.test(text)) add("browser", "backend", "fragt Messdaten ab");
  if (showBrowser && signals.device && /esp32|device|lokal|webserver/.test(text)) add("browser", "device", "fragt Messdaten ab");
  if (signals.backend && showBrowser && /anzeigen|anschaut|anschauen|sieht|browser|daten/.test(text)) add("backend", "browser", "liefert Messdaten");
  if (signals.device && showBrowser && /anzeigen|anschaut|anschauen|sieht|browser|lokal|webserver/.test(text)) add("device", "browser", "liefert Messdaten");
  return lines.length ? lines : architectureFunctionLines({ fullText, signals, actorInterface, showBrowser });
}

function actorInterfaceSignals(textValue) {
  const text = String(textValue || "").toLowerCase();
  const hasActor = /\b(nutzer|kunde|user|anwender|bediener|operator|mensch)\b/.test(text);
  const hasInterface = /\b(interface|schnittstelle|webserver|web server|browser|webseite|web app|webapp|mobile app|app|bedienung|greift|zugriff|sieht|ansehen|anzeigen|steuert|bedient)\b/.test(text);
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

function plantUmlFunctionCoverage(source) {
  const aliases = new Set();
  const connected = new Set();
  const lines = String(source || "").split(/\r?\n/);
  for (const line of lines) {
    const element = line.match(/^\s*(actor|node|rectangle|queue|database|cloud)\s+"[^"]+"\s+as\s+([A-Za-z_][A-Za-z0-9_]*)\b/i);
    if (element) aliases.add(element[2]);
  }
  for (const line of lines) {
    const arrow = line.match(/\b([A-Za-z_][A-Za-z0-9_]*)\s+[-.]+>\s+([A-Za-z_][A-Za-z0-9_]*)\b/);
    if (!arrow) continue;
    if (aliases.has(arrow[1])) connected.add(arrow[1]);
    if (aliases.has(arrow[2])) connected.add(arrow[2]);
  }
  const elements = [...aliases];
  const missing = elements.length <= 1 ? [] : elements.filter((alias) => !connected.has(alias));
  return {
    element_count: elements.length,
    arrow_count: lines.filter((line) => /\b[A-Za-z_][A-Za-z0-9_]*\s+[-.]+>\s+[A-Za-z_][A-Za-z0-9_]*\b/.test(line)).length,
    complete: elements.length <= 1 || missing.length === 0,
    missing,
  };
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function cleanProjectId(value) {
  return String(value || "").trim().slice(0, 160);
}

function cleanAssistantMode(value) {
  const mode = String(value || "").trim();
  return ["function_clarification", "effect_chain_derivation", "code_explorer"].includes(mode) ? mode : "architecture_structure";
}

module.exports = { createDevelopmentAssistant, buildArchitectureDiagram, plantUmlFunctionCoverage };
