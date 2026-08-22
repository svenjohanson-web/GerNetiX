"use strict";

function createProjectSourceService({ projectServerJson, requireSessionProject, touchWorkspace, readJsonBody, readUserActionContext, sendJson }) {
  function ideRoute(projectId) { return `/app/ide/?project=${encodeURIComponent(projectId)}`; }
  async function read(res, session, projectId, sourcePath) {
    const project = await requireSessionProject(session, projectId);
    const source = await projectServerJson(`/api/projects/${encodeURIComponent(project.project_server_id)}/sources/${encodeURIComponent(sourcePath)}`, projectAccess(session, project));
    touchWorkspace(session, project.project_server_id, "ide", ideRoute(project.project_server_id));
    sendJson(res, 200, source);
  }
  async function list(res, session, projectId) {
    const project = await requireSessionProject(session, projectId);
    const sources = await projectServerJson(`/api/projects/${encodeURIComponent(project.project_server_id)}/sources`, projectAccess(session, project));
    touchWorkspace(session, project.project_server_id, "ide", ideRoute(project.project_server_id));
    sendJson(res, 200, sources);
  }
  async function search(res, session, projectId, searchParams) {
    const project = await requireSessionProject(session, projectId);
    const query = new URLSearchParams({ q: String(searchParams.get("q") || "").slice(0, 1000), current_path: String(searchParams.get("current_path") || "").slice(0, 300), limit: "6" });
    const result = await projectServerJson(`/api/projects/${encodeURIComponent(project.project_server_id)}/sources/search?${query}`, projectAccess(session, project));
    sendJson(res, 200, result);
  }
  async function write(req, res, session, projectId, sourcePath) {
    const project = await requireSessionProject(session, projectId);
    const body = await readJsonBody(req);
    const actionContext = readUserActionContext(req, "project.build.start");
    const source = await projectServerJson(`/api/projects/${encodeURIComponent(project.project_server_id)}/sources`, {
      method: "PUT", ...(actionContext ? { headers: actionContext.headers } : {}),
      internalAuth: projectAccess(session, project, "project.write").internalAuth,
      body: { path: sourcePath, content: String(body.content || ""), content_type: body.content_type || "text/x-c++src", role: body.role || "user_code", ...(project.repository_binding?.state === "active" ? { expected_head_sha: project.repository_binding.head_sha } : {}) },
    });
    touchWorkspace(session, project.project_server_id, "ide", ideRoute(project.project_server_id));
    sendJson(res, 200, source);
  }
  async function persistGenerated(project, sources, message) {
    const binding = project.repository_binding;
    if (binding?.state === "active" && binding.head_sha) {
      const result = await projectServerJson(`/api/projects/${encodeURIComponent(project.project_server_id)}/repository/commits`, { method: "POST", internalAuth: projectAccess(null, project, "project.write").internalAuth, body: { expected_head_sha: binding.head_sha, message, changes: sources.map((source) => ({ operation: "upsert", path: source.path, content: source.content, content_type: source.content_type, role: source.role })) } });
      return result.commit?.head_sha || binding.head_sha;
    }
    await Promise.all(sources.map((source) => projectServerJson(`/api/projects/${encodeURIComponent(project.project_server_id)}/sources`, { method: "PUT", internalAuth: projectAccess(null, project, "project.write").internalAuth, body: source })));
    return "";
  }
  return { read, list, search, write, persistGenerated };
}

function projectAccess(session, project, scope = "project.read") {
  const accountId = String(session?.account?.user_id || project.owner_user_id || project.user_id || "");
  return {
    internalAuth: {
      scopes: [scope],
      delegation: { account_id: accountId, project_ids: [String(project.project_server_id)] },
    },
  };
}

module.exports = { createProjectSourceService };
