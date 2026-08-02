"use strict";

function registerCommunityRoutes({
  registry,
  requireSession,
  readJsonBody,
  sendJson,
  communityJson,
  auth,
  createCommunityProjectSnapshot,
  notifyPrivateCommunityRequest,
}) {
  const publicHeaders = { "X-GerNetiX-Community-Actor": "", "X-GerNetiX-Community-Operator": "false" };
  registry.register({
    method: "GET",
    path: "/api/public/community/questions",
    async handler({ res, url }) {
      const tag = String(url.searchParams.get("tag") || "").trim();
      const payload = await communityJson(`/api/community/questions${tag ? `?tag=${encodeURIComponent(tag)}` : ""}`, { headers: publicHeaders });
      sendJson(res, 200, payload);
    },
  });
  registry.register({
    method: "GET",
    pattern: /^\/api\/public\/community\/questions\/([^/]+)$/,
    async handler({ res, match }) {
      const payload = await communityJson(`/api/community/questions/${encodeURIComponent(decodeURIComponent(match[1]))}`, { headers: publicHeaders });
      sendJson(res, 200, payload);
    },
  });
  registry.register({
    method: "GET",
    pattern: /^\/api\/public\/community\/questions\/([^/]+)\/answers$/,
    async handler({ res, match }) {
      const questionId = encodeURIComponent(decodeURIComponent(match[1]));
      const payload = await communityJson(`/api/community/questions/${questionId}/answers`, { headers: publicHeaders });
      sendJson(res, 200, payload);
    },
  });
  registry.register({
    method: "*",
    pattern: /^\/api\/community/,
    async handler({ req, res, url }) {
      const session = await requireSession(req, res);
      if (!session) return;
      const body = ["POST", "PATCH"].includes(req.method) ? await readJsonBody(req) : undefined;
      if (req.method === "POST" && ["/api/community/inbox/direct", "/api/community/message-threads"].includes(url.pathname)) {
        const recipient = await auth().repository.findUserByUsername(String(body?.recipient_username || "").trim());
        if (!recipient || recipient.account_type === "guest") {
          sendJson(res, 404, { error: "inbox_recipient_not_found", message: "Dieser registrierte Nickname wurde nicht gefunden." });
          return;
        }
        body.recipient_user_id = recipient.id;
        body.sender_label = session.account.username || "Mitglied";
        delete body.recipient_username;
      }
      if (req.method === "POST" && url.pathname === "/api/community/support-requests") body.sender_label = session.account.username || "Mitglied";
      if (req.method === "POST" && url.pathname === "/api/community/marketplace/listings") body.author_label = session.account.username || "Community-Mitglied";
      if (req.method === "POST" && (url.pathname === "/api/community/ideas" || /^\/api\/community\/ideas\/[^/]+\/comments$/.test(url.pathname))) {
        body.author_label = session.account.username || "Community-Mitglied";
      }
      if (req.method === "POST" && url.pathname === "/api/community/showcases") {
        body.project_snapshot = await createCommunityProjectSnapshot(session, body.project_id);
        body.author_label = session.account.username || "Community-Mitglied";
        delete body.project_id;
      }
      if (req.method === "POST" && url.pathname === "/api/community/questions" && body?.attach_project_snapshot === "true") {
        let capabilities;
        try {
          capabilities = await communityJson("/api/community/capabilities");
        } catch {
          const error = new Error("Der Community-Service ist noch nicht auf dem Stand für Projektkopien. Die Anfrage wurde nicht gespeichert.");
          error.status = 503;
          throw error;
        }
        if (!capabilities.project_snapshot_attachment) {
          const error = new Error("Der Community-Service unterstützt Projektkopien noch nicht. Die Anfrage wurde nicht gespeichert.");
          error.status = 503;
          throw error;
        }
        body.project_snapshot = await createCommunityProjectSnapshot(session, body.project_id);
        body.project_id = "";
      }
      const payload = await communityJson(`${url.pathname}${url.search}`, {
        method: req.method,
        body,
        headers: {
          "X-GerNetiX-Community-Actor": session.account.user_id,
          "X-GerNetiX-Community-Operator": "false",
        },
      });
      if (req.method === "POST" && url.pathname === "/api/community/questions" && body?.visibility === "private") {
        await notifyPrivateCommunityRequest({ questionId: payload.question_id });
      }
      sendJson(res, req.method === "POST" ? 201 : 200, payload);
    },
  });
}

module.exports = { registerCommunityRoutes };
