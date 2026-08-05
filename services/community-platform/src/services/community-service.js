const crypto = require("node:crypto");
const { CommunityPlatformError } = require("../errors");

class CommunityService {
  constructor(options) {
    this.repository = options.repository;
    this.triageSlaHours = options.triageSlaHours || 24;
    this.internalToken = options.internalToken || "";
    this.adminToken = options.adminToken || "";
    this.persistenceBackend = options.persistenceBackend || "unknown";
    this.messageRateLimit = options.messageRateLimit || 20;
    this.messageRateWindowSeconds = options.messageRateWindowSeconds || 600;
    this.supportUserIds = options.supportUserIds?.length ? options.supportUserIds : ["support"];
  }

  async operationsSummary() {
    const questions = await this.repository.listQuestions({});
    const answers = await this.repository.listAllAnswers();
    const knowledgeDocuments = await this.repository.listKnowledgeDocuments({});
    const marketplaceListings = await this.repository.listMarketplaceListings?.({}) || [];
    const projectIdeas = await this.repository.listProjectIdeas?.({}) || [];
    const projectShowcases = await this.repository.listProjectShowcases?.({}) || [];
    const now = Date.now();
    return {
      persistence_backend: this.persistenceBackend,
      questions: {
        total: questions.length,
        public: questions.filter((question) => question.visibility === "public").length,
        private: questions.filter((question) => question.visibility === "private").length,
        open: questions.filter((question) => question.status === "open").length,
        answered: questions.filter((question) => question.status === "answered").length,
        awaiting_triage: questions.filter((question) => question.triage_status === "new").length,
        overdue: questions.filter((question) => (
          question.triage_status === "new"
          && new Date(question.triage_due_at).getTime() < now
        )).length,
      },
      answers: {
        total: answers.length,
        verified: answers.filter((answer) => answer.verification_state === "verified").length,
        requires_reverification: answers.filter((answer) => answer.verification_state === "requires_reverification").length,
      },
      knowledge_documents: {
        total: knowledgeDocuments.length,
        verified: knowledgeDocuments.filter((document) => document.verification_state === "verified").length,
      },
      marketplace: {
        total: marketplaceListings.length,
        published: marketplaceListings.filter((item) => item.state === "published").length,
      },
      project_ideas: {
        total: projectIdeas.length,
        published: projectIdeas.filter((item) => item.state === "published").length,
      },
      project_showcases: {
        total: projectShowcases.length,
        published: projectShowcases.filter((item) => item.state === "published").length,
      },
    };
  }

  async createMarketplaceListing(input = {}, actor = {}) {
    const priceCents = Number(input.price_cents);
    if (!Number.isInteger(priceCents) || priceCents < 0 || priceCents > 5_000_000) {
      throw new CommunityPlatformError("marketplace_price_invalid", "Der Preis muss zwischen 0 und 50.000 Euro liegen.", 400);
    }
    const condition = normalizeMarketplaceCondition(input.condition);
    const now = new Date().toISOString();
    const listing = {
      listing_id: createId("marketplace"),
      author_user_id: required(actor.user_id, "actor_user_id"),
      author_label: String(input.author_label || "Community-Mitglied").trim().slice(0, 80),
      title: required(input.title, "title").slice(0, 120),
      description: required(input.description, "description").slice(0, 1200),
      category: normalizeMarketplaceCategory(input.category),
      condition,
      tags: normalizeList(input.tags).slice(0, 12).map((item) => String(item).slice(0, 40)),
      sale_type: "used_electronics",
      price_cents: priceCents,
      currency: "EUR",
      pickup_location: String(input.pickup_location || "").trim().slice(0, 80),
      shipping_available: input.shipping_available === true || input.shipping_available === "true",
      verification_state: "community_unverified",
      state: "published",
      created_at: now,
      updated_at: now,
    };
    return presentMarketplaceListing(await this.repository.saveMarketplaceListing(listing), actor);
  }

  async listMarketplaceListings(query = {}, actor = {}) {
    const ownOnly = query.mine === "true";
    const listings = await this.repository.listMarketplaceListings({
      state: ownOnly ? "" : "published",
      author_user_id: ownOnly ? actor.user_id : "",
    });
    const term = String(query.q || "").trim().toLowerCase();
    const category = String(query.category || "").trim();
    return { items: listings
      .filter((item) => !term || matches(item, term))
      .filter((item) => !category || item.category === category)
      .map((item) => presentMarketplaceListing(item, actor)) };
  }

  async getMarketplaceListing(listingId, actor = {}) {
    const listing = await this.repository.findMarketplaceListing(listingId);
    if (!listing || (listing.state !== "published" && listing.author_user_id !== actor.user_id)) {
      throw new CommunityPlatformError("marketplace_listing_not_found", "Dieser Marktplatz-Eintrag wurde nicht gefunden.", 404);
    }
    return presentMarketplaceListing(listing, actor);
  }

  async updateMarketplaceListing(listingId, input = {}, actor = {}) {
    const listing = await this.repository.findMarketplaceListing(listingId);
    if (!listing || listing.author_user_id !== actor.user_id) {
      throw new CommunityPlatformError("marketplace_listing_not_found", "Dieser Marktplatz-Eintrag wurde nicht gefunden.", 404);
    }
    const state = String(input.state || "");
    if (!["published", "reserved", "sold"].includes(state)) {
      throw new CommunityPlatformError("marketplace_state_invalid", "Unbekannter Inseratsstatus.", 400);
    }
    return presentMarketplaceListing(await this.repository.saveMarketplaceListing({
      ...listing,
      state,
      updated_at: new Date().toISOString(),
    }), actor);
  }

