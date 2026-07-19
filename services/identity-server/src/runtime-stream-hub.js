function createRuntimeStreamHub() {
  const subscribers = new Map();

  function subscribe({ accountId, projectId, send }) {
    const key = streamKey(accountId, projectId);
    const entries = subscribers.get(key) || new Set();
    entries.add(send);
    subscribers.set(key, entries);
    return () => {
      entries.delete(send);
      if (!entries.size) subscribers.delete(key);
    };
  }

  function publish({ accountId, projectId, deviceId, channel = "serial", line, occurredAt = new Date().toISOString() }) {
    const payload = JSON.stringify({ device_id: text(deviceId, 128), channel: text(channel, 32) || "serial", line: text(line, 500), occurred_at: occurredAt });
    for (const send of subscribers.get(streamKey(accountId, projectId)) || []) send(payload);
  }

  function streamKey(accountId, projectId) { return `${text(accountId, 128)}:${text(projectId, 128)}`; }
  return { publish, subscribe };
}

function text(value, max) { return String(value || "").trim().slice(0, max); }

module.exports = { createRuntimeStreamHub };
