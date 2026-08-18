"use strict";

function registerAccountRoutes({
  registry,
  requireSession,
  readJsonBody,
  sendJson,
  auth,
  sessions,
  setSessionCookie,
  sanitizeNextPath,
  updateCachedSessionAccount,
  accountAssetRepository,
  createAccountTransparency,
}) {
  registry.register({
    method: "POST",
    path: "/api/account/guest",
    async handler({ req, res }) {
      const body = await readJsonBody(req);
      const guest = await auth().create_guest({ preferredLocale: body.locale });
      sessions.set(guest.session.token, { account: guest.account, expiresAt: guest.session.expires_at });
      setSessionCookie(res, guest.session.token, guest.session.expires_at);
      sendJson(res, 201, { account: guest.account, next: sanitizeNextPath(body.next) || "/app/dashboard/" });
    },
  });
  registry.register({
    method: "GET",
    path: "/api/account/access-profile",
    async handler({ req, res }) {
      const session = await requireSession(req, res);
      if (session) sendJson(res, 200, { account: session.account });
    },
  });

  for (const method of ["GET", "PATCH"]) {
    registry.register({
      method,
      path: "/api/account/preferences",
      async handler({ req, res }) {
        const session = await requireSession(req, res);
        if (!session) return;
        if (method === "GET") {
          sendJson(res, 200, { preferred_locale: session.account.preferred_locale || "de" });
          return;
        }
        try {
          const body = await readJsonBody(req);
          const account = await auth().update_preferred_locale(session.account.user_id, body.preferred_locale);
          updateCachedSessionAccount(req, account);
          sendJson(res, 200, { preferred_locale: account.preferred_locale, account });
        } catch (error) {
          sendJson(res, error.status || 400, { error: error.code || "invalid_locale" });
        }
      },
    });
  }

  for (const method of ["GET", "PATCH"]) {
    registry.register({
      method,
      path: "/api/account/contact-notifications",
      async handler({ req, res }) {
        const session = await requireSession(req, res);
        if (!session) return;
        try {
          const result = method === "GET"
            ? await auth().get_contact_notification_settings(session.account.user_id)
            : await auth().update_notification_preferences(session.account.user_id, await readJsonBody(req));
          sendJson(res, 200, result);
        } catch (error) {
          sendJson(res, error.status || 400, { error: error.code || "contact_notification_update_failed" });
        }
      },
    });
  }

  registry.register({
    method: "POST",
    path: "/api/account/contact-email",
    async handler({ req, res }) {
      const session = await requireSession(req, res);
      if (!session) return;
      try {
        const body = await readJsonBody(req);
        sendJson(res, 202, await auth().request_contact_email_change(session.account.user_id, body.email));
      } catch (error) {
        sendJson(res, error.status || 400, { error: error.code || "contact_email_update_failed" });
      }
    },
  });

  registry.register({
    method: "DELETE",
    path: "/api/account/contact-email",
    async handler({ req, res }) {
      const session = await requireSession(req, res);
      if (!session) return;
      try {
        sendJson(res, 200, await auth().remove_contact_email(session.account.user_id));
      } catch (error) {
        sendJson(res, error.status || 400, { error: error.code || "contact_email_remove_failed" });
      }
    },
  });

  for (const method of ["GET", "POST"]) {
    registry.register({
      method,
      path: "/api/account/assets",
      async handler({ req, res }) {
        const session = await requireSession(req, res);
        if (!session) return;
        const repository = accountAssetRepository();
        if (!repository) { sendJson(res, 503, { error: "account_asset_store_unavailable" }); return; }
        if (method === "GET") {
          sendJson(res, 200, { items: await repository.list(session.account.user_id) });
          return;
        }
        const asset = await repository.create(session.account.user_id, await readJsonBody(req, 24 * 1024 * 1024));
        sendJson(res, 201, asset);
      },
    });
  }
  registry.register({
    method: "DELETE",
    pattern: /^\/api\/account\/assets\/([^/]+)$/,
    async handler({ req, res, match }) {
      const session = await requireSession(req, res);
      if (!session) return;
      const repository = accountAssetRepository();
      if (!repository) { sendJson(res, 503, { error: "account_asset_store_unavailable" }); return; }
      sendJson(res, 200, await repository.delete(session.account.user_id, decodeURIComponent(match[1])));
    },
  });
  registry.register({
    method: "GET",
    pattern: /^\/api\/account\/assets\/([^/]+)\/content$/,
    async handler({ req, res, match }) {
      const session = await requireSession(req, res);
      if (!session) return;
      const repository = accountAssetRepository();
      if (!repository) { sendJson(res, 503, { error: "account_asset_store_unavailable" }); return; }
      const asset = await repository.get(session.account.user_id, decodeURIComponent(match[1]));
      res.writeHead(200, {
        "Content-Type": asset.content_type,
        "Content-Length": asset.size_bytes,
        "X-Content-SHA256": asset.sha256 || "",
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "sandbox; default-src 'none'",
      });
      res.end(asset.content_blob);
    },
  });

  registry.register({
    method: "POST",
    path: "/api/account/upgrade-guest",
    async handler({ req, res }) {
      const session = await requireSession(req, res);
      if (!session) return;
      const body = await readJsonBody(req);
      const result = await auth().upgrade_guest_to_base(session.account.user_id, body.username, body.password, body.accepted_terms === true, body.passkey_credential_id, body.offline_recovery_set_confirmed === true, body.offline_recovery_set);
      updateCachedSessionAccount(req, result.account);
      sendJson(res, 200, result);
    },
  });
  registry.register({
    method: "POST",
    path: "/api/account/offline-recovery-set",
    async handler({ req, res }) {
      const session = await requireSession(req, res);
      if (!session) return;
      const result = await auth().create_offline_recovery_set(session.account.user_id);
      updateCachedSessionAccount(req, result.account);
      sendJson(res, 201, result);
    },
  });
  for (const method of ["POST", "DELETE"]) {
    registry.register({
      method,
      pattern: /^\/api\/account\/recovery-boards\/([^/]+)$/,
      async handler({ req, res, match }) {
        const session = await requireSession(req, res);
        if (!session) return;
        const boardId = decodeURIComponent(match[1]);
        const result = method === "POST"
          ? await auth().add_esp32_recovery_token(session.account.user_id, boardId)
          : await auth().remove_esp32_recovery_token(session.account.user_id, boardId);
        updateCachedSessionAccount(req, result.account);
        sendJson(res, 200, result);
      },
    });
  }

  for (const routePath of ["/api/account/me/transparency", "/account/me/transparency"]) {
    registry.register({
      method: "*",
      path: routePath,
      async handler({ req, res }) {
        const session = await requireSession(req, res);
        if (!session) return;
        if (!["GET", "POST"].includes(req.method)) { sendJson(res, 405, { error: "method_not_allowed" }); return; }
        sendJson(res, 200, await createAccountTransparency(session, { refresh: req.method === "POST" }));
      },
    });
  }
  for (const routePath of ["/api/account/me/transparency/refresh", "/account/me/transparency/refresh"]) {
    registry.register({
      method: "*",
      path: routePath,
      async handler({ req, res }) {
        const session = await requireSession(req, res);
        if (!session) return;
        if (req.method !== "POST") { sendJson(res, 405, { error: "method_not_allowed" }); return; }
        sendJson(res, 200, await createAccountTransparency(session, { refresh: true }));
      },
    });
  }
}

module.exports = { registerAccountRoutes };
