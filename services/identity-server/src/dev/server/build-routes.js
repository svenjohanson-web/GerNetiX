"use strict";

function registerBuildRoutes({
  registry,
  requireSession,
  readJsonBody,
  sendJson,
  handleUserIdeBuildJob,
  loadUserIdeProjects,
  buildDeployJson,
  projectServerJson,
  loadBuildDeployJob,
  recordCompletedBuildJob,
  browserFlashManifest,
  projectServerUserId,
  proxyBuildArtifact,
}) {
  registry.register({
    method: "POST",
    path: "/api/user-ide/build-jobs",
    async handler({ req, res }) {
      if (!await requireSession(req, res)) return;
      await handleUserIdeBuildJob(req, res);
    },
  });
  registry.register({
    method: "POST",
    path: "/api/user-ide/build-cache/clean",
    async handler({ req, res }) {
      const session = await requireSession(req, res);
      if (!session) return;
      const body = await readJsonBody(req);
      const projects = await loadUserIdeProjects(session);
      const project = projects.find((item) => item.slug === body.project_slug);
      if (!project) { sendJson(res, 404, { error: "project_not_found", message: "Projekt wurde nicht gefunden." }); return; }
      const result = await buildDeployJson("/api/build-cache/clean", {
        method: "POST",
        body: { project_id: project.project_server_id },
      });
      sendJson(res, 200, result);
    },
  });
  registry.register({
    method: "POST",
    pattern: /^\/api\/user-ide\/build-jobs\/([^/]+)\/browser-usb-flash-result$/,
    async handler({ req, res, match }) {
      if (!await requireSession(req, res)) return;
      const jobId = decodeURIComponent(match[1]);
      const body = await readJsonBody(req);
      const existing = await projectServerJson(`/api/build-jobs/${encodeURIComponent(jobId)}`);
      const updated = await projectServerJson(`/api/build-jobs/${encodeURIComponent(jobId)}/result`, {
        method: "POST",
        body: {
          status: body.status === "succeeded" ? "succeeded" : "failed",
          build: {
            ...(existing.result?.build || {}),
            usb_flash: {
              requested: true,
              status: body.status === "succeeded" ? "succeeded" : "failed",
              runner: "web_serial",
              transport: "web_serial",
              chip_name: body.chip_name || "",
              error: body.error || "",
            },
          },
          deploy: existing.result?.deploy || null,
          logs: body.logs || [],
          error: body.status === "succeeded" ? null : { message: body.error || "Browser Web-Serial-Flash fehlgeschlagen." },
        },
      });
      sendJson(res, 200, updated);
    },
  });
  registry.register({
    method: "GET",
    pattern: /^\/api\/user-ide\/build-jobs\/([^/]+)\/status$/,
    async handler({ req, res, match }) {
      if (!await requireSession(req, res)) return;
      const jobId = decodeURIComponent(match[1]);
      const job = await loadBuildDeployJob(jobId);
      const projectJob = await projectServerJson(`/api/build-jobs/${encodeURIComponent(jobId)}`).catch(() => null);
      if (["succeeded", "failed"].includes(job.status)) await recordCompletedBuildJob(jobId, job);
      sendJson(res, 200, {
        build_job_id: jobId,
        build_deploy_job_id: jobId,
        status: job.status,
        flash_status: job.mode === "build_and_flash"
          ? (job.result?.deploy?.status || "nicht angefordert")
          : (job.result?.build?.usb_flash?.status || "nicht angefordert"),
        flash_manifest: browserFlashManifest(jobId, job, projectJob?.build_config || {}),
        error: job.error?.message || projectJob?.error?.message || "",
        build_log: job.error?.details?.build_log || projectJob?.error?.details?.build_log || job.result?.build?.log || "",
        progress: Array.isArray(job.progress) ? job.progress : [],
      });
    },
  });
  registry.register({
    method: "GET",
    pattern: /^\/api\/user-ide\/build-artifacts\/([^/]+)\/([^/]+)$/,
    async handler({ req, res, match }) {
      const session = await requireSession(req, res);
      if (!session) return;
      const jobId = decodeURIComponent(match[1]);
      const job = await projectServerJson(`/api/build-jobs/${encodeURIComponent(jobId)}`).catch(() => null);
      if (!job || job.user_id !== projectServerUserId(session)) {
        sendJson(res, 404, { error: "build_artifact_not_found" });
        return;
      }
      await proxyBuildArtifact(res, jobId, decodeURIComponent(match[2]));
    },
  });
}

module.exports = { registerBuildRoutes };
