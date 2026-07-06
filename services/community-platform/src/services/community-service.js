const crypto = require("node:crypto");
const { CommunityPlatformError } = require("../errors");

class CommunityService {
  constructor(options) {
    this.repository = options.repository;
    this.triageSlaHours = options.triageSlaHours || 24;
    seedKnowledge(this);
  }

  createQuestion(input = {}) {
    const now = new Date();
    const question = {
      question_id: createId("question"),
      title: required(input.title, "title"),
      body: required(input.body, "body"),
      author_user_id: input.author_user_id || "anonymous",
      project_id: input.project_id || "",
      tags: normalizeList(input.tags),
      status: "open",
      triage_status: "new",
      priority: input.priority || "normal",
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
      triage_due_at: new Date(now.getTime() + this.triageSlaHours * 60 * 60 * 1000).toISOString(),
      triaged_at: null,
      triaged_by: "",
      accepted_answer_id: "",
    };
    return this.repository.saveQuestion(question);
  }

  listQuestions(query = {}) {
    const items = this.repository.listQuestions(query)
      .map((question) => this.decorateQuestion(question));
    return { items };
  }

  getQuestion(questionId) {
    return this.decorateQuestion(this.requireQuestion(questionId));
  }

  triageQuestion(questionId, input = {}) {
    const question = this.requireQuestion(questionId);
    const now = new Date().toISOString();
    const next = {
      ...question,
      triage_status: input.triage_status || input.status || "triaged",
      priority: input.priority || question.priority,
      status: input.question_status || question.status,
      triaged_at: now,
      triaged_by: input.triaged_by || input.actor || "moderator",
      updated_at: now,
      moderation_note: input.moderation_note || question.moderation_note || "",
    };
    return this.decorateQuestion(this.repository.saveQuestion(next));
  }

  createAnswer(questionId, input = {}) {
    const question = this.requireQuestion(questionId);
    const now = new Date().toISOString();
    const answer = {
      answer_id: createId("answer"),
      question_id: question.question_id,
      body: required(input.body, "body"),
      author_user_id: input.author_user_id || "anonymous",
      verification_state: "unverified",
      verified_at: null,
      verified_by: "",
      verification_history: [],
      needs_reverification: false,
      created_at: now,
      updated_at: now,
    };
    return this.repository.saveAnswer(answer);
  }

  updateAnswer(answerId, input = {}) {
    const answer = this.requireAnswer(answerId);
    const now = new Date().toISOString();
    const bodyChanged = input.body && input.body !== answer.body;
    const next = {
      ...answer,
      body: input.body || answer.body,
      updated_at: now,
      verification_state: bodyChanged && answer.verification_state === "verified" ? "requires_reverification" : answer.verification_state,
      needs_reverification: bodyChanged && answer.verification_state === "verified",
    };
    return this.repository.saveAnswer(next);
  }

  verifyAnswer(answerId, input = {}) {
    const answer = this.requireAnswer(answerId);
    const question = this.requireQuestion(answer.question_id);
    const now = new Date().toISOString();
    const next = {
      ...answer,
      verification_state: input.verification_state || "verified",
      verified_at: now,
      verified_by: input.verified_by || input.actor || "expert",
      needs_reverification: false,
      verification_history: answer.verification_history.concat({
        verification_state: input.verification_state || "verified",
        verified_at: now,
        verified_by: input.verified_by || input.actor || "expert",
        note: input.note || "",
      }),
      updated_at: now,
    };
    this.repository.saveAnswer(next);
    if (next.verification_state === "verified" && input.accept !== false) {
      this.repository.saveQuestion({
        ...question,
        status: "answered",
        accepted_answer_id: next.answer_id,
        updated_at: now,
      });
    }
    this.publishKnowledgeDocument(question, next);
    return next;
  }

  listAnswers(questionId) {
    this.requireQuestion(questionId);
    return { items: this.repository.listAnswers(questionId) };
  }

