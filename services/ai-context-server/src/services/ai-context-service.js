const crypto = require("node:crypto");
const { AiContextError } = require("../errors");
const { isGrantActive } = require("../repositories/in-memory-ai-context-repository");

const SOURCE_TYPES = new Set(["current_chat", "project_files", "graph_database", "device_data", "customer_data", "admin_statistics", "hardware_catalog", "ai_prompt", "architecture_context", "help_knowledge"]);
const PURPOSES = new Set(["architecture_assistance", "debugging", "support_case", "usage_analysis", "general_chat", "help_assistance"]);
const PROVIDER_SCOPES = new Set(["local_only", "external_allowed", "external_redacted_only"]);
const REDACTION_LEVELS = new Set(["none", "metadata_only", "summary_only", "masked"]);

class AiContextService {
  constructor(options) {
    this.repository = options.repository;
    this.now = options.now || (() => new Date());
  }

  createGrant(input = {}) {
    validateGrantInput(input);
    const now = this.now().toISOString();
    const grant = {
      grant_id: input.grant_id || createId("ai_ctx_grant"),
      account_id: clean(input.account_id),
      project_id: clean(input.project_id),
      granted_by_account_id: clean(input.granted_by_account_id || input.account_id),
      source_type: clean(input.source_type),
      source_scope: normalizeScope(input.source_scope),
      purpose: clean(input.purpose),
      allowed_provider_scope: clean(input.allowed_provider_scope || "local_only"),
      redaction_level: clean(input.redaction_level || "summary_only"),
      max_context_items: positiveInt(input.max_context_items, this.repository.getPolicy().default_max_context_items),
      valid_from: clean(input.valid_from) || now,
      valid_until: clean(input.valid_until),
      revoked_at: clean(input.revoked_at),
      created_at: now,
      rationale: clean(input.rationale),
    };
    assertValidGrantWindow(grant);
    return this.repository.saveGrant(grant);
  }

  revokeGrant(grantId, input = {}) {
    const grant = this.repository.revokeGrant(grantId, clean(input.revoked_at) || this.now().toISOString());
    if (!grant) throw new AiContextError("grant_not_found", "AI-Kontext-Grant wurde nicht gefunden.", 404);
    return grant;
  }

  listGrants(filter = {}) {
    return this.repository.listGrants(filter);
  }

  listSources(filter = {}) {
    return this.repository.listSources(filter);
  }

  listPromptFoundations(filter = {}) {
    return this.repository.listPromptFoundations(filter);
  }

  listArchitectureComponents(filter = {}) {
    return this.repository.listArchitectureComponents(filter);
  }

  listHelpArticles(filter = {}) {
    return this.repository.listHelpArticles(filter);
  }

  upsertHelpArticle(input = {}) {
    validateHelpArticleInput(input);
    const now = this.now().toISOString();
    const articleId = clean(input.article_id);
    return mapMaybePromise(this.repository.listHelpArticles(), (items) => {
      const existing = items.find((item) => item.article_id === articleId);
      return this.repository.saveHelpArticle({
        article_id: articleId,
        title: clean(input.title),
        summary: clean(input.summary),
        content: clean(input.content),
        help_topic_id: clean(input.help_topic_id),
        status: clean(input.status || "active"),
        created_at: existing?.created_at || now,
        updated_at: now,
      });
    });
  }

  searchHelpArticles(query, limit = 3) {
    const normalizedQuery = clean(query);
    if (!normalizedQuery) return { strategy: "none", items: [] };
    const normalizedLimit = Math.min(5, positiveInt(limit, 3));
    if (typeof this.repository.searchHelpArticles === "function") return this.repository.searchHelpArticles(normalizedQuery, normalizedLimit);
    return mapMaybePromise(this.repository.listHelpArticles({ status: "active" }), (items) => ({
      strategy: "lexical_fallback",
      items: lexicalHelpSearch(normalizedQuery, items, normalizedLimit),
    }));
  }

