const { CommunityAiAssistantError } = require("./errors");

const prefix = "/api/community-ai";

function createHttpApp(options) {
  const service = options.service;

  return async function routeRequest(req, res) {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const path = url.pathname;

    if (req.method === "GET" && path === "/health") {
      sendJson(res, 200, { status: "ok", service: "community-ai-assistant" });
      return;
    }

    if (req.method === "POST" && path === `${prefix}/query`) {
      sendJson(res, 200, await service.answerQuestion(await readJsonBody(req)));
      return;
    }

    if (req.method === "POST" && path === `${prefix}/similar-content`) {
      sendJson(res, 200, await service.similarContent(await readJsonBody(req)));
      return;
    }

    if (req.method === "POST" && path === `${prefix}/summaries`) {
      sendJson(res, 200, await service.summarize(await readJsonBody(req)));
      return;
    }

    if (req.method === "GET" && path === `${prefix}/admin/metrics`) {
      sendJson(res, 200, service.adminMetrics());
      return;
    }

    if (req.method === "POST" && path === `${prefix}/admin/config`) {
      sendJson(res, 200, service.updateConfig(await readJsonBody(req)));
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
        reject(new CommunityAiAssistantError("request_too_large", "Request ist zu gross.", 413));
        req.destroy();
      }
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new CommunityAiAssistantError("invalid_json", "Request Body ist kein gueltiges JSON."));
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
