const net = require("node:net");
const tls = require("node:tls");

class MqttTransport {
  constructor(options = {}) {
    this.url = new URL(options.url);
    this.clientId = options.clientId || `gernetix-build-${process.pid}`;
    this.username = options.username || "";
    this.password = options.password || "";
    this.topicFilter = options.topicFilter || "gernetix/devices/+/status/#";
    this.onMessage = options.onMessage || (() => {});
    this.telemetry = options.telemetry || null;
    this.socket = null;
    this.buffer = Buffer.alloc(0);
    this.packetId = 1;
    this.pending = new Map();
    this.connectPromise = null;
    this.started = false;
    this.keepaliveTimer = null;
  }

  async start() {
    this.started = true;
    await this.ensureConnected();
    await this.subscribe(this.topicFilter);
  }

  async publish(topic, payload, options = {}) {
    const startedAt = Date.now();
    try {
      await this.ensureConnected();
    const qos = options.qos === 1 ? 1 : 0;
    const retain = options.retain === true ? 1 : 0;
    const packetId = qos ? this.nextPacketId() : 0;
    const variable = Buffer.concat([mqttString(topic), ...(qos ? [uint16(packetId)] : [])]);
    const packet = packetBuffer(0x30 | (qos << 1) | retain, Buffer.concat([variable, Buffer.from(payload)]));
    if (!qos) {
      this.socket.write(packet);
      this.recordTelemetry("PUBLISH", topic, true, Date.now() - startedAt);
      return;
    }
    const acknowledged = waitForPacket(this.pending, `puback:${packetId}`, 5000);
    this.socket.write(packet);
    await acknowledged;
      this.recordTelemetry("PUBLISH", topic, true, Date.now() - startedAt);
    } catch (error) {
      this.recordTelemetry("PUBLISH", topic, false, Date.now() - startedAt);
      throw error;
    }
  }

  async subscribe(topic) {
    const startedAt = Date.now();
    try {
    const packetId = this.nextPacketId();
    const packet = packetBuffer(0x82, Buffer.concat([uint16(packetId), mqttString(topic), Buffer.from([1])]));
    const acknowledged = waitForPacket(this.pending, `suback:${packetId}`, 5000);
    this.socket.write(packet);
    await acknowledged;
      this.recordTelemetry("SUBSCRIBE", topic, true, Date.now() - startedAt);
    } catch (error) {
      this.recordTelemetry("SUBSCRIBE", topic, false, Date.now() - startedAt);
      throw error;
    }
  }

  async ensureConnected() {
    if (this.socket && !this.socket.destroyed) return;
    if (this.connectPromise) return this.connectPromise;
    this.connectPromise = new Promise((resolve, reject) => {
      const secure = this.url.protocol === "mqtts:";
      const port = Number(this.url.port || (secure ? 8883 : 1883));
      const socket = secure
        ? tls.connect({ host: this.url.hostname, port, servername: this.url.hostname })
        : net.connect({ host: this.url.hostname, port });
      this.socket = socket;
      const onError = (error) => reject(error);
      socket.once("error", onError);
      socket.on("data", (chunk) => this.consume(chunk, resolve, reject));
      socket.on("close", () => {
        this.stopKeepalive();
        this.socket = null;
        this.connectPromise = null;
        if (this.started) setTimeout(() => this.start().catch(() => {}), 2000).unref?.();
      });
      socket.on(secure ? "secureConnect" : "connect", () => socket.write(connectPacket(this.clientId, this.username, this.password)));
    }).finally(() => { this.connectPromise = null; });
    return this.connectPromise;
  }