  upsertPromptFoundation(input = {}) {
    validatePromptFoundationInput(input);
    const now = this.now().toISOString();
    const foundationId = clean(input.foundation_id);
    return mapMaybePromise(this.repository.listPromptFoundations(), (items) => {
    const existing = items.find((item) => item.foundation_id === foundationId);
    return this.repository.savePromptFoundation({
      foundation_id: foundationId,
      title: clean(input.title),
      route_task: clean(input.route_task),
      source_scope: normalizeScope(input.source_scope),
      content_kind: clean(input.content_kind || "system_prompt"),
      allowed_sources: Array.isArray(input.allowed_sources) ? input.allowed_sources.map(clean).filter(Boolean) : [],
      blocked_sources: Array.isArray(input.blocked_sources) ? input.blocked_sources.map(clean).filter(Boolean) : [],
      content: clean(input.content),
      status: clean(input.status || "active"),
      created_at: existing?.created_at || now,
      updated_at: now,
    });});
  }

  upsertSource(input = {}) {
    validateSourceInput(input);
    const now = this.now().toISOString();
    return mapMaybePromise(this.repository.listSources(), (items) => {
    const existing = items.find((source) => source.source_id === clean(input.source_id));
    return this.repository.saveSource({
      source_id: clean(input.source_id),
      source_type: clean(input.source_type),
      source_scope: normalizeScope(input.source_scope),
      title: clean(input.title),
      summary: clean(input.summary),
      backing_service: clean(input.backing_service),
      endpoint: clean(input.endpoint),
      contains: Array.isArray(input.contains) ? input.contains.map(clean).filter(Boolean) : [],
      default_redaction_level: clean(input.default_redaction_level || "summary_only"),
      default_provider_scope: clean(input.default_provider_scope || "local_only"),
      allowed_purposes: Array.isArray(input.allowed_purposes) ? input.allowed_purposes.map(clean).filter((purpose) => PURPOSES.has(purpose)) : [],
      status: clean(input.status || "active"),
      created_at: existing?.created_at || now,
      updated_at: now,
    });});
  }

  upsertArchitectureComponent(input = {}) {
    validateArchitectureComponentInput(input);
    const now = this.now().toISOString();
    const componentId = clean(input.component_id);
    return mapMaybePromise(this.repository.listArchitectureComponents(), (items) => {
    const existing = items.find((item) => item.component_id === componentId);
    return this.repository.saveArchitectureComponent({
      component_id: componentId,
      name: clean(input.name),
      aliases: arrayOfClean(input.aliases),
      summary: clean(input.summary),
      properties: arrayOfClean(input.properties),
      provided_interfaces: arrayOfClean(input.provided_interfaces),
      required_interfaces: arrayOfClean(input.required_interfaces),
      decision_hints: arrayOfClean(input.decision_hints),
      source_scope: normalizeScope(input.source_scope || `start_architecture/components/${componentId.replace(/^arch_component\./, "")}`),
      status: clean(input.status || "active"),
      created_at: existing?.created_at || now,
      updated_at: now,
    });});
  }

  getPolicy() {
    return this.repository.getPolicy();
  }

  updatePolicy(input = {}) {
    const policy = {
      deny_without_grant: bool(input.deny_without_grant, true),
      require_explicit_source_scope: bool(input.require_explicit_source_scope, true),
      allow_external_provider_customer_data: bool(input.allow_external_provider_customer_data, false),
      default_max_context_items: positiveInt(input.default_max_context_items, 12),
      protected_source_types: Array.isArray(input.protected_source_types)
        ? input.protected_source_types.filter((sourceType) => SOURCE_TYPES.has(sourceType))
        : undefined,
    };
    return this.repository.savePolicy(removeUndefined(policy));
  }

  preflight(input = {}) {
    const request = normalizePreflightInput(input);
    return mapMaybePromise(this.repository.getPolicy(), (policy) => mapMaybePromise(this.repository.listGrants(), (grants) => {
    const decision = decideAccess({ request, policy, grants }, this.now());
    return mapMaybePromise(this.repository.addAuditEvent({
      audit_event_id: createId("ai_ctx_audit"),
      occurred_at: this.now().toISOString(),
      account_id: request.account_id,
      project_id: request.project_id,
      actor_id: request.actor_id,
      actor_role: request.actor_role,
      source_type: request.source_type,
      source_scope: request.source_scope,
      purpose: request.purpose,
      provider: request.provider,
      model: request.model,
      grant_id: decision.grant?.grant_id || null,
      access_decision: decision.allowed ? "allowed" : "denied",
      rejection_reason: decision.allowed ? null : decision.reason,
      redaction_level: decision.redaction_level || null,
      allowed_context_items: decision.allowed_context_items || 0,
    }), (auditEvent) => ({
      allowed: decision.allowed,
      reason: decision.reason,
      grant: decision.grant || null,
      redaction_level: decision.redaction_level || null,
      allowed_context_items: decision.allowed_context_items || 0,
      audit_event_id: auditEvent.audit_event_id,
    }));}));
  }

