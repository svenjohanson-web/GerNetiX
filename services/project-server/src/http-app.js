const { ProjectServerError } = require("./errors");

const prefix = "/api/projects";

function createHttpApp(options) {
  const service = options.service;

  return async function routeRequest(req, res) {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const path = url.pathname;

    if (req.method === "GET" && path === "/health") {
      sendJson(res, 200, { status: "ok", service: "project-server" });
      return;
    }

    if (req.method === "GET" && path === prefix) {
      sendJson(res, 200, { items: service.listProjects(Object.fromEntries(url.searchParams.entries())) });
      return;
    }
    if (req.method === "POST" && path === prefix) {
      sendJson(res, 201, service.createProject(await readJsonBody(req)));
      return;
    }

    const project = path.match(new RegExp(`^${prefix}/([^/]+)$`));
    if (req.method === "GET" && project) {
      sendJson(res, 200, service.getProject(decodeURIComponent(project[1])));
      return;
    }
    if (req.method === "PATCH" && project) {
      sendJson(res, 200, service.updateProject(decodeURIComponent(project[1]), await readJsonBody(req)));
      return;
    }

    const sources = path.match(new RegExp(`^${prefix}/([^/]+)/sources$`));
    if (req.method === "GET" && sources) {
      sendJson(res, 200, { items: service.listSources(decodeURIComponent(sources[1])) });
      return;
    }
    if (req.method === "PUT" && sources) {
      sendJson(res, 200, service.upsertSource(decodeURIComponent(sources[1]), await readJsonBody(req)));
      return;
    }

    const sourceSearch = path.match(new RegExp(`^${prefix}/([^/]+)/sources/search$`));
    if (req.method === "GET" && sourceSearch) {
      sendJson(res, 200, { items: service.searchSources(decodeURIComponent(sourceSearch[1]), {
        query: url.searchParams.get("q") || "",
        current_path: url.searchParams.get("current_path") || "",
        limit: url.searchParams.get("limit") || 6,
      }) });
      return;
    }

    const source = path.match(new RegExp(`^${prefix}/([^/]+)/sources/(.+)$`));
    if (req.method === "GET" && source) {
      sendJson(res, 200, service.getSource(decodeURIComponent(source[1]), decodeURIComponent(source[2])));
      return;
    }

    const projectBuildJobs = path.match(new RegExp(`^${prefix}/([^/]+)/build-jobs$`));
    if (req.method === "POST" && projectBuildJobs) {
      sendJson(res, 201, service.createBuildJob(decodeURIComponent(projectBuildJobs[1]), await readJsonBody(req)));
      return;
    }
    if (req.method === "GET" && projectBuildJobs) {
      sendJson(res, 200, { items: service.listBuildJobs({ project_id: decodeURIComponent(projectBuildJobs[1]) }) });
      return;
    }

    if (req.method === "GET" && path === "/api/build-jobs") {
      sendJson(res, 200, { items: service.listBuildJobs(Object.fromEntries(url.searchParams.entries())) });
      return;
    }

    const buildJob = path.match(/^\/api\/build-jobs\/([^/]+)$/);
    if (req.method === "GET" && buildJob) {
      sendJson(res, 200, service.getBuildJob(decodeURIComponent(buildJob[1])));
      return;
    }

    const buildPackage = path.match(/^\/api\/build-jobs\/([^/]+)\/build-package$/);
    if (req.method === "GET" && buildPackage) {
      sendJson(res, 200, service.createBuildPackage(decodeURIComponent(buildPackage[1])));
      return;
    }

    const submit = path.match(/^\/api\/build-jobs\/([^/]+)\/submitted$/);
    if (req.method === "POST" && submit) {
      sendJson(res, 200, service.markBuildSubmitted(decodeURIComponent(submit[1]), await readJsonBody(req)));
      return;
    }

    const result = path.match(/^\/api\/build-jobs\/([^/]+)\/result$/);
    if (req.method === "POST" && result) {
      sendJson(res, 200, service.recordBuildResult(decodeURIComponent(result[1]), await readJsonBody(req)));
      return;
    }

    if (req.method === "GET" && path === "/api/firmware-artifacts") {
      sendJson(res, 200, { items: service.listArtifacts(Object.fromEntries(url.searchParams.entries())) });
      return;
    }

    if (req.method === "POST" && path === "/api/learning-feedback") {
      sendJson(res, 201, service.createFeedback(await readJsonBody(req)));
      return;
    }
    if (req.method === "GET" && path === "/api/learning-feedback") {
      sendJson(res, 200, { items: service.listFeedback(Object.fromEntries(url.searchParams.entries())) });
      return;
    }

    const feedbackConsent = path.match(/^\/api\/learning-feedback\/([^/]+)\/contact-consent$/);
    if (req.method === "POST" && feedbackConsent) {
      sendJson(res, 201, service.createFeedbackConsent(decodeURIComponent(feedbackConsent[1]), await readJsonBody(req)));
      return;
    }

    if (req.method === "POST" && path === "/api/learning-feedback/anonymize-expired") {
      sendJson(res, 200, { items: service.anonymizeExpiredFeedback() });
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
      if (body.length > 5 * 1024 * 1024) {
        reject(new ProjectServerError("request_too_large", "Request ist zu gross.", 413));
        req.destroy();
      }
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new ProjectServerError("invalid_json", "Request Body ist kein gueltiges JSON."));
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
