function startRetentionScheduler({ service, intervalHours = 24, log = console, setIntervalImpl = setInterval }) {
  const run = () => {
    try { service.prune(); }
    catch (error) { log.error?.(`Telemetry-Retention fehlgeschlagen: ${error.message}`); }
  };
  run();
  const timer = setIntervalImpl(run, intervalHours * 60 * 60 * 1000);
  timer.unref?.();
  return timer;
}

module.exports = { startRetentionScheduler };