  searchArchitectureComponents(query, limit = 5) {
    const normalizedQuery = clean(query);
    if (!normalizedQuery) return { strategy:"none", items:[] };
    const normalizedLimit = Math.min(20, positiveInt(limit, 5));
    if (typeof this.repository.searchArchitectureComponents === "function") {
      return this.repository.searchArchitectureComponents(normalizedQuery, normalizedLimit);
    }
    return mapMaybePromise(this.repository.listArchitectureComponents({ status:"active" }), (items) => ({
      strategy:"lexical_fallback",
      items:lexicalArchitectureSearch(normalizedQuery, items, normalizedLimit),
    }));
  }

  recordClarificationCase(input = {}) {
    const utterance = clean(input.utterance);
    if (!utterance) throw new AiContextError("missing_utterance", "Eine Nutzerformulierung wird benoetigt.");
    const now = this.now().toISOString();
    const normalizedUtterance = normalizeLearningText(utterance);
    const fingerprint = crypto.createHash("sha256").update([
      clean(input.domain || "architecture"), normalizedUtterance,
      clean(input.suggested_intent), clean(input.suggested_entity),
    ].join("|")).digest("hex");
    return mapMaybePromise(this.repository.findClarificationCaseByFingerprint(fingerprint), (existing) => {
      const occurrenceCount = Number(existing?.occurrence_count || 0) + 1;
      const semanticScore = boundedScore(input.semantic_score, existing?.semantic_score);
      const correctionCount = Number(existing?.correction_count || 0);
      const priorityScore = clarificationPriorityScore({ occurrenceCount, semanticScore, correctionCount, reason: input.ambiguity_reason });
      return this.repository.saveClarificationCase({
        case_id: existing?.case_id || createId("ai_clarification"),
        fingerprint,
        utterance,
        normalized_utterance: normalizedUtterance,
        domain: clean(input.domain || "architecture"),
        account_id: clean(input.account_id) || null,
        project_id: clean(input.project_id) || null,
        suggested_intent: clean(input.suggested_intent) || null,
        suggested_entity: clean(input.suggested_entity) || null,
        semantic_score: semanticScore,
        ambiguity_reason: clean(input.ambiguity_reason || "low_confidence"),
        occurrence_count: occurrenceCount,
        confirmation_count: Number(existing?.confirmation_count || 0),
        correction_count: correctionCount,
        priority: priorityLabel(priorityScore),
        priority_score: priorityScore,
        status: existing && !["resolved", "ignored"].includes(existing.status) ? existing.status : "open",
        resolution: existing?.resolution || null,
        created_at: existing?.created_at || now,
        updated_at: now,
        last_seen_at: now,
      });
    });
  }

  listClarificationCases(filter = {}) {
    return mapMaybePromise(this.repository.listClarificationCases(), (allItems) => ({
      summary: summarizeClarificationCases(allItems),
      items: allItems.filter((item) => !filter.status || item.status === filter.status).filter((item) => !filter.priority || item.priority === filter.priority),
    }));
  }

