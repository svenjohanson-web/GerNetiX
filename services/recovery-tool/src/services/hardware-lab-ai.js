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
    if (config.apiProvider !== "openai-responses") {
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
      capabilities: { type: "array", items: { type: "string" } },
      integrated_peripherals: {
        type: "array", items: {
          type: "object", additionalProperties: false,
          required: ["name", "kind", "interface", "driver", "confidence"],
          properties: { name: { type: "string" }, kind: { type: "string" }, interface: nullableString, driver: nullableString, confidence: { type: "string", enum: ["documented", "inferred", "unknown"] } },
        },
      },
      pin_candidates: {
        type: "array", items: {
          type: "object", additionalProperties: false,
          required: ["function", "gpio", "direction", "active_test_allowed", "source_url", "confidence"],
          properties: {
            function: { type: "string" }, gpio: { type: ["integer", "null"] }, direction: { type: "string", enum: ["input", "output", "bus", "unknown"] },
            active_test_allowed: { type: "boolean" }, source_url: nullableString, confidence: { type: "string", enum: ["documented", "inferred", "unknown"] },
          },
        },
      },
      evidence: {
        type: "array", items: {
          type: "object", additionalProperties: false,
          required: ["property", "value", "source_url", "confidence"],
          properties: { property: { type: "string" }, value: { type: "string" }, source_url: { type: "string" }, confidence: { type: "string", enum: ["documented", "inferred", "unknown"] } },
        },
      },
      unresolved_questions: { type: "array", items: { type: "string" } },
      discovery_expectations: {
        type: "object", additionalProperties: false,
        required: ["passive_checks", "active_checks_requiring_confirmation", "safety_notes"],
        properties: {
          passive_checks: { type: "array", items: { type: "string" } },
          active_checks_requiring_confirmation: { type: "array", items: { type: "string" } },
          safety_notes: { type: "array", items: { type: "string" } },
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
    integrated_peripherals: Array.isArray(profile.integrated_peripherals) ? profile.integrated_peripherals.slice(0, 100) : [],
    pin_candidates: (Array.isArray(profile.pin_candidates) ? profile.pin_candidates : []).slice(0, 200).map((pin) => ({
      ...pin,
      active_test_allowed: false,
      source_url: allowedUrls.has(pin.source_url) ? pin.source_url : null,
    })),
    evidence: (Array.isArray(profile.evidence) ? profile.evidence : []).filter((item) => allowedUrls.has(item.source_url)).slice(0, 300),
    unresolved_questions: uniqueStrings(profile.unresolved_questions).slice(0, 100),
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

module.exports = { HardwareLabAi, boardProfileSchema, responseOutputText };
