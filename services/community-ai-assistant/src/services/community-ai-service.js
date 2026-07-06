const crypto = require("node:crypto");
const { CommunityAiAssistantError } = require("../errors");

class CommunityAiService {
  constructor(options) {
    this.repository = options.repository;
    this.communityClient = options.communityClient;
    this.aiUsageClient = options.aiUsageClient;
    this.defaultModel = options.defaultModel || "gpt-4.1-mini";
  }

  async answerQuestion(input = {}) {
    const config = this.repository.getConfig();
    if (!config.assistant_enabled) throw new CommunityAiAssistantError("assistant_disabled", "Community AI Assistant ist deaktiviert.", 503);
    const question = required(input.question, "question");
    const moderation = moderate(question, config);
    if (!moderation.allowed) return this.recordBlocked(input, moderation);

    const model = input.model || this.defaultModel;
    const estimatedInputTokens = estimateTokens(question) + 900;
    const estimatedOutputTokens = Number(input.estimated_output_tokens || 500);
    const preflight = await this.aiUsageClient.preflight({
      account_id: required(input.account_id, "account_id"),
      user_id: input.user_id || input.account_id,
      project_id: input.project_id || "",
      feature: "community_ai_assistant",
      model,
      estimated_input_tokens: estimatedInputTokens,
      estimated_output_tokens: estimatedOutputTokens,
      system_capabilities: input.system_capabilities || ["system_capability.community_ai_assistant"],
    });
    if (!preflight.allowed) return this.recordBlocked(input, { reason: preflight.rejection_reason, protection_action: preflight.protection_action }, preflight);

    const sources = await this.retrieveSources(question, config);
    if (!sources.length) {
      return this.recordBlocked(input, { reason: "no_verified_sources", protection_action: "require_sources" }, preflight);
    }

    const answer = composeAnswer(question, sources);
    const completed = await this.aiUsageClient.complete(preflight.event_id, {
      input_tokens: estimatedInputTokens,
      output_tokens: estimateTokens(answer),
    });
    const query = {
      query_id: createId("community_ai_query"),
      account_id: input.account_id,
      user_id: input.user_id || input.account_id,
      question,
      model,
      status: "answered",
      answer,
      sources,
      similar_content: sources.slice(0, 3).map(toSimilarContent),
      usage_event_id: preflight.event_id,
      usage: completed,
      moderation,
      created_at: new Date().toISOString(),
    };
    return this.repository.saveQuery(query);
  }

  async similarContent(input = {}) {
    const sources = await this.retrieveSources(required(input.query, "query"), this.repository.getConfig());
    return { items: sources.map(toSimilarContent) };
  }

  async summarize(input = {}) {
    const sources = await this.retrieveSources(required(input.query, "query"), this.repository.getConfig());
    if (!sources.length) throw new CommunityAiAssistantError("no_sources", "Keine verifizierten Quellen fuer Zusammenfassung gefunden.", 404);
    return {
      summary_id: createId("community_ai_summary"),
      query: input.query,
      summary: sources.map((source) => source.title).slice(0, 3).join("; "),
      sources,
      created_at: new Date().toISOString(),
    };
  }

  adminMetrics() {
    const queries = this.repository.listQueries();
    return {
      summary: {
        total_queries: queries.length,
        answered: queries.filter((query) => query.status === "answered").length,
        blocked: queries.filter((query) => query.status === "blocked").length,
        sources_used: queries.reduce((sum, query) => sum + (query.sources ? query.sources.length : 0), 0),
      },
      frequent_questions: queries.slice(-10).map((query) => ({ query_id: query.query_id, question: query.question, status: query.status })),
      configuration: this.repository.getConfig(),
    };
  }

  updateConfig(input = {}) {
    const current = this.repository.getConfig();
    return this.repository.saveConfig({
      ...current,
      ...input,
      allowed_source_types: input.allowed_source_types || current.allowed_source_types,
      moderation_blocklist: input.moderation_blocklist || current.moderation_blocklist,
    });
  }

  async retrieveSources(question, config) {
    const result = await this.communityClient.search(question);
    const items = (result.items || [])
      .filter((entry) => entry.type === "knowledge_document")
      .map((entry) => entry.item)
      .filter((document) => config.allowed_source_types.includes(document.source_type))
      .filter((document) => !config.require_verified_sources || document.verification_state === "verified")
      .slice(0, config.max_sources);
    if (items.length) return items;
    const documents = await this.communityClient.knowledgeDocuments();
    return (documents.items || []).slice(0, config.max_sources);
  }

  recordBlocked(input, reason, preflight = null) {
    return this.repository.saveQuery({
      query_id: createId("community_ai_query"),
      account_id: input.account_id || "",
      user_id: input.user_id || input.account_id || "",
      question: input.question || "",
      model: input.model || this.defaultModel,
      status: "blocked",
      answer: "",
      sources: [],
      similar_content: [],
      usage_event_id: preflight ? preflight.event_id : "",
      rejection_reason: reason.reason,
      protection_action: reason.protection_action || "block_request",
      moderation: reason,
      created_at: new Date().toISOString(),
    });
  }
}

function composeAnswer(question, sources) {
  const source = sources[0];
  const snippet = String(source.content || "").split(/\n+/).filter(Boolean).slice(-1)[0] || source.title;
  return `Kurzantwort: ${snippet}\n\nBegruendung: Ich nutze nur verifizierte Community-Quellen. Frage: ${question}`;
}

function toSimilarContent(source) {
  return {
    source_type: source.source_type,
    source_id: source.source_id,
    title: source.title,
    source_reference: source.source_reference,
  };
}

function moderate(question, config) {
  const lowered = question.toLowerCase();
  const blocked = config.moderation_blocklist.find((item) => lowered.includes(item));
  if (blocked) return { allowed: false, reason: "moderation_blocked", matched_rule: blocked, protection_action: "moderate_request" };
  return { allowed: true };
}

function estimateTokens(text) {
  return Math.max(1, Math.ceil(String(text || "").length / 4));
}

function required(value, field) {
  const normalized = String(value || "").trim();
  if (!normalized) throw new CommunityAiAssistantError("missing_required_field", `Pflichtfeld fehlt: ${field}`);
  return normalized;
}

function createId(prefix) {
  return `${prefix}_${crypto.randomUUID()}`;
}

module.exports = { CommunityAiService };