  resolveClarificationCase(caseId, input = {}) {
    return mapMaybePromise(this.repository.findClarificationCase(clean(caseId)), (existing) => {
      if (!existing) throw new AiContextError("clarification_case_not_found", "KI-Klaerfall wurde nicht gefunden.", 404);
      const action = clean(input.action);
      if (!new Set(["confirm", "correct", "defer", "ignore", "reopen", "prioritize"]).has(action)) {
        throw new AiContextError("invalid_clarification_action", "Unbekannte Klaerfall-Aktion.");
      }
      const now = this.now().toISOString();
      const confirmed = action === "confirm";
      const corrected = action === "correct";
      const intent = clean(input.intent || existing.suggested_intent);
      const entity = clean(input.entity || existing.suggested_entity);
      if ((confirmed || corrected) && !intent) throw new AiContextError("missing_intent", "Fuer die Uebernahme wird ein Intent benoetigt.");
      const confirmationCount = Number(existing.confirmation_count || 0) + (confirmed ? 1 : 0);
      const correctionCount = Number(existing.correction_count || 0) + (corrected ? 1 : 0);
      const score = action === "prioritize"
        ? Math.max(Number(existing.priority_score || 0), priorityFloor(clean(input.priority)))
        : clarificationPriorityScore({ occurrenceCount:existing.occurrence_count, semanticScore:existing.semantic_score, correctionCount, reason:existing.ambiguity_reason });
      const next = {
        ...existing,
        suggested_intent: intent || existing.suggested_intent,
        suggested_entity: entity || existing.suggested_entity,
        confirmation_count: confirmationCount,
        correction_count: correctionCount,
        priority_score: score,
        priority: action === "prioritize" && clean(input.priority) ? clean(input.priority) : priorityLabel(score),
        status: clarificationStatus(action),
        resolution: confirmed || corrected ? { intent, entity:entity||null, scope:clean(input.scope||"global"), resolved_by:clean(input.resolved_by||"admin"), resolved_at:now } : existing.resolution,
        updated_at: now,
      };
      return mapMaybePromise(this.repository.saveClarificationCase(next), (saved) => {
        if (!(confirmed || corrected) || input.promote === false) return saved;
        return mapMaybePromise(this.repository.saveIntentExample({
          example_id: createId("ai_intent_example"),
          utterance: existing.utterance,
          normalized_utterance: existing.normalized_utterance,
          intent,
          entity: entity || null,
          domain: existing.domain,
          scope: clean(input.scope || "global"),
          account_id: clean(input.scope) === "account" ? existing.account_id : null,
          source_case_id: existing.case_id,
          status: "active",
          created_at: now,
          updated_at: now,
        }), () => saved);
      });
    });
  }

  listIntentExamples(filter = {}) {
    return this.repository.listIntentExamples(filter);
  }

  searchIntentExamples(query, limit = 5, accountId = "") {
    const normalizedQuery = clean(query);
    if (!normalizedQuery) return { strategy:"none", items:[] };
    const normalizedLimit = Math.min(20, positiveInt(limit, 5));
    if (typeof this.repository.searchIntentExamples === "function") return this.repository.searchIntentExamples(normalizedQuery, normalizedLimit, clean(accountId));
    return mapMaybePromise(this.repository.listIntentExamples({status:"active",account_id:clean(accountId)}), (items) => ({strategy:"lexical_fallback",items:lexicalIntentSearch(normalizedQuery,items,normalizedLimit)}));
  }

  listAuditEvents(filter = {}) {
    return this.repository.listAuditEvents(filter);
  }

  sqliteSummary() {
    if (typeof this.repository.sqliteSummary === "function") {
      return this.repository.sqliteSummary();
    }
    return {
      available: false,
      reason: "sqlite_repository_not_enabled",
      tables: [],
      service_documents: [],
    };
  }

  storageSummary() {
    if (typeof this.repository.summary === "function") return this.repository.summary();
    return this.sqliteSummary();
  }
}

function mapMaybePromise(value, mapper) {
  return value && typeof value.then === "function" ? value.then(mapper) : mapper(value);
}

function normalizeLearningText(value) {
  return String(value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
}

function boundedScore(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.min(1, number)) : Number(fallback || 0);
}

function clarificationPriorityScore({ occurrenceCount, semanticScore, correctionCount, reason }) {
  const uncertainty = Math.round((1 - boundedScore(semanticScore)) * 45);
  const frequency = Math.min(30, Math.max(0, Number(occurrenceCount || 1) - 1) * 5);
  const corrections = Math.min(20, Number(correctionCount || 0) * 10);
  const reasonWeight = clean(reason) === "conflicting_matches" ? 10 : clean(reason) === "unknown_entity" ? 8 : 0;
  return Math.min(100, 15 + uncertainty + frequency + corrections + reasonWeight);
}

function priorityLabel(score) { return score >= 80 ? "urgent" : score >= 60 ? "high" : score >= 35 ? "normal" : "low"; }
function priorityFloor(priority) { return ({urgent:80,high:60,normal:35,low:0})[priority] ?? 0; }
function clarificationStatus(action) { return ({confirm:"resolved",correct:"resolved",defer:"deferred",ignore:"ignored",reopen:"open",prioritize:"open"})[action]; }
function summarizeClarificationCases(items) { return {total:items.length,open:items.filter((item)=>item.status==="open").length,urgent:items.filter((item)=>item.status==="open"&&item.priority==="urgent").length,resolved:items.filter((item)=>item.status==="resolved").length}; }
function lexicalIntentSearch(query,items,limit){const tokens=normalizeLearningText(query).split(" ").filter((token)=>token.length>2);return items.map((item)=>{const corpus=normalizeLearningText(`${item.utterance} ${item.intent} ${item.entity||""}`);const score=tokens.reduce((sum,token)=>sum+(corpus.includes(token)?1:0),0);return{...item,semantic_score:score};}).filter((item)=>item.semantic_score>0).sort((a,b)=>b.semantic_score-a.semantic_score).slice(0,limit);}

