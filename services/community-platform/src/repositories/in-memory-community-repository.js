class InMemoryCommunityRepository {
  constructor(seed = {}) {
    this.questions = new Map((seed.questions || []).map((item) => [item.question_id, item]));
    this.answers = new Map((seed.answers || []).map((item) => [item.answer_id, item]));
    this.knowledgeDocuments = new Map((seed.knowledgeDocuments || []).map((item) => [item.document_id, item]));
    this.inboxItems = new Map((seed.inboxItems || []).map((item) => [item.inbox_item_id, item]));
    this.messageThreads = new Map((seed.messageThreads || []).map((item) => [item.thread_id, item]));
    this.threadMembers = new Map((seed.threadMembers || []).map((item) => [`${item.thread_id}:${item.user_id}`, item]));
    this.messages = new Map((seed.messages || []).map((item) => [item.message_id, item]));
    this.inboxEntries = new Map((seed.inboxEntries || []).map((item) => [item.inbox_entry_id, item]));
    this.broadcasts = new Map((seed.broadcasts || []).map((item) => [item.broadcast_id, item]));
    this.messageBlocks = new Map((seed.messageBlocks || []).map((item) => [`${item.blocker_user_id}:${item.blocked_user_id}`, item]));
    this.messageReports = new Map((seed.messageReports || []).map((item) => [item.report_id, item]));
    this.marketplaceListings = new Map((seed.marketplaceListings || []).map((item) => [item.listing_id, clone(item)]));
    this.projectIdeas = new Map((seed.projectIdeas || []).map((item) => [item.idea_id, clone(item)]));
    this.projectIdeaComments = new Map((seed.projectIdeaComments || []).map((item) => [item.comment_id, clone(item)]));
    this.projectShowcases = new Map((seed.projectShowcases || []).map((item) => [item.showcase_id, clone(item)]));
    this.notificationOutbox = new Map((seed.notificationOutbox || []).map((item) => [item.event_id, clone(item)]));
  }

  saveQuestion(question) {
    this.questions.set(question.question_id, question);
    return question;
  }

  findQuestion(questionId) {
    return this.questions.get(questionId) || null;
  }

  listQuestions(filter = {}) {
    return Array.from(this.questions.values()).filter((question) => {
      if (filter.status && question.status !== filter.status) return false;
      if (filter.triage_status && question.triage_status !== filter.triage_status) return false;
      if (filter.project_id && question.project_id !== filter.project_id) return false;
      if (filter.visibility && question.visibility !== filter.visibility) return false;
      if (filter.tag && !question.tags.includes(filter.tag)) return false;
      return true;
    });
  }

  dashboardSummary(userId) {
    const questions = Array.from(this.questions.values()).filter((question) => question.author_user_id === userId);
    const activeThreadIds = new Set(Array.from(this.threadMembers.values())
      .filter((member) => member.user_id === userId && !member.left_at && !member.archived_at)
      .map((member) => member.thread_id));
    const unreadThreadIds = new Set(Array.from(this.inboxEntries.values())
      .filter((entry) => entry.recipient_user_id === userId && entry.state === "unread" && activeThreadIds.has(entry.thread_id))
      .map((entry) => entry.thread_id));
    return {
      questions: summarizeQuestions(questions),
      messages: {
        unread: unreadThreadIds.size,
        threads: activeThreadIds.size,
      },
    };
  }

  saveAnswer(answer) {
    this.answers.set(answer.answer_id, answer);
    return answer;
  }

  findAnswer(answerId) {
    return this.answers.get(answerId) || null;
  }

  listAnswers(questionId) {
    return Array.from(this.answers.values()).filter((answer) => answer.question_id === questionId);
  }

  listAllAnswers() {
    return Array.from(this.answers.values());
  }

  saveKnowledgeDocument(document) {
    this.knowledgeDocuments.set(document.document_id, document);
    return document;
  }

  listKnowledgeDocuments(filter = {}) {
    return Array.from(this.knowledgeDocuments.values()).filter((document) => {
      if (filter.source_type && document.source_type !== filter.source_type) return false;
      if (filter.verification_state && document.verification_state !== filter.verification_state) return false;
      return true;
    });
  }

  saveInboxItem(item) { this.inboxItems.set(item.inbox_item_id, item); return item; }
  saveInboxItemWithNotification(item, notificationEvent) {
    this.saveInboxItem(item);
    this.saveNotificationOutboxEvent(notificationEvent);
    return clone(item);
  }
  findInboxItem(id) { return this.inboxItems.get(id) || null; }
  listInboxItems(filter = {}) {
    return Array.from(this.inboxItems.values()).filter((item) => !filter.user_id || item.recipient_user_id === filter.user_id).sort((a, b) => b.created_at.localeCompare(a.created_at));
  }

  saveMessageThread(thread) { this.messageThreads.set(thread.thread_id, clone(thread)); return clone(thread); }
  findMessageThread(threadId) { return clone(this.messageThreads.get(threadId)); }

  listMessageThreads(filter = {}) {
    return Array.from(this.messageThreads.values())
      .filter((thread) => !filter.mailbox_kind || thread.mailbox_kind === filter.mailbox_kind)
      .filter((thread) => filter.archived === true ? Boolean(thread.archived_at) : filter.archived === false ? !thread.archived_at : true)
      .sort((left, right) => String(right.updated_at).localeCompare(String(left.updated_at)))
      .map(clone);
  }
  saveThreadMember(member) { this.threadMembers.set(`${member.thread_id}:${member.user_id}`, clone(member)); return clone(member); }
  findThreadMember(threadId, userId) { return clone(this.threadMembers.get(`${threadId}:${userId}`)); }
  listThreadMembers(threadId) {
    return Array.from(this.threadMembers.values()).filter((item) => item.thread_id === threadId && !item.left_at).map(clone);
  }
  listMessageThreadsForUser(userId, options = {}) {
    const threadIds = new Set(Array.from(this.threadMembers.values()).filter((item) => {
      if (item.user_id !== userId || item.left_at) return false;
      return options.archived ? Boolean(item.archived_at) : !item.archived_at;
    }).map((item) => item.thread_id));
    return Array.from(this.messageThreads.values()).filter((item) => threadIds.has(item.thread_id)).sort((a, b) => b.updated_at.localeCompare(a.updated_at)).map(clone);
  }
  saveMessage(message) { this.messages.set(message.message_id, clone(message)); return clone(message); }
  findMessage(messageId) { return clone(this.messages.get(messageId)); }
  listMessages(threadId) {
    return Array.from(this.messages.values()).filter((item) => item.thread_id === threadId && !item.deleted_at).sort((a, b) => a.created_at.localeCompare(b.created_at)).map(clone);
  }
  saveInboxEntry(entry) { this.inboxEntries.set(entry.inbox_entry_id, clone(entry)); return clone(entry); }
  saveInboxEntryWithNotification(entry, notificationEvent) {
    this.saveInboxEntry(entry);
    this.saveNotificationOutboxEvent(notificationEvent);
    return clone(entry);
  }
  findInboxEntry(entryId) { return clone(this.inboxEntries.get(entryId)); }
  listInboxEntries(userId) {
    return Array.from(this.inboxEntries.values()).filter((item) => item.recipient_user_id === userId).sort((a, b) => b.created_at.localeCompare(a.created_at)).map(clone);
  }
  saveBroadcast(broadcast) { this.broadcasts.set(broadcast.broadcast_id, clone(broadcast)); return clone(broadcast); }
  saveMessageBlock(block) { this.messageBlocks.set(`${block.blocker_user_id}:${block.blocked_user_id}`, clone(block)); return clone(block); }
  deleteMessageBlock(blockerUserId, blockedUserId) { return this.messageBlocks.delete(`${blockerUserId}:${blockedUserId}`); }
  findMessageBlock(blockerUserId, blockedUserId) { return clone(this.messageBlocks.get(`${blockerUserId}:${blockedUserId}`)); }
  listMessageBlocks(blockerUserId) { return Array.from(this.messageBlocks.values()).filter((item) => item.blocker_user_id === blockerUserId).map(clone); }
  saveMessageReport(report) { this.messageReports.set(report.report_id, clone(report)); return clone(report); }
  findMessageReport(reportId) { return clone(this.messageReports.get(reportId)); }
  listMessageReports(filter = {}) { return Array.from(this.messageReports.values()).filter((item) => !filter.status || item.status === filter.status).map(clone); }
  saveMarketplaceListing(listing) { this.marketplaceListings.set(listing.listing_id, clone(listing)); return clone(listing); }
  findMarketplaceListing(listingId) { return clone(this.marketplaceListings.get(listingId)); }
  listMarketplaceListings(filter = {}) {
    return Array.from(this.marketplaceListings.values())
      .filter((item) => !filter.state || item.state === filter.state)
      .filter((item) => !filter.author_user_id || item.author_user_id === filter.author_user_id)
      .sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at))).map(clone);
  }
  saveProjectIdea(idea) { this.projectIdeas.set(idea.idea_id, clone(idea)); return clone(idea); }
  findProjectIdea(ideaId) { return clone(this.projectIdeas.get(ideaId)); }
  listProjectIdeas(filter = {}) {
    return Array.from(this.projectIdeas.values())
      .filter((item) => !filter.state || item.state === filter.state)
      .filter((item) => !filter.author_user_id || item.author_user_id === filter.author_user_id)
      .sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at))).map(clone);
  }
  saveProjectIdeaComment(comment) { this.projectIdeaComments.set(comment.comment_id, clone(comment)); return clone(comment); }
  listProjectIdeaComments(ideaId) {
    return Array.from(this.projectIdeaComments.values()).filter((item) => item.idea_id === ideaId)
      .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at))).map(clone);
  }
  saveProjectShowcase(showcase) { this.projectShowcases.set(showcase.showcase_id, clone(showcase)); return clone(showcase); }
  findProjectShowcase(showcaseId) { return clone(this.projectShowcases.get(showcaseId)); }
  listProjectShowcases(filter = {}) {
    return Array.from(this.projectShowcases.values())
      .filter((item) => !filter.state || item.state === filter.state)
      .filter((item) => !filter.author_user_id || item.author_user_id === filter.author_user_id)
      .sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at))).map(clone);
  }
  countMessagesByAuthorSince(userId, since) {
    return Array.from(this.messages.values()).filter((item) => item.author_user_id === userId && item.created_at >= since).length;
  }

  saveNotificationOutboxEvent(event) {
    if (!this.notificationOutbox.has(event.event_id)) this.notificationOutbox.set(event.event_id, clone(event));
    return clone(this.notificationOutbox.get(event.event_id));
  }

  claimNotificationOutbox({ now, leaseUntil, limit = 25 }) {
    const eligible = Array.from(this.notificationOutbox.values())
      .filter((event) => (
        (["pending", "retry"].includes(event.status) && event.next_attempt_at <= now)
        || (event.status === "leased" && event.lease_until && event.lease_until <= now)
      ))
      .sort((left, right) => left.created_at.localeCompare(right.created_at))
      .slice(0, limit);
    return eligible.map((event) => {
      const leased = { ...event, status: "leased", attempts: Number(event.attempts || 0) + 1, lease_until: leaseUntil, updated_at: now };
      this.notificationOutbox.set(event.event_id, leased);
      return clone(leased);
    });
  }

  completeNotificationOutboxEvent(eventId, { now, outcome }) {
    const event = this.notificationOutbox.get(eventId);
    if (!event || event.status !== "leased") return null;
    const completed = { ...event, status: "delivered", outcome, lease_until: null, delivered_at: now, updated_at: now, last_error_code: null };
    this.notificationOutbox.set(eventId, completed);
    return clone(completed);
  }

  retryNotificationOutboxEvent(eventId, { now, nextAttemptAt, errorCode, maxAttempts = 8 }) {
    const event = this.notificationOutbox.get(eventId);
    if (!event || event.status !== "leased") return null;
    const exhausted = Number(event.attempts || 0) >= maxAttempts;
    const retried = {
      ...event,
      status: exhausted ? "dead_letter" : "retry",
      lease_until: null,
      next_attempt_at: exhausted ? event.next_attempt_at : nextAttemptAt,
      updated_at: now,
      last_error_code: errorCode,
    };
    this.notificationOutbox.set(eventId, retried);
    return clone(retried);
  }

  notificationOutboxSummary() {
    const values = Array.from(this.notificationOutbox.values());
    return Object.fromEntries(["pending", "retry", "leased", "delivered", "dead_letter"].map((status) => [status, values.filter((item) => item.status === status).length]));
  }

  purgeNotificationOutbox({ deliveredBefore, deadLetterBefore }) {
    const purged = { delivered: 0, dead_letter: 0, total: 0 };
    const deliveredCutoff = new Date(deliveredBefore).getTime();
    const deadLetterCutoff = new Date(deadLetterBefore).getTime();
    for (const [eventId, event] of this.notificationOutbox.entries()) {
      const timestamp = new Date(event.delivered_at || event.updated_at || event.created_at || "").getTime();
      const purgeDelivered = event.status === "delivered" && Number.isFinite(timestamp) && timestamp < deliveredCutoff;
      const purgeDeadLetter = event.status === "dead_letter" && Number.isFinite(timestamp) && timestamp < deadLetterCutoff;
      if (!purgeDelivered && !purgeDeadLetter) continue;
      this.notificationOutbox.delete(eventId);
      purged[event.status] += 1;
      purged.total += 1;
    }
    return purged;
  }

  createMessageThreadBundle({ thread, members, message, inboxEntries, outboxEvents = [] }) {
    this.saveMessageThread(thread);
    for (const member of members) this.saveThreadMember(member);
    this.saveMessage(message);
    for (const entry of inboxEntries) this.saveInboxEntry(entry);
    for (const event of outboxEvents) this.saveNotificationOutboxEvent(event);
    return clone({ thread, members, message, inboxEntries, outboxEvents });
  }

  appendMessageBundle({ thread, authorMember, message, inboxEntries, outboxEvents = [] }) {
    this.saveMessage(message);
    this.saveMessageThread(thread);
    if (authorMember) this.saveThreadMember(authorMember);
    for (const entry of inboxEntries) this.saveInboxEntry(entry);
    for (const event of outboxEvents) this.saveNotificationOutboxEvent(event);
    return clone({ thread, authorMember, message, inboxEntries, outboxEvents });
  }

  saveBroadcastBundle({ broadcast, inboxEntries }) {
    this.saveBroadcast(broadcast);
    for (const entry of inboxEntries) this.saveInboxEntry(entry);
    return clone({ broadcast, inboxEntries });
  }
}

function summarizeQuestions(questions) {
  const summary = {
    total: 0,
    public: { open: 0, closed: 0 },
    private: { open: 0, closed: 0 },
  };
  for (const question of questions) {
    const visibility = question.visibility === "private" ? "private" : "public";
    const lifecycle = ["closed", "resolved"].includes(String(question.status || "").toLowerCase()) ? "closed" : "open";
    summary[visibility][lifecycle] += 1;
    summary.total += 1;
  }
  return summary;
}

function clone(value) {
  return value ? JSON.parse(JSON.stringify(value)) : null;
}

module.exports = { InMemoryCommunityRepository };
