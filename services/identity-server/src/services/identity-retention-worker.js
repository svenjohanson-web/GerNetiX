"use strict";

function createIdentityRetentionWorker(options) {
  const cleanup = options.cleanup;
  const logger = options.logger || console;
  const intervalMs = Math.max(60_000, Number(options.intervalMs || 60 * 60 * 1000));
  let activeRun = null;
  let timer = null;
  let scheduled = false;

  function run() {
    if (activeRun) return activeRun;
    activeRun = Promise.resolve()
      .then(() => cleanup())
      .catch((error) => {
        logger.warn?.(`Identity retention cleanup failed: ${safeMessage(error)}`);
        return { unavailable: true };
      })
      .finally(() => { activeRun = null; });
    return activeRun;
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    setTimeout(() => { scheduled = false; void run(); }, 0);
  }

  function start() {
    if (timer) return timer;
    timer = setInterval(() => void run(), intervalMs);
    timer.unref?.();
    schedule();
    return timer;
  }

  function stop() {
    if (timer) clearInterval(timer);
    timer = null;
  }

  return { run, schedule, start, stop };
}

function createIdentityRetentionCleanup(options) {
  const env = options.env || process.env;
  const clock = options.clock || (() => Date.now());
  return async function cleanup() {
    const auth = options.getAuth();
    const now = Number(clock());
    const dayMs = 24 * 60 * 60 * 1000;
    const result = {
      notification_deliveries: { enabled: false, purged: { terminal: 0, failed: 0, total: 0 } },
      authentication_records: { enabled: false, purged: { verification_tokens: 0, password_reset_tokens: 0, support_recoveries: 0, total: 0 } },
    };
    if (env.COMMUNITY_NOTIFICATION_RETENTION_ENABLED === "1") {
      const terminalDays = boundedDays(env.COMMUNITY_NOTIFICATION_DELIVERED_RETENTION_DAYS, 30);
      const failedDays = boundedDays(env.COMMUNITY_NOTIFICATION_DEAD_LETTER_RETENTION_DAYS, 90);
      result.notification_deliveries = {
        enabled: true,
        purged: await auth.purge_community_notification_deliveries({
          terminal_before: new Date(now - terminalDays * dayMs).toISOString(),
          failed_before: new Date(now - failedDays * dayMs).toISOString(),
        }),
      };
    }
    if (env.IDENTITY_TOKEN_RETENTION_ENABLED === "1") {
      const tokenDays = boundedDays(env.IDENTITY_EXPIRED_TOKEN_RETENTION_DAYS, 7);
      const supportDays = boundedDays(env.IDENTITY_SUPPORT_RECOVERY_RETENTION_DAYS, 30);
      result.authentication_records = {
        enabled: true,
        purged: await auth.purge_expired_authentication_records({
          token_before: new Date(now - tokenDays * dayMs).toISOString(),
          support_recovery_before: new Date(now - supportDays * dayMs).toISOString(),
        }),
      };
    }
    return result;
  };
}

function safeMessage(error) {
  return String(error?.code || error?.message || "cleanup_failed").replace(/[\r\n]/g, " ").slice(0, 160);
}

function boundedDays(value, fallback) {
  const days = Number(value || fallback);
  return Number.isInteger(days) && days >= 1 && days <= 365 ? days : fallback;
}

module.exports = { createIdentityRetentionCleanup, createIdentityRetentionWorker };