function lexicalArchitectureSearch(query, items, limit) {
  const queryTokens = lookupTokens(query);
  return items.map((item) => {
    const corpus = lookupTokens([item.name,...(item.aliases||[]),item.summary,...(item.properties||[]),...(item.provided_interfaces||[]),...(item.required_interfaces||[]),...(item.decision_hints||[])].join(" "));
    const corpusSet = new Set(corpus);
    const semanticScore = queryTokens.reduce((score, token) => score + (corpusSet.has(token) ? 1 : 0), 0);
    return { ...item, semantic_score:semanticScore };
  }).filter((item) => item.semantic_score > 0).sort((left,right) => right.semantic_score-left.semantic_score).slice(0,limit);
}

function lexicalHelpSearch(query, items, limit) {
  const queryTokens = lookupTokens(query);
  return items.map((item) => {
    const corpus = new Set(lookupTokens(`${item.title} ${item.summary} ${item.content}`));
    const semanticScore = queryTokens.reduce((score, token) => score + (corpus.has(token) ? 1 : 0), 0);
    return { ...item, semantic_score: semanticScore };
  }).filter((item) => item.semantic_score > 0).sort((left, right) => right.semantic_score - left.semantic_score).slice(0, limit);
}

function lookupTokens(value) {
  return clean(value).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9 ]+/g," ").split(/\s+/).filter((token)=>token.length>2);
}

function decideAccess({ request, policy, grants }, now) {
  if (!SOURCE_TYPES.has(request.source_type)) return deny("unknown_source_type");
  if (!PURPOSES.has(request.purpose)) return deny("unknown_purpose");
  if (policy.require_explicit_source_scope && !request.source_scope) return deny("missing_source_scope");

  const matchingGrant = grants.find((grant) => grantMatchesRequest(grant, request, now));
  if (!matchingGrant) return deny("missing_valid_grant");

  if (request.source_type === "help_knowledge" && request.provider !== "ollama") {
    return deny("help_knowledge_local_only");
  }
  if (request.provider !== "ollama" && matchingGrant.allowed_provider_scope === "local_only") {
    return deny("external_provider_not_allowed_by_grant");
  }
  if (request.provider !== "ollama" && matchingGrant.allowed_provider_scope === "external_redacted_only" && matchingGrant.redaction_level === "none") {
    return deny("external_provider_requires_redaction");
  }
  if (request.provider !== "ollama" && request.source_type === "customer_data" && !policy.allow_external_provider_customer_data) {
    return deny("external_provider_customer_data_blocked_by_policy");
  }

  return {
    allowed: true,
    reason: "valid_grant",
    grant: matchingGrant,
    redaction_level: matchingGrant.redaction_level,
    allowed_context_items: matchingGrant.max_context_items || policy.default_max_context_items,
  };
}

function grantMatchesRequest(grant, request, now) {
  if (!isGrantActive(grant, now)) return false;
  if (grant.account_id !== "*" && grant.account_id !== request.account_id) return false;
  if (grant.project_id && request.project_id && grant.project_id !== request.project_id) return false;
  if (grant.source_type !== request.source_type) return false;
  if (grant.purpose !== request.purpose) return false;
  return scopeIncludes(grant.source_scope, request.source_scope);
}

function scopeIncludes(grantScope, requestScope) {
  if (grantScope === "*") return true;
  if (!requestScope) return false;
  if (grantScope === requestScope) return true;
  return requestScope.startsWith(`${grantScope}/`);
}

function validateGrantInput(input) {
  for (const field of ["account_id", "source_type", "source_scope", "purpose", "valid_until"]) {
    if (!clean(input[field])) throw new AiContextError("missing_required_field", `Pflichtfeld fehlt: ${field}`);
  }
  if (!SOURCE_TYPES.has(clean(input.source_type))) throw new AiContextError("invalid_source_type", "Unbekannte Kontextquelle.");
  if (!PURPOSES.has(clean(input.purpose))) throw new AiContextError("invalid_purpose", "Unbekannter KI-Kontextzweck.");
  if (!PROVIDER_SCOPES.has(clean(input.allowed_provider_scope || "local_only"))) throw new AiContextError("invalid_provider_scope", "Unbekannter Provider-Scope.");
  if (!REDACTION_LEVELS.has(clean(input.redaction_level || "summary_only"))) throw new AiContextError("invalid_redaction_level", "Unbekannte Redaktionsstufe.");
}

