"use strict";

const { issueInternalToken } = require("../../../../shared/internal-api-auth");

function registerHardwareLabRoutes({
  registry,
  requireSession,
  readJsonBody,
  sendJson,
  projectServerUserId,
  hardwareLabService,
  hardwareLabRepository,
  buildDeployBaseUrl,
  aiUsageJson,
  internalApiSigningKey,
  fetchImpl = fetch,
}) {
  registry.register({
    method: "GET",
    path: "/api/platform/hardware-lab/ai-usage",
    async handler({ req, res }) {
      const session = await requireSession(req, res);
      if (!session) return;
      const accountId = projectServerUserId(session);
      const rating = await aiUsageJson(`/api/ai-usage/accounts/${encodeURIComponent(accountId)}/rating`, {
        internalAuth: {
          scopes: ["ai.usage.read"],
          delegation: { account_id: accountId, project_ids: [], entitlements: [] },
        },
      });
      sendJson(res, 200, { rating });
    },
  });

  registry.register({
    method: "GET",
    path: "/api/platform/hardware-lab/sessions",
    async handler({ req, res }) {
      const session = await requireSession(req, res);
      if (!session) return;
      const accountId = projectServerUserId(session);
      sendJson(res, 200, {
        items: hardwareLabService.listSessions({ account_id: accountId }).items
          .filter(isHardwareLabSession)
          .map(presentSession),
      });
    },
  });

  registry.register({
    method: "POST",
    path: "/api/platform/hardware-lab/sessions",
    async handler({ req, res }) {
      const identitySession = await requireSession(req, res);
      if (!identitySession) return;
      await respond(res, async () => hardwareLabService.createHardwareLabSession({
        ...readBodyWithoutIdentity(await readJsonBody(req)),
        account_id: projectServerUserId(identitySession),
        actor: "identity-hardware-lab",
      }), 201);
    },
  });

  registerAction("analyze-sources", (id) => hardwareLabService.analyzeHardwareLabSources(id, { actor: "identity-hardware-lab" }));
  registerAction("chat", (id, body) => hardwareLabService.chatHardwareLab(id, { ...body, actor: "identity-hardware-lab" }));
  registerAction("discovery-firmware-build", (id) => hardwareLabService.requestDiscoveryFirmwareBuild(id, { actor: "identity-hardware-lab" }));
  registerAction("discovery-firmware-build-status", (id) => hardwareLabService.synchronizeDiscoveryFirmwareBuild(id));
  registerAction("examination-report", (id, body) => hardwareLabService.recordHardwareExamination(id, { ...body, actor: "identity-hardware-lab" }));
  registerAction("gernetix-verification-request", (id, body) => hardwareLabService.requestGerNetiXVerification(id, { ...body, actor: "identity-hardware-lab" }));

  registry.register({
    method: "GET",
    pattern: /^\/api\/platform\/hardware-lab\/sessions\/([^/]+)\/firmware$/,
    async handler({ req, res, match }) {
      const identitySession = await requireSession(req, res);
      if (!identitySession) return;
      const labSession = ownedSession(match[1], identitySession, res);
      if (!labSession) return;
      const build = labSession.discovery?.firmware_build || {};
      if (build.status !== "success" || !build.build_job_id || !build.artifact_file_name) {
        sendJson(res, 404, { error: "hardware_lab_firmware_not_found", message: "Für diesen Laborvorgang ist keine Firmware verfügbar." });
        return;
      }
      await proxyFirmware(res, build.build_job_id, build.artifact_file_name, labSession.account_id);
    },
  });

  function registerAction(action, execute) {
    registry.register({
      method: "POST",
      pattern: new RegExp(`^/api/platform/hardware-lab/sessions/([^/]+)/${action}$`),
      async handler({ req, res, match }) {
        const identitySession = await requireSession(req, res);
        if (!identitySession) return;
        const sessionId = decodeURIComponent(match[1]);
        if (!ownedSession(sessionId, identitySession, res)) return;
        const body = readBodyWithoutIdentity(await readJsonBody(req));
        await respond(res, () => execute(sessionId, body));
      },
    });
  }

  function ownedSession(rawSessionId, identitySession, res) {
    const sessionId = decodeURIComponent(rawSessionId);
    let labSession;
    try { labSession = hardwareLabService.getSession(sessionId); } catch { labSession = null; }
    if (!isHardwareLabSession(labSession) || labSession.account_id !== projectServerUserId(identitySession)) {
      sendJson(res, 404, { error: "hardware_lab_session_not_found", message: "Laborvorgang wurde nicht gefunden." });
      return null;
    }
    return labSession;
  }

  async function proxyFirmware(res, jobId, fileName, accountId) {
    try {
      const scopes = ["artifact.download"];
      const common = { iss: "identity-server", sub: "identity-server", aud: "build-deploy-server", scopes };
      const response = await fetchImpl(`${String(buildDeployBaseUrl).replace(/\/$/, "")}/artifacts/${encodeURIComponent(jobId)}/${encodeURIComponent(fileName)}`, {
        headers: {
          Authorization: `Bearer ${issueInternalToken(common, internalApiSigningKey)}`,
          "X-GerNetiX-Delegation": issueInternalToken({
            ...common,
            kind: "delegated_user_action",
            context: { account_id: accountId, project_ids: [], entitlements: [] },
          }, internalApiSigningKey),
        },
      });
      if (!response.ok) {
        sendJson(res, response.status === 404 ? 404 : 502, { error: "hardware_lab_firmware_fetch_failed", message: "Die Discovery-Firmware konnte nicht geladen werden." });
        return;
      }
      const bytes = Buffer.from(await response.arrayBuffer());
      res.writeHead(200, {
        "Content-Type": response.headers.get("content-type") || "application/octet-stream",
        "Content-Disposition": `attachment; filename="${safeFileName(fileName)}"`,
        "Content-Length": bytes.length,
        "Cache-Control": "private, no-store",
      });
      res.end(bytes);
    } catch {
      sendJson(res, 502, { error: "hardware_lab_firmware_fetch_failed", message: "Die Discovery-Firmware konnte nicht geladen werden." });
    }
  }

  function presentSession(session) {
    const copy = structuredClone(session);
    if (copy.discovery?.firmware_build?.artifact_url) {
      copy.discovery.firmware_build.artifact_url = `/api/platform/hardware-lab/sessions/${encodeURIComponent(copy.recovery_session_id)}/firmware`;
    }
    return copy;
  }

  async function respond(res, operation, status = 200) {
    try {
      const result = await operation();
      await hardwareLabRepository?.flush?.();
      sendJson(res, status, presentSession(result));
    } catch (error) {
      await hardwareLabRepository?.flush?.().catch(() => {});
      sendJson(res, Number(error.status || 500), {
        error: error.code || "hardware_lab_request_failed",
        message: error.message || "Hardware-Labor-Anfrage fehlgeschlagen.",
        ...(error.details ? { details: error.details } : {}),
      });
    }
  }
}

function readBodyWithoutIdentity(body = {}) {
  const { account_id: _accountId, user_id: _userId, actor: _actor, ...safeBody } = body || {};
  return safeBody;
}

function isHardwareLabSession(session) {
  return session?.recovery_type === "ai_guided_hardware_lab";
}

function safeFileName(value) {
  return String(value || "discovery-firmware.bin").replace(/[^A-Za-z0-9._-]+/g, "-");
}

module.exports = { registerHardwareLabRoutes, readBodyWithoutIdentity };
