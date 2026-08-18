"use strict";

class PostgresCommunityRepository {
  constructor(pool) {
    this.pool = pool;
  }

  static async create(options = {}) {
    const { Pool } = require("pg");
    const pool = options.pool || new Pool(options.poolOptions || options);
    const repository = new PostgresCommunityRepository(pool);
    await repository.ensureSchema();
    return repository;
  }

  async ensureSchema() {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS community_questions (
        question_id text PRIMARY KEY,
        author_user_id text NOT NULL,
        project_id text NOT NULL,
        visibility text NOT NULL,
        status text NOT NULL,
        triage_status text NOT NULL,
        raw_json jsonb NOT NULL,
        created_at timestamptz NOT NULL,
        updated_at timestamptz NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_community_questions_author
        ON community_questions (author_user_id, updated_at DESC);
      CREATE INDEX IF NOT EXISTS idx_community_questions_visibility
        ON community_questions (visibility, updated_at DESC);

      CREATE TABLE IF NOT EXISTS community_answers (
        answer_id text PRIMARY KEY,
        question_id text NOT NULL REFERENCES community_questions(question_id) ON DELETE CASCADE,
        author_user_id text NOT NULL,
        verification_state text NOT NULL,
        raw_json jsonb NOT NULL,
        created_at timestamptz NOT NULL,
        updated_at timestamptz NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_community_answers_question
        ON community_answers (question_id, created_at);

      CREATE TABLE IF NOT EXISTS community_knowledge_documents (
        document_id text PRIMARY KEY,
        question_id text NOT NULL REFERENCES community_questions(question_id) ON DELETE CASCADE,
        source_type text NOT NULL,
        source_id text NOT NULL,
        verification_state text NOT NULL,
        raw_json jsonb NOT NULL,
        updated_at timestamptz NOT NULL
      );

      CREATE TABLE IF NOT EXISTS community_migrations (
        migration_id text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE TABLE IF NOT EXISTS community_inbox_items (
        inbox_item_id text PRIMARY KEY, recipient_user_id text NOT NULL, state text NOT NULL,
        created_at timestamptz NOT NULL, raw_json jsonb NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_community_inbox_recipient ON community_inbox_items (recipient_user_id, created_at DESC);

      CREATE TABLE IF NOT EXISTS community_message_threads (
        thread_id text PRIMARY KEY,
        thread_kind text NOT NULL CHECK (thread_kind IN ('direct', 'project', 'system')),
        created_by_user_id text NOT NULL,
        created_at timestamptz NOT NULL,
        updated_at timestamptz NOT NULL,
        archived_at timestamptz,
        raw_json jsonb NOT NULL
      );
      CREATE TABLE IF NOT EXISTS community_message_thread_members (
        thread_id text NOT NULL REFERENCES community_message_threads(thread_id) ON DELETE CASCADE,
        user_id text NOT NULL,
        member_role text NOT NULL CHECK (member_role IN ('owner', 'member')),
        joined_at timestamptz NOT NULL,
        left_at timestamptz,
        last_read_message_id text,
        archived_at timestamptz,
        PRIMARY KEY (thread_id, user_id)
      );
      ALTER TABLE community_message_thread_members ADD COLUMN IF NOT EXISTS archived_at timestamptz;
      CREATE INDEX IF NOT EXISTS idx_community_message_members_user ON community_message_thread_members (user_id, joined_at DESC);
      CREATE TABLE IF NOT EXISTS community_messages (
        message_id text PRIMARY KEY,
        thread_id text NOT NULL REFERENCES community_message_threads(thread_id) ON DELETE CASCADE,
        author_user_id text NOT NULL,
        body text NOT NULL,
        created_at timestamptz NOT NULL,
        edited_at timestamptz,
        deleted_at timestamptz,
        raw_json jsonb NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_community_messages_thread ON community_messages (thread_id, created_at);
      CREATE TABLE IF NOT EXISTS community_inbox_entries (
        inbox_entry_id text PRIMARY KEY,
        recipient_user_id text NOT NULL,
        entry_kind text NOT NULL CHECK (entry_kind IN ('thread', 'project_invitation', 'broadcast')),
        thread_id text REFERENCES community_message_threads(thread_id) ON DELETE CASCADE,
        state text NOT NULL CHECK (state IN ('unread', 'read', 'archived')),
        created_at timestamptz NOT NULL,
        read_at timestamptz,
        raw_json jsonb NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_community_inbox_entries_recipient ON community_inbox_entries (recipient_user_id, state, created_at DESC);
      CREATE TABLE IF NOT EXISTS community_notification_outbox (
        event_id text PRIMARY KEY,
        recipient_user_id text NOT NULL,
        category text NOT NULL CHECK (category IN ('thread_replies', 'direct_messages', 'support_replies', 'project_invitations')),
        status text NOT NULL CHECK (status IN ('pending', 'retry', 'leased', 'delivered', 'dead_letter')),
        attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
        next_attempt_at timestamptz NOT NULL,
        lease_until timestamptz,
        outcome text,
        last_error_code text,
        created_at timestamptz NOT NULL,
        updated_at timestamptz NOT NULL,
        delivered_at timestamptz
      );
      CREATE INDEX IF NOT EXISTS idx_community_notification_outbox_ready
        ON community_notification_outbox (status, next_attempt_at, created_at);
      CREATE TABLE IF NOT EXISTS community_broadcasts (
        broadcast_id text PRIMARY KEY,
        created_by_user_id text NOT NULL,
        subject text NOT NULL,
        body text NOT NULL,
        audience_kind text NOT NULL,
        state text NOT NULL CHECK (state IN ('draft', 'sent', 'cancelled')),
        created_at timestamptz NOT NULL,
        sent_at timestamptz,
        raw_json jsonb NOT NULL
      );
      CREATE TABLE IF NOT EXISTS community_message_blocks (
        blocker_user_id text NOT NULL, blocked_user_id text NOT NULL, created_at timestamptz NOT NULL,
        raw_json jsonb NOT NULL, PRIMARY KEY (blocker_user_id, blocked_user_id)
      );
      CREATE TABLE IF NOT EXISTS community_message_reports (
        report_id text PRIMARY KEY, reporter_user_id text NOT NULL,
        thread_id text NOT NULL REFERENCES community_message_threads(thread_id) ON DELETE CASCADE,
        message_id text NOT NULL REFERENCES community_messages(message_id) ON DELETE CASCADE,
        status text NOT NULL, created_at timestamptz NOT NULL, raw_json jsonb NOT NULL
      );
      CREATE TABLE IF NOT EXISTS community_marketplace_listings (
        listing_id text PRIMARY KEY,
        author_user_id text NOT NULL,
        state text NOT NULL CHECK (state IN ('published', 'reserved', 'sold', 'withdrawn')),
        category text NOT NULL,
        raw_json jsonb NOT NULL,
        created_at timestamptz NOT NULL,
        updated_at timestamptz NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_community_marketplace_state
        ON community_marketplace_listings (state, updated_at DESC);
      ALTER TABLE community_marketplace_listings DROP CONSTRAINT IF EXISTS community_marketplace_listings_state_check;
      ALTER TABLE community_marketplace_listings ADD CONSTRAINT community_marketplace_listings_state_check CHECK (state IN ('published', 'reserved', 'sold', 'withdrawn'));
      CREATE TABLE IF NOT EXISTS community_project_ideas (
        idea_id text PRIMARY KEY, author_user_id text NOT NULL, state text NOT NULL,
        stage text NOT NULL, raw_json jsonb NOT NULL, created_at timestamptz NOT NULL, updated_at timestamptz NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_community_project_ideas_state ON community_project_ideas (state, updated_at DESC);
      CREATE TABLE IF NOT EXISTS community_project_idea_comments (
        comment_id text PRIMARY KEY,
        idea_id text NOT NULL REFERENCES community_project_ideas(idea_id) ON DELETE CASCADE,
        author_user_id text NOT NULL, raw_json jsonb NOT NULL, created_at timestamptz NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_community_project_idea_comments_idea ON community_project_idea_comments (idea_id, created_at);
      CREATE TABLE IF NOT EXISTS community_project_showcases (
        showcase_id text PRIMARY KEY, author_user_id text NOT NULL, state text NOT NULL,
        raw_json jsonb NOT NULL, created_at timestamptz NOT NULL, updated_at timestamptz NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_community_project_showcases_state ON community_project_showcases (state, updated_at DESC);
    `);
  }

  async saveQuestion(question) {
    await this.pool.query(`
      INSERT INTO community_questions
        (question_id, author_user_id, project_id, visibility, status, triage_status,
         raw_json, created_at, updated_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      ON CONFLICT (question_id) DO UPDATE SET
        author_user_id=EXCLUDED.author_user_id,
        project_id=EXCLUDED.project_id,
        visibility=EXCLUDED.visibility,
        status=EXCLUDED.status,
        triage_status=EXCLUDED.triage_status,
        raw_json=EXCLUDED.raw_json,
        updated_at=EXCLUDED.updated_at
    `, [
      question.question_id, question.author_user_id, question.project_id || "",
      question.visibility, question.status, question.triage_status, question,
      question.created_at, question.updated_at,
    ]);
    return clone(question);
  }

  async findQuestion(questionId) {
    return first(await this.pool.query(
      "SELECT raw_json FROM community_questions WHERE question_id=$1",
      [questionId],
    ));
  }

  async listQuestions(filter = {}) {
    const conditions = [];
    const values = [];
    for (const [column, value] of [
      ["status", filter.status],
      ["triage_status", filter.triage_status],
      ["project_id", filter.project_id],
      ["visibility", filter.visibility],
    ]) {
      if (value) {
        values.push(value);
        conditions.push(`${column}=$${values.length}`);
      }
    }
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const items = rows(await this.pool.query(
      `SELECT raw_json FROM community_questions ${where} ORDER BY updated_at DESC`,
      values,
    ));
    return filter.tag ? items.filter((question) => question.tags.includes(filter.tag)) : items;
  }

  async dashboardSummary(userId) {
    const [questionResult, messageResult] = await Promise.all([
      this.pool.query(`
        SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE visibility = 'public' AND status NOT IN ('closed', 'resolved'))::int AS public_open,
          COUNT(*) FILTER (WHERE visibility = 'public' AND status IN ('closed', 'resolved'))::int AS public_closed,
          COUNT(*) FILTER (WHERE visibility = 'private' AND status NOT IN ('closed', 'resolved'))::int AS private_open,
          COUNT(*) FILTER (WHERE visibility = 'private' AND status IN ('closed', 'resolved'))::int AS private_closed
        FROM community_questions
        WHERE author_user_id=$1
      `, [userId]),
      this.pool.query(`
        SELECT
          COUNT(DISTINCT m.thread_id)::int AS threads,
          COUNT(DISTINCT CASE WHEN inbox.state = 'unread' THEN m.thread_id END)::int AS unread
        FROM community_message_thread_members m
        LEFT JOIN community_inbox_entries inbox
          ON inbox.thread_id=m.thread_id AND inbox.recipient_user_id=m.user_id
        WHERE m.user_id=$1 AND m.left_at IS NULL AND m.archived_at IS NULL
      `, [userId]),
    ]);
    const questions = questionResult.rows[0] || {};
    const messages = messageResult.rows[0] || {};
    return {
      questions: {
        total: Number(questions.total || 0),
        public: { open: Number(questions.public_open || 0), closed: Number(questions.public_closed || 0) },
        private: { open: Number(questions.private_open || 0), closed: Number(questions.private_closed || 0) },
      },
      messages: {
        unread: Number(messages.unread || 0),
        threads: Number(messages.threads || 0),
      },
    };
  }

  async saveAnswer(answer) {
    await this.pool.query(`
      INSERT INTO community_answers
        (answer_id, question_id, author_user_id, verification_state, raw_json, created_at, updated_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7)
      ON CONFLICT (answer_id) DO UPDATE SET
        author_user_id=EXCLUDED.author_user_id,
        verification_state=EXCLUDED.verification_state,
        raw_json=EXCLUDED.raw_json,
        updated_at=EXCLUDED.updated_at
    `, [
      answer.answer_id, answer.question_id, answer.author_user_id,
      answer.verification_state, answer, answer.created_at, answer.updated_at,
    ]);
    return clone(answer);
  }

  async findAnswer(answerId) {
    return first(await this.pool.query(
      "SELECT raw_json FROM community_answers WHERE answer_id=$1",
      [answerId],
    ));
  }

  async listAnswers(questionId) {
    return rows(await this.pool.query(
      "SELECT raw_json FROM community_answers WHERE question_id=$1 ORDER BY created_at",
      [questionId],
    ));
  }

  async listAllAnswers() {
    return rows(await this.pool.query(
      "SELECT raw_json FROM community_answers ORDER BY created_at",
    ));
  }

  async saveKnowledgeDocument(document) {
    await this.pool.query(`
      INSERT INTO community_knowledge_documents
        (document_id, question_id, source_type, source_id, verification_state, raw_json, updated_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7)
      ON CONFLICT (document_id) DO UPDATE SET
        verification_state=EXCLUDED.verification_state,
        raw_json=EXCLUDED.raw_json,
        updated_at=EXCLUDED.updated_at
    `, [
      document.document_id, document.question_id, document.source_type,
      document.source_id, document.verification_state, document,
      document.indexed_at || new Date().toISOString(),
    ]);
    return clone(document);
  }

  async listKnowledgeDocuments(filter = {}) {
    const result = rows(await this.pool.query(
      "SELECT raw_json FROM community_knowledge_documents ORDER BY updated_at DESC",
    ));
    return result
      .filter((item) => !filter.source_type || item.source_type === filter.source_type)
      .filter((item) => !filter.verification_state || item.verification_state === filter.verification_state);
  }

  async saveInboxItem(item) {
    await this.pool.query(`INSERT INTO community_inbox_items (inbox_item_id, recipient_user_id, state, created_at, raw_json)
      VALUES ($1,$2,$3,$4,$5) ON CONFLICT (inbox_item_id) DO UPDATE SET state=EXCLUDED.state, raw_json=EXCLUDED.raw_json`, [item.inbox_item_id, item.recipient_user_id, item.state, item.created_at, item]);
    return clone(item);
  }
  async saveInboxItemWithNotification(item, notificationEvent) {
    return this.inTransaction(async (repository) => {
      await repository.saveInboxItem(item);
      await repository.saveNotificationOutboxEvent(notificationEvent);
      return clone(item);
    });
  }
  async findInboxItem(id) { return first(await this.pool.query("SELECT raw_json FROM community_inbox_items WHERE inbox_item_id=$1", [id])); }
  async listInboxItems(filter = {}) {
    const result = filter.user_id ? await this.pool.query("SELECT raw_json FROM community_inbox_items WHERE recipient_user_id=$1 ORDER BY created_at DESC", [filter.user_id]) : await this.pool.query("SELECT raw_json FROM community_inbox_items ORDER BY created_at DESC");
    return rows(result);
  }

  async saveMessageThread(thread) {
    await this.pool.query(`
      INSERT INTO community_message_threads
        (thread_id, thread_kind, created_by_user_id, created_at, updated_at, archived_at, raw_json)
      VALUES ($1,$2,$3,$4,$5,$6,$7)
      ON CONFLICT (thread_id) DO UPDATE SET
        updated_at=EXCLUDED.updated_at, archived_at=EXCLUDED.archived_at, raw_json=EXCLUDED.raw_json
    `, [thread.thread_id, thread.thread_kind, thread.created_by_user_id, thread.created_at, thread.updated_at, thread.archived_at || null, thread]);
    return clone(thread);
  }

  async findMessageThread(threadId) {
    return first(await this.pool.query("SELECT raw_json FROM community_message_threads WHERE thread_id=$1", [threadId]));
  }

  async listMessageThreads(filter = {}) {
    const result = await this.pool.query(`
      SELECT raw_json FROM community_message_threads
      WHERE ${filter.archived === true ? "archived_at IS NOT NULL" : filter.archived === false ? "archived_at IS NULL" : "TRUE"}
      ORDER BY updated_at DESC
    `);
    return rows(result).filter((thread) => !filter.mailbox_kind || thread.mailbox_kind === filter.mailbox_kind);
  }

  async saveThreadMember(member) {
    await this.pool.query(`
      INSERT INTO community_message_thread_members
        (thread_id, user_id, member_role, joined_at, left_at, last_read_message_id, archived_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7)
      ON CONFLICT (thread_id, user_id) DO UPDATE SET
        member_role=EXCLUDED.member_role, left_at=EXCLUDED.left_at,
        last_read_message_id=EXCLUDED.last_read_message_id, archived_at=EXCLUDED.archived_at
    `, [member.thread_id, member.user_id, member.member_role, member.joined_at, member.left_at || null, member.last_read_message_id || null, member.archived_at || null]);
    return clone(member);
  }

  async findThreadMember(threadId, userId) {
    const result = await this.pool.query(`
      SELECT thread_id, user_id, member_role, joined_at, left_at, last_read_message_id, archived_at
      FROM community_message_thread_members WHERE thread_id=$1 AND user_id=$2
    `, [threadId, userId]);
    return result.rows[0] ? clone(result.rows[0]) : null;
  }

  async listThreadMembers(threadId) {
    return (await this.pool.query(`
      SELECT thread_id, user_id, member_role, joined_at, left_at, last_read_message_id, archived_at
      FROM community_message_thread_members WHERE thread_id=$1 AND left_at IS NULL
    `, [threadId])).rows.map(clone);
  }

  async listMessageThreadsForUser(userId, options = {}) {
    return rows(await this.pool.query(`
      SELECT t.raw_json FROM community_message_threads t
      JOIN community_message_thread_members m ON m.thread_id=t.thread_id
      WHERE m.user_id=$1 AND m.left_at IS NULL
        AND ${options.archived ? "m.archived_at IS NOT NULL" : "m.archived_at IS NULL"}
      ORDER BY t.updated_at DESC
    `, [userId]));
  }

  async saveMessage(message) {
    await this.pool.query(`
      INSERT INTO community_messages
        (message_id, thread_id, author_user_id, body, created_at, edited_at, deleted_at, raw_json)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      ON CONFLICT (message_id) DO UPDATE SET
        body=EXCLUDED.body, edited_at=EXCLUDED.edited_at,
        deleted_at=EXCLUDED.deleted_at, raw_json=EXCLUDED.raw_json
    `, [message.message_id, message.thread_id, message.author_user_id, message.body, message.created_at, message.edited_at || null, message.deleted_at || null, message]);
    return clone(message);
  }

  async findMessage(messageId) {
    return first(await this.pool.query("SELECT raw_json FROM community_messages WHERE message_id=$1", [messageId]));
  }

  async listMessages(threadId) {
    return rows(await this.pool.query(`
      SELECT raw_json FROM community_messages
      WHERE thread_id=$1 AND deleted_at IS NULL ORDER BY created_at
    `, [threadId]));
  }

  async saveInboxEntry(entry) {
    await this.pool.query(`
      INSERT INTO community_inbox_entries
        (inbox_entry_id, recipient_user_id, entry_kind, thread_id, state, created_at, read_at, raw_json)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      ON CONFLICT (inbox_entry_id) DO UPDATE SET
        state=EXCLUDED.state, read_at=EXCLUDED.read_at, raw_json=EXCLUDED.raw_json
    `, [entry.inbox_entry_id, entry.recipient_user_id, entry.entry_kind, entry.thread_id || null, entry.state, entry.created_at, entry.read_at || null, entry]);
    return clone(entry);
  }
  async saveInboxEntryWithNotification(entry, notificationEvent) {
    return this.inTransaction(async (repository) => {
      await repository.saveInboxEntry(entry);
      await repository.saveNotificationOutboxEvent(notificationEvent);
      return clone(entry);
    });
  }

  async findInboxEntry(entryId) {
    return first(await this.pool.query(
      "SELECT raw_json FROM community_inbox_entries WHERE inbox_entry_id=$1",
      [entryId],
    ));
  }

  async listInboxEntries(userId) {
    return rows(await this.pool.query(`
      SELECT raw_json FROM community_inbox_entries
      WHERE recipient_user_id=$1 ORDER BY created_at DESC
    `, [userId]));
  }

  async saveBroadcast(broadcast) {
    await this.pool.query(`
      INSERT INTO community_broadcasts
        (broadcast_id, created_by_user_id, subject, body, audience_kind, state, created_at, sent_at, raw_json)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      ON CONFLICT (broadcast_id) DO UPDATE SET
        state=EXCLUDED.state, sent_at=EXCLUDED.sent_at, raw_json=EXCLUDED.raw_json
    `, [broadcast.broadcast_id, broadcast.created_by_user_id, broadcast.subject, broadcast.body, broadcast.audience_kind, broadcast.state, broadcast.created_at, broadcast.sent_at || null, broadcast]);
    return clone(broadcast);
  }
  async saveMessageBlock(block) {
    await this.pool.query(`INSERT INTO community_message_blocks (blocker_user_id,blocked_user_id,created_at,raw_json) VALUES ($1,$2,$3,$4)
      ON CONFLICT (blocker_user_id,blocked_user_id) DO UPDATE SET raw_json=EXCLUDED.raw_json`,
    [block.blocker_user_id, block.blocked_user_id, block.created_at, block]);
    return clone(block);
  }
  async deleteMessageBlock(blockerUserId, blockedUserId) {
    return (await this.pool.query("DELETE FROM community_message_blocks WHERE blocker_user_id=$1 AND blocked_user_id=$2", [blockerUserId, blockedUserId])).rowCount > 0;
  }
  async findMessageBlock(blockerUserId, blockedUserId) {
    return first(await this.pool.query("SELECT raw_json FROM community_message_blocks WHERE blocker_user_id=$1 AND blocked_user_id=$2", [blockerUserId, blockedUserId]));
  }
  async listMessageBlocks(blockerUserId) {
    return rows(await this.pool.query("SELECT raw_json FROM community_message_blocks WHERE blocker_user_id=$1 ORDER BY created_at DESC", [blockerUserId]));
  }
  async saveMessageReport(report) {
    await this.pool.query(`INSERT INTO community_message_reports (report_id,reporter_user_id,thread_id,message_id,status,created_at,raw_json)
      VALUES ($1,$2,$3,$4,$5,$6,$7)
      ON CONFLICT (report_id) DO UPDATE SET status=EXCLUDED.status, raw_json=EXCLUDED.raw_json`,
    [report.report_id, report.reporter_user_id, report.thread_id, report.message_id, report.status, report.created_at, report]);
    return clone(report);
  }
  async findMessageReport(reportId) { return first(await this.pool.query("SELECT raw_json FROM community_message_reports WHERE report_id=$1", [reportId])); }
  async listMessageReports(filter = {}) {
    return rows(await this.pool.query(
      `SELECT raw_json FROM community_message_reports ${filter.status ? "WHERE status=$1" : ""} ORDER BY created_at DESC`,
      filter.status ? [filter.status] : [],
    ));
  }
  async countMessagesByAuthorSince(userId, since) {
    const result = await this.pool.query("SELECT count(*) AS count FROM community_messages WHERE author_user_id=$1 AND created_at >= $2", [userId, since]);
    return Number(result.rows[0]?.count || 0);
  }

  async saveMarketplaceListing(listing) {
    await this.pool.query(`
      INSERT INTO community_marketplace_listings (listing_id,author_user_id,state,category,raw_json,created_at,updated_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7)
      ON CONFLICT (listing_id) DO UPDATE SET state=EXCLUDED.state, category=EXCLUDED.category, raw_json=EXCLUDED.raw_json, updated_at=EXCLUDED.updated_at
    `, [listing.listing_id, listing.author_user_id, listing.state, listing.category, listing, listing.created_at, listing.updated_at]);
    return clone(listing);
  }
  async findMarketplaceListing(listingId) {
    return first(await this.pool.query("SELECT raw_json FROM community_marketplace_listings WHERE listing_id=$1", [listingId]));
  }
  async listMarketplaceListings(filter = {}) {
    const conditions = [];
    const values = [];
    if (filter.state) { values.push(filter.state); conditions.push(`state=$${values.length}`); }
    if (filter.author_user_id) { values.push(filter.author_user_id); conditions.push(`author_user_id=$${values.length}`); }
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    return rows(await this.pool.query(`SELECT raw_json FROM community_marketplace_listings ${where} ORDER BY updated_at DESC`, values));
  }

  async saveProjectIdea(idea) {
    await this.pool.query(`
      INSERT INTO community_project_ideas (idea_id,author_user_id,state,stage,raw_json,created_at,updated_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7)
      ON CONFLICT (idea_id) DO UPDATE SET state=EXCLUDED.state, stage=EXCLUDED.stage, raw_json=EXCLUDED.raw_json, updated_at=EXCLUDED.updated_at
    `, [idea.idea_id, idea.author_user_id, idea.state, idea.stage, idea, idea.created_at, idea.updated_at]);
    return clone(idea);
  }
  async findProjectIdea(ideaId) { return first(await this.pool.query("SELECT raw_json FROM community_project_ideas WHERE idea_id=$1", [ideaId])); }
  async listProjectIdeas(filter = {}) {
    const conditions = [];
    const values = [];
    if (filter.state) { values.push(filter.state); conditions.push(`state=$${values.length}`); }
    if (filter.author_user_id) { values.push(filter.author_user_id); conditions.push(`author_user_id=$${values.length}`); }
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    return rows(await this.pool.query(`SELECT raw_json FROM community_project_ideas ${where} ORDER BY updated_at DESC`, values));
  }
  async saveProjectIdeaComment(comment) {
    await this.pool.query(`INSERT INTO community_project_idea_comments (comment_id,idea_id,author_user_id,raw_json,created_at) VALUES ($1,$2,$3,$4,$5)`, [comment.comment_id, comment.idea_id, comment.author_user_id, comment, comment.created_at]);
    return clone(comment);
  }
  async listProjectIdeaComments(ideaId) {
    return rows(await this.pool.query("SELECT raw_json FROM community_project_idea_comments WHERE idea_id=$1 ORDER BY created_at", [ideaId]));
  }
  async saveProjectShowcase(showcase) {
    await this.pool.query(`
      INSERT INTO community_project_showcases (showcase_id,author_user_id,state,raw_json,created_at,updated_at)
      VALUES ($1,$2,$3,$4,$5,$6)
      ON CONFLICT (showcase_id) DO UPDATE SET state=EXCLUDED.state, raw_json=EXCLUDED.raw_json, updated_at=EXCLUDED.updated_at
    `, [showcase.showcase_id, showcase.author_user_id, showcase.state, showcase, showcase.created_at, showcase.updated_at]);
    return clone(showcase);
  }
  async findProjectShowcase(showcaseId) { return first(await this.pool.query("SELECT raw_json FROM community_project_showcases WHERE showcase_id=$1", [showcaseId])); }
  async listProjectShowcases(filter = {}) {
    const conditions = [];
    const values = [];
    if (filter.state) { values.push(filter.state); conditions.push(`state=$${values.length}`); }
    if (filter.author_user_id) { values.push(filter.author_user_id); conditions.push(`author_user_id=$${values.length}`); }
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    return rows(await this.pool.query(`SELECT raw_json FROM community_project_showcases ${where} ORDER BY updated_at DESC`, values));
  }

  async saveNotificationOutboxEvent(event) {
    await this.pool.query(`
      INSERT INTO community_notification_outbox
        (event_id, recipient_user_id, category, status, attempts, next_attempt_at,
         lease_until, outcome, last_error_code, created_at, updated_at, delivered_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
      ON CONFLICT (event_id) DO NOTHING
    `, [
      event.event_id, event.recipient_user_id, event.category, event.status,
      Number(event.attempts || 0), event.next_attempt_at, event.lease_until || null,
      event.outcome || null, event.last_error_code || null, event.created_at,
      event.updated_at, event.delivered_at || null,
    ]);
    return clone(event);
  }

  async claimNotificationOutbox({ now, leaseUntil, limit = 25 }) {
    const result = await this.pool.query(`
      WITH candidates AS (
        SELECT event_id
        FROM community_notification_outbox
        WHERE ((status IN ('pending', 'retry') AND next_attempt_at <= $1)
          OR (status = 'leased' AND lease_until <= $1))
        ORDER BY created_at
        FOR UPDATE SKIP LOCKED
        LIMIT $2
      )
      UPDATE community_notification_outbox AS event
      SET status='leased', attempts=event.attempts+1, lease_until=$3,
          updated_at=$1, last_error_code=NULL
      FROM candidates
      WHERE event.event_id=candidates.event_id
      RETURNING event.*
    `, [now, limit, leaseUntil]);
    return result.rows.map(notificationOutboxRow);
  }

  async completeNotificationOutboxEvent(eventId, { now, outcome }) {
    const result = await this.pool.query(`
      UPDATE community_notification_outbox
      SET status='delivered', outcome=$2, lease_until=NULL, delivered_at=$3,
          updated_at=$3, last_error_code=NULL
      WHERE event_id=$1 AND status='leased'
      RETURNING *
    `, [eventId, outcome, now]);
    return result.rows[0] ? notificationOutboxRow(result.rows[0]) : null;
  }

  async retryNotificationOutboxEvent(eventId, { now, nextAttemptAt, errorCode, maxAttempts = 8 }) {
    const result = await this.pool.query(`
      UPDATE community_notification_outbox
      SET status=CASE WHEN attempts >= $5 THEN 'dead_letter' ELSE 'retry' END,
          next_attempt_at=CASE WHEN attempts >= $5 THEN next_attempt_at ELSE $3 END,
          lease_until=NULL, updated_at=$2, last_error_code=$4
      WHERE event_id=$1 AND status='leased'
      RETURNING *
    `, [eventId, now, nextAttemptAt, errorCode, maxAttempts]);
    return result.rows[0] ? notificationOutboxRow(result.rows[0]) : null;
  }

  async notificationOutboxSummary() {
    const result = await this.pool.query("SELECT status, count(*)::int AS count FROM community_notification_outbox GROUP BY status");
    const summary = { pending: 0, retry: 0, leased: 0, delivered: 0, dead_letter: 0 };
    for (const row of result.rows) summary[row.status] = Number(row.count || 0);
    return summary;
  }

  async purgeNotificationOutbox({ deliveredBefore, deadLetterBefore }) {
    const result = await this.pool.query(`
      WITH deleted AS (
        DELETE FROM community_notification_outbox
        WHERE (status='delivered' AND COALESCE(delivered_at, updated_at, created_at) < $1)
           OR (status='dead_letter' AND COALESCE(updated_at, created_at) < $2)
        RETURNING status
      )
      SELECT
        count(*) FILTER (WHERE status='delivered')::int AS delivered,
        count(*) FILTER (WHERE status='dead_letter')::int AS dead_letter,
        count(*)::int AS total
      FROM deleted
    `, [deliveredBefore, deadLetterBefore]);
    const row = result.rows[0] || {};
    return {
      delivered: Number(row.delivered || 0),
      dead_letter: Number(row.dead_letter || 0),
      total: Number(row.total || 0),
    };
  }

  async createMessageThreadBundle({ thread, members, message, inboxEntries, outboxEvents = [] }) {
    return this.inTransaction(async (repository) => {
      await repository.saveMessageThread(thread);
      for (const member of members) await repository.saveThreadMember(member);
      await repository.saveMessage(message);
      for (const entry of inboxEntries) await repository.saveInboxEntry(entry);
      for (const event of outboxEvents) await repository.saveNotificationOutboxEvent(event);
      return clone({ thread, members, message, inboxEntries, outboxEvents });
    });
  }

  async appendMessageBundle({ thread, authorMember, message, inboxEntries, outboxEvents = [] }) {
    return this.inTransaction(async (repository) => {
      await repository.saveMessage(message);
      await repository.saveMessageThread(thread);
      if (authorMember) await repository.saveThreadMember(authorMember);
      for (const entry of inboxEntries) await repository.saveInboxEntry(entry);
      for (const event of outboxEvents) await repository.saveNotificationOutboxEvent(event);
      return clone({ thread, authorMember, message, inboxEntries, outboxEvents });
    });
  }

  async saveBroadcastBundle({ broadcast, inboxEntries }) {
    return this.inTransaction(async (repository) => {
      await repository.saveBroadcast(broadcast);
      for (const entry of inboxEntries) await repository.saveInboxEntry(entry);
      return clone({ broadcast, inboxEntries });
    });
  }

  async inTransaction(work) {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const result = await work(new PostgresCommunityRepository(client));
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async hasMigration(migrationId) {
    return (await this.pool.query(
      "SELECT 1 FROM community_migrations WHERE migration_id=$1",
      [migrationId],
    )).rowCount > 0;
  }

  async importLegacyState(state, migrationId = "community-sqlite-v1") {
    if (await this.hasMigration(migrationId)) return { imported: false, reason: "already_applied" };
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const count = await client.query("SELECT count(*) AS count FROM community_questions");
      if (Number(count.rows[0].count) > 0) throw new Error("COMMUNITY_POSTGRES_NOT_EMPTY");
      const transactionRepository = new PostgresCommunityRepository(client);
      for (const item of state.questions || []) await transactionRepository.saveQuestion(item);
      for (const item of state.answers || []) await transactionRepository.saveAnswer(item);
      for (const item of state.knowledgeDocuments || []) await transactionRepository.saveKnowledgeDocument(item);
      await client.query("INSERT INTO community_migrations (migration_id) VALUES ($1)", [migrationId]);
      await client.query("COMMIT");
      return {
        imported: true,
        questions: (state.questions || []).length,
        answers: (state.answers || []).length,
        knowledge_documents: (state.knowledgeDocuments || []).length,
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async close() {
    await this.pool.end();
  }
}

function first(result) {
  return result.rows[0] ? clone(result.rows[0].raw_json) : null;
}
function rows(result) {
  return result.rows.map((row) => clone(row.raw_json));
}

function notificationOutboxRow(row) {
  return clone({
    event_id: row.event_id,
    recipient_user_id: row.recipient_user_id,
    category: row.category,
    status: row.status,
    attempts: Number(row.attempts || 0),
    next_attempt_at: timestamp(row.next_attempt_at),
    lease_until: timestamp(row.lease_until),
    outcome: row.outcome || null,
    last_error_code: row.last_error_code || null,
    created_at: timestamp(row.created_at),
    updated_at: timestamp(row.updated_at),
    delivered_at: timestamp(row.delivered_at),
  });
}

function timestamp(value) { return value ? new Date(value).toISOString() : null; }
function clone(value) {
  return value ? JSON.parse(JSON.stringify(value)) : null;
}

module.exports = { PostgresCommunityRepository };
