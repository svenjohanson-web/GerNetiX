const { ProjectServerError } = require("./errors");
const {
  verifyInternalToken,
  verifyDelegation,
  assertDelegatedResource,
  readBearerToken,
} = require("../../shared/internal-api-auth");

const prefix = "/api/projects";

function createHttpApp(options) {
  const service = options.service;
  // Die aktuelle interne Authentifizierung verwendet einen Ed25519-Keyring.
  // Er darf nicht in einen String umgewandelt werden, sonst faellt die
  // Verifikation stillschweigend in den alten HMAC-Vertrag zurueck.
  const internalAuthSecret = options.internalAuthSecret || "";

  return async function routeRequest(req, res) {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const path = url.pathname;

    if (req.method === "GET" && path === "/health") {
      sendJson(res, 200, { status: "ok", service: "project-server" });
      return;
    }

    // The Project Server is an internal API.  A caller must first prove its
    // service identity; a signed delegation is checked separately below for
    // tenant resources.  This intentionally fails closed when no key exists.
    const requiredScope = requiredServiceScope(req.method, path);
    const serviceClaims = authorizeService(req, internalAuthSecret, requiredScope);
    if (!serviceClaims) {
      sendJson(res, 403, { error: "project_internal_access_denied" });
      return;
    }

    const projectRoute = path.match(new RegExp(`^${prefix}/([^/]+)`));
    if (projectRoute) {
      const projectId = decodeURIComponent(projectRoute[1]);
      if (!authorizeDelegatedProject(req, internalAuthSecret, requiredScope, projectId)) {
        sendJson(res, 403, { error: "project_delegated_access_denied" });
        return;
      }
    }

    if (req.method === "GET" && path === "/api/internal/repositories/summary") {
      if (!hasScope(serviceClaims, "project.admin")) {
        sendJson(res, 403, { error: "project_admin_access_denied" });
        return;
      }
      sendJson(res, 200, await service.repositoryAdministrationSummary());
      return;
    }

    if (req.method === "POST" && path === "/api/internal/repositories/migrations") {
      if (!hasScope(serviceClaims, "project.admin")) {
        sendJson(res, 403, { error: "project_admin_access_denied" });
        return;
      }
      sendJson(res, 200, await service.migrateProjectRepositories(await readJsonBody(req)));
      return;
    }

    const ownershipLookup = path.match(/^\/api\/internal\/project-ownership\/([^/]+)$/);
    if (req.method === "GET" && ownershipLookup) {
      const project = await service.getProject(decodeURIComponent(ownershipLookup[1]));
      const allocatedDeviceIds = [project.device_id, ...(project.build_config?.component_device_allocations || []).map((item) => item.device_id)]
        .map((value) => String(value || "").trim()).filter(Boolean);
      sendJson(res, 200, {
        project_id: project.project_id,
        account_id: project.user_id,
        allocated_device_ids: [...new Set(allocatedDeviceIds)],
      });
      return;
    }

    if (req.method === "GET" && path === prefix) {
      if (!authorizeDelegatedAccount(req, internalAuthSecret, requiredScope, url.searchParams.get("user_id") || url.searchParams.get("userId") || "")) {
        sendJson(res, 403, { error: "project_delegated_access_denied" });
        return;
      }
      sendJson(res, 200, { items: await service.listProjects(Object.fromEntries(url.searchParams.entries())) });
      return;
    }
    if (req.method === "POST" && path === prefix) {
      const body = await readJsonBody(req);
      if (!authorizeDelegatedAccount(req, internalAuthSecret, requiredScope, body.user_id || "")) {
        sendJson(res, 403, { error: "project_delegated_access_denied" });
        return;
      }
      sendJson(res, 201, await service.createProject(body));
      return;
    }

    if (req.method === "GET" && path === "/api/resource-policies") {
      sendJson(res, 200, await service.resourceSummary());
      return;
    }
    const accountResourcePolicy = path.match(/^\/api\/internal\/accounts\/([^/]+)\/resource-plan$/);
    if (req.method === "GET" && accountResourcePolicy) {
      if (!authorizeDelegatedAccount(req, internalAuthSecret, requiredScope, decodeURIComponent(accountResourcePolicy[1]))) {
        sendJson(res, 403, { error: "project_delegated_access_denied" });
        return;
      }
      sendJson(res, 200, await service.accountResourceSummary(
        decodeURIComponent(accountResourcePolicy[1]),
        url.searchParams.get("plan_id") || "free",
      ));
      return;
    }
    if (req.method === "PUT" && accountResourcePolicy) {
      if (!authorizeDelegatedAccount(req, internalAuthSecret, requiredScope, decodeURIComponent(accountResourcePolicy[1]))) {
        sendJson(res, 403, { error: "project_delegated_access_denied" });
        return;
      }
      sendJson(res, 200, await service.applyAccountResourcePlan(
        decodeURIComponent(accountResourcePolicy[1]),
        await readJsonBody(req),
      ));
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

    const debugSession = path.match(new RegExp(`^${prefix}/([^/]+)/debug-session$`));
    if (req.method === "GET" && debugSession) {
      sendJson(res, 200, await service.getDebugSession(decodeURIComponent(debugSession[1])));
      return;
    }
    if (req.method === "POST" && debugSession) {
      sendJson(res, 201, await service.startDebugSession(decodeURIComponent(debugSession[1]), await readJsonBody(req)));
      return;
    }
    if (req.method === "DELETE" && debugSession) {
      sendJson(res, 200, await service.endDebugSession(decodeURIComponent(debugSession[1])));
      return;
    }

    const projectApp = path.match(new RegExp(`^${prefix}/([^/]+)/project-app$`));
    if (req.method === "GET" && projectApp) {
      sendJson(res, 200, await service.getProjectAppSettings(
        decodeURIComponent(projectApp[1]),
        url.searchParams.get("account_id") || "",
      ));
      return;
    }
    if (req.method === "PUT" && projectApp) {
      sendJson(res, 200, await service.updateProjectAppSettings(
        decodeURIComponent(projectApp[1]),
        await readJsonBody(req),
      ));
      return;
    }
    const projectAppDevices = path.match(new RegExp(`^${prefix}/([^/]+)/project-app/devices$`));
    if (req.method === "PUT" && projectAppDevices) {
      sendJson(res, 200, await service.updateProjectAppDevices(
        decodeURIComponent(projectAppDevices[1]),
        await readJsonBody(req),
      ));
      return;
    }
    const debugSessionActivity = path.match(new RegExp(`^${prefix}/([^/]+)/debug-session/activity$`));
    if (req.method === "POST" && debugSessionActivity) {
      sendJson(res, 200, await service.touchDebugSession(decodeURIComponent(debugSessionActivity[1])));
      return;
    }

    const sources = path.match(new RegExp(`^${prefix}/([^/]+)/sources$`));
    if (req.method === "GET" && sources) {
      sendJson(res, 200, { items: await service.listSources(decodeURIComponent(sources[1]), {
        commit_sha: url.searchParams.get("commit_sha") || "",
      }) });
      return;
    }
    if (req.method === "PUT" && sources) {
      sendJson(res, 200, await service.upsertSource(decodeURIComponent(sources[1]), await readJsonBody(req)));
      return;
    }

    const repositoryCommits = path.match(new RegExp(`^${prefix}/([^/]+)/repository/commits$`));
    if (req.method === "POST" && repositoryCommits) {
      sendJson(res, 201, await service.commitRepositoryChanges(
        decodeURIComponent(repositoryCommits[1]),
        await readJsonBody(req),
      ));
      return;
    }
    const repositoryTree = path.match(new RegExp(`^${prefix}/([^/]+)/repository/tree$`));
    if (req.method === "GET" && repositoryTree) {
      sendJson(res, 200, await service.repositoryTree(
        decodeURIComponent(repositoryTree[1]),
        url.searchParams.get("commit_sha") || "",
      ));
      return;
    }
    const repositoryHistory = path.match(new RegExp(`^${prefix}/([^/]+)/repository/history$`));
    if (req.method === "GET" && repositoryHistory) {
      sendJson(res, 200, await service.repositoryHistory(decodeURIComponent(repositoryHistory[1]), {
        commit_sha: url.searchParams.get("commit_sha") || "",
        limit: url.searchParams.get("limit") || 30,
      }));
      return;
    }
    const repositoryDiff = path.match(new RegExp(`^${prefix}/([^/]+)/repository/commits/([^/]+)/diff$`));
    if (req.method === "GET" && repositoryDiff) {
      sendJson(res, 200, await service.repositoryDiff(
        decodeURIComponent(repositoryDiff[1]), decodeURIComponent(repositoryDiff[2]),
      ));
      return;
    }
    const repositoryRestore = path.match(new RegExp(`^${prefix}/([^/]+)/repository/restores$`));
    if (req.method === "POST" && repositoryRestore) {
      sendJson(res, 201, await service.restoreRepository(
        decodeURIComponent(repositoryRestore[1]), await readJsonBody(req),
      ));
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
        commit_sha: url.searchParams.get("commit_sha") || "",
        limit: url.searchParams.get("limit") || 6,
      }) });
      return;
    }

    const sourceRename = path.match(new RegExp(`^${prefix}/([^/]+)/sources/rename$`));
    if (req.method === "POST" && sourceRename) {
      sendJson(res, 200, await service.renameSource(decodeURIComponent(sourceRename[1]), await readJsonBody(req)));
      return;
    }

    const source = path.match(new RegExp(`^${prefix}/([^/]+)/sources/(.+)$`));
    if (req.method === "GET" && source) {
      sendJson(res, 200, await service.getSource(decodeURIComponent(source[1]), decodeURIComponent(source[2]), {
        commit_sha: url.searchParams.get("commit_sha") || "",
      }));
      return;
    }
    if (req.method === "DELETE" && source) {
      sendJson(res, 200, await service.deleteSource(
        decodeURIComponent(source[1]), decodeURIComponent(source[2]), await readJsonBody(req),
      ));
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
      if (!authorizeDelegatedAccount(req, internalAuthSecret, requiredScope, url.searchParams.get("user_id") || url.searchParams.get("userId") || "")) {
        sendJson(res, 403, { error: "project_delegated_access_denied" });
        return;
      }
      sendJson(res, 200, { items: await service.listBuildJobs(Object.fromEntries(url.searchParams.entries())) });
      return;
    }

    const buildJob = path.match(/^\/api\/build-jobs\/([^/]+)$/);
    if (req.method === "GET" && buildJob) {
      if (!await authorizeDelegatedBuildJob(req, internalAuthSecret, requiredScope, service, decodeURIComponent(buildJob[1]))) {
        sendJson(res, 403, { error: "project_delegated_access_denied" });
        return;
      }
      sendJson(res, 200, await service.getBuildJob(decodeURIComponent(buildJob[1])));
      return;
    }

    const buildPackage = path.match(/^\/api\/build-jobs\/([^/]+)\/build-package$/);
    if (req.method === "GET" && buildPackage) {
      if (!await authorizeDelegatedBuildJob(req, internalAuthSecret, requiredScope, service, decodeURIComponent(buildPackage[1]))) {
        sendJson(res, 403, { error: "project_delegated_access_denied" });
        return;
      }
      sendJson(res, 200, await service.createBuildPackage(decodeURIComponent(buildPackage[1])));
      return;
    }

    const buildReuseStatus = path.match(/^\/api\/build-jobs\/([^/]+)\/reuse-status$/);
    if (req.method === "GET" && buildReuseStatus) {
      if (!await authorizeDelegatedBuildJob(req, internalAuthSecret, requiredScope, service, decodeURIComponent(buildReuseStatus[1]))) {
        sendJson(res, 403, { error: "project_delegated_access_denied" });
        return;
      }
      sendJson(res, 200, await service.buildReuseStatus(decodeURIComponent(buildReuseStatus[1])));
      return;
    }

    const submit = path.match(/^\/api\/build-jobs\/([^/]+)\/submitted$/);
    if (req.method === "POST" && submit) {
      if (!await authorizeDelegatedBuildJob(req, internalAuthSecret, requiredScope, service, decodeURIComponent(submit[1]))) {
        sendJson(res, 403, { error: "project_delegated_access_denied" });
        return;
      }
      sendJson(res, 200, await service.markBuildSubmitted(decodeURIComponent(submit[1]), await readJsonBody(req)));
      return;
    }

    const result = path.match(/^\/api\/build-jobs\/([^/]+)\/result$/);
    if (req.method === "POST" && result) {
      if (!await authorizeDelegatedBuildJob(req, internalAuthSecret, requiredScope, service, decodeURIComponent(result[1]))) {
        sendJson(res, 403, { error: "project_delegated_access_denied" });
        return;
      }
      sendJson(res, 200, await service.recordBuildResult(decodeURIComponent(result[1]), await readJsonBody(req)));
      return;
    }

    if (req.method === "GET" && path === "/api/firmware-artifacts") {
      const projectId = url.searchParams.get("project_id") || url.searchParams.get("projectId") || "";
      if (!projectId || !authorizeDelegatedProject(req, internalAuthSecret, requiredScope, projectId)) {
        sendJson(res, 403, { error: "project_delegated_access_denied" });
        return;
      }
      sendJson(res, 200, { items: await service.listArtifacts(Object.fromEntries(url.searchParams.entries())) });
      return;
    }

    if (req.method === "POST" && path === "/api/learning-feedback") {
      sendJson(res, 201, await service.createFeedback(await readJsonBody(req)));
      return;
    }
    if (req.method === "POST" && path === "/api/template-feedback") {
      sendJson(res, 201, await service.createTemplateFeedback(await readJsonBody(req)));
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

function requiredServiceScope(method, path) {
  if (method === "GET" && path.startsWith("/api/internal/project-ownership/")) return "project.ownership.resolve";
  if (path === "/api/resource-policies" || path.startsWith("/api/resource-policies/") || path.startsWith("/api/internal/repositories/")) return "project.admin";
  if (path === "/api/learning-feedback" || path.startsWith("/api/learning-feedback/") || path === "/api/template-feedback") return "project.admin";
  return method === "GET" ? "project.read" : "project.write";
}

function authorizeService(req, secret, scope) {
  try {
    return verifyInternalToken(readBearerToken(req), secret, { audience: "project-server", requiredScopes: [scope] });
  } catch {
    return null;
  }
}

function authorizeDelegatedProject(req, secret, scope, projectId) {
  try {
    const claims = verifyDelegation(req.headers["x-gernetix-project-delegation"], secret, {
      audience: "project-server", requiredScopes: [scope],
    });
    assertDelegatedResource(claims, { projectId });
    return claims;
  } catch {
    return null;
  }
}

function authorizeDelegatedAccount(req, secret, scope, accountId) {
  try {
    if (!accountId) return null;
    const claims = verifyDelegation(req.headers["x-gernetix-project-delegation"], secret, {
      audience: "project-server", requiredScopes: [scope],
    });
    assertDelegatedResource(claims, { accountId });
    return claims;
  } catch {
    return null;
  }
}

async function authorizeDelegatedBuildJob(req, secret, scope, service, buildJobId) {
  try {
    const buildJob = await service.getBuildJob(buildJobId);
    return authorizeDelegatedProject(req, secret, scope, buildJob.project_id);
  } catch {
    return null;
  }
}

function hasScope(claims, scope) { return Array.isArray(claims?.scopes) && claims.scopes.includes(scope); }

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