  async createProjectIdea(input = {}, actor = {}) {
    const now = new Date().toISOString();
    const idea = {
      idea_id: createId("idea"),
      author_user_id: required(actor.user_id, "actor_user_id"),
      author_label: String(input.author_label || "Community-Mitglied").trim().slice(0, 80),
      title: required(input.title, "title").slice(0, 140),
      pitch: required(input.pitch, "pitch").slice(0, 320),
      description: required(input.description, "description").slice(0, 5000),
      motivation: String(input.motivation || "").trim().slice(0, 1600),
      stage: normalizeProjectIdeaStage(input.stage),
      looking_for: normalizeList(input.looking_for).filter((item) => ["feedback", "collaborators", "hardware", "software", "testing"].includes(item)).slice(0, 5),
      tags: normalizeList(input.tags).slice(0, 12).map((item) => String(item).slice(0, 40)),
      state: "published",
      created_at: now,
      updated_at: now,
    };
    return presentProjectIdea(await this.repository.saveProjectIdea(idea), actor, 0);
  }

  async listProjectIdeas(query = {}, actor = {}) {
    const ideas = await this.repository.listProjectIdeas({ state: "published" });
    const term = String(query.q || "").trim().toLowerCase();
    const stage = String(query.stage || "").trim();
    return { items: await Promise.all(ideas
      .filter((item) => !term || matches(item, term))
      .filter((item) => !stage || item.stage === stage)
      .map(async (item) => presentProjectIdea(item, actor, (await this.repository.listProjectIdeaComments(item.idea_id)).length))) };
  }

  async getProjectIdea(ideaId, actor = {}) {
    const idea = await this.repository.findProjectIdea(ideaId);
    if (!idea || idea.state !== "published") throw new CommunityPlatformError("project_idea_not_found", "Diese Projektidee wurde nicht gefunden.", 404);
    const comments = await this.repository.listProjectIdeaComments(ideaId);
    return { ...presentProjectIdea(idea, actor, comments.length), comments: comments.map(presentProjectIdeaComment) };
  }

  async createProjectIdeaComment(ideaId, input = {}, actor = {}) {
    const idea = await this.repository.findProjectIdea(ideaId);
    if (!idea || idea.state !== "published") throw new CommunityPlatformError("project_idea_not_found", "Diese Projektidee wurde nicht gefunden.", 404);
    const comment = {
      comment_id: createId("idea_comment"), idea_id: ideaId,
      author_user_id: required(actor.user_id, "actor_user_id"),
      author_label: String(input.author_label || "Community-Mitglied").trim().slice(0, 80),
      body: required(input.body, "body").slice(0, 2500),
      created_at: new Date().toISOString(),
    };
    await this.repository.saveProjectIdeaComment(comment);
    await this.repository.saveProjectIdea({ ...idea, updated_at: comment.created_at });
    return presentProjectIdeaComment(comment);
  }

  async createProjectShowcase(input = {}, actor = {}) {
    const snapshot = normalizeProjectSnapshot(input.project_snapshot);
    if (!snapshot) throw new CommunityPlatformError("showcase_project_snapshot_required", "Für den Projekt-Showcase ist eine sichere Projektkopie erforderlich.", 400);
    const now = new Date().toISOString();
    const showcase = {
      showcase_id: createId("showcase"),
      author_user_id: required(actor.user_id, "actor_user_id"),
      author_label: String(input.author_label || "Community-Mitglied").trim().slice(0, 80),
      title: required(input.title || snapshot.project_title, "title").slice(0, 140),
      summary: required(input.summary, "summary").slice(0, 420),
      story: required(input.story, "story").slice(0, 5000),
      hardware_items: normalizeList(input.hardware_items).slice(0, 24).map((item) => String(item).slice(0, 100)),
      tags: normalizeList(input.tags).slice(0, 12).map((item) => String(item).slice(0, 40)),
      project_snapshot: snapshot,
      verification_state: "community_unverified",
      state: "published",
      created_at: now,
      updated_at: now,
    };
    return presentProjectShowcase(await this.repository.saveProjectShowcase(showcase), actor);
  }

  async listProjectShowcases(query = {}, actor = {}) {
    const term = String(query.q || "").trim().toLowerCase();
    const items = await this.repository.listProjectShowcases({ state: "published" });
    return { items: items.filter((item) => !term || matches(item, term)).map((item) => presentProjectShowcase(item, actor)) };
  }

  async getProjectShowcase(showcaseId, actor = {}) {
    const showcase = await this.repository.findProjectShowcase(showcaseId);
    if (!showcase || showcase.state !== "published") throw new CommunityPlatformError("project_showcase_not_found", "Dieses Community-Projekt wurde nicht gefunden.", 404);
    return presentProjectShowcase(showcase, actor, true);
  }

  async adminOverview(actor = {}) {
    requireAdminCapability(actor, ["admin_community_support", "admin_community_moderation"]);
    const [supportThreads, reports, summary] = await Promise.all([
      this.repository.listMessageThreads({ mailbox_kind: "support", archived: false }),
      this.repository.listMessageReports({ status: "open" }),
      this.operationsSummary(),
    ]);
    return {
      support: { open: supportThreads.length },
      questions: summary.questions,
      reports: { open: reports.length },
    };
  }