  search(query = {}) {
    const term = String(query.q || query.query || "").toLowerCase();
    const questions = this.repository.listQuestions({}).filter((question) => matches(question, term));
    const answers = Array.from(this.repository.answers.values()).filter((answer) => matches(answer, term));
    const documents = this.repository.listKnowledgeDocuments({}).filter((document) => matches(document, term));
    return {
      items: [
        ...questions.map((question) => ({ type: "question", score: score(question, term), item: this.decorateQuestion(question) })),
        ...answers.map((answer) => ({ type: "answer", score: score(answer, term), item: answer })),
        ...documents.map((document) => ({ type: "knowledge_document", score: score(document, term), item: document })),
      ].sort((left, right) => right.score - left.score),
    };
  }

  listKnowledgeDocuments(query = {}) {
    return { items: this.repository.listKnowledgeDocuments(query) };
  }

  publishKnowledgeDocument(question, answer) {
    if (answer.verification_state !== "verified") return null;
    const document = {
      document_id: `knowledge_${answer.answer_id}`,
      source_type: "community_answer",
      source_id: answer.answer_id,
      question_id: question.question_id,
      title: question.title,
      content: `${question.title}\n\n${question.body}\n\n${answer.body}`,
      tags: question.tags,
      verification_state: answer.verification_state,
      source_reference: {
        type: "community_answer",
        question_id: question.question_id,
        answer_id: answer.answer_id,
      },
      indexed_at: new Date().toISOString(),
    };
    return this.repository.saveKnowledgeDocument(document);
  }

  decorateQuestion(question) {
    const answers = this.repository.listAnswers(question.question_id);
    return {
      ...question,
      answer_count: answers.length,
      verified_answer_count: answers.filter((answer) => answer.verification_state === "verified").length,
      triage_sla_state: new Date(question.triage_due_at).getTime() < Date.now() && question.triage_status === "new" ? "overdue" : "within_sla",
    };
  }

  requireQuestion(questionId) {
    const question = this.repository.findQuestion(questionId);
    if (!question) throw new CommunityPlatformError("question_not_found", "Community-Frage wurde nicht gefunden.", 404);
    return question;
  }

  requireAnswer(answerId) {
    const answer = this.repository.findAnswer(answerId);
    if (!answer) throw new CommunityPlatformError("answer_not_found", "Community-Antwort wurde nicht gefunden.", 404);
    return answer;
  }
}

function seedKnowledge(service) {
  if (service.repository.listQuestions({}).length > 0) return;
  const question = service.createQuestion({
    title: "ESP32 OTA Update schlaegt nach WLAN-Wechsel fehl",
    body: "Nach einem WLAN-Wechsel ist das Board erreichbar, OTA meldet aber timeout.",
    author_user_id: "seed",
    tags: ["esp32", "ota", "wifi"],
  });
  service.triageQuestion(question.question_id, { triaged_by: "system", priority: "normal" });
  const answer = service.createAnswer(question.question_id, {
    author_user_id: "seed-expert",
    body: "Pruefe zuerst den OTA-Hostname im Device-Webserver und sende danach einen Connectivity-Heartbeat an Device Management.",
  });
  service.verifyAnswer(answer.answer_id, { verified_by: "seed-expert" });
}

function normalizeList(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  return String(value || "").split(",").map((item) => item.trim()).filter(Boolean);
}

function matches(item, term) {
  if (!term) return true;
  return JSON.stringify(item).toLowerCase().includes(term);
}

function score(item, term) {
  if (!term) return 1;
  const haystack = JSON.stringify(item).toLowerCase();
  return haystack.split(term).length - 1;
}

function required(value, field) {
  const normalized = String(value || "").trim();
  if (!normalized) throw new CommunityPlatformError("missing_required_field", `Pflichtfeld fehlt: ${field}`);
  return normalized;
}

function createId(prefix) {
  return `${prefix}_${crypto.randomUUID()}`;
}

module.exports = { CommunityService };
