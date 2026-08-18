const { issueInternalToken } = require("../../../shared/internal-api-auth");

function createUserActionReporter(options = {}) {
  const baseUrl = String(options.baseUrl || "").replace(/\/$/, "");
  const signingKey = String(options.internalApiSigningKey || "");
  const fetchImpl = options.fetchImpl || fetch;
  const logger = options.logger || console;
  const timeoutMs = Number(options.timeoutMs || 700);
  const outbox = options.outboxStore ? createOutbox(options.outboxStore, logger, Number(options.outboxLimit || 10000)) : null;
  const emergencyLimit = Math.max(20, Number(options.emergencyLimit || 200));
  const emergencyQueue = new Map();
  const recentFailures = new Map();

  function remember(map, event, extra = {}) {
    const safe = diagnosticEvent(event, extra);
    map.delete(safe.event_id);
    map.set(safe.event_id, safe);
    while (map.size > emergencyLimit) map.delete(map.keys().next().value);
  }

  function rememberFailure(event, deliveryState) {
    if (["failed", "timed_out", "unhandled"].includes(event.phase)) {
      remember(recentFailures, event, { delivery_state: deliveryState });
    }
  }

  async function deliver(event) {
    if (!baseUrl || !signingKey) return false;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const token = issueInternalToken({ iss: "identity-server", sub: "identity-server", aud: "admin-tool", scopes: ["operations.user_actions.write"] }, signingKey);
      const response = await fetchImpl(`${baseUrl}/api/internal/user-action-events`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(event),
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`Admin Tool antwortete mit HTTP ${response.status}.`);
      return true;
    } catch (error) {
      logger.warn?.(`User action event delivery failed: ${error.message || error}`);
      return false;
    } finally {
      clearTimeout(timeout);
    }
  }

  async function reportUserActionEvent(event) {
    let persisted = false;
    if (outbox) {
      try { await outbox.enqueue(event); persisted = true; }
      catch (error) {
        logger.warn?.(`User action outbox enqueue failed: ${error.message || error}`);
        remember(emergencyQueue, event);
      }
    }
    const delivered = await deliver(event);
    if (!delivered && !persisted) remember(emergencyQueue, event);
    rememberFailure(event, delivered ? "delivered" : "pending");
    if (delivered && persisted) {
      try { await outbox.remove(event.event_id); }
      catch (error) { logger.warn?.(`User action outbox cleanup failed: ${error.message || error}`); }
      await flushOutbox(20);
    }
    if (delivered) emergencyQueue.delete(event.event_id);
    return delivered;
  }

  async function flushOutbox(maxItems = 100) {
    let items = [];
    if (outbox) {
      try { items = await outbox.pending(); }
      catch (error) { logger.warn?.(`User action outbox read failed: ${error.message || error}`); }
    }
    const persistedIds = new Set(items.map((event) => event.event_id));
    const emergencyItems = [...emergencyQueue.values()].filter((event) => !persistedIds.has(event.event_id));
    const pendingItems = [...items, ...emergencyItems];
    let deliveredCount = 0;
    for (const event of pendingItems.slice(0, Math.max(1, maxItems))) {
      if (!await deliver(event)) break;
      if (persistedIds.has(event.event_id)) {
        try { await outbox.remove(event.event_id); }
        catch (error) {
          logger.warn?.(`User action outbox cleanup failed: ${error.message || error}`);
          break;
        }
      }
      emergencyQueue.delete(event.event_id);
      rememberFailure(event, "delivered");
      deliveredCount += 1;
    }
    return { pending: pendingItems.length - deliveredCount, delivered: deliveredCount };
  }

  reportUserActionEvent.flush = () => flushOutbox(100);
  reportUserActionEvent.pending = async () => {
    let persisted = [];
    if (outbox) {
      try { persisted = await outbox.pending(); }
      catch (error) { logger.warn?.(`User action outbox read failed: ${error.message || error}`); }
    }
    return new Set([...persisted.map((event) => event.event_id), ...emergencyQueue.keys()]).size;
  };
  reportUserActionEvent.diagnostics = () => ({
    pending: emergencyQueue.size,
    items: [...recentFailures.values()].sort((a, b) => String(b.occurred_at).localeCompare(String(a.occurred_at))),
  });
  return reportUserActionEvent;
}

function diagnosticEvent(event, extra = {}) {
  const allowed = [
    "event_id", "occurred_at", "action_type", "action_id", "span_type", "span_id",
    "parent_span_id", "phase", "reason_code", "route_id", "release_id", "duration_bucket",
  ];
  const safe = {};
  for (const key of allowed) if (event[key] !== undefined) safe[key] = event[key];
  if (extra.delivery_state) safe.delivery_state = extra.delivery_state;
  return safe;
}

function createOutbox(store, logger, limit) {
  let sequence = Promise.resolve();
  function serialize(operation) {
    const result = sequence.then(operation, operation);
    sequence = result.catch((error) => logger.warn?.(`User action outbox operation failed: ${error.message || error}`));
    return result;
  }
  return {
    enqueue(event) {
      return serialize(async () => {
        const state = store.load();
        const items = (state.items || []).filter((item) => item.event_id !== event.event_id);
        items.push(event);
        await store.save({ items: items.slice(-Math.max(100, limit)) });
      });
    },
    remove(eventId) {
      return serialize(async () => {
        const state = store.load();
        await store.save({ items: (state.items || []).filter((item) => item.event_id !== eventId) });
      });
    },
    pending() {
      return serialize(async () => store.load().items || []);
    },
  };
}

module.exports = { createOutbox, createUserActionReporter, diagnosticEvent };
