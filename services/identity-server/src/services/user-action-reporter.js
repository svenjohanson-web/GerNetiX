function createUserActionReporter(options = {}) {
  const baseUrl = String(options.baseUrl || "").replace(/\/$/, "");
  const ingestToken = String(options.ingestToken || "");
  const fetchImpl = options.fetchImpl || fetch;
  const logger = options.logger || console;
  const timeoutMs = Number(options.timeoutMs || 700);
  const outbox = options.outboxStore ? createOutbox(options.outboxStore, logger, Number(options.outboxLimit || 10000)) : null;

  async function deliver(event) {
    if (!baseUrl || !ingestToken) return false;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(`${baseUrl}/api/internal/user-action-events`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-GerNetiX-System-Event-Token": ingestToken,
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
      catch (error) { logger.warn?.(`User action outbox enqueue failed: ${error.message || error}`); }
    }
    const delivered = await deliver(event);
    if (delivered && persisted) {
      try { await outbox.remove(event.event_id); }
      catch (error) { logger.warn?.(`User action outbox cleanup failed: ${error.message || error}`); }
      await flushOutbox(20);
    }
    return delivered;
  }

  async function flushOutbox(maxItems = 100) {
    if (!outbox) return { pending: 0, delivered: 0 };
    const items = await outbox.pending();
    let deliveredCount = 0;
    for (const event of items.slice(0, Math.max(1, maxItems))) {
      if (!await deliver(event)) break;
      await outbox.remove(event.event_id);
      deliveredCount += 1;
    }
    return { pending: items.length - deliveredCount, delivered: deliveredCount };
  }

  reportUserActionEvent.flush = () => flushOutbox(100);
  reportUserActionEvent.pending = async () => outbox ? (await outbox.pending()).length : 0;
  return reportUserActionEvent;
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

module.exports = { createOutbox, createUserActionReporter };
