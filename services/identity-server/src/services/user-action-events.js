"use strict";

const crypto = require("node:crypto");

const ACTION_TYPES = new Set([
  "identity.login.passkey",
  "nexi.flash.usb.start",
  "project.build.start",
  "project.settings.save",
]);
const PHASES = new Set(["triggered", "started", "succeeded", "failed", "timed_out", "unhandled"]);
const SPAN_TYPES = new Set([
  "action", "release.prepare", "helper.status", "helper.ports", "board.probe",
  "manifest.load", "firmware.download", "board.flash", "flash.verify", "commissioning.open",
  "auth.options", "auth.webauthn", "auth.verify", "auth.session",
  "project.settings.validate", "project.settings.persist", "project.settings.refresh",
  "project.source.persist", "build.submit", "build.wait", "build.verify",
]);
const REASON_CODES = new Set([
  "", "action_handler_missing", "action_timed_out", "local_dependency_unreachable",
  "local_device_missing", "multiple_local_devices", "board_probe_failed", "board_incompatible",
  "manifest_unavailable", "artifact_download_failed", "artifact_verification_failed",
  "helper_update_failed", "flash_failed", "flash_verification_failed", "unknown_client_failure",
  "authentication_options_failed", "passkey_cancelled", "passkey_not_supported", "passkey_origin_invalid",
  "authentication_verification_failed", "identity_unreachable", "account_unavailable",
  "project_not_found", "settings_validation_failed", "settings_conflict", "settings_persistence_failed",
  "build_prerequisite_failed", "source_persistence_failed", "build_submission_failed",
  "build_execution_failed", "build_cancelled", "build_status_unavailable",
]);
const DURATION_BUCKETS = new Set(["", "lt_100ms", "lt_1s", "lt_5s", "lt_30s", "lt_2m", "gte_2m"]);
const ROUTES = new Set([
  "/app/auth/",
  "/app/development-platform/",
  "/app/ide/",
  "/app/project-app/",
  "/nachbauprojekte/nexi-sprachassistent/",
]);
const ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const RELEASE_PATTERN = /^[A-Za-z0-9._-]{1,80}$/;

function normalizeUserActionEvent(input, now = new Date()) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw invalid("invalid_user_action_event");
  const actionType = allowed(input.action_type, ACTION_TYPES, "unknown_action_type");
  const phase = allowed(input.phase, PHASES, "invalid_action_phase");
  const spanType = allowed(input.span_type || "action", SPAN_TYPES, "invalid_action_span");
  const reasonCode = allowed(input.reason_code || "", REASON_CODES, "invalid_action_reason");
  const routeId = allowed(input.route_id, ROUTES, "invalid_action_route");
  const durationBucket = allowed(input.duration_bucket || "", DURATION_BUCKETS, "invalid_duration_bucket");
  const actionId = validId(input.action_id, "invalid_action_id");
  const spanId = validId(input.span_id, "invalid_span_id");
  const parentSpanId = input.parent_span_id ? validId(input.parent_span_id, "invalid_parent_span_id") : "";
  const parentActionId = input.parent_action_id ? validId(input.parent_action_id, "invalid_parent_action_id") : "";
  const releaseId = String(input.release_id || "");
  if (releaseId && !RELEASE_PATTERN.test(releaseId)) throw invalid("invalid_release_id");
  return {
    event_id: crypto.randomUUID(),
    occurred_at: now.toISOString(),
    action_type: actionType,
    action_id: actionId,
    span_type: spanType,
    span_id: spanId,
    parent_span_id: parentSpanId,
    parent_action_id: parentActionId,
    phase,
    reason_code: reasonCode,
    route_id: routeId,
    release_id: releaseId,
    duration_bucket: durationBucket,
  };
}

function createUserActionIngestHandler(options) {
  const attempts = new Map();
  const limit = Number(options.limit || 120);
  const windowMs = Number(options.windowMs || 60_000);
  return async function handleUserActionIngest(req, res) {
    if (!sameOrigin(req)) { options.sendJson(res, 403, { error: "user_action_origin_denied" }); return; }
    const key = String(req.socket?.remoteAddress || "browser");
    const now = Date.now();
    const current = attempts.get(key);
    const bucket = !current || current.expiresAt <= now ? { count: 0, expiresAt: now + windowMs } : current;
    bucket.count += 1;
    attempts.set(key, bucket);
    if (bucket.count > limit) { options.sendJson(res, 429, { error: "user_action_rate_limited" }); return; }
    try {
      const event = normalizeUserActionEvent(await options.readJsonBody(req));
      const delivered = await options.reportUserAction(event);
      options.sendJson(res, 202, { accepted: true, delivered, action_id: event.action_id });
    } catch (error) {
      options.sendJson(res, error.status || 400, { error: error.code || "invalid_user_action_event" });
    }
  };
}

function sameOrigin(req) {
  const origin = String(req.headers.origin || "");
  if (!origin) return false;
  try { return new URL(origin).host === String(req.headers.host || ""); } catch { return false; }
}

function allowed(value, values, code) {
  const normalized = String(value || "");
  if (!values.has(normalized)) throw invalid(code);
  return normalized;
}

function validId(value, code) {
  const normalized = String(value || "");
  if (!ID_PATTERN.test(normalized)) throw invalid(code);
  return normalized.toLowerCase();
}

function invalid(code) {
  const error = new Error(code);
  error.code = code;
  error.status = 400;
  return error;
}

function readUserActionContext(req, expectedType = "") {
  const actionId = String(req?.headers?.["x-gernetix-action-id"] || "").trim();
  const actionType = String(req?.headers?.["x-gernetix-action-type"] || "").trim();
  if (!actionId && !actionType) return null;
  if (!ID_PATTERN.test(actionId) || !ACTION_TYPES.has(actionType)) return null;
  if (expectedType && actionType !== expectedType) return null;
  return {
    actionId: actionId.toLowerCase(),
    actionType,
    headers: {
      "X-GerNetiX-Action-Id": actionId.toLowerCase(),
      "X-GerNetiX-Action-Type": actionType,
    },
  };
}

module.exports = { createUserActionIngestHandler, normalizeUserActionEvent, readUserActionContext };
