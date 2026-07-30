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

    if (req.method === "GET" && path === `${prefix}/operations-summary`) {
      sendJson(res, 200, await service.operationsSummary());
      return;
    }

    if (req.method === "GET" && path === `${prefix}/capabilities`) {
      sendJson(res, 200, { project_snapshot_attachment: true });
      return;
    }

    if (req.method === "GET" && path === `${prefix}/questions`) {
      sendJson(res, 200, await service.listQuestions(Object.fromEntries(url.searchParams.entries()), actor));
      return;
    }

    if (req.method === "POST" && path === `${prefix}/questions`) {
      sendJson(res, 201, await service.createQuestion(await readJsonBody(req), actor));
      return;
    }

    const questionMatch = path.match(new RegExp(`^${prefix}/questions/([^/]+)$`));
    if (req.method === "GET" && questionMatch) {
      sendJson(res, 200, await service.getQuestion(decodeURIComponent(questionMatch[1]), actor));
      return;
    }

    const triageMatch = path.match(new RegExp(`^${prefix}/questions/([^/]+)/triage$`));
    if (req.method === "POST" && triageMatch) {
      sendJson(res, 200, await service.triageQuestion(decodeURIComponent(triageMatch[1]), await readJsonBody(req), actor));
      return;
    }

    const answersMatch = path.match(new RegExp(`^${prefix}/questions/([^/]+)/answers$`));
    if (req.method === "GET" && answersMatch) {
      sendJson(res, 200, await service.listAnswers(decodeURIComponent(answersMatch[1]), actor));
      return;
    }
    if (req.method === "POST" && answersMatch) {
      sendJson(res, 201, await service.createAnswer(decodeURIComponent(answersMatch[1]), await readJsonBody(req), actor));
      return;
    }

    const answerMatch = path.match(new RegExp(`^${prefix}/answers/([^/]+)$`));
    if (req.method === "PATCH" && answerMatch) {
      sendJson(res, 200, await service.updateAnswer(decodeURIComponent(answerMatch[1]), await readJsonBody(req), actor));
      return;
    }

    const verifyMatch = path.match(new RegExp(`^${prefix}/answers/([^/]+)/verify$`));
    if (req.method === "POST" && verifyMatch) {
      sendJson(res, 200, await service.verifyAnswer(decodeURIComponent(verifyMatch[1]), await readJsonBody(req), actor));
      return;
    }

    if (req.method === "GET" && path === `${prefix}/search`) {
      sendJson(res, 200, await service.search(Object.fromEntries(url.searchParams.entries()), actor));
      return;
    }

    if (req.method === "GET" && path === `${prefix}/knowledge-documents`) {
      sendJson(res, 200, await service.listKnowledgeDocuments(Object.fromEntries(url.searchParams.entries()), actor));
      return;
    }

    if (req.method === "GET" && path === `${prefix}/inbox`) {
      sendJson(res, 200, await service.listInbox(actor));
      return;
    }
    if (req.method === "GET" && path === `${prefix}/message-threads`) {
      sendJson(res, 200, await service.listMessageThreads(actor, Object.fromEntries(url.searchParams.entries())));
      return;
    }
    if (req.method === "POST" && path === `${prefix}/message-threads`) {
      sendJson(res, 201, await service.createDirectThread(await readJsonBody(req), actor));
      return;
    }
    if (req.method === "POST" && path === `${prefix}/support-requests`) {
      sendJson(res, 201, await service.createSupportRequest(await readJsonBody(req), actor));
      return;
    }
    if (req.method === "GET" && path === `${prefix}/message-blocks`) {
      sendJson(res, 200, await service.listMessageBlocks(actor));
      return;
    }
    if (req.method === "POST" && path === `${prefix}/message-blocks`) {
      sendJson(res, 201, await service.blockMessageUser(await readJsonBody(req), actor));
      return;
    }
    const messageBlock = path.match(new RegExp(`^${prefix}/message-blocks/([^/]+)$`));
    if (req.method === "DELETE" && messageBlock) {
      sendJson(res, 200, await service.unblockMessageUser(decodeURIComponent(messageBlock[1]), actor));
      return;
    }
    const messageThread = path.match(new RegExp(`^${prefix}/message-threads/([^/]+)$`));
    if (req.method === "GET" && messageThread) {
      sendJson(res, 200, await service.getMessageThread(decodeURIComponent(messageThread[1]), actor));
      return;
    }
    const threadMessages = path.match(new RegExp(`^${prefix}/message-threads/([^/]+)/messages$`));
    if (req.method === "POST" && threadMessages) {
      sendJson(res, 201, await service.appendThreadMessage(decodeURIComponent(threadMessages[1]), await readJsonBody(req), actor));
      return;
    }
    const messageReport = path.match(new RegExp(`^${prefix}/message-threads/([^/]+)/messages/([^/]+)/report$`));
    if (req.method === "POST" && messageReport) {
      sendJson(res, 201, await service.reportMessage(
        decodeURIComponent(messageReport[1]),
        decodeURIComponent(messageReport[2]),
        await readJsonBody(req),
        actor,
      ));
      return;
    }
    const threadRead = path.match(new RegExp(`^${prefix}/message-threads/([^/]+)/read$`));
    if (req.method === "POST" && threadRead) {
      sendJson(res, 200, await service.markThreadRead(decodeURIComponent(threadRead[1]), actor));
      return;
    }
    const threadArchive = path.match(new RegExp(`^${prefix}/message-threads/([^/]+)/archive$`));
    if (req.method === "POST" && threadArchive) {
      sendJson(res, 200, await service.archiveMessageThread(decodeURIComponent(threadArchive[1]), actor));
      return;
    }
    if (req.method === "DELETE" && threadArchive) {
      sendJson(res, 200, await service.restoreMessageThread(decodeURIComponent(threadArchive[1]), actor));
      return;
    }
    const threadMessageDelete = path.match(new RegExp(`^${prefix}/message-threads/([^/]+)/messages/([^/]+)$`));
    if (req.method === "DELETE" && threadMessageDelete) {
      sendJson(res, 200, await service.deleteThreadMessage(decodeURIComponent(threadMessageDelete[1]), decodeURIComponent(threadMessageDelete[2]), actor));
      return;
    }
    if (req.method === "GET" && path === `${prefix}/message-reports`) {
      sendJson(res, 200, await service.listMessageReports(Object.fromEntries(url.searchParams.entries()), actor));
      return;
    }
    const messageReportResolution = path.match(new RegExp(`^${prefix}/message-reports/([^/]+)/resolve$`));
    if (req.method === "POST" && messageReportResolution) {
      sendJson(res, 200, await service.resolveMessageReport(decodeURIComponent(messageReportResolution[1]), await readJsonBody(req), actor));
      return;
    }
    if (req.method === "POST" && path === `${prefix}/inbox/direct`) {
      sendJson(res, 201, await service.sendDirectMessage(await readJsonBody(req), actor));
      return;
    }
    if (req.method === "POST" && path === `${prefix}/inbox/broadcasts`) {
      sendJson(res, 201, { items: await service.createBroadcast(await readJsonBody(req), actor) });
      return;
    }
    if (req.method === "POST" && path === `${prefix}/inbox/project-invitations`) {
      sendJson(res, 201, await service.createProjectInvitation(await readJsonBody(req), actor));
      return;
    }
    const inboxRead = path.match(new RegExp(`^${prefix}/inbox/([^/]+)/read$`));
    if (req.method === "POST" && inboxRead) {
      sendJson(res, 200, await service.markInboxRead(decodeURIComponent(inboxRead[1]), actor));
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
