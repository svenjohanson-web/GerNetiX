(function initGerNetiXActionOps(root) {
  "use strict";

  const endpoint = "/api/operations/user-actions";
  const pending = new Map();

  function begin(actionType, options = {}) {
    const record = claimPending(actionType) || createRecord(actionType, options, true);
    record.claimed = true;
    clearTimeout(record.unhandledTimer);
    record.releaseId = safeToken(options.releaseId || record.releaseId);
    emit(record, { phase: "started", spanType: "action", spanId: record.rootSpanId });
    record.actionTimer = setTimeout(() => {
      if (record.finished) return;
      record.finished = true;
      emit(record, { phase: "timed_out", reasonCode: "action_timed_out", spanType: "action", spanId: record.rootSpanId });
    }, boundedTimeout(options.timeoutMs || record.timeoutMs));
    return actionHandle(record);
  }

  function actionHandle(record) {
    return {
      id: record.actionId,
      type: record.actionType,
      failureMessage(message) { return supportMessage(message, record.actionId); },
      startSpan(spanType, parentSpanId = record.rootSpanId) {
        const span = { id: randomId(), type: spanType, parentSpanId, startedAt: Date.now(), finished: false };
        emit(record, { phase: "started", spanType, spanId: span.id, parentSpanId });
        return {
          id: span.id,
          succeed() { finishSpan(record, span, "succeeded", ""); },
          fail(reasonCode) { finishSpan(record, span, "failed", reasonCode); },
        };
      },
      async step(spanType, operation, reasonCode = "unknown_client_failure") {
        const span = this.startSpan(spanType);
        try {
          const result = await operation();
          span.succeed();
          return result;
        } catch (error) {
          span.fail(typeof reasonCode === "function" ? reasonCode(error) : reasonCode);
          throw error;
        }
      },
      succeed() { finishAction(record, "succeeded", ""); },
      fail(reasonCode) { finishAction(record, "failed", reasonCode); },
    };
  }

  function observeActivation(element) {
    const actionType = safeToken(element?.dataset?.actionType);
    if (!actionType) return null;
    const existing = pending.get(actionType);
    if (existing && !existing.claimed && !existing.finished && Date.now() - existing.startedAt < 1000) return existing.actionId;
    const record = createRecord(actionType, {
      releaseId: element.dataset.actionRelease,
      timeoutMs: element.dataset.actionTimeout,
    }, true);
    pending.set(actionType, record);
    record.unhandledTimer = setTimeout(() => {
      if (record.claimed || record.finished) return;
      record.finished = true;
      emit(record, { phase: "unhandled", reasonCode: "action_handler_missing", spanType: "action", spanId: record.rootSpanId });
    }, 1000);
    return record.actionId;
  }

  function createRecord(actionType, options, emitTriggered) {
    const record = {
      actionType: safeToken(actionType), actionId: randomId(), rootSpanId: randomId(),
      releaseId: safeToken(options.releaseId), timeoutMs: boundedTimeout(options.timeoutMs),
      startedAt: Date.now(), claimed: false, finished: false, actionTimer: null, unhandledTimer: null,
    };
    if (emitTriggered) emit(record, { phase: "triggered", spanType: "action", spanId: record.rootSpanId });
    return record;
  }

  function claimPending(actionType) {
    const record = pending.get(actionType);
    pending.delete(actionType);
    if (!record || record.finished || Date.now() - record.startedAt > 5000) return null;
    return record;
  }

  function finishSpan(record, span, phase, reasonCode) {
    if (span.finished || record.finished) return;
    span.finished = true;
    emit(record, {
      phase, reasonCode, spanType: span.type, spanId: span.id,
      parentSpanId: span.parentSpanId, durationBucket: durationBucket(Date.now() - span.startedAt),
    });
  }

  function finishAction(record, phase, reasonCode) {
    if (record.finished) return;
    record.finished = true;
    clearTimeout(record.actionTimer);
    clearTimeout(record.unhandledTimer);
    emit(record, {
      phase, reasonCode, spanType: "action", spanId: record.rootSpanId,
      durationBucket: durationBucket(Date.now() - record.startedAt),
    });
  }

  function emit(record, event) {
    const body = {
      action_type: record.actionType,
      action_id: record.actionId,
      span_type: safeToken(event.spanType || "action"),
      span_id: event.spanId,
      parent_span_id: event.parentSpanId || "",
      phase: event.phase,
      reason_code: safeToken(event.reasonCode),
      route_id: root.location?.pathname || "/",
      release_id: record.releaseId,
      duration_bucket: event.durationBucket || "",
    };
    if (typeof root.fetch !== "function") return;
    void root.fetch(endpoint, {
      method: "POST", credentials: "same-origin", keepalive: true,
      headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    }).catch(() => {});
  }

  function durationBucket(milliseconds) {
    if (milliseconds < 100) return "lt_100ms";
    if (milliseconds < 1000) return "lt_1s";
    if (milliseconds < 5000) return "lt_5s";
    if (milliseconds < 30000) return "lt_30s";
    if (milliseconds < 120000) return "lt_2m";
    return "gte_2m";
  }

  function boundedTimeout(value) {
    const timeout = Number(value || 600000);
    return Number.isFinite(timeout) ? Math.max(1000, Math.min(timeout, 15 * 60 * 1000)) : 600000;
  }

  function safeToken(value) { return String(value || "").slice(0, 100); }
  function randomId() { return root.crypto?.randomUUID?.() || "00000000-0000-4000-8000-000000000000"; }
  function supportMessage(message, action) {
    const actionId = typeof action === "string" ? action : action?.id;
    const text = String(message || "Die Aktion ist fehlgeschlagen.");
    return actionId && !text.includes(actionId) ? `${text} Vorgangs-ID: ${actionId}` : text;
  }

  if (root.document?.addEventListener) {
    root.document.addEventListener("click", (event) => {
      const element = event.target?.closest?.("[data-action-type]");
      if (element && !element.disabled) observeActivation(element);
    }, true);
    root.document.addEventListener("change", (event) => {
      const element = event.target?.closest?.("[data-action-type]");
      if (element && !element.disabled) observeActivation(element);
    }, true);
  }

  const api = { begin, durationBucket, observeActivation, supportMessage };
  root.GerNetiXActionOps = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);

/*
 * Diese Datei veroeffentlicht ihre Schnittstelle nach UMD-Art durch Zuweisung
 * an das globale Objekt. Es gibt keine gleichnamige Bindung, also wird sie hier
 * angelegt: derselbe Wert, nur ansprechbar fuer den export.
 *
 * Eine Uebergangsbruecke braucht diese Datei deshalb auch nicht -- die
 * Zuweisung oben ist bereits eine, und sie war es immer schon.
 */
const GerNetiXActionOps = globalThis.GerNetiXActionOps;

export {
  GerNetiXActionOps,
};
