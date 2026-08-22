"use strict";

const crypto = require("node:crypto");

const RESPONSE_TIMEOUT_MS = 45000;
const MAX_PROPOSAL_LENGTH = 12000;
const MAX_OUTPUT_TOKENS = 1800;

function createRequirementsWorkshopAssistant({
  aiUsageJson,
  llmConfigStore,
  projectServerUserId,
  accountSubscription,
  readJsonBody,
  sendJson,
  fetchImpl = fetch,
}) {
  async function handleFeedback(req, res, session) {
    const body = await readJsonBody(req);
    const proposal = clean(body.proposal).slice(0, MAX_PROPOSAL_LENGTH);
    if (!proposal) {
      sendJson(res, 400, {
        error: "missing_requirement_proposal",
        message: "Bitte beschreibe zuerst deine Anforderung.",
      });
      return;
    }

    const config = llmConfigStore.resolveRoute("requirements_workshop");
    if (config.provider !== "api" || config.apiProvider !== "openai-responses") {
      sendJson(res, 503, {
        error: "requirements_workshop_provider_not_supported",
        message: "Der KI-Anforderungsspiegel benötigt die OpenAI Responses API.",
      });
      return;
    }

    let usagePreflight = null;
    try {
      usagePreflight = await preflightUsage(session, config, proposal);
      if (!usagePreflight?.allowed) {
        sendJson(res, 402, {
          error: "ai_usage_rejected",
          message: "Das KI-Limit für den Anforderungsworkshop ist erreicht.",
          usagePreflight,
        });
        return;
      }

      const result = await callOpenAiResponses(config, proposal, session);
      const usageEvent = await completeUsage(usagePreflight, result.usage, session);
      sendJson(res, 200, {
        feedback: normalizeFeedback(result.feedback),
        routing: {
          provider: "openai-responses",
          routeTask: "requirements_workshop",
          costPolicy: config.costPolicy,
          model: config.apiModel,
        },
        usage: result.usage,
        usageEvent,
      });
    } catch (error) {
      await failUsage(usagePreflight, error, session);
      sendJson(res, 503, {
        error: "requirements_workshop_unavailable",
        message: error?.message || "Der KI-Anforderungsspiegel ist gerade nicht erreichbar.",
      });
    }
  }

  async function callOpenAiResponses(config, proposal, session) {
    if (!config.apiKey) throw new Error("Der OpenAI API-Key für den Anforderungsworkshop fehlt.");
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
          reasoning: { effort: "medium" },
          text: {
            verbosity: "low",
            format: {
              type: "json_schema",
              name: "requirements_understanding_mirror",
              strict: true,
              schema: feedbackSchema(),
            },
          },
          input: [
            { role: "developer", content: [{ type: "input_text", text: systemPrompt() }] },
            { role: "user", content: [{ type: "input_text", text: `Vorschlag des Lernenden:\n${proposal}` }] },
          ],
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error?.message || payload.error || `OpenAI antwortet mit HTTP ${response.status}.`);
      const output = openAiOutputText(payload);
      if (!output) throw new Error("Die KI hat keinen Anforderungsspiegel geliefert.");
      return {
        feedback: JSON.parse(output),
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

  async function preflightUsage(session, config, proposal) {
    if (typeof aiUsageJson !== "function") throw new Error("Die KI-Nutzungsprüfung ist nicht verfügbar.");
    const accountId = accountIdFor(session, projectServerUserId);
    return aiUsageJson("/api/ai-usage/preflight", {
      method: "POST",
      allowPaymentRequired: true,
      internalAuth: { scopes: ["ai.usage.consume"], delegation: userDelegation(session) },
      body: {
        account_id: accountId,
        user_id: accountId,
        project_id: "",
        feature: "requirements_workshop_feedback",
        model: config.apiModel,
        source_id: "openai_gpt",
        estimated_input_tokens: Math.ceil((systemPrompt().length + proposal.length) / 4),
        estimated_output_tokens: MAX_OUTPUT_TOKENS,
        system_capabilities: [],
      },
    });
  }

  async function completeUsage(preflight, usage, session) {
    if (!preflight?.event_id) return null;
    return aiUsageJson(`/api/ai-usage/events/${encodeURIComponent(preflight.event_id)}/complete`, {
      method: "POST",
      internalAuth: { scopes: ["ai.usage.consume"], delegation: userDelegation(session) },
      body: { input_tokens: usage.promptTokens, output_tokens: usage.completionTokens },
    }).catch((error) => ({ event_id: preflight.event_id, status: "tracking_failed", error: error.message || String(error) }));
  }

  async function failUsage(preflight, error, session) {
    if (!preflight?.event_id || typeof aiUsageJson !== "function") return null;
    return aiUsageJson(`/api/ai-usage/events/${encodeURIComponent(preflight.event_id)}/fail`, {
      method: "POST",
      internalAuth: { scopes: ["ai.usage.consume"], delegation: userDelegation(session) },
      body: { error_code: "provider_error", error_message: error.message || String(error) },
    }).catch(() => null);
  }

  function userDelegation(session) {
    return {
      account_id: accountIdFor(session, projectServerUserId),
      project_ids: [],
      entitlements: accountSubscription?.(session)?.entitlements || [],
    };
  }

  return { handleFeedback };
}

function systemPrompt() {
  return [
    "Du bist ein deutschsprachiger Requirements-Engineering-Lerncoach.",
    "Deine wichtigste Aufgabe ist ein Verständnis-Spiegel: Zeige, was du aus dem Text sicher verstanden hast, welche Annahmen du sonst treffen müsstest und welches Wissen fehlt.",
    "Erfinde keine fachlichen Entscheidungen. Formuliere vorgeschlagene Anforderungen nur aus dem gegebenen Inhalt und kennzeichne Lücken als Lücken.",
    "Trenne funktionale Anforderungen (Verhalten/Fähigkeiten) von nichtfunktionalen Anforderungen (messbare Qualität oder Randbedingung). Eine Sicherheitsfunktion kann funktional sein; ihre Stärke, Zeit oder Zuverlässigkeit ist meist nichtfunktional.",
    "Bei Identität und Zugang nie automatisch Benutzername und Passwort unterstellen. Prüfe unter anderem Identifikation, Authentisierung, Autorisierung und Sitzungsbindung sowie PKI/Zertifikate, Token, Passkeys, RFID/NFC, Hardware-Schlüssel, Biometrie und Mehrfaktorverfahren, sofern sie fachlich relevant sein könnten.",
    "Formuliere Akzeptanzkriterien beobachtbar und testbar. Stelle höchstens drei priorisierte Rückfragen.",
    "Schreibe knapp, konkret, respektvoll und auf Deutsch.",
  ].join("\n");
}

function feedbackSchema() {
  const strings = { type: "array", items: { type: "string" } };
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      summary: { type: "string" },
      understood: strings,
      assumptions: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: { title: { type: "string" }, text: { type: "string" }, impact: { type: "string" } },
          required: ["title", "text", "impact"],
        },
      },
      unclear: strings,
      knowledge_gaps: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: { topic: { type: "string" }, explanation: { type: "string" }, options: strings },
          required: ["topic", "explanation", "options"],
        },
      },
      functional_requirements: strings,
      non_functional_requirements: strings,
      constraints: strings,
      business_rules: strings,
      acceptance_criteria: strings,
      follow_up_questions: strings,
      quality_score: { type: "integer", minimum: 0, maximum: 100 },
    },
    required: [
      "summary", "understood", "assumptions", "unclear", "knowledge_gaps",
      "functional_requirements", "non_functional_requirements", "constraints",
      "business_rules", "acceptance_criteria", "follow_up_questions", "quality_score",
    ],
  };
}

