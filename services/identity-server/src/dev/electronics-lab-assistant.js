"use strict";

const crypto = require("node:crypto");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const RESPONSE_TIMEOUT_MS = 45000;
const MAX_OUTPUT_TOKENS = 900;
const DEFAULT_RATE_LIMIT = 8;
const DEFAULT_RATE_WINDOW_MS = 60_000;
const CONTRACT_URL = pathToFileURL(path.resolve(
  __dirname,
  "../../../../modules/virtual-electronics-lab/ai/troubleshooting-assistant-contract.mjs",
)).href;

function createElectronicsLabAssistant({
  aiUsageJson,
  llmConfigStore,
  projectServerUserId,
  readJsonBody,
  sendJson,
  fetchImpl = fetch,
  contractLoader = () => import(CONTRACT_URL),
  enabled = true,
  rateLimit = DEFAULT_RATE_LIMIT,
  rateWindowMs = DEFAULT_RATE_WINDOW_MS,
  now = () => Date.now(),
  auditEvent = null,
}) {
  const requestLimiter = createAccountRateLimiter({ limit: rateLimit, windowMs: rateWindowMs, now });

  async function handleRequest(req, res, session) {
    let usagePreflight = null;
    const accountId = accountIdFor(session, projectServerUserId);
    const accountHash = privacySafeAccountHash(accountId);
    try {
      if (!enabled) {
        await audit("disabled", accountHash);
        sendJson(res, 503, {
          error: "electronics_lab_assistant_disabled",
          message: "Der KI-Assistent ist vorübergehend ausgeschaltet. Das manuelle Elektroniklabor bleibt verfügbar.",
        });
        return;
      }

      const rate = requestLimiter.consume(accountId);
      if (!rate.allowed) {
        await audit("rate_limited", accountHash, { retry_after_seconds: rate.retryAfterSeconds });
        sendJson(res, 429, {
          error: "electronics_lab_assistant_rate_limited",
          message: "Zu viele KI-Anfragen. Bitte warte kurz; das manuelle Elektroniklabor bleibt verfügbar.",
          retryAfterSeconds: rate.retryAfterSeconds,
        });
        return;
      }

      const body = await readJsonBody(req);
      const contract = await contractLoader();
      const contextResult = contract.createTroubleshootingAssistantContext({
        scenario: body.scenario,
        snapshot: body.snapshot,
      });
      const requestedAction = clean(body.requestedAction).slice(0, 64);
      if (!contextResult.ok || !contract.TROUBLESHOOTING_ASSISTANT_CONTRACT.actionTypes.includes(requestedAction)) {
        sendJson(res, 400, {
          error: "electronics_lab_assistant_context_invalid",
          message: "Fehlersuchfall, Labormessung oder Assistentenaktion ist ungültig.",
        });
        return;
      }

      const config = llmConfigStore.resolveRoute("electronics_lab_troubleshooting");
      if (config.provider !== "api" || config.apiProvider !== "openai-responses") {
        sendJson(res, 503, {
          error: "electronics_lab_assistant_provider_not_supported",
          message: "Der Elektroniklabor-Assistent benötigt die OpenAI Responses API.",
        });
        return;
      }

      const requestContext = {
        requestedAction,
        observationNote: clean(body.message).slice(0, 600),
        lab: contextResult.context,
      };
      usagePreflight = await preflightUsage(session, config, requestContext);
      if (!usagePreflight?.allowed) {
        await audit("credit_rejected", accountHash, { reason: clean(usagePreflight?.reason).slice(0, 64) });
        sendJson(res, 402, {
          error: "ai_usage_rejected",
          message: "Für den KI-Assistenten sind derzeit keine Credits verfügbar.",
          usagePreflight,
        });
        return;
      }

      const result = await callOpenAiResponses(config, requestContext, session, contract);
      const usageEvent = await completeUsage(usagePreflight, result.usage);
      await audit("completed", accountHash, { requested_action: requestedAction });
      sendJson(res, 200, {
        proposal: result.proposal,
        routing: {
          provider: "openai-responses",
          routeTask: "electronics_lab_troubleshooting",
          costPolicy: config.costPolicy,
          model: config.apiModel,
        },
        usage: result.usage,
        usageEvent,
      });
    } catch (error) {
      await failUsage(usagePreflight, error);
      await audit("failed", accountHash, { error_code: clean(error?.code || "assistant_unavailable").slice(0, 64) });
      sendJson(res, 503, {
        error: "electronics_lab_assistant_unavailable",
        message: error?.message || "Der Elektroniklabor-Assistent ist gerade nicht erreichbar.",
      });
    }
  }

  async function audit(outcome, accountHash, details = {}) {
    if (typeof auditEvent !== "function") return;
    try {
      await auditEvent({
        severity: outcome === "completed" ? "info" : "warning",
        source_service: "identity_server",
        target_service: "ai_usage_server",
        category: "ai_security",
        event_type: "electronics_lab_assistant_request",
        message: "Elektroniklabor-KI-Anfrage verarbeitet.",
        impact: outcome,
        route: "/api/platform/electronics-lab/assistant",
        details: { account_hash: accountHash, outcome, ...details },
      });
    } catch {
      // Audit transport must never turn an otherwise valid lab response into an error.
    }
  }

  async function callOpenAiResponses(config, requestContext, session, contract) {
    if (!config.apiKey) throw new Error("Der OpenAI API-Key für den Elektroniklabor-Assistenten fehlt.");
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), RESPONSE_TIMEOUT_MS);
    try {
      const response = await fetchImpl(`${config.apiBaseUrl.replace(/\/$/, "")}/responses`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.apiKey}` },
        signal: controller.signal,
        body: JSON.stringify({
          model: config.apiModel,
          store: false,
          max_output_tokens: MAX_OUTPUT_TOKENS,
          safety_identifier: privacySafeIdentifier(session, projectServerUserId),
          reasoning: { effort: "low" },
          text: {
            verbosity: "low",
            format: {
              type: "json_schema",
              name: "gernetix_electronics_lab_troubleshooting",
              strict: true,
              schema: assistantProposalSchema(),
            },
          },
          input: [
            { role: "developer", content: [{ type: "input_text", text: systemPrompt() }] },
            { role: "user", content: [{ type: "input_text", text: JSON.stringify(requestContext) }] },
          ],
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error?.message || payload.error || `OpenAI antwortet mit HTTP ${response.status}.`);
      const output = openAiOutputText(payload);
      if (!output) throw new Error("Die KI hat keinen strukturierten Vorschlag geliefert.");
      const parsed = normalizeProviderProposal(JSON.parse(output));
      const validation = contract.validateTroubleshootingAssistantProposal(parsed);
      if (!validation.ok) throw new Error("Die KI-Antwort verletzt den erlaubten Elektroniklabor-Vertrag.");
      return {
        proposal: validation.proposal,
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

  async function preflightUsage(session, config, requestContext) {
    if (typeof aiUsageJson !== "function") throw new Error("Die KI-Nutzungsprüfung ist nicht verfügbar.");
    const accountId = accountIdFor(session, projectServerUserId);
    const serialized = JSON.stringify(requestContext);
    return aiUsageJson("/api/ai-usage/preflight", {
      method: "POST",
      allowPaymentRequired: true,
      body: {
        account_id: accountId,
        user_id: accountId,
        project_id: "",
        feature: "electronics_lab_troubleshooting",
        model: config.apiModel,
        source_id: "openai_gpt",
        estimated_input_tokens: Math.ceil((systemPrompt().length + serialized.length) / 4),
        estimated_output_tokens: MAX_OUTPUT_TOKENS,
        system_capabilities: [],
      },
    });
  }

  async function completeUsage(preflight, usage) {
    if (!preflight?.event_id) return null;
    return aiUsageJson(`/api/ai-usage/events/${encodeURIComponent(preflight.event_id)}/complete`, {
      method: "POST",
      body: { input_tokens: usage.promptTokens, output_tokens: usage.completionTokens },
    }).catch((error) => ({ event_id: preflight.event_id, status: "tracking_failed", error: error.message || String(error) }));
  }

  async function failUsage(preflight, error) {
    if (!preflight?.event_id || typeof aiUsageJson !== "function") return null;
    return aiUsageJson(`/api/ai-usage/events/${encodeURIComponent(preflight.event_id)}/fail`, {
      method: "POST",
      body: { error_code: "provider_error", error_message: error.message || String(error) },
    }).catch(() => null);
  }

  return { handleRequest };
}

function systemPrompt() {
  return [
    "Du bist ein knapper deutschsprachiger Assistent in einem idealisierten Elektronik-Lernlabor.",
    "Nutze ausschließlich den übergebenen minimierten Laborzustand. Erfinde keine Messwerte und behaupte keine reale Bauteilgenauigkeit.",
    "Erklärungen und Messvorschläge enthalten keine Commands.",
    "Reparaturvorschläge dürfen ausschließlich die erlaubten SetContactReference- oder UpdateSourceFile-Commands enthalten und müssen eine ausdrückliche Bestätigung verlangen.",
    "Wende niemals selbst eine Änderung an. Antworte ausschließlich im vorgegebenen JSON-Schema.",
  ].join("\n");
}

function assistantProposalSchema() {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      actionType: { type: "string", enum: ["explain-observation", "suggest-measurement", "propose-command-diff"] },
      content: { type: "string", maxLength: 800 },
      requiresConfirmation: { type: "boolean" },
      commands: {
        type: "array",
        maxItems: 3,
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            type: { type: "string", enum: ["SetContactReference", "UpdateSourceFile"] },
            contactReferenceMode: { type: ["string", "null"], enum: ["gnd", "vcc", null] },
            sourceFile: { type: ["string", "null"], maxLength: 4096 },
          },
          required: ["type", "contactReferenceMode", "sourceFile"],
        },
      },
    },
    required: ["actionType", "content", "requiresConfirmation", "commands"],
  };
}

function normalizeProviderProposal(value = {}) {
  const proposal = { actionType: value.actionType, content: value.content };
  if (value.actionType !== "propose-command-diff") return proposal;
  proposal.requiresConfirmation = value.requiresConfirmation;
  proposal.commands = (Array.isArray(value.commands) ? value.commands : []).map((command) => {
    if (command.type === "SetContactReference") {
      return { type: command.type, contactReferenceMode: command.contactReferenceMode };
    }
    return { type: command.type, sourceFile: command.sourceFile };
  });
  return proposal;
}

function privacySafeIdentifier(session, projectServerUserId) {
  return `electronics-lab-${privacySafeAccountHash(accountIdFor(session, projectServerUserId))}`;
}

function privacySafeAccountHash(accountId) {
  return crypto.createHash("sha256").update(clean(accountId) || "anonymous").digest("hex").slice(0, 24);
}

function createAccountRateLimiter({ limit = DEFAULT_RATE_LIMIT, windowMs = DEFAULT_RATE_WINDOW_MS, now = () => Date.now() } = {}) {
  const buckets = new Map();
  const safeLimit = Math.max(1, Number(limit) || DEFAULT_RATE_LIMIT);
  const safeWindowMs = Math.max(1_000, Number(windowMs) || DEFAULT_RATE_WINDOW_MS);
  return {
    consume(accountId) {
      const key = privacySafeAccountHash(accountId);
      const currentTime = Number(now());
      const previous = buckets.get(key);
      const bucket = !previous || previous.expiresAt <= currentTime
        ? { count: 0, expiresAt: currentTime + safeWindowMs }
        : previous;
      bucket.count += 1;
      buckets.set(key, bucket);
      if (bucket.count <= safeLimit) return { allowed: true, remaining: safeLimit - bucket.count };
      return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((bucket.expiresAt - currentTime) / 1000)) };
    },
  };
}

function accountIdFor(session, projectServerUserId) {
  return typeof projectServerUserId === "function" ? clean(projectServerUserId(session)) : clean(session?.user_id);
}

function openAiOutputText(payload) {
  if (clean(payload.output_text)) return clean(payload.output_text);
  return (payload.output || []).flatMap((item) => item.content || [])
    .filter((part) => part.type === "output_text" || part.type === "text")
    .map((part) => part.text || "").join("\n").trim();
}

function clean(value) {
  return String(value || "").trim();
}

module.exports = {
  assistantProposalSchema,
  createAccountRateLimiter,
  createElectronicsLabAssistant,
  normalizeProviderProposal,
};
