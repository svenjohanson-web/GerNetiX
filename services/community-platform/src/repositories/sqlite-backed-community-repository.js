const { SqliteStateStore, jsonColumn } = require("../../../shared");
const { InMemoryCommunityRepository } = require("./in-memory-community-repository");

class SqliteBackedCommunityRepository extends InMemoryCommunityRepository {
  constructor(store) {
    super(store.load());
    this.store = store;
    this.store.ensureSchema?.(communitySchema());
  }

  static create(sqlitePath) {
    return new SqliteBackedCommunityRepository(new SqliteStateStore(sqlitePath, "community-platform", {
      defaultState: {
        questions: [],
        answers: [],
        knowledgeDocuments: [],
        inboxItems: [],
        messageThreads: [],
        threadMembers: [],
        messages: [],
        inboxEntries: [],
        broadcasts: [],
        messageBlocks: [],
        messageReports: [],
        marketplaceListings: [],
        projectIdeas: [],
        projectIdeaComments: [],
        projectShowcases: [],
      },
      collectionMap: {
        questions: "questions",
        answers: "answers",
        knowledgeDocuments: "knowledge_documents",
        inboxItems: "inbox_items",
        messageThreads: "message_threads",
        threadMembers: "message_thread_members",
        messages: "messages",
        inboxEntries: "inbox_entries",
        broadcasts: "broadcasts",
        messageBlocks: "message_blocks",
        messageReports: "message_reports",
        marketplaceListings: "marketplace_listings",
        projectIdeas: "project_ideas",
        projectIdeaComments: "project_idea_comments",
        projectShowcases: "project_showcases",
      },
    }));
  }

  saveQuestion(question) {
    const result = super.saveQuestion(question);
    this.persist();
    return result;
  }

  saveAnswer(answer) {
    const result = super.saveAnswer(answer);
    this.persist();
    return result;
  }

  saveKnowledgeDocument(document) {
    const result = super.saveKnowledgeDocument(document);
    this.persist();
    return result;
  }

  saveInboxItem(item) { return this.saveAndPersist(() => super.saveInboxItem(item)); }
  saveMessageThread(thread) { return this.saveAndPersist(() => super.saveMessageThread(thread)); }
  saveThreadMember(member) { return this.saveAndPersist(() => super.saveThreadMember(member)); }
  saveMessage(message) { return this.saveAndPersist(() => super.saveMessage(message)); }
  saveInboxEntry(entry) { return this.saveAndPersist(() => super.saveInboxEntry(entry)); }
  saveBroadcast(broadcast) { return this.saveAndPersist(() => super.saveBroadcast(broadcast)); }
  saveMessageBlock(block) { return this.saveAndPersist(() => super.saveMessageBlock(block)); }
  deleteMessageBlock(blockerUserId, blockedUserId) { return this.saveAndPersist(() => super.deleteMessageBlock(blockerUserId, blockedUserId)); }
  saveMessageReport(report) { return this.saveAndPersist(() => super.saveMessageReport(report)); }
  saveMarketplaceListing(listing) { return this.saveAndPersist(() => super.saveMarketplaceListing(listing)); }
  saveProjectIdea(idea) { return this.saveAndPersist(() => super.saveProjectIdea(idea)); }
  saveProjectIdeaComment(comment) { return this.saveAndPersist(() => super.saveProjectIdeaComment(comment)); }
  saveProjectShowcase(showcase) { return this.saveAndPersist(() => super.saveProjectShowcase(showcase)); }

  createMessageThreadBundle({ thread, members, message, inboxEntries }) {
    InMemoryCommunityRepository.prototype.saveMessageThread.call(this, thread);
    for (const member of members) InMemoryCommunityRepository.prototype.saveThreadMember.call(this, member);
    InMemoryCommunityRepository.prototype.saveMessage.call(this, message);
    for (const entry of inboxEntries) InMemoryCommunityRepository.prototype.saveInboxEntry.call(this, entry);
    this.persist();
    return { thread, members, message, inboxEntries };
  }

  appendMessageBundle({ thread, authorMember, message, inboxEntries }) {
    InMemoryCommunityRepository.prototype.saveMessage.call(this, message);
    InMemoryCommunityRepository.prototype.saveMessageThread.call(this, thread);
    if (authorMember) InMemoryCommunityRepository.prototype.saveThreadMember.call(this, authorMember);
    for (const entry of inboxEntries) InMemoryCommunityRepository.prototype.saveInboxEntry.call(this, entry);
    this.persist();
    return { thread, authorMember, message, inboxEntries };
  }

