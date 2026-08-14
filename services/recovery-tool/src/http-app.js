const fs = require("node:fs");
const path = require("node:path");
const { RecoveryToolError } = require("./errors");
const {
  assertDelegatedResource,
  readBearerToken,
  verifyDelegation,
  verifyInternalToken,
} = require("../../shared/internal-api-auth");

const prefix = "/api/recovery";
const publicDir = path.join(__dirname, "..", "public");
const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
};

function createHttpApp(options) {
  const service = options.service;
  const signingKey = options.internalApiSigningKey || "";

  return async function routeRequest(req, res) {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const path = url.pathname;

    if (req.method === "GET" && path === "/health") {
      sendJson(res, 200, { status: "ok", service: "recovery-tool" });
      return;
    }

    if (req.method === "GET" && path === `${prefix}/sessions`) {
      const delegation = authorize(req, signingKey, "recovery.session.read");
      sendJson(res, 200, service.listSessions({ ...Object.fromEntries(url.searchParams.entries()), account_id: delegation.context.account_id }));
      return;
    }

    if (req.method === "POST" && path === `${prefix}/sessions`) {
      const delegation = authorize(req, signingKey, "recovery.session.write");
      sendJson(res, 201, service.createSession(withDelegatedAccount(await readJsonBody(req), delegation)));
      return;
    }

    if (req.method === "POST" && path === `${prefix}/hardware-lab/sessions`) {
      const delegation = authorize(req, signingKey, "hardware_lab.write", "ai_assistant");
      sendJson(res, 201, service.createHardwareLabSession(withDelegatedAccount(await readJsonBody(req), delegation)));
      return;
    }

    const hardwareLabActionMatch = path.match(new RegExp(`^${prefix}/hardware-lab/sessions/([^/]+)/(analyze-sources|discovery-firmware-build|discovery-firmware-build-status|discovery-firmware-build-result|examination-report|gernetix-verification-request)$`));
    if (req.method === "POST" && hardwareLabActionMatch) {
      const sessionId = decodeURIComponent(hardwareLabActionMatch[1]);
      const delegation = authorize(req, signingKey, "hardware_lab.write", "ai_assistant");
      assertOwnedSession(service, sessionId, delegation);
      const body = await readJsonBody(req);
      const actions = {
        "analyze-sources": () => service.analyzeHardwareLabSources(sessionId, body),
        "discovery-firmware-build": () => service.requestDiscoveryFirmwareBuild(sessionId, body),
        "discovery-firmware-build-status": () => service.synchronizeDiscoveryFirmwareBuild(sessionId),
        "discovery-firmware-build-result": () => service.recordDiscoveryFirmwareBuild(sessionId, body),
        "examination-report": () => service.recordHardwareExamination(sessionId, body),
        "gernetix-verification-request": () => service.requestGerNetiXVerification(sessionId, body),
      };
      sendJson(res, 200, await actions[hardwareLabActionMatch[2]]());
      return;
    }

    const sessionMatch = path.match(new RegExp(`^${prefix}/sessions/([^/]+)$`));
    if (req.method === "GET" && sessionMatch) {
      const sessionId = decodeURIComponent(sessionMatch[1]);
      const delegation = authorize(req, signingKey, "recovery.session.read");
      sendJson(res, 200, assertOwnedSession(service, sessionId, delegation));
      return;
    }

    const capabilitiesMatch = path.match(new RegExp(`^${prefix}/sessions/([^/]+)/capabilities$`));
    if (req.method === "POST" && capabilitiesMatch) {
      const sessionId = decodeURIComponent(capabilitiesMatch[1]);
      const delegation = authorize(req, signingKey, "recovery.session.write");
      assertOwnedSession(service, sessionId, delegation);
      sendJson(res, 200, service.answerCapabilities(sessionId, await readJsonBody(req)));
      return;
    }

    const registerMatch = path.match(new RegExp(`^${prefix}/sessions/([^/]+)/register-community-device$`));
    if (req.method === "POST" && registerMatch) {
      const sessionId = decodeURIComponent(registerMatch[1]);
      const delegation = authorize(req, signingKey, "recovery.session.write");
      assertOwnedSession(service, sessionId, delegation);
      sendJson(res, 200, await service.registerCommunityDevice(sessionId, await readJsonBody(req)));
      return;
    }

    const credentialsMatch = path.match(new RegExp(`^${prefix}/sessions/([^/]+)/renew-credentials$`));
    if (req.method === "POST" && credentialsMatch) {
      const sessionId = decodeURIComponent(credentialsMatch[1]);
      const delegation = authorize(req, signingKey, "recovery.credentials.write");
      assertOwnedSession(service, sessionId, delegation);
      sendJson(res, 200, service.renewCredentials(sessionId, await readJsonBody(req)));
      return;
    }

    const connectivityMatch = path.match(new RegExp(`^${prefix}/sessions/([^/]+)/connectivity-reset$`));
    if (req.method === "POST" && connectivityMatch) {
      const sessionId = decodeURIComponent(connectivityMatch[1]);
      const delegation = authorize(req, signingKey, "recovery.session.write");
      assertOwnedSession(service, sessionId, delegation);
      sendJson(res, 200, service.resetConnectivity(sessionId, await readJsonBody(req)));
      return;
    }

    if (req.method === "GET") {
      serveStatic(res, path);
      return;
    }

    sendJson(res, 404, { error: "not_found" });
  };
}

function authorize(req, signingKey, scope, entitlement = "") {
  verifyInternalToken(readBearerToken(req), signingKey, { audience: "recovery-tool", requiredScopes: [scope] });
  const delegation = verifyDelegation(req.headers["x-gernetix-delegation"], signingKey, {
    audience: "recovery-tool",
    requiredScopes: [scope],
  });
  return assertDelegatedResource(delegation, { entitlement });
}

function assertOwnedSession(service, sessionId, delegation) {
  const session = service.getSession(sessionId);
  assertDelegatedResource(delegation, { accountId: session.account_id });
  return session;
}

function withDelegatedAccount(body, delegation) {
  return { ...(body || {}), account_id: delegation.context.account_id };
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1024 * 1024) {
        reject(new RecoveryToolError("request_too_large", "Request ist zu gross.", 413));
        req.destroy();
      }
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new RecoveryToolError("invalid_json", "Request Body ist kein gueltiges JSON."));
      }
    });
    req.on("error", reject);
  });
}

function sendJson(res, status, payload) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

function serveStatic(res, requestPath) {
  const normalizedRequestPath = requestPath === "/" ? "/index.html" : requestPath;
  const filePath = path.normalize(path.join(publicDir, normalizedRequestPath));
  if (!filePath.startsWith(publicDir)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }
  fs.readFile(filePath, (error, content) => {
    if (error) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not found");
      return;
    }
    res.writeHead(200, {
      "Content-Type": contentTypes[path.extname(filePath)] || "application/octet-stream",
      "Cache-Control": "no-store",
    });
    res.end(content);
  });
}

module.exports = { createHttpApp, sendJson };