  consume(chunk, connectResolve, connectReject) {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    while (this.buffer.length > 1) {
      const remaining = decodeRemainingLength(this.buffer, 1);
      if (!remaining || this.buffer.length < remaining.offset + remaining.value) return;
      const header = this.buffer[0];
      const payload = this.buffer.subarray(remaining.offset, remaining.offset + remaining.value);
      this.buffer = this.buffer.subarray(remaining.offset + remaining.value);
      const type = header >> 4;
      if (type === 2) {
        if (payload[1] !== 0) connectReject(new Error(`MQTT CONNACK ${payload[1]}`));
        else {
          this.startKeepalive();
          connectResolve();
        }
      } else if (type === 4) resolvePending(this.pending, `puback:${payload.readUInt16BE(0)}`);
      else if (type === 9) resolvePending(this.pending, `suback:${payload.readUInt16BE(0)}`);
      else if (type === 3) this.receivePublish(header, payload);
    }
  }

  receivePublish(header, payload) {
    const topicLength = payload.readUInt16BE(0);
    const topic = payload.subarray(2, 2 + topicLength).toString();
    const qos = (header >> 1) & 0x03;
    let offset = 2 + topicLength;
    let packetId = 0;
    if (qos) { packetId = payload.readUInt16BE(offset); offset += 2; }
    Promise.resolve(this.onMessage(topic, payload.subarray(offset).toString())).catch(() => {});
    this.recordTelemetry("RECEIVE", topic, true, 0);
    if (qos === 1) this.socket.write(packetBuffer(0x40, uint16(packetId)));
  }

  nextPacketId() { this.packetId = this.packetId >= 65535 ? 1 : this.packetId + 1; return this.packetId; }

  startKeepalive() {
    this.stopKeepalive();
    this.keepaliveTimer = setInterval(() => {
      if (this.socket && !this.socket.destroyed) this.socket.write(Buffer.from([0xc0, 0x00]));
    }, 30000);
    this.keepaliveTimer.unref?.();
  }

  stopKeepalive() {
    if (this.keepaliveTimer) clearInterval(this.keepaliveTimer);
    this.keepaliveTimer = null;
  }

  recordTelemetry(method, topic, succeeded, durationMs) {
    this.telemetry?.record({
      targetService: "mqtt-broker",
      method,
      route: normalizeMqttTopic(topic),
      statusCode: succeeded ? 200 : 0,
      durationMs,
      succeeded,
    });
  }
}

function normalizeMqttTopic(topic) {
  return String(topic || "").replace(/^(gernetix\/devices\/)[^/]+/, "$1{device}").slice(0, 300);
}

function connectPacket(clientId, username, password) {
  let flags = 0x02;
  const fields = [mqttString(clientId)];
  if (username) { flags |= 0x80; fields.push(mqttString(username)); }
  if (password) { flags |= 0x40; fields.push(mqttString(password)); }
  return packetBuffer(0x10, Buffer.concat([mqttString("MQTT"), Buffer.from([4, flags]), uint16(60), ...fields]));
}
function mqttString(value) { const content = Buffer.from(String(value)); return Buffer.concat([uint16(content.length), content]); }
function uint16(value) { const result = Buffer.alloc(2); result.writeUInt16BE(value); return result; }
function packetBuffer(header, payload) { return Buffer.concat([Buffer.from([header]), encodeRemainingLength(payload.length), payload]); }
function encodeRemainingLength(value) { const bytes=[];do{let digit=value%128;value=Math.floor(value/128);if(value)digit|=128;bytes.push(digit);}while(value);return Buffer.from(bytes); }
function decodeRemainingLength(buffer, start) { let multiplier=1,value=0,index=start;while(index<buffer.length&&index<start+4){const digit=buffer[index++];value+=(digit&127)*multiplier;if(!(digit&128))return{value,offset:index};multiplier*=128;}return null; }
function waitForPacket(pending, key, timeoutMs) { return new Promise((resolve,reject)=>{const timeout=setTimeout(()=>{pending.delete(key);reject(new Error(`MQTT timeout: ${key}`));},timeoutMs);pending.set(key,()=>{clearTimeout(timeout);resolve();});}); }
function resolvePending(pending,key){const resolve=pending.get(key);if(resolve){pending.delete(key);resolve();}}

module.exports = { MqttTransport, connectPacket, decodeRemainingLength, encodeRemainingLength, normalizeMqttTopic, packetBuffer };