  saveBroadcastBundle({ broadcast, inboxEntries }) {
    InMemoryCommunityRepository.prototype.saveBroadcast.call(this, broadcast);
    for (const entry of inboxEntries) InMemoryCommunityRepository.prototype.saveInboxEntry.call(this, entry);
    this.persist();
    return { broadcast, inboxEntries };
  }

  saveAndPersist(save) {
    const result = save();
    this.persist();
    return result;
  }

  persist() {
    const state = {
      questions: Array.from(this.questions.values()),
      answers: Array.from(this.answers.values()),
      knowledgeDocuments: Array.from(this.knowledgeDocuments.values()),
      inboxItems: Array.from(this.inboxItems.values()),
      messageThreads: Array.from(this.messageThreads.values()),
      threadMembers: Array.from(this.threadMembers.values()),
      messages: Array.from(this.messages.values()),
      inboxEntries: Array.from(this.inboxEntries.values()),
      broadcasts: Array.from(this.broadcasts.values()),
      messageBlocks: Array.from(this.messageBlocks.values()),
      messageReports: Array.from(this.messageReports.values()),
      marketplaceListings: Array.from(this.marketplaceListings.values()),
      projectIdeas: Array.from(this.projectIdeas.values()),
      projectIdeaComments: Array.from(this.projectIdeaComments.values()),
      projectShowcases: Array.from(this.projectShowcases.values()),
    };
    this.store.save(state);
    this.store.replaceCollection?.("questions", state.questions, "question_id");
    this.store.replaceCollection?.("answers", state.answers, "answer_id");
    this.store.replaceCollection?.("knowledge_documents", state.knowledgeDocuments, "document_id");
    this.store.replaceCollection?.("inbox_items", state.inboxItems, "inbox_item_id");
    this.store.replaceCollection?.("message_threads", state.messageThreads, "thread_id");
    this.store.replaceCollection?.("message_thread_members", state.threadMembers, (row) => `${row.thread_id}:${row.user_id}`);
    this.store.replaceCollection?.("messages", state.messages, "message_id");
    this.store.replaceCollection?.("inbox_entries", state.inboxEntries, "inbox_entry_id");
    this.store.replaceCollection?.("broadcasts", state.broadcasts, "broadcast_id");
    this.store.replaceCollection?.("message_blocks", state.messageBlocks, (row) => `${row.blocker_user_id}:${row.blocked_user_id}`);
    this.store.replaceCollection?.("message_reports", state.messageReports, "report_id");
    this.store.replaceCollection?.("marketplace_listings", state.marketplaceListings, "listing_id");
    this.store.replaceCollection?.("project_ideas", state.projectIdeas, "idea_id");
    this.store.replaceCollection?.("project_idea_comments", state.projectIdeaComments, "comment_id");
    this.store.replaceCollection?.("project_showcases", state.projectShowcases, "showcase_id");
    if (typeof this.store.replaceTable === "function") {
      this.store.replaceTable("community_questions", state.questions, questionColumns());
      this.store.replaceTable("community_answers", state.answers, answerColumns());
      this.store.replaceTable("community_knowledge_documents", state.knowledgeDocuments, documentColumns());
      this.store.replaceTable("community_inbox_items", state.inboxItems, inboxItemColumns());
      this.store.replaceTable("community_message_threads", state.messageThreads, messageThreadColumns());
      this.store.replaceTable("community_message_thread_members", state.threadMembers, threadMemberColumns());
      this.store.replaceTable("community_messages", state.messages, messageColumns());
      this.store.replaceTable("community_inbox_entries", state.inboxEntries, inboxEntryColumns());
      this.store.replaceTable("community_broadcasts", state.broadcasts, broadcastColumns());
      this.store.replaceTable("community_message_blocks", state.messageBlocks, messageBlockColumns());
      this.store.replaceTable("community_message_reports", state.messageReports, messageReportColumns());
      this.store.replaceTable("community_marketplace_listings", state.marketplaceListings, marketplaceListingColumns());
      this.store.replaceTable("community_project_ideas", state.projectIdeas, projectIdeaColumns());
      this.store.replaceTable("community_project_idea_comments", state.projectIdeaComments, projectIdeaCommentColumns());
      this.store.replaceTable("community_project_showcases", state.projectShowcases, projectShowcaseColumns());
    }
  }
}

