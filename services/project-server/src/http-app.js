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
      sendJson(res, 200, { items: await service.listProjects(Object.fromEntries(url.searchParams.entries())) });
      return;
    }
    if (req.method === "POST" && path === prefix) {
      sendJson(res, 201, await service.createProject(await readJsonBody(req)));
      return;
    }

    if (req.method === "GET" && path === "/api/resource-policies") {
      sendJson(res, 200, await service.resourceSummary());
      return;
    }
    const resourcePolicy = path.match(/^\/api\/resource-policies\/([^/]+)$/);
    if (req.method === "PUT" && resourcePolicy) {
      sendJson(res, 200, await service.updateResourcePolicy(decodeURIComponent(resourcePolicy[1]), await readJsonBody(req)));
      return;
    }

    const project = path.match(new RegExp(`^${prefix}/([^/]+)$`));
    if (req.method === "GET" && project) {
      sendJson(res, 200, await service.getProject(decodeURIComponent(project[1])));
      return;
    }
    if (req.method === "PATCH" && project) {
      sendJson(res, 200, await service.updateProject(decodeURIComponent(project[1]), await readJsonBody(req)));
      return;
    }
    if (req.method === "DELETE" && project) {
      sendJson(res, 200, await service.deleteProject(decodeURIComponent(project[1])));
      return;
    }

    const sources = path.match(new RegExp(`^${prefix}/([^/]+)/sources$`));
    if (req.method === "GET" && sources) {
      sendJson(res, 200, { items: await service.listSources(decodeURIComponent(sources[1])) });
      return;
    }
    if (req.method === "PUT" && sources) {
      sendJson(res, 200, await service.upsertSource(decodeURIComponent(sources[1]), await readJsonBody(req)));
      return;
    }

    const versions = path.match(new RegExp(`^${prefix}/([^/]+)/versions$`));
    if (req.method === "GET" && versions) {
      sendJson(res, 200, { items: await service.listVersions(decodeURIComponent(versions[1])) });
      return;
    }
    if (req.method === "POST" && versions) {
      sendJson(res, 201, await service.createVersion(decodeURIComponent(versions[1]), await readJsonBody(req)));
      return;
    }
    const restoreVersion = path.match(new RegExp(`^${prefix}/([^/]+)/versions/([^/]+)/restore$`));
    if (req.method === "POST" && restoreVersion) {
      sendJson(res, 201, await service.restoreVersion(decodeURIComponent(restoreVersion[1]), decodeURIComponent(restoreVersion[2]), await readJsonBody(req)));
      return;
    }

    const learningProgress = path.match(new RegExp(`^${prefix}/([^/]+)/learning-progress$`));
    if (req.method === "GET" && learningProgress) {
      sendJson(res, 200, await service.getLearningProgress(
        decodeURIComponent(learningProgress[1]),
        url.searchParams.get("user_id") || "",
      ));
      return;
    }
    if (req.method === "PUT" && learningProgress) {
      sendJson(res, 200, await service.updateLearningProgress(
        decodeURIComponent(learningProgress[1]),
        await readJsonBody(req),
      ));
      return;
    }

    const sourceSearch = path.match(new RegExp(`^${prefix}/([^/]+)/sources/search$`));
    if (req.method === "GET" && sourceSearch) {
      sendJson(res, 200, { items: await service.searchSources(decodeURIComponent(sourceSearch[1]), {
        query: url.searchParams.get("q") || "",
        current_path: url.searchParams.get("current_path") || "",
        source_kind: url.searchParams.get("source_kind") || "",
        limit: url.searchParams.get("limit") || 6,
      }) });
      return;
    }

    const source = path.match(new RegExp(`^${prefix}/([^/]+)/sources/(.+)$`));
    if (req.method === "GET" && source) {
      sendJson(res, 200, await service.getSource(decodeURIComponent(source[1]), decodeURIComponent(source[2])));
      return;
    }

    const projectBuildJobs = path.match(new RegExp(`^${prefix}/([^/]+)/build-jobs$`));
    if (req.method === "POST" && projectBuildJobs) {
      sendJson(res, 201, await service.createBuildJob(decodeURIComponent(projectBuildJobs[1]), await readJsonBody(req)));
      return;
    }
    if (req.method === "GET" && projectBuildJobs) {
      sendJson(res, 200, { items: await service.listBuildJobs({ project_id: decodeURIComponent(projectBuildJobs[1]) }) });
      return;
    }

    if (req.method === "GET" && path === "/api/build-jobs") {
      sendJson(res, 200, { items: await service.listBuildJobs(Object.fromEntries(url.searchParams.entries())) });
      return;
    }

    const buildJob = path.match(/^\/api\/build-jobs\/([^/]+)$/);
    if (req.method === "GET" && buildJob) {
      sendJson(res, 200, await service.getBuildJob(decodeURIComponent(buildJob[1])));
      return;
    }

    const buildPackage = path.match(/^\/api\/build-jobs\/([^/]+)\/build-package$/);
    if (req.method === "GET" && buildPackage) {
      sendJson(res, 200, await service.createBuildPackage(decodeURIComponent(buildPackage[1])));
      return;
    }

    const buildReuseStatus = path.match(/^\/api\/build-jobs\/([^/]+)\/reuse-status$/);
    if (req.method === "GET" && buildReuseStatus) {
      sendJson(res, 200, await service.buildReuseStatus(decodeURIComponent(buildReuseStatus[1])));
      return;
    }

    const submit = path.match(/^\/api\/build-jobs\/([^/]+)\/submitted$/);
    if (req.method === "POST" && submit) {
      sendJson(res, 200, await service.markBuildSubmitted(decodeURIComponent(submit[1]), await readJsonBody(req)));
      return;
    }

    const result = path.match(/^\/api\/build-jobs\/([^/]+)\/result$/);
    if (req.method === "POST" && result) {
      sendJson(res, 200, await service.recordBuildResult(decodeURIComponent(result[1]), await readJsonBody(req)));
      return;
    }

    if (req.method === "GET" && path === "/api/firmware-artifacts") {
      sendJson(res, 200, { items: await service.listArtifacts(Object.fromEntries(url.searchParams.entries())) });
      return;
    }

    if (req.method === "POST" && path === "/api/learning-feedback") {
      sendJson(res, 201, await service.createFeedback(await readJsonBody(req)));
      return;
    }
    if (req.method === "GET" && path === "/api/learning-feedback") {
      sendJson(res, 200, { items: await service.listFeedback(Object.fromEntries(url.searchParams.entries())) });
      return;
    }

    const feedbackConsent = path.match(/^\/api\/learning-feedback\/([^/]+)\/contact-consent$/);
    if (req.method === "POST" && feedbackConsent) {
      sendJson(res, 201, await service.createFeedbackConsent(decodeURIComponent(feedbackConsent[1]), await readJsonBody(req)));
      return;
    }

    if (req.method === "POST" && path === "/api/learning-feedback/anonymize-expired") {
      sendJson(res, 200, { items: await service.anonymizeExpiredFeedback() });
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
