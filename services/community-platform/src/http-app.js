const { CommunityPlatformError } = require("./errors");

const prefix = "/api/community";

function createHttpApp(options) {
  const service = options.service;

  return async function routeRequest(req, res) {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const path = url.pathname;

    if (req.method === "GET" && path === "/health") {
      sendJson(res, 200, { status: "ok", service: "community-platform" });
      return;
    }

    if (service.internalToken && req.headers["x-gernetix-community-token"] !== service.internalToken) {
      sendJson(res, 401, { error: "community_access_denied", message: "Dieser Dienst ist nur ueber die GerNetiX Plattform erreichbar." });
      return;
    }
    const actor = {
      user_id: String(req.headers["x-gernetix-community-actor"] || ""),
      is_operator: req.headers["x-gernetix-community-operator"] === "true",
    };

    if (req.method === "GET" && path === `${prefix}/questions`) {
      sendJson(res, 200, service.listQuestions(Object.fromEntries(url.searchParams.entries()), actor));
      return;
    }

    if (req.method === "POST" && path === `${prefix}/questions`) {
      sendJson(res, 201, service.createQuestion(await readJsonBody(req), actor));
      return;
    }

    const questionMatch = path.match(new RegExp(`^${prefix}/questions/([^/]+)$`));
    if (req.method === "GET" && questionMatch) {
      sendJson(res, 200, service.getQuestion(decodeURIComponent(questionMatch[1]), actor));
      return;
    }

    const triageMatch = path.match(new RegExp(`^${prefix}/questions/([^/]+)/triage$`));
    if (req.method === "POST" && triageMatch) {
      sendJson(res, 200, service.triageQuestion(decodeURIComponent(triageMatch[1]), await readJsonBody(req), actor));
      return;
    }

    const answersMatch = path.match(new RegExp(`^${prefix}/questions/([^/]+)/answers$`));
    if (req.method === "GET" && answersMatch) {
      sendJson(res, 200, service.listAnswers(decodeURIComponent(answersMatch[1]), actor));
      return;
    }
    if (req.method === "POST" && answersMatch) {
      sendJson(res, 201, service.createAnswer(decodeURIComponent(answersMatch[1]), await readJsonBody(req), actor));
      return;
    }

    const answerMatch = path.match(new RegExp(`^${prefix}/answers/([^/]+)$`));
    if (req.method === "PATCH" && answerMatch) {
      sendJson(res, 200, service.updateAnswer(decodeURIComponent(answerMatch[1]), await readJsonBody(req), actor));
      return;
    }

    const verifyMatch = path.match(new RegExp(`^${prefix}/answers/([^/]+)/verify$`));
    if (req.method === "POST" && verifyMatch) {
      sendJson(res, 200, service.verifyAnswer(decodeURIComponent(verifyMatch[1]), await readJsonBody(req), actor));
      return;
    }

    if (req.method === "GET" && path === `${prefix}/search`) {
      sendJson(res, 200, service.search(Object.fromEntries(url.searchParams.entries()), actor));
      return;
    }

    if (req.method === "GET" && path === `${prefix}/knowledge-documents`) {
      sendJson(res, 200, service.listKnowledgeDocuments(Object.fromEntries(url.searchParams.entries()), actor));
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
        reject(new CommunityPlatformError("request_too_large", "Request ist zu gross.", 413));
        req.destroy();
      }
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new CommunityPlatformError("invalid_json", "Request Body ist kein gueltiges JSON."));
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