function communitySchema() {
  return [
    `CREATE TABLE IF NOT EXISTS community_questions (question_id TEXT PRIMARY KEY, account_id TEXT, project_id TEXT, title TEXT, body TEXT, visibility TEXT, status TEXT, triage_status TEXT, tags_json TEXT, created_at TEXT, updated_at TEXT, raw_json TEXT NOT NULL);`,
    `CREATE TABLE IF NOT EXISTS community_answers (answer_id TEXT PRIMARY KEY, question_id TEXT, account_id TEXT, body TEXT, verification_state TEXT, visible_state TEXT, created_at TEXT, updated_at TEXT, verified_at TEXT, raw_json TEXT NOT NULL);`,
    `CREATE TABLE IF NOT EXISTS community_knowledge_documents (document_id TEXT PRIMARY KEY, source_type TEXT, source_id TEXT, title TEXT, body TEXT, verification_state TEXT, tags_json TEXT, updated_at TEXT, raw_json TEXT NOT NULL);`,
    `CREATE TABLE IF NOT EXISTS community_inbox_items (inbox_item_id TEXT PRIMARY KEY, recipient_user_id TEXT, state TEXT, created_at TEXT, raw_json TEXT NOT NULL);`,
    `CREATE TABLE IF NOT EXISTS community_message_threads (thread_id TEXT PRIMARY KEY, thread_kind TEXT, created_by_user_id TEXT, created_at TEXT, updated_at TEXT, archived_at TEXT, raw_json TEXT NOT NULL);`,
    `CREATE TABLE IF NOT EXISTS community_message_thread_members (member_key TEXT PRIMARY KEY, thread_id TEXT, user_id TEXT, member_role TEXT, joined_at TEXT, left_at TEXT, last_read_message_id TEXT, raw_json TEXT NOT NULL);`,
    `CREATE TABLE IF NOT EXISTS community_messages (message_id TEXT PRIMARY KEY, thread_id TEXT, author_user_id TEXT, created_at TEXT, edited_at TEXT, deleted_at TEXT, raw_json TEXT NOT NULL);`,
    `CREATE TABLE IF NOT EXISTS community_inbox_entries (inbox_entry_id TEXT PRIMARY KEY, recipient_user_id TEXT, entry_kind TEXT, thread_id TEXT, state TEXT, created_at TEXT, read_at TEXT, latest_message_id TEXT, raw_json TEXT NOT NULL);`,
    `CREATE TABLE IF NOT EXISTS community_broadcasts (broadcast_id TEXT PRIMARY KEY, created_by_user_id TEXT, audience_kind TEXT, state TEXT, created_at TEXT, sent_at TEXT, raw_json TEXT NOT NULL);`,
    `CREATE TABLE IF NOT EXISTS community_message_blocks (block_key TEXT PRIMARY KEY, blocker_user_id TEXT, blocked_user_id TEXT, created_at TEXT, raw_json TEXT NOT NULL);`,
    `CREATE TABLE IF NOT EXISTS community_message_reports (report_id TEXT PRIMARY KEY, reporter_user_id TEXT, thread_id TEXT, message_id TEXT, status TEXT, created_at TEXT, raw_json TEXT NOT NULL);`,
    `CREATE TABLE IF NOT EXISTS community_marketplace_listings (listing_id TEXT PRIMARY KEY, author_user_id TEXT, state TEXT, title TEXT, category TEXT, created_at TEXT, updated_at TEXT, raw_json TEXT NOT NULL);`,
    `CREATE TABLE IF NOT EXISTS community_project_ideas (idea_id TEXT PRIMARY KEY, author_user_id TEXT, state TEXT, title TEXT, stage TEXT, created_at TEXT, updated_at TEXT, raw_json TEXT NOT NULL);`,
    `CREATE TABLE IF NOT EXISTS community_project_idea_comments (comment_id TEXT PRIMARY KEY, idea_id TEXT, author_user_id TEXT, created_at TEXT, raw_json TEXT NOT NULL);`,
    `CREATE TABLE IF NOT EXISTS community_project_showcases (showcase_id TEXT PRIMARY KEY, author_user_id TEXT, state TEXT, title TEXT, created_at TEXT, updated_at TEXT, raw_json TEXT NOT NULL);`,
  ];
}