function normalizeFeedback(input = {}) {
  const list = (value, limit = 12) => (Array.isArray(value) ? value : []).map(clean).filter(Boolean).slice(0, limit);
  return {
    summary: clean(input.summary).slice(0, 1200),
    understood: list(input.understood),
    assumptions: (Array.isArray(input.assumptions) ? input.assumptions : []).slice(0, 10).map((item) => ({
      title: clean(item?.title).slice(0, 160),
      text: clean(item?.text).slice(0, 800),
      impact: clean(item?.impact).slice(0, 500),
    })).filter((item) => item.title || item.text),
    unclear: list(input.unclear),
    knowledge_gaps: (Array.isArray(input.knowledge_gaps) ? input.knowledge_gaps : []).slice(0, 10).map((item) => ({
      topic: clean(item?.topic).slice(0, 160),
      explanation: clean(item?.explanation).slice(0, 800),
      options: list(item?.options, 8),
    })).filter((item) => item.topic || item.explanation),
    functional_requirements: list(input.functional_requirements),
    non_functional_requirements: list(input.non_functional_requirements),
    constraints: list(input.constraints),
    business_rules: list(input.business_rules),
    acceptance_criteria: list(input.acceptance_criteria),
    follow_up_questions: list(input.follow_up_questions, 3),
    quality_score: Math.max(0, Math.min(100, Number(input.quality_score) || 0)),
  };
}

function privacySafeIdentifier(session, projectServerUserId) {
  return `requirements-${crypto.createHash("sha256").update(accountIdFor(session, projectServerUserId) || "anonymous").digest("hex").slice(0, 24)}`;
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

module.exports = { createRequirementsWorkshopAssistant, feedbackSchema, normalizeFeedback };