function validateSourceInput(input) {
  for (const field of ["source_id", "source_type", "source_scope", "title", "backing_service", "endpoint"]) {
    if (!clean(input[field])) throw new AiContextError("missing_required_field", `Pflichtfeld fehlt: ${field}`);
  }
  if (!SOURCE_TYPES.has(clean(input.source_type))) throw new AiContextError("invalid_source_type", "Unbekannte Kontextquelle.");
  if (!REDACTION_LEVELS.has(clean(input.default_redaction_level || "summary_only"))) throw new AiContextError("invalid_redaction_level", "Unbekannte Redaktionsstufe.");
  if (!PROVIDER_SCOPES.has(clean(input.default_provider_scope || "local_only"))) throw new AiContextError("invalid_provider_scope", "Unbekannter Provider-Scope.");
}

function validatePromptFoundationInput(input) {
  for (const field of ["foundation_id", "title", "route_task", "source_scope", "content"]) {
    if (!clean(input[field])) throw new AiContextError("missing_required_field", `Pflichtfeld fehlt: ${field}`);
  }
  if (clean(input.content_kind || "system_prompt") !== "system_prompt") {
    throw new AiContextError("invalid_content_kind", "Unbekannte Prompt-Grundlagen-Art.");
  }
  if (!["active", "draft", "archived"].includes(clean(input.status || "active"))) {
    throw new AiContextError("invalid_status", "Unbekannter Prompt-Grundlagen-Status.");
  }
}

function validateArchitectureComponentInput(input) {
  for (const field of ["component_id", "name", "summary"]) {
    if (!clean(input[field])) throw new AiContextError("missing_required_field", `Pflichtfeld fehlt: ${field}`);
  }
  if (!["active", "draft", "archived"].includes(clean(input.status || "active"))) {
    throw new AiContextError("invalid_status", "Unbekannter Komponenten-Status.");
  }
}

function validateHelpArticleInput(input) {
  for (const field of ["article_id", "title", "summary", "content", "help_topic_id"]) {
    if (!clean(input[field])) throw new AiContextError("missing_required_field", `Pflichtfeld fehlt: ${field}`);
  }
  if (!["active", "draft", "archived"].includes(clean(input.status || "active"))) {
    throw new AiContextError("invalid_status", "Unbekannter Help-Artikel-Status.");
  }
}

function normalizePreflightInput(input) {
  for (const field of ["account_id", "source_type", "purpose", "provider"]) {
    if (!clean(input[field])) throw new AiContextError("missing_required_field", `Pflichtfeld fehlt: ${field}`);
  }
  return {
    account_id: clean(input.account_id),
    project_id: clean(input.project_id),
    actor_id: clean(input.actor_id || input.account_id),
    actor_role: clean(input.actor_role || "account_owner"),
    source_type: clean(input.source_type),
    source_scope: normalizeScope(input.source_scope),
    purpose: clean(input.purpose),
    provider: clean(input.provider),
    model: clean(input.model),
  };
}

function assertValidGrantWindow(grant) {
  if (new Date(grant.valid_until).getTime() <= new Date(grant.valid_from).getTime()) {
    throw new AiContextError("invalid_validity_window", "valid_until muss nach valid_from liegen.");
  }
}

function deny(reason) {
  return { allowed: false, reason };
}

function clean(value) {
  return String(value || "").trim();
}

function normalizeScope(value) {
  const scope = clean(value);
  return scope.replace(/\\/g, "/").replace(/\/+/g, "/");
}

function positiveInt(value, fallback) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : fallback;
}

function bool(value, fallback) {
  return typeof value === "boolean" ? value : fallback;
}

function arrayOfClean(value) {
  return Array.isArray(value) ? value.map(clean).filter(Boolean) : [];
}

function removeUndefined(input) {
  return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined));
}

function createId(prefix) {
  return `${prefix}_${crypto.randomUUID()}`;
}

module.exports = { AiContextService, decideAccess };
