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
  findInboxItem(id) { return this.inboxItems.get(id) || null; }
  listInboxItems(filter = {}) {
    return Array.from(this.inboxItems.values()).filter((item) => !filter.user_id || item.recipient_user_id === filter.user_id).sort((a, b) => b.created_at.localeCompare(a.created_at));
  }

  saveMessageThread(thread) { this.messageThreads.set(thread.thread_id, clone(thread)); return clone(thread); }
  findMessageThread(threadId) { return clone(this.messageThreads.get(threadId)); }
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
  countMessagesByAuthorSince(userId, since) {
    return Array.from(this.messages.values()).filter((item) => item.author_user_id === userId && item.created_at >= since).length;
  }

  createMessageThreadBundle({ thread, members, message, inboxEntries }) {
    this.saveMessageThread(thread);
    for (const member of members) this.saveThreadMember(member);
    this.saveMessage(message);
    for (const entry of inboxEntries) this.saveInboxEntry(entry);
    return clone({ thread, members, message, inboxEntries });
  }

  appendMessageBundle({ thread, authorMember, message, inboxEntries }) {
    this.saveMessage(message);
    this.saveMessageThread(thread);
    this.saveThreadMember(authorMember);
    for (const entry of inboxEntries) this.saveInboxEntry(entry);
    return clone({ thread, authorMember, message, inboxEntries });
  }

  saveBroadcastBundle({ broadcast, inboxEntries }) {
    this.saveBroadcast(broadcast);
    for (const entry of inboxEntries) this.saveInboxEntry(entry);
    return clone({ broadcast, inboxEntries });
  }
}

function clone(value) {
  return value ? JSON.parse(JSON.stringify(value)) : null;
}

module.exports = { InMemoryCommunityRepository };