function questionColumns() {
  return { question_id: "question_id", account_id: "account_id", project_id: "project_id", title: "title", body: "body", visibility: "visibility", status: "status", triage_status: "triage_status", tags_json: jsonColumn("tags"), created_at: "created_at", updated_at: "updated_at", raw_json: jsonColumn((row) => row) };
}

function marketplaceListingColumns() {
  return { listing_id: "listing_id", author_user_id: "author_user_id", state: "state", title: "title", category: "category", created_at: "created_at", updated_at: "updated_at", raw_json: jsonColumn((row) => row) };
}

function projectIdeaColumns() {
  return { idea_id: "idea_id", author_user_id: "author_user_id", state: "state", title: "title", stage: "stage", created_at: "created_at", updated_at: "updated_at", raw_json: jsonColumn((row) => row) };
}

function projectIdeaCommentColumns() {
  return { comment_id: "comment_id", idea_id: "idea_id", author_user_id: "author_user_id", created_at: "created_at", raw_json: jsonColumn((row) => row) };
}

function projectShowcaseColumns() {
  return { showcase_id: "showcase_id", author_user_id: "author_user_id", state: "state", title: "title", created_at: "created_at", updated_at: "updated_at", raw_json: jsonColumn((row) => row) };
}

function answerColumns() {
  return { answer_id: "answer_id", question_id: "question_id", account_id: "account_id", body: "body", verification_state: "verification_state", visible_state: "visible_state", created_at: "created_at", updated_at: "updated_at", verified_at: "verified_at", raw_json: jsonColumn((row) => row) };
}

function documentColumns() {
  return { document_id: "document_id", source_type: "source_type", source_id: "source_id", title: "title", body: "body", verification_state: "verification_state", tags_json: jsonColumn("tags"), updated_at: "updated_at", raw_json: jsonColumn((row) => row) };
}

function inboxItemColumns() {
  return { inbox_item_id: "inbox_item_id", recipient_user_id: "recipient_user_id", state: "state", created_at: "created_at", raw_json: jsonColumn((row) => row) };
}

function messageThreadColumns() {
  return { thread_id: "thread_id", thread_kind: "thread_kind", created_by_user_id: "created_by_user_id", created_at: "created_at", updated_at: "updated_at", archived_at: "archived_at", raw_json: jsonColumn((row) => row) };
}

function threadMemberColumns() {
  return { member_key: (row) => `${row.thread_id}:${row.user_id}`, thread_id: "thread_id", user_id: "user_id", member_role: "member_role", joined_at: "joined_at", left_at: "left_at", last_read_message_id: "last_read_message_id", raw_json: jsonColumn((row) => row) };
}

function messageColumns() {
  return { message_id: "message_id", thread_id: "thread_id", author_user_id: "author_user_id", created_at: "created_at", edited_at: "edited_at", deleted_at: "deleted_at", raw_json: jsonColumn((row) => row) };
}

function inboxEntryColumns() {
  return { inbox_entry_id: "inbox_entry_id", recipient_user_id: "recipient_user_id", entry_kind: "entry_kind", thread_id: "thread_id", state: "state", created_at: "created_at", read_at: "read_at", latest_message_id: "latest_message_id", raw_json: jsonColumn((row) => row) };
}

function broadcastColumns() {
  return { broadcast_id: "broadcast_id", created_by_user_id: "created_by_user_id", audience_kind: "audience_kind", state: "state", created_at: "created_at", sent_at: "sent_at", raw_json: jsonColumn((row) => row) };
}
function messageBlockColumns() { return { block_key: (row) => `${row.blocker_user_id}:${row.blocked_user_id}`, blocker_user_id: "blocker_user_id", blocked_user_id: "blocked_user_id", created_at: "created_at", raw_json: jsonColumn((row) => row) }; }
function messageReportColumns() { return { report_id: "report_id", reporter_user_id: "reporter_user_id", thread_id: "thread_id", message_id: "message_id", status: "status", created_at: "created_at", raw_json: jsonColumn((row) => row) }; }

module.exports = { SqliteBackedCommunityRepository };
