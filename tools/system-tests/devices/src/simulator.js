const { EventEmitter } = require("node:events");
const { assertDevicePublishTopic, buildTelemetryPayload, heartbeatTopic, normalizeDeviceId, telemetryTopic } = require("./contracts");

class DeviceSimulator extends EventEmitter {
  constructor({ config, clientFactory, random = Math.random, now = () => new Date(), timers = globalThis }) {
    super();
    this.config = config;
    this.clientFactory = clientFactory;
    this.random = random;
    this.now = now;
    this.timers = timers;
    this.sessions = new Map();
    this.stopping = false;
    this.stats = createStats(config.deviceCount);
  }

  async start() {
    this.stopping = false;
    for (let index = 0; index < this.config.deviceCount; index += 1) {
      const deviceId = normalizeDeviceId(`${this.config.devicePrefix}-${String(index + 1).padStart(5, "0")}`);
      const session = { deviceId, sequence: 0, reconnectAttempts: 0, connected: false, timers: new Set() };
      session.client = this.clientFactory({ deviceId });
      session.client.on?.("disconnect", () => this.handleDisconnect(session));
      this.sessions.set(deviceId, session);
      const delay = this.config.deviceCount === 1 ? 0 : Math.floor(index * this.config.connectionRampMs / (this.config.deviceCount - 1));
      this.schedule(session, () => this.connect(session), delay);
    }
    return this;
  }

  async connect(session) {
    if (this.stopping || session.connected) return;
    this.stats.connectAttempts += 1;
    try {
      await session.client.connect();
      if (this.stopping) { session.client.close(); return; }
      session.connected = true;
      session.reconnectAttempts = 0;
      this.stats.connected += 1;
      this.stats.peakConnected = Math.max(this.stats.peakConnected, this.stats.connected);
      this.emit("connected", session.deviceId);
      this.schedule(session, () => this.publishCycle(session), 0);
    } catch (error) {
      this.stats.connectionFailures += 1;
      this.retryConnect(session, error);
    }
  }

  handleDisconnect(session) {
    if (session.connected) {
      session.connected = false;
      this.stats.connected = Math.max(0, this.stats.connected - 1);
      this.stats.disconnects += 1;
    }
    if (!this.stopping) this.retryConnect(session, new Error("connection lost"));
  }

  retryConnect(session, error) {
    if (this.stopping) return;
    session.reconnectAttempts += 1;
    if (session.reconnectAttempts > this.config.maxReconnectAttempts) {
      this.stats.reconnectExhausted += 1;
      this.emit("deviceFailed", { deviceId: session.deviceId, reason: safeErrorReason(error) });
      return;
    }
    this.stats.reconnectScheduled += 1;
    const exponential = Math.min(this.config.reconnectMaxMs, this.config.reconnectBaseMs * 2 ** (session.reconnectAttempts - 1));
    const jittered = Math.floor(exponential * (0.75 + this.random() * 0.5));
    this.schedule(session, () => this.connect(session), jittered);
  }

  async publishCycle(session) {
    if (this.stopping || !session.connected) return;
    session.sequence += 1;
    const measuredAt = this.now();
    const payload = buildTelemetryPayload({
      deviceId: session.deviceId,
      projectId: this.config.projectId,
      sequence: session.sequence,
      measuredAt,
      value: Number((20 + this.random() * 10).toFixed(3)),
    });
    const encoded = JSON.stringify(payload);
    const delayed = this.random() < this.config.delayedRate;
    const publish = () => this.publish(session, telemetryTopic(session.deviceId), encoded, delayed ? "delayed" : "telemetry");
    if (delayed) {
      this.stats.delayedScheduled += 1;
      this.schedule(session, publish, this.config.delayedByMs);
    } else await publish();
    if (this.random() < this.config.duplicateRate) {
      this.stats.duplicatesScheduled += 1;
      await this.publish(session, telemetryTopic(session.deviceId), encoded, "duplicate");
    }
    if (this.config.heartbeatEvery > 0 && session.sequence % this.config.heartbeatEvery === 0) {
      await this.publish(session, heartbeatTopic(session.deviceId), JSON.stringify({ device_id: session.deviceId, status: "online", timestamp: measuredAt.toISOString() }), "heartbeat");
    }
    this.schedule(session, () => this.publishCycle(session), this.config.telemetryIntervalMs);
  }

  async publish(session, topic, payload, kind) {
    try {
      assertDevicePublishTopic(session.deviceId, topic);
      await session.client.publish(topic, payload);
      this.stats.published += 1;
      this.stats[`${kind}Published`] += 1;
    } catch (error) {
      this.stats.publishFailures += 1;
      this.emit("publishFailed", { deviceId: session.deviceId, kind, reason: safeErrorReason(error) });
    }
  }

  schedule(session, fn, delay) {
    if (this.stopping) return null;
    const timer = this.timers.setTimeout(() => {
      session.timers.delete(timer);
      Promise.resolve(fn()).catch((error) => this.emit("internalError", safeErrorReason(error)));
    }, delay);
    timer.unref?.();
    session.timers.add(timer);
    return timer;
  }

  stop() {
    this.stopping = true;
    for (const session of this.sessions.values()) {
      for (const timer of session.timers) this.timers.clearTimeout(timer);
      session.timers.clear();
      session.client.close();
      session.connected = false;
    }
    this.stats.connected = 0;
    this.stats.finishedAt = new Date().toISOString();
    return this.summary();
  }

  summary() {
    return { ...this.stats, configuredDevices: this.config.deviceCount };
  }
}

function createStats(configuredDevices) {
  return {
    configuredDevices,
    connected: 0,
    peakConnected: 0,
    connectAttempts: 0,
    connectionFailures: 0,
    disconnects: 0,
    reconnectScheduled: 0,
    reconnectExhausted: 0,
    published: 0,
    telemetryPublished: 0,
    duplicatePublished: 0,
    delayedPublished: 0,
    heartbeatPublished: 0,
    duplicatesScheduled: 0,
    delayedScheduled: 0,
    publishFailures: 0,
    finishedAt: null,
  };
}

function safeErrorReason(error) {
  const code = String(error && error.code || "");
  if (code && /^[A-Z0-9_]{1,40}$/.test(code)) return code;
  const message = String(error && error.message || "error").toLowerCase();
  if (message.includes("timeout")) return "timeout";
  if (message.includes("identity boundary")) return "identity_boundary";
  if (message.includes("connack")) return "broker_rejected";
  return "connection_error";
}

module.exports = { DeviceSimulator, createStats, safeErrorReason };
