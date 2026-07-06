const { RecoveryToolError } = require("./errors");

const prefix = "/api/recovery";

function createHttpApp(options) {
  const service = options.service;

  return async function routeRequest(req, res) {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const path = url.pathname;

    if (req.method === "GET" && path === "/health") {
      sendJson(res, 200, { status: "ok", service: "recovery-tool" });
      return;
    }

    if (req.method === "GET" && path === `${prefix}/sessions`) {
      sendJson(res, 200, service.listSessions(Object.fromEntries(url.searchParams.entries())));
      return;
    }

    if (req.method === "POST" && path === `${prefix}/sessions`) {
      sendJson(res, 201, service.createSession(await readJsonBody(req)));
      return;
    }

    const sessionMatch = path.match(new RegExp(`^${prefix}/sessions/([^/]+)$`));
    if (req.method === "GET" && sessionMatch) {
      sendJson(res, 200, service.getSession(decodeURIComponent(sessionMatch[1])));
      return;
    }

    const capabilitiesMatch = path.match(new RegExp(`^${prefix}/sessions/([^/]+)/capabilities$`));
    if (req.method === "POST" && capabilitiesMatch) {
      sendJson(res, 200, service.answerCapabilities(decodeURIComponent(capabilitiesMatch[1]), await readJsonBody(req)));
      return;
    }

    const registerMatch = path.match(new RegExp(`^${prefix}/sessions/([^/]+)/register-community-device$`));
    if (req.method === "POST" && registerMatch) {
      sendJson(res, 200, await service.registerCommunityDevice(decodeURIComponent(registerMatch[1]), await readJsonBody(req)));
      return;
    }

    const credentialsMatch = path.match(new RegExp(`^${prefix}/sessions/([^/]+)/renew-credentials$`));
    if (req.method === "POST" && credentialsMatch) {
      sendJson(res, 200, service.renewCredentials(decodeURIComponent(credentialsMatch[1]), await readJsonBody(req)));
      return;
    }

    const connectivityMatch = path.match(new RegExp(`^${prefix}/sessions/([^/]+)/connectivity-reset$`));
    if (req.method === "POST" && connectivityMatch) {
      sendJson(res, 200, service.resetConnectivity(decodeURIComponent(connectivityMatch[1]), await readJsonBody(req)));
      return;
    }

    sendJson(res, 404, { error: "not_found" });
  };
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

module.exports = { createHttpApp, sendJson };
