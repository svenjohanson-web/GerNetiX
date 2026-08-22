"use strict";

function createCommunityNotificationOutboxWorker(options) {
  const communityJson = options.communityJson;
  const deliver = options.deliver;
  const logger = options.logger || console;
  const intervalMs = Math.max(5_000, Number(options.intervalMs || 15_000));
  let activeFlush = null;
  let timer = null;
  let scheduled = false;

  async function runFlush() {
    const batch = await communityJson("/api/community/notification-outbox/claim", {
      method: "POST",
      body: { limit: 25, lease_seconds: 60 },
    });
    let delivered = 0;
    let retried = 0;
    for (const event of batch.events || []) {
      try {
        const result = await deliver(event);
        if (["sent", "skipped"].includes(result?.status)) {
          await communityJson(`/api/community/notification-outbox/${encodeURIComponent(event.event_id)}/complete`, {
            method: "POST",
            body: { outcome: result.status },
          });
          delivered += 1;
        } else {
          await retry(event, result?.status === "processing" ? "identity_delivery_processing" : "identity_delivery_failed");
          retried += 1;
        }
      } catch (error) {
        try {
          await retry(event, "identity_delivery_unavailable");
        } catch (retryError) {
          logger.warn?.(`Community notification outbox retry failed: ${safeMessage(retryError)}`);
        }
        retried += 1;
      }
    }
    return { claimed: (batch.events || []).length, delivered, retried };
  }

  function flush() {
    if (activeFlush) return activeFlush;
    activeFlush = runFlush()
      .catch((error) => {
        logger.warn?.(`Community notification outbox unavailable: ${safeMessage(error)}`);
        return { claimed: 0, delivered: 0, retried: 0, unavailable: true };
      })
      .finally(() => { activeFlush = null; });
    return activeFlush;
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    setTimeout(() => {
      scheduled = false;
      void flush();
    }, 0);
  }

  function start() {
    if (timer) return timer;
    timer = setInterval(() => void flush(), intervalMs);
    timer.unref?.();
    schedule();
    return timer;
  }

  function stop() {
    if (timer) clearInterval(timer);
    timer = null;
  }

  async function retry(event, errorCode) {
    await communityJson(`/api/community/notification-outbox/${encodeURIComponent(event.event_id)}/retry`, {
      method: "POST",
      body: { attempts: event.attempts, error_code: errorCode },
    });
  }

  return { flush, schedule, start, stop };
}

function safeMessage(error) {
  return String(error?.code || error?.message || "request_failed").replace(/[\r\n]/g, " ").slice(0, 160);
}

module.exports = { createCommunityNotificationOutboxWorker };
