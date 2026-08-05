const crypto = require("node:crypto");
const { RecoveryToolError } = require("../errors");

class HardwareLabAi {
  constructor(options = {}) {
    this.llmConfigStore = options.llmConfigStore;
    this.fetchImpl = options.fetchImpl || fetch;
    this.timeoutMs = Number(options.timeoutMs || 90000);
    this.aiUsageClient = options.aiUsageClient;
  }

  async analyze(input) {
    const config = this.llmConfigStore.resolveRoute("hardware_lab_analysis");
    if (config.provider !== "api") {
      throw new RecoveryToolError("hardware_lab_external_ai_required", "Das Hardware-Labor benoetigt fuer die Quellenanalyse eine konfigurierte externe API-Route.", 503);
    }
    if (!supportsOpenAiResponses(config)) {
      throw new RecoveryToolError("hardware_lab_openai_responses_required", "Das erste Hardware-Labor-Inkrement verwendet die OpenAI Responses API.", 503);
    }
    if (!config.apiKey) throw new RecoveryToolError("hardware_lab_api_key_missing", "In der GerNetiX-KI-Konfiguration fehlt der OpenAI API-Key.", 503);

    if (!this.aiUsageClient) throw new RecoveryToolError("hardware_lab_ai_usage_not_configured", "Die verpflichtende KI-Nutzungspruefung ist nicht konfiguriert.", 503);
    const accountId = String(input.account_id || "").trim();
    if (!accountId) throw new RecoveryToolError("hardware_lab_account_required", "Fuer die KI-Analyse ist eine Account-ID erforderlich.", 400);
    const usagePreflight = await this.aiUsageClient.preflight({
      account_id: accountId,
      user_id: accountId,
      project_id: "",
      feature: "hardware_lab_board_analysis",
      model: config.apiModel,
      source_id: "openai_gpt",
      estimated_input_tokens: estimateInputTokens(input),
      estimated_output_tokens: 4000,
      system_capabilities: ["system_capability.ai_premium_models", "system_capability.ai_guided_hardware_lab"],
    });
    if (!usagePreflight.allowed) {
      throw new RecoveryToolError("hardware_lab_ai_usage_rejected", `KI-Analyse wurde durch die Nutzungspruefung abgelehnt: ${usagePreflight.rejection_reason || "unbekannter Grund"}.`, 402, usagePreflight);
    }

    const requestBody = {
      model: config.apiModel,
      store: false,
      reasoning: { effort: "medium" },
      max_output_tokens: 4000,
      safety_identifier: privacySafeIdentifier(input.account_id),
      input: responseInput(input),
      text: {
        verbosity: "low",
        format: {
          type: "json_schema",
          name: "gernetix_hardware_board_profile",
          strict: true,
          schema: boardProfileSchema(),
        },
      },
    };
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetchImpl(`${config.apiBaseUrl.replace(/\/$/, "")}/responses`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.apiKey}` },
        signal: controller.signal,
        body: JSON.stringify(requestBody),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new RecoveryToolError("hardware_lab_ai_failed", payload.error?.message || `OpenAI Responses API antwortet mit HTTP ${response.status}.`, 502);
      }
      if (payload.status === "incomplete") {
        throw new RecoveryToolError("hardware_lab_ai_incomplete", "Die KI-Quellenanalyse wurde unvollstaendig beendet.", 502, payload.incomplete_details || {});
      }
      const outputText = responseOutputText(payload);
      let profile;
      try { profile = JSON.parse(outputText); } catch {
        throw new RecoveryToolError("hardware_lab_ai_invalid_json", "Die KI-Quellenanalyse lieferte kein gueltiges strukturiertes Boardprofil.", 502);
      }
      const usage = {
        input_tokens: payload.usage?.input_tokens ?? null,
        output_tokens: payload.usage?.output_tokens ?? null,
        total_tokens: payload.usage?.total_tokens ?? null,
      };
      let usageBooking;
      try {
        usageBooking = await this.aiUsageClient.complete(usagePreflight.event_id, {
          input_tokens: usage.input_tokens ?? 0,
          output_tokens: usage.output_tokens ?? 0,
        });
      } catch (error) {
        usageBooking = { event_id: usagePreflight.event_id, status: "tracking_failed", error_code: error.code || "usage_completion_failed" };
      }
      return {
        profile: normalizeProfile(profile, input),
        provider: "openai-responses",
        model: config.apiModel,
        response_id: payload.id || "",
        usage: { ...usage, event_id: usagePreflight.event_id, booking_status: usageBooking?.status || "unknown" },
      };
    } catch (error) {
      if (error.name === "AbortError") throw new RecoveryToolError("hardware_lab_ai_timeout", "Die KI-Quellenanalyse hat das Zeitlimit ueberschritten.", 504);
      try {
        await this.aiUsageClient.fail(usagePreflight.event_id, { error_code: error.code || "provider_error", error_message: error.message || String(error) });
      } catch {}
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  async chat(input) {
    const config = this.llmConfigStore.resolveRoute("hardware_lab_analysis");
    if (config.provider !== "api" || !supportsOpenAiResponses(config) || !config.apiKey) {
      throw new RecoveryToolError("hardware_lab_chat_not_configured", "Der KI-Dialog des Hardware-Labors benötigt eine konfigurierte OpenAI-Responses-Route.", 503);
    }
    if (!this.aiUsageClient) throw new RecoveryToolError("hardware_lab_ai_usage_not_configured", "Die verpflichtende KI-Nutzungsprüfung ist nicht konfiguriert.", 503);
    const accountId = String(input.account_id || "").trim();
    if (!accountId) throw new RecoveryToolError("hardware_lab_account_required", "Für den KI-Dialog ist eine Account-ID erforderlich.", 400);
    const providerInput = chatResponseInput(input);
    const usagePreflight = await this.aiUsageClient.preflight({
      account_id: accountId,
      user_id: accountId,
      project_id: "",
      feature: "hardware_lab_conversation",
      model: config.apiModel,
      source_id: "openai_gpt",
      estimated_input_tokens: estimateChatTokens(providerInput),
      estimated_output_tokens: 1400,
      system_capabilities: ["system_capability.ai_premium_models", "system_capability.ai_guided_hardware_lab"],
    });
    if (!usagePreflight.allowed) {
      throw new RecoveryToolError("hardware_lab_ai_usage_rejected", `KI-Dialog wurde durch die Nutzungsprüfung abgelehnt: ${usagePreflight.rejection_reason || "unbekannter Grund"}.`, 402, usagePreflight);
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetchImpl(`${config.apiBaseUrl.replace(/\/$/, "")}/responses`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.apiKey}` },
        signal: controller.signal,
        body: JSON.stringify({
          model: config.apiModel,
          store: false,
          reasoning: { effort: "medium" },
          max_output_tokens: 1400,
          safety_identifier: privacySafeIdentifier(accountId),
          input: providerInput,
          text: { verbosity: "low", format: { type: "json_schema", name: "gernetix_hardware_lab_chat", strict: true, schema: hardwareLabChatSchema() } },
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new RecoveryToolError("hardware_lab_chat_failed", payload.error?.message || `OpenAI Responses API antwortet mit HTTP ${response.status}.`, 502);
      const parsed = JSON.parse(responseOutputText(payload));
      const usage = { input_tokens: payload.usage?.input_tokens ?? null, output_tokens: payload.usage?.output_tokens ?? null, total_tokens: payload.usage?.total_tokens ?? null };
      let usageBooking;
      try {
        usageBooking = await this.aiUsageClient.complete(usagePreflight.event_id, { input_tokens: usage.input_tokens ?? 0, output_tokens: usage.output_tokens ?? 0 });
      } catch (error) {
        usageBooking = { status: "tracking_failed", error_code: error.code || "usage_completion_failed" };
      }
      return {
        answer: String(parsed.answer || "").trim(),
        profile_updates: normalizeProfileUpdates(parsed.profile_updates, input),
        next_step: normalizeAssistantStep(parsed.next_step),
        next_question: parsed.next_question ? String(parsed.next_question).trim().slice(0, 600) : null,
        completed: parsed.completed === true,
        suggested_actions: uniqueStrings(parsed.suggested_actions).filter((action) => ["analyze_sources", "build_discovery_firmware", "refresh_build_status", "download_firmware", "answer_open_questions", "none"].includes(action)),
        proposed_tests: Array.isArray(parsed.proposed_tests) ? parsed.proposed_tests.slice(0, 12).map((test) => ({ ...test, requires_confirmation: true })) : [],
        provider: "openai-responses",
        model: config.apiModel,
        response_id: payload.id || "",
        usage: { ...usage, event_id: usagePreflight.event_id, booking_status: usageBooking?.status || "unknown" },
      };
    } catch (error) {
      if (error.name === "AbortError") throw new RecoveryToolError("hardware_lab_ai_timeout", "Der KI-Dialog hat das Zeitlimit überschritten.", 504);
      try { await this.aiUsageClient.fail(usagePreflight.event_id, { error_code: error.code || "provider_error", error_message: error.message || String(error) }); } catch {}
      if (error instanceof SyntaxError) throw new RecoveryToolError("hardware_lab_chat_invalid_json", "Der KI-Dialog lieferte keine gültige strukturierte Antwort.", 502);
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }
}

function supportsOpenAiResponses(config = {}) {
  if (config.apiProvider === "openai-responses") return true;
  if (config.apiProvider !== "openai-compatible") return false;
  try {
    const url = new URL(config.apiBaseUrl);
    return url.protocol === "https:" && url.hostname === "api.openai.com";
  } catch {
    return false;
  }
}

function estimateChatTokens(providerInput) {
  return Math.max(500, Math.ceil(JSON.stringify(providerInput).length / 4));
}

function chatResponseInput(input) {
  const developer = [
    "Du bist der dialogorientierte OpenAI-Assistent im GerNetiX KI-Hardware-Labor.",
    "Führe den Nutzer schrittweise durch das Anlegen eines selbst beschafften Boards.",
    "Bearbeite nur den aktuellen Schritt. Übernimm belegte vorhandene Werte und erfinde keine Pins, Speichergrößen, Busadressen oder Peripherie.",
    "Gib ausschließlich neue oder geänderte Profilwerte in profile_updates zurück; wiederhole niemals das vollständige Boardprofil.",
    "Stelle höchstens eine konkrete nächste Frage. Wenn der aktuelle Schritt vollständig ist, wechsle zum nächsten Schritt.",
    "Wenn next_question gesetzt ist, beende auch answer mit genau dieser einen Frage.",
    "Wenn alle für die sichere Discovery notwendigen Angaben vorliegen, setze completed=true, next_step=complete und next_question=null.",
    "Aktive GPIO-, Bus- oder Versorgungstests dürfen nur vorgeschlagen werden und benötigen immer eine ausdrückliche Bestätigung; führe sie niemals selbst aus.",
    "Die verpflichtende reale Discovery-Prüfung und ihre Build-/SHA-Gates dürfen nicht umgangen werden.",
    "Antworte auf Deutsch, knapp und handlungsorientiert.",
  ].join("\n");
  const state = compactChatState(input);
  return [
    { role: "developer", content: [{ type: "input_text", text: developer }] },
    { role: "user", content: [{ type: "input_text", text: `Kompakte Board-Akte:\n${JSON.stringify(state)}\n\nAktuelle Antwort oder Nachricht des Nutzers:\n${String(input.message || "")}` }] },
  ];
}

function hardwareLabChatSchema() {
  const nullableString = { type: ["string", "null"] };
  const confidence = { type: "string", enum: ["confirmed", "documented", "inferred", "unknown"] };
  return {
    type: "object",
    additionalProperties: false,
    required: ["answer", "profile_updates", "next_step", "next_question", "completed", "suggested_actions", "proposed_tests"],
    properties: {
      answer: { type: "string" },
      profile_updates: {
        type: "object",
        additionalProperties: false,
        required: ["facts", "capabilities", "peripherals", "pins", "resolved_questions", "open_questions"],
        properties: {
          facts: {
            type: "array", maxItems: 12,
            items: {
              type: "object", additionalProperties: false,
              required: ["field", "value", "confidence", "source_url"],
              properties: {
                field: { type: "string", enum: ["board_name", "manufacturer", "processor_family", "mcu_variant", "module_name", "flash_bytes", "psram_bytes", "ram_bytes", "platformio_platform", "platformio_board", "platformio_framework", "platformio_environment"] },
                value: { type: "string" }, confidence, source_url: nullableString,
              },
            },
          },
          capabilities: { type: "array", maxItems: 20, items: { type: "string" } },
          peripherals: {
            type: "array", maxItems: 12, items: {
              type: "object", additionalProperties: false,
              required: ["name", "kind", "interface", "driver", "confidence"],
              properties: { name: { type: "string" }, kind: { type: "string" }, interface: nullableString, driver: nullableString, confidence },
            },
          },
          pins: {
            type: "array", maxItems: 16, items: {
              type: "object", additionalProperties: false,
              required: ["function", "gpio", "direction", "source_url", "confidence"],
              properties: {
                function: { type: "string" }, gpio: { type: ["integer", "null"] }, direction: { type: "string", enum: ["input", "output", "bus", "unknown"] },
                source_url: nullableString, confidence,
              },
            },
          },
          resolved_questions: { type: "array", maxItems: 8, items: { type: "string" } },
          open_questions: { type: "array", maxItems: 4, items: { type: "string" } },
        },
      },
      next_step: { type: "string", enum: hardwareLabAssistantSteps() },
      next_question: nullableString,
      completed: { type: "boolean" },
      suggested_actions: { type: "array", items: { type: "string", enum: ["analyze_sources", "build_discovery_firmware", "refresh_build_status", "download_firmware", "answer_open_questions", "none"] } },
      proposed_tests: {
        type: "array", maxItems: 12,
        items: {
          type: "object", additionalProperties: false,
          required: ["id", "title", "description", "risk", "requires_confirmation"],
          properties: {
            id: { type: "string" }, title: { type: "string" }, description: { type: "string" },
            risk: { type: "string", enum: ["passive", "low", "requires_review"] }, requires_confirmation: { type: "boolean" },
          },
        },
      },
    },
  };
}

function compactChatState(input) {
  const profile = input.profile && typeof input.profile === "object" ? input.profile : {};
  const assistantState = input.assistant_state && typeof input.assistant_state === "object" ? input.assistant_state : {};
  const step = normalizeAssistantStep(assistantState.step);
  const facts = Object.fromEntries([
    ["board_name", profile.board_name && profile.board_name !== "Noch unbekanntes Board" ? profile.board_name : null],
    ["manufacturer", profile.manufacturer],
    ["processor_family", profile.processor_family],
    ["mcu_variant", profile.mcu_variant],
    ["module_name", profile.module_name],
    ["flash_bytes", profile.flash_bytes],
    ["psram_bytes", profile.psram_bytes],
    ["ram_bytes", profile.ram_bytes],
    ["platformio_board", profile.platformio?.board],
  ].filter(([, value]) => value !== null && value !== undefined && value !== ""));
  const includeInterfaces = ["interfaces", "pins", "discovery", "complete"].includes(step);
  const includePins = ["pins", "discovery", "complete"].includes(step);
  return {
    current_step: step,
    current_question: assistantState.current_question || null,
    confirmed_facts: facts,
    capabilities: includeInterfaces ? uniqueStrings(profile.capabilities).slice(0, 20) : [],
    peripherals: includeInterfaces ? (Array.isArray(profile.integrated_peripherals) ? profile.integrated_peripherals : []).slice(0, 12).map((item) => ({
      name: item.name, kind: item.kind, interface: item.interface || null, driver: item.driver || null, confidence: item.confidence || "unknown",
    })) : [],
    confirmed_pins: includePins ? (Array.isArray(profile.pin_candidates) ? profile.pin_candidates : [])
      .filter((pin) => Number.isInteger(pin.gpio) && ["confirmed", "documented"].includes(pin.confidence))
      .slice(0, 16)
      .map((pin) => ({ function: pin.function, gpio: pin.gpio, direction: pin.direction })) : [],
    source_count: Array.isArray(input.source_urls) ? input.source_urls.length : 0,
    source_urls: step === "sources" ? (Array.isArray(input.source_urls) ? input.source_urls : []).slice(-2) : [],
    discovery: {
      build_status: input.workflow?.discovery?.firmware_build?.status || "not_started",
      examination_status: input.workflow?.discovery?.examination?.status || "not_started",
    },
  };
}

function normalizeProfileUpdates(value, input) {
  const updates = value && typeof value === "object" ? value : {};
  const allowedUrls = new Set(Array.isArray(input.source_urls) ? input.source_urls : []);
  const allowedFields = new Set(["board_name", "manufacturer", "processor_family", "mcu_variant", "module_name", "flash_bytes", "psram_bytes", "ram_bytes", "platformio_platform", "platformio_board", "platformio_framework", "platformio_environment"]);
  return {
    facts: (Array.isArray(updates.facts) ? updates.facts : []).filter((item) => allowedFields.has(item?.field)).slice(0, 12).map((item) => ({
      field: item.field,
      value: String(item.value || "").trim().slice(0, 240),
      confidence: normalizeConfidence(item.confidence),
      source_url: allowedUrls.has(item.source_url) ? item.source_url : null,
    })).filter((item) => item.value),
    capabilities: uniqueStrings(updates.capabilities).slice(0, 20),
    peripherals: (Array.isArray(updates.peripherals) ? updates.peripherals : []).slice(0, 12).map((item) => ({
      name: String(item?.name || "").trim().slice(0, 160), kind: String(item?.kind || "").trim().slice(0, 120),
      interface: item?.interface ? String(item.interface).trim().slice(0, 120) : null,
      driver: item?.driver ? String(item.driver).trim().slice(0, 160) : null,
      confidence: normalizeConfidence(item?.confidence),
    })).filter((item) => item.name && item.kind),
    pins: (Array.isArray(updates.pins) ? updates.pins : []).slice(0, 16).map((pin) => ({
      function: String(pin?.function || "").trim().slice(0, 120),
      gpio: Number.isInteger(pin?.gpio) && pin.gpio >= 0 && pin.gpio <= 255 ? pin.gpio : null,
      direction: ["input", "output", "bus", "unknown"].includes(pin?.direction) ? pin.direction : "unknown",
      source_url: allowedUrls.has(pin?.source_url) ? pin.source_url : null,
      confidence: normalizeConfidence(pin?.confidence),
    })).filter((pin) => pin.function),
    resolved_questions: uniqueStrings(updates.resolved_questions).slice(0, 8),
    open_questions: uniqueStrings(updates.open_questions).slice(0, 4),
  };
}

function hardwareLabAssistantSteps() {
  return ["intake", "sources", "identity", "processor", "memory", "interfaces", "pins", "discovery", "complete"];
}

function normalizeAssistantStep(value) {
  return hardwareLabAssistantSteps().includes(value) ? value : "intake";
}

function normalizeConfidence(value) {
  return ["confirmed", "documented", "inferred", "unknown"].includes(value) ? value : "unknown";
}

function estimateInputTokens(input) {
  const sourceCharacters = (input.sources || []).reduce((sum, source) => sum + String(source.text || source.file_data_base64 || "").length, 0);
  return Math.max(500, Math.ceil((sourceCharacters + String(input.board_name || "").length + String(input.notes || "").length + 2500) / 4));
}

function responseInput(input) {
  const developer = [
    "Du analysierst Hardwarequellen fuer das GerNetiX Hardware-Labor.",
    "Extrahiere nur Angaben, die in den uebergebenen Quellen belegt sind.",
    "Erfinde keine Pins, Speicherwerte, PlatformIO-Boards oder Peripherie.",
    "Unbekannte Werte bleiben leer oder null und werden als offene Frage ausgegeben.",
    "Aktive Pintests sind standardmaessig unsicher. Gib nur quellengestuetzte Kandidaten an; die Firmware verwendet sie erst nach separater Bestaetigung.",
    "Jeder Evidenzeintrag muss eine der uebergebenen source_url-Adressen verwenden.",
    "Ziel ist ein passiver erster Discovery-Build, der Chip, Revision, Flash, RAM, PSRAM, Runtime und Funkfaehigkeiten untersucht.",
  ].join("\n");
  const textSources = input.sources.filter((source) => source.kind === "text").map((source) => [
    `QUELLE: ${source.source_url}`,
    `FINAL: ${source.final_url}`,
    source.text,
  ].join("\n")).join("\n\n---\n\n");
  const userContent = [{
    type: "input_text",
    text: [
      `Board-Name des Nutzers: ${input.board_name}`,
      `Herstellerangabe: ${input.manufacturer || "unbekannt"}`,
      `Hinweise: ${input.notes || "keine"}`,
      "Analysiere die folgenden Quellen und erzeuge das Boardprofil im vorgegebenen Schema.",
      textSources,
    ].join("\n\n"),
  }];
  for (const source of input.sources.filter((candidate) => candidate.kind === "pdf")) {
    userContent.push({ type: "input_text", text: `PDF-QUELLE: ${source.source_url}\nFINAL: ${source.final_url}` });
    userContent.push({ type: "input_file", filename: source.file_name, file_data: source.file_data_base64 });
  }
  return [
    { role: "developer", content: [{ type: "input_text", text: developer }] },
    { role: "user", content: userContent },
  ];
}

function boardProfileSchema() {
  const nullableString = { type: ["string", "null"] };
  return {
    type: "object",
    additionalProperties: false,
    required: ["board_name", "manufacturer", "processor_family", "mcu_variant", "module_name", "flash_bytes", "psram_bytes", "ram_bytes", "platformio", "capabilities", "integrated_peripherals", "pin_candidates", "evidence", "unresolved_questions", "discovery_expectations"],
    properties: {
      board_name: { type: "string" },
      manufacturer: nullableString,
      processor_family: { type: "string", enum: ["esp32", "esp8266", "avr", "unknown"] },
      mcu_variant: nullableString,
      module_name: nullableString,
      flash_bytes: { type: ["integer", "null"], minimum: 0 },
      psram_bytes: { type: ["integer", "null"], minimum: 0 },
      ram_bytes: { type: ["integer", "null"], minimum: 0 },
      platformio: {
        type: "object", additionalProperties: false,
        required: ["platform", "board", "framework", "environment", "build_flags"],
        properties: {
          platform: nullableString,
          board: nullableString,
          framework: { type: ["string", "null"], enum: ["arduino", "espidf", null] },
          environment: nullableString,
          build_flags: { type: "array", items: { type: "string" } },
        },
      },
      capabilities: { type: "array", maxItems: 40, items: { type: "string" } },
      integrated_peripherals: {
        type: "array", maxItems: 40, items: {
          type: "object", additionalProperties: false,
          required: ["name", "kind", "interface", "driver", "confidence"],
          properties: { name: { type: "string" }, kind: { type: "string" }, interface: nullableString, driver: nullableString, confidence: { type: "string", enum: ["documented", "inferred", "unknown"] } },
        },
      },
      pin_candidates: {
        type: "array", maxItems: 48, items: {
          type: "object", additionalProperties: false,
          required: ["function", "gpio", "direction", "active_test_allowed", "source_url", "confidence"],
          properties: {
            function: { type: "string" }, gpio: { type: ["integer", "null"] }, direction: { type: "string", enum: ["input", "output", "bus", "unknown"] },
            active_test_allowed: { type: "boolean" }, source_url: nullableString, confidence: { type: "string", enum: ["documented", "inferred", "unknown"] },
          },
        },
      },
      evidence: {
        type: "array", maxItems: 80, items: {
          type: "object", additionalProperties: false,
          required: ["property", "value", "source_url", "confidence"],
          properties: { property: { type: "string" }, value: { type: "string" }, source_url: { type: "string" }, confidence: { type: "string", enum: ["documented", "inferred", "unknown"] } },
        },
      },
      unresolved_questions: { type: "array", maxItems: 8, items: { type: "string" } },
      discovery_expectations: {
        type: "object", additionalProperties: false,
        required: ["passive_checks", "active_checks_requiring_confirmation", "safety_notes"],
        properties: {
          passive_checks: { type: "array", maxItems: 20, items: { type: "string" } },
          active_checks_requiring_confirmation: { type: "array", maxItems: 20, items: { type: "string" } },
          safety_notes: { type: "array", maxItems: 20, items: { type: "string" } },
        },
      },
    },
  };
}

function normalizeProfile(profile, input) {
  const allowedUrls = new Set(input.sources.flatMap((source) => [source.source_url, source.final_url]));
  return {
    ...profile,
    board_name: String(profile.board_name || input.board_name).trim(),
    manufacturer: profile.manufacturer ? String(profile.manufacturer).trim() : input.manufacturer || null,
    capabilities: uniqueStrings(profile.capabilities),
    integrated_peripherals: Array.isArray(profile.integrated_peripherals) ? profile.integrated_peripherals.slice(0, 40) : [],
    pin_candidates: (Array.isArray(profile.pin_candidates) ? profile.pin_candidates : []).slice(0, 48).map((pin) => ({
      ...pin,
      active_test_allowed: false,
      source_url: allowedUrls.has(pin.source_url) ? pin.source_url : null,
    })),
    evidence: (Array.isArray(profile.evidence) ? profile.evidence : []).filter((item) => allowedUrls.has(item.source_url)).slice(0, 80),
    unresolved_questions: uniqueStrings(profile.unresolved_questions).slice(0, 8),
  };
}

function responseOutputText(payload) {
  if (payload.output_text) return payload.output_text;
  return (payload.output || []).flatMap((item) => item.content || []).map((part) => part.text || "").join("").trim();
}

function privacySafeIdentifier(accountId) {
  return `hardware-lab-${crypto.createHash("sha256").update(String(accountId || "anonymous")).digest("hex").slice(0, 24)}`;
}

function uniqueStrings(value) {
  return Array.from(new Set((Array.isArray(value) ? value : []).map((item) => String(item || "").trim()).filter(Boolean)));
}

module.exports = { HardwareLabAi, boardProfileSchema, hardwareLabChatSchema, responseOutputText };