  async createQuestion(input = {}, actor = {}) {
    const now = new Date();
    const question = {
      question_id: createId("question"),
      title: required(input.title, "title"),
      body: required(input.body, "body"),
      author_user_id: required(actor.user_id, "actor_user_id"),
      project_id: input.project_id || "",
      project_snapshot: normalizeProjectSnapshot(input.project_snapshot),
      visibility: input.visibility === "private" ? "private" : "public",
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

  async listQuestions(query = {}, actor = {}) {
    const visible = (await this.repository.listQuestions(query))
      .filter((question) => canAccess(question, actor))
      .filter((question) => query.mine !== "true" || question.author_user_id === actor.user_id);
    const items = await Promise.all(visible.map(async (question) =>
      this.presentQuestion(await this.decorateQuestion(question), actor)));
    return { items };
  }

  async dashboardSummary(actor = {}) {
    const userId = required(actor.user_id, "actor_user_id");
    const summary = await this.repository.dashboardSummary(userId);
    return {
      available: true,
      ...summary.questions,
      messages: summary.messages,
    };
  }

  async getQuestion(questionId, actor = {}) {
    const question = await this.requireQuestion(questionId);
    requireAccess(question, actor);
    return this.presentQuestion(await this.decorateQuestion(question), actor);
  }

  async triageQuestion(questionId, input = {}, actor = {}) {
    requireOperator(actor);
    const question = await this.requireQuestion(questionId);
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
    return this.decorateQuestion(await this.repository.saveQuestion(next));
  }

  async createAnswer(questionId, input = {}, actor = {}) {
    const question = await this.requireQuestion(questionId);
    requireAccess(question, actor);
    if (!actor.is_operator && question.author_user_id !== actor.user_id) throw new CommunityPlatformError("community_access_denied", "Antworten sind nur fuer die anfragende Person oder GerNetiX moeglich.", 403);
    const now = new Date().toISOString();
    const answer = {
      answer_id: createId("answer"),
      question_id: question.question_id,
      body: required(input.body, "body"),
      author_user_id: actor.user_id,
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

  async updateAnswer(answerId, input = {}, actor = {}) {
    const answer = await this.requireAnswer(answerId);
    if (!actor.is_operator && answer.author_user_id !== actor.user_id) throw new CommunityPlatformError("community_access_denied", "Diese Antwort darf nicht bearbeitet werden.", 403);
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

  async verifyAnswer(answerId, input = {}, actor = {}) {
    requireOperator(actor);
    const answer = await this.requireAnswer(answerId);
    const question = await this.requireQuestion(answer.question_id);
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
    await this.repository.saveAnswer(next);
    if (next.verification_state === "verified" && input.accept !== false) {
      await this.repository.saveQuestion({
        ...question,
        status: "answered",
        accepted_answer_id: next.answer_id,
        updated_at: now,
      });
    }
    if (question.visibility === "public") await this.publishKnowledgeDocument(question, next);
    return next;
  }

  async listAnswers(questionId, actor = {}) {
    const question = await this.requireQuestion(questionId);
    requireAccess(question, actor);
    return { items: (await this.repository.listAnswers(questionId)).map((answer) => this.presentAnswer(answer, actor)) };
  }

  async search(query = {}, actor = {}) {
    const term = String(query.q || query.query || "").toLowerCase();
    const allQuestions = await this.repository.listQuestions({});
    const questionById = new Map(allQuestions.map((question) => [question.question_id, question]));
    const questions = allQuestions.filter((question) => canAccess(question, actor) && matches(question, term));
    const answers = (await this.repository.listAllAnswers()).filter((answer) => {
      const question = questionById.get(answer.question_id);
      return question && canAccess(question, actor) && matches(answer, term);
    });
    const documents = (await this.visibleKnowledgeDocuments(actor)).filter((document) => matches(document, term));
    return {
      items: [
        ...await Promise.all(questions.map(async (question) => ({ type: "question", score: score(question, term), item: this.presentQuestion(await this.decorateQuestion(question), actor) }))),
        ...answers.map((answer) => ({ type: "answer", score: score(answer, term), item: this.presentAnswer(answer, actor) })),
        ...documents.map((document) => ({ type: "knowledge_document", score: score(document, term), item: document })),
      ].sort((left, right) => right.score - left.score),
    };
  }

  async listKnowledgeDocuments(query = {}, actor = {}) {
    return { items: (await this.visibleKnowledgeDocuments(actor)).filter((document) => (!query.source_type || document.source_type === query.source_type) && (!query.verification_state || document.verification_state === query.verification_state)) };
  }

  async createDirectThread(input = {}, actor = {}) {
    const senderUserId = required(actor.user_id, "actor_user_id");
    const recipientUserId = required(input.recipient_user_id, "recipient_user_id");
    if (senderUserId === recipientUserId) {
      throw new CommunityPlatformError("message_recipient_invalid", "Eine Unterhaltung mit dir selbst ist nicht möglich.", 400);
    }
    await this.requireMessagingAllowed(senderUserId, recipientUserId);
    await this.requireMessageRate(senderUserId);
    const now = new Date().toISOString();
    const thread = {
      thread_id: createId("thread"),
      thread_kind: "direct",
      subject: String(input.subject || "Direktnachricht").trim().slice(0, 160),
      created_by_user_id: senderUserId,
      created_at: now,
      updated_at: now,
      archived_at: null,
    };
    const message = {
      message_id: createId("message"),
      thread_id: thread.thread_id,
      author_user_id: senderUserId,
      author_label: String(input.sender_label || "Mitglied").slice(0, 80),
      body: required(input.body, "body").slice(0, 8000),
      created_at: now,
      edited_at: null,
      deleted_at: null,
    };
    const members = [{
      thread_id: thread.thread_id, user_id: senderUserId, member_role: "owner",
      joined_at: now, left_at: null, last_read_message_id: message.message_id,
    }, {
      thread_id: thread.thread_id, user_id: recipientUserId, member_role: "member",
      joined_at: now, left_at: null, last_read_message_id: null,
    }];
    const inboxEntries = [{
      inbox_entry_id: createId("inbox_entry"), recipient_user_id: recipientUserId,
      entry_kind: "thread", thread_id: thread.thread_id, state: "unread",
      created_at: now, read_at: null, latest_message_id: message.message_id,
    }];
    await this.repository.createMessageThreadBundle({ thread, members, message, inboxEntries });
    return { ...thread, members: [senderUserId, recipientUserId], latest_message: message };
  }

  async createSupportRequest(input = {}, actor = {}) {
    const senderUserId = required(actor.user_id, "actor_user_id");
    await this.requireMessageRate(senderUserId);
    const recipients = [...new Set(this.supportUserIds)].filter((userId) => userId !== senderUserId);
    if (!recipients.length) throw new CommunityPlatformError("support_mailbox_unavailable", "Das Support-Postfach ist nicht konfiguriert.", 503);
    const now = new Date().toISOString();
    const thread = {
      thread_id: createId("thread"), thread_kind: "system",
      subject: required(input.subject || input.title, "subject").slice(0, 160),
      created_by_user_id: senderUserId, mailbox_kind: "support",
      created_at: now, updated_at: now, archived_at: null,
    };
    const message = {
      message_id: createId("message"), thread_id: thread.thread_id,
      author_user_id: senderUserId, author_label: String(input.sender_label || "Mitglied").slice(0, 80),
      body: required(input.body, "body").slice(0, 8000), created_at: now, edited_at: null, deleted_at: null,
    };
    const members = [
      { thread_id: thread.thread_id, user_id: senderUserId, member_role: "owner", joined_at: now, left_at: null, last_read_message_id: message.message_id },
      ...recipients.map((userId) => ({ thread_id: thread.thread_id, user_id: userId, member_role: "member", joined_at: now, left_at: null, last_read_message_id: null })),
    ];
    const inboxEntries = recipients.map((userId) => ({
      inbox_entry_id: createId("inbox_entry"), recipient_user_id: userId,
      entry_kind: "thread", type: "support_request", thread_id: thread.thread_id,
      state: "unread", created_at: now, read_at: null, latest_message_id: message.message_id,
    }));
    await this.repository.createMessageThreadBundle({ thread, members, message, inboxEntries });
    return { ...thread, members: members.map((item) => item.user_id), latest_message: message };
  }

  async listAdminSupportThreads(actor = {}, query = {}) {
    requireAdminCapability(actor, "admin_community_support");
    const threads = await this.repository.listMessageThreads({
      mailbox_kind: "support",
      archived: query.folder === "archived",
    });
    return {
      items: await Promise.all(threads.map((thread) => this.presentAdminSupportThread(thread))),
    };
  }

  async getAdminSupportThread(threadId, actor = {}) {
    requireAdminCapability(actor, "admin_community_support");
    const thread = await this.requireSupportThread(threadId);
    return {
      ...thread,
      members: await this.repository.listThreadMembers(threadId),
      messages: await this.repository.listMessages(threadId),
    };
  }

  async appendAdminSupportMessage(threadId, input = {}, actor = {}) {
    requireAdminCapability(actor, "admin_community_support");
    const thread = await this.requireSupportThread(threadId);
    if (thread.archived_at) throw new CommunityPlatformError("message_thread_closed", "Diese Unterhaltung ist geschlossen.", 409);
    const now = new Date().toISOString();
    const message = {
      message_id: createId("message"),
      thread_id: threadId,
      author_user_id: `admin:${required(actor.actor_id, "admin_actor_id")}`,
      author_label: "GerNetiX Support",
      body: required(input.body, "body").slice(0, 8000),
      created_at: now,
      edited_at: null,
      deleted_at: null,
    };
    const members = await this.repository.listThreadMembers(threadId);
    const recipients = members.filter((member) => member.member_role === "owner");
    const recipientIds = recipients.length ? recipients.map((member) => member.user_id) : [thread.created_by_user_id];
    const inboxEntries = [...new Set(recipientIds)].filter(Boolean).map((recipientUserId) => ({
      inbox_entry_id: createId("inbox_entry"),
      recipient_user_id: recipientUserId,
      entry_kind: "thread",
      thread_id: threadId,
      state: "unread",
      created_at: now,
      read_at: null,
      latest_message_id: message.message_id,
    }));
    await this.repository.appendMessageBundle({
      thread: { ...thread, updated_at: now },
      authorMember: null,
      message,
      inboxEntries,
    });
    return message;
  }

  async listAdminQuestions(actor = {}, query = {}) {
    requireAdminCapability(actor, "admin_community_support");
    return this.listQuestions(query, adminOperatorActor(actor));
  }

  async getAdminQuestion(questionId, actor = {}) {
    requireAdminCapability(actor, "admin_community_support");
    return this.getQuestion(questionId, adminOperatorActor(actor));
  }

  async triageAdminQuestion(questionId, input = {}, actor = {}) {
    requireAdminCapability(actor, "admin_community_support");
    return this.triageQuestion(questionId, {
      ...input,
      triaged_by: "GerNetiX Support",
    }, adminOperatorActor(actor));
  }

  async createAdminAnswer(questionId, input = {}, actor = {}) {
    requireAdminCapability(actor, "admin_community_support");
    return this.createAnswer(questionId, input, adminOperatorActor(actor));
  }

  async verifyAdminAnswer(answerId, input = {}, actor = {}) {
    requireAdminCapability(actor, "admin_community_moderation");
    return this.verifyAnswer(answerId, {
      ...input,
      verified_by: "GerNetiX Moderation",
    }, adminOperatorActor(actor));
  }

  async listAdminMessageReports(actor = {}, query = {}) {
    requireAdminCapability(actor, "admin_community_moderation");
    const result = await this.listMessageReports(query, adminOperatorActor(actor));
    return {
      items: await Promise.all(result.items.map(async (report) => {
        const [message, thread] = await Promise.all([
          this.repository.findMessage(report.message_id),
          this.repository.findMessageThread(report.thread_id),
        ]);
        return {
          ...report,
          reported_message: message ? {
            message_id: message.message_id,
            author_label: message.author_label || "Mitglied",
            body: message.body,
            created_at: message.created_at,
          } : null,
          thread: thread ? {
            thread_id: thread.thread_id,
            thread_kind: thread.thread_kind,
            subject: thread.subject || "Unterhaltung",
          } : null,
        };
      })),
    };
  }

  async resolveAdminMessageReport(reportId, input = {}, actor = {}) {
    requireAdminCapability(actor, "admin_community_moderation");
    return this.resolveMessageReport(reportId, input, adminOperatorActor(actor));
  }

  async listMessageThreads(actor = {}, query = {}) {
    const userId = required(actor.user_id, "actor_user_id");
    const entries = await this.repository.listInboxEntries(userId);
    const stateByThread = new Map();
    for (const entry of entries.filter((item) => item.thread_id)) {
      const current = stateByThread.get(entry.thread_id);
      if (!current || entry.state === "unread") stateByThread.set(entry.thread_id, entry);
    }
    const items = await Promise.all((await this.repository.listMessageThreadsForUser(userId, { archived: query.folder === "archived" })).map(async (thread) => {
      const messages = await this.repository.listMessages(thread.thread_id);
      const members = await this.repository.listThreadMembers(thread.thread_id);
      return {
        ...thread,
        members: members.map((member) => ({ user_id: member.user_id, member_role: member.member_role })),
        latest_message: messages.at(-1) || null,
        message_count: messages.length,
        state: stateByThread.get(thread.thread_id)?.state || "read",
      };
    }));
    return { items, unread_count: items.filter((item) => item.state === "unread").length };
  }

  async getMessageThread(threadId, actor = {}) {
    await this.requireThreadMember(threadId, actor.user_id);
    const thread = await this.repository.findMessageThread(threadId);
    if (!thread) throw new CommunityPlatformError("message_thread_not_found", "Unterhaltung wurde nicht gefunden.", 404);
    return {
      ...thread,
      members: await this.repository.listThreadMembers(threadId),
      messages: await this.repository.listMessages(threadId),
    };
  }

  async requireSupportThread(threadId) {
    const thread = await this.repository.findMessageThread(threadId);
    if (!thread || thread.mailbox_kind !== "support") {
      throw new CommunityPlatformError("support_thread_not_found", "Support-Anfrage wurde nicht gefunden.", 404);
    }
    return thread;
  }

  async presentAdminSupportThread(thread) {
    const [messages, members] = await Promise.all([
      this.repository.listMessages(thread.thread_id),
      this.repository.listThreadMembers(thread.thread_id),
    ]);
    return {
      ...thread,
      customer_user_id: thread.created_by_user_id,
      message_count: messages.length,
      latest_message: messages.at(-1) || null,
      member_count: members.length,
    };
  }

  async appendThreadMessage(threadId, input = {}, actor = {}) {
    const member = await this.requireThreadMember(threadId, actor.user_id);
    const thread = await this.repository.findMessageThread(threadId);
    if (!thread || thread.archived_at) throw new CommunityPlatformError("message_thread_closed", "Diese Unterhaltung ist geschlossen.", 409);
    await this.requireMessageRate(actor.user_id);
    for (const recipient of await this.repository.listThreadMembers(threadId)) {
      if (recipient.user_id !== actor.user_id) await this.requireMessagingAllowed(actor.user_id, recipient.user_id);
    }
    const now = new Date().toISOString();
    const message = {
      message_id: createId("message"), thread_id: threadId,
      author_user_id: actor.user_id, author_label: String(input.sender_label || "Mitglied").slice(0, 80),
      body: required(input.body, "body").slice(0, 8000), created_at: now,
      edited_at: null, deleted_at: null,
    };
    const inboxEntries = [];
    for (const recipient of await this.repository.listThreadMembers(threadId)) {
      if (recipient.user_id === actor.user_id) continue;
      inboxEntries.push({
        inbox_entry_id: createId("inbox_entry"), recipient_user_id: recipient.user_id,
        entry_kind: "thread", thread_id: threadId, state: "unread",
        created_at: now, read_at: null, latest_message_id: message.message_id,
      });
    }
    await this.repository.appendMessageBundle({
      thread: { ...thread, updated_at: now },
      authorMember: { ...member, last_read_message_id: message.message_id },
      message,
      inboxEntries,
    });
    return message;
  }

  async markThreadRead(threadId, actor = {}) {
    const member = await this.requireThreadMember(threadId, actor.user_id);
    const messages = await this.repository.listMessages(threadId);
    const latest = messages.at(-1);
    await this.repository.saveThreadMember({ ...member, last_read_message_id: latest?.message_id || null });
    const entries = await this.repository.listInboxEntries(actor.user_id);
    for (const entry of entries.filter((item) => item.thread_id === threadId && item.state === "unread")) {
      await this.repository.saveInboxEntry({ ...entry, state: "read", read_at: new Date().toISOString() });
    }
    return { thread_id: threadId, state: "read", last_read_message_id: latest?.message_id || null };
  }

  async archiveMessageThread(threadId, actor = {}) {
    const member = await this.requireThreadMember(threadId, actor.user_id);
    await this.repository.saveThreadMember({ ...member, archived_at: new Date().toISOString() });
    return { thread_id: threadId, state: "archived" };
  }

  async restoreMessageThread(threadId, actor = {}) {
    const member = await this.requireThreadMember(threadId, actor.user_id);
    await this.repository.saveThreadMember({ ...member, archived_at: null });
    return { thread_id: threadId, state: "active" };
  }

  async deleteThreadMessage(threadId, messageId, actor = {}) {
    await this.requireThreadMember(threadId, actor.user_id);
    const message = await this.repository.findMessage(messageId);
    if (!message || message.thread_id !== threadId) throw new CommunityPlatformError("message_not_found", "Nachricht wurde nicht gefunden.", 404);
    if (!actor.is_operator && message.author_user_id !== actor.user_id) throw new CommunityPlatformError("message_delete_denied", "Diese Nachricht darfst du nicht löschen.", 403);
    return this.repository.saveMessage({ ...message, body: "", deleted_at: new Date().toISOString() });
  }

  async requireThreadMember(threadId, userId) {
    const member = await this.repository.findThreadMember(threadId, required(userId, "actor_user_id"));
    if (!member || member.left_at) throw new CommunityPlatformError("message_thread_access_denied", "Diese Unterhaltung ist nicht zugreifbar.", 403);
    return member;
  }

  async blockMessageUser(input = {}, actor = {}) {
    const blockerUserId = required(actor.user_id, "actor_user_id");
    const blockedUserId = required(input.blocked_user_id, "blocked_user_id");
    if (blockerUserId === blockedUserId) throw new CommunityPlatformError("message_block_invalid", "Du kannst dich nicht selbst blockieren.", 400);
    return this.repository.saveMessageBlock({ blocker_user_id: blockerUserId, blocked_user_id: blockedUserId, created_at: new Date().toISOString() });
  }

  async unblockMessageUser(blockedUserId, actor = {}) {
    await this.repository.deleteMessageBlock(required(actor.user_id, "actor_user_id"), required(blockedUserId, "blocked_user_id"));
    return { blocked_user_id: blockedUserId, state: "unblocked" };
  }

  async listMessageBlocks(actor = {}) {
    return { items: await this.repository.listMessageBlocks(required(actor.user_id, "actor_user_id")) };
  }

  async reportMessage(threadId, messageId, input = {}, actor = {}) {
    await this.requireThreadMember(threadId, actor.user_id);
    const message = await this.repository.findMessage(messageId);
    if (!message || message.thread_id !== threadId) throw new CommunityPlatformError("message_not_found", "Nachricht wurde nicht gefunden.", 404);
    return this.repository.saveMessageReport({
      report_id: createId("message_report"), reporter_user_id: actor.user_id,
      thread_id: threadId, message_id: messageId,
      reason: required(input.reason, "reason").slice(0, 500), status: "open",
      created_at: new Date().toISOString(),
    });
  }

  async listMessageReports(query = {}, actor = {}) {
    requireOperator(actor);
    return { items: await this.repository.listMessageReports({ status: query.status || "open" }) };
  }

  async resolveMessageReport(reportId, input = {}, actor = {}) {
    requireOperator(actor);
    const report = await this.repository.findMessageReport(reportId);
    if (!report) throw new CommunityPlatformError("message_report_not_found", "Meldung wurde nicht gefunden.", 404);
    return this.repository.saveMessageReport({
      ...report, status: input.status === "dismissed" ? "dismissed" : "resolved",
      resolution_note: String(input.resolution_note || "").slice(0, 1000),
      resolved_by_user_id: actor.user_id, resolved_at: new Date().toISOString(),
    });
  }

  async requireMessagingAllowed(senderUserId, recipientUserId) {
    if (await this.repository.findMessageBlock(recipientUserId, senderUserId)
      || await this.repository.findMessageBlock(senderUserId, recipientUserId)) {
      throw new CommunityPlatformError("message_delivery_blocked", "Zwischen diesen Konten können keine Nachrichten zugestellt werden.", 403);
    }
  }

  async requireMessageRate(userId) {
    const since = new Date(Date.now() - this.messageRateWindowSeconds * 1000).toISOString();
    if (await this.repository.countMessagesByAuthorSince(userId, since) >= this.messageRateLimit) {
      throw new CommunityPlatformError("message_rate_limited", "Zu viele Nachrichten. Bitte warte einen Moment.", 429);
    }
  }

  async sendDirectMessage(input = {}, actor = {}) {
    const recipient = required(input.recipient_user_id, "recipient_user_id");
    const sender = required(actor.user_id, "actor_user_id");
    if (recipient === sender) throw new CommunityPlatformError("inbox_recipient_invalid", "Eine Nachricht an dich selbst ist nicht sinnvoll.", 400);
    const now = new Date().toISOString();
    return this.repository.saveInboxItem({
      inbox_item_id: createId("inbox"), type: "direct_message", recipient_user_id: recipient,
      sender_user_id: sender, sender_label: String(input.sender_label || "Mitglied").slice(0, 80),
      subject: String(input.subject || "Direktnachricht").slice(0, 160), body: required(input.body, "body").slice(0, 8000),
      state: "unread", created_at: now, read_at: null,
    });
  }

  async listInbox(actor = {}) {
    const userId = required(actor.user_id, "actor_user_id");
    const items = [
      ...await this.repository.listInboxItems({ user_id: userId }),
      ...await this.repository.listInboxEntries(userId),
    ].sort((left, right) => right.created_at.localeCompare(left.created_at));
    return { items, unread_count: items.filter((item) => item.state === "unread").length };
  }

  async markInboxRead(itemId, actor = {}) {
    const item = await this.repository.findInboxItem(itemId)
      || await this.repository.findInboxEntry(itemId);
    if (!item || item.recipient_user_id !== actor.user_id) throw new CommunityPlatformError("inbox_access_denied", "Diese Nachricht ist nicht zugreifbar.", 403);
    if (item.state === "read") return item;
    const updated = { ...item, state: "read", read_at: new Date().toISOString() };
    return item.inbox_entry_id
      ? this.repository.saveInboxEntry(updated)
      : this.repository.saveInboxItem(updated);
  }

  async createBroadcast(input = {}, actor = {}) {
    requireOperator(actor);
    const recipients = [...new Set(Array.isArray(input.recipient_user_ids) ? input.recipient_user_ids.map(String).filter(Boolean) : [])];
    if (!recipients.length) throw new CommunityPlatformError("broadcast_recipients_required", "Ein Broadcast benötigt mindestens ein Empfängerkonto.", 400);
    const now = new Date().toISOString();
    const subject = required(input.subject, "subject").slice(0, 160);
    const body = required(input.body, "body").slice(0, 8000);
    const broadcast = {
      broadcast_id: createId("broadcast"),
      created_by_user_id: actor.user_id,
      subject,
      body,
      audience_kind: "selected_accounts",
      state: "sent",
      created_at: now,
      sent_at: now,
    };
    const inboxEntries = recipients.map((recipientUserId) => ({
      inbox_entry_id: createId("inbox_entry"),
      recipient_user_id: recipientUserId,
      entry_kind: "broadcast",
      type: "broadcast",
      thread_id: null,
      broadcast_id: broadcast.broadcast_id,
      sender_label: "GerNetiX",
      subject,
      body,
      state: "unread",
      created_at: now,
      read_at: null,
      latest_message_id: null,
    }));
    await this.repository.saveBroadcastBundle({ broadcast, inboxEntries });
    return inboxEntries;
  }

  async createProjectInvitation(input = {}, actor = {}) {
    const recipient = required(input.recipient_user_id, "recipient_user_id");
    const now = new Date().toISOString();
    return this.repository.saveInboxEntry({
      inbox_entry_id: createId("inbox_entry"), entry_kind: "project_invitation", type: "project_invitation", recipient_user_id: recipient,
      sender_user_id: required(actor.user_id, "actor_user_id"), sender_label: String(input.sender_label || "Mitglied").slice(0, 80),
      subject: "Projekteinladung", body: "", thread_id: null, state: "unread", created_at: now, read_at: null, latest_message_id: null,
      action: { project_id: required(input.project_id, "project_id"), role: input.role === "collaborate" ? "collaborate" : "read", status: "pending" },
    });
  }

  async publishKnowledgeDocument(question, answer) {
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

  async decorateQuestion(question) {
    const answers = await this.repository.listAnswers(question.question_id);
    return {
      ...question,
      answer_count: answers.length,
      verified_answer_count: answers.filter((answer) => answer.verification_state === "verified").length,
      triage_sla_state: new Date(question.triage_due_at).getTime() < Date.now() && question.triage_status === "new" ? "overdue" : "within_sla",
    };
  }

  presentQuestion(question, actor) {
    const { author_user_id, ...visible } = question;
    return { ...visible, author_label: actor.is_operator ? author_user_id : "Mitglied", is_owner: question.author_user_id === actor.user_id };
  }

  presentAnswer(answer, actor) {
    const { author_user_id, ...visible } = answer;
    return { ...visible, author_label: actor.is_operator ? author_user_id : answer.author_user_id === actor.user_id ? "Du" : "GerNetiX" };
  }

  async visibleKnowledgeDocuments(actor) {
    const documents = await this.repository.listKnowledgeDocuments({});
    const visible = await Promise.all(documents.map(async (document) => {
      const question = await this.repository.findQuestion(document.question_id);
      return question && question.visibility === "public" && canAccess(question, actor) ? document : null;
    }));
    return visible.filter(Boolean);
  }

  async requireQuestion(questionId) {
    const question = await this.repository.findQuestion(questionId);
    if (!question) throw new CommunityPlatformError("question_not_found", "Community-Frage wurde nicht gefunden.", 404);
    return question;
  }

  async requireAnswer(answerId) {
    const answer = await this.repository.findAnswer(answerId);
    if (!answer) throw new CommunityPlatformError("answer_not_found", "Community-Antwort wurde nicht gefunden.", 404);
    return answer;
  }
}

async function seedKnowledge(service) {
  if ((await service.repository.listQuestions({})).length > 0) return;
  const question = await service.createQuestion({
    title: "ESP32 OTA Update schlaegt nach WLAN-Wechsel fehl",
    body: "Nach einem WLAN-Wechsel ist das Board erreichbar, OTA meldet aber timeout.",
    author_user_id: "seed",
    tags: ["esp32", "ota", "wifi"],
  }, { user_id: "seed", is_operator: true });
  await service.triageQuestion(question.question_id, { triaged_by: "system", priority: "normal" }, { user_id: "seed", is_operator: true });
  const answer = await service.createAnswer(question.question_id, {
    author_user_id: "seed-expert",
    body: "Pruefe zuerst den OTA-Hostname im Device-Webserver und sende danach einen Connectivity-Heartbeat an Device Management.",
  }, { user_id: "seed-expert", is_operator: true });
  await service.verifyAnswer(answer.answer_id, { verified_by: "seed-expert" }, { user_id: "seed-expert", is_operator: true });
}

function normalizeList(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  return String(value || "").split(",").map((item) => item.trim()).filter(Boolean);
}

function normalizeProjectSnapshot(value) {
  if (!value || typeof value !== "object") return null;
  const sources = Array.isArray(value.sources) ? value.sources : [];
  const safeSources = [];
  let totalBytes = 0;
  for (const source of sources.slice(0, 60)) {
    const path = String(source?.path || "").trim().slice(0, 300);
    const content = String(source?.content || "").slice(0, 48 * 1024);
    if (!path || !content) continue;
    const bytes = Buffer.byteLength(content, "utf8");
    if (totalBytes + bytes > 180 * 1024) break;
    totalBytes += bytes;
    safeSources.push({
      path,
      content,
      content_type: String(source.content_type || "text/plain").slice(0, 120),
      content_sha256: String(source.content_sha256 || "").slice(0, 128),
    });
  }
  if (!safeSources.length) return null;
  return {
    snapshot_id: String(value.snapshot_id || createId("community_snapshot")).slice(0, 160),
    project_title: String(value.project_title || "Projekt").slice(0, 120),
    captured_at: String(value.captured_at || new Date().toISOString()).slice(0, 64),
    source_count: safeSources.length,
    sources: safeSources,
  };
}

function presentMarketplaceListing(listing, actor) {
  const { author_user_id, ...visible } = listing;
  return {
    ...visible,
    author_label: listing.author_label || "Community-Mitglied",
    is_owner: Boolean(actor.user_id && author_user_id === actor.user_id),
  };
}

function normalizeMarketplaceCategory(value) {
  const category = String(value || "other").trim();
  return ["boards", "sensors", "displays", "components", "tools", "bundles", "other"].includes(category) ? category : "other";
}

function normalizeMarketplaceCondition(value) {
  const condition = String(value || "").trim();
  if (!["like_new", "very_good", "good", "acceptable", "for_parts"].includes(condition)) {
    throw new CommunityPlatformError("marketplace_condition_invalid", "Bitte gib einen gültigen Zustand an.", 400);
  }
  return condition;
}

function normalizeProjectIdeaStage(value) {
  const stage = String(value || "rough_idea").trim();
  return ["rough_idea", "concept", "prototype", "seeking_collaborators"].includes(stage) ? stage : "rough_idea";
}

function presentProjectIdea(idea, actor, commentCount) {
  const { author_user_id, ...visible } = idea;
  return { ...visible, is_owner: Boolean(actor.user_id && actor.user_id === author_user_id), comment_count: commentCount };
}

function presentProjectIdeaComment(comment) {
  const { author_user_id, ...visible } = comment;
  return visible;
}

function presentProjectShowcase(showcase, actor, includeSnapshot = false) {
  const { author_user_id, project_snapshot, ...visible } = showcase;
  return {
    ...visible,
    is_owner: Boolean(actor.user_id && actor.user_id === author_user_id),
    source_count: project_snapshot?.source_count || 0,
    ...(includeSnapshot ? { project_snapshot } : {}),
  };
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

module.exports = { CommunityService, seedKnowledge };

function canAccess(question, actor) {
  return question.visibility !== "private" || question.author_user_id === actor.user_id || actor.is_operator;
}

function requireAccess(question, actor) {
  if (!canAccess(question, actor)) throw new CommunityPlatformError("community_access_denied", "Diese Anfrage ist privat.", 403);
}

function requireOperator(actor) {
  if (!actor.is_operator) throw new CommunityPlatformError("community_access_denied", "Diese Aktion ist GerNetiX vorbehalten.", 403);
}

function requireAdminCapability(actor, capabilities) {
  const requiredCapabilities = Array.isArray(capabilities) ? capabilities : [capabilities];
  const available = new Set(Array.isArray(actor.capabilities) ? actor.capabilities : []);
  if (!actor.is_admin || !requiredCapabilities.some((capability) => available.has(capability))) {
    throw new CommunityPlatformError("community_admin_access_denied", "Diese Community-Verwaltung ist nicht freigegeben.", 403);
  }
}

function adminOperatorActor(actor) {
  return {
    user_id: `admin:${required(actor.actor_id, "admin_actor_id")}`,
    is_operator: true,
    is_admin: true,
    actor_id: actor.actor_id,
    capabilities: actor.capabilities || [],
  };
}
